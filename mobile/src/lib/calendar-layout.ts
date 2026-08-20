import { Palette } from '@/constants/theme';
import { SLOT_MIN } from '@/lib/itinerary';

export const SLOT_PX = 24; // one 30-min slot — bigger than the web app's 22px for touch
export const GUTTER_W = 52;

export const TRANSPORT_COLOR = Palette.charcoalMid;
export const CUSTOM_COLOR = '#A87E2F';

// Regions are now user-created per trip (no fixed Georgia region list to
// key a color map off of) — derive a stable color from the id instead.
const REGION_PALETTE = [Palette.wine, Palette.terra, Palette.mountain, Palette.gold, '#6C63FF', '#6B8E23', '#3B82F6', '#8B7355'];
export function colorForRegion(regionId: string | null | undefined): string {
  if (!regionId) return '#8B7355';
  let hash = 0;
  for (let i = 0; i < regionId.length; i++) hash = (hash * 31 + regionId.charCodeAt(i)) >>> 0;
  return REGION_PALETTE[hash % REGION_PALETTE.length];
}

const CUSTOM_EMOJI_RULES: [RegExp, string][] = [
  [/land/i, '🛬'],
  [/flight|fly|airport/i, '✈️'],
  [/breakfast|lunch|dinner|meal|snack/i, '🍽️'],
  [/check.?out/i, '🧳'],
  [/check.?in/i, '🏨'],
  [/rest|relax|nap/i, '😴'],
  [/fortress|castle/i, '🏰'],
  [/pick up car|rental/i, '🚗'],
];
export function customEmoji(title: string | null | undefined): string {
  for (const [re, emoji] of CUSTOM_EMOJI_RULES) if (re.test(title || '')) return emoji;
  return '📌';
}

// 'worklet' so these are callable directly from gesture-handler's
// UI-thread callbacks (calendar-block.tsx's onUpdate/onEnd), not just JS.
export function snapSlot(min: number) {
  'worklet';
  return Math.round(min / SLOT_MIN) * SLOT_MIN;
}
export function clamp(n: number, lo: number, hi: number) {
  'worklet';
  return Math.min(Math.max(n, lo), hi);
}

export type LaidOutBlock<T> = { item: T; lane: number; lanes: number };

// Pack overlapping blocks of one day into side-by-side lanes — ported
// as-is from the web app's layoutDay (pure geometry, no DOM/gesture code).
export function layoutDay<T extends { id: string; startMin: number; durationMin: number }>(
  dayItems: T[]
): Record<string, { lane: number; lanes: number }> {
  const sorted = [...dayItems].sort((a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin);
  const result: Record<string, { lane: number; lanes: number }> = {};
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const c of cluster) result[c.id] = { lane: c.lane, lanes: laneEnds.length };
    cluster = [];
    laneEnds = [];
  };
  for (const it of sorted) {
    if (cluster.length && it.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = it.startMin + it.durationMin;
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.startMin + it.durationMin);
  }
  flush();
  return result;
}
