import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckSquare,
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
  getGetPractitionerCalendarQueryKey,
  getGetPractitionerDashboardQueryKey,
  getListAppointmentsQueryKey,
  getListConversationsQueryKey,
  getListPractitionerPaymentsQueryKey,
  useActOnAppointment,
  useCreateAppointmentRefund,
  useGetAppointment,
  useGetAppointmentPayment,
  useListConversations,
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
  makeIdempotencyKey,
  sessionFormatLabel,
  zoneCity,
} from '@/lib/format';

type Confirmation = 'cancel' | 'decline' | 'refund';

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
 * `/appointment/:id` — one session from whichever side is looking at it,
 * ported from the Expo screen. Clients can pay, reschedule, cancel and review;
 * practitioners can accept/decline, complete, reschedule, cancel and refund.
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
  const isPractitioner = appointment?.viewerRole === 'practitioner';

  const paymentQuery = useGetAppointmentPayment(appointmentId, {
    query: {
      enabled: !!appointmentId,
      queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
    },
  });
  const payment = paymentQuery.data ?? appointment?.payment ?? null;

  const checkout = useCheckoutPopup({ appointmentId, paymentStatus: payment?.status });
  const act = useActOnAppointment();
  const refund = useCreateAppointmentRefund();
  const openConversation = useOpenConversation();

  // Practitioners cannot start conversations (clients do), so look up the
  // existing thread with this client instead.
  const conversationsQuery = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), enabled: isPractitioner },
  });
  const existingConversation = useMemo(
    () =>
      appointment && isPractitioner
        ? conversationsQuery.data?.find((c) => c.otherParty.id === appointment.client.id)
        : undefined,
    [appointment, conversationsQuery.data, isPractitioner],
  );

  const [rescheduling, setRescheduling] = useState(false);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<AppointmentActionRequestAction | null>(null);
  const [calendarBusy, setCalendarBusy] = useState(false);

  useEffect(() => {
    if (!appointment) {
      document.title = 'Session · Healers Inc';
      return;
    }
    const other = appointment.viewerRole === 'client' ? appointment.practitioner : appointment.client;
    document.title = `${appointment.serviceName} with ${other.fullName} · Healers Inc`;
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

  function invalidateLists() {
    void queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey().slice(0, 1) });
    void queryClient.invalidateQueries({ queryKey: getGetAppointmentPaymentQueryKey(appointmentId) });
    void queryClient.invalidateQueries({ queryKey: getGetPractitionerDashboardQueryKey() });
    void queryClient.invalidateQueries({
      queryKey: getGetPractitionerCalendarQueryKey().slice(0, 1),
    });
  }

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
          invalidateLists();
          const titles: Record<AppointmentActionRequestAction, string> = {
            accept: 'Request accepted',
            decline: 'Request declined',
            cancel: 'Session cancelled',
            complete: 'Session marked as completed',
            reschedule: updated.status === 'pending' ? 'New time requested' : 'Session rescheduled',
          };
          toast({
            title: titles[action],
            description: action === 'reschedule' ? `Now ${updated.viewerLabel}.` : undefined,
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

  function runRefund() {
    setActionError(null);
    refund.mutate(
      {
        appointmentId,
        data: { idempotencyKey: makeIdempotencyKey(), reason: 'Practitioner issued full refund' },
      },
      {
        onSuccess: async () => {
          await Promise.all([query.refetch(), paymentQuery.refetch()]);
          void queryClient.invalidateQueries({ queryKey: getListPractitionerPaymentsQueryKey() });
          invalidateLists();
          toast({ title: 'Refund issued', description: 'The full payment is on its way back to the client.' });
        },
        onError: (error) => setActionError(errorMessage(error)),
      },
    );
  }

  function handleMessage() {
    if (!appointment) return;
    setActionError(null);
    if (isPractitioner) {
      if (existingConversation) navigate(`/messages/${existingConversation.id}`);
      return;
    }
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

  const counterpart = isPractitioner ? appointment.client : appointment.practitioner;
  const counterpartZone = isPractitioner ? appointment.clientTimezone : appointment.practitionerTimezone;
  const firstName = counterpart.fullName.split(' ')[0] ?? counterpart.fullName;
  const showBothZones = appointment.clientTimezone !== appointment.practitionerTimezone;
  const isPast = new Date(appointment.endsAt).getTime() < Date.now();
  const isOpen = appointment.status === 'pending' || appointment.status === 'confirmed';
  const backHref = isPractitioner ? '/schedule' : '/bookings';
  const backLabel = isPractitioner ? 'Schedule' : 'Your sessions';

  const canAcceptDecline = isPractitioner && appointment.status === 'pending';
  const canComplete = isPractitioner && appointment.status === 'confirmed' && isPast;
  const canRefund = isPractitioner && payment?.status === 'paid';
  const canCancel = isOpen && !isPast;
  const canReschedule = isOpen && !isPast;
  const canReview = !isPractitioner && appointment.canReview && !appointment.hasReview;
  const canPay =
    !isPractitioner &&
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
  const cancelLabel = appointment.status === 'pending' ? 'Cancel request' : 'Cancel session';
  const messageDisabled = isPractitioner
    ? conversationsQuery.isLoading || !existingConversation
    : openConversation.isPending;

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
          {checkout.isStarting || checkout.isConfirming ? <Spinner className="w-4 h-4" /> : null}
          {checkout.isStarting
            ? 'Opening checkout…'
            : checkout.isConfirming
              ? 'Confirming payment…'
              : checkoutTitle}
        </Button>
      ) : null}

      {canAcceptDecline ? (
        <>
          <Button size="lg" className="w-full" disabled={busy} onClick={() => runAction('accept')} data-testid="appointment-accept">
            {busy && pendingAction === 'accept' ? <Spinner className="w-4 h-4" /> : <Check className="w-4 h-4" aria-hidden />}
            Accept request
          </Button>
          <Button variant="destructive" className="w-full" disabled={busy} onClick={() => setConfirming('decline')} data-testid="appointment-decline">
            {busy && pendingAction === 'decline' ? <Spinner className="w-4 h-4" /> : null}
            Decline
          </Button>
        </>
      ) : null}

      {canComplete ? (
        <Button size="lg" className="w-full" disabled={busy} onClick={() => runAction('complete')} data-testid="appointment-complete">
          {busy && pendingAction === 'complete' ? <Spinner className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" aria-hidden />}
          Mark as completed
        </Button>
      ) : null}

      {canRefund ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Cancellations before the notice window are refunded automatically. Late cancellations are not; you can choose to issue a full refund.
          </p>
          <Button variant="destructive" className="w-full" disabled={refund.isPending} onClick={() => setConfirming('refund')} data-testid="appointment-full-refund">
            {refund.isPending ? <Spinner className="w-4 h-4" /> : null}
            Issue full refund
          </Button>
        </div>
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
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => setRescheduling(true)} data-testid="appointment-reschedule">
          <RefreshCw className="w-4 h-4" aria-hidden />
          Reschedule
        </Button>
      ) : null}

      <Button
        variant="outline"
        className="w-full"
        disabled={messageDisabled}
        onClick={handleMessage}
        title={isPractitioner && !existingConversation && !conversationsQuery.isLoading ? `${firstName} has not started a conversation yet.` : undefined}
        data-testid="appointment-message"
      >
        {openConversation.isPending ? <Spinner className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" aria-hidden />}
        Message {firstName}
      </Button>
      {isPractitioner && !existingConversation && !conversationsQuery.isLoading ? (
        <p className="text-xs text-muted-foreground -mt-1" data-testid="appointment-message-hint">
          Clients start conversations; {firstName} has not messaged you yet.
        </p>
      ) : null}

      <Button variant="ghost" className="w-full" disabled={calendarBusy} onClick={() => void handleAddToCalendar()} data-testid="appointment-add-to-calendar">
        {calendarBusy ? <Spinner className="w-4 h-4" /> : <CalendarPlus className="w-4 h-4 text-primary" aria-hidden />}
        Add to calendar
      </Button>

      {canCancel ? (
        <Button variant={canAcceptDecline ? 'ghost' : 'destructive'} className="w-full" disabled={busy} onClick={() => setConfirming('cancel')} data-testid="appointment-cancel">
          {busy && pendingAction === 'cancel' ? <Spinner className="w-4 h-4" /> : null}
          {cancelLabel}
        </Button>
      ) : null}
    </div>
  );

  const paymentCard = payment ? (
    <PaymentCard
      payment={payment}
      confirming={checkout.isConfirming}
      timedOut={checkout.timedOut}
      onCheckAgain={checkout.resumeConfirming}
      showNet={isPractitioner}
    />
  ) : null;

  const confirmCopy: Record<Confirmation, { title: string; body: string; action: string; keep: string; run: () => void }> = {
    cancel: {
      title: cancelLabel,
      body: appointment.status === 'confirmed' ? CANCEL_COPY.confirmed : CANCEL_COPY.pending,
      action: cancelLabel,
      keep: 'Keep session',
      run: () => runAction('cancel'),
    },
    decline: {
      title: 'Decline request',
      body: `Decline ${firstName}'s booking request? They will be notified.`,
      action: 'Decline',
      keep: 'Back',
      run: () => runAction('decline'),
    },
    refund: {
      title: 'Issue full refund',
      body: 'This returns the full payment to the client. Cancellations made before the notice window are already refunded automatically; late cancellations are not.',
      action: 'Issue refund',
      keep: 'Keep payment',
      run: runRefund,
    },
  };
  const dialog = confirming ? confirmCopy[confirming] : null;

  return (
    <Page testId="page-appointment" className="pb-28 lg:pb-16">
      <PageHeader
        eyebrow={isPractitioner ? 'Session with a client' : 'Session'}
        title={appointment.serviceName}
        description={`With ${counterpart.fullName}`}
        backHref={backHref}
        backLabel={backLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-6 lg:gap-8 items-start">
        <div className="flex flex-col gap-4">
          {/* Who */}
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                {isPractitioner ? (
                  <UserAvatar name={counterpart.fullName} avatarUrl={counterpart.avatarUrl} className="h-14 w-14" fallbackClassName="text-base" />
                ) : (
                  <Link
                    href={`/practitioner/${counterpart.id}`}
                    className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`View ${counterpart.fullName}'s profile`}
                  >
                    <UserAvatar name={counterpart.fullName} avatarUrl={counterpart.avatarUrl} className="h-14 w-14" fallbackClassName="text-base" />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  {isPractitioner ? (
                    <p className="font-semibold text-lg text-foreground truncate" data-testid="appointment-client-name">
                      {counterpart.fullName}
                    </p>
                  ) : (
                    <Link
                      href={`/practitioner/${counterpart.id}`}
                      className="font-semibold text-lg text-foreground hover:text-primary truncate block"
                      data-testid="appointment-practitioner-link"
                    >
                      {counterpart.fullName}
                    </Link>
                  )}
                  {counterpart.headline ? (
                    <p className="text-sm text-muted-foreground truncate">{counterpart.headline}</p>
                  ) : isPractitioner ? (
                    <p className="text-sm text-muted-foreground truncate">Client · {zoneCity(counterpart.timezone)}</p>
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
              <InfoRow icon={CalendarDays} label={`Your time (${zoneCity(appointment.viewerTimezone)})`} value={appointment.viewerLabel} testId="appointment-viewer-time" />
              {showBothZones ? (
                <InfoRow icon={Globe} label={`${firstName}'s time (${zoneCity(counterpartZone)})`} value={appointment.counterpartLabel} testId="appointment-counterpart-time" />
              ) : null}
              <Separator />
              <InfoRow
                icon={Clock}
                label="Duration"
                value={`${formatDuration(appointment.serviceDurationMinutes)} · ends ${clockInZone(appointment.endsAt, appointment.viewerTimezone)}`}
              />
            </CardContent>
          </Card>

          {/* Service */}
          <Card>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 sm:p-5">
              <InfoRow icon={Bookmark} label="Service" value={appointment.serviceName} />
              <InfoRow icon={Video} label="Format" value={sessionFormatLabel[appointment.serviceFormat]} />
              <InfoRow icon={Tag} label="Price" value={formatMoney(appointment.servicePriceCents, appointment.serviceCurrency)} />
            </CardContent>
          </Card>

          {paymentCard ? <div className="lg:hidden">{paymentCard}</div> : null}

          {appointment.clientNotes ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {isPractitioner ? 'Client notes' : 'Your notes'}
                </p>
                <p className="text-sm text-foreground whitespace-pre-line">{appointment.clientNotes}</p>
              </CardContent>
            </Card>
          ) : null}

          {appointment.cancellationReason ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cancellation reason</p>
                <p className="text-sm text-foreground whitespace-pre-line">{appointment.cancellationReason}</p>
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
          {paymentCard ??
            (paymentQuery.isLoading ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Spinner className="w-4 h-4" />
                  <p className="text-sm text-muted-foreground">Loading payment…</p>
                </CardContent>
              </Card>
            ) : null)}
          <Card>
            <CardContent className="p-4">{actions}</CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile / tablet actions */}
      <div className="lg:hidden mt-6">{actions}</div>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => (!open ? setConfirming(null) : undefined)}>
        <AlertDialogContent data-testid="appointment-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="appointment-confirm-keep">{dialog?.keep}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => dialog?.run()}
              data-testid="appointment-confirm-action"
            >
              {dialog?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
