# Notes System + Calendar Redesign — Design

Date: 2026-07-14

## Purpose

Two related gaps in the trip planner:

1. There's nowhere to jot practical, non-vote information — "no beef kubdari
   option", "bring cash for the sulfur baths", "meet driver at hotel lobby
   at 9am". The only free-text field is the per-place comment thread, which
   is really a voting discussion, not a notes area.
2. The calendar (`src/app/calendar/page.js`) is dense and fiddly: tiny type,
   no way to clean up multiple blocks at once, and no way to attach a note
   to a scheduled block.

This adds a notes system in three places (per-place, per-calendar-event,
trip-wide), restyles the calendar for readability, and adds rubber-band
multi-select + bulk delete to the calendar grid.

## Data model

New migration: `supabase/migration-05-notes.sql`

```sql
-- One shared, editable "sticky note" per place. Upserted, not appended —
-- unlike `comments`, there's exactly one row per experience_id.
CREATE TABLE IF NOT EXISTS place_notes (
  experience_id TEXT PRIMARY KEY REFERENCES experiences(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single-row trip-wide scratchpad. id is pinned to 1 so there's only ever
-- one row; upsert with onConflict: 'id'.
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
```

`place_notes.experience_id` can safely FK to `experiences(id)` because the
seed data in `schema.sql` already inserts every static place (from
`src/lib/data.js`) into the `experiences` table, not just family-added ones
— `useExperiences()` merges the local constant with DB rows only for ids
*not* in the static set, but all static ids already exist as DB rows too.

No conflict resolution beyond last-write-wins on blur, matching how votes/
comments already work in this app (small trusted group, realtime refetch
reconciles everyone). Not worth building anything fancier here.

## Place notes (sticky note per place)

- New `src/lib/notes.js`: `usePlaceNotes()` (realtime map keyed by
  `experience_id`), `upsertPlaceNote(userId, experienceId, text)`,
  `useTripNote()`, `upsertTripNote(userId, text)`. Kept separate from
  `hooks.js` since notes are a distinct concern from votes/ratings/comments.
- New `src/components/PlaceNoteBox.js`, inserted into `ExperienceCard`
  above the existing `CommentBox`. Empty state: dashed box, "📝 No notes yet
  — add a tip for the family" (click to start editing). Filled state: shows
  the text with a small edit affordance; click → textarea + Save/Cancel;
  save on blur or explicit Save. Footer caption "— {emoji} {name}, {relative
  time}" reusing the same relative-time formatting `CommentBox` already has.
- To avoid the new "Notes" section reading as a duplicate of the existing
  comment thread, `CommentBox`'s input placeholder changes from "Add a
  note..." to "Add a comment...", and its section keeps functioning as the
  voting discussion it already is.

## Calendar event notes

- `useItinerary()` in `src/lib/itinerary.js`: `mapDbItem`/`toDbItem` gain
  `notes`/`notes` (nullable), and `updateItem`'s patch handling gains a
  `notes` branch, mirroring how `title` is already handled.
- In `src/app/calendar/page.js`, the `cal-panel` detail view (opened by
  tapping a block) gets a notes textarea for **every** block kind (places,
  transport, custom) — not just the existing title-rename input, which only
  covers transport/custom. Read-only text is shown even in locked/view mode
  so the whole family can read logistics without unlocking; the textarea
  itself only appears when `editing` is true. Save on blur via `updateItem`.

## Trip-wide notes page

- New route `src/app/notes/page.js`. Single shared textarea (freeform,
  matching the "shared scratchpad" preference over categorized sections),
  autosave on blur via `upsertTripNote`, footer showing who last edited it
  and when. No lock/gate — same openness as comments and place notes.
- New link in `Navbar.js`: `{ href: "/notes", label: "Notes", icon: "📝" }`,
  placed after Calendar.

## Calendar visual polish

Restyling within the existing design-token system (`--space-*`,
`--radius-*`, the existing region/wine/gold palette) — no new colors, no
layout change to the grid/drag-to-place/resize model, per your choice to
keep the timeline view rather than switch to an agenda list.

- Block name/time typography steps up from the current 0.68rem/0.6rem —
  it's genuinely hard to read at a glance today.
- More internal padding on `.cal-block`, softer corner radius.
- Hour-gutter labels get a size/contrast bump (`.cal-hour-label` is
  currently 0.62rem, quite faint).
- Clearer visual distinction between locked (view) and unlocked (edit)
  states beyond the existing lockbar — e.g. blocks look subtly flatter/
  non-interactive when `readonly`.
- Selected-block outline stays but gets visually distinct from the new
  multi-select highlight (single-select keeps the existing ring; multi-
  select uses a dashed outline so the two states are never ambiguous).

Exact pixel values are an implementation detail decided against the
existing token scale, not spec'd line-by-line here.

## Multi-select + bulk delete

- New interaction, edit-mode only (`editing === true`), analogous to the
  existing chip/block drag but a new `type: "select"` in the same
  `dragRef`-based pointer system already powering drag/resize — no new
  library.
- Trigger: `onPointerDown` on `.cal-day-body` itself (not bubbled from a
  `.cal-block`) starts a rubber-band selection box. On move, a new overlay
  element (`selectBoxRef`, styled `.cal-select-box`) is sized/positioned
  like `cal-drop-preview` already is.
- On pointer up, any block whose day + time range intersects the box's
  screen rect gets added to a `selectedIds` Set (new state, distinct from
  the existing single-block `selectedId` used for the tap-to-open detail
  panel). Those blocks get the `.multi-selected` class (dashed outline per
  above).
- While `selectedIds.size > 0`, a floating bar appears (new `.cal-bulk-bar`,
  positioned like the existing `.cal-panel`) showing "{N} selected",
  a "🗑 Delete" button, and a "Clear" button (click empties the set without
  deleting).
- **Delete** or **Backspace**, while `selectedIds.size > 0` and no text
  input/textarea has focus, deletes every selected block (`removeItem` for
  each id) and clears the selection. Same behavior is wired to the bulk
  bar's Delete button.
- Starting a rubber-band drag, tapping a single block, or opening the
  add-event modal all clear any existing multi-selection, so the two
  selection modes (single detail panel vs. multi bulk-bar) never overlap.

## Verification

No test framework in this repo (`package.json` has no test script) — this
gets verified manually: `npm run lint`, then a run through on the dev
server covering:

- Add/edit/clear a place note; confirm it shows on the card and persists
  after reload.
- Add a note to a calendar place block, a transport block, and a custom
  event; confirm it's readable in locked mode and editable when unlocked.
- Write something on the trip-wide Notes page, reload, confirm it persisted
  and the "last edited by" footer is correct.
- Rubber-band select 2+ blocks, delete via the bulk bar; repeat and delete
  via the Delete key; confirm a plain tap on one block still opens the
  normal detail panel instead of starting a multi-select.
- Visual pass on the calendar at normal browser width and narrow (mobile)
  width.
