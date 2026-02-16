# Phase Review: Phase 6

## Overall Verdict
**NEEDS-FIX** — See MUST-FIX.md

## Code Quality Review

### Summary
Phase 6 implementation is architecturally sound and follows established patterns. The code compiles cleanly, all 230 unit/component tests pass, and the archive feature is functional. However, there are **critical issues with the `restoreCard` logic** and **E2E test failures** that must be fixed before this phase can be considered complete.

### Findings

1. **CRITICAL - Flawed restoreCard Logic** — `src/lib/db/cards.ts:202-228`
   - The fallback logic when original column is deleted is unnecessarily complex and potentially buggy
   - Lines 204-212 attempt to find board via "other cards in existing columns" — this will fail if the archived card is the only card from that board
   - Lines 216-223 fallback attempts to find "board by checking which board has a column with the closest ID" — this is nonsensical and will return an arbitrary board's first column
   - **Impact**: Restoring a card whose column was deleted will likely place it in the wrong board
   - **Root cause**: The archived card still has a `column_id` reference, but if that column was deleted (ON DELETE CASCADE disabled in test), there's no direct way to find the board
   - **Correct approach**: Store `board_id` in the Card interface, OR join through columns table assuming foreign key constraints are enabled

2. **CRITICAL - E2E Test Failures** — 3 tests failing in `tests/archive.spec.ts`
   - Test: "shows archive count badge after archiving" (line 44) — Badge not appearing after archive
   - Test: "archive badge shows correct count for multiple cards" (line 155) — Badge not updating count
   - Test: "empty archive page shows correct message" (line 163) — Message not appearing
   - **Likely cause**: Archive count badge not refreshing after archive operations (state management issue)

3. **Code Smell - Complex Nested Query** — `src/lib/db/cards.ts:204-212`
   - Three-level nested subquery is hard to understand and maintain
   - Performance concern: SQLite may not optimize this efficiently
   - Alternative: Simpler approach would be to preserve board_id or use existing foreign key relationships

4. **Minor - Missing Unit Test** — `src/lib/db/__tests__/cards.test.ts`
   - No test for "restore to first column when original deleted AND card is only card from that board"
   - Current test (line 648-661) creates col2 BEFORE archiving, ensuring board still has columns
   - Edge case: What if ALL columns are deleted from a board? (Should be impossible with foreign keys, but worth testing)

5. **Minor - Inconsistent Error Handling** — `src/lib/db/cards.ts:192-234`
   - `restoreCard` returns `undefined` on failure, but doesn't distinguish between "card not found", "card not archived", and "no valid column to restore to"
   - API endpoint (line 16 in restore.ts) returns generic "Card not found or not archived" error
   - Better UX would distinguish these cases for clearer error messages

6. **Good - Real SQLite in Tests** — `src/lib/db/__tests__/cards.test.ts:654-661`
   - Test correctly disables foreign keys to test deleted column scenario
   - Shows attention to detail and proper understanding of SQLite behavior

### Spec Compliance Checklist

#### Database & Repository Layer
- [x] Migration adds `archived_at` column with index
- [x] Card interface includes `archived_at: string | null`
- [x] `archiveCard(id)` sets `archived_at` timestamp
- [x] `listArchivedCards(boardId)` returns only archived cards with column names
- [x] `restoreCard(id)` clears `archived_at` timestamp
- [ ] `restoreCard(id)` handles deleted column correctly — **FAILS** (buggy logic)
- [x] `deleteCardPermanently(id)` hard deletes card
- [x] `listCardsByColumn()` excludes archived cards
- [x] `searchCards()` excludes archived cards

#### API Endpoints
- [x] `POST /api/cards/[id]/archive` endpoint exists
- [x] `POST /api/cards/[id]/restore` endpoint exists
- [x] `DELETE /api/cards/[id]/permanent` endpoint exists
- [x] `GET /api/cards/archived?boardId={id}` endpoint exists
- [x] All endpoints follow status code conventions (200/404/400/500)
- [x] All endpoints have try-catch error handling

#### UI Components
- [x] Archive button replaces delete in CardManager
- [x] Archive button has loading state and proper ARIA label
- [x] Archive removes card from UI optimistically
- [ ] Archive badge appears in ColumnManager — **FAILS E2E** (not refreshing)
- [ ] Archive badge shows correct count — **FAILS E2E** (state management issue)
- [x] Archive badge links to archive view page
- [x] Archive view page exists at `/boards/[id]/archive`
- [x] Archive view shows archived cards with column names
- [x] Restore button removes card from archive view
- [x] Delete button shows confirmation dialog
- [ ] Empty archive view shows message — **FAILS E2E** (selector issue)

#### Testing
- [x] Unit tests: 68 total card tests (12 new archive tests)
- [x] All unit tests pass (230/230)
- [ ] E2E tests: 12 archive scenarios — **3 FAILURES**
- [x] Test coverage on archive functions is adequate
- [x] Tests use real SQLite (no mocking)

