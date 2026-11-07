---
phase: quick-261106-rmq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/data/demo.ts
  - src/theme.ts
  - src/App.tsx
  - package.json
  - package-lock.json
autonomous: true
requirements: [QUICK-261106-rmq]
must_haves:
  truths:
    - "App renders and behaves identically (no UI or allocation-math change)"
    - "npm test passes (4 tests)"
    - "npm run typecheck output has no new errors vs baseline"
  artifacts:
    - path: "src/App.tsx"
      provides: "Screens without duplicate type / redundant wrapper"
  key_links: []
---

<objective>
Remove verified dead code and make small behavior-preserving refinements. No features, no UI changes, no allocation semantics changes.

Baseline recorded before planning:
- `npm test`: 4 pass, 0 fail.
- `npm run typecheck`: exactly two errors, both config-level and known: TS5098 (customConditions requires moduleResolution node16/nodenext/bundler) and TS6046 (expo/tsconfig.base.json --module value). Do NOT try to fix these. Goal: the output stays these same two lines.

Evidence gathered (grep over src/, index.js, app.json, README.md, tests/):
- All styles in `styles` in App.tsx are referenced; all `colors.*` and `spacing.*` are used. No unused imports in App.tsx.
- Do NOT touch `src/lib/supabase.ts` (unused now, but ROADMAP wires auth to it imminently). Note only.
- Do NOT touch `expo-camera` / `expo-image-picker` (configured in app.json plugins, planned for receipt capture).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@src/App.tsx
@src/data/demo.ts
@src/theme.ts
@src/core/allocation.d.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove dead fixtures, token and dependency</name>
  <files>src/data/demo.ts, src/theme.ts, package.json, package-lock.json</files>
  <action>
Remove only these items, each confirmed to have zero usages:
1. `src/data/demo.ts` lines 3-7: `export const currentUser = {...}` (grep `currentUser` shows only its definition). Keep the `cents` import (still used).
2. `src/data/demo.ts` line 50: top-level `confidence: 0.92,` on `scannedReceipt` (only item-level `confidence` is read, App.tsx:288; receipt-level is never read and is not in the `ReceiptInput` contract). Keep item-level confidence values.
3. `src/theme.ts`: the `mono` entry of `type` (grep `type.mono` shows 0 usages anywhere). Keep other `type` entries and `colors`/`spacing` untouched.
4. `expo-status-bar` dependency: App.tsx imports `StatusBar` from `react-native`, and nothing else references `expo-status-bar` (grep of src, index.js, app.json, README.md). Run `npm uninstall expo-status-bar` so package.json and package-lock.json both update. Do not change any other dependency version.
  </action>
  <verify>
    <automated>cd /Users/dandan/Desktop/Projects/SPLIT && npm test 2>&1 | grep -E "^ℹ (pass|fail)" && grep -rn "currentUser\|type\.mono\|expo-status-bar" src package.json | wc -l && npm run typecheck 2>&1 | grep -c "error TS"</automated>
  </verify>
  <done>Tests: pass 4, fail 0. grep count of removed identifiers is 0. Typecheck still reports exactly the 2 baseline config errors. package.json no longer lists expo-status-bar.</done>
</task>

<task type="auto">
  <name>Task 2: Behavior-preserving refinements in App.tsx</name>
  <files>src/App.tsx</files>
  <action>
Apply exactly these refinements:
1. Delete the local `type ReceiptInput = {...}` (lines 21-26) and instead `import type { ReceiptInput } from './core/allocation.mjs';` (it duplicates the exported `ReceiptInput` in src/core/allocation.d.ts). Keep the `ReceiptDraft` alias. Place the type import alongside the existing `./core/allocation.mjs` import.
2. Replace `import * as React from 'react'` plus `React.ReactNode` usages (ScreenFrame `children`, Header `right`) with a named `import type { ReactNode } from 'react'` (merge sensible with the existing `useMemo, useState` import line) and use `ReactNode`. Remove the namespace import.
3. Remove the redundant `navigate` wrapper in `App` (lines 32-34): it only forwards to `setRoute`. Rename usage so `navigate` is replaced by `setRoute` directly (`onNavigate={setRoute}`, `() => setRoute('groups')`, etc.).
4. In `ReviewReceiptScreen`, move the `receiptInput` construction inside the `useMemo` callback so the memo's `[receipt]` dependency list is truthful (currently the object is built every render outside the memo). Same input object contents, same `canSaveReceipt` call.
5. In `GroupsScreen` (line 118), replace the hardcoded `04 GROUPS` literal with a value derived from the fixture: `` `${String(groups.length).padStart(2, '0')} GROUPS` `` (renders identically for the current 4 groups).
Follow project style: 2-space indent, single quotes, semicolons, trailing commas. Add no comments. Do not touch styles, JSX structure, or `src/core/allocation.mjs`.
  </action>
  <verify>
    <automated>cd /Users/dandan/Desktop/Projects/SPLIT && npm test 2>&1 | grep -E "^ℹ (pass|fail)" && grep -c "React\.\|navigate\|04 GROUPS" src/App.tsx; npm run typecheck 2>&1 | grep -c "error TS"</automated>
  </verify>
  <done>Tests pass 4/0. grep for `React.`, `navigate`, `04 GROUPS` in App.tsx returns 0. Typecheck error count remains 2 (same TS5098/TS6046 baseline lines, no new errors referencing src/).</done>
</task>

</tasks>

<verification>
- `npm test` passes (4/4).
- `npm run typecheck` output identical to baseline (2 config errors, none from src/).
- `git diff --stat` touches only the listed files.
</verification>

<success_criteria>
Dead code listed above removed; refinements applied; no UI/allocation behavior change; tests green; typecheck not worse than baseline.
</success_criteria>

<output>
Create `.planning/quick/261106-rmq-clean-up-dead-code-refine/261106-rmq-SUMMARY.md` when done, including a "Noted, not removed" section: `src/lib/supabase.ts` (unused until auth phase), `expo-camera`/`expo-image-picker` (planned capture), `src/core/allocation.d.ts` `quantity?` field (part of public contract).
</output>
