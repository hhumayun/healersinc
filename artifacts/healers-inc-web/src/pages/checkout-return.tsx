import { useEffect, useMemo, useState } from 'react';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import { Button } from '@workspace/healers-inc/components/ui/button';

import { LoadingBlock, Page } from '@/components/page';
import {
  CHECKOUT_RETURN_MESSAGE,
  type CheckoutReturnMessage,
  type CheckoutReturnStatus,
} from '@/hooks/use-checkout-popup';

function parseStatus(value: string | null): CheckoutReturnStatus | null {
  return value === 'success' || value === 'cancelled' ? value : null;
}

/**
 * Where Stripe Checkout sends the browser back to
 * (`/checkout-return?appointmentId=…&status=success|cancelled`).
 *
 * Inside the Checkout popup this posts the result to the page that opened it
 * and closes itself. If Checkout ran in the same tab (popup blocked), it
 * forwards to the appointment page, which resumes confirming the payment.
 */
export default function CheckoutReturnPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { appointmentId, status } = useMemo(() => {
    const params = new URLSearchParams(search);
    return {
      appointmentId: params.get('appointmentId')?.trim() || null,
      status: parseStatus(params.get('status')),
    };
  }, [search]);
  const [stuck, setStuck] = useState(false);

  const target = appointmentId && status ? `/appointment/${appointmentId}?checkout=${status}` : null;

  useEffect(() => {
    document.title = 'Returning to your session · Healers Inc';
  }, []);

  useEffect(() => {
    if (!appointmentId || !status || !target) return;

    if (window.opener && window.opener !== window) {
      const message: CheckoutReturnMessage = {
        type: CHECKOUT_RETURN_MESSAGE,
        appointmentId,
        status,
      };
      try {
        (window.opener as Window).postMessage(message, window.location.origin);
      } catch {
        // The opener may have navigated away; the appointment page polls anyway.
      }
      window.close();
      // If the browser refused to close the popup, offer a way out.
      const timer = setTimeout(() => setStuck(true), 1500);
      return () => clearTimeout(timer);
    }

    navigate(target, { replace: true });
    return undefined;
  }, [appointmentId, navigate, status, target]);

  if (!appointmentId || !status || !target) {
    return <Redirect to="/" replace />;
  }

  return (
    <Page width="narrow" testId="page-checkout-return">
      <LoadingBlock label="Returning to your session…" />
      {stuck ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">You can close this window now.</p>
          <Button asChild variant="outline" data-testid="checkout-return-open-session">
            <Link href={target}>Open the session here instead</Link>
          </Button>
        </div>
      ) : null}
    </Page>
  );
}
