import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatDay, formatTime, type ItineraryItem } from '@/lib/itinerary';
import { useTheme } from '@/hooks/use-theme';

export function DetailSheet({
  item,
  label,
  editable,
  onClose,
  onSave,
  onDelete,
}: {
  item: ItineraryItem | null;
  label: string;
  editable: boolean;
  onClose: () => void;
  onSave: (patch: { title?: string | null; notes?: string | null }) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(item?.title ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');

  useEffect(() => {
    setTitle(item?.title ?? '');
    setNotes(item?.notes ?? '');
  }, [item?.id]);

  if (!item) return null;

  const save = () => {
    const patch: { title?: string | null; notes?: string | null } = {};
    if (title !== (item.title ?? '')) patch.title = title.trim() || null;
    if (notes !== (item.notes ?? '')) patch.notes = notes.trim() || null;
    if (Object.keys(patch).length) onSave(patch);
  };

  const f = formatDay(item.day);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={(e) => e.stopPropagation()}>
          <ThemedText type="subtitle">{label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {f.weekday} {f.date} {f.month} · {formatTime(item.startMin)}–{formatTime(item.startMin + item.durationMin)}
          </ThemedText>

          {editable && item.kind !== 'place' && (
            <TextInput
              value={title}
              onChangeText={setTitle}
              onBlur={save}
              placeholder={item.kind === 'transport' ? 'Note, e.g. Airport → Hotel' : 'Rename this event'}
              placeholderTextColor={theme.textMuted}
              maxLength={80}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
            />
          )}

          {editable ? (
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onBlur={save}
              placeholder="Notes — meet driver at the lobby, bring cash…"
              placeholderTextColor={theme.textMuted}
              maxLength={300}
              multiline
              style={[styles.input, styles.notesInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
            />
          ) : (
            !!item.notes && (
              <ThemedText type="small" themeColor="textSecondary">
                📝 {item.notes}
              </ThemedText>
            )
          )}

          <View style={styles.actions}>
            {editable && (
              <Pressable onPress={onDelete} style={[styles.deleteButton, { borderColor: theme.border }]}>
                <ThemedText type="small" style={{ color: '#E53935' }}>
                  🗑 Remove
                </ThemedText>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: theme.accent }]}>
              <ThemedText type="small" style={{ color: '#fff' }}>
                Close
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderWidth: 1, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  notesInput: { minHeight: 70, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  deleteButton: { borderWidth: 1, borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
  closeButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2 },
});
