import type Stripe from "stripe";
import type { PractitionerPaymentAccount } from "@workspace/db";
import { normalizeCountry } from "./paymentPolicy";

export type StripeAccountApiVersion = "v1" | "v2";

export interface StripeAccountProjection {
  stripeAccountId: string;
  accountApiVersion: StripeAccountApiVersion;
  country: string;
  status: PractitionerPaymentAccount["status"];
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  capabilities: Record<string, unknown>;
  requirements: Record<string, unknown>;
}

function requiredCountry(country: string | null | undefined): string {
  if (!country) throw new Error("Stripe account did not provide a country.");
  return normalizeCountry(country) ?? country.toUpperCase();
}

export function projectV1StripeAccount(
  account: Stripe.Account,
): StripeAccountProjection {
  const enabled =
    account.charges_enabled &&
    account.payouts_enabled &&
    account.details_submitted;
  const restricted = Boolean(
    account.requirements?.disabled_reason ||
      account.capabilities?.card_payments === "inactive" ||
      account.capabilities?.transfers === "inactive",
  );
  return {
    stripeAccountId: account.id,
    accountApiVersion: "v1",
    country: requiredCountry(account.country),
    status: enabled ? "enabled" : restricted ? "restricted" : "pending",
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    capabilities: (account.capabilities ?? {}) as unknown as Record<
      string,
      unknown
    >,
    requirements: {
      currentlyDue: account.requirements?.currently_due ?? [],
      eventuallyDue: account.requirements?.eventually_due ?? [],
      disabledReason: account.requirements?.disabled_reason ?? null,
    },
  };
}

function requirementDisablesPayouts(account: Stripe.V2.Core.Account): boolean {
  return Boolean(
    account.requirements?.entries?.some((entry) =>
      entry.impact.restricts_capabilities?.some(
        (restriction) =>
          restriction.configuration === "recipient" &&
          restriction.capability === "stripe_balance.payouts" &&
          ["currently_due", "past_due"].includes(restriction.deadline.status),
      ),
    ),
  );
}

export function projectV2StripeAccount(
  account: Stripe.V2.Core.Account,
): StripeAccountProjection {
  const recipient = account.configuration?.recipient;
  const balance = recipient?.capabilities?.stripe_balance;
  const transfersStatus = balance?.stripe_transfers?.status ?? null;
  const payoutsStatus = balance?.payouts?.status ?? null;
  const payoutsDisabled =
    requirementDisablesPayouts(account) ||
    payoutsStatus === "restricted" ||
    payoutsStatus === "unsupported";
  const ready =
    !account.closed &&
    recipient?.applied === true &&
    transfersStatus === "active" &&
    !payoutsDisabled;
  const restricted =
    Boolean(account.closed) ||
    transfersStatus === "restricted" ||
    transfersStatus === "unsupported" ||
    payoutsDisabled;

  return {
    stripeAccountId: account.id,
    accountApiVersion: "v2",
    country: requiredCountry(account.identity?.country),
    status: ready ? "enabled" : restricted ? "restricted" : "pending",
    // V2 recipient accounts do not take charges; the platform is merchant of record.
    chargesEnabled: true,
    payoutsEnabled: !payoutsDisabled,
    detailsSubmitted: recipient?.applied === true,
    capabilities: {
      recipient: {
        applied: recipient?.applied === true,
        stripeTransfers: transfersStatus,
        payouts: payoutsStatus,
      },
    },
    requirements: {
      payoutsDisabled,
      currentEntryCount: account.requirements?.entries?.length ?? 0,
      futureEntryCount: account.future_requirements?.entries?.length ?? 0,
    },
  };
}

export function projectedAccountReady(
  account: Pick<
    PractitionerPaymentAccount,
    | "status"
    | "detailsSubmitted"
    | "chargesEnabled"
    | "payoutsEnabled"
    | "capabilities"
    | "requirements"
  > & { accountApiVersion: string },
): boolean {
  const capabilities = account.capabilities as Record<string, unknown>;
  if (account.accountApiVersion === "v2") {
    const recipient = capabilities["recipient"] as
      | { applied?: unknown; stripeTransfers?: unknown }
      | undefined;
    const requirements = account.requirements as
      | { payoutsDisabled?: unknown }
      | undefined;
    return (
      account.status === "enabled" &&
      account.detailsSubmitted &&
      account.payoutsEnabled &&
      recipient?.applied === true &&
      recipient.stripeTransfers === "active" &&
      requirements?.payoutsDisabled !== true
    );
  }
  return (
    account.status === "enabled" &&
    account.detailsSubmitted &&
    account.chargesEnabled &&
    account.payoutsEnabled &&
    capabilities["card_payments"] === "active" &&
    capabilities["transfers"] === "active"
  );
}

export function v2RecipientAccountCreateParams(input: {
  practitionerId: string;
  email: string;
  country: string;
}): Stripe.V2.Core.AccountCreateParams {
  return {
    dashboard: "express",
    contact_email: input.email,
    identity: { country: input.country },
    metadata: { practitionerId: input.practitionerId },
    configuration: {
      // Stripe currently requires this capability alongside recipient transfers
      // for Express accounts. Charge construction still leaves the platform as
      // merchant of record (no connected-account header or on_behalf_of).
      merchant: {
        capabilities: {
          card_payments: { requested: true },
        },
      },
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: { requested: true },
          },
        },
      },
    },
    defaults: {
      responsibilities: {
        fees_collector: "application_express",
        losses_collector: "application",
      },
    },
    include: [
      "configuration.merchant",
      "configuration.recipient",
      "identity",
      "requirements",
      "future_requirements",
    ],
  };
}

export function v2RecipientAccountLinkParams(input: {
  accountId: string;
  returnUrl: string;
  refreshUrl: string;
}): Stripe.V2.Core.AccountLinkCreateParams {
  const flow = {
    // Account Links require every applied configuration. Merchant is present
    // only because Stripe makes it a dependency of recipient transfers.
    configurations: ["merchant" as const, "recipient" as const],
    collection_options: {
      fields: "eventually_due" as const,
      future_requirements: "include" as const,
    },
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
  };
  return {
    account: input.accountId,
    // Express accounts remain Stripe-hosted. Stripe only allows onboarding
    // links for this responsibility model, including when an existing account
    // returns later to finish or refresh restricted requirements.
    use_case: { type: "account_onboarding", account_onboarding: flow },
  };
}