import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { RegionCard } from '@/components/region-card';
import { RegionPickerGrid } from '@/components/region-picker-grid';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { seedTripCatalog, setRegionSelected } from '@/lib/catalog';
import { dayCount } from '@/lib/date-range';
import {
  experiencesInSelectedRegions,
  useExperiences,
  useRegions,
  useTripMembers,
  useVotes,
} from '@/lib/hooks';

export default function DashboardScreen() {
  const theme = useTheme();
  const { trips, activeTripId, activeMember } = useTrip();
  const trip = trips.find((t) => t.id === activeTripId);
  const isAdmin = activeMember?.role === 'owner' || activeMember?.role === 'admin';

  const { regions, selectedRegions, unselectedRegions, loading: regionsLoading, refetch } = useRegions(activeTripId);
  const { experiences } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { members } = useTripMembers(activeTripId);

  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);

  const scoped = useMemo(() => experiencesInSelectedRegions(experiences, regions), [experiences, regions]);
  const placeCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of experiences) counts.set(e.regionId, (counts.get(e.regionId) ?? 0) + 1);
    return counts;
  }, [experiences]);

  // A trip created before migration-09, or one whose seeding was skipped.
  const needsCatalog = !regionsLoading && regions.every((r) => r.catalogRegionId === null);

  const openRegion = (regionId: string) => {
    if (!activeTripId) return;
    router.push({ pathname: '/trip/[tripId]/region/[regionId]', params: { tripId: activeTripId, regionId } });
  };

  const onImport = async () => {
    if (!activeTripId) return;
    setImporting(true);
    await seedTripCatalog(activeTripId, []);
    await refetch();
    setImporting(false);
  };

  const progressForMember = (memberId: string) => {
    if (scoped.length === 0) return 0;
    const voted = scoped.filter((e) => votes.some((v) => v.member_id === memberId && v.experience_id === e.id)).length;
    return voted / scoped.length;
  };

  return (
    <Screen edges={['top']}>
      <FlatList
        data={selectedRegions}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="title" style={{ flex: 1 }}>
                {trip?.cover_emoji ?? '🧳'} {trip?.name ?? 'Trip'}
              </ThemedText>
              {isAdmin && activeTripId && (
                <Pressable
                  onPress={() => router.push({ pathname: '/trip/[tripId]/admin', params: { tripId: activeTripId } })}>
                  <ThemedText type="link">⚙️ Admin</ThemedText>
                </Pressable>
              )}
            </View>
            {trip?.start_date && trip?.end_date && (
              <ThemedText type="default" themeColor="textSecondary">
                {dayCount(trip.start_date, trip.end_date)} days in Georgia
              </ThemedText>
            )}

            {needsCatalog && (
              <View style={[styles.notice, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
                <ThemedText type="small">
                  This trip was made before the Georgia guide existed. Add all of Georgia&rsquo;s regions and places
                  to it — nothing you already have is changed or removed.
                </ThemedText>
                <Pressable
                  onPress={onImport}
                  disabled={importing}
                  style={[styles.noticeButton, { backgroundColor: theme.accent, opacity: importing ? 0.6 : 1 }]}>
                  <ThemedText type="small" style={styles.buttonLabel}>
                    {importing ? 'Adding…' : "Add Georgia's places"}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {members.length > 0 && scoped.length > 0 && (
              <View style={[styles.progressCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progressTitle}>
                  Voting progress · {scoped.length} places
                </ThemedText>
                {members.map((m) => {
                  const pct = progressForMember(m.id);
                  return (
                    <View key={m.id} style={styles.progressRow}>
                      <ThemedText type="small">
                        {m.emoji} {m.display_name}
                      </ThemedText>
                      <View style={[styles.progressTrack, { backgroundColor: theme.background }]}>
                        <View
                          style={[
                            styles.progressFill,
                            { backgroundColor: theme.accent, width: `${Math.round(pct * 100)}%` },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.sectionRow}>
              <ThemedText type="subtitle" style={{ flex: 1 }}>
                Our regions
              </ThemedText>
              {regions.length > 0 && (
                <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8}>
                  <ThemedText type="link">{editing ? 'Done' : 'Edit'}</ThemedText>
                </Pressable>
              )}
            </View>

            {editing && (
              <RegionPickerGrid
                options={regions.map((r) => ({ id: r.id, name: r.name, icon: r.icon, subtitle: r.subtitle }))}
                selectedIds={new Set(selectedRegions.map((r) => r.id))}
                onToggle={async (id) => {
                  const region = regions.find((r) => r.id === id);
                  if (!region) return;
                  await setRegionSelected(id, !region.isSelected);
                  await refetch();
                }}
              />
            )}
          </View>
        }
        ListEmptyComponent={
          !regionsLoading && !editing ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              No regions picked yet. Tap Edit above to choose where you&rsquo;re going, or explore all of Georgia
              below.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RegionCard region={item} placeCount={placeCount.get(item.id) ?? 0} onPress={() => openRegion(item.id)} />
          </View>
        )}
        ListFooterComponent={
          activeTripId ? (
            <Pressable
              onPress={() => router.push({ pathname: '/trip/[tripId]/explore', params: { tripId: activeTripId } })}
              style={[styles.exploreCard, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="default">🇬🇪 Explore all of Georgia &rsaquo;</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {unselectedRegions.length} more regions · {experiences.length - scoped.length} places · browse and
                vote freely
              </ThemedText>
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm },
  header: { gap: Spacing.sm, marginBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
  empty: { textAlign: 'center', marginTop: Spacing.lg },
  cardWrap: { marginBottom: Spacing.sm },
  notice: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  noticeButton: { borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  buttonLabel: { color: '#fff', fontFamily: Fonts.headingMedium },
  progressCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm, marginTop: Spacing.sm },
  progressTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  progressRow: { gap: 4 },
  progressTrack: { height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  exploreCard: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 2, marginTop: Spacing.md },
});
