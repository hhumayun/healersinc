import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { signupStepEnum } from "./enums";

/**
 * One account per person, identified by their Clerk user. Sign-in, passwords,
 * email verification and sessions all live in Clerk; this row holds what the
 * marketplace needs on top of that. A single account may hold both roles:
 * every practitioner may also browse and book as a client, which is why the
 * roles are independent booleans rather than a single role column.
 */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk's `user_...` identifier; the bridge between the JWT and this row. */
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    country: text("country"),
    /** IANA identifier, e.g. `America/Toronto`. */
    timezone: text("timezone").notNull().default("UTC"),
    avatarUrl: text("avatar_url"),
    isClient: boolean("is_client").notNull().default(false),
    isPractitioner: boolean("is_practitioner").notNull().default(false),
    /**
     * Which portal the account is currently acting in. Authorization is always
     * derived from this column on the server, never from anything the client
     * sends in a body or query string.
     */
    activeRole: text("active_role").notNull().default("client"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("users_clerk_user_id_unique").on(table.clerkUserId),
    uniqueIndex("users_email_unique").on(table.email),
  ],
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

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
