import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { useFonts } from "expo-font";

/**
 * Loads the Healers Inc brand typeface (DM Sans).
 *
 * The registered names match `fontFamily` in `lib/native-theme`, so every
 * native component can reference them directly.
 *
 * Returns `[loaded, error]` -- gate your splash screen on `loaded || !!error`.
 */
export function useHealersFonts(): [boolean, Error | null] {
  return useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
}
