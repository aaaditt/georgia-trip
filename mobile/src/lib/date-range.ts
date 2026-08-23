/** An ISO calendar date, `YYYY-MM-DD`. Always interpreted as UTC midnight. */
export type IsoDate = string;

export function fromIso(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

/** Inclusive of both endpoints: 03→14 is 12 days. Returns 0 if end precedes start. */
export function dayCount(start: IsoDate, end: IsoDate): number {
  const ms = fromIso(end).getTime() - fromIso(start).getTime();
  if (ms < 0) return 0;
  return Math.round(ms / 86_400_000) + 1;
}
