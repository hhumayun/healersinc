import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutProviderIdempotencyKey,
  classifyUnpaidPayment,
  refundProviderIdempotencyKey,
  paymentTransitionAllowed,
  shouldAutoRefundCapturedPayment,
} from "./paymentState";

test("pending appointments never advertise checkout", () => {
  assert.deepEqual(
    classifyUnpaidPayment({
      appointmentStatus: "pending",
      isFuture: true,
      priceCents: 10_000,
      paymentsEnabled: true,
      countryEligible: true,
      practitionerReady: true,
    }),
    {
      status: "not_required",
      message: "Payment becomes available after the practitioner accepts.",
    },
  );
});

test("confirmed payment availability requires every readiness gate", () => {
  const base = {
    appointmentStatus: "confirmed" as const,
    isFuture: true,
    priceCents: 10_000,
    paymentsEnabled: true,
    countryEligible: true,
    practitionerReady: true,
  };
  assert.equal(classifyUnpaidPayment(base).status, "checkout_available");
  assert.equal(
    classifyUnpaidPayment({ ...base, practitionerReady: false }).status,
    "unavailable",
  );
  assert.equal(
    classifyUnpaidPayment({ ...base, countryEligible: false }).status,
    "unavailable",
  );
});

test("provider keys are stable and checkout attempts are versioned", () => {
  assert.equal(
    checkoutProviderIdempotencyKey("payment-1", 1),
    checkoutProviderIdempotencyKey("payment-1", 1),
  );
  assert.notEqual(
    checkoutProviderIdempotencyKey("payment-1", 1),
    checkoutProviderIdempotencyKey("payment-1", 2),
  );
  assert.equal(refundProviderIdempotencyKey("refund-1"), "refund:refund-1");
});

test("refund state cannot regress when success or completion arrives later", () => {
  assert.equal(paymentTransitionAllowed("refunded", "paid"), false);
  assert.equal(paymentTransitionAllowed("refunded", "processing"), false);
  assert.equal(paymentTransitionAllowed("partially_refunded", "paid"), false);
  assert.equal(
    paymentTransitionAllowed("partially_refunded", "processing"),
    false,
  );
});

test("stale failure or expiration cannot regress a paid payment", () => {
  assert.equal(paymentTransitionAllowed("paid", "failed"), false);
  assert.equal(paymentTransitionAllowed("paid", "cancelled"), false);
  assert.equal(paymentTransitionAllowed("processing", "failed"), true);
  assert.equal(paymentTransitionAllowed("processing", "cancelled"), true);
  assert.equal(paymentTransitionAllowed("failed", "paid"), true);
  assert.equal(paymentTransitionAllowed("paid", "partially_refunded"), true);
  assert.equal(paymentTransitionAllowed("partially_refunded", "refunded"), true);
});

test("capture after cancellation only auto-refunds before the notice cutoff", () => {
  assert.equal(
    shouldAutoRefundCapturedPayment({
      appointmentStatus: "cancelled",
      cancelledLate: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoRefundCapturedPayment({
      appointmentStatus: "cancelled",
      cancelledLate: true,
    }),
    false,
  );
  assert.equal(
    shouldAutoRefundCapturedPayment({
      appointmentStatus: "confirmed",
      cancelledLate: false,
    }),
    false,
  );
});