// Generates supabase/migration-10-catalog-<region>.sql from
// content/catalog/*.json. Run: node scripts/build-catalog-sql.mjs
//
// The JSON is the source of truth; the SQL is a build artefact that happens
// to be committed so the user can paste it into the Supabase SQL Editor.
// Never hand-edit the generated files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'content/catalog';
const OUT_DIR = 'supabase';

const REGION_SLUGS = new Set([
  'tbilisi', 'mtskheta', 'kakheti', 'gudauri-kazbegi', 'borjomi-bakuriani',
  'samtskhe-javakheti', 'shida-kartli', 'kutaisi-imereti', 'svaneti', 'batumi-adjara',
]);

const TAGS = new Set([
  'cool', 'kids', 'wine', 'scenic', 'water', 'cave', 'walk', 'hike', 'thrill', 'evening',
]);

// Georgia's bounding box, generously padded. Catches transposed or
// wrong-hemisphere coordinates, which are otherwise invisible until a map
// renders them in the Indian Ocean.
const BOUNDS = { latMin: 41.0, latMax: 43.6, lngMin: 40.0, lngMax: 46.7 };

// Longest price_lari the experience card can show on one line without
// truncating. Set from the content, not guessed: after normalising, the
// longest legitimate value in the catalog is exactly 24 characters
// ("₾25 return (both stages)").
const MAX_PRICE_LARI = 24;

const errors = [];
const seenIds = new Set();
// Two distinct places at the same 6dp coordinate is essentially always a
// reused value rather than a real collision — found in the wild when a kayak
// trip and a rafting trip were both pinned to 42.2205,44.8321. The bounding
// box cannot catch it because both points are legitimately inside Georgia.
const seenCoords = new Map();

/** Single-quoted SQL literal, or NULL. */
function sql(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Dollar-quoted, for the long narration bodies. */
function sqlLong(value) {
  if (!value) return 'NULL';
  if (value.includes('$guide$')) throw new Error('script contains the dollar-quote tag');
  return `$guide$${value}$guide$`;
}

/** Formats numeric value or returns SQL NULL literal. */
function num(value) {
  return value === null || value === undefined ? 'NULL' : String(value);
}

/** Formats boolean value as SQL boolean literal string. */
function bool(value) {
  return value ? 'true' : 'false';
}

/** Formats array of tag strings as PostgreSQL text array literal. */
function tagArray(tags) {
  if (!tags || tags.length === 0) return `'{}'::TEXT[]`;
  return `ARRAY[${tags.map(sql).join(', ')}]::TEXT[]`;
}

/** Counts whitespace-separated words in a text string. */
function wordCount(text) {
  return text ? text.trim().split(/\s+/).length : 0;
}

/** Validates a catalog place schema against strict regional bounds and content rules. */
function validate(regionId, place) {
  const where = `${regionId}/${place.id}`;
  if (!/^[a-z0-9-]+$/.test(place.id)) errors.push(`${where}: id is not lowercase kebab-case`);
  if (!place.id.startsWith(regionId)) errors.push(`${where}: id is not prefixed with its region slug`);
  if (seenIds.has(place.id)) errors.push(`${where}: duplicate id`);
  seenIds.add(place.id);

  for (const tag of place.tags ?? []) {
    if (!TAGS.has(tag)) errors.push(`${where}: unknown tag "${tag}"`);
  }

  if (!Number.isInteger(place.duration_min) || place.duration_min <= 0) {
    errors.push(`${where}: duration_min must be a positive integer`);
  }

  const { price_gel_min: lo, price_gel_max: hi } = place;
  if (lo != null && hi != null && lo > hi) errors.push(`${where}: price_gel_min exceeds price_gel_max`);
  const isFree = lo == null && hi == null;
  if (isFree !== (place.price_lari === 'Free')) {
    errors.push(`${where}: price_lari "${place.price_lari}" disagrees with the numeric price being ${isFree ? 'absent' : 'present'}`);
  }

  // price_lari renders inside the experience card's meta row, a single flex
  // line shared with the comment count and the Details affordance. Research
  // agents naturally write explanatory prices ("₾40-70 per person (tasting
  // only; the wine-and-dine package ...)") and the catalog had grown thirty-six
  // of them, up to 105 characters against a median of 4. The card now clamps to
  // one line, so a long value truncates rather than breaking the layout — but a
  // price truncated mid-sentence is still bad. Keep the value compact and put
  // the conditions in `tips`, which wraps freely on the place page.
  if (place.price_lari != null && place.price_lari.length > MAX_PRICE_LARI) {
    errors.push(
      `${where}: price_lari is ${place.price_lari.length} chars, max ${MAX_PRICE_LARI} — keep the value compact and move the conditions into tips`
    );
  }

  if (place.lat != null && (place.lat < BOUNDS.latMin || place.lat > BOUNDS.latMax)) {
    errors.push(`${where}: lat ${place.lat} is outside Georgia`);
  }
  if (place.lng != null && (place.lng < BOUNDS.lngMin || place.lng > BOUNDS.lngMax)) {
    errors.push(`${where}: lng ${place.lng} is outside Georgia`);
  }

  if (place.lat != null && place.lng != null) {
    const key = `${place.lat},${place.lng}`;
    const firstSeen = seenCoords.get(key);
    if (firstSeen) {
      errors.push(`${where}: shares coordinates ${key} with ${firstSeen} — one of them is a reused value`);
    } else {
      seenCoords.set(key, place.id);
    }
  }

  const words = wordCount(place.guide_script);
  if (words > 0 && (words < 900 || words > 1400)) {
    errors.push(`${where}: guide_script is ${words} words, expected 900-1400`);
  }
}

let totalPlaces = 0;
let totalWords = 0;

// Bodies of each region's migration, reused verbatim to build the single
// combined file below. Built from the same strings as the per-region files so
// the two can never disagree.
const sections = [];

for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const doc = JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8'));
  const { region, places } = doc;

  if (!REGION_SLUGS.has(region.id)) {
    errors.push(`${file}: "${region.id}" is not one of the ten frozen region slugs`);
  }

  const rows = [];
  for (const place of places) {
    validate(region.id, place);
    totalPlaces++;
    totalWords += wordCount(place.guide_script);
    rows.push(
      `  (${sql(place.id)}, ${sql(region.id)}, ${sql(place.name)}, ${sql(place.hook)}, ` +
        `${sql(place.description)}, ${sql(place.tips)}, ${sql(place.best_time)}, ` +
        `${num(place.duration_min)}, ${sql(place.time_needed)}, ` +
        `${num(place.price_gel_min)}, ${num(place.price_gel_max)}, ${sql(place.price_lari)}, ` +
        `${sql(place.nearest_town)}, ${num(place.lat)}, ${num(place.lng)}, ` +
        `${sql(place.kid_note)}, ${bool(place.booking_required)}, ${tagArray(place.tags)}, ` +
        `${num(place.sort_order)}, ${sqlLong(place.guide_script)}, ${num(wordCount(place.guide_script) || null)})`
    );
  }

  const body = `UPDATE catalog_regions SET
  subtitle      = ${sql(region.subtitle)},
  summary       = ${sql(region.summary)},
  when_to_go    = ${sql(region.when_to_go)},
  getting_there = ${sql(region.getting_there)},
  base_towns    = ${sql(region.base_towns)}
WHERE id = ${sql(region.id)};

INSERT INTO catalog_places (
  id, region_id, name, hook, description, tips, best_time,
  duration_min, time_needed, price_gel_min, price_gel_max, price_lari,
  nearest_town, lat, lng, kid_note, booking_required, tags, sort_order,
  guide_script, guide_script_words
) VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO NOTHING;
`;

  sections.push({ region, places, body });

  const out = `-- Migration 10 — Georgia catalog places: ${region.name}
--
-- GENERATED FILE. Source of truth is content/catalog/${region.id}.json.
-- Regenerate with: node scripts/build-catalog-sql.mjs
-- Do not hand-edit — your changes will be overwritten.
--
-- Run in Supabase Dashboard > SQL Editor after migration-09. Idempotent:
-- re-running is a no-op, and it will not overwrite an edited row.

${body}
-- Expect ${places.length}.
SELECT count(*) AS ${region.id.replace(/-/g, '_')}_places
  FROM catalog_places WHERE region_id = ${sql(region.id)};
`;

  writeFileSync(join(OUT_DIR, `migration-10-catalog-${region.id}.sql`), out);
  console.log(`${region.id.padEnd(20)} ${String(places.length).padStart(3)} places`);
}

