import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { clamp, SLOT_PX, snapSlot } from '@/lib/calendar-layout';
import { formatTime, SLOT_MIN } from '@/lib/itinerary';

const DAY_MIN = 24 * 60;
// A resize handle sized for a mouse cursor (the web app's) is unusable on
// touch — this is the plan's called-for bigger, visible drag affordance.
const HANDLE_H = 28;

export function CalendarBlock({
  label,
  color,
  startMin,
  durationMin,
  laneLeftPct,
  laneWidthPct,
  editable,
  selectMode,
  selected,
  hasNotes,
  onTap,
  onMove,
  onResize,
}: {
  label: string;
  color: string;
  startMin: number;
  durationMin: number;
  laneLeftPct: number;
  laneWidthPct: number;
  editable: boolean;
  selectMode: boolean;
  selected: boolean;
  hasNotes: boolean;
  onTap: () => void;
  onMove: (newStartMin: number) => void;
  onResize: (newDurationMin: number) => void;
}) {
  const startMinSV = useSharedValue(startMin);
  const durationMinSV = useSharedValue(durationMin);
  const translateY = useSharedValue(0);
  const heightDelta = useSharedValue(0);
  const dragging = useSharedValue(false);
  const liveStartMin = useSharedValue(startMin);
  const liveDuration = useSharedValue(durationMin);

  useEffect(() => {
    startMinSV.value = startMin;
    liveStartMin.value = startMin;
  }, [startMin]);
  useEffect(() => {
    durationMinSV.value = durationMin;
    liveDuration.value = durationMin;
  }, [durationMin]);

  const commitMove = (newStartMin: number) => {
    translateY.value = 0;
    onMove(newStartMin);
  };
  const commitResize = (newDuration: number) => {
    heightDelta.value = 0;
    onResize(newDuration);
  };
  const hapticStart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const moveGesture = Gesture.Pan()
    .enabled(editable && !selectMode)
    .activateAfterLongPress(220)
    .onStart(() => {
      dragging.value = true;
      scheduleOnRN(hapticStart);
    })
    .onUpdate((e) => {
      const rawStart = startMinSV.value + (e.translationY / SLOT_PX) * SLOT_MIN;
      const snapped = clamp(snapSlot(rawStart), 0, DAY_MIN - durationMinSV.value);
      liveStartMin.value = snapped;
      translateY.value = ((snapped - startMinSV.value) / SLOT_MIN) * SLOT_PX;
    })
    .onEnd(() => {
      dragging.value = false;
      scheduleOnRN(commitMove, liveStartMin.value);
    });

  const resizeGesture = Gesture.Pan()
    .enabled(editable && !selectMode)
    .onStart(() => {
      dragging.value = true;
      scheduleOnRN(hapticStart);
    })
    .onUpdate((e) => {
      const rawDuration = durationMinSV.value + (e.translationY / SLOT_PX) * SLOT_MIN;
      const snapped = clamp(snapSlot(rawDuration), SLOT_MIN, DAY_MIN - startMinSV.value);
      liveDuration.value = snapped;
      heightDelta.value = ((snapped - durationMinSV.value) / SLOT_MIN) * SLOT_PX;
    })
    .onEnd(() => {
      dragging.value = false;
      scheduleOnRN(commitResize, liveDuration.value);
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    scheduleOnRN(onTap);
  });

  const composedMove = Gesture.Race(moveGesture, tapGesture);

  const blockAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    height: (durationMin / 30) * SLOT_PX - 2 + heightDelta.value,
    opacity: dragging.value ? 0.85 : 1,
    zIndex: dragging.value ? 10 : 1,
    elevation: dragging.value ? 6 : 0,
  }));

  const top = (startMin / SLOT_MIN) * SLOT_PX;

  return (
    <Animated.View
      style={[
        styles.block,
        blockAnimatedStyle,
        {
          top,
          left: `${laneLeftPct}%`,
          width: `${laneWidthPct}%`,
          backgroundColor: `${color}22`,
          borderColor: color,
          borderLeftColor: color,
        },
        selected && { borderWidth: 2 },
      ]}>
      <GestureDetector gesture={composedMove}>
        <View style={styles.tapArea} onTouchEnd={selectMode ? onTap : undefined}>
          <ThemedText type="small" numberOfLines={2} style={{ color }}>
            {label}
          </ThemedText>
          {durationMin >= 60 && (
            <ThemedText type="small" themeColor="textMuted" style={styles.time}>
              {formatTime(startMin)}–{formatTime(startMin + durationMin)}
            </ThemedText>
          )}
          {hasNotes && (
            <ThemedText type="small" style={styles.noteDot}>
              📝
            </ThemedText>
          )}
        </View>
      </GestureDetector>

      {editable && !selectMode && (
        <GestureDetector gesture={resizeGesture}>
          <View style={[styles.handle, { borderColor: color }]}>
            <View style={[styles.handleGrip, { backgroundColor: color }]} />
          </View>
        </GestureDetector>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    position: 'absolute',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  tapArea: { flex: 1, padding: 4 },
  time: { fontSize: 11 },
  noteDot: { position: 'absolute', top: 2, right: 4, fontSize: 11 },
  handle: {
    height: HANDLE_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
  },
  handleGrip: { width: 28, height: 3, borderRadius: 2, opacity: 0.6 },
});
