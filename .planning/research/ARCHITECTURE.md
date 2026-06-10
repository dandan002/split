# Architecture Research: Split v1

**Domain:** iOS-first trip receipt splitting app  
**Project:** Split  
**Researched:** 2026-06-10  
**Overall confidence:** HIGH for app/backend boundaries, MEDIUM for exact library choices until implementation spikes verify Expo SDK 56 compatibility in this repo.

## Executive Recommendation

Split should grow from the prototype into a feature-oriented Expo app with clear vertical slices: navigation routes and screen composition in `app/`, reusable UI in `src/components/`, domain logic in `src/core/`, Supabase access in `src/services/`, and generated database types plus mappers in `src/types/` or `src/data/`. The current `src/App.tsx` should become a temporary migration source, not the long-term integration point for auth, OCR, receipt editing, and ledger persistence.

Use Expo Router for v1 navigation. Official Expo Router docs position it as the recommended routing layer for new Expo apps because it provides file-based routes, typed routes, deep linking, and route-level lazy evaluation. That maps directly to Split's growth path: auth screens, protected tabs, group detail, scan, receipt review, activity, settlement detail, and profile are already outgrowing local string state.

Keep Supabase as the only v1 backend. The architecture should treat Supabase in three service categories: client repositories for simple reads/writes, Postgres RPCs for atomic ledger-confirmation operations, and Edge Functions for external receipt-recognition provider isolation. The existing schema already models groups, memberships, receipts, receipt items, adjustments, allocations, expenses, and shares, but group creation, receipt confirmation, and share creation need server-side transactional boundaries before real users can trust the ledger.

The allocation engine is the core product invariant and should remain framework-neutral. Convert it to TypeScript or add stronger runtime validation around its public input shape, but do not bind it to React, Supabase, Expo, or OCR. Screens and services should prepare valid `ReceiptInput` objects, call the core allocator, and then persist only confirmed allocation outputs.

## Target Module Structure

Recommended structure after the first foundation phase:

```text
app/
  _layout.tsx
  (auth)/
    login.tsx
    signup.tsx
  (tabs)/
    _layout.tsx
    groups.tsx
    activity.tsx
    scan.tsx
    profile.tsx
  groups/
    [groupId].tsx
    [groupId]/members.tsx
  receipts/
    review.tsx
  settlements/
    [groupId].tsx
src/
  components/
    AppHeader.tsx
    EmptyState.tsx
    MoneyText.tsx
    MemberAvatarStrip.tsx
    ReceiptLineItemRow.tsx
  core/
    allocation.ts
    settlement.ts
    money.ts
    receiptDraft.ts
  features/
    auth/
      AuthProvider.tsx
      useAuthSession.ts
    groups/
      groupHooks.ts
      groupMappers.ts
    receipts/
      receiptHooks.ts
      receiptMappers.ts
      receiptDraftStore.ts
    ledger/
      ledgerHooks.ts
      ledgerMappers.ts
  services/
    supabaseClient.ts
    authService.ts
    groupService.ts
    receiptService.ts
    ledgerService.ts
    storageService.ts
    recognitionService.ts
  theme/
    index.ts
  types/
    database.ts
    domain.ts
supabase/
  migrations/
  functions/
    recognize-receipt/
```

This is intentionally not a heavy enterprise layering scheme. The important rule is dependency direction:

```text
routes/screens -> feature hooks -> services/repositories -> Supabase
routes/screens -> components
feature hooks -> core mappers/validators
services -> core mappers/validators
core -> no React, no Expo, no Supabase
supabase/functions -> provider helpers and schemas only
```

## Component Boundaries

