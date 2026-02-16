# Phase 4: Position Rebalancing and UX Polish

## Objective
Address the position convergence limitation identified in Phase 3 by implementing automatic position rebalancing when positions get too close together. Additionally, add keyboard shortcuts and visual polish to improve the user experience. This phase ensures SwimLanes remains reliable under heavy use and feels professional and responsive.

## Scope

### In Scope
- **Position rebalancing logic** — automatically detect when positions converge below a threshold (e.g., gaps < 10) and renumber all items in a list with fresh 1000-unit gaps
- **Rebalancing triggers** — run rebalancing after drag-and-drop operations when convergence is detected
- **Repository layer enhancements** — add `rebalanceColumnPositions(boardId)` and `rebalanceCardPositions(columnId)` functions
- **Keyboard shortcuts** — add common keyboard shortcuts for improved navigation and editing:
  - `Enter` to start editing a card/column name
  - `Escape` to cancel editing
  - Arrow keys (↑/↓) to navigate between cards in a column
  - `Delete` or `Backspace` to delete selected card/column (with confirmation)
- **Visual feedback improvements**:
  - Drag preview styling (semi-transparent ghost during drag)
  - Drop zone highlighting (show valid drop targets)
  - Focus indicators for keyboard navigation
- **Accessibility improvements**:
  - ARIA labels for drag-and-drop operations
  - Screen reader announcements for card/column moves
  - Focus management for keyboard navigation
- **Full test coverage** for rebalancing logic, keyboard shortcuts, and accessibility features
- Update AGENTS.md with rebalancing strategy and keyboard shortcuts
- Update README.md with keyboard shortcuts documentation

### Out of Scope
- Card search/filtering (future enhancement)
- Undo/redo functionality (significant architecture change)
- Export board to JSON/CSV (future enhancement)
- Dark mode theme toggle (future enhancement)
- Card archiving/soft delete (future enhancement)
- Mobile touch-based drag improvements (Phase 3 reflections noted this gap but it's not critical)
- Multi-board views or board templates

## Requirements
- Rebalancing algorithm must maintain relative order of items (no position swaps)
- Rebalancing must be atomic (single transaction per list)
- Rebalancing threshold: trigger when any gap between consecutive items is < 10
- Rebalancing output: items renumbered to 1000, 2000, 3000, ... with 1000-unit gaps
- Keyboard shortcuts must not interfere with native browser shortcuts
- Keyboard shortcuts must work when focus is on cards/columns (not when editing text)
- Drag preview must be visually distinct from original element
- Drop zones must highlight on dragover and unhighlight on dragleave/drop
- All new features must maintain TypeScript strictness (no `any` types)
- All async operations show loading indicators
- All error paths handled with try-catch and user-visible error messages

## Acceptance Criteria
- [ ] After many drag-and-drop operations, positions do not converge to unusable values (< 1)
- [ ] When positions converge below threshold, rebalancing automatically renumbers items
- [ ] Rebalancing maintains the correct order of items (no position swaps)
- [ ] Rebalancing happens transparently without disrupting user's view
- [ ] User can press `Enter` on a card/column to start editing
- [ ] User can press `Escape` to cancel editing
- [ ] User can use arrow keys to navigate between cards
- [ ] User can press `Delete` or `Backspace` to delete a card/column (with confirmation)
- [ ] Dragged items show semi-transparent preview during drag
- [ ] Valid drop zones highlight on hover during drag
- [ ] Focus indicators are visible and clear for keyboard users
- [ ] Screen readers announce card/column moves
- [ ] All tests pass (unit, integration, component, E2E)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on rebalancing functions is 80%+
- [ ] Documentation updated with rebalancing strategy and keyboard shortcuts

## Testing Strategy
- **Framework**: Vitest for unit/integration tests, Playwright for E2E tests (continue from Phase 3)
- **Coverage**: Run `npm test -- --coverage` to verify 80%+ on rebalancing functions
- **Key test scenarios**:
  - **Rebalancing unit tests** (15+ tests):
    - Detect when positions converge below threshold
    - Rebalance columns for a board (renumber to 1000, 2000, 3000)
    - Rebalance cards for a column (renumber to 1000, 2000, 3000)
    - Rebalancing maintains relative order
    - Rebalancing in single transaction (rollback on error)
    - No-op when positions are healthy (no rebalancing needed)
    - Edge case: single item (no rebalancing needed)
    - Edge case: two items with position 0 and 1 (rebalance to 1000, 2000)
  - **Integration tests** (10+ tests):
    - After drag-and-drop, verify rebalancing runs if needed
    - After multiple reorders, positions remain usable
    - Rebalancing endpoint returns correct status codes
  - **Keyboard shortcut tests** (10+ tests):
    - `Enter` starts editing card/column
    - `Escape` cancels editing
    - Arrow keys navigate between cards
    - `Delete` triggers delete confirmation
    - Shortcuts disabled during text editing
  - **E2E tests** (5+ scenarios):
    - Perform 50+ drag-and-drop operations, verify positions remain valid
    - Use keyboard to navigate and edit cards
    - Use keyboard to delete cards
    - Verify drag preview and drop zone highlighting appear correctly
    - Verify focus indicators are visible
- **Coverage expectation**: 80%+ on rebalancing functions, 80%+ on keyboard handler code

## Documentation Updates
- **AGENTS.md**: Add section on position rebalancing (when it triggers, how it works, threshold values), add keyboard shortcuts table, add accessibility features section
- **CLAUDE.md**: No changes needed (AGENTS.md is sufficient)
- **README.md**: Add keyboard shortcuts section with table of shortcuts and their actions

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 3 complete (all MVP features delivered)
- No new npm dependencies required (keyboard events are native, ARIA attributes are native)

## Adjustments from Previous Phase

Based on Phase 3 REFLECTIONS.md lessons learned:

1. **Position convergence limitation must be fixed**:
   - Phase 3 REFLECTIONS line 98 documents this as known technical debt
   - After many reorders, positions converge (e.g., 1000 → 1001 → floor rounding collisions)
   - Phase 4 implements automatic rebalancing to prevent this

2. **Continue bottom-up build order**:
   - DB → API → UI with tests at each layer has worked flawlessly in all phases
   - Phase 4 follows the same pattern: rebalancing in repository layer first, then API integration, then UI triggers

3. **E2E test strategy should include stress testing**:
   - Phase 3 E2E tests covered happy paths for drag-and-drop
   - Phase 4 adds stress test: 50+ consecutive drag operations to verify rebalancing works

4. **Keyboard shortcuts improve accessibility**:
   - Phase 3 REFLECTIONS line 88 suggests keyboard shortcuts as future enhancement
   - Phase 4 delivers keyboard navigation for power users and accessibility

5. **Visual feedback enhances UX**:
   - Drag preview and drop zone highlighting make drag-and-drop more intuitive
   - Focus indicators improve accessibility for keyboard users

6. **No infrastructure-only work**:
   - This phase delivers user-visible features (rebalancing prevents bugs, keyboard shortcuts improve UX)
   - Follows vertical slice principle: every feature is testable end-to-end
