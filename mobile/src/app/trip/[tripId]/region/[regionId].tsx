import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AddPlaceForm } from '@/components/add-place-form';
import { ExperienceCard } from '@/components/experience-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { setRegionSelected } from '@/lib/catalog';
import { addExperience, useComments, useExperiences, useRegions, useVotes } from '@/lib/hooks';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

export default function RegionScreen() {
  const { regionId } = useLocalSearchParams<{ tripId: string; regionId: string }>();
  const theme = useTheme();
  const { activeTripId, activeMember } = useTrip();

  const { regions, refetch } = useRegions(activeTripId);
  const { experiences, loading } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { comments } = useComments(activeTripId);

  const region = regions.find((r) => r.id === regionId);
  const regionExperiences = experiences.filter((e) => e.regionId === regionId);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: region ? `${region.icon} ${region.name}` : '' }} />

      <FlatList
        data={regionExperiences}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          region ? (
            <View style={styles.regionHeader}>
              {!!region.subtitle && (
                <ThemedText type="default" themeColor="textSecondary">
                  {region.subtitle}
                </ThemedText>
              )}
              {!!region.summary && <ThemedText type="default">{region.summary}</ThemedText>}
              {!!region.whenToGo && <Fact label="When to go" value={region.whenToGo} />}
              {!!region.gettingThere && <Fact label="Getting there" value={region.gettingThere} />}
              {!!region.baseTowns && <Fact label="Where to stay" value={region.baseTowns} />}

              {!region.isSelected && (
                <Pressable
                  onPress={async () => {
                    await setRegionSelected(region.id, true);
                    await refetch();
                  }}
                  style={[styles.addBanner, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
                  <ThemedText type="small" themeColor="accent">
                    + Add {region.name} to our trip
                  </ThemedText>
                </Pressable>
              )}
            </View>
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
                comments={comments}
                onPress={() =>
                  router.push({
                    pathname: '/trip/[tripId]/place/[placeId]',
                    params: { tripId: activeTripId, placeId: item.id },
                  })
                }
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  cardWrap: { marginBottom: Spacing.sm },
  regionHeader: { gap: Spacing.sm, marginBottom: Spacing.md },
  fact: { gap: 2 },
  addBanner: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center' },
});
