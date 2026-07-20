"use client";

import { TAG_MAP } from "@/lib/data";

/**
 * Coloured pill displaying an experience tag (e.g. "🍷 Wine", "🏔️ Nature").
 * @param {{ tag: string }} props
 */
export default function TagPill({ tag }) {
  const info = TAG_MAP[tag];
  if (!info) return null;

  return (
    <span className={`tag tag-${tag}`}>
      {info.emoji} {info.label}
    </span>
  );
}
