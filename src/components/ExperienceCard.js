"use client";

import { useUser } from "@/context/UserContext";
import {
  upsertVote,
  upsertRating,
  getVotesForExperience,
  getRatingsForExperience,
  getCommentsForExperience,
  getVoteCounts,
  getUserVote,
  getUserRating,
  getAverageRating,
} from "@/lib/hooks";
import TagPill from "./TagPill";
import VoteButtons from "./VoteButtons";
import StarRating from "./StarRating";
import VoteSummary from "./VoteSummary";
import CommentBox from "./CommentBox";

export default function ExperienceCard({
  experience,
  votes,
  ratings,
  comments,
}) {
  const { currentUser } = useUser();

  const expVotes = getVotesForExperience(votes, experience.id);
  const voteCounts = getVoteCounts(votes, experience.id);
  const currentVote = currentUser
    ? getUserVote(votes, currentUser.id, experience.id)
    : null;
  const currentRating = currentUser
    ? getUserRating(ratings, currentUser.id, experience.id)
    : null;
  const avgRating = getAverageRating(ratings, experience.id);
  const expComments = getCommentsForExperience(comments, experience.id);
  const ratingCount = getRatingsForExperience(ratings, experience.id).length;

  const handleVote = async (vote) => {
    if (!currentUser) return;
    // Toggle off if clicking same vote
    if (currentVote === vote) {
      // We don't support unsetting — just keep it
      return;
    }
    await upsertVote(currentUser.id, experience.id, vote);
  };

  const handleRate = async (rating) => {
    if (!currentUser) return;
    await upsertRating(currentUser.id, experience.id, rating);
  };

  const voteClass = currentVote ? `voted-${currentVote}` : "";

  return (
    <div className={`card experience-card ${voteClass}`}>
      <div className="experience-header">
        <div>
          <h3 className="experience-name">{experience.name}</h3>
          <p className="experience-description">{experience.description}</p>
        </div>
        {experience.tags.length > 0 && (
          <div className="tags">
            {experience.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>

      <div className="experience-meta">
        <div className="meta-item">
          <span className="meta-label">⏱️</span>
          <span className="meta-value">{experience.time}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">₾</span>
          <span className="meta-value">{experience.priceLari}</span>
        </div>
        {experience.priceRupee !== "—" && (
          <div className="meta-item">
            <span className="meta-value">{experience.priceRupee}</span>
          </div>
        )}
        {experience.priceAED !== "—" && (
          <div className="meta-item">
            <span className="meta-value">{experience.priceAED}</span>
          </div>
        )}
        {avgRating > 0 && (
          <div className="meta-item">
            <span className="meta-label">★</span>
            <span className="meta-value">
              {avgRating.toFixed(1)} ({ratingCount})
            </span>
          </div>
        )}
      </div>

      {/* Interactions */}
      <div className="experience-interactions">
        <div className="interaction-row">
          <span className="interaction-label">Vote</span>
          <VoteButtons currentVote={currentVote} onVote={handleVote} />
        </div>

        <div className="interaction-row">
          <span className="interaction-label">Rate</span>
          <StarRating currentRating={currentRating || 0} onRate={handleRate} />
        </div>
      </div>

      {/* Vote summary */}
      {voteCounts.total > 0 && (
        <div style={{ marginTop: "var(--space-md)" }}>
          <VoteSummary voteCounts={voteCounts} />

          {/* Who voted what */}
          <div className="who-voted" style={{ marginTop: "var(--space-sm)" }}>
            {expVotes.filter(v => v.vote === "go").length > 0 && (
              <div className="voter-avatars" style={{ marginBottom: "4px" }}>
                {expVotes
                  .filter((v) => v.vote === "go")
                  .map((v) => (
                    <span key={v.id} className="voter-chip chip-go">
                      {v.users?.emoji} {v.users?.name}
                    </span>
                  ))}
              </div>
            )}
            {expVotes.filter(v => v.vote === "maybe").length > 0 && (
              <div className="voter-avatars" style={{ marginBottom: "4px" }}>
                {expVotes
                  .filter((v) => v.vote === "maybe")
                  .map((v) => (
                    <span key={v.id} className="voter-chip chip-maybe">
                      {v.users?.emoji} {v.users?.name}
                    </span>
                  ))}
              </div>
            )}
            {expVotes.filter(v => v.vote === "skip").length > 0 && (
              <div className="voter-avatars">
                {expVotes
                  .filter((v) => v.vote === "skip")
                  .map((v) => (
                    <span key={v.id} className="voter-chip chip-skip">
                      {v.users?.emoji} {v.users?.name}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comments */}
      <CommentBox comments={expComments} experienceId={experience.id} />
    </div>
  );
}
