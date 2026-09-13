import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, type DimensionValue } from "react-native";

import { radii, space, useTheme } from "../../lib/native-theme";

export type SkeletonProps = {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: object;
};

export function Skeleton({
  width = "100%",
  height = 14,
  radius = radii.sm,
  style,
}: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 750,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.muted,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/** A few stacked skeleton cards, for list placeholders. */
export function SkeletonList({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space(3) }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.card,
            borderRadius: radii.lg,
            padding: space(4),
            gap: space(2.5),
          }}
        >
          <Skeleton width="55%" height={16} />
          <Skeleton width="85%" />
          <Skeleton width="40%" />
        </View>
      ))}
    </View>
  );
}
