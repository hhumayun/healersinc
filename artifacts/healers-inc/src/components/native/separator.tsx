import React from "react";
import { View, type ViewProps } from "react-native";

import { space, useTheme } from "../../lib/native-theme";
import { Text } from "./text";

export function Separator({
  label,
  style,
  ...props
}: ViewProps & { label?: string }) {
  const { colors } = useTheme();
  if (!label) {
    return (
      <View
        {...props}
        style={[{ height: 1, backgroundColor: colors.border }, style]}
      />
    );
  }
  return (
    <View
      {...props}
      style={[
        { flexDirection: "row", alignItems: "center", gap: space(3) },
        style,
      ]}
    >
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
