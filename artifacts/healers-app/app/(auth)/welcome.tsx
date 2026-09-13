import React from 'react';
import { View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import { Button, Text } from '@workspace/healers-inc/native';

import { Screen } from '@/components/Screen';
import { useSession } from '@/lib/session';
import { BrandMark } from '@/components/AuthShared';

const MODALITIES: { icon: keyof typeof Feather.glyphMap; label: string; tint: number }[] = [
  { icon: 'sun', label: 'Mind', tint: 0 },
  { icon: 'activity', label: 'Body', tint: 1 },
  { icon: 'moon', label: 'Spirit', tint: 2 },
  { icon: 'message-circle', label: 'Psychology', tint: 3 },
];

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { status, user } = useSession();

  if (status === 'authenticated' && (user?.onboardingComplete ?? false)) {
    return <Redirect href="/" />;
  }

  const charts = [colors.chart1, colors.chart2, colors.chart3, colors.chart4];

  return (
    <Screen>
      <View
        style={{
          flex: 1,
          paddingHorizontal: space(6),
          paddingTop: space(10),
          paddingBottom: space(6),
          justifyContent: 'space-between',
        }}
      >
        <View style={{ gap: space(6) }}>
          <View style={{ gap: space(4) }}>
            <BrandMark size={60} />
            <View style={{ gap: space(2) }}>
              <Text variant="overline" tone="primary">
                Healers Inc
              </Text>
              <Text variant="display">Find the care that meets you where you are.</Text>
              <Text variant="body" tone="muted">
                Book trusted practitioners across mind, body, spirit and psychology —
                on your schedule, in your time zone.
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: space(2.5),
            }}
          >
            {MODALITIES.map((m) => (
              <View
                key={m.label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space(2),
                  paddingHorizontal: space(3.5),
                  paddingVertical: space(2.5),
                  borderRadius: radii.pill,
                  backgroundColor: withAlpha(charts[m.tint], 0.12),
                }}
              >
                <Feather name={m.icon} size={16} color={charts[m.tint]} />
                <Text variant="label">{m.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: space(3) }}>
          <Button
            title="Find a practitioner"
            size="lg"
            fullWidth
            iconRight={
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            }
            onPress={() => router.push('/(auth)/sign-up')}
          />
          <Button
            title="Sign in"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => router.push('/(auth)/sign-in')}
          />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space(1.5),
              marginTop: space(1),
            }}
          >
            <Text variant="small" tone="muted">
              Are you a practitioner?
            </Text>
            <Button
              title="Apply to join"
              variant="link"
              size="sm"
              onPress={() => router.push('/(auth)/practitioner-signup')}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}
