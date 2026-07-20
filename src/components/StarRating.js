"use client";

import { useState } from "react";

/**
 * Interactive 1–5 star rating with hover preview.
 * @param {{ currentRating: number, onRate: (star: number) => void }} props
 */
export default function StarRating({ currentRating, onRate }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      className="star-rating"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className={`star-btn ${
            star <= (hovered || currentRating) ? "filled" : ""
          } ${hovered && star <= hovered ? "hovered" : ""}`}
          onClick={() => onRate(star)}
          onMouseEnter={() => setHovered(star)}
          title={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
