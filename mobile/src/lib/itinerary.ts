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

export function parseDefaultDuration(timeNeeded: string | undefined): number {
  const text = (timeNeeded || '').toLowerCase();
  const snap = (min: number) => Math.max(SLOT_MIN, Math.round(min / SLOT_MIN) * SLOT_MIN);
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

function toDbItem(item: Partial<ItineraryItem> & { tripId: string }) {
  const db: Record<string, unknown> = { trip_id: item.tripId };
  if (item.id !== undefined) db.id = item.id;
  if (item.kind !== undefined) db.kind = item.kind;
  if (item.experienceId !== undefined) db.experience_id = item.experienceId ?? null;
  if (item.transportMode !== undefined) db.transport_mode = item.transportMode ?? null;
  if (item.title !== undefined) db.title = item.title ?? null;
  if (item.notes !== undefined) db.notes = item.notes ?? null;
  if (item.day !== undefined) db.day = item.day;
  if (item.startMin !== undefined) db.start_min = item.startMin;
  if (item.durationMin !== undefined) db.duration_min = item.durationMin;
  if (item.createdByMember !== undefined) db.created_by_member = item.createdByMember ?? null;
  return db;
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
      const { error } = await supabase.from('itinerary_items').insert(toDbItem({ ...withId, tripId }));
      if (error) setItems((prev) => prev.filter((i) => i.id !== withId.id));
      return { error };
    },
    [tripId]
  );

  const updateItem = useCallback(
    async (id: string, patch: Partial<ItineraryItem>) => {
      if (!tripId) return { error: new Error('No active trip') };
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
      const db = toDbItem({ ...patch, tripId });
      delete db.trip_id;
      const { error } = await supabase.from('itinerary_items').update(db).eq('id', id);
      return { error };
    },
    [tripId]
  );

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase.from('itinerary_items').delete().eq('id', id);
    return { error };
  }, []);

  return { items, loading, fetchError, addItem, updateItem, removeItem };
}
