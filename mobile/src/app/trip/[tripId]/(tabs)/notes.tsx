import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { upsertTripNote, useTripNote } from '@/lib/notes';

function relativeTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotesScreen() {
  const theme = useTheme();
  const { activeTripId, activeMember } = useTrip();
  const { note, loading } = useTripNote(activeTripId);
  const [text, setText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dirty) setText(note?.text ?? '');
  }, [note?.text, dirty]);

  const save = async () => {
    if (!activeTripId || !activeMember) return;
    setSaving(true);
    await upsertTripNote(activeTripId, activeMember.id, text.trim());
    setSaving(false);
    setDirty(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <ThemedText type="title">📝 Trip Notes</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          A shared scratchpad — packing list, flight details, reminders, whatever the group needs to remember.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            setDirty(true);
          }}
          onBlur={save}
          placeholder="Start typing…"
          placeholderTextColor={theme.textMuted}
          editable={!loading}
          multiline
          style={[styles.textarea, { color: theme.text }]}
        />
        <ThemedText type="small" themeColor="textMuted" style={styles.footer}>
          {saving
            ? 'Saving…'
            : note?.updated_at
              ? `Last edited by ${note.trip_members?.emoji ?? ''} ${note.trip_members?.display_name ?? 'someone'}, ${relativeTime(note.updated_at)}`
              : 'Nobody has written anything yet.'}
        </ThemedText>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  header: { gap: Spacing.xs, marginBottom: Spacing.md },
  card: { flex: 1, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md },
  textarea: { flex: 1, fontSize: 16, textAlignVertical: 'top' },
  footer: { marginTop: Spacing.sm },
});
