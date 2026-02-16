# Must-Fix Items: Phase 7

## Summary
**1 critical issue, 2 minor issues** found in review. The critical issue is a flaky E2E test that fails intermittently due to a loose selector. The minor issues are documentation cleanup and a type safety improvement.

---

## Tasks

### Task 1: Fix Flaky E2E Test Selector
**Status:** ✅ Fixed
**What was done:** Added `.first()` to all 4 `getByPlaceholder('Add a card...')` calls in the `beforeEach` block (lines 22, 32, 42, 50) to disambiguate the "add card" input from card edit inputs. Verified with 3 consecutive runs — all 24 tests (12 per browser) pass 100% of the time.
**Priority:** Critical
**Files:** `tests/color-filter.spec.ts`

**Problem**: Test "keyboard navigation works with color chips" fails intermittently with error: "strict mode violation: locator('div.w-72').filter({ hasText: 'Todo' }).getByPlaceholder('Add a card...') resolved to 2 elements"

The selector `column.getByPlaceholder('Add a card...')` becomes ambiguous after cards are created because multiple card edit forms can have the same placeholder text. This causes the test to fail when Playwright finds 2+ elements matching the selector.

**Failing test location**: `tests/color-filter.spec.ts:153-166`
**Specific failure line**: `tests/color-filter.spec.ts:22` in the `beforeEach` block

**Fix**: Use a more specific selector in the `beforeEach` setup that disambiguates between the "add card" input and card edit inputs.

**Step-by-step fix**:

1. **Option A**: Use `.first()` to select the first matching element (the "add card" input is always first in the column):
   ```typescript
   // Line 22 (and similar lines 32, 42, 50)
   await column.getByPlaceholder('Add a card...').first().fill('Blocker');
   ```

2. **Option B**: Use a more specific selector that targets the form element:
   ```typescript
   // Find the "add card" form specifically
   const addCardInput = column.locator('form').getByPlaceholder('Add a card...');
   await addCardInput.fill('Blocker');
   ```

3. **Option C**: Use a data-testid attribute (requires adding to component):
   - Add `data-testid="add-card-input"` to the add card input in CardManager.tsx
   - Use `column.getByTestId('add-card-input')` in test

**Recommended approach**: Option A (`.first()`) is simplest and doesn't require code changes. The "add card" input is always the first input in the column, so this is safe and unambiguous.

**Apply to these lines in `beforeEach`**:
- Line 22: `await column.getByPlaceholder('Add a card...').first().fill('Blocker');`
- Line 32: `await column.getByPlaceholder('Add a card...').first().fill('Feature');`
- Line 42: `await column.getByPlaceholder('Add a card...').first().fill('Done');`
- Line 50: `await column.getByPlaceholder('Add a card...').first().fill('Plain');`

**Verify**:
1. Run `npx playwright test tests/color-filter.spec.ts` multiple times (at least 3 runs)
2. All 11 tests should pass consistently
3. No "strict mode violation" errors should appear
4. Specific check: Test "keyboard navigation works with color chips" should pass 100% of the time

---

### Task 2: Add Missing E2E Test for Drag-and-Drop on Filtered Cards
**Status:** ✅ Fixed
**What was done:** Added new E2E test "drag-and-drop works on filtered cards" at the end of `tests/color-filter.spec.ts`. Test creates a second column, filters to red cards, drags the red "Blocker" card to the new column, and verifies the card moved and the filter remained active. Total test count is now 12 (was 11).
**Priority:** Minor
**Files:** `tests/color-filter.spec.ts`

**Problem**: SPEC.md line 56 requires "Drag-and-drop, keyboard shortcuts, and inline editing work on filtered cards", but no E2E test explicitly verifies drag-and-drop functionality on filtered cards.

**Context**:
- Existing `tests/cards.spec.ts` tests drag-and-drop without filters
- Code doesn't prevent dragging filtered cards (filtering doesn't modify draggable attributes)
- However, SPEC acceptance criteria explicitly requires this to be tested

