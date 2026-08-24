-- Migration 09 — Georgia catalog, region opt-in, richer place detail
--
-- This app is for planning a trip to Georgia (the country). The destination
-- is not a variable. What varies per trip is the dates and which of
-- Georgia's regions a given group actually wants to visit.
--
-- Adds:
--   1. catalog_regions / catalog_places — global, read-only reference data
--      holding the curated Georgia content. Readable by any authenticated
--      user whether or not they belong to a trip, which is what lets the
--      create wizard show the region grid before the trip exists.
--   2. Mirror columns + a catalog_*_id backlink on the existing per-trip
--      regions / experiences tables.
--   3. regions.is_selected — the trip's shared shortlist. Gates emphasis and
--      prompting in the app; never gates access. Every place stays browsable
--      and votable by anyone.
--   4. Three SECURITY DEFINER RPCs to create-and-seed, seed, and toggle.
--
-- WHY THE ROWS ARE COPIED RATHER THAN JOINED: votes, ratings, comments,
-- itinerary_items and place_notes all carry an experience_id foreign key to
-- experiences(id). Reading the catalog directly would break all five. Copying
-- keeps every existing FK, RLS policy, hook and screen working untouched, and
-- leaves each trip's rows independently editable by its own members.
--
-- WHY IDS ARE SUFFIXED WITH THE TRIP UUID: regions.id and experiences.id are
-- globally unique TEXT primary keys — migration-06 added trip_id as a plain
-- column but never made the key composite, so two trips cannot both own a
-- region with id 'tbilisi'. (This is also why addRegion() in the app appends
-- Date.now().toString(36).) Making the key composite would break those same
-- five foreign keys, so seeded rows mint '<catalog_slug>-<trip_uuid>' instead
-- and carry the catalog id in a dedicated column.
--
-- Every write below goes through a SECURITY DEFINER function per
-- migration-08's header — direct table writes fail under the Supabase RLS
-- platform bug documented there.
--
-- Run in Supabase Dashboard > SQL Editor, after migration-08. Idempotent.
-- Follow with the migration-10-catalog-*.sql files, which carry the places.

