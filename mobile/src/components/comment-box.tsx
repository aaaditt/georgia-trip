import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Comment } from '@/lib/hooks';

export function CommentBox({
  comments,
  myMemberId,
  onAdd,
  onReport,
  onBlock,
}: {
  comments: Comment[];
  myMemberId?: string;
  onAdd: (text: string) => Promise<void> | void;
  onReport?: (commentId: number) => void;
  onBlock?: (memberId: string, memberName: string) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<number>>(new Set());

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    await onAdd(text.trim());
    setSubmitting(false);
    setText('');
  };

  const report = (c: Comment) => {
    onReport?.(c.id);
    setReportedIds((prev) => new Set(prev).add(c.id));
  };

  const confirmBlock = (c: Comment) => {
    const name = c.trip_members?.display_name ?? 'this person';
    Alert.alert(`Block ${name}?`, "You won't see their comments anymore. You can undo this from your account settings later.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => onBlock?.(c.member_id, name) },
    ]);
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
          {comments.map((c) => {
            const isMine = myMemberId && c.member_id === myMemberId;
            return (
              <View key={c.id} style={styles.comment}>
                <ThemedText type="smallBold">
                  {c.trip_members?.emoji} {c.trip_members?.display_name ?? 'Someone'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {c.text}
                </ThemedText>
                {!isMine && (onReport || onBlock) && (
                  <View style={styles.moderationRow}>
                    {onReport && (
                      <Pressable onPress={() => report(c)} disabled={reportedIds.has(c.id)}>
                        <ThemedText type="small" themeColor="textMuted">
                          {reportedIds.has(c.id) ? 'Reported' : 'Report'}
                        </ThemedText>
                      </Pressable>
                    )}
                    {onBlock && (
                      <Pressable onPress={() => confirmBlock(c)}>
                        <ThemedText type="small" themeColor="textMuted">
                          Block
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          })}
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
  moderationRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 2 },
  inputRow: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-end' },
  input: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, minHeight: 36 },
  sendButton: { borderRadius: Radius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
