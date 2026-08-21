import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { useTripMembers } from '@/lib/hooks';
import { unblockMember, useBlockedMemberIds } from '@/lib/moderation';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const theme = useTheme();
  const { session, profile, signOut } = useAuth();
  const { activeTripId, activeMember, trips } = useTrip();
  const activeTrip = trips.find((t) => t.id === activeTripId);
  const { members } = useTripMembers(activeTripId);
  const { blockedIds, refetch: refetchBlocked } = useBlockedMemberIds(activeTripId, activeMember?.id ?? null);
  const blockedMembers = members.filter((m) => blockedIds.has(m.id));
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveName = async () => {
    if (!session?.user || !displayName.trim() || displayName === profile?.display_name) return;
    setSaving(true);
    await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', session.user.id);
    setSaving(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your account and everything tied to it — your votes, ratings, comments, and trip memberships. Trips you created stay for other members, but you lose access. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  const doDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.rpc('delete_own_account');
    if (error) {
      setDeleting(false);
      Alert.alert('Could not delete account', error.message);
      return;
    }
    await supabase.auth.signOut();
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText type="title">Account</ThemedText>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Email
        </ThemedText>
        <ThemedText type="default">{session?.user?.email}</ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Display name
        </ThemedText>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          onBlur={saveName}
          placeholder="Your name"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />
        {saving && (
          <ThemedText type="small" themeColor="textMuted">
            Saving…
          </ThemedText>
        )}
      </View>

      {activeTripId && (
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Blocked in {activeTrip?.name ?? 'this trip'}
          </ThemedText>
          {blockedMembers.length === 0 ? (
            <ThemedText type="small" themeColor="textMuted">
              Nobody blocked.
            </ThemedText>
          ) : (
            blockedMembers.map((m) => (
              <View key={m.id} style={styles.blockedRow}>
                <ThemedText type="small">
                  {m.emoji} {m.display_name}
                </ThemedText>
                <Pressable
                  onPress={async () => {
                    if (!activeMember) return;
                    await unblockMember(activeMember.id, m.id);
                    refetchBlocked();
                  }}>
                  <ThemedText type="small" themeColor="accent">
                    Unblock
                  </ThemedText>
                </Pressable>
              </View>
            ))
          )}
        </View>
      )}

      <Pressable onPress={signOut} style={[styles.button, styles.buttonOutline, { borderColor: theme.border }]}>
        <ThemedText type="default">Log out</ThemedText>
      </Pressable>

      <View style={styles.dangerZone}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.dangerTitle}>
          Danger zone
        </ThemedText>
        <Pressable
          onPress={confirmDelete}
          disabled={deleting}
          style={[styles.button, styles.deleteButton, { borderColor: '#E53935', opacity: deleting ? 0.6 : 1 }]}>
          <ThemedText type="default" style={{ color: '#E53935', fontFamily: Fonts.headingMedium }}>
            {deleting ? 'Deleting…' : 'Delete my account'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.lg },
  field: { gap: Spacing.xs },
  blockedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  button: { borderRadius: Radius.full, paddingVertical: Spacing.sm + 4, alignItems: 'center' },
  buttonOutline: { borderWidth: 1 },
  dangerZone: { marginTop: Spacing.xl, gap: Spacing.sm },
  dangerTitle: { textTransform: 'uppercase', letterSpacing: 0.5 },
  deleteButton: { borderWidth: 1 },
});
