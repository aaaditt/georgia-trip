import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — copy mobile/.env.example to mobile/.env.local and fill them in.'
  );
}

// AsyncStorage's web implementation wraps window.localStorage, which
// doesn't exist during Expo Router's web SSR render pass (that bundle
// evaluates in Node) — crashes with "window is not defined" on module
// load otherwise. Native (iOS/Android, our actual target platforms) never
// hits this branch since `window` is simply never defined there either
// way and AsyncStorage's native implementation doesn't touch it.
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};
const authStorage = typeof window === 'undefined' ? noopStorage : AsyncStorage;

// autoRefreshToken needs an explicit AppState listener on RN (no browser
// tab visibility events here), added in AuthContext.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
