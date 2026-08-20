import { and, eq, sql } from "drizzle-orm";
import {
  appointmentEventsTable,
  appointmentsTable,
  db,
  EXCLUSION_VIOLATION,
  type Appointment,
  type PractitionerProfile,
  type Service,
  type User,
} from "@workspace/db";
import { blockRange, isSlotBookable, safeZone } from "@workspace/scheduling";
import { buildSlotRequest, loadScheduleContext } from "./availability";
import { conflict } from "./errors";
import { scheduleReminders } from "./reminders";

const UNIQUE_VIOLATION = "23505";

function errorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

const SLOT_TAKEN =
  "That time was just booked by someone else. Please pick another slot.";

export interface CreateBookingInput {
  client: User;
  practitioner: User;
  profile: PractitionerProfile;
  service: Service;
  startsAt: Date;
  clientTimezone: string;
  notes?: string | null;
  idempotencyKey: string;
}

/**
 * Write a booking, or return the one this idempotency key already created.
 *
 * Three layers stop a slot being sold twice:
 *   1. a transaction-scoped advisory lock per practitioner, so concurrent
 *      requests for the same person queue instead of racing;
 *   2. a re-check of live availability inside that transaction, using data read
 *      under the lock rather than whatever the client saw a minute ago;
 *   3. the database's own exclusion constraint over the buffered time range,
 *      which is the guarantee that survives bugs in the two layers above.
 */
export async function createBooking(
  input: CreateBookingInput,
): Promise<{ appointment: Appointment; reused: boolean }> {
  const existing = await findByIdempotencyKey(input.idempotencyKey);
  if (existing) return { appointment: existing, reused: true };

  const range = blockRange(
    input.startsAt,
    input.service.durationMinutes,
    input.profile.bufferBeforeMinutes,
    input.profile.bufferAfterMinutes,
  );

  const status = input.profile.instantBooking ? "confirmed" : "pending";

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${input.practitioner.id}))`,
      );

      const context = await loadScheduleContext({
        practitionerId: input.practitioner.id,
        rangeStart: new Date(range.blockStartsAt.getTime() - 86_400_000),
        rangeEnd: new Date(range.blockEndsAt.getTime() + 86_400_000),
        executor: tx,
      });

      const bookable = isSlotBookable(
        buildSlotRequest({
          context,
          durationMinutes: input.service.durationMinutes,
          rangeStart: range.startsAt,
          rangeEnd: range.endsAt,
        }),
        input.startsAt,
      );

      if (!bookable) throw conflict(SLOT_TAKEN, "slot_unavailable");

      const [appointment] = await tx
        .insert(appointmentsTable)
        .values({
          clientId: input.client.id,
          practitionerId: input.practitioner.id,
          serviceId: input.service.id,
          serviceName: input.service.name,
          serviceDurationMinutes: input.service.durationMinutes,
          servicePriceCents: input.service.priceCents,
          serviceCurrency: input.service.currency,
          serviceFormat: input.service.format,
          startsAt: range.startsAt,
          endsAt: range.endsAt,
          blockStartsAt: range.blockStartsAt,
          blockEndsAt: range.blockEndsAt,
          clientTimezone: safeZone(input.clientTimezone),
          practitionerTimezone: safeZone(input.profile.timezone),
          status,
          clientNotes: input.notes ?? null,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();

      if (!appointment) throw conflict(SLOT_TAKEN, "slot_unavailable");

      await tx.insert(appointmentEventsTable).values({
        appointmentId: appointment.id,
        actorId: input.client.id,
        fromStatus: null,
        toStatus: status,
        reason: "Booking created",
      });

      if (status === "confirmed") {
        await scheduleReminders({
          appointmentId: appointment.id,
          startsAt: appointment.startsAt,
          executor: tx,
        });
      }

      return { appointment, reused: false };
    });
  } catch (err) {
    const code = errorCode(err);

    if (code === EXCLUSION_VIOLATION) {
      throw conflict(SLOT_TAKEN, "slot_unavailable");
    }

    // Two taps of Confirm racing each other: the loser reads the winner's row.
    if (code === UNIQUE_VIOLATION) {
      const duplicate = await findByIdempotencyKey(input.idempotencyKey);
      if (duplicate) return { appointment: duplicate, reused: true };
    }

    throw err;
  }
}

async function findByIdempotencyKey(key: string): Promise<Appointment | null> {
  const [row] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.idempotencyKey, key))
    .limit(1);

  return row ?? null;
}

export interface RescheduleInput {
  appointment: Appointment;
  profile: PractitionerProfile;
  actorId: string;
  startsAt: Date;
  reason?: string | null;
}

/** Move an existing appointment, holding the same three safety layers. */
export async function rescheduleAppointment(
  input: RescheduleInput,
): Promise<Appointment> {
  const range = blockRange(
    input.startsAt,
    input.appointment.serviceDurationMinutes,
    input.profile.bufferBeforeMinutes,
    input.profile.bufferAfterMinutes,
  );

  try {
    return await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${input.appointment.practitionerId}))`,
      );

      const context = await loadScheduleContext({
        practitionerId: input.appointment.practitionerId,
        rangeStart: new Date(range.blockStartsAt.getTime() - 86_400_000),
        rangeEnd: new Date(range.blockEndsAt.getTime() + 86_400_000),
        executor: tx,
        ignoreAppointmentId: input.appointment.id,
      });

      const bookable = isSlotBookable(
        buildSlotRequest({
          context,
          durationMinutes: input.appointment.serviceDurationMinutes,
          rangeStart: range.startsAt,
          rangeEnd: range.endsAt,
        }),
        input.startsAt,
      );

      if (!bookable) {
        throw conflict(
          "That new time is not available. Please pick another slot.",
          "slot_unavailable",
        );
      }

      const [updated] = await tx
        .update(appointmentsTable)
        .set({
          startsAt: range.startsAt,
          endsAt: range.endsAt,
          blockStartsAt: range.blockStartsAt,
          blockEndsAt: range.blockEndsAt,
        })
        .where(
          and(
            eq(appointmentsTable.id, input.appointment.id),
            eq(appointmentsTable.status, input.appointment.status),
          ),
        )
        .returning();

      if (!updated) {
        throw conflict(
          "This appointment changed while you were rescheduling. Reopen it and try again.",
        );
      }

      await tx.insert(appointmentEventsTable).values({
        appointmentId: updated.id,
        actorId: input.actorId,
        fromStatus: input.appointment.status,
        toStatus: updated.status,
        reason: input.reason ?? "Rescheduled",
      });

      if (updated.status === "confirmed") {
        await scheduleReminders({
          appointmentId: updated.id,
          startsAt: updated.startsAt,
          executor: tx,
        });
      }

      return updated;
    });
  } catch (err) {
    if (errorCode(err) === EXCLUSION_VIOLATION) {
      throw conflict(
        "That new time is not available. Please pick another slot.",
        "slot_unavailable",
      );
    }
    throw err;
  }
}
