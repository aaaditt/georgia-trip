"use client";

import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { getVoteCounts } from "@/lib/hooks";
import VoteSummary from "./VoteSummary";

export default function RegionCard({ region, votes, experiences, index }) {
  const { currentUser } = useUser();
  const regionExperiences = experiences.filter(
    (e) => e.regionId === region.id
  );

  const votedIds = new Set(
    votes
      .filter((v) => currentUser && v.user_id === currentUser.id)
      .map((v) => v.experience_id)
  );
  const leftToVote = regionExperiences.filter(
    (e) => !votedIds.has(e.id)
  ).length;

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

        <div
          className={`vote-progress-chip ${leftToVote === 0 ? "all-done" : ""}`}
        >
          {leftToVote === 0
            ? "🎉 You've voted on everything here!"
            : `🗳️ ${leftToVote} place${leftToVote !== 1 ? "s" : ""} left for you to vote`}
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
