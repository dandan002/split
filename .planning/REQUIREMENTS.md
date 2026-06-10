# Requirements: Split

**Defined:** 2026-06-10
**Core Value:** Users can capture a shared receipt, assign each line item to the right people, and save an accurate ledger entry with trustworthy per-person totals.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: Developer can run `npm test` and `npm run typecheck` successfully after dependency/config updates.
- [ ] **FOUND-02**: App navigation separates unauthenticated, authenticated tab, group detail, receipt, and settlement flows with typed route boundaries.
- [ ] **FOUND-03**: Shared UI components and feature modules replace the single-file screen implementation for new v1 work.
- [ ] **FOUND-04**: Receipt draft, OCR response, database row, and allocation input DTOs have explicit mappers and validation.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password and receives a usable authenticated session.
- [ ] **AUTH-02**: User can sign in with email and password and stays signed in across app restarts.
- [ ] **AUTH-03**: User can sign out from the profile/account screen.
- [ ] **AUTH-04**: User sees clear loading, error, and empty states during auth/session restoration.
- [ ] **AUTH-05**: User profile is created or loaded after first authentication.

### Groups

- [ ] **GRP-01**: User can create a trip group and is automatically added as owner.
- [ ] **GRP-02**: User can view their trip groups from real Supabase data.
- [ ] **GRP-03**: User can open a group detail screen with members, balances, receipts, and primary actions.
- [ ] **GRP-04**: Group owner can add members to a group.
- [ ] **GRP-05**: Group owner can remove members when doing so does not corrupt existing expenses.
- [ ] **GRP-06**: Non-members cannot read or mutate group data under RLS.

### Receipt Capture

- [ ] **RCPT-01**: User can start receipt capture from an active group.
- [ ] **RCPT-02**: User can capture a receipt image with the camera after granting permission.
- [ ] **RCPT-03**: User can import a receipt image from the photo library after granting permission.
- [ ] **RCPT-04**: App uploads receipt images to a user/group-scoped storage path.
- [ ] **RCPT-05**: App invokes the receipt recognition function and handles processing, needs-review, failed, and retry states.
- [ ] **RCPT-06**: Receipt recognition rejects invalid unauthenticated or unauthorized image paths.

### Receipt Review

- [ ] **REV-01**: User can review and edit merchant, date, currency, subtotal, total, and receipt confidence before saving.
- [ ] **REV-02**: User can add, edit, delete, and reorder receipt line items.
- [ ] **REV-03**: User can add, edit, delete, and classify tax, tip, fees, discounts, and credits.
- [ ] **REV-04**: User can assign each item to one or more group members with equal, weighted, or custom allocation as supported by the core model.
- [ ] **REV-05**: User can choose adjustment allocation strategy: proportional, equal, or custom.
- [ ] **REV-06**: User sees low-confidence OCR fields and unresolved validation issues before save.
- [ ] **REV-07**: App blocks save until all required item assignments and totals are valid.
- [ ] **REV-08**: Member totals update immediately as receipt edits and assignments change.

### Ledger

- [ ] **LEDG-01**: User can save a confirmed receipt as an expense in one atomic server-side operation.
- [ ] **LEDG-02**: Saved ledger data includes expense, receipt, items, adjustments, allocations, and expense shares.
- [ ] **LEDG-03**: Partial save failures do not leave inconsistent receipt or expense data.
- [ ] **LEDG-04**: User can reopen a saved expense/receipt in read-only or controlled edit mode.
- [ ] **LEDG-05**: Allocation tests cover invalid members, malformed money input, negative adjustments, and custom allocations before ledger save is exposed.

### Activity

- [ ] **ACT-01**: User can view group activity showing saved expenses, receipt confirmations, edits, and settlements.
- [ ] **ACT-02**: User can open an activity item to inspect the related receipt, expense, or settlement.
- [ ] **ACT-03**: Activity screen handles empty, loading, error, and refresh states.

### Settlements

- [ ] **SETL-01**: User can view current group balances by member based on saved expense shares and settlements.
- [ ] **SETL-02**: User can view suggested settlement transfers for a group.
- [ ] **SETL-03**: User can record a manual settlement between group members.
- [ ] **SETL-04**: User can see settlement history in the group activity or settlement screen.

### Profile

- [ ] **PROF-01**: User can view and edit display name.
- [ ] **PROF-02**: User can view and update avatar when storage support is available.
- [ ] **PROF-03**: User can access account settings and sign out.
- [ ] **PROF-04**: Profile screen shows useful app/session state when backend configuration is missing or unavailable.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Automation

- **AUTO-01**: App can use a production OCR provider with provider-specific confidence tuning.
- **AUTO-02**: App can suggest assignments from historical member ordering or repeated merchants.
- **AUTO-03**: App can support offline receipt drafts and later sync.

### Platform

- **PLAT-01**: App has Android-specific polish and QA.
- **PLAT-02**: App has desktop/web parity.
- **PLAT-03**: App has EAS production build and release automation.

### Payments

- **PAY-01**: User can initiate in-app payment or payment-link handoff for settlements.
- **PAY-02**: User can track external payment provider status.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| In-app payments | Manual settlement tracking is enough for v1 and avoids financial-provider complexity. |
| Live currency conversion | v1 can store currency codes without exchange-rate logic. |
| Chat or social feed | Does not support the core receipt-to-ledger workflow. |
| Public user discovery | Groups should remain private and membership-based. |
| Desktop/web parity | Product is iOS-first and current codebase is Expo mobile. |
| Full offline sync | Requires conflict handling that should follow a working online ledger. |
| Auto-saving OCR without review | Human review is required for money correctness and trust. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| GRP-01 | Phase 3 | Pending |
| GRP-02 | Phase 3 | Pending |
| GRP-03 | Phase 3 | Pending |
| GRP-04 | Phase 3 | Pending |
| GRP-05 | Phase 3 | Pending |
| GRP-06 | Phase 3 | Pending |
| RCPT-01 | Phase 4 | Pending |
| RCPT-02 | Phase 4 | Pending |
| RCPT-03 | Phase 4 | Pending |
| RCPT-04 | Phase 4 | Pending |
| RCPT-05 | Phase 4 | Pending |
| RCPT-06 | Phase 4 | Pending |
| REV-01 | Phase 5 | Pending |
| REV-02 | Phase 5 | Pending |
| REV-03 | Phase 5 | Pending |
| REV-04 | Phase 5 | Pending |
| REV-05 | Phase 5 | Pending |
| REV-06 | Phase 5 | Pending |
| REV-07 | Phase 5 | Pending |
| REV-08 | Phase 5 | Pending |
| LEDG-01 | Phase 6 | Pending |
| LEDG-02 | Phase 6 | Pending |
| LEDG-03 | Phase 6 | Pending |
| LEDG-04 | Phase 6 | Pending |
| LEDG-05 | Phase 6 | Pending |
| ACT-01 | Phase 7 | Pending |
| ACT-02 | Phase 7 | Pending |
| ACT-03 | Phase 7 | Pending |
| SETL-01 | Phase 7 | Pending |
| SETL-02 | Phase 7 | Pending |
| SETL-03 | Phase 7 | Pending |
| SETL-04 | Phase 7 | Pending |
| PROF-01 | Phase 7 | Pending |
| PROF-02 | Phase 7 | Pending |
| PROF-03 | Phase 7 | Pending |
| PROF-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-06-10*
*Last updated: 2026-06-10 after initial definition*
