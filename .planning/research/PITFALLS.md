# Domain Pitfalls

**Domain:** iOS-first trip receipt splitting app
**Project:** Split
**Researched:** 2026-06-10
**Overall confidence:** HIGH for local codebase risks; MEDIUM for external platform guidance verified against official Supabase and Expo docs.

## Critical Pitfalls

Mistakes that can cause incorrect balances, blocked users, private data exposure, or expensive rewrites.

### Pitfall 1: Treating Receipt Save as a Client-Side Multi-Table Insert

**What goes wrong:** The app writes `expenses`, `receipts`, `receipt_items`, `receipt_adjustments`, `item_allocations`, and `expense_shares` from the mobile client as separate operations. Partial failure leaves a saved expense without complete items, allocations, or member shares.

**Why it happens:** The schema already has the right tables, so it is tempting to wire each table directly from the review screen. Supabase RLS also makes direct client inserts feel natural, but a confirmed receipt is one financial transaction.

**Consequences:** Activity and settlement screens show balances that do not reconcile with the receipt. Retrying can duplicate records. Users lose trust because "who owes whom" changes after refresh or differs between devices.

**Warning signs:**
- Review screen calls several `.insert()` statements in sequence.
- Save logic lives inside a React component.
- No idempotency key or draft/confirmed state transition exists.
- Tests only verify one table at a time.

**Prevention:** Create a single save boundary: preferably a Postgres RPC or Edge Function that validates the draft, recomputes allocations server-side, writes all rows in one transaction, and transitions from draft to confirmed once. The client should submit a validated receipt draft and receive the canonical saved ledger entry.

**Detection:** Add an integration test that forces a mid-save failure and asserts no confirmed ledger entry is visible. Add reconciliation tests that compare `expense_shares` totals to saved receipt totals.

**Phase should address:** Persistence / save-to-ledger phase, before activity and settlements depend on saved data.

### Pitfall 2: Letting Money Rules Drift Across UI, Edge Function, Database, and Core Allocation

**What goes wrong:** The UI edits one receipt shape, OCR returns another, the database stores snake_case rows, and the allocation engine consumes a third model. Field-name mismatches, malformed cents, unknown member IDs, and rounding changes slip through.

**Why it happens:** Current code already has drift: UI/demo objects use `amountCents`, the edge function returns `totalAmountCents`, and tables use names like `total_amount_cents`. The allocation core is JavaScript with a separate `.d.ts`, so type drift is possible.

**Consequences:** People are charged for the wrong items, discounts are applied to the wrong members, or invalid OCR values produce `NaN`/bad totals. These are v1-stopping defects because the product's core promise is trustworthy per-person totals.

**Warning signs:**
- Repeated inline mapping code in screens.
- Money parsed in UI components.
- `amount` strings accepted past the review form boundary.
- Allocation tests are not updated when receipt editing changes.

**Prevention:** Define one domain receipt draft type and explicit mappers for OCR response -> draft, draft -> allocation input, and saved rows -> ledger view. Reject malformed money at the boundary. Keep cent values as integers after parsing. Add tests for negative discounts, custom fixed allocations, unknown members, zero/negative weights, empty active members, and malformed OCR amounts before expanding review editing.

**Detection:** Property-style reconciliation tests should assert that item totals plus adjustments equal the receipt total and member shares sum exactly to the saved amount. Typecheck must pass before relying on TypeScript for these contracts.

**Phase should address:** Foundation/typecheck phase and receipt review editing phase, with final server-side validation in persistence phase.

### Pitfall 3: Shipping Group Creation Without Owner-Membership Bootstrap

**What goes wrong:** A user creates a group but is not automatically inserted into `group_memberships` as owner. Since read/update policies depend on membership, the newly created group can become inaccessible to its creator.

**Why it happens:** The existing `trip_groups` insert policy permits creation, but the local codebase audit found no matching trigger to create the owner membership row.

**Consequences:** The first real group flow appears to succeed, then disappears from the group list. Invite/member management cannot be trusted because ownership is not established atomically.

**Warning signs:**
- App calls `trip_groups.insert()` directly from the create group screen.
- Group list query returns empty after create.
- Tests create groups by seeding memberships manually, hiding the real path.