if (errors.length > 0) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}

// One combined file, because pasting ten files into the SQL Editor one at a
// time is where a step gets skipped. Written only after the validation gate
// above passes, so the single-paste file is never produced from a catalog that
// failed — if validation fails the previous, known-good copy is left alone.
// Wrapped in a transaction: all ten regions land or none do.
const combined = `-- Migration 10 — Georgia catalog places: ALL TEN REGIONS
--
-- GENERATED FILE. Source of truth is content/catalog/*.json.
-- Regenerate with: node scripts/build-catalog-sql.mjs
-- Do not hand-edit — your changes will be overwritten.
--
-- This is the ten per-region migration-10 files concatenated in one
-- transaction, for a single paste into Supabase Dashboard > SQL Editor.
-- Run it after migration-09 (or after migration-00-bootstrap-all).
--
-- Idempotent: every INSERT is ON CONFLICT (id) DO NOTHING, so re-running is a
-- no-op and will not overwrite a row you have since edited by hand. The
-- UPDATEs to catalog_regions DO overwrite, which is intended — the region
-- prose is generated content.
--
-- Expect ${totalPlaces} places across ${sections.length} regions.

BEGIN;

${sections
  .map(
    ({ region, places, body }) =>
      `-- ${'='.repeat(66)}
-- ${region.name} — ${places.length} places
-- ${'='.repeat(66)}

${body}`
  )
  .join('\n')}
COMMIT;

-- Verification. Expect ${sections.length} rows summing to ${totalPlaces}, and no region at 0.
SELECT r.sort_order,
       r.id                AS region,
       count(p.id)         AS places
  FROM catalog_regions r
  LEFT JOIN catalog_places p ON p.region_id = r.id
 GROUP BY r.sort_order, r.id
 ORDER BY r.sort_order;

SELECT count(*) AS total_places FROM catalog_places;
`;

writeFileSync(join(OUT_DIR, 'migration-10-catalog-ALL.sql'), combined);

console.log(`\n${totalPlaces} places, ${totalWords.toLocaleString()} script words. OK.`);
console.log(`Combined single-paste file: ${join(OUT_DIR, 'migration-10-catalog-ALL.sql')}`);
