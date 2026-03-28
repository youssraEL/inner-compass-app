import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * expo-secure-store adapter for Supabase auth.
 * Stores session tokens in the device keychain (iOS) / Keystore (Android)
 * instead of AsyncStorage, which is plaintext on disk.
 *
 * Note: SecureStore keys must be ≤ 256 chars and only contain [A-Za-z0-9._-].
 * Supabase uses keys like "sb-<projectRef>-auth-token" which are safe.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
