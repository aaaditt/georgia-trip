# Catalog content contract (read this fully before writing any file)

Write ONE file: `content/catalog/<region-id>.json`, pretty-printed JSON, 2-space indent, UTF-8.
Do NOT return the JSON in your reply. The file is the deliverable.

## Shape

```json
{
  "region": { "id":"", "name":"", "icon":"", "subtitle":"", "summary":"", "when_to_go":"", "getting_there":"", "base_towns":"", "sort_order":0 },
  "places": [{
    "id":"", "name":"", "hook":"", "description":"", "tips":null, "best_time":null,
    "duration_min":45, "time_needed":"45 min",
    "price_gel_min":null, "price_gel_max":null, "price_lari":"Free",
    "nearest_town":"", "lat":41.688000, "lng":44.809000,
    "kid_note":null, "booking_required":false,
    "tags":["scenic"], "sort_order":1, "guide_script":null
  }]
}
```

The region `id`/`name`/`icon`/`subtitle`/`sort_order` are FROZEN — your dispatch message gives them, use verbatim.
You author `summary` (2-4 sentences), `when_to_go` (season + time of day, heat especially),
`getting_there` (from Tbilisi: how, how long, road quality), `base_towns` (where you'd actually sleep).

## Per-place rules

- `id` lowercase kebab, MUST start with the region slug, globally unique, `^[a-z0-9-]+$`
- `hook` ONE sentence, <=120 chars
- `description` 3-5 sentences: what you actually do and see
- `tips` practical only (closing days, cash-only, queues, scams). `null` if none
- `best_time` `null` if it truly doesn't matter
- `duration_min` positive integer minutes, realistic INCLUDING queueing
- `time_needed` display string that AGREES with duration_min (45 -> "45 min", 150 -> "2.5 hr")
- `price_gel_min`/`price_gel_max` integer GEL per person; BOTH null means free
- `price_lari` display string, include the GEL symbol yourself; exactly "Free" when free.
  The app does NOT prepend a currency symbol.
  **Keep it to 24 characters or fewer** — `₾20`, `₾15-30`, `₾2.5-5`. It renders on one
  line in a card next to the comment count, so it is a price, not a sentence. Every
  condition — per person, per vehicle, children's rates, what is extra, what to confirm
  locally — belongs in `tips`, which wraps freely. A whole research run had to be
  rewritten for getting this wrong.
- `lat`/`lng` 6dp, FOR THE SITE ITSELF not the town centre
- `kid_note` `null` if nothing specific
- `tags` ONLY from: cool kids wine scenic water cave walk hike thrill evening
  (cool = cool/shaded; wine = wine AND food; walk = light, hike = longer; cave = caves AND canyons)
- `sort_order` 1..N, sensible visiting order
- `guide_script` MUST be `null` for every place

## Hard rules — a validator rejects the whole file on any violation

1. every id starts with the region slug and is unique
2. every tag is in the ten-tag vocabulary
3. duration_min is a positive integer
4. price_gel_min <= price_gel_max; both null IF AND ONLY IF price_lari is exactly "Free"
5. lat within 41.0-43.6 AND lng within 40.0-46.7 (Georgia's bounding box)
6. no string contains the literal `$guide$`
7. guide_script is null everywhere
8. price_lari is at most 24 characters
9. no two places anywhere in the catalog share a lat/lng

## Coordinates — the known failure mode

A wrong lat/lng is invisible until a map renders it. A previous run put a hilltop monastery at
its town's coordinates and gave two different activities the same point. Check EVERY coordinate
points at the actual site, and that no two places share a coordinate.

## Research standard

Cross-check every factual claim with WebSearch: prices in GEL (they drift), opening hours and
closing days (many Georgian sites close Mondays), whether a site is currently open or under
renovation, seasonal access. Existing project copy in `src/lib/data.js` and
`docs/collected-trip-data.md` is a DRAFT to verify and improve, never ground truth — replace it
where thin, stale or wrong. If you cannot verify something, say so in your reply; do not invent a number.

## Curation

A useful mix, not N variations on one thing: the unmissable sites, one or two most visitors miss,
somewhere to eat that is a destination rather than a refuel, and at least one bad-weather option.
Durations and kid notes must be honest — a "2 hours" that is really 4 makes the app untrustworthy.

## Reply with (short)

1. file written + place count  2. the 3-5 biggest corrections/findings  3. anything you could NOT verify
