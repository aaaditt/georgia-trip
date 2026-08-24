import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Experience, Vote } from '@/lib/hooks';

/**
 * A person may edit the calendar once they've voted on every place in the
 * trip's shortlisted regions. Callers must pass an already-scoped list —
 * experiencesInSelectedRegions() in lib/hooks.
 *
 * The empty guard matters: Array.every() on [] is true, so a trip with no
 * shortlisted regions would otherwise hand everyone calendar access.
 */
export function hasCompletedVoting(votes: Vote[], experiences: Experience[], memberId: string) {
  if (experiences.length === 0) return false;
  return experiences.every((e) => votes.some((v) => v.member_id === memberId && v.experience_id === e.id));
}

// …or when an admin granted them an override (calendar_access row).
export function useCalendarAccess(tripId: string | null) {
  const [grantedIds, setGrantedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchAccess = useCallback(async () => {
    if (!tripId) {
      setGrantedIds(new Set());
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.from('calendar_access').select('member_id').eq('trip_id', tripId);
    if (!error && data) setGrantedIds(new Set(data.map((r) => r.member_id as string)));
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchAccess();
    if (!tripId) return;
    const channel = supabase
      .channel(`calendar-access-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'calendar_access', filter: `trip_id=eq.${tripId}` },
        () => fetchAccess()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAccess, tripId]);

  const grantAccess = useCallback(
    async (memberId: string) => {
      if (!tripId) return { error: new Error('No active trip') };
      setGrantedIds((prev) => new Set(prev).add(memberId));
      // grant_calendar_access (migration-08) — SECURITY DEFINER RPC, not a
      // direct upsert; see that migration's header for why.
      const { error } = await supabase.rpc('grant_calendar_access', {
        p_trip_id: tripId,
        p_member_id: memberId,
      });
      if (error) fetchAccess();
      return { error };
    },
    [tripId, fetchAccess]
  );

  const revokeAccess = useCallback(
    async (memberId: string) => {
      if (!tripId) return { error: new Error('No active trip') };
      setGrantedIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
      // revoke_calendar_access (migration-08) — SECURITY DEFINER RPC, not
      // a direct delete; see that migration's header for why.
      const { error } = await supabase.rpc('revoke_calendar_access', {
        p_trip_id: tripId,
        p_member_id: memberId,
      });
      if (error) fetchAccess();
      return { error };
    },
    [tripId, fetchAccess]
  );

  return { grantedIds, loading, grantAccess, revokeAccess };
}
