# Architecture

**Analysis Date:** 2026-06-10

## Pattern Overview

**Overall:** Expo React Native single-screen prototype with a framework-neutral domain core and Supabase persistence boundary.

**Key Characteristics:**
- `index.js` registers `src/App.tsx` as the Expo root component.
- `src/App.tsx` owns all current screen routing, UI composition, local receipt state, and interaction handlers.
- `src/core/allocation.mjs` is a standalone JavaScript domain module used by both the React Native app and Node tests.
- `supabase/migrations/001_initial_schema.sql` defines the planned Postgres data model and RLS policies; client code is not wired to it yet.
- `supabase/functions/recognize-receipt/index.ts` defines the receipt-recognition edge function contract and returns a review-required draft response.

## Layers

**Application Shell:**
- Purpose: Boot the Expo app and attach the React Native root component.
- Location: `index.js`
- Contains: `registerRootComponent(App)` for Expo native runtime registration.
- Depends on: `expo`, `src/App.tsx`
- Used by: Expo CLI scripts in `package.json` (`npm run start`, `npm run ios`, `npm run android`).

**Screen/UI Layer:**
- Purpose: Render login, groups, scan, receipt review, activity, profile, header, and bottom navigation flows.
- Location: `src/App.tsx`
- Contains: React function components (`LoginScreen`, `GroupsScreen`, `ScanScreen`, `ReviewReceiptScreen`, `BottomNav`, `Header`) and `StyleSheet.create` styles.
- Depends on: `react`, `react-native`, `@expo/vector-icons`, `src/core/allocation.mjs`, `src/data/demo.ts`, `src/theme.ts`
- Used by: `index.js`
- Prescriptive pattern: Add new prototype screens as function components near the related flow in `src/App.tsx` until routing or screen count warrants extraction.

**Design Tokens:**
- Purpose: Centralize shared color, spacing, and typography primitives for React Native styles.
- Location: `src/theme.ts`
- Contains: `colors`, `spacing`, and `type` exports backed by `StyleSheet.create`.
- Depends on: `react-native`
- Used by: `src/App.tsx`
- Prescriptive pattern: Add shared visual tokens to `src/theme.ts`; keep component-specific layout styles inside the component file using them.

**Demo Data Layer:**
- Purpose: Provide in-memory groups, members, current user, and scanned receipt fixtures for the current prototype.
- Location: `src/data/demo.ts`
- Contains: `currentUser`, `groups`, `members`, `scannedReceipt`.
- Depends on: `src/core/allocation.mjs` for `cents`.
- Used by: `src/App.tsx`
- Prescriptive pattern: Keep static prototype fixtures in `src/data/`; replace with service/query modules when wiring Supabase.

**Domain Allocation Core:**
- Purpose: Convert receipt items, allocations, and adjustments into deterministic member totals with cent-accurate rounding.
- Location: `src/core/allocation.mjs`
- Contains: Public functions `cents`, `dollars`, `allocateReceipt`, `canSaveReceipt`; private helpers `splitAdjustment`, `normalizeAllocations`, `splitAmount`, `addCents`, `pruneZeroTotals`.
- Depends on: No framework or runtime-specific packages.
- Used by: `src/App.tsx`, `src/data/demo.ts`, `tests/allocation.test.mjs`.
- Prescriptive pattern: Keep receipt math and validation framework-neutral in `src/core/` so it remains testable with `node --test`.

**Domain Type Surface:**
- Purpose: Provide TypeScript declarations for the JavaScript allocation module.
- Location: `src/core/allocation.d.ts`
- Contains: `Member`, `AllocationInput`, `ReceiptItemInput`, `ReceiptAdjustmentInput`, `ReceiptInput`, and exported function signatures.
- Depends on: TypeScript declaration syntax only.
- Used by: TypeScript consumers importing `src/core/allocation.mjs`, especially `src/App.tsx` and `src/data/demo.ts`.
- Prescriptive pattern: Update `src/core/allocation.d.ts` whenever public exports or input/result shapes in `src/core/allocation.mjs` change.

**Backend Client Boundary:**
- Purpose: Configure the Supabase browser/native client from Expo public environment variables.
- Location: `src/lib/supabase.ts`
- Contains: `supabase` client and `isSupabaseConfigured` boolean.
- Depends on: `react-native-url-polyfill/auto`, `@supabase/supabase-js`, `process.env.EXPO_PUBLIC_SUPABASE_URL`, `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Used by: Not currently imported elsewhere.
- Prescriptive pattern: Put Supabase queries and mutations behind modules under `src/lib/` or future service files; do not call `createClient` outside `src/lib/supabase.ts`.

**Database Schema and Authorization:**
- Purpose: Define persistent data structures for profiles, groups, memberships, expenses, receipts, receipt items, adjustments, item allocations, and expense shares.
- Location: `supabase/migrations/001_initial_schema.sql`
- Contains: Tables, indexes, RLS enablement, `public.is_group_member(target_group_id uuid)`, and policies.
- Depends on: Supabase Postgres, `auth.users`, `auth.uid()`, `pgcrypto`.
- Used by: Supabase migrations/deployment tooling.
- Prescriptive pattern: Add new persistent entities through SQL migrations in `supabase/migrations/` and include RLS policies at the same time.

**Receipt Recognition Edge Function:**
- Purpose: Accept an image path and return a draft recognized receipt shape requiring user review.
- Location: `supabase/functions/recognize-receipt/index.ts`
- Contains: Deno `serve` handler, `RecognizedReceipt` type, `POST` validation, JSON response helper.
- Depends on: Deno standard HTTP server import from `https://deno.land/std@0.224.0/http/server.ts`.
- Used by: Supabase Edge Functions runtime; not currently called by the app.
- Prescriptive pattern: Keep network/OCR provider details inside this function or helper modules under `supabase/functions/recognize-receipt/`; return review-safe drafts rather than directly committing OCR output.

