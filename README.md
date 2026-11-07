# Split

Split is an iOS-first app for splitting trip costs. You scan a receipt, Claude reads the line items, you assign each item to people in the trip group, and Split saves a ledger entry with per-person totals. Balances, suggested settlements and payment history come from that saved ledger.

## Run the app

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase project values
npm run ios                  # or: npm run web
```

Without `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` the app shows a "Backend not configured" screen.

## Set up the backend (Supabase)

1. Apply the migrations in order: `supabase/migrations/001_initial_schema.sql`, then `002_v1_backend.sql` (with the Supabase CLI: `supabase db push`, or paste them into the SQL editor).
2. Deploy the receipt recognition function: `supabase functions deploy recognize-receipt`.
3. For OCR, set the Claude API key as a function secret: `supabase secrets set ANTHROPIC_API_KEY=...`. Optionally set `RECEIPT_MODEL` (default `claude-opus-5-5`). Without the key the function returns an empty draft and users enter the receipt by hand.
4. If email confirmation is on in Auth settings, new users must confirm before signing in. Turn it off in a dev project to test faster.

Migration `002` creates the `receipts` (private) and `avatars` (public) storage buckets and their policies.

## How it fits together

| Area | Where |
| --- | --- |
| Money math (allocation, rounding, validation) | `src/core/allocation.mjs` |
| Receipt DTOs: OCR response → review draft → save payload, plus saved rows → read-only draft | `src/core/receipt.mjs` |
| Settlement suggestions | `src/core/settlement.mjs` |
| Supabase calls | `src/lib/api.ts` |
| Auth/session and profile bootstrap | `src/lib/auth.tsx` |
| Navigation (tabs plus a typed stack) | `src/navigation.tsx` |
| Screens | `src/screens/` |
| Schema, RLS, RPCs | `supabase/migrations/` |
| Receipt OCR (Claude vision, structured output) | `supabase/functions/recognize-receipt/` |

Ledger writes all go through security-definer RPCs, which validate membership and totals and run in a single transaction:

- `create_group`, `add_group_member` (by email), `remove_group_member`
- `save_receipt`, which writes the expense, receipt, items, adjustments, allocations and shares together or not at all
- `record_settlement`
- `group_balances` and `my_groups` (reads)

Clients can only read ledger tables. They can create and edit receipt drafts, but not confirmed receipts.

Receipt flow: capture or import a photo, which is uploaded to `receipts/{group_id}/{user_id}/…`. The app then creates a `receipts` row, `recognize-receipt` fills in a draft, and the user reviews and assigns every item. `save_receipt` then confirms it. OCR output is never saved without human review.

## Verification

```bash
npm test            # allocation, receipt mapper and settlement unit tests
npm run typecheck
PGURL=postgres://postgres@localhost:5432/postgres npm run test:db   # migrations + RLS/RPC tests on a scratch database
```

`test:db` creates a throwaway database, loads `supabase/tests/supabase_stub.sql` (minimal stand-ins for Supabase's `auth` and `storage` schemas), applies every migration and runs `supabase/tests/*.test.sql`.
