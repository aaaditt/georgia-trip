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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dateOk = (v: string) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v);

  const onSubmit = async () => {
    if (!session?.user) return;
    if (!dateOk(startDate) || !dateOk(endDate)) {
      setError('Dates must be in YYYY-MM-DD format');
      return;
    }
    setError(null);
    setSubmitting(true);
    // create_trip (migration-08) — SECURITY DEFINER RPC, not a direct
    // insert; see that migration's header for why. on_trip_created
    // (migration-06) still inserts the owner's trip_members row
    // automatically via the AFTER INSERT trigger either way. Dates are
    // optional at creation but the calendar (Phase 3) needs them to know
    // which days to show — worth filling in if you have them.
    const { data: tripId, error: insertError } = await supabase.rpc('create_trip', {
      p_name: name.trim(),
      p_destination: destination.trim() || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    });
    setSubmitting(false);
    if (insertError || !tripId) {
      setError(insertError?.message ?? 'Could not create trip');
      return;
    }
    await refetchTrips();
    setActiveTripId(tripId as string);
    router.replace({ pathname: '/trip/[tripId]/dashboard', params: { tripId: tripId as string } });
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
        <View style={styles.row}>
          <TextInput
            value={startDate}
            onChangeText={setStartDate}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, styles.half, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
          <TextInput
            value={endDate}
            onChangeText={setEndDate}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor={theme.textMuted}
            style={[styles.input, styles.half, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
        </View>

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
  row: { flexDirection: 'row', gap: Spacing.sm },
  half: { flex: 1 },
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
