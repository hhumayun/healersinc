import type { AppointmentStatus, SessionFormat } from '@workspace/api-client-react';

/** `4500, "CAD"` -> `$45`. Whole amounts drop the cents. */
export function formatMoney(cents?: number | null, currency = 'CAD'): string {
  if (cents == null) return '—';
  const amount = cents / 100;
  const fraction = amount % 1 === 0 ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: fraction,
      maximumFractionDigits: fraction,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(fraction)}`;
  }
}

/** `90` -> `1h 30m` */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export const sessionFormatLabel: Record<SessionFormat, string> = {
  online: 'Online',
  phone: 'Phone',
  in_person: 'In person',
};

export const statusLabel: Record<AppointmentStatus, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** `YYYY-MM-DD` -> `Mon, 24 Aug`. Parsed as a plain calendar date, never UTC-shifted. */
export function formatCalendarDate(isoDate: string, withYear = false): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  const base = `${WEEKDAYS[date.getDay()]}, ${d} ${MONTHS[m - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

/** `YYYY-MM-DD` -> `24` / `Mon` pieces, for calendar strips. */
export function calendarParts(isoDate: string): { day: string; weekday: string } {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return { day: String(d ?? ''), weekday: WEEKDAYS[date.getDay()] ?? '' };
}

/**
 * Today as `YYYY-MM-DD` in `zone` (an IANA name), defaulting to the device
 * zone. Calendar windows must be built in the same zone the API will read them
 * in, otherwise a booking near midnight lands on the wrong day.
 */
export function todayIso(offsetDays = 0, zone?: string | null): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);

  if (zone) {
    try {
      // `en-CA` formats as YYYY-MM-DD.
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
    } catch {
      // Fall through to the device zone on an unknown zone name.
    }
  }

  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** `2026-08-20T14:00:00Z` -> `2h ago` / `just now`. */
export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatCalendarDate(iso.slice(0, 10));
}

/** Clock time in a specific IANA zone, e.g. `2:05 PM`. */
export function clockInZone(iso: string, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(11, 16);
  }
}

/** `America/Toronto` -> `Toronto`. */
export function zoneCity(timezone?: string | null): string {
  if (!timezone) return '';
  const part = timezone.split('/').pop() ?? timezone;
  return part.replace(/_/g, ' ');
}

/** 5-star average with one decimal, or `New` when unrated. */
export function formatRating(average?: number | null, count = 0): string {
  if (!average || count === 0) return 'New';
  return average.toFixed(1);
}

/** Random-ish key so a retried booking is not double-charged/duplicated. */
export function makeIdempotencyKey(): string {
  return `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
