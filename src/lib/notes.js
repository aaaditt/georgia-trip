"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// One shared, editable note per place (see place_notes in
// supabase/migration-05-notes.sql). Realtime-synced like votes/comments.
export function usePlaceNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from("place_notes")
      .select("*, users(name, emoji)");
    if (!error && data) setNotes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel("place-notes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_notes" },
        () => fetchNotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotes]);

  return { notes, loading, refetch: fetchNotes };
}

export function getPlaceNote(notes, experienceId) {
  return notes.find((n) => n.experience_id === experienceId) || null;
}

export async function upsertPlaceNote(userId, experienceId, text) {
  const { error } = await supabase.from("place_notes").upsert(
    {
      experience_id: experienceId,
      text,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "experience_id" }
  );
  return { error };
}

// Single shared trip-wide scratchpad (trip_notes, id pinned to 1).
export function useTripNote() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchNote = useCallback(async () => {
    const { data, error } = await supabase
      .from("trip_notes")
      .select("*, users(name, emoji)")
      .eq("id", 1)
      .maybeSingle();
    if (!error) setNote(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNote();

    const channel = supabase
      .channel("trip-notes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_notes" },
        () => fetchNote()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNote]);

  return { note, loading, refetch: fetchNote };
}

export async function upsertTripNote(userId, text) {
  const { error } = await supabase.from("trip_notes").upsert(
    { id: 1, text, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  return { error };
}