**Test Layer:**
- Purpose: Verify allocation behavior independently from React Native.
- Location: `tests/allocation.test.mjs`
- Contains: Node test suites for proportional adjustments, odd-cent rounding, equal adjustments, and save validation.
- Depends on: `node:test`, `node:assert/strict`, `src/core/allocation.mjs`.
- Used by: `npm test` from `package.json`.
- Prescriptive pattern: Add core logic tests under `tests/*.test.mjs` and import framework-neutral modules directly.

**Design Reference Artifacts:**
- Purpose: Preserve static design outputs and visual references for the prototype.
- Location: `stitch_minimalist_trip_splitter/`
- Contains: `monochrome_logic/DESIGN.md`, HTML exports such as `stitch_minimalist_trip_splitter/scan_receipt/code.html`, and PNG screenshots.
- Depends on: Not part of the app runtime.
- Used by: Human design/reference workflow.
- Prescriptive pattern: Treat this directory as reference input, not application source.

## Data Flow

**App Startup:**

1. Expo loads `index.js`.
2. `index.js` imports `src/App.tsx` and calls `registerRootComponent(App)`.
3. `src/App.tsx` initializes `route` to `'login'` and `receipt` to `scannedReceipt` from `src/data/demo.ts`.
4. The current route determines which inline screen component renders.

**Prototype Navigation Flow:**

1. `LoginScreen` calls `onDone`, which sets `route` to `'groups'`.
2. `GroupsScreen` shows demo `groups` from `src/data/demo.ts` and calls `onScan`, which sets `route` to `'scan'`.
3. `ScanScreen` calls `onCapture`, which sets `route` to `'review'`.
4. `BottomNav` calls `navigate(route)` for top-level tabs and treats `'review'` as part of the scan tab.

**Receipt Review and Allocation Flow:**

1. `ReviewReceiptScreen` receives `receipt` and `onChangeReceipt` from `src/App.tsx`.
2. It builds a `ReceiptInput` from `members`, `receipt.items`, `receipt.adjustments`, and `receipt.receiptTotalCents`.
3. `useMemo` calls `canSaveReceipt(receiptInput)` from `src/core/allocation.mjs`.
4. `canSaveReceipt` calls `allocateReceipt`, then adds validation reasons for unassigned items, invalid item amounts, or total mismatches.
5. `allocateReceipt` splits item amounts, applies adjustment strategies, computes `memberTotals`, and reports `remainingCents`.
6. UI rows render member totals with `dollars` from `src/core/allocation.mjs`.
7. Tapping an item cycles local allocation presets and updates React state through `onChangeReceipt`.

**Receipt Recognition API Flow:**

1. A client sends `POST` to the Supabase function at `supabase/functions/recognize-receipt/index.ts` with JSON containing `imagePath`.
2. The function rejects non-`POST` requests with `405`.
3. The function rejects missing or non-string `imagePath` with `400`.
4. The function returns `{ imagePath, receipt: draft, status: 'needs_review' }`.
5. The returned draft shape mirrors fields needed by receipt review: merchant, date, currency, totals, confidence, items, and adjustments.

**Database Persistence Model:**

1. A signed-in user has a profile in `public.profiles`.
2. Groups live in `public.trip_groups` and membership access is modeled by `public.group_memberships`.
3. Expenses are stored in `public.expenses`; uploaded receipt metadata is stored in `public.receipts`.
4. Receipt line items live in `public.receipt_items`; tax, tip, fees, discounts, and credits live in `public.receipt_adjustments`.
5. Item and adjustment assignments live in `public.item_allocations`.
6. Final owed/paid totals live in `public.expense_shares`.
7. RLS policies use `public.is_group_member(group_id)` to constrain group-scoped reads and writes.

**State Management:**
- Local UI state uses React `useState` inside `src/App.tsx`.
- Derived receipt validation/allocation uses React `useMemo` in `ReviewReceiptScreen`.
- Persistent state is represented in `supabase/migrations/001_initial_schema.sql` but is not connected to the UI yet.
- Authentication/session state is configured in `src/lib/supabase.ts` but is not consumed by screens yet.

## Key Abstractions

**Route Union:**
- Purpose: Enumerate all in-app screens supported by local state routing.
- Examples: `src/App.tsx`
- Pattern: `type Route = 'login' | 'groups' | 'scan' | 'review' | 'activity' | 'profile'`; pass `navigate` callbacks into child components.

