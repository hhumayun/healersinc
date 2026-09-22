import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAppointmentPaymentQueryKey,
  getGetAppointmentQueryKey,
  useCreateAppointmentCheckout,
  type PractitionerPaymentStatus,
} from '@workspace/api-client-react';
import { toast } from '@workspace/healers-inc/hooks/use-toast';

import { errorMessage } from '@/lib/errors';
import { makeIdempotencyKey } from '@/lib/format';

/** Message the `/checkout-return` popup posts back to the page that opened it. */
export const CHECKOUT_RETURN_MESSAGE = 'healers.checkout.return';

export type CheckoutReturnStatus = 'success' | 'cancelled';

export type CheckoutReturnMessage = {
  type: typeof CHECKOUT_RETURN_MESSAGE;
  appointmentId: string;
  status: CheckoutReturnStatus;
};

export type CheckoutPhase =
  /** Nothing in flight. */
  | 'idle'
  /** Creating the Checkout session; the popup is open on a blank page. */
  | 'starting'
  /** Checkout is open (or just returned); polling until the webhook lands. */
  | 'confirming'
  /** Polled for the full window without a final state. */
  | 'timed_out';

const POLL_MS = 2_000;
const POPUP_WATCH_MS = 500;
const CONFIRM_TIMEOUT_MS = 60_000;
const POPUP_WIDTH = 520;
const POPUP_HEIGHT = 760;

/** The site's own base URL, which the API must have allowlisted. */
export function webReturnBaseUrl(): string {
  const base = (import.meta.env.BASE_URL as string | undefined) ?? '/';
  return `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}`;
}

function popupFeatures(): string {
  const left = Math.max(
    0,
    Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2),
  );
  const top = Math.max(
    0,
    Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2),
  );
  return `popup=yes,width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},resizable=yes,scrollbars=yes`;
}

/**
 * Stripe Checkout in a centered popup, mirroring the Expo web flow. The popup
 * is opened synchronously in the click handler (so popup blockers allow it),
 * pointed at the hosted Checkout URL once the API returns it, and the page
 * then polls the appointment + payment until the webhook marks it paid. The
 * `/checkout-return` route inside the popup posts a same-origin message back
 * and closes itself; if the browser blocked the popup we fall back to a
 * same-tab redirect, in which case `/checkout-return` routes back here with
 * `?checkout=success` and the page calls `resumeConfirming()`.
 */
