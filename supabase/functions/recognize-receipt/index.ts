import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type RecognizedReceipt = {
  merchant: string | null;
  date: string | null;
  currencyCode: string;
  subtotalCents: number;
  totalCents: number;
  confidence: number;
  items: Array<{
    name: string;
    quantity: number;
    totalAmountCents: number;
    confidence: number;
  }>;
  adjustments: Array<{
    label: string;
    kind: 'tax' | 'tip' | 'service_fee' | 'delivery_fee' | 'discount' | 'credit' | 'other';
    amountCents: number;
  }>;
};

serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const { imagePath } = await request.json();

  if (typeof imagePath !== 'string' || imagePath.length === 0) {
    return json({ error: 'imagePath is required' }, 400);
  }

  const draft: RecognizedReceipt = {
    merchant: null,
    date: null,
    currencyCode: 'USD',
    subtotalCents: 0,
    totalCents: 0,
    confidence: 0,
    items: [],
    adjustments: [],
  };

  return json({
    imagePath,
    receipt: draft,
    status: 'needs_review',
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
