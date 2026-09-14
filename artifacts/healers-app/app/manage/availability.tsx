import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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
import { useQueryClient } from '@tanstack/react-query';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  Segmented,
  Text,
  Textarea,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SCREEN_PADDING, SectionTitle } from '@/components/Screen';
import { formatCalendarDate, zoneCity } from '@/lib/format';
import { confirm, notify } from '@/lib/dialog';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

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
    week[rule.weekday].push({
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
    });
  }
  for (const d of WEEKDAYS) {
    week[d.day].sort((a, b) => a.startMinute - b.startMinute);
  }
  return week;
}

function weekToRules(week: WeekMap): AvailabilityRule[] {
  const rules: AvailabilityRule[] = [];
  for (const d of WEEKDAYS) {
    for (const w of week[d.day] ?? []) {
      rules.push({
        weekday: d.day,
        startMinute: w.startMinute,
        endMinute: w.endMinute,
      });
    }
  }
  return rules;
}

const EXCEPTION_KIND_INFO: Record<
  AvailabilityExceptionDraftKind,
  { label: string; description: string; variant: 'destructive' | 'muted' | 'success' }
> = {
  block: {
    label: 'Block',
    description: 'Removes bookable slots for the chosen date and time.',
    variant: 'destructive',
  },
  vacation: {
    label: 'Vacation',
    description: 'Marks whole days off — no bookings across the range.',
    variant: 'muted',
  },
  extra: {
    label: 'Extra hours',
    description: 'Opens bookable time outside your usual weekly hours.',
    variant: 'success',
  },
};

