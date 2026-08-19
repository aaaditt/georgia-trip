import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';

// Phase 2+ replaces each of these with the real screen (region browse,
// consensus ranking, the gesture-driven calendar, etc.) — this just proves
// the tab shell, trip scoping, and theme are wired correctly end to end.
export function TripTabPlaceholder({ emoji, title, note }: { emoji: string; title: string; note: string }) {
  const theme = useTheme();
  const { trips, activeTripId } = useTrip();
  const trip = trips.find((t) => t.id === activeTripId);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText type="title">{title}</ThemedText>
      {trip && (
        <ThemedText type="default" themeColor="textSecondary">
          {trip.name}
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textMuted" style={styles.note}>
        {note}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
  emoji: { fontSize: 40 },
  note: { textAlign: 'center', marginTop: Spacing.md },
});
