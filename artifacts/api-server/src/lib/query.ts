import { DateTime } from "luxon";

import { badRequest } from "./errors.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The generated query schemas coerce every value to a string, which turns a
 * missing `?from=` into the literal `"undefined"` instead of a validation
 * error. Guard the calendar-day parameters here so a malformed or missing
 * range answers with a clear 400 rather than blowing up further down.
 */
export function requireCalendarDay(value: unknown, field: string): string {
  const raw = typeof value === "string" ? value.trim() : "";

  if (!ISO_DATE.test(raw) || !DateTime.fromISO(raw).isValid) {
    throw badRequest(`"${field}" has to be a calendar day formatted YYYY-MM-DD.`);
  }

  return raw;
}

/**
 * Read an optional instant (an ISO date-time cursor) from a query string.
 *
 * A query value is always a string, but the generated schema for a
 * `format: date-time` parameter is a plain `z.date()`, so parsing it there can
 * only ever fail. Pull these out of `req.query` before the generated parse.
 */
export function optionalInstant(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") return null;

  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = DateTime.fromISO(raw);

  if (!parsed.isValid) {
    throw badRequest(`"${field}" has to be a date and time.`);
  }

  return parsed.toJSDate();
}

/** Validate a `from`/`to` pair and make sure it reads forwards in time. */
export function requireCalendarRange(
  from: unknown,
  to: unknown,
): { from: string; to: string } {
  const start = requireCalendarDay(from, "from");
  const end = requireCalendarDay(to, "to");

  if (start > end) {
    throw badRequest("The start of the range must come before the end.");
  }

  return { from: start, to: end };
}
