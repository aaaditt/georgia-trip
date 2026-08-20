import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDay } from '@/lib/itinerary';
import { useTheme } from '@/hooks/use-theme';

// Just a name + day — start time/duration default sensibly and, like
// every other block, are fully adjustable afterward by dragging/resizing,
// so the modal doesn't need to ask for everything up front.
export function AddEventModal({
  visible,
  days,
  defaultDay,
  onClose,
  onAdd,
}: {
  visible: boolean;
  days: string[];
  defaultDay: string;
  onClose: () => void;
  onAdd: (title: string, day: string) => void;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [day, setDay] = useState(defaultDay);

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), day);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText type="subtitle">📌 Add checkpoint / event</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Hotel check-in, a flight, lunch, "meet at the car"… it lands on the calendar and you can drag it around like everything else.
          </ThemedText>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Event name"
            placeholderTextColor={theme.textMuted}
            autoFocus
            maxLength={80}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />

          <ThemedText type="small" themeColor="textSecondary">
            Day
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {days.map((d, i) => {
              const f = formatDay(d);
              const active = d === day;
              return (
                <Pressable
                  key={d}
                  onPress={() => setDay(d)}
                  style={[styles.dayChip, { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.accentGlow : 'transparent' }]}>
                  <ThemedText type="small" style={active ? { color: theme.accent } : undefined}>
                    Day {i + 1} · {f.weekday} {f.date}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable onPress={onClose}>
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
            <Pressable onPress={submit} disabled={!name.trim()} style={[styles.saveButton, { backgroundColor: theme.accent, opacity: name.trim() ? 1 : 0.5 }]}>
              <ThemedText type="small" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
                Add to calendar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: Spacing.lg },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm },
  hint: { marginBottom: Spacing.xs },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  dayRow: { gap: Spacing.xs, paddingVertical: 4 },
  dayChip: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  saveButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
});
