import type { ReactNode } from 'react';
import { Clock, Globe, ShieldCheck, Zap } from 'lucide-react';
import type {
  AvailabilitySlot,
  BookingPolicy,
  PractitionerCard,
  Service,
} from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';
import { Separator } from '@workspace/healers-inc/components/ui/separator';
import { cn } from '@workspace/healers-inc/lib/utils';

import { UserAvatar } from '@/components/user-avatar';
import {
  formatCalendarDate,
  formatDuration,
  formatMoney,
  sessionFormatLabel,
  zoneCity,
} from '@/lib/format';

export type BookingSummaryProps = {
  practitioner: PractitionerCard;
  policy: BookingPolicy;
  service: Service | null;
  date: string | null;
  slot: AvailabilitySlot | null;
  viewerTimezone: string;
  /** From the availability calendar when loaded, else the profile. */
  practitionerTimezone: string;
  sameTimezone: boolean;
  paymentsEnabled: boolean;
  /** Error banner + confirm button, rendered by the page so it can differ per breakpoint. */
  footer?: ReactNode;
  className?: string;
};

/** Cancellation copy shared by the summary card and the mobile bar. */
export function cancellationNotice(policy: BookingPolicy): string {
  const hours = policy.cancellationNoticeHours;
  if (hours <= 0) return 'Cancel any time before the session starts.';
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `Cancel up to ${days} ${days === 1 ? 'day' : 'days'} before the session.`;
  }
  return `Cancel up to ${hours} ${hours === 1 ? 'hour' : 'hours'} before the session.`;
}

/**
 * The "Review & confirm" card. Sticky in the right-hand column on desktop and
 * part of the stack on mobile. Shows the chosen time in the visitor's zone and,
 * when it differs, the practitioner's zone too.
 */
export function BookingSummary({
  practitioner,
  policy,
  service,
  date,
  slot,
  viewerTimezone,
  practitionerTimezone,
  sameTimezone,
  paymentsEnabled,
  footer,
  className,
}: BookingSummaryProps) {
  const instant = policy.instantBooking;
  const currency = service?.currency || practitioner.currency;

  return (
    <Card className={cn('overflow-hidden', className)} data-testid="booking-summary">
      <CardHeader className="gap-3 pb-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={practitioner.fullName} avatarUrl={practitioner.avatarUrl} className="h-12 w-12" />
          <div className="min-w-0">
            <CardTitle className="truncate text-base" data-testid="summary-practitioner-name">
              {practitioner.fullName}
            </CardTitle>
            {practitioner.headline ? (
              <p className="mt-1 truncate text-sm text-muted-foreground">{practitioner.headline}</p>
            ) : null}
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" aria-hidden />
              {zoneCity(practitionerTimezone)} ({practitionerTimezone})
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <Separator />
        {service ? (
          <>
            <SummaryRow label="Service" value={service.name} />
            <SummaryRow label="Duration" value={formatDuration(service.durationMinutes)} />
            <SummaryRow label="Format" value={sessionFormatLabel[service.format]} />
            <SummaryRow label="Price" value={formatMoney(service.priceCents, currency)} emphasize testId="summary-price" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="summary-no-service">
            Choose a service to see the price and duration.
          </p>
        )}

        <Separator />

        {slot && date ? (
          <>
            <SummaryRow label="Date" value={formatCalendarDate(date, true)} testId="summary-date" />
            <SummaryRow
              label={`Your time (${zoneCity(viewerTimezone)})`}
              value={slot.viewerLabel}
              emphasize
              testId="summary-viewer-time"
            />
            {!sameTimezone ? (
              <SummaryRow
                label={`Their time (${zoneCity(practitionerTimezone)})`}
                value={slot.practitionerLabel}
                testId="summary-practitioner-time"
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="summary-no-slot">
            {service ? 'Pick a day and time to continue.' : 'Then pick a day and time.'}
          </p>
        )}

        <Separator />

        <div className="flex items-start gap-2 text-sm">
          {instant ? (
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          )}
          <p className="flex-1 text-muted-foreground">
            {instant
              ? 'Confirmed instantly once you book.'
              : 'Sent as a request — the practitioner confirms it.'}
          </p>
          <Badge
            variant="outline"
            className={cn(
              'shrink-0',
              instant ? 'border-transparent bg-primary/10 text-primary' : 'border-transparent bg-muted text-muted-foreground',
            )}
            data-testid="summary-booking-mode"
          >
            {instant ? 'Instant' : 'Request'}
          </Badge>
        </div>

        <div className="flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="flex-1 text-muted-foreground" data-testid="summary-cancellation">
            {cancellationNotice(policy)}
          </p>
        </div>

        {paymentsEnabled ? (
          <p className="text-xs leading-relaxed text-muted-foreground" data-testid="summary-payment-note">
            No payment is taken now. If this practitioner supports in-app payments, payment is
            requested securely only after the session is accepted and confirmed.
          </p>
        ) : null}

        {footer ? (
          <>
            <Separator />
            <div className="flex flex-col gap-3">{footer}</div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
  testId,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn('min-w-0 text-right text-foreground', emphasize ? 'font-semibold' : '')}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}
