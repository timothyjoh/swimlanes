# Phase 2: Board Detail with Columns

## Objective
Deliver the second vertical slice of SwimLanes: a user can navigate to a board detail page and create/rename/reorder/delete columns (swim lanes) within that board. This phase builds on Phase 1's foundation by adding the column layer that will later hold cards, keeping the full-stack vertical slice approach.

## Scope

### In Scope
- Board detail page at `/boards/:id` showing the selected board and its columns
- SQLite migration adding `columns` table with `board_id` foreign key (ON DELETE CASCADE)
- Repository pattern for column data access in `src/lib/db/columns.ts`
- Astro API routes: `POST /api/columns`, `GET /api/columns?boardId=X`, `PATCH /api/columns/:id`, `DELETE /api/columns/:id`, `PATCH /api/columns/:id/position`
- React island for column management with create/rename/delete/reorder functionality
- Drag-to-reorder columns using HTML5 drag-and-drop API
- Column positioning using integer gaps (1000, 2000, 3000) for easy reordering
- Loading states and error handling for all column operations
- Full test coverage: unit tests for column repository, integration tests for column API routes, component tests for column interactions
- Update AGENTS.md with column architecture details

### Out of Scope
- Cards (Phase 3)
- Moving cards between columns (Phase 3)
- Card-level features like color labels or descriptions (Phase 3+)
- Advanced column features (collapse, width adjustment, templates)
- Keyboard shortcuts for column navigation
- Undo/redo functionality

## Requirements
- Columns table with `id`, `board_id` (FK), `name`, `position`, `created_at`, `updated_at`
- Foreign key constraint: `ON DELETE CASCADE` when board is deleted
- Column position is an integer field with default gaps of 1000 between columns
- Repository layer validates: column names cannot be empty, boardId must exist
- API routes follow REST conventions and return proper status codes (201, 200, 204, 400, 404)
- All async operations show loading indicators in the UI
- All error paths handled with try-catch and user-visible error messages
- TypeScript throughout with no `any` types
- Navigation from board list to board detail page (click board name)
- Columns displayed horizontally (typical kanban layout)

## Acceptance Criteria
- [ ] User can click a board name on the home page and navigate to `/boards/:id`
- [ ] Board detail page shows the board name and a list of columns
- [ ] User can create a new column by typing a name and submitting
- [ ] Newly created column appears in the list without page reload
- [ ] User can rename a column inline
- [ ] User can delete a column (with confirmation)
- [ ] User can drag a column to reorder it, and the new order persists
- [ ] Columns persist across server restarts (SQLite)
- [ ] Deleting a board cascades and deletes its columns
- [ ] All column operations show loading states (creating, saving, deleting)
- [ ] All error paths display error messages to the user
- [ ] Database layer has unit tests covering all column operations and error cases
- [ ] API routes have integration tests covering success and error paths
- [ ] Component has DOM tests verifying rendering, loading states, and error states
- [ ] All tests pass (100% of test suite)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on `src/lib/db/columns.ts` is 80%+

## Testing Strategy
- **Framework**: Vitest (continue from Phase 1)
- **Coverage**: Run `npm test -- --coverage` to verify 80%+ on data layer
- **Key test scenarios**:
  - **Database unit tests** (15+ tests):
    - Create column with valid data
    - Reject empty column name
    - Reject non-existent board_id
    - List columns for a board
    - List returns empty array for board with no columns
    - Rename column
    - Rename rejects empty name
    - Delete column
    - Reorder columns (update position)
    - Cascade delete: verify columns deleted when board is deleted
  - **API integration tests** (20+ tests):
    - POST /api/columns: success, missing name, invalid boardId, malformed JSON
    - GET /api/columns?boardId=X: success, missing boardId, invalid boardId
    - PATCH /api/columns/:id: success, missing name, invalid id, malformed JSON
    - DELETE /api/columns/:id: success, invalid id
    - PATCH /api/columns/:id/position: success, missing position, invalid id
  - **Component tests** (5+ tests):
    - Renders column list with loading state
    - Renders columns after fetch completes
    - Shows error banner when fetch fails
    - Triggers create column on form submit
    - Shows loading state during column creation
- **Coverage expectation**: 80%+ on `src/lib/db/columns.ts`, 80%+ on column API routes

## Documentation Updates
- **AGENTS.md**: Add column architecture section (table schema, position gaps strategy, cascade delete behavior)
- **CLAUDE.md**: No changes needed (AGENTS.md is sufficient)
- **README.md**: Update feature list to mention columns/swim lanes

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 1 complete (boards table, API routes, home page)
- No new npm dependencies required (drag-and-drop is native HTML5)

## Adjustments from Previous Phase

Based on REFLECTIONS.md lessons learned:

1. **Error handling is mandatory, not optional**:
   - All API routes MUST include try-catch around `request.json()` and database calls
   - All components MUST include error state and try-catch around fetch calls
   - Add explicit acceptance criterion: "All error paths display error messages to the user"

2. **Loading states are required, not nice-to-have**:
   - All async operations MUST show loading indicators (creating, updating, deleting)
   - Add explicit acceptance criterion: "All column operations show loading states"

3. **Component tests must verify observable behavior**:
   - No "smoke tests" — tests must use happy-dom and verify actual rendering
   - Component tests MUST cover: happy path render, loading state, error state
   - Add explicit test scenario: "Shows error banner when fetch fails"

4. **Cascade delete must be tested**:
   - Phase 1 deferred foreign keys; Phase 2 adds them
   - Add explicit test: "Cascade delete: verify columns deleted when board is deleted"

5. **Position field strategy documented upfront**:
   - Use integer gaps (1000, 2000, 3000) for easy reordering
   - Document this in AGENTS.md so future phases understand the pattern

6. **Review integrated during implementation**:
   - Don't wait until "done" to find critical issues
   - Consider checkpoints: after DB layer, after API routes, after UI

These adjustments ensure Phase 2 ships with production-quality error handling and user feedback from the start, not as post-implementation fixes.
