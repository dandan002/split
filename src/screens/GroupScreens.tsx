import { useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Banner,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Label,
  LoadingState,
  Money,
  MoneyInput,
  Row,
  Screen,
  SectionHeader,
  TextField,
} from '../components/ui';
import { dollars } from '../core/allocation.mjs';
import { suggestTransfers } from '../core/settlement.mjs';
import {
  addMember,
  getBalances,
  getGroup,
  getSettlement,
  listExpenses,
  listOpenReceipts,
  listSettlements,
  recordSettlement,
  removeMember,
  type MemberBalance,
} from '../lib/api';
import { useCurrentUser } from '../lib/auth';
import { friendlyError } from '../lib/errors';
import { formatDate, formatDateRange, shortName, timeAgo } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useNavigation } from '../navigation';
import { colors, spacing, type } from '../theme';
import { openReceipt } from './ScanScreen';

function confirm(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    if (globalThis.confirm?.(`${title}\n\n${message}`) ?? true) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

async function loadGroup(groupId: string) {
  const [group, balances, expenses, settlements, receipts] = await Promise.all([
    getGroup(groupId),
    getBalances(groupId),
    listExpenses(groupId),
    listSettlements(groupId),
    listOpenReceipts(groupId),
  ]);
  return { group, balances, expenses, settlements, receipts };
}

export function GroupDetailScreen({ groupId }: { groupId: string }) {
  const nav = useNavigation();
  const { userId } = useCurrentUser();
  const state = useAsync(() => loadGroup(groupId), [groupId]);
  const data = state.data;

  const names = useMemo(
    () => Object.fromEntries((data?.balances ?? []).map((balance) => [balance.profile_id, balance.display_name])),
    [data?.balances],
  );

  const transfers = useMemo(() => {
    if (!data) return [];
    try {
      return suggestTransfers(data.balances.map((balance) => ({ memberId: balance.profile_id, netCents: balance.net_cents })));
    } catch {
      return [];
    }
  }, [data]);

  if (!data) {
    return (
      <Screen title="Group">
        {state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const { group, balances, expenses, settlements, receipts } = data;
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.total_cents, 0);
  const me = balances.find((balance) => balance.profile_id === userId);
  const myReceipts = receipts.filter((receipt) => receipt.uploaded_by === userId);

  return (
    <Screen title={group.name} refreshing={state.refreshing} onRefresh={state.refresh}>
      <Label>{formatDateRange(group.starts_on, group.ends_on)}</Label>

      <View style={styles.summary}>
        <View>
          <Label>TOTAL SPENT</Label>
          <Text style={styles.bigMoney}>{dollars(totalSpent)}</Text>
        </View>
        <View style={styles.alignEnd}>
          <Label>{!me || me.net_cents === 0 ? 'YOU ARE' : me.net_cents > 0 ? 'YOU ARE OWED' : 'YOU OWE'}</Label>
          <Text style={styles.bigMoney}>{!me || me.net_cents === 0 ? 'Settled' : dollars(Math.abs(me.net_cents))}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Scan receipt" icon="scan-outline" style={styles.flex} onPress={() => nav.switchTab('scan', { name: 'scan', groupId })} testID="group-scan" />
        <Button
          label="Settle up"
          variant="secondary"
          style={styles.flex}
          onPress={() => nav.push({ name: 'settle', groupId })}
          disabled={balances.length < 2}
          testID="group-settle"
        />
      </View>

      {myReceipts.length > 0 ? (
        <>
          <SectionHeader title="NEEDS REVIEW" />
          {myReceipts.map((receipt) => (
            <Row
              key={receipt.id}
              title={receipt.merchant || 'Untitled receipt'}
              subtitle={`${receipt.ocr_status.replace('_', ' ').toUpperCase()} · ${timeAgo(receipt.created_at)}`}
              right={<Label>REVIEW</Label>}
              onPress={() => openReceipt(nav, receipt, userId)}
            />
          ))}
        </>
      ) : null}

      <SectionHeader
        title={`MEMBERS (${balances.length})`}
        right={<Button variant="text" label="Manage" onPress={() => nav.push({ name: 'members', groupId })} testID="group-members" />}
      />
      {balances.map((balance) => (
        <Row
          key={balance.profile_id}
          left={<Avatar name={balance.display_name} uri={balance.avatar_url} />}
          title={balance.profile_id === userId ? `${balance.display_name} (you)` : balance.display_name}
          subtitle={`PAID ${dollars(balance.paid_cents)} · SHARE ${dollars(balance.owed_cents)}`}
          right={<BalanceAmount cents={balance.net_cents} />}
        />
      ))}
      {balances.length < 2 ? (
        <Banner>Add the people you’re traveling with so you can split receipts.</Banner>
      ) : null}

      {transfers.length > 0 ? (
        <>
          <SectionHeader title="SUGGESTED SETTLEMENTS" />
          {transfers.map((transfer) => (
            <Row
              key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
              title={`${shortName(names[transfer.fromMemberId] ?? '?')} → ${shortName(names[transfer.toMemberId] ?? '?')}`}
              subtitle="TAP TO RECORD PAYMENT"
              right={<Money cents={transfer.amountCents} />}
              onPress={() =>
                nav.push({
                  name: 'settle',
                  groupId,
                  fromId: transfer.fromMemberId,
                  toId: transfer.toMemberId,
                  amountCents: transfer.amountCents,
                })
              }
            />
          ))}
        </>
      ) : null}

      <SectionHeader title="EXPENSES" right={expenses.length ? `${expenses.length}` : undefined} />
      {expenses.length === 0 ? (
        <EmptyState title="No expenses yet" body="Scan a receipt or enter one manually to start the ledger." />
      ) : (
        expenses.map((expense) => (
          <Row
            key={expense.id}
            testID={`expense-${expense.merchant}`}
            title={expense.merchant}
            subtitle={`${formatDate(expense.occurred_on)} · PAID BY ${(names[expense.paid_by] ?? 'former member').toUpperCase()}`}
            right={<Money cents={expense.total_cents} />}
            onPress={() => nav.push({ name: 'expense', expenseId: expense.id })}
          />
        ))
      )}

      {settlements.length > 0 ? (
        <>
          <SectionHeader title="SETTLEMENT HISTORY" />
          {settlements.map((settlement) => (
            <Row
              key={settlement.id}
              title={`${shortName(names[settlement.from_profile_id] ?? '?')} paid ${shortName(names[settlement.to_profile_id] ?? '?')}`}
              subtitle={`${formatDate(settlement.settled_on)}${settlement.note ? ` · ${settlement.note.toUpperCase()}` : ''}`}
              right={<Money cents={settlement.amount_cents} />}
              onPress={() => nav.push({ name: 'settlement', settlementId: settlement.id })}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function BalanceAmount({ cents }: { cents: number }) {
  if (cents === 0) {
    return <Label>SETTLED</Label>;
  }
  return (
    <>
      <Money cents={Math.abs(cents)} />
      <Label>{cents > 0 ? 'IS OWED' : 'OWES'}</Label>
    </>
  );
}

export function MembersScreen({ groupId }: { groupId: string }) {
  const nav = useNavigation();
  const { userId } = useCurrentUser();
  const balances = useAsync(() => getBalances(groupId), [groupId]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const me = balances.data?.find((balance) => balance.profile_id === userId);
  const isOwner = me?.role === 'owner';

  const add = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const profile = await addMember(groupId, email.trim());
      setNotice(`${profile.display_name} was added.`);
      setEmail('');
      await balances.refresh();
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = (member: MemberBalance) => {
    const leaving = member.profile_id === userId;
    confirm(
      leaving ? 'Leave group?' : `Remove ${member.display_name}?`,
      leaving ? 'You’ll lose access to this group.' : 'They’ll lose access to this group.',
      async () => {
        setError(null);
        try {
          await removeMember(groupId, member.profile_id);
          if (leaving) {
            nav.switchTab('groups');
          } else {
            await balances.refresh();
          }
        } catch (caught) {
          setError(friendlyError(caught));
        }
      },
    );
  };

  return (
    <Screen title="Members" refreshing={balances.refreshing} onRefresh={balances.refresh}>
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner>{notice}</Banner> : null}

      {isOwner ? (
        <View style={styles.addForm}>
          <TextField
            label="ADD BY EMAIL"
            placeholder="friend@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            style={styles.flex}
            testID="member-email"
          />
          <Button
            label="Add"
            onPress={add}
            loading={busy}
            disabled={!/^\S+@\S+\.\S+$/.test(email.trim())}
            testID="member-add"
          />
        </View>
      ) : (
        <Banner>Only the group owner can add members.</Banner>
      )}
      <Text style={[type.body, styles.muted, styles.hint]}>
        People need a Split account before you can add them. Members with expenses or settlements can’t be removed.
      </Text>

      {balances.loading && !balances.data ? <LoadingState /> : null}
      {balances.error ? <ErrorState message={balances.error} onRetry={balances.reload} /> : null}

      {(balances.data ?? []).map((member) => {
        const canRemove = isOwner || member.profile_id === userId;
        return (
          <Row
            key={member.profile_id}
            left={<Avatar name={member.display_name} uri={member.avatar_url} />}
            title={member.profile_id === userId ? `${member.display_name} (you)` : member.display_name}
            subtitle={member.role.toUpperCase()}
            right={
              canRemove ? (
                <Button
                  variant="text"
                  label={member.profile_id === userId ? 'Leave' : 'Remove'}
                  onPress={() => remove(member)}
                />
              ) : null
            }
          />
        );
      })}
    </Screen>
  );
}

export function SettleScreen({
  groupId,
  fromId,
  toId,
  amountCents,
}: {
  groupId: string;
  fromId?: string;
  toId?: string;
  amountCents?: number;
}) {
  const nav = useNavigation();
  const { userId } = useCurrentUser();
  const balances = useAsync(() => getBalances(groupId), [groupId]);
  const [from, setFrom] = useState<string | undefined>(fromId ?? userId);
  const [to, setTo] = useState<string | undefined>(toId);
  const [amount, setAmount] = useState<number>(amountCents ?? 0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = balances.data ?? [];
  const valid = Boolean(from && to && from !== to && Number.isInteger(amount) && amount > 0);

  const save = async () => {
    if (!from || !to) return;
    setBusy(true);
    setError(null);
    try {
      await recordSettlement(groupId, from, to, amount, note);
      nav.back();
    } catch (caught) {
      setError(friendlyError(caught));
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Settle Up"
      footer={<Button label="Record payment" onPress={save} disabled={!valid} loading={busy} testID="settle-submit" />}
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      {balances.loading && !balances.data ? <LoadingState /> : null}
      {balances.error ? <ErrorState message={balances.error} onRetry={balances.reload} /> : null}

      {balances.data ? (
        <View style={styles.form}>
          <View>
            <Label>WHO PAID</Label>
            <View style={styles.chips}>
              {members.map((member) => (
                <Chip
                  key={member.profile_id}
                  label={shortName(member.display_name)}
                  selected={from === member.profile_id}
                  onPress={() => setFrom(member.profile_id)}
                />
              ))}
            </View>
          </View>
          <View>
            <Label>WHO RECEIVED IT</Label>
            <View style={styles.chips}>
              {members.map((member) => (
                <Chip
                  key={member.profile_id}
                  label={shortName(member.display_name)}
                  selected={to === member.profile_id}
                  disabled={member.profile_id === from}
                  onPress={() => setTo(member.profile_id)}
                />
              ))}
            </View>
          </View>
          <MoneyInput label="AMOUNT" value={amount} onChange={setAmount} testID="settle-amount" />
          <TextField label="NOTE (OPTIONAL)" placeholder="Venmo, cash…" value={note} onChangeText={setNote} maxLength={120} />
          <Text style={[type.body, styles.muted]}>
            Split records payments made outside the app. It doesn’t move money.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

export function SettlementDetailScreen({ settlementId }: { settlementId: string }) {
  const nav = useNavigation();
  const state = useAsync(async () => {
    const settlement = await getSettlement(settlementId);
    const balances = await getBalances(settlement.group_id);
    const group = await getGroup(settlement.group_id);
    return { settlement, balances, group };
  }, [settlementId]);

  if (!state.data) {
    return (
      <Screen title="Payment">
        {state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const { settlement, balances, group } = state.data;
  const name = (id: string) => balances.find((balance) => balance.profile_id === id)?.display_name ?? 'Former member';

  return (
    <Screen title="Payment">
      <Label>{group.name.toUpperCase()}</Label>
      <Text style={[styles.bigMoney, styles.spaced]}>{dollars(settlement.amount_cents)}</Text>
      <Row title={name(settlement.from_profile_id)} subtitle="PAID" />
      <Row title={name(settlement.to_profile_id)} subtitle="RECEIVED" />
      <Row title={formatDate(settlement.settled_on)} subtitle="DATE" />
      {settlement.note ? <Row title={settlement.note} subtitle="NOTE" /> : null}
      <Button
        variant="secondary"
        label="Open group"
        style={styles.spaced}
        onPress={() => nav.push({ name: 'group', groupId: group.id })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  muted: { color: colors.muted },
  summary: {
    backgroundColor: colors.subtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  bigMoney: { color: colors.ink, fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900', marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  addForm: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  hint: { marginBottom: spacing.md, marginTop: spacing.md },
  form: { gap: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  spaced: { marginBottom: spacing.lg, marginTop: spacing.md },
});
