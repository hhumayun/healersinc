import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Appointment } from '@workspace/api-client-react';
import {
  elevation,
  radii,
  space,
  useTheme,
} from '@workspace/healers-inc/lib/native-theme';
import { Avatar, Text } from '@workspace/healers-inc/native';

import { StatusBadge } from '@/components/StatusBadge';
import { mediaUrl } from '@/lib/api';
import { formatDuration, formatMoney, sessionFormatLabel } from '@/lib/format';

/**
 * One booking, from whichever side is looking at it. `viewerLabel` and
 * `counterpartLabel` are rendered by the API in the right time zones.
 */
export function AppointmentCard({
  appointment,
  onPress,
}: {
  appointment: Appointment;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const counterpart =
    appointment.viewerRole === 'client' ? appointment.practitioner : appointment.client;
  const showBothZones = appointment.clientTimezone !== appointment.practitionerTimezone;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => router.push(`/appointment/${appointment.id}`))}
      style={({ pressed }) => [
        {
          backgroundColor: colors.card,
          borderRadius: radii.lg,
          padding: space(4),
          gap: space(3),
          opacity: pressed ? 0.92 : 1,
        },
        elevation(1),
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Avatar
          uri={mediaUrl(counterpart.avatarUrl)}
          name={counterpart.fullName}
          size={44}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {counterpart.fullName}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {appointment.serviceName}
          </Text>
        </View>
        <StatusBadge status={appointment.status} />
      </View>

      <View style={{ gap: space(1) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text variant="bodyStrong">{appointment.viewerLabel}</Text>
        </View>
        {showBothZones ? (
          <Text variant="caption" tone="muted" style={{ marginLeft: space(6) }}>
            {appointment.counterpartLabel} for {counterpart.fullName.split(' ')[0]}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        <Text variant="caption" tone="muted">
          {formatDuration(appointment.serviceDurationMinutes)}
        </Text>
        <Text variant="caption" tone="muted">
          · {sessionFormatLabel[appointment.serviceFormat]}
        </Text>
        <Text variant="caption" tone="muted">
          ·{' '}
          {formatMoney(appointment.servicePriceCents, appointment.serviceCurrency)}
        </Text>
      </View>
    </Pressable>
  );
}
