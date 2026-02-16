# Research: Phase 3

## Phase Context

Phase 3 completes the SwimLanes MVP by adding cards with full CRUD functionality (create, edit title/description/color, delete), drag-and-drop within columns, drag-and-drop between columns, and comprehensive Playwright E2E testing covering all MVP features. Cards will have integer-based positioning matching the column positioning strategy, stored in a new SQLite table with foreign key cascade delete. The phase also extracts shared positioning logic to a utility module and adds E2E test infrastructure that was deferred from Phase 2.

## Previous Phase Learnings

Key points from Phase 2 REFLECTIONS.md that affect Phase 3:

1. **E2E tests are mandatory** — BRIEF.md line 29 requires Playwright E2E tests for any UI feature. Phase 2 deferred E2E tests; Phase 3 must deliver full Playwright setup and comprehensive E2E coverage as a hard requirement (REFLECTIONS.md lines 62-68).

2. **Bottom-up build order validated** — DB → API → UI with tests at each layer worked flawlessly in both phases. Continue this approach for cards (REFLECTIONS.md line 71).

3. **Error handling and loading states must be baked in from start** — Phase 2 proved that including error handling and loading indicators in the spec upfront eliminates post-implementation retrofitting (REFLECTIONS.md line 73).

4. **Extract positioning logic to shared utility** — Both columns and cards use the same integer gap positioning strategy (1000, 2000, 3000). Create `src/lib/utils/positioning.ts` with `calculateInitialPosition(items)` and `calculateReorderPosition(items, sourceIndex, targetIndex)` functions to reduce duplication and make future rebalancing logic easier (REFLECTIONS.md line 126).

5. **Position rebalancing remains deferred** — Phase 2 noted the risk of positions converging below 1 after many reorders, but rebalancing logic remains unimplemented technical debt (REFLECTIONS.md lines 75-76).

6. **Component interaction tests are valuable but optional** — Phase 2 component tests only verify rendering states. Phase 3 could add interaction tests using `@testing-library/user-event` for form submit, inline edit, drag-reorder, but rendering/loading/error tests take priority (REFLECTIONS.md line 77).

## Current Codebase State

### Relevant Components

#### Database Layer
- **Connection management** — `src/lib/db/connection.ts` — Singleton pattern with getDb(), auto-runs migrations from `db/migrations/`, enables WAL mode and foreign keys
- **Boards repository** — `src/lib/db/boards.ts` — 5 functions: createBoard, listBoards, getBoardById, renameBoard, deleteBoard
- **Columns repository** — `src/lib/db/columns.ts` — 6 functions: createColumn, listColumnsByBoard, getColumnById, renameColumn, deleteColumn, updateColumnPosition
- **Migrations** — `db/migrations/001_create_boards.sql` and `db/migrations/002_create_columns.sql` — Applied on startup, tracked in `_migrations` table

#### API Layer
- **Board endpoints** — `src/pages/api/boards/index.ts` (GET, POST) and `src/pages/api/boards/[id].ts` (PATCH, DELETE)
- **Column endpoints** — `src/pages/api/columns/index.ts` (GET, POST), `src/pages/api/columns/[id].ts` (PATCH, DELETE), `src/pages/api/columns/[id]/position.ts` (PATCH)
- **Patterns** — All routes validate inputs, return proper status codes (200, 201, 204, 400, 404), use try-catch for error handling, parse JSON with fallback for malformed requests

#### UI Layer
- **BoardList component** — `src/components/BoardList.tsx` — Manages board CRUD with inline editing, loading states, error banners, confirmation dialogs for delete
- **ColumnManager component** — `src/components/ColumnManager.tsx` — Manages column CRUD + drag-to-reorder using HTML5 DnD API, inline rename on click, delete with confirmation, horizontal scrollable layout
- **Board detail page** — `src/pages/boards/[id].astro` — SSR page, server-side board lookup with redirect if not found, renders ColumnManager island with `client:load`

### Existing Patterns to Follow

#### Repository Pattern
- **File location** — `src/lib/db/*.ts` — One file per entity type (boards.ts, columns.ts)
- **Function structure** — Export plain functions (not classes), use getDb() to get connection, validate inputs before DB operations, throw Error for validation failures, return undefined for not-found cases
- **TypeScript interface** — Export interface matching DB schema exactly (column names snake_case matching SQLite conventions)
- **Validation** — Trim whitespace, reject empty strings, check foreign keys exist before insert
- **Position calculation** — `columns.ts:21-24` — Calculate position as `(maxPos.max || 0) + 1000` for new items, giving 1000-gap spacing
- **Pattern in columns.ts:12-34** demonstrates the full create flow: validate, check foreign key, calculate position, insert, return fetched row

