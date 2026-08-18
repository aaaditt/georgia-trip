-- Migration 05 — shared trip notes (RECONSTRUCTED)
--
-- This file was an empty stub in the repo even though `place_notes` and
-- `trip_notes` are live tables already in use (see src/lib/notes.js) —
-- they were created directly in the Supabase Dashboard SQL editor and the
-- DDL was never checked in. The definitions below are inferred from how
-- src/lib/notes.js queries these tables (columns, the upsert onConflict
-- targets, and the users(name, emoji) embed) and from the shape of every
-- other "Allow all for anon" table in this schema.
--
-- Before relying on this file: confirm it actually matches the live
-- schema (Supabase Dashboard > Table Editor, or `supabase db pull` if the
-- CLI gets linked to the project) — treat this as best-effort
-- documentation of what should exist, not a verified export of what does.
-- Safe to run either way: every statement is idempotent (IF NOT EXISTS /
-- ON CONFLICT-safe), so re-running it against a project where these
-- tables already exist correctly is a no-op.

-- One shared, editable note per place. upsertPlaceNote() upserts on the
-- experience_id conflict target, so it must be unique.
CREATE TABLE IF NOT EXISTS place_notes (
  id SERIAL PRIMARY KEY,
  experience_id TEXT REFERENCES experiences(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (experience_id)
);

-- Single shared trip-wide scratchpad. The app always upserts/reads id=1 —
-- one row per trip today; becomes one row per trip_id once multi-tenancy
-- lands (see migration-06).
CREATE TABLE IF NOT EXISTS trip_notes (
  id INT PRIMARY KEY,
  text TEXT NOT NULL,
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ADD TABLE has no IF NOT EXISTS form, so guard it for idempotency.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE place_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trip_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE place_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon" ON place_notes;
CREATE POLICY "Allow all for anon" ON place_notes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon" ON trip_notes;
CREATE POLICY "Allow all for anon" ON trip_notes FOR ALL USING (true) WITH CHECK (true);
