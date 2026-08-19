import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/use-theme';

export default function SignUpScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: signUpError } = await signUp(email.trim(), password, displayName.trim());
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError);
      return;
    }
    // Supabase Auth requires email confirmation by default — session isn't
    // active yet, so the (auth) guard won't flip until they confirm and
    // log in. Show a "check your email" state instead of navigating.
    setCheckEmail(true);
  };

  if (checkEmail) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <ThemedText type="title" style={styles.brand}>
          📬 Check your email
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          We sent a confirmation link to {email}. Confirm it, then log in.
        </ThemedText>
        <Link href="/(auth)/login" asChild>
          <Pressable style={[styles.button, { backgroundColor: theme.accent }]}>
            <ThemedText type="default" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
              Back to log in
            </ThemedText>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.brand}>
          🧳 Trip Planner
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          Create an account
        </ThemedText>

        <View style={styles.form}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={theme.textMuted}
            autoComplete="name"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password (min. 6 characters)"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            autoComplete="password-new"
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
          />

          {error && (
            <ThemedText type="small" themeColor="accent">
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={submitting || !email || !password || !displayName}
            style={[styles.button, { backgroundColor: theme.accent, opacity: submitting ? 0.6 : 1 }]}>
            <ThemedText type="default" style={{ color: '#fff', fontFamily: Fonts.headingMedium }}>
              {submitting ? 'Creating account…' : 'Create account'}
            </ThemedText>
          </Pressable>

          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.linkRow}>
              <ThemedText type="link">Already have an account? Log in</ThemedText>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  brand: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  form: {
    gap: Spacing.md,
  },
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
  linkRow: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
