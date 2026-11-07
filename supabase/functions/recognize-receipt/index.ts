// Receipt recognition edge function.
//
// POST { receiptId } with the caller's Supabase JWT. The function:
//   1. verifies the caller uploaded the receipt and the image lives under
//      {group_id}/{caller_id}/ in the private `receipts` bucket,
//   2. reads the image with the caller's own permissions (RLS + storage policy),
//   3. asks Claude to extract merchant, date, line items and tax/tip/fees,
//   4. stores the raw result on the receipt and marks it `needs_review`.
//
// The result is always a draft: the app requires a human review before the
// receipt becomes a ledger entry. Without ANTHROPIC_API_KEY the function
// returns an empty draft so the manual-entry flow still works.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

type AdjustmentKind = 'tax' | 'tip' | 'service_fee' | 'delivery_fee' | 'discount' | 'credit' | 'other';

type RecognizedReceipt = {
  merchant: string | null;
  date: string | null;
  currencyCode: string;
  subtotalCents: number;
  totalCents: number;
  confidence: number;
  fieldConfidence: { merchant: number; date: number; total: number; subtotal: number };
  items: Array<{ name: string; quantity: number; totalAmountCents: number; confidence: number }>;
  adjustments: Array<{ label: string; kind: AdjustmentKind; amountCents: number }>;
};

const MODEL = Deno.env.get('RECEIPT_MODEL') ?? 'claude-opus-5-5';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADJUSTMENT_KINDS: AdjustmentKind[] = ['tax', 'tip', 'service_fee', 'delivery_fee', 'discount', 'credit', 'other'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'merchant',
    'date',
    'currencyCode',
    'subtotalCents',
    'totalCents',
    'confidence',
    'fieldConfidence',
    'items',
    'adjustments',
  ],
  properties: {
    merchant: { type: 'string', description: 'Business name as printed. Empty string if unreadable.' },
    date: { type: 'string', description: 'Purchase date as YYYY-MM-DD. Empty string if not printed.' },
    currencyCode: { type: 'string', description: 'ISO 4217 code, e.g. USD. Infer from symbols/locale; default USD.' },
    subtotalCents: { type: 'integer', description: 'Pre-tax subtotal in minor units (cents).' },
    totalCents: { type: 'integer', description: 'Grand total charged, in minor units (cents).' },
    confidence: { type: 'number', description: 'Overall confidence 0-1 that the extraction is correct.' },
    fieldConfidence: {
      type: 'object',
      additionalProperties: false,
      required: ['merchant', 'date', 'total', 'subtotal'],
      properties: {
        merchant: { type: 'number' },
        date: { type: 'number' },
        total: { type: 'number' },
        subtotal: { type: 'number' },
      },
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'totalAmountCents', 'confidence'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          totalAmountCents: { type: 'integer', description: 'Line total (quantity x unit price) in cents.' },
          confidence: { type: 'number' },
        },
      },
    },
    adjustments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'kind', 'amountCents'],
        properties: {
          label: { type: 'string' },
          kind: { type: 'string', enum: ADJUSTMENT_KINDS },
          amountCents: {
            type: 'integer',
            description: 'Positive for charges (tax, tip, fees); negative for discounts and credits.',
          },
        },
      },
    },
  },
};

