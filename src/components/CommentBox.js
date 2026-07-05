"use client";

import { useState } from "react";
import { addComment, deleteComment } from "@/lib/hooks";
import { useUser } from "@/context/UserContext";

export default function CommentBox({ comments, experienceId }) {
  const { currentUser } = useUser();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !currentUser) return;

    setSubmitting(true);
    await addComment(currentUser.id, experienceId, text.trim());
    setText("");
    setSubmitting(false);
  };

  const handleDelete = async (commentId) => {
    await deleteComment(commentId);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  return (
    <div className="comment-section">
      {comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-item">
              <div className="comment-avatar">
                {c.users?.emoji || "🧑"}
              </div>
              <div className="comment-body">
                <div className="comment-author">
                  {c.users?.name || "Unknown"}
                </div>
                <div className="comment-text">{c.text}</div>
                <div className="comment-time">
                  {formatTime(c.created_at)}
                </div>
              </div>
              {currentUser && c.user_id === currentUser.id && (
                <button
                  className="comment-delete"
                  onClick={() => handleDelete(c.id)}
                  title="Delete comment"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="comment-input"
          placeholder="Add a note..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
        <button
          type="submit"
          className="comment-submit"
          disabled={!text.trim() || submitting}
        >
          {submitting ? "..." : "Post"}
        </button>
      </form>
    </div>
  );
}
