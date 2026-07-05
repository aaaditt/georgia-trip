"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { REGIONS, TRIP_INFO } from "@/lib/data";
import { useVotes, useExperiences } from "@/lib/hooks";
import Navbar from "@/components/Navbar";
import RegionCard from "@/components/RegionCard";
import Link from "next/link";

export default function DashboardPage() {
  const { currentUser, isLoaded } = useUser();
  const { votes, loading } = useVotes();
  const { experiences } = useExperiences();
  const router = useRouter();

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

  // Calculate progress
  const totalExperiences = experiences.length;
  const votedExperiences = new Set(
    votes
      .filter((v) => v.user_id === currentUser.id)
      .map((v) => v.experience_id)
  ).size;
  const progressPct = totalExperiences > 0
    ? Math.round((votedExperiences / totalExperiences) * 100)
    : 0;

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">🇬🇪</span>
          <h1>{TRIP_INFO.title}</h1>
          <p className="subtitle">{TRIP_INFO.dates} · {TRIP_INFO.group}</p>
        </div>

        {/* Progress */}
        <div className="progress-section animate-in">
          <div className="progress-label">
            Hey {currentUser.name}! You&apos;ve voted on {votedExperiences}/{totalExperiences} experiences ({progressPct}%)
          </div>
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Quick links */}
        <div className="quick-links animate-in animate-in-delay-1">
          <Link href="/consensus" className="quick-link">
            📊 View Group Consensus
          </Link>
          <Link href="/plan" className="quick-link">
            📋 View Day-by-Day Plan
          </Link>
        </div>

        {/* Currency note */}
        <div style={{
          textAlign: "center",
          marginBottom: "var(--space-lg)",
          padding: "var(--space-sm) var(--space-md)",
          background: "var(--stone-light)",
          borderRadius: "var(--radius-full)",
          fontFamily: "var(--font-heading)",
          fontSize: "0.75rem",
          color: "var(--charcoal-light)",
          display: "inline-block",
          width: "100%",
        }}>
          💰 {TRIP_INFO.currencyNote}
        </div>

        {/* Region grid */}
        <div className="region-grid" style={{ marginTop: "var(--space-lg)" }}>
          {REGIONS.map((region, i) => (
            <RegionCard
              key={region.id}
              region={region}
              votes={votes}
              experiences={experiences}
              index={i}
            />
          ))}
        </div>
      </main>
    </>
  );
}