#### API Route Pattern
- **File location** — `src/pages/api/{entity}/` — RESTful structure with index.ts for collection endpoints, [id].ts for item endpoints, [id]/{action}.ts for sub-resources
- **Handler exports** — Export GET, POST, PATCH, DELETE as named APIRoute functions
- **JSON parsing** — `src/pages/api/boards/[id].ts:13-20` — Wrap request.json() in try-catch, return 400 with error message on parse failure
- **Validation** — Check required fields, validate types, return 400 with descriptive error messages
- **Status codes** — 200 (update success), 201 (create success), 204 (delete success), 400 (validation error), 404 (not found)
- **Error handling** — `src/pages/api/columns/index.ts:35-53` — Try-catch around repository calls, check error message to determine 404 vs 400

#### Component State Management Pattern
- **useState hooks** — Separate state for: items array, loading boolean, error string|null, form input values, operation-in-progress IDs (creating, updatingId, deletingId)
- **Loading indicators** — `ColumnManager.tsx:240-242` — Show "Loading..." message while initial fetch in progress
- **Error banners** — `ColumnManager.tsx:246-250` — Red banner at top when error state is not null
- **Optimistic UI updates** — After successful API call, update local state (setColumns/setBoards) without re-fetching
- **Inline editing** — Click item name to enter edit mode, auto-focus input, save on blur/Enter, cancel on Escape
- **Loading states during operations** — Disable buttons, show "Creating...", "Saving...", "Deleting..." text while operation in progress

#### HTML5 Drag-and-Drop Implementation
- **Drag handlers** — `ColumnManager.tsx:164-238` — onDragStart (store draggedId, set effectAllowed), onDragOver (preventDefault, set dropEffect), onDrop (calculate new position, call API)
- **Position calculation** — `ColumnManager.tsx:193-211` — Calculate midpoint between neighbors, or add/subtract 1000 at edges, floor the result to avoid decimals
- **Visual feedback** — `ColumnManager.tsx:285-287` — Apply opacity-50 class to dragged element using draggedId state
- **Draggable attribute** — `ColumnManager.tsx:281` — Make draggable={editingId !== column.id} to disable drag during inline edit

#### Database Schema Conventions
- **Table naming** — Plural lowercase (boards, columns)
- **Primary key** — `id INTEGER PRIMARY KEY AUTOINCREMENT`
- **Timestamps** — `created_at TEXT NOT NULL DEFAULT (datetime('now'))`, `updated_at TEXT NOT NULL DEFAULT (datetime('now'))`
- **Foreign keys** — `FOREIGN KEY (parent_id) REFERENCES parent_table(id) ON DELETE CASCADE`
- **Indexes** — Create index on foreign key columns: `CREATE INDEX idx_{table}_{column} ON {table}({column})`
- **Position field** — `position INTEGER NOT NULL` for ordering

### Dependencies & Integration Points

#### Database Integration
- **Connection singleton** — `src/lib/db/connection.ts:7-18` — getDb() returns cached connection, creates new DB file if needed, runs migrations on first call
- **Foreign key enforcement** — `connection.ts:14` — `db.pragma("foreign_keys = ON")` enables FK constraints
- **WAL mode** — `connection.ts:13` — Write-Ahead Logging for better concurrency
- **Migration tracking** — `connection.ts:21-44` — `_migrations` table tracks applied migrations, files in `db/migrations/` sorted alphabetically

#### Cascade Delete Implementation
- **Columns table** — `db/migrations/002_create_columns.sql:8` — `ON DELETE CASCADE` on board_id FK ensures columns deleted when board deleted
- **Test verification** — `src/lib/db/__tests__/columns.test.ts:148-158` — Test creates board with columns, deletes board, verifies columns gone
- **Pattern to follow** — Cards table will need `ON DELETE CASCADE` on column_id FK so cards deleted when column deleted

#### Positioning System
- **Integer gaps** — First item position = 1000, second = 2000, third = 3000
- **Reorder calculation** — `ColumnManager.tsx:193-211` — Calculate midpoint between neighbors to insert item without renumbering all items
- **Edge cases** — When moving to first position: `max(0, target.position - 1000)`, when moving to last: `target.position + 1000`
- **Known limitation** — After many reorders, positions converge (e.g., 1000 → 1001 → 1001.5 → floor rounding collisions). No rebalancing logic exists yet.

#### React Island Hydration
- **Component prop passing** — `src/pages/boards/[id].astro:27` — Pass props to island: `<ColumnManager client:load boardId={boardId} />`
- **TypeScript interface** — Define props interface in component: `interface ColumnManagerProps { boardId: number }`
- **Hydration directive** — `client:load` for immediate hydration, used for all interactive components

### Test Infrastructure