**Fix**: Add a new E2E test that verifies drag-and-drop works on color-filtered cards.

**Step-by-step fix**:

1. Add a new test at the end of `tests/color-filter.spec.ts` (after line 187):

```typescript
test('drag-and-drop works on filtered cards', async ({ page }) => {
  // Filter to show only red and blue cards
  await page.getByLabel('Filter by red cards').click();
  await page.getByLabel('Filter by blue cards').click();

  // Verify filtered cards are visible
  await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();
  await expect(page.locator('[aria-label="Card: Feature"]')).toBeVisible();

  // Get initial column name for "Blocker" card
  const blockerCard = page.locator('[aria-label="Card: Blocker"]');
  const initialColumn = await blockerCard.locator('..').locator('..').locator('h3').textContent();

  // Create a second column to drag to
  await page.getByPlaceholder('New column name').fill('In Progress');
  await page.getByRole('button', { name: 'Add Column' }).click();
  await expect(page.locator('h3').filter({ hasText: 'In Progress' })).toBeVisible();

  // Drag "Blocker" card from "Todo" to "In Progress"
  const targetColumn = page.locator('div.w-72').filter({ hasText: 'In Progress' });
  await blockerCard.dragTo(targetColumn);

  // Wait for drag operation to complete
  await page.waitForTimeout(500);

  // Verify card moved to new column
  const inProgressColumn = page.locator('div.w-72').filter({ hasText: 'In Progress' });
  await expect(inProgressColumn.locator('[aria-label="Card: Blocker"]')).toBeVisible();

  // Verify card is still visible (filter still applies)
  await expect(page.locator('[aria-label="Card: Blocker"]')).toBeVisible();

  // Verify red chip is still selected (filter didn't reset)
  await expect(page.getByLabel('Filter by red cards')).toHaveAttribute('aria-pressed', 'true');
});
```

2. Update test count in test file header if needed

**Verify**:
1. Run `npx playwright test tests/color-filter.spec.ts`
2. New test should pass
3. Verify drag-and-drop actually moves the card between columns
4. Verify color filter remains active after drag-and-drop
5. Total test count should be 12 tests (was 11)

---

### Task 3: Fix Documentation Duplication in AGENTS.md
**Status:** ✅ Fixed
**What was done:** Deleted the first "URL Persistence" section (under "Search Functionality") and renamed the second section to "URL Persistence for Search and Color Filters" to make it clear it covers both. Only one URL Persistence section now exists at line 337.
**Priority:** Minor
**Files:** `AGENTS.md`

**Problem**: The "URL Persistence" section is duplicated in AGENTS.md. Lines 316-320 define URL persistence for text search, then lines 343-349 redefine it for both search and colors. This creates confusion about which section is authoritative.

**Location**: `AGENTS.md:316-320` and `AGENTS.md:343-349`

**Fix**: Consolidate the two "URL Persistence" sections into one that covers both search and color filters.

**Step-by-step fix**:

1. **Delete lines 316-320** (first "URL Persistence" section under "Search Functionality"):
   ```markdown
   ### URL Persistence
   - **Query parameter**: Search query persists in URL as `?q=search+term`
   - **Shareable links**: Users can share links with pre-populated search queries
   - **Navigation**: Search query persists when using browser back/forward buttons
   - **Format**: Special characters are URL-encoded using `URLSearchParams`
   ```

2. **Keep lines 343-349** (second "URL Persistence" section) but move it to replace the deleted section, and rename it to clarify it covers both filters:
   ```markdown
   ### URL Persistence for Search and Color Filters
   - **Query parameter**: Search query persists in URL as `?q=search+term`
   - **Color parameter**: Selected colors persist in URL as `?colors=red,blue` (comma-separated)
   - **Shareable links**: Users can share links with pre-populated search queries and color filters
   - **Navigation**: Both search query and color filters persist when using browser back/forward buttons
   - **Combination**: Colors combine with text search in URL (`?q=todo&colors=red,blue`)
   - **Format**: Special characters are URL-encoded using `URLSearchParams`
   ```

