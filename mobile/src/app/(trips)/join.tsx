import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTrip } from '@/context/TripContext';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function JoinTripScreen() {
  const theme = useTheme();
  const { refetchTrips, setActiveTripId } = useTrip();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    // redeem_trip_invite (migration-06) validates the code, throttles
    // repeated failures, and inserts the trip_members row server-side.
    const { data: tripId, error: rpcError } = await supabase.rpc('redeem_trip_invite', {
      p_code: code.trim(),
    });
    setSubmitting(false);
    if (rpcError || !tripId) {
      setError(rpcError?.message ?? 'Could not join trip');
      return;
    }
    await refetchTrips();
    setActiveTripId(tripId as string);
    router.replace({ pathname: '/trip/[tripId]/dashboard', params: { tripId: tripId as string } });
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      <ThemedText type="title">Join a trip</ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
        Enter the invite code someone shared with you.
      </ThemedText>

      <View style={styles.form}>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.trim())}
          placeholder="Invite code"
          placeholderTextColor={theme.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            styles.codeInput,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}
        />

        {error && (
          <ThemedText type="small" themeColor="accent">
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={submitting || !code}
          style={[styles.button, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
          <ThemedText type="default" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
            {submitting ? 'Joining…' : 'Join trip'}
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
  codeInput: {
    fontFamily: Fonts.headingMedium,
    letterSpacing: 2,
    textAlign: 'center',
  },
  button: {
    borderRadius: Radius.full,
    paddingVertical: Spacing.sm + 4,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
