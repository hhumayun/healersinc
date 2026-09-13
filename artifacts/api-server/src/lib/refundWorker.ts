import { and, eq, inArray } from "drizzle-orm";
import {
  appointmentsTable,
  db,
  paymentsTable,
  refundsTable,
} from "@workspace/db";
import { logger } from "./logger";
import { paymentPolicy } from "./paymentPolicy";
import {
  requestFullRefund,
  submitPendingRefund,
} from "./payments";

const RETRY_INTERVAL_MS = 60_000;
let timer: NodeJS.Timeout | null = null;
let running = false;

export async function processPendingRefunds(): Promise<void> {
  if (!paymentPolicy.enabled || running) return;
  running = true;
  try {
    // Recovery scan closes the gap if cancellation committed while reserving
    // its obligation failed. It also makes timely-cancellation refunds durable
    // independently of any one HTTP request.
    const missingObligations = await db
      .select({ payment: paymentsTable })
      .from(paymentsTable)
      .innerJoin(
        appointmentsTable,
        eq(appointmentsTable.id, paymentsTable.appointmentId),
      )
      .where(
        and(
          eq(appointmentsTable.status, "cancelled"),
          eq(appointmentsTable.cancelledLate, false),
          inArray(paymentsTable.status, ["paid", "partially_refunded"]),
        ),
      );
    for (const { payment } of missingObligations) {
      try {
        await requestFullRefund({
          payment,
          requestedById: null,
          reason: "Automatic refund for timely cancellation",
        });
      } catch (err) {
        logger.warn(
          { err, paymentId: payment.id },
          "Cancellation refund obligation will be retried",
        );
      }
    }

    const rows = await db
      .select({ refund: refundsTable, payment: paymentsTable })
      .from(refundsTable)
      .innerJoin(paymentsTable, eq(paymentsTable.id, refundsTable.paymentId))
      .where(eq(refundsTable.status, "pending"));
    for (const row of rows) {
      if (row.refund.stripeRefundId) continue;
      try {
        await submitPendingRefund(row.refund, row.payment);
        logger.info({ refundId: row.refund.id }, "Pending refund submitted");
      } catch (err) {
        // The durable row remains pending. A later pass uses the same provider
        // idempotency key, including when Stripe succeeded but our update failed.
        logger.warn(
          { err, refundId: row.refund.id },
          "Pending refund submission will be retried",
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startRefundWorker(): void {
  if (!paymentPolicy.enabled || timer) return;
  timer = setInterval(() => void processPendingRefunds(), RETRY_INTERVAL_MS);
  timer.unref();
}