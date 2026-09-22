import { useEffect, useMemo } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { CalendarDays, Star } from 'lucide-react';
import {
  getListAppointmentsQueryKey,
  useListAppointments,
  type AppointmentScope,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@workspace/healers-inc/components/ui/tabs';

import { AppointmentCard } from '@/components/appointment-card';
import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page';

const SCOPES: { value: AppointmentScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'pending', label: 'Pending' },
  { value: 'past', label: 'Past' },
];

const EMPTY_COPY: Record<AppointmentScope, { title: string; description: string }> = {
  upcoming: {
    title: 'No upcoming sessions',
    description: 'Book a practitioner and your sessions will appear here.',
  },
  pending: {
    title: 'Nothing pending',
    description: 'Requests awaiting a practitioner’s confirmation show up here.',
  },
  past: {
    title: 'No past sessions yet',
    description: 'Once you complete a session it will be listed here.',
  },
  all: { title: 'No sessions', description: 'You have no sessions yet.' },
};

function isScope(value: string | null): value is AppointmentScope {
  return SCOPES.some((s) => s.value === value);
}

function BookingListSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      aria-busy="true"
      aria-label="Loading sessions"
    >
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/**
 * `/bookings` — the client's sessions, split the same way the Expo tab is
 * (upcoming / pending / past). The scope lives in the URL so the back button
 * and refreshes keep it.
 */
export default function BookingsPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const requested = new URLSearchParams(search).get('scope');
  const scope: AppointmentScope = isScope(requested) ? requested : 'upcoming';

  const query = useListAppointments(
    { scope },
    { query: { queryKey: getListAppointmentsQueryKey({ scope }) } },
  );
  const appointments = useMemo(() => query.data ?? [], [query.data]);

  useEffect(() => {
    document.title = 'Your sessions · Healers Inc';
  }, []);

  function setScope(next: string) {
    if (!isScope(next)) return;
    navigate(next === 'upcoming' ? '/bookings' : `/bookings?scope=${next}`, { replace: true });
  }

  const isLoading = query.isLoading;
  const isError = query.isError && !query.data;

  return (
    <Page testId="page-bookings">
      <PageHeader
        eyebrow="Bookings"
        title="Your sessions"
        description="Your bookings and requests, shown in your own time zone."
        actions={
          <Button asChild variant="outline" data-testid="bookings-find-practitioner">
            <Link href="/discover">Find a practitioner</Link>
          </Button>
        }
      />

      <Tabs value={scope} onValueChange={setScope} className="mb-6">
        <TabsList className="w-full sm:w-auto" data-testid="bookings-scope">
          {SCOPES.map((s) => (
            <TabsTrigger
              key={s.value}
              value={s.value}
              className="flex-1 sm:flex-none sm:px-5"
              data-testid={`bookings-scope-${s.value}`}
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <BookingListSkeleton />
      ) : isError ? (
        <ErrorState
          title="Couldn't load your sessions"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : appointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={EMPTY_COPY[scope].title}
          description={EMPTY_COPY[scope].description}
          action={
            scope === 'upcoming' ? (
              <Button asChild data-testid="bookings-empty-discover">
                <Link href="/discover">Find a practitioner</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="bookings-list">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="flex flex-col gap-2">
              <AppointmentCard appointment={appointment} className="h-full" />
              {appointment.canReview && !appointment.hasReview ? (
                <Button asChild variant="secondary" size="sm" className="self-start">
                  <Link
                    href={`/review/${appointment.id}`}
                    data-testid={`bookings-review-${appointment.id}`}
                  >
                    <Star className="w-4 h-4" aria-hidden />
                    Leave a review
                  </Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
