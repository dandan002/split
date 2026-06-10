# Codebase Concerns

**Analysis Date:** 2026-06-10

## Tech Debt

**Single-file app shell and feature implementation:**
- Issue: `src/App.tsx` contains routing, login UI, group list UI, scanner UI, receipt review behavior, placeholder tabs, shared header/nav components, and all screen styles in one 889-line file.
- Files: `src/App.tsx`
- Impact: Every feature change touches the same module, making merge conflicts, visual regressions, and accidental behavior changes more likely. Screen-specific state and domain behavior are difficult to test independently.
- Fix approach: Split by screen and responsibility: `src/screens/LoginScreen.tsx`, `src/screens/GroupsScreen.tsx`, `src/screens/ScanScreen.tsx`, `src/screens/ReviewReceiptScreen.tsx`, shared components under `src/components/`, and navigation state under a small app shell.

**Prototype data is hard-wired into production UI flow:**
- Issue: The app renders imported demo data directly and does not read from Supabase or a repository/service layer. `src/App.tsx` imports `groups`, `members`, and `scannedReceipt` from `src/data/demo.ts`; `src/lib/supabase.ts` exports a client but is not used by the app.
- Files: `src/App.tsx`, `src/data/demo.ts`, `src/lib/supabase.ts`
- Impact: UI behavior can look complete while persistence, auth, group membership, receipt creation, and save flows are not exercised. Future backend integration will require changing component contracts instead of swapping data providers.
- Fix approach: Introduce typed data access functions under `src/services/` or `src/data/` for auth, groups, receipt drafts, and saves. Keep demo data behind an explicit mock provider used only in development or tests.

**Login, social sign-in, create group, edit, and save controls are non-functional:**
- Issue: The login button only changes local route state; Apple/Google buttons have no handlers; create group, edit receipt, and save split controls do not call persistence or validation side effects.
- Files: `src/App.tsx`, `src/lib/supabase.ts`
- Impact: User-facing actions can be tapped without performing the promised action. This hides missing auth/session/error states until late integration work.
- Fix approach: Wire controls through explicit commands such as `signInWithPassword`, OAuth handlers, `createGroup`, `updateReceiptDraft`, and `saveExpenseShares`. Disable or remove controls until handlers and error states exist.

**Receipt scanner is a static mock instead of a camera/OCR workflow:**
- Issue: `ScanScreen` renders fake receipt text and static "LIVE RECOGNITION" rows; `onCapture` only navigates to review with the seeded `scannedReceipt`.
- Files: `src/App.tsx`, `src/data/demo.ts`, `supabase/functions/recognize-receipt/index.ts`
- Impact: Camera permissions and dependencies exist in `app.json` and `package.json`, but image capture, upload, edge-function invocation, OCR polling, and failure states are not implemented.
- Fix approach: Add an image capture/import module, upload receipts to a controlled storage path, invoke `recognize-receipt`, then populate the review screen from returned draft data.

