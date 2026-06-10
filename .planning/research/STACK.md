# Technology Stack Research: Split v1 Completion

**Project:** Split, an iOS-first trip receipt splitting app  
**Research type:** Stack dimension  
**Researched:** 2026-06-10  
**Overall confidence:** HIGH for current codebase direction, MEDIUM for exact new dependency versions until installed with `npx expo install`

## Recommendation

Complete v1 by staying on the existing Expo React Native + Supabase stack. Do not rewrite to native iOS, do not replace Supabase, and do not introduce a heavyweight state framework yet. The missing work is integration, routing, persistence, validation, and test coverage around the stack already present.

The stack should move from "single-file prototype" to "thin app shell with typed services":

```text
Expo Router / route layouts
  -> screens and feature components
  -> TanStack Query hooks for Supabase server state
  -> service/repository modules for auth, groups, receipts, settlements
  -> framework-neutral core allocation + mapping/validation
  -> Supabase Auth/Postgres/Storage/Edge Functions/RLS
```

## Recommended Stack

### Core Runtime

| Technology | Current / Target | Purpose | Direction |
|------------|------------------|---------|-----------|
| Expo | Current `^56.0.9` | React Native runtime, SDK package compatibility, iOS developer flow | Keep. Expo SDK 56 officially targets React Native 0.85, React 19.2.3, and Node 22.13.x minimum, matching the repo's package set except local Node is newer. |
| React Native | Current `0.85.3` | Native mobile UI | Keep under Expo's version constraints. Do not independently upgrade RN outside Expo. |
| React | Current `19.2.3` | Component model | Keep with Expo SDK 56. |
| TypeScript | Current `~5.3.3`, target SDK-compatible newer version | Static typing | Fix immediately. Current `npm run typecheck` fails against Expo's base config. Install the Expo-compatible TypeScript version and set module resolution to Expo's expected modern mode, likely `bundler`, then verify. |
| npm | Current lockfile v3 | Package management | Keep. Use `npx expo install` for Expo/RN native packages so versions match SDK 56. |

### App Structure and Navigation

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| Expo Router | Not installed | File-based routing, protected route groups, auth/layout boundaries, deep-link readiness | Add early. The current string route state cannot support auth guards, group detail, receipt review params, settlement detail, or profile flows cleanly. |
| `react-native-safe-area-context` | Not installed | iOS safe area handling | Add with Expo Router. |
| `react-native-screens` | Not installed | Native screen primitives used by navigation | Add with Expo Router. |
| `expo-linking`, `expo-constants` | Not installed | Router/deep-link support | Add with Expo Router if not pulled in transitively by the Expo install recipe. |
| Existing `@expo/vector-icons` | Installed | Icons | Keep. It is enough for v1. Do not add a second icon system. |

Prescriptive route shape:

```text
src/app/
  _layout.tsx                  # Supabase/session bootstrap, QueryClientProvider
  (auth)/
    sign-in.tsx
    sign-up.tsx
  (app)/
    _layout.tsx                # protected tabs/stack
    groups/index.tsx
    groups/[groupId].tsx
    groups/[groupId]/members.tsx
    scan/index.tsx
    receipts/[receiptId]/review.tsx
    activity/index.tsx
    settlements/index.tsx
    profile/index.tsx
```

Do not migrate every component perfectly before building features. First create the route boundary and move current screens out of `src/App.tsx` enough to stop the single-file bottleneck.

### Backend and Data Access

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| Supabase JS | Current `^2.45.4` | Auth, Postgres, Storage, Edge Functions | Keep and update only if needed for current React Native auth guidance. Use publishable keys for new setup, while maintaining anon-key compatibility if the existing project still uses it. |
| Supabase Auth | Client configured but unused | Real sessions and protected routes | Implement first. Add React Native storage, app-state token refresh, and auth route guards before group/receipt writes. |
| Supabase Postgres + RLS | Schema exists | Persistent ledger and authorization | Keep. Add missing migrations for owner membership bootstrap, stricter profile visibility, storage bucket/policies, and validated receipt write constraints. |
| Supabase Storage | Not yet modeled in migrations | Receipt image upload | Add a private receipt-images bucket with path conventions scoped by user/group. Do this before invoking OCR on real images. |
| Supabase Edge Functions | Contract exists | Receipt recognition boundary | Keep. Expand `recognize-receipt` behind its existing contract; do not move OCR into the client. |
| SQL RPC / Postgres transaction function | Not present | Atomic receipt confirmation | Add for save-to-ledger. The app should not manually issue six independent writes for expenses, receipts, items, adjustments, allocations, and shares. |

Recommended service boundaries:

