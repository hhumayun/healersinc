import { CalendarDays, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import type { AvailabilityDay, AvailabilitySlot } from '@workspace/api-client-react';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Skeleton } from '@workspace/healers-inc/components/ui/skeleton';
import { cn } from '@workspace/healers-inc/lib/utils';

import { EmptyState, ErrorState } from '@/components/page';
import { calendarParts, formatCalendarDate, zoneCity } from '@/lib/format';

export type SlotPickerProps = {
  /** Days in the viewer's zone that still have at least one slot. */
  days: AvailabilityDay[];
  selectedDate: string | null;
  selectedSlot: AvailabilitySlot | null;
  onSelectDate: (date: string) => void;
  onSelectSlot: (slot: AvailabilitySlot) => void;
  /** Inclusive `YYYY-MM-DD` window currently loaded (viewer zone). */
  from: string;
  to: string;
  /** How many days ahead of today the window starts. */
  rangeOffset: number;
  onLater: () => void;
  onEarlier: () => void;
  /** False once `policy.maxAdvanceDays` has been reached. */
  canGoLater: boolean;
  viewerTimezone: string;
  practitionerTimezone?: string;
  sameTimezone: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error?: unknown;
  onRetry: () => void;
};

/**
 * Step 2 of the booking flow: a horizontal day strip plus the slots of the
 * selected day, every slot labelled in the viewer's zone first and the
 * practitioner's zone underneath when they differ. Mirrors the Expo screen.
 */
export function SlotPicker(props: SlotPickerProps) {
  const {
    days,
    selectedDate,
    selectedSlot,
    onSelectDate,
    onSelectSlot,
    from,
    to,
    rangeOffset,
    onLater,
    onEarlier,
    canGoLater,
    viewerTimezone,
    practitionerTimezone,
    sameTimezone,
    isLoading,
    isFetching,
    error,
    onRetry,
  } = props;

  const activeDay = days.find((d) => d.date === selectedDate) ?? null;

  const rangeNav = (
    <div className="flex items-center justify-between gap-2" data-testid="slot-range-nav">
      <p className="text-sm text-muted-foreground">
        {formatCalendarDate(from)} – {formatCalendarDate(to)}
      </p>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEarlier}
          disabled={rangeOffset === 0 || isFetching}
          aria-label="Earlier dates"
          data-testid="slot-range-earlier"
        >
          <ChevronLeft />
          Earlier
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onLater}
          disabled={!canGoLater || isFetching}
          aria-label="Later dates"
          data-testid="slot-range-later"
        >
          Later
          <ChevronRight />
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4" data-testid="slot-picker-loading" aria-busy="true">
        {rangeNav}
        <div className="flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-[4.5rem] w-16 shrink-0 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        {rangeNav}
        <ErrorState title="Couldn't load availability" error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {rangeNav}
        <EmptyState
          icon={CalendarDays}
          title="No open times in this range"
          description={
            rangeOffset === 0
              ? 'Nothing available in the next two weeks. Look further ahead?'
              : canGoLater
                ? 'Still nothing here. Keep looking?'
                : 'This practitioner is not taking bookings any further ahead yet.'
          }
          action={
            canGoLater ? (
              <Button type="button" onClick={onLater} data-testid="slot-empty-later">
                Try the next two weeks
                <ChevronRight />
              </Button>
            ) : rangeOffset > 0 ? (
              <Button type="button" variant="outline" onClick={onEarlier} data-testid="slot-empty-earlier">
                <ChevronLeft />
                Back to earlier dates
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-5', isFetching && 'opacity-70 transition-opacity')} data-testid="slot-picker">
      {rangeNav}

      {/* Day strip — bleeds to the screen edge on mobile so it scrolls naturally. */}
      <div
        role="radiogroup"
        aria-label="Pick a day"
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:thin]"
        data-testid="day-strip"
      >
        {days.map((day) => {
          const active = day.date === selectedDate;
          const { day: dayNum, weekday } = calendarParts(day.date);
          return (
            <button
              key={day.date}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={formatCalendarDate(day.date, true)}
              onClick={() => onSelectDate(day.date)}
              data-testid={`day-option-${day.date}`}
              className={cn(
                'flex w-16 shrink-0 snap-start flex-col items-center gap-0.5 rounded-lg border py-2.5 transition-colors',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted/40',
              )}
            >
              <span className={cn('text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {weekday}
              </span>
              <span className="text-lg font-semibold leading-tight">{dayNum}</span>
              <span className={cn('text-[0.65rem]', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {day.slots.length} {day.slots.length === 1 ? 'time' : 'times'}
              </span>
            </button>
          );
        })}
      </div>

      {activeDay ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {formatCalendarDate(activeDay.date, true)}
            </h3>
            <p className="text-xs text-muted-foreground">
              Times in {zoneCity(viewerTimezone)} ({viewerTimezone})
            </p>
          </div>

          {!sameTimezone && practitionerTimezone ? (
            <div
              className="flex items-start gap-2 rounded-md bg-primary/10 px-3 py-2.5 text-xs text-foreground"
              data-testid="slot-timezone-note"
            >
              <Globe className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p>
                Times show in your zone ({zoneCity(viewerTimezone)}) first, with{' '}
                {zoneCity(practitionerTimezone)} for your healer below.
              </p>
            </div>
          ) : null}

          <div
            role="radiogroup"
            aria-label="Pick a time"
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            data-testid="slot-grid"
          >
            {activeDay.slots.map((slot) => {
              const active = slot.startsAt === selectedSlot?.startsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`Book ${slot.viewerLabel}`}
                  onClick={() => onSelectSlot(slot)}
                  data-testid={`slot-option-${slot.startsAt}`}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2.5 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:bg-muted/40',
                  )}
                >
                  <span className="text-sm font-semibold">{slot.viewerLabel}</span>
                  {!sameTimezone ? (
                    <span
                      className={cn(
                        'text-[0.65rem] leading-tight',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      {slot.practitionerLabel} their time
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {canGoLater ? (
        <div>
          <Button type="button" variant="link" size="sm" className="px-0" onClick={onLater} data-testid="slot-look-ahead">
            Look further ahead
            <ChevronRight />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
