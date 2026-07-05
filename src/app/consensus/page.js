"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { REGIONS, TAG_MAP } from "@/lib/data";
import {
  useVotes,
  useRatings,
  useComments,
  useExperiences,
  getVoteCounts,
  getAverageRating,
  getCommentsForExperience,
} from "@/lib/hooks";
import { getMapsUrl } from "@/lib/links";
import Navbar from "@/components/Navbar";
import VoteSummary from "@/components/VoteSummary";
import TagPill from "@/components/TagPill";

export default function ConsensusPage() {
  const { currentUser, isLoaded } = useUser();
  const router = useRouter();
  const { votes } = useVotes();
  const { ratings } = useRatings();
  const { comments } = useComments();
  const { experiences } = useExperiences();
  const [regionFilter, setRegionFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");

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

  // Filter & sort experiences
  let filtered = [...experiences];

  if (regionFilter !== "all") {
    filtered = filtered.filter((e) => e.regionId === regionFilter);
  }

  if (tagFilter !== "all") {
    filtered = filtered.filter((e) => e.tags.includes(tagFilter));
  }

  // Sort by go votes (desc), then by avg rating (desc)
  const sorted = filtered.sort((a, b) => {
    const aGo = getVoteCounts(votes, a.id).go;
    const bGo = getVoteCounts(votes, b.id).go;
    if (bGo !== aGo) return bGo - aGo;

    const aRating = getAverageRating(ratings, a.id);
    const bRating = getAverageRating(ratings, b.id);
    return bRating - aRating;
  });

  const allTags = Object.keys(TAG_MAP);

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">📊</span>
          <h1>Group Consensus</h1>
          <p className="subtitle">
            Experiences ranked by how many people want to go
          </p>
        </div>

        {/* Filters */}
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <div className="section-divider">
            <span className="section-divider-text">Filter by Region</span>
          </div>
          <div className="filter-row">
            <button
              className={`filter-chip ${regionFilter === "all" ? "active" : ""}`}
              onClick={() => setRegionFilter("all")}
            >
              All Regions
            </button>
            {REGIONS.map((r) => (
              <button
                key={r.id}
                className={`filter-chip ${regionFilter === r.id ? "active" : ""}`}
                onClick={() => setRegionFilter(r.id)}
              >
                {r.icon} {r.name}
              </button>
            ))}
          </div>

          <div className="section-divider">
            <span className="section-divider-text">Filter by Tag</span>
          </div>
          <div className="filter-row">
            <button
              className={`filter-chip ${tagFilter === "all" ? "active" : ""}`}
              onClick={() => setTagFilter("all")}
            >
              All Tags
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`filter-chip ${tagFilter === tag ? "active" : ""}`}
                onClick={() => setTagFilter(tag)}
              >
                {TAG_MAP[tag].emoji} {TAG_MAP[tag].label}
              </button>
            ))}
          </div>
        </div>

        {/* Consensus list */}
        {sorted.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗳️</div>
            <p>No matching experiences found</p>
          </div>
        ) : (
          sorted.map((exp, idx) => {
            const voteCounts = getVoteCounts(votes, exp.id);
            const avgRating = getAverageRating(ratings, exp.id);
            const expComments = getCommentsForExperience(comments, exp.id);
            const region = REGIONS.find((r) => r.id === exp.regionId);
            const isHighlight = voteCounts.go >= 6;

            return (
              <div
                key={exp.id}
                className={`card consensus-card ${
                  isHighlight ? "consensus-highlight" : ""
                } animate-in animate-in-delay-${Math.min(idx, 7)}`}
              >
                <div className="consensus-rank">{idx + 1}</div>
                <div className="consensus-content">
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", flexWrap: "wrap", marginBottom: "var(--space-xs)" }}>
                    <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", fontWeight: 600 }}>
                      {exp.name}
                    </h3>
                    {isHighlight && (
                      <span style={{
                        padding: "1px 8px",
                        background: "var(--go-bg)",
                        border: "1px solid var(--go-border)",
                        borderRadius: "var(--radius-full)",
                        fontFamily: "var(--font-heading)",
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: "var(--go)",
                      }}>
                        🎉 Group Favorite!
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: "0.85rem", color: "var(--charcoal-mid)", marginBottom: "var(--space-sm)" }}>
                    {exp.description}
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-sm)" }}>
                    <span style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "0.72rem",
                      color: "var(--charcoal-light)",
                      background: "var(--stone-light)",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                    }}>
                      {region?.icon} {region?.name}
                    </span>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: "var(--charcoal-light)" }}>
                      ₾ {exp.priceLari}
                    </span>
                    <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: "var(--charcoal-light)" }}>
                      ⏱️ {exp.time}
                    </span>
                    <a
                      href={getMapsUrl(exp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="maps-link"
                    >
                      📍 Map
                    </a>
                    {avgRating > 0 && (
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: "0.75rem", color: "var(--gold)" }}>
                        ★ {avgRating.toFixed(1)}
                      </span>
                    )}
                    {exp.tags.length > 0 && (
                      <div className="tags">
                        {exp.tags.map((t) => (
                          <TagPill key={t} tag={t} />
                        ))}
                      </div>
                    )}
                  </div>

                  {voteCounts.total > 0 && (
                    <VoteSummary voteCounts={voteCounts} />
                  )}

                  {expComments.length > 0 && (
                    <div style={{ marginTop: "var(--space-sm)" }}>
                      <span style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: "0.72rem",
                        color: "var(--charcoal-light)",
                      }}>
                        💬 {expComments.length} comment{expComments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>

                <Link
                  href={`/region/${exp.regionId}`}
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "0.78rem",
                    color: "var(--wine)",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                    alignSelf: "flex-start",
                  }}
                >
                  Vote →
                </Link>
              </div>
            );
          })
        )}
      </main>
    </>
  );
}
