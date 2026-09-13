import React from "react";
import {
  ActivityIndicator,
  Pressable,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { radii, space, typography, useTheme } from "../../lib/native-theme";
import { Text } from "./text";

export type ButtonVariant =
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive"
  | "link";

export type ButtonSize = "sm" | "default" | "lg" | "icon";

export type ButtonProps = Omit<PressableProps, "style" | "children"> & {
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Rendered before the label. */
  icon?: React.ReactNode;
  /** Rendered after the label. */
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

const sizeStyles: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; fontSize: number }
> = {
  sm: { height: 36, paddingHorizontal: space(3), fontSize: 13 },
  default: { height: 46, paddingHorizontal: space(5), fontSize: 15 },
  lg: { height: 54, paddingHorizontal: space(6), fontSize: 16 },
  icon: { height: 44, paddingHorizontal: 0, fontSize: 15 },
};

export function Button({
  title,
  variant = "default",
  size = "default",
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  const { colors } = useTheme();
  const dims = sizeStyles[size];
  const isDisabled = disabled || loading;

  const palette: Record<
    ButtonVariant,
    { bg: string; fg: string; border?: string }
  > = {
    default: { bg: colors.primary, fg: colors.primaryForeground },
    secondary: { bg: colors.secondary, fg: colors.secondaryForeground },
    outline: {
      bg: "transparent",
      fg: colors.foreground,
      border: colors.input,
    },
    ghost: { bg: "transparent", fg: colors.foreground },
    destructive: { bg: colors.destructive, fg: colors.destructiveForeground },
    link: { bg: "transparent", fg: colors.primary },
  };
  const tone = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === "icon" ? 6 : undefined}
      style={({ pressed }) => [
        {
          height: dims.height,
          minWidth: size === "icon" ? dims.height : undefined,
          paddingHorizontal: dims.paddingHorizontal,
          borderRadius: variant === "link" ? 0 : radii.pill,
          backgroundColor: tone.bg,
          borderWidth: tone.border ? 1 : 0,
          borderColor: tone.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space(2),
          alignSelf: fullWidth ? "stretch" : "flex-start",
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.985 : 1 }],
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone.fg} />
      ) : (
        icon ?? null
      )}
      {title ? (
        <Text
          style={{
            ...typography.title,
            fontSize: dims.fontSize,
            color: tone.fg,
            textDecorationLine: variant === "link" ? "underline" : "none",
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}
      {children}
      {iconRight ? <View>{iconRight}</View> : null}
    </Pressable>
  );
}
