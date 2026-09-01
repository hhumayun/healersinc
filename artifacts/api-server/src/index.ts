import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { applyDatabaseConstraints } from "@workspace/db";
import { attachRealtime } from "./lib/realtime";
import { startReminderScheduler } from "./lib/reminders";
import { emailProviderConfigured } from "./lib/email";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { paymentPolicy } from "./lib/paymentPolicy";
import {
  processPendingRefunds,
  startRefundWorker,
} from "./lib/refundWorker";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main(): Promise<void> {
  // The double-booking guarantee lives in the database, so it has to exist
  // before the server accepts a single request.
  await applyDatabaseConstraints();

  if (paymentPolicy.enabled) {
    const databaseUrl = process.env["DATABASE_URL"];
    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
    if (!databaseUrl) throw new Error("DATABASE_URL is required for payments.");
    if (!domain) throw new Error("REPLIT_DOMAINS is required for Stripe webhooks.");
    logger.info("Initializing Stripe synchronization");
    await runMigrations({ databaseUrl, logger });
    const stripeSync = await getStripeSync();
    const enabledEvents = [
      ...stripeSync.getSupportedEventTypes(),
      "checkout.session.completed",
      "checkout.session.expired",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.refunded",
      "refund.updated",
    ] as const;
    await stripeSync.findOrCreateManagedWebhook(
      `https://${domain}/api/webhooks/stripe`,
      { enabled_events: [...new Set(enabledEvents)] },
    );
    await stripeSync.syncBackfill();
    await processPendingRefunds();
    logger.info("Stripe synchronization initialized");
  } else {
    logger.info("Stripe initialization skipped because payments are disabled");
  }

  const server = createServer(app);
  attachRealtime(server);

  server.listen(port, () => {
    logger.info({ port }, "Server listening");
    if (!emailProviderConfigured) {
      logger.warn(
        "No email provider is configured — verification codes and reminders will be written to this log instead of being sent.",
      );
    }
    startReminderScheduler();
    startRefundWorker();
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
