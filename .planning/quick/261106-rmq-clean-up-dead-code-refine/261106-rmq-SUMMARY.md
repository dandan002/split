# Quick 261106-rmq: Clean up dead code, refine — Summary

## Done (per plan)
- Removed `currentUser` and receipt-level `confidence` from `src/data/demo.ts`.
- Removed unused `type.mono` from `src/theme.ts`.
- Uninstalled unused `expo-status-bar`.
- `src/App.tsx`: imported `ReceiptInput` instead of redeclaring it, named `ReactNode` import, dropped `navigate` wrapper, built memo input inside `useMemo`, derived group count from fixture.

## Beyond plan
- Typecheck was broken (TS5098/TS6046): TypeScript 5.3 is too old for `expo/tsconfig.base`. Upgraded to `~5.9.3`, reduced `tsconfig.json` to `extends` + `strict` + `include`.
- With a working typecheck, `allocation.d.ts` was revealed as never applied to `allocation.mjs`; renamed to `allocation.d.mts`. Removed the now-unneeded `as Record<string, number>` cast and the redundant `validation.ok ? 0 :` guard.
- Added `.gitignore`; untracked `node_modules/`, `.expo/`, `.DS_Store`.

## Verification
- `npm test`: 4 pass, 0 fail.
- `npm run typecheck`: 0 errors.

## Noted, not removed
- `src/lib/supabase.ts` — unused until auth phase.
- `expo-camera` / `expo-image-picker` — planned receipt capture.
- `quantity?` in `allocation.d.mts` — part of the public contract.
- `Header` always renders a back arrow, even with no `onBack` (visual change, left for UI work).
