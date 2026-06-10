# Feature Landscape

**Domain:** iOS-first trip receipt splitting app
**Project:** Split
**Researched:** 2026-06-10
**Overall confidence:** MEDIUM-HIGH

## Scope

This research answers the Features dimension only: what v1 screens and capabilities are table stakes, differentiators, or anti-features for Split, given the current brownfield prototype.

The existing codebase already has a React Native/Expo prototype with demo login, groups list, static scan flow, receipt review, activity/profile placeholders, a Supabase schema, and a tested allocation core. The product gap is not "invent a new app"; it is completing a trustworthy scan-to-ledger workflow around the domain strength that already exists: itemized receipt allocation with deterministic cent rounding.

## Market Baseline

Established group expense apps set the user expectation that a v1 product can create groups, track shared expenses, show balances, and record settlement/payment activity. Splitwise's public product page lists groups/friends, equal and unequal splits, percentage/share splits, total balances, simplified debts, offline mode, cloud sync, multiple currencies, payment integrations, receipt scanning, itemization, search, and charts across core/pro tiers. Its App Store listing also emphasizes group creation, offline entry, online backup, multiple payers, activity feed, push notifications, edit history, deleted bill restore, and integrated payments.

Receipt-first bill splitters set a more specific expectation: scan or import a receipt, detect line items, let people claim items, split shared items, automatically distribute tax/tip, and share a clear breakdown. Tab's App Store listing describes taking a picture of an itemized receipt, automatic item/price detection, selecting who ordered what, real-time shared bill selection, shared item support, proportional tax/tip, birthday comp splitting, and past bill summaries.

For Split, v1 should not try to beat mature apps on every generic expense-management axis. The wedge should be a focused, reliable receipt workflow for trips: capture receipt, review OCR, assign items to members, distribute adjustments correctly, save to a group ledger, then show balances and settlement guidance.

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Current State | Complexity | V1 Recommendation |
|---------|--------------|---------------|------------|-------------------|
| Real authentication and session restoration | Real group ledgers require user identity, RLS, and persistence. | Login screen is route-only demo; Supabase client exists but is unused. | Medium | Implement email/password or magic-link auth, restored sessions, protected routes, loading/error states, and sign-out. |
| Profile bootstrap | Groups and expense shares need display names/avatars for member assignment. | `profiles` table exists; Profile tab is placeholder. | Low-Med | Create/update profile after auth; allow display name and avatar placeholder initials for v1. |
| Groups list | Group expense products start from a trip/household/event context. | Demo groups list exists. | Medium | Replace demo data with Supabase-backed groups list, empty state, loading state, and active group selection. |
| Create group | Users need a way to start a trip ledger. | UI affordance exists but is non-functional; schema lacks owner-membership bootstrap. | Medium | Add create group flow plus owner membership bootstrap via trigger/RPC before shipping. |
| Group detail | Users need to see trip members, recent expenses, balances, and actions from one place. | Not present; groups route jumps directly to scan. | Medium | Add a group detail screen as the home for Scan, Add Expense, Members, Activity, and Settle Up. |
| Member management | Receipt assignment is only useful if the group member list is correct. | Demo members exist; assignment presets are hard-coded and omit one demo member. | Medium | Add invite/add member, pending/inactive states if needed, remove member constraints, and assignment options generated from active members. |
| Receipt capture/import | Receipt-first products must use a real camera/photo import path. | Static mock scanner only; camera/image-picker dependencies exist. | Medium-High | Support camera capture and photo library import; request permissions; store local preview; upload to Supabase Storage. |
| Recognition request lifecycle | Users need to know when OCR is uploading, processing, failed, or ready to review. | Edge-function contract exists but app does not call it. | Medium | Add upload/progress, processing, retry, and graceful manual-entry fallback. |
| OCR review guardrail | OCR is imperfect; v1 must require human review before save. | Edge function returns `needs_review`; review UI uses demo data. | Medium | Always land in review with confidence indicators and editable fields; never auto-save recognized receipts. |
| Editable merchant/date/currency | Saved ledger entries must be recognizable later. | Merchant/date display exists; edit action is placeholder. | Low-Med | Allow editing merchant, date, payer, note, and currency code. No exchange conversion in v1. |
| Editable line items | OCR errors and receipt quirks are common. | Items display and assignment cycling exist; no add/delete/edit amount/name. | Medium | Add edit item name/amount, add item, delete item, and duplicate/merge correction flows. |
| Item assignment to one/many members | Core value depends on assigning each item to the right people. | Tap cycles hard-coded presets. | Medium | Use member picker with quick states: unassigned, one member, multiple members, everyone. |
| Shared item support | Appetizers, rides, rooms, and shared supplies are common trip cases. | Allocation core supports multiple allocation members. | Medium | Make multi-select assignment obvious; show split preview per assigned member. |
| Tax/tip/fee/discount adjustments | Receipt totals often include non-item amounts. | Demo adjustments and allocation core exist. | Medium | Support tax, tip, fees, discounts/credits with proportional/equal/custom allocation strategy. |
| Receipt total validation | Money apps must prevent silent total mismatches. | `canSaveReceipt` validates total mismatch/unassigned/invalid items. | Medium | Preserve strict save validation with visible blocking reasons and "remaining/unassigned" counters. |
| Save receipt to ledger | Review without persistence is not a usable product. | Not implemented; schema anticipates required tables. | High | Save expense, receipt, items, adjustments, item allocations, and expense shares atomically, preferably through an RPC/server function. |
| Expense activity feed | Users need auditability after saving. | Activity tab is placeholder. | Medium | Show saved expenses, receipt merchant/date/payer/total, shares, edits/settlements, and empty states. |
| Balances and "who owes whom" | Group expense apps are judged by whether they answer settlement questions. | Supabase `expense_shares` table exists; no UI. | Medium | Compute member balances per group and show simplified settlement suggestions. |
| Record settlement | Users need to close debts without necessarily moving money in-app. | Not present. | Medium | Record cash/external settlement entries; update activity and balances. |
| Basic account/settings | Users expect sign-out and identity management. | Profile tab placeholder. | Low | Add display name, avatar initials/photo placeholder, email, sign-out, and app/backend config errors. |
| Error, loading, empty, and offline-ish states | Current demo UI hides failures; v1 will hit auth, network, OCR, and RLS errors. | Mostly absent. | Medium | Add user-facing states for auth failure, no groups, no receipts, upload failure, save failure, and session expired. |

