import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CalendarOff, Globe, Info, Plus, Trash2 } from 'lucide-react';
import {
  getGetMyAvailabilityQueryKey,
  getListAvailabilityExceptionsQueryKey,
  useCreateAvailabilityException,
  useDeleteAvailabilityException,
  useGetMyAvailability,
  useListAvailabilityExceptions,
  useUpdateMyAvailability,
  AvailabilityExceptionDraftKind,
  type AvailabilityException,
  type AvailabilityExceptionDraft,
  type AvailabilityRule,
  type AvailabilitySchedule,
} from '@workspace/api-client-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/healers-inc/components/ui/alert-dialog';
import { Badge } from '@workspace/healers-inc/components/ui/badge';
import { Button } from '@workspace/healers-inc/components/ui/button';
import { Card, CardContent } from '@workspace/healers-inc/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/healers-inc/components/ui/dialog';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@workspace/healers-inc/components/ui/field';
import { Input } from '@workspace/healers-inc/components/ui/input';
import { Textarea } from '@workspace/healers-inc/components/ui/textarea';
import { toast } from '@workspace/healers-inc/hooks/use-toast';
import { cn } from '@workspace/healers-inc/lib/utils';

import { ChoiceChips } from '@/components/manage/choice-chips';
import { ManageLayout, Section } from '@/components/manage/section';
import { ErrorBanner, ErrorState, LoadingBlock, Page, PageHeader } from '@/components/page';
import { errorMessage } from '@/lib/errors';
import { formatCalendarDate, zoneCity } from '@/lib/format';

const WEEKDAYS = [
  { day: 1, label: 'Monday' },
  { day: 2, label: 'Tuesday' },
  { day: 3, label: 'Wednesday' },
  { day: 4, label: 'Thursday' },
  { day: 5, label: 'Friday' },
  { day: 6, label: 'Saturday' },
  { day: 7, label: 'Sunday' },
] as const;

type Window = { startMinute: number; endMinute: number };
type WeekMap = Record<number, Window[]>;

/** `540` -> `9:00 AM`. */
function minutesToLabel(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** `"09:30"` -> minutes. Returns null if unparseable. */
function parseClock(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 24 || m < 0 || m > 59) return null;
  const total = h * 60 + m;
  return total > 1440 ? null : total;
}

function minutesToClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function rulesToWeek(rules: AvailabilityRule[]): WeekMap {
  const week: WeekMap = {};
  for (const d of WEEKDAYS) week[d.day] = [];
  for (const rule of rules) {
    if (!week[rule.weekday]) week[rule.weekday] = [];
    week[rule.weekday].push({ startMinute: rule.startMinute, endMinute: rule.endMinute });
  }
  for (const d of WEEKDAYS) week[d.day].sort((a, b) => a.startMinute - b.startMinute);
  return week;
}

function weekToRules(week: WeekMap): AvailabilityRule[] {
  const rules: AvailabilityRule[] = [];
  for (const d of WEEKDAYS) {
    for (const w of week[d.day] ?? []) {
      rules.push({ weekday: d.day, startMinute: w.startMinute, endMinute: w.endMinute });
    }
  }
  return rules;
}

function validateDay(windows: Window[]): (string | undefined)[] {
  const sorted = [...windows].map((w, i) => ({ ...w, i })).sort((a, b) => a.startMinute - b.startMinute);
  const errors: (string | undefined)[] = windows.map(() => undefined);
  for (let k = 0; k < sorted.length; k++) {
    const cur = sorted[k];
    if (cur.endMinute <= cur.startMinute) {
      errors[cur.i] = 'End must be after start.';
      continue;
    }
    const prev = sorted[k - 1];
    if (prev && cur.startMinute < prev.endMinute) errors[cur.i] = 'Overlaps another window.';
  }
  return errors;
}

const EXCEPTION_KIND_INFO: Record<
  AvailabilityExceptionDraftKind,
  { label: string; description: string; className: string }
> = {
  block: {
    label: 'Block',
    description: 'Removes bookable slots for the chosen date and time.',
    className: 'border-transparent bg-destructive/10 text-destructive',
  },
  vacation: {
    label: 'Vacation',
    description: 'Marks whole days off — no bookings across the range.',
    className: 'border-transparent bg-muted text-muted-foreground',
  },
  extra: {
    label: 'Extra hours',
    description: 'Opens bookable time outside your usual weekly hours.',
    className: 'border-transparent bg-primary/15 text-primary',
  },
};

