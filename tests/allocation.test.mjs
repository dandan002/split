import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allocateReceipt,
  canSaveReceipt,
  cents,
} from '../src/core/allocation.mjs';

const members = [
  { id: 'ana', name: 'Ana' },
  { id: 'bo', name: 'Bo' },
  { id: 'cam', name: 'Cam' },
];

test('allocates receipt items and proportional tax/tip to member totals', () => {
  const result = allocateReceipt({
    members,
    items: [
      {
        id: 'burger',
        name: 'Burger',
        amountCents: cents('18.00'),
        allocations: [{ memberId: 'ana', weight: 1 }],
      },
      {
        id: 'salad',
        name: 'Salad',
        amountCents: cents('12.00'),
        allocations: [{ memberId: 'bo', weight: 1 }],
      },
    ],
    adjustments: [
      { id: 'tax', label: 'Tax', amountCents: cents('2.70'), strategy: 'proportional' },
      { id: 'tip', label: 'Tip', amountCents: cents('6.00'), strategy: 'proportional' },
    ],
    receiptTotalCents: cents('38.70'),
  });

  assert.deepEqual(result.memberTotals, {
    ana: cents('23.22'),
    bo: cents('15.48'),
  });
  assert.equal(result.allocatedTotalCents, cents('38.70'));
  assert.equal(result.remainingCents, 0);
});

test('splits odd cents deterministically by largest remainder then member order', () => {
  const result = allocateReceipt({
    members,
    items: [
      {
        id: 'fries',
        name: 'Fries',
        amountCents: cents('10.00'),
        allocations: [
          { memberId: 'ana', weight: 1 },
          { memberId: 'bo', weight: 1 },
          { memberId: 'cam', weight: 1 },
        ],
      },
    ],
    adjustments: [],
    receiptTotalCents: cents('10.00'),
  });

  assert.deepEqual(result.memberTotals, {
    ana: cents('3.34'),
    bo: cents('3.33'),
    cam: cents('3.33'),
  });
  assert.equal(result.remainingCents, 0);
});

test('equal adjustment strategy allocates fees equally across members with item shares', () => {
  const result = allocateReceipt({
    members,
    items: [
      {
        id: 'ramen',
        name: 'Ramen',
        amountCents: cents('20.00'),
        allocations: [{ memberId: 'ana', weight: 1 }],
      },
      {
        id: 'tea',
        name: 'Tea',
        amountCents: cents('10.00'),
        allocations: [{ memberId: 'bo', weight: 1 }],
      },
    ],
    adjustments: [
      { id: 'fee', label: 'Service Fee', amountCents: cents('3.00'), strategy: 'equal' },
    ],
    receiptTotalCents: cents('33.00'),
  });

  assert.deepEqual(result.memberTotals, {
    ana: cents('21.50'),
    bo: cents('11.50'),
  });
});

test('save validation blocks unassigned items and unmatched receipt totals', () => {
  const unassigned = canSaveReceipt({
    members,
    items: [
      {
        id: 'pasta',
        name: 'Pasta',
        amountCents: cents('16.00'),
        allocations: [],
      },
    ],
    adjustments: [],
    receiptTotalCents: cents('16.00'),
  });

  const unmatched = canSaveReceipt({
    members,
    items: [
      {
        id: 'pasta',
        name: 'Pasta',
        amountCents: cents('16.00'),
        allocations: [{ memberId: 'ana', weight: 1 }],
      },
    ],
    adjustments: [],
    receiptTotalCents: cents('20.00'),
  });

  assert.equal(unassigned.ok, false);
  assert.deepEqual(unassigned.reasons, ['unassigned_items']);
  assert.equal(unmatched.ok, false);
  assert.deepEqual(unmatched.reasons, ['receipt_total_mismatch']);
});
