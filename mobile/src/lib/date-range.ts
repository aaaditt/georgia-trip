/**
 * Pure UTC date maths for the trip date-range picker.
 *
 * Everything is UTC on purpose, matching tripDays() in lib/itinerary.ts. A
 * bare `new Date('2027-08-03')` parses as UTC but `new Date(2027, 7, 3)` is
 * local, and mixing the two shifts dates by a day for anyone west of
 * Greenwich. Always go through fromIso().
 */

/** An ISO calendar date, `YYYY-MM-DD`. Always interpreted as UTC midnight. */
export type IsoDate = string;

/** `month` is 1-based: 1 = January, 12 = December. */
export type YearMonth = { year: number; month: number };

const MS_PER_DAY = 86_400_000;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function fromIso(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function todayIso(): IsoDate {
  return toIso(new Date());
}

export function yearMonthOf(iso: IsoDate): YearMonth {
  const d = fromIso(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  return toIso(new Date(fromIso(iso).getTime() + n * MS_PER_DAY));
}

export function addMonths(ym: YearMonth, n: number): YearMonth {
  // Work in absolute months to avoid manual wrap-around arithmetic.
  const total = ym.year * 12 + (ym.month - 1) + n;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

export function monthLabel(ym: YearMonth): string {
  return `${MONTH_NAMES[ym.month - 1]} ${ym.year}`;
}

/** Inclusive of both endpoints: 03 to 14 is 12 days. Returns 0 if end precedes start. */
export function dayCount(start: IsoDate, end: IsoDate): number {
  const ms = fromIso(end).getTime() - fromIso(start).getTime();
  if (ms < 0) return 0;
  return Math.round(ms / MS_PER_DAY) + 1;
}

/** Inclusive of both endpoints. */
export function isBetween(iso: IsoDate, start: IsoDate, end: IsoDate): boolean {
  const t = fromIso(iso).getTime();
  return t >= fromIso(start).getTime() && t <= fromIso(end).getTime();
}

/**
 * A Monday-first calendar grid for one month, always exactly 42 cells (6
 * rows) so the picker's height never jumps between months. Padding cells are
 * null rather than adjacent-month dates — greying out neighbours adds
 * ambiguity about which month a tap belongs to for no real benefit.
 */
export function monthGrid(ym: YearMonth): (IsoDate | null)[] {
  const first = new Date(Date.UTC(ym.year, ym.month - 1, 1));
  // getUTCDay() is Sunday-0; shift so Monday is 0.
  const leadingPad = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(ym.year, ym.month, 0)).getUTCDate();

  const cells: (IsoDate | null)[] = [];
  for (let i = 0; i < leadingPad; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toIso(new Date(Date.UTC(ym.year, ym.month - 1, day))));
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}
