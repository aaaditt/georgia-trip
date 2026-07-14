# Notes System + Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add practical notes in three places (per-place, per-calendar-event, trip-wide) and redesign the calendar for readability and easier bulk edits.

**Architecture:** Three new/extended Supabase tables (`place_notes`, `trip_notes`, `itinerary_items.notes`) feeding a new `src/lib/notes.js` data layer, a new `PlaceNoteBox` component wired into `ExperienceCard`, a new `/notes` page, an extended calendar detail panel, calendar CSS polish, and a rubber-band multi-select + bulk-delete interaction added to the calendar's existing hand-rolled pointer-drag system (no new libraries).

**Tech Stack:** Next.js (App Router, `"use client"` components), React 19, Supabase (`@supabase/supabase-js`), plain CSS custom properties (no CSS framework).

## Global Constraints

- This repo has **no test framework** (`package.json` has no test script, no jest/vitest/playwright dependency). Every task's verification step is therefore `npm run lint` plus precise manual checks on the dev server (`npm run dev`) — do not invent a test framework or fake test files to satisfy this plan's template; that would violate the "no placeholders" rule by pretending automation exists where it doesn't.
- Match existing conventions exactly: hooks fetch + subscribe to a Supabase realtime channel + expose optimistic mutators (see `src/lib/hooks.js`, `src/lib/access.js`); RLS policy is always `"Allow all for anon" ... FOR ALL USING (true) WITH CHECK (true)` (trusted small group, no auth); CSS uses only existing custom properties from `src/app/globals.css` (`--space-*`, `--radius-*`, `--charcoal*`, `--wine*`, `--gold*`, `--stone*`) — no new colors.
- Supabase migrations in this repo are applied manually by the user via the Supabase SQL Editor (no CLI/config is set up locally) — same as migrations 01–04. This plan creates the `.sql` file; it does not and cannot apply it.
- `src/app/calendar/page.js` has a code comment: `// Grid geometry (keep in sync with the .cal-* styles in globals.css)` above `SLOT_PX`/`HEADER_H`/`COL_W`. Any task touching those constants must update the matching CSS in the same task.

---

### Task 1: Database migration

**Files:**

- Create: `supabase/migration-05-notes.sql`

**Interfaces:**

- Produces: `place_notes(experience_id TEXT PK, text, updated_by, updated_at)`, `trip_notes(id INT PK=1, text, updated_by, updated_at)`, `itinerary_items.notes TEXT` — every later task's Supabase calls assume these exist.

- [ ] **Step 1: Write the migration file**

```sql
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
```

- [ ] **Step 2: Verify**

Read the file back and confirm every table/column name matches this plan's
later tasks exactly: `place_notes.experience_id`, `place_notes.text`,
`place_notes.updated_by`, `place_notes.updated_at`, `trip_notes.id`,
`trip_notes.text`, `trip_notes.updated_by`, `trip_notes.updated_at`,
`itinerary_items.notes`. This file is not runnable from this session — it
must be pasted into the Supabase SQL Editor by the project owner before the
notes features work end-to-end (flag this clearly at the end of the plan).

- [ ] **Step 3: Commit**

```bash
git add supabase/migration-05-notes.sql
git commit -m "feat: add place_notes, trip_notes tables and itinerary notes column"
```

---

### Task 2: Notes data layer

**Files:**

- Create: `src/lib/notes.js`

**Interfaces:**

- Consumes: `supabase` client from `src/lib/supabase.js` (default pattern already used by every hook in `src/lib/hooks.js`).
- Produces: `usePlaceNotes()` → `{ notes, loading, refetch }` where `notes` is an array of `{ experience_id, text, updated_by, updated_at, users: { name, emoji } }`. `getPlaceNote(notes, experienceId)` → single row or `null`. `upsertPlaceNote(userId, experienceId, text)` → `{ error }`. `useTripNote()` → `{ note, loading, refetch }` where `note` is `{ id, text, updated_by, updated_at, users }` or `null`. `upsertTripNote(userId, text)` → `{ error }`.

- [ ] **Step 1: Write `src/lib/notes.js`**

```js
"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

// One shared, editable note per place (see place_notes in
// supabase/migration-05-notes.sql). Realtime-synced like votes/comments.
export function usePlaceNotes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    const { data, error } = await supabase
      .from("place_notes")
      .select("*, users(name, emoji)");
    if (!error && data) setNotes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotes();

    const channel = supabase
      .channel("place-notes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_notes" },
        () => fetchNotes()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotes]);

  return { notes, loading, refetch: fetchNotes };
}

export function getPlaceNote(notes, experienceId) {
  return notes.find((n) => n.experience_id === experienceId) || null;
}

export async function upsertPlaceNote(userId, experienceId, text) {
  const { error } = await supabase.from("place_notes").upsert(
    {
      experience_id: experienceId,
      text,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "experience_id" }
  );
  return { error };
}

// Single shared trip-wide scratchpad (trip_notes, id pinned to 1).
export function useTripNote() {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchNote = useCallback(async () => {
    const { data, error } = await supabase
      .from("trip_notes")
      .select("*, users(name, emoji)")
      .eq("id", 1)
      .maybeSingle();
    if (!error) setNote(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNote();

    const channel = supabase
      .channel("trip-notes-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_notes" },
        () => fetchNote()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNote]);

  return { note, loading, refetch: fetchNote };
}

export async function upsertTripNote(userId, text) {
  const { error } = await supabase.from("trip_notes").upsert(
    { id: 1, text, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  return { error };
}
```

- [ ] **Step 2: Verify it's syntactically valid**

