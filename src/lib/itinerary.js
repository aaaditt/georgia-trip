"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// Trip window: flights land Aug 3, flying home Aug 16.
export const TRIP_START = "2026-08-03";
export const TRIP_DAYS_COUNT = 14;

export const SLOT_MIN = 30; // grid snaps to half-hour slots
export const DAY_SLOTS = (24 * 60) / SLOT_MIN;

export const TRANSPORT_MODES = [
  { id: "car", emoji: "🚗", label: "Car" },
  { id: "taxi", emoji: "🚕", label: "Taxi" },
  { id: "public", emoji: "🚌", label: "Public transport" },
];

// The 14 trip days as ISO date strings (2026-08-03 … 2026-08-16)
export const TRIP_DAYS = Array.from({ length: TRIP_DAYS_COUNT }, (_, i) => {
  const d = new Date(Date.UTC(2026, 7, 3 + i));
  return d.toISOString().slice(0, 10);
});

export function formatDay(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  return {
    weekday: d.toLocaleDateString("en-GB", { weekday: "short" }),
    date: d.getDate(),
    month: d.toLocaleDateString("en-GB", { month: "short" }),
  };
}

export function formatTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

// Guess a sensible default block length from free-text like
// "2–3 hr", "30–60 min", "half day", "flight 10–30 min".
export function parseDefaultDuration(timeNeeded) {
  const text = (timeNeeded || "").toLowerCase();
  const snap = (min) => Math.max(SLOT_MIN, Math.round(min / SLOT_MIN) * SLOT_MIN);
  if (text.includes("full day")) return 480;
  if (text.includes("half")) return 240;
  const firstNumber = text.match(/\d+(?:\.\d+)?/);
  if (firstNumber) {
    const n = parseFloat(firstNumber[0]);
    if (text.includes("hr") || text.includes("hour")) return snap(n * 60);
    if (text.includes("min")) return snap(n);
  }
  return 60;
}

function mapDbItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    experienceId: row.experience_id,
    transportMode: row.transport_mode,
    title: row.title,
    day: row.day,
    startMin: row.start_min,
    durationMin: row.duration_min,
    createdBy: row.created_by,
  };
}

function toDbItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    experience_id: item.experienceId ?? null,
    transport_mode: item.transportMode ?? null,
    title: item.title ?? null,
    day: item.day,
    start_min: item.startMin,
    duration_min: item.durationMin,
    created_by: item.createdBy ?? null,
  };
}

// Shared itinerary with realtime sync. Mutations update local state
// immediately (so drags don't snap back while the network round-trips)
// and then persist; the realtime refetch reconciles everyone.
export function useItinerary() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const fetchItems = useCallback(async () => {
    const { data, error } = await supabase.from("itinerary_items").select("*");
    if (!error && data) {
      setItems(data.map(mapDbItem));
      setFetchError(null);
    } else if (error) {
      setFetchError(error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel("itinerary-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itinerary_items" },
        () => fetchItems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchItems]);

  const addItem = useCallback(async (item) => {
    const withId = { ...item, id: crypto.randomUUID() };
    setItems((prev) => [...prev, withId]);
    const { error } = await supabase
      .from("itinerary_items")
      .insert(toDbItem(withId));
    if (error) setItems((prev) => prev.filter((i) => i.id !== withId.id));
    return { error };
  }, []);

  const updateItem = useCallback(async (id, patch) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const db = {};
    if (patch.day !== undefined) db.day = patch.day;
    if (patch.startMin !== undefined) db.start_min = patch.startMin;
    if (patch.durationMin !== undefined) db.duration_min = patch.durationMin;
    if (patch.title !== undefined) db.title = patch.title;
    db.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("itinerary_items")
      .update(db)
      .eq("id", id);
    return { error };
  }, []);

  const removeItem = useCallback(async (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    const { error } = await supabase
      .from("itinerary_items")
      .delete()
      .eq("id", id);
    return { error };
  }, []);

  return { items, loading, fetchError, addItem, updateItem, removeItem };
}
