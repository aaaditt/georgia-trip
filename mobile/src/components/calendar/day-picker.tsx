import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatDay } from '@/lib/itinerary';
import { useTheme } from '@/hooks/use-theme';

export function DayPicker({
  days,
  activeDay,
  onSelect,
}: {
  days: string[];
  activeDay: string;
  onSelect: (day: string) => void;
}) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {days.map((day, i) => {
        const f = formatDay(day);
        const active = day === activeDay;
        return (
          <Pressable
            key={day}
            onPress={() => onSelect(day)}
            style={[
              styles.chip,
              { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentGlow : theme.backgroundElement },
            ]}>
            <ThemedText type="small" themeColor="textMuted">
              Day {i + 1}
            </ThemedText>
            <ThemedText type="smallBold" style={active ? { color: theme.accent } : undefined}>
              {f.weekday} {f.date}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignItems: 'center',
    minWidth: 64,
  },
});