```text
src/lib/supabase.ts             # client singleton only
src/services/auth.ts            # sign in/out, session, profile bootstrap
src/services/groups.ts          # groups, memberships, invites/removals
src/services/receiptImages.ts   # image upload and storage paths
src/services/recognition.ts     # invoke recognize-receipt
src/services/receipts.ts        # drafts, mapper, confirm/save RPC
src/services/settlements.ts     # balances, activity, settlements
src/core/allocation.ts          # money math, no Supabase imports
src/core/receiptSchema.ts       # DTO validation/mappers
```

### Server State and Local State

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| TanStack Query | Not installed | Supabase query/mutation lifecycle, caching, refetching, optimistic/error states | Add after auth foundation. It is the right fit for group lists, group details, activity, receipt fetches, settlement summaries, and mutation invalidation. |
| `expo-network` or `@react-native-community/netinfo` | Not installed | React Native online status for TanStack Query | Prefer `expo-network` for Expo-managed compatibility unless a later package requires NetInfo. |
| React local state | Current | Form state, current draft edits, transient UI | Keep for editable receipt review and simple screen-local controls. |
| Zustand / Redux / MobX | Not installed | Global client state | Do not add for v1. Auth/session can live in a provider; server state belongs in TanStack Query; receipt draft state can stay local or in a small reducer. |
| Offline persistence | Not installed | Drafts during network loss | Defer full offline sync. For v1, persist only in-progress receipt drafts if needed after capture, using focused local storage rather than a full sync engine. |

### Native Device Capabilities

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| `expo-camera` | Installed | Receipt capture | Use for live capture only. Keep scanner UI pragmatic: capture image, preview, upload, process, review. |
| `expo-image-picker` | Installed | Import existing receipt image | Use alongside camera. It is already configured in `app.json`. |
| `expo-file-system` | Not installed | File metadata/read/upload preparation | Add if current Expo/Supabase upload implementation needs file reads or blob conversion from local URIs. |
| `expo-image-manipulator` | Not installed | Resize/compress receipt images before upload | Add only if captured images are too large or OCR/upload latency is poor. Do not add preemptively. |
| `expo-secure-store` | Not installed | Sensitive device storage | Do not use as Supabase session storage by default because Supabase's official React Native quickstart uses AsyncStorage. Consider SecureStore later for app-specific secrets only. |

### Validation, Money Math, and Domain Types

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| Existing allocation core | Current `src/core/allocation.mjs` | Deterministic receipt allocation | Keep behavior and tests. Convert to TypeScript or add checked JSDoc before broad feature work. |
| Zod | Not installed | Runtime schema validation for OCR responses, receipt drafts, save payloads | Add. This is worth the dependency because OCR, database rows, and UI drafts currently use different field names and need a shared contract. |
| Database generated types | Not present | Typed Supabase rows/inserts/RPC results | Add Supabase generated TypeScript types once local/project Supabase CLI setup exists. Commit generated types or generate in CI, but do not hand-type every row long-term. |

Prescriptive direction:

- Convert `src/core/allocation.mjs` to `src/core/allocation.ts` once typecheck is fixed, then keep Node tests pointed at a stable public entry.
- Add `receiptSchema.ts` with Zod schemas for `RecognizedReceipt`, editable `ReceiptDraft`, and `ConfirmReceiptInput`.
- Keep cents as integers everywhere. Do not introduce floating-point money libraries unless multi-currency conversion enters scope.

### Testing and Quality

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| Node built-in test runner | Installed/working | Core allocation and mapper tests | Keep for framework-neutral core tests. `npm test` currently passes 4 allocation tests. |
| TypeScript `tsc --noEmit` | Configured/failing | Static guardrail | Fix before depending on TS for feature work. This is the first stack task. |
| React Native Testing Library | Not installed | Screen and interaction tests | Add for auth guard behavior, receipt review editing, save validation, and navigation-critical flows. |
| Jest | Not installed | RN component test runner | Add only if React Native Testing Library setup requires it. Keep Node runner for pure domain tests. |
| Supabase local tests / SQL policy tests | Not configured | RLS and migration validation | Add before exposing real writes. At minimum test owner, member, non-member, and anonymous access for groups, receipts, allocations, shares, and settlements. |
| Edge function tests | Not configured | Receipt recognition contract | Add Deno tests or request-level tests around malformed JSON, auth, bad image paths, provider failure, and successful draft shape. |
| Detox / Maestro | Not installed | End-to-end mobile flows | Defer until v1 flows stabilize. Manual iOS verification plus focused component/service tests are higher leverage first. |

### Infrastructure and Release

| Technology | Status | Purpose | Direction |
|------------|--------|---------|-----------|
| Expo Application Services (`eas.json`) | Missing | iOS builds, submit pipeline, build profiles | Add after core v1 flows are wired, before beta distribution. |
| Supabase CLI config | Missing | Local database/functions workflow | Add before RLS and edge-function work becomes substantial. The current migration/function files need a repeatable local deploy/test path. |
| Environment variables | Documented only | Supabase configuration | Keep Expo public env vars for URL and publishable key. Fail clearly when missing. |
| Error reporting/analytics | Not installed | Crash and production diagnostics | Defer. Add only after v1 flow is usable; do not block core stack work on observability tooling. |

