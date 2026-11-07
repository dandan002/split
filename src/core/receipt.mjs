// Receipt DTO boundary: explicit conversions between the OCR response, the
// editable review draft, the allocation engine input, the save RPC payload,
// and saved database rows. Framework-neutral so it can be unit tested in Node.

import { allocateReceipt, canSaveReceipt } from './allocation.mjs';

export const ADJUSTMENT_KINDS = ['tax', 'tip', 'service_fee', 'delivery_fee', 'discount', 'credit', 'other'];
export const ADJUSTMENT_STRATEGIES = ['proportional', 'equal', 'custom'];
export const LOW_CONFIDENCE = 0.9;

const KIND_LABELS = {
  tax: 'Tax',
  tip: 'Tip',
  service_fee: 'Service fee',
  delivery_fee: 'Delivery fee',
  discount: 'Discount',
  credit: 'Credit',
  other: 'Other',
};

const ISSUE_MESSAGES = {
  merchant_required: 'Add a merchant name.',
  payer_required: 'Choose who paid.',
  payer_not_member: 'The payer must be a group member.',
  no_items: 'Add at least one line item.',
  unassigned_items: 'Assign every item to at least one person.',
  invalid_item_amounts: 'Item amounts must be valid, non-negative numbers.',
  invalid_adjustment_amounts: 'Tax, tip and fee amounts must be valid numbers.',
  unassigned_adjustments: 'Choose who shares each custom-split adjustment.',
  unknown_members: 'Some assignments refer to people who are not in this group.',
  invalid_weights: 'Split weights must be positive numbers.',
  invalid_total: 'Enter a valid receipt total.',
  negative_member_total: 'Discounts leave someone with a negative total.',
  receipt_total_mismatch: 'Items and adjustments do not add up to the receipt total.',
  item_name_required: 'Every item needs a name.',
  invalid_date: 'Use a YYYY-MM-DD date.',
  invalid_currency: 'Use a 3-letter currency code.',
};

export function kindLabel(kind) {
  return KIND_LABELS[kind] ?? 'Other';
}

export function issueMessage(code) {
  return ISSUE_MESSAGES[code] ?? code.replaceAll('_', ' ');
}

let keyCounter = 0;

