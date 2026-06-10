# Codebase Structure

**Analysis Date:** 2026-06-10

## Directory Layout

```text
SPLIT/
├── index.js                         # Expo root registration
├── src/                             # React Native app, core logic, tokens, and client helpers
│   ├── App.tsx                      # Current app screens, local routing, and UI state
│   ├── core/                        # Framework-neutral allocation domain logic
│   │   ├── allocation.mjs           # Receipt allocation implementation
│   │   └── allocation.d.ts          # Type declarations for allocation.mjs
│   ├── data/                        # Prototype/demo data
│   │   └── demo.ts                  # Demo user, groups, members, scanned receipt
│   ├── lib/                         # External service client helpers
│   │   └── supabase.ts              # Supabase client singleton and config flag
│   └── theme.ts                     # Shared React Native color, spacing, typography tokens
├── tests/                           # Node test files
│   └── allocation.test.mjs          # Allocation core tests
├── supabase/                        # Supabase backend artifacts
│   ├── functions/
│   │   └── recognize-receipt/
│   │       └── index.ts             # Receipt recognition edge function
│   └── migrations/
│       └── 001_initial_schema.sql   # Database schema, indexes, RLS policies
├── stitch_minimalist_trip_splitter/ # Static design references and generated mockups
│   ├── monochrome_logic/
│   │   └── DESIGN.md                # Design system reference
│   ├── scan_receipt/
│   │   ├── code.html
│   │   └── screen.png
│   ├── split_items/
│   │   └── screen.png
│   ├── split_login/
│   │   ├── code.html
│   │   └── screen.png
│   └── your_groups/
│       ├── code.html
│       └── screen.png
├── package.json                     # npm scripts and dependencies
├── package-lock.json                # npm dependency lockfile
├── tsconfig.json                    # TypeScript compiler configuration
├── app.json                         # Expo app and native permission configuration
├── babel.config.js                  # Expo Babel preset configuration
└── README.md                        # Project overview and local commands
```

## Directory Purposes

**Project Root:**
- Purpose: Hold Expo project config, npm metadata, and top-level entry files.
- Contains: `index.js`, `package.json`, `package-lock.json`, `tsconfig.json`, `app.json`, `babel.config.js`, `README.md`.
- Key files: `index.js`, `package.json`, `app.json`.

**`src/`:**
- Purpose: Hold all runtime app source for the Expo React Native client.
- Contains: Root component, domain core, demo data, external client helpers, and theme tokens.
- Key files: `src/App.tsx`, `src/theme.ts`, `src/lib/supabase.ts`.

**`src/core/`:**
- Purpose: Hold framework-independent business logic that can run in Node tests and React Native.
- Contains: `src/core/allocation.mjs` and matching declarations in `src/core/allocation.d.ts`.
- Key files: `src/core/allocation.mjs`, `src/core/allocation.d.ts`.
- Guidance: Put receipt math, settlement math, currency conversion helpers, and deterministic validation here when they do not require React Native or Supabase.

**`src/data/`:**
- Purpose: Hold static prototype fixtures used by current UI flows.
- Contains: Demo user, groups, members, and scanned receipt data in `src/data/demo.ts`.
- Key files: `src/data/demo.ts`.
- Guidance: Keep throwaway/demo constants here; move persistent reads and writes into service/client modules when Supabase is wired.

**`src/lib/`:**
- Purpose: Hold client wrappers for external services and shared library configuration.
- Contains: Supabase client initialization in `src/lib/supabase.ts`.
- Key files: `src/lib/supabase.ts`.
- Guidance: Add Supabase query modules or service wrappers here, importing the singleton `supabase` from `src/lib/supabase.ts`.

**`tests/`:**
- Purpose: Hold automated tests that run outside the Expo runtime.
- Contains: Node test files using `node:test`.
- Key files: `tests/allocation.test.mjs`.
- Guidance: Add tests for `src/core/` modules here as `*.test.mjs`.

**`supabase/`:**
- Purpose: Hold backend database and edge function artifacts for Supabase.
- Contains: SQL migrations under `supabase/migrations/` and Deno edge functions under `supabase/functions/`.
- Key files: `supabase/migrations/001_initial_schema.sql`, `supabase/functions/recognize-receipt/index.ts`.
- Guidance: Add database changes as new migration files in `supabase/migrations/`; add edge function code under a function-specific directory in `supabase/functions/`.

