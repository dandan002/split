import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getOrCreateProfile, type Profile } from './api';
import { friendlyError } from './errors';
import { isSupabaseConfigured, supabase } from './supabase';

type AuthStatus = 'unconfigured' | 'restoring' | 'signedOut' | 'loadingProfile' | 'ready' | 'profileError';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  setProfile: (profile: Profile) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(isSupabaseConfigured);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
        }
      })
      .finally(() => {
        if (active) {
          setRestoring(false);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) {
        setProfile(null);
        setProfileError(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? null;

  const reloadProfile = useCallback(async () => {
    if (!userId) {
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    try {
      setProfile(await getOrCreateProfile(userId, email));
    } catch (error) {
      setProfileError(friendlyError(error));
    } finally {
      setProfileLoading(false);
    }
  }, [userId, email]);

  useEffect(() => {
    if (userId) {
      void reloadProfile();
    }
  }, [userId, reloadProfile]);

  const signIn = useCallback(async (emailAddress: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailAddress.trim(), password });
    if (error) {
      throw error;
    }
  }, []);

  const signUp = useCallback(async (emailAddress: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: emailAddress.trim(),
      password,
      options: { data: { display_name: displayName.trim() } },
    });
    if (error) {
      throw error;
    }
    return { needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const status: AuthStatus = !isSupabaseConfigured
    ? 'unconfigured'
    : restoring
      ? 'restoring'
      : !session
        ? 'signedOut'
        : profile
          ? 'ready'
          : profileError && !profileLoading
            ? 'profileError'
            : 'loadingProfile';

  const value = useMemo<AuthContextValue>(
    () => ({ status, session, profile, profileError, signIn, signUp, signOut, reloadProfile, setProfile }),
    [status, session, profile, profileError, signIn, signUp, signOut, reloadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}

// For screens that only render once signed in.
export function useCurrentUser() {
  const { session, profile } = useAuth();
  if (!session || !profile) {
    throw new Error('useCurrentUser requires a signed-in user');
  }
  return { userId: session.user.id, email: session.user.email ?? '', profile };
}
