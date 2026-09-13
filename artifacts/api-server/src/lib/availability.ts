import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { DateTime } from "luxon";
import {
  appointmentsTable,
  availabilityExceptionsTable,
  availabilityRulesTable,
  db,
  practitionerProfilesTable,
  type PractitionerProfile,
  type Service,
} from "@workspace/db";
import type { AvailabilityCalendar, AvailabilityDay } from "@workspace/api-zod";
import {
  formatInZone,
  generateSlots,
  safeZone,
  type BusyInterval,
  type ScheduleException,
  type Slot,
  type SlotRequest,
  type WeeklyWindow,
} from "@workspace/scheduling";
import { notFound } from "./errors";

/** Either the pool or an open transaction. */
export type Executor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0];

const SLOT_LABEL_FORMAT = "h:mm a";
const STATUSES_THAT_HOLD_TIME = ["pending", "confirmed"] as const;

export interface ScheduleContext {
  profile: PractitionerProfile;
  windows: WeeklyWindow[];
  exceptions: ScheduleException[];
  busy: BusyInterval[];
}

/**
 * Load everything needed to decide whether a time is free: the weekly pattern,
 * one-off changes, and the buffered spans already taken by live appointments.
 *
 * `ignoreAppointmentId` lets a reschedule ignore the booking being moved.
 */
export async function loadScheduleContext(options: {
  practitionerId: string;
  rangeStart: Date;
  rangeEnd: Date;
  executor?: Executor;
  ignoreAppointmentId?: string;
}): Promise<ScheduleContext> {
  const executor = options.executor ?? db;

  const [profile] = await executor
    .select()
    .from(practitionerProfilesTable)
    .where(eq(practitionerProfilesTable.userId, options.practitionerId))
    .limit(1);

  if (!profile) throw notFound("That practitioner is no longer available.");

  const rules = await executor
    .select()
    .from(availabilityRulesTable)
    .where(eq(availabilityRulesTable.practitionerId, options.practitionerId));

  const exceptions = await executor
    .select()
    .from(availabilityExceptionsTable)
    .where(
      eq(availabilityExceptionsTable.practitionerId, options.practitionerId),
    );

  const busyConditions = [
    eq(appointmentsTable.practitionerId, options.practitionerId),
    inArray(appointmentsTable.status, [...STATUSES_THAT_HOLD_TIME]),
    gt(appointmentsTable.blockEndsAt, options.rangeStart),
    lt(appointmentsTable.blockStartsAt, options.rangeEnd),
  ];

  if (options.ignoreAppointmentId) {
    busyConditions.push(ne(appointmentsTable.id, options.ignoreAppointmentId));
  }

  const busyRows = await executor
    .select({
      start: appointmentsTable.blockStartsAt,
      end: appointmentsTable.blockEndsAt,
    })
    .from(appointmentsTable)
    .where(and(...busyConditions));

  return {
    profile,
    windows: rules.map((rule) => ({
      weekday: rule.weekday,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
    })),
    exceptions: exceptions.map((exception) => ({
      kind: exception.kind,
      startDate: exception.startDate,
      endDate: exception.endDate,
      startMinute: exception.startMinute,
      endMinute: exception.endMinute,
    })),
    busy: busyRows,
  };
}

export function buildSlotRequest(options: {
  context: ScheduleContext;
  durationMinutes: number;
  rangeStart: Date;
  rangeEnd: Date;
  now?: Date;
}): SlotRequest {
  const { profile } = options.context;

  return {
    timezone: safeZone(profile.timezone),
    windows: options.context.windows,
    exceptions: options.context.exceptions,
    busy: options.context.busy,
    durationMinutes: options.durationMinutes,
    policy: {
      bufferBeforeMinutes: profile.bufferBeforeMinutes,
      bufferAfterMinutes: profile.bufferAfterMinutes,
      minNoticeMinutes: profile.minNoticeMinutes,
      maxAdvanceDays: profile.maxAdvanceDays,
    },
    slotIntervalMinutes: 15,
    rangeStart: options.rangeStart,
    rangeEnd: options.rangeEnd,
    now: options.now ?? new Date(),
  };
}

/** Turn a local `YYYY-MM-DD` in a zone into the instant that day begins. */
export function startOfLocalDay(date: string, zone: string): Date {
  return DateTime.fromISO(date, { zone: safeZone(zone) })
    .startOf("day")
    .toJSDate();
}

export function endOfLocalDay(date: string, zone: string): Date {
  return DateTime.fromISO(date, { zone: safeZone(zone) })
    .endOf("day")
    .toJSDate();
}

/**
 * Group slots into days *as the viewer experiences them*. A 2pm Toronto slot
 * belongs to the next calendar day for a client in Karachi, and the calendar
 * has to say so.
 */
export function groupSlotsForViewer(
  slots: Slot[],
  viewerTimezone: string,
  practitionerTimezone: string,
): AvailabilityDay[] {
  const byDate = new Map<string, AvailabilityDay>();

  for (const slot of slots) {
    const viewerDay =
      DateTime.fromJSDate(slot.startsAt, {
        zone: safeZone(viewerTimezone),
      }).toISODate() ?? slot.practitionerDate;

    const day = byDate.get(viewerDay) ?? { date: viewerDay, slots: [] };
    day.slots.push({
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      viewerLabel: formatInZone(slot.startsAt, viewerTimezone, SLOT_LABEL_FORMAT),
      practitionerLabel: formatInZone(
        slot.startsAt,
        practitionerTimezone,
        SLOT_LABEL_FORMAT,
      ),
    });
    byDate.set(viewerDay, day);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function buildAvailabilityCalendar(options: {
  practitionerId: string;
  service: Service;
  from: string;
  to: string;
  viewerTimezone: string;
}): Promise<AvailabilityCalendar> {
  const viewerTimezone = safeZone(options.viewerTimezone);
  const rangeStart = startOfLocalDay(options.from, viewerTimezone);
  const rangeEnd = endOfLocalDay(options.to, viewerTimezone);

  const context = await loadScheduleContext({
    practitionerId: options.practitionerId,
    rangeStart,
    rangeEnd,
  });

  const slots = generateSlots(
    buildSlotRequest({
      context,
      durationMinutes: options.service.durationMinutes,
      rangeStart,
      rangeEnd,
    }),
  );

  const practitionerTimezone = safeZone(context.profile.timezone);

  return {
    practitionerTimezone,
    viewerTimezone,
    sameTimezone: practitionerTimezone === viewerTimezone,
    days: groupSlotsForViewer(slots, viewerTimezone, practitionerTimezone),
  };
}

/** Soonest bookable instant across all of a practitioner's active services. */
export async function findNextAvailable(options: {
  practitionerId: string;
  durationMinutes: number;
  horizonDays?: number;
}): Promise<Date | null> {
  const now = new Date();
  const rangeEnd = new Date(
    now.getTime() + (options.horizonDays ?? 21) * 86_400_000,
  );

  const context = await loadScheduleContext({
    practitionerId: options.practitionerId,
    rangeStart: now,
    rangeEnd,
  });

  const [slot] = generateSlots(
    buildSlotRequest({
      context,
      durationMinutes: options.durationMinutes,
      rangeStart: now,
      rangeEnd,
      now,
    }),
  );

  return slot?.startsAt ?? null;
}