**Prevention:** Add an `after insert` trigger or server-side group-create RPC that inserts the owner membership in the same transaction. Test owner, member, non-member, and anonymous paths through RLS.

**Detection:** Supabase local tests should create a group as a signed-in user, immediately select it, update it, and manage memberships. A non-member should be denied.

**Phase should address:** Auth + group/member management phase before receipt save depends on active groups.

### Pitfall 4: Assuming RLS Membership Checks Are Enough for Receipt and Allocation Writes

**What goes wrong:** Members can write rows that reference profiles outside the group, mutate confirmed receipts, or create allocations inconsistent with the parent receipt.

**Why it happens:** Current policies mostly check whether the caller belongs to the parent group. The audit specifically flagged missing constraints on `item_allocations.profile_id`, receipt finalization rules, and settlement write controls.

**Consequences:** A malicious or buggy client can assign costs to non-members, rewrite finalized history, or expose group/profile relationships. Settlement balances become an authorization problem, not just a UI bug.

**Warning signs:**
- Policies only use `is_group_member(group_id)` and do not validate referenced profile membership.
- Confirmed receipts remain editable through normal table update policies.
- Settlement writes come directly from the client.

**Prevention:** Add database constraints and RLS policies that verify every referenced profile is a member of the same group. Restrict confirmed receipt updates to controlled server-side flows. Use RPCs for finalization and settlements so policy complexity stays testable.

**Detection:** RLS tests should attempt cross-group allocations, non-member profile IDs, edits to confirmed receipts, and settlement writes from non-owners/non-participants.

**Phase should address:** Security foundation and persistence phase, before activity/settlement screens.

### Pitfall 5: Building Receipt Capture Before Storage Authorization and OCR Contract Validation

**What goes wrong:** The app captures or imports images, uploads them to arbitrary paths, and sends `imagePath` to `recognize-receipt` without proving ownership or validating the returned draft.

**Why it happens:** The current edge function accepts any non-empty `imagePath` and returns an empty draft. Supabase Storage bucket migrations and policies are not present. Official Supabase Storage docs state uploads require explicit RLS policies on `storage.objects`, and service keys bypass RLS and must not be shared publicly.

**Consequences:** Users can process or reference another user's receipt image path, private images can leak, OCR failures crash the review flow, and the app stores untrusted provider output.

**Warning signs:**
- Receipt paths are constructed from filenames only.
- Storage bucket policies are absent or broad.
- Edge function accepts unauthenticated requests.
- OCR response is cast to app types without parsing.

**Prevention:** Create a private receipt-images bucket with path rules scoped by user/group. Validate image path ownership before recognition. Require authenticated function invocation unless there is a deliberate anonymous flow. Parse OCR responses with a schema and convert to the app's canonical receipt draft.

**Detection:** Tests should cover unauthenticated function calls, malformed JSON bodies, missing image paths, cross-user paths, provider timeout/failure, and invalid OCR amounts.

**Phase should address:** Receipt capture/import/upload phase and edge-function/OCR phase before review handoff.

### Pitfall 6: Treating Supabase Auth as a Button Handler Instead of App State Infrastructure

**What goes wrong:** Login appears to work, but sessions do not restore reliably after app restart, protected screens render before auth state is known, and sign-out leaves stale group/receipt state in memory.

**Why it happens:** Current UI uses local route state. Supabase's React Native guide expects `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, platform-aware storage, `processLock`, and app-state-driven token refresh; the current client enables `persistSession` but has no React Native storage adapter.

**Consequences:** RLS calls fail intermittently, users see another session's cached data, and the app cannot reliably test owner/member/non-member flows.

**Warning signs:**
- `isAuthenticated` is local React state rather than Supabase session state.
- Supabase client is created with empty URL/key fallbacks.
- No loading state while restoring the session.
- Sign-out only navigates to Login.

**Prevention:** Fix Supabase client setup first: fail clearly when env vars are missing, add the React Native storage adapter, subscribe to auth state changes, restore session before rendering protected routes, and clear group/receipt caches on sign-out.

**Detection:** Manual and automated tests should restart the app, verify session restoration, sign out, and confirm protected data is no longer visible.

**Phase should address:** Authentication foundation phase.

### Pitfall 7: Letting Prototype Navigation Become the Production Flow

