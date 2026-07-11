-- Migration 03 — shared drag-and-drop itinerary calendar
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- One row = one block on the calendar grid (a place visit, a transport
-- leg, or a custom checkpoint/event). Everyone can edit; realtime keeps
-- the whole family in sync, same as votes/ratings/comments.

CREATE TABLE IF NOT EXISTS itinerary_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('place', 'transport', 'custom')),
  -- kind='place': which experience this block is for (static or custom place)
  experience_id TEXT,
  -- kind='transport': 'car' | 'taxi' | 'public'
  transport_mode TEXT,
  -- kind='custom': the event/checkpoint name; also used as an optional
  -- note on transport blocks ("Tbilisi → Kazbegi")
  title TEXT,
  day DATE NOT NULL,
  start_min INT NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
  duration_min INT NOT NULL DEFAULT 60 CHECK (duration_min >= 30),
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE itinerary_items;

ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON itinerary_items FOR ALL USING (true) WITH CHECK (true);
