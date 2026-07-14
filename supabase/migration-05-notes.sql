-- Migration 05 — notes system
-- Run this in Supabase SQL Editor (after migration-04).
-- Three additions: a shared editable "sticky note" per place, a single
-- shared trip-wide scratchpad, and a notes field on calendar blocks.

-- One row per place. Upserted (onConflict: experience_id), not appended —
-- unlike `comments`, this is a single shared note, last edit wins.
CREATE TABLE IF NOT EXISTS place_notes (
  experience_id TEXT PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single-row trip-wide scratchpad. id is pinned to 1 — always upsert with
-- onConflict: 'id' so there is never more than one row.
CREATE TABLE IF NOT EXISTS trip_notes (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  text TEXT NOT NULL DEFAULT '',
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE itinerary_items ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER PUBLICATION supabase_realtime ADD TABLE place_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_notes;

ALTER TABLE place_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON place_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON trip_notes FOR ALL USING (true) WITH CHECK (true);
