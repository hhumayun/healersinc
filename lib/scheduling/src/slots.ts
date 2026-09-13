import { DateTime } from "luxon";
import type { Slot, SlotRequest, ScheduleException } from "./types";
import { safeZone, wallClockToInstant } from "./timezones";

const MINUTES_PER_DAY = 24 * 60;

interface MinuteRange {
  start: number;
  end: number;
}

function clampRange(range: MinuteRange): MinuteRange {
  return {
    start: Math.max(0, Math.min(MINUTES_PER_DAY, range.start)),
    end: Math.max(0, Math.min(MINUTES_PER_DAY, range.end)),
  };
}

function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = ranges
    .map(clampRange)
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  const merged: MinuteRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function subtractRanges(
  base: MinuteRange[],
  cuts: MinuteRange[],
): MinuteRange[] {
  let result = base.map((range) => ({ ...range }));

  for (const cut of mergeRanges(cuts)) {
    const next: MinuteRange[] = [];
    for (const range of result) {
      if (cut.end <= range.start || cut.start >= range.end) {
        next.push(range);
        continue;
      }
      if (cut.start > range.start) {
        next.push({ start: range.start, end: cut.start });
      }
      if (cut.end < range.end) {
        next.push({ start: cut.end, end: range.end });
      }
    }
    result = next;
  }

  return mergeRanges(result);
}

function exceptionCoversDate(
  exception: ScheduleException,
  date: string,
): boolean {
  return exception.startDate <= date && date <= exception.endDate;
}

function exceptionRange(exception: ScheduleException): MinuteRange {
  return {
    start: exception.startMinute ?? 0,
    end: exception.endMinute ?? MINUTES_PER_DAY,
  };
}

/**
 * The practitioner's bookable wall-clock ranges for one local calendar day,
 * after adding `extra` exceptions and removing blocks and vacations.
 */
export function windowsForDate(
  request: Pick<SlotRequest, "windows" | "exceptions">,
  date: string,
  weekday: number,
): MinuteRange[] {
  const base = request.windows
    .filter((window) => window.weekday === weekday)
    .map((window) => ({ start: window.startMinute, end: window.endMinute }));

  const extras = request.exceptions
    .filter(
      (exception) =>
        exception.kind === "extra" && exceptionCoversDate(exception, date),
    )
    .map(exceptionRange);

  const cuts = request.exceptions
    .filter(
      (exception) =>
        exception.kind !== "extra" && exceptionCoversDate(exception, date),
    )
    .map(exceptionRange);

  return subtractRanges(mergeRanges([...base, ...extras]), cuts);
}

function overlapsBusy(
  request: SlotRequest,
  blockStart: Date,
  blockEnd: Date,
): boolean {
  const startMs = blockStart.getTime();
  const endMs = blockEnd.getTime();
  return request.busy.some(
    (interval) =>
      startMs < interval.end.getTime() && endMs > interval.start.getTime(),
  );
}

/**
 * Generate bookable start times for a practitioner.
 *
 * Availability is authored in the practitioner's wall clock, so every candidate
 * is built as a local date + minute-of-day and then converted to a UTC instant.
 * That is what keeps "2pm–5pm on Tuesdays" correct across DST changes on either
 * side, and it means offsets are never added or subtracted by hand.
 */
export function generateSlots(request: SlotRequest): Slot[] {
  const zone = safeZone(request.timezone);
  const interval = request.slotIntervalMinutes ?? 15;
  const duration = request.durationMinutes;
  if (duration <= 0 || interval <= 0) return [];

  const earliest = new Date(
    Math.max(
      request.rangeStart.getTime(),
      request.now.getTime() + request.policy.minNoticeMinutes * 60_000,
    ),
  );
  const latest = new Date(
    Math.min(
      request.rangeEnd.getTime(),
      request.now.getTime() + request.policy.maxAdvanceDays * 86_400_000,
    ),
  );
  if (earliest >= latest) return [];

  // Widen the day walk by one day on each side: a local day in the
  // practitioner's zone can start before or end after the UTC range bounds.
  let cursor = DateTime.fromJSDate(request.rangeStart, { zone })
    .startOf("day")
    .minus({ days: 1 });
  const lastDay = DateTime.fromJSDate(latest, { zone })
    .startOf("day")
    .plus({ days: 1 });

  const slots: Slot[] = [];

  while (cursor <= lastDay) {
    const date = cursor.toISODate();
    if (!date) break;

    for (const window of windowsForDate(request, date, cursor.weekday)) {
      for (
        let minute = window.start;
        minute + duration <= window.end;
        minute += interval
      ) {
        const startsAt = wallClockToInstant(date, minute, zone);
        // Null means this wall-clock time does not exist on this date (the
        // hour skipped by a spring-forward transition) — not bookable.
        if (!startsAt) continue;

        if (startsAt < earliest || startsAt > latest) continue;

        const endsAt = DateTime.fromJSDate(startsAt, { zone })
          .plus({ minutes: duration })
          .toJSDate();

        const blockStart = new Date(
          startsAt.getTime() - request.policy.bufferBeforeMinutes * 60_000,
        );
        const blockEnd = new Date(
          endsAt.getTime() + request.policy.bufferAfterMinutes * 60_000,
        );

        if (overlapsBusy(request, blockStart, blockEnd)) continue;

        slots.push({ startsAt, endsAt, practitionerDate: date });
      }
    }

    cursor = cursor.plus({ days: 1 });
  }

  slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  // A slot can be produced twice when overlapping windows survive merging on
  // either side of a day boundary; keep the first of each instant.
  const seen = new Set<number>();
  return slots.filter((slot) => {
    const key = slot.startsAt.getTime();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The soonest bookable instant, or null when the practitioner has none. */
export function nextAvailableSlot(request: SlotRequest): Slot | null {
  return generateSlots(request)[0] ?? null;
}

/**
 * Whether a specific requested start time is still bookable. Used for the
 * final re-check immediately before a booking is written.
 */
export function isSlotBookable(
  request: SlotRequest,
  startsAt: Date,
): boolean {
  const target = startsAt.getTime();
  return generateSlots({
    ...request,
    rangeStart: new Date(target - 60_000),
    rangeEnd: new Date(target + 60_000),
  }).some((slot) => slot.startsAt.getTime() === target);
}

/** Expand an appointment to the span it occupies including buffers. */
export function blockRange(
  startsAt: Date,
  durationMinutes: number,
  bufferBeforeMinutes: number,
  bufferAfterMinutes: number,
): { startsAt: Date; endsAt: Date; blockStartsAt: Date; blockEndsAt: Date } {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  return {
    startsAt,
    endsAt,
    blockStartsAt: new Date(startsAt.getTime() - bufferBeforeMinutes * 60_000),
    blockEndsAt: new Date(endsAt.getTime() + bufferAfterMinutes * 60_000),
  };
}
