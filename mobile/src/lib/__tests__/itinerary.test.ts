import { parseDefaultDuration, tripDays } from '@/lib/itinerary';

describe('parseDefaultDuration', () => {
  it('prefers the structured duration when present', () => {
    expect(parseDefaultDuration('2–3 hr', 90)).toBe(90);
  });

  it('snaps a structured duration to the 30-minute grid', () => {
    expect(parseDefaultDuration(undefined, 100)).toBe(90);
    expect(parseDefaultDuration(undefined, 105)).toBe(120);
  });

  it('ignores a non-positive structured duration', () => {
    expect(parseDefaultDuration('45 min', 0)).toBe(60);
  });

  it('falls back to parsing the human string for member-added places', () => {
    expect(parseDefaultDuration('2 hr', null)).toBe(120);
    expect(parseDefaultDuration('full day', null)).toBe(480);
    expect(parseDefaultDuration('half day', null)).toBe(240);
  });

  it('defaults to an hour when it can parse nothing', () => {
    expect(parseDefaultDuration(undefined, null)).toBe(60);
  });
});

describe('tripDays', () => {
  it('is inclusive of both endpoints', () => {
    expect(tripDays('2027-08-03', '2027-08-06')).toEqual([
      '2027-08-03',
      '2027-08-04',
      '2027-08-05',
      '2027-08-06',
    ]);
  });

  it('is empty when either date is missing', () => {
    expect(tripDays(null, '2027-08-06')).toEqual([]);
  });
});
