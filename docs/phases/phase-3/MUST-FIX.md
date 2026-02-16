# Must-Fix Items: Phase 3

## Summary
**3 critical issues, 1 minor issue** found in review. The application code is excellent and works correctly. All issues are in **E2E test selectors** (17/28 E2E tests failing) and one **missed DRY opportunity** in cards.ts.

## Tasks

### Task 1: Fix E2E Selector — Homepage h1 Check
**Status:** ✅ Fixed
**What was done:** Replaced `page.locator('h1')` with `page.getByRole('heading', { name: ..., level: 1 })` in all three spec files (boards.spec.ts, cards.spec.ts, columns.spec.ts). This uses Playwright's recommended getByRole approach with specific name filters, eliminating strict mode violations from multiple h1 elements.

---

### Task 2: Replace Arbitrary Timeouts with Proper Waits
**Status:** ✅ Fixed
**What was done:** Replaced `await page.waitForTimeout(500)` with `await page.waitForLoadState('networkidle')` in cards.spec.ts (drag within column and drag between columns) and columns.spec.ts (column reorder drag). This waits for actual API calls to complete rather than using arbitrary timeouts.

---

### Task 3: Fix Fragile Card Edit Input Selector
**Status:** ✅ Fixed
**What was done:** Replaced `columnA.locator('input[type="text"]').last()` with a scoped approach: click the card title using a filter-based locator, then target the edit input within `columnA.locator('div.bg-white')` (the single card in edit mode). Also fixed a secondary issue where the `hasText` filter broke after entering edit mode (input values aren't matched by `hasText`). Additionally fixed two related selector issues discovered during testing: (1) `.space-y-2` drop target resolving to 2 elements — replaced with `.min-h-\[50px\]`; (2) column delete button ambiguity when cards exist — targeted `button.text-sm` specifically. Same `hasText`-after-edit issue was also fixed in boards.spec.ts rename test.

---

### Task 4: Refactor cards.ts to Use Positioning Utility
**Status:** ✅ Fixed
**What was done:** Added `import { calculateInitialPosition, type PositionedItem } from "../utils/positioning"` to cards.ts. Replaced inline position calculation with `calculateInitialPosition(existingCards)`. Removed the local `PositionRow` interface in favor of the shared `PositionedItem` type. All 173 unit tests pass and build compiles cleanly.

---

## Completion Criteria

Phase 3 is **complete**:
1. ✅ Task 1 fixed — All E2E h1 selectors pass (no strict mode violations)
2. ✅ Task 2 fixed — Drag tests use proper waits (no arbitrary timeouts)
3. ✅ Task 3 fixed — Card edit selector is robust (targets specific card)
4. ✅ Task 4 fixed — cards.ts uses calculateInitialPosition() utility
5. ✅ All tests pass: `npm test` (173 tests) AND `npm run test:e2e` (28 tests)
6. ✅ Build succeeds: `npm run build`

Phase 3 is **done**. The implementation is production-ready.
