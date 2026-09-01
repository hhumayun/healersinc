import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import {
  db,
  paymentsTable,
  practitionerPaymentAccountsTable,
  refundsTable,
  type Appointment,
  type Payment,
  type PractitionerPaymentAccount,
  type Refund,
} from "@workspace/db";
import type {
  PaymentAccountStatus,
  PaymentSummary,
  RefundSummary,
} from "@workspace/api-zod";
import { getUncachableStripeClient } from "../stripeClient";
import {
  calculateFee,
  countryIsEligible,
  normalizeCountry,
  paymentPolicy,
} from "./paymentPolicy";
import { conflict } from "./errors";
import {
  checkoutProviderIdempotencyKey,
  classifyUnpaidPayment,
  refundProviderIdempotencyKey,
  type UnpaidPaymentAvailability,
} from "./paymentState";
import {
  projectedAccountReady,
  projectV1StripeAccount,
  projectV2StripeAccount,
  type StripeAccountProjection,
} from "./stripeAccountState";

export {
  checkoutProviderIdempotencyKey,
  classifyUnpaidPayment,
  refundProviderIdempotencyKey,
} from "./paymentState";

export function toPaymentSummary(payment: Payment): PaymentSummary {
  return {
    id: payment.id,
    appointmentId: payment.appointmentId,
    status: payment.status,
    message: null,
    grossAmountCents: payment.grossAmountCents,
    platformFeeCents: payment.platformFeeCents,
    platformFeeBasisPoints: payment.platformFeeBasisPoints,
    practitionerNetCents: payment.practitionerNetCents,
    currency: payment.currency,
    paidAt: payment.paidAt,
    refundedAt: payment.refundedAt,
    createdAt: payment.createdAt,
  };
}

export function unpaidPaymentSummary(
  appointment: Appointment,
  availability: UnpaidPaymentAvailability,
): PaymentSummary {
  const fee = calculateFee(appointment.servicePriceCents);
  return {
    id: null,
    appointmentId: appointment.id,
    status: availability.status,
    message: availability.message,
    grossAmountCents: appointment.servicePriceCents,
    platformFeeCents: fee,
    platformFeeBasisPoints: paymentPolicy.platformFeeBasisPoints,
    practitionerNetCents: appointment.servicePriceCents - fee,
    currency: appointment.serviceCurrency,
    paidAt: null,
    refundedAt: null,
    createdAt: appointment.createdAt,
  };
}

export function toRefundSummary(refund: Refund): RefundSummary {
  return {
    id: refund.id,
    paymentId: refund.paymentId,
    amountCents: refund.amountCents,
    currency: refund.currency,
    status: refund.status,
    reason: refund.reason,
    refundedAt: refund.refundedAt,
    createdAt: refund.createdAt,
  };
}

async function persistAccountProjection(
  practitionerId: string,
  projection: StripeAccountProjection,
): Promise<PractitionerPaymentAccount> {
  const [saved] = await db
    .insert(practitionerPaymentAccountsTable)
    .values({
      practitionerId,
      ...projection,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: practitionerPaymentAccountsTable.practitionerId,
      set: {
        ...projection,
        lastSyncedAt: new Date(),
      },
    })
    .returning();
  if (!saved) throw new Error("Could not persist payment account.");
  return saved;
}

export function persistStripeAccount(
  practitionerId: string,
  account: Stripe.Account,
): Promise<PractitionerPaymentAccount> {
  return persistAccountProjection(practitionerId, projectV1StripeAccount(account));
}

export function persistStripeV2Account(
  practitionerId: string,
  account: Stripe.V2.Core.Account,
): Promise<PractitionerPaymentAccount> {
  return persistAccountProjection(practitionerId, projectV2StripeAccount(account));
}

export async function refreshStripePaymentAccount(
  practitionerId: string,
  account: PractitionerPaymentAccount,
  stripe?: Stripe,
): Promise<PractitionerPaymentAccount> {
  const client = stripe ?? (await getUncachableStripeClient());
  if (account.accountApiVersion === "v2") {
    const providerAccount = await client.v2.core.accounts.retrieve(
      account.stripeAccountId,
      {
        include: [
          "configuration.merchant",
          "configuration.recipient",
          "identity",
          "requirements",
          "future_requirements",
        ],
      },
    );
    return persistStripeV2Account(practitionerId, providerAccount);
  }
  return persistStripeAccount(
    practitionerId,
    await client.accounts.retrieve(account.stripeAccountId),
  );
}

