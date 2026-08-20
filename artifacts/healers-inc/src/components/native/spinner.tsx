import React from "react";
import { ActivityIndicator, View } from "react-native";

import { space, useTheme } from "../../lib/native-theme";
import { Text } from "./text";

export function Spinner({
  size = "small",
  color,
}: {
  size?: "small" | "large";
  color?: string;
}) {
  const { colors } = useTheme();
  return <ActivityIndicator size={size} color={color ?? colors.primary} />;
}

/** Full-area loading state with an optional message. */
export function LoadingState({ label }: { label?: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: space(3),
        padding: space(8),
      }}
    >
      <Spinner size="large" />
      {label ? (
        <Text variant="small" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}