3. **Result**: One consolidated "URL Persistence" section that covers both search and color filters, located after "Search Keyboard Shortcuts" section (around line 328).

**Verify**:
1. Read `AGENTS.md` to confirm only one "URL Persistence" section exists
2. Confirm the consolidated section mentions both `?q=` and `?colors=` parameters
3. Confirm the section is located logically after "Search Keyboard Shortcuts"
4. No information should be lost from either original section

---

### Task 4: Improve Type Safety for initialColors Prop
**Status:** ✅ Fixed
**What was done:** Changed `initialColors?: string[]` to `initialColors?: readonly string[]` in the `ColumnManagerProps` interface at `src/components/ColumnManager.tsx:35`. Build compiles without errors and all 249 tests pass.
**Priority:** Minor
**Files:** `src/components/ColumnManager.tsx`, `src/pages/boards/[id].astro`

**Problem**: The `initialColors` prop in ColumnManager is typed as `string[]` but should be `readonly string[]` to prevent accidental mutation. The FILTER_COLORS constant uses `as const` for immutability, but the prop doesn't enforce the same constraint.

**Location**: `src/components/ColumnManager.tsx:35` (props interface)

**Context**:
- `FILTER_COLORS` is defined as `readonly` array (line 22): `const FILTER_COLORS = ["red", "blue", "green", "yellow", "purple", "gray"] as const;`
- But `initialColors` prop is mutable: `initialColors?: string[]`
- This creates a type inconsistency

**Fix**: Make `initialColors` prop readonly to match the immutability pattern used for `FILTER_COLORS`.

**Step-by-step fix**:

1. **Update ColumnManager props interface** (line 35):
   ```typescript
   // Before
   interface ColumnManagerProps {
     boardId: number;
     initialSearchQuery?: string;
     initialColors?: string[];
   }

   // After
   interface ColumnManagerProps {
     boardId: number;
     initialSearchQuery?: string;
     initialColors?: readonly string[];
   }
   ```

2. **No changes needed in `src/pages/boards/[id].astro`** — the array from `.split(',')` is already readonly-compatible.

3. **No changes needed in component usage** — `useState` accepts readonly arrays and converts them to mutable state internally.

**Verify**:
1. Run `npm run build` to ensure TypeScript compiles without errors
2. Run `npm test` to ensure all tests still pass
3. No runtime behavior should change (this is only a type-level improvement)
4. TypeScript should prevent accidental mutations of `initialColors` in component code

---

## Verification Checklist

After completing all fixes:

- [ ] Run `npm run build` — should complete without errors
- [ ] Run `npm test` — all 249+ tests should pass
- [ ] Run `npx playwright test tests/color-filter.spec.ts` — all 12 tests should pass (was 11, now 12 with new drag-and-drop test)
- [ ] Run `npx playwright test tests/color-filter.spec.ts` **3 times** — all runs should pass 100% (no flaky failures)
- [ ] Read `AGENTS.md` — confirm only ONE "URL Persistence" section exists
- [ ] Read `MUST-FIX.md` — confirm all tasks marked complete

---

## Notes for Build Agent

**Task 1** is the critical blocker — the flaky test MUST be fixed before merge. Tasks 2-4 are quality improvements that should be done but are lower priority.

**Task 1 fix is trivial** — just add `.first()` to 4 lines in `beforeEach`. This is a 2-minute fix with zero risk.

**Task 2** (drag-and-drop test) is optional if time is limited — existing tests in `cards.spec.ts` provide some coverage, and the code doesn't prevent dragging filtered cards. However, SPEC acceptance criteria explicitly requires this, so it SHOULD be done.

**Tasks 3 and 4** are documentation/type safety cleanups — nice-to-have but not blockers.

**Prioritization**: Fix in order 1 → 2 → 3 → 4. Stop after Task 2 if time is limited.
