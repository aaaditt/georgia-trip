import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Region } from '@/lib/hooks';

export function RegionCard({
  region,
  placeCount,
  onPress,
}: {
  region: Region;
  placeCount?: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText style={styles.icon}>{region.icon}</ThemedText>
      <View style={{ flex: 1 }}>
        <ThemedText type="default">{region.name}</ThemedText>
        {region.subtitle && (
          <ThemedText type="small" themeColor="textSecondary">
            {region.subtitle}
          </ThemedText>
        )}
        {placeCount !== undefined && (
          <ThemedText type="small" themeColor="textMuted">
            {placeCount} {placeCount === 1 ? 'place' : 'places'}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  icon: { fontSize: 28 },
});
