export function cents(value) {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  const parsed = parseCents(value);
  return parsed === null ? Number.NaN : parsed;
}

// Parses user-entered money ("12", "12.5", "$1,204.99", "-3.10") into integer
// cents. Returns null for anything that is not a well-formed amount, including
// more than two decimal places.
export function parseCents(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/[$,\s]/g, '');
  const match = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(trimmed);

  if (!match || (match[2] === '' && !match[3])) {
    return null;
  }

  const sign = match[1] ? -1 : 1;
  const whole = Number.parseInt(match[2] || '0', 10);
  const fraction = Number.parseInt(`${match[3] ?? ''}00`.slice(0, 2), 10);
  const result = sign * (whole * 100 + fraction);

  return Number.isSafeInteger(result) ? result || 0 : null;
}

// Formats cents for an editable text field ("12.50", "-3.00").
export function formatCentsInput(amountCents) {
  if (!Number.isInteger(amountCents)) {
    return '';
  }

  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export function dollars(amountCents) {
  if (!Number.isFinite(amountCents)) {
    return '--';
  }

  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  return `${sign}$${Math.floor(absolute / 100).toLocaleString('en-US')}.${String(absolute % 100).padStart(2, '0')}`;
}

export function canSaveReceipt(receipt) {
  const reasons = [];
  const result = allocateReceipt(receipt);
  const memberIds = new Set(receipt.members.map((member) => member.id));
  const adjustments = receipt.adjustments ?? [];
  const allAllocations = [
    ...receipt.items.flatMap((item) => item.allocations ?? []),
    ...adjustments.flatMap((adjustment) => adjustment.allocations ?? []),
  ];

  const hasUnassignedItems = receipt.items.some((item) => !item.allocations || item.allocations.length === 0);
  const hasInvalidTotal = !Number.isInteger(receipt.receiptTotalCents) || receipt.receiptTotalCents < 0;
  const checks = [
    ['no_items', receipt.items.length === 0],
    ['unassigned_items', hasUnassignedItems],
    ['invalid_item_amounts', receipt.items.some((item) => !Number.isInteger(item.amountCents) || item.amountCents < 0)],
    ['invalid_adjustment_amounts', adjustments.some((adjustment) => !Number.isInteger(adjustment.amountCents))],
    [
      'unassigned_adjustments',
      adjustments.some(
        (adjustment) => adjustment.strategy === 'custom' && (!adjustment.allocations || adjustment.allocations.length === 0),
      ),
    ],
    ['unknown_members', allAllocations.some((allocation) => !memberIds.has(allocation.memberId))],
    [
      'invalid_weights',
      allAllocations.some((allocation) => {
        const weight = allocation.weight ?? allocation.amountCents ?? 1;
        return !Number.isFinite(weight) || weight < 0;
      }),
    ],
    ['invalid_total', hasInvalidTotal],
    ['negative_member_total', Object.values(result.memberTotals).some((total) => total < 0)],
    ['receipt_total_mismatch', !hasUnassignedItems && !hasInvalidTotal && result.remainingCents !== 0],
  ];

  for (const [reason, failed] of checks) {
    if (failed) {
      reasons.push(reason);
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    result,
  };
}

export function allocateReceipt(receipt) {
  const memberIds = receipt.members.map((member) => member.id);
  const memberTotals = {};
  const itemShares = [];

  for (const item of receipt.items) {
    const allocations = normalizeAllocations(item.allocations);
    const shares = splitAmount(item.amountCents, allocations, memberIds);

    for (const share of shares) {
      addCents(memberTotals, share.memberId, share.amountCents);
      itemShares.push({
        itemId: item.id,
        memberId: share.memberId,
        amountCents: share.amountCents,
      });
    }
  }

  const itemSubtotalByMember = { ...memberTotals };
  const adjustmentShares = [];

  for (const adjustment of receipt.adjustments ?? []) {
    const shares = splitAdjustment(adjustment, itemSubtotalByMember, memberIds);

    for (const share of shares) {
      addCents(memberTotals, share.memberId, share.amountCents);
      adjustmentShares.push({
        adjustmentId: adjustment.id,
        memberId: share.memberId,
        amountCents: share.amountCents,
      });
    }
  }

  pruneZeroTotals(memberTotals);

  const allocatedTotalCents = Object.values(memberTotals).reduce((sum, amount) => sum + amount, 0);
  const receiptTotalCents = receipt.receiptTotalCents ?? allocatedTotalCents;

  return {
    memberTotals,
    itemShares,
    adjustmentShares,
    allocatedTotalCents,
    receiptTotalCents,
    remainingCents: receiptTotalCents - allocatedTotalCents,
  };
}

function splitAdjustment(adjustment, itemSubtotalByMember, memberIds) {
  const activeMemberIds = memberIds.filter((memberId) => (itemSubtotalByMember[memberId] ?? 0) !== 0);

  if (adjustment.strategy === 'equal') {
    return splitAmount(
      adjustment.amountCents,
      activeMemberIds.map((memberId) => ({ memberId, weight: 1 })),
      memberIds,
    );
  }

  if (adjustment.strategy === 'custom') {
    return splitAmount(adjustment.amountCents, normalizeAllocations(adjustment.allocations), memberIds);
  }

  return splitAmount(
    adjustment.amountCents,
    activeMemberIds.map((memberId) => ({
      memberId,
      weight: Math.abs(itemSubtotalByMember[memberId] ?? 0),
    })),
    memberIds,
  );
}

function normalizeAllocations(allocations = []) {
  return allocations
    .filter((allocation) => allocation.memberId && allocation.weight !== 0)
    .map((allocation) => ({
      memberId: allocation.memberId,
      weight: allocation.weight ?? allocation.amountCents ?? 1,
    }));
}

function splitAmount(amountCents, allocations, memberOrder) {
  if (!allocations.length || amountCents === 0) {
    return [];
  }

  const totalWeight = allocations.reduce((sum, allocation) => sum + Math.abs(allocation.weight), 0);

  if (totalWeight === 0) {
    return [];
  }

  const sign = amountCents < 0 ? -1 : 1;
  const absoluteAmount = Math.abs(amountCents);
  const baseShares = allocations.map((allocation) => {
    const exact = (absoluteAmount * Math.abs(allocation.weight)) / totalWeight;
    const floor = Math.floor(exact);

    return {
      memberId: allocation.memberId,
      amountCents: floor,
      remainder: exact - floor,
      order: memberOrder.indexOf(allocation.memberId),
    };
  });

  let remaining = absoluteAmount - baseShares.reduce((sum, share) => sum + share.amountCents, 0);
  const rankedShares = [...baseShares].sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }

    return a.order - b.order;
  });

  for (const share of rankedShares) {
    if (remaining === 0) {
      break;
    }

    share.amountCents += 1;
    remaining -= 1;
  }

  return baseShares.map((share) => ({
    memberId: share.memberId,
    amountCents: sign * share.amountCents,
  }));
}

function addCents(totals, memberId, amountCents) {
  totals[memberId] = (totals[memberId] ?? 0) + amountCents;
}

function pruneZeroTotals(totals) {
  for (const [memberId, total] of Object.entries(totals)) {
    if (total === 0) {
      delete totals[memberId];
    }
  }
}
