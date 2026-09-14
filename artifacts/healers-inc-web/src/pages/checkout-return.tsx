import { useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';

import { PageLoader } from '@/components/route-guards';

/**
 * Where hosted Checkout sends the payer back to. The booking page opens
 * Checkout in a popup, so the usual path is: hand the result to the opener
 * and close. When there is no opener — a redirect in the same tab, or a
 * restored session — fall back to the appointment itself.
 */
export default function CheckoutReturn() {
  const search = useSearch();
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const appointmentId = params.get('appointmentId');
    const status = params.get('status');

    if (!appointmentId || (status !== 'success' && status !== 'cancelled')) {
      navigate('/bookings', { replace: true });
      return;
    }

    if (window.opener) {
      window.opener.postMessage(
        { type: 'healers.checkout.return', appointmentId, status },
        window.location.origin,
      );
      window.close();
      return;
    }

    navigate(`/bookings/${appointmentId}?checkout=${status}`, { replace: true });
  }, [search, navigate]);

  return <PageLoader label="Returning to your session…" />;
}
