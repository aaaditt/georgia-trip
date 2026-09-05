# Store submission — Wonder Georgia

Scope added 2026-09-03. The implementation plan (`docs/superpowers/plans/2026-08-23-georgia-catalog.md`)
explicitly excluded EAS builds and store submission, so this file tracks it instead.

> **Decision, 2026-09-05: Google Play only.** One-time 25 USD, no recurring fee.
> Apple is out of scope — 99 USD/year is unavoidable for iOS in any form, including
> TestFlight, and is not worth it for this app right now. Nothing here forecloses it:
> the iOS config in `app.json` is left in place and inert, so adding Apple later is
> a purchase and a build, not a rewrite.

Everything marked **YOU** needs an account, a credential, a device or a judgement
call that is not mine to make. Everything marked **DONE** was verified against the
actual code or config, not assumed.

---

## 1. Where we already stand

| Item | State | Evidence |
|---|---|---|
| EAS project linked | **DONE** | `mobile/app.json` → `extra.eas.projectId`, owner `aaaditts-team` |
| App name | **DONE** | `Wonder Georgia` — applied to app.json, web `<title>`, legal pages, listing copy |
| Android package | **DONE** | `com.aaaditt.tripplanner` |
| App icon | **DONE** | Adaptive icon with foreground, background *and* monochrome layers — Play requires the mono layer for themed icons |
| Splash screen | **DONE** | `expo-splash-screen` plugin configured |
| Build profiles | **DONE** | `mobile/eas.json` — development, preview, production (`autoIncrement: true`) |
| Version source | **DONE** | `appVersionSource: "remote"` — EAS owns the version code, so you never bump it by hand |
| In-app account deletion | **DONE** | `account.tsx:34-53` → `supabase.rpc('delete_own_account')`. Play requires this for any app with accounts, same as Apple |
| Content reporting + user blocking | **DONE** | `src/lib/moderation.ts` — `reportComment`, `blockMember`, `unblockMember`. Needed for the UGC content-rating answers |
| Privacy policy URL | **DONE** | `/privacy` on the Vercel deployment — publicly reachable, no login. Play **requires** this |
| Support URL | **DONE** | `/support` on the Vercel deployment |

Account deletion and UGC moderation were both already implemented. Those are the two
things most likely to bounce an app like this, and neither needs building.

---

## 2. Still needed from you

**Three placeholder values**, marked with a loud dashed-yellow style on `/privacy`
and `/support` so they cannot ship unnoticed:

- `[OPERATOR NAME]` — the legal person responsible for the app and its data (the
  "data controller"). With no company, your own full legal name.
- `[CONTACT EMAIL]` — a support address. Play publishes it on the listing and it
  appears in the privacy policy, so it becomes public. Use a fresh dedicated
  address, not your personal one.
- `[HOSTING REGION]` — Supabase Dashboard → Project Settings → General.

**Name availability**: search Play for "Wonder Georgia" before you commit. Fallbacks
if taken: *Wander Georgia*, *Sakartvelo*, *Georgia Together*, *Kartuli*. The name is
14 characters, so it may truncate under the launcher icon; a shorter home-screen
name can be set separately if that bothers you.

---

## 3. Google Play account — **YOU**

- [ ] **Google Play Developer account** — 25 USD one-time, at
      play.google.com/console. Needs identity verification (ID document), which can
      take a few days.
- [ ] **⚠️ The 14-day closed test.** New *personal* developer accounts must run a
      closed test with **at least 12 testers opted in continuously for 14 days**
      before they can apply for production access. Organisation accounts are exempt.
      This is the single longest lead time in the whole process — start the account
      and the closed test as early as possible, because everything else can be done
      in parallel but this clock cannot be compressed. Verify the current rule in
      the Console; Google has changed the numbers before.
- [ ] **Create the app record** in Play Console.
- [ ] **Google service account JSON key** for `eas submit` — Play Console → Setup →
      API access. Without it, submission is a manual upload each time.
- [ ] `npm i -g eas-cli` then `eas login`. Not installed locally, and the login is
      interactive so it has to be you.

Once you have the service account key, tell me and I will wire `eas.json`'s
`submit.production` block — it is an empty object today.

---

## 4. Build and submit

Run from `mobile/`. I can run the build; submission needs your credentials.

```bash
# Sanity gate first
npx tsc --noEmit && npm test

# Production build (cloud, ~15-30 min). Produces an AAB, which is what Play wants.
eas build --platform android --profile production

# A shareable APK instead, for the closed test or direct sideloading
eas build --platform android --profile preview

eas submit --platform android --profile production
```

**After the first build**, check the generated `AndroidManifest.xml` for permissions
Expo's prebuild added that the app does not use — every extra permission is another
line you must justify on the Data safety form. I deliberately did *not* set
`android.permissions: []` pre-emptively, because an over-aggressive value there can
strip `INTERNET` and break all networking, and I cannot verify a native build from
here. We prune from evidence, once.

**Also drop `expo-device`** — it is in `mobile/package.json` but imported nowhere in
`src/`. An unused dependency that reads device information is exactly the kind of
thing that complicates the Data safety declaration for no benefit. Say the word.

---

## 5. App access — reviewers need a way in

The app is invite-only. A reviewer who signs up sees an empty state with no way
into a trip, and "we could not evaluate the app" is a rejection.

