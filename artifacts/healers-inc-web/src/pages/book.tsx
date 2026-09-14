import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Zap,
} from 'lucide-react';
import {
  getGetAppConfigQueryKey,
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  useCreateBooking,
  useGetAppConfig,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  type AvailabilitySlot,
  type Service,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { cn } from '@workspace/healers-inc/lib/utils';

import { EmptyState } from '@/pages/discover';
import { PageLoader, RequireClient } from '@/components/route-guards';
import { errorMessage, errorStatus } from '@/lib/errors';
import {
  calendarParts,
  formatCalendarDate,
  formatDuration,
  formatMoney,
  makeIdempotencyKey,
  sessionFormatLabel,
  todayIso,
  zoneCity,
} from '@/lib/format';
import { useViewerTimezone } from '@/lib/session';

/** How many calendar days ahead we ask the API for at once. */
const WINDOW_DAYS = 14;

export default function BookPage() {
  return (
    <RequireClient>
      <BookFlow />
    </RequireClient>
  );
}

function BookFlow() {
  const params = useParams<{ practitionerId: string }>();
  const practitionerId = params.practitionerId ?? '';
  const search = useSearch();
  const [, navigate] = useLocation();
  const viewerTimezone = useViewerTimezone();

  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const preselectedServiceId = searchParams.get('serviceId');
  const preselectedStartsAt = searchParams.get('startsAt');

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState('');
  const [rangeOffset, setRangeOffset] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // One idempotency key per booking attempt, so a retried request cannot
  // create a second appointment.
  const idempotencyKey = useRef(makeIdempotencyKey());

  const appConfig = useGetAppConfig({
    query: { queryKey: getGetAppConfigQueryKey(), staleTime: 5 * 60_000 },
  });

  const profileQuery = useGetPractitionerProfile(practitionerId, {
    query: {
      queryKey: getGetPractitionerProfileQueryKey(practitionerId),
      enabled: !!practitionerId,
    },
  });
  const profile = profileQuery.data;

  const activeServices = useMemo(
    () => (profile?.services ?? []).filter((s) => s.isActive),
    [profile?.services],
  );

  useEffect(() => {
    document.title = profile
      ? `Book ${profile.practitioner.fullName} — Healers Inc`
      : 'Book a session — Healers Inc';
  }, [profile]);

  // Preselect the service once the profile loads.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current || activeServices.length === 0) return;
    didPreselect.current = true;
    const match = activeServices.find((s) => s.id === preselectedServiceId);
    setServiceId(match ? match.id : activeServices[0].id);
  }, [activeServices, preselectedServiceId]);

  const selectedService = useMemo(
    () => activeServices.find((s) => s.id === serviceId) ?? null,
    [activeServices, serviceId],
  );

  const from = todayIso(rangeOffset, viewerTimezone);
  const to = todayIso(rangeOffset + WINDOW_DAYS, viewerTimezone);

  const availabilityParams = {
    practitionerId,
    serviceId: serviceId ?? '',
    from,
    to,
    timezone: viewerTimezone,
  };
  const availabilityQuery = useGetPractitionerAvailability(availabilityParams, {
    query: {
      queryKey: getGetPractitionerAvailabilityQueryKey(availabilityParams),
      enabled: !!serviceId,
    },
  });

  const calendar = availabilityQuery.data;
  const daysWithSlots = useMemo(
    () => (calendar?.days ?? []).filter((d) => d.slots.length > 0),
    [calendar?.days],
  );

  // Keep the selected day valid as availability changes.
  useEffect(() => {
    if (daysWithSlots.length === 0) {
      setSelectedDate(null);
      setSelectedSlot(null);
      return;
    }
    setSelectedDate((prev) =>
      prev && daysWithSlots.some((d) => d.date === prev)
        ? prev
        : daysWithSlots[0].date,
    );
  }, [daysWithSlots]);

  const activeDay = useMemo(
    () => daysWithSlots.find((d) => d.date === selectedDate) ?? null,
    [daysWithSlots, selectedDate],
  );

  // Honour a slot handed over from the profile's availability preview, once.
  const didPreselectSlot = useRef(false);
  useEffect(() => {
    if (didPreselectSlot.current || !preselectedStartsAt) return;
    const match = daysWithSlots
      .flatMap((d) => d.slots.map((slot) => ({ date: d.date, slot })))
      .find((entry) => entry.slot.startsAt === preselectedStartsAt);
    if (!match) return;
    didPreselectSlot.current = true;
    setSelectedDate(match.date);
    setSelectedSlot(match.slot);
  }, [daysWithSlots, preselectedStartsAt]);

  // Drop a stale slot when the day changes.
  useEffect(() => {
    setSelectedSlot((prev) =>
      prev && activeDay?.slots.some((s) => s.startsAt === prev.startsAt)
        ? prev
        : null,
    );
  }, [activeDay]);

  const sameZone = calendar?.sameTimezone ?? true;
  const practitionerTz = calendar?.practitionerTimezone;
  const createBooking = useCreateBooking();
  const canConfirm = !!selectedService && !!selectedSlot;

  const confirm = () => {
    if (!selectedService || !selectedSlot) return;
    setSubmitError(null);
    createBooking.mutate(
      {
        data: {
          practitionerId,
          serviceId: selectedService.id,
          startsAt: selectedSlot.startsAt,
          clientTimezone: viewerTimezone,
          notes: notes.trim() ? notes.trim() : null,
          idempotencyKey: idempotencyKey.current,
        },
      },
      {
        onSuccess: (appointment) => navigate(`/bookings/${appointment.id}`),
        onError: (err) => {
          // A fresh key so the retry counts as a new attempt.
          idempotencyKey.current = makeIdempotencyKey();
          if (errorStatus(err) === 409) {
            setSubmitError(
              'That time was just taken. Pick another slot — availability has been refreshed.',
            );
            setSelectedSlot(null);
            void availabilityQuery.refetch();
          } else {
            setSubmitError(errorMessage(err, 'Could not complete the booking.'));
          }
        },
      },
    );
  };

  if (profileQuery.isLoading) return <PageLoader label="Loading services…" />;

  if (profileQuery.isError || !profile) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't start booking"
            description={errorMessage(
              profileQuery.error,
              "We couldn't load this practitioner's services.",
            )}
            action={
              <Button variant="outline" asChild>
                <Link href="/discover">Back to discover</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  if (activeServices.length === 0) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <EmptyState
            icon={<Clock className="w-6 h-6 text-primary" aria-hidden />}
            title="No bookable services"
            description="This practitioner has no services open for booking right now."
            action={
              <Button variant="outline" asChild>
                <Link href={`/practitioner/${practitionerId}`}>Back to profile</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const instant = profile.policy.instantBooking;

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-40 px-4 sm:px-6"
      data-testid="page-book"
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link
            href={`/practitioner/${practitionerId}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="back-to-profile"
          >
            ← {profile.practitioner.fullName}
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mt-2">
            Book a session
          </h1>
        </div>

        <div className="flex flex-col gap-10">
          {/* Step 1 — service */}
          <Step number={1} title="Choose a service">
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Service">
              {activeServices.map((service) => (
                <ServiceOption
                  key={service.id}
                  service={service}
                  currency={profile.practitioner.currency}
                  selected={service.id === serviceId}
                  onSelect={() => {
                    setServiceId(service.id);
                    setSelectedDate(null);
                    setSelectedSlot(null);
                    setRangeOffset(0);
                  }}
                />
              ))}
            </div>
          </Step>

          {/* Step 2 — day */}
          {selectedService ? (
            <Step number={2} title="Pick a day">
              {availabilityQuery.isLoading ? (
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="w-16 h-[72px] rounded-md" />
                  ))}
                </div>
              ) : availabilityQuery.isError ? (
                <Card>
                  <CardContent className="p-5 flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      Couldn't load availability.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void availabilityQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              ) : daysWithSlots.length === 0 ? (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-sm text-muted-foreground">
                    {rangeOffset === 0
                      ? 'Nothing available in the next two weeks.'
                      : 'Still nothing open in this range.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRangeOffset((o) => o + WINDOW_DAYS)}
                    data-testid="look-further-empty"
                  >
                    Look further ahead
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
                    role="radiogroup"
                    aria-label="Day"
                  >
                    {daysWithSlots.map((day) => {
                      const active = day.date === selectedDate;
                      const { day: dayNum, weekday } = calendarParts(day.date);
                      return (
                        <button
                          key={day.date}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={formatCalendarDate(day.date)}
                          onClick={() => setSelectedDate(day.date)}
                          data-testid={`day-${day.date}`}
                          className={cn(
                            'w-16 shrink-0 py-2.5 rounded-md border-2 flex flex-col items-center gap-0.5 transition-colors',
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-foreground hover:border-primary/50',
                          )}
                        >
                          <span
                            className={cn(
                              'text-xs',
                              active
                                ? 'text-primary-foreground/80'
                                : 'text-muted-foreground',
                            )}
                          >
                            {weekday}
                          </span>
                          <span className="text-lg font-semibold">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    className="self-start gap-1 px-0"
                    onClick={() => setRangeOffset((o) => o + WINDOW_DAYS)}
                    data-testid="look-further"
                  >
                    Look further ahead
                    <ChevronRight className="w-4 h-4" aria-hidden />
                  </Button>
                </div>
              )}
            </Step>
          ) : null}

          {/* Step 3 — time */}
          {selectedService && activeDay ? (
            <Step number={3} title="Pick a time">
              {!sameZone && practitionerTz ? (
                <div
                  className="flex items-start gap-2 rounded-md bg-secondary px-3 py-2.5 mb-4"
                  data-testid="timezone-note"
                >
                  <Globe className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                  <p className="text-sm text-secondary-foreground leading-relaxed">
                    Times show in your zone ({zoneCity(viewerTimezone)}) first,
                    with {zoneCity(practitionerTz)} for your practitioner below.
                  </p>
                </div>
              ) : null}

              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-label="Session time"
              >
                {activeDay.slots.map((slot) => {
                  const active = slot.startsAt === selectedSlot?.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setSelectedSlot(slot)}
                      data-testid={`slot-${slot.startsAt}`}
                      className={cn(
                        'px-4 py-2.5 rounded-md border-2 flex flex-col items-center transition-colors',
                        active
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground hover:border-primary/50',
                      )}
                    >
                      <span className="font-medium">{slot.viewerLabel}</span>
                      {!sameZone ? (
                        <span
                          className={cn(
                            'text-xs',
                            active
                              ? 'text-primary-foreground/80'
                              : 'text-muted-foreground',
                          )}
                        >
                          {slot.practitionerLabel} their time
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </Step>
          ) : null}

          {/* Step 4 — notes */}
          {selectedSlot ? (
            <Step number={4} title="Anything to share?">
              <Field>
                <FieldLabel htmlFor="notes" className="sr-only">
                  Notes for your practitioner
                </FieldLabel>
                <Textarea
                  id="notes"
                  rows={4}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What would you like to focus on?"
                  data-testid="input-notes"
                />
                <FieldDescription>
                  Optional — this note goes to your practitioner with the request.
                </FieldDescription>
              </Field>
            </Step>
          ) : null}

          {/* Summary */}
          {canConfirm && selectedService && selectedSlot ? (
            <section aria-labelledby="summary-heading" data-testid="booking-summary">
              <h2
                id="summary-heading"
                className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3"
              >
                Review &amp; confirm
              </h2>
              <Card>
                <CardContent className="p-5 flex flex-col gap-3">
                  <SummaryRow label="Practitioner" value={profile.practitioner.fullName} />
                  <SummaryRow label="Service" value={selectedService.name} />
                  <Separator />
                  <SummaryRow
                    label="Duration"
                    value={formatDuration(selectedService.durationMinutes)}
                  />
                  <SummaryRow
                    label="Format"
                    value={sessionFormatLabel[selectedService.format]}
                  />
                  <SummaryRow
                    label="Price"
                    value={formatMoney(
                      selectedService.priceCents,
                      selectedService.currency || profile.practitioner.currency,
                    )}
                    emphasize
                  />
                  <Separator />
                  <SummaryRow
                    label="Date"
                    value={selectedDate ? formatCalendarDate(selectedDate, true) : '—'}
                  />
                  <SummaryRow
                    label={`Time (${zoneCity(viewerTimezone)})`}
                    value={selectedSlot.viewerLabel}
                    emphasize
                  />
                  {!sameZone && practitionerTz ? (
                    <SummaryRow
                      label={`Their time (${zoneCity(practitionerTz)})`}
                      value={selectedSlot.practitionerLabel}
                    />
                  ) : null}
                  <Separator />
                  <div className="flex items-center gap-3">
                    {instant ? (
                      <Zap className="w-4 h-4 text-primary shrink-0" aria-hidden />
                    ) : (
                      <Clock className="w-4 h-4 text-primary shrink-0" aria-hidden />
                    )}
                    <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
                      {instant
                        ? 'Confirmed instantly once you book.'
                        : 'Sent as a request — the practitioner confirms it.'}
                    </p>
                    <Badge variant={instant ? 'default' : 'outline'}>
                      {instant ? 'Instant' : 'Request'}
                    </Badge>
                  </div>
                  {appConfig.data?.paymentsEnabled ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      No payment is taken now. If this practitioner supports in-app
                      payments, you'll be asked to pay securely once the session is
                      confirmed.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </section>
          ) : null}
        </div>
      </div>

      {/* Sticky confirm bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 sm:px-6 py-3 z-40">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          {submitError ? (
            <p
              role="alert"
              className="text-sm text-destructive"
              data-testid="booking-error"
            >
              {submitError}
            </p>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            disabled={!canConfirm || createBooking.isPending}
            onClick={confirm}
            data-testid="button-confirm-booking"
          >
            {createBooking.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Booking…
              </>
            ) : !selectedService ? (
              'Choose a service'
            ) : !selectedSlot ? (
              'Choose a time'
            ) : instant ? (
              'Confirm booking'
            ) : (
              'Send booking request'
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`step-${number}`}>
      <h2 id={`step-${number}`} className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-muted-foreground/60 tabular-nums">
          0{number}
        </span>
        <span className="text-lg font-semibold text-foreground">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function ServiceOption({
  service,
  currency,
  selected,
  onSelect,
}: {
  service: Service;
  currency: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={`service-option-${service.id}`}
      className={cn(
        'flex items-center gap-3 p-4 rounded-md border-2 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground">{service.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatDuration(service.durationMinutes)} ·{' '}
          {sessionFormatLabel[service.format]}
        </p>
      </div>
      <span className="font-medium text-foreground shrink-0">
        {formatMoney(service.priceCents, service.currency || currency)}
      </span>
      <span
        className={cn(
          'w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center',
          selected ? 'border-primary bg-primary' : 'border-border',
        )}
        aria-hidden
      >
        {selected ? (
          <Check className="w-3 h-3 text-primary-foreground" aria-hidden />
        ) : null}
      </span>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'text-right',
          emphasize ? 'font-semibold text-foreground' : 'text-sm text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}
