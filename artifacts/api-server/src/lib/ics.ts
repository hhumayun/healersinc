import type { Appointment } from "@workspace/db";

function icsInstant(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escape the characters iCalendar treats as structural. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** iCalendar requires CRLF line endings and lines of at most 75 octets. */
function fold(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export interface CalendarFileInput {
  appointment: Appointment;
  practitionerName: string;
  clientName: string;
  viewerRole: "client" | "practitioner";
}

/**
 * A single-event calendar file. Times are written as UTC instants so importing
 * calendars render them in whatever zone the device is set to.
 */
export function buildIcs(input: CalendarFileInput): string {
  const { appointment } = input;
  const counterpart =
    input.viewerRole === "client" ? input.practitionerName : input.clientName;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Healers Inc//Marketplace//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${appointment.id}@healers.inc`,
    `DTSTAMP:${icsInstant(new Date())}`,
    `DTSTART:${icsInstant(appointment.startsAt)}`,
    `DTEND:${icsInstant(appointment.endsAt)}`,
    `SUMMARY:${escapeText(`${appointment.serviceName} with ${counterpart}`)}`,
    `DESCRIPTION:${escapeText(
      `${appointment.serviceName} (${appointment.serviceDurationMinutes} minutes) booked through Healers Inc.`,
    )}`,
    `STATUS:${appointment.status === "cancelled" || appointment.status === "declined" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n");
}

export function icsFilename(appointment: Appointment): string {
  const slug = appointment.serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "session"}-${appointment.id.slice(0, 8)}.ics`;
}
