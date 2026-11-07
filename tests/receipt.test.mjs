import test from 'node:test';
import assert from 'node:assert/strict';

import { canSaveReceipt, parseCents, formatCentsInput, dollars } from '../src/core/allocation.mjs';
import {
  draftFromRecognition,
  draftFromRows,
  moveItem,
  toggleMember,
  toSavePayload,
  validateDraft,
} from '../src/core/receipt.mjs';
import { suggestTransfers } from '../src/core/settlement.mjs';

const members = [
  { id: 'ana', name: 'Ana' },
  { id: 'bo', name: 'Bo' },
  { id: 'cam', name: 'Cam' },
];

test('parseCents accepts well-formed money and rejects malformed input', () => {
  assert.equal(parseCents('12'), 1200);
  assert.equal(parseCents('12.5'), 1250);
  assert.equal(parseCents('$1,204.99'), 120499);
  assert.equal(parseCents('-3.10'), -310);
  assert.equal(parseCents('.75'), 75);
  assert.equal(parseCents('0'), 0);
  assert.equal(parseCents('-0'), 0);
  assert.equal(parseCents(''), null);
  assert.equal(parseCents('abc'), null);
  assert.equal(parseCents('1.234'), null);
  assert.equal(parseCents('1.2.3'), null);
  assert.equal(parseCents('--1'), null);
  assert.equal(parseCents(undefined), null);
  assert.equal(formatCentsInput(-310), '-3.10');
  assert.equal(formatCentsInput(5), '0.05');
  assert.equal(dollars(Number.NaN), '--');
});

test('canSaveReceipt rejects unknown members, malformed amounts, bad weights, and unassigned custom adjustments', () => {
  const base = {
    members,
    items: [{ id: 'a', name: 'A', amountCents: 1000, allocations: [{ memberId: 'ana', weight: 1 }] }],
    adjustments: [],
    receiptTotalCents: 1000,
  };

  assert.equal(canSaveReceipt(base).ok, true);

  assert.ok(
    canSaveReceipt({
      ...base,
      items: [{ ...base.items[0], allocations: [{ memberId: 'stranger', weight: 1 }] }],
    }).reasons.includes('unknown_members'),
  );

  assert.ok(
    canSaveReceipt({ ...base, items: [{ ...base.items[0], amountCents: Number.NaN }] }).reasons.includes(
      'invalid_item_amounts',
    ),
  );

  assert.ok(
    canSaveReceipt({
      ...base,
      items: [{ ...base.items[0], allocations: [{ memberId: 'ana', weight: -2 }] }],
    }).reasons.includes('invalid_weights'),
  );

  assert.ok(
    canSaveReceipt({
      ...base,
      adjustments: [{ id: 'fee', label: 'Fee', amountCents: 100, strategy: 'custom', allocations: [] }],
      receiptTotalCents: 1100,
    }).reasons.includes('unassigned_adjustments'),
  );

  assert.ok(canSaveReceipt({ ...base, items: [] , receiptTotalCents: 0 }).reasons.includes('no_items'));
});

test('negative adjustments larger than a member total are blocked', () => {
  const result = canSaveReceipt({
    members,
    items: [
      { id: 'a', name: 'A', amountCents: 500, allocations: [{ memberId: 'ana', weight: 1 }] },
      { id: 'b', name: 'B', amountCents: 5000, allocations: [{ memberId: 'bo', weight: 1 }] },
    ],
    adjustments: [{ id: 'credit', label: 'Credit', amountCents: -1000, strategy: 'equal' }],
    receiptTotalCents: 4500,
  });

  // Ana's $5 item is fully offset by her half of the $10 credit.
  assert.deepEqual(result.result.memberTotals, { bo: 4500 });
  assert.deepEqual(result.reasons, []);

  const custom = canSaveReceipt({
    members,
    items: [{ id: 'a', name: 'A', amountCents: 500, allocations: [{ memberId: 'ana', weight: 1 }] }],
    adjustments: [
      {
        id: 'credit',
        label: 'Credit',
        amountCents: -800,
        strategy: 'custom',
        allocations: [{ memberId: 'ana', weight: 1 }],
      },
      { id: 'fee', label: 'Fee', amountCents: 800, strategy: 'custom', allocations: [{ memberId: 'bo', weight: 1 }] },
    ],
    receiptTotalCents: 500,
  });

  assert.ok(custom.reasons.includes('negative_member_total'));
});

