import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const ACTIVE_TRIP_KEY = 'trip-planner:active-trip-id';

export type TripSummary = {
  id: string;
  name: string;
  destination: string | null;
  cover_emoji: string | null;
};

export type ActiveMember = {
  id: string;
  role: 'owner' | 'admin' | 'member';
  display_name: string;
  emoji: string;
};

type TripContextValue = {
  trips: TripSummary[];
  activeTripId: string | null;
  activeMember: ActiveMember | null;
  loading: boolean;
  setActiveTripId: (tripId: string | null) => void;
  refetchTrips: () => Promise<void>;
};

const TripContext = createContext<TripContextValue | null>(null);

// Supabase's join-table embed typing (trip_members -> trips) isn't worth
// hand-rolling generated DB types for yet at scaffold stage.
type TripMemberRow = { trips: TripSummary | TripSummary[] | null };

export function TripProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(null);
  const [activeMember, setActiveMember] = useState<ActiveMember | null>(null);
  const [loading, setLoading] = useState(true);

  const setActiveTripId = useCallback((tripId: string | null) => {
    setActiveTripIdState(tripId);
    if (tripId) AsyncStorage.setItem(ACTIVE_TRIP_KEY, tripId);
    else AsyncStorage.removeItem(ACTIVE_TRIP_KEY);
  }, []);

  const refetchTrips = useCallback(async () => {
    if (!userId) {
      setTrips([]);
      return;
    }
    const { data, error } = await supabase
      .from('trip_members')
      .select('trips(id, name, destination, cover_emoji)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .overrideTypes<TripMemberRow[], { merge: false }>();
    if (!error && data) {
      setTrips(data.flatMap((row) => (Array.isArray(row.trips) ? row.trips : row.trips ? [row.trips] : [])));
    }
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (!userId) {
        setTrips([]);
        setActiveTripIdState(null);
        setLoading(false);
        return;
      }
      await refetchTrips();
      const stored = await AsyncStorage.getItem(ACTIVE_TRIP_KEY);
      if (!cancelled) {
        setActiveTripIdState(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refetchTrips]);

  useEffect(() => {
    if (!userId || !activeTripId) {
      setActiveMember(null);
      return;
    }
    supabase
      .from('trip_members')
      .select('id, role, display_name, emoji')
      .eq('trip_id', activeTripId)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setActiveMember(data as ActiveMember | null));
  }, [userId, activeTripId]);

  return (
    <TripContext.Provider
      value={{ trips, activeTripId, activeMember, loading, setActiveTripId, refetchTrips }}>
      {children}
    </TripContext.Provider>
  );
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used within TripProvider');
  return ctx;
}