Fill Play Console's **App access** section with credentials for a real account that
is already a member of a populated trip. The trip should contain two or three
members, a shortlist of two regions with their places, some votes and ratings, a
comment, and a couple of itinerary entries — otherwise the reviewer sees a working
app with nothing in it and cannot exercise voting or consensus at all.

I can seed that demo trip once the catalogue is loaded, using the same path the app
itself uses.

---

## 6. Play listing copy — drafted, edit freely

**App name (30 char max)**
> Wonder Georgia

**Short description (80 char max)**
> Plan a trip through Georgia together. Shortlist regions, vote, agree on a plan.

**Full description (4000 char max)**

> Planning a trip with other people usually means a group chat that scrolls past
> every good idea. Wonder Georgia turns that into something you can actually decide
> from.
>
> One person creates the trip, everyone else joins with a code, and the group works
> through the country together.
>
> **A real catalogue, not an empty app.** Ten regions of Georgia come already
> researched — what the place is, how long it honestly takes, what it costs in lari,
> the nearest town, whether it works with children, and when to go. You are not
> typing in a list before you can start.
>
> **Shortlist first, then decide.** Pick the regions you care about and the app fills
> your trip with what is there. Everything else stays browsable in Explore, so nobody
> is locked out of an idea that turns out to be good.
>
> **Vote instead of arguing.** Go, maybe or skip on every place, plus a rating out of
> five. The consensus screen shows what the group genuinely agrees on rather than
> whoever messaged last.
>
> **Then build the days.** Once the shortlist is voted on, the calendar opens up and
> you can lay places into days, leave notes on anything, and see it all update live
> for everyone.
>
> Built for the country of Georgia specifically — Tbilisi, Kakheti's wine country,
> the Kazbegi mountains, Svaneti's towers, the Black Sea coast at Batumi, and the
> cave towns and canyons in between.

**Category**: Travel & Local
**Tags**: trip planning, travel, itinerary, group

---

## 7. Graphic assets — **YOU** (I can advise, not produce)

Verify exact specs in the Console, they do shift:

- [ ] **App icon** — 512 × 512 PNG, 32-bit with alpha
- [ ] **Feature graphic** — 1024 × 500 PNG or JPG. Mandatory. No transparency, and
      keep text away from the edges since it gets cropped in places
- [ ] **Phone screenshots** — at least 2, up to 8. The five worth showing, in order:
      the region picker mid-selection, the dashboard with a shortlist, a place detail
      page, the consensus ranking, the calendar with days filled

Take screenshots from the real production build, not the simulator, so the status
bar and safe-area insets look right.

---

## 8. Data safety form — answers, pre-filled

Derived from the actual schema and a grep for privacy-sensitive APIs, so these are
accurate rather than cautious guesses.

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** |
| Is data encrypted in transit? | **Yes** |
| Can users request data deletion? | **Yes** — in-app, Account → Delete my account |
| **Personal info → Name** | Collected. Not shared. Required. App functionality |
| **Personal info → Email address** | Collected. Not shared. Required. Account management |
| **App activity → Other user-generated content** | Collected. Not shared. Required. App functionality (votes, ratings, comments, notes, itinerary) |
| Location | **Not collected** — no `expo-location`, never requested |
| Photos / videos / audio | **Not collected** |
| Contacts, calendar, SMS, call logs | **Not collected** |
| Device or other IDs | **Not collected** |
| Financial info | **Not collected** |
| Health, fitness, messages, files | **Not collected** |
| Analytics / crash logs | **Not collected** — no analytics or crash SDK installed |
| Shared with third parties? | **No.** Supabase is a processor acting on your instructions, which Google's form does not count as sharing |

---

## 9. Content rating and target audience

- **Target age group**: 13+. Do **not** opt into the Families programme — children
  appear in a trip only as names added by a parent, with no login and no contact
  details, and Families brings a much stricter review.
- **Content rating questionnaire**: the question that matters is whether users can
  interact or exchange content — answer **yes** (comments inside a private trip), and
  declare that reporting and blocking are both available. Expect a Teen / PEGI 12
  style rating as a result. That is normal and not a problem.
- **Ads**: none. Declare no ads.
- **In-app purchases**: none.

---

## 10. Order of operations

1. Load the catalogue into Supabase — **currently blocked**, see the SQL error below
2. Create the Play Developer account and **start the 12-tester closed test
   immediately** — 14-day clock, longest lead time, everything else runs in parallel
3. Fill the three placeholders on `/privacy` and `/support`
4. Production build, install it, walk the app end to end on a real device — this is
   also where the deferred device checks from Tasks 5, 6, 7 and 8 finally get done
5. Seed the demo trip and fill App access
6. Screenshots and feature graphic from the real build
7. Listing copy, Data safety, content rating
8. Apply for production access once the closed test has run its 14 days
9. Submit

Steps 1, 4, 5 and 7 I can do most of. Steps 2, 3, 6 and 8 are yours.

---

## Open blocker

`migration-10-catalog-ALL.sql` failed with `42P01: relation "catalog_regions" does
not exist`, despite the bootstrap having reportedly succeeded on 2026-08-28 with
"18/18 tables, 10 regions, 0 places". Verified locally that the bootstrap does
create the table unqualified (line 1644) with no file-scope `SET search_path`, and
that all three configs point at project `hktblcqdfzzeqflbmrqm`. Diagnostic query
issued; root cause not yet established. Most likely a different or reset project.
