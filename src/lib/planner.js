// Mock plan generator — turns the family's votes into a dated draft
// itinerary for 3–20 August. Pure functions: same votes in, same plan
// out, so the page recomputes live as votes and ratings change.
//
// How it decides:
//  · Points follow the app convention: ✅ go = 2, 🤔 maybe = 1, ❌ skip = 0.
//    A place makes the cut when it has points AND skips don't outnumber
//    the people who want it. Ratings break ties.
//  · The route is the fixed loop the group already agreed on
//    (Tbilisi → Kakheti → Kazbegi → Gori → Borjomi → Kutaisi → Svaneti
//    → back), pinned to real dates. Votes decide what fills each day.
//  · Time of day comes from the tags: cool/cave places take the hot
//    midday, evening/lit-up places take the night, exposed scenic spots
//    get mornings or golden hour. August heat shapes everything.

import { REGIONS } from "./data";
import { getVoteCounts, getAverageRating } from "./hooks";
import { parseDefaultDuration } from "./itinerary";

const H = 60;
const DAY_END = 22 * H; // nothing scheduled past 10pm
const SNAP = 30;

// ---------------------------------------------------------------------------
// Time-of-day windows + tag heuristics
// ---------------------------------------------------------------------------

export const WINDOWS = {
  morning: { start: 9 * H, end: 12 * H + 30 },
  midday: { start: 12 * H + 30, end: 15 * H + 30 },
  afternoon: { start: 15 * H + 30, end: 18 * H + 30 },
  evening: { start: 18 * H + 30, end: 21 * H + 30 },
};
const WINDOW_ORDER = ["morning", "midday", "afternoon", "evening"];

// Hand-tuned exceptions where the tags alone would guess wrong.
const TIME_OVERRIDES = {
  "uplistsikhe-cave": {
    windows: ["morning"],
    reason: "☀️ exposed rock, brutal at midday — go early with hats & water",
  },
  "kazbegi-gergeti": {
    windows: ["morning"],
    reason: "🏔️ clearest Kazbek views before the clouds build",
  },
  "kazbegi-paragliding": {
    windows: ["morning", "afternoon"],
    reason: "🪂 calmer morning winds; weather-dependent, keep it flexible",
  },
  "kakheti-sighnaghi": {
    windows: ["evening", "afternoon"],
    reason: "🌇 ramparts at sunset over the Alazani Valley",
  },
  "tbilisi-chronicles": {
    windows: ["evening", "morning"],
    reason: "🌇 dramatic at golden hour, and the hilltop is exposed",
  },
  "tbilisi-sulfur-baths": {
    windows: ["midday", "evening"],
    reason: "🛁 indoor soak — a perfect hot-afternoon escape",
  },
  "tbilisi-sulfur-scrub": {
    windows: ["midday", "evening"],
    reason: "🛁 book alongside the bath room",
  },
  "kakheti-david-gareja": {
    windows: ["morning"],
    reason: "☀️ semi-desert ridge — mornings only in August",
  },
  "kakheti-supra": {
    windows: ["midday", "afternoon"],
    reason: "🍽️ the supra is a long, late lunch — feast through the heat",
  },
};

// A few free-text durations parse too short/long for real planning.
const DURATION_OVERRIDES = {
  "svaneti-ushguli": 240, // the 4×4 ride out + village walks
  "kazbegi-paragliding": 150, // transfer + briefing + flight
  "kazbegi-gergeti": 210, // keep room for the rest of the day
  "kazbegi-juta-truso": 300, // "half–full day" — plan the half-day version
};

