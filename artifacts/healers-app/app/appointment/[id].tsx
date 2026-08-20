import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAppointmentCalendarFileQueryKey,
  getGetAppointmentQueryKey,
  getGetPractitionerAvailabilityQueryKey,
  getGetPractitionerProfileQueryKey,
  useActOnAppointment,
  useGetAppointment,
  useGetAppointmentCalendarFile,
  useGetPractitionerAvailability,
  useGetPractitionerProfile,
  useOpenConversation,
  type Appointment,
  type AppointmentActionRequestAction,
  type AvailabilitySlot,
} from '@workspace/api-client-react';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  LoadingState,
  Separator,
  Spinner,
  Text,
} from '@workspace/healers-inc/native';

import { ScreenScroll } from '@/components/Screen';
import { StatusBadge } from '@/components/StatusBadge';
import { mediaUrl } from '@/lib/api';
import {
  clockInZone,
  formatCalendarDate,
  formatDuration,
  formatMoney,
  sessionFormatLabel,
  todayIso,
  zoneCity,
} from '@/lib/format';
import { confirm, notify } from '@/lib/dialog';

function errorInfo(error: unknown): { message: string; status?: number } {
  if (error && typeof error === 'object') {
    const e = error as { message?: unknown; status?: unknown };
    return {
      message: e.message ? String(e.message) : 'Something went wrong.',
      status: typeof e.status === 'number' ? e.status : undefined,
    };
  }
  return { message: 'Something went wrong.' };
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space(3), alignItems: 'flex-start' }}>
      <Feather name={icon} size={16} color={colors.mutedForeground} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Reschedule slot picker                                              */
/* ------------------------------------------------------------------ */

