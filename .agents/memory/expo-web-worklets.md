---
name: Expo worklets in the browser preview
description: The Expo browser preview can crash before app render when the optional native Worklets runtime is installed but the app has no animation requirement.
---

## Keep optional Worklets out of browser-first Expo apps unless needed

The optional native animation runtime can crash Expo Router before the browser
preview renders.

**Why:** Expo Router detects and initializes the optional runtime at startup,
before product UI has a chance to render.

**How to apply:** omit it when it is not a product requirement. Preserve
native keyboard usability with React Native's built-in `KeyboardAvoidingView`
and standard scrolling primitives; verify the browser preview and Expo Go
before adding the runtime back.