function timePreference(exp) {
  if (TIME_OVERRIDES[exp.id]) return TIME_OVERRIDES[exp.id];
  const tags = exp.tags || [];
  const has = (t) => tags.includes(t);

  if (has("evening"))
    return { windows: ["evening", "afternoon"], reason: "🌙 best after dark — lit up and cool" };
  // Hikes before "cool": a shaded valley walk still wants an early start
  if (has("hike"))
    return { windows: ["morning"], reason: "🥾 start early — cooler trail, softer light" };
  if (has("cool") || has("cave"))
    return { windows: ["midday", "afternoon"], reason: "❄️ cool refuge — saved for peak heat" };
  if (has("water"))
    return { windows: ["midday", "morning"], reason: "🚣 water time — welcome when the sun is high" };
  if (has("wine"))
    return { windows: ["afternoon", "morning"], reason: "🍷 cellar hours — late morning or late afternoon" };
  if (has("thrill"))
    return { windows: ["morning", "afternoon"], reason: "⚡ mornings are calmer for the adrenaline stuff" };
  if (has("scenic") || has("walk"))
    return { windows: ["morning", "evening"], reason: "☀️ exposed spot — morning or golden hour beats the heat" };
  return { windows: ["morning", "afternoon"], reason: "🌤️ flexible — slotted where the day had room" };
}

function durationFor(exp) {
  const d = DURATION_OVERRIDES[exp.id] ?? parseDefaultDuration(exp.time);
  return Math.min(480, Math.max(SNAP, d));
}

// ---------------------------------------------------------------------------
// Vote scoring
// ---------------------------------------------------------------------------

export function scorePlaces(experiences, votes, ratings) {
  const scored = experiences.map((exp) => {
    const counts = getVoteCounts(votes, exp.id);
    const points = counts.go * 2 + counts.maybe;
    const avgRating = getAverageRating(ratings, exp.id);
    return { exp, counts, points, avgRating };
  });

  const byRank = (a, b) =>
    b.points - a.points || b.avgRating - a.avgRating || b.counts.go - a.counts.go;

  return {
    // In: has points and isn't skip-vetoed (more ❌ than ✅+🤔 = cut)
    selected: scored
      .filter((s) => s.points > 0 && s.counts.skip <= s.counts.go + s.counts.maybe)
      .sort(byRank),
    cut: scored
      .filter((s) => s.counts.total > 0 && (s.points === 0 || s.counts.skip > s.counts.go + s.counts.maybe))
      .sort(byRank),
    unvoted: scored.filter((s) => s.counts.total === 0),
  };
}

// ---------------------------------------------------------------------------
// The route skeleton — fixed dates, vote-driven contents.
// Constraints from the group: Tbilisi is 1 day at the start (nothing
// before 3pm on arrival day) + 2 days at the end; the loop in between
// starts and ends in Tbilisi.
// ---------------------------------------------------------------------------
//
// pools: where a day draws its places from.
//   { regionId, only: [ids] }    → exactly these places (road order on
//                                   "enroute" days)
//   { regionId, exclude: [ids] } → the rest of the region's pool
//   notBefore: minute-of-day     → pool is at the day's destination, so
//                                   nothing from it before the drive lands
// mode "enroute": places go down in geographic order with drive gaps,
// instead of by time-of-day preference.

