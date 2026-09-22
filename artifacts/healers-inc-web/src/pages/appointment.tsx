import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Clock,
  Globe,
  MessageCircle,
  RefreshCw,
  Star,
  Tag,
  Video,
} from 'lucide-react';
import {
  getAppointmentCalendarFile,
  getGetAppointmentPaymentQueryKey,
  getGetAppointmentQueryKey,
  getListAppointmentsQueryKey,
  useActOnAppointment,
  useGetAppointment,
  useGetAppointmentPayment,
  useOpenConversation,
  type AppointmentActionRequestAction,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/healers-inc/components/ui/alert-dialog';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { InfoRow } from '@/components/appointment/info-row';
import { PaymentCard } from '@/components/appointment/payment-card';
import { ReschedulePicker } from '@/components/appointment/reschedule-picker';
import {
  EmptyState,
  ErrorBanner,
  ErrorState,
  LoadingBlock,
  Page,
  PageHeader,
} from '@/components/page';
import { StatusBadge } from '@/components/status-badge';
import { UserAvatar } from '@/components/user-avatar';
import { useCheckoutPopup } from '@/hooks/use-checkout-popup';
import { errorMessage, errorStatus } from '@/lib/errors';
import {
  clockInZone,
  formatDuration,
  formatMoney,
  sessionFormatLabel,
  zoneCity,
} from '@/lib/format';

const CANCEL_COPY = {
  confirmed:
    'A cancellation before the notice window is refunded automatically. A late cancellation is not refunded automatically. Continue?',
  pending: 'Are you sure you want to cancel this request?',
};

/** Trigger a browser download of the API's `.ics` invite. */
function downloadCalendarFile(file: { filename: string; contentType: string; content: string }) {
  const blob = new Blob([file.content], { type: file.contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * `/appointment/:id` — one session from the client's side, ported from the
 * Expo screen minus the practitioner-only actions (accept/decline/complete/
 * refund), which live in the app.
 */
export default function AppointmentPage() {
  const { id = '' } = useParams<{ id: string }>();
  const appointmentId = id;
  const search = useSearch();
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();

  const query = useGetAppointment(appointmentId, {
    query: { enabled: !!appointmentId, queryKey: getGetAppointmentQueryKey(appointmentId) },
  });
  const appointment = query.data;

  const paymentQuery = useGetAppointmentPayment(appointmentId, {
    query: {
      enabled: !!appointmentId,
      queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
    },
  });
  const payment = paymentQuery.data ?? appointment?.payment ?? null;

  const checkout = useCheckoutPopup({ appointmentId, paymentStatus: payment?.status });
  const act = useActOnAppointment();
  const openConversation = useOpenConversation();

  const [rescheduling, setRescheduling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AppointmentActionRequestAction | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);

  useEffect(() => {
    document.title = appointment
      ? `${appointment.serviceName} with ${appointment.practitioner.fullName} · Healers Inc`
      : 'Session · Healers Inc';
  }, [appointment]);

  // Same-tab Checkout return (`?checkout=success|cancelled`): resume polling
  // and drop the flag from the URL so a refresh does not restart it.
  useEffect(() => {
    const status = new URLSearchParams(search).get('checkout');
    if (!status || !appointmentId) return;
    if (status === 'success') {
      checkout.resumeConfirming();
    } else if (status === 'cancelled') {
      void checkout.refetch();
    }
    navigate(location, { replace: true });
    // Run once per return, not whenever the hook's callbacks re-create.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId, search]);

  const notFound = query.isError && errorStatus(query.error) === 404;

  function runAction(action: AppointmentActionRequestAction, extra?: { startsAt?: string }) {
    setActionError(null);
    setPendingAction(action);
    act.mutate(
      {
        appointmentId,
        data: { action, startsAt: extra?.startsAt ?? null, reason: null },
      },
      {
        onSuccess: (updated) => {
          setPendingAction(null);
          setRescheduling(false);
          queryClient.setQueryData(getGetAppointmentQueryKey(appointmentId), updated);
          void queryClient.invalidateQueries({
            queryKey: getListAppointmentsQueryKey().slice(0, 1),
          });
          void queryClient.invalidateQueries({
            queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
          });
          toast({
            title:
              action === 'cancel'
                ? 'Session cancelled'
                : action === 'reschedule'
                  ? updated.status === 'pending'
                    ? 'New time requested'
                    : 'Session rescheduled'
                  : 'Session updated',
            description:
              action === 'reschedule' ? `Now ${updated.viewerLabel}.` : undefined,
          });
        },
        onError: (error) => {
          setPendingAction(null);
          if (errorStatus(error) === 409) {
            setActionError(
              'This session was just updated by the other party. Refreshing the latest status…',
            );
            void query.refetch();
          } else {
            setActionError(errorMessage(error));
          }
        },
      },
    );
  }

  function handleMessage() {
    if (!appointment) return;
    setActionError(null);
    openConversation.mutate(
      { data: { practitionerId: appointment.practitioner.id } },
      {
        onSuccess: (conversation) => navigate(`/messages/${conversation.id}`),
        onError: (error) => setActionError(errorMessage(error)),
      },
    );
  }

  async function handleAddToCalendar() {
    setActionError(null);
    setCalendarBusy(true);
    try {
      const file = await getAppointmentCalendarFile(appointmentId);
      downloadCalendarFile(file);
    } catch (error) {
      setActionError(errorMessage(error, 'Could not load the calendar invite. Please try again.'));
    } finally {
      setCalendarBusy(false);
    }
  }

  if (query.isLoading) {
    return (
      <Page testId="page-appointment">
        <LoadingBlock label="Loading session…" />
      </Page>
    );
  }

  if (notFound) {
    return (
      <Page width="narrow" testId="page-appointment">
        <EmptyState
          icon={CalendarDays}
          title="Session not found"
          description="This session does not exist or belongs to another account."
          action={
            <Button asChild variant="outline">
              <Link href="/bookings">Back to your sessions</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  if (query.isError || !appointment) {
    return (
      <Page width="narrow" testId="page-appointment">
        <ErrorState
          title="Couldn't load this session"
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      </Page>
    );
  }

  const practitioner = appointment.practitioner;
  const firstName = practitioner.fullName.split(' ')[0] ?? practitioner.fullName;
  const showBothZones = appointment.clientTimezone !== appointment.practitionerTimezone;
  const isPast = new Date(appointment.endsAt).getTime() < Date.now();
  const isOpen = appointment.status === 'pending' || appointment.status === 'confirmed';

  const canCancel = isOpen && !isPast;
  const canReschedule = isOpen && !isPast;
  const canReview = appointment.canReview && !appointment.hasReview;
  const canPay =
    appointment.status === 'confirmed' &&
    !isPast &&
    (payment?.status === 'checkout_available' ||
      payment?.status === 'checkout_pending' ||
      payment?.status === 'failed' ||
      payment?.status === 'cancelled');
  const checkoutTitle =
    payment?.status === 'checkout_pending'
      ? 'Resume secure checkout'
      : payment?.status === 'failed' || payment?.status === 'cancelled'
        ? 'Try payment again'
        : 'Pay securely';

  const busy = act.isPending;
  const errorText = actionError ?? checkout.error;

  const actions = (
    <div className="flex flex-col gap-3" data-testid="appointment-actions">
      {canPay ? (
        <Button
          size="lg"
          className="w-full"
          onClick={() => void checkout.start()}
          disabled={checkout.isStarting || checkout.isConfirming}
          data-testid="appointment-pay-securely"
        >
          {checkout.isStarting ? (
            <Spinner className="w-4 h-4" />
          ) : checkout.isConfirming ? (
            <Spinner className="w-4 h-4" />
          ) : null}
          {checkout.isStarting
            ? 'Opening checkout…'
            : checkout.isConfirming
              ? 'Confirming payment…'
              : checkoutTitle}
        </Button>
      ) : null}

      {canReview ? (
        <Button asChild size="lg" className="w-full" data-testid="appointment-leave-review">
          <Link href={`/review/${appointment.id}`}>
            <Star className="w-4 h-4" aria-hidden />
            Leave a review
          </Link>
        </Button>
      ) : null}

      {canReschedule && !rescheduling ? (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => setRescheduling(true)}
          data-testid="appointment-reschedule"
        >
          <RefreshCw className="w-4 h-4" aria-hidden />
          Reschedule
        </Button>
      ) : null}

      <Button
        variant="outline"
        className="w-full"
        disabled={openConversation.isPending}
        onClick={handleMessage}
        data-testid="appointment-message"
      >
        {openConversation.isPending ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <MessageCircle className="w-4 h-4" aria-hidden />
        )}
        Message {firstName}
      </Button>

      <Button
        variant="ghost"
        className="w-full"
        disabled={calendarBusy}
        onClick={() => void handleAddToCalendar()}
        data-testid="appointment-add-to-calendar"
      >
        {calendarBusy ? (
          <Spinner className="w-4 h-4" />
        ) : (
          <CalendarPlus className="w-4 h-4 text-primary" aria-hidden />
        )}
        Add to calendar
      </Button>

      {canCancel ? (
        <Button
          variant="destructive"
          className="w-full"
          disabled={busy}
          onClick={() => setCancelOpen(true)}
          data-testid="appointment-cancel"
        >
          {busy && pendingAction === 'cancel' ? <Spinner className="w-4 h-4" /> : null}
          {appointment.status === 'pending' ? 'Cancel request' : 'Cancel session'}
        </Button>
      ) : null}
    </div>
  );

  return (
    <Page testId="page-appointment" className="pb-28 lg:pb-16">
      <PageHeader
        eyebrow="Session"
        title={appointment.serviceName}
        description={`With ${practitioner.fullName}`}
        backHref="/bookings"
        backLabel="Your sessions"
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 lg:gap-8 items-start">
        <div className="flex flex-col gap-4">
          {/* Who */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Link
                  href={`/practitioner/${practitioner.id}`}
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View ${practitioner.fullName}'s profile`}
                >
                  <UserAvatar
                    name={practitioner.fullName}
                    avatarUrl={practitioner.avatarUrl}
                    className="h-14 w-14"
                    fallbackClassName="text-base"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/practitioner/${practitioner.id}`}
                    className="font-semibold text-lg text-foreground hover:text-primary truncate block"
                    data-testid="appointment-practitioner-link"
                  >
                    {practitioner.fullName}
                  </Link>
                  {practitioner.headline ? (
                    <p className="text-sm text-muted-foreground truncate">{practitioner.headline}</p>
                  ) : null}
                </div>
                <StatusBadge status={appointment.status} full />
              </div>
              {appointment.cancelledLate ? (
                <Badge variant="destructive" className="self-start" data-testid="appointment-late-cancel">
                  Late cancellation
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          {/* When */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <InfoRow
                icon={CalendarDays}
                label={`Your time (${zoneCity(appointment.viewerTimezone)})`}
                value={appointment.viewerLabel}
                testId="appointment-viewer-time"
              />
              {showBothZones ? (
                <InfoRow
                  icon={Globe}
                  label={`${firstName}'s time (${zoneCity(appointment.practitionerTimezone)})`}
                  value={appointment.counterpartLabel}
                  testId="appointment-counterpart-time"
                />
              ) : null}
              <Separator />
              <InfoRow
                icon={Clock}
                label="Duration"
                value={`${formatDuration(appointment.serviceDurationMinutes)} · ends ${clockInZone(
                  appointment.endsAt,
                  appointment.viewerTimezone,
                )}`}
              />
            </CardContent>
          </Card>

          {/* Service */}
          <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 sm:p-5">
              <InfoRow icon={Bookmark} label="Service" value={appointment.serviceName} />
              <InfoRow icon={Video} label="Format" value={sessionFormatLabel[appointment.serviceFormat]} />
              <InfoRow
                icon={Tag}
                label="Price"
                value={formatMoney(appointment.servicePriceCents, appointment.serviceCurrency)}
              />
            </CardContent>
          </Card>

          {payment ? (
            <div className="lg:hidden">
              <PaymentCard
                payment={payment}
                confirming={checkout.isConfirming}
                timedOut={checkout.timedOut}
                onCheckAgain={checkout.resumeConfirming}
              />
            </div>
          ) : null}

          {appointment.clientNotes ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Your notes
                </p>
                <p className="text-sm text-foreground whitespace-pre-line">{appointment.clientNotes}</p>
              </CardContent>
            </Card>
          ) : null}

          {appointment.cancellationReason ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Cancellation reason
                </p>
                <p className="text-sm text-foreground whitespace-pre-line">
                  {appointment.cancellationReason}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {rescheduling ? (
            <ReschedulePicker
              appointment={appointment}
              pending={busy}
              onCancel={() => setRescheduling(false)}
              onPick={(startsAt) => runAction('reschedule', { startsAt })}
            />
          ) : null}

          {errorText ? <ErrorBanner message={errorText} /> : null}
        </div>

        {/* Desktop rail */}
        <aside className="hidden lg:flex flex-col gap-4 lg:sticky lg:top-24">
          {payment ? (
            <PaymentCard
              payment={payment}
              confirming={checkout.isConfirming}
              timedOut={checkout.timedOut}
              onCheckAgain={checkout.resumeConfirming}
            />
          ) : paymentQuery.isLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Spinner className="w-4 h-4" />
                <p className="text-sm text-muted-foreground">Loading payment…</p>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardContent className="p-4">{actions}</CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile / tablet actions */}
      <div className="lg:hidden mt-6">{actions}</div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent data-testid="appointment-cancel-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {appointment.status === 'pending' ? 'Cancel request' : 'Cancel session'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {appointment.status === 'confirmed' ? CANCEL_COPY.confirmed : CANCEL_COPY.pending}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="appointment-cancel-keep">Keep session</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => runAction('cancel')}
              data-testid="appointment-cancel-confirm"
            >
              {appointment.status === 'pending' ? 'Cancel request' : 'Cancel session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
