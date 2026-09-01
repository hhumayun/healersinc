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

const paymentStateRank: Record<PaymentState, number> = {
  checkout_pending: 0,
  failed: 1,
  cancelled: 1,
  processing: 2,
  paid: 3,
  partially_refunded: 4,
  refunded: 5,
};

/** Provider events may advance money state, but can never regress it. */
export function paymentTransitionAllowed(
  current: PaymentState,
  next: PaymentState,
): boolean {
  return paymentStateRank[next] >= paymentStateRank[current];
}

export function paymentTransitionSources(next: PaymentState): PaymentState[] {
  return paymentStates.filter((current) =>
    paymentTransitionAllowed(current, next),
  );
}