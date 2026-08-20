import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Where the session token lives.
 *
 * On a device it goes into the OS keychain/keystore through SecureStore, so
 * another app or a filesystem dump cannot read it. SecureStore has no web
 * implementation, so the browser falls back to AsyncStorage (localStorage).
 */
const KEY = 'healers.session.token';

const useSecureStore = Platform.OS !== 'web';

export async function readToken(): Promise<string | null> {
  try {
    if (useSecureStore) return await SecureStore.getItemAsync(KEY);
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string): Promise<void> {
  if (useSecureStore) {
    await SecureStore.setItemAsync(KEY, token);
    return;
  }
  await AsyncStorage.setItem(KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (useSecureStore) {
      await SecureStore.deleteItemAsync(KEY);
      return;
    }
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing to clean up.
  }
}
