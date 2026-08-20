import { forwardRef, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CalendarBlock } from '@/components/calendar/calendar-block';
import { ThemedText } from '@/components/themed-text';
import { GUTTER_W, layoutDay, SLOT_PX } from '@/lib/calendar-layout';
import { formatTime, type ItineraryItem } from '@/lib/itinerary';
import { useTheme } from '@/hooks/use-theme';

export type GridBlock = ItineraryItem & { label: string; color: string };

export const TimeGrid = forwardRef<ScrollView, {
  blocks: GridBlock[];
  editable: boolean;
  selectMode: boolean;
  selectedIds: Set<string>;
  onTapBlock: (id: string) => void;
  onMoveBlock: (id: string, startMin: number) => void;
  onResizeBlock: (id: string, durationMin: number) => void;
}>(function TimeGrid({ blocks, editable, selectMode, selectedIds, onTapBlock, onMoveBlock, onResizeBlock }, ref) {
  const theme = useTheme();
  const lanes = useMemo(() => layoutDay(blocks), [blocks]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, h) => h), []);

  return (
    <ScrollView ref={ref} style={styles.scroller} contentContainerStyle={styles.content}>
      <View style={[styles.gutter, { borderColor: theme.border }]}>
        {hours.map((h) => (
          <ThemedText key={h} type="small" themeColor="textMuted" style={[styles.hourLabel, { top: h * 2 * SLOT_PX - 6 }]}>
            {formatTime(h * 60)}
          </ThemedText>
        ))}
      </View>
      <View style={[styles.body, { height: 24 * 2 * SLOT_PX, borderColor: theme.border }]}>
        {hours.map((h) => (
          <View key={h} style={[styles.hourLine, { top: h * 2 * SLOT_PX, borderColor: theme.border }]} />
        ))}
        {blocks.map((b) => {
          const lane = lanes[b.id] || { lane: 0, lanes: 1 };
          return (
            <CalendarBlock
              key={b.id}
              label={b.label}
              color={b.color}
              startMin={b.startMin}
              durationMin={b.durationMin}
              laneLeftPct={(lane.lane / lane.lanes) * 100}
              laneWidthPct={100 / lane.lanes}
              editable={editable}
              selectMode={selectMode}
              selected={selectedIds.has(b.id)}
              hasNotes={!!b.notes}
              onTap={() => onTapBlock(b.id)}
              onMove={(newStart) => onMoveBlock(b.id, newStart)}
              onResize={(newDuration) => onResizeBlock(b.id, newDuration)}
            />
          );
        })}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroller: { flex: 1 },
  content: { flexDirection: 'row' },
  gutter: { width: GUTTER_W, borderRightWidth: 1 },
  hourLabel: { position: 'absolute', right: 6, fontSize: 10 },
  body: { flex: 1, position: 'relative' },
  hourLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth },
});
