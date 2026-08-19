import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Comment } from '@/lib/hooks';

export function CommentBox({
  comments,
  onAdd,
}: {
  comments: Comment[];
  onAdd: (text: string) => Promise<void> | void;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    await onAdd(text.trim());
    setSubmitting(false);
    setText('');
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded((v) => !v)}>
        <ThemedText type="small" themeColor="textSecondary">
          💬 {comments.length ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Add a comment'}
        </ThemedText>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          {comments.map((c) => (
            <View key={c.id} style={styles.comment}>
              <ThemedText type="smallBold">
                {c.trip_members?.emoji} {c.trip_members?.display_name ?? 'Someone'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {c.text}
              </ThemedText>
            </View>
          ))}
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Write a comment…"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              multiline
            />
            <Pressable
              onPress={submit}
              disabled={submitting || !text.trim()}
              style={[styles.sendButton, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
              <ThemedText type="small" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
                Send
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.xs },
  body: { gap: Spacing.sm, marginTop: Spacing.xs },
  comment: { gap: 2 },
  inputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, minHeight: 36 },
  sendButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
