import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import type Stripe from "stripe";
import {
  db,
  appointmentsTable,
  paymentsTable,
  practitionerPaymentAccountsTable,
  refundsTable,
  stripeReconciliationEventsTable,
  type Payment,
} from "@workspace/db";
import { getStripeSync } from "./stripeClient";
import { persistStripeAccount, requestFullRefund } from "./lib/payments";
import {
  paymentTransitionSources,
  shouldAutoRefundCapturedPayment,
  type PaymentState,
} from "./lib/paymentState";

function objectId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

async function loadMatchedPayment(where: SQL): Promise<Payment | null> {
  const [payment] = await db
    .select()
    .from(paymentsTable)
    .where(where)
    .limit(1);
  return payment ?? null;
}

async function reconcileAccount(event: Stripe.Event): Promise<void> {
  const object = event.data.object;
  const stripeAccountId =
    event.type === "account.updated"
      ? (object as Stripe.Account).id
      : event.account ?? null;
  if (!stripeAccountId) return;
  const [local] = await db
    .select()
    .from(practitionerPaymentAccountsTable)
    .where(eq(practitionerPaymentAccountsTable.stripeAccountId, stripeAccountId))
    .limit(1);
  if (!local) return;
  if (event.type === "account.updated") {
    await persistStripeAccount(local.practitionerId, object as Stripe.Account);
  }
}

