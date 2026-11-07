import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Member } from '../core/allocation.mjs';
import type { ReceiptDraft, SavePayload, SavedRows } from '../core/receipt.mjs';
import { draftFromRecognition, draftFromRows } from '../core/receipt.mjs';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
};

export type GroupSummary = {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  archived_at: string | null;
  role: 'owner' | 'member';
  member_count: number;
  total_spent_cents: number;
  my_net_cents: number;
};

export type TripGroup = {
  id: string;
  name: string;
  starts_on: string | null;
  ends_on: string | null;
  created_by: string;
  created_at: string;
  archived_at: string | null;
};

export type MemberBalance = {
  profile_id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'owner' | 'member';
  paid_cents: number;
  owed_cents: number;
  settled_out_cents: number;
  settled_in_cents: number;
  net_cents: number;
};

export type Expense = {
  id: string;
  group_id: string;
  paid_by: string;
  merchant: string;
  occurred_on: string;
  currency_code: string;
  total_cents: number;
  subtotal_cents: number | null;
  created_by: string;
  created_at: string;
  receipt_id: string | null;
};

export type Settlement = {
  id: string;
  group_id: string;
  from_profile_id: string;
  to_profile_id: string;
  amount_cents: number;
  currency_code: string;
  note: string | null;
  settled_on: string;
  created_by: string;
  created_at: string;
};

export type ReceiptRow = {
  id: string;
  group_id: string;
  expense_id: string | null;
  uploaded_by: string;
  merchant: string | null;
  receipt_date: string | null;
  currency_code: string;
  subtotal_cents: number;
  total_cents: number;
  image_path: string | null;
  ocr_status: 'draft' | 'processing' | 'needs_review' | 'confirmed' | 'failed';
  ocr_confidence: number | null;
  raw_ocr: Record<string, unknown>;
  created_at: string;
};

export type ExpenseShare = {
  expense_id: string;
  profile_id: string;
  owes_cents: number;
  paid_cents: number;
};

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data as T;
}

const numberFields = <T extends Record<string, unknown>>(row: T, fields: Array<keyof T>): T => {
  const copy = { ...row };
  for (const field of fields) {
    if (copy[field] !== null && copy[field] !== undefined) {
      copy[field] = Number(copy[field]) as T[keyof T];
    }
  }
  return copy;
};

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getOrCreateProfile(userId: string, email: string | null): Promise<Profile> {
  const existing = unwrap(
    await supabase.from('profiles').select('id, display_name, avatar_url, email').eq('id', userId).maybeSingle(),
  ) as Profile | null;

  if (existing) {
    return existing;
  }

  // The sign-up trigger normally creates this; fall back for older accounts.
  const fallbackName = (email ?? 'traveler').split('@')[0] || 'Traveler';
  return unwrap(
    await supabase
      .from('profiles')
      .insert({ id: userId, display_name: fallbackName })
      .select('id, display_name, avatar_url, email')
      .single(),
  ) as Profile;
}

export async function updateDisplayName(userId: string, displayName: string): Promise<Profile> {
  return unwrap(
    await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', userId)
      .select('id, display_name, avatar_url, email')
      .single(),
  ) as Profile;
}

export async function uploadAvatar(userId: string, base64: string, mimeType: string): Promise<Profile> {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  unwrap(
    await supabase.storage.from('avatars').upload(path, base64ToArrayBuffer(base64), {
      contentType: mimeType,
      upsert: true,
    }),
  );
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return unwrap(
    await supabase
      .from('profiles')
      .update({ avatar_url: data.publicUrl })
      .eq('id', userId)
      .select('id, display_name, avatar_url, email')
      .single(),
  ) as Profile;
}

// ---------------------------------------------------------------------------
// Groups & members
// ---------------------------------------------------------------------------

export async function listGroups(): Promise<GroupSummary[]> {
  const rows = unwrap(await supabase.rpc('my_groups')) as GroupSummary[];
  return rows.map((row) => numberFields(row, ['member_count', 'total_spent_cents', 'my_net_cents']));
}

export async function createGroup(name: string, startsOn: string | null, endsOn: string | null): Promise<TripGroup> {
  return unwrap(
    await supabase.rpc('create_group', { p_name: name, p_starts_on: startsOn, p_ends_on: endsOn }),
  ) as TripGroup;
}

export async function getGroup(groupId: string): Promise<TripGroup> {
  const group = unwrap(await supabase.from('trip_groups').select('*').eq('id', groupId).maybeSingle()) as TripGroup | null;
  if (!group) {
    throw new Error('group_not_found');
  }
  return group;
}