/** Editor for a single weekday's windows. */
function WindowRow({
  window,
  onChange,
  onRemove,
  error,
}: {
  window: Window;
  onChange: (next: Window) => void;
  onRemove: () => void;
  error?: string;
}) {
  const { colors } = useTheme();
  const [start, setStart] = useState(minutesToClock(window.startMinute));
  const [end, setEnd] = useState(minutesToClock(window.endMinute));

  useEffect(() => {
    setStart(minutesToClock(window.startMinute));
    setEnd(minutesToClock(window.endMinute));
  }, [window.startMinute, window.endMinute]);

  const commit = (rawStart: string, rawEnd: string) => {
    const s = parseClock(rawStart);
    const e = parseClock(rawEnd);
    onChange({
      startMinute: s ?? window.startMinute,
      endMinute: e ?? window.endMinute,
    });
  };

  return (
    <View style={{ gap: space(1.5) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <View style={{ flex: 1 }}>
          <Input
            value={start}
            onChangeText={setStart}
            onBlur={() => commit(start, end)}
            placeholder="09:00"
            keyboardType="numbers-and-punctuation"
            invalid={!!error}
          />
        </View>
        <Feather name="arrow-right" size={16} color={colors.mutedForeground} />
        <View style={{ flex: 1 }}>
          <Input
            value={end}
            onChangeText={setEnd}
            onBlur={() => commit(start, end)}
            placeholder="17:00"
            keyboardType="numbers-and-punctuation"
            invalid={!!error}
          />
        </View>
        <Button
          size="icon"
          variant="ghost"
          accessibilityLabel="Remove window"
          onPress={onRemove}
          icon={<Feather name="trash-2" size={18} color={colors.destructive} />}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function validateDay(windows: Window[]): (string | undefined)[] {
  const sorted = [...windows]
    .map((w, i) => ({ ...w, i }))
    .sort((a, b) => a.startMinute - b.startMinute);
  const errors: (string | undefined)[] = windows.map(() => undefined);
  for (let k = 0; k < sorted.length; k++) {
    const cur = sorted[k];
    if (cur.endMinute <= cur.startMinute) {
      errors[cur.i] = 'End must be after start.';
      continue;
    }
    const prev = sorted[k - 1];
    if (prev && cur.startMinute < prev.endMinute) {
      errors[cur.i] = 'Overlaps another window.';
    }
  }
  return errors;
}

function ExceptionEditor({
  visible,
  timezone,
  onClose,
  onSaved,
}: {
  visible: boolean;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const create = useCreateAvailabilityException();

  const [kind, setKind] = useState<AvailabilityExceptionDraftKind>(
    AvailabilityExceptionDraftKind.block,
  );
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKind(AvailabilityExceptionDraftKind.block);
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setNote('');
    setError(null);
  }, [visible]);

  const usesTime = kind !== AvailabilityExceptionDraftKind.vacation;
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(startDate);

  const submit = () => {
    setError(null);
    if (!dateOk) {
      setError('Enter a start date as YYYY-MM-DD.');
      return;
    }
    const end = endDate.trim() || startDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      setError('Enter an end date as YYYY-MM-DD.');
      return;
    }

    let startMinute: number | null = null;
    let endMinute: number | null = null;
    if (usesTime && (startTime.trim() || endTime.trim())) {
      startMinute = parseClock(startTime);
      endMinute = parseClock(endTime);
      if (startMinute == null || endMinute == null) {
        setError('Enter times as HH:MM.');
        return;
      }
      if (endMinute <= startMinute) {
        setError('End time must be after start time.');
        return;
      }
    }

    const body: AvailabilityExceptionDraft = {
      kind,
      startDate,
      endDate: end,
      startMinute,
      endMinute,
      note: note.trim() || null,
    };

    create.mutate(
      { data: body },
      {
        onSuccess: onSaved,
        onError: (err) =>
          setError(errorMessage(err, 'Could not save the exception.')),
      },
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            paddingTop: insets.top + space(3),
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: space(3),
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text variant="h2">New exception</Text>
          <Button
            size="icon"
            variant="ghost"
            accessibilityLabel="Close"
            onPress={onClose}
            icon={<Feather name="x" size={22} color={colors.foreground} />}
          />
        </View>

        <KeyboardAwareScrollViewCompat
          contentContainerStyle={{
            paddingHorizontal: SCREEN_PADDING,
            paddingBottom: insets.bottom + space(24),
            gap: space(4),
          }}
        >
          <Field label="Type">
            <Segmented
              options={[
                { value: AvailabilityExceptionDraftKind.block, label: 'Block' },
                {
                  value: AvailabilityExceptionDraftKind.vacation,
                  label: 'Vacation',
                },
                { value: AvailabilityExceptionDraftKind.extra, label: 'Extra' },
              ]}
              value={kind}
              onChange={setKind}
            />
          </Field>

          <Card
            variant="flat"
            style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}
          >
            <Feather name="info" size={16} color={colors.mutedForeground} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {EXCEPTION_KIND_INFO[kind].description}
            </Text>
          </Card>

          <View style={{ flexDirection: 'row', gap: space(3) }}>
            <View style={{ flex: 1 }}>
              <Field label="Start date" required>
                <Input
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-01-15"
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="End date" hint="Same day if empty">
                <Input
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-01-16"
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />
              </Field>
            </View>
          </View>

          {usesTime ? (
            <View style={{ flexDirection: 'row', gap: space(3) }}>
              <View style={{ flex: 1 }}>
                <Field label="From" hint="Optional — all day if empty">
                  <Input
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="13:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="To">
                  <Input
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="15:00"
                    keyboardType="numbers-and-punctuation"
                  />
                </Field>
              </View>
            </View>
          ) : null}

          <Field label="Note" hint="Only you see this.">
            <Textarea
              value={note}
              onChangeText={setNote}
              rows={2}
              placeholder="Conference, day off…"
            />
          </Field>

          <Text variant="caption" tone="muted">
            All times are in your zone{timezone ? ` (${zoneCity(timezone)})` : ''}.
          </Text>

          {error ? (
            <Text variant="small" tone="destructive">
              {error}
            </Text>
          ) : null}

          <Button
            title="Save exception"
            fullWidth
            onPress={submit}
            loading={create.isPending}
          />
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

export default function ManageAvailabilityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const availabilityQuery = useGetMyAvailability();
  const exceptionsQuery = useListAvailabilityExceptions();
  const updateSchedule = useUpdateMyAvailability();

  const [week, setWeek] = useState<WeekMap>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exceptionVisible, setExceptionVisible] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const schedule = availabilityQuery.data;
  const timezone = schedule?.timezone ?? '';

  useEffect(() => {
    if (schedule && !initializedRef.current) {
      initializedRef.current = true;
      setWeek(rulesToWeek(schedule.rules));
    }
  }, [schedule]);

  const dayErrors = useMemo(() => {
    const map: Record<number, (string | undefined)[]> = {};
    for (const d of WEEKDAYS) {
      map[d.day] = validateDay(week[d.day] ?? []);
    }
    return map;
  }, [week]);

  const hasErrors = useMemo(
    () =>
      Object.values(dayErrors).some((errs) => errs.some((e) => e !== undefined)),
    [dayErrors],
  );

  const addWindow = (day: number) => {
    setWeek((prev) => {
      const existing = prev[day] ?? [];
      const last = existing[existing.length - 1];
      const startMinute = last ? Math.min(last.endMinute + 60, 22 * 60) : 9 * 60;
      const endMinute = Math.min(startMinute + 60, 24 * 60);
      return { ...prev, [day]: [...existing, { startMinute, endMinute }] };
    });
  };

  const updateWindow = (day: number, index: number, next: Window) => {
    setWeek((prev) => {
      const copy = [...(prev[day] ?? [])];
      copy[index] = next;
      return { ...prev, [day]: copy };
    });
  };

  const removeWindow = (day: number, index: number) => {
    setWeek((prev) => {
      const copy = [...(prev[day] ?? [])];
      copy.splice(index, 1);
      return { ...prev, [day]: copy };
    });
  };

  const saveSchedule = () => {
    if (!schedule) return;
    setSaveError(null);
    if (hasErrors) {
      setSaveError('Fix the highlighted hours before saving.');
      return;
    }
    const body: AvailabilitySchedule = {
      timezone: schedule.timezone,
      rules: weekToRules(week),
    };
    updateSchedule.mutate(
      { data: body },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMyAvailabilityQueryKey(), updated);
        },
        onError: (err) =>
          setSaveError(errorMessage(err, 'Could not save your hours.')),
      },
    );
  };

  const onExceptionSaved = () => {
    setExceptionVisible(false);
    void queryClient.invalidateQueries({
      queryKey: getListAvailabilityExceptionsQueryKey(),
    });
  };

  const confirmDeleteException = async (exception: AvailabilityException) => {
    const ok = await confirm({
      title: 'Remove this exception?',
      message: 'Your usual hours will apply again.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(exception.id);
    deleteException.mutate(
      { exceptionId: exception.id },
      {
        onSuccess: () => {
          setDeletingId(null);
          void queryClient.invalidateQueries({
            queryKey: getListAvailabilityExceptionsQueryKey(),
          });
        },
        onError: (err) => {
          setDeletingId(null);
          void notify('Could not remove', errorMessage(err, 'Please try again.'));
        },
      },
    );
  };

  const deleteException = useDeleteAvailabilityException();

  if (availabilityQuery.isLoading) {
    return <LoadingState label="Loading your hours…" />;
  }

  if (availabilityQuery.isError || !schedule) {
    return (
      <View style={{ flex: 1, padding: SCREEN_PADDING, gap: space(3) }}>
        <Text variant="small" tone="muted">
          {errorMessage(
            availabilityQuery.error,
            'We could not load your availability.',
          )}
        </Text>
        <Button
          title="Try again"
          variant="outline"
          size="sm"
          onPress={() => void availabilityQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <>
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: SCREEN_PADDING,
          paddingBottom: insets.bottom + space(28),
          gap: space(5),
        }}
      >
        <Card
          variant="flat"
          style={{ flexDirection: 'row', gap: space(2), alignItems: 'center' }}
        >
          <Feather name="globe" size={18} color={colors.primary} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            Hours are in your time zone
            {timezone ? ` (${zoneCity(timezone)})` : ''}. Clients always see
            times converted to their own.
          </Text>
        </Card>

        <View style={{ gap: space(3) }}>
          <SectionTitle title="Weekly hours" />
          {WEEKDAYS.map(({ day, label }) => {
            const windows = week[day] ?? [];
            const errs = dayErrors[day] ?? [];
            return (
              <Card key={day} style={{ gap: space(3) }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text variant="title">{label}</Text>
                  {windows.length === 0 ? (
                    <Text variant="caption" tone="muted">
                      Unavailable
                    </Text>
                  ) : (
                    <Text variant="caption" tone="muted">
                      {windows.length} window{windows.length > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                {windows.map((win, index) => (
                  <WindowRow
                    key={index}
                    window={win}
                    error={errs[index]}
                    onChange={(next) => updateWindow(day, index, next)}
                    onRemove={() => removeWindow(day, index)}
                  />
                ))}

                <Button
                  title={windows.length === 0 ? 'Add hours' : 'Add another window'}
                  variant="outline"
                  size="sm"
                  onPress={() => addWindow(day)}
                  icon={<Feather name="plus" size={15} color={colors.foreground} />}
                />
              </Card>
            );
          })}
        </View>

        {saveError ? (
          <Text variant="small" tone="destructive">
            {saveError}
          </Text>
        ) : null}

        <Button
          title="Save weekly hours"
          fullWidth
          onPress={saveSchedule}
          loading={updateSchedule.isPending}
          disabled={hasErrors}
        />

        <View style={{ gap: space(3) }}>
          <SectionTitle
            title="Exceptions"
            action={
              <Button
                title="Add"
                size="sm"
                variant="outline"
                onPress={() => setExceptionVisible(true)}
                icon={<Feather name="plus" size={15} color={colors.foreground} />}
              />
            }
          />
          <Text variant="caption" tone="muted">
            One-off changes: block time, take a vacation, or open extra hours.
          </Text>

          {exceptionsQuery.isError ? (
            <Card variant="outline" style={{ gap: space(3), alignItems: 'flex-start' }}>
              <Text variant="small" tone="muted">
                {errorMessage(
                  exceptionsQuery.error,
                  'Could not load exceptions.',
                )}
              </Text>
              <Button
                title="Try again"
                variant="outline"
                size="sm"
                onPress={() => void exceptionsQuery.refetch()}
              />
            </Card>
          ) : exceptionsQuery.data && exceptionsQuery.data.length > 0 ? (
            <View style={{ gap: space(3) }}>
              {exceptionsQuery.data.map((exception) => {
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
                  <Card key={exception.id} style={{ gap: space(2) }}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: space(2),
                      }}
                    >
                      <Badge
                        label={info.label}
                        variant={info.variant}
                        size="sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        accessibilityLabel="Remove exception"
                        onPress={() => confirmDeleteException(exception)}
                        loading={deletingId === exception.id}
                        icon={
                          <Feather
                            name="trash-2"
                            size={18}
                            color={colors.destructive}
                          />
                        }
                      />
                    </View>
                    <Text variant="bodyStrong">{range}</Text>
                    <Text variant="caption" tone="muted">
                      {timeLabel}
                    </Text>
                    {exception.note ? (
                      <Text variant="small" tone="muted">
                        {exception.note}
                      </Text>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ) : (
            <Card
              variant="flat"
              style={{ alignItems: 'center', gap: space(2), paddingVertical: space(6) }}
            >
              <Feather name="calendar" size={22} color={colors.mutedForeground} />
              <Text variant="small" tone="muted" align="center">
                No exceptions. Your weekly hours apply every week.
              </Text>
            </Card>
          )}
        </View>
      </KeyboardAwareScrollViewCompat>

      <ExceptionEditor
        visible={exceptionVisible}
        timezone={timezone}
        onClose={() => setExceptionVisible(false)}
        onSaved={onExceptionSaved}
      />
    </>
  );
}
