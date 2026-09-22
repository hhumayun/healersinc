import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  CreditCard,
  Inbox,
  MessageCircle,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import {
  getGetPractitionerCalendarQueryKey,
  getGetPractitionerDashboardQueryKey,
  getListAppointmentsQueryKey,
  getListPractitionerPaymentsQueryKey,
  useActOnAppointment,
  useGetPractitionerDashboard,
  useListAppointments,
  useListPractitionerPayments,
  type Appointment,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Progress } from '@workspace/healers-inc/components/ui/progress';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';
import { cn } from '@workspace/healers-inc/lib/utils';

import { AppointmentCard } from '@/components/appointment-card';
import { Section } from '@/components/manage/section';
import { EmptyState, ErrorState, Page, PageHeader } from '@/components/page';
import { RatingSummary } from '@/components/star-rating';
import { UserAvatar } from '@/components/user-avatar';
import { errorMessage } from '@/lib/errors';
import { formatMoney } from '@/lib/format';
import { useSession } from '@/lib/session';

function StatTile({
  icon: Icon,
  label,
  value,
  tint,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tint: string;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="flex flex-col gap-2 p-4">
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-full', tint)}>
          <Icon className="w-4 h-4" aria-hidden />
        </span>
        <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

/** A pending request the practitioner can accept/decline inline. */
function PendingRow({ appointment }: { appointment: Appointment }) {
  const queryClient = useQueryClient();
  const act = useActOnAppointment();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: 'accept' | 'decline') => {
    setError(null);
    setBusy(action);
    act.mutate(
      { appointmentId: appointment.id, data: { action } },
      {
        onSuccess: () => {
          setBusy(null);
          void queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey().slice(0, 1) });
          void queryClient.invalidateQueries({ queryKey: getGetPractitionerDashboardQueryKey() });
          void queryClient.invalidateQueries({
            queryKey: getGetPractitionerCalendarQueryKey().slice(0, 1),
          });
        },
        onError: (err) => {
          setBusy(null);
          setError(errorMessage(err, 'Could not update this request.'));
        },
      },
    );
  };

  return (
    <Card data-testid={`pending-request-${appointment.id}`}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={appointment.client.fullName} avatarUrl={appointment.client.avatarUrl} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{appointment.client.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{appointment.serviceName}</p>
          </div>
          <Badge variant="outline" className="border-transparent bg-accent/15 text-accent shadow-none">
            Pending
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <CalendarDays className="w-4 h-4 text-primary" aria-hidden />
          {appointment.viewerLabel}
        </div>
        {appointment.clientNotes ? (
          <p className="text-sm text-muted-foreground line-clamp-2">&ldquo;{appointment.clientNotes}&rdquo;</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1" onClick={() => run('accept')} disabled={busy !== null} data-testid={`pending-accept-${appointment.id}`}>
            {busy === 'accept' ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" />}
            Accept
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => run('decline')} disabled={busy !== null} data-testid={`pending-decline-${appointment.id}`}>
            {busy === 'decline' ? <Spinner className="w-4 h-4" /> : null}
            Decline
          </Button>
          <Button size="icon" variant="ghost" asChild aria-label="Open request details">
            <Link href={`/appointment/${appointment.id}`}>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TileSkeletons() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-busy="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

/** `/dashboard` — the practitioner's home, ported from the Expo dashboard tab. */
export default function DashboardPage() {
  const { user } = useSession();
  const dashboard = useGetPractitionerDashboard({
    query: { queryKey: getGetPractitionerDashboardQueryKey() },
  });
  const pending = useListAppointments(
    { scope: 'pending' },
    { query: { queryKey: getListAppointmentsQueryKey({ scope: 'pending' }) } },
  );
  const paymentStatus = useListPractitionerPayments({
    query: { queryKey: getListPractitionerPaymentsQueryKey() },
  });

  useEffect(() => {
    document.title = 'Your practice · Healers Inc';
  }, []);

  const summary = dashboard.data;
  const needsProfile = !!summary && (!summary.isPublished || summary.profileCompletion < 100);
  const accountStatus = paymentStatus.data?.accountStatus;
  const needsPaymentSetup =
    accountStatus === 'onboarding_required' || accountStatus === 'pending' || accountStatus === 'restricted';
  const firstName = user?.fullName.split(' ')[0];

  return (
    <Page testId="page-dashboard">
      <PageHeader
        eyebrow="Your practice"
        title={firstName ? `Welcome back, ${firstName}` : 'Your practice'}
        description="What needs you, what's next, and how things are going."
        actions={
          <Button asChild variant="outline" data-testid="dashboard-schedule">
            <Link href="/schedule">Open schedule</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 lg:gap-8 items-start">
        <div className="flex flex-col gap-8 min-w-0">
          {dashboard.isLoading ? (
            <TileSkeletons />
          ) : dashboard.isError ? (
            <ErrorState title="Couldn't load your dashboard" error={dashboard.error} onRetry={() => void dashboard.refetch()} />
          ) : summary ? (
            <>
              {needsProfile ? (
                <Card className="border-primary/30 bg-primary/5" data-testid="dashboard-profile-nudge">
                  <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4.5 h-4.5 text-primary" aria-hidden />
                      <p className="font-semibold text-foreground">
                        {summary.isPublished ? 'Finish your profile' : 'You are not visible yet'}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {summary.isPublished
                        ? 'Your profile is a little thin. Complete it so clients see you at your best.'
                        : 'Publish your profile to appear in search and start receiving bookings.'}
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Profile completion</span>
                        <span className="font-semibold text-primary" data-testid="dashboard-profile-completion">
                          {summary.profileCompletion}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, summary.profileCompletion))} className="h-2" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" asChild>
                        <Link href="/manage/profile">Edit profile</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/manage/services">Services</Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/manage/availability">Availability</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-primary/5 border-primary/20" data-testid="dashboard-live">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <CheckCircle2 className="w-5 h-5" />
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">You are live</p>
                      <p className="text-xs text-muted-foreground">Your profile is published and complete.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {needsPaymentSetup ? (
                <Card data-testid="dashboard-payments-nudge">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                    <CreditCard className="w-5 h-5 text-primary shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">Finish payment setup</p>
                      <p className="text-xs text-muted-foreground">Complete the secure hosted setup to accept in-app payments.</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/manage/payments">Open</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <Section title="This month">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatTile icon={Clock} label="Pending requests" value={String(summary.pendingCount)} tint="bg-accent/15 text-accent" testId="stat-pending" />
                  <StatTile icon={CalendarDays} label="Upcoming sessions" value={String(summary.upcomingCount)} tint="bg-primary/15 text-primary" testId="stat-upcoming" />
                  <StatTile icon={CheckSquare} label="Completed" value={String(summary.completedThisMonth)} tint="bg-secondary text-secondary-foreground" testId="stat-completed" />
                  <StatTile icon={TrendingUp} label="Earnings (info only)" value={formatMoney(summary.earningsThisMonthCents, summary.currency)} tint="bg-primary/15 text-primary" testId="stat-earnings" />
                </div>
              </Section>

              {summary.nextAppointment ? (
                <Section
                  title="Next up"
                  action={
                    <Button variant="link" size="sm" asChild className="px-0">
                      <Link href="/schedule">Schedule</Link>
                    </Button>
                  }
                >
                  <AppointmentCard appointment={summary.nextAppointment} />
                </Section>
              ) : null}
            </>
          ) : null}

          <Section
            title="Pending requests"
            action={
              summary && summary.pendingCount > 0 ? (
                <Badge variant="secondary" data-testid="dashboard-pending-count">{summary.pendingCount}</Badge>
              ) : undefined
            }
            testId="dashboard-pending"
          >
            {pending.isLoading ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                <Skeleton className="h-36 rounded-xl" />
                <Skeleton className="h-36 rounded-xl" />
              </div>
            ) : pending.isError ? (
              <ErrorState title="Couldn't load your requests" error={pending.error} onRetry={() => void pending.refetch()} />
            ) : pending.data && pending.data.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pending.data.map((appointment) => (
                  <PendingRow key={appointment.id} appointment={appointment} />
                ))}
              </div>
            ) : (
              <EmptyState icon={Inbox} title="No requests waiting" description="New booking requests will show up here for you to accept or decline." />
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <Card data-testid="dashboard-rating">
            <CardContent className="flex flex-col gap-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your rating</p>
              {summary ? (
                <RatingSummary average={summary.ratingAverage} count={summary.ratingCount} />
              ) : (
                <Skeleton className="h-5 w-24" />
              )}
              <Button variant="outline" size="sm" asChild className="justify-between">
                <Link href="/messages">
                  <span className="inline-flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Messages
                  </span>
                  {summary && summary.unreadMessages > 0 ? (
                    <Badge data-testid="dashboard-unread">{summary.unreadMessages}</Badge>
                  ) : null}
                </Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-2">
              {[
                { href: '/manage/profile', label: 'Public profile' },
                { href: '/manage/services', label: 'Services' },
                { href: '/manage/availability', label: 'Availability' },
                { href: '/manage/policy', label: 'Booking rules' },
                { href: '/manage/payments', label: 'Payments' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  data-testid={`dashboard-link-${item.href.split('/').pop()}`}
                >
                  {item.label}
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
