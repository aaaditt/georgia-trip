# Georgia catalog, region opt-in, and trip-creation redesign

**Date:** 2026-08-23
**Status:** Approved, ready for implementation planning

## Why

The mobile rewrite (`mobile/`) generalised the original one-off Georgia trip
into an "any destination, any trip" planner. That was the wrong direction.
Everyone using this app is going to Georgia (the country). The destination is
not a variable — the *dates* and *which parts of Georgia this group cares
about* are.

Today a new trip starts completely empty: zero regions, zero places, and the
only way to populate it is `add_region` / `add_experience`, one at a time, by
hand. Meanwhile `src/lib/data.js` at the repo root holds real curated research
for 8 Georgian regions and 57 places that no new trip can reach.

This design ports that research into the mobile app's schema, expands it to a
genuinely useful level of per-place detail, seeds it automatically into every
new trip, and adds a region opt-in step so a group planning Tbilisi + Batumi
isn't asked to vote on 113 places.

## Decisions

| Question | Decision |
|---|---|
| Region opt-in model | Shared trip-level shortlist, editable by any member; nothing is ever locked |
| Catalog storage | Global `catalog_regions` / `catalog_places` tables, copied into each trip on create |
| Content scope | 10 regions, ~113 places (existing 8 rebalanced + Batumi/Adjara + Samtskhe-Javakheti; Uplistsikhe promoted to Shida Kartli) |
| Date picker | Hand-built range calendar, no new dependency |
| Per-place detail | Structured practical fields (hook, description, tips, best time, duration, coords, kid note, booking) |
| Prices | Authoritative lari display string + numeric GEL min/max; legacy ₹/AED columns untouched but unused |
| Create flow | 3-step wizard: name → dates → regions |
| Existing trips | Untouched; manual "Add Georgia's places" import action |
| Audio guide content | Full 5–10 minute narration script written now for all ~113 places |

## Non-goals

- Building the TTS pipeline, audio player, or offline download (documented in
  `docs/roadmap/audio-guides.md`, not built).
- Building the AI trip planner or any pricing/billing (documented in
  `docs/roadmap/ai-planner-and-pricing.md`, not built).
- Changing the original Next.js web app at the repo root. It is superseded by
  `mobile/` and is not part of this work.
- Backfilling or migrating the legacy `Georgia 2026` trip's data.

## Architecture

### Constraint that shapes everything: every write is an RPC

`supabase/migration-08-rls-workaround-rpcs.sql` exists because RLS enforcement
rejects writes for the `authenticated` role even under a trivially-true
policy — a confirmed Supabase platform bug. Every insert/update/delete in this
app goes through a `SECURITY DEFINER` function owned by `postgres`.

For seeding this is not merely a constraint but a design driver: copying ~113
rows from the client would be ~113 RPC round-trips. Seeding must happen
**server-side in a single function call**.

### Constraint two: region and place ids are globally unique

`regions.id` and `experiences.id` are `TEXT PRIMARY KEY`. Migration 06 added
`trip_id` as a plain column but never made the primary key composite. Two
trips therefore cannot both own a region with id `'tbilisi'`. This is why
`addRegion()` in `mobile/src/lib/hooks.ts` appends `Date.now().toString(36)`
to its slug.

Making the key composite would break the `experience_id` foreign keys in
`votes`, `ratings`, `comments`, `itinerary_items` and `place_notes` — five
tables — so it stays as-is. Seeded rows instead mint per-trip ids of the form
`<catalog_slug>-<trip_uuid>` and carry a `catalog_place_id` backlink.

### Data model

Two new global tables. These are reference data, not trip-scoped, and are
readable by any authenticated user whether or not they belong to a trip —
which is what lets the create wizard show the region grid *before the trip
exists*.

```sql
catalog_regions (
  id TEXT PRIMARY KEY,          -- 'tbilisi', 'batumi-adjara', …
  name, icon, subtitle,
  summary        TEXT,          -- the region's what/why paragraph
  when_to_go     TEXT,          -- season and heat guidance
  getting_there  TEXT,          -- access and drive times
  base_towns     TEXT,          -- where you would sleep
  sort_order INT, is_active BOOLEAN
)

catalog_places (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES catalog_regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hook           TEXT,          -- one line, why you would go
  description    TEXT,          -- 3–5 sentences
  tips           TEXT,          -- closing days, cash-only, book ahead, crowds
  best_time      TEXT,          -- time of day and/or season
  duration_min   INT,           -- structured; the calendar's default block
  time_needed    TEXT,          -- human display, e.g. '1–1.5 hr'
  price_gel_min  INT,           -- NULL means free
  price_gel_max  INT,
  price_lari     TEXT,          -- display string, e.g. '₾20 + ₾15 boat'
  nearest_town   TEXT,
  lat NUMERIC(9,6), lng NUMERIC(9,6),
  kid_note       TEXT,
  booking_required BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT,
  -- audio guide (content written now, playback built later)
  guide_script       TEXT,
  guide_script_words INT,
  guide_version      INT NOT NULL DEFAULT 1,
  audio_url          TEXT,
  audio_duration_sec INT,
  audio_voice        TEXT
)
```

