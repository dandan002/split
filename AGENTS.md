<!-- GSD:project-start source:PROJECT.md -->
## Project

**Split**

Split is an iOS-first trip cost splitting app for groups who need to turn shared trip expenses into clear per-person balances. The existing codebase is a React Native/Expo prototype with login, groups, receipt scan, and receipt review screens, backed by a Supabase schema and a tested allocation engine.

The next milestone is to plan and add the missing functionality and screens that connect the prototype into a usable v1: real authentication, group/member flows, receipt capture and review, save-to-ledger persistence, activity, settlements, and account/profile management.

**Core Value:** Users can capture a shared receipt, assign each line item to the right people, and save an accurate ledger entry with trustworthy per-person totals.

### Constraints

- **Platform**: iOS-first Expo React Native app - preserve Expo scripts and mobile-first interaction patterns.
- **Backend**: Supabase Auth, Postgres, RLS, Storage, and Edge Functions - new persistence should use the existing Supabase direction.
- **Money math**: Allocation behavior must stay deterministic and cent-accurate - changes require focused tests.
- **Codebase shape**: `src/App.tsx` is too large for major feature work - split screens/components early enough to avoid compounding conflicts.
- **Type safety**: `npm run typecheck` is currently blocked by TypeScript/Expo config mismatch - fix before relying on TypeScript as a guardrail.
- **Security**: RLS and membership policies must be verified before exposing group, receipt, or settlement writes to real users.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript - Expo/React Native application code in `src/App.tsx`, shared theme code in `src/theme.ts`, Supabase client setup in `src/lib/supabase.ts`, and Supabase Edge Function code in `supabase/functions/recognize-receipt/index.ts`.
- JavaScript / ECMAScript modules - app bootstrap in `index.js`, allocation engine in `src/core/allocation.mjs`, Node test files in `tests/allocation.test.mjs`, and Babel config in `babel.config.js`.
- SQL - Supabase/Postgres schema, indexes, RLS policies, and helper function in `supabase/migrations/001_initial_schema.sql`.
- HTML - static design/reference exports in `stitch_minimalist_trip_splitter/split_login/code.html`, `stitch_minimalist_trip_splitter/scan_receipt/code.html`, and `stitch_minimalist_trip_splitter/your_groups/code.html`.
- Markdown - project docs in `README.md` and design reference in `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`.
## Runtime
- Node.js v26.3.0 detected locally via `node -v`; no `.nvmrc`, `.node-version`, or `engines` field is present in `package.json`.
- npm v11.16.0 detected locally via `npm -v`.
- Expo runtime for the mobile app, configured by `app.json` and launched by scripts in `package.json`.
- React Native runtime through `react-native` 0.85.3 and Expo SDK package `expo` ^56.0.9 in `package.json`.
- Deno runtime for Supabase Edge Functions; `supabase/functions/recognize-receipt/index.ts` imports `serve` from `https://deno.land/std@0.224.0/http/server.ts`.
- Postgres runtime through Supabase migrations in `supabase/migrations/001_initial_schema.sql`.
- npm
- Lockfile: present at `package-lock.json` with lockfileVersion 3.
## Frameworks
- Expo ^56.0.9 - mobile app framework and developer runtime, invoked by `npm run start`, `npm run ios`, and `npm run android` in `package.json`.
- React 19.2.3 - component framework used in `src/App.tsx`.
- React Native 0.85.3 - native UI runtime used by imports from `react-native` in `src/App.tsx`.
- Supabase JavaScript client ^2.45.4 - backend client created in `src/lib/supabase.ts`.
- Supabase Edge Functions / Deno std 0.224.0 - HTTP function contract in `supabase/functions/recognize-receipt/index.ts`.
- Supabase Postgres - relational schema and row-level security in `supabase/migrations/001_initial_schema.sql`.
- Node built-in test runner - `npm test` runs `node --test tests/*.test.mjs` from `package.json`.
- No Jest, Vitest, or React Native Testing Library config detected.
- TypeScript ~5.3.3 - typechecking configured by `tsconfig.json` and run by `npm run typecheck`.
- Babel preset Expo ^56.0.14 - Metro/Babel transpilation configured by `babel.config.js`.
- Expo CLI - exposed through `expo start`, `expo start --ios`, and `expo start --android` scripts in `package.json`.
## Key Dependencies
- `expo` ^56.0.9 - app runtime, bundler integration, and local developer server in `package.json`.
- `react` 19.2.3 - UI component model in `src/App.tsx`.
- `react-native` 0.85.3 - native UI primitives used throughout `src/App.tsx`.
- `@supabase/supabase-js` ^2.45.4 - backend client for Supabase Auth/Postgres/Functions/Storage, instantiated in `src/lib/supabase.ts`.
- `react-native-url-polyfill` ^2.0.0 - URL polyfill required before Supabase client setup in `src/lib/supabase.ts`.
- `expo-camera` ~56.0.7 - declared in `package.json` and configured in `app.json` for receipt scanning permissions.
- `expo-image-picker` ~56.0.16 - declared in `package.json` and configured in `app.json` for receipt image imports.
- `@expo/vector-icons` ^15.0.2 - icon rendering in `src/App.tsx` through `Ionicons` and `MaterialCommunityIcons`.
- `expo-status-bar` ~56.0.4 - Expo status bar package declared in `package.json`; `src/App.tsx` currently imports `StatusBar` from `react-native`.
- `@types/react` ^19.2.0 - React typings for TypeScript in `package.json`.
- `babel-preset-expo` ^56.0.14 - Babel preset configured in `babel.config.js`.
- `typescript` ~5.3.3 - static typechecking configured in `tsconfig.json`.
## Configuration
- Supabase client configuration comes from Expo public environment variables in `src/lib/supabase.ts`:
- `src/lib/supabase.ts` exports `isSupabaseConfigured` so application code can check whether both public Supabase values are present.
- `README.md` documents `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as required before connecting a real backend.
- No `.env`, `.env.*`, `.python-version`, `.nvmrc`, `eas.json`, `metro.config.*`, `supabase/config.toml`, `deno.json`, or `import_map.json` file detected in the scanned project root.
- `package.json` defines runtime scripts:
- `tsconfig.json` extends `expo/tsconfig.base`, uses `strict: true`, `target: ES2021`, `lib: ["ES2021"]`, `moduleResolution: "node"`, `jsx: "react-native"`, `allowJs: true`, and `noEmit: true`.
- `babel.config.js` uses `babel-preset-expo`.
- `app.json` defines Expo app metadata, iOS bundle identifier `app.split.trips`, portrait orientation, URL scheme `split`, camera/photo library permission text, and Expo plugins for `expo-camera` and `expo-image-picker`.
## Platform Requirements
- Use npm with the committed `package-lock.json`.
- Use Expo CLI through npm scripts in `package.json`; iOS development requires the Expo/iOS toolchain invoked by `npm run ios`.
- Use TypeScript strict mode as configured in `tsconfig.json`.
- Use Supabase CLI or Supabase dashboard tooling to apply `supabase/migrations/001_initial_schema.sql` and deploy `supabase/functions/recognize-receipt/index.ts`; no local Supabase CLI config file is present.
- Mobile target is iOS-first. `app.json` sets `ios.supportsTablet` to `false` and `ios.bundleIdentifier` to `app.split.trips`.
- Backend target is Supabase-hosted Postgres/Auth/RLS and Supabase Edge Functions, represented by `supabase/migrations/001_initial_schema.sql` and `supabase/functions/recognize-receipt/index.ts`.
- Deployment target for mobile builds is not explicitly configured; no `eas.json` detected.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use PascalCase for React Native app component entry files such as `src/App.tsx`.
- Use lowercase domain module names for shared logic such as `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `src/theme.ts`, and `src/lib/supabase.ts`.
- Use lowercase test filenames with the `.test.mjs` suffix in `tests/allocation.test.mjs`.
- Use Supabase function entrypoints named `index.ts` under a function-specific directory, as in `supabase/functions/recognize-receipt/index.ts`.
- Use camelCase for regular functions and helpers: `allocateReceipt`, `canSaveReceipt`, `splitAdjustment`, `normalizeAllocations`, `splitAmount`, `addCents`, and `pruneZeroTotals` in `src/core/allocation.mjs`.
- Use PascalCase for React component functions: `App`, `LoginScreen`, `GroupsScreen`, `ScanScreen`, `ReviewReceiptScreen`, `AvatarStrip`, `ScreenFrame`, `Header`, and `BottomNav` in `src/App.tsx`.
- Keep event-style callbacks named by intent with `on` prefixes in props: `onDone`, `onScan`, `onCapture`, `onChangeReceipt`, `onBack`, and `onNavigate` in `src/App.tsx`.
- Use camelCase for local variables and derived values: `receiptInput`, `memberTotals`, `activeMemberIds`, `baseShares`, `rankedShares`, and `allocatedTotalCents` in `src/App.tsx` and `src/core/allocation.mjs`.
- Use plural names for arrays: `members`, `groups`, `items`, `adjustments`, `allocations`, `itemShares`, and `adjustmentShares` in `src/data/demo.ts` and `src/core/allocation.mjs`.
- Use `*Cents` suffixes for integer money values: `amountCents`, `receiptTotalCents`, `allocatedTotalCents`, `remainingCents`, `subtotalCents`, and `totalCents` in `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `src/data/demo.ts`, and `supabase/functions/recognize-receipt/index.ts`.
- Use `is*` boolean names for configuration flags, as in `isSupabaseConfigured` in `src/lib/supabase.ts`.
- Use PascalCase for TypeScript type aliases: `Route`, `ReceiptDraft`, and `ReceiptInput` in `src/App.tsx`; `Member`, `AllocationInput`, `ReceiptItemInput`, `ReceiptAdjustmentInput`, and `ReceiptInput` in `src/core/allocation.d.ts`; `RecognizedReceipt` in `supabase/functions/recognize-receipt/index.ts`.
- Use discriminated string unions for fixed domain choices, as in `Route` in `src/App.tsx` and `ReceiptAdjustmentInput['strategy']` in `src/core/allocation.d.ts`.
- For JavaScript modules consumed from TypeScript, keep a sibling declaration file such as `src/core/allocation.d.ts` next to `src/core/allocation.mjs`.
## Code Style
- No Prettier, Biome, or formatter config is detected in `.prettierrc*`, `biome.json`, or package scripts in `package.json`.
- Follow the existing style manually: 2-space indentation, single quotes, semicolons, trailing commas in multiline object/array/function-call literals, and blank lines between import groups and major blocks.
- Keep React Native styles in `StyleSheet.create` objects, as in `src/App.tsx` and `src/theme.ts`.
- Keep UI copy and status labels uppercase where the existing UI uses uppercase labels, for example `GET STARTED`, `OVERVIEW`, and `TAP ROW TO REASSIGN` in `src/App.tsx`.
- No ESLint config is detected (`.eslintrc*` and `eslint.config.*` are absent).
- `package.json` exposes `npm run typecheck` (`tsc --noEmit`) as the static quality gate.
- `tsconfig.json` uses `strict: true`, `allowJs: true`, `checkJs: false`, `jsx: react-native`, `target: ES2021`, and extends `expo/tsconfig.base`.
## Import Organization
- No path aliases are configured in `tsconfig.json`.
- Use relative imports for local modules: `./src/App` in `index.js`, `./core/allocation.mjs` in `src/App.tsx`, `../core/allocation.mjs` in `src/data/demo.ts`, and `../src/core/allocation.mjs` in `tests/allocation.test.mjs`.
- Include the `.mjs` extension when importing the allocation engine from TypeScript or tests, as shown in `src/App.tsx`, `src/data/demo.ts`, and `tests/allocation.test.mjs`.
## Error Handling
- Prefer explicit validation return objects for domain validation. `canSaveReceipt` in `src/core/allocation.mjs` returns `{ ok, reasons, result }` instead of throwing.
- Use stable machine-readable reason strings for validation failures, such as `unassigned_items`, `invalid_item_amounts`, and `receipt_total_mismatch` in `src/core/allocation.mjs`.
- Use early HTTP responses for request validation in Supabase functions. `supabase/functions/recognize-receipt/index.ts` returns JSON errors with status `405` for unsupported methods and `400` for invalid input.
- Avoid throwing for expected user-correctable states. `splitAmount` in `src/core/allocation.mjs` returns `[]` for empty allocations, zero amounts, and zero total weight.
- Convert validation errors to user-facing text at the UI boundary. `ReviewReceiptScreen` in `src/App.tsx` renders `validation.reasons.join(' / ').replaceAll('_', ' ')`.
## Logging
- No `console.*` calls are present in `src/`, `tests/`, or `supabase/functions/`.
- Keep logging out of pure calculation modules such as `src/core/allocation.mjs`.
- Add logging only at integration boundaries when needed, such as Supabase functions in `supabase/functions/recognize-receipt/index.ts` or client-service modules in `src/lib/`.
## Comments
- Comments are not used in the current source files. Prefer self-explanatory names and small helpers, as in `splitAdjustment`, `normalizeAllocations`, and `pruneZeroTotals` in `src/core/allocation.mjs`.
- Add comments only when a domain rule is non-obvious, such as deterministic cent rounding in `src/core/allocation.mjs`.
- JSDoc/TSDoc is not used.
- Public typing for the JavaScript allocation module is supplied through `src/core/allocation.d.ts`, not inline doc comments.
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- `index.js` registers `src/App.tsx` as the Expo root component.
- `src/App.tsx` owns all current screen routing, UI composition, local receipt state, and interaction handlers.
- `src/core/allocation.mjs` is a standalone JavaScript domain module used by both the React Native app and Node tests.
- `supabase/migrations/001_initial_schema.sql` defines the planned Postgres data model and RLS policies; client code is not wired to it yet.
- `supabase/functions/recognize-receipt/index.ts` defines the receipt-recognition edge function contract and returns a review-required draft response.
## Layers
- Purpose: Boot the Expo app and attach the React Native root component.
- Location: `index.js`
- Contains: `registerRootComponent(App)` for Expo native runtime registration.
- Depends on: `expo`, `src/App.tsx`
- Used by: Expo CLI scripts in `package.json` (`npm run start`, `npm run ios`, `npm run android`).
- Purpose: Render login, groups, scan, receipt review, activity, profile, header, and bottom navigation flows.
- Location: `src/App.tsx`
- Contains: React function components (`LoginScreen`, `GroupsScreen`, `ScanScreen`, `ReviewReceiptScreen`, `BottomNav`, `Header`) and `StyleSheet.create` styles.
- Depends on: `react`, `react-native`, `@expo/vector-icons`, `src/core/allocation.mjs`, `src/data/demo.ts`, `src/theme.ts`
- Used by: `index.js`
- Prescriptive pattern: Add new prototype screens as function components near the related flow in `src/App.tsx` until routing or screen count warrants extraction.
- Purpose: Centralize shared color, spacing, and typography primitives for React Native styles.
- Location: `src/theme.ts`
- Contains: `colors`, `spacing`, and `type` exports backed by `StyleSheet.create`.
- Depends on: `react-native`
- Used by: `src/App.tsx`
- Prescriptive pattern: Add shared visual tokens to `src/theme.ts`; keep component-specific layout styles inside the component file using them.
- Purpose: Provide in-memory groups, members, current user, and scanned receipt fixtures for the current prototype.
- Location: `src/data/demo.ts`
- Contains: `currentUser`, `groups`, `members`, `scannedReceipt`.
- Depends on: `src/core/allocation.mjs` for `cents`.
- Used by: `src/App.tsx`
- Prescriptive pattern: Keep static prototype fixtures in `src/data/`; replace with service/query modules when wiring Supabase.
- Purpose: Convert receipt items, allocations, and adjustments into deterministic member totals with cent-accurate rounding.
- Location: `src/core/allocation.mjs`
- Contains: Public functions `cents`, `dollars`, `allocateReceipt`, `canSaveReceipt`; private helpers `splitAdjustment`, `normalizeAllocations`, `splitAmount`, `addCents`, `pruneZeroTotals`.
- Depends on: No framework or runtime-specific packages.
- Used by: `src/App.tsx`, `src/data/demo.ts`, `tests/allocation.test.mjs`.
- Prescriptive pattern: Keep receipt math and validation framework-neutral in `src/core/` so it remains testable with `node --test`.
- Purpose: Provide TypeScript declarations for the JavaScript allocation module.
- Location: `src/core/allocation.d.ts`
- Contains: `Member`, `AllocationInput`, `ReceiptItemInput`, `ReceiptAdjustmentInput`, `ReceiptInput`, and exported function signatures.
- Depends on: TypeScript declaration syntax only.
- Used by: TypeScript consumers importing `src/core/allocation.mjs`, especially `src/App.tsx` and `src/data/demo.ts`.
- Prescriptive pattern: Update `src/core/allocation.d.ts` whenever public exports or input/result shapes in `src/core/allocation.mjs` change.
- Purpose: Configure the Supabase browser/native client from Expo public environment variables.
- Location: `src/lib/supabase.ts`
- Contains: `supabase` client and `isSupabaseConfigured` boolean.
- Depends on: `react-native-url-polyfill/auto`, `@supabase/supabase-js`, `process.env.EXPO_PUBLIC_SUPABASE_URL`, `process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Used by: Not currently imported elsewhere.
- Prescriptive pattern: Put Supabase queries and mutations behind modules under `src/lib/` or future service files; do not call `createClient` outside `src/lib/supabase.ts`.
- Purpose: Define persistent data structures for profiles, groups, memberships, expenses, receipts, receipt items, adjustments, item allocations, and expense shares.
- Location: `supabase/migrations/001_initial_schema.sql`
- Contains: Tables, indexes, RLS enablement, `public.is_group_member(target_group_id uuid)`, and policies.
- Depends on: Supabase Postgres, `auth.users`, `auth.uid()`, `pgcrypto`.
- Used by: Supabase migrations/deployment tooling.
- Prescriptive pattern: Add new persistent entities through SQL migrations in `supabase/migrations/` and include RLS policies at the same time.
- Purpose: Accept an image path and return a draft recognized receipt shape requiring user review.
- Location: `supabase/functions/recognize-receipt/index.ts`
- Contains: Deno `serve` handler, `RecognizedReceipt` type, `POST` validation, JSON response helper.
- Depends on: Deno standard HTTP server import from `https://deno.land/std@0.224.0/http/server.ts`.
- Used by: Supabase Edge Functions runtime; not currently called by the app.
- Prescriptive pattern: Keep network/OCR provider details inside this function or helper modules under `supabase/functions/recognize-receipt/`; return review-safe drafts rather than directly committing OCR output.
- Purpose: Verify allocation behavior independently from React Native.
- Location: `tests/allocation.test.mjs`
- Contains: Node test suites for proportional adjustments, odd-cent rounding, equal adjustments, and save validation.
- Depends on: `node:test`, `node:assert/strict`, `src/core/allocation.mjs`.
- Used by: `npm test` from `package.json`.
- Prescriptive pattern: Add core logic tests under `tests/*.test.mjs` and import framework-neutral modules directly.
- Purpose: Preserve static design outputs and visual references for the prototype.
- Location: `stitch_minimalist_trip_splitter/`
- Contains: `monochrome_logic/DESIGN.md`, HTML exports such as `stitch_minimalist_trip_splitter/scan_receipt/code.html`, and PNG screenshots.
- Depends on: Not part of the app runtime.
- Used by: Human design/reference workflow.
- Prescriptive pattern: Treat this directory as reference input, not application source.
## Data Flow
- Local UI state uses React `useState` inside `src/App.tsx`.
- Derived receipt validation/allocation uses React `useMemo` in `ReviewReceiptScreen`.
- Persistent state is represented in `supabase/migrations/001_initial_schema.sql` but is not connected to the UI yet.
- Authentication/session state is configured in `src/lib/supabase.ts` but is not consumed by screens yet.
## Key Abstractions
- Purpose: Enumerate all in-app screens supported by local state routing.
- Examples: `src/App.tsx`
- Pattern: `type Route = 'login' | 'groups' | 'scan' | 'review' | 'activity' | 'profile'`; pass `navigate` callbacks into child components.
- Purpose: Hold the editable scanned receipt state rendered by the review flow.
- Examples: `src/App.tsx`, `src/data/demo.ts`
- Pattern: `type ReceiptDraft = typeof scannedReceipt`; update with immutable object spreads in `onChangeReceipt`.
- Purpose: Normalize UI/demo receipt state into the allocation core input contract.
- Examples: `src/App.tsx`, `src/core/allocation.d.ts`
- Pattern: Build `{ members, items, adjustments, receiptTotalCents }` before calling `canSaveReceipt`.
- Purpose: Split item and adjustment cents across members and produce audit-friendly share arrays.
- Examples: `src/core/allocation.mjs`, `tests/allocation.test.mjs`
- Pattern: Pure functions return data objects; no UI, database, or network side effects.
- Purpose: Determine how non-item amounts are distributed.
- Examples: `src/core/allocation.mjs`, `src/core/allocation.d.ts`, `src/data/demo.ts`, `supabase/migrations/001_initial_schema.sql`
- Pattern: Supported values are `proportional`, `equal`, and `custom`; database stores the equivalent in `receipt_adjustments.allocation_strategy`.
- Purpose: Provide one configured client for app-side Supabase access.
- Examples: `src/lib/supabase.ts`
- Pattern: Read Expo public env vars once and export `supabase` plus `isSupabaseConfigured`.
- Purpose: Centralize group access checks for RLS policies.
- Examples: `supabase/migrations/001_initial_schema.sql`
- Pattern: SQL function `public.is_group_member(target_group_id uuid)` is referenced from group-scoped policies.
- Purpose: Keep color, spacing, and typography reusable across React Native styles.
- Examples: `src/theme.ts`, `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`
- Pattern: Import named token objects into component files; do not duplicate shared constants inline.
## Entry Points
- Location: `index.js`
- Triggers: Expo runtime launched by `npm run start`, `npm run ios`, or `npm run android`.
- Responsibilities: Register `src/App.tsx` as the root component.
- Location: `src/App.tsx`
- Triggers: Expo root registration.
- Responsibilities: Hold route and receipt state, compose screens, render navigation, call allocation core for receipt review.
- Location: `tests/allocation.test.mjs`
- Triggers: `npm test`, which runs `node --test tests/*.test.mjs`.
- Responsibilities: Verify deterministic allocation and validation behavior.
- Location: `tsconfig.json`
- Triggers: `npm run typecheck`, which runs `tsc --noEmit`.
- Responsibilities: Type-check TypeScript and JavaScript-compatible imports included from `src/**/*` and `index.js`.
- Location: `supabase/migrations/001_initial_schema.sql`
- Triggers: Supabase migration tooling.
- Responsibilities: Create schema, indexes, RLS functions, and policies.
- Location: `supabase/functions/recognize-receipt/index.ts`
- Triggers: Supabase Edge Functions runtime HTTP requests.
- Responsibilities: Validate receipt-recognition requests and return a draft OCR result shape.
## Error Handling
- `src/core/allocation.mjs` returns `{ ok, reasons, result }` from `canSaveReceipt` instead of throwing for receipt validation problems.
- `src/App.tsx` disables the save button and displays validation reasons from `canSaveReceipt`.
- `supabase/functions/recognize-receipt/index.ts` returns JSON errors with explicit HTTP status codes for bad method and invalid body.
- `src/core/allocation.mjs` returns empty share arrays for empty allocations or zero amounts, allowing callers to surface validation separately.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
