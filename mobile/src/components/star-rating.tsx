import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function StarRating({
  value,
  average,
  count,
  onChange,
}: {
  value?: number;
  average: number;
  count: number;
  onChange: (rating: number) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={4}>
          <ThemedText style={{ fontSize: 18, color: (value ?? 0) >= n ? Palette.gold : theme.border }}>★</ThemedText>
        </Pressable>
      ))}
      {count > 0 && (
        <ThemedText type="small" themeColor="textMuted" style={styles.average}>
          {average.toFixed(1)} ({count})
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  average: { marginLeft: Spacing.xs },
});
