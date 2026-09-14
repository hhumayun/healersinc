import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import {
  getGetMyPractitionerProfileQueryKey,
  useGetMyPractitionerProfile,
  useUpdateBookingPolicy,
  type BookingPolicy,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Button,
  Card,
  Field,
  LoadingState,
  Text,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SCREEN_PADDING, SectionTitle } from '@/components/Screen';

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

/** A row of chip choices bound to a numeric policy value. */
function ChoiceRow<T extends number>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <Field label={label} hint={description}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${option.label}`}
              onPress={() => onChange(option.value)}
              style={{
                paddingHorizontal: space(3.5),
                paddingVertical: space(2),
                borderRadius: radii.pill,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : colors.card,
              }}
            >
              <Text
                variant="label"
                style={{
                  color: active ? colors.primaryForeground : colors.foreground,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Field>
  );
}

const BUFFER_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 10, label: '10m' },
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
] as const;

const NOTICE_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 60, label: '1h' },
  { value: 180, label: '3h' },
  { value: 720, label: '12h' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
] as const;

const ADVANCE_OPTIONS = [
  { value: 14, label: '2 weeks' },
  { value: 30, label: '1 month' },
  { value: 60, label: '2 months' },
  { value: 90, label: '3 months' },
  { value: 180, label: '6 months' },
] as const;

const CANCEL_OPTIONS = [
  { value: 0, label: 'Anytime' },
  { value: 12, label: '12h' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '72h' },
] as const;

/** Snap an arbitrary value onto the nearest offered choice. */
function nearest<T extends number>(
  value: number,
  options: readonly { value: T }[],
): T {
  let best = options[0].value;
  let bestDiff = Math.abs(value - best);
  for (const option of options) {
    const diff = Math.abs(value - option.value);
    if (diff < bestDiff) {
      best = option.value;
      bestDiff = diff;
    }
  }
  return best;
}

export default function ManagePolicyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const profileQuery = useGetMyPractitionerProfile();
  const update = useUpdateBookingPolicy();

  const policy = profileQuery.data?.policy;

  const [bufferBefore, setBufferBefore] = useState(0);
  const [bufferAfter, setBufferAfter] = useState(0);
  const [minNotice, setMinNotice] = useState(0);
  const [maxAdvance, setMaxAdvance] = useState(30);
  const [instantBooking, setInstantBooking] = useState(false);
  const [cancellationNotice, setCancellationNotice] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (policy && !initializedRef.current) {
      initializedRef.current = true;
      setBufferBefore(nearest(policy.bufferBeforeMinutes, BUFFER_OPTIONS));
      setBufferAfter(nearest(policy.bufferAfterMinutes, BUFFER_OPTIONS));
      setMinNotice(nearest(policy.minNoticeMinutes, NOTICE_OPTIONS));
      setMaxAdvance(nearest(policy.maxAdvanceDays, ADVANCE_OPTIONS));
      setInstantBooking(policy.instantBooking);
      setCancellationNotice(
        nearest(policy.cancellationNoticeHours, CANCEL_OPTIONS),
      );
    }
  }, [policy]);

  const save = () => {
    setError(null);
    const body: BookingPolicy = {
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      minNoticeMinutes: minNotice,
      maxAdvanceDays: maxAdvance,
      instantBooking,
      cancellationNoticeHours: cancellationNotice,
    };
    update.mutate(
      { data: body },
      {
        onSuccess: (updated) => {
          const key = getGetMyPractitionerProfileQueryKey();
          queryClient.setQueryData(key, (old: unknown) =>
            old && typeof old === 'object'
              ? { ...(old as object), policy: updated }
              : old,
          );
        },
        onError: (err) =>
          setError(errorMessage(err, 'Could not save your booking rules.')),
      },
    );
  };

  if (profileQuery.isLoading) {
    return <LoadingState label="Loading booking rules…" />;
  }

  if (profileQuery.isError || !policy) {
    return (
      <View style={{ flex: 1, padding: SCREEN_PADDING, gap: space(3) }}>
        <Text variant="small" tone="muted">
          {errorMessage(
            profileQuery.error,
            'We could not load your booking rules.',
          )}
        </Text>
        <Button
          title="Try again"
          variant="outline"
          size="sm"
          onPress={() => void profileQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: SCREEN_PADDING,
        paddingBottom: insets.bottom + space(28),
        gap: space(5),
      }}
    >
      <View>
        <SectionTitle title="Confirmation" />
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: instantBooking }}
          accessibilityLabel="Instant booking"
          onPress={() => setInstantBooking((v) => !v)}
        >
          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(3),
              backgroundColor: instantBooking
                ? withAlpha(colors.primary, 0.08)
                : colors.card,
            }}
          >
            <View style={{ flex: 1, gap: space(1) }}>
              <Text variant="title">Instant booking</Text>
              <Text variant="caption" tone="muted">
                {instantBooking
                  ? 'Requests confirm themselves automatically — no approval needed.'
                  : 'You review and accept each request before it is confirmed.'}
              </Text>
            </View>
            <View
              style={{
                width: 52,
                height: 30,
                borderRadius: radii.pill,
                padding: 3,
                justifyContent: 'center',
                backgroundColor: instantBooking
                  ? colors.primary
                  : colors.muted,
                alignItems: instantBooking ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radii.pill,
                  backgroundColor: colors.card,
                }}
              />
            </View>
          </Card>
        </Pressable>
      </View>

      <View style={{ gap: space(4) }}>
        <SectionTitle title="Around each session" />
        <ChoiceRow
          label="Buffer before"
          description="Free time kept before a session so you can prepare."
          options={BUFFER_OPTIONS}
          value={nearest(bufferBefore, BUFFER_OPTIONS)}
          onChange={setBufferBefore}
        />
        <ChoiceRow
          label="Buffer after"
          description="Free time kept after a session to wrap up and reset."
          options={BUFFER_OPTIONS}
          value={nearest(bufferAfter, BUFFER_OPTIONS)}
          onChange={setBufferAfter}
        />
      </View>

      <View style={{ gap: space(4) }}>
        <SectionTitle title="Booking window" />
        <ChoiceRow
          label="Minimum notice"
          description="How far ahead clients must book — blocks last-minute requests."
          options={NOTICE_OPTIONS}
          value={nearest(minNotice, NOTICE_OPTIONS)}
          onChange={setMinNotice}
        />
        <ChoiceRow
          label="Book up to"
          description="How far into the future clients can schedule."
          options={ADVANCE_OPTIONS}
          value={nearest(maxAdvance, ADVANCE_OPTIONS)}
          onChange={setMaxAdvance}
        />
      </View>

      <View style={{ gap: space(4) }}>
        <SectionTitle title="Cancellations" />
        <ChoiceRow
          label="Cancellation notice"
          description="Clients must cancel this far ahead, or it counts as a late cancellation."
          options={CANCEL_OPTIONS}
          value={nearest(cancellationNotice, CANCEL_OPTIONS)}
          onChange={setCancellationNotice}
        />
      </View>

      {error ? (
        <Text variant="small" tone="destructive">
          {error}
        </Text>
      ) : null}

      <Button
        title="Save booking rules"
        fullWidth
        onPress={save}
        loading={update.isPending}
      />
    </KeyboardAwareScrollViewCompat>
  );
}
