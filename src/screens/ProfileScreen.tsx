import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Banner, Button, Label, Row, Screen, TextField } from '../components/ui';
import { updateDisplayName, uploadAvatar } from '../lib/api';
import { useAuth, useCurrentUser } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { isSupabaseConfigured, supabaseHost } from '../lib/supabase';
import { colors, spacing, type } from '../theme';

export function ProfileScreen() {
  const { signOut, setProfile, session } = useAuth();
  const { userId, email, profile } = useCurrentUser();
  const [name, setName] = useState(profile.display_name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= 60 && trimmed !== profile.display_name && !saving;

  const saveName = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      setProfile(await updateDisplayName(userId, trimmed));
      setNotice('Name updated.');
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async () => {
    setError(null);
    setNotice(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is off. Allow it in Settings to choose an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.base64) {
      return;
    }
    setUploading(true);
    try {
      setProfile(await uploadAvatar(userId, asset.base64, asset.mimeType ?? 'image/jpeg'));
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setUploading(false);
    }
  };

  const expiresAt = session?.expires_at ? new Date(session.expires_at * 1000) : null;

  return (
    <Screen title="Profile">
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner>{notice}</Banner> : null}

      <View style={styles.identity}>
        <Pressable accessibilityLabel="Change avatar" onPress={changeAvatar} disabled={uploading}>
          <Avatar name={profile.display_name} uri={profile.avatar_url} size={72} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={type.headline}>{profile.display_name}</Text>
          <Text style={[type.body, styles.muted]}>{email}</Text>
          <Button
            variant="text"
            label={uploading ? 'Uploading…' : 'Change photo'}
            onPress={changeAvatar}
            disabled={uploading}
            style={styles.leftAlign}
          />
        </View>
      </View>

      <View style={styles.nameForm}>
        <TextField
          label="DISPLAY NAME"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={60}
          style={styles.flex}
          testID="profile-name"
        />
        <Button label="Save" onPress={saveName} disabled={!canSave} loading={saving} testID="profile-save" />
      </View>
      <Text style={[type.body, styles.muted, styles.hint]}>Group members see this name on receipts and balances.</Text>

      <Label style={styles.section}>ACCOUNT</Label>
      <Row title="Backend" subtitle={isSupabaseConfigured ? supabaseHost.toUpperCase() : 'NOT CONFIGURED'} />
      <Row
        title="Session"
        subtitle={expiresAt ? `TOKEN REFRESHES BEFORE ${expiresAt.toLocaleTimeString()}` : 'ACTIVE'}
      />
      <Row title="Version" subtitle={(Constants.expoConfig?.version ?? 'dev').toUpperCase()} />

      <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.signOut} testID="profile-signout" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  muted: { color: colors.muted },
  identity: { alignItems: 'center', flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.xl },
  leftAlign: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  nameForm: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  hint: { marginTop: spacing.sm },
  section: { marginTop: spacing.xl },
  signOut: { marginTop: spacing.xl },
});
