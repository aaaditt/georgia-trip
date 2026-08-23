import { useMemo } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { customEmoji } from '@/lib/calendar-layout';
import { useExperiences } from '@/lib/hooks';
import { formatDay, formatTime, tripDays, TRANSPORT_MODES, useItinerary } from '@/lib/itinerary';

type PlanRow = { id: string; time: string; emoji: string; name: string; note: string | null };

export default function PlanScreen() {
  const theme = useTheme();
  const { trips, activeTripId } = useTrip();
  const trip = trips.find((t) => t.id === activeTripId);
  const { experiences } = useExperiences(activeTripId);
  const { items, loading } = useItinerary(activeTripId);

  const days = useMemo(() => tripDays(trip?.start_date ?? null, trip?.end_date ?? null), [trip?.start_date, trip?.end_date]);
  const expById = useMemo(() => new Map(experiences.map((e) => [e.id, e])), [experiences]);

  const sections = useMemo(() => {
    return days
      .map((day, i) => {
        const dayItems = items
          .filter((it) => it.day === day)
          .sort((a, b) => a.startMin - b.startMin)
          .map((it): PlanRow => {
            if (it.kind === 'place') {
              const exp = it.experienceId ? expById.get(it.experienceId) : undefined;
              return {
                id: it.id,
                time: `${formatTime(it.startMin)}–${formatTime(it.startMin + it.durationMin)}`,
                emoji: '📍',
                name: exp ? exp.name : '(removed place)',
                note: null,
              };
            }
            if (it.kind === 'transport') {
              const mode = TRANSPORT_MODES.find((m) => m.id === it.transportMode);
              return {
                id: it.id,
                time: `${formatTime(it.startMin)}–${formatTime(it.startMin + it.durationMin)}`,
                emoji: mode?.emoji ?? '🚗',
                name: mode?.label ?? 'Transport',
                note: it.title,
              };
            }
            return {
              id: it.id,
              time: `${formatTime(it.startMin)}–${formatTime(it.startMin + it.durationMin)}`,
              emoji: customEmoji(it.title),
              name: it.title || 'Event',
              note: null,
            };
          });
        const f = formatDay(day);
        return { title: `Day ${i + 1} · ${f.weekday} ${f.date} ${f.month}`, data: dayItems };
      })
      .filter((s) => s.data.length > 0);
  }, [days, items, expById]);

  const totalItems = items.length;

  return (
    <Screen edges={['top']} style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="title">📖 The Plan</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Built live from the calendar — change a block there and this updates for everyone.
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              {totalItems === 0 ? 'Nothing scheduled yet — add places to the calendar first.' : 'No trip dates set yet.'}
            </ThemedText>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          <ThemedText type="subtitle" style={[styles.sectionTitle, { backgroundColor: theme.background }]}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textMuted" style={styles.time}>
              {item.time}
            </ThemedText>
            <ThemedText type="default" style={{ flex: 1 }}>
              {item.emoji} {item.name}
              {item.note ? <ThemedText type="small" themeColor="textSecondary"> — {item.note}</ThemedText> : null}
            </ThemedText>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {},
  list: { padding: Spacing.lg, gap: Spacing.sm },
  header: { gap: Spacing.xs, marginBottom: Spacing.md },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  sectionTitle: { paddingVertical: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, paddingVertical: Spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  time: { width: 96 },
});
