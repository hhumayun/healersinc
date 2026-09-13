import React from 'react';
import { Pressable, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { space, useTheme } from '@workspace/healers-inc/lib/native-theme';
import { Text } from '@workspace/healers-inc/native';

import { formatRating } from '@/lib/format';

/** Read-only rating summary: ★ 4.9 (23) */
export function RatingSummary({
  average,
  count,
  size = 14,
}: {
  average?: number | null;
  count?: number;
  size?: number;
}) {
  const { colors } = useTheme();
  const reviews = count ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(1) }}>
      <Feather name="star" size={size} color={colors.primary} />
      <Text variant="label">{formatRating(average, reviews)}</Text>
      {reviews > 0 ? (
        <Text variant="caption" tone="muted">
          ({reviews})
        </Text>
      ) : null}
    </View>
  );
}

/** Five stars, filled to `value`. Tappable when `onChange` is supplied. */
export function StarRating({
  value,
  onChange,
  size = 32,
}: {
  value: number;
  onChange?: (next: number) => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space(2) }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        const icon = (
          <Feather
            name="star"
            size={size}
            color={filled ? colors.primary : colors.border}
            style={filled ? undefined : { opacity: 0.9 }}
          />
        );
        if (!onChange) return <View key={star}>{icon}</View>;
        return (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
            hitSlop={6}
            onPress={() => onChange(star)}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}
