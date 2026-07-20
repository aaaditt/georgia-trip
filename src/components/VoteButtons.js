"use client";

/**
 * Three-button row: Want to go / Maybe / Skip.
 * @param {{ currentVote: string|null, onVote: (key: string) => void }} props
 */
export default function VoteButtons({ currentVote, onVote }) {
  const options = [
    { key: "go", emoji: "✅", label: "Want to go" },
    { key: "maybe", emoji: "🤔", label: "Maybe" },
    { key: "skip", emoji: "❌", label: "Skip" },
  ];

  return (
    <div className="vote-buttons">
      {options.map((opt) => (
        <button
          key={opt.key}
          className={`vote-btn vote-${opt.key} ${
            currentVote === opt.key ? "active" : ""
          }`}
          onClick={() => onVote(opt.key)}
        >
          <span className="vote-emoji">{opt.emoji}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
