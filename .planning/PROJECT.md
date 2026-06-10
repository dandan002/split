# Split

## What This Is

Split is an iOS-first trip cost splitting app for groups who need to turn shared trip expenses into clear per-person balances. The existing codebase is a React Native/Expo prototype with login, groups, receipt scan, and receipt review screens, backed by a Supabase schema and a tested allocation engine.

The next milestone is to plan and add the missing functionality and screens that connect the prototype into a usable v1: real authentication, group/member flows, receipt capture and review, save-to-ledger persistence, activity, settlements, and account/profile management.

## Core Value

Users can capture a shared receipt, assign each line item to the right people, and save an accurate ledger entry with trustworthy per-person totals.

## Requirements

### Validated

- [x] Expo React Native app shell exists with login, groups, scan, receipt review, activity, and profile routes.
- [x] Receipt allocation engine exists in `src/core/allocation.mjs` with deterministic cent rounding and Node tests.
- [x] Supabase schema exists for profiles, trip groups, memberships, expenses, receipts, receipt items, adjustments, allocations, and expense shares.
- [x] Supabase client boundary exists in `src/lib/supabase.ts`.
- [x] Receipt recognition edge-function contract exists in `supabase/functions/recognize-receipt/index.ts`.
- [x] Design reference artifacts exist in `stitch_minimalist_trip_splitter/`.

### Active

- [ ] Replace demo-only authentication with real Supabase auth, session restoration, sign-out, error states, and protected routes.
- [ ] Add group and member management screens for creating groups, viewing group details, inviting/removing members, and selecting the active group.
- [ ] Implement receipt image capture/import, upload, recognition request, processing states, failures, and review handoff.
- [ ] Expand receipt review into an editable workflow for merchant/date, line items, amounts, tax/tip/fees/discounts, item assignments, and save validation.
- [ ] Persist confirmed receipts into the Supabase ledger across expenses, receipts, items, adjustments, allocations, and expense shares.
- [ ] Add activity and settlement screens that show saved expenses, member balances, who owes whom, and settlement history.
- [ ] Add profile/account screens for display name, avatar, preferences, and sign-out.
- [ ] Fix technical foundations that block v1: typecheck compatibility, header navigation behavior, Supabase session storage, group membership bootstrap, and allocation validation gaps.

### Out of Scope

- Real-time chat - not required for receipt splitting and settlement v1.
- Multi-currency conversion - v1 can store a currency code but should not perform exchange-rate conversion.
- Full OCR provider optimization - v1 needs a stable recognition contract and review workflow; provider tuning can follow.
- Android-specific polish - product is iOS-first, though Expo should avoid unnecessary Android breakage.
- Public social discovery - groups should be private and membership-based for v1.

## Context

The current app is intentionally prototype-heavy. `src/App.tsx` holds route state, screen implementations, shared components, styles, and demo interactions in one file. `src/data/demo.ts` provides seeded groups, members, and a scanned receipt. `src/core/allocation.mjs` is the strongest production-ready part of the codebase and should stay framework-neutral.

The backend model already anticipates the target product. `supabase/migrations/001_initial_schema.sql` includes profiles, groups, memberships, expenses, receipts, receipt items, adjustments, item allocations, and expense shares with RLS enabled. However, app screens do not yet call Supabase, and group creation lacks an owner-membership bootstrap path.

The roadmap should prioritize vertical slices that convert static UI into real user workflows while containing risk around money math, RLS, and OCR review. Screens should remain visually consistent with the existing restrained monochrome iOS-first design unless a later UI phase changes the design system.

## Constraints

- **Platform**: iOS-first Expo React Native app - preserve Expo scripts and mobile-first interaction patterns.
- **Backend**: Supabase Auth, Postgres, RLS, Storage, and Edge Functions - new persistence should use the existing Supabase direction.
- **Money math**: Allocation behavior must stay deterministic and cent-accurate - changes require focused tests.
- **Codebase shape**: `src/App.tsx` is too large for major feature work - split screens/components early enough to avoid compounding conflicts.
- **Type safety**: `npm run typecheck` is currently blocked by TypeScript/Expo config mismatch - fix before relying on TypeScript as a guardrail.
- **Security**: RLS and membership policies must be verified before exposing group, receipt, or settlement writes to real users.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Continue with Expo React Native | Existing app, dependencies, and design references are already Expo/iOS-first. | Pending |
| Use Supabase as the v1 backend | Schema, client setup, auth direction, and edge-function contract already exist. | Pending |
| Keep allocation logic framework-neutral | Existing tests protect the money-critical domain core and allow fast Node verification. | Pending |
| Build from authenticated ledger flows before polish | Static UI already exists; v1 risk is correctness, persistence, and complete workflows. | Pending |
| Treat generated HTML/screenshots as design reference only | Runtime code lives in React Native; reference artifacts should not drive app behavior directly. | Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-10 after initialization*
