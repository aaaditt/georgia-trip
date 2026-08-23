import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type CommentReport = {
  id: string;
  comment_id: number;
  reason: string | null;
  created_at: string;
  comments: { text: string } | null;
  trip_members: { display_name: string; emoji: string } | null;
};

// Admin-only (RLS: "admins read reports") — the reported-comments queue
// on the admin panel.
export function useCommentReports(tripId: string | null) {
  const [reports, setReports] = useState<CommentReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!tripId) {
      setReports([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('comment_reports')
      .select('*, comments(text), trip_members(display_name, emoji)')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: false });
    if (!error && data) setReports(data as unknown as CommentReport[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    fetchReports();
    if (!tripId) return;
    const channel = supabase
      .channel(`comment-reports-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_reports', filter: `trip_id=eq.${tripId}` },
        () => fetchReports()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports, tripId]);

  return { reports, loading, refetch: fetchReports };
}

export async function dismissReport(reportId: string) {
  // dismiss_report (migration-08) — SECURITY DEFINER RPC, not a direct
  // delete; see that migration's header for why.
  const { error } = await supabase.rpc('dismiss_report', { p_report_id: reportId });
  return { error };
}

export async function reportComment(tripId: string, commentId: number, reporterMemberId: string, reason?: string) {
  // report_comment (migration-08) — SECURITY DEFINER RPC, not a direct
  // upsert; see that migration's header for why.
  const { error } = await supabase.rpc('report_comment', {
    p_trip_id: tripId,
    p_comment_id: commentId,
    p_reporter_member_id: reporterMemberId,
    p_reason: reason ?? null,
  });
  return { error };
}

// Per-member blocking (Apple Guideline 1.2's "a way to block abusive
// users") — hides a blocked member's content from the blocker's own view
// only; it's not a trip-wide ban, which stays an admin action (removing
// someone from trip_members, done from the admin panel).
export function useBlockedMemberIds(tripId: string | null, myMemberId: string | null) {
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchBlocked = useCallback(async () => {
    if (!tripId || !myMemberId) {
      setBlockedIds(new Set());
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('blocked_members')
      .select('blocked_member_id')
      .eq('trip_id', tripId)
      .eq('blocker_member_id', myMemberId);
    if (!error && data) setBlockedIds(new Set(data.map((r) => r.blocked_member_id as string)));
    setLoading(false);
  }, [tripId, myMemberId]);

  useEffect(() => {
    fetchBlocked();
    if (!tripId || !myMemberId) return;
    const channel = supabase
      .channel(`blocked-members-${tripId}-${myMemberId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_members', filter: `blocker_member_id=eq.${myMemberId}` },
        () => fetchBlocked()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBlocked, tripId, myMemberId]);

  return { blockedIds, loading, refetch: fetchBlocked };
}

export async function blockMember(tripId: string, blockerMemberId: string, blockedMemberId: string) {
  // block_member (migration-08) — SECURITY DEFINER RPC, not a direct
  // upsert; see that migration's header for why.
  const { error } = await supabase.rpc('block_member', {
    p_trip_id: tripId,
    p_blocker_member_id: blockerMemberId,
    p_blocked_member_id: blockedMemberId,
  });
  return { error };
}

export async function unblockMember(blockerMemberId: string, blockedMemberId: string) {
  // unblock_member (migration-08) — SECURITY DEFINER RPC, not a direct
  // delete; see that migration's header for why.
  const { error } = await supabase.rpc('unblock_member', {
    p_blocker_member_id: blockerMemberId,
    p_blocked_member_id: blockedMemberId,
  });
  return { error };
}