export async function reconcileStripeEvent(event: Stripe.Event): Promise<void> {
  const [inserted] = await db
    .insert(stripeReconciliationEventsTable)
    .values({
      providerEventId: event.id,
      eventType: event.type,
      livemode: event.livemode,
      metadata: { connectedAccount: Boolean(event.account) },
      payload: {
        objectType: event.data.object.object,
        status:
          "status" in event.data.object
            ? String(event.data.object.status ?? "")
            : undefined,
      },
    })
    .onConflictDoNothing()
    .returning();
  const [receipt] = inserted
    ? [inserted]
    : await db
        .select()
        .from(stripeReconciliationEventsTable)
        .where(eq(stripeReconciliationEventsTable.providerEventId, event.id))
        .limit(1);
  if (!receipt || receipt.processedAt) return;

  await reconcileAccount(event);

  let paymentId: string | null = null;
  let capturedPayment: Payment | null = null;
  let refundId: string | null = null;
  const now = new Date();

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadataPaymentId = session.metadata?.["paymentId"];
    const identity =
      event.type === "checkout.session.expired"
        ? eq(paymentsTable.stripeCheckoutSessionId, session.id)
        : metadataPaymentId
          ? eq(paymentsTable.id, metadataPaymentId)
          : eq(paymentsTable.stripeCheckoutSessionId, session.id);
    const nextStatus: PaymentState =
      event.type === "checkout.session.completed"
        ? session.payment_status === "paid"
          ? "paid"
          : "processing"
        : "cancelled";
    const [updatedPayment] = await db
      .update(paymentsTable)
      .set(
        event.type === "checkout.session.completed"
          ? {
              status: nextStatus,
              stripePaymentIntentId: objectId(session.payment_intent),
              paidAt: session.payment_status === "paid" ? now : null,
            }
          : { status: "cancelled" },
      )
      .where(
        and(
          identity,
          inArray(
            paymentsTable.status,
            event.type === "checkout.session.expired"
              ? ["checkout_pending"]
              : paymentTransitionSources(nextStatus),
          ),
        ),
      )
      .returning();
    const payment = updatedPayment ?? (await loadMatchedPayment(identity));
    paymentId = payment?.id ?? null;
    if (
      payment &&
      event.type === "checkout.session.completed" &&
      session.payment_status === "paid" &&
      (payment.status === "paid" || payment.status === "partially_refunded")
    ) {
      capturedPayment = payment;
    }
  } else if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const intent = event.data.object as Stripe.PaymentIntent;
    const metadataPaymentId = intent.metadata["paymentId"];
    const identity = metadataPaymentId
      ? eq(paymentsTable.id, metadataPaymentId)
      : eq(paymentsTable.stripePaymentIntentId, intent.id);
    const nextStatus: PaymentState =
      event.type === "payment_intent.succeeded" ? "paid" : "failed";
    const [updatedPayment] = await db
      .update(paymentsTable)
      .set({
        status: nextStatus,
        stripePaymentIntentId: intent.id,
        stripeChargeId: objectId(intent.latest_charge),
        paidAt: event.type === "payment_intent.succeeded" ? now : null,
      })
      .where(
        and(
          identity,
          inArray(paymentsTable.status, paymentTransitionSources(nextStatus)),
        ),
      )
      .returning();
    const payment = updatedPayment ?? (await loadMatchedPayment(identity));
    paymentId = payment?.id ?? null;
    if (
      payment &&
      event.type === "payment_intent.succeeded" &&
      (payment.status === "paid" || payment.status === "partially_refunded")
    ) {
      capturedPayment = payment;
    }
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const identity = or(
      eq(paymentsTable.stripeChargeId, charge.id),
      eq(paymentsTable.stripePaymentIntentId, objectId(charge.payment_intent) ?? ""),
    )!;
    const nextStatus: PaymentState =
      charge.amount_refunded >= charge.amount
        ? "refunded"
        : "partially_refunded";
    const [updatedPayment] = await db
      .update(paymentsTable)
      .set({
        status: nextStatus,
        stripeChargeId: charge.id,
        refundedAt: charge.amount_refunded >= charge.amount ? now : null,
      })
      .where(
        and(
          identity,
          inArray(paymentsTable.status, paymentTransitionSources(nextStatus)),
        ),
      )
      .returning();
    const payment = updatedPayment ?? (await loadMatchedPayment(identity));
    paymentId = payment?.id ?? null;
  } else if (
    event.type === "refund.updated" ||
    event.type === "refund.created" ||
    event.type === "refund.failed"
  ) {
    const providerRefund = event.data.object as Stripe.Refund;
    const localStatus =
      providerRefund.status === "succeeded"
        ? "succeeded"
        : providerRefund.status === "failed"
          ? "failed"
          : providerRefund.status === "canceled"
            ? "cancelled"
            : "pending";
    const metadataRefundId = providerRefund.metadata?.["refundId"];
    let [refund] = await db
      .update(refundsTable)
      .set({
        stripeRefundId: providerRefund.id,
        status: localStatus,
        refundedAt: localStatus === "succeeded" ? now : null,
      })
      .where(
        metadataRefundId
          ? eq(refundsTable.id, metadataRefundId)
          : eq(refundsTable.stripeRefundId, providerRefund.id),
      )
      .returning();
    if (!refund) {
      const paymentIntentId = objectId(providerRefund.payment_intent);
      const chargeId = objectId(providerRefund.charge);
      const [payment] = await db
        .select()
        .from(paymentsTable)
        .where(
          or(
            eq(paymentsTable.stripePaymentIntentId, paymentIntentId ?? ""),
            eq(paymentsTable.stripeChargeId, chargeId ?? ""),
          ),
        )
        .limit(1);
      if (payment) {
        [refund] = await db
          .insert(refundsTable)
          .values({
            paymentId: payment.id,
            stripeRefundId: providerRefund.id,
            idempotencyKey: `provider:${providerRefund.id}`,
            amountCents: providerRefund.amount,
            currency: providerRefund.currency.toUpperCase(),
            status: localStatus,
            reason: providerRefund.reason,
            refundedAt: localStatus === "succeeded" ? now : null,
          })
          .onConflictDoNothing()
          .returning();
      }
    }
    refundId = refund?.id ?? null;
    paymentId = refund?.paymentId ?? null;
    if (refund && localStatus === "succeeded") {
      const [payment] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, refund.paymentId))
        .limit(1);
      if (payment) {
        const [totals] = await db
          .select({
            amount: sql<number>`coalesce(sum(${refundsTable.amountCents}), 0)::int`,
          })
          .from(refundsTable)
          .where(
            and(
              eq(refundsTable.paymentId, payment.id),
              eq(refundsTable.status, "succeeded"),
            ),
          );
        const nextStatus: PaymentState =
          Number(totals?.amount ?? 0) >= payment.grossAmountCents
            ? "refunded"
            : "partially_refunded";
        await db
          .update(paymentsTable)
          .set({
            status: nextStatus,
            refundedAt: nextStatus === "refunded" ? now : null,
          })
          .where(
            and(
              eq(paymentsTable.id, payment.id),
              inArray(
                paymentsTable.status,
                paymentTransitionSources(nextStatus),
              ),
            ),
          );
      }
    }
  }

  if (capturedPayment) {
    const [appointment] = await db
      .select({
        status: appointmentsTable.status,
        cancelledLate: appointmentsTable.cancelledLate,
      })
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, capturedPayment.appointmentId))
      .limit(1);
    if (
      appointment &&
      shouldAutoRefundCapturedPayment({
        appointmentStatus: appointment.status,
        cancelledLate: appointment.cancelledLate,
      })
    ) {
      // A capture racing with a timely cancellation is still refunded.
      // Reservation is durable; delivery is performed by the retry worker.
      await requestFullRefund({
        payment: capturedPayment,
        requestedById: null,
        reason: "Automatic refund for payment captured after cancellation",
      });
    }
  }

  await db
    .update(stripeReconciliationEventsTable)
    .set({ paymentId, refundId, processedAt: now })
    .where(
      and(
        eq(stripeReconciliationEventsTable.id, receipt.id),
        eq(stripeReconciliationEventsTable.providerEventId, event.id),
      ),
    );
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) throw new Error("Stripe webhook body must be raw.");
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    const event = JSON.parse(payload.toString("utf8")) as Stripe.Event;
    await reconcileStripeEvent(event);
  }
}