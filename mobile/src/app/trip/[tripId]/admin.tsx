import { Stack } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { useCalendarAccess } from '@/lib/access';
import { deleteComment, useExperiences, useTripMembers, useVotes, type TripMember } from '@/lib/hooks';
import { dismissReport, useCommentReports } from '@/lib/moderation';
import { supabase } from '@/lib/supabase';

export default function AdminScreen() {
  const theme = useTheme();
  const { activeTripId, activeMember } = useTrip();
  const { members, refetch: refetchMembers } = useTripMembers(activeTripId);
  const { experiences } = useExperiences(activeTripId);
  const { votes } = useVotes(activeTripId);
  const { grantedIds, grantAccess, revokeAccess } = useCalendarAccess(activeTripId);
  const { reports, refetch: refetchReports } = useCommentReports(activeTripId);

  const isAdmin = activeMember?.role === 'owner' || activeMember?.role === 'admin';

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Admin' }} />
        <ThemedText type="default" themeColor="textSecondary">
          Only trip owners and admins can see this page.
        </ThemedText>
      </View>
    );
  }

  const progressFor = (memberId: string) => {
    if (experiences.length === 0) return 0;
    const voted = experiences.filter((e) => votes.some((v) => v.member_id === memberId && v.experience_id === e.id)).length;
    return Math.round((voted / experiences.length) * 100);
  };

  const toggleAdmin = async (member: TripMember) => {
    if (member.role === 'owner') return;
    const nextRole = member.role === 'admin' ? 'member' : 'admin';
    // update_member_role (migration-08) — SECURITY DEFINER RPC, not a
    // direct update; see that migration's header for why.
    await supabase.rpc('update_member_role', { p_member_id: member.id, p_next_role: nextRole });
    refetchMembers();
  };

  const removeMember = (member: TripMember) => {
    Alert.alert(`Remove ${member.display_name}?`, 'They lose access to this trip. Their past votes/comments stay unless they delete their own account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          // remove_trip_member (migration-08) — SECURITY DEFINER RPC, not
          // a direct update; see that migration's header for why.
          await supabase.rpc('remove_trip_member', { p_member_id: member.id });
          refetchMembers();
        },
      },
    ]);
  };

  const resolveReport = (reportId: string, commentId: number, remove: boolean) => {
    Alert.alert(remove ? 'Delete this comment?' : 'Dismiss this report?', remove ? 'This removes the comment for everyone.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: remove ? 'Delete comment' : 'Dismiss',
        style: remove ? 'destructive' : 'default',
        onPress: async () => {
          if (remove) await deleteComment(commentId);
          await dismissReport(reportId);
          refetchReports();
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Admin' }} />

      {reports.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="subtitle">🚩 Reported comments</ThemedText>
          {reports.map((r) => (
            <View key={r.id} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                "{r.comments?.text ?? '(comment removed)'}"
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                Reported by {r.trip_members?.emoji} {r.trip_members?.display_name}
              </ThemedText>
              <View style={styles.rowActions}>
                <Pressable onPress={() => resolveReport(r.id, r.comment_id, true)}>
                  <ThemedText type="small" style={{ color: '#E53935' }}>
                    Delete comment
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => resolveReport(r.id, r.comment_id, false)}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Dismiss
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <ThemedText type="subtitle">👥 Members</ThemedText>
        {members.map((m) => (
          <View key={m.id} style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={styles.memberHeader}>
              <ThemedText type="default">
                {m.emoji} {m.display_name}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {m.role}
                {m.member_kind === 'managed' ? ' · managed' : ''}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Voted {progressFor(m.id)}% of places
            </ThemedText>
            <View style={styles.rowActions}>
              {m.role !== 'owner' && (
                <Pressable onPress={() => toggleAdmin(m)}>
                  <ThemedText type="small" themeColor="accent">
                    {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </ThemedText>
                </Pressable>
              )}
              {grantedIds.has(m.id) ? (
                <Pressable onPress={() => revokeAccess(m.id)}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Revoke early calendar access
                  </ThemedText>
                </Pressable>
              ) : (
                <Pressable onPress={() => grantAccess(m.id)}>
                  <ThemedText type="small" themeColor="accent">
                    Grant early calendar access
                  </ThemedText>
                </Pressable>
              )}
              {m.role !== 'owner' && m.id !== activeMember?.id && (
                <Pressable onPress={() => removeMember(m)}>
                  <ThemedText type="small" style={{ color: '#E53935' }}>
                    Remove
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  section: { gap: Spacing.sm },
  card: { borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 4 },
  memberHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: 4 },
});
