import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { colorForRegion, TRANSPORT_COLOR } from '@/lib/calendar-layout';
import { getAverageRating, getVoteCounts, type Experience, type Rating, type Region, type Vote } from '@/lib/hooks';
import { TRANSPORT_MODES } from '@/lib/itinerary';
import { useTheme } from '@/hooks/use-theme';

export type PalettePayload =
  | { kind: 'place'; experienceId: string; name: string; regionId: string }
  | { kind: 'transport'; transportMode: string; name: string };

export function CalendarPalette({
  regions,
  experiences,
  votes,
  ratings,
  scheduledExperienceIds,
  onPick,
  onAddEvent,
}: {
  regions: Region[];
  experiences: Experience[];
  votes: Vote[];
  ratings: Rating[];
  scheduledExperienceIds: Set<string>;
  onPick: (payload: PalettePayload) => void;
  onAddEvent: () => void;
}) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<string>(regions[0]?.id ?? 'transport');

  const tabs = [...regions.map((r) => ({ id: r.id, icon: r.icon, label: r.name })), { id: 'transport', icon: '🚕', label: 'Transport' }];

  const regionChips = experiences
    .filter((e) => e.regionId === activeTab)
    .map((e) => {
      const counts = getVoteCounts(votes, e.id);
      const avg = getAverageRating(ratings, e.id);
      return { experience: e, score: counts.go * 2 + counts.maybe, avg };
    })
    .sort((a, b) => b.score - a.score || b.avg - a.avg || a.experience.name.localeCompare(b.experience.name));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[styles.tab, { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentGlow : 'transparent' }]}>
              <ThemedText type="small" style={active ? { color: theme.accent } : undefined}>
                {t.icon} {t.label}
              </ThemedText>
            </Pressable>
          );
        })}
        <Pressable onPress={onAddEvent} style={[styles.tab, { borderColor: theme.accent }]}>
          <ThemedText type="small" themeColor="accent">
            ➕ Checkpoint
          </ThemedText>
        </Pressable>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {activeTab === 'transport'
          ? TRANSPORT_MODES.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => onPick({ kind: 'transport', transportMode: m.id, name: m.label })}
                style={[styles.chip, { borderColor: TRANSPORT_COLOR }]}>
                <ThemedText type="small">
                  {m.emoji} {m.label}
                </ThemedText>
              </Pressable>
            ))
          : regionChips.map(({ experience, score }) => {
              const scheduled = scheduledExperienceIds.has(experience.id);
              const color = colorForRegion(activeTab);
              return (
                <Pressable
                  key={experience.id}
                  onPress={() => onPick({ kind: 'place', experienceId: experience.id, name: experience.name, regionId: activeTab })}
                  style={[styles.chip, { borderColor: color }]}>
                  <ThemedText type="small">{experience.name}</ThemedText>
                  {score > 0 && (
                    <ThemedText type="small" themeColor="textMuted">
                      {score}pt
                    </ThemedText>
                  )}
                  {scheduled && <ThemedText type="small">✓</ThemedText>}
                </Pressable>
              );
            })}
        {activeTab !== 'transport' && regionChips.length === 0 && (
          <ThemedText type="small" themeColor="textMuted" style={styles.empty}>
            No places in this region yet.
          </ThemedText>
        )}
      </ScrollView>

      <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
        Tap a place to add it, then hold a block to drag it · pull the bottom edge to stretch · tap for details.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderTopWidth: 1, paddingVertical: Spacing.sm, gap: Spacing.xs },
  tabRow: { gap: Spacing.xs, paddingHorizontal: Spacing.md },
  tab: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  chipRow: { gap: Spacing.xs, paddingHorizontal: Spacing.md, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  empty: { paddingVertical: Spacing.xs },
  hint: { paddingHorizontal: Spacing.md, fontSize: 11 },
});
