export type Member = {
  id: string;
  name: string;
};

export type AllocationInput = {
  memberId: string;
  weight?: number;
  amountCents?: number;
};

export type ReceiptItemInput = {
  id: string;
  name: string;
  amountCents: number;
  allocations: AllocationInput[];
  quantity?: number;
  confidence?: number;
};

export type ReceiptAdjustmentInput = {
  id: string;
  label: string;
  amountCents: number;
  strategy: 'proportional' | 'equal' | 'custom';
  allocations?: AllocationInput[];
};

export type ReceiptInput = {
  members: Member[];
  items: ReceiptItemInput[];
  adjustments: ReceiptAdjustmentInput[];
  receiptTotalCents: number;
};

export function cents(value: string | number): number;
export function parseCents(value: unknown): number | null;
export function formatCentsInput(amountCents: number): string;
export function dollars(amountCents: number): string;
export function allocateReceipt(receipt: ReceiptInput): {
  memberTotals: Record<string, number>;
  itemShares: Array<{ itemId: string; memberId: string; amountCents: number }>;
  adjustmentShares: Array<{ adjustmentId: string; memberId: string; amountCents: number }>;
  allocatedTotalCents: number;
  receiptTotalCents: number;
  remainingCents: number;
};
export function canSaveReceipt(receipt: ReceiptInput): {
  ok: boolean;
  reasons: string[];
  result: ReturnType<typeof allocateReceipt>;
};
