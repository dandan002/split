# Roadmap: Split

**Created:** 2026-06-10
**Granularity:** Coarse
**Core Value:** Users can capture a shared receipt, assign each line item to the right people, and save an accurate ledger entry with trustworthy per-person totals.

## Overview

| Phase | Name | Goal | Requirements | UI hint | Status |
|-------|------|------|--------------|---------|--------|
| 1 | Foundation and App Structure | Make the codebase ready for real feature work with passing checks, routed app structure, shared components, and receipt DTO boundaries. | FOUND-01..FOUND-04 | yes | Pending |
| 2 | Authentication and Profile Bootstrap | Replace demo login with real Supabase auth, session restoration, protected routes, and profile creation/loading. | AUTH-01..AUTH-05 | yes | Pending |
| 3 | Groups and Memberships | Build real trip group and member management backed by secure owner bootstrap and RLS behavior. | GRP-01..GRP-06 | yes | Pending |
| 4 | Receipt Capture and OCR Drafts | Connect camera/photo import, storage upload, recognition invocation, processing states, and review handoff. | RCPT-01..RCPT-06 | yes | Pending |
| 5 | Receipt Review and Allocation UX | Turn receipt review into a complete editable, validated assignment workflow with live member totals. | REV-01..REV-08 | yes | Pending |
| 6 | Atomic Ledger Persistence | Save confirmed receipts and shares transactionally, prevent partial ledgers, and harden allocation validation. | LEDG-01..LEDG-05 | yes | Pending |
| 7 | Activity, Settlements, and Account Polish | Build saved-data activity, balances, settlement recording/history, and final profile/account screens. | ACT-01..ACT-03, SETL-01..SETL-04, PROF-01..PROF-04 | yes | Pending |

## Phase Details

### Phase 1: Foundation and App Structure

**Goal:** Make the codebase ready for real feature work with passing checks, routed app structure, shared components, and receipt DTO boundaries.

**Why now:** The existing app is a single-file prototype and `npm run typecheck` is broken. Adding screens before fixing structure would compound merge and correctness risk.

**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04

**Deliverables:**
- Expo/TypeScript configuration and dependencies aligned so `npm test` and `npm run typecheck` pass.
- App routing shell with unauthenticated/authenticated boundaries, tabs, group detail route, receipt routes, and settlement routes.
- Screen/component/module structure for new work, preserving current visual language.
- Receipt DTO and mapper layer covering OCR response, UI draft, database rows, and allocation input.

**Success Criteria:**
1. A developer can run `npm test` and `npm run typecheck` successfully.
2. Existing prototype screens still render through the new app/navigation structure.
3. New v1 screens have clear homes under feature modules or shared components instead of expanding the monolithic `src/App.tsx`.
4. Receipt mapper tests prove UI/OCR/database/allocation shape conversions are explicit.

**Risks:**
- Dependency changes may require careful Expo SDK compatibility checks.
- Router migration can break existing prototype navigation if done too broadly.

### Phase 2: Authentication and Profile Bootstrap

**Goal:** Replace demo login with real Supabase auth, session restoration, protected routes, and profile creation/loading.

**Why now:** RLS-backed groups, receipts, and storage all require authenticated user identity.

**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05

**Deliverables:**
- Email/password sign-up, sign-in, sign-out, and session restoration.
- React Native Supabase auth storage configuration.
- Profile bootstrap flow for first authenticated session.
- Auth loading, error, empty, and backend-missing states.
- Protected route behavior that keeps unauthenticated users out of app tabs.

**Success Criteria:**
1. A user can create an account and reach the app with a persisted session.
2. A returning user stays signed in after app restart.
3. Signing out returns the user to the auth flow and clears protected app state.
4. Missing Supabase configuration is surfaced clearly instead of failing silently.

**Risks:**
- Supabase client currently creates with empty environment values unless guarded.
- OAuth buttons exist but are not v1-critical unless explicitly scoped later.

### Phase 3: Groups and Memberships

**Goal:** Build real trip group and member management backed by secure owner bootstrap and RLS behavior.

**Why now:** Receipts must belong to a group, and group membership drives RLS authorization.

**Requirements:** GRP-01, GRP-02, GRP-03, GRP-04, GRP-05, GRP-06

**Deliverables:**
- Migration or RPC/trigger that creates owner membership when a trip group is created.
- Group list from Supabase data, replacing demo group rows.
- Create group screen and group detail screen.
- Member list/add/remove flows with owner constraints.
- RLS verification for owner, member, non-member, and anonymous cases.

**Success Criteria:**
1. Creating a group immediately makes the creator an owner who can read and manage it.
2. Group list and detail screens show real backend data.
3. Owner can add and remove members within safe constraints.
4. Non-members cannot access group data through client calls or direct RLS checks.

**Risks:**
- Removing members with existing expenses needs explicit constraints.
- Profile visibility policy may need tightening before member search is expanded.

### Phase 4: Receipt Capture and OCR Drafts

