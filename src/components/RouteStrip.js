"use client";

import { useMemo } from "react";
import { REGIONS } from "@/lib/data";
import { TRANSPORT_MODES, formatDay } from "@/lib/itinerary";

// Short labels for the route chips (region names are long)
const SHORT_NAMES = {
  tbilisi: "Tbilisi",
  mtskheta: "Mtskheta",
  kakheti: "Kakheti",
  "gudauri-kazbegi": "Kazbegi",
  borjomi: "Borjomi",
  "kutaisi-imereti": "Kutaisi",
  uplistsikhe: "Uplistsikhe",
  svaneti: "Svaneti",
};

function regionMeta(regionId) {
  const region = REGIONS.find((r) => r.id === regionId);
  return {
    icon: region?.icon || "📍",
    name: SHORT_NAMES[regionId] || region?.name || regionId,
  };
}

function dayRange(days) {
  if (days.length === 0) return null;
  const sorted = [...days].sort();
  const first = formatDay(sorted[0]);
  const last = formatDay(sorted[sorted.length - 1]);
  if (sorted[0] === sorted[sorted.length - 1]) return `${first.date} ${first.month}`;
  return `${first.date}–${last.date} ${last.month}`;
}

// The route around Georgia, read straight off the calendar: walk every
// block in time order, and each time the places jump to a new region
// that's the next stop. A transport block between two stops puts its
// emoji on the connecting arrow.
export default function RouteStrip({ items, experiences }) {
  const stops = useMemo(() => {
    const expById = new Map(experiences.map((e) => [e.id, e]));
    const sorted = [...items].sort(
      (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.startMin - b.startMin)
    );

    // The trip starts in Tbilisi (that's where the flights land)
    const result = [{ regionId: "tbilisi", days: [], via: null }];
    let pendingTransport = null;

    for (const it of sorted) {
      if (it.kind === "transport") {
        pendingTransport = TRANSPORT_MODES.find((m) => m.id === it.transportMode);
        continue;
      }
      if (it.kind !== "place") continue;
      const regionId = expById.get(it.experienceId)?.regionId;
      if (!regionId) continue;

      const last = result[result.length - 1];
      if (last.regionId === regionId) {
        last.days.push(it.day);
        pendingTransport = null; // that ride was local, not a leg
      } else {
        result.push({ regionId, days: [it.day], via: pendingTransport });
        pendingTransport = null;
      }
    }
    return result;
  }, [items, experiences]);

  const hasRoute = stops.length > 1;

  return (
    <div className="route-strip">
      <span className="route-label">🧭 Route</span>
      {stops.map((stop, i) => {
        const meta = regionMeta(stop.regionId);
        const range = dayRange(stop.days);
        return (
          <span key={i} className="route-leg">
            {i > 0 && (
              <span className="route-arrow">
                {stop.via ? stop.via.emoji : ""} →
              </span>
            )}
            <span className="route-stop">
              <span className="route-stop-name">
                {meta.icon} {meta.name}
              </span>
              <span className="route-stop-days">
                {i === 0 && stop.days.length === 0 ? "start · 3 Aug" : range || "—"}
              </span>
            </span>
          </span>
        );
      })}
      {!hasRoute && (
        <span className="route-hint">
          — the route draws itself as places land on the calendar
        </span>
      )}
    </div>
  );
}
