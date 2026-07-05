"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { LOCKED_PLAN, ROAD_TRIP_PLAN } from "@/lib/data";
import Navbar from "@/components/Navbar";
import Link from "next/link";

function mapsSearch(query) {
  return (
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(query + ", Georgia")
  );
}

function LockedPlanView() {
  return (
    <>
      <div
        className="group-pick animate-in"
        style={{ marginBottom: "var(--space-xl)", textAlign: "center" }}
      >
        <div className="gp-label" style={{ justifyContent: "center" }}>
          🔒 Read-only
        </div>
        <p>{LOCKED_PLAN.note}</p>
      </div>

      <div className="animate-in animate-in-delay-1">
        {LOCKED_PLAN.days.map((day, i) => (
          <div
            key={i}
            className="plan-day"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="plan-day-label">{day.day}</div>
            <h3 className="plan-day-title">{day.title}</h3>
            <ul className="plan-items">
              {day.items.map((item, j) => (
                <li key={j} className="plan-item">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: "var(--space-2xl)",
          padding: "var(--space-lg)",
        }}
      >
        <p style={{ color: "var(--charcoal-light)", marginBottom: "var(--space-md)" }}>
          Days 8–10 depend on the group vote!
        </p>
        <Link href="/consensus" className="quick-link" style={{ display: "inline-flex" }}>
          📊 See what everyone wants
        </Link>
      </div>
    </>
  );
}

function RoadTripPlanView() {
  return (
    <>
      <div
        className="group-pick animate-in"
        style={{ marginBottom: "var(--space-lg)", textAlign: "center" }}
      >
        <div className="gp-label" style={{ justifyContent: "center" }}>
          🚐 Proposed — vote to shape it
        </div>
        <p>{ROAD_TRIP_PLAN.note}</p>
        <p style={{ marginTop: "var(--space-sm)", fontSize: "0.8rem" }}>
          <a
            href={ROAD_TRIP_PLAN.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            📖 Wander-Lush road-trip guide (source)
          </a>
        </p>
      </div>

      {/* Route chain */}
      <div className="route-chain animate-in">{ROAD_TRIP_PLAN.routeChain}</div>

      {/* Day by day */}
      <div className="animate-in animate-in-delay-1">
        {ROAD_TRIP_PLAN.days.map((day, i) => (
          <div
            key={i}
            className="plan-day"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="plan-day-label">{day.day}</div>
            <h3 className="plan-day-title">{day.route}</h3>
            <div className="plan-day-meta">
              {day.overnight !== "Departure" ? (
                <a
                  href={mapsSearch(day.overnight)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="maps-link"
                >
                  🛏️ {day.overnight}
                </a>
              ) : (
                <span className="maps-link" style={{ borderStyle: "dashed" }}>
                  ✈️ Departure
                </span>
              )}
              <span className="drive-chip">🚗 {day.drive}</span>
            </div>
            <ul className="plan-items">
              {day.items.map((item, j) => (
                <li key={j} className="plan-item">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Why this route works */}
      <div className="section-divider">
        <span className="section-divider-text">Why this route works</span>
      </div>
      <ul className="plan-items" style={{ marginBottom: "var(--space-xl)" }}>
        {ROAD_TRIP_PLAN.whyItWorks.map((w, i) => (
          <li key={i} className="plan-item">{w}</li>
        ))}
      </ul>

      {/* Hotels */}
      <div className="section-divider">
        <span className="section-divider-text">Suggested stays for 8</span>
      </div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        {ROAD_TRIP_PLAN.hotels.map((h, i) => (
          <div key={i} className="hotel-row">
            <a
              href={mapsSearch(h.destination.replace(/\s*\(.*\)/, ""))}
              target="_blank"
              rel="noopener noreferrer"
              className="hotel-destination"
            >
              📍 {h.destination}
            </a>
            <span className="hotel-base">{h.base}</span>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="section-divider">
        <span className="section-divider-text">Practical road-trip tips</span>
      </div>
      <ul className="plan-items" style={{ marginBottom: "var(--space-xl)" }}>
        {ROAD_TRIP_PLAN.tips.map((t, i) => (
          <li key={i} className="plan-item">{t}</li>
        ))}
      </ul>

      <div style={{ textAlign: "center", padding: "var(--space-lg)" }}>
        <Link href="/consensus" className="quick-link" style={{ display: "inline-flex" }}>
          📊 Vote on the places to shape the days
        </Link>
      </div>
    </>
  );
}

export default function PlanPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const [version, setVersion] = useState("v2");

  useEffect(() => {
    if (isLoaded && !currentUser) {
      router.push("/");
    }
  }, [isLoaded, currentUser, router]);

  if (!isLoaded || !currentUser) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  const plan = version === "v1" ? LOCKED_PLAN : ROAD_TRIP_PLAN;

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">📋</span>
          <h1>{plan.title}</h1>
          <p className="subtitle">{plan.subtitle}</p>
        </div>

        {/* Version toggle */}
        <div className="plan-version-toggle">
          <button
            className={`filter-chip ${version === "v2" ? "active" : ""}`}
            onClick={() => setVersion("v2")}
          >
            🚐 v2 — 13-Day Road-Trip Loop
          </button>
          <button
            className={`filter-chip ${version === "v1" ? "active" : ""}`}
            onClick={() => setVersion("v1")}
          >
            🔒 v1 — Original (locked)
          </button>
        </div>

        {version === "v1" ? <LockedPlanView /> : <RoadTripPlanView />}
      </main>
    </>
  );
}
