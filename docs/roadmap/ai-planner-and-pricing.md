# Roadmap — AI trip planner and pricing plans

**Status:** Not built, and deliberately not scheduled. This is a written-down
idea, not a commitment. The gate is explicit: get the app online, get real
users, and build this **only if users ask for it**.

## The idea

The original Georgia trip had a plan drafted by hand — 13 days, regions
sequenced sensibly, drive times that worked, everyone's preferences balanced.
That is exactly the kind of work an LLM does well, and the app already holds
every input it would need.

A user with a trip taps "Draft a plan with AI." The model reads the catalog,
the trip's dates, and how the group actually voted, and returns a day-by-day
itinerary written into the calendar as editable items — a starting point the
group then argues with, not a final answer.

## Why the data is already the right shape

This is the part worth recording, because it is not an accident and should not
be broken by later work.

`catalog_places` is a structured, queryable table of ~113 rows with, per place:
region, duration in minutes, price range in GEL, coordinates, tags, best time
of day or season, and booking requirements. That is very close to an ideal LLM
planning input — small enough to fit in a prompt in full, structured enough to
reason over, and with the two fields that make sequencing possible at all
(`duration_min` and `lat`/`lng`).

The trip side adds: `start_date`/`end_date`, the shortlisted regions
(`regions.is_selected`), and per-member `votes` (go/maybe/skip) and `ratings`.
So the planner's context is roughly:

```
catalog places for the trip's selected regions   (~40 rows, structured)
+ trip dates and day count
+ per-place vote tallies and average ratings
+ group composition (adults/kids from trip_members)
→ a day-by-day itinerary
```

Output should be structured — a JSON array of
`{ day, start_min, duration_min, place_id | transport | custom, title }` —
mapping directly onto `itinerary_items`, which already exists and already has
an `add_itinerary_item` RPC. The AI planner would write through that same RPC,
so it inherits the existing authorization and needs no new write path.

**Design rule to protect:** keep `catalog_places` structured and keep
`duration_min` and coordinates populated. Both exist for the calendar today and
are what would make this feature cheap later.

## Where it would run

Not on the device, and not with a key shipped in the app.

Two plausible homes:

- **Supabase Edge Function.** Same project, same auth, straightforward access
  to the tables. Natural fit.
- **A route on the existing Vercel project.** The repo is already linked to
  Vercel (`.vercel/project.json`). Vercel AI Gateway would give provider
  fallbacks and observability without hardcoding a provider SDK, and AI SDK
  streaming works on the default Node runtime.

Either way the flow is: client calls the endpoint with a trip id → endpoint
verifies membership → reads the trip's data server-side → calls the model →
validates the structured output against real `place_id`s and the trip's actual
date range → writes `itinerary_items`. That validation step is not optional;
an unvalidated model response will happily invent a place id or schedule a day
outside the trip.

## Cost shape

A single plan draft is a small request by modern standards — roughly 40 catalog
rows plus vote tallies in, a day-by-day itinerary out. Call it a few cents of
tokens per draft, and assume users redraft two or three times before they like
it. The cost driver is not any single plan; it is unbounded redrafting.

That is the actual argument for metering, and it should be framed to users that
way rather than as an arbitrary paywall.

## Pricing, if it ever happens

Sketch only.

| Tier | Shape |
|---|---|
| Free | The whole planner as it exists today: unlimited trips, members, voting, calendar, notes, and the full Georgia catalog. No AI. |
| Paid | AI plan drafting with a monthly draft allowance, per trip or per account. |

Principles worth holding to:

- **Never paywall what is free today.** The catalog, voting and the calendar
  are the product. Charging for them later would be a bait-and-switch on
  existing users.
- **Charge for the metered thing.** AI drafting has a real marginal cost;
  that is a defensible thing to charge for and an easy one to explain.
- **One trip owner pays, the whole trip benefits.** Charging every member of an
  eight-person family trip is hostile and would kill adoption. Bill the trip,
  not the seat.
- **Ship a free allowance.** A couple of free drafts per trip lets people see
  the value before deciding, and most groups will never exceed it.

Mechanically: Stripe, a `subscriptions` table keyed by trip or account, a
`ai_usage` ledger for metering, and the RPC pattern this codebase already uses
for every write. Store price ids and never trust a client-supplied plan.

The audio guides are a separate question and probably should **not** be behind
this same paywall — they are the thing most likely to attract users who are not
planning a group trip at all, and they cost nothing marginal to serve once
rendered.

## What has to be true before building any of this

1. The app is live and people are using it.
2. Users have actually asked for AI planning, unprompted, more than once.
3. There is enough usage that the metering conversation is real rather than
   hypothetical.

Until all three hold, this document is the whole feature.
