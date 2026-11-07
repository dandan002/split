# Split

Split is an iOS-first trip cost splitting app with receipt scanning, itemized allocation, tax/tip distribution, and Supabase/Postgres persistence.

## Local App

```bash
npm install
npm run ios
```

Set these environment variables before connecting a real backend:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

## Current Build

- Expo React Native app scaffold with login, groups, scan, activity/profile placeholders, and the receipt review flow.
- Framework-neutral allocation engine with deterministic cent rounding.
- Supabase schema for groups, members, expenses, receipts, items, adjustments, allocations, and final expense shares.
- Receipt recognition edge function contract returning draft OCR data that must be reviewed before save.

## Verification

```bash
npm test
npm run typecheck
```
