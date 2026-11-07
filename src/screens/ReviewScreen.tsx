import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Banner,
  Button,
  CheckTag,
  Chip,
  ErrorState,
  Label,
  LoadingState,
  MoneyInput,
  Screen,
  SectionHeader,
  TextField,
} from '../components/ui';
import type { AllocationInput, Member } from '../core/allocation.mjs';
import { dollars } from '../core/allocation.mjs';
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_STRATEGIES,
  LOW_CONFIDENCE,
  adjustmentsTotal,
  assignEveryone,
  itemsSubtotal,
  kindLabel,
  moveItem,
  newKey,
  setMemberWeight,
  toSavePayload,
  toggleMember,
  validateDraft,
  type AdjustmentKind,
  type DraftAdjustment,
  type DraftItem,
  type ReceiptDraft,
} from '../core/receipt.mjs';
import { deleteReceipt, getBalances, getReceiptImageUrl, membersFromBalances, saveReceipt } from '../lib/api';
import { friendlyError } from '../lib/errors';
import { shortName } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useNavigation } from '../navigation';
import { colors, spacing, type } from '../theme';

export function ReviewReceiptScreen({ groupId, draft: initialDraft }: { groupId: string; draft: ReceiptDraft }) {
  const nav = useNavigation();
  const balances = useAsync(() => getBalances(groupId), [groupId]);
  const members = useMemo(() => membersFromBalances(balances.data ?? []), [balances.data]);
  const [draft, setDraft] = useState<ReceiptDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (draft.imagePath) {
      void getReceiptImageUrl(draft.imagePath).then(setImageUrl);
    }
  }, [draft.imagePath]);

  const validation = useMemo(() => validateDraft(draft, members), [draft, members]);
  const { memberTotals, remainingCents } = validation.result;
  const computedTotal = itemsSubtotal(draft) + adjustmentsTotal(draft);

  const update = (patch: Partial<ReceiptDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const updateItem = (key: string, patch: Partial<DraftItem>, edited = true) =>
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.key === key ? { ...item, ...patch, edited: item.edited || edited } : item)),
    }));

  const updateAdjustment = (key: string, patch: Partial<DraftAdjustment>) =>
    setDraft((current) => ({
      ...current,
      adjustments: current.adjustments.map((adjustment) => (adjustment.key === key ? { ...adjustment, ...patch } : adjustment)),
    }));

  const addItem = () =>
    setDraft((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          key: newKey('item'),
          name: '',
          quantity: 1,
          amountCents: 0,
          confidence: null,
          edited: true,
          allocations: [],
        },
      ],
    }));

  const addAdjustment = (kind: AdjustmentKind) =>
    setDraft((current) => ({
      ...current,
      adjustments: [
        ...current.adjustments,
        { key: newKey('adj'), label: kindLabel(kind), kind, amountCents: 0, strategy: 'proportional', allocations: [] },
      ],
    }));

  const save = async () => {
    if (!draft.receiptId) {
      setSaveError('This receipt has no draft record. Start again from the Scan tab.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const expenseId = await saveReceipt(draft.receiptId, toSavePayload(draft, members));
      nav.replace({ name: 'expense', expenseId });
    } catch (caught) {
      setSaveError(friendlyError(caught));
      setSaving(false);
    }
  };

  const discard = async () => {
    if (draft.receiptId) {
      try {
        await deleteReceipt(draft.receiptId);
      } catch {
        // A leftover draft only shows up in the review list.
      }
    }
    nav.back();
  };

  if (!balances.data) {
    return (
      <Screen title="Review Receipt">
        {balances.error ? <ErrorState message={balances.error} onRetry={balances.reload} /> : <LoadingState />}
      </Screen>
    );
  }

  const flagged = new Set(draft.lowConfidenceFields);
  const firstIssue = validation.issues[0];

  return (
    <Screen
      title="Review Receipt"
      right={<Button variant="text" label="Discard" onPress={discard} />}
      footer={
        <View style={styles.saveBar}>
          <View style={styles.flex}>
            <Label numberOfLines={2}>{validation.ok ? 'BALANCED' : firstIssue?.message.toUpperCase()}</Label>
            <Text style={styles.monoStrong}>Remaining {dollars(remainingCents)}</Text>
          </View>
          <Button label="Save split" onPress={save} disabled={!validation.ok} loading={saving} testID="review-save" />
        </View>
      }
    >
      {saveError ? <Banner tone="error">{saveError}</Banner> : null}
      {draft.lowConfidenceFields.length > 0 || draft.items.some((item) => (item.confidence ?? 1) < LOW_CONFIDENCE) ? (
        <Banner tone="warning">Fields marked CHECK were hard to read. Compare them with the receipt.</Banner>
      ) : null}

      {imageUrl ? (
        <Pressable onPress={() => setShowImage((value) => !value)} style={styles.imageToggle}>
          <Ionicons name="image-outline" size={18} color={colors.ink} />
          <Label>{showImage ? 'HIDE RECEIPT PHOTO' : 'SHOW RECEIPT PHOTO'}</Label>
        </Pressable>
      ) : null}
      {showImage && imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" /> : null}

      <View style={styles.summaryGrid}>
        <TextField
          label="MERCHANT"
          placeholder="Where was this?"
          value={draft.merchant}
          onChangeText={(merchant) => update({ merchant })}
          autoCapitalize="words"
          flagged={flagged.has('merchant')}
          testID="review-merchant"
        />
        <View style={styles.twoColumn}>
          <TextField
            label="DATE"
            placeholder="YYYY-MM-DD"
            value={draft.receiptDate}
            onChangeText={(receiptDate) => update({ receiptDate })}
            flagged={flagged.has('date')}
            style={styles.flex}
          />
          <TextField
            label="CURRENCY"
            value={draft.currencyCode}
            onChangeText={(currencyCode) => update({ currencyCode: currencyCode.toUpperCase().slice(0, 3) })}
            autoCapitalize="characters"
            style={styles.currency}
          />
        </View>
        <MoneyInput
          label="RECEIPT TOTAL"
          value={draft.totalCents}
          onChange={(totalCents) => update({ totalCents })}
          flagged={flagged.has('total')}
          inputStyle={styles.totalInput}
          testID="review-total"
        />
      </View>

      <Label style={styles.paidByLabel}>PAID BY</Label>
      <View style={styles.chips}>
        {members.map((member) => (
          <Chip
            key={member.id}
            label={shortName(member.name)}
            selected={draft.paidBy === member.id}
            onPress={() => update({ paidBy: member.id })}
          />
        ))}
      </View>

      <SectionHeader title={`ITEMS (${draft.items.length})`} right="TAP NAMES TO ASSIGN" />
      {draft.items.map((item, index) => (
        <ItemEditor
          key={item.key}
          item={item}
          members={members}
          unassigned={validation.unassignedItemKeys.includes(item.key)}
          isFirst={index === 0}
          isLast={index === draft.items.length - 1}
          onChange={(patch, edited) => updateItem(item.key, patch, edited)}
          onMove={(delta) => setDraft((current) => ({ ...current, items: moveItem(current.items, index, delta) }))}
          onDelete={() => setDraft((current) => ({ ...current, items: current.items.filter((candidate) => candidate.key !== item.key) }))}
        />
      ))}
      <Button label="Add item" icon="add" variant="secondary" onPress={addItem} style={styles.addButton} testID="review-add-item" />

      <SectionHeader title="TAX / TIP / FEES / DISCOUNTS" />
      {draft.adjustments.map((adjustment, index) => (
        <AdjustmentEditor
          key={adjustment.key}
          adjustment={adjustment}
          members={members}
          onChange={(patch) => updateAdjustment(adjustment.key, patch)}
          onMove={(delta) =>
            setDraft((current) => ({ ...current, adjustments: moveItem(current.adjustments, index, delta) }))
          }
          onDelete={() =>
            setDraft((current) => ({
              ...current,
              adjustments: current.adjustments.filter((candidate) => candidate.key !== adjustment.key),
            }))
          }
        />
      ))}
      <View style={styles.chips}>
        {(['tax', 'tip', 'service_fee', 'discount', 'credit', 'other'] as AdjustmentKind[]).map((kind) => (
          <Chip key={kind} label={`+ ${kindLabel(kind)}`} onPress={() => addAdjustment(kind)} testID={`review-add-${kind}`} />
        ))}
      </View>

      <View style={styles.reconcile}>
        <ReconcileRow label="Items" cents={itemsSubtotal(draft)} />
        <ReconcileRow label="Tax, tip & adjustments" cents={adjustmentsTotal(draft)} />
        <ReconcileRow label="Calculated total" cents={computedTotal} strong />
        <ReconcileRow label="Receipt total" cents={Number.isNaN(draft.totalCents) ? 0 : draft.totalCents} />
        {computedTotal !== draft.totalCents && computedTotal >= 0 ? (
          <Button
            variant="text"
            label={`Use calculated total ${dollars(computedTotal)}`}
            onPress={() => update({ totalCents: computedTotal })}
          />
        ) : null}
      </View>

      <View style={styles.memberTotals}>
        <Text style={type.title}>Member Totals</Text>
        {members.map((member) => (
          <View key={member.id} style={styles.totalRow}>
            <Text style={type.body}>{member.name}</Text>
            <Text style={styles.monoStrong}>{dollars(memberTotals[member.id] ?? 0)}</Text>
          </View>
        ))}
      </View>

      {validation.issues.length > 0 ? (
        <View style={styles.issues}>
          <Label>BEFORE YOU SAVE</Label>
          {validation.issues.map((issue) => (
            <Text key={issue.code} style={type.body}>
              • {issue.message}
            </Text>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function ReconcileRow({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[type.body, strong && styles.bold]}>{label}</Text>
      <Text style={styles.monoStrong}>{dollars(cents)}</Text>
    </View>
  );
}

function MemberPicker({
  members,
  allocations,
  onChange,
  showWeights,
}: {
  members: Member[];
  allocations: AllocationInput[];
  onChange: (allocations: AllocationInput[]) => void;
  showWeights: boolean;
}) {
  const selected = new Set(allocations.map((allocation) => allocation.memberId));
  const everyone = members.length > 0 && members.every((member) => selected.has(member.id));

  return (
    <View>
      <View style={styles.chips}>
        <Chip label="EVERYONE" selected={everyone} onPress={() => onChange(everyone ? [] : assignEveryone(members))} />
        {members.map((member) => (
          <Chip
            key={member.id}
            label={shortName(member.name)}
            selected={selected.has(member.id)}
            onPress={() => onChange(toggleMember(allocations, member.id))}
          />
        ))}
      </View>
      {showWeights && allocations.length > 0 ? (
        <View style={styles.weights}>
          {allocations.map((allocation) => (
            <WeightInput
              key={allocation.memberId}
              name={members.find((member) => member.id === allocation.memberId)?.name ?? '?'}
              weight={allocation.weight ?? 1}
              onChange={(weight) => onChange(setMemberWeight(allocations, allocation.memberId, weight))}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function WeightInput({ name, weight, onChange }: { name: string; weight: number; onChange: (weight: number) => void }) {
  const [text, setText] = useState(String(weight));
  return (
    <View style={styles.weightCell}>
      <Label>{shortName(name)}</Label>
      <TextInput
        accessibilityLabel={`${name} share weight`}
        inputMode="decimal"
        keyboardType="decimal-pad"
        value={text}
        onChangeText={(next) => {
          setText(next);
          const parsed = Number(next);
          onChange(next.trim() === '' || !Number.isFinite(parsed) ? Number.NaN : parsed);
        }}
        style={[styles.weightInput, !(Number.isFinite(weight) && weight > 0) && styles.inputInvalid]}
      />
    </View>
  );
}

function RowControls({
  onMove,
  onDelete,
  isFirst,
  isLast,
}: {
  onMove: (delta: number) => void;
  onDelete: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  return (
    <View style={styles.rowControls}>
      <Pressable accessibilityLabel="Move up" disabled={isFirst} hitSlop={8} onPress={() => onMove(-1)}>
        <Ionicons name="chevron-up" size={20} color={isFirst ? colors.line : colors.ink} />
      </Pressable>
      <Pressable accessibilityLabel="Move down" disabled={isLast} hitSlop={8} onPress={() => onMove(1)}>
        <Ionicons name="chevron-down" size={20} color={isLast ? colors.line : colors.ink} />
      </Pressable>
      <Pressable accessibilityLabel="Delete" hitSlop={8} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color={colors.ink} />
      </Pressable>
    </View>
  );
}

function ItemEditor({
  item,
  members,
  unassigned,
  isFirst,
  isLast,
  onChange,
  onMove,
  onDelete,
}: {
  item: DraftItem;
  members: Member[];
  unassigned: boolean;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<DraftItem>, edited?: boolean) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const hasCustomWeights = item.allocations.some((allocation) => (allocation.weight ?? 1) !== 1);
  const [showWeights, setShowWeights] = useState(hasCustomWeights);
  const lowConfidence = (item.confidence ?? 1) < LOW_CONFIDENCE && !item.edited;

  return (
    <View style={[styles.editorCard, unassigned && styles.editorUnassigned]} testID={`item-${item.name || 'new'}`}>
      <View style={styles.editorTop}>
        <View style={styles.flex}>
          <View style={styles.nameLine}>
            <TextInput
              accessibilityLabel="Item name"
              placeholder="Item name"
              placeholderTextColor={colors.muted}
              value={item.name}
              onChangeText={(name) => onChange({ name })}
              style={[type.title, styles.nameInput]}
            />
            {lowConfidence ? <CheckTag /> : null}
          </View>
          <View style={styles.qtyLine}>
            <Label>QTY</Label>
            <TextInput
              accessibilityLabel="Quantity"
              inputMode="decimal"
              keyboardType="decimal-pad"
              defaultValue={String(item.quantity)}
              onChangeText={(text) => {
                const quantity = Number(text);
                if (Number.isFinite(quantity) && quantity > 0) onChange({ quantity });
              }}
              style={styles.qtyInput}
            />
          </View>
        </View>
        <MoneyInput value={item.amountCents} onChange={(amountCents) => onChange({ amountCents })} style={styles.amount} />
      </View>

      <MemberPicker
        members={members}
        allocations={item.allocations}
        onChange={(allocations) => onChange({ allocations }, false)}
        showWeights={showWeights}
      />

      <View style={styles.editorBottom}>
        <Pressable onPress={() => setShowWeights((value) => !value)} hitSlop={8}>
          <Label>{showWeights ? 'HIDE SHARES' : 'UNEVEN SHARES'}</Label>
        </Pressable>
        {unassigned ? <Label style={styles.warnText}>UNASSIGNED</Label> : null}
        <RowControls onMove={onMove} onDelete={onDelete} isFirst={isFirst} isLast={isLast} />
      </View>
    </View>
  );
}

function AdjustmentEditor({
  adjustment,
  members,
  onChange,
  onMove,
  onDelete,
}: {
  adjustment: DraftAdjustment;
  members: Member[];
  onChange: (patch: Partial<DraftAdjustment>) => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const isNegativeKind = adjustment.kind === 'discount' || adjustment.kind === 'credit';

  return (
    <View style={styles.editorCard}>
      <View style={styles.editorTop}>
        <TextInput
          accessibilityLabel="Adjustment label"
          value={adjustment.label}
          onChangeText={(label) => onChange({ label })}
          style={[type.title, styles.nameInput, styles.flex]}
        />
        <MoneyInput
          value={adjustment.amountCents}
          allowNegative
          onChange={(amountCents) =>
            onChange({ amountCents: isNegativeKind && amountCents > 0 ? -amountCents : amountCents })
          }
          style={styles.amount}
        />
      </View>

      <View style={styles.chips}>
        {ADJUSTMENT_KINDS.map((kind) => (
          <Chip
            key={kind}
            label={kindLabel(kind)}
            selected={adjustment.kind === kind}
            onPress={() => {
              const negative = kind === 'discount' || kind === 'credit';
              const amount = Number.isNaN(adjustment.amountCents) ? adjustment.amountCents : Math.abs(adjustment.amountCents);
              onChange({ kind, amountCents: negative ? -amount : amount });
            }}
          />
        ))}
      </View>

      <Label style={styles.strategyLabel}>SPLIT</Label>
      <View style={styles.chips}>
        {ADJUSTMENT_STRATEGIES.map((strategy) => (
          <Chip
            key={strategy}
            label={strategy === 'proportional' ? 'BY ITEMS' : strategy === 'equal' ? 'EVENLY' : 'CHOOSE'}
            selected={adjustment.strategy === strategy}
            onPress={() => onChange({ strategy })}
          />
        ))}
      </View>
      <Text style={[type.body, styles.muted, styles.strategyHint]}>
        {adjustment.strategy === 'proportional'
          ? 'Split in proportion to each person’s items.'
          : adjustment.strategy === 'equal'
            ? 'Split evenly between everyone with items.'
            : 'Split between the people you choose.'}
      </Text>
      {adjustment.strategy === 'custom' ? (
        <MemberPicker
          members={members}
          allocations={adjustment.allocations}
          onChange={(allocations) => onChange({ allocations })}
          showWeights={false}
        />
      ) : null}

      <View style={styles.editorBottom}>
        <View style={styles.flex} />
        <RowControls onMove={onMove} onDelete={onDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  muted: { color: colors.muted },
  monoStrong: { color: colors.ink, fontSize: 16, fontVariant: ['tabular-nums'], fontWeight: '900' },
  saveBar: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  imageToggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  image: { backgroundColor: colors.subtle, height: 420, marginBottom: spacing.md, width: '100%' },
  summaryGrid: { gap: spacing.md },
  twoColumn: { flexDirection: 'row', gap: spacing.md },
  currency: { width: 96 },
  totalInput: { fontSize: 28 },
  paidByLabel: { marginTop: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  addButton: { marginTop: spacing.md },
  editorCard: {
    borderBottomColor: colors.line,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  editorUnassigned: { borderLeftColor: colors.ink, borderLeftWidth: 3, paddingLeft: spacing.sm },
  editorTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  nameLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  nameInput: { color: colors.ink, flex: 1, minHeight: 36, minWidth: 0, paddingVertical: 0 },
  qtyLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  qtyInput: { color: colors.ink, fontSize: 14, minWidth: 40, paddingVertical: 2 },
  amount: { width: 120 },
  editorBottom: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', marginTop: spacing.sm },
  warnText: { color: colors.ink },
  rowControls: { flexDirection: 'row', gap: spacing.md },
  weights: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  weightCell: { width: 72 },
  weightInput: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    color: colors.ink,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    paddingVertical: 4,
  },
  inputInvalid: { borderBottomColor: colors.danger, borderBottomWidth: 2 },
  strategyLabel: { marginTop: spacing.sm },
  strategyHint: { fontSize: 14, marginTop: spacing.xs },
  reconcile: { gap: spacing.sm, marginTop: spacing.xl },
  memberTotals: { backgroundColor: colors.subtle, gap: spacing.md, marginTop: spacing.xl, padding: spacing.lg },
  totalRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  issues: { gap: spacing.xs, marginTop: spacing.lg },
});
