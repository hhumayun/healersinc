import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { availabilityExceptionKindEnum } from "./enums";
import { usersTable } from "./users";

/**
 * A recurring weekly window, expressed in the practitioner's own time zone as
 * minutes from local midnight. Storing wall-clock minutes (rather than
 * instants) is what keeps "I work 2pm-5pm" true across DST transitions.
 */
export const availabilityRulesTable = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** 1 = Monday … 7 = Sunday (matches Luxon's `weekday`). */
    weekday: integer("weekday").notNull(),
    startMinute: integer("start_minute").notNull(),
    endMinute: integer("end_minute").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("availability_rules_practitioner_idx").on(table.practitionerId),
  ],
);

export type AvailabilityRule = typeof availabilityRulesTable.$inferSelect;
export type InsertAvailabilityRule =
  typeof availabilityRulesTable.$inferInsert;

/**
 * One-off changes: a break, a blocked afternoon, a vacation, or extra hours
 * outside the weekly pattern. Also authored in the practitioner's local wall
 * clock so DST cannot shift a vacation day.
 */
export const availabilityExceptionsTable = pgTable(
  "availability_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: availabilityExceptionKindEnum("kind").notNull(),
    /** Inclusive local calendar range, `YYYY-MM-DD`. */
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    /** Null start/end minutes mean the whole day is affected. */
    startMinute: integer("start_minute"),
    endMinute: integer("end_minute"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("availability_exceptions_practitioner_idx").on(table.practitionerId),
    index("availability_exceptions_range_idx").on(
      table.startDate,
      table.endDate,
    ),
  ],
);

export type AvailabilityException =
  typeof availabilityExceptionsTable.$inferSelect;
export type InsertAvailabilityException =
  typeof availabilityExceptionsTable.$inferInsert;
