"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/context/UserContext";
import { REGIONS } from "@/lib/data";
import { useVotes, useRatings, useComments, useExperiences } from "@/lib/hooks";
import { usePlaceNotes } from "@/lib/notes";
import Navbar from "@/components/Navbar";
import ExperienceCard from "@/components/ExperienceCard";
import AddPlaceForm from "@/components/AddPlaceForm";

export default function RegionPage() {
  const { currentUser, isLoaded } = useUser();
  const params = useParams();
  const router = useRouter();
  const { votes } = useVotes();
  const { ratings } = useRatings();
  const { comments } = useComments();
  const { notes: placeNotes } = usePlaceNotes();
  const { experiences, refetch: refetchExperiences } = useExperiences();

  useEffect(() => {
    if (isLoaded && !currentUser) {
      router.push("/");
    }
  }, [isLoaded, currentUser, router]);

  const region = REGIONS.find((r) => r.id === params.slug);
  const regionExperiences = experiences.filter(
    (e) => e.regionId === params.slug
  );

  if (!isLoaded || !currentUser) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!region) {
    return (
      <>
        <Navbar />
        <main className="page-container">
          <div className="empty-state">
            <div className="empty-icon">🤷</div>
            <p>Region not found</p>
            <Link href="/dashboard" className="back-link" style={{ marginTop: "var(--space-md)", display: "inline-flex" }}>
              ← Back to dashboard
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="page-container">
        <Link href="/dashboard" className="back-link">
          ← Back to all regions
        </Link>

        <div className="page-header" style={{ textAlign: "left" }}>
          <span style={{ fontSize: "2.5rem" }}>{region.icon}</span>
          <h1 style={{ marginTop: "var(--space-sm)" }}>{region.name}</h1>
          <p className="subtitle">{region.subtitle}</p>
          <p style={{ marginTop: "var(--space-md)", maxWidth: "700px" }}>
            {region.description}
          </p>
        </div>

        {/* Group pick */}
        {region.groupPick && (
          <div className="group-pick animate-in">
            <div className="gp-label">🎯 Suggested group pick</div>
            <p>{region.groupPick}</p>
          </div>
        )}

        {/* Review summary */}
        {region.reviewSummary && (
          <div className="review-quote animate-in animate-in-delay-1" style={{ marginBottom: "var(--space-xl)" }}>
            {region.reviewSummary}
          </div>
        )}

        {/* Experiences */}
        <div className="section-divider">
          <span className="section-divider-text">
            {regionExperiences.length} Experiences
          </span>
        </div>

        {regionExperiences.map((exp, i) => (
          <div
            key={exp.id}
            className={`animate-in animate-in-delay-${Math.min(i + 2, 7)}`}
          >
            <ExperienceCard
              experience={exp}
              votes={votes}
              ratings={ratings}
              comments={comments}
              notes={placeNotes}
            />
          </div>
        ))}

        <AddPlaceForm regionId={params.slug} onAdded={refetchExperiences} />
      </main>
    </>
  );
}
