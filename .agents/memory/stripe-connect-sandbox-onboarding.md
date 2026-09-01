---
name: Stripe Connect sandbox onboarding
description: Successful test-mode identity values for completing UK hosted Connect onboarding.
---

For Stripe Connect sandbox accounts, arbitrary fictional identity data can produce `verification_failed_keyed_identity` and leave transfers and payouts restricted. Hosted onboarding tests must use Stripe’s documented success-trigger values rather than ordinary fake details.

**Why:** A human-completed hosted onboarding run remained restricted until these test-mode values were submitted; afterward Stripe reported the recipient ready.

**How to apply:** Before a hosted onboarding test, consult Stripe’s current Connect testing documentation for the applicable country’s success triggers. Never enter real identity or banking data in sandbox testing.