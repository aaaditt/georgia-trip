import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DateRangeCalendar } from '@/components/date-range-calendar';
import { RegionPickerGrid } from '@/components/region-picker-grid';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { createGeorgiaTrip, useCatalogRegions } from '@/lib/catalog';
import { dayCount, type IsoDate } from '@/lib/date-range';

const STEPS = 3;

export default function CreateTripScreen() {
  const theme = useTheme();
  const { refetchTrips, setActiveTripId } = useTrip();
  const { catalogRegions, loading: catalogLoading } = useCatalogRegions();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [start, setStart] = useState<IsoDate | null>(null);
  const [end, setEnd] = useState<IsoDate | null>(null);
  const [regionIds, setRegionIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleRegion = (id: string) => {
    setRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const options = useMemo(
    () => catalogRegions.map((r) => ({ id: r.id, name: r.name, icon: r.icon, subtitle: r.subtitle })),
    [catalogRegions]
  );

  const canAdvance = step === 1 ? name.trim().length > 0 : step === 2 ? !!start && !!end : true;

  const onCreate = async () => {
    setError(null);
    setSubmitting(true);
    const { tripId, error: rpcError } = await createGeorgiaTrip({
      name,
      startDate: start,
      endDate: end,
      regionIds: [...regionIds],
    });
    setSubmitting(false);
    if (rpcError || !tripId) {
      setError(rpcError?.message ?? 'Could not create trip');
      return;
    }
    await refetchTrips();
    setActiveTripId(tripId);
    router.replace({ pathname: '/trip/[tripId]/dashboard', params: { tripId } });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.dots}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i < step ? theme.accent : theme.border },
              ]}
            />
          ))}
        </View>

        {step === 1 && (
          <View style={styles.stepBody}>
            <ThemedText type="title">What&rsquo;s this trip called?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              You&rsquo;ll be the owner and can invite others once it&rsquo;s created.
            </ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Georgia 2027"
              placeholderTextColor={theme.textMuted}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => canAdvance && setStep(2)}
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ]}
            />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepBody}>
            <ThemedText type="title">When are you going?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Tap the first day, then the last. You can change this later.
            </ThemedText>
            <DateRangeCalendar
              start={start}
              end={end}
              onChange={(nextStart, nextEnd) => {
                setStart(nextStart);
                setEnd(nextEnd);
              }}
            />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepBody}>
            <ThemedText type="title">Which parts of Georgia?</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Pick the regions you&rsquo;re planning around. You&rsquo;ll still be able to browse and vote on
              everywhere else, and you can change this anytime.
            </ThemedText>
            {catalogLoading ? (
              <ThemedText type="default" themeColor="textMuted">
                Loading regions…
              </ThemedText>
            ) : (
              <RegionPickerGrid options={options} selectedIds={regionIds} onToggle={toggleRegion} />
            )}
          </View>
        )}

        {error && (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        )}

        <View style={styles.nav}>
          {step > 1 ? (
            <Pressable onPress={() => setStep(step - 1)} hitSlop={8}>
              <ThemedText type="default" themeColor="textSecondary">
                &lsaquo; Back
              </ThemedText>
            </Pressable>
          ) : (
            <View />
          )}

          {step < STEPS ? (
            <Pressable
              onPress={() => setStep(step + 1)}
              disabled={!canAdvance}
              style={[styles.primary, { backgroundColor: theme.accent, opacity: canAdvance ? 1 : 0.4 }]}>
              <ThemedText type="default" style={styles.primaryLabel}>
                Next &rsaquo;
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={onCreate}
              disabled={submitting}
              style={[styles.primary, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
              <ThemedText type="default" style={styles.primaryLabel}>
                {submitting ? 'Creating…' : regionIds.size > 0 ? 'Create trip' : 'Skip for now'}
              </ThemedText>
            </Pressable>
          )}
        </View>

        {step === 2 && start && end && (
          <ThemedText type="small" themeColor="textMuted" style={styles.centered}>
            {dayCount(start, end)} days in Georgia
          </ThemedText>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.lg },
  dots: { flexDirection: 'row', gap: Spacing.xs, justifyContent: 'center' },
  dot: { width: 28, height: 4, borderRadius: Radius.full },
  stepBody: { gap: Spacing.md, flex: 1 },
  centered: { textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  primary: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
  },
  primaryLabel: { color: '#fff', fontFamily: Fonts.headingMedium },
});
