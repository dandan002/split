import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, ErrorState, Label, LoadingState, Money, Row, Screen, SectionHeader } from '../components/ui';
import { allocateReceipt, dollars } from '../core/allocation.mjs';
import { kindLabel, toAllocationInput } from '../core/receipt.mjs';
import { getBalances, getExpenseDetail, getReceiptImageUrl, membersFromBalances } from '../lib/api';
import { formatDate, shortName } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useNavigation } from '../navigation';
import { colors, spacing, type } from '../theme';

// Read-only view of a saved expense: the confirmed receipt, who had what, and
// each member's share as stored in the ledger.
export function ExpenseDetailScreen({ expenseId }: { expenseId: string }) {
  const nav = useNavigation();
  const state = useAsync(async () => {
    const detail = await getExpenseDetail(expenseId);
    const balances = await getBalances(detail.expense.group_id);
    return { ...detail, balances };
  }, [expenseId]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);

  const imagePath = state.data?.receipt?.image_path;
  useEffect(() => {
    if (imagePath) {
      void getReceiptImageUrl(imagePath).then(setImageUrl);
    }
  }, [imagePath]);

  const names = useMemo(
    () => Object.fromEntries((state.data?.balances ?? []).map((balance) => [balance.profile_id, balance.display_name])),
    [state.data?.balances],
  );

  // Per-item shares recomputed from the saved allocations, for display only.
  const itemShares = useMemo(() => {
    if (!state.data) return new Map<string, Array<{ memberId: string; amountCents: number }>>();
    const members = membersFromBalances(state.data.balances);
    const known = new Set(members.map((member) => member.id));
    for (const item of state.data.draft.items) {
      for (const allocation of item.allocations) {
        if (!known.has(allocation.memberId)) {
          members.push({ id: allocation.memberId, name: 'Former member' });
          known.add(allocation.memberId);
        }
      }
    }
    const result = allocateReceipt(toAllocationInput(state.data.draft, members));
    const map = new Map<string, Array<{ memberId: string; amountCents: number }>>();
    for (const share of result.itemShares) {
      map.set(share.itemId, [...(map.get(share.itemId) ?? []), share]);
    }
    return map;
  }, [state.data]);

  if (!state.data) {
    return (
      <Screen title="Expense">
        {state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const { expense, draft, shares } = state.data;
  const name = (id: string) => names[id] ?? 'Former member';

  return (
    <Screen title="Expense" refreshing={state.refreshing} onRefresh={state.refresh}>
      <View style={styles.summary}>
        <View style={styles.flex}>
          <Label>MERCHANT</Label>
          <Text style={type.headline}>{expense.merchant}</Text>
          <Text style={[type.body, styles.muted]}>
            {formatDate(expense.occurred_on)} · Paid by {name(expense.paid_by)}
          </Text>
        </View>
        <View style={styles.alignEnd}>
          <Label>TOTAL</Label>
          <Text style={styles.total}>{dollars(expense.total_cents)}</Text>
          {expense.currency_code !== 'USD' ? <Label>{expense.currency_code}</Label> : null}
        </View>
      </View>

      {imageUrl ? (
        <Pressable onPress={() => setShowImage((value) => !value)} style={styles.imageToggle}>
          <Label>{showImage ? 'HIDE RECEIPT PHOTO' : 'SHOW RECEIPT PHOTO'}</Label>
        </Pressable>
      ) : null}
      {showImage && imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" /> : null}

      <SectionHeader title="WHO OWES WHAT" />
      {shares
        .filter((share) => share.owes_cents > 0 || share.paid_cents > 0)
        .sort((a, b) => b.owes_cents - a.owes_cents)
        .map((share) => (
          <Row
            key={share.profile_id}
            left={<Avatar name={name(share.profile_id)} />}
            title={name(share.profile_id)}
            subtitle={share.paid_cents > 0 ? `PAID ${dollars(share.paid_cents)}` : undefined}
            right={<Money cents={share.owes_cents} />}
          />
        ))}

      {draft.items.length > 0 ? (
        <>
          <SectionHeader title={`ITEMS (${draft.items.length})`} />
          {draft.items.map((item) => (
            <Row
              key={item.key}
              title={item.quantity !== 1 ? `${item.name} ×${item.quantity}` : item.name}
              subtitle={(itemShares.get(item.key) ?? [])
                .map((share) => `${shortName(name(share.memberId))} ${dollars(share.amountCents)}`)
                .join(' · ')
                .toUpperCase()}
              right={<Money cents={item.amountCents} />}
            />
          ))}
        </>
      ) : null}

      {draft.adjustments.length > 0 ? (
        <>
          <SectionHeader title="TAX / TIP / FEES" />
          {draft.adjustments.map((adjustment) => (
            <Row
              key={adjustment.key}
              title={adjustment.label}
              subtitle={`${kindLabel(adjustment.kind)} · ${
                adjustment.strategy === 'proportional'
                  ? 'BY ITEMS'
                  : adjustment.strategy === 'equal'
                    ? 'EVENLY'
                    : adjustment.allocations.map((allocation) => shortName(name(allocation.memberId))).join(', ')
              }`.toUpperCase()}
              right={<Money cents={adjustment.amountCents} />}
            />
          ))}
        </>
      ) : null}

      <Text style={[type.body, styles.muted, styles.note]}>
        Saved expenses are read-only so balances stay consistent. Record a settlement to adjust who owes whom.
      </Text>
      <Button variant="secondary" label="Open group" onPress={() => nav.push({ name: 'group', groupId: expense.group_id })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  muted: { color: colors.muted },
  summary: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  total: { color: colors.ink, fontSize: 28, fontVariant: ['tabular-nums'], fontWeight: '900' },
  imageToggle: { marginTop: spacing.md },
  image: { backgroundColor: colors.subtle, height: 420, marginTop: spacing.md, width: '100%' },
  note: { marginBottom: spacing.md, marginTop: spacing.xl },
});
