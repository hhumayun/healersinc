import type { PractitionerPaymentStatus } from '@workspace/api-client-react';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { cn } from '@workspace/healers-inc/lib/utils';

/**
 * Copy and tinting for every payment state, ported from the Expo appointment
 * screen. Tints are theme tokens only: accent for "money in motion", primary
 * for settled, secondary for refunds, destructive for failures.
 */
export const PAYMENT_STATES: Record<
  PractitionerPaymentStatus,
  { label: string; title: string; className: string }
> = {
  not_required: {
    label: 'Not required',
    title: 'Payment not required',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
  unavailable: {
    label: 'Unavailable',
    title: 'In-app payment unavailable',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
  checkout_available: {
    label: 'Payment due',
    title: 'Ready for secure payment',
    className: 'border-transparent bg-accent/15 text-accent',
  },
  checkout_pending: {
    label: 'Awaiting checkout',
    title: 'Checkout started',
    className: 'border-transparent bg-accent/15 text-accent',
  },
  processing: {
    label: 'Processing',
    title: 'Confirming payment',
    className: 'border-transparent bg-accent/15 text-accent',
  },
  paid: {
    label: 'Paid',
    title: 'Payment complete',
    className: 'border-transparent bg-primary/15 text-primary',
  },
  partially_refunded: {
    label: 'Partly refunded',
    title: 'Payment partly refunded',
    className: 'border-transparent bg-secondary text-secondary-foreground',
  },
  refunded: {
    label: 'Refunded',
    title: 'Payment refunded',
    className: 'border-transparent bg-secondary text-secondary-foreground',
  },
  failed: {
    label: 'Payment failed',
    title: 'Payment failed',
    className: 'border-transparent bg-destructive/10 text-destructive',
  },
  cancelled: {
    label: 'Checkout cancelled',
    title: 'Checkout cancelled',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
};

/** States worth flagging on a list card; the rest are noise there. */
const LISTED: ReadonlySet<PractitionerPaymentStatus> = new Set([
  'checkout_available',
  'checkout_pending',
  'processing',
  'paid',
  'partially_refunded',
  'refunded',
  'failed',
]);

export function isListedPaymentStatus(status: PractitionerPaymentStatus): boolean {
  return LISTED.has(status);
}

export function PaymentBadge({
  status,
  label,
  className,
}: {
  status: PractitionerPaymentStatus;
  /** Override the default one-line label (e.g. "Processing" while confirming). */
  label?: string;
  className?: string;
}) {
  const state = PAYMENT_STATES[status];
  return (
    <Badge
      variant="outline"
      className={cn('shadow-none', state.className, className)}
      data-testid={`payment-badge-${status}`}
    >
      {label ?? state.label}
    </Badge>
  );
}
