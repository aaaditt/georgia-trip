# Store submission — Georgia Trip Planner

Scope added 2026-09-03. The implementation plan (`docs/superpowers/plans/2026-08-23-georgia-catalog.md`)
explicitly excluded EAS builds and store submission, so this file tracks it instead.

Everything below marked **YOU** needs an account, a credential, a device or a
judgement call that is not mine to make. Everything marked **DONE** was verified
against the actual code or config, not assumed.

---

## 1. Where we already stand

| Item | State | Evidence |
|---|---|---|
| EAS project linked | **DONE** | `mobile/app.json` → `extra.eas.projectId`, owner `aaaditts-team` |
| iOS bundle identifier | **DONE** | `com.aaaditt.tripplanner` |
| Android package | **DONE** | `com.aaaditt.tripplanner` |
| App icon (iOS) | **DONE** | `./assets/expo.icon` bundle |
| App icon (Android) | **DONE** | Adaptive icon with foreground, background *and* monochrome layers |
| Splash screen | **DONE** | `expo-splash-screen` plugin configured |
| Build profiles | **DONE** | `mobile/eas.json` — development, preview, production (`autoIncrement: true`) |
| Version source | **DONE** | `appVersionSource: "remote"` — EAS owns the build number, so you never bump it by hand |
| **Apple 5.1.1(v)** in-app account deletion | **DONE** | `account.tsx:34-53` → `supabase.rpc('delete_own_account')`, real deletion of `auth.users` |
| **Apple 1.2** UGC report + block | **DONE** | `src/lib/moderation.ts` — `reportComment`, `blockMember`, `unblockMember` |
| Privacy policy URL | **DONE** | `/privacy` on the Vercel deployment — publicly reachable, no login |
| Support URL | **DONE** | `/support` on the Vercel deployment |
| Export compliance | **DONE** | `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` — HTTPS only, so exempt. Stops ASC asking on every build |
| Device form factor | **DONE** | `ios.supportsTablet: false` — iPhone only, so no iPad screenshots needed |

Those two Apple guidelines are the usual multi-week rejection cause for an app of
this shape, and both were already satisfied by existing code. That is the single
biggest thing in your favour here.

---

## 2. Decisions I need from you

**The app name is a problem.** `app.json` says `"name": "Trip Planner"`. App Store
names must be globally unique and "Trip Planner" is certainly taken, so this will
be rejected at the metadata stage. It is also weak positioning for what the app
actually is. Pick something and I will change it everywhere (`app.json`, the web
`<title>`, the listing copy below). Suggestions, all checked for being descriptive
rather than generic: *Sakartvelo*, *Georgia Together*, *Tbilisi & Beyond*,
*Kartuli*, *Wander Georgia*.

The display name under the icon can be shorter than the App Store name if you want
(`Georgia Trip` fits on one line; anything over about 12 characters truncates).

**Three placeholder values** are marked with a loud dashed-yellow style on
`/privacy` and `/support` so they cannot ship unnoticed:

- `[OPERATOR NAME]` — you personally, or a company name if you have one
- `[CONTACT EMAIL]` — a support address. Both stores publish this. Consider a
  dedicated address rather than your personal one, since it becomes public
- `[HOSTING REGION]` — your Supabase project's region, from Supabase → Project
  Settings → General

---

## 3. Accounts and credentials — **YOU**

- [ ] **Apple Developer Program** — 99 USD/year, and enrolment identity verification
      can take a few days. Start this first if it is not already done; everything
      iOS blocks on it.
- [ ] **Google Play Developer** — 25 USD one-time. New personal accounts also need
      12 testers for 14 days before production access, so start this early too.
- [ ] **App Store Connect app record** — create the app, get the **ASC App ID** and
      your **Apple Team ID**.
- [ ] **Play Console app record** — create the app, then a **Google service account
      JSON key** for `eas submit`.
- [ ] `npm i -g eas-cli` then `eas login`. Not installed locally right now, and the
      login is interactive so it has to be you.

Once you have the four identifiers, tell me and I will fill in `eas.json`'s
`submit.production` block — it is an empty object today, which means `eas submit`
will interrogate you interactively every time instead.

---

## 4. Build and submit — commands

Run from `mobile/`. I can run the builds; the submissions need your credentials.

