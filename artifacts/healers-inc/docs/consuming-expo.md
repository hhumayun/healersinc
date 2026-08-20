# Consuming Healers Inc in Expo apps

Read `artifacts/healers-inc/docs/AGENTS.md` first. React Native does not consume
the web CSS or DOM components. It imports portable tokens, the native theme and
hooks, and native components directly from this package. If the Expo app still
contains scaffolded or existing local theme/hooks/components, also read
`artifacts/healers-inc/docs/migrating-expo.md` before writing UI.

The native layer already exists — use it, do not rebuild it.

## Native theme and fonts

`src/lib/native-theme.tsx` turns the generated tokens into plain JS values
(CSS lengths are converted once, inside this package):

```tsx
import {
  ThemeProvider,
  useTheme,
  radii,
  space,
  typography,
  elevation,
  withAlpha,
} from "@workspace/healers-inc/lib/native-theme";
import { useColors } from "@workspace/healers-inc/hooks/use-colors";
import { useHealersFonts } from "@workspace/healers-inc/hooks/use-fonts";
```

- Wrap the app in `ThemeProvider`; it follows the device color scheme.
- `useTheme()` returns `{ scheme, isDark, colors, radii, fontFamily, typography, space, elevation }`.
  `useColors()` is the shorthand when only colors are needed.
- `space(n)` is `n * 4` px. `radii` exposes `xs | sm | md | lg | xl | pill`.
- `typography` holds the registered variants: `display, h1, h2, h3, title, body,
  bodyStrong, small, label, caption, overline`.
- `elevation(0-3)` returns the shadow style for the platform (`boxShadow` on web,
  `shadow*`/`elevation` on native).
- `withAlpha(hex, alpha)` builds translucent fills from a token color.

The token font is **DM Sans**. `useHealersFonts()` loads
`DMSans_400Regular / 500Medium / 600SemiBold / 700Bold` and returns
`[fontsLoaded, fontError]`. Never pass a CSS family name — use
`useTheme().fontFamily`. Keep the root layout's SplashScreen gating around the
hook's result.

## Native components

Import the whole family from the `native` entry point, or a single file:

```tsx
import { Button, Card, Field, Input, Text } from "@workspace/healers-inc/native";
import { Badge } from "@workspace/healers-inc/components/native/badge";
```

What ships today, in `src/components/native/`:

| Family | Exports / notable props |
| --- | --- |
| text | `Text` — `variant` (typography names), `tone`, `align` |
| button | `Button` — `variant`: default, secondary, outline, ghost, destructive, link; `size`: sm, default, lg, icon; `loading`, `icon` |
| card | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` |
| badge | `Badge` — `variant`: default, secondary, outline, muted, success, warning, destructive; `size` |
| input / textarea | focus ring, optional leading icon and trailing accessory |
| field | `Field` — label, hint and error wiring around any control |
| avatar | `Avatar` — image or initials fallback |
| spinner | `Spinner`, `LoadingState` |
| skeleton | `Skeleton`, `SkeletonList` |
| empty | `Empty` — title, description, optional actions |
| separator | `Separator` |
| segmented | `Segmented`, `Chips` |

These mirror their `src/components/ui/` web counterparts' variant names, sizes,
and state semantics wherever React Native supports them. When a family is
missing, add it here rather than styling one-off views in the app.

Keep product data, navigation, state, and domain compositions in Expo. An
app-specific `PractitionerCard`, for example, stays app-owned but composes the
package's Card, Button, Badge, and typography primitives.

Platform note: React Native's `Alert` is a no-op on react-native-web, so build
confirmations on a cross-platform helper in the app rather than calling `Alert`
directly.

## Dependencies and assets

`react-native`, `expo-font`, and `@expo-google-fonts/dm-sans` are optional peer
dependencies here and real dependencies of the Expo artifact. Metro resolves the
workspace package through pnpm symlinks — do not copy source or token values.
Loose binary assets may still need copying into Expo because Metro does not
watch sibling artifact folders by default.

Set `app.json`'s literal `splash.backgroundColor` from
`tokens.color.light.background` and keep it synchronized when that token changes.

## Verify

Render a `Button` from `@workspace/healers-inc/native`, then run the Expo
typecheck and the development workflow. The import, native theme, and font hook
must resolve before broader screen work begins.