Run: `node --check src/lib/notes.js`
Expected: no output (exit code 0). Note this only checks JS syntax, not JSX
— this file has none, so this is a real check here.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors for `src/lib/notes.js`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/notes.js
git commit -m "feat: add place_notes/trip_notes data layer"
```

---

### Task 3: Per-place notes UI

**Files:**

- Create: `src/components/PlaceNoteBox.js`
- Modify: `src/components/ExperienceCard.js:1-29` (imports, props), `:203-204` (render)
- Modify: `src/app/region/[slug]/page.js:8` (import), `:17-20` (hook), `:102-107` (prop)
- Modify: `src/components/CommentBox.js:76` (placeholder copy)
- Modify: `src/app/globals.css` (append note-box styles)

**Interfaces:**

- Consumes: `getPlaceNote`, `upsertPlaceNote` from Task 2's `src/lib/notes.js`; `useUser()` from `src/context/UserContext.js` (exposes `currentUser.id/name/emoji`, matching `CommentBox.js` usage).
- Produces: `<PlaceNoteBox note={note|null} experienceId={string} />` — self-contained, no other task depends on its internals.

- [ ] **Step 1: Create `src/components/PlaceNoteBox.js`**

```jsx
"use client";

import { useState } from "react";
import { useUser } from "@/context/UserContext";
import { upsertPlaceNote } from "@/lib/notes";

function relativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function PlaceNoteBox({ note, experienceId }) {
  const { currentUser } = useUser();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note?.text || "");
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setText(note?.text || "");
    setEditing(true);
  };

  const save = async () => {
    if (!currentUser) return;
    setSaving(true);
    await upsertPlaceNote(currentUser.id, experienceId, text.trim());
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="note-box note-box-editing">
        <textarea
          className="note-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="A practical tip for the family — bring cash, no beef option, meet at the lobby…"
          maxLength={500}
          autoFocus
        />
        <div className="note-box-actions">
          <button className="note-save-btn" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="note-cancel-btn"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!note?.text) {
    return (
      <button
        type="button"
        className="note-box note-box-empty"
        onClick={startEditing}
      >
        📝 No notes yet — add a tip for the family
      </button>
    );
  }

  return (
    <div className="note-box">
      <div className="note-box-header">
        <span className="note-box-label">📝 Notes</span>
        <button type="button" className="note-edit-btn" onClick={startEditing}>
          ✏️ Edit
        </button>
      </div>
      <p className="note-text">{note.text}</p>
      <span className="note-meta">
        — {note.users?.emoji} {note.users?.name}, {relativeTime(note.updated_at)}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `ExperienceCard.js`**

In `src/components/ExperienceCard.js`, add the import alongside the existing
ones (after the `CommentBox` import on line 22):

```js
import PlaceNoteBox from "./PlaceNoteBox";
import { getPlaceNote } from "@/lib/notes";
```

Add a `notes` prop to the component signature (currently lines 24-29):

```jsx
export default function ExperienceCard({
  experience,
  votes,
  ratings,
  comments,
  notes,
}) {
```

Replace the comments block (currently lines 203-204):

```jsx
      {/* Comments */}
      <CommentBox comments={expComments} experienceId={experience.id} />
```

with:

```jsx
      {/* Notes */}
      <PlaceNoteBox
        note={getPlaceNote(notes, experience.id)}
        experienceId={experience.id}
      />

      {/* Comments */}
      <CommentBox comments={expComments} experienceId={experience.id} />
```

- [ ] **Step 3: Fetch and pass place notes from the region page**

In `src/app/region/[slug]/page.js`, change the import on line 8 from:

```js
import { useVotes, useRatings, useComments, useExperiences } from "@/lib/hooks";
```

to:

```js
import { useVotes, useRatings, useComments, useExperiences } from "@/lib/hooks";
import { usePlaceNotes } from "@/lib/notes";
```

Add the hook call after line 19 (`const { comments } = useComments();`):

```js
  const { notes: placeNotes } = usePlaceNotes();
```

Pass it down in the `ExperienceCard` render (currently lines 102-107):

```jsx
            <ExperienceCard
              experience={exp}
              votes={votes}
              ratings={ratings}
              comments={comments}
              notes={placeNotes}
            />
```

- [ ] **Step 4: Disambiguate the comment box's copy**

In `src/components/CommentBox.js` line 76, change:

```jsx
          placeholder="Add a note..."
```

to:

```jsx
          placeholder="Add a comment..."
```

(This box is the voting discussion thread, not the new Notes section — the
old "note" wording now collides with it.)

- [ ] **Step 5: Add CSS**

Append to `src/app/globals.css` (after the `.comment-submit:disabled` rule):

```css
/* --- Place Notes (sticky note) --- */
.note-box {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: rgba(212, 168, 83, 0.1);
  border: 1px solid rgba(212, 168, 83, 0.35);
  border-radius: var(--radius-md);
}

.note-box-empty {
  display: block;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-heading);
  font-size: 0.82rem;
  color: var(--charcoal-light);
  background: var(--stone-light);
  border: 1px dashed var(--stone-dark);
  transition: all var(--duration-fast) var(--ease-out);
}
.note-box-empty:hover {
  border-color: var(--gold);
  color: var(--charcoal-mid);
}

.note-box-editing {
  background: var(--white);
  border-color: var(--stone-mid);
}

.note-box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.note-box-label {
  font-family: var(--font-heading);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--charcoal-mid);
}

.note-edit-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-heading);
  font-size: 0.72rem;
  color: var(--charcoal-light);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}
.note-edit-btn:hover {
  color: var(--wine);
  background: rgba(139, 34, 82, 0.08);
}

.note-text {
  font-size: 0.88rem;
  color: var(--charcoal-mid);
  white-space: pre-wrap;
  word-break: break-word;
}

.note-meta {
  display: block;
  margin-top: var(--space-xs);
  font-family: var(--font-heading);
  font-size: 0.68rem;
  color: var(--charcoal-light);
}

.note-textarea {
  width: 100%;
  min-height: 60px;
  border: 1px solid var(--stone-mid);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  font-family: var(--font-body);
  font-size: 0.88rem;
  outline: none;
  resize: vertical;
  background: var(--stone-light);
}
.note-textarea:focus {
  border-color: var(--wine);
  background: var(--white);
}

.note-box-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.note-save-btn,
.note-cancel-btn {
  font-family: var(--font-heading);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  cursor: pointer;
  border: 1px solid var(--stone-mid);
  background: var(--stone-light);
  color: var(--charcoal-mid);
}
.note-save-btn {
  background: var(--wine);
  border-color: var(--wine);
  color: var(--white);
}
.note-save-btn:hover { background: var(--wine-light); }
.note-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.note-cancel-btn:hover { border-color: var(--stone-dark); }
```

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual verification**

Run: `npm run dev`, open a region page (e.g. `/region/tbilisi`).
Expected: every experience card shows a dashed "📝 No notes yet…" box.
Click it, type a note, Save — it renders as filled with your emoji/name and
"just now". Reload the page — the note is still there. The comment box
below it now says "Add a comment..." as its placeholder.

- [ ] **Step 8: Commit**

```bash
git add src/components/PlaceNoteBox.js src/components/ExperienceCard.js src/app/region/\[slug\]/page.js src/components/CommentBox.js src/app/globals.css
git commit -m "feat: per-place sticky notes on experience cards"
```

---

### Task 4: Calendar-event notes field (data plumbing)

**Files:**

- Modify: `src/lib/itinerary.js:58-70` (`mapDbItem`), `:72-84` (`toDbItem`), `:132-145` (`updateItem`)

**Interfaces:**

- Produces: itinerary items now carry a `notes` field (string or `null`); `updateItem(id, { notes })` persists it. Task 5 consumes this.

- [ ] **Step 1: Add `notes` to `mapDbItem`**

In `src/lib/itinerary.js`, change (lines 58-70):

```js
function mapDbItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    experienceId: row.experience_id,
    transportMode: row.transport_mode,
    title: row.title,
    day: row.day,
    startMin: row.start_min,
    durationMin: row.duration_min,
    createdBy: row.created_by,
  };
}
```

to:

```js
function mapDbItem(row) {
  return {
    id: row.id,
    kind: row.kind,
    experienceId: row.experience_id,
    transportMode: row.transport_mode,
    title: row.title,
    notes: row.notes,
    day: row.day,
    startMin: row.start_min,
    durationMin: row.duration_min,
    createdBy: row.created_by,
  };
}
```

- [ ] **Step 2: Add `notes` to `toDbItem`**

Change (lines 72-84):

```js
function toDbItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    experience_id: item.experienceId ?? null,
    transport_mode: item.transportMode ?? null,
    title: item.title ?? null,
    day: item.day,
    start_min: item.startMin,
    duration_min: item.durationMin,
    created_by: item.createdBy ?? null,
  };
}
```

to:

```js
function toDbItem(item) {
  return {
    id: item.id,
    kind: item.kind,
    experience_id: item.experienceId ?? null,
    transport_mode: item.transportMode ?? null,
    title: item.title ?? null,
    notes: item.notes ?? null,
    day: item.day,
    start_min: item.startMin,
    duration_min: item.durationMin,
    created_by: item.createdBy ?? null,
  };
}
```

- [ ] **Step 3: Add `notes` to `updateItem`'s patch handling**

In the `updateItem` callback (lines 132-145), change:

```js
    if (patch.title !== undefined) db.title = patch.title;
    db.updated_at = new Date().toISOString();
```

to:

```js
    if (patch.title !== undefined) db.title = patch.title;
    if (patch.notes !== undefined) db.notes = patch.notes;
    db.updated_at = new Date().toISOString();
```

- [ ] **Step 4: Verify and lint**

Run: `node --check src/lib/itinerary.js` — expected: no output.
Run: `npm run lint` — expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/itinerary.js
git commit -m "feat: plumb a notes field through itinerary items"
```

---

### Task 5: Calendar-event notes UI

**Files:**

- Modify: `src/app/calendar/page.js:756-775` (`cal-panel` detail view)
- Modify: `src/app/globals.css` (append panel-notes styles)

**Interfaces:**

- Consumes: `selectedItem.notes` (from Task 4), `updateItem` (from `useItinerary()`, already destructured at the top of `CalendarPage`), `editing` (existing computed boolean in this file).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Replace the title-only input with title + notes**

In `src/app/calendar/page.js`, the current block (lines 756-775) is:

```jsx
          {editing && selectedItem.kind !== "place" && (
            <input
              key={selectedItem.id}
              type="text"
              className="comment-input cal-panel-note"
              placeholder={
                selectedItem.kind === "transport"
                  ? "Note, e.g. Tbilisi → Kazbegi"
                  : "Rename this event"
              }
              defaultValue={selectedItem.title || ""}
              maxLength={80}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (selectedItem.title || "")) {
                  updateItem(selectedItem.id, { title: v || null });
                }
              }}
            />
          )}
