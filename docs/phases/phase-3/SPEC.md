# Phase 3: Cards with Drag-and-Drop

## Objective
Deliver the final core vertical slice of SwimLanes MVP: users can create cards within columns, edit card details (title, description, color label), delete cards, and drag cards both within columns and between columns. This phase completes all MVP features listed in BRIEF.md and adds full E2E test coverage with Playwright as required by the quality bar.

## Scope

### In Scope
- SQLite migration adding `cards` table with `column_id` foreign key (ON DELETE CASCADE)
- Repository pattern for card data access in `src/lib/db/cards.ts`
- Astro API routes: `POST /api/cards`, `GET /api/cards?columnId=X`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id`, `PATCH /api/cards/:id/position`, `PATCH /api/cards/:id/column`
- CardManager React component with create/edit/delete functionality
- Card positioning using integer gaps (same strategy as columns)
- Drag-to-reorder cards within a column using HTML5 drag-and-drop
- Drag cards between columns (updates both column_id and position)
- Color label selector for cards (5-7 predefined colors, displayed as visual tag)
- Card description field (textarea, optional)
- Loading states and error handling for all card operations
- **Playwright E2E test setup** — install Playwright, add test commands to package.json, configure playwright.config.ts
- **E2E tests covering all MVP features**: board CRUD, column CRUD, card CRUD, drag-within-column, drag-between-columns
- Full test coverage: unit tests for card repository (20+ tests), integration tests for card API routes (25+ tests), component tests for CardManager (5+ tests)
- Extract positioning logic to shared utility `src/lib/utils/positioning.ts` (reused by cards and columns)
- Update AGENTS.md with card architecture details, E2E test commands, positioning utility
- Update README.md with feature completion status and E2E test instructions

### Out of Scope
- Due dates, assignments, attachments (listed as non-goals in BRIEF.md)
- Real-time collaboration or multi-user features
- Keyboard shortcuts for card navigation
- Undo/redo functionality
- Advanced card features (subtasks, comments, file uploads)
- Position rebalancing logic for integer overflow (deferred technical debt)
- Mobile-specific responsive refinements (basic Tailwind responsiveness is sufficient)

## Requirements
- Cards table with `id`, `column_id` (FK), `title`, `description`, `color`, `position`, `created_at`, `updated_at`
- Foreign key constraint: `ON DELETE CASCADE` when column is deleted
- Card position is an integer field with default gaps of 1000 between cards (same as columns)
- Repository layer validates: card title cannot be empty, columnId must exist
- API routes follow REST conventions and return proper status codes (201, 200, 204, 400, 404)
- All async operations show loading indicators in the UI
- All error paths handled with try-catch and user-visible error messages
- TypeScript throughout with no `any` types
- Cards displayed vertically within columns (typical kanban layout)
- Color labels: at least 5 predefined colors (e.g., red, blue, green, yellow, purple) displayed as visual tag on card
- Description field is optional, shown in edit mode or on card expansion
- Drag-and-drop must work across Chrome, Firefox, and Brave
- **Playwright tests must run in CI mode (headless) and interactive mode (UI)**

## Acceptance Criteria
- [ ] User can create a new card within a column by typing a title and submitting
- [ ] Newly created card appears in the column without page reload
- [ ] User can edit a card inline or in a modal (title, description, color label)
- [ ] User can delete a card (with confirmation)
- [ ] User can drag a card to reorder it within the same column
- [ ] User can drag a card from one column to another column
- [ ] Card's new position and column persist after drag-and-drop
- [ ] Cards display a visual color label (if set)
- [ ] Cards persist across server restarts (SQLite)
- [ ] Deleting a column cascades and deletes its cards
- [ ] All card operations show loading states (creating, saving, deleting)
- [ ] All error paths display error messages to the user
- [ ] **Playwright is installed and configured** (`playwright.config.ts` exists)
- [ ] **E2E tests cover all MVP features**: board CRUD, column CRUD, card CRUD, drag-within-column, drag-between-columns
- [ ] **E2E tests pass in headless mode** (`npm run test:e2e`)
- [ ] Database layer has unit tests covering all card operations and error cases (20+ tests)
- [ ] API routes have integration tests covering success and error paths (25+ tests)
- [ ] Component has tests verifying rendering, loading states, and error states (5+ tests)
- [ ] All tests pass (100% of test suite)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on `src/lib/db/cards.ts` is 80%+
- [ ] **All BRIEF.md MVP features are complete**: boards ✅, columns ✅, cards ✅, drag-and-drop ✅, persistence ✅, responsive ✅

## Testing Strategy
- **Framework**: Vitest (continue from Phase 1 & 2) for unit/integration tests
- **E2E Framework**: Playwright (new in Phase 3) for end-to-end UI tests
- **Coverage**: Run `npm test -- --coverage` to verify 80%+ on data layer
- **Key test scenarios**:
  - **Database unit tests** (20+ tests for cards):
    - Create card with valid data
    - Reject empty card title
    - Reject non-existent column_id
    - List cards for a column
    - List returns empty array for column with no cards
    - Update card (title, description, color)
    - Update rejects empty title
    - Delete card
    - Reorder cards within column (update position)
    - Move card between columns (update column_id and position)
    - Cascade delete: verify cards deleted when column is deleted
  - **API integration tests** (25+ tests for card endpoints):
    - POST /api/cards: success, missing title, invalid columnId, malformed JSON
    - GET /api/cards?columnId=X: success, missing columnId, invalid columnId
    - PATCH /api/cards/:id: success, missing title, invalid id, malformed JSON
    - DELETE /api/cards/:id: success, invalid id
    - PATCH /api/cards/:id/position: success, missing position, invalid id
    - PATCH /api/cards/:id/column: success, missing columnId, invalid id
  - **Component tests** (5+ tests for CardManager):
    - Renders card list with loading state
    - Renders cards after fetch completes
    - Shows error banner when fetch fails
    - Triggers create card on form submit
    - Shows loading state during card creation
  - **E2E tests with Playwright** (8+ scenarios):
    - Create a board, verify it appears in the list
    - Rename a board, verify name updates
    - Delete a board, verify it's removed
    - Navigate to board detail, create a column, verify it appears
    - Rename a column, verify name updates
    - Reorder columns via drag-and-drop, verify new order persists on reload
    - Create a card in a column, verify it appears
    - Edit card title/description/color, verify changes persist
    - Drag card within column to reorder, verify new position persists on reload
    - Drag card from one column to another, verify column change persists on reload
    - Delete a column, verify cards are also deleted
    - Delete a card, verify it's removed
- **Coverage expectation**: 80%+ on `src/lib/db/cards.ts`, 80%+ on card API routes
- **E2E test commands**:
  - `npm run test:e2e` — run Playwright tests in headless mode (CI-friendly)
  - `npm run test:e2e:ui` — run Playwright tests with interactive UI (debugging)

## Documentation Updates
- **AGENTS.md**: Add card architecture section (table schema, color label values, drag-between-columns behavior, CASCADE DELETE), positioning utility module, E2E test commands
- **CLAUDE.md**: No changes needed (AGENTS.md is sufficient)
- **README.md**: Update feature list to mark all MVP features as complete, add E2E test instructions, add note about project completion

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 2 complete (columns table, column API routes, board detail page with columns)
- Playwright npm package (new dependency for E2E tests)
- No other new dependencies required (drag-and-drop is native HTML5)

## Adjustments from Previous Phase

Based on Phase 2 REFLECTIONS.md lessons learned:

1. **E2E tests are now mandatory**:
   - BRIEF.md line 29 requires "E2E tests required for any UI feature (use Playwright)"
   - Phase 2 deferred E2E tests; Phase 3 MUST deliver Playwright setup and full E2E coverage
   - Add explicit acceptance criteria: "Playwright is installed", "E2E tests cover all MVP features", "E2E tests pass in headless mode"
   - This is a hard requirement, not optional

2. **Extract positioning logic to shared utility**:
   - Phase 2 REFLECTIONS line 126 recommends `src/lib/utils/positioning.ts` to reduce duplication
   - Create `calculateInitialPosition(items)` and `calculateReorderPosition(items, sourceIndex, targetIndex)` functions
   - Both columns and cards use the same integer gap strategy (1000, 2000, 3000)
   - Shared utility makes future rebalancing logic easier to implement

3. **Continue bottom-up build order**:
   - DB → API → UI with tests at each layer worked flawlessly in Phases 1 & 2
   - Do not deviate from this approach

4. **Error handling and loading states mandatory**:
   - Phase 2 validated that baking these into the spec upfront works
   - Every async operation in Phase 3 must have error handling and loading indicators
   - Not optional, not nice-to-have

5. **Component tests should cover interactions where feasible**:
   - Phase 2 REFLECTIONS line 77 suggests component interaction tests using `@testing-library/user-event`
   - This is optional but valuable for CardManager (form submit, inline edit)
   - Prioritize rendering/loading/error tests first; add interaction tests if time permits

6. **Position rebalancing remains deferred**:
   - Phase 2 REFLECTIONS line 76 notes the risk of positions converging below 1 after many reorders
   - Phase 3 does NOT implement rebalancing logic (still deferred technical debt)
   - Document this limitation in AGENTS.md for future phases

7. **Review should check BRIEF.md compliance**:
   - Phase 2 REFLECTIONS line 120 recommends reviews validate against BRIEF.md goals
   - Ensure all MVP features from BRIEF.md are complete before marking phase done
