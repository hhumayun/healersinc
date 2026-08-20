import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import {
  typography,
  useTheme,
  type ThemeColors,
  type TypographyVariant,
} from "../../lib/native-theme";

export type TextTone =
  | "default"
  | "muted"
  | "primary"
  | "accent"
  | "destructive"
  | "inverse"
  | "onPrimary";

const toneToColor = (
  tone: TextTone,
  colors: ThemeColors,
): string => {
  switch (tone) {
    case "muted":
      return colors.mutedForeground;
    case "primary":
      return colors.primary;
    case "accent":
      return colors.accent;
    case "destructive":
      return colors.destructive;
    case "inverse":
      return colors.background;
    case "onPrimary":
      return colors.primaryForeground;
    default:
      return colors.foreground;
  }
};

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: TextTone;
  /** Shorthand for `textAlign`. */
  align?: "left" | "center" | "right";
};

/**
 * Every string in the app should be rendered through this component so the
 * brand typeface and token colors are applied consistently.
 */
export function Text({
  variant = "body",
  tone = "default",
  align,
  style,
  ...props
}: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      {...props}
      style={[
        typography[variant],
        { color: toneToColor(tone, colors) },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

export const Display = (props: Omit<TextProps, "variant">) => (
  <Text variant="display" {...props} />
);
export const Heading = (props: Omit<TextProps, "variant">) => (
  <Text variant="h1" {...props} />
);
export const Subheading = (props: Omit<TextProps, "variant">) => (
  <Text variant="h2" {...props} />
);
export const Caption = (props: Omit<TextProps, "variant">) => (
  <Text variant="caption" tone="muted" {...props} />
);