```

Replace it with:

```jsx
          {editing && selectedItem.kind !== "place" && (
            <input
              key={`title-${selectedItem.id}`}
              type="text"
              className="comment-input cal-panel-note"
              placeholder={
                selectedItem.kind === "transport"
                  ? "Note, e.g. Tbilisi → Kazbegi"
                  : "Rename this event"
              }
              defaultValue={selectedItem.title || ""}
              maxLength={80}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (selectedItem.title || "")) {
                  updateItem(selectedItem.id, { title: v || null });
                }
              }}
            />
          )}
          {editing ? (
            <textarea
              key={`notes-${selectedItem.id}`}
              className="cal-panel-note-textarea"
              placeholder="Notes — meet driver at the lobby, bring cash…"
              defaultValue={selectedItem.notes || ""}
              maxLength={300}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (selectedItem.notes || "")) {
                  updateItem(selectedItem.id, { notes: v || null });
                }
              }}
            />
          ) : (
            selectedItem.notes && (
              <p className="cal-panel-note-readonly">📝 {selectedItem.notes}</p>
            )
          )}
```

(The title-rename input's `key` changed from `selectedItem.id` to
`` `title-${selectedItem.id}` `` purely so it reads unambiguously next to the
new notes field's `` `notes-${selectedItem.id}` `` key — both still force a
remount when a different block is selected, same mechanism as before.)

- [ ] **Step 2: Add CSS**

Append to `src/app/globals.css` (after the `.cal-modal-row select` rule,
before the `@media (max-width: 640px)` calendar block):

```css
.cal-panel-note-textarea {
  width: 100%;
  min-height: 56px;
  border: 1px solid var(--stone-mid);
  border-radius: var(--radius-md);
  background: var(--stone-light);
  padding: var(--space-sm) var(--space-md);
  font-family: var(--font-body);
  font-size: 0.85rem;
  outline: none;
  resize: vertical;
  transition: border-color var(--duration-fast) var(--ease-out);
}
.cal-panel-note-textarea:focus {
  border-color: var(--wine);
  background: var(--white);
}