**`supabase/functions/recognize-receipt/`:**
- Purpose: Hold the receipt recognition HTTP function.
- Contains: Deno TypeScript handler in `supabase/functions/recognize-receipt/index.ts`.
- Key files: `supabase/functions/recognize-receipt/index.ts`.
- Guidance: Keep receipt OCR provider integration and response normalization in this function directory.

**`supabase/migrations/`:**
- Purpose: Hold ordered SQL migrations.
- Contains: Initial database schema and policy migration.
- Key files: `supabase/migrations/001_initial_schema.sql`.
- Guidance: Name future migrations with sortable numeric or timestamp prefixes and include indexes, constraints, and RLS policies with the tables they support.

**`stitch_minimalist_trip_splitter/`:**
- Purpose: Hold static visual/design references generated outside the runtime app.
- Contains: Design system markdown, exported HTML mockups, and screenshots.
- Key files: `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`, `stitch_minimalist_trip_splitter/split_login/code.html`, `stitch_minimalist_trip_splitter/scan_receipt/screen.png`.
- Guidance: Use as reference for UI implementation; do not import from this directory in runtime app code.

**`.planning/codebase/`:**
- Purpose: Hold generated codebase intelligence documents for GSD planning.
- Contains: `ARCHITECTURE.md` and `STRUCTURE.md`.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.

## Key File Locations

**Entry Points:**
- `index.js`: Expo native app entry; imports `src/App.tsx` and registers it.
- `src/App.tsx`: React Native root component and all current UI screens.
- `supabase/functions/recognize-receipt/index.ts`: Supabase edge function HTTP entry.

**Configuration:**
- `package.json`: npm scripts (`start`, `ios`, `android`, `test`, `typecheck`) and dependencies.
- `app.json`: Expo app name, slug, scheme, iOS bundle identifier, camera/photo permission text, and Expo plugins.
- `tsconfig.json`: TypeScript settings, Expo base config extension, and include paths.
- `babel.config.js`: Expo Babel preset setup.
- `package-lock.json`: npm lockfile.

**Core Logic:**
- `src/core/allocation.mjs`: Allocation, validation, cent parsing, and dollar formatting.
- `src/core/allocation.d.ts`: Type declarations for allocation core consumers.
- `src/App.tsx`: UI-level state transitions, receipt assignment cycling, and presentation logic.

**Data and Service Boundaries:**
- `src/data/demo.ts`: Prototype data source for groups, members, and receipt review.
- `src/lib/supabase.ts`: Supabase client and configuration detection.
- `supabase/migrations/001_initial_schema.sql`: Persistent schema and authorization.
- `supabase/functions/recognize-receipt/index.ts`: Receipt recognition response boundary.

**Styling and Design:**
- `src/theme.ts`: Runtime color, spacing, and typography tokens.
- `src/App.tsx`: Component-local React Native styles.
- `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`: Design system reference.
- `stitch_minimalist_trip_splitter/*/screen.png`: Static visual references.

**Testing:**
- `tests/allocation.test.mjs`: Allocation behavior tests.
- `package.json`: `npm test` and `npm run typecheck` commands.

## Naming Conventions

**Files:**
- Root app component uses PascalCase: `src/App.tsx`.
- React Native token/module files use lowercase descriptive names: `src/theme.ts`.
- Domain JavaScript modules use lowercase descriptive names with `.mjs`: `src/core/allocation.mjs`.
- Type declarations mirror the JavaScript module name: `src/core/allocation.d.ts`.
- Test files use lowercase module names plus `.test.mjs`: `tests/allocation.test.mjs`.
- Supabase function entry files use `index.ts` inside a kebab-case function directory: `supabase/functions/recognize-receipt/index.ts`.
- SQL migrations use an ordered prefix and descriptive suffix: `supabase/migrations/001_initial_schema.sql`.

**Directories:**
- Source layer directories use short lowercase names: `src/core/`, `src/data/`, `src/lib/`.
- Supabase function directories use kebab-case: `supabase/functions/recognize-receipt/`.
- Static design artifact directory names use snake_case or generated naming from source artifacts: `stitch_minimalist_trip_splitter/`, `monochrome_logic/`, `scan_receipt/`.

