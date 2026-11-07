import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, Chip, EmptyState, ErrorState, Label, LoadingState, Row, Screen, SectionHeader } from '../components/ui';
import { emptyDraft } from '../core/receipt.mjs';
import {
  createReceipt,
  deleteReceipt,
  draftFromReceiptRow,
  listGroups,
  listOpenReceipts,
  recognizeReceipt,
  uploadReceiptImage,
  type ReceiptRow,
} from '../lib/api';
import { useCurrentUser } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useNavigation } from '../navigation';
import { colors, spacing, type } from '../theme';

type Phase =
  | { step: 'idle' }
  | { step: 'uploading'; previewUri: string }
  | { step: 'recognizing'; previewUri: string | null; receiptId: string }
  | { step: 'failed'; previewUri: string | null; receiptId: string | null; message: string };

export function openReceipt(nav: ReturnType<typeof useNavigation>, receipt: ReceiptRow, userId: string) {
  nav.push({ name: 'review', groupId: receipt.group_id, draft: draftFromReceiptRow(receipt, userId) });
}

export function ScanScreen({ groupId: initialGroupId }: { groupId?: string }) {
  const nav = useNavigation();
  const { userId } = useCurrentUser();
  const groups = useAsync(listGroups, []);
  const [groupId, setGroupId] = useState<string | undefined>(initialGroupId);
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const activeGroups = (groups.data ?? []).filter((group) => !group.archived_at);
  const selectedGroup = activeGroups.find((group) => group.id === groupId);

  useEffect(() => {
    if (!groupId && activeGroups.length > 0) {
      setGroupId(activeGroups[0].id);
    }
  }, [groupId, activeGroups]);

  const drafts = useAsync(
    () => (groupId ? listOpenReceipts(groupId) : Promise.resolve([] as ReceiptRow[])),
    [groupId, phase.step],
  );
  const myDrafts = (drafts.data ?? []).filter((receipt) => receipt.uploaded_by === userId);

  const busy = phase.step === 'uploading' || phase.step === 'recognizing';

  const runRecognition = async (receiptId: string, previewUri: string | null) => {
    if (!groupId) return;
    setPhase({ step: 'recognizing', previewUri, receiptId });
    try {
      const draft = await recognizeReceipt(receiptId, userId);
      setPhase({ step: 'idle' });
      nav.push({ name: 'review', groupId, draft });
    } catch (caught) {
      setPhase({ step: 'failed', previewUri, receiptId, message: friendlyError(caught) });
    }
  };

  const capture = async (source: 'camera' | 'library') => {
    if (!groupId) return;
    setPermissionError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setPermissionError(
        source === 'camera'
          ? 'Camera access is off. Allow it in Settings to scan receipts, or import a photo instead.'
          : 'Photo library access is off. Allow it in Settings to import receipts.',
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, exif: false };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      setPhase({ step: 'failed', previewUri: asset.uri, receiptId: null, message: 'Could not read that image.' });
      return;
    }

    setPhase({ step: 'uploading', previewUri: asset.uri });
    let receiptId: string | null = null;
    try {
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const path = await uploadReceiptImage(groupId, userId, asset.base64, mimeType);
      const receipt = await createReceipt(groupId, userId, path);
      receiptId = receipt.id;
    } catch (caught) {
      setPhase({ step: 'failed', previewUri: asset.uri, receiptId: null, message: friendlyError(caught) });
      return;
    }

    await runRecognition(receiptId, asset.uri);
  };

  const enterManually = async (existingReceiptId?: string | null) => {
    if (!groupId) return;
    setPhase({ step: 'idle' });
    try {
      const receiptId = existingReceiptId ?? (await createReceipt(groupId, userId, null)).id;
      nav.push({ name: 'review', groupId, draft: { ...emptyDraft({ paidBy: userId }), receiptId } });
    } catch (caught) {
      setPhase({ step: 'failed', previewUri: null, receiptId: null, message: friendlyError(caught) });
    }
  };

  const discard = async (receiptId: string | null) => {
    setPhase({ step: 'idle' });
    if (receiptId) {
      try {
        await deleteReceipt(receiptId);
      } catch {
        // Leaving a stray draft is harmless; it shows in the review list.
      }
    }
  };

  if (groups.loading && !groups.data) {
    return (
      <Screen title="Scan Receipt">
        <LoadingState />
      </Screen>
    );
  }

  if (groups.error) {
    return (
      <Screen title="Scan Receipt">
        <ErrorState message={groups.error} onRetry={groups.reload} />
      </Screen>
    );
  }

  if (activeGroups.length === 0) {
    return (
      <Screen title="Scan Receipt">
        <EmptyState
          title="Create a group first"
          body="Receipts belong to a trip group so they can be split between its members."
          action={<Button label="Create trip group" onPress={() => nav.push({ name: 'createGroup' })} />}
        />
      </Screen>
    );
  }

  return (
    <Screen title="Scan Receipt" refreshing={drafts.refreshing} onRefresh={drafts.refresh}>
      <Label>GROUP</Label>
      <View style={styles.chips}>
        {activeGroups.map((group) => (
          <Chip
            key={group.id}
            label={group.name}
            selected={group.id === groupId}
            disabled={busy}
            onPress={() => setGroupId(group.id)}
          />
        ))}
      </View>

      {permissionError ? (
        <Banner tone="warning">
          <Text style={type.body}>{permissionError}</Text>
          <Button variant="text" label="Open settings" onPress={() => Linking.openSettings()} />
        </Banner>
      ) : null}

      <View style={styles.viewfinder}>
        {phase.step !== 'idle' && phase.previewUri ? (
          <Image source={{ uri: phase.previewUri }} style={styles.preview} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons name="receipt-text-outline" size={72} color="#ffffff88" />
        )}
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
        {busy ? (
          <View style={styles.processing}>
            <ActivityIndicator color={colors.ink} />
            <Text style={styles.processingText}>
              {phase.step === 'uploading' ? 'UPLOADING…' : 'READING RECEIPT…'}
            </Text>
          </View>
        ) : null}
      </View>

      {phase.step === 'failed' ? (
        <Banner tone="error">
          <Text style={type.body}>{phase.message}</Text>
          <View style={styles.inlineActions}>
            {phase.receiptId ? (
              <Button variant="text" label="Retry" onPress={() => runRecognition(phase.receiptId as string, phase.previewUri)} />
            ) : null}
            <Button variant="text" label="Enter manually" onPress={() => enterManually(phase.receiptId)} />
            <Button variant="text" label="Discard" onPress={() => discard(phase.receiptId)} />
          </View>
        </Banner>
      ) : null}

      <View style={styles.captureButtons}>
        <Button
          label="Take photo"
          icon="camera-outline"
          onPress={() => capture('camera')}
          disabled={busy}
          testID="scan-camera"
        />
        <Button
          label="Import from photos"
          icon="images-outline"
          variant="secondary"
          onPress={() => capture('library')}
          disabled={busy}
          testID="scan-library"
        />
        <Button
          label="Enter manually"
          variant="text"
          onPress={() => enterManually()}
          disabled={busy}
          testID="scan-manual"
        />
      </View>
      <Text style={[type.body, styles.muted]}>
        {selectedGroup ? `Receipts go to ${selectedGroup.name}. ` : ''}You’ll review every line before anything is saved.
      </Text>

      {myDrafts.length > 0 ? (
        <>
          <SectionHeader title="WAITING FOR REVIEW" />
          {myDrafts.map((receipt) => (
            <Row
              key={receipt.id}
              left={
                <View style={styles.recentIcon}>
                  <Ionicons name="document-text-outline" size={22} color={colors.muted} />
                </View>
              }
              title={receipt.merchant || 'Untitled receipt'}
              subtitle={`${receipt.ocr_status.replace('_', ' ').toUpperCase()} · ${timeAgo(receipt.created_at)}`}
              right={<Label>REVIEW</Label>}
              onPress={() => openReceipt(nav, receipt, userId)}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg, marginTop: spacing.sm },
  viewfinder: {
    alignItems: 'center',
    backgroundColor: '#111111',
    height: 300,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  preview: { height: '100%', width: '100%' },
  corner: { borderColor: colors.inverse, height: 36, position: 'absolute', width: 36 },
  cornerTopLeft: { borderLeftWidth: 3, borderTopWidth: 3, left: spacing.lg, top: spacing.lg },
  cornerTopRight: { borderRightWidth: 3, borderTopWidth: 3, right: spacing.lg, top: spacing.lg },
  cornerBottomLeft: { borderBottomWidth: 3, borderLeftWidth: 3, bottom: spacing.lg, left: spacing.lg },
  cornerBottomRight: { borderBottomWidth: 3, borderRightWidth: 3, bottom: spacing.lg, right: spacing.lg },
  processing: {
    alignItems: 'center',
    backgroundColor: colors.inverse,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
  },
  processingText: { color: colors.ink, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  captureButtons: { gap: spacing.sm, marginBottom: spacing.md },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  recentIcon: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
