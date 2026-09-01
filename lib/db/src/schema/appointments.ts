import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  appointmentFormatEnum,
  appointmentStatusEnum,
  reminderKindEnum,
} from "./enums";
import { servicesTable } from "./services";
import { usersTable } from "./users";

/**
 * A booking. Timestamps are true UTC instants; the two `*Timezone` columns
 * record how each side saw the time so confirmations can show both.
 *
 * `blockStartsAt` / `blockEndsAt` widen the appointment by the practitioner's
 * buffers. The overlap exclusion constraint (added by the DB bootstrap script,
 * which needs `btree_gist`) is defined over that wider range, so buffers are
 * enforced by the database rather than only by application logic.
 */
export const appointmentsTable = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    practitionerId: uuid("practitioner_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => servicesTable.id, {
      onDelete: "set null",
    }),

    // Immutable snapshot: later edits to the service never rewrite history.
    serviceName: text("service_name").notNull(),
    serviceDurationMinutes: integer("service_duration_minutes").notNull(),
    servicePriceCents: integer("service_price_cents").notNull(),
    serviceCurrency: text("service_currency").notNull(),
    serviceFormat: appointmentFormatEnum("service_format")
      .notNull()
      .default("online"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    blockStartsAt: timestamp("block_starts_at", {
      withTimezone: true,
    }).notNull(),
    blockEndsAt: timestamp("block_ends_at", { withTimezone: true }).notNull(),

    clientTimezone: text("client_timezone").notNull(),
    practitionerTimezone: text("practitioner_timezone").notNull(),

    status: appointmentStatusEnum("status").notNull().default("pending"),
    clientNotes: text("client_notes"),
    cancellationReason: text("cancellation_reason"),
    cancelledById: uuid("cancelled_by_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    /** True when cancelled inside the practitioner's free-cancellation window. */
    cancelledLate: boolean("cancelled_late").notNull().default(false),

    /** Repeat taps of "Confirm" reuse the same appointment instead of duplicating. */
    idempotencyKey: text("idempotency_key"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("appointments_practitioner_idx").on(
      table.practitionerId,
      table.startsAt,
    ),
    index("appointments_client_idx").on(table.clientId, table.startsAt),
    uniqueIndex("appointments_idempotency_key_unique").on(table.idempotencyKey),
  ],
);

export type Appointment = typeof appointmentsTable.$inferSelect;
export type InsertAppointment = typeof appointmentsTable.$inferInsert;

/** Append-only audit trail of every status transition. */
export const appointmentEventsTable = pgTable(
  "appointment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("appointment_events_appointment_idx").on(table.appointmentId),
  ],
);

export type AppointmentEvent = typeof appointmentEventsTable.$inferSelect;
export type InsertAppointmentEvent =
  typeof appointmentEventsTable.$inferInsert;

/**
 * Scheduled 24h / 1h reminders. A row is created when a booking is confirmed
 * and stamped `sentAt` once delivered, so the scheduler never double-sends.
 */
export const appointmentRemindersTable = pgTable(
  "appointment_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id, { onDelete: "cascade" }),
    kind: reminderKindEnum("kind").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("appointment_reminders_unique").on(
      table.appointmentId,
      table.kind,
    ),
    index("appointment_reminders_due_idx").on(table.sendAt, table.sentAt),
  ],
);

export type AppointmentReminder =
  typeof appointmentRemindersTable.$inferSelect;
export type InsertAppointmentReminder =
  typeof appointmentRemindersTable.$inferInsert;