| Component | Responsibility | Communicates With | Notes |
|-----------|----------------|-------------------|-------|
| Expo Router `app/` routes | Navigation, route params, protected route grouping, screen-level layout | Feature hooks, shared components | Replace local `Route` string state early. Auth and tabs should be route groups, not conditionals in one file. |
| Auth provider | Restore session, subscribe to auth changes, expose user/profile/session state | Supabase auth client, profile service, route guards | Must use React Native storage and app-state refresh behavior from Supabase RN docs. |
| Shared UI components | Reusable visual primitives: headers, buttons, empty states, receipt rows, avatar strips | Theme tokens, feature props | Keep visual logic here; no Supabase calls inside components. |
| Feature hooks | Screen-specific orchestration for queries, mutations, loading/error states | Services, TanStack Query if adopted, core validators | Hooks are the right place for `useGroup`, `useGroupMembers`, `useReceiptDraft`, `useSaveReceipt`. |
| Services/repositories | Typed Supabase reads/writes, storage upload, edge-function invocation | Supabase client, database mappers, core validators | No React imports. Return domain DTOs or typed errors. |
| Core domain | Money parsing/formatting, receipt allocation, save validation, settlement simplification | Called by hooks/services/tests | Must remain deterministic and testable with Node. |
| Database RPCs | Atomic group bootstrap, receipt confirmation, share persistence, settlement recording | Called through `supabase.rpc` from services | Use for multi-table writes that must succeed or fail together. |
| Edge functions | OCR provider calls and image-path authorization checks | Supabase Storage, OCR provider, receipt draft schema | Return `needs_review` drafts only; never directly finalize user balances. |
| Supabase migrations | Tables, constraints, indexes, RLS, storage policies, triggers/RPCs | Supabase runtime | Every new table or mutation path needs RLS in the same phase. |

## Service Boundaries

### `authService`

Responsibilities:
- Sign in/sign up/sign out.
- Restore session on app boot.
- Subscribe to auth state changes.
- Create or load the user's profile.

Required architecture decision:
- Replace `src/lib/supabase.ts` with a React Native-ready client setup using `@react-native-async-storage/async-storage`, `processLock`, and `AppState` auto-refresh behavior. Supabase's current React Native quickstart shows this exact pattern, including `detectSessionInUrl: false`, `persistSession: true`, and foreground/background token refresh.

### `groupService`

Responsibilities:
- List groups visible to current user.
- Create a group.
- Read group detail and member list.
- Invite/add/remove members or change roles.

Server-side requirement:
- Group creation should not rely on a client doing two writes. Add a trigger or RPC that creates the `trip_groups` row and owner `group_memberships` row atomically. The current schema allows group insert but does not bootstrap creator membership, which can make a new group inaccessible under RLS.

### `storageService`

Responsibilities:
- Upload receipt images under an authenticated, group-scoped path.
- Return canonical storage paths, not raw local file URIs.
- Enforce file type and size limits before upload.

Server-side requirement:
- Add Storage bucket policies. Supabase Storage access control is based on Postgres RLS policies, so receipt images need the same membership model as receipt rows.

### `recognitionService`

Responsibilities:
- Invoke `recognize-receipt` with a validated storage path.
- Normalize the edge-function response into a `ReceiptDraft`.
- Surface `processing`, `needs_review`, and `failed` states.

Boundary rule:
- OCR is never trusted enough to write expenses or shares. It creates a draft that must pass review and allocation validation.

### `receiptService`

Responsibilities:
- Create/update/read receipt drafts.
- Map UI draft shape to database row shapes.
- Persist edited items, adjustments, and item allocation assignments.
- Load a review-ready draft by `receiptId`.

Boundary rule:
- Keep draft editing separate from final ledger confirmation. Draft rows can be mutable; confirmed expenses and shares should be treated as ledger records.

### `ledgerService`

Responsibilities:
- Confirm a reviewed receipt as an expense.
- Persist `expenses`, `receipts`, `receipt_items`, `receipt_adjustments`, `item_allocations`, and `expense_shares`.
- Read group activity, balances, and settlement history.

Server-side requirement:
- Receipt confirmation should be a Postgres RPC, not a sequence of client inserts. The client should send a validated draft payload and allocator output; the RPC should verify membership, profile IDs, totals, and then perform all writes in one database transaction.

## Data Flow

### App Startup and Auth

1. Expo loads the router root layout.
2. `AuthProvider` creates/uses the singleton Supabase client.
3. Auth provider calls `getSession`, subscribes to `onAuthStateChange`, and starts/stops token refresh based on React Native `AppState`.
4. Root route group redirects unauthenticated users to `(auth)` and signed-in users to `(tabs)`.
5. Once signed in, profile and group queries are enabled.

### Group List to Active Group

1. `groups.tsx` calls `useGroups()`.
2. `useGroups()` delegates to `groupService.listGroups()`.
3. The service reads `trip_groups` joined with membership/summary data visible through RLS.
4. Selecting a group navigates to `groups/[groupId]`.
5. Scan and activity flows should require an active `groupId` route param or explicit selected group state.

### Receipt Capture to Review