const DAY_TEMPLATES = [
  {
    date: "2026-08-03",
    title: "Arrival — Tbilisi",
    base: "Tbilisi",
    icon: "🏙️",
    note: "Flights land — nothing planned before 3pm. An easy lit-up evening to start.",
    dayStart: 15 * H,
    maxPlaces: 3,
    fixed: [{ startMin: 15 * H, durationMin: 60, emoji: "🏨", name: "Check in & settle" }],
    pools: [{ regionId: "tbilisi" }],
  },
  {
    date: "2026-08-04",
    title: "Tbilisi → Kakheti wine country",
    base: "Sighnaghi",
    icon: "🍇",
    driveNote: "~2.5 hr",
    maxPlaces: 4,
    fixed: [
      { startMin: 9 * H, durationMin: 150, emoji: "🚗", name: "Drive Tbilisi → Sighnaghi", note: "~2.5 hr" },
    ],
    pools: [{ regionId: "kakheti" }],
  },
  {
    date: "2026-08-05",
    title: "Kakheti — vineyards & valley views",
    base: "Sighnaghi",
    icon: "🍷",
    maxPlaces: 5,
    fixed: [],
    pools: [{ regionId: "kakheti" }],
  },
  {
    date: "2026-08-06",
    title: "The Military Highway — Kakheti → Kazbegi",
    base: "Stepantsminda",
    icon: "🏔️",
    driveNote: "~5–6 hr broken by the stops",
    mode: "enroute",
    driveGap: 60,
    maxPlaces: 6,
    fixed: [
      { startMin: 9 * H, durationMin: 90, emoji: "🚗", name: "Drive Sighnaghi → Military Highway", note: "first leg" },
    ],
    enrouteStart: 10 * H + 30,
    pools: [
      {
        regionId: "mtskheta",
        only: ["mtskheta-aragvi-raft", "mtskheta-zhinvali-kayak", "mtskheta-ananuri"],
      },
      {
        regionId: "gudauri-kazbegi",
        only: ["kazbegi-mineral-springs", "kazbegi-friendship", "kazbegi-sno"],
      },
    ],
  },
  {
    date: "2026-08-07",
    title: "Kazbegi — the crown jewel",
    base: "Stepantsminda",
    icon: "⛰️",
    maxPlaces: 4,
    fixed: [],
    pools: [{ regionId: "gudauri-kazbegi" }],
  },
  {
    date: "2026-08-08",
    title: "Kazbegi day two — valleys & thrills",
    base: "Stepantsminda",
    icon: "🪂",
    maxPlaces: 5,
    fixed: [],
    pools: [{ regionId: "gudauri-kazbegi" }],
  },
  {
    date: "2026-08-09",
    title: "Back down — Mtskheta & Gori",
    base: "Gori",
    icon: "⛪",
    driveNote: "~4 hr + stops",
    mode: "enroute",
    driveGap: 45,
    maxPlaces: 4,
    fixed: [
      { startMin: 9 * H, durationMin: 120, emoji: "🚗", name: "Drive Stepantsminda → Mtskheta", note: "back down the highway" },
    ],
    enrouteStart: 11 * H,
    pools: [
      { regionId: "mtskheta", exclude: ["mtskheta-aragvi-raft", "mtskheta-zhinvali-kayak", "mtskheta-ananuri"] },
      { regionId: "uplistsikhe", exclude: ["uplistsikhe-cave"] },
    ],
  },
  {
    date: "2026-08-10",
    title: "Uplistsikhe → Borjomi",
    base: "Borjomi",
    icon: "🌿",
    driveNote: "~2 hr",
    maxPlaces: 4,
    fixed: [
      { startMin: 12 * H, durationMin: 120, emoji: "🚗", name: "Drive Gori → Borjomi", note: "~2 hr" },
    ],
    pools: [
      { regionId: "uplistsikhe", only: ["uplistsikhe-cave"] },
      { regionId: "borjomi", notBefore: 14 * H },
    ],
  },
  {
    date: "2026-08-11",
    title: "Borjomi → Kutaisi",
    base: "Kutaisi",
    icon: "🌊",
    driveNote: "~2.5 hr",
    maxPlaces: 4,
    fixed: [
      { startMin: 13 * H, durationMin: 150, emoji: "🚗", name: "Drive Borjomi → Kutaisi", note: "~2.5 hr" },
    ],
    pools: [
      { regionId: "borjomi" },
      {
        regionId: "kutaisi-imereti",
        only: ["imereti-white-bridge", "imereti-bazaar"],
        notBefore: 16 * H,
      },
    ],
  },
  {
    date: "2026-08-12",
    title: "Imereti — caves, canyons & water",
    base: "Kutaisi",
    icon: "🪨",
    maxPlaces: 5,
    fixed: [],
    pools: [{ regionId: "kutaisi-imereti", exclude: ["imereti-cooking-class"] }],
  },
  {
    date: "2026-08-13",
    title: "The climb to Svaneti — Kutaisi → Mestia",
    base: "Mestia",
    icon: "🗼",
    driveNote: "~5 hr scenic",
    maxPlaces: 2,
    fixed: [
      { startMin: 9 * H, durationMin: 300, emoji: "🚗", name: "Drive Kutaisi → Mestia", note: "~5 hr, scenic climb" },
    ],
    pools: [{ regionId: "svaneti", only: ["svaneti-towers", "svaneti-kubdari"] }],
  },
  {
    date: "2026-08-14",
    title: "Mestia — towers, cable car & glacier",
    base: "Mestia",
    icon: "🏔️",
    maxPlaces: 5,
    fixed: [],
    pools: [
      {
        regionId: "svaneti",
        exclude: ["svaneti-ushguli", "svaneti-lamaria", "svaneti-shkhara", "svaneti-horse"],
      },
    ],
  },
  {
    date: "2026-08-15",
    title: "Ushguli day trip (UNESCO)",
    base: "Mestia",
    icon: "🐎",
    driveNote: "~2 hr rough road each way",
    mode: "enroute",
    driveGap: 15,
    maxPlaces: 4,
    fixed: [
      { startMin: 17 * H, durationMin: 120, emoji: "🚙", name: "4×4 back Ushguli → Mestia", note: "~2 hr" },
    ],
    enrouteStart: 9 * H,
    pools: [
      {
        regionId: "svaneti",
        only: ["svaneti-ushguli", "svaneti-lamaria", "svaneti-shkhara", "svaneti-horse"],
      },
    ],
  },
  {
    date: "2026-08-16",
    title: "Mestia → Kutaisi",
    base: "Kutaisi",
    icon: "🍲",
    driveNote: "~5 hr",
    maxPlaces: 3,
    fixed: [
      { startMin: 9 * H + 30, durationMin: 300, emoji: "🚗", name: "Drive Mestia → Kutaisi", note: "~5 hr" },
    ],
    pools: [{ regionId: "kutaisi-imereti" }],
  },
  {
    date: "2026-08-17",
    title: "Kutaisi → Tbilisi",
    base: "Tbilisi",
    icon: "🏙️",
    driveNote: "~3.5 hr expressway",
    maxPlaces: 3,
    fixed: [
      { startMin: 10 * H, durationMin: 210, emoji: "🚗", name: "Drive Kutaisi → Tbilisi", note: "~3.5 hr expressway" },
    ],
    pools: [{ regionId: "tbilisi", notBefore: 14 * H }],
  },
  {
    date: "2026-08-18",
    title: "Tbilisi — the city, properly",
    base: "Tbilisi",
    icon: "🏙️",
    maxPlaces: 5,
    fixed: [],
    pools: [{ regionId: "tbilisi" }],
  },
  {
    date: "2026-08-19",
    title: "Tbilisi — last day & farewell supra",
    base: "Tbilisi",
    icon: "🥂",
    maxPlaces: 4,
    fixed: [{ startMin: 19 * H + 30, durationMin: 120, emoji: "🥂", name: "Farewell supra dinner" }],
    pools: [{ regionId: "tbilisi" }],
  },
  {
    date: "2026-08-20",
    title: "Departure",
    base: "✈️ Home",
    icon: "✈️",
    note: "Check out, last khachapuri, airport. Safe travels! 🇬🇪",
    maxPlaces: 0,
    fixed: [{ startMin: 9 * H, durationMin: 180, emoji: "✈️", name: "Check out & head to the airport" }],
    pools: [],
  },
];