export async function getBalances(groupId: string): Promise<MemberBalance[]> {
  const rows = unwrap(await supabase.rpc('group_balances', { p_group_id: groupId })) as MemberBalance[];
  return rows.map((row) =>
    numberFields(row, ['paid_cents', 'owed_cents', 'settled_out_cents', 'settled_in_cents', 'net_cents']),
  );
}

export function membersFromBalances(balances: MemberBalance[]): Member[] {
  return balances.map((balance) => ({ id: balance.profile_id, name: balance.display_name }));
}

export async function addMember(groupId: string, email: string): Promise<Profile> {
  return unwrap(await supabase.rpc('add_group_member', { p_group_id: groupId, p_email: email })) as Profile;
}

export async function removeMember(groupId: string, profileId: string): Promise<void> {
  unwrap(await supabase.rpc('remove_group_member', { p_group_id: groupId, p_profile_id: profileId }));
}

// ---------------------------------------------------------------------------
// Ledger reads
// ---------------------------------------------------------------------------

export async function listExpenses(groupId: string): Promise<Expense[]> {
  return unwrap(
    await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ) as Expense[];
}

export async function listSettlements(groupId: string): Promise<Settlement[]> {
  return unwrap(
    await supabase.from('settlements').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
  ) as Settlement[];
}