**What goes wrong:** More screens are added to the current local string route state, creating inconsistent back behavior, missing route params, and untestable nested flows.

**Why it happens:** `src/App.tsx` currently owns routing, state, UI, and styles in one large file. Existing header back controls already render without actions on some screens.

**Consequences:** Users can land in review without an active group or receipt draft, back buttons do nothing, and save/cancel behavior loses edits. Every feature conflicts in the same file.

**Warning signs:**
- New routes are added as string literals in `App.tsx`.
- Screens pull data from module-level demo imports.
- Route-specific state is shared through broad app-level variables.
- Header behavior is patched per screen.

**Prevention:** Split screens/components early and introduce typed navigation or a route reducer with explicit params. Define required screen preconditions: active session, active group, receipt draft, saved expense ID.

**Detection:** Interaction tests should cover login guard, group selection, scan -> review handoff, review cancel/save, activity detail navigation, and header/back behavior.

**Phase should address:** Foundation/navigation refactor phase, before adding missing screens in parallel.

## Moderate Pitfalls

### Pitfall 8: Completing Activity and Settlements Before the Ledger Model Is Canonical

**What goes wrong:** Activity and settlement screens calculate balances from client-side demo data or incomplete receipt rows, then need to be rewritten when persistence is finalized.

**Warning signs:**
- Settlement math lives in UI components.
- Activity rows are derived from receipt drafts rather than confirmed expenses.
- Settlement history has no immutable audit row.

**Prevention:** Build activity from confirmed ledger records only. Treat settlements as their own auditable events, not edits to historical receipt shares. Reuse the same canonical balance calculation in tests and UI.

**Phase should address:** Activity/settlements phase after persistence phase.

### Pitfall 9: Under-Specifying the Human Review Workflow for OCR

**What goes wrong:** OCR output is treated as mostly correct, and the review screen only lets users assign items. Real receipts need merchant/date edits, line-item corrections, tax/tip/fees/discount handling, deletions, and confidence/error states.

**Warning signs:**
- No explicit "needs review" reasons.
- Users cannot edit totals independently from line items.
- Low-confidence OCR fields look final.

**Prevention:** Treat OCR as draft generation. Require human confirmation before ledger save. Preserve raw OCR/confidence metadata for debugging, but save only validated canonical fields.

**Phase should address:** Receipt review editing phase.

### Pitfall 10: Ignoring Offline, Retry, and Interruption States in Mobile Capture

**What goes wrong:** A user takes a receipt photo, leaves the app, loses network, or gets an upload/OCR timeout, and the draft disappears.

**Warning signs:**
- Capture result exists only in component state.
- Upload has no retry/cancel state.
- Review cannot resume from a pending draft.

**Prevention:** Add a minimal local draft lifecycle: captured, uploading, recognizing, needs_review, save_failed, confirmed. Persist enough local metadata to resume or discard safely. Keep v1 simple but explicit.

**Phase should address:** Receipt capture/import/upload phase.

### Pitfall 11: Leaving Profile Visibility and Member Identity Too Broad

**What goes wrong:** All signed-in users can browse all profiles, or group member displays rely on stale/freeform names rather than scoped identity.

**Warning signs:**
- Profile select policy remains globally readable.
- Invite/search UI queries all profiles.
- Receipt allocations store display names rather than profile IDs.

**Prevention:** Restrict profile reads to shared groups or expose only a minimal public profile view. Store allocations by profile ID and render display fields through scoped member queries.

**Phase should address:** Auth/profile and group/member management phase.

### Pitfall 12: Treating Typecheck as Optional While Reworking App Boundaries

**What goes wrong:** Screen extraction, service layers, and DTO mappers are added while `npm run typecheck` is already broken, so contract regressions are invisible.

**Warning signs:**
- New TypeScript files are added before the Expo/TypeScript config is fixed.
- Tests pass but typecheck still fails.
- Allocation `.d.ts` changes are made by hand without runtime changes.

**Prevention:** Fix TypeScript/Expo compatibility before major refactors. Convert or strongly type allocation boundaries when touching the domain layer.

**Phase should address:** Technical foundation phase.

## Minor Pitfalls

### Pitfall 13: Over-Polishing Reference UI Before Real Workflows