## Differentiators

Features that can set Split apart. Not all are required for v1, but the first three are strong v1 differentiators because they align with existing code and product positioning.

| Feature | Value Proposition | Current State | Complexity | V1 Recommendation |
|---------|-------------------|---------------|------------|-------------------|
| Receipt-first group workflow | Mature expense apps treat receipt scanning as premium or advanced; Split can make scan-to-split the main path. | Prototype already centers scan and review. | Medium | Make this the product wedge: group detail -> scan/import -> review -> save -> balances. |
| Trustworthy adjustment allocation | Users argue about tax, tip, discounts, and shared items; deterministic visible allocation builds trust. | Allocation core already handles proportional/equal/custom adjustments and cent rounding. | Medium | Surface why totals are what they are; show tax/tip/discount allocation in each member breakdown. |
| Human-reviewed OCR confidence | OCR failure is a known pain point; explicit review avoids incorrect debts. | Edge contract has `status: needs_review`; no UI confidence treatment yet. | Medium | Show low-confidence fields and require correction before save. |
| Receipt draft persistence | Users may lose work during review, app switching, or poor connectivity. | Not present. | Medium | Save local/remote drafts after OCR and during editing if time allows; otherwise make it a Phase 2 priority. |
| Shareable per-person breakdown | Not every participant wants another app account; trip organizers need to send clear totals. | Not present. | Medium | Consider v1.1 export/share sheet from saved receipt: each member's items, tax/tip share, and total. |
| "Non-participant" or lightweight guest members | Family trips often include people who will not sign up but must be included in math. | Schema assumes profiles/memberships. | Medium-High | Defer unless requirements demand it; if added, model as group-local member records carefully. |
| Birthday/comp mode | Useful for restaurant bills where one person's total is distributed to others. | Not present. | Medium | Defer; can be implemented later as a special allocation transform. |
| Category and spending insights | Mature apps offer charts and spending totals. | Schema has no category first-class field detected. | Medium | Defer; not needed to prove receipt-splitting v1. |
| Real-time collaborative claiming | Tab-like simultaneous item claiming can be delightful for meals. | Not present; Supabase could support real-time later. | High | Defer; v1 should support one organizer completing the receipt reliably. |

