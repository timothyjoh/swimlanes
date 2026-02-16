# Phase 2: Columns (Swim Lanes)

## Objective
Deliver the column management feature that allows users to view a board detail page, add columns (swim lanes) to organize work, and manage those columns through rename and delete operations. This phase builds on the board foundation from Phase 1 and establishes the hierarchical structure (boards → columns) needed for cards in Phase 3.

## Scope

### In Scope
- Board detail page showing a single board with its columns
- Database table for columns with foreign key relationship to boards
- Column creation, listing, renaming, and deletion (CRUD operations)
- ColumnRepository following the established repository pattern
- RESTful API routes for column operations
- UI component to display columns horizontally across board
- Delete cascade behavior: deleting a board removes its columns
- Manual column reordering via position field (up/down or manual drag)
- Navigation from board list to board detail page

### Out of Scope
- Cards within columns (Phase 3)
- HTML5 drag-and-drop API implementation (defer until Phase 3 when cards exist)
- Board editing or deletion UI (can be a later polish phase)
- Advanced column features (color coding, collapse/expand, limits)
- Undo/redo functionality
- Real-time updates or optimistic UI patterns

## Requirements
- User can click a board from the home page to view its detail page
- User can add a new column to a board with a name
- User can see all columns for a board displayed horizontally
- User can rename a column
- User can delete a column
- User can reorder columns (change their position/sequence)
- All column data persists in SQLite with proper foreign key constraints
- Deleting a board automatically deletes its columns (CASCADE)
- Empty board (no columns) shows helpful message encouraging column creation
- Column operations return appropriate HTTP status codes (404 if board not found, etc.)

## Acceptance Criteria
- [ ] User can navigate to `/boards/:id` and see board name and column list
- [ ] User can add a new column via form on board detail page
- [ ] User can rename a column by clicking an edit button/icon
- [ ] User can delete a column via delete button/icon with confirmation
- [ ] User can reorder columns (e.g., up/down arrows or drag handles)
- [ ] Empty board shows "No columns yet" message with "Add Column" prompt
- [ ] API endpoint `POST /api/boards/:boardId/columns` creates column with position
- [ ] API endpoint `GET /api/boards/:boardId/columns` returns columns sorted by position
- [ ] API endpoint `PATCH /api/columns/:id` updates column name or position
- [ ] API endpoint `DELETE /api/columns/:id` removes column
- [ ] ColumnRepository has unit tests for all CRUD operations
- [ ] API routes have integration tests covering happy paths and error cases
- [ ] Foreign key constraint tested: deleting board cascades to columns
- [ ] Test for 404 when accessing non-existent board detail page
- [ ] All tests pass with >80% coverage on new code
- [ ] Code compiles without TypeScript warnings
- [ ] Board detail page loads without console errors

## Testing Strategy
- **Framework**: Continue using Vitest with in-memory SQLite via `getTestDb()`
- **Unit Tests**: ColumnRepository covering:
  - Create column with board_id and position
  - Find all columns for a board (ordered by position)
  - Find column by ID
  - Update column name and position
  - Delete column
  - Cascade delete: verify columns deleted when board deleted
- **Integration Tests**: API routes covering:
  - POST column with valid board_id → 201 Created
  - POST column with invalid board_id → 404 Not Found
  - GET columns for existing board → 200 OK with array
  - GET columns for non-existent board → 404 Not Found
  - PATCH column name → 200 OK
  - PATCH column position (reorder) → 200 OK
  - DELETE column → 204 No Content
  - DELETE board → verify columns also deleted
- **Coverage Expectations**: >80% on `ColumnRepository`, API routes, and board detail page logic
- **Test Cases Section** (explicit scenarios to prevent gaps):
  - Test that malformed JSON in POST returns 500
  - Test that missing `name` field in POST returns 400
  - Test that updating non-existent column returns 404
  - Test that deleting non-existent column returns 404
  - Test position ordering: create 3 columns, verify GET returns in position order

## Documentation Updates
- **CLAUDE.md**:
  - Add section on column entity and ColumnRepository
  - Document API route conventions for nested resources (`/api/boards/:boardId/columns`)
  - Add foreign key cascade behavior explanation
  - Update project structure to mention board detail page route
  - Add column reordering strategy (position field approach)

- **README.md**:
  - Update project status to "Phase 2 complete — board and column management"
  - Add screenshot or description of board detail page with columns
  - Mention column CRUD features in feature list

## Dependencies
- Phase 1 completion: boards must exist with working CRUD
- Existing BoardRepository and API routes functional
- Database migration system operational
- Test framework configured and running

## Adjustments from Previous Phase

Based on Phase 1 reflections:

1. **Include explicit test cases in spec** — This SPEC has a "Testing Strategy" section with specific scenarios (malformed JSON, missing fields, 404 cases) to prevent coverage gaps like the Phase 1 malformed JSON error handler.

2. **Address foreign key relationships explicitly** — The scope and requirements clearly define cascade delete behavior: deleting a board removes its columns. This must be tested explicitly.

3. **Maintain test coverage discipline** — Acceptance criteria includes ">80% coverage on new code" and reminder to run `npm run test:coverage` before moving to review step.

4. **Reuse repository + API test patterns** — Use `BoardRepository.test.ts` and `index.test.ts` as templates. Mock `getDb()` to redirect to `getTestDb()` in API tests (validated pattern from Phase 1).

5. **Defer drag-and-drop complexity** — Based on reflections, Phase 2 will NOT implement HTML5 DnD. Instead, use simpler UI (up/down buttons or position input) until Phase 3 when cards exist and DnD is needed for card movement between columns.

6. **Vertical slice maintained** — This phase delivers complete column management (DB → API → UI), not just infrastructure. User can see and interact with columns end-to-end.
