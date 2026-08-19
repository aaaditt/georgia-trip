import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  display_name: string | null;
  emoji: string | null;
  avatar_url: string | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  initializing: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // Supabase's token auto-refresh timer needs a foreground/background
    // nudge on native — there's no browser tab visibility event to drive
    // it like there is on web.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      authSub.subscription.unsubscribe();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('id, display_name, emoji, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session?.user?.id]);

  const signUp: AuthContextValue['signUp'] = async (email, password, displayName) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    // handle_new_auth_user() (migration-06) creates the profiles row with a
    // default name derived from the email; patch in the real display name.
    if (data.user) {
      await supabase.from('profiles').update({ display_name: displayName }).eq('id', data.user.id);
    }
    return { error: null };
  };

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? error.message : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, profile, initializing, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
