/**
 * Native (React Native / Expo) theme for the Healers Inc design system.
 *
 * Web consumes the theme through Tailwind CSS variables in `src/index.css`.
 * Native has no CSS, so this module turns the same portable token object into
 * plain JS values: colors, spacing, radii, typography and shadows.
 *
 * Never hardcode a color or font family in an app screen -- always read it from
 * `useTheme()` / `useColors()` so light and dark mode stay in sync.
 */
import React, {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  Platform,
  useColorScheme,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { tokens } from "../generated/tokens";

export type ColorScheme = "light" | "dark";
/** Same keys in every scheme; values widen to `string` so light and dark unify. */
export type ThemeColors = {
  [K in keyof typeof tokens.color.light]: string;
};

/** Base spacing step (0.25rem in the token file). */
export const SPACING_UNIT = 4;

/** `space(3)` -> 12. Use instead of magic numbers. */
export function space(steps: number): number {
  return steps * SPACING_UNIT;
}

/** Corner radii derived from the token radius (0.75rem = 12). */
export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Registered font names -- these must match `useHealersFonts()`. */
export const fontFamily = {
  regular: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
} as const;

export type TypographyVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "body"
  | "bodyStrong"
  | "small"
  | "label"
  | "caption"
  | "overline";

export const typography: Record<TypographyVariant, TextStyle> = {
  display: {
    fontFamily: fontFamily.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fontFamily.semibold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  h3: {
    fontFamily: fontFamily.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 21,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyStrong: {
    fontFamily: fontFamily.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  small: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: fontFamily.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  overline: {
    fontFamily: fontFamily.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
};

/** Soft elevation used by cards and sheets. */
export function elevation(level: 0 | 1 | 2 | 3): ViewStyle {
  if (level === 0) return {};
  const config = {
    1: { radius: 8, opacity: 0.06, offset: 2, android: 1 },
    2: { radius: 16, opacity: 0.08, offset: 6, android: 3 },
    3: { radius: 28, opacity: 0.12, offset: 12, android: 8 },
  }[level];
  // react-native-web deprecates the `shadow*` props in favour of CSS shadows,
  // so the same token renders through `boxShadow` there.
  if (Platform.OS === "web") {
    return {
      boxShadow: `0px ${config.offset}px ${config.radius}px rgba(11, 10, 8, ${config.opacity})`,
    } as ViewStyle;
  }

  return {
    shadowColor: "#0b0a08",
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.offset },
    elevation: config.android,
  };
}

export type Theme = {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  radii: typeof radii;
  fontFamily: typeof fontFamily;
  typography: typeof typography;
  space: typeof space;
  elevation: typeof elevation;
};

function buildTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    isDark: scheme === "dark",
    colors: tokens.color[scheme],
    radii,
    fontFamily,
    typography,
    space,
    elevation,
  };
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({
  children,
  scheme,
}: {
  children: ReactNode;
  /** Force a scheme. Omit to follow the device setting. */
  scheme?: ColorScheme;
}) {
  const system = useColorScheme();
  const resolved: ColorScheme = scheme ?? (system === "dark" ? "dark" : "light");
  const value = useMemo(() => buildTheme(resolved), [resolved]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Full theme (colors + scales). Works with or without a ThemeProvider. */
export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  const system = useColorScheme();
  const fallbackScheme: ColorScheme = system === "dark" ? "dark" : "light";
  const fallback = useMemo(() => buildTheme(fallbackScheme), [fallbackScheme]);
  return ctx ?? fallback;
}

/** Convenience: alpha-blend a hex token color onto a solid background. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