## Anti-Features

Features to explicitly not build for v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| In-app money movement/payment processing | Adds compliance, support, reversals, regional availability, and payment-provider complexity. | Record external settlements; optionally deep-link/share to payment apps later. |
| Multi-currency conversion | Trip apps often mention many currencies, but live conversion adds rates, historical conversion, and reconciliation questions. | Store a currency code per receipt/group; do not convert in v1. |
| Full personal finance budgeting/charts | Mature apps offer charts, but this dilutes the receipt-splitting wedge. | Show group balances and activity only. |
| Recurring bills | Useful for roommates, not central to trip receipt splitting. | Defer; keep data model flexible enough for normal expenses. |
| Public social feed or discovery | Group expense data is sensitive and trip groups should be private. | Private membership-based groups only. |
| Chat/comments in v1 | Not required to allocate receipts or settle balances. | Use notes on expenses if necessary; defer threaded comments. |
| Automatic save from OCR | OCR mistakes cause incorrect debts and user distrust. | Require review and validation before save. |
| Complex role/permission system | Overbuilt permissions slow v1 and complicate RLS. | Owner/member roles only; protect destructive actions. |
| Desktop/web parity | Product is iOS-first and the codebase is Expo React Native. | Keep mobile-first; avoid web-specific requirements in v1. |
| Android-specific polish | Out of scope per project constraints. | Avoid unnecessary breakage, but optimize iOS workflows first. |
| CSV/JSON export | Useful for power users but not needed for a trustworthy v1 mobile loop. | Defer until ledgers and activity are stable. |

## Screen Inventory

Recommended v1 screen set, mapped to current prototype status.

| Screen | Status | Table Stake or Differentiator | Purpose | Notes |
|--------|--------|-------------------------------|---------|-------|
| Auth Landing / Sign In | Exists as demo | Table stake | Sign in/sign up, show auth errors, restore sessions. | Replace local route transition with Supabase auth. |
| Auth Loading / Protected Route Gate | Missing | Table stake | Avoid flashing private screens before session resolution. | Needed before real data. |
| Groups List | Exists with demo data | Table stake | Show user's trip groups and create/join affordances. | Needs Supabase-backed loading/empty/error states. |
| Create Group | Missing/non-functional | Table stake | Create named trip group and owner membership. | Must fix membership bootstrap. |
| Group Detail | Missing | Table stake | Main trip workspace: members, balances, recent expenses, scan/add actions. | This should replace jumping directly from group card to scan. |
| Group Members | Missing | Table stake | Add/invite/remove members and show member identities. | Required before reliable receipt assignment. |
| Scan Receipt | Exists as static mock | Table stake | Capture/import receipt image and start recognition. | Add camera/library permissions, preview, upload, retry. |
| OCR Processing | Missing | Table stake | Show upload/recognition progress and failure recovery. | Prevents confusing blank transitions. |
| Review Receipt | Exists with demo receipt | Table stake and differentiator | Edit OCR output, assign items, validate totals, save split. | Should be the deepest v1 investment. |
| Item Editor / Assignment Picker | Partially present as tap-cycle | Table stake | Edit item fields and choose member allocations. | Replace hard-coded cycles with member-driven UI. |
| Adjustment Editor | Partially present as display only | Table stake | Edit tax/tip/fee/discount and allocation strategy. | Use proportional as default; support equal/custom where needed. |
| Save Confirmation | Missing | Table stake | Confirm saved receipt and show resulting per-person balances. | Can be a post-save state on Review or Group Detail. |
| Activity Feed | Placeholder | Table stake | Audit saved expenses and settlements. | Start simple: chronological ledger events. |
| Expense Detail | Missing | Table stake | Show one saved receipt's items, shares, payer, and validation output. | Reuse review display read-only after save. |
| Balances / Settle Up | Missing | Table stake | Show who owes whom and record settlements. | Can live inside Group Detail initially. |
| Record Settlement | Missing | Table stake | Record external cash/Venmo/etc. payment as ledger event. | Do not process payment in-app. |
| Profile / Account | Placeholder | Table stake | Display name, avatar, email, sign-out, preferences. | Keep minimal. |
| App Configuration Error | Missing | Table stake for development/release safety | Show Supabase env/config errors. | Current client can be created with empty config. |
| Share Breakdown | Missing | Differentiator | Share member totals/items outside the app. | Defer if v1 scope is tight; high value for trips with reluctant signups. |
| Drafts | Missing | Differentiator | Resume partially reviewed receipt. | Strong v1.1 candidate; include local persistence if review flow is long. |

