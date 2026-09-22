import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, LocateFixed } from 'lucide-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@workspace/healers-inc/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@workspace/healers-inc/components/ui/popover';
import { cn } from '@workspace/healers-inc/lib/utils';

import { clockInZone, zoneCity } from '@/lib/format';
import { browserTimezone } from '@/lib/session';

/** Used when the runtime cannot enumerate IANA zones (`Intl.supportedValuesOf`). */
const FALLBACK_ZONES = [
  'UTC',
  'America/Anchorage',
  'America/Argentina/Buenos_Aires',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Edmonton',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Phoenix',
  'America/Sao_Paulo',
  'America/St_Johns',
  'America/Toronto',
  'America/Vancouver',
  'America/Winnipeg',
  'Pacific/Honolulu',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Dublin',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Stockholm',
  'Europe/Zurich',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Adelaide',
  'Australia/Brisbane',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
];

/** Every IANA zone the runtime knows, or a curated list when it cannot enumerate them. */
export function supportedTimezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === 'function') {
      const zones = intl.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length > 0) return zones;
    }
  } catch {
    // Fall through to the curated list.
  }
  return FALLBACK_ZONES;
}

export function isValidTimezone(tz: string): boolean {
  if (!tz.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz.trim() }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** `America/Toronto` -> `America`; the leading region, used to group the list. */
function zoneRegion(tz: string): string {
  const idx = tz.indexOf('/');
  return idx === -1 ? 'Other' : tz.slice(0, idx);
}

/**
 * Searchable IANA time zone picker (Popover + cmdk). Each option shows the
 * city and the full zone name, so "toronto" and "america/tor" both match.
 * The current value is always selectable even when the runtime's list lacks it.
 */
export function TimezoneSelect({
  value,
  onChange,
  id,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detected = browserTimezone();

  const zones = useMemo(() => {
    const list = supportedTimezones();
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [value]);

  const groups = useMemo(() => {
    const byRegion = new Map<string, string[]>();
    for (const tz of zones) {
      const region = zoneRegion(tz);
      const bucket = byRegion.get(region);
      if (bucket) bucket.push(tz);
      else byRegion.set(region, [tz]);
    }
    return [...byRegion.entries()];
  }, [zones]);

  const now = new Date().toISOString();

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal min-h-10',
              invalid && 'border-destructive text-destructive',
            )}
            data-testid="select-timezone"
          >
            <span className="flex items-center gap-2 min-w-0">
              {value ? (
                <>
                  <span className="truncate text-foreground">{zoneCity(value)}</span>
                  <span className="truncate text-xs text-muted-foreground">{value}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Choose a time zone</span>
              )}
            </span>
            <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[--radix-popover-trigger-width] min-w-72 p-0"
          data-testid="timezone-popover"
        >
          <Command>
            <CommandInput placeholder="Search by city or zone…" data-testid="input-timezone-search" />
            <CommandList>
              <CommandEmpty>No time zone found.</CommandEmpty>
              {groups.map(([region, list]) => (
                <CommandGroup key={region} heading={region}>
                  {list.map((tz) => (
                    <CommandItem
                      key={tz}
                      value={`${zoneCity(tz)} ${tz}`}
                      onSelect={() => {
                        onChange(tz);
                        setOpen(false);
                      }}
                      className="justify-between gap-3"
                      data-testid={`timezone-option-${tz}`}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Check
                          className={cn('w-4 h-4 shrink-0', tz === value ? 'opacity-100' : 'opacity-0')}
                          aria-hidden
                        />
                        <span className="flex flex-col min-w-0">
                          <span className="truncate">{zoneCity(tz)}</span>
                          <span className="truncate text-xs text-muted-foreground">{tz}</span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {clockInZone(now, tz)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {detected && detected !== value ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-start px-0 h-auto"
          onClick={() => onChange(detected)}
          disabled={disabled}
          data-testid="button-use-browser-timezone"
        >
          <LocateFixed className="w-3.5 h-3.5" aria-hidden />
          Use my browser's time zone ({zoneCity(detected)})
        </Button>
      ) : null}
    </div>
  );
}
