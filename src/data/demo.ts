import { cents } from '../core/allocation.mjs';

export const groups = [
  {
    id: 'iceland',
    name: 'Iceland Trip',
    dates: 'JUN 12 - JUN 20, 2024',
    balanceCents: cents('1420.50'),
    status: 'OWED',
  },
  {
    id: 'nyc',
    name: 'Weekend in NYC',
    dates: 'MAY 04 - MAY 06, 2024',
    balanceCents: cents('428.00'),
    status: 'SETTLED',
  },
  {
    id: 'tokyo',
    name: 'Tokyo Dining',
    dates: 'APR 15 - APR 22, 2024',
    balanceCents: cents('890.12'),
    status: 'OWED',
  },
  {
    id: 'skiing',
    name: 'Skiing 2024',
    dates: 'FEB 10 - FEB 17, 2024',
    balanceCents: cents('2105.00'),
    status: 'SETTLED',
  },
];

export const members = [
  { id: 'ana', name: 'Ana' },
  { id: 'bo', name: 'Bo' },
  { id: 'cam', name: 'Cam' },
  { id: 'dev', name: 'Dev' },
];

export const scannedReceipt = {
  merchant: 'Blue Hill',
  date: 'Today, 8:42 PM',
  items: [
    {
      id: 'oysters',
      name: 'Oysters',
      amountCents: cents('24.00'),
      allocations: [{ memberId: 'ana', weight: 1 }],
      confidence: 0.97,
    },
    {
      id: 'tagliatelle',
      name: 'Tagliatelle',
      amountCents: cents('32.00'),
      allocations: [
        { memberId: 'ana', weight: 1 },
        { memberId: 'bo', weight: 1 },
      ],
      confidence: 0.95,
    },
    {
      id: 'branzino',
      name: 'Branzino',
      amountCents: cents('38.00'),
      allocations: [{ memberId: 'cam', weight: 1 }],
      confidence: 0.88,
    },
    {
      id: 'nebbiolo',
      name: 'Nebbiolo',
      amountCents: cents('54.00'),
      allocations: [
        { memberId: 'ana', weight: 1 },
        { memberId: 'bo', weight: 1 },
        { memberId: 'cam', weight: 1 },
      ],
      confidence: 0.81,
    },
  ],
  adjustments: [
    { id: 'tax', label: 'Tax', amountCents: cents('13.32'), strategy: 'proportional' as const },
    { id: 'tip', label: 'Tip', amountCents: cents('29.60'), strategy: 'proportional' as const },
  ],
  receiptTotalCents: cents('190.92'),
};
