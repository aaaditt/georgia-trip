"use client";

import Link from "next/link";
import { EXPERIENCES } from "@/lib/data";
import { getVoteCounts } from "@/lib/hooks";
import VoteSummary from "./VoteSummary";

export default function RegionCard({ region, votes, index }) {
  const regionExperiences = EXPERIENCES.filter(
    (e) => e.regionId === region.id
  );

  const totalGoVotes = regionExperiences.reduce((sum, exp) => {
    return sum + getVoteCounts(votes, exp.id).go;
  }, 0);

  const totalVotes = regionExperiences.reduce((sum, exp) => {
    return sum + getVoteCounts(votes, exp.id).total;
  }, 0);

  // Aggregate votes across all experiences in region
  const regionVoteCounts = regionExperiences.reduce(
    (acc, exp) => {
      const counts = getVoteCounts(votes, exp.id);
      acc.go += counts.go;
      acc.maybe += counts.maybe;
      acc.skip += counts.skip;
      acc.total += counts.total;
      return acc;
    },
    { go: 0, maybe: 0, skip: 0, total: 0 }
  );

  return (
    <Link
      href={`/region/${region.id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div
        className={`card card-clickable region-card animate-in animate-in-delay-${index}`}
      >
        <div className="region-icon">{region.icon}</div>
        <div className="region-name">{region.name}</div>
        <div className="region-subtitle">{region.subtitle}</div>

        <div className="region-stats">
          <div className="stat">📍 {regionExperiences.length} places</div>
          <div className="stat">
            ✅ {totalGoVotes} vote{totalGoVotes !== 1 ? "s" : ""} to go
          </div>
        </div>

        {regionVoteCounts.total > 0 && (
          <div style={{ marginTop: "var(--space-md)" }}>
            <VoteSummary voteCounts={regionVoteCounts} />
          </div>
        )}
      </div>
    </Link>
  );
}
