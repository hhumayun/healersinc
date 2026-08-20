import React, { type ReactNode } from 'react';

/**
 * The app uses the operating system's standard keyboard behavior. Keeping this
 * wrapper preserves one shared root composition without a worklet runtime,
 * which is incompatible with the browser preview.
 */
export function KeyboardProviderCompat({ children }: { children: ReactNode }) {
  return <>{children}</>;
}