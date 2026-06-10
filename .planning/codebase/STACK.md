# Technology Stack

**Analysis Date:** 2026-06-10

## Languages

**Primary:**
- TypeScript - Expo/React Native application code in `src/App.tsx`, shared theme code in `src/theme.ts`, Supabase client setup in `src/lib/supabase.ts`, and Supabase Edge Function code in `supabase/functions/recognize-receipt/index.ts`.
- JavaScript / ECMAScript modules - app bootstrap in `index.js`, allocation engine in `src/core/allocation.mjs`, Node test files in `tests/allocation.test.mjs`, and Babel config in `babel.config.js`.
- SQL - Supabase/Postgres schema, indexes, RLS policies, and helper function in `supabase/migrations/001_initial_schema.sql`.

**Secondary:**
- HTML - static design/reference exports in `stitch_minimalist_trip_splitter/split_login/code.html`, `stitch_minimalist_trip_splitter/scan_receipt/code.html`, and `stitch_minimalist_trip_splitter/your_groups/code.html`.
- Markdown - project docs in `README.md` and design reference in `stitch_minimalist_trip_splitter/monochrome_logic/DESIGN.md`.

## Runtime

**Environment:**
- Node.js v26.3.0 detected locally via `node -v`; no `.nvmrc`, `.node-version`, or `engines` field is present in `package.json`.
- npm v11.16.0 detected locally via `npm -v`.
- Expo runtime for the mobile app, configured by `app.json` and launched by scripts in `package.json`.
- React Native runtime through `react-native` 0.85.3 and Expo SDK package `expo` ^56.0.9 in `package.json`.
- Deno runtime for Supabase Edge Functions; `supabase/functions/recognize-receipt/index.ts` imports `serve` from `https://deno.land/std@0.224.0/http/server.ts`.
- Postgres runtime through Supabase migrations in `supabase/migrations/001_initial_schema.sql`.

**Package Manager:**
- npm
- Lockfile: present at `package-lock.json` with lockfileVersion 3.

## Frameworks

**Core:**
- Expo ^56.0.9 - mobile app framework and developer runtime, invoked by `npm run start`, `npm run ios`, and `npm run android` in `package.json`.
- React 19.2.3 - component framework used in `src/App.tsx`.
- React Native 0.85.3 - native UI runtime used by imports from `react-native` in `src/App.tsx`.
- Supabase JavaScript client ^2.45.4 - backend client created in `src/lib/supabase.ts`.
- Supabase Edge Functions / Deno std 0.224.0 - HTTP function contract in `supabase/functions/recognize-receipt/index.ts`.
- Supabase Postgres - relational schema and row-level security in `supabase/migrations/001_initial_schema.sql`.

**Testing:**
- Node built-in test runner - `npm test` runs `node --test tests/*.test.mjs` from `package.json`.
- No Jest, Vitest, or React Native Testing Library config detected.

**Build/Dev:**
- TypeScript ~5.3.3 - typechecking configured by `tsconfig.json` and run by `npm run typecheck`.
- Babel preset Expo ^56.0.14 - Metro/Babel transpilation configured by `babel.config.js`.
- Expo CLI - exposed through `expo start`, `expo start --ios`, and `expo start --android` scripts in `package.json`.

## Key Dependencies

**Critical:**
- `expo` ^56.0.9 - app runtime, bundler integration, and local developer server in `package.json`.
- `react` 19.2.3 - UI component model in `src/App.tsx`.
- `react-native` 0.85.3 - native UI primitives used throughout `src/App.tsx`.
- `@supabase/supabase-js` ^2.45.4 - backend client for Supabase Auth/Postgres/Functions/Storage, instantiated in `src/lib/supabase.ts`.
- `react-native-url-polyfill` ^2.0.0 - URL polyfill required before Supabase client setup in `src/lib/supabase.ts`.
- `expo-camera` ~56.0.7 - declared in `package.json` and configured in `app.json` for receipt scanning permissions.
- `expo-image-picker` ~56.0.16 - declared in `package.json` and configured in `app.json` for receipt image imports.

**Infrastructure:**
- `@expo/vector-icons` ^15.0.2 - icon rendering in `src/App.tsx` through `Ionicons` and `MaterialCommunityIcons`.
- `expo-status-bar` ~56.0.4 - Expo status bar package declared in `package.json`; `src/App.tsx` currently imports `StatusBar` from `react-native`.
- `@types/react` ^19.2.0 - React typings for TypeScript in `package.json`.
- `babel-preset-expo` ^56.0.14 - Babel preset configured in `babel.config.js`.
- `typescript` ~5.3.3 - static typechecking configured in `tsconfig.json`.

## Configuration

**Environment:**
- Supabase client configuration comes from Expo public environment variables in `src/lib/supabase.ts`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `src/lib/supabase.ts` exports `isSupabaseConfigured` so application code can check whether both public Supabase values are present.
- `README.md` documents `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` as required before connecting a real backend.
- No `.env`, `.env.*`, `.python-version`, `.nvmrc`, `eas.json`, `metro.config.*`, `supabase/config.toml`, `deno.json`, or `import_map.json` file detected in the scanned project root.

**Build:**
- `package.json` defines runtime scripts:
  - `npm run start` -> `expo start`
  - `npm run ios` -> `expo start --ios`
  - `npm run android` -> `expo start --android`
  - `npm test` -> `node --test tests/*.test.mjs`
  - `npm run typecheck` -> `tsc --noEmit`
- `tsconfig.json` extends `expo/tsconfig.base`, uses `strict: true`, `target: ES2021`, `lib: ["ES2021"]`, `moduleResolution: "node"`, `jsx: "react-native"`, `allowJs: true`, and `noEmit: true`.
- `babel.config.js` uses `babel-preset-expo`.
- `app.json` defines Expo app metadata, iOS bundle identifier `app.split.trips`, portrait orientation, URL scheme `split`, camera/photo library permission text, and Expo plugins for `expo-camera` and `expo-image-picker`.

## Platform Requirements

**Development:**
- Use npm with the committed `package-lock.json`.
- Use Expo CLI through npm scripts in `package.json`; iOS development requires the Expo/iOS toolchain invoked by `npm run ios`.
- Use TypeScript strict mode as configured in `tsconfig.json`.
- Use Supabase CLI or Supabase dashboard tooling to apply `supabase/migrations/001_initial_schema.sql` and deploy `supabase/functions/recognize-receipt/index.ts`; no local Supabase CLI config file is present.

**Production:**
- Mobile target is iOS-first. `app.json` sets `ios.supportsTablet` to `false` and `ios.bundleIdentifier` to `app.split.trips`.
- Backend target is Supabase-hosted Postgres/Auth/RLS and Supabase Edge Functions, represented by `supabase/migrations/001_initial_schema.sql` and `supabase/functions/recognize-receipt/index.ts`.
- Deployment target for mobile builds is not explicitly configured; no `eas.json` detected.

---

*Stack analysis: 2026-06-10*