**What goes wrong:** The app matches the checked-in design reference but still cannot authenticate, save receipts, or show real balances.

**Prevention:** Use the monochrome iOS-first reference as visual guidance only. Prioritize usable vertical slices with loading, empty, error, and disabled states.

**Phase should address:** All UI phases; polish should follow verified functionality.

### Pitfall 14: Adding Social Sign-In Labels Without Provider Setup

**What goes wrong:** Apple/Google buttons remain visible but not functional, or OAuth callback/deep-link behavior is incomplete.

**Prevention:** Either implement and test provider flows end to end or hide them for v1. Email/password is acceptable if it enables secure ledger workflows sooner.

**Phase should address:** Authentication phase.

### Pitfall 15: Missing Observability Around Edge and Persistence Failures

**What goes wrong:** OCR or save failures show generic errors and leave no useful diagnostic trail.

**Prevention:** Add structured error codes at service boundaries and log non-sensitive request IDs/statuses. Do not log receipt image contents, access tokens, or full OCR text by default.

**Phase should address:** Edge-function/OCR and persistence phases.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Technical foundation | Typecheck stays broken while app is refactored | Fix Expo/TypeScript compatibility first; require `npm run typecheck` for later phases |
| Authentication | Session state is local UI state | Implement Supabase React Native auth storage, app-state refresh, protected route loading, and sign-out cache clearing |
| Group/member management | Created groups are inaccessible | Add owner-membership bootstrap trigger/RPC and RLS tests |
| Receipt capture/upload | Image paths are untrusted | Add private bucket, storage RLS, path ownership validation, and upload failure states |
| OCR edge function | Provider output becomes app truth | Require auth/path validation, schema parsing, confidence states, and human review |
| Receipt review | Money parsing and allocation rules drift | Centralize DTOs/mappers, use integer cents, expand allocation tests |
| Save-to-ledger | Partial multi-table client writes | Use transactional RPC/function with idempotency and server-side recomputation |
| Activity | UI reads draft/incomplete data | Read confirmed ledger entries only |
| Settlements | Settlements mutate history | Store auditable settlement events and derive balances from immutable ledger records |
| Profile/account | Profile data is globally visible | Scope profile reads to shared groups or expose a minimal public view |

## Recommended Roadmap Guardrails

1. **Foundation first:** Fix typecheck, split the app shell, establish navigation/preconditions, and configure Supabase React Native auth correctly.
2. **Security before writes:** Add group owner bootstrap, profile/member scoping, storage policies, and RLS tests before exposing create/save flows.
3. **Receipt pipeline as a draft lifecycle:** Capture/upload/OCR should produce a validated draft, not a ledger entry.
4. **Review before persistence:** All OCR and user edits must pass canonical allocation validation before save.
5. **Persistence before balances:** Activity and settlements should wait until confirmed ledger writes are transactional and tested.

## Sources

- Local project context: `.planning/PROJECT.md` (2026-06-10) - HIGH confidence.
- Local audit: `.planning/codebase/CONCERNS.md` (2026-06-10) - HIGH confidence.
- Local testing audit: `.planning/codebase/TESTING.md` (2026-06-10) - HIGH confidence.
- Local integration audit: `.planning/codebase/INTEGRATIONS.md` (2026-06-10) - HIGH confidence.
- Supabase React Native Auth docs: https://supabase.com/docs/guides/auth/quickstarts/react-native - HIGH confidence for required client setup patterns.
- Supabase Row Level Security docs: https://supabase.com/docs/guides/database/postgres/row-level-security - HIGH confidence for RLS concepts and policy dependency.
- Supabase Edge Function Auth docs: https://supabase.com/docs/guides/functions/auth - HIGH confidence for authenticated function patterns.
- Supabase Storage Access Control docs: https://supabase.com/docs/guides/storage/security/access-control - HIGH confidence for storage RLS requirements and service-key warning.
- Supabase Storage Uploads docs: https://supabase.com/docs/guides/storage/uploads/standard-uploads - HIGH confidence for upload behavior and path/upsert cautions.
- Expo Camera docs: https://docs.expo.dev/versions/latest/sdk/camera/ - MEDIUM confidence for capture/permission lifecycle guidance; specific implementation still needs phase-level validation against installed Expo SDK.
