import React from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";

import { radii, typography, useTheme, withAlpha } from "../../lib/native-theme";
import { Text } from "./text";

export type AvatarProps = {
  uri?: string | null;
  name?: string | null;
  size?: number;
  /** Ring color, e.g. to signal availability. */
  ring?: string;
  style?: StyleProp<ViewStyle>;
};

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join("") || "?";
}

export function Avatar({ uri, name, size = 44, ring, style }: AvatarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: withAlpha(colors.primary, 0.16),
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderWidth: ring ? 2 : 0,
          borderColor: ring,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            ...typography.title,
            fontSize: Math.max(11, size * 0.36),
            color: colors.primary,
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}
