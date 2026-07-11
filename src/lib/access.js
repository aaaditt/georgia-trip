"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// A person may edit the calendar once they've voted on every place…
export function hasCompletedVoting(votes, experiences, userId) {
  return experiences.every((e) =>
    votes.some((v) => v.user_id === userId && v.experience_id === e.id)
  );
}

// …or when the admin granted them an override (calendar_access row).
export function useCalendarAccess() {
  const [grantedIds, setGrantedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);

  const fetchAccess = useCallback(async () => {
    const { data, error } = await supabase
      .from("calendar_access")
      .select("user_id");
    if (!error && data) setGrantedIds(new Set(data.map((r) => r.user_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccess();

    const channel = supabase
      .channel("calendar-access-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_access" },
        () => fetchAccess()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAccess]);

  const grantAccess = useCallback(
    async (userId) => {
      setGrantedIds((prev) => new Set(prev).add(userId));
      const { error } = await supabase
        .from("calendar_access")
        .upsert({ user_id: userId }, { onConflict: "user_id" });
      if (error) fetchAccess();
      return { error };
    },
    [fetchAccess]
  );

  const revokeAccess = useCallback(
    async (userId) => {
      setGrantedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      const { error } = await supabase
        .from("calendar_access")
        .delete()
        .eq("user_id", userId);
      if (error) fetchAccess();
      return { error };
    },
    [fetchAccess]
  );

  return { grantedIds, loading, grantAccess, revokeAccess };
}
