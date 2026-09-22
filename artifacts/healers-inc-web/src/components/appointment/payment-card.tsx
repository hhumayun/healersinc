import { CreditCard } from 'lucide-react';
import type { PaymentSummary } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@workspace/healers-inc/components/ui/card';
import { Spinner } from '@workspace/healers-inc/components/ui/spinner';

import { InfoRow } from '@/components/appointment/info-row';
import { PAYMENT_STATES, PaymentBadge } from '@/components/appointment/payment-badge';
import { formatMoney } from '@/lib/format';

/**
 * The "Payment" block of the session page, ported from the Expo screen. While
 * `confirming` the copy explains that we are waiting on the secure webhook;
 * after the polling window ends a "Check again" button lets the person retry.
 */
export function PaymentCard({
  payment,
  confirming,
  timedOut,
  onCheckAgain,
}: {
  payment: PaymentSummary;
  confirming: boolean;
  timedOut: boolean;
  onCheckAgain: () => void;
}) {
  const state = PAYMENT_STATES[payment.status];
  const title = confirming ? 'Confirming payment' : timedOut ? 'Still confirming' : state.title;
  const showAmount = payment.status !== 'not_required' && payment.status !== 'unavailable';

  return (
    <Card data-testid="appointment-payment-card">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Payment</CardTitle>
        {confirming ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="w-3.5 h-3.5 text-accent" />
            <PaymentBadge status="processing" label="Processing" />
          </span>
        ) : (
          <PaymentBadge status={payment.status} />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="font-semibold text-foreground" data-testid="appointment-payment-title">
          {title}
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {confirming
            ? 'The payment provider is confirming the result. This page will update when the secure webhook confirms payment.'
            : timedOut
              ? 'We have not heard back from the payment provider yet. Your card may still have been charged; check again in a moment before paying twice.'
              : payment.message}
        </p>
        {showAmount ? (
          <InfoRow
            icon={CreditCard}
            label="Amount"
            value={formatMoney(payment.grossAmountCents, payment.currency)}
            testId="appointment-payment-amount"
          />
        ) : null}
        {timedOut ? (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={onCheckAgain}
            data-testid="appointment-payment-check-again"
          >
            Check again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
