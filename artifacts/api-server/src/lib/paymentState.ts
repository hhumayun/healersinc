export type BookableAppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "declined";

export interface UnpaidPaymentAvailabilityInput {
  appointmentStatus: BookableAppointmentStatus;
  isFuture: boolean;
  priceCents: number;
  paymentsEnabled: boolean;
  countryEligible: boolean;
  practitionerReady: boolean;
}

export interface UnpaidPaymentAvailability {
  status: "checkout_available" | "unavailable" | "not_required";
  message: string;
}

export function classifyUnpaidPayment(
  input: UnpaidPaymentAvailabilityInput,
): UnpaidPaymentAvailability {
  if (input.appointmentStatus === "pending") {
    return {
      status: "not_required",
      message: "Payment becomes available after the practitioner accepts.",
    };
  }
  if (
    input.appointmentStatus !== "confirmed" ||
    !input.isFuture ||
    input.priceCents <= 0
  ) {
    return {
      status: "not_required",
      message: "No checkout is required for this appointment.",
    };
  }
  if (
    input.paymentsEnabled &&
    input.countryEligible &&
    input.practitionerReady
  ) {
    return { status: "checkout_available", message: "Checkout is available." };
  }
  if (input.paymentsEnabled) {
    return {
      status: "unavailable",
      message: "This practitioner cannot accept in-app payments right now.",
    };
  }
  return {
    status: "not_required",
    message: "This booking uses the existing unpaid flow.",
  };
}

export function checkoutProviderIdempotencyKey(
  paymentId: string,
  attempt: number,
): string {
  return `checkout:${paymentId}:attempt:${attempt}`;
}

export function refundProviderIdempotencyKey(refundId: string): string {
  return `refund:${refundId}`;
}

export const paymentStates = [
  "checkout_pending",
  "failed",
  "cancelled",
  "processing",
  "paid",
  "partially_refunded",
  "refunded",
] as const;

export type PaymentState = (typeof paymentStates)[number];

const allowedPaymentTransitions: Record<PaymentState, readonly PaymentState[]> = {
  checkout_pending: paymentStates,
  // A failed or expired PaymentIntent can still be retried or have a delayed
  // capture/refund event arrive afterward.
  failed: paymentStates,
  cancelled: paymentStates,
  // Asynchronous payment methods can legitimately fail after first entering
  // processing. Paid/refunded money states remain monotonic below.
  processing: paymentStates,
  paid: ["paid", "partially_refunded", "refunded"],
  partially_refunded: ["partially_refunded", "refunded"],
  refunded: ["refunded"],
};

/** Provider events may resolve unsettled states, but settled money cannot regress. */
export function paymentTransitionAllowed(
  current: PaymentState,
  next: PaymentState,
): boolean {
  return allowedPaymentTransitions[current].includes(next);
}

export function paymentTransitionSources(next: PaymentState): PaymentState[] {
  return paymentStates.filter((current) =>
    paymentTransitionAllowed(current, next),
  );
}

export function shouldAutoRefundCapturedPayment(input: {
  appointmentStatus: BookableAppointmentStatus;
  cancelledLate: boolean;
}): boolean {
  return input.appointmentStatus === "cancelled" && !input.cancelledLate;
}