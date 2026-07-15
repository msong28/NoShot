import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import { Platform } from 'react-native';
import 'react-native-get-random-values';

/**
 * expo-secure-store can't hold values over ~2048 bytes, and Supabase's
 * session payload (access + refresh token + user metadata) regularly
 * exceeds that. So the session itself lives in AsyncStorage, encrypted
 * with an AES key that's generated per-entry and held in SecureStore.
 * Native-only: SecureStore has no web implementation (see `supabaseAuthStorage`
 * below for the web path).
 */
class LargeSecureStore {
  private async encrypt(key: string, value: string) {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));

    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string) {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) {
      return null;
    }

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));

    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    return await this.decrypt(key, encrypted);
  }

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string) {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}

/**
 * Expo Router's web output renders once server-side (Node.js) before the
 * client takes over, and that pass has no `window`/localStorage. There's no
 * real session to recover during SSR anyway, so it just gets a no-op stub.
 */
class NoopStorage {
  async getItem() {
    return null;
  }
  async removeItem() {}
  async setItem() {}
}

function getAuthStorage() {
  if (Platform.OS === 'web') {
    return typeof window === 'undefined' ? new NoopStorage() : AsyncStorage;
  }
  return new LargeSecureStore();
}

// SecureStore has no web implementation; the browser has no OS keychain
// equivalent, so web falls back to plain AsyncStorage (localStorage),
// same as most web session storage.
const supabaseAuthStorage = getAuthStorage();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
