/* GENERATED FROM tokens.json -- DO NOT EDIT. Run scripts/build-tokens.mjs. */
// Portable design tokens (colors as hex). Web consumes the theme via
// src/index.css; mobile (Expo) and any other platform import this object so the
// whole product shares one source of truth.
export const tokens = {
  "color": {
    "light": {
      "background": "#f7f7f8",
      "foreground": "#1d2130",
      "border": "#e4e4e7",
      "card": "#ffffff",
      "cardForeground": "#1d2130",
      "popover": "#ffffff",
      "popoverForeground": "#1d2130",
      "primary": "#f28500",
      "primaryForeground": "#ffffff",
      "secondary": "#fbd6aa",
      "secondaryForeground": "#6b3d00",
      "muted": "#efeff1",
      "mutedForeground": "#6b7280",
      "accent": "#2379ea",
      "accentForeground": "#ffffff",
      "destructive": "#d6403a",
      "destructiveForeground": "#ffffff",
      "input": "#d6d6db",
      "ring": "#f28500",
      "chart1": "#f28500",
      "chart2": "#2379ea",
      "chart3": "#e0491c",
      "chart4": "#f2bb6b",
      "chart5": "#4c9a6a",
      "sidebar": "#ffffff",
      "sidebarForeground": "#3f4254",
      "sidebarBorder": "#e4e4e7",
      "sidebarPrimary": "#f28500",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#fdeedc",
      "sidebarAccentForeground": "#6b3d00",
      "sidebarRing": "#f28500"
    },
    "dark": {
      "background": "#17140f",
      "foreground": "#f5f1e9",
      "border": "#322c22",
      "card": "#1f1b15",
      "cardForeground": "#f5f1e9",
      "popover": "#1f1b15",
      "popoverForeground": "#f5f1e9",
      "primary": "#f28500",
      "primaryForeground": "#ffffff",
      "secondary": "#3d2c17",
      "secondaryForeground": "#fbd6aa",
      "muted": "#2a251d",
      "mutedForeground": "#a69f92",
      "accent": "#3f8cff",
      "accentForeground": "#ffffff",
      "destructive": "#e5484d",
      "destructiveForeground": "#ffffff",
      "input": "#3a3327",
      "ring": "#f28500",
      "chart1": "#f79422",
      "chart2": "#5c9df5",
      "chart3": "#f2593d",
      "chart4": "#f7c873",
      "chart5": "#6fbf8a",
      "sidebar": "#1c1812",
      "sidebarForeground": "#ede7dc",
      "sidebarBorder": "#322c22",
      "sidebarPrimary": "#f28500",
      "sidebarPrimaryForeground": "#ffffff",
      "sidebarAccent": "#2c2619",
      "sidebarAccentForeground": "#f5f1e9",
      "sidebarRing": "#f28500"
    }
  },
  "fontFamily": {
    "sans": [
      "DM Sans",
      "sans-serif"
    ],
    "serif": [
      "Georgia",
      "serif"
    ],
    "mono": [
      "Menlo",
      "monospace"
    ]
  },
  "radius": "0.75rem",
  "spacing": "0.25rem"
} as const;

export type Tokens = typeof tokens;
export default tokens;
