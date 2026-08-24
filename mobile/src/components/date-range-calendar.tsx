import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addMonths,
  dayCount,
  fromIso,
  isBetween,
  monthGrid,
  monthLabel,
  todayIso,
  yearMonthOf,
  type IsoDate,
} from '@/lib/date-range';

const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// A plain string literal, not `${100 / 7}%`. TypeScript does not evaluate
// arithmetic inside template literal types, so the computed form widens to
// `string` in a standalone const and stops satisfying RN's DimensionValue
// (`${number}%`). Inline template literals in a style object are fine —
// they get the contextual type — but an extracted const does not.
const COLUMN_WIDTH = '14.2857%';

export function DateRangeCalendar({
  start,
  end,
  onChange,
  minDate = todayIso(),
}: {
  start: IsoDate | null;
  end: IsoDate | null;
  onChange: (start: IsoDate | null, end: IsoDate | null) => void;
  minDate?: IsoDate;
}) {
  const theme = useTheme();
  const [visible, setVisible] = useState(() => yearMonthOf(start ?? todayIso()));

  const cells = useMemo(() => monthGrid(visible), [visible]);
  const minTime = fromIso(minDate).getTime();

  const onPressDay = (iso: IsoDate) => {
    // First tap, a tap after a complete range, or a tap that would invert
    // the range all start over from that day.
    if (!start || end || fromIso(iso).getTime() < fromIso(start).getTime()) {
      onChange(iso, null);
      return;
    }
    onChange(start, iso);
  };

  const count = start && end ? dayCount(start, end) : 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.monthRow}>
        <Pressable
          onPress={() => setVisible(addMonths(visible, -1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month">
          <ThemedText type="subtitle" themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="default" style={{ fontFamily: Fonts.headingMedium }}>
          {monthLabel(visible)}
        </ThemedText>
        <Pressable
          onPress={() => setVisible(addMonths(visible, 1))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month">
          <ThemedText type="subtitle" themeColor="accent">
            ›
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_INITIALS.map((initial, i) => (
          <ThemedText key={i} type="small" themeColor="textMuted" style={styles.weekdayText}>
            {initial}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={`pad-${i}`} style={styles.cell} />;

          const disabled = fromIso(iso).getTime() < minTime;
          const isEdge = iso === start || iso === end;
          const inRange = !!start && !!end && isBetween(iso, start, end);

          return (
            <Pressable
              key={iso}
              onPress={() => onPressDay(iso)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: inRange, disabled }}
              style={[
                styles.cell,
                inRange && !isEdge && { backgroundColor: theme.accentGlow },
                isEdge && { backgroundColor: theme.accent, borderRadius: Radius.full },
              ]}>
              <ThemedText
                type="small"
                style={[
                  styles.cellText,
                  disabled && { color: theme.textMuted, opacity: 0.4 },
                  isEdge && { color: '#fff', fontFamily: Fonts.headingMedium },
                ]}>
                {fromIso(iso).getUTCDate()}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        {count > 0 ? (
          <>
            <View style={[styles.countPill, { backgroundColor: theme.accentGlow }]}>
              <ThemedText type="smallBold" themeColor="accent">
                {count} {count === 1 ? 'day' : 'days'}
              </ThemedText>
            </View>
            <Pressable onPress={() => onChange(null, null)} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary">
                Clear
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <ThemedText type="small" themeColor="textMuted">
            {start ? 'Now pick the last day' : 'Pick the first day'}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekdayRow: { flexDirection: 'row' },
  weekdayText: { width: COLUMN_WIDTH, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: COLUMN_WIDTH, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    minHeight: 28,
  },
  countPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
});
