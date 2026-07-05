-- Migration 01 — live-push newly added places
-- Run this once in Supabase Dashboard > SQL Editor.
--
-- The app now lets anyone add a new place (stored in the experiences
-- table). Without this, new places appear for others on their next page
-- load; with it, they pop in instantly like votes/ratings/comments do.

ALTER PUBLICATION supabase_realtime ADD TABLE experiences;
