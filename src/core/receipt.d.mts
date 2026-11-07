import type { AllocationInput, Member, ReceiptInput, allocateReceipt } from './allocation.mjs';

export type AdjustmentKind = 'tax' | 'tip' | 'service_fee' | 'delivery_fee' | 'discount' | 'credit' | 'other';
export type AdjustmentStrategy = 'proportional' | 'equal' | 'custom';

export type DraftItem = {
  key: string;
  name: string;
  quantity: number;
  amountCents: number;
  confidence: number | null;
  edited: boolean;
  allocations: AllocationInput[];
};

export type DraftAdjustment = {
  key: string;
  label: string;
  kind: AdjustmentKind;
  amountCents: number;
  strategy: AdjustmentStrategy;
  allocations: AllocationInput[];
};

export type ReceiptDraft = {
  receiptId: string | null;
  imagePath: string | null;
  merchant: string;
  receiptDate: string;
  currencyCode: string;
  subtotalCents: number;
  totalCents: number;
  confidence: number | null;
  paidBy: string | null;
  items: DraftItem[];
  adjustments: DraftAdjustment[];
  lowConfidenceFields: string[];
};

export type ValidationIssue = { code: string; message: string };

export type DraftValidation = {
  ok: boolean;
  issues: ValidationIssue[];
  unassignedItemKeys: string[];
  result: ReturnType<typeof allocateReceipt>;
};

export type SavePayload = {
  merchant: string;
  receiptDate: string;
  currencyCode: string;
  subtotalCents: number;
  totalCents: number;
  paidBy: string;
  confidence: number | null;
  items: Array<{
    name: string;
    quantity: number;
    totalAmountCents: number;
    confidence: number | null;
    wasManuallyEdited: boolean;
    allocations: Array<{ profileId: string; weight?: number; amountCents?: number }>;
  }>;
  adjustments: Array<{
    label: string;
    kind: AdjustmentKind;
    amountCents: number;
    strategy: AdjustmentStrategy;
    allocations: Array<{ profileId: string; weight?: number; amountCents?: number }>;
  }>;
  shares: Array<{ profileId: string; owesCents: number }>;
};

export type SavedRows = {
  receipt?: Record<string, any> | null;
  expense?: Record<string, any> | null;
  items?: Array<Record<string, any>>;
  adjustments?: Array<Record<string, any>>;
  allocations?: Array<Record<string, any>>;
};

export const ADJUSTMENT_KINDS: AdjustmentKind[];
export const ADJUSTMENT_STRATEGIES: AdjustmentStrategy[];
export const LOW_CONFIDENCE: number;

export function kindLabel(kind: string): string;
export function issueMessage(code: string): string;
export function newKey(prefix?: string): string;
export function isIsoDate(value: unknown): boolean;
export function todayIso(now?: Date): string;
export function emptyDraft(options?: { paidBy?: string | null; currencyCode?: string }): ReceiptDraft;
export function draftFromRecognition(
  response: unknown,
  options?: { receiptId?: string | null; imagePath?: string | null; paidBy?: string | null },
): ReceiptDraft;
export function assignEveryone(members: Member[]): AllocationInput[];
export function toggleMember(allocations: AllocationInput[], memberId: string): AllocationInput[];
export function setMemberWeight(allocations: AllocationInput[], memberId: string, weight: number): AllocationInput[];
export function moveItem<T>(list: T[], index: number, delta: number): T[];
export function itemsSubtotal(draft: ReceiptDraft): number;
export function adjustmentsTotal(draft: ReceiptDraft): number;
export function toAllocationInput(draft: ReceiptDraft, members: Member[]): ReceiptInput;
export function validateDraft(draft: ReceiptDraft, members: Member[]): DraftValidation;
export function toSavePayload(draft: ReceiptDraft, members: Member[]): SavePayload;
export function draftFromRows(rows: SavedRows): ReceiptDraft;
