import { Alert, Platform } from 'react-native';

/**
 * React Native's `Alert` is a no-op on react-native-web, so any confirmation
 * built directly on it silently does nothing in a browser. These helpers keep
 * the native look on device and fall back to the browser dialogs on web.
 */

type ConfirmOptions = {
  title: string;
  message?: string;
  /** Label of the button that proceeds. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive on native. */
  destructive?: boolean;
};

export function confirm({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    // eslint-disable-next-line no-alert
    return Promise.resolve(
      typeof window === 'undefined' ? false : window.confirm(text),
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** A single-button message. Resolves once the person has acknowledged it. */
export function notify(title: string, message?: string): Promise<void> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    if (typeof window !== 'undefined') window.alert(text);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: () => resolve() }]);
  });
}

type ChoiceOption<T> = {
  label: string;
  value: T;
  destructive?: boolean;
};

/**
 * A short list of actions. On web this degrades to sequential confirms, which
 * is acceptable for the two-option menus we use it for.
 */
export function choose<T>(
  title: string,
  message: string | undefined,
  options: ChoiceOption<T>[],
): Promise<T | null> {
  if (Platform.OS === 'web') {
    return (async () => {
      for (const option of options) {
        const picked = await confirm({
          title,
          message: message ? `${message}\n\n${option.label}?` : `${option.label}?`,
          confirmLabel: option.label,
          cancelLabel: 'Not this one',
          destructive: option.destructive,
        });
        if (picked) return option.value;
      }
      return null;
    })();
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      ...options.map((option) => ({
        text: option.label,
        style: option.destructive ? ('destructive' as const) : ('default' as const),
        onPress: () => resolve(option.value),
      })),
      { text: 'Cancel', style: 'cancel' as const, onPress: () => resolve(null) },
    ]);
  });
}
