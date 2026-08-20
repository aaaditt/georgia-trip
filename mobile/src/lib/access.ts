import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { Experience, Vote } from '@/lib/hooks';

// A person may edit the calendar once they've voted on every place…
export function hasCompletedVoting(votes: Vote[], experiences: Experience[], memberId: string) {
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
      const { error } = await supabase
        .from('calendar_access')
        .upsert({ trip_id: tripId, member_id: memberId }, { onConflict: 'trip_id,member_id' });
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
      const { error } = await supabase
        .from('calendar_access')
        .delete()
        .eq('trip_id', tripId)
        .eq('member_id', memberId);
      if (error) fetchAccess();
      return { error };
    },
    [tripId, fetchAccess]
  );

  return { grantedIds, loading, grantAccess, revokeAccess };
}
