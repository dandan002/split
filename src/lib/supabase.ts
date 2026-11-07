import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseHost = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).host : '';
  } catch {
    return '';
  }
})();

// createClient throws on an empty URL, so fall back to a placeholder; the app
// shows a configuration screen instead of making requests when unconfigured.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost.invalid',
  isSupabaseConfigured ? supabaseAnonKey : 'unconfigured',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
    },
  },
);

// Only refresh tokens while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web' && isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