RLS is enabled on both with a single `SELECT TO authenticated USING (true)`
policy and no write policies — content ships via migration under the
`postgres` role.

The audio guide lives on the catalog rather than on per-trip rows because a
narration of Gergeti Trinity is identical for every group, and the stated
long-term goal is that someone can download the guide without being in a trip
at all.

Additive columns on the existing per-trip tables mirror the catalog fields and
add the backlink:

- `regions` += `catalog_region_id`, `summary`, `when_to_go`, `getting_there`,
  `base_towns`, `is_selected BOOLEAN NOT NULL DEFAULT false`, `selected_at`,
  `selected_by`
- `experiences` += `catalog_place_id`, `hook`, `tips`, `best_time`,
  `duration_min`, `price_gel_min`, `price_gel_max`, `nearest_town`, `lat`,
  `lng`, `kid_note`, `booking_required`
- Partial unique indexes on `(trip_id, catalog_region_id)` and
  `(trip_id, catalog_place_id)` make seeding idempotent

Mirroring rather than always joining to the catalog is deliberate. A copied row
stays independently editable by trip members, and every existing hook is
`select('*').eq('trip_id', …)` — so all of them keep working with no query
changes. The backlink exists for idempotency, a future catalog refresh, and the
audio join.

### Server functions

All follow the migration-08 pattern: owned by `postgres`, `SECURITY DEFINER`,
`SET search_path = ''`, re-implementing the corresponding RLS policy's own
authorization check in the function body, then
`REVOKE EXECUTE … FROM PUBLIC, anon` and `GRANT EXECUTE … TO authenticated`.

| Function | Purpose | Auth check |
|---|---|---|
| `create_georgia_trip(name, start, end, region_ids[])` | Atomic: insert the trip with `destination='Georgia'`, `cover_emoji='🇬🇪'`, then seed. Returns trip id. | `auth.uid()` is the creator |
| `seed_trip_catalog(trip_id, region_ids[])` | Copy all catalog regions and places into the trip, marking `is_selected` for the picked ones. `ON CONFLICT DO NOTHING`. Also serves the manual import. | `private.is_trip_member` |
| `set_trip_region_selected(region_id, selected)` | Toggle a region into or out of the trip's shortlist. | member of that region's trip |

The existing `create_trip(TEXT, TEXT, DATE, DATE)` is left in place untouched.

### Selection semantics

`regions.is_selected` marks the trip's shortlist. It gates *emphasis and
prompting*, never access:

- Dashboard splits into "Our regions" (selected) and "Explore all of Georgia"
  (the rest, with an "Add to our trip" action).
- Voting progress, consensus, and the plan tab count only selected regions.
- Every place in the catalog stays browsable and votable by anyone at any time.

### The calendar-gate hazard

`mobile/src/lib/access.ts:8` — `hasCompletedVoting()` requires a member to have
voted on *every* row in `experiences` before the calendar unlocks. Seeding ~113
places into a trip would permanently lock the calendar for everyone. The gate
must be re-scoped to experiences in selected regions. This is a direct
consequence of the seeding work, not optional polish.

## Content

Ten regions, ~113 places. Research is web-cross-checked; where the original
`data.js` copy is thin, stale, or wrong it is corrected rather than ported
faithfully.

| Region | id | Now | Target |
|---|---|---|---|
| Tbilisi | `tbilisi` | 10 | 12 |
| Mtskheta & the Military Highway | `mtskheta` | 5 | 10 |
| Kakheti | `kakheti` | 8 | 12 |
| Gudauri & Kazbegi | `gudauri-kazbegi` | 10 | 12 |
| Borjomi & Bakuriani | `borjomi-bakuriani` | 4 | 11 |
| Samtskhe-Javakheti (Vardzia, Rabati) | `samtskhe-javakheti` | — | 10 |
| Shida Kartli (Gori, Uplistsikhe) | `shida-kartli` | 2 | 10 |
| Kutaisi & Imereti | `kutaisi-imereti` | 9 | 12 |
| Svaneti (Mestia, Ushguli) | `svaneti` | 9 | 12 |
| Batumi & Adjara | `batumi-adjara` | — | 12 |

