import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type Region = {
  id: string;
  name: string;
  icon: string;
  subtitle: string | null;
  sortOrder: number;
  catalogRegionId: string | null;
  summary: string | null;
  whenToGo: string | null;
  gettingThere: string | null;
  baseTowns: string | null;
  isSelected: boolean;
};

export type Experience = {
  id: string;
  regionId: string;
  name: string;
  description: string;
  time: string;
  priceLari: string;
  priceRupee: string;
  priceAED: string;
  tags: string[];
  sortOrder: number;
  catalogPlaceId: string | null;
  hook: string | null;
  tips: string | null;
  bestTime: string | null;
  durationMin: number | null;
  priceGelMin: number | null;
  priceGelMax: number | null;
  nearestTown: string | null;
  lat: number | null;
  lng: number | null;
  kidNote: string | null;
  bookingRequired: boolean;
};

type MemberRef = { display_name: string; emoji: string } | null;

export type Vote = {
  id: number;
  trip_id: string;
  member_id: string;
  experience_id: string;
  vote: 'go' | 'maybe' | 'skip';
  trip_members: MemberRef;
};

export type Rating = {
  id: number;
  trip_id: string;
  member_id: string;
  experience_id: string;
  rating: number;
  trip_members: MemberRef;
};

export type Comment = {
  id: number;
  trip_id: string;
  member_id: string;
  experience_id: string;
  text: string;
  created_at: string;
  trip_members: MemberRef;
};

// Shared fetch-then-realtime-refetch core, scoped to one trip's rows —
// every table in this schema is trip_id-scoped, so this is the one
// pattern every hook below builds on instead of repeating 5 times.
function useTripTable<Row>(
  table: string,
  tripId: string | null,
  select: string,
  orderBy?: { column: string; ascending?: boolean }
) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    if (!tripId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let query = supabase.from(table).select(select).eq('trip_id', tripId);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    const { data, error } = await query;
    if (!error && data) setRows(data as Row[]);
    setLoading(false);
  }, [table, tripId, select, orderBy?.column, orderBy?.ascending]);

  useEffect(() => {
    fetchRows();
    if (!tripId) return;
    const channel = supabase
      .channel(`${table}-${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` },
        () => fetchRows()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRows, table, tripId]);

  return { data: rows, loading, refetch: fetchRows };
}

function mapDbRegion(row: any): Region {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon || '📍',
    subtitle: row.subtitle,
    sortOrder: row.sort_order ?? 0,
    catalogRegionId: row.catalog_region_id ?? null,
    summary: row.summary ?? null,
    whenToGo: row.when_to_go ?? null,
    gettingThere: row.getting_there ?? null,
    baseTowns: row.base_towns ?? null,
    isSelected: row.is_selected ?? false,
  };
}

export function useRegions(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<any>('regions', tripId, '*', {
    column: 'sort_order',
  });
  const regions = useMemo(() => data.map(mapDbRegion), [data]);
  const selectedRegions = useMemo(() => regions.filter((r) => r.isSelected), [regions]);
  const unselectedRegions = useMemo(() => regions.filter((r) => !r.isSelected), [regions]);
  return { regions, selectedRegions, unselectedRegions, loading, refetch };
}

/**
 * Every trip carries the whole Georgia catalog, so "all experiences" is ~113
 * places whether or not the group is going to any of them. Anything that
 * counts progress, nags, or gates has to run over the shortlist instead.
 * Browsing and voting are deliberately NOT scoped — those stay open.
 */
export function experiencesInSelectedRegions(experiences: Experience[], regions: Region[]): Experience[] {
  const selected = new Set(regions.filter((r) => r.isSelected).map((r) => r.id));
  return experiences.filter((e) => selected.has(e.regionId));
}

export async function addRegion({
  tripId,
  name,
  icon,
  subtitle,
}: {
  tripId: string;
  name: string;
  icon?: string;
  subtitle?: string;
}) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
  // add_region (migration-08) — SECURITY DEFINER RPC, not a direct
  // insert; see that migration's header for why.
  const { error } = await supabase.rpc('add_region', {
    p_id: slug,
    p_trip_id: tripId,
    p_name: name.trim(),
    p_icon: icon?.trim() || '📍',
    p_subtitle: subtitle?.trim() || null,
    p_sort_order: 999,
  });
  return { id: slug, error };
}

function mapDbExperience(row: any): Experience {
  return {
    id: row.id,
    regionId: row.region_id,
    name: row.name,
    description: row.description || '',
    time: row.time_needed || '—',
    priceLari: row.price_lari || '—',
    priceRupee: row.price_rupee || '—',
    priceAED: row.price_aed || '—',
    tags: row.tags || [],
    sortOrder: row.sort_order ?? 0,
    catalogPlaceId: row.catalog_place_id ?? null,
    hook: row.hook ?? null,
    tips: row.tips ?? null,
    bestTime: row.best_time ?? null,
    // NUMERIC comes back from PostgREST as a string; INT comes back as a
    // number. Normalise both rather than letting `lat` be a string.
    durationMin: row.duration_min ?? null,
    priceGelMin: row.price_gel_min ?? null,
    priceGelMax: row.price_gel_max ?? null,
    nearestTown: row.nearest_town ?? null,
    lat: row.lat === null || row.lat === undefined ? null : Number(row.lat),
    lng: row.lng === null || row.lng === undefined ? null : Number(row.lng),
    kidNote: row.kid_note ?? null,
    bookingRequired: row.booking_required ?? false,
  };
}

