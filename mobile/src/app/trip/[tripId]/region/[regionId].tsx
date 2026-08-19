import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { AddPlaceForm } from '@/components/add-place-form';
import { ExperienceCard } from '@/components/experience-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { addExperience, useComments, useExperiences, useRatings, useRegions, useVotes } from '@/lib/hooks';

export default function RegionScreen() {
  const { regionId } = useLocalSearchParams<{ tripId: string; regionId: string }>();
  const theme = useTheme();
  const { activeTripId, activeMember } = useTrip();

  const { regions } = useRegions(activeTripId);
  const { experiences, loading } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { ratings } = useRatings(activeTripId);
  const { comments } = useComments(activeTripId);

  const region = regions.find((r) => r.id === regionId);
  const regionExperiences = experiences.filter((e) => e.regionId === regionId);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: region ? `${region.icon} ${region.name}` : '' }} />

      <FlatList
        data={regionExperiences}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          region?.subtitle ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
              {region.subtitle}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              No places here yet — add the first one below.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) =>
          activeTripId && activeMember ? (
            <View style={styles.cardWrap}>
              <ExperienceCard
                experience={item}
                tripId={activeTripId}
                memberId={activeMember.id}
                votes={votes}
                ratings={ratings}
                comments={comments}
              />
            </View>
          ) : null
        }
        ListFooterComponent={
          activeTripId && regionId ? (
            <View style={styles.cardWrap}>
              <AddPlaceForm
                onAdd={async (place) => {
                  await addExperience({ tripId: activeTripId, regionId, ...place });
                }}
              />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  subtitle: { marginBottom: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  cardWrap: { marginBottom: Spacing.sm },
});
