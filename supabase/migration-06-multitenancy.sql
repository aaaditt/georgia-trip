-- Migration 06 — Multi-tenant backend (Phase 0)
--
-- Turns this from "one hardcoded Georgia trip, no auth" into a real
-- multi-tenant backend: any authenticated user can create a trip, invite
-- others, and every existing table becomes scoped to a trip_id with real
-- Row Level Security instead of the current "Allow all for anon" policies.
--
-- ⚠️  READ BEFORE RUNNING — THIS IS A BREAKING CHANGE FOR THE CURRENT WEB APP
-- The existing Next.js app (src/lib/supabase.js) talks to Supabase with the
-- anon key and no login at all. Every policy below is scoped `TO
-- authenticated`, so the moment this migration runs, the *current* web app
-- loses read/write access to everything — dashboard, votes, calendar, notes,
-- all of it — until the app is rewritten to sign users in with Supabase Auth
-- (Phase 1+ of the plan). This is expected and intentional (Phase 0 is
-- explicitly backend-first, ahead of the app rewrite), not a bug — but do
-- not run this against the live project if anyone still needs the existing
-- web app to keep working unmodified in the meantime. If you want the old
-- app to stay browsable (read-only) while the rewrite is in progress, add
-- `TO anon` SELECT-only policies alongside these before running — flagged
-- as optional, not included below to keep the intended end-state clean.
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / DROP+
-- CREATE POLICY / ON CONFLICT-safe backfill), so running this twice is a
-- no-op the second time.
--
-- Run in Supabase Dashboard > SQL Editor, after migration-05-notes.sql.

-- Created up front (also re-declared in §2) because §1's invite-attempt
-- throttle table below needs to live in `private` before that section runs.
CREATE SCHEMA IF NOT EXISTS private;

-- ============================================================
-- 1. Core multi-tenant tables
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  emoji TEXT DEFAULT '🧑',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  cover_emoji TEXT DEFAULT '🧳',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per person per trip. Real account holders have user_id set;
-- parent-linked kids (member_kind='managed') never get their own login —
-- see the plan's "Kids' accounts" decision — so user_id stays NULL and
-- managed_by points at the parent's own trip_members row instead.
CREATE TABLE IF NOT EXISTS trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  legacy_user_id INT, -- bridges rows backfilled from the old `users` table below; NULL for anyone who joins post-migration
  display_name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🧑',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  member_kind TEXT NOT NULL DEFAULT 'account' CHECK (member_kind IN ('account', 'managed')),
  managed_by UUID REFERENCES trip_members(id) ON DELETE SET NULL,
  is_adult BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'removed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE (trip_id, user_id)
);

-- gen_random_bytes() below needs pgcrypto — Postgres core's random()/md5()
-- is not a CSPRNG and must not be used to generate anything
-- access-granting (invite codes, tokens, etc).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS trip_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(5), 'hex'),
  email TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trip_members_trip_id_idx ON trip_members (trip_id);
CREATE INDEX IF NOT EXISTS trip_members_user_id_idx ON trip_members (user_id);
CREATE INDEX IF NOT EXISTS trip_members_managed_by_idx ON trip_members (managed_by);
CREATE INDEX IF NOT EXISTS trip_invites_trip_id_idx ON trip_invites (trip_id);
CREATE INDEX IF NOT EXISTS trip_invites_code_idx ON trip_invites (code);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Auto-add the creator as 'owner' whenever a trip is created, atomically.
CREATE OR REPLACE FUNCTION public.handle_new_trip()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name TEXT;
  v_emoji TEXT;
BEGIN
  SELECT display_name, emoji INTO v_name, v_emoji FROM public.profiles WHERE id = NEW.created_by;
  INSERT INTO public.trip_members (trip_id, user_id, display_name, emoji, role, member_kind, status, joined_at)
  VALUES (NEW.id, NEW.created_by, COALESCE(v_name, 'Trip Owner'), COALESCE(v_emoji, '🧑'), 'owner', 'account', 'active', NOW());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_created ON trips;
CREATE TRIGGER on_trip_created
  AFTER INSERT ON trips
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_trip();