// ---------------------------------------------------------------------------
// Interval scheduling helpers
// ---------------------------------------------------------------------------

const snapUp = (min) => Math.ceil(min / SNAP) * SNAP;

// Earliest conflict-free start in [from, latestStart] for `duration`.
function findSlot(busy, from, latestStart, duration) {
  let start = snapUp(from);
  while (start <= latestStart) {
    const conflict = busy.find((b) => start < b.end && start + duration > b.start);
    if (!conflict) return start + duration <= DAY_END ? start : null;
    start = snapUp(conflict.end);
  }
  return null;
}

function poolMatches(pool, scoredPlace) {
  const { exp } = scoredPlace;
  if (exp.regionId !== pool.regionId) return false;
  if (pool.only) return pool.only.includes(exp.id);
  if (pool.exclude) return !pool.exclude.includes(exp.id);
  return true;
}

// ---------------------------------------------------------------------------
// The generator
// ---------------------------------------------------------------------------

export function buildMockPlan(experiences, votes, ratings) {
  const { selected, cut, unvoted } = scorePlaces(experiences, votes, ratings);

  // Places still waiting for a day, keyed for quick removal
  const remaining = new Map(selected.map((s) => [s.exp.id, s]));

  const days = DAY_TEMPLATES.map((tpl, i) => {
    const dayStart = tpl.dayStart ?? 9 * H;
    const busy = tpl.fixed.map((f) => ({ start: f.startMin, end: f.startMin + f.durationMin }));
    const blocks = tpl.fixed.map((f, j) => ({ ...f, id: `fixed-${tpl.date}-${j}`, kind: "fixed" }));

    // Gather this day's candidates from its pools, in pool order.
    // "only" pools keep their listed (geographic) order; open pools
    // rank by points so the favourites get the best slots.
    const candidates = [];
    for (const pool of tpl.pools) {
      const matches = [...remaining.values()].filter((s) => poolMatches(pool, s));
      if (pool.only) {
        matches.sort((a, b) => pool.only.indexOf(a.exp.id) - pool.only.indexOf(b.exp.id));
      }
      candidates.push(...matches.map((s) => ({ s, notBefore: pool.notBefore ?? 0 })));
    }

    let placed = 0;
    let cursor = tpl.enrouteStart ?? dayStart;

    for (const { s, notBefore } of candidates) {
      if (placed >= tpl.maxPlaces) break;
      const duration = durationFor(s.exp);
      let startMin = null;
      let reason;

      if (tpl.mode === "enroute") {
        // Road order: next free slot from the rolling cursor, then a
        // drive gap before the following stop.
        startMin = findSlot(busy, cursor, DAY_END - duration, duration);
        if (startMin !== null) cursor = startMin + duration + tpl.driveGap;
        reason = "🛣️ en-route stop, in road order";
      } else {
        const pref = timePreference(s.exp);
        reason = pref.reason;
        // Preferred windows first, then anything with room.
        const tryOrder = [...pref.windows, ...WINDOW_ORDER.filter((w) => !pref.windows.includes(w))];
        for (const w of tryOrder) {
          const win = WINDOWS[w];
          const from = Math.max(win.start, dayStart, notBefore);
          startMin = findSlot(busy, from, win.end - SNAP, duration);
          if (startMin !== null) break;
        }
        // Be honest when it didn't land in its first-choice window
        if (startMin !== null) {
          const landed = WINDOW_ORDER.find(
            (w) => startMin >= WINDOWS[w].start && startMin < WINDOWS[w].end
          );
          if (landed && landed !== pref.windows[0]) reason += " · shifted to fit the day";
        }
      }

      if (startMin === null) continue; // no room today — a later day may take it
      busy.push({ start: startMin, end: startMin + duration });
      blocks.push({
        id: s.exp.id,
        kind: "place",
        startMin,
        durationMin: duration,
        emoji: "📍",
        name: s.exp.name,
        exp: s.exp,
        counts: s.counts,
        points: s.points,
        avgRating: s.avgRating,
        reason,
      });
      remaining.delete(s.exp.id);
      placed += 1;
    }

    blocks.sort((a, b) => a.startMin - b.startMin);
    return {
      date: tpl.date,
      dayNumber: i + 1,
      title: tpl.title,
      base: tpl.base,
      icon: tpl.icon,
      driveNote: tpl.driveNote,
      note: tpl.note,
      blocks,
      placeCount: placed,
    };
  });

  return {
    days,
    selected,
    cut,
    unvoted,
    leftover: [...remaining.values()], // made the cut but no day had room
  };
}

// Consecutive same-base days collapsed into route stops for the strip.
export function routeStops(days) {
  const stops = [];
  for (const d of days) {
    const last = stops[stops.length - 1];
    if (last && last.base === d.base) {
      last.dates.push(d.date);
    } else {
      stops.push({ base: d.base, icon: d.icon, dates: [d.date] });
    }
  }
  return stops;
}

export function regionName(regionId) {
  return REGIONS.find((r) => r.id === regionId)?.name || regionId;
}
