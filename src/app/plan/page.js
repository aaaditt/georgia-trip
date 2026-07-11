"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { useExperiences } from "@/lib/hooks";
import {
  useItinerary,
  TRIP_DAYS,
  TRANSPORT_MODES,
  formatDay,
  formatTime,
} from "@/lib/itinerary";
import { getMapsUrl } from "@/lib/links";
import Navbar from "@/components/Navbar";
import RouteStrip from "@/components/RouteStrip";

// The plan is generated live from the shared drag-and-drop calendar —
// every block someone places there shows up here, day by day.
export default function PlanPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const { experiences } = useExperiences();
  const { items, loading } = useItinerary();

  useEffect(() => {
    if (isLoaded && !currentUser) {
      router.push("/");
    }
  }, [isLoaded, currentUser, router]);

  const expById = useMemo(() => {
    const map = new Map();
    for (const e of experiences) map.set(e.id, e);
    return map;
  }, [experiences]);

  const days = useMemo(() => {
    return TRIP_DAYS.map((day, i) => {
      const dayItems = items
        .filter((it) => it.day === day)
        .sort((a, b) => a.startMin - b.startMin)
        .map((it) => {
          if (it.kind === "place") {
            const exp = expById.get(it.experienceId);
            return {
              ...it,
              emoji: "📍",
              name: exp ? exp.name : "(removed place)",
              exp,
            };
          }
          if (it.kind === "transport") {
            const mode = TRANSPORT_MODES.find((m) => m.id === it.transportMode);
            return {
              ...it,
              emoji: mode?.emoji || "🚗",
              name: mode?.label || "Transport",
              note: it.title,
            };
          }
          return { ...it, emoji: "📌", name: it.title || "Event" };
        });
      return { day, dayNumber: i + 1, items: dayItems };
    });
  }, [items, expById]);

  if (!isLoaded || !currentUser) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const totalItems = items.length;
  const plannedDays = days.filter((d) => d.items.length > 0);

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">📋</span>
          <h1>The Master Plan</h1>
          <p className="subtitle">
            3–20 August · built live from the family calendar
          </p>
        </div>

        <div
          className="group-pick animate-in"
          style={{ marginBottom: "var(--space-xl)", textAlign: "center" }}
        >
          <div className="gp-label" style={{ justifyContent: "center" }}>
            🗓️ Live
          </div>
          <p>
            Every block on the{" "}
            <Link href="/calendar">shared calendar</Link> lands here,
            formatted day by day. Change the calendar and this page updates
            for everyone instantly.
          </p>
        </div>

        {!loading && totalItems > 0 && (
          <RouteStrip items={items} experiences={experiences} />
        )}

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : totalItems === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗓️</div>
            <p>Nothing scheduled yet — the plan builds itself as the family
              drags places onto the calendar.</p>
            <Link
              href="/calendar"
              className="quick-link"
              style={{ display: "inline-flex", marginTop: "var(--space-md)" }}
            >
              🗓️ Open the calendar
            </Link>
          </div>
        ) : (
          <div className="animate-in animate-in-delay-1">
            {plannedDays.map((d, i) => {
              const f = formatDay(d.day);
              return (
                <div
                  key={d.day}
                  className="plan-day"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="plan-day-label">Day {d.dayNumber}</div>
                  <h3 className="plan-day-title">
                    {f.weekday} {f.date} {f.month}
                  </h3>
                  <ul className="plan-items">
                    {d.items.map((it) => (
                      <li key={it.id} className="plan-item">
                        <span className="plan-item-time">
                          {formatTime(it.startMin)}–{formatTime(it.startMin + it.durationMin)}
                        </span>{" "}
                        {it.emoji}{" "}
                        {it.kind === "place" && it.exp ? (
                          <a
                            href={getMapsUrl(it.exp)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {it.name}
                          </a>
                        ) : (
                          it.name
                        )}
                        {it.note ? (
                          <span className="plan-item-note"> — {it.note}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ textAlign: "center", padding: "var(--space-lg)" }}>
          <Link href="/calendar" className="quick-link" style={{ display: "inline-flex" }}>
            🗓️ Adjust the plan on the calendar
          </Link>
        </div>
      </main>
    </>
  );
}
