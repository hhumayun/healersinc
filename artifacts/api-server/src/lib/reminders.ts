import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  appointmentRemindersTable,
  appointmentsTable,
  db,
  usersTable,
} from "@workspace/db";
import { formatInZone, zoneLabel } from "@workspace/scheduling";
import { reminderEmail, sendEmail } from "./email";
import { notify } from "./notifications";
import { logger } from "./logger";
import type { Executor } from "./availability";

const TICK_INTERVAL_MS = 60_000;
const REMINDER_OFFSETS = [
  { kind: "24h" as const, minutesBefore: 24 * 60 },
  { kind: "1h" as const, minutesBefore: 60 },
];

/**
 * Create (or move) the 24-hour and 1-hour reminders for an appointment.
 * Rescheduling clears `sentAt` so the new times are announced again.
 */
export async function scheduleReminders(options: {
  appointmentId: string;
  startsAt: Date;
  executor?: Executor;
}): Promise<void> {
  const executor = options.executor ?? db;

  for (const offset of REMINDER_OFFSETS) {
    const sendAt = new Date(
      options.startsAt.getTime() - offset.minutesBefore * 60_000,
    );

    await executor
      .insert(appointmentRemindersTable)
      .values({ appointmentId: options.appointmentId, kind: offset.kind, sendAt })
      .onConflictDoUpdate({
        target: [
          appointmentRemindersTable.appointmentId,
          appointmentRemindersTable.kind,
        ],
        set: { sendAt, sentAt: null },
      });
  }
}

/** Cancelled and declined sessions must not remind anybody. */
export async function cancelReminders(
  appointmentId: string,
  executor: Executor = db,
): Promise<void> {
  await executor
    .delete(appointmentRemindersTable)
    .where(eq(appointmentRemindersTable.appointmentId, appointmentId));
}

/**
 * Claim every due reminder in one atomic UPDATE. Stamping `sent_at` as part of
 * the claim is what makes a double send impossible, even if two ticks overlap
 * or a second server process is running.
 */
async function claimDueReminders(): Promise<string[]> {
  const claimed = await db.execute<{ id: string }>(sql`
    UPDATE appointment_reminders
    SET sent_at = now()
    WHERE id IN (
      SELECT r.id
      FROM appointment_reminders r
      JOIN appointments a ON a.id = r.appointment_id
      WHERE r.sent_at IS NULL
        AND r.send_at <= now()
        AND a.starts_at > now()
        AND a.status = 'confirmed'
      ORDER BY r.send_at
      LIMIT 50
      FOR UPDATE OF r SKIP LOCKED
    )
    RETURNING id
  `);

  return claimed.rows.map((row) => row.id);
}

async function deliverReminder(reminderId: string): Promise<void> {
  const client = alias(usersTable, "reminder_client");
  const practitioner = alias(usersTable, "reminder_practitioner");

  const rows = await db
    .select({
      reminder: appointmentRemindersTable,
      appointment: appointmentsTable,
      client: client,
      practitioner: practitioner,
    })
    .from(appointmentRemindersTable)
    .innerJoin(
      appointmentsTable,
      eq(appointmentsTable.id, appointmentRemindersTable.appointmentId),
    )
    .innerJoin(client, eq(client.id, appointmentsTable.clientId))
    .innerJoin(practitioner, eq(practitioner.id, appointmentsTable.practitionerId))
    .where(eq(appointmentRemindersTable.id, reminderId))
    .limit(1);

  const row = rows[0];
  if (!row) return;

  const hoursBefore = row.reminder.kind === "24h" ? 24 : 1;
  const recipients = [
    {
      user: row.client,
      timezone: row.appointment.clientTimezone,
      counterpart: row.practitioner.fullName,
    },
    {
      user: row.practitioner,
      timezone: row.appointment.practitionerTimezone,
      counterpart: row.client.fullName,
    },
  ];

  for (const recipient of recipients) {
    const whenLabel = formatInZone(
      row.appointment.startsAt,
      recipient.timezone,
      "EEEE d LLLL, h:mm a",
    );

    await sendEmail({
      to: recipient.user.email,
      ...reminderEmail({
        recipientName: recipient.user.fullName.split(" ")[0] ?? recipient.user.fullName,
        counterpartName: recipient.counterpart,
        serviceName: row.appointment.serviceName,
        whenLabel,
        timezoneLabel: zoneLabel(recipient.timezone, row.appointment.startsAt),
        hoursBefore,
      }),
    });

    await notify({
      userId: recipient.user.id,
      type: "booking_reminder",
      title: hoursBefore === 24 ? "Session tomorrow" : "Session in an hour",
      body: `${row.appointment.serviceName} with ${recipient.counterpart} — ${whenLabel}`,
      appointmentId: row.appointment.id,
    });
  }
}

/** One pass of the scheduler. Exported so it can be triggered in tests. */
export async function runReminderTick(): Promise<number> {
  const ids = await claimDueReminders();

  for (const id of ids) {
    try {
      await deliverReminder(id);
    } catch (err) {
      // Release the claim so the next tick retries this one.
      logger.error({ err, reminderId: id }, "Reminder delivery failed");
      await db
        .update(appointmentRemindersTable)
        .set({ sentAt: null })
        .where(eq(appointmentRemindersTable.id, id));
    }
  }

  return ids.length;
}

export function startReminderScheduler(): void {
  const timer = setInterval(() => {
    runReminderTick().catch((err: unknown) => {
      logger.error({ err }, "Reminder tick failed");
    });
  }, TICK_INTERVAL_MS);

  timer.unref();
  logger.info("Appointment reminder scheduler started");
}

/** Reminders that are already overdue when a booking is made are pointless. */
export async function pruneStaleReminders(): Promise<void> {
  await db
    .update(appointmentRemindersTable)
    .set({ sentAt: new Date() })
    .where(
      and(
        isNull(appointmentRemindersTable.sentAt),
        lte(appointmentRemindersTable.sendAt, new Date()),
        inArray(
          appointmentRemindersTable.appointmentId,
          db
            .select({ id: appointmentsTable.id })
            .from(appointmentsTable)
            .where(lte(appointmentsTable.startsAt, new Date())),
        ),
      ),
    );
}
