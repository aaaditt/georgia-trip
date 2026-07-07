# Hidden Admin Panel — Design

Date: 2026-07-07

## Purpose

Give the trip organizer a hidden, passcode-gated view into who has voted/rated
what, and who still needs to, so they can coordinate the family without
exposing this as a normal nav item everyone sees.

## Threat model

This app already has no real authentication — "logging in" is just picking
your name from a fixed list of 8, and Supabase RLS allows all operations for
the anon key. The admin panel matches that same trust model: a shared static
passcode checked client-side is enough to keep casual family members out. It
is not meant to stop a determined attacker with dev tools open.

## Architecture

- **`src/context/AdminContext.js`** — mirrors `UserContext`. Exposes
  `isAdmin`, `unlock(passcode)`, `lock()`. `unlock` compares the given value
  against `process.env.NEXT_PUBLIC_ADMIN_PASSCODE`. On match, sets
  `isAdmin = true` in state and persists it to `sessionStorage` (per-tab,
  cleared when the tab/browser closes — deliberately not `localStorage`,
  so an unlocked admin session doesn't linger indefinitely on a shared
  device). Wrapped into `layout.js` alongside `UserProvider`.
- **`src/lib/adminStats.js`** — pure functions (no React) that take `votes`,
  `ratings`, `comments`, `experiences`, `USERS` and return the per-person
  breakdowns, custom-place attribution, and overall stats. Keeps the admin
  page thin, matching how `lib/hooks.js` already separates aggregation
  helpers (`getVoteCounts`, etc.) from components.
- **No new Supabase tables or columns.** Custom-place attribution is derived
  from the existing convention: `AddPlaceForm` already posts a comment
  `"💡 I suggested this place!"` from the adding user — admin stats reads the
  earliest such comment per experience to determine who added it.

## Trigger & gating

- In `Navbar.js`, the brand link (flag + "Georgia 2026") gets an `onClick`
  handler that counts taps within a rolling ~2s window. On the 5th rapid tap,
  it prevents the default navigation and opens `AdminGateModal` instead.
  Taps 1–4 behave exactly as today (normal navigation to `/dashboard`).
- **`AdminGateModal`** — small centered overlay with a passcode input +
  submit button. Wrong passcode shows an inline error and clears the field.
  No lockouts/rate-limiting (unnecessary for this trust model). On success:
  calls `unlock()`, closes the modal, routes to `/admin`.
- The `/admin` page itself also renders `AdminGateModal` inline whenever
  `isAdmin` is false — so directly visiting/bookmarking `/admin` is equally
  gated, not just the gesture path.
- Once unlocked for the session, `Navbar` quietly adds a "🔒 Admin" link to
  its nav list (only rendered when `isAdmin` is true), so the tap gesture
  doesn't need to be repeated while working in the panel.

## Admin page content (`/admin`)

1. **Overall stats strip** — 4 tiles: total votes cast, people fully done
   voting (X/8), most popular place (name + go-count), custom places added
   (count).
2. **Per-person voting tracker** — one card per user (all 8, sorted by most
   remaining-first): name/emoji, "X/Y voted", and a collapsible list of
   not-yet-voted experience names grouped by region.
3. **Per-person ratings tracker** — same card, second stat line: "X/Y
   rated", collapsible remaining list.
4. **Custom places added** — table: place name, region, added-by (name +
   emoji), added-when — sourced from the attribution comment.
5. Read-only throughout — no edit/delete actions from this panel.

## Error handling & edge cases

- If `NEXT_PUBLIC_ADMIN_PASSCODE` isn't set in the environment, `unlock()`
  always fails closed (never silently grants access) and the modal shows
  "Admin passcode not configured."
- While `votes`/`ratings`/`experiences` are still loading, the admin page
  shows the existing app's loading-spinner pattern rather than a flash of
  0/0 stats.
- Kids (`is_adult: false`) are included in the per-person trackers same as
  adults — no special-casing, since the app doesn't distinguish them
  anywhere else functionally.

## Testing

No test suite exists in this repo. Verification is manual: exercise the tap
gesture, wrong/right passcode, a direct `/admin` visit while locked, and
compare computed stats against known votes in Supabase.

## Configuration

- New env var: `NEXT_PUBLIC_ADMIN_PASSCODE` (set to `2212`), added to
  `.env.local` (local dev) and to the Vercel project's environment
  variables (Production + Preview + Development) so the deployed build has
  it inlined at build time. `.env.local.example` gets a placeholder line
  documenting the variable without the real value.
