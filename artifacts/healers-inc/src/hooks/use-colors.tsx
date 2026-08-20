import { useTheme, type ThemeColors } from "../lib/native-theme";

/**
 * Colors for the active scheme. Shorthand for `useTheme().colors`.
 */
export function useColors(): ThemeColors {
  return useTheme().colors;
}

export type { ThemeColors };
