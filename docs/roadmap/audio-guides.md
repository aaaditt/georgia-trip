# Roadmap — Downloadable audio guides

**Status:** Not built. Content (scripts) is being written now; everything below
is deferred until the app is online and stable.

## The idea

Every place in the Georgia catalog gets a 5–10 minute narrated tour guide.
You stand in front of Gergeti Trinity, open the app, hit play, and a warm,
knowledgeable voice tells you what you are looking at — when it was built and
by whom, the story worth knowing, what to notice before you leave.

Two properties matter and shape every decision below:

1. **It works offline.** You are on a mountain with no signal. The audio must
   already be on the device.
2. **It works without a trip.** Someone who found the app and is travelling
   solo should be able to download the Georgia guide and use it. The group
   planner and the guide are separable products that happen to share a
   database.

## What already exists after the current session

`catalog_places` carries the finished narration text and the columns the
pipeline will fill in:

| Column | Filled by |
|---|---|
| `guide_script` | Written now, as part of the content research pass |
| `guide_script_words` | Written now |
| `guide_version` | Bumped when a script is revised, so stale audio is detectable |
| `audio_url` | The TTS pipeline, later |
| `audio_duration_sec` | The TTS pipeline, later |
| `audio_voice` | The TTS pipeline, later |

Because these live on the **global catalog** and not on per-trip rows, one
render serves every trip and every solo user. No schema change is needed to
start rendering audio.

## Script voice

The scripts are being written to a single consistent persona rather than
generated ad hoc per place, because inconsistent narration across 113 places is
immediately obvious and feels cheap.

The persona: a Georgian local who knows the history properly but talks like a
friend walking beside you, not a museum placard. Second person. Present tense
for what you can see, past tense for what happened here. Specific over
sweeping — "the 1783 treaty signed in that room" beats "centuries of history."
One genuine surprise per script. No superlatives stacked on superlatives, no
"nestled," no "hidden gem."

Structure per script, roughly:

1. Arrival — what you are looking at right now, and one sensory detail
2. Origin — when, who, why, and what was happening in Georgia at the time
3. The story — the one thing about this place worth telling properly
4. Look for this — two or three specific details most visitors walk past
5. Before you go — practical closing note, where this sits in the wider trip

## TTS options

Roughly 124,000 words of script, which is about **700,000 characters** and
about **850 minutes** of finished audio.

**ElevenLabs.** Best quality, easiest integration, per-character pricing. At
their published rates a one-time full render of 700k characters lands in the
low hundreds of dollars — verify current pricing before committing, and check
whether a one-off scale/business tier is cheaper than burning monthly quota.
Re-renders after script edits cost again, which is what `guide_version` is for.

**Open-source, self-hosted.** Kokoro, XTTS-v2, F5-TTS, Piper and Chatterbox are
all plausible. Cost drops to GPU time, quality is close but generally not equal
for long-form narration, and you own the pipeline. Worth benchmarking on three
or four real scripts side by side against ElevenLabs before deciding — the gap
on a 90-second sample is much smaller than the gap over eight minutes, where
prosody drift and mispronounced Georgian proper nouns start to show.

**Georgian proper nouns are the real risk** with any engine. Svetitskhoveli,
Tsminda Sameba, Ushguli, Bagrati, qvevri, churchkhela. Budget for a
pronunciation lexicon or inline phoneme overrides, and listen to every render
at least once. This is the step that quietly ruins the whole feature if
skipped.

## Storage and delivery

Rough sizing at 64 kbps mono MP3, which is fine for spoken word:

- ~480 KB per minute → **~400 MB for the full catalog**
- ~40 MB per region

That number decides the download UX: **downloading the whole guide is not an
option**, and neither is bundling audio in the app binary. Download is
per-region, opt-in, with a visible size, and per-place as a fallback for
someone who only wants one.

Supabase Storage is the obvious host — already in the stack, has a CDN, and
public-read on a bucket of static MP3s needs no auth complexity. `audio_url`
holds the public URL.

On device: `expo-file-system` for the download and a local cache directory,
`expo-audio` for playback. Cache entries keyed by `place_id` + `guide_version`
so a script revision invalidates the stale file. A "Downloaded regions" screen
in Account for managing space.

## Playback UX

The Play button belongs on the place detail page
(`app/trip/[tripId]/place/[placeId].tsx`), which the current session creates.
Minimum viable player: play/pause, scrub, 15-second skip, playback speed, and a
persistent mini-player so the audio keeps going while you browse.

Worth considering later, not at first launch:

- **Proximity prompt.** The catalog already stores `lat`/`lng` for every place.
  A foreground geofence could surface "You're at Uplistsikhe — play the guide?"
  This is genuinely delightful and also the single biggest battery and
  permissions cost in the feature. Not for v1.
- **Region overview track.** A 3–4 minute intro per region, played on the drive
  in. Cheap to add — `catalog_regions` would need the same three audio columns.
- **Transcript view.** The script text is already in the database, so showing
  it alongside playback is nearly free and helps accessibility.

## Build order when this starts

1. Benchmark ElevenLabs against two open-source engines on four real scripts,
   including one dense in Georgian proper nouns. Decide.
2. Build the pronunciation lexicon.
3. Render one region (Tbilisi, 12 places) end to end. Listen to all of it.
4. Storage bucket, upload script, populate `audio_url` / `audio_duration_sec`
   / `audio_voice` via a `SECURITY DEFINER` RPC or direct `postgres` update.
5. Player and per-region download on the place page.
6. Render the remaining nine regions.

## Open questions

- Does the guide ship inside this app, or as a separate "Georgia Guide" app
  sharing the same Supabase project? The second is a cleaner story for solo
  users but doubles the release surface.
- Do member-added places (the ones not from the catalog) get any guide
  treatment, or is audio catalog-only? Catalog-only is the sane default.
- Multiple language versions later? The schema would need
  `guide_script`/`audio_url` per locale rather than single columns — worth
  deciding before the first render, because retrofitting is a migration.
