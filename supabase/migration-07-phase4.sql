-- Migration 07 — Phase 4: account deletion + UGC moderation
--
-- Both Apple and Google require in-app account deletion before they'll
-- accept an app with account creation at all, and Apple's Guideline 1.2
-- requires basic moderation (report + block) for any app with
-- user-generated content — comments and notes here. This migration adds
-- the schema for both.
--
-- Run in Supabase Dashboard > SQL Editor, after migration-06. Idempotent —
-- safe to re-run.

-- ============================================================
-- 1. Fix FK delete-behavior so account deletion doesn't get blocked
--
-- migration-06 left several FKs at Postgres's default ON DELETE NO ACTION.
-- That's fine for votes/ratings/comments/calendar_access (already
-- CASCADE — their content should disappear with the account, which is
-- what "delete all data" compliance expects), but trips.created_by,
-- itinerary_items.created_by_member, and place_notes/trip_notes's
-- updated_by_member would make deleting a user who created a trip/event/
-- note throw a foreign-key violation instead of actually deleting them.
-- Switch those specifically to SET NULL: the trip/event/note survives
-- (other trip members are still using it), just loses its "created by"
-- attribution.
-- ============================================================

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_created_by_fkey;
ALTER TABLE trips ADD CONSTRAINT trips_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE trip_invites DROP CONSTRAINT IF EXISTS trip_invites_invited_by_fkey;
ALTER TABLE trip_invites ADD CONSTRAINT trip_invites_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE trip_invites DROP CONSTRAINT IF EXISTS trip_invites_accepted_by_fkey;
ALTER TABLE trip_invites ADD CONSTRAINT trip_invites_accepted_by_fkey
  FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE itinerary_items DROP CONSTRAINT IF EXISTS itinerary_items_created_by_member_fkey;
ALTER TABLE itinerary_items ADD CONSTRAINT itinerary_items_created_by_member_fkey
  FOREIGN KEY (created_by_member) REFERENCES trip_members(id) ON DELETE SET NULL;

ALTER TABLE place_notes DROP CONSTRAINT IF EXISTS place_notes_updated_by_member_fkey;
ALTER TABLE place_notes ADD CONSTRAINT place_notes_updated_by_member_fkey
  FOREIGN KEY (updated_by_member) REFERENCES trip_members(id) ON DELETE SET NULL;

ALTER TABLE trip_notes DROP CONSTRAINT IF EXISTS trip_notes_updated_by_member_fkey;
ALTER TABLE trip_notes ADD CONSTRAINT trip_notes_updated_by_member_fkey
  FOREIGN KEY (updated_by_member) REFERENCES trip_members(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Self-service account deletion
--
-- Deletes the auth.users row directly inside a SECURITY DEFINER function
-- (a common pattern for self-serve deletion without a server-side Admin
-- API call). profiles (ON DELETE CASCADE) and trip_members (ON DELETE
-- CASCADE) — and everything that cascades from trip_members (votes,
-- ratings, comments, calendar_access) — clean up automatically; the FK
-- fixes in §1 keep it from erroring on trips/itinerary/notes the user
-- created. If your Supabase project's `postgres` role ever lacks
-- privileges on the `auth` schema, the fallback is a Supabase Edge
-- Function calling `supabase.auth.admin.deleteUser()` with the service
-- role key (server-side only, never shipped to the client).
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ============================================================
-- 3. UGC moderation — report + block (Apple Guideline 1.2)
-- ============================================================

CREATE TABLE IF NOT EXISTS comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  comment_id INT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reported_by_member UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (comment_id, reported_by_member)
);

CREATE INDEX IF NOT EXISTS comment_reports_trip_id_idx ON comment_reports (trip_id);
CREATE INDEX IF NOT EXISTS comment_reports_comment_id_idx ON comment_reports (comment_id);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members create reports" ON comment_reports;
CREATE POLICY "members create reports" ON comment_reports FOR INSERT TO authenticated
  WITH CHECK (reported_by_member IN (SELECT private.my_member_ids(trip_id)));

DROP POLICY IF EXISTS "admins read reports" ON comment_reports;
CREATE POLICY "admins read reports" ON comment_reports FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_admin(trip_id)));

DROP POLICY IF EXISTS "admins delete reports" ON comment_reports;
CREATE POLICY "admins delete reports" ON comment_reports FOR DELETE TO authenticated
  USING ((SELECT private.is_trip_admin(trip_id)));

-- Per-member blocking: hides a blocked member's content from the
-- blocker's own view (client-side filter) — doesn't require admin
-- involvement, matches Apple's "a way to block abusive users" bar.
CREATE TABLE IF NOT EXISTS blocked_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  blocker_member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  blocked_member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (blocker_member_id, blocked_member_id)
);

CREATE INDEX IF NOT EXISTS blocked_members_trip_id_idx ON blocked_members (trip_id);
CREATE INDEX IF NOT EXISTS blocked_members_blocker_idx ON blocked_members (blocker_member_id);

ALTER TABLE blocked_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members manage own blocks" ON blocked_members;
CREATE POLICY "members manage own blocks" ON blocked_members FOR ALL TO authenticated
  USING (blocker_member_id IN (SELECT private.my_member_ids(trip_id)))
  WITH CHECK (blocker_member_id IN (SELECT private.my_member_ids(trip_id)));
