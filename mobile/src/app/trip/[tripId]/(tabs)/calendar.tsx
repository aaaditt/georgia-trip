import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddEventModal } from '@/components/calendar/add-event-modal';
import { CalendarPalette, type PalettePayload } from '@/components/calendar/palette';
import { DayPicker } from '@/components/calendar/day-picker';
import { DetailSheet } from '@/components/calendar/detail-sheet';
import { TimeGrid, type GridBlock } from '@/components/calendar/time-grid';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { hasCompletedVoting, useCalendarAccess } from '@/lib/access';
import { colorForRegion, customEmoji, TRANSPORT_COLOR, CUSTOM_COLOR } from '@/lib/calendar-layout';
import { useExperiences, useRatings, useRegions, useVotes } from '@/lib/hooks';
import { clamp } from '@/lib/calendar-layout';
import { parseDefaultDuration, tripDays, TRANSPORT_MODES, useItinerary, type ItineraryItem } from '@/lib/itinerary';

export default function CalendarScreen() {
  const theme = useTheme();
  const { trips, activeTripId, activeMember } = useTrip();
  const trip = trips.find((t) => t.id === activeTripId);

  const { regions } = useRegions(activeTripId);
  const { experiences, loading: expLoading } = useExperiences(activeTripId);
  const { votes, loading: votesLoading } = useVotes(activeTripId);
  const { ratings } = useRatings(activeTripId);
  const { grantedIds, loading: accessLoading } = useCalendarAccess(activeTripId);
  const { items, addItem, updateItem, removeItem } = useItinerary(activeTripId);

  const days = useMemo(() => tripDays(trip?.start_date ?? null, trip?.end_date ?? null), [trip?.start_date, trip?.end_date]);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const day = activeDay ?? days[0] ?? null;

  const [unlocked, setUnlocked] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showAddEvent, setShowAddEvent] = useState(false);

  const gateLoading = expLoading || votesLoading || accessLoading;
  const votedCount = activeMember ? experiences.filter((e) => votes.some((v) => v.member_id === activeMember.id && v.experience_id === e.id)).length : 0;
  const canEdit = !gateLoading && !!activeMember && (hasCompletedVoting(votes, experiences, activeMember.id) || grantedIds.has(activeMember.id));
  const editing = canEdit && unlocked;

  const expById = useMemo(() => new Map(experiences.map((e) => [e.id, e])), [experiences]);
  const scheduledExperienceIds = useMemo(
    () => new Set(items.filter((i) => i.kind === 'place' && i.experienceId).map((i) => i.experienceId as string)),
    [items]
  );

  const dayBlocks: GridBlock[] = useMemo(() => {
    if (!day) return [];
    return items
      .filter((i) => i.day === day)
      .map((i) => {
        if (i.kind === 'place') {
          const exp = i.experienceId ? expById.get(i.experienceId) : undefined;
          return { ...i, label: `📍 ${exp ? exp.name : '(removed place)'}`, color: colorForRegion(exp?.regionId) };
        }
        if (i.kind === 'transport') {
          const mode = TRANSPORT_MODES.find((m) => m.id === i.transportMode);
          return { ...i, label: `${mode?.emoji ?? '🚗'} ${i.title || mode?.label || 'Transport'}`, color: TRANSPORT_COLOR };
        }
        return { ...i, label: `${customEmoji(i.title)} ${i.title || 'Event'}`, color: CUSTOM_COLOR };
      });
  }, [items, day, expById]);

  const selectedItem: ItineraryItem | null = items.find((i) => i.id === selectedItemId) ?? null;
  const selectedLabel = selectedItem ? dayBlocks.find((b) => b.id === selectedItem.id)?.label ?? selectedItem.title ?? '' : '';

  const nextFreeSlot = (targetDay: string, durationMin: number) => {
    const dayItems = items.filter((i) => i.day === targetDay).sort((a, b) => a.startMin - b.startMin);
    let start = 540; // 9am default
    for (const it of dayItems) {
      if (start + durationMin <= it.startMin) break;
      start = Math.max(start, it.startMin + it.durationMin);
    }
    return clamp(start, 0, 1440 - durationMin);
  };

  const onPick = (payload: PalettePayload) => {
    if (!day || !activeMember || !activeTripId) return;
    const durationMin = payload.kind === 'place' ? parseDefaultDuration(expById.get(payload.experienceId)?.time) : 60;
    const startMin = nextFreeSlot(day, durationMin);
    addItem({
      kind: payload.kind,
      experienceId: payload.kind === 'place' ? payload.experienceId : null,
      transportMode: payload.kind === 'transport' ? payload.transportMode : null,
      title: null,
      notes: null,
      day,
      startMin,
      durationMin,
      createdByMember: activeMember.id,
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onTapBlock = (id: string) => {
    if (selectMode) toggleSelect(id);
    else setSelectedItemId(id);
  };

  if (!day) {
    return (
      <Screen edges={['top']} style={StyleSheet.flatten([styles.container, styles.centered])}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.emptyText}>
          Set this trip's start and end dates (trip settings) to unlock the calendar.
        </ThemedText>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={styles.container}>
      <DayPicker days={days} activeDay={day} onSelect={setActiveDay} />

      {!canEdit && (
        <View style={[styles.lockCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          {gateLoading ? (
            <ThemedText type="small">Checking your voting progress…</ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              🔒 Vote on every place first — you're at {votedCount}/{experiences.length}. You can still look around below.
            </ThemedText>
          )}
        </View>
      )}

      {canEdit && (
        <View style={[styles.lockBar, { backgroundColor: unlocked ? theme.accentGlow : theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            {unlocked ? '🔓 Edit mode — drags and deletes are live for everyone.' : '🔒 View mode — safe to browse.'}
          </ThemedText>
          <Pressable onPress={() => setUnlocked((u) => !u)}>
            <ThemedText type="smallBold" themeColor="accent">
              {unlocked ? 'Lock' : 'Unlock'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      {editing && (
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => {
              setSelectMode((v) => !v);
              setSelectedIds(new Set());
            }}
            style={[styles.selectToggle, { borderColor: selectMode ? theme.accent : theme.border, backgroundColor: selectMode ? theme.accentGlow : 'transparent' }]}>
            <ThemedText type="small" themeColor={selectMode ? 'accent' : 'textSecondary'}>
              {selectMode ? '✓ Select mode — tap blocks to select' : 'Select mode'}
            </ThemedText>
          </Pressable>
        </View>
      )}

      <TimeGrid
        blocks={dayBlocks}
        editable={editing}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onTapBlock={onTapBlock}
        onMoveBlock={(id, startMin) => updateItem(id, { startMin })}
        onResizeBlock={(id, durationMin) => updateItem(id, { durationMin })}
      />

      {editing && !selectMode && (
        <CalendarPalette
          regions={regions}
          experiences={experiences}
          votes={votes}
          ratings={ratings}
          scheduledExperienceIds={scheduledExperienceIds}
          onPick={onPick}
          onAddEvent={() => setShowAddEvent(true)}
        />
      )}

      {editing && selectMode && selectedIds.size > 0 && (
        <View style={[styles.bulkBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="small">{selectedIds.size} selected</ThemedText>
          <View style={styles.bulkActions}>
            <Pressable
              onPress={() => {
                selectedIds.forEach((id) => removeItem(id));
                setSelectedIds(new Set());
              }}>
              <ThemedText type="small" style={{ color: '#E53935' }}>
                🗑 Delete
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setSelectedIds(new Set())}>
              <ThemedText type="small" themeColor="textSecondary">
                Clear
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      <AddEventModal
        visible={showAddEvent}
        days={days}
        defaultDay={day}
        onClose={() => setShowAddEvent(false)}
        onAdd={(title, targetDay) => {
          if (!activeMember) return;
          const durationMin = 60;
          addItem({
            kind: 'custom',
            experienceId: null,
            transportMode: null,
            title,
            notes: null,
            day: targetDay,
            startMin: nextFreeSlot(targetDay, durationMin),
            durationMin,
            createdByMember: activeMember.id,
          });
        }}
      />

      {selectedItem && (
        <DetailSheet
          item={selectedItem}
          label={selectedLabel}
          editable={editing}
          onClose={() => setSelectedItemId(null)}
          onSave={(patch) => updateItem(selectedItem.id, patch)}
          onDelete={() => {
            removeItem(selectedItem.id);
            setSelectedItemId(null);
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {},
  centered: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  emptyText: { textAlign: 'center' },
  lockCard: { margin: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  lockBar: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, padding: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.sm },
  modeRow: { paddingHorizontal: Spacing.md, marginBottom: Spacing.xs },
  selectToggle: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  bulkBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: Spacing.md, padding: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1 },
  bulkActions: { flexDirection: 'row', gap: Spacing.md },
});
