import { StyleSheet, View } from 'react-native';

import { TagPill } from '@/components/tag-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Experience } from '@/lib/hooks';

function Fact({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" style={styles.factIcon}>
        {icon}
      </ThemedText>
      <View style={{ flex: 1 }}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="small">{value}</ThemedText>
      </View>
    </View>
  );
}

export function PlaceDetailSheet({ experience }: { experience: Experience }) {
  const theme = useTheme();
  const price = experience.priceLari && experience.priceLari !== '—' ? experience.priceLari : null;

  return (
    <View style={styles.root}>
      {!!experience.hook && (
        <ThemedText type="default" style={styles.hook}>
          {experience.hook}
        </ThemedText>
      )}

      {!!experience.description && (
        <ThemedText type="default" themeColor="textSecondary">
          {experience.description}
        </ThemedText>
      )}

      {experience.tags.length > 0 && (
        <View style={styles.tagRow}>
          {experience.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      )}

      <View style={[styles.facts, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {experience.time !== '—' && <Fact icon="⏱" label="How long" value={experience.time} />}
        {!!price && <Fact icon="💰" label="Cost" value={price} />}
        {!!experience.nearestTown && <Fact icon="📍" label="Where" value={experience.nearestTown} />}
        {!!experience.bestTime && <Fact icon="🌤" label="Best time" value={experience.bestTime} />}
        {!!experience.kidNote && <Fact icon="🧒" label="With kids" value={experience.kidNote} />}
        {experience.bookingRequired && <Fact icon="📅" label="Booking" value="Book ahead — walk-ins are not reliable" />}
      </View>

      {!!experience.tips && (
        <View style={[styles.tips, { backgroundColor: theme.accentGlow, borderColor: theme.accent }]}>
          <ThemedText type="smallBold" themeColor="accent">
            Worth knowing
          </ThemedText>
          <ThemedText type="small">{experience.tips}</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.md },
  hook: { fontStyle: 'italic' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  facts: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  fact: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  factIcon: { width: 20 },
  tips: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 4 },
});
