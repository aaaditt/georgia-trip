"use client";

export default function VoteSummary({ voteCounts }) {
  const { go, maybe, skip, total } = voteCounts;

  if (total === 0) return null;

  const goWidth = (go / total) * 100;
  const maybeWidth = (maybe / total) * 100;
  const skipWidth = (skip / total) * 100;

  return (
    <div>
      <div className="vote-summary-bar">
        {go > 0 && (
          <div className="bar-go" style={{ width: `${goWidth}%` }} />
        )}
        {maybe > 0 && (
          <div className="bar-maybe" style={{ width: `${maybeWidth}%` }} />
        )}
        {skip > 0 && (
          <div className="bar-skip" style={{ width: `${skipWidth}%` }} />
        )}
      </div>
      <div className="vote-summary-counts">
        <span className="count-go">✅ {go}</span>
        <span className="count-maybe">🤔 {maybe}</span>
        <span className="count-skip">❌ {skip}</span>
      </div>
    </div>
  );
}
