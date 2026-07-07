// Pure aggregation helpers for the admin dashboard.
// No React/Supabase here — just plain data transforms over the same
// votes/ratings/comments/experiences shapes used throughout lib/hooks.js.

import { REGIONS } from "./data";

const ATTRIBUTION_MARKER = "I suggested this place!";

// One row per user: how many experiences they've voted/rated on, and the
// names (grouped by region) of the ones they haven't touched yet.
export function getPersonProgress(users, votes, ratings, experiences) {
  return users.map((user) => {
    const votedIds = new Set(
      votes.filter((v) => v.user_id === user.id).map((v) => v.experience_id)
    );
    const ratedIds = new Set(
      ratings.filter((r) => r.user_id === user.id).map((r) => r.experience_id)
    );

    const notVoted = experiences.filter((e) => !votedIds.has(e.id));
    const notRated = experiences.filter((e) => !ratedIds.has(e.id));

    return {
      user,
      votedCount: experiences.length - notVoted.length,
      totalCount: experiences.length,
      notVoted: groupByRegion(notVoted),
      ratedCount: experiences.length - notRated.length,
      notRated: groupByRegion(notRated),
    };
  }).sort((a, b) => {
    const aLeft = a.totalCount - a.votedCount;
    const bLeft = b.totalCount - b.votedCount;
    return bLeft - aLeft;
  });
}

function groupByRegion(experiences) {
  const byRegion = new Map();
  for (const exp of experiences) {
    const region = REGIONS.find((r) => r.id === exp.regionId);
    const label = region ? `${region.icon} ${region.name}` : exp.regionId;
    if (!byRegion.has(label)) byRegion.set(label, []);
    byRegion.get(label).push(exp.name);
  }
  return Array.from(byRegion.entries()).map(([region, names]) => ({ region, names }));
}

// Custom (family-added) places with who added them, derived from the
// "💡 I suggested this place!" attribution comment AddPlaceForm posts.
export function getCustomPlaces(experiences, comments) {
  return experiences
    .filter((e) => e.custom)
    .map((exp) => {
      const attribution = comments
        .filter((c) => c.experience_id === exp.id && c.text.includes(ATTRIBUTION_MARKER))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];
      const region = REGIONS.find((r) => r.id === exp.regionId);

      return {
        experience: exp,
        regionLabel: region ? `${region.icon} ${region.name}` : exp.regionId,
        addedBy: attribution?.users || null,
        addedAt: attribution?.created_at || null,
      };
    });
}

// Overall trip-wide stats strip.
export function getOverallStats(users, votes, experiences) {
  const totalVotes = votes.length;
  const customCount = experiences.filter((e) => e.custom).length;

  const peopleFullyDone = users.filter((user) => {
    const votedCount = new Set(
      votes.filter((v) => v.user_id === user.id).map((v) => v.experience_id)
    ).size;
    return votedCount === experiences.length;
  }).length;

  let mostPopular = null;
  let mostGoVotes = -1;
  for (const exp of experiences) {
    const goVotes = votes.filter((v) => v.experience_id === exp.id && v.vote === "go").length;
    if (goVotes > mostGoVotes) {
      mostGoVotes = goVotes;
      mostPopular = exp;
    }
  }

  return {
    totalVotes,
    peopleFullyDone,
    totalPeople: users.length,
    mostPopular,
    mostGoVotes: mostGoVotes > 0 ? mostGoVotes : 0,
    customCount,
  };
}
