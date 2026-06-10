# External Integrations

**Analysis Date:** 2026-06-10

## APIs & External Services

**Backend-as-a-Service:**
- Supabase - application backend for auth identities, Postgres persistence, RLS-protected data access, and Edge Functions.
  - SDK/Client: `@supabase/supabase-js` from `package.json`
  - Client implementation: `src/lib/supabase.ts`
  - Auth: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Receipt Recognition:**
- Supabase Edge Function `recognize-receipt` - HTTP POST endpoint contract for receipt image recognition.
  - Implementation: `supabase/functions/recognize-receipt/index.ts`
  - Runtime: Deno with `https://deno.land/std@0.224.0/http/server.ts`
  - Request shape: JSON body with `imagePath`
  - Response shape: `{ imagePath, receipt, status: "needs_review" }`
  - Current behavior: returns an empty draft receipt with `currencyCode: "USD"`, zero totals, empty items, empty adjustments, and `status: "needs_review"`.
  - Third-party OCR/AI provider: Not detected.

**Mobile Device APIs:**
- Expo Camera - camera access for receipt scanning.
  - Package: `expo-camera` in `package.json`
  - Native config: `app.json` includes the `expo-camera` plugin and camera permission copy.
  - UI placeholder: `src/App.tsx` implements a simulated scan flow; direct `expo-camera` API calls are not currently present in source.
- Expo Image Picker - photo library access for importing receipt images.
  - Package: `expo-image-picker` in `package.json`
  - Native config: `app.json` includes the `expo-image-picker` plugin and iOS photo library permission copy.
  - Direct API calls: Not detected in `src/`.

**Platform Identity Providers:**
- Apple and Google sign-in are represented as UI actions in `src/App.tsx` labels `CONTINUE WITH APPLE` and `CONTINUE WITH GOOGLE`.
  - SDK/Client: Not detected.
  - Auth: Not wired; no Apple/Google OAuth packages or Supabase provider calls detected.

## Data Storage

**Databases:**
- Supabase Postgres
  - Schema: `supabase/migrations/001_initial_schema.sql`
  - Client: `@supabase/supabase-js` client exported from `src/lib/supabase.ts`
  - Connection: `EXPO_PUBLIC_SUPABASE_URL`
  - Public client auth: `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - Tables: `public.profiles`, `public.trip_groups`, `public.group_memberships`, `public.expenses`, `public.receipts`, `public.receipt_items`, `public.receipt_adjustments`, `public.item_allocations`, `public.expense_shares`
  - Extensions: `pgcrypto` enabled in `supabase/migrations/001_initial_schema.sql` for `gen_random_uuid()`
  - Indexes: receipt, adjustment, allocation, and expense share indexes are defined in `supabase/migrations/001_initial_schema.sql`
  - Access control: row-level security is enabled on all application tables in `supabase/migrations/001_initial_schema.sql`

**File Storage:**
- Receipt image storage is represented by `receipts.image_path` in `supabase/migrations/001_initial_schema.sql` and `imagePath` in `supabase/functions/recognize-receipt/index.ts`.
- Supabase Storage bucket definitions, storage policies, and upload code are not detected.
- Local filesystem storage is not used by the app source.

**Caching:**
- None detected.
- No Redis, local persistent cache, React Query, SWR, AsyncStorage, or Expo SQLite dependency detected in `package.json`.

## Authentication & Identity

**Auth Provider:**
- Supabase Auth
  - Implementation: `src/lib/supabase.ts` creates a Supabase client with `auth.autoRefreshToken: true`, `auth.detectSessionInUrl: false`, and `auth.persistSession: true`.
  - Database dependency: `public.profiles.id` references `auth.users(id)` in `supabase/migrations/001_initial_schema.sql`.
  - RLS identity: policies use `auth.uid()` throughout `supabase/migrations/001_initial_schema.sql`.
  - Current UI state: `src/App.tsx` uses local React state for login/navigation and demo data; no real sign-in/sign-out calls are detected.

**Authorization:**
- Supabase row-level security policies in `supabase/migrations/001_initial_schema.sql` enforce:
  - signed-in profile visibility/update rules,
  - group membership based read/manage rules,
  - owner-only membership management,
  - creator/uploader checks for expenses and receipts,
  - member-based access to receipt items, adjustments, allocations, and expense shares.
- Helper function `public.is_group_member(target_group_id uuid)` in `supabase/migrations/001_initial_schema.sql` centralizes group membership checks with `security definer`.

## Monitoring & Observability

**Error Tracking:**
- None detected.
- No Sentry, Bugsnag, Datadog, LogRocket, or similar dependency detected in `package.json`.

**Logs:**
- App-side logging pattern not detected in `src/`.
- Supabase Edge Function `supabase/functions/recognize-receipt/index.ts` returns JSON error responses for invalid method and missing `imagePath`; no structured logging is present.

## CI/CD & Deployment

**Hosting:**
- Mobile app hosting/build service: Not detected. No `eas.json` found.
- Backend hosting: Supabase is implied by `supabase/migrations/001_initial_schema.sql`, `supabase/functions/recognize-receipt/index.ts`, and `src/lib/supabase.ts`.

**CI Pipeline:**
- None detected.
- No GitHub Actions, GitLab CI, CircleCI, or other CI config was detected in the scanned files.

## Environment Configuration

**Required env vars:**
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL used in `src/lib/supabase.ts` and documented in `README.md`.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous public key used in `src/lib/supabase.ts` and documented in `README.md`.

**Secrets location:**
- No `.env` or `.env.*` files detected.
- Secret values are not committed in the inspected repository.
- Public Expo env vars are referenced by name only in `src/lib/supabase.ts` and `README.md`.

## Webhooks & Callbacks

**Incoming:**
- Supabase Edge Function `recognize-receipt` accepts HTTP POST requests in `supabase/functions/recognize-receipt/index.ts`.
- No inbound webhook route for third-party services is detected.

**Outgoing:**
- Supabase client requests are configured through `src/lib/supabase.ts`, but direct table queries, storage uploads, auth calls, or function invocations are not currently detected in `src/`.
- No outbound webhooks or third-party API calls are detected.

---

*Integration audit: 2026-06-10*
