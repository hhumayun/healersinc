import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { CalendarDays, Star, WifiOff } from 'lucide-react';
import {
  getListAppointmentsQueryKey,
  useListAppointments,
  type Appointment,
  type AppointmentScope,
} from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@workspace/healers-inc/components/ui/tabs';

import { AppointmentCard } from '@/components/appointment-card';
import { RequireClient } from '@/components/route-guards';
import { EmptyState } from '@/pages/discover';
import { errorMessage } from '@/lib/errors';

const SCOPES: { value: AppointmentScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'pending', label: 'Pending' },
  { value: 'past', label: 'Past' },
];

const EMPTY_COPY: Record<string, { title: string; description: string }> = {
  upcoming: {
    title: 'No upcoming sessions',
    description: 'Book a practitioner and your sessions will appear here.',
  },
  pending: {
    title: 'Nothing pending',
    description: "Requests awaiting a practitioner's confirmation show up here.",
  },
  past: {
    title: 'No past sessions yet',
    description: 'Once you complete a session it will be listed here.',
  },
};

export default function BookingsPage() {
  return (
    <RequireClient>
      <Bookings />
    </RequireClient>
  );
}

function Bookings() {
  const [scope, setScope] = useState<AppointmentScope>('upcoming');

  useEffect(() => {
    document.title = 'Your bookings — Healers Inc';
  }, []);

  const query = useListAppointments(
    { scope },
    { query: { queryKey: getListAppointmentsQueryKey({ scope }) } },
  );
  const appointments: Appointment[] = query.data ?? [];

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-bookings"
    >
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-2">
            Your sessions
          </h1>
          <p className="text-muted-foreground">
            Bookings and requests, with every time shown in your own zone.
          </p>
        </header>

        <Tabs
          value={scope}
          onValueChange={(v) => setScope(v as AppointmentScope)}
          className="mb-6"
        >
          <TabsList className="w-full sm:w-auto" data-testid="bookings-scopes">
            {SCOPES.map((option) => (
              <TabsTrigger
                key={option.value}
                value={option.value}
                className="flex-1 sm:flex-none"
                data-testid={`scope-${option.value}`}
              >
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {query.isLoading ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <EmptyState
            icon={<WifiOff className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load your sessions"
            description={errorMessage(query.error, 'Please try again.')}
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Try again
              </Button>
            }
          />
        ) : appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="w-6 h-6 text-primary" aria-hidden />}
            title={EMPTY_COPY[scope]?.title ?? 'No sessions'}
            description={EMPTY_COPY[scope]?.description ?? 'You have no sessions yet.'}
            action={
              scope === 'upcoming' ? (
                <Button asChild>
                  <Link href="/discover">Find a practitioner</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-4" data-testid="appointment-list">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col gap-2">
                <AppointmentCard appointment={appointment} />
                {appointment.canReview && !appointment.hasReview ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className="self-start gap-2"
                    data-testid={`review-cta-${appointment.id}`}
                  >
                    <Link href={`/bookings/${appointment.id}/review`}>
                      <Star className="w-4 h-4" aria-hidden />
                      Leave a review
                    </Link>
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
