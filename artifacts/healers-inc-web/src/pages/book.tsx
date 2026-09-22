import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Globe } from 'lucide-react';
import {
  getGetAppConfigQueryKey,
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  getListAppointmentsQueryKey,
  useCreateBooking,
  useGetAppConfig,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  type AvailabilitySlot,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { BookingSummary, cancellationNotice } from '@/components/booking/booking-summary';
import { ServicePicker } from '@/components/booking/service-picker';
import { SlotPicker } from '@/components/booking/slot-picker';
import {
  EmptyState,
  ErrorBanner,
  ErrorState,
  LoadingBlock,
  Page,
  PageHeader,
} from '@/components/page';
import { errorMessage, errorStatus } from '@/lib/errors';
import {
  formatDuration,
  formatMoney,
  makeIdempotencyKey,
  todayIso,
  zoneCity,
} from '@/lib/format';
import { browserTimezone, useSession } from '@/lib/session';

/** How many calendar days ahead we ask the API for at once (same as the app). */
const WINDOW_DAYS = 14;
/** Matches the Expo textarea `maxLength`. */
const NOTES_MAX = 1000;

export default function BookPage() {
  const params = useParams<{ practitionerId: string }>();
  const practitionerId = params.practitionerId ?? '';
  const search = useSearch();
  const preselectedServiceId = useMemo(
    () => new URLSearchParams(search).get('serviceId'),
    [search],
  );
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const viewerTimezone = user?.timezone || browserTimezone();

  const appConfigQuery = useGetAppConfig({
    query: { queryKey: getGetAppConfigQueryKey(), staleTime: 5 * 60_000 },
  });

  const profileQuery = useGetPractitionerProfile(practitionerId, {
    query: {
      enabled: !!practitionerId,
      queryKey: getGetPractitionerProfileQueryKey(practitionerId),
    },
  });
  const profile = profileQuery.data;
  const activeServices = useMemo(
    () => (profile?.services ?? []).filter((s) => s.isActive),
    [profile?.services],
  );

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState('');
  const [rangeOffset, setRangeOffset] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // One idempotency key per booking attempt. It only changes after the server
  // has definitively answered (so a retry after a network drop reuses it and a
  // retry after a 4xx/5xx is a fresh attempt).
  const idempotencyKey = useRef(makeIdempotencyKey());

  useEffect(() => {
    document.title = profile
      ? `Book with ${profile.practitioner.fullName} — Healers Inc`
      : 'Book a session — Healers Inc';
  }, [profile]);

  // Preselect the service once the profile loads.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current || activeServices.length === 0) return;
    didPreselect.current = true;
    const match = activeServices.find((s) => s.id === preselectedServiceId);
    setServiceId(match ? match.id : null);
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
      enabled: !!serviceId,
      queryKey: getGetPractitionerAvailabilityQueryKey(availabilityParams),
    },
  });

  const calendar = availabilityQuery.data;
  const daysWithSlots = useMemo(
    () => (calendar?.days ?? []).filter((d) => d.slots.length > 0),
    [calendar?.days],
  );

  // Keep the selected day/slot valid as availability changes.
  useEffect(() => {
    if (daysWithSlots.length === 0) {
      setSelectedDate(null);
      setSelectedSlot(null);
      return;
    }
    setSelectedDate((prev) =>
      prev && daysWithSlots.some((d) => d.date === prev) ? prev : daysWithSlots[0].date,
    );
  }, [daysWithSlots]);

  const activeDay = useMemo(
    () => daysWithSlots.find((d) => d.date === selectedDate) ?? null,
    [daysWithSlots, selectedDate],
  );

  // Drop a stale slot when the day changes.
  useEffect(() => {
    setSelectedSlot((prev) =>
      prev && activeDay?.slots.some((s) => s.startsAt === prev.startsAt) ? prev : null,
    );
  }, [activeDay]);

  const practitionerTimezone = calendar?.practitionerTimezone ?? profile?.practitioner.timezone ?? 'UTC';
  const sameTimezone = calendar?.sameTimezone ?? practitionerTimezone === viewerTimezone;

  const maxAdvanceDays = profile?.policy.maxAdvanceDays ?? 365;
  // The server never returns slots past `maxAdvanceDays`; stop paging there.
  const canGoLater = rangeOffset + WINDOW_DAYS < maxAdvanceDays;

  const createBooking = useCreateBooking();
  const canConfirm = !!selectedService && !!selectedSlot && !createBooking.isPending;
  const instant = profile?.policy.instantBooking ?? false;

  const confirm = () => {
    if (!selectedService || !selectedSlot || createBooking.isPending) return;
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
        onSuccess: (appointment) => {
          void queryClient.invalidateQueries({
            queryKey: getListAppointmentsQueryKey().slice(0, 1),
          });
          toast({
            title: instant ? 'Booking confirmed' : 'Request sent',
            description: instant
              ? `You're booked with ${profile?.practitioner.fullName ?? 'your practitioner'} for ${selectedSlot.viewerLabel} (${zoneCity(viewerTimezone)}).`
              : `${profile?.practitioner.fullName ?? 'Your practitioner'} will confirm your request soon.`,
          });
          navigate(`/appointment/${appointment.id}`, { replace: true });
        },
        onError: (err) => {
          const status = errorStatus(err);
          // The server answered, so the next try is a new attempt. A network
          // failure (no status) keeps the key so a duplicate cannot be created.
          if (status != null) idempotencyKey.current = makeIdempotencyKey();
          if (status === 409) {
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

  // ---- Render ----

  if (profileQuery.isLoading) {
    return (
      <Page testId="page-book">
        <PageHeader title="Book a session" backHref={`/practitioner/${practitionerId}`} backLabel="Back to profile" />
        <LoadingBlock label="Loading services…" />
      </Page>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <Page testId="page-book">
        <PageHeader title="Book a session" backHref={`/practitioner/${practitionerId}`} backLabel="Back to profile" />
        <ErrorState
          title="Couldn't start booking"
          error={profileQuery.error ?? "We couldn't load this practitioner's services."}
          onRetry={() => profileQuery.refetch()}
        />
      </Page>
    );
  }

  const practitioner = profile.practitioner;
  const backHref = `/practitioner/${practitioner.id}`;

  if (activeServices.length === 0) {
    return (
      <Page testId="page-book">
        <PageHeader
          title="Book a session"
          description={`with ${practitioner.fullName}`}
          backHref={backHref}
          backLabel="Back to profile"
        />
        <EmptyState
          icon={CalendarDays}
          title="No bookable services"
          description="This practitioner has no services open for booking right now."
          action={
            <Button variant="outline" onClick={() => navigate(backHref)} data-testid="book-back-to-profile">
              Back to profile
            </Button>
          }
        />
      </Page>
    );
  }

  const paymentsEnabled = appConfigQuery.data?.paymentsEnabled ?? false;
  const confirmLabel = !selectedService
    ? 'Choose a service'
    : !selectedSlot
      ? 'Choose a time'
      : instant
        ? 'Confirm booking'
        : 'Request booking';

  const confirmButton = (testId: string) => (
    <Button
      type="button"
      size="lg"
      className="w-full"
      disabled={!canConfirm}
      onClick={confirm}
      data-testid={testId}
    >
      {createBooking.isPending ? (
        <>
          <Spinner />
          {instant ? 'Booking…' : 'Sending request…'}
        </>
      ) : (
        confirmLabel
      )}
    </Button>
  );

  const zoneNotice = sameTimezone ? (
    <>
      Times shown in {zoneCity(viewerTimezone)} ({viewerTimezone}). {practitioner.fullName} is in
      the same time zone.
    </>
  ) : (
    <>
      Times shown in {zoneCity(viewerTimezone)} ({viewerTimezone}). {practitioner.fullName} is in{' '}
      {zoneCity(practitionerTimezone)} ({practitionerTimezone}).
    </>
  );

  const stepNumberClass =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary';

  return (
    <Page testId="page-book" className="pb-40 lg:pb-16">
      <PageHeader
        eyebrow="Booking"
        title="Book a session"
        description={`with ${practitioner.fullName}${practitioner.location ? ` · ${practitioner.location}` : ''}`}
        backHref={backHref}
        backLabel="Back to profile"
      />

      <div
        className="mb-8 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-foreground"
        data-testid="book-timezone-notice"
      >
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="leading-relaxed">{zoneNotice}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        {/* Left column — the steps */}
        <div className="flex flex-col gap-10">
          <section aria-labelledby="book-step-service" data-testid="book-step-service">
            <div className="mb-4 flex items-center gap-3">
              <span className={stepNumberClass} aria-hidden>1</span>
              <h2 id="book-step-service" className="text-lg font-semibold text-foreground">
                Choose a service
              </h2>
            </div>
            <ServicePicker
              services={activeServices}
              currency={practitioner.currency}
              selectedId={serviceId}
              onSelect={(s) => {
                if (s.id === serviceId) return;
                setServiceId(s.id);
                setSelectedDate(null);
                setSelectedSlot(null);
                setRangeOffset(0);
                setSubmitError(null);
              }}
            />
          </section>

          <section
            aria-labelledby="book-step-time"
            data-testid="book-step-time"
            className={selectedService ? undefined : 'opacity-60'}
          >
            <div className="mb-4 flex items-center gap-3">
              <span className={stepNumberClass} aria-hidden>2</span>
              <h2 id="book-step-time" className="text-lg font-semibold text-foreground">
                Pick a day and time
              </h2>
            </div>
            {selectedService ? (
              <>
                <p className="mb-4 text-xs text-muted-foreground" data-testid="book-policy-note">
                  {formatDuration(selectedService.durationMinutes)} sessions · book up to{' '}
                  {maxAdvanceDays} {maxAdvanceDays === 1 ? 'day' : 'days'} ahead
                  {profile.policy.minNoticeMinutes > 0
                    ? ` · at least ${formatDuration(profile.policy.minNoticeMinutes)} notice`
                    : ''}
                </p>
                <SlotPicker
                  days={daysWithSlots}
                  selectedDate={selectedDate}
                  selectedSlot={selectedSlot}
                  onSelectDate={setSelectedDate}
                  onSelectSlot={(slot) => {
                    setSelectedSlot(slot);
                    setSubmitError(null);
                  }}
                  from={from}
                  to={to}
                  rangeOffset={rangeOffset}
                  onLater={() => setRangeOffset((o) => o + WINDOW_DAYS)}
                  onEarlier={() => setRangeOffset((o) => Math.max(0, o - WINDOW_DAYS))}
                  canGoLater={canGoLater}
                  viewerTimezone={viewerTimezone}
                  practitionerTimezone={practitionerTimezone}
                  sameTimezone={sameTimezone}
                  isLoading={availabilityQuery.isLoading}
                  isFetching={availabilityQuery.isFetching}
                  error={availabilityQuery.isError ? availabilityQuery.error : undefined}
                  onRetry={() => availabilityQuery.refetch()}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a service first to see open times.</p>
            )}
          </section>

          {selectedSlot ? (
            <section aria-labelledby="book-step-notes" data-testid="book-step-notes">
              <div className="mb-4 flex items-center gap-3">
                <span className={stepNumberClass} aria-hidden>3</span>
                <h2 id="book-step-notes" className="text-lg font-semibold text-foreground">
                  Anything to share?
                </h2>
              </div>
              <Field>
                <FieldLabel htmlFor="booking-notes" className="sr-only">
                  Notes for your practitioner
                </FieldLabel>
                <Textarea
                  id="booking-notes"
                  placeholder="What would you like to focus on?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                  maxLength={NOTES_MAX}
                  rows={4}
                  data-testid="booking-notes"
                />
                <FieldDescription className="flex justify-between gap-4">
                  <span>Optional — a note goes to your practitioner with the {instant ? 'booking' : 'request'}.</span>
                  <span className="shrink-0 tabular-nums" aria-live="polite">
                    {notes.length}/{NOTES_MAX}
                  </span>
                </FieldDescription>
              </Field>
            </section>
          ) : null}
        </div>

        {/* Right column — sticky summary */}
        <aside className="lg:sticky lg:top-24" data-testid="book-summary-column">
          <div className="mb-4 hidden items-center gap-3 lg:flex">
            <h2 className="text-lg font-semibold text-foreground">Review &amp; confirm</h2>
          </div>
          <BookingSummary
            practitioner={practitioner}
            policy={profile.policy}
            service={selectedService}
            date={selectedDate}
            slot={selectedSlot}
            viewerTimezone={viewerTimezone}
            practitionerTimezone={practitionerTimezone}
            sameTimezone={sameTimezone}
            paymentsEnabled={paymentsEnabled}
            footer={
              <div className="hidden flex-col gap-3 lg:flex">
                {submitError ? <ErrorBanner message={submitError} /> : null}
                {confirmButton('book-confirm')}
                {canConfirm && paymentsEnabled ? (
                  <p className="text-center text-xs text-muted-foreground">
                    You'll book first and pay only after confirmation when in-app payment is available.
                  </p>
                ) : null}
              </div>
            }
          />
        </aside>
      </div>

      {/* Mobile / tablet sticky confirm bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden"
        data-testid="book-mobile-bar"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 sm:px-2">
          {submitError ? <ErrorBanner message={submitError} className="py-2" /> : null}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {selectedService ? (
                <>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {formatMoney(selectedService.priceCents, selectedService.currency || practitioner.currency)}
                    <span className="font-normal text-muted-foreground"> · {formatDuration(selectedService.durationMinutes)}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedSlot && selectedDate
                      ? `${selectedSlot.viewerLabel} ${zoneCity(viewerTimezone)}${sameTimezone ? '' : ` · ${selectedSlot.practitionerLabel} ${zoneCity(practitionerTimezone)}`}`
                      : cancellationNotice(profile.policy)}
                  </p>
                </>
              ) : (
                <p className="truncate text-xs text-muted-foreground">{practitioner.fullName}</p>
              )}
            </div>
            <div className="w-1/2 shrink-0 sm:w-64">{confirmButton('book-confirm-mobile')}</div>
          </div>
        </div>
      </div>
    </Page>
  );
}
