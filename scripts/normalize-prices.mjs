// One-off content migration: make `price_lari` a compact display value.
//
// Why: price_lari is rendered in the experience card's meta row, which is a
// single flex row also holding the comment count and the Details affordance.
// The catalog had grown price strings up to 105 characters ("₾40-70 per
// person (tasting only; the wine-and-dine package with a meal costs more —
// confirm when booking)") against a median of 4 ("Free"). The card is now
// clamped to one line so it cannot break, but truncating mid-sentence is a
// poor way to show a price — the value itself should be short.
//
// The nuance is not thrown away. For every entry below, either the detail was
// already present in `tips` (verified by reading all thirty), or a carry-over
// sentence is appended here. Each carry-over is guarded by a word that must be
// ABSENT from the existing tips, so re-running this script cannot duplicate a
// sentence.
//
// Run: node scripts/normalize-prices.mjs
// Then: node scripts/build-catalog-sql.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CONTENT_DIR = 'content/catalog';

// short  — the replacement price_lari
// carry  — sentence appended to tips, only when `guard` is absent from tips
// guard  — substring whose presence proves the detail is already in tips
const PLAN = {
  'batumi-adjara-botanical-garden': { short: '₾10-20' },
  'borjomi-bakuriani-central-park': { short: '₾5' },
  'borjomi-bakuriani-ropeway': { short: '₾15-25' },
  'borjomi-bakuriani-sulfur-pools': { short: '₾15' },
  'borjomi-bakuriani-alpine-coaster': {
    short: '₾15-30',
    guard: 'per ride',
    carry: 'The fare is charged per ride, not as a day pass.',
  },
  'borjomi-bakuriani-skiing': { short: '₾28-55' },
  'borjomi-bakuriani-joyland': {
    short: '₾10-30',
    guard: 'depends on',
    carry: 'What you pay depends on which activities you actually do.',
  },
  'gudauri-kazbegi-gergeti-trinity': { short: '₾15-30' },
  'gudauri-kazbegi-truso-valley': { short: '₾40-100' },
  'gudauri-kazbegi-paragliding': { short: '₾100-250' },
  'gudauri-kazbegi-horse-riding': {
    short: '₾130-250',
    guard: 'route',
    carry: 'The price swings with the route and how long you ride — agree it before setting off.',
  },
  'gudauri-kazbegi-rooms-restaurant': {
    short: '₾40-90',
    guard: 'main course',
    carry: 'Reckon on ₾40-90 for a main course.',
  },
  'kakheti-pheasants-tears': {
    short: '₾40-80',
    guard: 'wine is',
    carry: 'Around ₾40-80 a head for dinner, and wine is charged on top.',
  },
  'kakheti-khareba-kids': { short: '₾30-55' },
  'kutaisi-imereti-prometheus-cave': { short: '₾40-70' },
  'kutaisi-imereti-sataplia': {
    short: '₾30',
    guard: '5.50',
    carry: 'Children aged 6-18 pay ₾5.50, and under-6s are free.',
  },
  'kutaisi-imereti-okatse-canyon': {
    short: '₾20',
    guard: '5.50',
    carry: 'Children aged 6-18 pay ₾5.50.',
  },
  'kutaisi-imereti-martvili-canyon': { short: '₾20-40' },
  'kutaisi-imereti-baias-wine': { short: '₾40-70' },
  'mtskheta-mukhrani': { short: '₾15-35' },
  'mtskheta-zhinvali-kayak': { short: '₾40-60' },
  'samtskhe-javakheti-rabati': { short: '₾15-20' },
  'samtskhe-javakheti-vardzia': { short: '₾15' },
  'samtskhe-javakheti-abastumani-observatory': { short: '₾20-40' },
  'samtskhe-javakheti-sakalmakhe': { short: '₾25-45' },
  'shida-kartli-stalin-museum': { short: '₾5-15' },
  'shida-kartli-gori-museum': {
    short: '₾3',
    guard: 'student',
    carry: 'Students and schoolchildren pay less than the ₾3 adult rate.',
  },
  'shida-kartli-chinebuli': { short: '₾20-30' },
  'shida-kartli-uplistsikhe': { short: '₾7-15' },
  'svaneti-cafe-laila': {
    short: '₾25-45',
    guard: 'estimate',
    carry: 'The ₾25-45 a head is an estimate from reviews rather than a published menu — check prices when you order.',
  },

  // Second pass. These six were missed on the first pass because the survey
  // that produced the list above was truncated by a `head` limit, so Tbilisi
  // and part of Svaneti never appeared in it. All six already state the full
  // detail in their tips, so none needs a carry-over sentence.
  'svaneti-museum': { short: '₾7-10' },
  'svaneti-koruldi-lakes': { short: '₾60-250' },
  // Kept at 2.5 rather than derived from price_gel_min (3): the cable car
  // genuinely costs ₾2.5 one-way, and the integer GEL columns cannot hold it.
  // The display string is the honest one.
  'tbilisi-narikala': { short: '₾2.5-5' },
  'tbilisi-sulfur-baths': { short: '₾15-200' },
  'tbilisi-mtatsminda': { short: '₾10-40' },
  'tbilisi-keto-kote': { short: '₾45-80' },
};

let changed = 0;
let carried = 0;
let skipped = 0;
const unseen = new Set(Object.keys(PLAN));

for (const file of readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.json')).sort()) {
  const path = join(CONTENT_DIR, file);
  const doc = JSON.parse(readFileSync(path, 'utf8'));
  let dirty = false;

  for (const place of doc.places) {
    // Normalise en-dashes in every price, not just the planned ones, so the
    // catalog is punctuation-consistent.
    if (place.price_lari && place.price_lari.includes('–')) {
      place.price_lari = place.price_lari.replace(/–/g, '-');
      dirty = true;
    }

    const plan = PLAN[place.id];
    if (!plan) continue;
    unseen.delete(place.id);

    if (place.price_lari === plan.short) {
      skipped++;
      continue;
    }

    if (plan.carry) {
      const tips = place.tips ?? '';
      if (!tips.toLowerCase().includes(plan.guard.toLowerCase())) {
        place.tips = tips ? `${tips.trimEnd()} ${plan.carry}` : plan.carry;
        carried++;
      }
    }

    place.price_lari = plan.short;
    changed++;
    dirty = true;
  }

  if (dirty) writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
}

console.log(`price_lari shortened on ${changed} place(s); ${carried} carry-over tip(s) appended; ${skipped} already short.`);
if (unseen.size > 0) {
  console.error(`\nERROR: ${unseen.size} planned id(s) matched no place — the plan is stale:`);
  for (const id of unseen) console.error('  ' + id);
  process.exit(1);
}
