import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

type MemberRef = { display_name: string; emoji: string } | null;

export type PlaceNote = {
  id: number;
  experience_id: string;
  text: string;
  updated_by_member: string | null;
  updated_at: string;
  trip_members: MemberRef;
};

export type TripNote = {
  id: number;
  trip_id: string;
  text: string;
  updated_by_member: string | null;
  updated_at: string;
  trip_members: MemberRef;
};

const MEMBER_SELECT = '*, trip_members(display_name, emoji)';

// One shared, editable note per place — realtime-synced like votes/comments.
export function usePlaceNotes(tripId: string | null) {
  const [notes, setNotes] = useState<PlaceNote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!tripId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('place_notes').select(MEMBER_SELECT).eq('trip_id', tripId);
    if (!error && data) setNotes(data as PlaceNote[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchNotes();
    if (!tripId) return;
    const channel = supabase
      .channel(`place-notes-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'place_notes', filter: `trip_id=eq.${tripId}` },
        () => fetchNotes()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotes, tripId]);

  return { notes, loading, refetch: fetchNotes };
}

export function getPlaceNote(notes: PlaceNote[], experienceId: string) {
  return notes.find((n) => n.experience_id === experienceId) || null;
}

export async function upsertPlaceNote(tripId: string, memberId: string, experienceId: string, text: string) {
  // upsert_place_note (migration-08) — SECURITY DEFINER RPC, not a direct
  // upsert; see that migration's header for why.
  const { error } = await supabase.rpc('upsert_place_note', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_experience_id: experienceId,
    p_text: text,
  });
  return { error };
}

// Single shared trip-wide scratchpad — one row per trip (trip_id is the
// unique key, see migration-06's trip_notes_trip_id_uidx).
export function useTripNote(tripId: string | null) {
  const [note, setNote] = useState<TripNote | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNote = useCallback(async () => {
    if (!tripId) {
      setNote(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('trip_notes').select(MEMBER_SELECT).eq('trip_id', tripId).maybeSingle();
    if (!error) setNote(data as TripNote | null);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchNote();
    if (!tripId) return;
    const channel = supabase
      .channel(`trip-notes-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_notes', filter: `trip_id=eq.${tripId}` },
        () => fetchNote()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNote, tripId]);

  return { note, loading, refetch: fetchNote };
}

export async function upsertTripNote(tripId: string, memberId: string, text: string) {
  // upsert_trip_note (migration-08) — SECURITY DEFINER RPC, not a direct
  // upsert; see that migration's header for why.
  const { error } = await supabase.rpc('upsert_trip_note', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_text: text,
  });
  return { error };
}
