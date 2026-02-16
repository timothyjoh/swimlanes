# Must-Fix Items: Phase 4

## Summary
**4 critical issues found in E2E test review, 7 test failures out of 46 total tests (85% pass rate).**

All issues are in UI layer (CardManager component) and E2E tests. Repository and API layers are solid. The bugs prevent keyboard shortcuts from working correctly in production.

---

### Task 1: Fix Escape Key Not Working During Edit Mode
**Status:** ✅ Fixed
**What was done:** Added `onKeyDown` handlers to all three edit form inputs (title input, description textarea, color select) in `CardManager.tsx`. Each handler checks for `e.key === "Escape"` and calls `cancelEdit()`. This allows Escape to cancel editing even though the main `handleKeyDown` returns early when `editingId !== null`.

---

### Task 2: Fix ARIA Duplication Causing Strict Mode Violation
**Status:** ✅ Fixed
**What was done:** Removed the duplicate sr-only `<span>` element (lines 459-463) from `CardManager.tsx`. The visible color badge already shows the color text, and `aria-label` on the card container already announces the card for screen readers. Removing the sr-only span eliminates the Playwright strict mode violation where two spans matched "blue".

---

### Task 3: Fix Enter Key Not Triggering Edit Mode
**Status:** ✅ Fixed
**What was done:** The root cause was **event bubbling**, not focus or timing. When Enter was pressed on a card div, the keydown event bubbled up to the ColumnManager's column div, which also had an Enter key handler that triggered column name editing. The column's edit input then stole focus with `autoFocus`, preventing the card edit form from appearing. Fixed by adding `e.stopPropagation()` to all key handlers in `CardManager.tsx`'s `handleKeyDown` function (Enter, ArrowDown, ArrowUp, Delete/Backspace). Also added `await expect(card).toBeFocused()` and `await expect(card).toHaveClass(/ring-2/)` assertions in the E2E test to ensure focus is established before pressing Enter.

---

### Task 4: Fix Cross-Column Drag Test Flakiness
**Status:** ✅ Fixed
**What was done:** Added explicit card count stabilization wait inside the drag loop in `tests/position-rebalancing.spec.ts`. After each cross-column drag and `waitForLoadState('networkidle')`, the test now uses `expect().toPass({ timeout: 5000 })` to retry-assert that the total card count across both columns equals 3 before proceeding to the next drag operation. This prevents race conditions where the next drag starts before state has fully synced.

---

## Testing Checklist

After fixes, run all tests:

1. **Unit tests:** `npm test` → ✅ 191 tests passed
2. **E2E tests:** `npm run test:e2e` → ✅ All 46 tests passed
3. **Manual verification:**
   - Focus a card (click it or tab to it)
   - Press Enter → Edit form appears
   - Press Escape → Edit form closes
   - Press arrow keys → Focus moves between cards
   - Press Delete → Confirmation dialog appears
4. **Accessibility check:**
   - Inspect card element in DevTools
   - Verify only ONE span element contains color text (visible badge)
   - Verify `aria-label="Card: ${title}"` exists on card container
   - Verify live region announces moves: open console, drag card, check for announcement text update

## Success Criteria

Phase 4 is complete when:
- [x] All 191 unit/integration tests pass
- [x] All 46 E2E tests pass
- [x] Build compiles without errors (`npm run build`)
- [x] Manual keyboard shortcut testing works as specified
- [x] No ARIA duplication or strict mode violations in tests

**Current Status:** All 4 fixes applied and verified. 191 unit tests + 46 E2E tests all passing.
