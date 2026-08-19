// Ported as-is from the web app's src/lib/data.js TAG_MAP — a shared tag
// vocabulary across all trips (not trip content, so it stays a constant
// rather than a DB table).
export const TAG_MAP: Record<string, { emoji: string; label: string; color: string }> = {
  cool: { emoji: '❄️', label: 'Cool/Shaded', color: '#4A7C8F' },
  kids: { emoji: '🧒', label: 'Kid-friendly', color: '#E8A87C' },
  wine: { emoji: '🍷', label: 'Wine/Food', color: '#8B2252' },
  scenic: { emoji: '👀', label: 'Scenic', color: '#6B8E23' },
  water: { emoji: '🚣', label: 'On Water', color: '#3B82F6' },
  cave: { emoji: '🪨', label: 'Cave/Canyon', color: '#8B7355' },
  walk: { emoji: '🚶', label: 'Light Walk', color: '#9CAF88' },
  hike: { emoji: '🥾', label: 'Longer Walk', color: '#7B6B4E' },
  thrill: { emoji: '🪂', label: 'Thrill', color: '#E63946' },
  evening: { emoji: '🌙', label: 'Evening/Lit-up', color: '#6C63FF' },
};
