import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function CreateTripScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { refetchTrips, setActiveTripId } = useTrip();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!session?.user) return;
    setError(null);
    setSubmitting(true);
    // on_trip_created (migration-06) inserts the owner's trip_members row
    // automatically in the same transaction as this insert.
    const { data, error: insertError } = await supabase
      .from('trips')
      .insert({ name: name.trim(), destination: destination.trim() || null, created_by: session.user.id })
      .select('id')
      .single();
    setSubmitting(false);
    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not create trip');
      return;
    }
    await refetchTrips();
    setActiveTripId(data.id);
    router.replace({ pathname: '/trip/[tripId]/dashboard', params: { tripId: data.id } });
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText type="title">New trip</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
        You'll be the owner and can invite others once it's created.
      </ThemedText>

      <View style={styles.form}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Trip name (e.g. Georgia 2027)"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder="Destination (optional)"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        />

        {error && (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !name.trim()}
          style={[styles.button, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
          <ThemedText type="default" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
            {submitting ? 'Creating…' : 'Create trip'}
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: Spacing.lg, gap: Spacing.lg },
  subtitle: { marginTop: -Spacing.sm },
  form: { gap: Spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    fontFamily: Fonts.body,
    fontSize: 16,
  },
  button: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
