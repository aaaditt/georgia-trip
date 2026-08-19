import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { RegionCard } from '@/components/region-card';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { addRegion, useExperiences, useRegions, useTripMembers, useVotes } from '@/lib/hooks';

export default function DashboardScreen() {
  const theme = useTheme();
  const { trips, activeTripId } = useTrip();
  const trip = trips.find((t) => t.id === activeTripId);

  const { regions, loading: regionsLoading } = useRegions(activeTripId);
  const { experiences } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { members } = useTripMembers(activeTripId);

  const [addingRegion, setAddingRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [newRegionIcon, setNewRegionIcon] = useState('📍');
  const [submitting, setSubmitting] = useState(false);

  const openRegion = (regionId: string) => {
    if (!activeTripId) return;
    router.push({ pathname: '/trip/[tripId]/region/[regionId]', params: { tripId: activeTripId, regionId } });
  };

  const onAddRegion = async () => {
    if (!activeTripId || !newRegionName.trim()) return;
    setSubmitting(true);
    await addRegion({ tripId: activeTripId, name: newRegionName, icon: newRegionIcon });
    setSubmitting(false);
    setNewRegionName('');
    setNewRegionIcon('📍');
    setAddingRegion(false);
  };

  const progressForMember = (memberId: string) => {
    if (experiences.length === 0) return 0;
    const voted = experiences.filter((e) =>
      votes.some((v) => v.member_id === memberId && v.experience_id === e.id)
    ).length;
    return voted / experiences.length;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={regions}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="title">{trip?.cover_emoji ?? '🧳'} {trip?.name ?? 'Trip'}</ThemedText>
            {trip?.destination && (
              <ThemedText type="default" themeColor="textSecondary">
                {trip.destination}
              </ThemedText>
            )}

            {members.length > 0 && experiences.length > 0 && (
              <View style={[styles.progressCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.progressTitle}>
                  Voting progress
                </ThemedText>
                {members.map((m) => {
                  const pct = progressForMember(m.id);
                  return (
                    <View key={m.id} style={styles.progressRow}>
                      <ThemedText type="small" style={styles.progressLabel}>
                        {m.emoji} {m.display_name}
                      </ThemedText>
                      <View style={[styles.progressTrack, { backgroundColor: theme.background }]}>
                        <View style={[styles.progressFill, { backgroundColor: theme.accent, width: `${Math.round(pct * 100)}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Regions
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          !regionsLoading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              No regions yet — add the first one below.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RegionCard region={item} onPress={() => openRegion(item.id)} />
          </View>
        )}
        ListFooterComponent={
          <View style={styles.cardWrap}>
            {addingRegion ? (
              <View style={[styles.addForm, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={styles.addFormRow}>
                  <TextInput
                    value={newRegionIcon}
                    onChangeText={setNewRegionIcon}
                    style={[styles.iconInput, { color: theme.text, borderColor: theme.border }]}
                  />
                  <TextInput
                    value={newRegionName}
                    onChangeText={setNewRegionName}
                    placeholder="Region name"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <View style={styles.addFormActions}>
                  <Pressable onPress={() => setAddingRegion(false)}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={onAddRegion}
                    disabled={submitting || !newRegionName.trim()}
                    style={[styles.saveButton, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
                    <ThemedText type="small" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setAddingRegion(true)}
                style={[styles.addButton, { borderColor: theme.accent }]}>
                <ThemedText type="default" themeColor="accent">
                  + Add region
                </ThemedText>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  header: { gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { marginTop: Spacing.md },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  cardWrap: { marginBottom: Spacing.sm },
  progressCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  progressTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  progressRow: { gap: 4 },
  progressLabel: {},
  progressTrack: { height: 6, borderRadius: Radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: Radius.full },
  addButton: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  addForm: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  addFormRow: { flexDirection: 'row', gap: Spacing.sm },
  iconInput: { width: 56, borderWidth: 1, borderRadius: Radius.md, textAlign: 'center', fontSize: 20, paddingVertical: Spacing.sm },
  nameInput: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  addFormActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md },
  saveButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
});