test('custom weighted allocations split by weight with deterministic rounding', () => {
  const result = canSaveReceipt({
    members,
    items: [
      {
        id: 'room',
        name: 'Room',
        amountCents: 10000,
        allocations: [
          { memberId: 'ana', weight: 2 },
          { memberId: 'bo', weight: 1 },
        ],
      },
    ],
    adjustments: [],
    receiptTotalCents: 10000,
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.result.memberTotals, { ana: 6667, bo: 3333 });
});

test('draftFromRecognition coerces untrusted OCR output into a safe draft', () => {
  const draft = draftFromRecognition(
    {
      status: 'needs_review',
      receipt: {
        merchant: '  Blue Hill  ',
        date: '2026-02-30',
        currencyCode: 'eur',
        subtotalCents: '9000',
        totalCents: 9800,
        confidence: 4,
        fieldConfidence: { merchant: 0.99, total: 0.5 },
        items: [
          { name: 'Wine', quantity: 1, totalAmountCents: 3000, confidence: 0.7 },
          { name: '', quantity: -1, totalAmountCents: -5 },
          'garbage',
        ],
        adjustments: [
          { label: 'Tax', kind: 'tax', amountCents: 900 },
          { label: 'Promo', kind: 'discount', amountCents: 100 },
          { label: 'Mystery', kind: 'bribe', amountCents: 1 },
        ],
      },
    },
    { receiptId: 'r1', imagePath: 'g/u/r.jpg', paidBy: 'ana' },
  );

  assert.equal(draft.merchant, 'Blue Hill');
  assert.match(draft.receiptDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(draft.receiptDate, '2026-02-30');
  assert.equal(draft.currencyCode, 'EUR');
  assert.equal(draft.subtotalCents, 9000);
  assert.equal(draft.confidence, 1);
  assert.equal(draft.items.length, 2);
  assert.equal(draft.items[1].name, 'Item');
  assert.equal(draft.items[1].quantity, 1);
  assert.equal(draft.items[1].amountCents, 0);
  assert.deepEqual(
    draft.adjustments.map((adjustment) => [adjustment.kind, adjustment.amountCents]),
    [
      ['tax', 900],
      ['discount', -100],
      ['other', 1],
    ],
  );
  assert.deepEqual(draft.lowConfidenceFields, ['total']);
  assert.equal(draft.paidBy, 'ana');
});

test('validateDraft reports draft-level issues and toSavePayload produces balanced shares', () => {
  const draft = draftFromRecognition({
    receipt: {
      merchant: 'Cafe',
      date: '2026-06-14',
      totalCents: 3300,
      items: [
        { name: 'Coffee', totalAmountCents: 1000 },
        { name: 'Cake', totalAmountCents: 2000 },
      ],
      adjustments: [{ label: 'Tax', kind: 'tax', amountCents: 300 }],
    },
  });

  const initial = validateDraft(draft, members);
  assert.equal(initial.ok, false);
  assert.deepEqual(
    initial.issues.map((issue) => issue.code),
    ['unassigned_items', 'payer_required'],
  );
  assert.equal(initial.unassignedItemKeys.length, 2);
  assert.throws(() => toSavePayload(draft, members), /Assign every item/);

  draft.paidBy = 'cam';
  draft.items[0].allocations = toggleMember([], 'ana');
  draft.items[1].allocations = toggleMember(toggleMember([], 'ana'), 'bo');

  const payload = toSavePayload(draft, members);
  assert.equal(payload.totalCents, 3300);
  assert.equal(payload.subtotalCents, 3000);
  assert.equal(payload.paidBy, 'cam');
  assert.deepEqual(payload.items[1].allocations, [
    { profileId: 'ana', weight: 1 },
    { profileId: 'bo', weight: 1 },
  ]);
  assert.equal(
    payload.shares.reduce((sum, share) => sum + share.owesCents, 0),
    3300,
  );
  assert.deepEqual(payload.shares, [
    { profileId: 'ana', owesCents: 2200 },
    { profileId: 'bo', owesCents: 1100 },
  ]);
});

test('draftFromRows rebuilds a saved receipt in position order', () => {
  const draft = draftFromRows({
    receipt: { id: 'r', merchant: 'Cafe', receipt_date: '2026-06-14', currency_code: 'USD', total_cents: 1500, subtotal_cents: 1500, ocr_confidence: '0.900' },
    expense: { paid_by: 'bo' },
    items: [
      { id: 'i2', name: 'Cake', quantity: '1.000', total_amount_cents: 500, position: 1 },
      { id: 'i1', name: 'Coffee', quantity: '2.000', total_amount_cents: 1000, position: 0 },
    ],
    adjustments: [],
    allocations: [
      { receipt_item_id: 'i1', profile_id: 'ana', weight: '1.0000', amount_cents: null },
      { receipt_item_id: 'i2', profile_id: 'bo', weight: null, amount_cents: 500 },
    ],
  });

  assert.deepEqual(draft.items.map((item) => item.name), ['Coffee', 'Cake']);
  assert.equal(draft.items[0].quantity, 2);
  assert.deepEqual(draft.items[0].allocations, [{ memberId: 'ana', weight: 1 }]);
  assert.deepEqual(draft.items[1].allocations, [{ memberId: 'bo', amountCents: 500 }]);
  assert.equal(draft.paidBy, 'bo');
  assert.equal(draft.confidence, 0.9);
  assert.equal(validateDraft(draft, members).ok, true);
});

test('moveItem reorders within bounds', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, -2), ['c', 'a', 'b']);
});

test('suggestTransfers settles balances with minimal greedy transfers', () => {
  assert.deepEqual(
    suggestTransfers([
      { memberId: 'ana', netCents: 6533 },
      { memberId: 'bo', netCents: -3267 },
      { memberId: 'cam', netCents: -3266 },
    ]),
    [
      { fromMemberId: 'bo', toMemberId: 'ana', amountCents: 3267 },
      { fromMemberId: 'cam', toMemberId: 'ana', amountCents: 3266 },
    ],
  );

  assert.deepEqual(
    suggestTransfers([
      { memberId: 'a', netCents: 1000 },
      { memberId: 'b', netCents: 500 },
      { memberId: 'c', netCents: -1500 },
      { memberId: 'd', netCents: 0 },
    ]),
    [
      { fromMemberId: 'c', toMemberId: 'a', amountCents: 1000 },
      { fromMemberId: 'c', toMemberId: 'b', amountCents: 500 },
    ],
  );

  assert.deepEqual(suggestTransfers([{ memberId: 'a', netCents: 0 }]), []);
  assert.throws(() => suggestTransfers([{ memberId: 'a', netCents: 1 }]), /net to zero/);
});
