import React from "react";
import { View, type ViewProps } from "react-native";

import { elevation, radii, space, useTheme } from "../../lib/native-theme";
import { Text } from "./text";

export type CardProps = ViewProps & {
  /** `elevated` floats above the background, `flat` sits on it. */
  variant?: "elevated" | "flat" | "outline";
  padded?: boolean;
};

export function Card({
  variant = "elevated",
  padded = true,
  style,
  ...props
}: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: variant === "flat" ? colors.muted : colors.card,
          borderRadius: radii.lg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: colors.border,
          padding: padded ? space(4) : 0,
          overflow: "hidden",
        },
        variant === "elevated" ? elevation(1) : null,
        style,
      ]}
    />
  );
}

export function CardHeader({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ gap: space(1) }, style]} />;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text variant="h3">{children}</Text>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="small" tone="muted">
      {children}
    </Text>
  );
}

export function CardContent({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ gap: space(2) }, style]} />;
}

export function CardFooter({ style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space(2),
          marginTop: space(3),
        },
        style,
      ]}
    />
  );
}
