export function cents(value) {
  if (typeof value === 'number') {
    return Math.round(value * 100);
  }

  const trimmed = String(value).trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const normalized = trimmed.replace(/^-/, '');
  const [whole = '0', fraction = ''] = normalized.split('.');
  const paddedFraction = `${fraction}00`.slice(0, 2);

  return sign * (Number.parseInt(whole, 10) * 100 + Number.parseInt(paddedFraction, 10));
}

export function dollars(amountCents) {
  const sign = amountCents < 0 ? '-' : '';
  const absolute = Math.abs(amountCents);
  return `${sign}$${Math.floor(absolute / 100).toLocaleString('en-US')}.${String(absolute % 100).padStart(2, '0')}`;
}

export function canSaveReceipt(receipt) {
  const reasons = [];
  const result = allocateReceipt(receipt);

  const hasUnassignedItems = receipt.items.some((item) => !item.allocations || item.allocations.length === 0);
  const hasInvalidAmounts = receipt.items.some((item) => !Number.isInteger(item.amountCents) || item.amountCents < 0);

  if (hasUnassignedItems) {
    reasons.push('unassigned_items');
  }

  if (hasInvalidAmounts) {
    reasons.push('invalid_item_amounts');
  }

  if (!hasUnassignedItems && result.remainingCents !== 0) {
    reasons.push('receipt_total_mismatch');
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
