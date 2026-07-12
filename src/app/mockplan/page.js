"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import {
  useExperiences,
  useVotes,
  useRatings,
  getVoteCounts,
  getAverageRating,
} from "@/lib/hooks";
import { formatDay } from "@/lib/itinerary";
import {
  PROPOSED_PLAN,
  TRAVEL_MODES,
  getDayRouteUrl,
  getTripOverviewUrl,
} from "@/lib/proposal";
import { REGIONS } from "@/lib/data";
import { getMapsUrl } from "@/lib/links";
import Navbar from "@/components/Navbar";

// "14:30" → "2:30pm"
function fmt(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, "0")}${ampm}`;
}

function VoteChips({ score }) {
  if (!score || score.counts.total === 0) return null;
  const { counts, points, avgRating } = score;
  return (
    <span className="mock-votes">
      {counts.go > 0 && <span>✅×{counts.go}</span>}
      {counts.maybe > 0 && <span>🤔×{counts.maybe}</span>}
      {counts.skip > 0 && <span>❌×{counts.skip}</span>}
      {avgRating > 0 && <span>★{avgRating.toFixed(1)}</span>}
      <span className="mock-points">{points} pts</span>
    </span>
  );
}

// The Proposed Plan: a researched, hand-crafted route (see lib/proposal.js)
// that connects every voted-in place with real travel times and modes.
// Votes stay live: chips update in realtime, and anything newly voted in
// that the proposal doesn't cover surfaces in the watchlist below.
export default function ProposalPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const { experiences, loading: expLoading } = useExperiences();
  const { votes, loading: votesLoading } = useVotes();
  const { ratings, loading: ratingsLoading } = useRatings();

  useEffect(() => {
    if (isLoaded && !currentUser) {
      router.push("/");
    }
  }, [isLoaded, currentUser, router]);

  const loading = expLoading || votesLoading || ratingsLoading;

  const expById = useMemo(() => {
    const map = new Map();
    for (const e of experiences) map.set(e.id, e);
    return map;
  }, [experiences]);

  // Live score per place, same rule as everywhere in the app:
  // ✅ go = 2, 🤔 maybe = 1; more ❌ than support = out.
  const scoreById = useMemo(() => {
    const map = new Map();
    for (const exp of experiences) {
      const counts = getVoteCounts(votes, exp.id);
      const points = counts.go * 2 + counts.maybe;
      const avgRating = getAverageRating(ratings, exp.id);
      const status =
        counts.total === 0
          ? "unvoted"
          : points > 0 && counts.skip <= counts.go + counts.maybe
            ? "in"
            : "out";
      map.set(exp.id, { exp, counts, points, avgRating, status });
    }
    return map;
  }, [experiences, votes, ratings]);

  // Everything the proposal covers (scheduled or listed as optional)
  const coveredIds = useMemo(() => {
    const ids = new Set();
    for (const day of PROPOSED_PLAN.days)
      for (const b of day.blocks) if (b.type === "place") ids.add(b.expId);
    for (const o of PROPOSED_PLAN.optionals) ids.add(o.expId);
    return ids;
  }, []);

  const watchlist = useMemo(
    () =>
      [...scoreById.values()].filter(
        (s) => s.status === "in" && !coveredIds.has(s.exp.id)
      ),
    [scoreById, coveredIds]
  );
  const cut = useMemo(
    () =>
      [...scoreById.values()]
        .filter((s) => s.status === "out")
        .sort((a, b) => b.points - a.points),
    [scoreById]
  );
  const unvoted = useMemo(
    () => [...scoreById.values()].filter((s) => s.status === "unvoted"),
    [scoreById]
  );

  // Consecutive same-base days → route strip stops
  const stops = useMemo(() => {
    const result = [];
    for (const d of PROPOSED_PLAN.days) {
      const last = result[result.length - 1];
      if (last && last.base === d.base) last.dates.push(d.date);
      else result.push({ base: d.base, icon: d.icon, dates: [d.date] });
    }
    return result;
  }, []);

  if (!isLoaded || !currentUser || loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const placesInPlan = coveredIds.size - PROPOSED_PLAN.optionals.length;

  const regionName = (regionId) =>
    REGIONS.find((r) => r.id === regionId)?.name || regionId;

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">🧭</span>
          <h1>The Proposed Plan</h1>
          <p className="subtitle">
            3–16 August · a researched route connecting everything you voted in
          </p>
        </div>

        <div
          className="group-pick animate-in"
          style={{ marginBottom: "var(--space-lg)", textAlign: "center" }}
        >
          <div className="gp-label" style={{ justifyContent: "center" }}>
            🔬 How this route was built
          </div>
          <p>
            Every place the family voted in ({placesInPlan} of them, plus 3
            opt-ins) is connected into one loop with real drive times, modes
            and opening days — researched, not guessed. The clever bits: the
            Tianeti back road links Kakheti straight to the mountains, Ushguli
            is the <em>exit</em> from Svaneti over the newly sealed Zagari
            Pass (saves a full day), the Monday cave closures fall on the
            drive day, and Dry Bridge lands on its best day, Saturday. Vote
            chips stay live — if votes change, the watchlist below flags
            anything the route should absorb. When the family blesses it,
            copy the days onto the <Link href="/calendar">calendar</Link>.
          </p>
        </div>

        <div style={{ textAlign: "center", marginBottom: "var(--space-md)" }}>
          <a
            href={getTripOverviewUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="quick-link"
            style={{ display: "inline-flex" }}
          >
            🗺️ See the whole loop on Google Maps
          </a>
        </div>

        <div className="route-strip animate-in">
          <span className="route-label">🧭 Route</span>
          {stops.map((stop, i) => {
            const first = formatDay(stop.dates[0]);
            const last = formatDay(stop.dates[stop.dates.length - 1]);
            const range =
              stop.dates.length === 1
                ? `${first.date} ${first.month}`
                : `${first.date}–${last.date} ${last.month}`;
            return (
              <span key={i} className="route-leg">
                {i > 0 && <span className="route-arrow">→</span>}
                <span className="route-stop">
                  <span className="route-stop-name">
                    {stop.icon} {stop.base}
                  </span>
                  <span className="route-stop-days">{range}</span>
                </span>
              </span>
            );
          })}
        </div>

        <div className="animate-in animate-in-delay-1">
          {PROPOSED_PLAN.days.map((d, i) => {
            const f = formatDay(d.date);
            return (
              <div
                key={d.date}
                className="plan-day"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="plan-day-label">
                  Day {i + 1} · {f.weekday} {f.date} {f.month}
                </div>
                <h3 className="plan-day-title">
                  {d.icon} {d.title}
                </h3>
                <div className="plan-day-meta">
                  <span className="drive-chip">🛏️ overnight: {d.base}</span>
                  {(() => {
                    const url = getDayRouteUrl(
                      d,
                      PROPOSED_PLAN.days[i - 1],
                      expById
                    );
                    return url && d.base !== "✈️ Home" ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="drive-chip"
                      >
                        🗺️ day route in Maps
                      </a>
                    ) : null;
                  })()}
                </div>
                {d.note && <p className="mock-day-note">{d.note}</p>}
                <ul className="plan-items">
                  {d.blocks.map((b, j) => {
                    if (b.type === "travel") {
                      const mode = TRAVEL_MODES[b.mode];
                      return (
                        <li key={j} className="travel-leg">
                          <span className="plan-item-time">
                            {fmt(b.start)}–{fmt(b.end)}
                          </span>{" "}
                          <span className="travel-leg-route">
                            {mode.emoji} {b.from} → {b.to}
                          </span>
                          {b.note && (
                            <span className="plan-item-note"> · {b.note}</span>
                          )}
                        </li>
                      );
                    }
                    if (b.type === "event") {
                      return (
                        <li key={j} className="plan-item">
                          <div>
                            <span className="plan-item-time">
                              {fmt(b.start)}–{fmt(b.end)}
                            </span>{" "}
                            {b.emoji} {b.label}
                            {b.note && (
                              <span className="plan-item-note"> — {b.note}</span>
                            )}
                          </div>
                        </li>
                      );
                    }
                    const exp = expById.get(b.expId);
                    const score = scoreById.get(b.expId);
                    const name = exp?.name || b.fallbackName || b.expId;
                    return (
                      <li key={j} className="plan-item">
                        <div>
                          <span className="plan-item-time">
                            {fmt(b.start)}–{fmt(b.end)}
                          </span>{" "}
                          📍{" "}
                          {exp ? (
                            <a
                              href={getMapsUrl(exp)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {name}
                            </a>
                          ) : (
                            name
                          )}
                          <VoteChips score={score} />
                          {b.note && <div className="mock-reason">{b.note}</div>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mock-list-section">
          <h3 className="mock-list-title">🎯 Opt-ins — decide on the day</h3>
          <ul className="plan-items">
            {PROPOSED_PLAN.optionals.map((o) => {
              const exp = expById.get(o.expId);
              const score = scoreById.get(o.expId);
              return (
                <li key={o.expId} className="plan-item">
                  <div>
                    {exp ? (
                      <a
                        href={getMapsUrl(exp)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {exp.name}
                      </a>
                    ) : (
                      o.expId
                    )}{" "}
                    <span className="plan-item-note">— {o.when}</span>
                    <VoteChips score={score} />
                    <div className="mock-reason">{o.why}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {watchlist.length > 0 && (
          <div className="mock-list-section mock-watchlist">
            <h3 className="mock-list-title">👀 Voted in, not yet in the route</h3>
            <p className="mock-day-note">
              These crossed the vote threshold after the route was drawn —
              flag them in the group chat so the plan can absorb them.
            </p>
            <ul className="plan-items">
              {watchlist.map((s) => (
                <li key={s.exp.id} className="plan-item">
                  <div>
                    {s.exp.name}{" "}
                    <span className="plan-item-note">
                      — {regionName(s.exp.regionId)}
                    </span>
                    <VoteChips score={s} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {cut.length > 0 && (
          <div className="mock-list-section">
            <h3 className="mock-list-title">✂️ Cut by the vote</h3>
            <ul className="plan-items">
              {cut.map((s) => (
                <li key={s.exp.id} className="plan-item mock-cut">
                  <div>
                    {s.exp.name}{" "}
                    <span className="plan-item-note">
                      — {regionName(s.exp.regionId)}
                    </span>
                    <VoteChips score={s} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unvoted.length > 0 && (
          <div className="mock-list-section">
            <h3 className="mock-list-title">🗳️ Still waiting for votes</h3>
            <ul className="plan-items">
              {unvoted.map((s) => (
                <li key={s.exp.id} className="plan-item mock-cut">
                  <div>
                    {s.exp.name}{" "}
                    <span className="plan-item-note">
                      — {regionName(s.exp.regionId)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ textAlign: "center", padding: "var(--space-lg)" }}>
          <Link
            href="/calendar"
            className="quick-link"
            style={{ display: "inline-flex" }}
          >
            🗓️ Make it official on the calendar
          </Link>
        </div>
      </main>
    </>
  );
}
