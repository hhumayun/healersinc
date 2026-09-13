import React from "react";
import { View, type ViewProps } from "react-native";

import { space } from "../../lib/native-theme";
import { Text } from "./text";

export type FieldProps = ViewProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
};

/**
 * Label + control + hint/error wrapper. Mirrors the web `Field` component.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  style,
  ...props
}: FieldProps) {
  return (
    <View {...props} style={[{ gap: space(1.5) }, style]}>
      {label ? (
        <Text variant="label">
          {label}
          {required ? (
            <Text variant="label" tone="destructive">
              {" *"}
            </Text>
          ) : null}
        </Text>
      ) : null}
      {children}
      {error ? (
        <Text variant="caption" tone="destructive">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