**Code Symbols:**
- React components use PascalCase: `LoginScreen`, `ReviewReceiptScreen`, `BottomNav`, `Header`.
- Functions and variables use camelCase: `navigate`, `cycleAssignment`, `assignmentLabel`, `canSaveReceipt`, `allocateReceipt`.
- Type aliases use PascalCase: `Route`, `ReceiptDraft`, `ReceiptInput`, `RecognizedReceipt`.
- Exported token objects use lowercase nouns: `colors`, `spacing`, `type`.
- Database tables and columns use snake_case: `trip_groups`, `receipt_items`, `allocation_strategy`, `created_at`.
- SQL functions use snake_case: `public.is_group_member`.

## Where to Add New Code

**New Prototype Screen:**
- Primary code: `src/App.tsx`
- Tests: Not currently established for UI; keep screen behavior simple or extract logic to `src/core/` for tests in `tests/`.
- Guidance: Add a new `Route` union member in `src/App.tsx`, render the new component in the route switch, and add a `BottomNav` item only for top-level tabs.

**New Reusable UI Component:**
- Implementation: `src/App.tsx` for small components while the app remains compact.
- Future extraction target: Create `src/components/` when multiple screens share complex components.
- Guidance: Continue using React Native function components and shared tokens from `src/theme.ts`.

**New Business Rule or Allocation Feature:**
- Primary code: `src/core/allocation.mjs` or a new module under `src/core/`.
- Types: `src/core/allocation.d.ts` or a matching `.d.ts` file for new `.mjs` modules.
- Tests: `tests/allocation.test.mjs` or a new `tests/*.test.mjs` file.
- Guidance: Keep logic pure and avoid importing React Native or Supabase into `src/core/`.

**New Demo Fixture:**
- Primary code: `src/data/demo.ts` or a new file under `src/data/`.
- Tests: Not usually needed unless fixture builders include logic.
- Guidance: Use `cents` from `src/core/allocation.mjs` for money values to keep fixture units consistent.

**New Supabase Query or Mutation:**
- Primary code: `src/lib/` using `src/lib/supabase.ts`.
- Tests: No established integration test location; prefer extracting mappers/validators to `src/core/` for Node tests.
- Guidance: Import the exported `supabase` singleton; guard app flows with `isSupabaseConfigured` where backend connectivity is optional.

**New Database Table or Policy:**
- Primary code: `supabase/migrations/`.
- Tests: Not detected.
- Guidance: Add a new migration file; include constraints, indexes, `alter table ... enable row level security`, and policies using `public.is_group_member` for group-scoped data.

**New Edge Function:**
- Implementation: `supabase/functions/<function-name>/index.ts`.
- Shared helpers: Place helper files in the same function directory unless a shared Supabase functions convention is introduced.
- Guidance: Validate HTTP method and request body before provider calls; return JSON with explicit HTTP status codes.

**Receipt OCR Provider Integration:**
- Primary code: `supabase/functions/recognize-receipt/index.ts`.
- Persistence boundary: Store resulting review state through tables defined in `supabase/migrations/001_initial_schema.sql`.
- Guidance: Preserve the current draft response shape and status-based review workflow.

**Shared Theme Token:**
- Primary code: `src/theme.ts`.
- Consumers: `src/App.tsx` and future UI files.
- Guidance: Add token values to `colors`, `spacing`, or `type`; avoid duplicating shared visual primitives in component-local styles.

## Special Directories

**`.expo/`:**
- Purpose: Expo local development metadata.
- Generated: Yes.
- Committed: Not determined from repository tracking; current working tree shows it as untracked.

**`node_modules/`:**
- Purpose: Installed npm packages.
- Generated: Yes.
- Committed: Current working tree shows it as untracked; should generally remain uncommitted.

**`.planning/`:**
- Purpose: GSD planning and codebase intelligence artifacts.
- Generated: Yes.
- Committed: Intended for workflow artifacts depending on project policy.

**`stitch_minimalist_trip_splitter/`:**
- Purpose: Static design reference bundle.
- Generated: Appears generated/exported.
- Committed: Current working tree shows it as untracked.

**`supabase/`:**
- Purpose: Backend schema and functions.
- Generated: No; source-controlled backend artifacts.
- Committed: Current working tree shows it as untracked.

---

*Structure analysis: 2026-06-10*