**Receipt Draft:**
- Purpose: Hold the editable scanned receipt state rendered by the review flow.
- Examples: `src/App.tsx`, `src/data/demo.ts`
- Pattern: `type ReceiptDraft = typeof scannedReceipt`; update with immutable object spreads in `onChangeReceipt`.

**Receipt Input:**
- Purpose: Normalize UI/demo receipt state into the allocation core input contract.
- Examples: `src/App.tsx`, `src/core/allocation.d.ts`
- Pattern: Build `{ members, items, adjustments, receiptTotalCents }` before calling `canSaveReceipt`.

**Allocation Engine:**
- Purpose: Split item and adjustment cents across members and produce audit-friendly share arrays.
- Examples: `src/core/allocation.mjs`, `tests/allocation.test.mjs`
- Pattern: Pure functions return data objects; no UI, database, or network side effects.

**Adjustment Strategy:**
- Purpose: Determine how non-item amounts are distributed.
- Examples: `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `src/data/demo.ts`, `supabase/migrations/001_initial_schema.sql`
- Pattern: Supported values are `proportional`, `equal`, and `custom`; database stores the equivalent in `receipt_adjustments.allocation_strategy`.

**Supabase Client Singleton:**
- Purpose: Provide one configured client for app-side Supabase access.
- Examples: `src/lib/supabase.ts`
- Pattern: Read Expo public env vars once and export `supabase` plus `isSupabaseConfigured`.

**Group Membership Authorization:**
- Purpose: Centralize group access checks for RLS policies.
- Examples: `supabase/migrations/001_initial_schema.sql`
- Pattern: SQL function `public.is_group_member(target_group_id uuid)` is referenced from group-scoped policies.

**Design Tokens:**
- Purpose: Keep color, spacing, and typography reusable across React Native styles.
- Examples: `src/theme.ts`, `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`
- Pattern: Import named token objects into component files; do not duplicate shared constants inline.

## Entry Points

**Expo Native App:**
- Location: `index.js`
- Triggers: Expo runtime launched by `npm run start`, `npm run ios`, or `npm run android`.
- Responsibilities: Register `src/App.tsx` as the root component.

**React Native Root Component:**
- Location: `src/App.tsx`
- Triggers: Expo root registration.
- Responsibilities: Hold route and receipt state, compose screens, render navigation, call allocation core for receipt review.

**Allocation Tests:**
- Location: `tests/allocation.test.mjs`
- Triggers: `npm test`, which runs `node --test tests/*.test.mjs`.
- Responsibilities: Verify deterministic allocation and validation behavior.

**Type Checking:**
- Location: `tsconfig.json`
- Triggers: `npm run typecheck`, which runs `tsc --noEmit`.
- Responsibilities: Type-check TypeScript and JavaScript-compatible imports included from `src/**/*` and `index.js`.

**Supabase Migration:**
- Location: `supabase/migrations/001_initial_schema.sql`
- Triggers: Supabase migration tooling.
- Responsibilities: Create schema, indexes, RLS functions, and policies.

**Supabase Edge Function:**
- Location: `supabase/functions/recognize-receipt/index.ts`
- Triggers: Supabase Edge Functions runtime HTTP requests.
- Responsibilities: Validate receipt-recognition requests and return a draft OCR result shape.

## Error Handling

**Strategy:** Keep user-correctable validation in returned data, and use HTTP status responses at the edge boundary.

**Patterns:**
- `src/core/allocation.mjs` returns `{ ok, reasons, result }` from `canSaveReceipt` instead of throwing for receipt validation problems.
- `src/App.tsx` disables the save button and displays validation reasons from `canSaveReceipt`.
- `supabase/functions/recognize-receipt/index.ts` returns JSON errors with explicit HTTP status codes for bad method and invalid body.
- `src/core/allocation.mjs` returns empty share arrays for empty allocations or zero amounts, allowing callers to surface validation separately.

## Cross-Cutting Concerns

**Logging:** Not detected in app source; no logging wrapper exists in `src/` or `supabase/functions/recognize-receipt/index.ts`.

**Validation:** Receipt save validation is implemented in `src/core/allocation.mjs`; edge request validation is implemented in `supabase/functions/recognize-receipt/index.ts`; database constraints and RLS policies are implemented in `supabase/migrations/001_initial_schema.sql`.

**Authentication:** Supabase auth client configuration exists in `src/lib/supabase.ts`; database policies depend on `auth.uid()` in `supabase/migrations/001_initial_schema.sql`; UI login in `src/App.tsx` is currently prototype-only and does not call Supabase auth.

**Styling:** Runtime styling uses React Native `StyleSheet.create` in `src/App.tsx` and shared tokens from `src/theme.ts`; design reference artifacts live under `stitch_minimalist_trip_splitter/`.

**Testing:** Core business logic is covered by `tests/allocation.test.mjs`; UI, Supabase client wiring, database policies, and edge function behavior do not have detected automated tests.

---

*Architecture analysis: 2026-06-10*
