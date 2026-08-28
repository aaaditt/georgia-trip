import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { RegionCard } from '@/components/region-card';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { setRegionSelected } from '@/lib/catalog';
import { addRegion, useExperiences, useRegions } from '@/lib/hooks';

export default function ExploreScreen() {
  const theme = useTheme();
  const { activeTripId } = useTrip();
  const { regions, unselectedRegions, loading, refetch } = useRegions(activeTripId);
  const { experiences } = useExperiences(activeTripId);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('📍');
  const [submitting, setSubmitting] = useState(false);

  const placeCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of experiences) counts.set(e.regionId, (counts.get(e.regionId) ?? 0) + 1);
    return counts;
  }, [experiences]);

  const openRegion = (regionId: string) => {
    if (!activeTripId) return;
    router.push({ pathname: '/trip/[tripId]/region/[regionId]', params: { tripId: activeTripId, regionId } });
  };

  const onAddOwn = async () => {
    if (!activeTripId || !newName.trim()) return;
    setSubmitting(true);
    await addRegion({ tripId: activeTripId, name: newName, icon: newIcon });
    await refetch();
    setSubmitting(false);
    setNewName('');
    setNewIcon('📍');
    setAdding(false);
  };

  return (
    <Screen edges={['bottom']}>
      <FlatList
        data={unselectedRegions}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <ThemedText type="default" themeColor="textSecondary" style={styles.intro}>
            Everywhere else in Georgia. Browse and vote on any of it — adding a region to your trip just means it
            shows up on your dashboard and counts toward everyone&rsquo;s voting progress.
          </ThemedText>
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              {regions.length === 0
                ? "This trip has no regions yet — use “Add Georgia's places” on the dashboard."
                : 'Every region is already on your trip.'}
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <RegionCard region={item} placeCount={placeCount.get(item.id) ?? 0} onPress={() => openRegion(item.id)} />
            <Pressable
              onPress={async () => {
                await setRegionSelected(item.id, true);
                await refetch();
              }}
              style={[styles.addButton, { borderColor: theme.accent }]}>
              <ThemedText type="small" themeColor="accent">
                + Add to our trip
              </ThemedText>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.cardWrap}>
            {adding ? (
              <View style={[styles.addForm, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  Somewhere the guide doesn&rsquo;t cover yet
                </ThemedText>
                <View style={styles.addFormRow}>
                  <TextInput
                    value={newIcon}
                    onChangeText={setNewIcon}
                    style={[styles.iconInput, { color: theme.text, borderColor: theme.border }]}
                  />
                  <TextInput
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="Region name"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]}
                  />
                </View>
                <View style={styles.addFormActions}>
                  <Pressable onPress={() => setAdding(false)}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={onAddOwn}
                    disabled={submitting || !newName.trim()}
                    style={[styles.saveButton, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
                    <ThemedText type="small" style={styles.saveLabel}>
                      Save
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setAdding(true)} style={[styles.ownButton, { borderColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  + Add your own region
                </ThemedText>
              </Pressable>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm },
  intro: { marginBottom: Spacing.sm },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  cardWrap: { marginBottom: Spacing.md, gap: Spacing.xs },
  addButton: { borderWidth: 1, borderRadius: Radius.full, paddingVertical: Spacing.sm, alignItems: 'center' },
  ownButton: {
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
  saveLabel: { color: '#fff', fontFamily: Fonts.headingMedium },
});
