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
import { signupStepEnum } from "./enums";

/**
 * One account per email address. A single account may hold both roles: every
 * practitioner may also browse and book as a client, which is why the roles are
 * independent booleans rather than a single role column.
 */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    country: text("country"),
    /** IANA identifier, e.g. `America/Toronto`. */
    timezone: text("timezone").notNull().default("UTC"),
    avatarUrl: text("avatar_url"),
    isClient: boolean("is_client").notNull().default(false),
    isPractitioner: boolean("is_practitioner").notNull().default(false),
    emailVerified: boolean("email_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)],
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

/** Opaque bearer tokens handed to the mobile client. */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    /** Which portal the session was opened from; drives role-scoped routing. */
    activeRole: text("active_role").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;

/** Short-lived email verification codes for practitioner signup. */
export const emailOtpsTable = pgTable(
  "email_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("email_otps_email_idx").on(table.email)],
);

export type EmailOtp = typeof emailOtpsTable.$inferSelect;
export type InsertEmailOtp = typeof emailOtpsTable.$inferInsert;

/**
 * Persisted wizard state so an interrupted practitioner signup resumes exactly
 * where it stopped. `draft` accumulates answers until the final step writes
 * them into the practitioner profile.
 */
export const practitionerSignupProgressTable = pgTable(
  "practitioner_signup_progress",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    currentStep: signupStepEnum("current_step").notNull().default("account"),
    draft: jsonb("draft").notNull().default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export type PractitionerSignupProgress =
  typeof practitionerSignupProgressTable.$inferSelect;
export type InsertPractitionerSignupProgress =
  typeof practitionerSignupProgressTable.$inferInsert;
