import React, { useState } from "react";
import {
  Platform,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { radii, space, typography, useTheme, withAlpha } from "../../lib/native-theme";

export type InputProps = TextInputProps & {
  invalid?: boolean;
  /** Rendered inside the field, before the text. */
  icon?: React.ReactNode;
  /** Rendered inside the field, after the text. */
  accessory?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({
  invalid = false,
  icon,
  accessory,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = invalid
    ? colors.destructive
    : focused
      ? colors.ring
      : colors.input;

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space(2),
          minHeight: 48,
          paddingHorizontal: space(3.5),
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor,
          backgroundColor: colors.card,
          ...(Platform.OS === "web"
            ? {
                boxShadow: focused
                  ? `0px 0px 6px ${withAlpha(colors.ring, 0.18)}`
                  : undefined,
              }
            : {
                shadowColor: colors.ring,
                shadowOpacity: focused ? 0.18 : 0,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              }),
        },
        containerStyle,
      ]}
    >
      {icon}
      <TextInput
        placeholderTextColor={withAlpha(colors.mutedForeground, 0.9)}
        selectionColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            flex: 1,
            paddingVertical: space(3),
            color: colors.foreground,
            ...typography.body,
          },
          style,
        ]}
        {...props}
      />
      {accessory}
    </View>
  );
}
