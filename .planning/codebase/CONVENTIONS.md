# Coding Conventions

**Analysis Date:** 2026-06-10

## Naming Patterns

**Files:**
- Use PascalCase for React Native app component entry files such as `src/App.tsx`.
- Use lowercase domain module names for shared logic such as `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `src/theme.ts`, and `src/lib/supabase.ts`.
- Use lowercase test filenames with the `.test.mjs` suffix in `tests/allocation.test.mjs`.
- Use Supabase function entrypoints named `index.ts` under a function-specific directory, as in `supabase/functions/recognize-receipt/index.ts`.

**Functions:**
- Use camelCase for regular functions and helpers: `allocateReceipt`, `canSaveReceipt`, `splitAdjustment`, `normalizeAllocations`, `splitAmount`, `addCents`, and `pruneZeroTotals` in `src/core/allocation.mjs`.
- Use PascalCase for React component functions: `App`, `LoginScreen`, `GroupsScreen`, `ScanScreen`, `ReviewReceiptScreen`, `AvatarStrip`, `ScreenFrame`, `Header`, and `BottomNav` in `src/App.tsx`.
- Keep event-style callbacks named by intent with `on` prefixes in props: `onDone`, `onScan`, `onCapture`, `onChangeReceipt`, `onBack`, and `onNavigate` in `src/App.tsx`.

**Variables:**
- Use camelCase for local variables and derived values: `receiptInput`, `memberTotals`, `activeMemberIds`, `baseShares`, `rankedShares`, and `allocatedTotalCents` in `src/App.tsx` and `src/core/allocation.mjs`.
- Use plural names for arrays: `members`, `groups`, `items`, `adjustments`, `allocations`, `itemShares`, and `adjustmentShares` in `src/data/demo.ts` and `src/core/allocation.mjs`.
- Use `*Cents` suffixes for integer money values: `amountCents`, `receiptTotalCents`, `allocatedTotalCents`, `remainingCents`, `subtotalCents`, and `totalCents` in `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `src/data/demo.ts`, and `supabase/functions/recognize-receipt/index.ts`.
- Use `is*` boolean names for configuration flags, as in `isSupabaseConfigured` in `src/lib/supabase.ts`.

**Types:**
- Use PascalCase for TypeScript type aliases: `Route`, `ReceiptDraft`, and `ReceiptInput` in `src/App.tsx`; `Member`, `AllocationInput`, `ReceiptItemInput`, `ReceiptAdjustmentInput`, and `ReceiptInput` in `src/core/allocation.d.ts`; `RecognizedReceipt` in `supabase/functions/recognize-receipt/index.ts`.
- Use discriminated string unions for fixed domain choices, as in `Route` in `src/App.tsx` and `ReceiptAdjustmentInput['strategy']` in `src/core/allocation.d.ts`.
- For JavaScript modules consumed from TypeScript, keep a sibling declaration file such as `src/core/allocation.d.ts` next to `src/core/allocation.mjs`.

## Code Style

**Formatting:**
- No Prettier, Biome, or formatter config is detected in `.prettierrc*`, `biome.json`, or package scripts in `package.json`.
- Follow the existing style manually: 2-space indentation, single quotes, semicolons, trailing commas in multiline object/array/function-call literals, and blank lines between import groups and major blocks.
- Keep React Native styles in `StyleSheet.create` objects, as in `src/App.tsx` and `src/theme.ts`.
- Keep UI copy and status labels uppercase where the existing UI uses uppercase labels, for example `GET STARTED`, `OVERVIEW`, and `TAP ROW TO REASSIGN` in `src/App.tsx`.

**Linting:**
- No ESLint config is detected (`.eslintrc*` and `eslint.config.*` are absent).
- `package.json` exposes `npm run typecheck` (`tsc --noEmit`) as the static quality gate.
- `tsconfig.json` uses `strict: true`, `allowJs: true`, `checkJs: false`, `jsx: react-native`, `target: ES2021`, and extends `expo/tsconfig.base`.

## Import Organization

**Order:**
1. Framework/runtime imports first, such as `import * as React from 'react';`, React hooks, and React Native imports in `src/App.tsx`.
2. Third-party package imports next, such as `@expo/vector-icons` in `src/App.tsx` and `@supabase/supabase-js` in `src/lib/supabase.ts`.
3. Local imports last, separated by a blank line, such as `./core/allocation.mjs`, `./data/demo`, and `./theme` in `src/App.tsx`.

