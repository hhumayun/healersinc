import React from "react";
import { View } from "react-native";

import { radii, space, useTheme, withAlpha } from "../../lib/native-theme";
import { Button } from "./button";
import { Text } from "./text";

export type EmptyProps = {
  title: string;
  description?: string;
  /** Usually an icon element. */
  media?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function Empty({
  title,
  description,
  media,
  actionLabel,
  onAction,
}: EmptyProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: space(3),
        paddingVertical: space(10),
        paddingHorizontal: space(6),
      }}
    >
      {media ? (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radii.pill,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: withAlpha(colors.primary, 0.12),
          }}
        >
          {media}
        </View>
      ) : null}
      <Text variant="h3" align="center">
        {title}
      </Text>
      {description ? (
        <Text variant="small" tone="muted" align="center">
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} size="sm" />
      ) : null}
    </View>
  );
}
