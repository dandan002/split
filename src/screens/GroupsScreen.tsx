import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner, Button, EmptyState, ErrorState, Label, LoadingState, Money, Row, Screen, TextField } from '../components/ui';
import { isIsoDate } from '../core/receipt.mjs';
import { createGroup, listGroups } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { formatDateRange } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useNavigation } from '../navigation';
import { colors, spacing, type } from '../theme';

export function GroupsScreen() {
  const nav = useNavigation();
  const groups = useAsync(listGroups, []);

  const active = (groups.data ?? []).filter((group) => !group.archived_at);
  const archived = (groups.data ?? []).filter((group) => group.archived_at);

  return (
    <Screen
      title="Split"
      right={
        <Pressable accessibilityLabel="Create group" hitSlop={12} onPress={() => nav.push({ name: 'createGroup' })}>
          <Ionicons name="add" size={30} color={colors.ink} />
        </Pressable>
      }
      refreshing={groups.refreshing}
      onRefresh={groups.refresh}
    >
      <View style={styles.overview}>
        <Label>OVERVIEW</Label>
        <View style={styles.spaceBetween}>
          <Text style={type.headline}>Trip Groups</Text>
          {groups.data ? <Text style={styles.count}>{`${String(active.length).padStart(2, '0')} ACTIVE`}</Text> : null}
        </View>
      </View>

      {groups.loading && !groups.data ? <LoadingState label="Loading groups" /> : null}
      {groups.error ? <ErrorState message={groups.error} onRetry={groups.reload} /> : null}

      {groups.data && groups.data.length === 0 ? (
        <EmptyState
          title="No trips yet"
          body="Create a group for your trip, add your travel companions, then scan receipts to split them."
          action={<Button label="Create trip group" onPress={() => nav.push({ name: 'createGroup' })} />}
        />
      ) : null}

      {active.map((group) => (
        <Row
          key={group.id}
          testID={`group-${group.name}`}
          title={group.name}
          subtitle={`${formatDateRange(group.starts_on, group.ends_on)} · ${group.member_count} ${group.member_count === 1 ? 'PERSON' : 'PEOPLE'}`}
          onPress={() => nav.push({ name: 'group', groupId: group.id })}
          right={<BalanceBadge netCents={group.my_net_cents} />}
        />
      ))}

      {groups.data && groups.data.length > 0 ? (
        <Pressable style={styles.dashedButton} onPress={() => nav.push({ name: 'createGroup' })}>
          <Ionicons name="add" size={26} color={colors.muted} />
          <Label>CREATE NEW TRIP GROUP</Label>
        </Pressable>
      ) : null}

      {archived.length > 0 ? (
        <>
          <Label style={styles.archivedLabel}>ARCHIVED</Label>
          {archived.map((group) => (
            <Row
              key={group.id}
              title={group.name}
              subtitle={formatDateRange(group.starts_on, group.ends_on)}
              onPress={() => nav.push({ name: 'group', groupId: group.id })}
              right={<BalanceBadge netCents={group.my_net_cents} />}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

export function BalanceBadge({ netCents }: { netCents: number }) {
  if (netCents === 0) {
    return <Text style={styles.statusText}>SETTLED</Text>;
  }
  return (
    <>
      <Money cents={Math.abs(netCents)} />
      <Text style={netCents > 0 ? styles.statusText : styles.statusPill}>{netCents > 0 ? 'OWED TO YOU' : 'YOU OWE'}</Text>
    </>
  );
}

export function CreateGroupScreen() {
  const nav = useNavigation();
  const [name, setName] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startValid = startsOn === '' || isIsoDate(startsOn);
  const endValid = endsOn === '' || isIsoDate(endsOn);
  const orderValid = !startsOn || !endsOn || !startValid || !endValid || endsOn >= startsOn;
  const canSave = name.trim().length > 0 && startValid && endValid && orderValid && !busy;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(name.trim(), startsOn || null, endsOn || null);
      nav.replace({ name: 'group', groupId: group.id });
    } catch (caught) {
      setError(friendlyError(caught));
      setBusy(false);
    }
  };

  return (
    <Screen title="New Group" footer={<Button label="Create group" onPress={save} disabled={!canSave} loading={busy} testID="create-group-submit" />}>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <View style={styles.form}>
        <TextField
          label="TRIP NAME"
          placeholder="Iceland Trip"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          maxLength={80}
          testID="group-name"
        />
        <TextField
          label="STARTS (YYYY-MM-DD, OPTIONAL)"
          placeholder="2026-06-12"
          value={startsOn}
          onChangeText={setStartsOn}
          error={startValid ? null : 'Use YYYY-MM-DD.'}
          testID="group-start"
        />
        <TextField
          label="ENDS (YYYY-MM-DD, OPTIONAL)"
          placeholder="2026-06-20"
          value={endsOn}
          onChangeText={setEndsOn}
          error={!endValid ? 'Use YYYY-MM-DD.' : !orderValid ? 'End date is before the start date.' : null}
          testID="group-end"
        />
        <Text style={[type.body, styles.muted]}>You’ll be the group owner. Add members from the group page.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overview: { gap: spacing.xs, marginBottom: spacing.lg },
  spaceBetween: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  count: { color: colors.ink, fontSize: 14, fontVariant: ['tabular-nums'], fontWeight: '900' },
  statusPill: {
    backgroundColor: colors.ink,
    color: colors.inverse,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginTop: spacing.xs },
  dashedButton: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 80,
  },
  archivedLabel: { marginTop: spacing.xl },
  form: { gap: spacing.lg },
  muted: { color: colors.muted },
});
