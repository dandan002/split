# Research Summary: Split

**Date:** 2026-06-10
**Context:** Brownfield Expo React Native/Supabase prototype for iOS-first trip receipt splitting.

## Key Findings

**Stack:** Keep the existing Expo React Native and Supabase direction. The product needs structure and integration, not a rewrite. Fix TypeScript/Expo compatibility first, then add a real navigation/auth boundary, Supabase React Native auth storage, server-state handling, and schema validation for OCR/database DTOs.

**Features:** v1 should complete one vertical loop: sign in, create/select a trip, add members, scan/import a receipt, review/edit/assign items, save to the ledger, view balances/activity, and record settlements. Receipt review is the central differentiator and needs the deepest interaction design and correctness work.

**Architecture:** Move from a single-file prototype toward feature-oriented routes, shared components, framework-neutral core logic, and explicit service/repository boundaries. Supabase reads can be client services, but confirmed receipt persistence should be a transaction-backed Postgres RPC or equivalent server-side boundary.

**Pitfalls:** Avoid mock-driven screen expansion, client-side multi-table ledger writes, silent OCR auto-save, unvalidated DTO drift, weak group membership bootstrap, and untested RLS. Activity and settlement screens should be built only after real ledger data exists.

## Recommended Build Order

1. Stabilize technical foundation: typecheck, app structure, navigation, tests, and shared DTO/mapping boundaries.
2. Implement authentication, session restoration, profile bootstrap, and protected app routes.
3. Implement group and member management with secure owner-membership bootstrap.
4. Implement receipt capture/import, storage upload, OCR invocation, processing/failure states, and review handoff.
5. Expand receipt review editing, assignment, allocation validation, and confidence/error states.
6. Persist confirmed receipts and expense shares through a transactional ledger boundary.
7. Build activity, balances, settlements, profile/account, and final navigation polish against real saved data.

## v1 Table Stakes

- Email/password auth, session persistence, sign-out, and profile basics.
- Trip group creation, group list, group detail, and member management.
- Camera/photo-library receipt capture with permission and failure states.
- Receipt recognition lifecycle: upload, processing, needs review, failed, confirmed.
- Editable receipt review for merchant/date, items, amounts, adjustments, assignments, and validation.
- Accurate tax/tip/fee/discount allocation and deterministic cent rounding.
- Atomic save to expenses, receipts, items, adjustments, allocations, and expense shares.
- Activity feed, group balances, settlement suggestions/history, and account/profile screens.

## Deliberate v1 Exclusions

- In-app payments.
- Live currency conversion.
- Chat, social feed, public discovery, or broad social features.
- Desktop/web parity.
- Full offline sync.
- Multi-provider OCR optimization.
- Charts, budgeting, recurring bills, or analytics.

## Critical Risks to Plan Around

- `npm run typecheck` currently fails; fix before relying on TypeScript for new screens.
- `src/App.tsx` is too large for major feature expansion; split screens/components early.
- Supabase auth storage is not configured for React Native session persistence.
- Group creation lacks owner-membership bootstrap and can create inaccessible groups.
- Receipt DTO shapes differ across UI, OCR function, database rows, and allocation input.
- Confirmed receipt save needs transactionality; client-side insert chains risk partial ledgers.
- RLS and storage policies need verification before real user data writes.

---
*Research summarized: 2026-06-10*