1. User opens `scan.tsx` inside a selected group context.
2. Capture/import uses Expo ImagePicker first for v1 simplicity because it provides camera and photo-library access through the system UI; Expo Camera can follow if the app needs a custom viewfinder.
3. `storageService.uploadReceiptImage(groupId, localUri)` stores the image in a membership-protected bucket path.
4. `recognitionService.recognizeReceipt({ groupId, imagePath })` invokes the edge function.
5. Edge function verifies auth and image-path ownership/membership, calls OCR provider or stub, and returns a draft with `status: needs_review`.
6. App saves or holds the draft and navigates to `receipts/review?groupId=...&receiptId=...`.

### Receipt Review and Allocation

1. Review route loads the draft and group members.
2. UI edits merchant/date/items/adjustments/assignments in local draft state, ideally isolated in a `useReceiptDraftStore` hook.
3. Draft mappers convert UI fields to `ReceiptInput`.
4. `canSaveReceipt` validates unassigned items, invalid amounts, and total mismatch.
5. The screen displays per-member totals from `allocateReceipt`.
6. Save is enabled only when validation is OK and all assignment profile IDs are members of the active group.

### Confirm Receipt to Ledger

1. `useConfirmReceipt()` builds a command payload:
   - group id
   - payer id
   - merchant/date/currency/total
   - item rows
   - adjustment rows
   - assignment rows
   - computed item/adjustment/member shares
2. Client calls `ledgerService.confirmReceipt()`.
3. Service calls a Postgres RPC such as `public.confirm_receipt(payload jsonb)`.
4. RPC validates current user membership, payer membership, all allocation profile IDs, receipt total, and idempotency key.
5. RPC inserts/updates all ledger tables in one transaction and marks receipt `confirmed`.
6. Client invalidates group activity, receipt list, balances, and settlement queries.

### Activity and Settlement

1. Activity screen reads confirmed expenses and receipt summaries for the group.
2. Settlement screen reads `expense_shares` and payments/settlements.
3. Settlement math should live in `src/core/settlement.ts` as a pure function that converts net balances into "who owes whom" transfers.
4. Recording a settlement should be its own table and RPC in a later phase; do not overload `expense_shares` as both receipt shares and settlement history.

## State Management Pattern

Use local React state for short-lived form fields and receipt draft edits; use a server-state library for Supabase reads/mutations once real backend flows begin. TanStack Query is a good fit because its docs explicitly support React Native and provide patterns for reconnect handling through `onlineManager`; it also gives query invalidation and mutation state without inventing a global store.

Recommendation:
- Add TanStack Query when the first Supabase-backed screens are built.
- Use query keys scoped by session and group, for example `['groups']`, `['group', groupId]`, `['receiptDraft', receiptId]`, `['balances', groupId]`.
- Keep receipt editing in component/local hook state until save; persist autosave later if needed.
- Do not add Redux/Zustand for v1 unless offline drafts become a central requirement. Current needs are mostly server state plus a few local form states.

## Patterns to Follow

### Pattern 1: Feature Hooks Over Direct Screen Queries

**What:** Screens call feature hooks; hooks call services; services call Supabase.

**Why:** This keeps loading/error/mutation behavior testable and prevents screen files from becoming SQL/query builders.

**Example:**

```typescript
export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => groupService.listMembers(groupId),
    enabled: Boolean(groupId),
  });
}
```

### Pattern 2: Mappers at Every Boundary

**What:** Convert between database rows, edge-function DTOs, UI drafts, and allocation-core inputs explicitly.

**Why:** The current code already has shape drift: UI uses `amountCents`, database rows use `total_amount_cents`, and OCR returns `totalAmountCents`. Mappers make this drift visible and testable.

**Example:**

```typescript
export function toAllocationInput(draft: ReceiptDraft, members: Member[]): ReceiptInput {
  return {
    members,
    items: draft.items.map((item) => ({
      id: item.id,
      amountCents: item.amountCents,
      allocations: item.allocations,
    })),
    adjustments: draft.adjustments,
    receiptTotalCents: draft.receiptTotalCents,
  };
}
```

### Pattern 3: RPC for Atomic Ledger Writes

**What:** Multi-table confirmed ledger writes happen inside Postgres.

**Why:** Client-side sequences can leave partial expenses, orphaned receipt rows, or shares that do not match item allocations. Money-critical writes need one transaction and server-side authorization checks.

**Example flow:**