#### Test Framework
- **Framework** — Vitest 4.0.18 with v8 coverage provider
- **Configuration** — `vitest.config.ts` — Node environment for DB tests, 80% coverage thresholds on `src/lib/**`
- **Commands** — `npm test` (run once), `npm run test:watch` (watch mode), `npm run test:coverage` (with coverage report)

#### Database Test Pattern
- **Setup/teardown** — `src/lib/db/__tests__/boards.test.ts:16-30` — Create temp DB file in OS tmpdir before each test, close DB and delete files (including -wal, -shm) after each test
- **Real database** — Tests use real SQLite, no mocks. This validates migrations, FK constraints, SQL correctness
- **Test organization** — Describe blocks per function, multiple its per function testing success/error cases
- **Comprehensive coverage** — boards.test.ts has 15 tests, columns.test.ts has 21 tests covering all CRUD operations + position logic + cascade delete

#### API Test Pattern
- **Mock request factory** — `src/pages/api/boards/__tests__/boards-api.test.ts:11-28` — Helper functions to create Request objects and context objects
- **Integration tests** — Call API route handlers directly with mock requests, use real DB layer (no mocks)
- **Test coverage** — 13 tests for board API, 25 tests for column API covering success paths, validation errors, 400/404 responses, malformed JSON

#### Component Test Pattern
- **Environment** — `@vitest-environment happy-dom` directive at top of file for DOM testing
- **Mock fetch** — `ColumnManager.test.tsx:8-9` — Mock global.fetch with vi.fn() in beforeEach
- **Render + wait** — Use render() from @testing-library/react, waitFor() for async state updates
- **Test focus** — 5 tests covering: render without crash, loading state, successful render with data, error state, empty state
- **No interaction tests** — Current component tests don't test form submit, inline edit, drag-reorder (noted as gap in Phase 2 reflections)

#### Test Count Requirements
- **Phase 3 spec** — 20+ database tests for cards, 25+ API tests for card endpoints, 5+ component tests for CardManager, 8+ Playwright E2E tests

### Code References

#### Database Layer
- `src/lib/db/connection.ts:7-18` — Database connection singleton with migrations
- `src/lib/db/boards.ts:10-17` — createBoard validation and insert pattern
- `src/lib/db/columns.ts:12-34` — createColumn with FK validation and position calculation
- `src/lib/db/columns.ts:69-82` — updateColumnPosition for drag-and-drop
- `db/migrations/002_create_columns.sql:8` — ON DELETE CASCADE example

#### API Layer
- `src/pages/api/boards/index.ts:12-37` — POST endpoint with JSON parsing and validation
- `src/pages/api/columns/[id].ts:4-48` — PATCH endpoint returning 200 or 404
- `src/pages/api/columns/[id]/position.ts:1-51` — Sub-resource route pattern for position updates

#### UI Layer
- `src/components/BoardList.tsx:40-66` — Form submission with error handling and loading state
- `src/components/ColumnManager.tsx:58-86` — Create form with optimistic state update
- `src/components/ColumnManager.tsx:164-238` — Complete drag-and-drop implementation
- `src/components/ColumnManager.tsx:193-211` — Position calculation algorithm for reordering
- `src/pages/boards/[id].astro:6-17` — SSR page with DB lookup and redirect

#### Test Layer
- `src/lib/db/__tests__/boards.test.ts:16-30` — Test setup/teardown pattern
- `src/lib/db/__tests__/columns.test.ts:148-158` — CASCADE DELETE verification test
- `src/pages/api/boards/__tests__/boards-api.test.ts:11-28` — API test helper functions
- `src/components/__tests__/ColumnManager.test.tsx:1-96` — Component test with mocked fetch

## Open Questions

1. **E2E test infrastructure** — Playwright is not yet installed. Need to understand: Which Playwright packages are required? What test commands should be added to package.json? What playwright.config.ts settings are needed for headless/UI modes?

2. **Color label values** — SPEC mentions "5-7 predefined colors" and examples like red, blue, green, yellow, purple. Should these be: (a) hardcoded array in the component, (b) enum type in TypeScript, (c) database enum constraint, or (d) just stored as string with no validation?

3. **Card positioning utility** — SPEC requires extracting positioning logic to `src/lib/utils/positioning.ts`. Should this be done before cards implementation (create util first, then use it) or after (implement cards with inline logic, then extract)?

4. **Card description field** — SPEC says "shown in edit mode or on card expansion". Does this mean: (a) modal for editing, (b) inline expand/collapse, or (c) just show description on all cards always?

5. **Drag-between-columns API** — SPEC mentions separate endpoint `PATCH /api/cards/:id/column` for moving card to different column. Should this also update position, or is position handled separately via `PATCH /api/cards/:id/position`?

6. **Test execution order** — Should E2E test setup happen early (after DB migration but before cards implementation) or late (after all card features are working)? Early setup allows TDD approach, late setup means tests verify complete implementation.