## Installation Direction

Use Expo-aware installs for native/Expo packages:

```bash
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install @react-native-async-storage/async-storage expo-network
npm install @tanstack/react-query zod
```

Potential later installs:

```bash
npx expo install expo-file-system
npx expo install expo-image-manipulator
npm install -D @testing-library/react-native jest
```

Do not install all later packages up front. Add them when the phase reaches the workflow that needs them.

## Immediate Stack Fixes for Roadmap Phase 1

1. Fix TypeScript/Expo compatibility.
   - Current evidence: `npm run typecheck` fails with `customConditions` and `module` errors from Expo's base tsconfig.
   - Direction: upgrade TypeScript to the version supported by Expo SDK 56, remove stale compiler overrides where possible, and use Expo's recommended module resolution.

2. Replace demo route state with Expo Router route boundaries.
   - Current evidence: `src/App.tsx` owns all navigation as a local string union.
   - Direction: introduce `(auth)` and `(app)` route groups and protected app layout before adding nested group/receipt screens.

3. Fix Supabase React Native auth setup.
   - Current evidence: `src/lib/supabase.ts` sets `persistSession: true` without a React Native storage adapter.
   - Direction: add `@react-native-async-storage/async-storage`, pass it as auth storage, add `processLock`, and manage auto-refresh from `AppState`.

4. Introduce typed service/query boundaries.
   - Current evidence: Supabase client exists but is unused; screens import demo data directly.
   - Direction: build auth/groups/receipts services and TanStack Query hooks before replacing demo UI data flow.

5. Add runtime DTO validation at the OCR/database boundary.
   - Current evidence: UI demo, edge-function response, allocation input, and database columns use different shapes.
   - Direction: add Zod schemas and mapper tests before save-to-ledger persistence.

## What Not To Add Yet

| Avoid | Reason |
|-------|--------|
| Native Swift rewrite | Existing Expo code, dependencies, schema, and design references already support the v1 target. The risk is incomplete integration, not framework choice. |
| Redux or MobX | Adds global state complexity before the app has enough client-only global state to justify it. |
| Full offline sync database | v1 needs reliable online receipt capture, review, and ledger save first. Add local draft persistence only if the scan/review flow requires it. |
| Multiple OCR providers | The existing edge-function contract should hide provider choice. Start with one provider or placeholder and keep human review mandatory. |
| Multi-currency conversion stack | Out of scope. Store currency code only. |
| Payments integration | Settlement tracking can be ledger-only for v1; real money movement introduces compliance and product complexity. |
| Analytics/error reporting platform | Useful later, but lower priority than auth, RLS, receipt persistence, and typecheck. |
| Design system library | Existing restrained React Native styles and tokens are enough. Extract components; do not replace the visual system. |

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Typecheck remains broken while screens are expanded | High | Make TypeScript compatibility the first stack task and require `npm run typecheck` for later phases. |
| Supabase RLS blocks or leaks real user data | High | Add owner-membership bootstrap, tighten policies, and test RLS locally before real writes. |
| Receipt confirmation is not atomic | High | Use a server-side RPC/transaction for ledger writes rather than chained client inserts. |
| OCR response shape drifts from review/save shape | High | Add Zod schemas and mapper tests before wiring recognition output into review. |
| Navigation migration delays feature work | Medium | Add only the route/layout skeleton first; migrate screens incrementally. |
| Too many libraries are added before flows exist | Medium | Add libraries phase-by-phase and require a concrete workflow need. |

## Source Notes

- HIGH confidence: Local codebase inspection of `.planning/PROJECT.md`, `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `package.json`, `tsconfig.json`, and `src/lib/supabase.ts`.
- HIGH confidence: Local verification on 2026-06-10: `npm test` passes; `npm run typecheck` fails at Expo/TypeScript config compatibility.
- HIGH confidence: Expo SDK docs list SDK 56.0.0 as targeting React Native 0.85, React 19.2.3, and Node 22.13.x minimum, and recommend `npx expo install` for SDK-compatible package versions: https://docs.expo.dev/versions/latest/
- HIGH confidence: Expo Router manual install docs list `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants`, and `expo-status-bar`, and show `expo-router/entry` plus typed routes setup: https://docs.expo.dev/router/installation/
- HIGH confidence: Supabase React Native auth docs show `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, `processLock`, `detectSessionInUrl: false`, and AppState-driven token refresh for React Native: https://supabase.com/docs/guides/auth/quickstarts/react-native
- MEDIUM confidence: TanStack Query React Native docs state it works with React Native and document React Native online/focus managers using NetInfo or `expo-network`: https://tanstack.com/query/latest/docs/framework/react/react-native

