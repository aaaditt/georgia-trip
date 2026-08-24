import { hasCompletedVoting } from '@/lib/access';
import { experiencesInSelectedRegions, type Experience, type Region, type Vote } from '@/lib/hooks';

const region = (id: string, isSelected: boolean): Region => ({
  id,
  name: id,
  icon: '📍',
  subtitle: null,
  sortOrder: 0,
  catalogRegionId: id,
  summary: null,
  whenToGo: null,
  gettingThere: null,
  baseTowns: null,
  isSelected,
});

const place = (id: string, regionId: string): Experience => ({
  id,
  regionId,
  name: id,
  description: '',
  time: '1 hr',
  priceLari: 'Free',
  priceRupee: '—',
  priceAED: '—',
  tags: [],
  sortOrder: 0,
  catalogPlaceId: id,
  hook: null,
  tips: null,
  bestTime: null,
  durationMin: null,
  priceGelMin: null,
  priceGelMax: null,
  nearestTown: null,
  lat: null,
  lng: null,
  kidNote: null,
  bookingRequired: false,
});

const vote = (memberId: string, experienceId: string): Vote => ({
  id: 1,
  trip_id: 't',
  member_id: memberId,
  experience_id: experienceId,
  vote: 'go',
  trip_members: null,
});

describe('experiencesInSelectedRegions', () => {
  it('keeps only places whose region is shortlisted', () => {
    const regions = [region('tbilisi', true), region('svaneti', false)];
    const places = [place('a', 'tbilisi'), place('b', 'svaneti'), place('c', 'tbilisi')];
    expect(experiencesInSelectedRegions(places, regions).map((e) => e.id)).toEqual(['a', 'c']);
  });

  it('returns nothing when no region is shortlisted', () => {
    const regions = [region('tbilisi', false)];
    expect(experiencesInSelectedRegions([place('a', 'tbilisi')], regions)).toEqual([]);
  });

  it('drops places whose region is missing entirely', () => {
    expect(experiencesInSelectedRegions([place('a', 'ghost')], [region('tbilisi', true)])).toEqual([]);
  });
});

describe('hasCompletedVoting', () => {
  it('is true once every place in scope is voted on', () => {
    const places = [place('a', 'tbilisi'), place('b', 'tbilisi')];
    const votes = [vote('m1', 'a'), vote('m1', 'b')];
    expect(hasCompletedVoting(votes, places, 'm1')).toBe(true);
  });

  it('is false with one place left', () => {
    const places = [place('a', 'tbilisi'), place('b', 'tbilisi')];
    expect(hasCompletedVoting([vote('m1', 'a')], places, 'm1')).toBe(false);
  });

  it('ignores other members votes', () => {
    const places = [place('a', 'tbilisi')];
    expect(hasCompletedVoting([vote('m2', 'a')], places, 'm1')).toBe(false);
  });

  // Array.every() on an empty array is true, which would have unlocked the
  // calendar for a trip with no places at all.
  it('is false when the scope is empty', () => {
    expect(hasCompletedVoting([], [], 'm1')).toBe(false);
  });
});