const KIND_OPTIONS = [
  { value: AvailabilityExceptionDraftKind.block, label: 'Block' },
  { value: AvailabilityExceptionDraftKind.vacation, label: 'Vacation' },
  { value: AvailabilityExceptionDraftKind.extra, label: 'Extra hours' },
] as const;

/** Editor for a single weekday's window. Native time inputs give `HH:MM`. */
function WindowRow({
  id,
  window,
  onChange,
  onRemove,
  error,
}: {
  id: string;
  window: Window;
  onChange: (next: Window) => void;
  onRemove: () => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="time"
          step={300}
          value={minutesToClock(window.startMinute)}
          onChange={(e) => {
            const s = parseClock(e.target.value);
            if (s != null) onChange({ ...window, startMinute: s });
          }}
          aria-label="Start time"
          aria-invalid={!!error || undefined}
          className="flex-1 min-w-0"
          data-testid={`${id}-start`}
        />
        <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          type="time"
          step={300}
          value={minutesToClock(window.endMinute)}
          onChange={(e) => {
            const v = parseClock(e.target.value);
            if (v != null) onChange({ ...window, endMinute: v });
          }}
          aria-label="End time"
          aria-invalid={!!error || undefined}
          className="flex-1 min-w-0"
          data-testid={`${id}-end`}
        />
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label="Remove window" className="text-destructive hover:text-destructive" data-testid={`${id}-remove`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ExceptionEditor({
  open,
  timezone,
  onClose,
  onSaved,
}: {
  open: boolean;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useCreateAvailabilityException();
  const [kind, setKind] = useState<AvailabilityExceptionDraftKind>(AvailabilityExceptionDraftKind.block);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(AvailabilityExceptionDraftKind.block);
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setNote('');
    setError(null);
  }, [open]);

  const usesTime = kind !== AvailabilityExceptionDraftKind.vacation;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(startDate);

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!dateOk) return setError('Choose a start date.');
    const end = endDate.trim() || startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return setError('Choose an end date.');
    if (end < startDate) return setError('The end date must not be before the start date.');

    let startMinute: number | null = null;
    let endMinute: number | null = null;
    if (usesTime && (startTime.trim() || endTime.trim())) {
      startMinute = parseClock(startTime);
      endMinute = parseClock(endTime);
      if (startMinute == null || endMinute == null) return setError('Enter both a from and a to time.');
      if (endMinute <= startMinute) return setError('End time must be after start time.');
    }

    const body: AvailabilityExceptionDraft = { kind, startDate, endDate: end, startMinute, endMinute, note: note.trim() || null };
    create.mutate({ data: body }, { onSuccess: onSaved, onError: (err) => setError(errorMessage(err, 'Could not save the exception.')) });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto" data-testid="exception-editor">
        <DialogHeader>
          <DialogTitle>New exception</DialogTitle>
          <DialogDescription>One-off changes: block time, take a vacation, or open extra hours.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel>Type</FieldLabel>
              <ChoiceChips<AvailabilityExceptionDraftKind> label="Type" options={KIND_OPTIONS} value={kind} onChange={(next) => setKind(next)} testId="exc-kind" />
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
                {EXCEPTION_KIND_INFO[kind].description}
              </p>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field>
                <FieldLabel htmlFor="exc-start">
                  Start date <span className="text-destructive">*</span>
                </FieldLabel>
                <Input id="exc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="exc-start" />
              </Field>
              <Field>
                <FieldLabel htmlFor="exc-end">End date</FieldLabel>
                <Input id="exc-end" type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} data-testid="exc-end" />
                <FieldDescription>Same day if empty.</FieldDescription>
              </Field>
            </div>
            {usesTime ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field>
                  <FieldLabel htmlFor="exc-from">From</FieldLabel>
                  <Input id="exc-from" type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} data-testid="exc-from" />
                  <FieldDescription>Optional — all day if empty.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="exc-to">To</FieldLabel>
                  <Input id="exc-to" type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} data-testid="exc-to" />
                </Field>
              </div>
            ) : null}
            <Field>
              <FieldLabel htmlFor="exc-note">Note</FieldLabel>
              <Textarea id="exc-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Conference, day off…" data-testid="exc-note" />
              <FieldDescription>Only you see this. All times are in your zone{timezone ? ` (${zoneCity(timezone)})` : ''}.</FieldDescription>
            </Field>
          </FieldGroup>
          {error ? <ErrorBanner message={error} /> : null}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending} data-testid="exc-save">
              {create.isPending ? 'Saving…' : 'Save exception'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** `/manage/availability` — weekly hours and exceptions, ported from the Expo screen. */
export default function ManageAvailabilityPage() {
  const queryClient = useQueryClient();
  const availabilityQuery = useGetMyAvailability({ query: { queryKey: getGetMyAvailabilityQueryKey() } });
  const exceptionsQuery = useListAvailabilityExceptions({
    query: { queryKey: getListAvailabilityExceptionsQueryKey() },
  });
  const updateSchedule = useUpdateMyAvailability();
  const deleteException = useDeleteAvailabilityException();

  const [week, setWeek] = useState<WeekMap>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  const [removing, setRemoving] = useState<AvailabilityException | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    document.title = 'Availability · Healers Inc';
  }, []);

  const schedule = availabilityQuery.data;
  const timezone = schedule?.timezone ?? '';

  useEffect(() => {
    if (schedule && !initialized.current) {
      initialized.current = true;
      setWeek(rulesToWeek(schedule.rules));
    }
  }, [schedule]);

  const dayErrors = useMemo(() => {
    const map: Record<number, (string | undefined)[]> = {};
    for (const d of WEEKDAYS) map[d.day] = validateDay(week[d.day] ?? []);
    return map;
  }, [week]);
  const hasErrors = useMemo(
    () => Object.values(dayErrors).some((errs) => errs.some((e) => e !== undefined)),
    [dayErrors],
  );

  const addWindow = (day: number) =>
    setWeek((prev) => {
      const existing = prev[day] ?? [];
      const last = existing[existing.length - 1];
      const startMinute = last ? Math.min(last.endMinute + 60, 22 * 60) : 9 * 60;
      const endMinute = Math.min(startMinute + 60, 24 * 60);
      return { ...prev, [day]: [...existing, { startMinute, endMinute }] };
    });
  const updateWindow = (day: number, index: number, next: Window) =>
    setWeek((prev) => {
      const copy = [...(prev[day] ?? [])];
      copy[index] = next;
      return { ...prev, [day]: copy };
    });
  const removeWindow = (day: number, index: number) =>
    setWeek((prev) => {
      const copy = [...(prev[day] ?? [])];
      copy.splice(index, 1);
      return { ...prev, [day]: copy };
    });
  const copyToWeekdays = (day: number) =>
    setWeek((prev) => {
      const source = (prev[day] ?? []).map((w) => ({ ...w }));
      const next = { ...prev };
      for (const d of WEEKDAYS) if (d.day <= 5 && d.day !== day) next[d.day] = source.map((w) => ({ ...w }));
      return next;
    });

  function saveSchedule(event: FormEvent) {
    event.preventDefault();
    if (!schedule) return;
    setSaveError(null);
    if (hasErrors) return setSaveError('Fix the highlighted hours before saving.');
    const body: AvailabilitySchedule = { timezone: schedule.timezone, rules: weekToRules(week) };
    updateSchedule.mutate(
      { data: body },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMyAvailabilityQueryKey(), updated);
          toast({ title: 'Weekly hours saved' });
        },
        onError: (err) => setSaveError(errorMessage(err, 'Could not save your hours.')),
      },
    );
  }

  function confirmRemove(exception: AvailabilityException) {
    setRemoving(null);
    setDeletingId(exception.id);
    deleteException.mutate(
      { exceptionId: exception.id },
      {
        onSuccess: () => {
          setDeletingId(null);
          void queryClient.invalidateQueries({ queryKey: getListAvailabilityExceptionsQueryKey() });
        },
        onError: (err) => {
          setDeletingId(null);
          toast({ variant: 'destructive', title: 'Could not remove', description: errorMessage(err, 'Please try again.') });
        },
      },
    );
  }

  if (availabilityQuery.isLoading) {
    return (
      <Page testId="page-manage-availability">
        <LoadingBlock label="Loading your hours…" />
      </Page>
    );
  }
  if (availabilityQuery.isError || !schedule) {
    return (
      <Page width="narrow" testId="page-manage-availability">
        <ErrorState title="Couldn't load your availability" error={availabilityQuery.error} onRetry={() => void availabilityQuery.refetch()} />
      </Page>
    );
  }

  const exceptions = exceptionsQuery.data ?? [];
  const exceptionsPanel = (
    <Section
      title="Exceptions"
      description="One-off changes: block time, take a vacation, or open extra hours."
      action={
        <Button size="sm" variant="outline" onClick={() => setExceptionOpen(true)} data-testid="exception-add">
          <Plus className="w-4 h-4" />
          Add
        </Button>
      }
      testId="exceptions"
    >
      {exceptionsQuery.isError ? (
        <ErrorState title="Couldn't load exceptions" error={exceptionsQuery.error} onRetry={() => void exceptionsQuery.refetch()} />
      ) : exceptions.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {exceptions.map((exception) => {
            const info = EXCEPTION_KIND_INFO[exception.kind];
            const range =
              exception.startDate === exception.endDate
                ? formatCalendarDate(exception.startDate)
                : `${formatCalendarDate(exception.startDate)} – ${formatCalendarDate(exception.endDate)}`;
            const timeLabel =
              exception.startMinute != null && exception.endMinute != null
                ? `${minutesToLabel(exception.startMinute)} – ${minutesToLabel(exception.endMinute)}`
                : 'All day';
            return (
              <li key={exception.id}>
                <Card data-testid={`exception-${exception.id}`}>
                  <CardContent className="flex flex-col gap-1.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className={cn('shadow-none', info.className)}>
                        {info.label}
                      </Badge>
                      <Button size="icon" variant="ghost" aria-label="Remove exception" disabled={deletingId === exception.id} onClick={() => setRemoving(exception)} className="text-destructive hover:text-destructive" data-testid={`exception-remove-${exception.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="font-medium text-foreground">{range}</p>
                    <p className="text-xs text-muted-foreground">{timeLabel}</p>
                    {exception.note ? <p className="text-sm text-muted-foreground">{exception.note}</p> : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 p-6 text-center">
            <CalendarOff className="w-5 h-5 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">No exceptions. Your weekly hours apply every week.</p>
          </CardContent>
        </Card>
      )}
    </Section>
  );

  return (
    <Page testId="page-manage-availability">
      <PageHeader eyebrow="Your practice" title="Availability" description="Your weekly hours and time off." backHref="/dashboard" backLabel="Dashboard" />
      <ManageLayout aside={exceptionsPanel}>
        <Card className="bg-muted/40">
          <CardContent className="flex items-center gap-3 p-4">
            <Globe className="w-5 h-5 text-primary shrink-0" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Hours are in your time zone{timezone ? ` (${zoneCity(timezone)})` : ''}. Clients always see times converted to their own.
            </p>
          </CardContent>
        </Card>

        <form onSubmit={saveSchedule} className="flex flex-col gap-6" noValidate data-testid="weekly-hours-form">
          <Section title="Weekly hours">
            <div className="flex flex-col gap-3">
              {WEEKDAYS.map(({ day, label }) => {
                const windows = week[day] ?? [];
                const errs = dayErrors[day] ?? [];
                return (
                  <Card key={day} data-testid={`weekday-${day}`}>
                    <CardContent className="flex flex-col gap-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {windows.length === 0 ? 'Unavailable' : `${windows.length} window${windows.length > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      {windows.map((win, index) => (
                        <WindowRow key={index} id={`weekday-${day}-window-${index}`} window={win} error={errs[index]} onChange={(next) => updateWindow(day, index, next)} onRemove={() => removeWindow(day, index)} />
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => addWindow(day)} data-testid={`weekday-${day}-add`}>
                          <Plus className="w-3.5 h-3.5" />
                          {windows.length === 0 ? 'Add hours' : 'Add another window'}
                        </Button>
                        {day === 1 && windows.length > 0 ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => copyToWeekdays(day)} data-testid="copy-to-weekdays">
                            Copy to Tue–Fri
                          </Button>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Section>

          {saveError ? <ErrorBanner message={saveError} /> : null}
          <Button type="submit" size="lg" className="w-full sm:w-auto sm:self-start" disabled={hasErrors || updateSchedule.isPending} data-testid="save-hours">
            {updateSchedule.isPending ? 'Saving…' : 'Save weekly hours'}
          </Button>
        </form>

        <div className="lg:hidden">{exceptionsPanel}</div>
      </ManageLayout>

      <ExceptionEditor
        open={exceptionOpen}
        timezone={timezone}
        onClose={() => setExceptionOpen(false)}
        onSaved={() => {
          setExceptionOpen(false);
          void queryClient.invalidateQueries({ queryKey: getListAvailabilityExceptionsQueryKey() });
          toast({ title: 'Exception saved' });
        }}
      />

      <AlertDialog open={removing !== null} onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}>
        <AlertDialogContent data-testid="exception-remove-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this exception?</AlertDialogTitle>
            <AlertDialogDescription>Your usual hours will apply again.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => removing && confirmRemove(removing)} data-testid="exception-remove-confirm">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
