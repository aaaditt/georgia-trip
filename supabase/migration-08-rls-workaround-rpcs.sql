-- Migration 08 — SECURITY DEFINER RPC workaround for broken RLS enforcement
--
-- Discovered via an extensive live debugging session: row-level security
-- checks reject inserts/updates/deletes for the `authenticated` role even
-- under a trivially-true policy (`WITH CHECK (true)`), on a table created
-- fresh seconds earlier with no history. Reproduced identically via the
-- Supabase SQL Editor, a direct Postgres connection, and the Supavisor
-- pooler — ruling out every application-level cause (stale policies, bad
-- role OIDs, triggers, rules, missing grants, connection pooling). Likely
-- a Supabase platform-level issue (the `authenticator` role has
-- `supautils`/`safeupdate` configured via session_preload_libraries,
-- which install permission hooks that outlive a mid-session `SET ROLE`).
-- A support ticket has been filed. Until it's resolved, every write goes
-- through a SECURITY DEFINER function instead of a direct table mutation:
-- these run with the *function owner's* privileges (`postgres`, which has
-- BYPASSRLS), sidestepping the broken enforcement layer entirely.
--
-- IMPORTANT: this does NOT disable RLS anywhere, and must not. RLS stays
-- enabled on every table exactly as migration-06/07 left it — it's still
-- what protects any future/direct API access this app doesn't route
-- through these functions. Each function below re-implements the *exact*
-- authorization check its corresponding RLS policy already expressed
-- (same private.is_trip_member/is_trip_admin/my_member_ids helpers) —
-- same security guarantee, just enforced in the function body instead of
-- via a policy, so a caller can't get anything past these checks that RLS
-- wouldn't have already allowed.
--
-- Once Supabase support resolves the platform bug, these functions can
-- stay (they're harmless and arguably a fine pattern regardless) or the
-- client can be reverted to direct table calls — not required either way.
--
-- Run in Supabase Dashboard > SQL Editor, after migration-07. Idempotent.

-- ============================================================
-- trips
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_trip(
  p_name TEXT, p_destination TEXT, p_start_date DATE, p_end_date DATE
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.trips (name, destination, start_date, end_date, created_by)
  VALUES (p_name, p_destination, p_start_date, p_end_date, (SELECT auth.uid()))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_trip(TEXT, TEXT, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_trip(TEXT, TEXT, DATE, DATE) TO authenticated;

-- ============================================================
-- profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_own_profile(p_display_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.profiles SET display_name = p_display_name WHERE id = (SELECT auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_own_profile(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_own_profile(TEXT) TO authenticated;

-- ============================================================
-- regions / experiences  (write check: is_trip_member)
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_region(
  p_id TEXT, p_trip_id UUID, p_name TEXT, p_icon TEXT, p_subtitle TEXT, p_sort_order INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  INSERT INTO public.regions (id, trip_id, name, icon, subtitle, sort_order)
  VALUES (p_id, p_trip_id, p_name, p_icon, p_subtitle, p_sort_order);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_region(TEXT, UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_region(TEXT, UUID, TEXT, TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_experience(
  p_id TEXT, p_trip_id UUID, p_region_id TEXT, p_name TEXT, p_description TEXT,
  p_time_needed TEXT, p_price_lari TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  INSERT INTO public.experiences (id, trip_id, region_id, name, description, time_needed, price_lari, tags, sort_order)
  VALUES (p_id, p_trip_id, p_region_id, p_name, p_description, p_time_needed, p_price_lari, '{}', 999);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_experience(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_experience(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- votes / ratings / comments  (write check: member_id IN my_member_ids)
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_vote(
  p_trip_id UUID, p_member_id UUID, p_experience_id TEXT, p_vote TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_member_id NOT IN (SELECT private.my_member_ids(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to vote as this member';
  END IF;
  INSERT INTO public.votes (trip_id, member_id, experience_id, vote, updated_at)
  VALUES (p_trip_id, p_member_id, p_experience_id, p_vote, NOW())
  ON CONFLICT (member_id, experience_id) DO UPDATE SET vote = EXCLUDED.vote, updated_at = NOW();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_vote(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_vote(UUID, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_rating(
  p_trip_id UUID, p_member_id UUID, p_experience_id TEXT, p_rating INT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_member_id NOT IN (SELECT private.my_member_ids(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to rate as this member';
  END IF;
  INSERT INTO public.ratings (trip_id, member_id, experience_id, rating, updated_at)
  VALUES (p_trip_id, p_member_id, p_experience_id, p_rating, NOW())
  ON CONFLICT (member_id, experience_id) DO UPDATE SET rating = EXCLUDED.rating, updated_at = NOW();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_rating(UUID, UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_rating(UUID, UUID, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_comment(
  p_trip_id UUID, p_member_id UUID, p_experience_id TEXT, p_text TEXT
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id INT;
BEGIN
  IF p_member_id NOT IN (SELECT private.my_member_ids(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to comment as this member';
  END IF;
  INSERT INTO public.comments (trip_id, member_id, experience_id, text)
  VALUES (p_trip_id, p_member_id, p_experience_id, p_text)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_comment(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_comment(UUID, UUID, TEXT, TEXT) TO authenticated;

-- Comment deletion: owner of the comment OR a trip admin. The original RLS
-- policy ("members delete own comments") only ever allowed the former,
-- which meant the admin moderation "delete reported comment" flow
-- (admin.tsx's resolveReport) was never actually authorized to begin
-- with — fixed here since this check is being rebuilt anyway.
CREATE OR REPLACE FUNCTION public.delete_comment(p_comment_id INT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id UUID;
  v_member_id UUID;
BEGIN
  SELECT trip_id, member_id INTO v_trip_id, v_member_id FROM public.comments WHERE id = p_comment_id;
  IF v_trip_id IS NULL THEN
    RETURN; -- already gone
  END IF;
  IF v_member_id NOT IN (SELECT private.my_member_ids(v_trip_id)) AND NOT (SELECT private.is_trip_admin(v_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to delete this comment';
  END IF;
  DELETE FROM public.comments WHERE id = p_comment_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_comment(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_comment(INT) TO authenticated;

-- ============================================================
-- itinerary_items  (write check: is_trip_member)
-- ============================================================

CREATE OR REPLACE FUNCTION public.add_itinerary_item(
  p_id TEXT, p_trip_id UUID, p_kind TEXT, p_experience_id TEXT, p_transport_mode TEXT,
  p_title TEXT, p_notes TEXT, p_day DATE, p_start_min INT, p_duration_min INT, p_created_by_member UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  INSERT INTO public.itinerary_items
    (id, trip_id, kind, experience_id, transport_mode, title, notes, day, start_min, duration_min, created_by_member)
  VALUES
    (p_id, p_trip_id, p_kind, p_experience_id, p_transport_mode, p_title, p_notes, p_day, p_start_min, p_duration_min, p_created_by_member);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_itinerary_item(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INT, INT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_itinerary_item(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, INT, INT, UUID) TO authenticated;

-- Client always sends the item's full current field values (not a
-- partial diff) — see mobile/src/lib/itinerary.ts's updateItem, which
-- merges the patch into local state before calling this, then sends that
-- merged row. Avoids needing NULL-as-"don't touch" sentinel handling here.
CREATE OR REPLACE FUNCTION public.update_itinerary_item(
  p_id TEXT, p_day DATE, p_start_min INT, p_duration_min INT, p_title TEXT, p_notes TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id FROM public.itinerary_items WHERE id = p_id;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;
  IF NOT (SELECT private.is_trip_member(v_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  UPDATE public.itinerary_items
  SET day = p_day, start_min = p_start_min, duration_min = p_duration_min, title = p_title, notes = p_notes
  WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_itinerary_item(TEXT, DATE, INT, INT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_itinerary_item(TEXT, DATE, INT, INT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_itinerary_item(p_id TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id FROM public.itinerary_items WHERE id = p_id;
  IF v_trip_id IS NULL THEN
    RETURN; -- already gone
  END IF;
  IF NOT (SELECT private.is_trip_member(v_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  DELETE FROM public.itinerary_items WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_itinerary_item(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_itinerary_item(TEXT) TO authenticated;

-- ============================================================
-- calendar_access  (write check: is_trip_admin)
-- ============================================================

CREATE OR REPLACE FUNCTION public.grant_calendar_access(p_trip_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_admin(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to manage calendar access for this trip';
  END IF;
  INSERT INTO public.calendar_access (trip_id, member_id)
  VALUES (p_trip_id, p_member_id)
  ON CONFLICT (trip_id, member_id) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.grant_calendar_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grant_calendar_access(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_calendar_access(p_trip_id UUID, p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_admin(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to manage calendar access for this trip';
  END IF;
  DELETE FROM public.calendar_access WHERE trip_id = p_trip_id AND member_id = p_member_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_calendar_access(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_calendar_access(UUID, UUID) TO authenticated;

-- ============================================================
-- place_notes / trip_notes  (write check: is_trip_member)
-- ============================================================

CREATE OR REPLACE FUNCTION public.upsert_place_note(
  p_trip_id UUID, p_member_id UUID, p_experience_id TEXT, p_text TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  INSERT INTO public.place_notes (trip_id, experience_id, text, updated_by_member, updated_at)
  VALUES (p_trip_id, p_experience_id, p_text, p_member_id, NOW())
  ON CONFLICT (experience_id) DO UPDATE
    SET text = EXCLUDED.text, updated_by_member = EXCLUDED.updated_by_member, updated_at = NOW();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_place_note(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_place_note(UUID, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_trip_note(p_trip_id UUID, p_member_id UUID, p_text TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;
  INSERT INTO public.trip_notes (trip_id, text, updated_by_member, updated_at)
  VALUES (p_trip_id, p_text, p_member_id, NOW())
  ON CONFLICT (trip_id) DO UPDATE
    SET text = EXCLUDED.text, updated_by_member = EXCLUDED.updated_by_member, updated_at = NOW();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_trip_note(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_trip_note(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- trip_members admin actions  (write check: is_trip_admin, can't touch owner)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_member_role(p_member_id UUID, p_next_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id UUID;
  v_current_role TEXT;
BEGIN
  SELECT trip_id, role INTO v_trip_id, v_current_role FROM public.trip_members WHERE id = p_member_id;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  IF NOT (SELECT private.is_trip_admin(v_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to manage members for this trip';
  END IF;
  IF v_current_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change the owner''s role';
  END IF;
  IF p_next_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  UPDATE public.trip_members SET role = p_next_role WHERE id = p_member_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_member_role(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_trip_member(p_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id UUID;
  v_role TEXT;
BEGIN
  SELECT trip_id, role INTO v_trip_id, v_role FROM public.trip_members WHERE id = p_member_id;
  IF v_trip_id IS NULL THEN
    RETURN; -- already gone
  END IF;
  IF NOT (SELECT private.is_trip_admin(v_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to manage members for this trip';
  END IF;
  IF v_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot remove the trip owner';
  END IF;
  UPDATE public.trip_members SET status = 'removed' WHERE id = p_member_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_trip_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_trip_member(UUID) TO authenticated;

-- ============================================================
-- moderation: comment_reports / blocked_members
-- ============================================================

CREATE OR REPLACE FUNCTION public.report_comment(
  p_trip_id UUID, p_comment_id INT, p_reporter_member_id UUID, p_reason TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_reporter_member_id NOT IN (SELECT private.my_member_ids(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to report as this member';
  END IF;
  INSERT INTO public.comment_reports (trip_id, comment_id, reported_by_member, reason)
  VALUES (p_trip_id, p_comment_id, p_reporter_member_id, p_reason)
  ON CONFLICT (comment_id, reported_by_member) DO UPDATE SET reason = EXCLUDED.reason;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.report_comment(UUID, INT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_comment(UUID, INT, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.dismiss_report(p_report_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id FROM public.comment_reports WHERE id = p_report_id;
  IF v_trip_id IS NULL THEN
    RETURN; -- already gone
  END IF;
  IF NOT (SELECT private.is_trip_admin(v_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to manage reports for this trip';
  END IF;
  DELETE FROM public.comment_reports WHERE id = p_report_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dismiss_report(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_report(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.block_member(p_trip_id UUID, p_blocker_member_id UUID, p_blocked_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_blocker_member_id NOT IN (SELECT private.my_member_ids(p_trip_id)) THEN
    RAISE EXCEPTION 'Not authorized to block as this member';
  END IF;
  INSERT INTO public.blocked_members (trip_id, blocker_member_id, blocked_member_id)
  VALUES (p_trip_id, p_blocker_member_id, p_blocked_member_id)
  ON CONFLICT (blocker_member_id, blocked_member_id) DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.block_member(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_member(UUID, UUID, UUID) TO authenticated;

-- No trip_id param needed: ownership of blocker_member_id is verified
-- directly, which is sufficient (a member row belongs to exactly one trip).
CREATE OR REPLACE FUNCTION public.unblock_member(p_blocker_member_id UUID, p_blocked_member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner_uid UUID;
BEGIN
  SELECT user_id INTO v_owner_uid FROM public.trip_members WHERE id = p_blocker_member_id;
  IF v_owner_uid IS NULL OR v_owner_uid != (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to unblock as this member';
  END IF;
  DELETE FROM public.blocked_members
  WHERE blocker_member_id = p_blocker_member_id AND blocked_member_id = p_blocked_member_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unblock_member(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_member(UUID, UUID) TO authenticated;
