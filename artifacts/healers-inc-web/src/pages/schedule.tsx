import { useEffect, useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CalendarDays, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import {
  getGetPractitionerCalendarQueryKey,
  getListAppointmentsQueryKey,
  useGetPractitionerCalendar,
  useListAppointments,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';

import { AppointmentCard } from '@/components/appointment-card';
import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page';
import { formatCalendarDate, todayIso, zoneCity } from '@/lib/format';
import { useSession } from '@/lib/session';

/** `/schedule` — the practitioner's week, ported from the Expo bookings tab. */
export default function SchedulePage() {
  const { user } = useSession();
  const search = useSearch();
  const [, navigate] = useLocation();
  const weekOffset = Math.max(0, Number(new URLSearchParams(search).get('week') ?? 0) || 0);

  // The calendar window is read by the API in the practitioner's own zone.
  const zone = user?.timezone ?? null;
  const from = todayIso(weekOffset * 7, zone);
  const to = todayIso(weekOffset * 7 + 6, zone);

  const calendarQuery = useGetPractitionerCalendar(
    { from, to },
    { query: { queryKey: getGetPractitionerCalendarQueryKey({ from, to }) } },
  );
  const pendingQuery = useListAppointments(
    { scope: 'pending' },
    { query: { queryKey: getListAppointmentsQueryKey({ scope: 'pending' }) } },
  );

  useEffect(() => {
    document.title = 'Schedule · Healers Inc';
  }, []);

  const days = useMemo(() => calendarQuery.data?.days ?? [], [calendarQuery.data]);
  const pending = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data]);
  const daysWithAppointments = days.filter((d) => d.appointments.length > 0);
  const totalInWindow = days.reduce((sum, d) => sum + d.appointments.length, 0);

  const rangeLabel =
    weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : `${formatCalendarDate(from)} – ${formatCalendarDate(to)}`;

  const setWeek = (next: number) => navigate(next <= 0 ? '/schedule' : `/schedule?week=${next}`, { replace: true });

  return (
    <Page testId="page-schedule">
      <PageHeader
        eyebrow="Schedule"
        title="Your calendar"
        description={`Sessions in your own time zone${zone ? ` (${zoneCity(zone)})` : ''}.`}
        actions={
          <Button asChild variant="outline" data-testid="schedule-availability">
            <Link href="/manage/availability">Edit availability</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 lg:gap-8 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
              <Button size="icon" variant="outline" disabled={weekOffset <= 0} aria-label="Previous week" onClick={() => setWeek(weekOffset - 1)} data-testid="schedule-prev">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-center">
                <p className="font-semibold text-foreground" data-testid="schedule-range">{rangeLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCalendarDate(from)} – {formatCalendarDate(to)}
                </p>
              </div>
              <Button size="icon" variant="outline" aria-label="Next week" onClick={() => setWeek(weekOffset + 1)} data-testid="schedule-next">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

          {calendarQuery.isLoading ? (
            <div className="flex flex-col gap-3" aria-busy="true">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </div>
          ) : calendarQuery.isError ? (
            <ErrorState title="Couldn't load your calendar" error={calendarQuery.error} onRetry={() => void calendarQuery.refetch()} />
          ) : totalInWindow === 0 ? (
            <EmptyState icon={CalendarDays} title="No sessions this week" description="Confirmed sessions in this range will appear here." />
          ) : (
            <div className="flex flex-col gap-6" data-testid="schedule-days">
              {daysWithAppointments.map((day) => (
                <section key={day.date} className="flex flex-col gap-3" data-testid={`schedule-day-${day.date}`}>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatCalendarDate(day.date)}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {day.appointments.map((appointment) => (
                      <AppointmentCard key={appointment.id} appointment={appointment} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24" data-testid="schedule-pending">
          <Card className={pending.length > 0 ? 'border-primary/30 bg-primary/5' : undefined}>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Inbox className="w-4.5 h-4.5 text-primary" aria-hidden />
                <p className="flex-1 font-semibold text-foreground">Pending requests</p>
                {pending.length > 0 ? <Badge>{pending.length}</Badge> : null}
              </div>
              {pendingQuery.isLoading ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : pendingQuery.isError ? (
                <ErrorState title="Couldn't load requests" error={pendingQuery.error} onRetry={() => void pendingQuery.refetch()} />
              ) : pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody is waiting on you right now.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">These clients are waiting on your response.</p>
                  <div className="flex flex-col gap-3">
                    {pending.map((appointment) => (
                      <AppointmentCard key={appointment.id} appointment={appointment} />
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
