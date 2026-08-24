import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export const SLOT_MIN = 30; // grid snaps to half-hour slots
export const DAY_SLOTS = (24 * 60) / SLOT_MIN;

export const TRANSPORT_MODES = [
  { id: 'car', emoji: '🚗', label: 'Car' },
  { id: 'taxi', emoji: '🚕', label: 'Taxi' },
  { id: 'public', emoji: '🚌', label: 'Public transport' },
] as const;

// Generalized from the web app's hardcoded Georgia-2026 TRIP_DAYS —
// derived from whatever dates the trip creator set (create.tsx), not one
// fixed destination's calendar.
export function tripDays(startDate: string | null, endDate: string | null): string[] {
  if (!startDate || !endDate) return [];
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const days: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export function formatDay(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    date: d.getDate(),
    month: d.toLocaleDateString('en-GB', { month: 'short' }),
  };
}

export function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
}

/**
 * Catalog places carry a real duration_min. Member-added places only have
 * the free-text "2–3 hr" string, so the regex path stays as the fallback.
 */
export function parseDefaultDuration(timeNeeded?: string, durationMin?: number | null): number {
  const snap = (min: number) => Math.max(SLOT_MIN, Math.round(min / SLOT_MIN) * SLOT_MIN);
  if (typeof durationMin === 'number' && durationMin > 0) return snap(durationMin);

  const text = (timeNeeded || '').toLowerCase();
  if (text.includes('full day')) return 480;
  if (text.includes('half')) return 240;
  const firstNumber = text.match(/\d+(?:\.\d+)?/);
  if (firstNumber) {
    const n = parseFloat(firstNumber[0]);
    if (text.includes('hr') || text.includes('hour')) return snap(n * 60);
    if (text.includes('min')) return snap(n);
  }
  return 60;
}

export type ItineraryItem = {
  id: string;
  kind: 'place' | 'transport' | 'custom';
  experienceId: string | null;
  transportMode: string | null;
  title: string | null;
  notes: string | null;
  day: string;
  startMin: number;
  durationMin: number;
  createdByMember: string | null;
};

function mapDbItem(row: any): ItineraryItem {
  return {
    id: row.id,
    kind: row.kind,
    experienceId: row.experience_id,
    transportMode: row.transport_mode,
    title: row.title,
    notes: row.notes,
    day: row.day,
    startMin: row.start_min,
    durationMin: row.duration_min,
    createdByMember: row.created_by_member,
  };
}

// Same optimistic-update shape as the web app's useItinerary: mutate local
// state immediately so drags don't snap back while the network round-trips,
// then persist; realtime reconciles everyone else.
export function useItinerary(tripId: string | null) {
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<unknown>(null);

  const fetchItems = useCallback(async () => {
    if (!tripId) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('itinerary_items').select('*').eq('trip_id', tripId);
    if (!error && data) {
      setItems(data.map(mapDbItem));
      setFetchError(null);
    } else if (error) {
      setFetchError(error);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchItems();
    if (!tripId) return;
    const channel = supabase
      .channel(`itinerary-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itinerary_items', filter: `trip_id=eq.${tripId}` },
        () => fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchItems, tripId]);

  const addItem = useCallback(
    async (item: Omit<ItineraryItem, 'id'>) => {
      if (!tripId) return { error: new Error('No active trip') };
      const withId: ItineraryItem = { ...item, id: crypto.randomUUID() };
      setItems((prev) => [...prev, withId]);
      // add_itinerary_item (migration-08) — SECURITY DEFINER RPC, not a
      // direct insert; see that migration's header for why.
      const { error } = await supabase.rpc('add_itinerary_item', {
        p_id: withId.id,
        p_trip_id: tripId,
        p_kind: withId.kind,
        p_experience_id: withId.experienceId,
        p_transport_mode: withId.transportMode,
        p_title: withId.title,
        p_notes: withId.notes,
        p_day: withId.day,
        p_start_min: withId.startMin,
        p_duration_min: withId.durationMin,
        p_created_by_member: withId.createdByMember,
      });
      if (error) setItems((prev) => prev.filter((i) => i.id !== withId.id));
      return { error };
    },
    [tripId]
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<ItineraryItem>) => {
      if (!tripId) return { error: new Error('No active trip') };
      let merged: ItineraryItem | undefined;
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          merged = { ...i, ...patch };
          return merged;
        })
      );
      if (!merged) return { error: new Error('Item not found') };
      // update_itinerary_item (migration-08) — SECURITY DEFINER RPC, not a
      // direct update; see that migration's header for why. Sends the
      // full merged row rather than a partial patch (the RPC has no
      // NULL-means-"don't touch" sentinel handling).
      const { error } = await supabase.rpc('update_itinerary_item', {
        p_id: id,
        p_day: merged.day,
        p_start_min: merged.startMin,
        p_duration_min: merged.durationMin,
        p_title: merged.title,
        p_notes: merged.notes,
      });
      return { error };
    },
    [tripId]
  );

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    // delete_itinerary_item (migration-08) — SECURITY DEFINER RPC, not a
    // direct delete; see that migration's header for why.
    const { error } = await supabase.rpc('delete_itinerary_item', { p_id: id });
    return { error };
  }, []);

  return { items, loading, fetchError, addItem, updateItem, removeItem };
}
