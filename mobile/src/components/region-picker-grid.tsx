import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RegionOption = {
  id: string;
  name: string;
  icon: string;
  subtitle: string | null;
};

export function RegionPickerGrid({
  options,
  selectedIds,
  onToggle,
}: {
  options: RegionOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = selectedIds.has(option.id);
        return (
          <Pressable
            key={option.id}
            onPress={() => onToggle(option.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.name}
            style={[
              styles.tile,
              {
                borderColor: selected ? theme.accent : theme.border,
                backgroundColor: selected ? theme.accentGlow : theme.backgroundElement,
              },
            ]}>
            <ThemedText type="default" style={styles.icon}>
              {option.icon}
            </ThemedText>
            <ThemedText
              type="small"
              style={selected ? { color: theme.accent, fontFamily: Fonts.headingMedium } : undefined}>
              {option.name}
            </ThemedText>
            {!!option.subtitle && (
              <ThemedText type="small" themeColor="textMuted" numberOfLines={2}>
                {option.subtitle}
              </ThemedText>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  // Two columns: half the width minus half the gap.
  tile: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 2,
    minHeight: 96,
  },
  icon: { fontSize: 24 },
});