export function useExperiences(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<any>('experiences', tripId, '*', {
    column: 'sort_order',
  });
  return { experiences: data.map(mapDbExperience), loading, refetch };
}

export async function addExperience({
  tripId,
  regionId,
  name,
  description,
  time,
  priceLari,
}: {
  tripId: string;
  regionId: string;
  name: string;
  description?: string;
  time?: string;
  priceLari?: string;
}) {
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36)}`;
  // add_experience (migration-08) — SECURITY DEFINER RPC, not a direct
  // insert; see that migration's header for why.
  const { error } = await supabase.rpc('add_experience', {
    p_id: slug,
    p_trip_id: tripId,
    p_region_id: regionId,
    p_name: name.trim(),
    p_description: description?.trim() || null,
    p_time_needed: time?.trim() || null,
    p_price_lari: priceLari?.trim() || null,
  });
  return { id: slug, error };
}

export type TripMember = {
  id: string;
  display_name: string;
  emoji: string;
  role: 'owner' | 'admin' | 'member';
  member_kind: 'account' | 'managed';
  is_adult: boolean;
  status: 'invited' | 'active' | 'removed';
};

export function useTripMembers(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<TripMember>(
    'trip_members',
    tripId,
    'id, display_name, emoji, role, member_kind, is_adult, status'
  );
  return { members: data.filter((m) => m.status === 'active'), loading, refetch };
}

const MEMBER_SELECT = '*, trip_members(display_name, emoji)';

export function useVotes(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<Vote>('votes', tripId, MEMBER_SELECT);
  return { votes: data, loading, refetch };
}

export function useRatings(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<Rating>('ratings', tripId, MEMBER_SELECT);
  return { ratings: data, loading, refetch };
}

export function useComments(tripId: string | null) {
  const { data, loading, refetch } = useTripTable<Comment>('comments', tripId, MEMBER_SELECT, {
    column: 'created_at',
  });
  return { comments: data, loading, refetch };
}

export async function upsertVote(
  tripId: string,
  memberId: string,
  experienceId: string,
  vote: 'go' | 'maybe' | 'skip'
) {
  // upsert_vote (migration-08) — SECURITY DEFINER RPC, not a direct
  // upsert; see that migration's header for why.
  const { error } = await supabase.rpc('upsert_vote', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_experience_id: experienceId,
    p_vote: vote,
  });
  return { error };
}

export async function upsertRating(tripId: string, memberId: string, experienceId: string, rating: number) {
  const { error } = await supabase.rpc('upsert_rating', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_experience_id: experienceId,
    p_rating: rating,
  });
  return { error };
}

export async function addComment(tripId: string, memberId: string, experienceId: string, text: string) {
  const { error } = await supabase.rpc('add_comment', {
    p_trip_id: tripId,
    p_member_id: memberId,
    p_experience_id: experienceId,
    p_text: text,
  });
  return { error };
}

export async function deleteComment(commentId: number) {
  const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId });
  return { error };
}

// Aggregate helpers
export function getVotesForExperience(votes: Vote[], experienceId: string) {
  return votes.filter((v) => v.experience_id === experienceId);
}

export function getRatingsForExperience(ratings: Rating[], experienceId: string) {
  return ratings.filter((r) => r.experience_id === experienceId);
}

export function getCommentsForExperience(comments: Comment[], experienceId: string) {
  return comments.filter((c) => c.experience_id === experienceId);
}

export function getAverageRating(ratings: Rating[], experienceId: string) {
  const expRatings = getRatingsForExperience(ratings, experienceId);
  if (expRatings.length === 0) return 0;
  return expRatings.reduce((sum, r) => sum + r.rating, 0) / expRatings.length;
}

export function getVoteCounts(votes: Vote[], experienceId: string) {
  const expVotes = getVotesForExperience(votes, experienceId);
  return {
    go: expVotes.filter((v) => v.vote === 'go').length,
    maybe: expVotes.filter((v) => v.vote === 'maybe').length,
    skip: expVotes.filter((v) => v.vote === 'skip').length,
    total: expVotes.length,
  };
}

export function getMemberVote(votes: Vote[], memberId: string, experienceId: string) {
  return votes.find((v) => v.member_id === memberId && v.experience_id === experienceId)?.vote;
}

export function getMemberRating(ratings: Rating[], memberId: string, experienceId: string) {
  return ratings.find((r) => r.member_id === memberId && r.experience_id === experienceId)?.rating;
}
