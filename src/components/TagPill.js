"use client";

import { TAG_MAP } from "@/lib/data";

export default function TagPill({ tag }) {
  const info = TAG_MAP[tag];
  if (!info) return null;

  return (
    <span className={`tag tag-${tag}`}>
      {info.emoji} {info.label}
    </span>
  );
}
