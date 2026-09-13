import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import {
  projectedAccountReady,
  projectV1StripeAccount,
  projectV2StripeAccount,
  v2RecipientAccountCreateParams,
  v2RecipientAccountLinkParams,
} from "./stripeAccountState";

test("v1 projection and readiness remain compatible", () => {
  const projected = projectV1StripeAccount({
    id: "acct_legacy",
    country: "ca",
    charges_enabled: true,
    payouts_enabled: true,
    details_submitted: true,
    capabilities: { card_payments: "active", transfers: "active" },
    requirements: { currently_due: [], eventually_due: [] },
  } as unknown as Stripe.Account);

  assert.equal(projected.accountApiVersion, "v1");
  assert.equal(projected.country, "CA");
  assert.equal(projectedAccountReady(projected), true);
});

test("v2 readiness requires an open applied recipient with active transfers", () => {
  const providerAccount = {
    id: "acct_v2",
    object: "v2.core.account",
    applied_configurations: ["recipient"],
    closed: false,
    created: "2026-01-01T00:00:00.000Z",
    livemode: false,
    identity: { country: "US" },
    configuration: {
      recipient: {
        applied: true,
        capabilities: {
          stripe_balance: {
            stripe_transfers: { status: "active", status_details: [] },
            payouts: { status: "active", status_details: [] },
          },
        },
      },
    },
    requirements: { entries: [] },
  } as unknown as Stripe.V2.Core.Account;

  const ready = projectV2StripeAccount(providerAccount);
  assert.equal(ready.accountApiVersion, "v2");
  assert.equal(projectedAccountReady(ready), true);

  const closed = projectV2StripeAccount({ ...providerAccount, closed: true });
  assert.equal(projectedAccountReady(closed), false);

  const payoutsRestricted = projectV2StripeAccount({
    ...providerAccount,
    requirements: {
      entries: [
        {
          impact: {
            restricts_capabilities: [
              {
                configuration: "recipient",
                capability: "stripe_balance.payouts",
                deadline: { status: "currently_due" },
              },
            ],
          },
        },
      ],
    },
  } as unknown as Stripe.V2.Core.Account);
  assert.equal(projectedAccountReady(payoutsRestricted), false);
  assert.equal(payoutsRestricted.status, "restricted");
});

test("v2 account and hosted-link parameters match recipient model", () => {
  const account = v2RecipientAccountCreateParams({
    practitionerId: "practitioner",
    email: "practitioner@example.com",
    country: "GB",
  });
  assert.equal(account.dashboard, "express");
  assert.deepEqual(account.identity, { country: "GB" });
  assert.equal(
    account.configuration?.recipient?.capabilities?.stripe_balance
      ?.stripe_transfers?.requested,
    true,
  );
  assert.equal(
    account.configuration?.merchant?.capabilities?.card_payments?.requested,
    true,
  );
  assert.deepEqual(account.defaults?.responsibilities, {
    fees_collector: "application_express",
    losses_collector: "application",
  });

  const link = v2RecipientAccountLinkParams({
    accountId: "acct_v2",
    returnUrl: "https://example.com/return",
    refreshUrl: "https://example.com/refresh",
  });
  assert.equal(link.use_case.type, "account_onboarding");
  assert.deepEqual(link.use_case.account_onboarding?.configurations, [
    "merchant",
    "recipient",
  ]);
  assert.deepEqual(link.use_case.account_onboarding?.collection_options, {
    fields: "eventually_due",
    future_requirements: "include",
  });

});