**Allocation engine is JavaScript with a separate declaration file:**
- Issue: Runtime logic lives in `src/core/allocation.mjs`; TypeScript types are manually mirrored in `src/core/allocation.d.ts`.
- Files: `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `tests/allocation.test.mjs`
- Impact: Types can drift from implementation, and `tsconfig.json` has `allowJs: true` with `checkJs: false`, so the core calculation file is not type-checked.
- Fix approach: Move allocation logic to `src/core/allocation.ts` or enable `checkJs` with JSDoc types. Keep tests importing the compiled/runtime-compatible module through the same public path used by the app.

**Receipt and allocation domain rules are split across UI, database, and core logic:**
- Issue: The UI uses `amountCents`, `strategy`, and `allocations`; the database uses `total_amount_cents`, `allocation_strategy`, and `item_allocations`; the edge function returns `totalAmountCents`. There is no shared mapper or schema validation.
- Files: `src/App.tsx`, `src/core/allocation.d.ts`, `src/core/allocation.mjs`, `supabase/functions/recognize-receipt/index.ts`, `supabase/migrations/001_initial_schema.sql`
- Impact: Backend integration is likely to introduce mismatched field names, missing conversions, and incorrect save payloads.
- Fix approach: Define shared domain DTOs and mapper functions for receipt drafts, database rows, and edge-function responses. Test the mappers before wiring persistence.

## Known Bugs

**Typecheck command fails before app code is checked:**
- Symptoms: `npm run typecheck` exits with TypeScript configuration errors: `customConditions` requires `moduleResolution` `node16`, `nodenext`, or `bundler`, and Expo's base `module` value is rejected by the installed compiler.
- Files: `package.json`, `package-lock.json`, `tsconfig.json`
- Trigger: Run `npm run typecheck`.
- Workaround: None in the current repo. Align `typescript` with Expo 56 requirements and update `tsconfig.json` module/moduleResolution settings to match Expo's base config.

**Header back button renders on screens without a back action:**
- Symptoms: `Header` always renders a pressable back arrow, even when `onBack` is undefined. Groups, Scan, Activity, and Profile screens show a tappable arrow that performs no navigation.
- Files: `src/App.tsx`
- Trigger: Navigate past login to any screen rendered through `Header` without passing `onBack`.
- Workaround: None. Render the back button only when `onBack` is provided, or pass a real destination handler for every header.

**Receipt assignment cycling excludes a real member in several presets:**
- Symptoms: `cycleAssignment` hard-codes `ana`, `bo`, and `cam` presets, then finally all members. The demo member list also includes `dev`, so most cycles cannot assign only `dev` or include `dev` except in the "everyone" preset.
- Files: `src/App.tsx`, `src/data/demo.ts`
- Trigger: Tap a receipt item repeatedly in review.
- Workaround: None. Generate assignment options from the active group member list rather than hard-coding member IDs.

**Unknown allocation member IDs are accepted by the core splitter:**
- Symptoms: `splitAmount` preserves `allocation.memberId` values even when `memberOrder.indexOf(memberId)` is `-1`; `allocateReceipt` then adds totals for IDs that are not in `receipt.members`.
- Files: `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `tests/allocation.test.mjs`
- Trigger: Call `allocateReceipt` with an item allocation for a profile not present in `receipt.members`.
- Workaround: None. Validate allocation member IDs before splitting and add a unit test for unknown members.

**Invalid currency strings can produce `NaN` cents:**
- Symptoms: `cents()` parses arbitrary strings with `Number.parseInt`; empty or non-numeric input can return `NaN`, which can then flow into totals and formatted dollars.
- Files: `src/core/allocation.mjs`, `tests/allocation.test.mjs`
- Trigger: Call `cents('')`, `cents('abc')`, or a malformed OCR amount string.
- Workaround: None. Reject malformed money input with a typed error/result and test invalid cases.

**Malformed edge-function JSON requests return an unhandled server error:**
- Symptoms: `recognize-receipt` calls `await request.json()` without a `try/catch`. Invalid JSON does not return the documented `imagePath is required` response.
- Files: `supabase/functions/recognize-receipt/index.ts`
- Trigger: POST a non-JSON body or malformed JSON to the edge function.
- Workaround: Send valid JSON only. Add body parsing guards and explicit 400 responses.

## Security Considerations

