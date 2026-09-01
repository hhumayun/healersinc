import { paymentPolicy } from "./paymentPolicy";

import type { ModalityInfo } from "@workspace/api-zod";

/**
 * Payments are modelled end to end (prices, currency, a payment status column
 * shaped for Stripe Connect) but switched off for the MVP. No card data is
 * collected or stored anywhere in this codebase.
 */
export const PAYMENTS_ENABLED = paymentPolicy.enabled;

export const DEFAULT_CURRENCY = "USD";

/** Session lifetime for a mobile bearer token. */
export const SESSION_TTL_DAYS = 30;

/** How long an emailed verification code stays valid. */
export const OTP_TTL_MINUTES = 10;

export const OTP_MAX_ATTEMPTS = 5;

export const MODALITIES: ModalityInfo[] = [
  {
    value: "mind",
    label: "Mind",
    description: "Coaching, meditation, hypnotherapy and mindset work",
  },
  {
    value: "body",
    label: "Body",
    description: "Bodywork, movement, nutrition and somatic practice",
  },
  {
    value: "spirit",
    label: "Spirit",
    description: "Energy work, breathwork and spiritual guidance",
  },
  {
    value: "psychology",
    label: "Psychologists & Counsellors",
    description: "Licensed psychologists, therapists and counsellors",
  },
];