.cal-panel-note-readonly {
  font-size: 0.85rem;
  color: var(--charcoal-mid);
  background: var(--stone-light);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/calendar`, unlock editing (or use an admin
override), drag a place onto a day, tap it, add a note in the panel, click
away to blur. Reopen the panel — the note persisted. Lock the calendar
(view mode) and tap the same block — the note shows as read-only text, no
textarea. Repeat for a transport block and a custom checkpoint.

- [ ] **Step 5: Commit**

```bash
git add src/app/calendar/page.js src/app/globals.css
git commit -m "feat: notes field on calendar blocks (all kinds)"
```

---

### Task 6: Trip-wide notes page

**Files:**

- Create: `src/app/notes/page.js`
- Modify: `src/components/Navbar.js:25-32` (nav link)
- Modify: `src/app/globals.css` (append trip-notes styles)

**Interfaces:**

- Consumes: `useTripNote`, `upsertTripNote` from Task 2.
- Produces: route `/notes`.

- [ ] **Step 1: Create `src/app/notes/page.js`**

```jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useTripNote, upsertTripNote } from "@/lib/notes";
import Navbar from "@/components/Navbar";

function relativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotesPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const { note, loading } = useTripNote();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (isLoaded && !currentUser) router.push("/");
  }, [isLoaded, currentUser, router]);

  // Only sync in remote changes while the user isn't mid-edit, so an
  // incoming realtime update never clobbers what they're typing.
  useEffect(() => {
    if (!dirty && note) setText(note.text || "");
  }, [note, dirty]);

  const save = async () => {
    if (!currentUser) return;
    setSaving(true);
    await upsertTripNote(currentUser.id, text.trim());
    setSaving(false);
    setDirty(false);
  };

  if (!isLoaded || !currentUser) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <h1>📝 Trip Notes</h1>
          <p className="page-subtitle">
            A shared scratchpad for anything that doesn&apos;t belong to one
            place — packing list, flight details, reminders, whatever the
            family needs to remember.
          </p>
        </div>

        <div className="trip-notes-card">
          <textarea
            className="trip-notes-textarea"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            onBlur={save}
            placeholder="Start typing…"
            disabled={loading}
          />
          <div className="trip-notes-footer">
            {saving
              ? "Saving…"
              : note?.updated_at
              ? `Last edited by ${note.users?.emoji || ""} ${note.users?.name || "someone"}, ${relativeTime(note.updated_at)}`
              : "Nobody has written anything yet."}
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Add the nav link**

In `src/components/Navbar.js`, change (lines 25-32):

```js
  const links = [
    { href: "/dashboard", label: "Regions", icon: "🗺️" },
    { href: "/consensus", label: "Consensus", icon: "📊" },
    { href: "/mockplan", label: "Proposal", icon: "🧭" },
    { href: "/plan", label: "Day Plan", icon: "📋" },
    { href: "/calendar", label: "Calendar", icon: "🗓️" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "🔒" }] : []),
  ];
```

to:

```js
  const links = [
    { href: "/dashboard", label: "Regions", icon: "🗺️" },
    { href: "/consensus", label: "Consensus", icon: "📊" },
    { href: "/mockplan", label: "Proposal", icon: "🧭" },
    { href: "/plan", label: "Day Plan", icon: "📋" },
    { href: "/calendar", label: "Calendar", icon: "🗓️" },
    { href: "/notes", label: "Notes", icon: "📝" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "🔒" }] : []),
  ];
```

- [ ] **Step 3: Add CSS**

Append to `src/app/globals.css`:

```css
/* --- Trip-wide Notes page --- */
.trip-notes-card {
  background: var(--white);
  border: 1px solid var(--stone-mid);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-md);
}

.trip-notes-textarea {
  width: 100%;
  min-height: 50vh;
  border: 1px solid var(--stone-mid);
  border-radius: var(--radius-md);
  background: var(--stone-light);
  padding: var(--space-md);
  font-family: var(--font-body);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--charcoal);
  resize: vertical;
  outline: none;
  transition: border-color var(--duration-fast) var(--ease-out);
}
.trip-notes-textarea:focus {
  border-color: var(--wine);
  background: var(--white);
}

.trip-notes-footer {
  margin-top: var(--space-sm);
  font-family: var(--font-heading);
  font-size: 0.78rem;
  color: var(--charcoal-light);
}
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, click "📝 Notes" in the navbar, type something, click
away to blur (triggers save), reload the page — text and "Last edited by…"
footer persisted correctly.

- [ ] **Step 6: Commit**

```bash
git add src/app/notes/page.js src/components/Navbar.js src/app/globals.css
git commit -m "feat: trip-wide shared notes page"
```

---

### Task 7: Calendar visual polish

**Files:**

- Modify: `src/app/calendar/page.js:31` (`COL_W` constant)
- Modify: `src/app/globals.css` (`.cal-block-name`, `.cal-block-time`, `.cal-block`, `.cal-block.readonly`, `.cal-hour-label`, `.cal-day`, `.cal-day-date`)

No new interactions here — purely visual, and deliberately does **not**
touch `SLOT_PX`/`HEADER_H` (the vertical grid math), since the day-body
background stripe CSS and gutter height are hand-tuned to `SLOT_PX=22` and
touching that has a much larger blast radius than this polish pass needs.
Only the day-column width changes, which is a purely horizontal, low-risk
change.

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Widen day columns**

In `src/app/calendar/page.js` line 31, change:

```js
const COL_W = 140; // fixed day column width
```

to:

```js
const COL_W = 160; // fixed day column width
```

- [ ] **Step 2: Match the CSS day-column width**

In `src/app/globals.css`, in the `.cal-day` rule, change:

```css
.cal-day {
  width: 140px;
  flex: none;
  border-right: 1px solid var(--stone-mid);
}
```

to:

```css
.cal-day {
  width: 160px;
  flex: none;
  border-right: 1px solid var(--stone-mid);
}
```

- [ ] **Step 3: Improve block and label typography**

Change `.cal-block`:

```css
.cal-block {
  position: absolute;
  border-radius: var(--radius-sm);
  border: 1px solid var(--block-color, var(--wine));
  border-left-width: 3px;
  background: color-mix(in srgb, var(--block-color, var(--wine)) 14%, var(--white));
  padding: 3px 6px 8px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none; /* the block itself is always a drag handle */
  z-index: 2;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
.cal-block:active { cursor: grabbing; }
.cal-block.readonly { cursor: pointer; touch-action: auto; }
.cal-block.selected {
  box-shadow: 0 0 0 2px var(--block-color, var(--wine)), var(--shadow-md);
  z-index: 3;
}
```

to:

```css
.cal-block {
  position: absolute;
  border-radius: var(--radius-md);
  border: 1px solid var(--block-color, var(--wine));
  border-left-width: 3px;
  background: color-mix(in srgb, var(--block-color, var(--wine)) 14%, var(--white));
  padding: 4px 7px 9px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none; /* the block itself is always a drag handle */
  z-index: 2;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--duration-fast) var(--ease-out);
}
.cal-block:active { cursor: grabbing; }
.cal-block.readonly {
  cursor: pointer;
  touch-action: auto;
  box-shadow: none;
  opacity: 0.92;
}
.cal-block.selected {
  box-shadow: 0 0 0 2px var(--block-color, var(--wine)), var(--shadow-md);
  z-index: 3;
}
.cal-block.multi-selected {
  outline: 2px dashed var(--block-color, var(--wine));
  outline-offset: 2px;
  z-index: 3;
}
```

Change `.cal-block-name`:

```css
.cal-block-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: 0.68rem;
  font-weight: 600;
  line-height: 1.25;
  color: var(--charcoal);
}
```

to:

```css
.cal-block-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-family: var(--font-heading);
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--charcoal);
}
```

Change `.cal-block-time`:

```css
.cal-block-time {
  display: block;
  font-family: var(--font-heading);
  font-size: 0.6rem;
  color: var(--charcoal-light);
  margin-top: 1px;
}
```

to:

```css
.cal-block-time {
  display: block;
  font-family: var(--font-heading);
  font-size: 0.66rem;
  color: var(--charcoal-light);
  margin-top: 1px;
}
```

Change `.cal-hour-label`:

```css
.cal-hour-label {
  position: absolute;
  right: 6px;
  transform: translateY(-55%);
  font-family: var(--font-heading);
  font-size: 0.62rem;
  color: var(--charcoal-light);
  background: var(--stone-light);
  padding: 0 2px;
}
```

to:

```css
.cal-hour-label {
  position: absolute;
  right: 6px;
  transform: translateY(-55%);
  font-family: var(--font-heading);
  font-size: 0.68rem;
  color: var(--charcoal-mid);
  background: var(--stone-light);
  padding: 0 2px;
}
```

Change `.cal-day-date`:

```css
.cal-day-date {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--charcoal);
}
```

to:

```css
.cal-day-date {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--charcoal);
}
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/calendar`. Block names/times and hour labels are
noticeably more legible than before; day columns have more breathing room;
scroll and drag still work exactly as before (this step is purely visual,
confirm nothing about drag-to-place, resize, or the detail panel broke).

- [ ] **Step 6: Commit**

```bash
git add src/app/calendar/page.js src/app/globals.css
git commit -m "style: calendar typography and spacing polish"
```

---

### Task 8: Calendar rubber-band multi-select

**Files:**

- Modify: `src/app/calendar/page.js` — module-level helper (after `layoutDay`, ~line 81), state/refs (~lines 194-205), `updateDragVisuals` (~lines 358-401), `endDrag` (~lines 420-449), new `dayBodyHandlers` factory (after `resizeHandlers`, ~line 541), block className (~line 705), `.cal-day-body` JSX (~line 697), new overlay div (~line 733)
- Modify: `src/app/globals.css` (append `.cal-select-box`, `.cal-day-body.editing`)

This reuses the file's existing hand-rolled pointer-drag system (`dragRef`,
`startDrag`, `onDragMove`, `endDrag`, `autoScrollLoop`) with a new
`type: "select"` drag, the same way `"move"`, `"resize"`, and `"new"`
already work — no new library, no new drag paradigm.

**Interfaces:**

- Consumes: `TRIP_DAYS`, `COL_W`, `SLOT_MIN`, `SLOT_PX`, `HEADER_H` (existing module-level constants in this file); `blocks` (existing `useMemo` in this component); `editing` (existing computed boolean).
- Produces: `selectedIds` (React state, a `Set` of block ids) — Task 9 consumes this to render the bulk-delete bar and wire the Delete key.

- [ ] **Step 1: Add the pure intersection helper**

In `src/app/calendar/page.js`, after the `layoutDay` function (which ends
just before `const DURATION_OPTIONS = ...` on line 83), add:

```js
// Which block ids does a selection rectangle (in the same content-relative
// px space as `resolveDrop`/`paintPreview` below — i.e. relative to
// daysRef's own top-left, not the viewport) overlap?
function blocksInRect(blocks, rect) {
  return blocks
    .filter((b) => {
      const dayIdx = TRIP_DAYS.indexOf(b.day);
      if (dayIdx === -1) return false;
      const left = dayIdx * COL_W;
      const right = left + COL_W;
      const top = HEADER_H + (b.startMin / SLOT_MIN) * SLOT_PX;
      const bottom = top + (b.durationMin / SLOT_MIN) * SLOT_PX;
      return left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
    })
    .map((b) => b.id);
}
```

- [ ] **Step 2: Verify the helper with a standalone check**

There's no test framework in this repo, so verify this pure function once,
manually, with a throwaway script — it is not kept in the repo.

Create a temporary file `/tmp-check.mjs` (outside the repo's tracked tree —
use the project's scratchpad, not `src/`) with:

```js
const TRIP_DAYS = ["2026-08-03", "2026-08-04"];
const COL_W = 160;
const SLOT_MIN = 30;
const SLOT_PX = 22;
const HEADER_H = 48;