export function useCheckoutPopup({
  appointmentId,
  paymentStatus,
}: {
  appointmentId: string;
  paymentStatus: PractitionerPaymentStatus | null | undefined;
}) {
  const queryClient = useQueryClient();
  const checkout = useCreateAppointmentCheckout();
  const [phase, setPhase] = useState<CheckoutPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const timersRef = useRef<{
    poll: ReturnType<typeof setInterval> | null;
    watch: ReturnType<typeof setInterval> | null;
    timeout: ReturnType<typeof setTimeout> | null;
  }>({ poll: null, watch: null, timeout: null });
  const announcedRef = useRef(false);

  const refetch = useCallback(async () => {
    if (!appointmentId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetAppointmentQueryKey(appointmentId) }),
      queryClient.invalidateQueries({
        queryKey: getGetAppointmentPaymentQueryKey(appointmentId),
      }),
    ]);
  }, [appointmentId, queryClient]);

  const clearTimers = useCallback(() => {
    const timers = timersRef.current;
    if (timers.poll) clearInterval(timers.poll);
    if (timers.watch) clearInterval(timers.watch);
    if (timers.timeout) clearTimeout(timers.timeout);
    timersRef.current = { poll: null, watch: null, timeout: null };
  }, []);

  const stopConfirming = useCallback(
    (next: CheckoutPhase = 'idle') => {
      clearTimers();
      setPhase(next);
    },
    [clearTimers],
  );

  /** Start (or restart) the polling window. Safe to call repeatedly. */
  const resumeConfirming = useCallback(() => {
    clearTimers();
    setPhase('confirming');
    void refetch();
    timersRef.current.poll = setInterval(() => void refetch(), POLL_MS);
    timersRef.current.timeout = setTimeout(() => {
      clearTimers();
      setPhase('timed_out');
      void refetch();
    }, CONFIRM_TIMEOUT_MS);
    timersRef.current.watch = setInterval(() => {
      const popup = popupRef.current;
      if (popup && popup.closed) {
        // The person closed Checkout (or the return page closed it): refresh
        // right away instead of waiting for the next poll tick.
        popupRef.current = null;
        void refetch();
      }
    }, POPUP_WATCH_MS);
  }, [clearTimers, refetch]);

  // The popup lands on /checkout-return, which posts back and closes itself.
  useEffect(() => {
    if (!appointmentId) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as Partial<CheckoutReturnMessage> | null;
      if (
        !data ||
        data.type !== CHECKOUT_RETURN_MESSAGE ||
        data.appointmentId !== appointmentId
      ) {
        return;
      }
      popupRef.current = null;
      if (data.status === 'cancelled') {
        stopConfirming('idle');
        void refetch();
        return;
      }
      // Success: Stripe redirected before the webhook necessarily fired, so
      // give it a fresh 60s window.
      resumeConfirming();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [appointmentId, refetch, resumeConfirming, stopConfirming]);

  // Final states end the wait; `paid` also gets a toast, once per attempt.
  useEffect(() => {
    if (phase !== 'confirming' && phase !== 'timed_out') return;
    if (paymentStatus === 'paid') {
      stopConfirming('idle');
      if (!announcedRef.current) {
        announcedRef.current = true;
        toast({
          title: 'Payment received',
          description: 'Your session is paid for. Thank you.',
        });
      }
    } else if (paymentStatus === 'failed' || paymentStatus === 'cancelled') {
      stopConfirming('idle');
    }
  }, [paymentStatus, phase, stopConfirming]);

  useEffect(() => clearTimers, [clearTimers]);

  const start = useCallback(async () => {
    if (!appointmentId || checkout.isPending) return;
    setError(null);
    announcedRef.current = false;

    // Must happen synchronously inside the click, before any await.
    let popup: Window | null = null;
    try {
      popup = window.open('about:blank', 'healers-checkout', popupFeatures());
    } catch {
      popup = null;
    }
    popupRef.current = popup;
    if (popup) {
      try {
        popup.document.title = 'Secure checkout — Healers Inc';
        popup.document.body.textContent = 'Opening secure checkout…';
      } catch {
        // Cross-origin or already navigated; purely cosmetic.
      }
    }
    setPhase('starting');

    try {
      const session = await checkout.mutateAsync({
        appointmentId,
        data: {
          idempotencyKey: makeIdempotencyKey(),
          returnTarget: 'web',
          returnBaseUrl: webReturnBaseUrl(),
        },
      });
      queryClient.setQueryData(getGetAppointmentPaymentQueryKey(appointmentId), session.payment);

      if (popup && !popup.closed) {
        popup.location.assign(session.checkoutUrl);
        popup.focus();
        resumeConfirming();
        return;
      }

      // Popup blocked: hand the whole tab to Stripe. It returns through
      // /checkout-return, which redirects to /appointment/:id?checkout=…
      popupRef.current = null;
      setPhase('idle');
      window.location.assign(session.checkoutUrl);
    } catch (err) {
      try {
        popup?.close();
      } catch {
        // Nothing to clean up.
      }
      popupRef.current = null;
      setPhase('idle');
      setError(errorMessage(err, 'We could not start checkout. Please try again.'));
    }
  }, [appointmentId, checkout, queryClient, resumeConfirming]);

  return {
    /** Open Checkout. Call from a click handler. */
    start,
    phase,
    isStarting: phase === 'starting' || checkout.isPending,
    isConfirming: phase === 'confirming',
    timedOut: phase === 'timed_out',
    /** Re-enter the polling window, e.g. after a same-tab return or "Check again". */
    resumeConfirming,
    stopConfirming,
    refetch,
    error,
    clearError: () => setError(null),
  };
}
