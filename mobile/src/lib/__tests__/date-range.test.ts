import { dayCount } from '@/lib/date-range';

describe('dayCount', () => {
  it('counts both endpoints', () => {
    expect(dayCount('2027-08-03', '2027-08-14')).toBe(12);
  });
});
