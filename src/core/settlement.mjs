// Suggests the fewest practical transfers that settle a group's balances.
// balances: [{ memberId, netCents }] where positive = owed money, negative = owes.
// Returns [{ fromMemberId, toMemberId, amountCents }]. Deterministic: ties are
// broken by the input order.
export function suggestTransfers(balances) {
  const total = balances.reduce((sum, balance) => sum + balance.netCents, 0);
  if (total !== 0) {
    throw new Error(`Balances must net to zero (got ${total}).`);
  }

  const order = new Map(balances.map((balance, index) => [balance.memberId, index]));
  const creditors = balances
    .filter((balance) => balance.netCents > 0)
    .map((balance) => ({ memberId: balance.memberId, remaining: balance.netCents }));
  const debtors = balances
    .filter((balance) => balance.netCents < 0)
    .map((balance) => ({ memberId: balance.memberId, remaining: -balance.netCents }));

  const byLargest = (a, b) => b.remaining - a.remaining || order.get(a.memberId) - order.get(b.memberId);
  const transfers = [];

  while (creditors.length && debtors.length) {
    creditors.sort(byLargest);
    debtors.sort(byLargest);

    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.remaining, debtor.remaining);

    transfers.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amountCents: amount });

    creditor.remaining -= amount;
    debtor.remaining -= amount;

    if (creditor.remaining === 0) {
      creditors.shift();
    }
    if (debtor.remaining === 0) {
      debtors.shift();
    }
  }

  return transfers;
}

// What the given member should do: transfers they owe and transfers owed to them.
export function transfersFor(memberId, transfers) {
  return {
    pay: transfers.filter((transfer) => transfer.fromMemberId === memberId),
    receive: transfers.filter((transfer) => transfer.toMemberId === memberId),
  };
}
