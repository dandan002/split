# Project State

**Project:** Split
**Initialized:** 2026-06-10
**Current phase:** Phase 1 - Foundation and App Structure
**Status:** Ready for phase discussion/planning

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-06-10)

**Core value:** Users can capture a shared receipt, assign each line item to the right people, and save an accurate ledger entry with trustworthy per-person totals.
**Current focus:** Make the codebase ready for real feature work with passing checks, routed app structure, shared components, and receipt DTO boundaries.

## Planning Artifacts

| Artifact | Location | Status |
|----------|----------|--------|
| Project context | `.planning/PROJECT.md` | Complete |
| Workflow config | `.planning/config.json` | Complete |
| Codebase map | `.planning/codebase/` | Complete |
| Research | `.planning/research/` | Complete |
| Requirements | `.planning/REQUIREMENTS.md` | Complete |
| Roadmap | `.planning/ROADMAP.md` | Complete |

## Current Roadmap

| Phase | Name | Status |
|-------|------|--------|
| 1 | Foundation and App Structure | Pending |
| 2 | Authentication and Profile Bootstrap | Pending |
| 3 | Groups and Memberships | Pending |
| 4 | Receipt Capture and OCR Drafts | Pending |
| 5 | Receipt Review and Allocation UX | Pending |
| 6 | Atomic Ledger Persistence | Pending |
| 7 | Activity, Settlements, and Account Polish | Pending |

## Important Context

- Existing app is an Expo React Native prototype with most UI in `src/App.tsx`.
- Existing allocation core in `src/core/allocation.mjs` is tested and should remain framework-neutral.
- Supabase schema exists but app UI is not wired to backend data yet.
- `npm run typecheck` is known to fail and is a Phase 1 blocker.
- Research recommends Expo Router, Supabase React Native auth storage, server-state handling, DTO validation, and transaction-backed ledger persistence.

## Next Action

Run `/gsd-discuss-phase 1` to clarify approach before planning the foundation phase.

---
*State initialized: 2026-06-10*