-- ============================================================
-- 1. Global catalog tables
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_regions (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '📍',
  subtitle      TEXT,
  summary       TEXT,
  when_to_go    TEXT,
  getting_there TEXT,
  base_towns    TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS catalog_places (
  id               TEXT PRIMARY KEY,
  region_id        TEXT NOT NULL REFERENCES catalog_regions(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  hook             TEXT,
  description      TEXT,
  tips             TEXT,
  best_time        TEXT,
  duration_min     INT,
  time_needed      TEXT,
  price_gel_min    INT,
  price_gel_max    INT,
  price_lari       TEXT,
  nearest_town     TEXT,
  lat              NUMERIC(9,6),
  lng              NUMERIC(9,6),
  kid_note         TEXT,
  booking_required BOOLEAN NOT NULL DEFAULT false,
  tags             TEXT[] NOT NULL DEFAULT '{}',
  sort_order       INT NOT NULL DEFAULT 0,
  -- Audio guide. Scripts ship with the content; the rest is filled in later
  -- by the TTS pipeline (see docs/roadmap/audio-guides.md). These live on the
  -- catalog, not on per-trip rows, because one narration serves every trip
  -- and the guide is meant to be usable without a trip at all.
  guide_script       TEXT,
  guide_script_words INT,
  guide_version      INT NOT NULL DEFAULT 1,
  audio_url          TEXT,
  audio_duration_sec INT,
  audio_voice        TEXT
);

CREATE INDEX IF NOT EXISTS catalog_places_region_id_idx ON catalog_places (region_id);

-- ============================================================
-- 2. RLS on the catalog: readable by any signed-in user, written only by
--    migrations running as postgres. No write policies on purpose.
-- ============================================================

ALTER TABLE catalog_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_places  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read catalog_regions" ON catalog_regions;
CREATE POLICY "authenticated read catalog_regions" ON catalog_regions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated read catalog_places" ON catalog_places;
CREATE POLICY "authenticated read catalog_places" ON catalog_places
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Mirror columns + backlinks on the per-trip tables
-- ============================================================

ALTER TABLE regions ADD COLUMN IF NOT EXISTS catalog_region_id TEXT REFERENCES catalog_regions(id) ON DELETE SET NULL;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS summary       TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS when_to_go    TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS getting_there TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS base_towns    TEXT;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS is_selected   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS selected_at   TIMESTAMPTZ;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS selected_by   UUID REFERENCES trip_members(id) ON DELETE SET NULL;

ALTER TABLE experiences ADD COLUMN IF NOT EXISTS catalog_place_id TEXT REFERENCES catalog_places(id) ON DELETE SET NULL;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS hook             TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS tips             TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS best_time        TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS duration_min     INT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS price_gel_min    INT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS price_gel_max    INT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS nearest_town     TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS lat              NUMERIC(9,6);
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS lng              NUMERIC(9,6);
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS kid_note         TEXT;
ALTER TABLE experiences ADD COLUMN IF NOT EXISTS booking_required BOOLEAN NOT NULL DEFAULT false;

-- Partial: member-added rows have a NULL backlink and must not collide.
CREATE UNIQUE INDEX IF NOT EXISTS regions_trip_catalog_uidx
  ON regions (trip_id, catalog_region_id) WHERE catalog_region_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS experiences_trip_catalog_uidx
  ON experiences (trip_id, catalog_place_id) WHERE catalog_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS regions_trip_selected_idx ON regions (trip_id, is_selected);

-- regions was never added to the realtime publication — schema.sql adds
-- votes/ratings/comments and migration-01 adds experiences, but regions was
-- missed, so useRegions()'s subscription has never actually fired. Harmless
-- while regions were static; not harmless now that is_selected is a live
-- toggle other members need to see.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE regions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 4. Seeding + selection RPCs
-- ============================================================

-- Copies the whole catalog into one trip. Called by create_georgia_trip
-- below, and directly by the app's "Add Georgia's places" import action for
-- trips that predate the catalog.
--
-- p_region_ids marks which regions land in the trip's shortlist; everything
-- else is still copied in, just unselected, so members can browse and vote
-- outside the shortlist without anything being fetched on demand.
--
-- ON CONFLICT DO NOTHING with no target covers both the primary key and the
-- partial unique indexes above, which makes re-running this a no-op.
CREATE OR REPLACE FUNCTION public.seed_trip_catalog(
  p_trip_id UUID, p_region_ids TEXT[] DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_places INT;
BEGIN
  IF NOT (SELECT private.is_trip_member(p_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;

  INSERT INTO public.regions (
    id, trip_id, catalog_region_id, name, icon, subtitle,
    summary, when_to_go, getting_there, base_towns, sort_order,
    is_selected, selected_at
  )
  SELECT
    cr.id || '-' || p_trip_id::TEXT, p_trip_id, cr.id, cr.name, cr.icon, cr.subtitle,
    cr.summary, cr.when_to_go, cr.getting_there, cr.base_towns, cr.sort_order,
    COALESCE(cr.id = ANY(p_region_ids), false),
    CASE WHEN COALESCE(cr.id = ANY(p_region_ids), false) THEN NOW() END
  FROM public.catalog_regions cr
  WHERE cr.is_active
  ON CONFLICT DO NOTHING;

  INSERT INTO public.experiences (
    id, trip_id, catalog_place_id, region_id, name, description, hook, tips,
    best_time, duration_min, time_needed, price_lari, price_gel_min,
    price_gel_max, nearest_town, lat, lng, kid_note, booking_required,
    tags, sort_order
  )
  SELECT
    cp.id || '-' || p_trip_id::TEXT, p_trip_id, cp.id,
    cp.region_id || '-' || p_trip_id::TEXT,
    cp.name, cp.description, cp.hook, cp.tips, cp.best_time, cp.duration_min,
    cp.time_needed, cp.price_lari, cp.price_gel_min, cp.price_gel_max,
    cp.nearest_town, cp.lat, cp.lng, cp.kid_note, cp.booking_required,
    cp.tags, cp.sort_order
  FROM public.catalog_places cp
  JOIN public.catalog_regions cr ON cr.id = cp.region_id AND cr.is_active
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_places = ROW_COUNT;
  RETURN v_places;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.seed_trip_catalog(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seed_trip_catalog(UUID, TEXT[]) TO authenticated;

-- Create + seed in one call. The on_trip_created trigger from migration-06
-- inserts the creator's owner row synchronously as part of the INSERT, so
-- private.is_trip_member() inside seed_trip_catalog already passes by the
-- time it runs.
--
-- destination is hardcoded: every trip in this app is a Georgia trip. The
-- column stays for the legacy Georgia 2026 row rather than being dropped.
--
-- The old create_trip(TEXT, TEXT, DATE, DATE) is deliberately left in place
-- and untouched.
CREATE OR REPLACE FUNCTION public.create_georgia_trip(
  p_name TEXT, p_start_date DATE, p_end_date DATE, p_region_ids TEXT[] DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF COALESCE(BTRIM(p_name), '') = '' THEN
    RAISE EXCEPTION 'Trip name is required';
  END IF;
  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date cannot precede start date';
  END IF;

  INSERT INTO public.trips (name, destination, start_date, end_date, cover_emoji, created_by)
  VALUES (BTRIM(p_name), 'Georgia', p_start_date, p_end_date, '🇬🇪', (SELECT auth.uid()))
  RETURNING id INTO v_id;

  PERFORM public.seed_trip_catalog(v_id, p_region_ids);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_georgia_trip(TEXT, DATE, DATE, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_georgia_trip(TEXT, DATE, DATE, TEXT[]) TO authenticated;

-- Toggle one region into or out of the trip's shortlist. Any member may do
-- this, matching the "members insert/update regions" RLS policies from
-- migration-06 section 7 — the shortlist is a shared group decision, not an
-- admin-only one.
CREATE OR REPLACE FUNCTION public.set_trip_region_selected(
  p_region_id TEXT, p_selected BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_trip_id   UUID;
  v_member_id UUID;
BEGIN
  SELECT trip_id INTO v_trip_id FROM public.regions WHERE id = p_region_id;
  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Region not found';
  END IF;
  IF NOT (SELECT private.is_trip_member(v_trip_id)) THEN
    RAISE EXCEPTION 'Not a member of this trip';
  END IF;

  SELECT id INTO v_member_id FROM public.trip_members
   WHERE trip_id = v_trip_id AND user_id = (SELECT auth.uid()) AND status = 'active'
   LIMIT 1;

  UPDATE public.regions
     SET is_selected = p_selected,
         selected_at = CASE WHEN p_selected THEN NOW() ELSE NULL END,
         selected_by = CASE WHEN p_selected THEN v_member_id ELSE NULL END
   WHERE id = p_region_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_trip_region_selected(TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_trip_region_selected(TEXT, BOOLEAN) TO authenticated;

-- ============================================================
-- 5. The ten catalog regions. Places arrive in migration-10-catalog-*.sql.
--    Slugs are frozen once this runs — trips reference them via
--    regions.catalog_region_id, so renaming one orphans live rows.
-- ============================================================

INSERT INTO catalog_regions (id, name, icon, subtitle, sort_order) VALUES
  ('tbilisi',            'Tbilisi',                        '🏙️', 'City, views, sulfur baths',            1),
  ('mtskheta',           'Mtskheta & the Military Highway','⛪', 'Ancient capital, the road north',      2),
  ('kakheti',            'Kakheti',                        '🍇', 'Wine country',                          3),
  ('gudauri-kazbegi',    'Gudauri & Kazbegi',              '🏔️', 'Alpine, cool, glaciers',                4),
  ('borjomi-bakuriani',  'Borjomi & Bakuriani',            '🌿', 'Mineral springs, forest, cool air',     5),
  ('samtskhe-javakheti', 'Samtskhe-Javakheti',             '🪨', 'Vardzia cave city & Rabati fortress',   6),
  ('shida-kartli',       'Shida Kartli',                   '🏛️', 'Gori & the Uplistsikhe rock town',      7),
  ('kutaisi-imereti',    'Kutaisi & Imereti',              '🌊', 'Caves, canyons & water',                8),
  ('svaneti',            'Svaneti',                        '🗼', 'Medieval towers under big mountains',   9),
  ('batumi-adjara',      'Batumi & Adjara',                '🌴', 'Black Sea coast & subtropical hills',  10)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. Verification — run these after the migration and eyeball the output.
-- ============================================================

-- Expect 10 rows.
SELECT count(*) AS catalog_regions FROM catalog_regions;

-- Expect 0 here until the migration-10-catalog-*.sql files have been run.
SELECT count(*) AS catalog_places FROM catalog_places;

-- Expect all three functions, each prosecdef = true (SECURITY DEFINER).
SELECT p.proname, p.prosecdef
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('create_georgia_trip', 'seed_trip_catalog', 'set_trip_region_selected')
 ORDER BY p.proname;

-- Expect exactly one row per function, granted to `authenticated` and to
-- nobody else. Anything mentioning anon or PUBLIC here is a bug.
SELECT routine_name, grantee
  FROM information_schema.routine_privileges
 WHERE routine_schema = 'public'
   AND routine_name IN ('create_georgia_trip', 'seed_trip_catalog', 'set_trip_region_selected')
 ORDER BY routine_name, grantee;

-- Expect regions to appear.
SELECT tablename FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime' AND tablename IN ('regions', 'experiences')
 ORDER BY tablename;
