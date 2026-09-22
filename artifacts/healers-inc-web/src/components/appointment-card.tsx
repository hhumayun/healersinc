import { Link } from 'wouter';
import { CalendarDays, ChevronRight } from 'lucide-react';
import type { Appointment } from '@workspace/api-client-react';
import { cn } from '@workspace/healers-inc/lib/utils';

import { StatusBadge } from '@/components/status-badge';
import { UserAvatar } from '@/components/user-avatar';
import { PaymentBadge, isListedPaymentStatus } from '@/components/appointment/payment-badge';
import { formatDuration, formatMoney, sessionFormatLabel } from '@/lib/format';

/**
 * One booking in a list, from the client's side. `viewerLabel` and
 * `counterpartLabel` are already rendered by the API in the right time zones,
 * so the card only decides whether the second zone is worth showing.
 */
export function AppointmentCard({
  appointment,
  className,
}: {
  appointment: Appointment;
  className?: string;
}) {
  const counterpart =
    appointment.viewerRole === 'client' ? appointment.practitioner : appointment.client;
  const showBothZones = appointment.clientTimezone !== appointment.practitionerTimezone;
  const firstName = counterpart.fullName.split(' ')[0] ?? counterpart.fullName;
  const payment = appointment.payment;

  return (
    <Link
      href={`/appointment/${appointment.id}`}
      className={cn(
        'group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm',
        'transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      data-testid={`appointment-card-${appointment.id}`}
      aria-label={`${appointment.serviceName} with ${counterpart.fullName}, ${appointment.viewerLabel}`}
    >
      <div className="flex items-center gap-3">
        <UserAvatar
          name={counterpart.fullName}
          avatarUrl={counterpart.avatarUrl}
          className="h-11 w-11"
          fallbackClassName="text-sm"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{counterpart.fullName}</p>
          <p className="text-sm text-muted-foreground truncate">{appointment.serviceName}</p>
        </div>
        <StatusBadge status={appointment.status} />
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary shrink-0" aria-hidden />
          <p className="text-sm font-medium text-foreground">{appointment.viewerLabel}</p>
        </div>
        {showBothZones ? (
          <p className="text-xs text-muted-foreground pl-6">
            {appointment.counterpartLabel} for {firstName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{formatDuration(appointment.serviceDurationMinutes)}</span>
        <span aria-hidden>·</span>
        <span>{sessionFormatLabel[appointment.serviceFormat]}</span>
        <span aria-hidden>·</span>
        <span>{formatMoney(appointment.servicePriceCents, appointment.serviceCurrency)}</span>
        <span className="ml-auto inline-flex items-center gap-2">
          {payment && isListedPaymentStatus(payment.status) ? (
            <PaymentBadge status={payment.status} />
          ) : null}
          <ChevronRight
            className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </div>
    </Link>
  );
}
