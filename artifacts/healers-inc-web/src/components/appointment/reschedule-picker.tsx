import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  type Appointment,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { cn } from '@workspace/healers-inc/lib/utils';

import { ErrorState } from '@/components/page';
import { formatCalendarDate, todayIso, zoneCity } from '@/lib/format';

/** Same three-week window the Expo reschedule picker asks for. */
const WINDOW_DAYS = 21;

/**
 * Inline "pick a new time" panel for the session page. Slots come from the
 * practitioner's availability for the booked service, labelled in the
 * viewer's zone (and the practitioner's when they differ).
 */
export function ReschedulePicker({
  appointment,
  onPick,
  onCancel,
  pending,
}: {
  appointment: Appointment;
  onPick: (startsAt: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const practitionerId = appointment.practitioner.id;

  // The availability endpoint needs a serviceId; resolve it from the
  // practitioner's public services by matching the service name.
  const profileQuery = useGetPractitionerProfile(practitionerId, {
    query: { queryKey: getGetPractitionerProfileQueryKey(practitionerId) },
  });
  const serviceId = useMemo(() => {
    const services = profileQuery.data?.services ?? [];
    return services.find((s) => s.name === appointment.serviceName)?.id ?? services[0]?.id;
  }, [profileQuery.data, appointment.serviceName]);

  const from = todayIso(0, appointment.viewerTimezone);
  const to = todayIso(WINDOW_DAYS, appointment.viewerTimezone);
  const params = {
    practitionerId,
    serviceId: serviceId ?? '',
    from,
    to,
    timezone: appointment.viewerTimezone,
  };
  const availabilityQuery = useGetPractitionerAvailability(params, {
    query: { enabled: !!serviceId, queryKey: getGetPractitionerAvailabilityQueryKey(params) },
  });

  const days = useMemo(
    () => (availabilityQuery.data?.days ?? []).filter((d) => d.slots.length > 0),
    [availabilityQuery.data],
  );
  const sameZone = appointment.clientTimezone === appointment.practitionerTimezone;
  const loading = profileQuery.isLoading || (!!serviceId && availabilityQuery.isLoading);
  const error = profileQuery.error ?? availabilityQuery.error;
  const noService = !profileQuery.isLoading && !profileQuery.error && !serviceId;

  return (
    <Card data-testid="appointment-reschedule-picker">
      <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary shrink-0" aria-hidden />
          <h3 className="flex-1 font-semibold text-foreground">Pick a new time</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={pending}
            data-testid="appointment-reschedule-cancel"
          >
            Cancel
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Times are shown in your zone ({zoneCity(appointment.viewerTimezone)}).
          {sameZone ? '' : ` ${appointment.practitioner.fullName.split(' ')[0]}'s time is shown underneath.`}
        </p>

        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-4 w-32" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24 rounded-full" />
              ))}
            </div>
          </div>
        ) : error ? (
          <ErrorState
            title="Couldn't load open times"
            error={error}
            onRetry={() => {
              void profileQuery.refetch();
              void availabilityQuery.refetch();
            }}
          />
        ) : noService || days.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="appointment-reschedule-empty">
            {noService
              ? 'This service is no longer offered, so it cannot be rescheduled online. Message the practitioner instead.'
              : 'No open slots in the next three weeks.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {days.map((day) => (
              <div key={day.date} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatCalendarDate(day.date)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={pending}
                      onClick={() => onPick(slot.startsAt)}
                      aria-label={`Reschedule to ${formatCalendarDate(day.date)} at ${slot.viewerLabel}`}
                      data-testid={`reschedule-slot-${slot.startsAt}`}
                      className={cn(
                        'flex flex-col items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground',
                        'transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-50',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      <span>{slot.viewerLabel}</span>
                      {sameZone ? null : (
                        <span className="text-xs font-normal text-muted-foreground">
                          {slot.practitionerLabel}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
