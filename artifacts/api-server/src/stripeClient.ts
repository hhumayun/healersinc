import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { logger } from "./lib/logger";

interface StripeCredentials {
  secretKey: string;
  webhookSecret?: string;
}

/**
 * Stripe keys come straight from the environment. `STRIPE_WEBHOOK_SECRET` is
 * optional on first boot: the sync layer registers a managed webhook endpoint
 * against `PUBLIC_API_URL` and stores its signing secret itself.
 */
export function getStripeCredentials(): StripeCredentials {
  const secretKey = process.env["STRIPE_SECRET_KEY"]?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required when payments are enabled.");
  }
  return {
    secretKey,
    webhookSecret: process.env["STRIPE_WEBHOOK_SECRET"]?.trim() || undefined,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Stripe sync.");
  const { secretKey, webhookSecret } = getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
    logger,
    revalidateObjectsViaStripeApi: [
      "charge",
      "payment_intent",
      "refund",
    ],
  });
}