function blocksInRect(blocks, rect) {
  return blocks
    .filter((b) => {
      const dayIdx = TRIP_DAYS.indexOf(b.day);
      if (dayIdx === -1) return false;
      const left = dayIdx * COL_W;
      const right = left + COL_W;
      const top = HEADER_H + (b.startMin / SLOT_MIN) * SLOT_PX;
      const bottom = top + (b.durationMin / SLOT_MIN) * SLOT_PX;
      return left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top;
    })
    .map((b) => b.id);
}

const blocks = [
  { id: "a", day: "2026-08-03", startMin: 540, durationMin: 60 }, // 9-10am, day 0
  { id: "b", day: "2026-08-04", startMin: 600, durationMin: 60 }, // 10-11am, day 1
];

// Box covering day 0 only, 9-11am — should hit "a" only.
console.assert(
  JSON.stringify(blocksInRect(blocks, { left: 0, right: 160, top: HEADER_H, bottom: HEADER_H + 200 })) === '["a"]',
  "expected only a"
);
// Box covering both columns, full height — should hit both.
console.assert(
  JSON.stringify(blocksInRect(blocks, { left: 0, right: 320, top: 0, bottom: 2000 })) === '["a","b"]',
  "expected both"
);
// Box with no overlap — should hit none.
console.assert(
  JSON.stringify(blocksInRect(blocks, { left: 0, right: 160, top: 0, bottom: 10 })) === '[]',
  "expected none"
);
console.log("blocksInRect OK");
```

Run: `node /tmp-check.mjs`
Expected output: `blocksInRect OK` with no assertion failures printed.
Delete the temporary file afterward — it's a one-off check, not a kept test.

- [ ] **Step 3: Add state and a ref**

In the `CalendarPage` component, change (lines 194-198):

```js
  const [selectedId, setSelectedId] = useState(null);
  const [showAddEvent, setShowAddEvent] = useState(false);
  // The calendar always opens locked (view-only) so nobody reorganises
  // the family's plan by accident — editing is an explicit unlock away.
  const [unlocked, setUnlocked] = useState(false);
```

to:

```js
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddEvent, setShowAddEvent] = useState(false);
  // The calendar always opens locked (view-only) so nobody reorganises
  // the family's plan by accident — editing is an explicit unlock away.
  const [unlocked, setUnlocked] = useState(false);
```

Change (lines 200-205):

```js
  const scrollerRef = useRef(null);
  const daysRef = useRef(null);
  const ghostRef = useRef(null);
  const previewRef = useRef(null);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
```

to:

```js
  const scrollerRef = useRef(null);
  const daysRef = useRef(null);
  const ghostRef = useRef(null);
  const previewRef = useRef(null);
  const selectBoxRef = useRef(null);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