**Goal:** Connect camera/photo import, storage upload, recognition invocation, processing states, and review handoff.

**Why now:** The current scanner is static; v1 needs a real way to create receipt drafts before review.

**Requirements:** RCPT-01, RCPT-02, RCPT-03, RCPT-04, RCPT-05, RCPT-06

**Deliverables:**
- Receipt capture/import entry points from an active group.
- Camera and photo-library permission flows.
- Group/user-scoped storage upload path and storage policy.
- Receipt recognition function request validation and auth/path authorization.
- Processing, retry, failed, and needs-review screen states.
- Handoff from recognized draft into receipt review.

**Success Criteria:**
1. User can capture or import an image and see it enter processing for a selected group.
2. Invalid or unauthorized image paths are rejected by the edge-function boundary.
3. Recognition failure is recoverable without losing the selected group context.
4. Successful recognition creates a validated draft for the review screen.

**Risks:**
- OCR provider details are deferred; the contract must still be stable.
- Storage paths and policies must not leak cross-group receipt images.

### Phase 5: Receipt Review and Allocation UX

**Goal:** Turn receipt review into a complete editable, validated assignment workflow with live member totals.

**Why now:** Receipt review is the product’s trust point and differentiator.

**Requirements:** REV-01, REV-02, REV-03, REV-04, REV-05, REV-06, REV-07, REV-08

**Deliverables:**
- Editable merchant/date/currency/subtotal/total fields.
- Add/edit/delete/reorder line item controls.
- Add/edit/delete/classify adjustment controls for tax, tip, fees, discounts, and credits.
- Member assignment UI for equal, weighted, and custom allocations.
- Adjustment allocation strategy UI for proportional, equal, and custom distribution.
- Low-confidence field markers and validation issue summary.
- Live member totals with save disabled until valid.

**Success Criteria:**
1. User can fully correct a noisy OCR draft without leaving review.
2. Every item can be assigned to valid group members with clear visual feedback.
3. Tax/tip/fee/discount allocation changes immediately update member totals.
4. Save is blocked for invalid totals, unassigned items, unknown members, or malformed amounts.

**Risks:**
- Money math regressions are easy here; add tests before behavior changes.
- Complex assignment UI can become slow or confusing if not constrained.

### Phase 6: Atomic Ledger Persistence

**Goal:** Save confirmed receipts and shares transactionally, prevent partial ledgers, and harden allocation validation.

**Why now:** Activity and settlements must depend on real, consistent ledger data.

**Requirements:** LEDG-01, LEDG-02, LEDG-03, LEDG-04, LEDG-05

**Deliverables:**
- Transaction-backed save boundary for expenses, receipts, items, adjustments, allocations, and shares.
- Database/RPC validation for group membership and receipt state transitions.
- Tests for invalid members, malformed money input, negative adjustments, custom allocations, and save failure behavior.
- Saved receipt/expense read path.
- Controlled reopen/read-only receipt detail behavior.

**Success Criteria:**
1. Confirming a receipt writes all ledger records or none of them.
2. App can load the saved expense and receipt from backend data.
3. Partial failure tests prove no inconsistent ledger rows remain.
4. Allocation edge-case tests pass before save is exposed to users.

**Risks:**
- Client-side insert chains would create partial ledger risk; avoid them.
- RLS and RPC security need explicit tests, not visual-only verification.

### Phase 7: Activity, Settlements, and Account Polish

**Goal:** Build saved-data activity, balances, settlement recording/history, and final profile/account screens.

**Why now:** These screens are useful only after real groups and ledger entries exist.

**Requirements:** ACT-01, ACT-02, ACT-03, SETL-01, SETL-02, SETL-03, SETL-04, PROF-01, PROF-02, PROF-03, PROF-04

**Deliverables:**
- Activity feed backed by saved expense/receipt/settlement events.
- Activity detail navigation to receipts, expenses, and settlements.
- Group balances by member.
- Suggested settlement transfers.
- Manual settlement recording and settlement history.
- Profile/account screen with display name, avatar support where storage is available, sign-out, and backend/session state.
- Final empty/loading/error/refresh states across v1 tabs.

**Success Criteria:**
1. User can understand who owes whom from real saved ledger data.
2. Recording a settlement updates balances and appears in history/activity.
3. Activity items open the relevant saved object.
4. Profile/account supports display-name editing, sign-out, and clear backend/session status.

**Risks:**
- Settlement math must be based on persisted shares and settlements, not duplicated UI calculations.
- Avatar upload should reuse storage policy patterns from receipt images.

## Coverage

- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

## Phase Dependency Graph

```text
1 Foundation and App Structure
  -> 2 Authentication and Profile Bootstrap
  -> 3 Groups and Memberships
  -> 4 Receipt Capture and OCR Drafts
  -> 5 Receipt Review and Allocation UX
  -> 6 Atomic Ledger Persistence
  -> 7 Activity, Settlements, and Account Polish
```

---
*Roadmap created: 2026-06-10*
