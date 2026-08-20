import React, { type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  radii,
  space,
  useTheme,
  withAlpha,
} from '@workspace/healers-inc/lib/native-theme';
import { Text } from '@workspace/healers-inc/native';

/**
 * Pull a clean, human-readable message out of whatever the API / fetch layer
 * throws. `ApiError` carries the server body on `.data` as `{ error, message }`;
 * fall back to the Error message otherwise.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err && typeof err === 'object') {
    const data = (err as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) return message.trim();
      const error = (data as { error?: unknown }).error;
      if (typeof error === 'string' && error.trim()) return error.trim();
    }
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      // Strip the "HTTP 401 Unauthorized: " prefix the fetch layer adds.
      return message.replace(/^HTTP\s+\d+[^:]*:\s*/i, '').trim();
    }
  }
  return fallback;
}

/** The approved Healers Inc layered-leaf mark, shared by the auth flow. */
export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <Image
      accessibilityLabel="Healers Inc"
      source={require('@/assets/images/healers-logo.png')}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
      }}
    />
  );
}

/** Inline error banner shown under forms on a failed mutation. */
export function ErrorBanner({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(2),
        paddingHorizontal: space(3.5),
        paddingVertical: space(3),
        borderRadius: radii.md,
        backgroundColor: withAlpha(colors.destructive, 0.1),
      }}
      accessibilityLiveRegion="polite"
    >
      <Feather name="alert-circle" size={16} color={colors.destructive} />
      <Text variant="small" tone="destructive" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

/** Muted hint card, e.g. for the dev verification code. */
export function InfoBanner({
  icon = 'info',
  tint,
  children,
}: {
  icon?: keyof typeof Feather.glyphMap;
  tint?: string;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const color = tint ?? colors.primary;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: space(2.5),
        padding: space(3.5),
        borderRadius: radii.md,
        backgroundColor: withAlpha(color, 0.1),
        borderWidth: 1,
        borderColor: withAlpha(color, 0.24),
      }}
    >
      <Feather name={icon} size={16} color={color} style={{ marginTop: space(0.5) }} />
      <View style={{ flex: 1, gap: space(1) }}>{children}</View>
    </View>
  );
}