```typescript
export async function confirmReceipt(command: ConfirmReceiptCommand) {
  const { data, error } = await supabase.rpc('confirm_receipt', {
    payload: command,
  });

  if (error) {
    throw mapSupabaseError(error);
  }

  return toConfirmedExpense(data);
}
```

### Pattern 4: Review-Gated OCR

**What:** OCR only produces a draft; users confirm the ledger.

**Why:** OCR errors in line items, totals, tax, or discounts directly change who owes whom. The app should optimize review, not bypass it.

**Implementation guidance:**
- Store `raw_ocr` for diagnostics.
- Store confidence per receipt and per line item.
- Require human correction for low-confidence totals or mismatches.
- Do not write `expense_shares` until `canSaveReceipt` passes.

### Pattern 5: Domain Core as Shared Contract

**What:** Put money parsing, allocation, receipt validation, and settlement simplification in `src/core/` with Node tests.

**Why:** These rules must be independent from UI and backend integration. They should be callable from app hooks, service mappers, and test fixtures without Expo.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Extending `src/App.tsx`

**What goes wrong:** More screens and backend calls get bolted into one component.

**Consequences:** Merge conflicts, hard-to-test behavior, route bugs, and accidental coupling between unrelated screens.

**Instead:** Move to route files and feature modules before implementing real auth and receipt persistence.

### Anti-Pattern 2: Client-Orchestrated Ledger Persistence

**What goes wrong:** The client inserts expense, receipt, items, allocations, and shares in separate calls.

**Consequences:** Partial writes, stale totals, duplicated expenses on retry, and difficult RLS failures.

**Instead:** Use an RPC for confirmed receipt save with an idempotency key and transaction-scoped validation.

### Anti-Pattern 3: Trusting OCR Output

**What goes wrong:** Recognized totals and line items flow directly into expenses.

**Consequences:** Users get incorrect balances and lose trust in the core product.

**Instead:** Treat OCR output as a review draft; require validation and user confirmation.

### Anti-Pattern 4: Scattering Supabase Calls Through UI Components

**What goes wrong:** Every screen has its own query/mutation shapes and error handling.

**Consequences:** Hard to change schema, hard to test, inconsistent loading/error states.

**Instead:** Centralize Supabase access in services and expose screen-ready hooks.

### Anti-Pattern 5: Adding Offline Sync Too Early

**What goes wrong:** The app builds a general sync engine before the online ledger path is correct.

**Consequences:** High complexity around conflict resolution, stale group members, duplicate uploads, and inconsistent shares.

**Instead:** Ship v1 with explicit online states and retryable receipt draft saves. Add durable offline drafts after ledger correctness is verified.

## Build Order for Roadmap

### Phase 1: Architecture Foundation and Type Safety

Addresses:
- Split `src/App.tsx` into route/screen/component boundaries.
- Add Expo Router route structure.
- Fix TypeScript/Expo compatibility.
- Convert allocation core to TypeScript or add stronger validation and declaration sync.

Why first:
- Every later feature touches screens and route state. Splitting first reduces repeated conflicts and makes phase work parallelizable.

### Phase 2: Supabase Client, Auth, and Profile Session

Addresses:
- React Native Supabase client storage/refresh setup.
- Login/signup/session restoration/sign-out.
- Protected routes.
- Profile bootstrap and account screen base.

Why second:
- RLS and group data cannot be meaningfully verified without real authenticated users.

### Phase 3: Group and Membership Backbone

Addresses:
- Group list from Supabase.
- Group create/detail/member management.
- Owner-membership bootstrap trigger or RPC.
- RLS tests for owner/member/non-member.

Why third:
- Receipt capture and ledger writes need an active group and member list.

### Phase 4: Receipt Capture, Upload, and Recognition Draft

Addresses:
- Image capture/import.
- Storage bucket/path policies.
- Upload service.
- Edge function auth/path validation.
- Recognition response mapper.
- Scan processing/failure states.

Why fourth:
- Provides real input to the review workflow while still avoiding ledger mutation risk.

### Phase 5: Receipt Review Workflow

Addresses:
- Editable merchant/date/items/amounts/tax/tip/fees/discounts.
- Member assignment UI generated from actual group members.
- Allocation validation improvements.
- Draft persistence.

Why fifth:
- The review contract must be correct before final ledger writes are allowed.

### Phase 6: Confirm to Ledger