const PROMPT = `Extract this receipt so a group of travelers can split it.

- List every purchased line item with its line total. Fold modifiers or add-ons into the item they modify.
- Put tax, tip/gratuity, service charges, delivery fees, discounts, coupons and credits in "adjustments", not "items".
- Use integer minor units (cents). Discounts and credits are negative.
- If the receipt already includes a tip line, record it; never invent a tip.
- Items plus adjustments should equal the total. If they don't, still report what is printed and lower your confidence.
- Use empty strings for a merchant or date you cannot read, and lower the matching fieldConfidence.`;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'not_authenticated' }, 401);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: 'not_authenticated' }, 401);
  }
  const userId = userData.user.id;

  let body: { receiptId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const receiptId = body.receiptId;
  if (typeof receiptId !== 'string' || !UUID.test(receiptId)) {
    return json({ error: 'receipt_id_required' }, 400);
  }

  // RLS limits this to receipts in the caller's groups.
  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .select('id, group_id, uploaded_by, image_path, ocr_status')
    .eq('id', receiptId)
    .maybeSingle();

  if (receiptError) {
    return json({ error: 'receipt_lookup_failed' }, 500);
  }
  if (!receipt) {
    return json({ error: 'receipt_not_found' }, 404);
  }
  if (receipt.uploaded_by !== userId) {
    return json({ error: 'not_receipt_uploader' }, 403);
  }
  if (receipt.ocr_status === 'confirmed') {
    return json({ error: 'receipt_already_saved' }, 409);
  }

  const imagePath: unknown = receipt.image_path;
  const expectedPrefix = `${receipt.group_id}/${userId}/`;
  if (
    typeof imagePath !== 'string' ||
    !imagePath.startsWith(expectedPrefix) ||
    imagePath.includes('..') ||
    imagePath.length > 300
  ) {
    return json({ error: 'invalid_image_path' }, 403);
  }

  await supabase.from('receipts').update({ ocr_status: 'processing' }).eq('id', receiptId);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    const draft = emptyReceipt();
    await supabase
      .from('receipts')
      .update({ ocr_status: 'needs_review', raw_ocr: { provider: 'none' } })
      .eq('id', receiptId);
    return json({ receiptId, imagePath, status: 'needs_review', provider: 'none', receipt: draft });
  }

  try {
    const { data: blob, error: downloadError } = await supabase.storage.from('receipts').download(imagePath);
    if (downloadError || !blob) {
      throw new RecognitionError('image_not_found', 404);
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new RecognitionError('image_too_large', 413);
    }

    const mediaType = imageMediaType(blob.type, imagePath);
    const data = encodeBase64(new Uint8Array(await blob.arrayBuffer()));
    const recognized = await recognize(apiKey, mediaType, data);

    await supabase
      .from('receipts')
      .update({
        ocr_status: 'needs_review',
        merchant: recognized.merchant,
        receipt_date: recognized.date,
        currency_code: recognized.currencyCode,
        subtotal_cents: recognized.subtotalCents,
        total_cents: recognized.totalCents,
        ocr_confidence: recognized.confidence,
        raw_ocr: { provider: 'anthropic', model: MODEL, receipt: recognized },
      })
      .eq('id', receiptId);

    return json({ receiptId, imagePath, status: 'needs_review', provider: 'anthropic', receipt: recognized });
  } catch (error) {
    const code = error instanceof RecognitionError ? error.code : 'recognition_failed';
    const status = error instanceof RecognitionError ? error.status : 502;
    console.error('recognize-receipt failed', code, error);
    await supabase
      .from('receipts')
      .update({ ocr_status: 'failed', raw_ocr: { provider: 'anthropic', error: code } })
      .eq('id', receiptId);
    return json({ receiptId, imagePath, status: 'failed', error: code }, status);
  }
});

class RecognitionError extends Error {
  constructor(public code: string, public status = 502) {
    super(code);
  }
}

async function recognize(apiKey: string, mediaType: string, data: string): Promise<RecognizedReceipt> {
  const client = new Anthropic({ apiKey });

  // deno-lint-ignore no-explicit-any
  const response: any = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { format: { type: 'json_schema', schema: RECEIPT_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
    // deno-lint-ignore no-explicit-any
  } as any);

  if (response.stop_reason === 'refusal') {
    throw new RecognitionError('recognition_refused', 422);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new RecognitionError('recognition_truncated', 502);
  }

  // deno-lint-ignore no-explicit-any
  const text = response.content.find((block: any) => block.type === 'text')?.text;
  if (!text) {
    throw new RecognitionError('recognition_empty', 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new RecognitionError('recognition_unparseable', 502);
  }

  return sanitize(parsed);
}

function sanitize(input: unknown): RecognizedReceipt {
  // deno-lint-ignore no-explicit-any
  const value = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const int = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : 0);
  const unit = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
  const text = (s: unknown, max = 120) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
  const date = text(value.date, 10);
  const currency = text(value.currencyCode, 3).toUpperCase();
  const fields = value.fieldConfidence ?? {};

  return {
    merchant: text(value.merchant) || null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : null,
    currencyCode: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
    subtotalCents: Math.max(0, int(value.subtotalCents)),
    totalCents: Math.max(0, int(value.totalCents)),
    confidence: unit(value.confidence),
    fieldConfidence: {
      merchant: unit(fields.merchant),
      date: unit(fields.date),
      total: unit(fields.total),
      subtotal: unit(fields.subtotal),
    },
    items: (Array.isArray(value.items) ? value.items : []).slice(0, 200).map((item: Record<string, unknown>) => ({
      name: text(item?.name) || 'Item',
      quantity: typeof item?.quantity === 'number' && item.quantity > 0 ? item.quantity : 1,
      totalAmountCents: Math.max(0, int(item?.totalAmountCents)),
      confidence: unit(item?.confidence),
    })),
    adjustments: (Array.isArray(value.adjustments) ? value.adjustments : [])
      .slice(0, 20)
      .map((adjustment: Record<string, unknown>) => ({
        label: text(adjustment?.label, 60) || 'Adjustment',
        kind: ADJUSTMENT_KINDS.includes(adjustment?.kind as AdjustmentKind) ? (adjustment.kind as AdjustmentKind) : 'other',
        amountCents: int(adjustment?.amountCents),
      })),
  };
}

function emptyReceipt(): RecognizedReceipt {
  return {
    merchant: null,
    date: null,
    currencyCode: 'USD',
    subtotalCents: 0,
    totalCents: 0,
    confidence: 0,
    fieldConfidence: { merchant: 0, date: 0, total: 0, subtotal: 0 },
    items: [],
    adjustments: [],
  };
}

function imageMediaType(blobType: string, path: string) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(blobType)) {
    return blobType;
  }
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