export function publicAccountStatus(
  country: string | null | undefined,
  account?: PractitionerPaymentAccount | null,
): { status: PaymentAccountStatus; message: string } {
  if (!paymentPolicy.enabled) {
    return { status: "feature_disabled", message: "In-app payments are currently disabled." };
  }
  if (!countryIsEligible(country)) {
    return {
      status: "policy_unavailable",
      message: "In-app payments are not available in your country yet.",
    };
  }
  if (!account) {
    return { status: "onboarding_required", message: "Set up payouts to accept card payments." };
  }
  if (accountReady(account)) {
    return { status: "ready", message: "Your account is ready to accept payments." };
  }
  if (account.status === "restricted") {
    return { status: "restricted", message: "Stripe needs updated information before payments can resume." };
  }
  return { status: "pending", message: "Stripe is reviewing your payout account." };
}

export async function loadPaymentForAppointment(
  appointmentId: string,
): Promise<Payment | null> {
  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.appointmentId, appointmentId))
    .limit(1);
  return payment ?? null;
}

export async function loadPaymentAccount(
  practitionerId: string,
): Promise<PractitionerPaymentAccount | null> {
  const [account] = await db
    .select()
    .from(practitionerPaymentAccountsTable)
    .where(eq(practitionerPaymentAccountsTable.practitionerId, practitionerId))
    .limit(1);
  return account ?? null;
}

export function accountReady(account: PractitionerPaymentAccount): boolean {
  return projectedAccountReady(account);
}

async function reusablePrice(
  stripe: Stripe,
  amount: number,
  currency: string,
): Promise<string> {
  const lookupKey = `healers_appointment_${currency.toLowerCase()}_${amount}`;
  const listed = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (listed.data[0]) return listed.data[0].id;

  const products = await stripe.products.search({
    query: "metadata['healers_catalog_key']:'appointment'",
    limit: 1,
  });
  const product =
    products.data[0] ??
    (await stripe.products.create(
      {
        name: "Healers appointment",
        description: "A practitioner appointment booked through Healers.",
        metadata: { healers_catalog_key: "appointment" },
      },
      { idempotencyKey: "healers-appointment-product-v1" },
    ));
  const price = await stripe.prices.create(
    {
      product: product.id,
      currency: currency.toLowerCase(),
      unit_amount: amount,
      lookup_key: lookupKey,
    },
    { idempotencyKey: `price-${lookupKey}` },
  );
  return price.id;
}