## Feature Dependencies

```text
Real auth -> Profile bootstrap -> Protected routes
Real auth -> Group list -> Create group -> Owner membership bootstrap -> Group detail
Group detail -> Member management -> Receipt assignment picker
Receipt capture/import -> Storage upload -> Recognition request lifecycle -> OCR review
OCR review -> Editable items/adjustments -> Allocation validation -> Save receipt to ledger
Save receipt to ledger -> Activity feed -> Expense detail
Save receipt to ledger -> Balances -> Settlement suggestions -> Record settlement
Profile/account -> Sign-out -> Protected route reset
```

Critical implementation dependency:

```text
Group creation cannot ship before owner membership bootstrap is fixed.
Receipt save cannot ship before receipt DTO/database mappers and transaction/RPC boundaries are defined.
Settlement UI cannot be trusted before expense shares are persisted and balance calculations are tested.
```

## MVP Recommendation

Prioritize:

1. Real auth/session/profile and protected routes.
2. Supabase-backed groups, create group, group detail, and member management.
3. Receipt capture/import, upload, recognition lifecycle, and review handoff.
4. Editable receipt review: merchant/date/payer, line items, member assignment, tax/tip/discounts, validation reasons.
5. Atomic save-to-ledger using existing allocation output and Supabase schema.
6. Group activity, balances, and record-settlement screens.
7. Minimal profile/account settings with sign-out.

Defer:

- Payment integrations: record settlements only.
- Multi-currency conversion: store currency codes only.
- Collaborative real-time item claiming: one organizer flow first.
- Charts/search/categories/export: useful after reliable ledgers exist.
- Guest/non-account members: important potential differentiator, but schema impact is high and should be researched separately.
- Offline-first sync: desirable, but v1 can use clear network/retry states and optional local receipt drafts.

## Requirements Implications

The first requirements milestone should define the v1 product as a completed vertical loop:

```text
Sign in -> create/select trip -> add members -> scan/import receipt -> review/edit/assign -> save to ledger -> see activity/balances -> record settlement.
```

Anything outside that loop should be explicitly marked deferred unless it directly reduces money-correctness risk or review-flow abandonment.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Group expense table stakes | HIGH | Verified from Splitwise official product page/App Store and Venmo Groups coverage; aligns with existing Supabase schema. |
| Receipt splitting table stakes | HIGH | Verified from Tab App Store and Splitwise Pro receipt/itemization references; aligns with current scan/review prototype. |
| Differentiator prioritization | MEDIUM-HIGH | Based on current codebase strengths and competitor positioning; product strategy judgment rather than purely factual. |
| Anti-feature recommendations | MEDIUM-HIGH | Aligned with project constraints and common complexity boundaries; may change if monetization or payment scope changes. |
| Guest/non-account member demand | MEDIUM | Supported by App Store review evidence and trip-use reasoning, but needs schema/product validation before inclusion. |

## Sources

- Project context: `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `README.md`.
- Splitwise official product page, accessed 2026-06-10: https://www.splitwise.com/
- Splitwise App Store listing, accessed 2026-06-10: https://apps.apple.com/us/app/splitwise/id458023433
- Tab App Store listing, accessed 2026-06-10: https://apps.apple.com/us/app/tab-the-simple-bill-splitter/id595068606
- Venmo Groups coverage from PayPal/Venmo announcement syndicated in Lifewire search result, 2023-11-14, accessed 2026-06-10: https://www.lifewire.com/venmo-group-payments-8401559
- Android Central 2026 Splitwise group-trip feature discussion, accessed 2026-06-10: https://www.androidcentral.com/apps-software/the-app-splitwise-is-the-best-hack-to-split-group-trip-expenses-in-2026
