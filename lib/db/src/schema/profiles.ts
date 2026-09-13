import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { modalityEnum } from "./enums";
import { usersTable } from "./users";

export const clientProfilesTable = pgTable("client_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  location: text("location"),
  notes: text("notes"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ClientProfile = typeof clientProfilesTable.$inferSelect;
export type InsertClientProfile = typeof clientProfilesTable.$inferInsert;

/**
 * Public-facing practitioner record plus their booking policy. Only the fields
 * marked public in the API layer are ever exposed through search.
 */
export const practitionerProfilesTable = pgTable(
  "practitioner_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    modality: modalityEnum("modality"),
    /** One-line professional descriptor, e.g. "Somatic breathwork guide". */
    headline: text("headline"),
    bio: text("bio"),
    photos: text("photos").array().notNull().default([]),
    languages: text("languages").array().notNull().default([]),
    tags: text("tags").array().notNull().default([]),
    hourlyRateCents: integer("hourly_rate_cents"),
    currency: text("currency").notNull().default("USD"),
    location: text("location"),
    /** Practitioner's own IANA time zone; all availability is authored in it. */
    timezone: text("timezone").notNull().default("UTC"),
    isPublished: boolean("is_published").notNull().default(false),

    // Booking policy
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    minNoticeMinutes: integer("min_notice_minutes").notNull().default(120),
    maxAdvanceDays: integer("max_advance_days").notNull().default(60),
    instantBooking: boolean("instant_booking").notNull().default(true),
    /** Free cancellation window; cancelling inside it is flagged as late. */
    cancellationNoticeHours: integer("cancellation_notice_hours")
      .notNull()
      .default(24),

    // Denormalised review aggregates, recomputed whenever a review lands.
    ratingAverage: numeric("rating_average", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("practitioner_profiles_modality_idx").on(table.modality),
    index("practitioner_profiles_published_idx").on(table.isPublished),
  ],
);

export type PractitionerProfile =
  typeof practitionerProfilesTable.$inferSelect;
export type InsertPractitionerProfile =
  typeof practitionerProfilesTable.$inferInsert;
