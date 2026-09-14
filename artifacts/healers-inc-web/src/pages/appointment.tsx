import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  Clock,
  CreditCard,
  Globe,
  Loader2,
  MessageCircle,
  RefreshCw,
  Star,
  Tag,
  Video,
} from 'lucide-react';
import {
  getGetAppointmentCalendarFileQueryKey,
  getGetAppointmentPaymentQueryKey,
  getGetAppointmentQueryKey,
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  getListAppointmentsQueryKey,
  useActOnAppointment,
  useCreateAppointmentCheckout,
  useGetAppointment,
  useGetAppointmentCalendarFile,
  useGetAppointmentPayment,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  useOpenConversation,
  type Appointment,
  type AppointmentActionRequestAction,
  type PaymentSummary,
  type PractitionerPaymentStatus,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/healers-inc/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@workspace/healers-inc/components/ui/alert-dialog';

import { EmptyState } from '@/pages/discover';
import { PageLoader, RequireClient } from '@/components/route-guards';
import { StatusBadge } from '@/components/status-badge';
import { mediaUrl } from '@/lib/api';
import { errorMessage, errorStatus } from '@/lib/errors';
import {
  clockInZone,
  formatCalendarDate,
  formatDuration,
  formatMoney,
  makeIdempotencyKey,
  sessionFormatLabel,
  todayIso,
  zoneCity,
} from '@/lib/format';

/** How far ahead the reschedule picker looks. */
const RESCHEDULE_DAYS = 21;

export default function AppointmentPage() {
  return (
    <RequireClient>
      <AppointmentDetail />
    </RequireClient>
  );
}

function AppointmentDetail() {
  const params = useParams<{ id: string }>();
  const appointmentId = params.id ?? '';
  const search = useSearch();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [pendingAction, setPendingAction] =
    useState<AppointmentActionRequestAction | null>(null);

  const query = useGetAppointment(appointmentId, {
    query: {
      queryKey: getGetAppointmentQueryKey(appointmentId),
      enabled: !!appointmentId,
    },
  });
  const appointment = query.data;

  const paymentQuery = useGetAppointmentPayment(appointmentId, {
    query: {
      queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
      enabled: !!appointmentId,
      // While the provider confirms, poll: the result arrives by webhook, not
      // in the response to anything this page did.
      refetchInterval: confirmingPayment ? 2500 : false,
    },
  });
  const payment = paymentQuery.data ?? appointment?.payment ?? null;

  const act = useActOnAppointment();
  const checkout = useCreateAppointmentCheckout();
  const openConversation = useOpenConversation();
  const calendarFileQuery = useGetAppointmentCalendarFile(appointmentId, {
    query: {
      queryKey: getGetAppointmentCalendarFileQueryKey(appointmentId),
      enabled: false,
    },
  });

  useEffect(() => {
    document.title = appointment
      ? `${appointment.serviceName} — Healers Inc`
      : 'Your session — Healers Inc';
  }, [appointment]);

  // A return that landed in this tab rather than a popup.
  useEffect(() => {
    const status = new URLSearchParams(search).get('checkout');
    if (status === 'success') setConfirmingPayment(true);
  }, [search]);

  // The popup hands its result back here.
  useEffect(() => {
    const handleReturn = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const message = event.data as {
        type?: unknown;
        appointmentId?: unknown;
        status?: unknown;
      };
      if (
        message.type !== 'healers.checkout.return' ||
        message.appointmentId !== appointmentId
      ) {
        return;
      }
      setConfirmingPayment(message.status === 'success');
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetAppointmentQueryKey(appointmentId),
        }),
        queryClient.invalidateQueries({
          queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
        }),
      ]);
    };
    window.addEventListener('message', handleReturn);
    return () => window.removeEventListener('message', handleReturn);
  }, [appointmentId, queryClient]);

  // Stop polling once the payment reaches a settled state.
  useEffect(() => {
    if (
      confirmingPayment &&
      payment &&
      payment.status !== 'checkout_pending' &&
      payment.status !== 'processing'
    ) {
      setConfirmingPayment(false);
    }
  }, [confirmingPayment, payment]);

  const runAction = useCallback(
    (action: AppointmentActionRequestAction, extra?: { startsAt?: string }) => {
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
            queryClient.setQueryData(
              getGetAppointmentQueryKey(appointmentId),
              updated,
            );
            void queryClient.invalidateQueries({
              queryKey: getListAppointmentsQueryKey(),
            });
            void queryClient.invalidateQueries({
              queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
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
    },
    [act, appointmentId, query, queryClient],
  );

  const handleCheckout = () => {
    setActionError(null);
    // Opened before the request so the browser still attributes it to the
    // click; a popup opened from an async callback is blocked.
    const checkoutWindow = window.open(
      'about:blank',
      'healers-checkout',
      'popup,width=520,height=760',
    );
    if (!checkoutWindow) {
      setActionError(
        'Checkout was blocked by the browser. Allow pop-ups for this site and try again.',
      );
      return;
    }
    checkout.mutate(
      {
        appointmentId,
        data: { idempotencyKey: makeIdempotencyKey(), returnTarget: 'site' },
      },
      {
        onSuccess: (session) => {
          queryClient.setQueryData(
            getGetAppointmentPaymentQueryKey(appointmentId),
            session.payment,
          );
          setConfirmingPayment(true);
          checkoutWindow.location.assign(session.checkoutUrl);
        },
        onError: (error) => {
          checkoutWindow.close();
          setActionError(errorMessage(error, 'Could not start checkout.'));
        },
      },
    );
  };

  const handleMessage = () => {
    if (!appointment) return;
    setActionError(null);
    openConversation.mutate(
      { data: { practitionerId: appointment.practitioner.id } },
      {
        onSuccess: (conversation) => navigate(`/messages/${conversation.id}`),
        onError: (error) =>
          setActionError(errorMessage(error, 'Could not open the conversation.')),
      },
    );
  };

  const handleAddToCalendar = async () => {
    setActionError(null);
    const result = await calendarFileQuery.refetch();
    const file = result.data;
    if (!file) {
      setActionError('Could not load the calendar invite. Please try again.');
      return;
    }
    // A browser can save the invite directly, so hand over a real .ics file.
    const blob = new Blob([file.content], { type: file.contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (query.isLoading) return <PageLoader label="Loading your session…" />;

  if (query.isError || !appointment) {
    return (
      <main className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <EmptyState
            icon={<AlertCircle className="w-6 h-6 text-primary" aria-hidden />}
            title="Couldn't load this session"
            description={errorMessage(query.error, 'Please try again.')}
            action={
              <Button variant="outline" asChild>
                <Link href="/bookings">Back to your sessions</Link>
              </Button>
            }
          />
        </div>
      </main>
    );
  }

  const counterpart = appointment.practitioner;
  const showBothZones =
    appointment.clientTimezone !== appointment.practitionerTimezone;
  const isPast = new Date(appointment.endsAt).getTime() < Date.now();
  const isOpen =
    appointment.status === 'pending' || appointment.status === 'confirmed';

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

  return (
    <main
      className="min-h-[100dvh] bg-background pt-24 pb-20 px-4 sm:px-6"
      data-testid="page-appointment"
    >
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
        <Link
          href="/bookings"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="back-to-bookings"
        >
          ← Your sessions
        </Link>

        {/* Identity */}
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarImage src={mediaUrl(counterpart.avatarUrl)} alt="" />
              <AvatarFallback className="text-sm font-semibold text-primary">
                {counterpart.fullName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-foreground truncate">
                {counterpart.fullName}
              </h1>
              {counterpart.headline ? (
                <p className="text-sm text-muted-foreground truncate">
                  {counterpart.headline}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <StatusBadge status={appointment.status} full />
              {appointment.cancelledLate ? (
                <Badge variant="destructive">Late cancellation</Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* When */}
        <Card>
          <CardContent className="p-5 flex flex-col gap-4">
            <InfoRow
              icon={<CalendarDays className="w-4 h-4" aria-hidden />}
              label={`Your time (${zoneCity(appointment.viewerTimezone)})`}
              value={appointment.viewerLabel}
            />
            {showBothZones ? (
              <InfoRow
                icon={<Globe className="w-4 h-4" aria-hidden />}
                label={`${counterpart.fullName.split(' ')[0]}'s time (${zoneCity(
                  appointment.practitionerTimezone,
                )})`}
                value={appointment.counterpartLabel}
              />
            ) : null}
            <Separator />
            <InfoRow
              icon={<Clock className="w-4 h-4" aria-hidden />}
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
          <CardContent className="p-5 flex flex-col gap-4">
            <InfoRow
              icon={<Tag className="w-4 h-4" aria-hidden />}
              label="Service"
              value={appointment.serviceName}
            />
            <InfoRow
              icon={<Video className="w-4 h-4" aria-hidden />}
              label="Format"
              value={sessionFormatLabel[appointment.serviceFormat]}
            />
            <InfoRow
              icon={<CreditCard className="w-4 h-4" aria-hidden />}
              label="Price"
              value={formatMoney(
                appointment.servicePriceCents,
                appointment.serviceCurrency,
              )}
            />
          </CardContent>
        </Card>

        {payment ? (
          <PaymentCard payment={payment} confirming={confirmingPayment} />
        ) : paymentQuery.isLoading ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : null}

        {appointment.clientNotes ? (
          <NoteCard label="Your notes" body={appointment.clientNotes} />
        ) : null}
        {appointment.cancellationReason ? (
          <NoteCard
            label="Cancellation reason"
            body={appointment.cancellationReason}
          />
        ) : null}

        {rescheduling ? (
          <ReschedulePicker
            appointment={appointment}
            pending={act.isPending}
            onCancel={() => setRescheduling(false)}
            onPick={(startsAt) => runAction('reschedule', { startsAt })}
          />
        ) : null}

        {actionError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3"
            data-testid="appointment-error"
          >
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-destructive leading-relaxed">{actionError}</p>
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {canPay ? (
            <Button
              size="lg"
              onClick={handleCheckout}
              disabled={checkout.isPending}
              data-testid="appointment-pay-securely"
            >
              {checkout.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Opening checkout…
                </>
              ) : (
                checkoutTitle
              )}
            </Button>
          ) : null}

          {canReview ? (
            <Button variant="secondary" asChild data-testid="appointment-review">
              <Link href={`/bookings/${appointmentId}/review`} className="gap-2">
                <Star className="w-4 h-4" aria-hidden />
                Leave a review
              </Link>
            </Button>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleMessage}
              disabled={openConversation.isPending}
              className="gap-2"
              data-testid="appointment-message"
            >
              <MessageCircle className="w-4 h-4" aria-hidden />
              {openConversation.isPending ? 'Opening…' : 'Message practitioner'}
            </Button>

            <Button
              variant="outline"
              onClick={() => void handleAddToCalendar()}
              disabled={calendarFileQuery.isFetching}
              className="gap-2"
              data-testid="appointment-calendar"
            >
              <CalendarPlus className="w-4 h-4" aria-hidden />
              {calendarFileQuery.isFetching ? 'Preparing…' : 'Add to calendar'}
            </Button>

            {canReschedule ? (
              <Button
                variant="outline"
                onClick={() => setRescheduling((v) => !v)}
                className="gap-2"
                data-testid="appointment-reschedule"
              >
                <RefreshCw className="w-4 h-4" aria-hidden />
                {rescheduling ? 'Stop rescheduling' : 'Reschedule'}
              </Button>
            ) : null}

            {canCancel ? (
              <CancelDialog
                pending={act.isPending && pendingAction === 'cancel'}
                onConfirm={() => runAction('cancel')}
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function NoteCard({ label, body }: { label: string; body: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">
          {label}
        </p>
        <p className="text-foreground leading-relaxed whitespace-pre-line">{body}</p>
      </CardContent>
    </Card>
  );
}

const PAYMENT_LABELS: Record<
  PractitionerPaymentStatus,
  { label: string; title: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  not_required: { label: 'Not required', title: 'Payment not required', variant: 'secondary' },
  unavailable: { label: 'Unavailable', title: 'In-app payment unavailable', variant: 'secondary' },
  checkout_available: { label: 'Awaiting checkout', title: 'Ready for secure payment', variant: 'outline' },
  checkout_pending: { label: 'Awaiting checkout', title: 'Checkout started', variant: 'outline' },
  processing: { label: 'Processing', title: 'Confirming payment', variant: 'outline' },
  paid: { label: 'Paid', title: 'Payment complete', variant: 'default' },
  partially_refunded: { label: 'Partly refunded', title: 'Payment partly refunded', variant: 'secondary' },
  refunded: { label: 'Refunded', title: 'Payment refunded', variant: 'secondary' },
  failed: { label: 'Failed', title: 'Payment failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', title: 'Checkout cancelled', variant: 'secondary' },
};

function PaymentCard({
  payment,
  confirming,
}: {
  payment: PaymentSummary;
  confirming: boolean;
}) {
  const state = PAYMENT_LABELS[payment.status];
  const settled = payment.status !== 'not_required' && payment.status !== 'unavailable';

  return (
    <Card data-testid="payment-card">
      <CardContent className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Payment</h2>
          <Badge variant={confirming ? 'outline' : state.variant} data-testid="payment-status">
            {confirming ? 'Processing' : state.label}
          </Badge>
        </div>
        <p className="font-medium text-foreground">
          {confirming ? 'Confirming payment' : state.title}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {confirming
            ? 'The payment provider is confirming the result. This page updates as soon as the secure webhook confirms it.'
            : payment.message}
        </p>
        {settled ? (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Amount</span>
              <span className="font-semibold text-foreground">
                {formatMoney(payment.grossAmountCents, payment.currency)}
              </span>
            </div>
            {payment.refundedAt ? (
              <p className="text-sm text-muted-foreground">
                Refunded on{' '}
                {formatCalendarDate(payment.refundedAt.slice(0, 10), true)}.
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CancelDialog({
  pending,
  onConfirm,
}: {
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="appointment-cancel">
          Cancel session
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="cancel-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Cancelling before your practitioner's notice window is refunded
            automatically. A late cancellation is not refunded automatically.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="cancel-dialog-keep">
            Keep session
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            data-testid="cancel-dialog-confirm"
          >
            {pending ? 'Cancelling…' : 'Cancel session'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ReschedulePicker({
  appointment,
  pending,
  onCancel,
  onPick,
}: {
  appointment: Appointment;
  pending: boolean;
  onCancel: () => void;
  onPick: (startsAt: string) => void;
}) {
  // The availability endpoint needs a serviceId; resolve it from the
  // practitioner's public services by matching the booked service name.
  const profileQuery = useGetPractitionerProfile(appointment.practitioner.id, {
    query: {
      queryKey: getGetPractitionerProfileQueryKey(appointment.practitioner.id),
    },
  });

  const serviceId = useMemo(() => {
    const services = profileQuery.data?.services ?? [];
    return (
      services.find((s) => s.name === appointment.serviceName)?.id ??
      services[0]?.id
    );
  }, [profileQuery.data, appointment.serviceName]);

  const from = todayIso(0, appointment.viewerTimezone);
  const to = todayIso(RESCHEDULE_DAYS, appointment.viewerTimezone);
  const params = {
    practitionerId: appointment.practitioner.id,
    serviceId: serviceId ?? '',
    from,
    to,
    timezone: appointment.viewerTimezone,
  };

  const availabilityQuery = useGetPractitionerAvailability(params, {
    query: {
      queryKey: getGetPractitionerAvailabilityQueryKey(params),
      enabled: !!serviceId,
    },
  });

  const days = (availabilityQuery.data?.days ?? []).filter(
    (d) => d.slots.length > 0,
  );
  const loading = profileQuery.isLoading || availabilityQuery.isLoading;

  return (
    <Card data-testid="reschedule-picker">
      <CardContent className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" aria-hidden />
          <h2 className="font-semibold text-foreground flex-1">Pick a new time</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Close
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : availabilityQuery.isError ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              {errorMessage(availabilityQuery.error, "Couldn't load availability.")}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void availabilityQuery.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open slots in the next three weeks.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {days.map((day) => (
              <div key={day.date} className="flex flex-col gap-2">
                <p className="text-sm font-medium text-foreground">
                  {formatCalendarDate(day.date)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {day.slots.map((slot) => (
                    <Button
                      key={slot.startsAt}
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => onPick(slot.startsAt)}
                      data-testid={`reschedule-slot-${slot.startsAt}`}
                    >
                      {slot.viewerLabel}
                    </Button>
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