**Supabase client can be created with empty URL/key:**
- Risk: `src/lib/supabase.ts` creates and exports a Supabase client even when `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is missing, because missing values default to empty strings.
- Files: `src/lib/supabase.ts`, `README.md`
- Current mitigation: `isSupabaseConfigured` exposes whether both values are present.
- Recommendations: Export a factory that throws a clear configuration error before client creation, or gate all Supabase usage behind `isSupabaseConfigured` with user-visible setup errors.

**Profiles are globally visible to all authenticated users:**
- Risk: The `profiles are visible to signed-in users` RLS policy allows every authenticated user to select all profiles.
- Files: `supabase/migrations/001_initial_schema.sql`
- Current mitigation: RLS is enabled on `public.profiles`.
- Recommendations: Restrict profile reads to users sharing a group, or expose a minimal public profile view for discovery while keeping email/private metadata out of `public.profiles`.

**Group creation has no matching owner-membership bootstrap:**
- Risk: `trip_groups` insert policy allows a signed-in user to create a group, but no trigger creates the matching `group_memberships` owner row. Since read/update policies depend on membership, a newly created group can become inaccessible to its creator.
- Files: `supabase/migrations/001_initial_schema.sql`
- Current mitigation: None detected in the migration.
- Recommendations: Add an `after insert` trigger on `public.trip_groups` to insert `(new.id, new.created_by, 'owner')`, and test RLS around create/read/manage membership flows.

**Members can write receipt rows and allocations for other members without payer/profile constraints:**
- Risk: Receipt item, adjustment, and allocation policies check group membership but do not constrain `item_allocations.profile_id` to a member of the same group or restrict who can update finalized/confirmed receipts.
- Files: `supabase/migrations/001_initial_schema.sql`
- Current mitigation: RLS checks that the parent receipt belongs to a group the caller belongs to.
- Recommendations: Add group-membership checks for `item_allocations.profile_id`, add receipt status restrictions for confirmed records, and route final settlement writes through controlled server-side functions.

**Receipt image paths are accepted as arbitrary strings:**
- Risk: `recognize-receipt` accepts any non-empty `imagePath` and echoes it back; the schema stores `receipts.image_path` as plain text with no storage bucket policy shown.
- Files: `supabase/functions/recognize-receipt/index.ts`, `supabase/migrations/001_initial_schema.sql`
- Current mitigation: The edge function currently returns only an empty draft and does not fetch the image.
- Recommendations: Validate image paths against an authenticated user's allowed storage prefix, add Supabase Storage bucket migrations/policies, and avoid echoing untrusted storage identifiers into logs or UI.

## Performance Bottlenecks

**Receipt review recomputes allocation for every receipt object change:**
- Problem: `ReviewReceiptScreen` calls `canSaveReceipt` in a `useMemo` keyed by the whole `receipt` object; every assignment change recalculates the full receipt.
- Files: `src/App.tsx`, `src/core/allocation.mjs`
- Cause: Allocation is cheap for demo data, but the UI has no incremental strategy or memoization by item/adjustment identity.
- Improvement path: Keep this simple for small receipts, but add benchmark tests before supporting large receipts or repeated OCR edits. Memoize derived totals at a service/store boundary if receipts grow.

**Allocation lookup and assignment label rendering scan members repeatedly:**
- Problem: `assignmentLabel` and `AvatarStrip` call `members.find(...)` for every rendered allocation.
- Files: `src/App.tsx`
- Cause: Members are stored as an array and used directly in render helpers.
- Improvement path: Build a `memberById` map once per active group and pass it into review components.

**RLS helper may be invoked repeatedly through nested policies:**
- Problem: Policies for receipt items, adjustments, allocations, expenses, and shares repeatedly call `public.is_group_member(...)`, including inside nested `exists` queries.
- Files: `supabase/migrations/001_initial_schema.sql`
- Cause: RLS policy checks are implemented independently per table and per row.
- Improvement path: Add indexes for all policy predicates, test query plans with realistic group sizes, and consider security-definer RPCs for bulk receipt save/update operations.

## Fragile Areas

**Cent rounding and adjustment allocation rules:**
- Files: `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `tests/allocation.test.mjs`
- Why fragile: The algorithm handles rounding remainders, negative adjustments, proportional tax/tip, custom allocations, and active-member selection. Small changes can shift cents between users.
- Safe modification: Add tests before changing behavior. Cover negative adjustments, custom fixed amounts, unknown members, zero/negative weights, empty active members, and malformed amounts.
- Test coverage: Basic positive allocation, odd-cent rounding, equal adjustments, unassigned items, and total mismatch are covered. Negative and invalid-input cases are not covered.

**Database RLS and membership model:**
- Files: `supabase/migrations/001_initial_schema.sql`
- Why fragile: Most table access depends on `public.is_group_member`, ownership is only represented in `group_memberships`, and group creation does not bootstrap membership.
- Safe modification: Validate policies with Supabase local integration tests for owner, member, non-member, and anonymous roles before adding app writes.
- Test coverage: No database migration, RLS, or policy tests detected.

**Receipt recognition contract:**
- Files: `supabase/functions/recognize-receipt/index.ts`, `src/data/demo.ts`, `src/App.tsx`
- Why fragile: The function returns a draft shape that differs from the UI demo object and database row names. It also has no authentication, storage validation, OCR provider integration, or schema parser.
- Safe modification: Define a shared receipt draft schema, validate edge-function responses, and add tests around malformed inputs and provider failures before connecting real OCR.
- Test coverage: No edge-function tests detected.

**Navigation and screen state:**
- Files: `src/App.tsx`
- Why fragile: Navigation is local string state with no route params, history stack, persistence, deep links, auth guards, or error handling.
- Safe modification: Introduce a navigation library or a typed route reducer before adding nested flows such as group detail, receipt edit, settlement, and auth callback screens.
- Test coverage: No component, navigation, or interaction tests detected.

**Generated/reference UI artifacts are checked into the repo:**
- Files: `stitch_minimalist_trip_splitter/scan_receipt/code.html`, `stitch_minimalist_trip_splitter/split_login/code.html`, `stitch_minimalist_trip_splitter/your_groups/code.html`, `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`
- Why fragile: Reference HTML can diverge from the React Native implementation and confuse future source searches unless its role is documented.
- Safe modification: Treat `stitch_minimalist_trip_splitter/` as design reference only, or move it under docs/design with a README explaining it is not runtime code.
- Test coverage: Not applicable; these files are not part of the app runtime or tests.

