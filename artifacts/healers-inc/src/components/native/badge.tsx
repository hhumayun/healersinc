import React from "react";
import { View, type ViewProps } from "react-native";

import { radii, space, typography, useTheme, withAlpha } from "../../lib/native-theme";
import { Text } from "./text";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "muted"
  | "success"
  | "warning"
  | "destructive";

export type BadgeProps = ViewProps & {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "default";
  icon?: React.ReactNode;
};

export function Badge({
  label,
  variant = "default",
  size = "default",
  icon,
  style,
  ...props
}: BadgeProps) {
  const { colors } = useTheme();

  const palette: Record<BadgeVariant, { bg: string; fg: string; border?: string }> = {
    default: { bg: withAlpha(colors.primary, 0.14), fg: colors.primary },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground },
    outline: { bg: "transparent", fg: colors.foreground, border: colors.border },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
    success: { bg: withAlpha(colors.chart5, 0.16), fg: colors.chart5 },
    warning: { bg: withAlpha(colors.chart4, 0.24), fg: colors.secondaryForeground },
    destructive: {
      bg: withAlpha(colors.destructive, 0.14),
      fg: colors.destructive,
    },
  };
  const tone = palette[variant];

  return (
    <View
      {...props}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space(1),
          alignSelf: "flex-start",
          backgroundColor: tone.bg,
          borderColor: tone.border,
          borderWidth: tone.border ? 1 : 0,
          borderRadius: radii.pill,
          paddingHorizontal: size === "sm" ? space(2) : space(2.5),
          paddingVertical: size === "sm" ? 2 : 4,
        },
        style,
      ]}
    >
      {icon}
      <Text
        style={{
          ...typography.label,
          fontSize: size === "sm" ? 11 : 12,
          color: tone.fg,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
