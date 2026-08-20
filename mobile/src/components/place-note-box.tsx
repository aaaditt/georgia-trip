import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceNote } from '@/lib/notes';

// One shared, editable note per place — everyone sees the same text and
// the last person to edit it wins (same model as the web app's
// PlaceNoteBox / the trip-wide scratchpad below).
export function PlaceNoteBox({ note, onSave }: { note: PlaceNote | null; onSave: (text: string) => Promise<void> | void }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(note?.text ?? '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) setText(note?.text ?? '');
  }, [note?.text, dirty]);

  const save = async () => {
    setDirty(false);
    await onSave(text.trim());
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <ThemedText type="small" themeColor="textSecondary">
          📝 {note?.text ? 'Note' : 'Add a note'}
        </ThemedText>
      </Pressable>
      {expanded && (
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setDirty(true);
          }}
          onBlur={save}
          placeholder="Meet at the entrance, bring cash…"
          placeholderTextColor={theme.textMuted}
          multiline
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, minHeight: 44, textAlignVertical: 'top' },
});