Each place also gets a complete 5–10 minute tour-guide narration script
(~1,100 words, ~124k words total). Written in a warm, historically grounded,
second-person voice: what you are standing in front of, when and why it was
built, the story worth knowing, and what to look for before you leave. These
become the scripts the TTS pipeline reads; see `docs/roadmap/audio-guides.md`.

Because of the volume, seed data is split into per-region SQL files rather than
one migration, each self-contained and pasteable into the Supabase SQL Editor,
with script bodies dollar-quoted (`$md$ … $md$`) to avoid escaping problems.

## App changes

### Data layer

- **new** `mobile/src/lib/catalog.ts` — `useCatalogRegions()` (pre-trip),
  `seedTripCatalog()`, `setRegionSelected()`
- `mobile/src/lib/hooks.ts` — extend `Region` and `Experience` types and their
  mappers with the new fields; `useRegions()` also returns selected/unselected
  splits
- `mobile/src/lib/access.ts` — `hasCompletedVoting()` scoped to selected regions
- `mobile/src/lib/itinerary.ts` — `parseDefaultDuration()` prefers the
  structured `duration_min`, keeping the regex as fallback for member-added
  places

### Screens and components

| File | Change |
|---|---|
| **new** `components/date-range-calendar.tsx` | Hand-built month grid, range shading, day-count pill, existing theme tokens |
| **new** `components/region-picker-grid.tsx` | Shared by the wizard's step 3 and the dashboard's Edit |
| **new** `components/screen.tsx` | Safe-area wrapper |
| **new** `app/trip/[tripId]/explore.tsx` | Browse the full catalog; add a region to the trip |
| **new** `app/trip/[tripId]/place/[placeId].tsx` | Full place info page |
| `app/(trips)/create.tsx` | 3-step wizard; destination field deleted |
| `app/trip/[tripId]/(tabs)/dashboard.tsx` | Our regions / Explore split; scoped progress; import CTA |
| `app/trip/[tripId]/region/[regionId].tsx` | Region header fields; add-to-trip toggle |
| `components/experience-card.tsx` | Summary card that taps through to the place page; fix the `₾Free` rendering bug |

The place detail screen is new because the card cannot carry hook, description,
tips, best time, kid note and coordinates *alongside* voting, ratings, comments
and notes and stay readable inside a `FlatList`. The card becomes a scannable
summary; the page holds the detail. It is also where the audio Play button
lands later.

### Safe area

`react-native-safe-area-context@5.7.0` is installed but used nowhere in
`mobile/src`, and `SafeAreaProvider` is absent from the root layout — so
`useSafeAreaInsets()` would return zeros today. Every route group sets
`headerShown: false`, so all 11 headerless screens collide with the notch.

Fix: add `SafeAreaProvider` and `<StatusBar>` to `app/_layout.tsx`, then apply
one `<Screen edges={…}>` wrapper across the affected screens —
`['top','bottom']` for the auth and trips groups, `['top']` for the five tab
screens (the tab bar owns the bottom inset), `['bottom']` for the two screens
that already have native headers. The stub `BottomTabInset = 0` in
`constants/theme.ts` is removed.

## Testing

- `npx tsc --noEmit` and `npm run lint` in `mobile/`
- Migration files written idempotent (`IF NOT EXISTS`, `ON CONFLICT DO
  NOTHING`, `CREATE OR REPLACE`) and safe to re-run, with a verification query
  block at the end of the schema migration
- Migrations cannot be executed from this environment — no Supabase CLI or
  service-role access. They are handed over as paste-ready files for the
  Supabase SQL Editor, matching how migrations 01–08 were run.

## Rollout

1. `migration-09-georgia-catalog.sql` — schema, indexes, RLS, RPCs, region rows
2. `migration-10-catalog-<region>.sql` × 10 — places and guide scripts
3. App changes; existing trips keep working untouched throughout
4. Any existing trip can pull the catalog in via the dashboard import action

## Follow-ups, not in scope

- Getting the app online (EAS build and store submission) is the next milestone
  after this work.
- `docs/roadmap/audio-guides.md`
- `docs/roadmap/ai-planner-and-pricing.md`