export async function createCheckout(input: {
  appointment: Appointment;
  account: PractitionerPaymentAccount;
  clientEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ payment: Payment; checkoutUrl: string; expiresAt: Date }> {
  const fee = calculateFee(input.appointment.servicePriceCents);
  const localKey = `appointment:${input.appointment.id}`;
  const stripe = await getUncachableStripeClient();

  // The lock is held across provider creation. If the DB commit fails after
  // Stripe succeeds, the same attempt number produces the same Stripe session.
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"checkout:" + input.appointment.id}))`,
    );
    let [payment] = await tx
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.appointmentId, input.appointment.id))
      .limit(1);
    if (!payment) {
      [payment] = await tx
      .insert(paymentsTable)
      .values({
        appointmentId: input.appointment.id,
        idempotencyKey: localKey,
        grossAmountCents: input.appointment.servicePriceCents,
        platformFeeBasisPoints: paymentPolicy.platformFeeBasisPoints,
        platformFeeCents: fee,
        practitionerNetCents: input.appointment.servicePriceCents - fee,
        currency: input.appointment.serviceCurrency,
      })
      .returning();
    }
    if (!payment) throw new Error("Could not create payment.");
    if (["paid", "partially_refunded", "refunded", "processing"].includes(payment.status)) {
      throw conflict("This appointment already has a payment in progress or completed.");
    }

    if (payment.stripeCheckoutSessionId) {
      const existing = await stripe.checkout.sessions.retrieve(
        payment.stripeCheckoutSessionId,
      );
      if (existing.status === "open" && existing.url) {
        if (
          existing.success_url === input.successUrl &&
          existing.cancel_url === input.cancelUrl
        ) {
          return {
            payment,
            checkoutUrl: existing.url,
            expiresAt: new Date(existing.expires_at * 1000),
          };
        }
        await stripe.checkout.sessions.expire(existing.id);
      }
      if (existing.status === "complete") {
        throw conflict("This appointment already has a completed checkout.");
      }
    }

    const attempt = payment.stripeCheckoutAttempt + 1;
    const priceId = await reusablePrice(
      stripe,
      payment.grossAmountCents,
      payment.currency,
    );
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: input.clientEmail,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          appointmentId: input.appointment.id,
          paymentId: payment.id,
          clientId: input.appointment.clientId,
          practitionerId: input.appointment.practitionerId,
          attempt: String(attempt),
        },
        payment_intent_data: {
          application_fee_amount: payment.platformFeeCents,
          transfer_data: { destination: input.account.stripeAccountId },
          metadata: {
            appointmentId: input.appointment.id,
            paymentId: payment.id,
            practitionerId: input.appointment.practitionerId,
          },
        },
      },
      {
        idempotencyKey: checkoutProviderIdempotencyKey(payment.id, attempt),
      },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    const [updated] = await tx
      .update(paymentsTable)
      .set({
        stripeCheckoutSessionId: session.id,
        stripeCheckoutAttempt: attempt,
        status: "checkout_pending",
      })
      .where(eq(paymentsTable.id, payment.id))
      .returning();
    if (!updated) throw new Error("Could not save checkout session.");
    return {
      payment: updated,
      checkoutUrl: session.url,
      expiresAt: new Date(session.expires_at * 1000),
    };
  });
}

export async function requestFullRefund(input: {
  payment: Payment;
  requestedById: string | null;
  reason?: string | null;
}): Promise<Refund> {
  if (!input.payment.stripePaymentIntentId || !["paid", "partially_refunded"].includes(input.payment.status)) {
    throw conflict("There is no captured payment to refund.");
  }
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${"refund:" + input.payment.id}))`,
    );
    const [freshPayment] = await tx
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, input.payment.id))
      .limit(1);
    if (!freshPayment?.stripePaymentIntentId) {
      throw conflict("There is no captured payment to refund.");
    }
    const existing = await tx
      .select()
      .from(refundsTable)
      .where(
        and(
          eq(refundsTable.paymentId, freshPayment.id),
          inArray(refundsTable.status, ["pending", "succeeded"]),
        ),
      )
      .orderBy(refundsTable.createdAt);
    const reserved = existing.reduce((sum, row) => sum + row.amountCents, 0);
    const remaining = freshPayment.grossAmountCents - reserved;
    if (remaining <= 0) {
      const obligation = existing[existing.length - 1];
      if (obligation) return obligation;
      throw conflict("This payment has already been fully refunded.");
    }
    const refundId = randomUUID();
    const [refund] = await tx
      .insert(refundsTable)
      .values({
        id: refundId,
        paymentId: freshPayment.id,
        idempotencyKey: refundProviderIdempotencyKey(refundId),
        amountCents: remaining,
        currency: freshPayment.currency,
        reason: input.reason ?? null,
        requestedById: input.requestedById,
      })
      .returning();
    if (!refund) throw new Error("Could not reserve refund obligation.");
    return refund;
  });
}

export async function submitPendingRefund(
  refund: Refund,
  payment: Payment,
): Promise<Refund> {
  if (refund.stripeRefundId || refund.status !== "pending") return refund;
  if (!payment.stripePaymentIntentId) {
    throw new Error("Pending refund has no captured PaymentIntent.");
  }
  const stripe = await getUncachableStripeClient();
  const providerRefund = await stripe.refunds.create(
    {
      payment_intent: payment.stripePaymentIntentId,
      amount: refund.amountCents,
      metadata: { paymentId: payment.id, refundId: refund.id },
      reverse_transfer: true,
      refund_application_fee: true,
    },
    { idempotencyKey: refundProviderIdempotencyKey(refund.id) },
  );
  const [updated] = await db
    .update(refundsTable)
    .set({ stripeRefundId: providerRefund.id })
    .where(
      and(
        eq(refundsTable.id, refund.id),
        eq(refundsTable.status, "pending"),
      ),
    )
    .returning();
  return updated ?? refund;
}

export async function cancelPendingCheckout(payment: Payment): Promise<void> {
  if (payment.status !== "checkout_pending") return;
  await db
    .update(paymentsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(paymentsTable.id, payment.id),
        eq(paymentsTable.status, "checkout_pending"),
      ),
    );
  if (!payment.stripeCheckoutSessionId) return;
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(
    payment.stripeCheckoutSessionId,
  );
  if (session.status === "open") {
    await stripe.checkout.sessions.expire(payment.stripeCheckoutSessionId);
  }
}