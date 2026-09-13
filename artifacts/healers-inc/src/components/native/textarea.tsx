import React from "react";

import { space } from "../../lib/native-theme";
import { Input, type InputProps } from "./input";

export type TextareaProps = InputProps & {
  rows?: number;
};

export function Textarea({ rows = 4, containerStyle, style, ...props }: TextareaProps) {
  return (
    <Input
      multiline
      textAlignVertical="top"
      containerStyle={[
        { alignItems: "flex-start", minHeight: 24 * rows + space(6) },
        containerStyle,
      ]}
      style={[{ minHeight: 24 * rows }, style]}
      {...props}
    />
  );
}
