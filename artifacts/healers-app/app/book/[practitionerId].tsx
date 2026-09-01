import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getGetPractitionerAvailabilityQueryKey,
  getGetAppConfigQueryKey,
  getGetPractitionerProfileQueryKey,
  useCreateBooking,
  useGetPractitionerAvailability,
  useGetAppConfig,
  useGetPractitionerProfile,
  type AvailabilitySlot,
  type Service,
} from '@workspace/api-client-react';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  LoadingState,
  Separator,
  Skeleton,
  Text,
  Textarea,
} from '@workspace/healers-inc/native';

import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { SectionTitle } from '@/components/Screen';
import { useSession } from '@/lib/session';
import {
  calendarParts,
  formatCalendarDate,
  formatDuration,
  formatMoney,
  makeIdempotencyKey,
  sessionFormatLabel,
  todayIso,
  zoneCity,
} from '@/lib/format';

/** How many calendar days ahead we ask the API for at once. */
const WINDOW_DAYS = 14;

function errorStatus(err: unknown): number | undefined {
  const e = err as { status?: number };
  return typeof e?.status === 'number' ? e.status : undefined;
}
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  const e = err as { message?: string; error?: string };
  return e?.message || e?.error || fallback;
}

function ServicePicker({
  services,
  currency,
  selectedId,
  onSelect,
}: {
  services: Service[];
  currency: string;
  selectedId: string | null;
  onSelect: (service: Service) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space(2) }}>
      {services.map((service) => {
        const active = service.id === selectedId;
        return (
          <Pressable
            key={service.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${service.name}`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(service)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space(3),
              padding: space(3.5),
              borderRadius: radii.md,
              borderWidth: 1.5,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active
                ? withAlpha(colors.primary, 0.08)
                : colors.card,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="title">{service.name}</Text>
              <Text variant="caption" tone="muted">
                {formatDuration(service.durationMinutes)} ·{' '}
                {sessionFormatLabel[service.format]}
              </Text>
            </View>
            <Text variant="bodyStrong">
              {formatMoney(service.priceCents, service.currency || currency)}
            </Text>
            <Feather
              name={active ? 'check-circle' : 'circle'}
              size={20}
              color={active ? colors.primary : colors.border}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function BookScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const params = useLocalSearchParams<{
    practitionerId: string;
    serviceId?: string;
  }>();
  const practitionerId = String(params.practitionerId);
  const preselectedServiceId = params.serviceId
    ? String(params.serviceId)
    : null;

  const viewerTimezone = user?.timezone ?? 'UTC';
  const appConfigQuery = useGetAppConfig({
    query: { queryKey: getGetAppConfigQueryKey() },
  });

  const profileQuery = useGetPractitionerProfile(practitionerId, {
    query: {
      enabled: !!practitionerId,
      queryKey: getGetPractitionerProfileQueryKey(practitionerId),
    },
  });
  const profile = profileQuery.data;
  const activeServices = useMemo(
    () => (profile?.services ?? []).filter((s) => s.isActive),
    [profile?.services],
  );

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState('');
  const [rangeOffset, setRangeOffset] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // One idempotency key per booking attempt.
  const idempotencyKey = useRef(makeIdempotencyKey());

  // Preselect the service once the profile loads.
  const didPreselect = useRef(false);
  useEffect(() => {
    if (didPreselect.current || activeServices.length === 0) return;
    didPreselect.current = true;
    const match = activeServices.find((s) => s.id === preselectedServiceId);
    setServiceId(match ? match.id : null);
  }, [activeServices, preselectedServiceId]);

  const selectedService = useMemo(
    () => activeServices.find((s) => s.id === serviceId) ?? null,
    [activeServices, serviceId],
  );

  const from = todayIso(rangeOffset, viewerTimezone);
  const to = todayIso(rangeOffset + WINDOW_DAYS, viewerTimezone);

  const availabilityParams = {
    practitionerId,
    serviceId: serviceId ?? '',
    from,
    to,
    timezone: viewerTimezone,
  };
  const availabilityQuery = useGetPractitionerAvailability(availabilityParams, {
    query: {
      enabled: !!serviceId,
      queryKey: getGetPractitionerAvailabilityQueryKey(availabilityParams),
    },
  });

  const calendar = availabilityQuery.data;
  const daysWithSlots = useMemo(
    () => (calendar?.days ?? []).filter((d) => d.slots.length > 0),
    [calendar?.days],
  );

  // Keep the selected day/slot valid as availability changes.
  useEffect(() => {
    if (daysWithSlots.length === 0) {
      setSelectedDate(null);
      setSelectedSlot(null);
      return;
    }
    setSelectedDate((prev) =>
      prev && daysWithSlots.some((d) => d.date === prev)
        ? prev
        : daysWithSlots[0].date,
    );
  }, [daysWithSlots]);

  const activeDay = useMemo(
    () => daysWithSlots.find((d) => d.date === selectedDate) ?? null,
    [daysWithSlots, selectedDate],
  );

  // Drop a stale slot when the day changes.
  useEffect(() => {
    setSelectedSlot((prev) =>
      prev && activeDay?.slots.some((s) => s.startsAt === prev.startsAt)
        ? prev
        : null,
    );
  }, [activeDay]);

  const sameZone = calendar?.sameTimezone ?? true;
  const practitionerTz = calendar?.practitionerTimezone;

  const createBooking = useCreateBooking();

  const canConfirm = !!selectedService && !!selectedSlot;

  const confirm = () => {
    if (!selectedService || !selectedSlot) return;
    setSubmitError(null);
    createBooking.mutate(
      {
        data: {
          practitionerId,
          serviceId: selectedService.id,
          startsAt: selectedSlot.startsAt,
          clientTimezone: viewerTimezone,
          notes: notes.trim() ? notes.trim() : null,
          idempotencyKey: idempotencyKey.current,
        },
      },
      {
        onSuccess: (appointment) => {
          router.replace(`/appointment/${appointment.id}`);
        },
        onError: (err) => {
          // A fresh key so the retry is a new attempt.
          idempotencyKey.current = makeIdempotencyKey();
          if (errorStatus(err) === 409) {
            setSubmitError(
              'That time was just taken. Pick another slot — availability has been refreshed.',
            );
            setSelectedSlot(null);
            void availabilityQuery.refetch();
          } else {
            setSubmitError(errorMessage(err, 'Could not complete the booking.'));
          }
        },
      },
    );
  };

  // ---- Render ----

  if (profileQuery.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Book a session' }} />
        <LoadingState label="Loading services" />
      </View>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Book a session' }} />
        <View style={{ paddingTop: space(12) }}>
          <Empty
            title="Couldn't start booking"
            description="We couldn't load this practitioner's services."
            media={<Feather name="alert-circle" size={26} color={colors.primary} />}
            actionLabel="Retry"
            onAction={() => profileQuery.refetch()}
          />
        </View>
      </View>
    );
  }

  if (activeServices.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack.Screen options={{ title: 'Book a session' }} />
        <View style={{ paddingTop: space(12) }}>
          <Empty
            title="No bookable services"
            description="This practitioner has no services open for booking right now."
            media={<Feather name="calendar" size={26} color={colors.primary} />}
            actionLabel="Back to profile"
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  const instant = profile.policy.instantBooking;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: 'Book a session' }} />

      <KeyboardAwareScrollViewCompat
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: space(5),
          paddingBottom: insets.bottom + space(28),
          gap: space(6),
        }}
      >
        {/* Step 1 — service */}
        <View>
          <SectionTitle title="1 · Choose a service" />
          <ServicePicker
            services={activeServices}
            currency={profile.practitioner.currency}
            selectedId={serviceId}
            onSelect={(s) => {
              setServiceId(s.id);
              setSelectedDate(null);
              setSelectedSlot(null);
              setRangeOffset(0);
            }}
          />
        </View>

        {/* Step 2 — day */}
        {selectedService ? (
          <View>
            <SectionTitle title="2 · Pick a day" />

            {availabilityQuery.isLoading ? (
              <View style={{ flexDirection: 'row', gap: space(2) }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} width={64} height={72} radius={radii.md} />
                ))}
              </View>
            ) : availabilityQuery.isError ? (
              <Card padded variant="flat">
                <View style={{ gap: space(3), alignItems: 'center' }}>
                  <Text variant="small" tone="muted" align="center">
                    Couldn't load availability.
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    title="Retry"
                    onPress={() => availabilityQuery.refetch()}
                  />
                </View>
              </Card>
            ) : daysWithSlots.length === 0 ? (
              <Empty
                title="No open times in this range"
                description={
                  rangeOffset === 0
                    ? 'Nothing available in the next two weeks. Look further ahead?'
                    : 'Still nothing here. Keep looking?'
                }
                media={<Feather name="calendar" size={26} color={colors.primary} />}
                actionLabel="Look further ahead"
                onAction={() => {
                  setRangeOffset((o) => o + WINDOW_DAYS);
                }}
              />
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: space(2), paddingVertical: space(1) }}
                >
                  {daysWithSlots.map((day) => {
                    const active = day.date === selectedDate;
                    const { day: dayNum, weekday } = calendarParts(day.date);
                    return (
                      <Pressable
                        key={day.date}
                        accessibilityRole="button"
                        accessibilityLabel={formatCalendarDate(day.date)}
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelectedDate(day.date)}
                        style={{
                          width: 64,
                          paddingVertical: space(2.5),
                          borderRadius: radii.md,
                          alignItems: 'center',
                          gap: 2,
                          borderWidth: 1.5,
                          borderColor: active ? colors.primary : colors.border,
                          backgroundColor: active
                            ? colors.primary
                            : colors.card,
                        }}
                      >
                        <Text
                          variant="caption"
                          style={{
                            color: active
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          }}
                        >
                          {weekday}
                        </Text>
                        <Text
                          variant="h3"
                          style={{
                            color: active
                              ? colors.primaryForeground
                              : colors.foreground,
                          }}
                        >
                          {dayNum}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={{ marginTop: space(2), alignItems: 'flex-start' }}>
                  <Button
                    size="sm"
                    variant="link"
                    title="Look further ahead"
                    icon={
                      <Feather
                        name="chevron-right"
                        size={16}
                        color={colors.primary}
                      />
                    }
                    onPress={() => setRangeOffset((o) => o + WINDOW_DAYS)}
                  />
                </View>
              </>
            )}
          </View>
        ) : null}

        {/* Step 3 — slot */}
        {selectedService && activeDay ? (
          <View>
            <SectionTitle title="3 · Pick a time" />
            {!sameZone && practitionerTz ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space(2),
                  marginBottom: space(3),
                  padding: space(3),
                  borderRadius: radii.md,
                  backgroundColor: withAlpha(colors.primary, 0.08),
                }}
              >
                <Feather name="globe" size={16} color={colors.primary} />
                <Text variant="caption" style={{ flex: 1 }}>
                  Times show in your zone ({zoneCity(viewerTimezone)}) first, with{' '}
                  {zoneCity(practitionerTz)} for your healer below.
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
              {activeDay.slots.map((slot) => {
                const active = slot.startsAt === selectedSlot?.startsAt;
                return (
                  <Pressable
                    key={slot.startsAt}
                    accessibilityRole="button"
                    accessibilityLabel={`Book ${slot.viewerLabel}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedSlot(slot)}
                    style={{
                      paddingHorizontal: space(3.5),
                      paddingVertical: space(2.5),
                      borderRadius: radii.md,
                      alignItems: 'center',
                      gap: 1,
                      borderWidth: 1.5,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active
                        ? colors.primary
                        : colors.card,
                    }}
                  >
                    <Text
                      variant="bodyStrong"
                      style={{
                        color: active
                          ? colors.primaryForeground
                          : colors.foreground,
                      }}
                    >
                      {slot.viewerLabel}
                    </Text>
                    {!sameZone ? (
                      <Text
                        variant="caption"
                        style={{
                          color: active
                            ? withAlpha(colors.primaryForeground, 0.85)
                            : colors.mutedForeground,
                        }}
                      >
                        {slot.practitionerLabel} their time
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Step 4 — notes */}
        {selectedSlot ? (
          <View>
            <SectionTitle title="4 · Anything to share?" />
            <Field hint="Optional — a note goes to your practitioner with the request.">
              <Textarea
                placeholder="What would you like to focus on?"
                value={notes}
                onChangeText={setNotes}
                numberOfLines={4}
                maxLength={1000}
              />
            </Field>
          </View>
        ) : null}

        {/* Summary */}
        {canConfirm && selectedService && selectedSlot ? (
          <View>
            <SectionTitle title="Review & confirm" />
            <Card padded>
              <View style={{ gap: space(3) }}>
                <SummaryRow label="Service" value={selectedService.name} />
                <Separator />
                <SummaryRow
                  label="Duration"
                  value={formatDuration(selectedService.durationMinutes)}
                />
                <SummaryRow
                  label="Format"
                  value={sessionFormatLabel[selectedService.format]}
                />
                <SummaryRow
                  label="Price"
                  value={formatMoney(
                    selectedService.priceCents,
                    selectedService.currency || profile.practitioner.currency,
                  )}
                  emphasize
                />
                <Separator />
                <SummaryRow
                  label="Date"
                  value={
                    selectedDate ? formatCalendarDate(selectedDate, true) : '—'
                  }
                />
                <SummaryRow
                  label={`Time (${zoneCity(viewerTimezone)})`}
                  value={selectedSlot.viewerLabel}
                  emphasize
                />
                {!sameZone && practitionerTz ? (
                  <SummaryRow
                    label={`Their time (${zoneCity(practitionerTz)})`}
                    value={selectedSlot.practitionerLabel}
                  />
                ) : null}
                <Separator />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space(2),
                  }}
                >
                  <Feather
                    name={instant ? 'zap' : 'clock'}
                    size={16}
                    color={colors.primary}
                  />
                  <Text variant="small" tone="muted" style={{ flex: 1 }}>
                    {instant
                      ? 'Confirmed instantly once you book.'
                      : 'Sent as a request — the practitioner confirms it.'}
                  </Text>
                  <Badge
                    label={instant ? 'Instant' : 'Request'}
                    variant={instant ? 'success' : 'warning'}
                    size="sm"
                  />
                </View>
                 {appConfigQuery.data?.paymentsEnabled ? (
                   <Text variant="small" tone="muted">
                     No payment is taken now. If this practitioner supports in-app
                     payments, payment is requested securely only after the session is
                     accepted and confirmed.
                   </Text>
                 ) : null}
              </View>
            </Card>
          </View>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      {/* Sticky confirm bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: space(5),
          paddingTop: space(3),
          paddingBottom: insets.bottom + space(3),
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: space(2),
        }}
      >
        {submitError ? (
          <Text variant="caption" tone="destructive">
            {submitError}
          </Text>
        ) : null}
        <Button
          title={
            !selectedService
              ? 'Choose a service'
              : !selectedSlot
                ? 'Choose a time'
                : instant
                  ? 'Confirm booking'
                  : 'Send booking request'
          }
          fullWidth
          disabled={!canConfirm}
          loading={createBooking.isPending}
          onPress={confirm}
        />
        {canConfirm && appConfigQuery.data?.paymentsEnabled ? (
          <Text variant="caption" tone="muted" align="center">
            You’ll book first and pay only after confirmation when in-app payment is
            available.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space(4),
      }}
    >
      <Text variant="small" tone="muted">
        {label}
      </Text>
      <Text
        variant={emphasize ? 'bodyStrong' : 'small'}
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  );
}