export function newKey(prefix = 'k') {
  keyCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${keyCounter.toString(36)}`;
}

function toInt(value, fallback = 0) {
  const number = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function toConfidence(value) {
  const number = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.min(1, Math.max(0, number));
}

function toText(value, max = 120) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, max);
}

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function emptyDraft({ paidBy = null, currencyCode = 'USD' } = {}) {
  return {
    receiptId: null,
    imagePath: null,
    merchant: '',
    receiptDate: todayIso(),
    currencyCode,
    subtotalCents: 0,
    totalCents: 0,
    confidence: null,
    paidBy,
    items: [],
    adjustments: [],
    lowConfidenceFields: [],
  };
}

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Converts the recognize-receipt function response into an editable draft.
// Every field is coerced defensively because OCR output is untrusted.
export function draftFromRecognition(response, { receiptId = null, imagePath = null, paidBy = null } = {}) {
  const receipt = response && typeof response === 'object' ? response.receipt ?? response : {};
  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const adjustments = Array.isArray(receipt.adjustments) ? receipt.adjustments : [];
  const fieldConfidence = receipt.fieldConfidence && typeof receipt.fieldConfidence === 'object' ? receipt.fieldConfidence : {};

  const draft = {
    receiptId,
    imagePath,
    merchant: toText(receipt.merchant),
    receiptDate: isIsoDate(receipt.date) ? receipt.date : todayIso(),
    currencyCode: /^[A-Za-z]{3}$/.test(receipt.currencyCode ?? '') ? receipt.currencyCode.toUpperCase() : 'USD',
    subtotalCents: Math.max(0, toInt(receipt.subtotalCents)),
    totalCents: Math.max(0, toInt(receipt.totalCents)),
    confidence: toConfidence(receipt.confidence),
    paidBy,
    items: items
      .filter((item) => item && typeof item === 'object')
      .slice(0, 200)
      .map((item) => ({
        key: newKey('item'),
        name: toText(item.name) || 'Item',
        quantity: Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1,
        amountCents: Math.max(0, toInt(item.totalAmountCents)),
        confidence: toConfidence(item.confidence),
        edited: false,
        allocations: [],
      })),
    adjustments: adjustments
      .filter((adjustment) => adjustment && typeof adjustment === 'object')
      .slice(0, 20)
      .map((adjustment) => {
        const kind = ADJUSTMENT_KINDS.includes(adjustment.kind) ? adjustment.kind : 'other';
        const amount = toInt(adjustment.amountCents);
        return {
          key: newKey('adj'),
          label: toText(adjustment.label, 60) || kindLabel(kind),
          kind,
          amountCents: kind === 'discount' || kind === 'credit' ? -Math.abs(amount) : amount,
          strategy: 'proportional',
          allocations: [],
        };
      }),
    lowConfidenceFields: [],
  };

  const low = [];
  for (const field of ['merchant', 'date', 'total', 'subtotal']) {
    const value = toConfidence(fieldConfidence[field]);
    if (value !== null && value < LOW_CONFIDENCE) {
      low.push(field);
    }
  }
  if (!draft.merchant) {
    low.push('merchant');
  }
  if (draft.totalCents === 0) {
    low.push('total');
  }
  draft.lowConfidenceFields = [...new Set(low)];

  return draft;
}

// Splits an item evenly across every member.
export function assignEveryone(members) {
  return members.map((member) => ({ memberId: member.id, weight: 1 }));
}

export function toggleMember(allocations, memberId) {
  const exists = allocations.some((allocation) => allocation.memberId === memberId);
  if (exists) {
    return allocations.filter((allocation) => allocation.memberId !== memberId);
  }
  return [...allocations, { memberId, weight: 1 }];
}

export function setMemberWeight(allocations, memberId, weight) {
  return allocations.map((allocation) => (allocation.memberId === memberId ? { memberId, weight } : allocation));
}

export function moveItem(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) {
    return list;
  }
  const copy = [...list];
  const [moved] = copy.splice(index, 1);
  copy.splice(target, 0, moved);
  return copy;
}

export function itemsSubtotal(draft) {
  return draft.items.reduce((sum, item) => sum + (Number.isInteger(item.amountCents) ? item.amountCents : 0), 0);
}

export function adjustmentsTotal(draft) {
  return draft.adjustments.reduce(
    (sum, adjustment) => sum + (Number.isInteger(adjustment.amountCents) ? adjustment.amountCents : 0),
    0,
  );
}

export function toAllocationInput(draft, members) {
  return {
    members: members.map((member) => ({ id: member.id, name: member.name })),
    items: draft.items.map((item) => ({
      id: item.key,
      name: item.name,
      amountCents: item.amountCents,
      quantity: item.quantity,
      confidence: item.confidence ?? undefined,
      allocations: item.allocations,
    })),
    adjustments: draft.adjustments.map((adjustment) => ({
      id: adjustment.key,
      label: adjustment.label,
      amountCents: adjustment.amountCents,
      strategy: adjustment.strategy,
      allocations: adjustment.strategy === 'custom' ? adjustment.allocations : undefined,
    })),
    receiptTotalCents: draft.totalCents,
  };
}

export function validateDraft(draft, members) {
  const base = canSaveReceipt(toAllocationInput(draft, members));
  const codes = [...base.reasons];
  const memberIds = new Set(members.map((member) => member.id));

  if (!draft.merchant || !draft.merchant.trim()) {
    codes.unshift('merchant_required');
  }
  if (!draft.paidBy) {
    codes.push('payer_required');
  } else if (!memberIds.has(draft.paidBy)) {
    codes.push('payer_not_member');
  }
  if (draft.items.some((item) => !item.name || !item.name.trim())) {
    codes.push('item_name_required');
  }
  if (!isIsoDate(draft.receiptDate)) {
    codes.push('invalid_date');
  }
  if (!/^[A-Z]{3}$/.test(draft.currencyCode ?? '')) {
    codes.push('invalid_currency');
  }

  const unassignedItemKeys = draft.items
    .filter((item) => !item.allocations || item.allocations.length === 0)
    .map((item) => item.key);

  return {
    ok: codes.length === 0,
    issues: codes.map((code) => ({ code, message: issueMessage(code) })),
    unassignedItemKeys,
    result: base.result,
  };
}

// Builds the JSON payload for the save_receipt RPC. Member totals are computed
// by the same allocation engine the review screen shows.
export function toSavePayload(draft, members) {
  const validation = validateDraft(draft, members);
  if (!validation.ok) {
    const error = new Error(validation.issues.map((issue) => issue.message).join(' '));
    error.issues = validation.issues;
    throw error;
  }

  const { memberTotals } = allocateReceipt(toAllocationInput(draft, members));

  return {
    merchant: draft.merchant.trim(),
    receiptDate: draft.receiptDate,
    currencyCode: draft.currencyCode,
    subtotalCents: itemsSubtotal(draft),
    totalCents: draft.totalCents,
    paidBy: draft.paidBy,
    confidence: draft.confidence,
    items: draft.items.map((item) => ({
      name: item.name.trim(),
      quantity: item.quantity,
      totalAmountCents: item.amountCents,
      confidence: item.confidence,
      wasManuallyEdited: Boolean(item.edited),
      allocations: item.allocations.map(allocationToRow),
    })),
    adjustments: draft.adjustments.map((adjustment) => ({
      label: adjustment.label.trim() || kindLabel(adjustment.kind),
      kind: adjustment.kind,
      amountCents: adjustment.amountCents,
      strategy: adjustment.strategy,
      allocations: adjustment.strategy === 'custom' ? adjustment.allocations.map(allocationToRow) : [],
    })),
    shares: Object.entries(memberTotals).map(([profileId, owesCents]) => ({ profileId, owesCents })),
  };
}

function allocationToRow(allocation) {
  const row = { profileId: allocation.memberId };
  if (allocation.amountCents !== undefined && allocation.weight === undefined) {
    row.amountCents = allocation.amountCents;
  } else {
    row.weight = allocation.weight ?? 1;
  }
  return row;
}

// Rebuilds a read-only draft from saved rows (receipts, receipt_items,
// receipt_adjustments, item_allocations) plus the expense payer.
export function draftFromRows({ receipt, expense, items = [], adjustments = [], allocations = [] }) {
  const allocationsFor = (column, id) =>
    allocations
      .filter((allocation) => allocation[column] === id)
      .map((allocation) => {
        const out = { memberId: allocation.profile_id };
        if (allocation.weight !== null && allocation.weight !== undefined) {
          out.weight = Number(allocation.weight);
        } else if (allocation.amount_cents !== null && allocation.amount_cents !== undefined) {
          out.amountCents = allocation.amount_cents;
        }
        return out;
      });

  return {
    receiptId: receipt?.id ?? null,
    imagePath: receipt?.image_path ?? null,
    merchant: receipt?.merchant ?? expense?.merchant ?? '',
    receiptDate: receipt?.receipt_date ?? expense?.occurred_on ?? todayIso(),
    currencyCode: receipt?.currency_code ?? expense?.currency_code ?? 'USD',
    subtotalCents: receipt?.subtotal_cents ?? 0,
    totalCents: receipt?.total_cents ?? expense?.total_cents ?? 0,
    confidence: receipt?.ocr_confidence === null || receipt?.ocr_confidence === undefined ? null : Number(receipt.ocr_confidence),
    paidBy: expense?.paid_by ?? null,
    items: [...items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        key: item.id,
        name: item.name,
        quantity: Number(item.quantity ?? 1),
        amountCents: item.total_amount_cents,
        confidence: item.ocr_confidence === null || item.ocr_confidence === undefined ? null : Number(item.ocr_confidence),
        edited: Boolean(item.was_manually_edited),
        allocations: allocationsFor('receipt_item_id', item.id),
      })),
    adjustments: [...adjustments]
      .sort((a, b) => a.position - b.position)
      .map((adjustment) => ({
        key: adjustment.id,
        label: adjustment.label,
        kind: adjustment.kind,
        amountCents: adjustment.amount_cents,
        strategy: adjustment.allocation_strategy,
        allocations: allocationsFor('receipt_adjustment_id', adjustment.id),
      })),
    lowConfidenceFields: [],
  };
}
