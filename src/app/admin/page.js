"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { useAdmin } from "@/context/AdminContext";
import { USERS } from "@/lib/data";
import { useVotes, useRatings, useComments, useExperiences } from "@/lib/hooks";
import { useCalendarAccess, hasCompletedVoting } from "@/lib/access";
import { getPersonProgress, getCustomPlaces, getOverallStats } from "@/lib/adminStats";
import Navbar from "@/components/Navbar";
import AdminGateModal from "@/components/AdminGateModal";

export default function AdminPage() {
  const { currentUser, isLoaded } = useUser();
  const { isAdmin } = useAdmin();
  const router = useRouter();

  const { votes, loading: votesLoading } = useVotes();
  const { ratings, loading: ratingsLoading } = useRatings();
  const { comments, loading: commentsLoading } = useComments();
  const { experiences, loading: experiencesLoading } = useExperiences();
  const { grantedIds, grantAccess, revokeAccess } = useCalendarAccess();

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

  if (!isAdmin) {
    return (
      <>
        <Navbar />
        <AdminGateModal onClose={() => router.push("/dashboard")} onUnlocked={() => {}} />
      </>
    );
  }

  const dataLoading = votesLoading || ratingsLoading || commentsLoading || experiencesLoading;

  if (dataLoading) {
    return (
      <>
        <Navbar />
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      </>
    );
  }

  const personProgress = getPersonProgress(USERS, votes, ratings, experiences);
  const customPlaces = getCustomPlaces(experiences, comments);
  const overall = getOverallStats(USERS, votes, experiences);

  return (
    <>
      <Navbar />
      <main className="page-container">
        <div className="page-header">
          <span className="flag">🔒</span>
          <h1>Admin</h1>
          <p className="subtitle">Who&apos;s voted, who&apos;s left, and what&apos;s been added</p>
        </div>

        {/* Overall stats strip */}
        <div className="admin-stats-grid animate-in">
          <div className="admin-stat-tile">
            <div className="admin-stat-value">{overall.totalVotes}</div>
            <div className="admin-stat-label">Total votes cast</div>
          </div>
          <div className="admin-stat-tile">
            <div className="admin-stat-value">{overall.peopleFullyDone}/{overall.totalPeople}</div>
            <div className="admin-stat-label">People fully done voting</div>
          </div>
          <div className="admin-stat-tile">
            <div className="admin-stat-value">{overall.mostPopular?.name || "—"}</div>
            <div className="admin-stat-label">
              Most popular {overall.mostGoVotes > 0 ? `(${overall.mostGoVotes} go votes)` : ""}
            </div>
          </div>
          <div className="admin-stat-tile">
            <div className="admin-stat-value">{overall.customCount}</div>
            <div className="admin-stat-label">Custom places added</div>
          </div>
        </div>

        {/* Calendar edit access */}
        <div className="section-divider">
          <span className="section-divider-text">Calendar Access</span>
        </div>

        <div className="card" style={{ marginBottom: "var(--space-lg)" }}>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-light)", marginBottom: "var(--space-md)" }}>
            The calendar unlocks by itself once someone has voted on every
            place. Use these switches to unlock someone early — it applies
            instantly on their phone.
          </p>
          {USERS.map((u) => {
            const votedAll = hasCompletedVoting(votes, experiences, u.id);
            const granted = grantedIds.has(u.id);
            return (
              <div key={u.id} className="admin-access-row">
                <span className="admin-person-name">
                  {u.emoji} {u.name}
                </span>
                {votedAll ? (
                  <span className="admin-tally-done">✅ Unlocked (voting done)</span>
                ) : granted ? (
                  <button className="admin-access-btn revoke" onClick={() => revokeAccess(u.id)}>
                    🔓 Granted — tap to revoke
                  </button>
                ) : (
                  <button className="admin-access-btn" onClick={() => grantAccess(u.id)}>
                    🔒 Locked — tap to grant
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Per-person progress */}
        <div className="section-divider">
          <span className="section-divider-text">Who&apos;s Voted</span>
        </div>

        {personProgress.map((p, i) => (
          <div key={p.user.id} className={`card admin-person-card animate-in animate-in-delay-${Math.min(i, 7)}`}>
            <div className="admin-person-header">
              <span className="admin-person-name">
                {p.user.emoji} {p.user.name}
              </span>
              <div className="admin-person-tallies">
                <span className={p.votedCount === p.totalCount ? "admin-tally-done" : "admin-tally"}>
                  🗳️ {p.votedCount}/{p.totalCount} voted
                </span>
                <span className={p.ratedCount === p.totalCount ? "admin-tally-done" : "admin-tally"}>
                  ⭐ {p.ratedCount}/{p.totalCount} rated
                </span>
              </div>
            </div>

            {p.notVoted.length > 0 && (
              <details className="admin-remaining">
                <summary>Still needs to vote on {p.totalCount - p.votedCount} place(s)</summary>
                {p.notVoted.map((group) => (
                  <div key={group.region} className="admin-remaining-group">
                    <div className="admin-remaining-region">{group.region}</div>
                    <div className="admin-remaining-names">{group.names.join(", ")}</div>
                  </div>
                ))}
              </details>
            )}

            {p.notRated.length > 0 && (
              <details className="admin-remaining">
                <summary>Still needs to rate {p.totalCount - p.ratedCount} place(s)</summary>
                {p.notRated.map((group) => (
                  <div key={group.region} className="admin-remaining-group">
                    <div className="admin-remaining-region">{group.region}</div>
                    <div className="admin-remaining-names">{group.names.join(", ")}</div>
                  </div>
                ))}
              </details>
            )}
          </div>
        ))}

        {/* Custom places */}
        <div className="section-divider">
          <span className="section-divider-text">Custom Places Added</span>
        </div>

        {customPlaces.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">➕</div>
            <p>No custom places suggested yet</p>
          </div>
        ) : (
          <div className="card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Region</th>
                  <th>Added by</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {customPlaces.map((cp) => (
                  <tr key={cp.experience.id}>
                    <td>{cp.experience.name}</td>
                    <td>{cp.regionLabel}</td>
                    <td>
                      {cp.addedBy ? `${cp.addedBy.emoji} ${cp.addedBy.name}` : "Unknown"}
                    </td>
                    <td>
                      {cp.addedAt
                        ? new Date(cp.addedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