```

- [ ] **Step 4: Handle the "select" drag type in `updateDragVisuals`**

The function currently starts (lines 358-379):

```js
  function updateDragVisuals() {
    const d = dragRef.current;
    if (!d || !d.active) return;

    if (d.type === "resize") {
      const rect = daysRef.current.getBoundingClientRect();
      const topMin = d.item.startMin;
      const rawEnd = ((d.y - rect.top - HEADER_H) / SLOT_PX) * SLOT_MIN;
      const duration = clamp(
        Math.round((rawEnd - topMin) / SLOT_MIN) * SLOT_MIN,
        SLOT_MIN,
        1440 - topMin
      );
      d.result = { durationMin: duration };
      paintPreview(
        { dayIdx: TRIP_DAYS.indexOf(d.item.day), startMin: topMin },
        duration,
        d.color
      );
      return;
    }

    if (ghostRef.current) {
```

Insert a new branch between the `resize` block's closing `return; }` and
the `if (ghostRef.current) {` line:

```js
    if (d.type === "select") {
      const rect = daysRef.current.getBoundingClientRect();
      const x0 = clamp(d.startX - rect.left, 0, rect.width);
      const x1 = clamp(d.x - rect.left, 0, rect.width);
      const y0 = clamp(d.startY - rect.top, HEADER_H, rect.height);
      const y1 = clamp(d.y - rect.top, HEADER_H, rect.height);
      const box = {
        left: Math.min(x0, x1),
        right: Math.max(x0, x1),
        top: Math.min(y0, y1),
        bottom: Math.max(y0, y1),
      };
      if (selectBoxRef.current) {
        const el = selectBoxRef.current;
        el.style.display = "block";
        el.style.left = `${box.left}px`;
        el.style.top = `${box.top}px`;
        el.style.width = `${box.right - box.left}px`;
        el.style.height = `${box.bottom - box.top}px`;
      }
      d.result = blocksInRect(blocks, box);
      return;
    }

    if (ghostRef.current) {
```

(`blocks` here is the component's existing `useMemo`-derived array in
scope — `updateDragVisuals` is a plain function declared inside the
component body, same as `resolveDrop`/`paintPreview`, so it already closes
over the current render's `blocks`.)

- [ ] **Step 5: Handle "select" in `endDrag`, and hide the overlay on cleanup**

Current (lines 420-449):

```js
  function endDrag(commit) {
    const d = dragRef.current;
    dragRef.current = null;
    cancelAnimationFrame(rafRef.current);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    if (previewRef.current) previewRef.current.style.display = "none";
    if (d?.dimEl) d.dimEl.style.opacity = "";
    if (!d || !d.active || !commit || !d.result) return d;

    if (d.type === "new") {
      addItem({
        kind: d.payload.kind,
        experienceId: d.payload.experienceId ?? null,
        transportMode: d.payload.transportMode ?? null,
        title: null,
        day: TRIP_DAYS[d.result.dayIdx],
        startMin: d.result.startMin,
        durationMin: d.payload.durationMin,
        createdBy: currentUser?.id ?? null,
      });
    } else if (d.type === "move") {
      updateItem(d.item.id, {
        day: TRIP_DAYS[d.result.dayIdx],
        startMin: d.result.startMin,
      });
    } else if (d.type === "resize") {
      updateItem(d.item.id, { durationMin: d.result.durationMin });
    }
    return d;
  }
```

Change to:

```js
  function endDrag(commit) {
    const d = dragRef.current;
    dragRef.current = null;
    cancelAnimationFrame(rafRef.current);
    if (ghostRef.current) ghostRef.current.style.display = "none";
    if (previewRef.current) previewRef.current.style.display = "none";
    if (selectBoxRef.current) selectBoxRef.current.style.display = "none";
    if (d?.dimEl) d.dimEl.style.opacity = "";
    if (!d || !d.active || !commit || !d.result) return d;

    if (d.type === "new") {
      addItem({
        kind: d.payload.kind,
        experienceId: d.payload.experienceId ?? null,
        transportMode: d.payload.transportMode ?? null,
        title: null,
        day: TRIP_DAYS[d.result.dayIdx],
        startMin: d.result.startMin,
        durationMin: d.payload.durationMin,
        createdBy: currentUser?.id ?? null,
      });
    } else if (d.type === "move") {
      updateItem(d.item.id, {
        day: TRIP_DAYS[d.result.dayIdx],
        startMin: d.result.startMin,
      });
    } else if (d.type === "resize") {
      updateItem(d.item.id, { durationMin: d.result.durationMin });
    } else if (d.type === "select") {
      setSelectedId(null);
      setSelectedIds(new Set(d.result));
    }
    return d;
  }
```

- [ ] **Step 6: Add `dayBodyHandlers`, and clear multi-select on the other three triggers**

After the existing `resizeHandlers` function (ends right before the
`// ---- render ----` comment), add:

```js
  const dayBodyHandlers = (day) => {
    if (!editing) return {};
    return {
      onPointerDown: (e) => {
        // Only start a rubber-band when the pointerdown lands on the empty
        // day surface itself — if it bubbled up from a block or its
        // resize handle, their own handlers already took it (and the
        // resize handle calls stopPropagation()), so bail out here.
        if (e.target !== e.currentTarget) return;
        startDrag(e, { type: "select", day });
      },
      onPointerMove: onDragMove,
      onPointerUp: () => {
        const d = endDrag(true);
        if (d && !d.active) setSelectedIds(new Set());
      },
      onPointerCancel: () => endDrag(false),
    };
  };
```

Then, so a single-block tap always wins over any stale multi-selection, add
`setSelectedIds(new Set());` to `blockEditHandlers`'s and
`resizeHandlers`'s `onPointerUp`. Change:

```js
    onPointerUp: () => {
      const d = endDrag(true);
      // a press without movement = tap → open the detail panel
      if (d && !d.active) setSelectedId(d.item.id);
    },
```

(this appears in `blockEditHandlers`) to:

```js
    onPointerUp: () => {
      const d = endDrag(true);
      // a press without movement = tap → open the detail panel
      if (d && !d.active) {
        setSelectedIds(new Set());
        setSelectedId(d.item.id);
      }
    },
```

And change the equivalent block in `resizeHandlers`:

```js
    onPointerUp: () => {
      const d = endDrag(true);
      // short blocks are mostly handle — let a still tap open the panel too
      if (d && !d.active) setSelectedId(d.item.id);
    },
```

to:

```js
    onPointerUp: () => {
      const d = endDrag(true);
      // short blocks are mostly handle — let a still tap open the panel too
      if (d && !d.active) {
        setSelectedIds(new Set());
        setSelectedId(d.item.id);
      }
    },
```

Finally, the "➕ Checkpoint / event" button also clears multi-select.
Change:

```jsx
            <button className="cal-add-event" onClick={() => setShowAddEvent(true)}>
              ➕ Checkpoint / event
            </button>
```

to:

```jsx
            <button
              className="cal-add-event"
              onClick={() => {
                setSelectedIds(new Set());
                setShowAddEvent(true);
              }}
            >
              ➕ Checkpoint / event
            </button>
```

- [ ] **Step 7: Wire the handlers and multi-selected class into the JSX**

Change the `.cal-day-body` div (currently just `<div className="cal-day-body">`):

```jsx
                    <div className="cal-day-body">
```

to:

```jsx
                    <div
                      className={`cal-day-body ${editing ? "editing" : ""}`}
                      {...dayBodyHandlers(day)}
                    >
```

Change the block's className (currently):

```jsx
                            className={`cal-block ${selectedId === b.id ? "selected" : ""} ${editing ? "" : "readonly"}`}
```

to:

```jsx
                            className={`cal-block ${selectedId === b.id ? "selected" : ""} ${selectedIds.has(b.id) ? "multi-selected" : ""} ${editing ? "" : "readonly"}`}
```

Add the selection-box overlay next to the existing drop preview (currently
`<div className="cal-drop-preview" ref={previewRef} />`):

```jsx
              <div className="cal-drop-preview" ref={previewRef} />
              <div className="cal-select-box" ref={selectBoxRef} />
```

- [ ] **Step 8: Add CSS**

Append to `src/app/globals.css`:

```css
.cal-select-box {
  display: none;
  position: absolute;
  z-index: 6;
  pointer-events: none;
  border: 1.5px solid var(--wine);
  background: rgba(139, 34, 82, 0.08);
  border-radius: var(--radius-sm);
}

.cal-day-body.editing {
  touch-action: none;
}
```

- [ ] **Step 9: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 10: Manual verification**

Run: `npm run dev`, open `/calendar`, unlock editing, schedule 2-3 blocks
on the same day. Click-drag from empty space near/around them (not
starting on a block) — a wine-colored dashed selection rectangle should
follow the drag, and blocks it overlaps get a dashed outline. Release —
the outline persists on the blocks that were inside the box. Click a
single block afterward — the multi-select outline clears and the normal
detail panel opens. Confirm normal drag-to-move and resize on blocks still
work exactly as before (this step only added a new pointerdown path on the
empty day surface, nothing about `.cal-block`'s own handlers changed).

- [ ] **Step 11: Commit**

```bash
git add src/app/calendar/page.js src/app/globals.css
git commit -m "feat: rubber-band multi-select on the calendar grid"
```

---

### Task 9: Bulk delete

**Files:**

- Modify: `src/app/calendar/page.js` — new `useEffect` for the Delete/Backspace key (placed after `const editing = canEdit && unlocked;`, ~line 323), new floating bar JSX (after the existing `{selectedItem && (...)}` block, ~line 793)
- Modify: `src/app/globals.css` (append `.cal-bulk-bar*`)

**Interfaces:**

- Consumes: `selectedIds`/`setSelectedIds` (Task 8), `removeItem` (existing, from `useItinerary()`), `editing` (existing).
- Produces: nothing consumed elsewhere — this is the last task touching this interaction.

- [ ] **Step 1: Add the Delete/Backspace keyboard handler**

In `src/app/calendar/page.js`, right after the line `const editing = canEdit && unlocked;` (and its comment), add:

```js
  // Bulk-delete every rubber-band-selected block with Delete/Backspace,
  // but never while the user is typing in an input/textarea, and never
  // outside edit mode.
  useEffect(() => {
    function handleKeyDown(e) {
      if (!editing || selectedIds.size === 0) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      selectedIds.forEach((id) => removeItem(id));
      setSelectedIds(new Set());
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing, selectedIds, removeItem]);
```

- [ ] **Step 2: Add the floating bulk-action bar**

After the existing block that renders `selectedItem`'s detail panel
(closes with `)}` right before `{showAddEvent && (`), add:

```jsx
      {editing && selectedIds.size > 0 && (
        <div className="cal-bulk-bar">
          <span className="cal-bulk-bar-text">{selectedIds.size} selected</span>
          <div className="cal-bulk-bar-actions">
            <button
              className="cal-bulk-bar-delete"
              onClick={() => {
                selectedIds.forEach((id) => removeItem(id));
                setSelectedIds(new Set());
              }}
            >
              🗑 Delete
            </button>
            <button
              className="cal-bulk-bar-clear"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Add CSS**

Append to `src/app/globals.css`:

```css
.cal-bulk-bar {
  position: fixed;
  left: 50%;
  bottom: var(--space-md);
  transform: translateX(-50%);
  z-index: 150;
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--wine);
  color: var(--white);
  border-radius: var(--radius-full);
  padding: var(--space-sm) var(--space-md) var(--space-sm) var(--space-lg);
  box-shadow: var(--shadow-xl);
  animation: fadeSlideUp 0.2s var(--ease-out);
}

.cal-bulk-bar-text {
  font-family: var(--font-heading);
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.cal-bulk-bar-actions {
  display: flex;
  gap: var(--space-xs);
}

.cal-bulk-bar-delete,
.cal-bulk-bar-clear {
  font-family: var(--font-heading);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.12);
  color: var(--white);
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.cal-bulk-bar-delete {
  background: var(--white);
  color: var(--wine);
  border-color: var(--white);
}
.cal-bulk-bar-delete:hover { background: rgba(255, 255, 255, 0.85); }
.cal-bulk-bar-clear:hover { background: rgba(255, 255, 255, 0.22); }
```

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `/calendar`, unlock editing, rubber-band select 2+
blocks. Expected: a wine-colored floating bar appears bottom-center reading
"N selected" with Delete/Clear buttons. Click "Clear" — bar disappears,
blocks un-highlight, nothing deleted. Rubber-band select again, click
"🗑 Delete" — all selected blocks disappear from the grid and the bar
closes. Rubber-band select a third time, press the Delete key on the
keyboard — same result. Click into the "➕ Checkpoint / event" text input
and press Backspace while editing text — confirm it deletes a character
normally and does *not* trigger bulk delete. Lock the calendar (view mode)
— confirm the bulk bar cannot appear at all (rubber-band select is
edit-mode only per Task 8).

- [ ] **Step 6: Commit**

```bash
git add src/app/calendar/page.js src/app/globals.css
git commit -m "feat: bulk-delete selected calendar blocks"
```

---

### Task 10: End-to-end verification pass

**Files:** none (verification only)

- [ ] **Step 1: Apply the migration**

Open the Supabase dashboard SQL Editor for this project and run the full
contents of `supabase/migration-05-notes.sql` (from Task 1). Confirm no
errors and that `place_notes`, `trip_notes` appear in the table list and
`itinerary_items` now has a `notes` column.

- [ ] **Step 2: Full manual pass**

Run: `npm run dev` and, matching the spec's own verification checklist,
walk through:

- Add/edit/clear a place note on an experience card; confirm it shows and
  survives a reload.
- Add a note to a calendar place block, a transport block, and a custom
  event; confirm each is readable in locked mode and editable once
  unlocked.
- Write something on `/notes`, reload, confirm it persisted with the
  correct "last edited by" line.
- Rubber-band select 2+ calendar blocks, delete via the bulk bar; repeat
  and delete via the Delete key; confirm a plain tap on a single block
  still opens the normal detail panel instead of starting a multi-select.
- Visual pass on `/calendar` at normal desktop width and at a narrow
  (~375px) mobile width — nothing overflows or clips awkwardly.

- [ ] **Step 3: Final lint pass**

Run: `npm run lint`
Expected: no errors across the whole repo.
