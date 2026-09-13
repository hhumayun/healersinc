/** A recurring weekly window in the practitioner's local wall clock. */
export interface WeeklyWindow {
  /** 1 = Monday … 7 = Sunday (Luxon's `weekday`). */
  weekday: number;
  /** Minutes from local midnight. */
  startMinute: number;
  endMinute: number;
}

/**
 * A one-off change to the weekly pattern. `block` and `vacation` subtract time;
 * `extra` adds it. Null minutes mean the whole local day.
 */
export interface ScheduleException {
  kind: "block" | "vacation" | "extra";
  /** Inclusive local calendar dates, `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  startMinute: number | null;
  endMinute: number | null;
}

/** An already-taken span of real time, buffers included. */
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface BookingPolicy {
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
}

export interface SlotRequest {
  /** Practitioner's IANA zone; all windows are authored in it. */
  timezone: string;
  windows: WeeklyWindow[];
  exceptions: ScheduleException[];
  busy: BusyInterval[];
  durationMinutes: number;
  policy: BookingPolicy;
  /** Granularity of generated start times, in minutes. */
  slotIntervalMinutes?: number;
  /** UTC range to generate within. */
  rangeStart: Date;
  rangeEnd: Date;
  now: Date;
}

export interface Slot {
  /** UTC instant the session starts. */
  startsAt: Date;
  /** UTC instant the session ends. */
  endsAt: Date;
  /** Local calendar day in the practitioner's zone, `YYYY-MM-DD`. */
  practitionerDate: string;
}
