import { DateTime, IANAZone } from "luxon";

/** True when the string is a real IANA identifier this runtime understands. */
export function isValidTimeZone(zone: string): boolean {
  return IANAZone.isValidZone(zone);
}

/** Falls back to UTC rather than throwing, so a bad stored zone never 500s. */
export function safeZone(zone: string | null | undefined): string {
  return zone && isValidTimeZone(zone) ? zone : "UTC";
}

/** e.g. `EDT (GMT-4)` — used to label times when the two sides differ. */
export function zoneLabel(zone: string, at: Date): string {
  const dt = DateTime.fromJSDate(at, { zone: safeZone(zone) });
  const abbreviation = dt.toFormat("ZZZZ");
  const offset = dt.toFormat("ZZ");
  return `${abbreviation} (GMT${offset})`;
}

/** Human-readable rendering of an instant in a given zone. */
export function formatInZone(
  at: Date,
  zone: string,
  format = "EEE, d LLL yyyy · h:mm a",
): string {
  return DateTime.fromJSDate(at, { zone: safeZone(zone) }).toFormat(format);
}

/** The local calendar day (`YYYY-MM-DD`) an instant falls on in a zone. */
export function localDate(at: Date, zone: string): string {
  return DateTime.fromJSDate(at, { zone: safeZone(zone) }).toISODate() ?? "";
}

/** Minutes from local midnight for an instant in a zone. */
export function localMinutes(at: Date, zone: string): number {
  const dt = DateTime.fromJSDate(at, { zone: safeZone(zone) });
  return dt.hour * 60 + dt.minute;
}

/**
 * Convert a local wall-clock time to a UTC instant.
 *
 * Returns `null` for times that do not exist (the skipped hour of a
 * spring-forward transition). For ambiguous times (the repeated hour of a
 * fall-back transition) Luxon resolves to the first — earlier — offset, which
 * we keep so the result is deterministic.
 */
export function wallClockToInstant(
  date: string,
  minuteOfDay: number,
  zone: string,
): Date | null {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (!year || !month || !day) return null;

  const dt = DateTime.fromObject(
    {
      year,
      month,
      day,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
    },
    { zone: safeZone(zone) },
  );

  if (!dt.isValid) return null;

  // Luxon shifts nonexistent local times forward rather than failing. If the
  // round-trip does not land on the requested wall clock, the time was skipped
  // by a DST transition and must not be offered as a slot.
  const requestedHour = Math.floor(minuteOfDay / 60);
  const requestedMinute = minuteOfDay % 60;
  if (dt.hour !== requestedHour || dt.minute !== requestedMinute) {
    return null;
  }

  return dt.toJSDate();
}
