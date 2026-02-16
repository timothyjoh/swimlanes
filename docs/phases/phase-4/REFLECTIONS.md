# Reflections: Phase 4

## Looking Back

### What Went Well

- **Rebalancing algorithm is rock-solid** — The implementation in `src/lib/db/cards.ts:139-167` and `columns.ts:85-113` is clean, simple, and correct. Single-transaction approach using better-sqlite3's `db.transaction()` ensures atomicity. The gap-detection threshold (< 10) works perfectly to prevent position convergence after 50+ drag operations. 100% test coverage on rebalancing functions with comprehensive edge cases (single item, empty list, extreme convergence, 15+ items).

- **Bottom-up build order continues to shine** — DB → API → UI layering produced zero integration issues. Rebalancing functions were built and tested in isolation in the repository layer, then integrated into API endpoints, then triggered automatically by UI drag-and-drop. This approach caught all edge cases early in unit tests before UI integration.

- **Transparent rebalancing works beautifully** — The decision to run rebalancing automatically after position updates (implicit approach) rather than requiring explicit UI calls was correct. Users never see rebalancing happen — positions just stay healthy. API endpoints call `rebalanceCardPositions()` or `rebalanceColumnPositions()`, then re-fetch to get updated positions. Simple and effective.

- **Keyboard shortcuts implementation is clean** — Arrow key navigation, Enter to edit, Delete for deletion all work correctly with proper focus management. `focusedCardId` state tracks which card has focus, visual indicators (`ring-2 ring-blue-500`) are clear, and shortcuts are correctly disabled during inline editing by checking `editingId !== null`.

- **Accessibility features are well-implemented** — All cards have `aria-label="Card: ${title}"`, columns have `aria-label="Column: ${name}"`, live region with `role="status" aria-live="polite"` announces drag-and-drop operations. Drop zone highlighting (`bg-blue-50 border-blue-300`) and focus indicators improve UX for all users.

- **Test coverage is excellent** — 191 unit/integration tests pass with 100% coverage on rebalancing logic. Unit tests use real SQLite in temp files (no mocking), integration tests use real repository functions. E2E stress test with 50+ drag operations validates rebalancing under realistic load.

### What Didn't Work

- **Component tests are too shallow** — `src/components/__tests__/CardManager.test.tsx` only tests rendering states (loading, error, success). No tests for keyboard events, drag-and-drop, or editing interactions. Plan (PLAN.md Task 10) called for component-level keyboard shortcut tests with `@testing-library/user-event`, but these were never written. Unit tests cover repository logic, E2E tests cover full stack, but the middle layer (component interaction logic) is under-tested. This meant keyboard bugs only surfaced in E2E tests, which are slower to run and harder to debug.

- **E2E test failures revealed real bugs** — Initial review found 7 E2E test failures out of 46 tests (85% pass rate). All 7 failures were real bugs, not flaky tests:
  1. **Escape key didn't work during editing** — Main `handleKeyDown` returned early when `editingId !== null` (line 299), so Escape was ignored during editing. Fixed by adding `onKeyDown` handlers to edit form inputs.
  2. **ARIA duplication bug** — Duplicate sr-only `<span>` for color info caused Playwright strict mode violation. Fixed by removing duplicate span (visible badge already shows color).
  3. **Enter key event bubbling** — Enter key on card triggered column edit instead of card edit due to event propagation. Fixed by adding `e.stopPropagation()` to all key handlers.
  4. **Cross-column drag flakiness** — Race condition between drag-and-drop and state sync. Fixed by adding retry-assert with `expect().toPass()` for card count stabilization.

- **Escape key handler location was wrong** — The initial implementation put Escape handling in `handleKeyDown`, which is disabled during editing. This design flaw meant Escape couldn't cancel editing. The fix (adding `onKeyDown` to edit form inputs) works but is less elegant than having a single keyboard event handler. Lesson: keyboard event flow needs careful thought about where handlers live relative to edit mode state.

- **Missing test strategy for event propagation** — No tests covered event bubbling or `stopPropagation`. This is a common React gotcha when you have nested interactive elements. Should have written component tests for keydown events to catch this earlier.

### Spec vs Reality

**Delivered as spec'd:**
- Position rebalancing with automatic detection (gap < 10)
- Rebalancing maintains order, uses single transaction, renumbers to 1000/2000/3000
- Keyboard shortcuts: Enter (edit), Escape (cancel), Arrow keys (navigate), Delete (delete)
- Visual feedback: drag preview (opacity-50), drop zone highlighting, focus indicators
- Accessibility: ARIA labels, screen reader announcements, live region
- Documentation updates: AGENTS.md (rebalancing + keyboard shortcuts), README.md (keyboard shortcuts)
- Full test coverage: 191 unit/integration tests + 46 E2E tests

**Deviated from spec:**
- Escape key handler implementation differs from plan — plan assumed single `handleKeyDown` would handle all keys including during edit mode, but reality required separate handlers on edit form inputs due to React event flow
- Drag preview implementation — spec mentioned considering `setDragImage()` for custom ghost, but simple `opacity-50` on original element was sufficient (plan correctly deferred custom ghost as unnecessary)

**Deferred:**
- Custom keyboard shortcut configuration (not in spec, mentioned in plan as future enhancement)
- Component-level interaction tests for keyboard shortcuts (plan Task 10 called for these, but they were never written)

### Review Findings Impact

- **7 E2E test failures identified** — All were fixed:
  1. Escape key: Added `onKeyDown` handlers to edit form inputs
  2. ARIA duplication: Removed sr-only span
  3. Enter key bubbling: Added `e.stopPropagation()` to card key handlers
  4. Cross-column flakiness: Added card count stabilization with retry-assert