function ReschedulePicker({
  appointment,
  onPick,
  onCancel,
  pending,
}: {
  appointment: Appointment;
  onPick: (startsAt: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const { colors } = useTheme();

  // The availability endpoint needs a serviceId; resolve it from the
  // practitioner's public services by matching the service name.
  const profileQuery = useGetPractitionerProfile(appointment.practitioner.id, {
    query: {
      queryKey: getGetPractitionerProfileQueryKey(appointment.practitioner.id),
    },
  });

  const serviceId = useMemo(() => {
    const services = profileQuery.data?.services ?? [];
    return (
      services.find((s) => s.name === appointment.serviceName)?.id ??
      services[0]?.id
    );
  }, [profileQuery.data, appointment.serviceName]);

  const from = todayIso(0, appointment.viewerTimezone);
  const to = todayIso(21, appointment.viewerTimezone);

  const availabilityQuery = useGetPractitionerAvailability(
    {
      practitionerId: appointment.practitioner.id,
      serviceId: serviceId ?? '',
      from,
      to,
      timezone: appointment.viewerTimezone,
    },
    {
      query: {
        enabled: !!serviceId,
        queryKey: getGetPractitionerAvailabilityQueryKey({
          practitionerId: appointment.practitioner.id,
          serviceId: serviceId ?? '',
          from,
          to,
          timezone: appointment.viewerTimezone,
        }),
      },
    },
  );

  const days = (availabilityQuery.data?.days ?? []).filter(
    (d) => d.slots.length > 0,
  );

  const loading = profileQuery.isLoading || availabilityQuery.isLoading;

  return (
    <Card variant="outline">
      <CardContent style={{ gap: space(4), padding: space(4) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Feather name="refresh-cw" size={16} color={colors.primary} />
          <Text variant="title" style={{ flex: 1 }}>
            Pick a new time
          </Text>
          <Button title="Cancel" variant="ghost" size="sm" onPress={onCancel} />
        </View>

        {loading ? (
          <View style={{ paddingVertical: space(6) }}>
            <Spinner />
          </View>
        ) : availabilityQuery.isError ? (
          <View style={{ gap: space(3) }}>
            <Text variant="small" tone="muted">
              {errorInfo(availabilityQuery.error).message}
            </Text>
            <Button
              title="Try again"
              variant="outline"
              size="sm"
              onPress={() => void availabilityQuery.refetch()}
            />
          </View>
        ) : days.length === 0 ? (
          <Text variant="small" tone="muted">
            No open slots in the next three weeks.
          </Text>
        ) : (
          <View style={{ gap: space(4) }}>
            {days.map((day) => (
              <View key={day.date} style={{ gap: space(2) }}>
                <Text variant="label" tone="muted">
                  {formatCalendarDate(day.date)}
                </Text>
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}
                >
                  {day.slots.map((slot: AvailabilitySlot) => (
                    <Pressable
                      key={slot.startsAt}
                      accessibilityRole="button"
                      accessibilityLabel={`Reschedule to ${slot.viewerLabel}`}
                      disabled={pending}
                      onPress={() => onPick(slot.startsAt)}
                      style={({ pressed }) => ({
                        paddingVertical: space(2),
                        paddingHorizontal: space(3),
                        borderRadius: radii.pill,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: pressed
                          ? withAlpha(colors.primary, 0.12)
                          : colors.card,
                        opacity: pending ? 0.5 : 1,
                      })}
                    >
                      <Text variant="label">{slot.viewerLabel}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export default function AppointmentScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointmentId = id ?? '';

  const query = useGetAppointment(appointmentId, {
    query: { enabled: !!appointmentId, queryKey: getGetAppointmentQueryKey(appointmentId) },
  });
  const act = useActOnAppointment();
  const openConversation = useOpenConversation();

  const [rescheduling, setRescheduling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] =
    useState<AppointmentActionRequestAction | null>(null);

  const appointment = query.data;

  const calendarFileQuery = useGetAppointmentCalendarFile(appointmentId, {
    query: {
      enabled: false,
      queryKey: getGetAppointmentCalendarFileQueryKey(appointmentId),
    },
  });

  const runAction = (
    action: AppointmentActionRequestAction,
    extra?: { startsAt?: string; reason?: string },
  ) => {
    setActionError(null);
    setPendingAction(action);
    act.mutate(
      {
        appointmentId,
        data: {
          action,
          startsAt: extra?.startsAt ?? null,
          reason: extra?.reason ?? null,
        },
      },
      {
        onSuccess: (updated) => {
          setPendingAction(null);
          setRescheduling(false);
          queryClient.setQueryData(getGetAppointmentQueryKey(appointmentId), updated);
          queryClient.invalidateQueries();
        },
        onError: (error) => {
          setPendingAction(null);
          const info = errorInfo(error);
          if (info.status === 409) {
            setActionError(
              'This session was just updated by the other party. Refreshing the latest status…',
            );
            void query.refetch();
          } else {
            setActionError(info.message);
          }
        },
      },
    );
  };

  const confirmCancel = async () => {
    if (!appointment) return;
    const late =
      appointment.status === 'confirmed'; // server confirms lateness; warn preemptively
    const ok = await confirm({
      title: 'Cancel session',
      message: late
        ? 'Cancelling a confirmed session close to its start time may count as a late cancellation. Continue?'
        : 'Are you sure you want to cancel this session?',
      confirmLabel: 'Cancel session',
      cancelLabel: 'Keep session',
      destructive: true,
    });
    if (ok) runAction('cancel');
  };

  const confirmDecline = async () => {
    const ok = await confirm({
      title: 'Decline request',
      message: 'Decline this booking request?',
      confirmLabel: 'Decline',
      cancelLabel: 'Back',
      destructive: true,
    });
    if (ok) runAction('decline');
  };

  const handleMessage = () => {
    if (!appointment) return;
    setActionError(null);
    openConversation.mutate(
      { data: { practitionerId: appointment.practitioner.id } },
      {
        onSuccess: (conversation) => {
          router.push(`/conversation/${conversation.id}`);
        },
        onError: (error) => setActionError(errorInfo(error).message),
      },
    );
  };

  const handleAddToCalendar = async () => {
    setActionError(null);
    const result = await calendarFileQuery.refetch();
    const file = result.data;
    if (!file || !appointment) {
      setActionError('Could not load the calendar invite. Please try again.');
      return;
    }
    // File writing / sharing packages aren't available in this build, so we
    // surface the invite details honestly for the person to add manually.
    const details = [
      appointment.serviceName,
      `${appointment.viewerLabel} (${zoneCity(appointment.viewerTimezone)})`,
      `With ${counterpart.fullName}`,
      `Duration: ${formatDuration(appointment.serviceDurationMinutes)}`,
    ].join('\n');
    await notify('Add to your calendar', details);
  };

  if (query.isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Session' }} />
        <LoadingState label="Loading session" />
      </>
    );
  }

  if (query.isError || !appointment) {
    return (
      <>
        <Stack.Screen options={{ title: 'Session' }} />
        <View style={{ flex: 1, justifyContent: 'center', padding: space(6), gap: space(4) }}>
          <Text variant="body" tone="muted" align="center">
            {errorInfo(query.error).message}
          </Text>
          <Button
            title="Try again"
            variant="outline"
            onPress={() => void query.refetch()}
          />
        </View>
      </>
    );
  }

  const counterpart =
    appointment.viewerRole === 'client'
      ? appointment.practitioner
      : appointment.client;
  const isPractitioner = appointment.viewerRole === 'practitioner';
  const showBothZones =
    appointment.clientTimezone !== appointment.practitionerTimezone;
  const isPast = new Date(appointment.endsAt).getTime() < Date.now();

  const canAcceptDecline = isPractitioner && appointment.status === 'pending';
  const canCancel =
    (appointment.status === 'pending' || appointment.status === 'confirmed') &&
    !isPast;
  const canReschedule =
    (appointment.status === 'pending' || appointment.status === 'confirmed') &&
    !isPast;
  const canComplete =
    isPractitioner && appointment.status === 'confirmed' && isPast;
  const canReview =
    !isPractitioner && appointment.canReview && !appointment.hasReview;

  const busy = act.isPending;

  return (
    <>
      <Stack.Screen options={{ title: 'Session details' }} />
      <ScreenScroll
        edges={false}
        onRefresh={() => void query.refetch()}
        refreshing={query.isRefetching}
      >
        {/* Header identity */}
        <Card>
          <CardContent style={{ gap: space(4), padding: space(4) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
              <Avatar
                uri={mediaUrl(counterpart.avatarUrl)}
                name={counterpart.fullName}
                size={56}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="h3" numberOfLines={1}>
                  {counterpart.fullName}
                </Text>
                {counterpart.headline ? (
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {counterpart.headline}
                  </Text>
                ) : null}
              </View>
              <StatusBadge status={appointment.status} />
            </View>
            {appointment.cancelledLate ? (
              <Badge label="Late cancellation" variant="destructive" size="sm" />
            ) : null}
          </CardContent>
        </Card>

        {/* When */}
        <Card>
          <CardContent style={{ gap: space(4), padding: space(4) }}>
            <InfoRow
              icon="calendar"
              label={`Your time (${zoneCity(appointment.viewerTimezone)})`}
              value={appointment.viewerLabel}
            />
            {showBothZones ? (
              <InfoRow
                icon="globe"
                label={`${counterpart.fullName.split(' ')[0]}'s time (${zoneCity(
                  appointment.viewerRole === 'client'
                    ? appointment.practitionerTimezone
                    : appointment.clientTimezone,
                )})`}
                value={appointment.counterpartLabel}
              />
            ) : null}
            <Separator />
            <InfoRow
              icon="clock"
              label="Duration"
              value={`${formatDuration(appointment.serviceDurationMinutes)} · ends ${clockInZone(
                appointment.endsAt,
                appointment.viewerTimezone,
              )}`}
            />
          </CardContent>
        </Card>

        {/* Service */}
        <Card>
          <CardContent style={{ gap: space(4), padding: space(4) }}>
            <InfoRow
              icon="bookmark"
              label="Service"
              value={appointment.serviceName}
            />
            <InfoRow
              icon="video"
              label="Format"
              value={sessionFormatLabel[appointment.serviceFormat]}
            />
            <InfoRow
              icon="tag"
              label="Price"
              value={`${formatMoney(
                appointment.servicePriceCents,
                appointment.serviceCurrency,
              )} (informational)`}
            />
          </CardContent>
        </Card>

        {/* Notes / cancellation reason */}
        {appointment.clientNotes ? (
          <Card>
            <CardContent style={{ gap: space(2), padding: space(4) }}>
              <Text variant="label" tone="muted">
                CLIENT NOTES
              </Text>
              <Text variant="body">{appointment.clientNotes}</Text>
            </CardContent>
          </Card>
        ) : null}

        {appointment.cancellationReason ? (
          <Card>
            <CardContent style={{ gap: space(2), padding: space(4) }}>
              <Text variant="label" tone="muted">
                CANCELLATION REASON
              </Text>
              <Text variant="body">{appointment.cancellationReason}</Text>
            </CardContent>
          </Card>
        ) : null}

        {/* Reschedule picker */}
        {rescheduling ? (
          <ReschedulePicker
            appointment={appointment}
            pending={busy}
            onCancel={() => setRescheduling(false)}
            onPick={(startsAt) => runAction('reschedule', { startsAt })}
          />
        ) : null}

        {actionError ? (
          <View
            style={{
              backgroundColor: withAlpha(colors.destructive, 0.1),
              padding: space(3),
              borderRadius: radii.md,
            }}
          >
            <Text variant="small" tone="destructive">
              {actionError}
            </Text>
          </View>
        ) : null}

        {/* Primary actions */}
        <View style={{ gap: space(3) }}>
          {canAcceptDecline ? (
            <>
              <Button
                title="Accept request"
                fullWidth
                loading={busy && pendingAction === 'accept'}
                disabled={busy}
                onPress={() => runAction('accept')}
              />
              <Button
                title="Decline"
                variant="destructive"
                fullWidth
                loading={busy && pendingAction === 'decline'}
                disabled={busy}
                onPress={confirmDecline}
              />
            </>
          ) : null}

          {canComplete ? (
            <Button
              title="Mark as completed"
              fullWidth
              loading={busy && pendingAction === 'complete'}
              disabled={busy}
              onPress={() => runAction('complete')}
            />
          ) : null}

          {canReview ? (
            <Button
              title="Leave a review"
              fullWidth
              icon={<Feather name="star" size={16} color={colors.primaryForeground} />}
              onPress={() => router.push(`/review/${appointment.id}`)}
            />
          ) : null}

          {canReschedule && !rescheduling ? (
            <Button
              title="Reschedule"
              variant="outline"
              fullWidth
              disabled={busy}
              icon={<Feather name="refresh-cw" size={16} color={colors.foreground} />}
              onPress={() => setRescheduling(true)}
            />
          ) : null}

          <Button
            title="Message"
            variant="outline"
            fullWidth
            loading={openConversation.isPending}
            icon={<Feather name="message-circle" size={16} color={colors.foreground} />}
            onPress={handleMessage}
          />

          <Button
            title="Add to calendar"
            variant="ghost"
            fullWidth
            loading={calendarFileQuery.isFetching}
            icon={<Feather name="download" size={16} color={colors.primary} />}
            onPress={() => void handleAddToCalendar()}
          />

          {canCancel ? (
            <Button
              title="Cancel session"
              variant="destructive"
              fullWidth
              loading={busy && pendingAction === 'cancel'}
              disabled={busy}
              onPress={confirmCancel}
            />
          ) : null}
        </View>
      </ScreenScroll>
    </>
  );
}
