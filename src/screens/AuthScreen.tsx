import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, TextField } from '../components/ui';
import { useAuth } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { colors, spacing, type } from '../theme';

type Mode = 'signIn' | 'signUp';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const passwordValid = password.length >= 6;
  const nameValid = mode === 'signIn' || displayName.trim().length > 0;
  const canSubmit = emailValid && passwordValid && nameValid && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password, displayName);
        if (needsConfirmation) {
          setNotice('Check your inbox to confirm your email, then sign in.');
          setMode('signIn');
        }
      }
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.canvas} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[type.display, styles.uppercase]}>Split</Text>
          <Text style={[type.body, styles.muted]}>Scan the receipt. Split it fairly. Settle up.</Text>
        </View>

        {notice ? <Banner>{notice}</Banner> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}

        <View style={styles.form}>
          {mode === 'signUp' ? (
            <TextField
              label="YOUR NAME"
              placeholder="Ana"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoComplete="name"
              testID="auth-name"
            />
          ) : null}
          <TextField
            label="EMAIL ADDRESS"
            placeholder="name@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            testID="auth-email"
          />
          <TextField
            label="PASSWORD"
            placeholder={mode === 'signUp' ? 'At least 6 characters' : 'Password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            onSubmitEditing={canSubmit ? submit : undefined}
            testID="auth-password"
          />
          <Button
            label={mode === 'signIn' ? 'Sign in' : 'Create account'}
            onPress={submit}
            disabled={!canSubmit}
            loading={busy}
            testID="auth-submit"
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={[type.label, styles.muted]}>OR</Text>
          <View style={styles.divider} />
        </View>

        <Button
          variant="text"
          label={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
          onPress={() => {
            setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            setError(null);
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function ConfigMissingScreen() {
  return (
    <ScrollView contentContainerStyle={styles.canvas}>
      <Text style={[type.display, styles.uppercase]}>Split</Text>
      <Text style={[type.title, styles.configTitle]}>Backend not configured</Text>
      <Text style={[type.body, styles.muted]}>
        Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (for example in a .env.local file), apply the
        migrations in supabase/migrations, then restart the dev server.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  canvas: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.margin,
    paddingVertical: spacing.xl,
    backgroundColor: colors.surface,
  },
  header: { marginBottom: spacing.xl },
  uppercase: { textTransform: 'uppercase' },
  muted: { color: colors.muted },
  form: { gap: spacing.lg },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.lg },
  divider: { backgroundColor: colors.line, flex: 1, height: StyleSheet.hairlineWidth },
  configTitle: { marginBottom: spacing.sm, marginTop: spacing.lg },
});