-- Failed-attempt log for redeem_trip_invite() below, so guessing codes is
-- throttled per caller — CSPRNG entropy alone isn't enough once an RPC is
-- reachable by any authenticated account with no attempt limit.
CREATE TABLE IF NOT EXISTS private.trip_invite_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trip_invite_attempts_user_time_idx ON private.trip_invite_attempts (user_id, attempted_at);

-- Join-by-code RPC (called from the app as supabase.rpc('redeem_trip_invite', { p_code })).
-- SECURITY DEFINER so an unaffiliated authenticated user can look up an
-- invite by code without a standing SELECT policy on trip_invites; the
-- auth.uid() check happens inside, not via RLS.
CREATE OR REPLACE FUNCTION public.redeem_trip_invite(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_invite public.trip_invites;
  v_profile public.profiles;
  v_recent_failures INT;
BEGIN
  SELECT COUNT(*) INTO v_recent_failures FROM private.trip_invite_attempts
    WHERE user_id = (SELECT auth.uid()) AND attempted_at > NOW() - INTERVAL '10 minutes';
  IF v_recent_failures >= 10 THEN
    RAISE EXCEPTION 'Too many invite attempts — please try again in a few minutes';
  END IF;

  SELECT * INTO v_invite FROM public.trip_invites
    WHERE code = p_code AND accepted_by IS NULL AND (expires_at IS NULL OR expires_at > NOW());
  IF NOT FOUND THEN
    INSERT INTO private.trip_invite_attempts (user_id) VALUES ((SELECT auth.uid()));
    RAISE EXCEPTION 'Invite code invalid or expired';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = (SELECT auth.uid());

  INSERT INTO public.trip_members (trip_id, user_id, display_name, emoji, role, member_kind, status, joined_at)
  VALUES (v_invite.trip_id, (SELECT auth.uid()), COALESCE(v_profile.display_name, 'New member'), COALESCE(v_profile.emoji, '🧑'), v_invite.role, 'account', 'active', NOW())
  ON CONFLICT (trip_id, user_id) DO UPDATE SET status = 'active', joined_at = NOW();

  UPDATE public.trip_invites SET accepted_by = (SELECT auth.uid()), accepted_at = NOW() WHERE id = v_invite.id;

  RETURN v_invite.trip_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_trip_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_trip_invite(TEXT) TO authenticated;

-- ============================================================
-- 2. Access-check helpers (private schema — not exposed via the API,
--    but explicitly revoked/re-granted anyway per Supabase's own
--    SECURITY DEFINER guidance).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_trip_member(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = t_id AND status = 'active'
      AND (
        user_id = (SELECT auth.uid())
        OR managed_by IN (
          SELECT id FROM public.trip_members m2
          WHERE m2.trip_id = t_id AND m2.user_id = (SELECT auth.uid())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION private.is_trip_admin(t_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = t_id AND user_id = (SELECT auth.uid())
      AND role IN ('owner', 'admin') AND status = 'active'
  );
$$;

-- Every trip_members.id the current auth user may act as: their own row,
-- plus any managed (kid) rows they parent. Used to scope "my vote / my
-- comment" writes without letting anyone write as someone else's member row.
CREATE OR REPLACE FUNCTION private.my_member_ids(t_id UUID)
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT id FROM public.trip_members
  WHERE trip_id = t_id
    AND (
      user_id = (SELECT auth.uid())
      OR managed_by IN (
        SELECT id FROM public.trip_members m2
        WHERE m2.trip_id = t_id AND m2.user_id = (SELECT auth.uid())
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION private.is_trip_member(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.is_trip_admin(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.my_member_ids(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_trip_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_trip_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION private.my_member_ids(UUID) TO authenticated;

-- ============================================================
-- 3. RLS for the new tables
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own profile" ON profiles;
CREATE POLICY "read own profile" ON profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "read co-member profiles" ON profiles;
CREATE POLICY "read co-member profiles" ON profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trip_members me JOIN trip_members them ON them.trip_id = me.trip_id
    WHERE me.user_id = (SELECT auth.uid()) AND them.user_id = profiles.id
  ));
DROP POLICY IF EXISTS "update own profile" ON profiles;
CREATE POLICY "update own profile" ON profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "members read trip" ON trips;
CREATE POLICY "members read trip" ON trips FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(id)));
DROP POLICY IF EXISTS "authenticated create trip" ON trips;
CREATE POLICY "authenticated create trip" ON trips FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS "admins update trip" ON trips;
CREATE POLICY "admins update trip" ON trips FOR UPDATE TO authenticated
  USING ((SELECT private.is_trip_admin(id)));
DROP POLICY IF EXISTS "owner deletes trip" ON trips;
CREATE POLICY "owner deletes trip" ON trips FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "members read roster" ON trip_members;
CREATE POLICY "members read roster" ON trip_members FOR SELECT TO authenticated
  USING ((SELECT private.is_trip_member(trip_id)));
DROP POLICY IF EXISTS "admins manage members" ON trip_members;
CREATE POLICY "admins manage members" ON trip_members FOR ALL TO authenticated
  USING ((SELECT private.is_trip_admin(trip_id))) WITH CHECK ((SELECT private.is_trip_admin(trip_id)));

DROP POLICY IF EXISTS "admins manage invites" ON trip_invites;
CREATE POLICY "admins manage invites" ON trip_invites FOR ALL TO authenticated
  USING ((SELECT private.is_trip_admin(trip_id))) WITH CHECK ((SELECT private.is_trip_admin(trip_id)));
-- No SELECT-by-code policy on purpose — joining happens through the
-- redeem_trip_invite() RPC above, not a direct table read.

-- ============================================================
-- 4. Scope every existing table to trip_id (+ member_id where the table
--    tracks "whose row is this"). Additive only — old INT user_id/
--    created_by/updated_by columns are left in place for traceability;
--    dropping them is a follow-up cleanup once the app no longer reads
--    them, not part of this migration.
-- ============================================================

ALTER TABLE regions ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE votes ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES trip_members(id) ON DELETE CASCADE;

ALTER TABLE ratings ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES trip_members(id) ON DELETE CASCADE;

ALTER TABLE comments ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES trip_members(id) ON DELETE CASCADE;

ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS created_by_member UUID REFERENCES trip_members(id);

ALTER TABLE calendar_access ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE calendar_access ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES trip_members(id) ON DELETE CASCADE;

ALTER TABLE place_notes ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE place_notes ADD COLUMN IF NOT EXISTS updated_by_member UUID REFERENCES trip_members(id);

ALTER TABLE trip_notes ADD COLUMN IF NOT EXISTS trip_id UUID REFERENCES trips(id) ON DELETE CASCADE;
ALTER TABLE trip_notes ADD COLUMN IF NOT EXISTS updated_by_member UUID REFERENCES trip_members(id);

-- ============================================================
-- 5. Backfill: wrap the existing Georgia trip + its 8 people into the new
--    model. Re-runnable — skips creating a second trip if "Georgia 2026"
--    already exists, and only fills columns that are still NULL.
-- ============================================================

DO $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT id INTO v_trip_id FROM trips WHERE name = 'Georgia 2026' LIMIT 1;

  IF v_trip_id IS NULL THEN
    INSERT INTO trips (name, destination, start_date, end_date, cover_emoji)
    VALUES ('Georgia 2026', 'Georgia', '2026-08-03', '2026-08-16', '🇬🇪')
    RETURNING id INTO v_trip_id;

    -- Legacy user id 1 (Aadit) becomes owner; adults become 'account' rows
    -- pending real sign-up (user_id NULL, status 'invited' until claimed);
    -- kids become 'managed' rows per the parent-linked-kids decision.
    -- managed_by is left NULL — assign the actual parent via the admin UI
    -- once real accounts exist (Phase 4), this migration doesn't guess it.
    INSERT INTO trip_members (trip_id, legacy_user_id, display_name, emoji, role, member_kind, is_adult, status)
    SELECT
      v_trip_id, u.id, u.name, u.emoji,
      CASE WHEN u.id = 1 THEN 'owner' ELSE 'member' END,
      CASE WHEN u.is_adult THEN 'account' ELSE 'managed' END,
      u.is_adult,
      'invited'
    FROM users u;

    UPDATE trip_members SET status = 'active', joined_at = NOW()
      WHERE trip_id = v_trip_id AND role = 'owner';
  END IF;

  UPDATE regions SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE experiences SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE votes SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE ratings SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE comments SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE itinerary_items SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE calendar_access SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE place_notes SET trip_id = v_trip_id WHERE trip_id IS NULL;
  UPDATE trip_notes SET trip_id = v_trip_id WHERE trip_id IS NULL;

  UPDATE votes v SET member_id = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = v.user_id AND v.member_id IS NULL;
  UPDATE ratings r SET member_id = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = r.user_id AND r.member_id IS NULL;
  UPDATE comments c SET member_id = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = c.user_id AND c.member_id IS NULL;
  UPDATE itinerary_items i SET created_by_member = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = i.created_by AND i.created_by_member IS NULL;
  UPDATE calendar_access ca SET member_id = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = ca.user_id AND ca.member_id IS NULL;
  UPDATE place_notes pn SET updated_by_member = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = pn.updated_by AND pn.updated_by_member IS NULL;
  UPDATE trip_notes tn SET updated_by_member = tm.id FROM trip_members tm
    WHERE tm.trip_id = v_trip_id AND tm.legacy_user_id = tn.updated_by AND tn.updated_by_member IS NULL;
END $$;

-- Lock trip_id down now that every existing row has one (safe on an empty
-- table too, so this also works on a fresh project with no seed data yet).
ALTER TABLE regions ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE experiences ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE votes ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE ratings ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE comments ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE itinerary_items ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE calendar_access ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE place_notes ALTER COLUMN trip_id SET NOT NULL;
ALTER TABLE trip_notes ALTER COLUMN trip_id SET NOT NULL;

-- ============================================================
-- 6. Indexes on every new FK column (RLS checks and joins both need these)
-- ============================================================

CREATE INDEX IF NOT EXISTS regions_trip_id_idx ON regions (trip_id);
CREATE INDEX IF NOT EXISTS experiences_trip_id_idx ON experiences (trip_id);
CREATE INDEX IF NOT EXISTS votes_trip_id_idx ON votes (trip_id);
CREATE INDEX IF NOT EXISTS votes_member_id_idx ON votes (member_id);
CREATE INDEX IF NOT EXISTS ratings_trip_id_idx ON ratings (trip_id);
CREATE INDEX IF NOT EXISTS ratings_member_id_idx ON ratings (member_id);
CREATE INDEX IF NOT EXISTS comments_trip_id_idx ON comments (trip_id);
CREATE INDEX IF NOT EXISTS comments_member_id_idx ON comments (member_id);
CREATE INDEX IF NOT EXISTS itinerary_items_trip_id_idx ON itinerary_items (trip_id);
CREATE INDEX IF NOT EXISTS itinerary_items_created_by_member_idx ON itinerary_items (created_by_member);
CREATE INDEX IF NOT EXISTS calendar_access_trip_id_idx ON calendar_access (trip_id);
CREATE INDEX IF NOT EXISTS calendar_access_member_id_idx ON calendar_access (member_id);
CREATE INDEX IF NOT EXISTS place_notes_trip_id_idx ON place_notes (trip_id);
CREATE INDEX IF NOT EXISTS trip_notes_trip_id_idx ON trip_notes (trip_id);

CREATE UNIQUE INDEX IF NOT EXISTS calendar_access_trip_member_uidx ON calendar_access (trip_id, member_id);
CREATE UNIQUE INDEX IF NOT EXISTS votes_member_experience_uidx ON votes (member_id, experience_id) WHERE member_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ratings_member_experience_uidx ON ratings (member_id, experience_id) WHERE member_id IS NOT NULL;

-- ============================================================
-- 7. Replace "Allow all for anon" with trip-scoped policies for
--    `authenticated`. Read access is member-wide (see everyone's votes/
--    comments/calendar, matching today's shared-trip behavior); writes to
--    votes/ratings/comments are restricted to the acting member's own
--    row via private.my_member_ids(); regions/experiences/itinerary/notes
--    stay member-wide writable, matching the current "anyone can add a
--    place / edit the calendar / edit notes" behavior.
-- ============================================================

DROP POLICY IF EXISTS "Allow all for anon" ON regions;
CREATE POLICY "members read regions" ON regions FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert regions" ON regions FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members update regions" ON regions FOR UPDATE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members delete regions" ON regions FOR DELETE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON experiences;
CREATE POLICY "members read experiences" ON experiences FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert experiences" ON experiences FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members update experiences" ON experiences FOR UPDATE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members delete experiences" ON experiences FOR DELETE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON votes;
CREATE POLICY "members read votes" ON votes FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert own votes" ON votes FOR INSERT TO authenticated WITH CHECK (member_id IN (SELECT private.my_member_ids(trip_id)));
CREATE POLICY "members update own votes" ON votes FOR UPDATE TO authenticated USING (member_id IN (SELECT private.my_member_ids(trip_id)));
CREATE POLICY "members delete own votes" ON votes FOR DELETE TO authenticated USING (member_id IN (SELECT private.my_member_ids(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON ratings;
CREATE POLICY "members read ratings" ON ratings FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert own ratings" ON ratings FOR INSERT TO authenticated WITH CHECK (member_id IN (SELECT private.my_member_ids(trip_id)));
CREATE POLICY "members update own ratings" ON ratings FOR UPDATE TO authenticated USING (member_id IN (SELECT private.my_member_ids(trip_id)));
CREATE POLICY "members delete own ratings" ON ratings FOR DELETE TO authenticated USING (member_id IN (SELECT private.my_member_ids(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON comments;
CREATE POLICY "members read comments" ON comments FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert own comments" ON comments FOR INSERT TO authenticated WITH CHECK (member_id IN (SELECT private.my_member_ids(trip_id)));
CREATE POLICY "members update own comments" ON comments FOR UPDATE TO authenticated USING (member_id IN (SELECT private.my_member_ids(trip_id)));
CREATE POLICY "members delete own comments" ON comments FOR DELETE TO authenticated USING (member_id IN (SELECT private.my_member_ids(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON itinerary_items;
CREATE POLICY "members read itinerary" ON itinerary_items FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert itinerary" ON itinerary_items FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members update itinerary" ON itinerary_items FOR UPDATE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members delete itinerary" ON itinerary_items FOR DELETE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON calendar_access;
CREATE POLICY "members read calendar access" ON calendar_access FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "admins manage calendar access" ON calendar_access FOR ALL TO authenticated
  USING ((SELECT private.is_trip_admin(trip_id))) WITH CHECK ((SELECT private.is_trip_admin(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON place_notes;
CREATE POLICY "members read place notes" ON place_notes FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert place notes" ON place_notes FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members update place notes" ON place_notes FOR UPDATE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members delete place notes" ON place_notes FOR DELETE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));

DROP POLICY IF EXISTS "Allow all for anon" ON trip_notes;
CREATE POLICY "members read trip notes" ON trip_notes FOR SELECT TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members insert trip notes" ON trip_notes FOR INSERT TO authenticated WITH CHECK ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members update trip notes" ON trip_notes FOR UPDATE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));
CREATE POLICY "members delete trip notes" ON trip_notes FOR DELETE TO authenticated USING ((SELECT private.is_trip_member(trip_id)));

-- ============================================================
-- Not handled here (follow-up work, not blocking):
--   - The legacy `users` table keeps its old "Allow all for anon" policy —
--     it's superseded by profiles/trip_members going forward and can be
--     dropped once nothing reads it anymore.
--   - regions.id / experiences.id are TEXT primary keys using readable
--     slugs (e.g. 'tbilisi-old-town'). That's fine while there's one trip,
--     but two different trips creating a region/experience with the same
--     slug will collide globally. Phase 1 app code generating these ids
--     needs to make them trip-unique (e.g. prefix with a short trip token
--     or switch to generated ids) — a schema note, not fixed here.
--   - Account deletion (both app stores require it) needs a dedicated
--     cascade function once real auth.users accounts exist — see the
--     plan's Phase 4.
-- ============================================================
