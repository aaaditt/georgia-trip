import {
  addDays,
  addMonths,
  dayCount,
  isBetween,
  monthGrid,
  monthLabel,
  yearMonthOf,
} from '@/lib/date-range';

describe('dayCount', () => {
  it('counts both endpoints', () => {
    expect(dayCount('2027-08-03', '2027-08-14')).toBe(12);
  });

  it('is 1 for a single day', () => {
    expect(dayCount('2027-08-03', '2027-08-03')).toBe(1);
  });

  it('is 0 when end precedes start', () => {
    expect(dayCount('2027-08-14', '2027-08-03')).toBe(0);
  });

  it('crosses a month boundary', () => {
    expect(dayCount('2027-08-30', '2027-09-02')).toBe(4);
  });

  it('crosses a leap day', () => {
    expect(dayCount('2028-02-27', '2028-03-01')).toBe(4);
  });
});

describe('addDays', () => {
  it('rolls over a month end', () => {
    expect(addDays('2027-08-31', 1)).toBe('2027-09-01');
  });

  it('goes backwards', () => {
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('addMonths', () => {
  it('rolls over a year end', () => {
    expect(addMonths({ year: 2027, month: 12 }, 1)).toEqual({ year: 2028, month: 1 });
  });

  it('goes backwards past a year start', () => {
    expect(addMonths({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
  });
});

describe('monthGrid', () => {
  it('always returns 42 cells so the grid height never jumps', () => {
    expect(monthGrid({ year: 2027, month: 8 })).toHaveLength(42);
    expect(monthGrid({ year: 2027, month: 2 })).toHaveLength(42);
  });

  it('is Monday-first: 1 Aug 2027 is a Sunday, so it sits in cell 6', () => {
    const grid = monthGrid({ year: 2027, month: 8 });
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toBe('2027-08-01');
  });

  it('pads the tail with nulls after the last day', () => {
    const grid = monthGrid({ year: 2027, month: 8 });
    expect(grid[36]).toBe('2027-08-31');
    expect(grid[37]).toBeNull();
  });

  it('handles a month starting on a Monday with no leading pad', () => {
    // 1 Feb 2027 is a Monday.
    expect(monthGrid({ year: 2027, month: 2 })[0]).toBe('2027-02-01');
  });
});

describe('isBetween', () => {
  it('includes both endpoints', () => {
    expect(isBetween('2027-08-03', '2027-08-03', '2027-08-14')).toBe(true);
    expect(isBetween('2027-08-14', '2027-08-03', '2027-08-14')).toBe(true);
  });

  it('excludes outside days', () => {
    expect(isBetween('2027-08-02', '2027-08-03', '2027-08-14')).toBe(false);
    expect(isBetween('2027-08-15', '2027-08-03', '2027-08-14')).toBe(false);
  });
});

describe('monthLabel', () => {
  it('formats as month and year', () => {
    expect(monthLabel({ year: 2027, month: 8 })).toBe('August 2027');
  });
});

describe('yearMonthOf', () => {
  it('extracts a 1-based month', () => {
    expect(yearMonthOf('2027-08-03')).toEqual({ year: 2027, month: 8 });
  });
});
