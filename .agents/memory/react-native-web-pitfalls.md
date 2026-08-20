---
name: React Native on web (Expo Router preview)
description: Behaviours that silently differ between a device and the browser preview, and how this project handles them.
---

## Alert is a no-op on react-native-web

`Alert.alert` from react-native does nothing in a browser. Every confirmation
built on it silently "fails" in the Replit preview -- the destructive action
never runs and there is no error.

**Why:** react-native-web ships no Alert implementation. The workspace preview is
the browser, so this is the default environment the user sees.

**How to apply:** route every confirm/notify/choose through a small platform
helper (window.confirm / window.alert on web, Alert.alert on native) instead of
importing Alert into a screen. Grep for `Alert.alert` before shipping.

## shadow* style props are deprecated on web

Elevation helpers must emit `boxShadow` when `Platform.OS === "web"` and the
`shadow*`/`elevation` props otherwise, or the console fills with deprecation
warnings.

## Calendar windows must be built in the account's IANA zone

A `todayIso()` helper that reads the device clock produces the wrong day near
midnight whenever the account zone differs from the device zone -- and the API
interprets `from`/`to` in the account zone. Always pass the zone in.

## An inverted FlatList does not flip in the browser

`inverted` on FlatList renders newest-at-top in react-native-web, so a chat
thread reads backwards even though it is correct on a device -- and nothing
errors, so it only shows up in a browser test.

**Why:** the inversion relies on a transform that react-native-web does not
apply the way the native list does.

**How to apply:** render chat-style lists chronologically (oldest first) and
stick to the bottom yourself -- scrollToEnd on content-size change, disabled
once the reader scrolls up -- instead of relying on `inverted`. Put
"load earlier" in a ListHeaderComponent rather than `onEndReached`.