Addresses:
- `confirm_receipt` RPC.
- Atomic writes to expenses, receipts, items, adjustments, allocations, and shares.
- Query invalidation and activity feed.
- Tests for transaction and RLS behavior.

Why sixth:
- This is the money-critical v1 milestone. It depends on auth, group membership, capture, and review.

### Phase 7: Balances, Settlements, and Account Polish

Addresses:
- Activity screen.
- Balance summary.
- Settlement recommendations.
- Settlement recording.
- Profile preferences and sign-out polish.

Why last:
- Settlement output only matters after confirmed expenses and shares exist.

## Scalability Considerations

| Concern | v1 Approach | Later Approach |
|---------|-------------|----------------|
| Navigation | Expo Router file routes and protected groups | Deep links to receipt/group/settlement detail, universal links |
| Server state | TanStack Query around Supabase services | Persistence plugin/offline queue only if offline drafts are prioritized |
| Receipt drafts | Local state plus explicit save/confirm | Autosave drafts and resumable uploads |
| Ledger writes | Postgres RPC transaction | Idempotent queue with retries and audit logs |
| OCR | Single edge function returning review drafts | Provider abstraction, async jobs, confidence analytics |
| RLS performance | Index policy predicates and test common flows | Dedicated views/RPCs for aggregate balances |
| Settlement math | Pure `src/core/settlement.ts` from expense shares | Server-computed summaries/materialized views if groups grow large |

## Critical Architecture Decisions

| Decision | Recommendation | Confidence | Rationale |
|----------|----------------|------------|-----------|
| Navigation | Adopt Expo Router | HIGH | Official Expo docs recommend it for new apps; route count and auth guards already exceed local string routing. |
| Backend | Continue Supabase | HIGH | Schema, client, RLS direction, and edge-function stub already exist. |
| Server state | Add TanStack Query when Supabase screens begin | MEDIUM | Official docs support React Native and reconnect handling; verify dependency compatibility in implementation. |
| Global state | Avoid Redux/Zustand for v1 | MEDIUM | Current needs are server state plus local drafts, not complex cross-app client state. |
| Receipt save | Use Postgres RPC for confirmation | HIGH | Multi-table money writes require transactionality and server-side validation. |
| OCR | Edge Function returns review drafts only | HIGH | Provider integration and untrusted OCR output should stay isolated from ledger finalization. |
| Core math | Keep pure and strongly tested | HIGH | Allocation correctness is the product invariant. |

## Research Flags for Roadmap

- Supabase local RLS testing needs a dedicated phase or task. Current policy risks are known but not proven with automated tests.
- Expo SDK 56 plus TypeScript compatibility must be fixed before the repo can rely on typecheck as a guardrail.
- Supabase Storage policies are absent and need official implementation detail during the capture/upload phase.
- `confirm_receipt` RPC shape should be designed with tests before implementation because it becomes the central ledger contract.
- Social login should be deferred or separately researched if Apple/Google auth is required for v1; email/password can validate the architecture faster.

## Sources

- Expo Router introduction, official docs, last updated 2026-06-03. Confidence: HIGH. Used for navigation recommendation and typed/deep-linkable route rationale. https://docs.expo.dev/router/introduction/
- Supabase React Native auth quickstart, official docs. Confidence: HIGH. Used for React Native auth storage, `processLock`, and `AppState` token refresh setup. https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase JavaScript client initialization reference, official docs. Confidence: HIGH. Used for client boundary and auth API surface. https://supabase.com/docs/reference/javascript/initializing
- Supabase Row Level Security guide, official docs. Confidence: HIGH. Used for RLS/security model and policy implications. https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Database Functions guide, official docs. Confidence: HIGH. Used for database RPC recommendation, security-definer cautions, function privileges, and database-vs-edge function distinction. https://supabase.com/docs/guides/database/functions
- Supabase Storage access control guide, official docs. Confidence: HIGH. Used for storage policy requirement. https://supabase.com/docs/guides/storage/security/access-control
- Supabase Edge Functions auth guide, official docs. Confidence: MEDIUM. Used for edge-function authentication direction. https://supabase.com/docs/guides/functions/auth
- Expo ImagePicker docs, official docs. Confidence: HIGH. Used for v1 image capture/import recommendation. https://docs.expo.dev/versions/latest/sdk/imagepicker/
- TanStack Query React Native docs, official docs. Confidence: MEDIUM. Used for server-state recommendation and React Native reconnect handling. https://tanstack.com/query/latest/docs/framework/react/react-native