```bash
# Sanity gate first — all three must be clean
npx tsc --noEmit && npm test

# Production builds (cloud, ~15-30 min each)
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

**After the first Android build**, check the generated manifest for permissions
Expo's prebuild added that the app does not use. I deliberately did *not* set
`android.permissions: []` pre-emptively — an over-aggressive value there can strip
`INTERNET` and break all networking, and I cannot verify a native build from here.
Check it once, then we prune from evidence.

**Also drop `expo-device`** — it is in `mobile/package.json` but imported nowhere
in `src/`. Unused native dependencies that read device information are exactly what
complicates Apple's privacy manifest for no benefit. Say the word and I will remove it.

---

## 5. A demo account for the reviewers — **easy to miss, blocks review**

This app is invite-only. A reviewer who signs up sees an empty state and no way in,
and "we could not test the app's features" is a straight rejection.

So before submitting, create a real account with a trip that has content in it, and
put the credentials in App Store Connect's **App Review Information → Sign-in
required** box, and in Play Console's **App access** section.

The trip should already contain: two or three members, a shortlist of two regions
with their places, a few votes and ratings, one comment, and a couple of itinerary
entries. Otherwise the reviewer sees a working app with nothing in it and cannot
exercise voting or consensus at all.

I can script the creation of that demo trip's content once the catalogue is loaded —
it is the same seeding path the app itself uses.

---

## 6. Store listing copy — drafted, edit freely

Names below assume you keep "Georgia" in the title; I will rewrite once you pick.

**Subtitle (iOS, 30 char max)**
> Plan Georgia as a group

**Short description (Play, 80 char max)**
> Plan a trip through Georgia together. Shortlist regions, vote, agree on a plan.

**Promotional text (iOS, 170 char, changeable without review)**
> Now with a researched catalogue of places across all ten regions of Georgia — from Tbilisi's sulphur baths to the Svan towers of Ushguli.

**Description**

> Planning a trip with other people usually means a group chat that scrolls past
> every good idea. Georgia Trip Planner turns that into something you can actually
> decide from.
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
> your trip with what is there. Everything else stays browsable in Explore, so
> nobody is locked out of an idea that turns out to be good.
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

**Keywords (iOS, 100 chars total, comma-separated, no spaces)**
> georgia,tbilisi,travel,itinerary,group,trip,vote,caucasus,batumi,kazbegi,planner

**Category**
- iOS: Primary **Travel**, secondary **Productivity**
- Play: **Travel & Local**

---

## 7. Play Store Data safety form — answers, pre-filled

Derived from the actual schema and a grep for privacy-sensitive APIs, so these are
accurate rather than cautious guesses.

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** |
| Is data encrypted in transit? | **Yes** |
| Can users request data deletion? | **Yes** — in-app, Account → Delete my account |
| **Personal info → Name** | Collected. Not shared. Required. For app functionality |
| **Personal info → Email address** | Collected. Not shared. Required. For account management |
| **App activity → Other user-generated content** | Collected. Not shared. Required. For app functionality (votes, ratings, comments, notes, itinerary) |
| Location | **Not collected** — no `expo-location`, app never requests it |
| Photos / videos / audio | **Not collected** |
| Contacts, calendar, SMS, call logs | **Not collected** |
| Device or other IDs | **Not collected** |
| Financial info | **Not collected** |
| Health, fitness, messages, files | **Not collected** |
| Analytics / crash logs | **Not collected** — no analytics or crash SDK is installed |
| Is any data shared with third parties? | **No.** Supabase is a processor acting on your instructions, which Google's form does not count as sharing |

**Target audience**: 13+. Not designed for children, so it should stay out of the
Families programme — children appear in a trip only as names added by a parent, with
no login.

**Content rating questionnaire**: the one that matters is *"does your app allow users
to interact or exchange content?"* — answer **yes** (comments within a private trip),
and declare that reporting and blocking are available. Expect a Teen / PEGI 12 style
rating because of the user interaction, which is normal and fine.

---

## 8. Apple App Store specifics

- [ ] **Screenshots** — iPhone only, since `supportsTablet: false`. Apple currently
      wants 6.9" display shots (1290 × 2796). Verify the exact set in App Store
      Connect when you get there; the requirement list changes. Best five to show, in
      order: the region picker mid-selection, the dashboard with a shortlist, a place
      detail page, the consensus ranking, the calendar with days filled.
- [ ] **Age rating questionnaire** — the relevant answers are user-generated content
      **yes**, with moderation, reporting and blocking all **yes**. No violence, no
      gambling, no unrestricted web access.
- [ ] **Privacy "Nutrition Label"** (App Privacy section) — mirrors the table in §7.
      Contact info (name, email) and User Content, both **linked to identity**, both
      **not used for tracking**. Answer **no** to the tracking question — nothing in
      this app tracks anyone across apps or sites.
- [ ] **App Review Information** — the demo account from §5, plus a note saying the
      app is invite-only and the demo account is already a member of a populated trip.
- [ ] Support URL → `/support`, Privacy Policy URL → `/privacy`, on your Vercel domain.

---

## 9. Order of operations

1. Finish the catalogue content and load it into Supabase (Tasks 9 and 11 — in flight)
2. Pick the app name, and fill the three placeholders on `/privacy` and `/support`
3. Enrol in both developer programmes — the long lead time, start it in parallel with 1
4. Create both app records, collect the four identifiers, fill `eas.json`
5. Create the demo trip and account
6. Production builds on both platforms
7. Install the builds and walk the app end to end on a real device — this is also
   where the deferred device checks from Tasks 5, 6, 7 and 8 finally get done
8. Screenshots from the real build
9. Listing metadata, data safety, age rating
10. Submit

Steps 1, 2, 4, 6, 8 and 9 I can do most of. Step 3 and the credentials in 4 are
yours; step 7 needs your hands on a device.