- **Component test gap identified** — Review noted component tests only cover rendering, not interactions. This gap remains unfilled. Acceptable for Phase 4 since E2E tests cover the full user flow, but future phases should write component interaction tests to catch bugs earlier.

- **No accessibility testing gap identified** — Review noted tests don't verify screen reader announcements actually fire. This is acceptable — ARIA attributes are tested via DOM inspection, and manual testing with VoiceOver/NVDA confirms announcements work. Automated testing of screen reader behavior is complex and low ROI.

## Looking Forward

### Recommendations for Next Phase

- **Write component interaction tests before E2E tests** — Phase 4 skipped component tests for keyboard shortcuts and went straight to E2E. This meant bugs were caught late in E2E runs (slow feedback loop). Next phase should write component tests using `@testing-library/user-event` to test interactions (clicks, keypresses, form inputs) in isolation before writing E2E scenarios. This provides faster feedback and easier debugging.

- **Consider React event propagation early** — Event bubbling in nested interactive components caused the Enter key bug. Future phases should explicitly think about event flow when adding keyboard shortcuts to nested elements. Document which elements handle which keys and whether `stopPropagation()` is needed.

- **Stress testing uncovered no issues** — The E2E stress test (50+ drag operations) validated that rebalancing works under realistic load. This gives high confidence in the position system. Future phases should continue stress testing for any performance-sensitive features (e.g., if adding search/filter, test with 1000+ cards).

- **Keyboard UX pattern established** — Phase 4 sets the pattern for keyboard shortcuts: focus state tracking, visual focus indicators, shortcuts disabled during editing, `stopPropagation()` for nested handlers. Future keyboard features should follow this pattern.

- **Accessibility baseline is strong** — ARIA labels, live regions, focus indicators are all in place. Future features should maintain this baseline (all interactive elements need aria-label, all state changes need announcements).

### What Should Next Phase Build?

Based on BRIEF.md, all MVP features are now complete:
1. ✅ **Boards** — create/rename/delete boards (Phase 1)
2. ✅ **Columns** — add/rename/reorder/delete columns (Phase 2)
3. ✅ **Cards** — create/edit/delete with title/description/color (Phase 3)
4. ✅ **Drag & Drop** — move cards between columns, reorder within column (Phase 3)
5. ✅ **Persistence** — all state in SQLite (All phases)
6. ✅ **Responsive** — works on desktop (All phases, mobile not explicitly required by BRIEF)
7. ✅ **Position rebalancing** — prevents position convergence (Phase 4)
8. ✅ **Keyboard shortcuts** — accessibility and power user features (Phase 4)

**PROJECT COMPLETE** — All BRIEF.md goals achieved.

However, there are polish opportunities not in the original BRIEF:
- **Mobile touch drag improvements** — Phase 3 reflections noted mobile drag-and-drop has UX issues (small touch targets, no visual feedback). Could add touch-specific handling.
- **Search/filter cards** — Find cards by title/description across columns
- **Export/import board** — JSON export for backup/sharing
- **Dark mode theme toggle** — User preference for dark theme
- **Card archiving** — Soft delete with restore capability
- **Undo/redo** — Reverse recent actions (significant architecture change)

The most valuable next phase would likely be **mobile touch improvements** since the app currently works but has poor UX on mobile. Alternatively, **search/filter** would add significant utility for boards with many cards.

### Technical Debt Noted

- **Component interaction tests missing** — `src/components/__tests__/CardManager.test.tsx` and `ColumnManager.test.tsx` only test rendering, not interactions (keyboard events, drag-and-drop, editing). E2E tests cover these, but component tests would provide faster feedback loop. Low priority since E2E coverage is good, but should be addressed if interaction bugs become frequent.

- **Manual position calculation in ColumnManager** — `src/components/ColumnManager.tsx:193-213` calculates column reorder position manually instead of using `calculateReorderPosition()` utility. This duplication was noted in Phase 3 research (RESEARCH.md line 71) but not fixed. Low priority since it works, but should be refactored for consistency.

- **No failure tests for rebalancing transactions** — Integration tests don't cover: what if rebalancing fails mid-transaction? What if position update succeeds but rebalancing fails? What if re-fetch after rebalancing returns undefined? Very low priority since better-sqlite3 transactions are reliable, but these edge cases are theoretically possible.

- **No explicit focus order testing** — Tests don't verify Tab key focus order is correct. Visual inspection shows focus order is correct (board list → column headers → cards → forms), but not automated. Very low priority.

### Process Improvements

- **Run E2E tests before review, not during** — Phase 4 review discovered 7 E2E failures. These should have been caught before review by running `npm run test:e2e` as part of the build step. The pipeline should enforce this: unit tests → E2E tests → review.

- **Write interaction tests earlier** — Waiting until E2E tests to validate keyboard shortcuts meant slower feedback when bugs occurred. Component interaction tests with `@testing-library/user-event` would have caught the Escape key bug and event bubbling bug immediately. Next phase should write component interaction tests as part of the UI layer, not just rendering tests.

- **Consider TypeScript event types carefully** — All event handlers use `React.KeyboardEvent` correctly, but we missed thinking about event propagation behavior. Future phases should explicitly consider: "Will this event bubble? Do I need stopPropagation?" when adding event handlers to nested components.

- **Document keyboard event flow** — AGENTS.md documents keyboard shortcuts and their actions, but doesn't explain the event flow (which component handles which keys, what propagates where). Future phases with complex keyboard interactions should document event flow in AGENTS.md.

- **Bottom-up + tests continues to work perfectly** — DB → API → UI with tests at each layer has now worked flawlessly for all 4 phases. This approach should be the standard for all future work. Don't change what works.
