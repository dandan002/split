# Testing Patterns

**Analysis Date:** 2026-06-10

## Test Framework

**Runner:**
- Node.js built-in test runner via `node --test`
- Config: Not detected; test discovery is controlled directly by the `test` script in `package.json`

**Assertion Library:**
- `node:assert/strict` in `tests/allocation.test.mjs`

**Run Commands:**
```bash
npm test              # Run all tests matching tests/*.test.mjs
npm run typecheck     # Run TypeScript static checks with tsc --noEmit
```

## Test File Organization

**Location:**
- Tests live in the top-level `tests/` directory.
- The current test suite is `tests/allocation.test.mjs`, which tests the pure allocation engine in `src/core/allocation.mjs`.

**Naming:**
- Use the `.test.mjs` suffix for Node test-runner files, as in `tests/allocation.test.mjs`.
- Name tests by the domain module or behavior under test; use `allocation.test.mjs` for `src/core/allocation.mjs`.

**Structure:**
```
tests/
└── allocation.test.mjs
```

## Test Structure

**Suite Organization:**
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  allocateReceipt,
  canSaveReceipt,
  cents,
} from '../src/core/allocation.mjs';

const members = [
  { id: 'ana', name: 'Ana' },
  { id: 'bo', name: 'Bo' },
  { id: 'cam', name: 'Cam' },
];

test('allocates receipt items and proportional tax/tip to member totals', () => {
  const result = allocateReceipt({
    members,
    items: [
      {
        id: 'burger',
        name: 'Burger',
        amountCents: cents('18.00'),
        allocations: [{ memberId: 'ana', weight: 1 }],
      },
    ],
    adjustments: [],
    receiptTotalCents: cents('18.00'),
  });

  assert.deepEqual(result.memberTotals, {
    ana: cents('18.00'),
  });
  assert.equal(result.remainingCents, 0);
});
```

**Patterns:**
- Use one `test(...)` block per behavior in `tests/allocation.test.mjs`.
- Build realistic receipt-shaped objects inline in each test so the tested scenario is self-contained.
- Use a shared module-level `members` fixture in `tests/allocation.test.mjs` when the same member ordering is required across deterministic rounding cases.
- Use `cents(...)` in assertions and inputs to avoid magic integer cents in tests.
- Assert complete totals with `assert.deepEqual` for object outputs and `assert.equal` for scalar outputs.

## Mocking

**Framework:** Not detected

**Patterns:**
```javascript
// No mocking pattern exists in the current test suite.
// Existing tests call pure functions from src/core/allocation.mjs directly.
```

**What to Mock:**
- Mock external services only at boundaries when tests are added for integration modules such as `src/lib/supabase.ts` or `supabase/functions/recognize-receipt/index.ts`.
- Keep core allocation tests in `tests/allocation.test.mjs` free of mocks because `src/core/allocation.mjs` is deterministic and side-effect free.

**What NOT to Mock:**
- Do not mock `cents`, `allocateReceipt`, or `canSaveReceipt` when testing allocation behavior; import the real functions from `src/core/allocation.mjs`.
- Do not mock local fixtures such as `members` in `tests/allocation.test.mjs`; declare explicit objects that show member order and allocation weights.

## Fixtures and Factories

**Test Data:**
```javascript
const members = [
  { id: 'ana', name: 'Ana' },
  { id: 'bo', name: 'Bo' },
  { id: 'cam', name: 'Cam' },
];

const result = allocateReceipt({
  members,
  items: [
    {
      id: 'fries',
      name: 'Fries',
      amountCents: cents('10.00'),
      allocations: [
        { memberId: 'ana', weight: 1 },
        { memberId: 'bo', weight: 1 },
        { memberId: 'cam', weight: 1 },
      ],
    },
  ],
  adjustments: [],
  receiptTotalCents: cents('10.00'),
});
```

**Location:**
- Shared test fixture data is declared at the top of `tests/allocation.test.mjs`.
- App demo data lives in `src/data/demo.ts` and is not imported by the current test suite.
- No dedicated `fixtures/` or `factories/` directory is detected.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# No coverage script is configured in package.json.
```

## Test Types

**Unit Tests:**
- Present for `src/core/allocation.mjs` through `tests/allocation.test.mjs`.
- Current coverage includes proportional tax/tip allocation, deterministic odd-cent splitting, equal adjustment allocation, unassigned-item validation, and receipt-total mismatch validation.

**Integration Tests:**
- Not used.
- No tests currently exercise Supabase client setup in `src/lib/supabase.ts`, the Supabase edge function in `supabase/functions/recognize-receipt/index.ts`, or the database schema in `supabase/migrations/001_initial_schema.sql`.

**E2E Tests:**
- Not used.
- No Detox, Maestro, Playwright, Cypress, or Expo E2E setup is detected in `package.json`.

## Common Patterns

**Async Testing:**
```javascript
// Not currently used. Prefer async node:test blocks when testing async code:
test('recognizes invalid receipt requests', async () => {
  // await the async function or fetch call here
});
```

**Error Testing:**
```javascript
test('save validation blocks unassigned items and unmatched receipt totals', () => {
  const unassigned = canSaveReceipt({
    members,
    items: [
      {
        id: 'pasta',
        name: 'Pasta',
        amountCents: cents('16.00'),
        allocations: [],
      },
    ],
    adjustments: [],
    receiptTotalCents: cents('16.00'),
  });

  assert.equal(unassigned.ok, false);
  assert.deepEqual(unassigned.reasons, ['unassigned_items']);
});
```

---

*Testing analysis: 2026-06-10*
