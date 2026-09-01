import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { logger } from "./lib/logger";

interface StripeCredentials {
  secretKey: string;
  webhookSecret?: string;
}

/** Fetch fresh connector credentials for every operation so rotations take effect. */
export async function getStripeCredentials(): Promise<StripeCredentials> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const token = process.env["REPL_IDENTITY"]
    ? `repl ${process.env["REPL_IDENTITY"]}`
    : process.env["WEB_REPL_RENEWAL"]
      ? `depl ${process.env["WEB_REPL_RENEWAL"]}`
      : null;

  if (!hostname || !token) {
    throw new Error("Stripe integration credentials are unavailable.");
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Could not fetch Stripe credentials (${response.status}).`);
  }

  const data = (await response.json()) as {
    items?: Array<{
      settings?: {
        secret?: string;
        secret_key?: string;
        webhook_secret?: string;
      };
    }>;
  };
  const settings = data.items?.[0]?.settings;
  const secretKey = settings?.secret ?? settings?.secret_key;
  if (!secretKey) {
    throw new Error("Stripe integration is not connected.");
  }
  return {
    secretKey,
    webhookSecret: settings?.webhook_secret,
  };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) throw new Error("DATABASE_URL is required for Stripe sync.");
  const { secretKey, webhookSecret } = await getStripeCredentials();
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