export async function listOpenReceipts(groupId?: string): Promise<ReceiptRow[]> {
  let query = supabase
    .from('receipts')
    .select('*')
    .in('ocr_status', ['draft', 'processing', 'needs_review', 'failed'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (groupId) {
    query = query.eq('group_id', groupId);
  }
  return unwrap(await query) as ReceiptRow[];
}

export type ExpenseDetail = {
  expense: Expense;
  receipt: ReceiptRow | null;
  shares: ExpenseShare[];
  draft: ReceiptDraft;
};

export async function getExpenseDetail(expenseId: string): Promise<ExpenseDetail> {
  const expense = unwrap(await supabase.from('expenses').select('*').eq('id', expenseId).maybeSingle()) as Expense | null;
  if (!expense) {
    throw new Error('Expense not found.');
  }

  const [receipt, shares] = await Promise.all([
    supabase.from('receipts').select('*').eq('expense_id', expenseId).maybeSingle(),
    supabase.from('expense_shares').select('*').eq('expense_id', expenseId),
  ]);
  const receiptRow = unwrap(receipt) as ReceiptRow | null;

  const rows: SavedRows = { receipt: receiptRow, expense, items: [], adjustments: [], allocations: [] };

  if (receiptRow) {
    const [items, adjustments] = await Promise.all([
      supabase.from('receipt_items').select('*').eq('receipt_id', receiptRow.id),
      supabase.from('receipt_adjustments').select('*').eq('receipt_id', receiptRow.id),
    ]);
    rows.items = unwrap(items) as SavedRows['items'];
    rows.adjustments = unwrap(adjustments) as SavedRows['adjustments'];

    const itemIds = (rows.items ?? []).map((item) => item.id as string);
    const adjustmentIds = (rows.adjustments ?? []).map((adjustment) => adjustment.id as string);
    const filters = [
      itemIds.length ? `receipt_item_id.in.(${itemIds.join(',')})` : null,
      adjustmentIds.length ? `receipt_adjustment_id.in.(${adjustmentIds.join(',')})` : null,
    ].filter(Boolean);

    if (filters.length) {
      rows.allocations = unwrap(await supabase.from('item_allocations').select('*').or(filters.join(','))) as SavedRows['allocations'];
    }
  }

  return {
    expense,
    receipt: receiptRow,
    shares: (unwrap(shares) as ExpenseShare[]).map((share) => numberFields(share, ['owes_cents', 'paid_cents'])),
    draft: draftFromRows(rows),
  };
}

export async function getReceiptImageUrl(imagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(imagePath, 60 * 10);
  return error ? null : data.signedUrl;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export type ActivityEntry =
  | { kind: 'expense'; id: string; groupId: string; groupName: string; at: string; expense: Expense }
  | { kind: 'settlement'; id: string; groupId: string; groupName: string; at: string; settlement: Settlement }
  | { kind: 'receipt'; id: string; groupId: string; groupName: string; at: string; receipt: ReceiptRow };

export type ActivityFeed = {
  entries: ActivityEntry[];
  names: Record<string, string>;
};

export async function getActivity(): Promise<ActivityFeed> {
  const groups = await listGroups();
  const groupNames = Object.fromEntries(groups.map((group) => [group.id, group.name]));

  if (groups.length === 0) {
    return { entries: [], names: {} };
  }

  const [expenses, settlements, receipts, profiles] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('settlements').select('*').order('created_at', { ascending: false }).limit(50),
    listOpenReceipts(),
    supabase.from('profiles').select('id, display_name'),
  ]);

  const names = Object.fromEntries(
    (unwrap(profiles) as Array<{ id: string; display_name: string }>).map((profile) => [profile.id, profile.display_name]),
  );

  const entries: ActivityEntry[] = [
    ...(unwrap(expenses) as Expense[]).map((expense) => ({
      kind: 'expense' as const,
      id: expense.id,
      groupId: expense.group_id,
      groupName: groupNames[expense.group_id] ?? 'Group',
      at: expense.created_at,
      expense,
    })),
    ...(unwrap(settlements) as Settlement[]).map((settlement) => ({
      kind: 'settlement' as const,
      id: settlement.id,
      groupId: settlement.group_id,
      groupName: groupNames[settlement.group_id] ?? 'Group',
      at: settlement.created_at,
      settlement,
    })),
    ...receipts.map((receipt) => ({
      kind: 'receipt' as const,
      id: receipt.id,
      groupId: receipt.group_id,
      groupName: groupNames[receipt.group_id] ?? 'Group',
      at: receipt.created_at,
      receipt,
    })),
  ];

  entries.sort((a, b) => b.at.localeCompare(a.at));
  return { entries, names };
}

export async function getSettlement(settlementId: string): Promise<Settlement> {
  const settlement = unwrap(
    await supabase.from('settlements').select('*').eq('id', settlementId).maybeSingle(),
  ) as Settlement | null;
  if (!settlement) {
    throw new Error('Settlement not found.');
  }
  return settlement;
}

// ---------------------------------------------------------------------------
// Receipts: capture, recognition, save
// ---------------------------------------------------------------------------

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function uploadReceiptImage(
  groupId: string,
  userId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `${groupId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  unwrap(
    await supabase.storage.from('receipts').upload(path, base64ToArrayBuffer(base64), {
      contentType: mimeType,
      upsert: false,
    }),
  );
  return path;
}

export async function createReceipt(groupId: string, userId: string, imagePath: string | null): Promise<ReceiptRow> {
  return unwrap(
    await supabase
      .from('receipts')
      .insert({
        group_id: groupId,
        uploaded_by: userId,
        image_path: imagePath,
        total_cents: 0,
        ocr_status: imagePath ? 'processing' : 'draft',
      })
      .select('*')
      .single(),
  ) as ReceiptRow;
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  unwrap(await supabase.from('receipts').delete().eq('id', receiptId));
}

export async function recognizeReceipt(receiptId: string, paidBy: string): Promise<ReceiptDraft> {
  const { data, error } = await supabase.functions.invoke('recognize-receipt', { body: { receiptId } });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      let code = 'recognition_failed';
      try {
        const body = await error.context.json();
        code = body?.error ?? code;
      } catch {
        // Response had no JSON body.
      }
      throw new Error(code);
    }
    throw error;
  }

  return draftFromRecognition(data, { receiptId, imagePath: data?.imagePath ?? null, paidBy });
}

export async function getReceipt(receiptId: string): Promise<ReceiptRow> {
  const receipt = unwrap(await supabase.from('receipts').select('*').eq('id', receiptId).maybeSingle()) as ReceiptRow | null;
  if (!receipt) {
    throw new Error('receipt_not_found');
  }
  return receipt;
}

// Rebuilds a review draft from a receipt that was recognized earlier.
export function draftFromReceiptRow(receipt: ReceiptRow, paidBy: string): ReceiptDraft {
  const raw = (receipt.raw_ocr ?? {}) as { receipt?: unknown };
  return draftFromRecognition(raw.receipt ? { receipt: raw.receipt } : {}, {
    receiptId: receipt.id,
    imagePath: receipt.image_path,
    paidBy,
  });
}

export async function saveReceipt(receiptId: string, payload: SavePayload): Promise<string> {
  return unwrap(await supabase.rpc('save_receipt', { p_receipt_id: receiptId, p_payload: payload })) as string;
}

// ---------------------------------------------------------------------------
// Settlements
// ---------------------------------------------------------------------------

export async function recordSettlement(
  groupId: string,
  fromId: string,
  toId: string,
  amountCents: number,
  note: string,
): Promise<Settlement> {
  return unwrap(
    await supabase.rpc('record_settlement', {
      p_group_id: groupId,
      p_from: fromId,
      p_to: toId,
      p_amount_cents: amountCents,
      p_note: note,
    }),
  ) as Settlement;
}
