import { Link, router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTrip, type TripSummary } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';

export default function TripPickerScreen() {
  const theme = useTheme();
  const { profile, signOut } = useAuth();
  const { trips, loading, setActiveTripId } = useTrip();

  const openTrip = (trip: TripSummary) => {
    setActiveTripId(trip.id);
    router.push({ pathname: '/trip/[tripId]/dashboard', params: { tripId: trip.id } });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View>
          <ThemedText type="subtitle">
            {profile?.emoji ?? '👋'} Hey{profile?.display_name ? `, ${profile.display_name}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your trips
          </ThemedText>
        </View>
        <View style={styles.headerActions}>
          <Link href="/(trips)/account" asChild>
            <Pressable>
              <ThemedText type="link">Account</ThemedText>
            </Pressable>
          </Link>
          <Pressable onPress={signOut}>
            <ThemedText type="link">Log out</ThemedText>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(trip) => trip.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !loading ? (
            <ThemedText type="default" themeColor="textSecondary" style={styles.empty}>
              No trips yet — create one or join with an invite code.
            </ThemedText>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openTrip(item)}
            style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="default" style={{ fontSize: 28 }}>
              {item.cover_emoji ?? '🧳'}
            </ThemedText>
            <View style={{ flex: 1 }}>
              <ThemedText type="default">{item.name}</ThemedText>
              {item.destination && (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.destination}
                </ThemedText>
              )}
            </View>
          </Pressable>
        )}
      />

      <View style={styles.actions}>
        <Link href="/(trips)/create" asChild>
          <Pressable style={StyleSheet.flatten([styles.actionButton, { backgroundColor: theme.accent }])}>
            <ThemedText type="default" style={{ color: '#fff' }}>
              + Create a trip
            </ThemedText>
          </Pressable>
        </Link>
        <Link href="/(trips)/join" asChild>
          <Pressable
            style={StyleSheet.flatten([styles.actionButton, styles.actionButtonOutline, { borderColor: theme.accent }])}>
            <ThemedText type="default" themeColor="accent">
              Join with a code
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerActions: { flexDirection: 'row', gap: Spacing.md },
  list: { gap: Spacing.sm, flexGrow: 1 },
  empty: { textAlign: 'center', marginTop: Spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  actions: { gap: Spacing.sm, marginTop: Spacing.md },
  actionButton: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
  },
  actionButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
});
