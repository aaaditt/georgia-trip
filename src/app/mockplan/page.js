"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useExperiences, useVotes, useRatings } from "@/lib/hooks";
import { formatDay, formatTime } from "@/lib/itinerary";
import { buildMockPlan, routeStops, regionName } from "@/lib/planner";
import { getMapsUrl } from "@/lib/links";
import Navbar from "@/components/Navbar";

function VoteChips({ counts, points, avgRating }) {
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

// A draft itinerary computed live from the family's votes — the route
// skeleton is fixed (Tbilisi start/end, the loop between), the votes
// pick the places and the tags pick the hour.
export default function MockPlanPage() {
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

  const plan = useMemo(
    () => buildMockPlan(experiences, votes, ratings),
    [experiences, votes, ratings]
  );

  if (!isLoaded || !currentUser || loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const { days, selected, deduped, cut, unvoted, leftover } = plan;
  const stops = routeStops(days);
  const votedOn = selected.length + cut.length;

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">🧭</span>
          <h1>The Mock Plan</h1>
          <p className="subtitle">
            3–16 August · drafted automatically from everyone&apos;s votes
          </p>
        </div>

        <div
          className="group-pick animate-in"
          style={{ marginBottom: "var(--space-lg)", textAlign: "center" }}
        >
          <div className="gp-label" style={{ justifyContent: "center" }}>
            🤖 How this draft is built
          </div>
          <p>
            Every place is scored from the votes (✅ = 2 pts, 🤔 = 1 pt — more
            ❌ than support cuts it), ratings break ties, and each pick lands
            on the day the route passes it, at the hour that suits it —
            ❄️ cool caves take the midday heat, 🌙 lit-up spots take the
            evening, ☀️ exposed viewpoints get mornings. Repeated activities
            (rafting, horses, tastings…) happen once, at the top-voted venue
            — cable cars stay, they&apos;re part of getting there. Change your
            votes on the <Link href="/dashboard">regions</Link> pages and
            this plan redraws itself. When it looks right, copy days onto
            the <Link href="/calendar">calendar</Link> to make them official.
          </p>
        </div>

        <div className="mock-stats animate-in">
          <div className="mock-stat">
            <span className="mock-stat-num">{selected.length}</span>
            <span className="mock-stat-label">places in</span>
          </div>
          <div className="mock-stat">
            <span className="mock-stat-num">{cut.length}</span>
            <span className="mock-stat-label">cut by the vote</span>
          </div>
          <div className="mock-stat">
            <span className="mock-stat-num">{unvoted.length}</span>
            <span className="mock-stat-label">no votes yet</span>
          </div>
          <div className="mock-stat">
            <span className="mock-stat-num">{votedOn}</span>
            <span className="mock-stat-label">voted on</span>
          </div>
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
          {days.map((d, i) => {
            const f = formatDay(d.date);
            return (
              <div
                key={d.date}
                className="plan-day"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <div className="plan-day-label">
                  Day {d.dayNumber} · {f.weekday} {f.date} {f.month}
                </div>
                <h3 className="plan-day-title">
                  {d.icon} {d.title}
                </h3>
                <div className="plan-day-meta">
                  <span className="drive-chip">🛏️ overnight: {d.base}</span>
                  {d.driveNote && (
                    <span className="drive-chip">🚗 {d.driveNote}</span>
                  )}
                </div>
                {d.note && <p className="mock-day-note">{d.note}</p>}
                {d.blocks.length === 0 ? (
                  <p className="mock-day-note">
                    Nothing voted in for this stop yet — free time, pool,
                    cafés. Vote places in and they&apos;ll appear here.
                  </p>
                ) : (
                  <ul className="plan-items">
                    {d.blocks.map((b) => (
                      <li key={b.id} className="plan-item mock-item">
                        <div>
                          <span className="plan-item-time">
                            {formatTime(b.startMin)}–{formatTime(b.startMin + b.durationMin)}
                          </span>{" "}
                          {b.emoji}{" "}
                          {b.kind === "place" ? (
                            <a
                              href={getMapsUrl(b.exp)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {b.name}
                            </a>
                          ) : (
                            b.name
                          )}
                          {b.note ? (
                            <span className="plan-item-note"> — {b.note}</span>
                          ) : null}
                          {b.kind === "place" && (
                            <VoteChips
                              counts={b.counts}
                              points={b.points}
                              avgRating={b.avgRating}
                            />
                          )}
                          {b.kind === "place" && (
                            <div className="mock-reason">{b.reason}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {leftover.length > 0 && (
          <div className="mock-list-section">
            <h3 className="mock-list-title">📦 Made the cut, didn&apos;t fit</h3>
            <p className="mock-day-note">
              Voted in, but every matching day was full. Swap them in on the
              calendar if the family wants them.
            </p>
            <ul className="plan-items">
              {leftover.map((s) => (
                <li key={s.exp.id} className="plan-item">
                  <div>
                    {s.exp.name}{" "}
                    <span className="plan-item-note">
                      — {regionName(s.exp.regionId)}
                    </span>
                    <VoteChips
                      counts={s.counts}
                      points={s.points}
                      avgRating={s.avgRating}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {deduped.length > 0 && (
          <div className="mock-list-section">
            <h3 className="mock-list-title">🔁 Same activity, better spot</h3>
            <p className="mock-day-note">
              These repeat an activity the votes ranked higher somewhere else,
              so the plan does it once — at the winning venue.
            </p>
            <ul className="plan-items">
              {deduped.map((s) => (
                <li key={s.exp.id} className="plan-item mock-cut">
                  <div>
                    {s.exp.name}{" "}
                    <span className="plan-item-note">
                      — {s.groupLabel.toLowerCase()} covered by{" "}
                      <strong>{s.winner.name}</strong>
                    </span>
                    <VoteChips
                      counts={s.counts}
                      points={s.points}
                      avgRating={s.avgRating}
                    />
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
                    <VoteChips
                      counts={s.counts}
                      points={s.points}
                      avgRating={s.avgRating}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {unvoted.length > 0 && (
          <div className="mock-list-section">
            <h3 className="mock-list-title">🗳️ Still waiting for votes</h3>
            <p className="mock-day-note">
              Nobody has voted on these yet, so the draft leaves them out.
            </p>
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
