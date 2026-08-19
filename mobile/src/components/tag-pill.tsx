import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { TAG_MAP } from '@/constants/tags';

export function TagPill({ tag }: { tag: string }) {
  const info = TAG_MAP[tag];
  if (!info) return null;

  return (
    <View style={[styles.pill, { backgroundColor: `${info.color}1A`, borderColor: `${info.color}55` }]}>
      <ThemedText type="small" style={{ color: info.color }}>
        {info.emoji} {info.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
});
