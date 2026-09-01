import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { appointmentsTable } from "./appointments";
import {
  paymentAccountStatusEnum,
  paymentStatusEnum,
  refundStatusEnum,
} from "./enums";
import { usersTable } from "./users";

/**
 * Stripe Connect state for a practitioner. Provider secrets and bank/card
 * details are never persisted; capability state is refreshed from Stripe.
 */
export const practitionerPaymentAccountsTable = pgTable(
  "practitioner_payment_accounts",
  {
    practitionerId: uuid("practitioner_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    stripeAccountId: text("stripe_account_id").notNull(),
    /** Stripe Accounts API generation. Existing rows are v1 unless migrated explicitly. */
    accountApiVersion: text("account_api_version").notNull().default("v1"),
    country: text("country").notNull(),
    status: paymentAccountStatusEnum("status").notNull().default("pending"),
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    detailsSubmitted: boolean("details_submitted").notNull().default(false),
    capabilities: jsonb("capabilities").notNull().default({}),
    requirements: jsonb("requirements").notNull().default({}),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("practitioner_payment_accounts_stripe_account_unique").on(
      table.stripeAccountId,
    ),
    index("practitioner_payment_accounts_status_idx").on(table.status),
  ],
);

export const insertPractitionerPaymentAccountSchema = createInsertSchema(
  practitionerPaymentAccountsTable,
).omit({ createdAt: true, updatedAt: true });
export type InsertPractitionerPaymentAccount = z.infer<
  typeof insertPractitionerPaymentAccountSchema
>;
export type PractitionerPaymentAccount =
  typeof practitionerPaymentAccountsTable.$inferSelect;

/** One payment lifecycle per appointment, with immutable pricing snapshots. */
export const paymentsTable = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id, { onDelete: "restrict" }),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    /** Monotonically increasing hosted-checkout attempt for this payment. */
    stripeCheckoutAttempt: integer("stripe_checkout_attempt").notNull().default(0),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    /** Fee policy at checkout creation; 1000 basis points is 10%. */
    platformFeeBasisPoints: integer("platform_fee_basis_points").notNull(),
    platformFeeCents: integer("platform_fee_cents").notNull(),
    practitionerNetCents: integer("practitioner_net_cents").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatusEnum("status")
      .notNull()
      .default("checkout_pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("payments_appointment_unique").on(table.appointmentId),
    uniqueIndex("payments_idempotency_key_unique").on(table.idempotencyKey),
    uniqueIndex("payments_checkout_session_unique").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("payments_payment_intent_unique").on(
      table.stripePaymentIntentId,
    ),
    uniqueIndex("payments_charge_unique").on(table.stripeChargeId),
    index("payments_status_idx").on(table.status),
  ],
);

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

export const refundsTable = pgTable(
  "refunds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => paymentsTable.id, { onDelete: "restrict" }),
    stripeRefundId: text("stripe_refund_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull(),
    status: refundStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    requestedById: uuid("requested_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("refunds_stripe_refund_unique").on(table.stripeRefundId),
    uniqueIndex("refunds_idempotency_key_unique").on(table.idempotencyKey),
    index("refunds_payment_idx").on(table.paymentId),
    index("refunds_status_idx").on(table.status),
  ],
);

export const insertRefundSchema = createInsertSchema(refundsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRefund = z.infer<typeof insertRefundSchema>;
export type Refund = typeof refundsTable.$inferSelect;

/**
 * Append-only receipt of Stripe events. Application code may stamp processedAt
 * but must never update providerEventId, eventType, livemode, or payload.
 */
export const stripeReconciliationEventsTable = pgTable(
  "stripe_reconciliation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(),
    livemode: boolean("livemode").notNull(),
    paymentId: uuid("payment_id").references(() => paymentsTable.id, {
      onDelete: "set null",
    }),
    refundId: uuid("refund_id").references(() => refundsTable.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    payload: jsonb("payload").notNull().default({}),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("stripe_reconciliation_events_provider_event_unique").on(
      table.providerEventId,
    ),
    index("stripe_reconciliation_events_payment_idx").on(table.paymentId),
    index("stripe_reconciliation_events_refund_idx").on(table.refundId),
    index("stripe_reconciliation_events_processed_idx").on(table.processedAt),
  ],
);

export const insertStripeReconciliationEventSchema = createInsertSchema(
  stripeReconciliationEventsTable,
).omit({ id: true, createdAt: true });
export type InsertStripeReconciliationEvent = z.infer<
  typeof insertStripeReconciliationEventSchema
>;
export type StripeReconciliationEvent =
  typeof stripeReconciliationEventsTable.$inferSelect;