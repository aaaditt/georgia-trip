"use client";

import { useState } from "react";
import { addExperience, addComment } from "@/lib/hooks";
import { useUser } from "@/context/UserContext";

export default function AddPlaceForm({ regionId, onAdded }) {
  const { currentUser } = useUser();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [time, setTime] = useState("");
  const [priceLari, setPriceLari] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !currentUser) return;

    setSubmitting(true);
    setError(null);
    const { id, error: insertError } = await addExperience({
      regionId,
      name,
      description,
      time,
      priceLari,
    });
    if (insertError) {
      setError("Couldn't add the place — check your connection and try again.");
      setSubmitting(false);
      return;
    }
    // Attribution lives in the comments (they already track who wrote them)
    await addComment(currentUser.id, id, "💡 I suggested this place!");
    setName("");
    setDescription("");
    setTime("");
    setPriceLari("");
    setSubmitting(false);
    setOpen(false);
    onAdded?.();
  };

  if (!open) {
    return (
      <button className="add-place-toggle" onClick={() => setOpen(true)}>
        ➕ Suggest a new place in this region
      </button>
    );
  }

  return (
    <div className="card add-place-card">
      <h3 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", fontWeight: 600, marginBottom: "var(--space-sm)" }}>
        ➕ Suggest a new place
      </h3>
      <p style={{ fontSize: "0.8rem", color: "var(--charcoal-light)", marginBottom: "var(--space-md)" }}>
        It shows up for everyone instantly, and the family can vote, rate and
        comment on it like any other spot.
      </p>
      <form onSubmit={handleSubmit} className="add-place-form">
        <input
          type="text"
          className="comment-input"
          placeholder="Place name (required)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
        <input
          type="text"
          className="comment-input"
          placeholder="What is it / why go? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
        />
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <input
            type="text"
            className="comment-input"
            placeholder="Time needed, e.g. 1–2 hr"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            maxLength={30}
          />
          <input
            type="text"
            className="comment-input"
            placeholder="Price ₾, e.g. ~20"
            value={priceLari}
            onChange={(e) => setPriceLari(e.target.value)}
            maxLength={30}
          />
        </div>
        {error && (
          <p style={{ fontSize: "0.8rem", color: "var(--skip, #c0392b)" }}>{error}</p>
        )}
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button
            type="submit"
            className="comment-submit"
            disabled={!name.trim() || submitting}
          >
            {submitting ? "Adding..." : "Add place"}
          </button>
          <button
            type="button"
            className="comment-submit add-place-cancel"
            onClick={() => { setOpen(false); setError(null); }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