**Path Aliases:**
- No path aliases are configured in `tsconfig.json`.
- Use relative imports for local modules: `./src/App` in `index.js`, `./core/allocation.mjs` in `src/App.tsx`, `../core/allocation.mjs` in `src/data/demo.ts`, and `../src/core/allocation.mjs` in `tests/allocation.test.mjs`.
- Include the `.mjs` extension when importing the allocation engine from TypeScript or tests, as shown in `src/App.tsx`, `src/data/demo.ts`, and `tests/allocation.test.mjs`.

## Error Handling

**Patterns:**
- Prefer explicit validation return objects for domain validation. `canSaveReceipt` in `src/core/allocation.mjs` returns `{ ok, reasons, result }` instead of throwing.
- Use stable machine-readable reason strings for validation failures, such as `unassigned_items`, `invalid_item_amounts`, and `receipt_total_mismatch` in `src/core/allocation.mjs`.
- Use early HTTP responses for request validation in Supabase functions. `supabase/functions/recognize-receipt/index.ts` returns JSON errors with status `405` for unsupported methods and `400` for invalid input.
- Avoid throwing for expected user-correctable states. `splitAmount` in `src/core/allocation.mjs` returns `[]` for empty allocations, zero amounts, and zero total weight.
- Convert validation errors to user-facing text at the UI boundary. `ReviewReceiptScreen` in `src/App.tsx` renders `validation.reasons.join(' / ').replaceAll('_', ' ')`.

## Logging

**Framework:** console not used

**Patterns:**
- No `console.*` calls are present in `src/`, `tests/`, or `supabase/functions/`.
- Keep logging out of pure calculation modules such as `src/core/allocation.mjs`.
- Add logging only at integration boundaries when needed, such as Supabase functions in `supabase/functions/recognize-receipt/index.ts` or client-service modules in `src/lib/`.

## Comments

**When to Comment:**
- Comments are not used in the current source files. Prefer self-explanatory names and small helpers, as in `splitAdjustment`, `normalizeAllocations`, and `pruneZeroTotals` in `src/core/allocation.mjs`.
- Add comments only when a domain rule is non-obvious, such as deterministic cent rounding in `src/core/allocation.mjs`.

**JSDoc/TSDoc:**
- JSDoc/TSDoc is not used.
- Public typing for the JavaScript allocation module is supplied through `src/core/allocation.d.ts`, not inline doc comments.

## Function Design

**Size:** Keep pure domain helpers small and focused. `src/core/allocation.mjs` exposes four public functions and keeps implementation helpers private in the same file. UI components in `src/App.tsx` are larger and file-local; new complex UI flows should be split into local component functions before adding more deeply nested JSX to `ReviewReceiptScreen`.

**Parameters:** Use object-shaped inputs for domain workflows, as in `allocateReceipt(receipt)` and `canSaveReceipt(receipt)` in `src/core/allocation.mjs`. Use destructured props with inline prop types for React component functions, as in `LoginScreen`, `GroupsScreen`, `ReviewReceiptScreen`, and `BottomNav` in `src/App.tsx`.

**Return Values:** Return plain serializable objects from domain code. `allocateReceipt` returns `memberTotals`, `itemShares`, `adjustmentShares`, `allocatedTotalCents`, `receiptTotalCents`, and `remainingCents` in `src/core/allocation.mjs`. React components return JSX directly from function components in `src/App.tsx`.

## Module Design

**Exports:** Use named exports for shared data, utilities, and clients: `colors`, `spacing`, and `type` in `src/theme.ts`; `groups`, `members`, and `scannedReceipt` in `src/data/demo.ts`; `supabase` and `isSupabaseConfigured` in `src/lib/supabase.ts`; `cents`, `dollars`, `allocateReceipt`, and `canSaveReceipt` in `src/core/allocation.mjs`. Use a default export only for the root React app component in `src/App.tsx`.

**Barrel Files:** Barrel files are not used. Import directly from the owning file, such as `src/theme.ts`, `src/data/demo.ts`, and `src/core/allocation.mjs`.

---

*Convention analysis: 2026-06-10*