#### Documentation
- [x] AGENTS.md updated with archive architecture
- [x] README.md updated with archive feature instructions
- [x] Documentation references correct file paths and function names

## Adversarial Test Review

### Summary
Test quality is **adequate but with critical gaps**. Unit tests cover the happy path and basic edge cases, but the "deleted column" scenario has a buggy implementation that the test doesn't catch. E2E tests are well-structured but 3 are failing, indicating UI state management issues.

### Findings

1. **CRITICAL - Test Passes But Implementation is Buggy** — `src/lib/db/__tests__/cards.test.ts:648-661`
   - Test: "moves to first column if original was deleted"
   - Test PASSES because it creates col2 BEFORE archiving and deleting col1
   - This means the card's board still has a valid column (col2) when restore runs
   - **But the production code's fallback logic is still broken** — test doesn't exercise the buggy fallback paths
   - **Missing test**: Archive card → delete ALL columns from board → restore card → should fail gracefully

2. **CRITICAL - E2E Tests Are Red** — `tests/archive.spec.ts`
   - 3 out of 9 E2E tests failing (33% failure rate)
   - Tests are well-written with proper selectors and waits
   - Failures suggest real bugs in the implementation, not flaky tests
   - **Must fix implementation, not weaken tests**

3. **Mock Abuse - None Detected** — Component tests are well-structured
   - CardManager tests mock fetch API only (appropriate)
   - No over-mocking of internal functions
   - Tests verify actual DOM interactions with user-event

4. **Boundary Conditions - Partially Covered**
   - ✅ Archive already-archived card → returns undefined
   - ✅ Restore non-archived card → returns undefined
   - ✅ Archive non-existent card → returns undefined
   - ❌ Restore card when ALL columns deleted → NOT TESTED
   - ❌ Restore card from different board (orphaned foreign key) → NOT TESTED

5. **Happy Path Only - Some Tests** — `tests/archive.spec.ts`
   - Most E2E tests follow the happy path (archive → restore → success)
   - Missing failure scenarios:
     - Archive operation fails (network error)
     - Restore operation fails (card moved to wrong board)
     - Permanent delete confirmation cancelled
     - Multiple simultaneous archives (race condition)

6. **Assertion Quality - Generally Strong**
   - Unit tests use specific assertions: `expect(archived!.archived_at).not.toBeNull()` ✅
   - E2E tests verify visibility with proper waits: `await expect(element).toBeVisible()` ✅
   - Good use of `.not.toBeVisible()` to verify disappearance ✅

7. **Integration Gaps - Badge Refresh**
   - Unit tests pass, component tests pass, but E2E tests fail
   - This suggests integration issue: archive count badge not refreshing after operations
   - Likely cause: ColumnManager fetches archive count once on mount, never refreshes
   - **Missing mechanism**: Badge should re-fetch count after navigation back from archive view

8. **Test Independence - Good**
   - Each E2E test creates fresh board with unique timestamp
   - No shared state between tests
   - Proper cleanup via beforeEach setup

### Test Coverage

**Unit/Component Tests**: 230 passing (0 failures)
- Archive functions: 12 tests covering create/list/restore/delete
- Search/list exclusion: 2 tests verifying archived cards filtered
- Component interactions: Tests for archive button, loading states, error handling

**E2E Tests**: 6 passing, 3 failing (67% pass rate)
- Passing: archive, navigate to archive view, show card, restore, delete, search exclusion
- Failing: badge visibility, badge count, empty state message

**Coverage Quality**: Adequate on happy path, **critical gaps on edge cases and integration**

### Missing Test Cases

Based on SPEC.md requirements NOT covered:

1. **Archive and restore preserve card description** — E2E test exists in PLAN but not in actual test file
2. **Archive and restore preserve card color** — E2E test exists in PLAN but not in actual test file
3. **Archive persists after page reload** — E2E test exists in PLAN but not in actual test file
4. **Restore to first column after column deletion** — E2E test exists in PLAN but not in actual test file
5. **Keyboard navigation in archive view** — Mentioned in SPEC.md acceptance criteria but not tested
6. **Archive count badge updates when restoring** — Integration gap (badge doesn't refresh)

## Summary

Phase 6 delivers the core archive functionality as specified, with solid architecture and comprehensive unit test coverage. However, **two critical issues block completion**:

1. **Buggy restoreCard logic** that will fail in production when original column is deleted
2. **E2E test failures** indicating the archive badge is not updating properly

The implementation demonstrates good patterns (real SQLite in tests, proper error handling, accessibility features), but the complex nested query in `restoreCard` and the missing badge refresh mechanism are significant quality issues that must be addressed.

**Recommendation**: Address all items in MUST-FIX.md before declaring phase complete. The fixes are isolated to two areas (restoreCard function and badge refresh) and should not require extensive refactoring.
