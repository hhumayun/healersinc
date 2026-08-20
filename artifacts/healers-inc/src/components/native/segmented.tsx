import React from "react";
import { Pressable, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";

import { radii, space, typography, useTheme } from "../../lib/native-theme";
import { Text } from "./text";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/** Equal-width segmented control (the native counterpart of a tab bar). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          backgroundColor: colors.muted,
          borderRadius: radii.pill,
          padding: 3,
        },
        style,
      ]}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              paddingVertical: space(2),
              borderRadius: radii.pill,
              alignItems: "center",
              backgroundColor: active ? colors.card : "transparent",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                ...typography.label,
                color: active ? colors.foreground : colors.mutedForeground,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type ChipsProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  /** Tapping the active chip clears the selection. */
  clearable?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Horizontally scrolling filter chips. */
export function Chips<T extends string>({
  options,
  value,
  onChange,
  clearable = true,
  style,
}: ChipsProps<T>) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space(2), paddingHorizontal: space(5) }}
      style={style}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() =>
              onChange(active && clearable ? null : option.value)
            }
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
              style={{
                ...typography.label,
                color: active ? colors.primaryForeground : colors.foreground,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