## Scaling Limits

**No persistence path from review to ledger:**
- Current capacity: The app can show and locally edit one seeded receipt draft in memory.
- Limit: Refreshing the app resets state; no expenses, receipt rows, allocations, or `expense_shares` are written.
- Scaling path: Add a receipt-save service that writes `expenses`, `receipts`, `receipt_items`, `receipt_adjustments`, `item_allocations`, and `expense_shares` in a transaction or server-side RPC.

**No offline/sync model:**
- Current capacity: Local UI state only; Supabase client is configured but unused.
- Limit: Real receipt capture and group editing will need network, upload, retry, and conflict behavior that is not modeled.
- Scaling path: Define local draft storage and sync state for receipt scans before wiring camera capture.

**No OCR processing pipeline:**
- Current capacity: The edge function returns an empty `needs_review` draft for any non-empty image path.
- Limit: It cannot extract merchant, date, line items, subtotal, total, tax, tip, confidence, or raw OCR.
- Scaling path: Add provider integration, timeout handling, raw result persistence, confidence thresholds, and human-review fallback states.

## Dependencies at Risk

**TypeScript / Expo config compatibility:**
- Risk: Installed `typescript` is `5.3.3`, while Expo 56's base config uses options rejected by this compiler under the current `tsconfig.json`.
- Impact: `npm run typecheck` is broken, so TypeScript cannot protect app changes.
- Migration plan: Use the TypeScript version and `moduleResolution` settings supported by the installed Expo SDK. Verify with `npm run typecheck` after updating `package.json`, `package-lock.json`, and `tsconfig.json`.

**Supabase client session persistence on React Native:**
- Risk: `src/lib/supabase.ts` enables `persistSession: true` but does not configure a React Native storage adapter.
- Impact: Supabase may warn about missing storage or fail to persist auth sessions consistently on device.
- Migration plan: Add the Supabase React Native auth storage setup using Expo/React Native storage appropriate for the app, then test app restart/session refresh behavior.

## Missing Critical Features

**Authentication implementation:**
- Problem: Login UI exists, but no password auth, OAuth, session restoration, sign-out, auth errors, or protected routes are implemented.
- Blocks: Real user data access, RLS validation, profile ownership, group creation, and receipt persistence.

**Camera/image capture and upload:**
- Problem: Camera and image-picker dependencies are installed and permissions are declared, but no capture/import/upload code exists.
- Blocks: Receipt OCR and any real scan-to-review flow.

**Backend data integration:**
- Problem: Supabase schema and client exist, but the app never reads or writes groups, receipts, expenses, memberships, or shares.
- Blocks: Multi-user trip cost splitting, persistence, synchronization, and settlement history.

**Settlement activity/profile functionality:**
- Problem: Activity and Profile are placeholders with static copy.
- Blocks: Account settings, member identity management, balance history, settlement audit trail, and user trust in final balances.

## Test Coverage Gaps

**Typecheck is not passing:**
- What's not tested: Type-level compatibility for the app and TypeScript source.
- Files: `package.json`, `tsconfig.json`
- Risk: Type errors in `src/App.tsx`, `src/lib/supabase.ts`, and declaration drift in `src/core/allocation.d.ts` can ship unnoticed.
- Priority: High

**UI behavior has no automated tests:**
- What's not tested: Login navigation, bottom navigation, scan-to-review transition, assignment cycling, save disabled state, header back behavior, and placeholder screen behavior.
- Files: `src/App.tsx`
- Risk: User-facing regressions will not be caught by `npm test`.
- Priority: High

**Supabase schema and RLS have no tests:**
- What's not tested: Group creation bootstrap, owner/member/non-member permissions, receipt writes, allocation writes, and expense share reads.
- Files: `supabase/migrations/001_initial_schema.sql`
- Risk: Security or access bugs can block users or expose group data.
- Priority: High

**Edge function has no request/response tests:**
- What's not tested: Method rejection, malformed JSON, missing image path, auth requirements, storage path authorization, OCR provider errors, and output schema.
- Files: `supabase/functions/recognize-receipt/index.ts`
- Risk: OCR integration can fail at runtime without a reliable contract.
- Priority: High

**Allocation edge cases are under-tested:**
- What's not tested: Negative discounts/credits, custom `amountCents` allocations, unknown member IDs, malformed money strings, zero weights, negative weights, empty active members for adjustments, and receipt total edge cases.
- Files: `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `tests/allocation.test.mjs`
- Risk: Incorrect cents can be assigned to members without detection.
- Priority: Medium

---

*Concerns audit: 2026-06-10*
