import { useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { TagPill } from '@/components/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { getAverageRating, getVoteCounts, useExperiences, useRatings, useRegions, useVotes, type Experience } from '@/lib/hooks';

// go counts double, maybe counts once, skip subtracts — a simple, legible
// consensus score rather than anything fancier (weighted averages, etc).
function scoreFor(votes: ReturnType<typeof useVotes>['votes'], ratings: ReturnType<typeof useRatings>['ratings'], experienceId: string) {
  const counts = getVoteCounts(votes, experienceId);
  const avgRating = getAverageRating(ratings, experienceId);
  return counts.go * 2 + counts.maybe * 1 - counts.skip * 1 + avgRating * 0.5;
}

export default function ConsensusScreen() {
  const theme = useTheme();
  const { activeTripId } = useTrip();
  const { regions } = useRegions(activeTripId);
  const { experiences, loading } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { ratings } = useRatings(activeTripId);

  const ranked = useMemo(() => {
    return [...experiences]
      .map((e) => ({ experience: e, score: scoreFor(votes, ratings, e.id) }))
      .sort((a, b) => b.score - a.score);
  }, [experiences, votes, ratings]);

  const regionName = (regionId: string) => regions.find((r) => r.id === regionId)?.name ?? '';

  return (
    <Screen edges={['top']} style={styles.container}>
      <FlatList
        data={ranked}
        keyExtractor={({ experience }) => experience.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedText type="title" style={styles.title}>
            🏆 Group favorites
          </ThemedText>
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              No places to rank yet — vote on some places first.
            </ThemedText>
          ) : null
        }
        renderItem={({ item, index }) => (
          <RankedRow rank={index + 1} experience={item.experience} regionName={regionName(item.experience.regionId)} votes={votes} />
        )}
      />
    </Screen>
  );
}

function RankedRow({
  rank,
  experience,
  regionName,
  votes,
}: {
  rank: number;
  experience: Experience;
  regionName: string;
  votes: ReturnType<typeof useVotes>['votes'];
}) {
  const theme = useTheme();
  const counts = getVoteCounts(votes, experience.id);

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="subtitle" style={styles.rank}>
        {rank}
      </ThemedText>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="default">{experience.name}</ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {regionName}
        </ThemedText>
        <View style={styles.tagRow}>
          {experience.tags.slice(0, 3).map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      </View>
      <View style={styles.counts}>
        <ThemedText type="small" themeColor="textSecondary">
          ✅ {counts.go}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          🤔 {counts.maybe}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  list: { padding: Spacing.lg, gap: Spacing.sm },
  title: { marginBottom: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  rank: { width: 32, textAlign: 'center' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  counts: { alignItems: 'flex-end', gap: 2 },
});
