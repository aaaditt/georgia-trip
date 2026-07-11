-- Migration 04 — calendar edit-access overrides
-- Run this in Supabase SQL Editor (after migration-03).
-- Normally the calendar unlocks for a person once they've voted on every
-- place. A row here is an admin-granted override that unlocks it early.

CREATE TABLE IF NOT EXISTS calendar_access (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER PUBLICATION supabase_realtime ADD TABLE calendar_access;

ALTER TABLE calendar_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON calendar_access FOR ALL USING (true) WITH CHECK (true);
