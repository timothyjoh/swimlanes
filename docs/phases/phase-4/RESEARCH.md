# Research: Phase 4

## Phase Context
Phase 4 addresses the position convergence limitation discovered in Phase 3 by implementing automatic position rebalancing when positions get too close together (gaps < 10). Additionally, it adds keyboard shortcuts for common operations (Enter to edit, Escape to cancel, arrow keys for navigation, Delete for deletion) and visual polish including drag previews, drop zone highlighting, focus indicators, and ARIA labels for accessibility. This ensures SwimLanes remains reliable under heavy use and feels professional and responsive.

## Previous Phase Learnings

From Phase 3 REFLECTIONS.md:

**Position convergence is known technical debt** (line 98) — After many reorders, positions converge below 1 (e.g., 1000 → 1001 → floor rounding collisions). No rebalancing logic currently implemented. Documented in AGENTS.md lines 169-170. Phase 4 must fix this limitation.

**Bottom-up build order works flawlessly** (line 7) — DB → API → UI with tests at each layer produced zero integration issues. Phase 4 should follow same pattern: rebalancing in repository layer first, then API integration, then UI triggers.

**E2E test strategy should emphasize specificity upfront** (line 108) — Use `getByRole()`, `getByText()`, and scoped filters from the start. Avoid generic selectors like `h1` or `.last()` that caused strict mode violations.

**Positioning utility extraction timing was correct** (line 114) — Creating shared utility first, then using it in both columns and cards, validated the abstraction before widespread use. Phase 4's rebalancing logic should follow similar approach.

**Run E2E tests before code review** (line 116) — Phase 3 review identified 17/28 E2E failures. Running `npm run test:e2e` before review would surface issues earlier.

**Keyboard shortcuts improve accessibility** (line 88-89) — Suggested as future enhancement. Phase 4 delivers keyboard navigation for power users and accessibility.

## Current Codebase State

### Relevant Components

**Positioning Utility** — `src/lib/utils/positioning.ts:1-35`
- Exports `POSITION_GAP` constant (1000)
- Exports `PositionedItem` interface (`id: number`, `position: number`)
- `calculateInitialPosition(items)` returns 1000 for empty list, `maxPosition + 1000` otherwise
- `calculateReorderPosition(items, draggedItem, targetIndex)` calculates midpoint between neighbors (line 33: `Math.floor((before.position + after.position) / 2)`)
- No rebalancing logic exists
- Known limitation: after many reorders, midpoint calculation can converge below 1

**Cards Repository** — `src/lib/db/cards.ts:1-138`
- `createCard(columnId, title, description?, color?)` — Uses `calculateInitialPosition()` at line 32
- `listCardsByColumn(columnId)` — Returns cards ordered by position ASC (line 50)
- `getCardById(id)` — Line 54-57
- `updateCard(id, updates)` — Line 60-99
- `deleteCard(id)` — Line 101-104
- `updateCardPosition(id, position)` — Line 106-118
- `updateCardColumn(id, columnId, position)` — Line 120-137
- No rebalancing functions exist

**Columns Repository** — `src/lib/db/columns.ts:1-84`
- `createColumn(boardId, name)` — Uses `calculateInitialPosition()` at line 25
- `listColumnsByBoard(boardId)` — Returns columns ordered by position ASC (line 40)
- `getColumnById(id)` — Line 44-47
- `renameColumn(id, name)` — Line 50-63
- `deleteColumn(id)` — Line 65-68
- `updateColumnPosition(id, position)` — Line 70-83
- No rebalancing functions exist

**CardManager Component** — `src/components/CardManager.tsx:1-424`
- State management: `editingId`, `updatingId`, `deletingId`, `draggedId`, `creating`, `error` (lines 43-49)
- Create card form with title input (lines 404-420)
- Inline editing: click card title to enter edit mode (line 102-107), shows title/description/color fields (lines 315-362)
- Delete with `confirm()` dialog (line 152)
- Drag handlers: `handleDragStart` (line 174-185), `handleDragOver` (line 187-190), `handleDrop` (line 192-257)
- Cross-column drop via `onCardDrop` callback (line 210-216)
- Same-column reorder uses `calculateReorderPosition()` (line 226-230)
- No keyboard shortcut handlers exist
- No ARIA attributes present
- Drag preview: sets `opacity-50` on dragged card (line 313), no semi-transparent ghost
- No drop zone highlighting

**ColumnManager Component** — `src/components/ColumnManager.tsx:1-371`
- State management: `editingId`, `updatingId`, `deletingId`, `draggedId`, `cardRefreshKey` (lines 23-28)
- Inline rename with auto-focus (line 51-57)
- Escape key handling exists for column name editing (line 332-335)
- Drag handlers for column reordering (lines 166-240)
- Manual position calculation instead of using `calculateReorderPosition()` utility (lines 193-213)
- Handles cross-column card drops (lines 243-272)
- No keyboard shortcuts for card navigation
- No ARIA attributes present
- No focus indicators
- Drag preview: sets `opacity-50` on dragged column (line 320)

**BoardList Component** — `src/components/BoardList.tsx:1-50` (partial read)
- Inline rename with Escape key handling (similar pattern to ColumnManager)
- Auto-focus on edit input (lines 33-38)
- No other keyboard shortcuts observed

### Existing Patterns to Follow

**Repository Layer Pattern** — All DB logic in `src/lib/db/` with pure functions
- DB connection singleton via `getDb()` from `src/lib/db/connection.ts:7-18`
- Better-sqlite3 with WAL mode and foreign keys enabled (line 13-14)
- Migration runner at startup (line 20-45)
- Functions return domain objects or `undefined` (not `null`)
- Validation throws errors with descriptive messages
- Position calculations use helper functions from `src/lib/utils/positioning.ts`

**API Route Pattern** — All routes in `src/pages/api/` using Astro's `APIRoute` type
- Example: `src/pages/api/cards/[id]/position.ts:1-51`
- Validate params (`isNaN` check for IDs)
- Parse JSON with try-catch
- Validate request body fields with type checks
- Call repository layer functions
- Return JSON responses with proper status codes (200, 201, 400, 404, 204)
- All errors include `{ error: "message" }` JSON shape

**Component State Machine Pattern** — Separate state variables for each loading/editing concern
- `loading` — initial fetch
- `creating` — create operation in progress
- `editingId` — which item is being edited (null = none)
- `updatingId` — which item is being updated (null = none)
- `deletingId` — which item is being deleted (null = none)
- `draggedId` — which item is being dragged (null = none)
- `error` — error message string or null
- Pattern seen in `CardManager.tsx:38-49`, `ColumnManager.tsx:18-28`

**Inline Editing Pattern** — Click to edit, blur/Enter to save, Escape to cancel
- Example: `ColumnManager.tsx:330-336`
- Uses ref for auto-focus and select-all (line 29, 54-56)
- Disabled state during update (line 337)
- Returns early if trimmed value is empty or unchanged (ColumnManager line 100-109)

**Drag-and-Drop Pattern** — HTML5 DnD with dataTransfer
- `draggable` attribute (CardManager line 307, ColumnManager line 315)
- `handleDragStart` sets `effectAllowed = "move"` and stores data in `dataTransfer` as JSON (CardManager line 180-184)
- `handleDragOver` prevents default and sets `dropEffect = "move"` (CardManager line 187-190)
- `handleDrop` parses dataTransfer JSON, calculates new position, calls API (CardManager line 192-257)
- Prevents drag during inline edit by checking `editingId` (CardManager line 175-178, ColumnManager line 315)

**Keyboard Handling Pattern** — Escape key already used for cancel
- Example: `ColumnManager.tsx:332-335`
- `onKeyDown` with `e.key === "Escape"` check
- Resets editing state variables

### Dependencies & Integration Points

**Database** — SQLite with better-sqlite3
- `db/migrations/003_create_cards.sql:1-15` — Cards table with `position INTEGER NOT NULL`, indexed (line 14)
- `db/migrations/002_create_columns.sql:1-12` — Columns table with `position INTEGER NOT NULL`
- Foreign keys with `ON DELETE CASCADE` (cards line 10, columns line 8)
- No constraints on position values (can be negative or duplicate)

**API Endpoints** — Position updates
- `PATCH /api/cards/:id/position` — Updates card position within column (`src/pages/api/cards/[id]/position.ts:1-51`)
- `PATCH /api/cards/:id/column` — Moves card to different column with position (`src/pages/api/cards/[id]/column.ts` - not read but referenced in AGENTS.md line 142)
- `PATCH /api/columns/:id/position` — Updates column position within board (`src/pages/api/columns/[id]/position.ts:1-51`)

**Test Infrastructure** — Vitest for unit/integration, Playwright for E2E
- Vitest config: `vitest.config.ts:1-19` — Node environment, excludes `tests/` E2E directory (line 6), 80% coverage threshold on `src/lib/` (lines 10-15)
- Playwright config: `playwright.config.ts:1-30` — Tests in `tests/` directory, Chromium + Firefox projects (lines 14-23), auto-starts dev server (lines 24-28)
- Component tests use `@testing-library/react` with `happy-dom` environment (CardManager test line 1)
- DB tests use temp files in `tmpdir()` with cleanup (cards test lines 20-34)

**UI Component Integration**
- `ColumnManager` renders `CardManager` for each column (line 358-362)
- `ColumnManager` passes `onCardDrop` callback to `CardManager` for cross-column moves (line 361)
- `ColumnManager` uses `cardRefreshKey` state to force re-render of all CardManagers after cross-column drop (line 266)

**Styling** — Tailwind CSS v4 via `@tailwindcss/vite` plugin
- No custom CSS files, all utility classes
- Drag opacity: `opacity-50` class applied when `draggedId` matches (CardManager line 313, ColumnManager line 320)
- Card styling: `bg-white rounded shadow-sm border border-gray-200` (CardManager line 311)
- Column styling: `bg-gray-100 rounded p-4` (ColumnManager line 319)

### Test Infrastructure

**Test Framework** — Vitest v4.0.18 with v8 coverage (`package.json:38`, `vitest.config.ts:8`)

**Test Patterns**
- DB tests use real SQLite with temp files in OS tmpdir
- Example from `src/lib/db/__tests__/cards.test.ts:20-34`:
  - `beforeEach` closes DB, creates unique temp path, calls `getDb(tempDbPath)`
  - `afterEach` closes DB and unlinks temp file + WAL/SHM files
  - Helper function `setupBoardAndColumn()` creates fixtures (line 36-40)
- API tests not examined in detail, but exist at `src/pages/api/cards/__tests__/cards-api.test.ts`
- Component tests use `@testing-library/react` with mocked `global.fetch` (CardManager test line 9)
- Component tests check rendering states only (loading, error, success) — no interaction tests (CardManager test line 17-80)

**Test Coverage** — 173 tests currently passing
- Positioning utility: 11 tests covering initial position and reorder calculation (`src/lib/utils/__tests__/positioning.test.ts:1-100`)
- Cards DB: 34 tests covering CRUD, validation, cascade delete (referenced in Phase 3 REFLECTIONS line 47)
- Cards API: 37 tests (referenced in Phase 3 REFLECTIONS line 47)
- CardManager component: 8 tests (referenced in Phase 3 REFLECTIONS line 47)
- Column tests also exist (AGENTS.md references column CRUD)
- Board tests also exist (AGENTS.md references board CRUD)

**E2E Test Patterns** — Playwright with specific selectors
- Test file: `tests/cards.spec.ts:1-100` (partial read)
- Uses `getByRole()` and `getByPlaceholder()` for specific targeting (line 9, 27)
- Uses `.locator()` with filters: `.filter({ hasText: 'Column A' })` (line 25)
- Uses unique board/card names with timestamps to avoid collisions (line 8, 24)
- Waits for visibility with `expect(...).toBeVisible()` (line 31)
- Dialog handling with `page.on('dialog', ...)` (line 85)
- Drag-and-drop uses Playwright's `dragTo()` API (not shown in partial read but referenced in AGENTS.md)

**Coverage Expectation** — 80%+ on `src/lib/` enforced in vitest.config.ts lines 10-15

### Code References

**Current Position System**
- `src/lib/utils/positioning.ts:6` — `POSITION_GAP = 1000`
- `src/lib/utils/positioning.ts:8-12` — `calculateInitialPosition()` function
- `src/lib/utils/positioning.ts:14-34` — `calculateReorderPosition()` function
- `src/lib/utils/positioning.ts:33` — Midpoint calculation: `Math.floor((before.position + after.position) / 2)`

**Position Update Functions**
- `src/lib/db/cards.ts:106-118` — `updateCardPosition(id, position)`
- `src/lib/db/columns.ts:70-83` — `updateColumnPosition(id, position)`

**List Query Functions (for rebalancing)**
- `src/lib/db/cards.ts:47-52` — `listCardsByColumn(columnId)` returns cards ordered by position
- `src/lib/db/columns.ts:37-42` — `listColumnsByBoard(boardId)` returns columns ordered by position

**Drag-and-Drop Implementation**
- `src/components/CardManager.tsx:174-257` — Drag handlers (start, over, drop)
- `src/components/CardManager.tsx:226-230` — Call to `calculateReorderPosition()`
- `src/components/CardManager.tsx:235-244` — API call to `/api/cards/${id}/position`
- `src/components/ColumnManager.tsx:166-240` — Column drag handlers

**Inline Editing Implementation**
- `src/components/CardManager.tsx:102-115` — `startEdit()` and `cancelEdit()`
- `src/components/CardManager.tsx:118-148` — `handleUpdate()` async function
- `src/components/CardManager.tsx:315-362` — Edit mode UI (input, textarea, select, buttons)

**Delete Implementation**
- `src/components/CardManager.tsx:151-171` — `handleDelete()` with `confirm()` dialog
- `src/components/ColumnManager.tsx:138-163` — Column delete with confirmation

**Database Schema**
- `db/migrations/003_create_cards.sql:1-15` — Cards table definition
- `db/migrations/003_create_cards.sql:14` — Position index on cards
- `db/migrations/002_create_columns.sql:1-12` — Columns table definition
- `db/migrations/002_create_columns.sql:11` — Board ID index on columns

**API Routes**
- `src/pages/api/cards/[id]/position.ts:1-51` — Card position update endpoint
- `src/pages/api/columns/[id]/position.ts:1-51` — Column position update endpoint

**Component Mounting**
- `src/components/ColumnManager.tsx:358-362` — Renders CardManager with key including cardRefreshKey

**Test Files**
- `src/lib/utils/__tests__/positioning.test.ts:1-100` — Positioning utility tests
- `src/lib/db/__tests__/cards.test.ts:1-100+` — Cards repository tests
- `src/components/__tests__/CardManager.test.tsx:1-80+` — Card component tests
- `tests/cards.spec.ts:1-100+` — E2E tests for cards

**Documentation**
- `AGENTS.md:158-170` — Current positioning utility documentation and known limitation
- `AGENTS.md:102-156` — Card architecture documentation
- `README.md:1-95` — User-facing README with features and commands

## Open Questions

**Rebalancing Threshold Detection** — How to efficiently detect when positions are too close?
- Option 1: Check after every position update (simple, but may be expensive)
- Option 2: Check only during drag-and-drop operations (matches spec line 10)
- Option 3: Calculate gap during position query (requires modifying list functions)
- Spec says "trigger when any gap between consecutive items is < 10" (line 41)

**Rebalancing Atomicity** — How to ensure single transaction for all updates?
- Repository layer functions currently use individual UPDATE statements
- Need to wrap multiple updates in `db.transaction()` (better-sqlite3 API)
- Should validate no position changes occurred during rebalancing (optimistic lock?)

**Rebalancing API Integration** — Should rebalancing be explicit or implicit?
- Option 1: Implicit — position update endpoints automatically trigger rebalancing if needed
- Option 2: Explicit — new endpoint `/api/boards/:id/rebalance` and `/api/columns/:id/rebalance` called by UI
- Spec line 10 says "run rebalancing after drag-and-drop operations" — suggests implicit

**Keyboard Shortcuts Scope** — Which component should own keyboard event handlers?
- CardManager handles card-specific shortcuts (edit, delete, arrow navigation within column)
- ColumnManager handles column-specific shortcuts (edit, delete)
- Need to manage focus state to know which card/column is "selected"
- Spec says shortcuts work "when focus is on cards/columns (not when editing text)" (line 44)

**Arrow Key Navigation** — How to track which card has focus?
- Need new state variable like `focusedCardId` in CardManager
- Need visual focus indicator (spec line 62)
- Arrow up/down moves focus between cards in same column
- What happens at boundaries (first/last card)?

**Focus Management** — How to integrate with existing inline edit flow?
- Currently click-to-edit (no keyboard activation)
- Spec says "Enter to start editing" (line 56)
- Need to track focused item separately from editing item

**Drop Zone Highlighting** — How to implement without complex CSS?
- Spec says "highlight on dragover and unhighlight on dragleave/drop" (line 46)
- Need state variable like `dropTargetId` to track where drag is hovering
- Apply different background/border style when item is drop target

**Drag Preview Styling** — How to create semi-transparent ghost?
- Spec says "semi-transparent preview during drag" (line 60)
- Currently just sets `opacity-50` on original element
- May need `setDragImage()` with custom element

**ARIA Announcements** — How to trigger screen reader announcements?
- Spec says "screen readers announce card/column moves" (line 63)
- Need ARIA live region (role="status" or role="alert")
- Update live region text after successful drag-and-drop

**Test Strategy for Keyboard Shortcuts** — How to test in component vs E2E?
- Component tests with `@testing-library/user-event` for keyboard simulation
- E2E tests with Playwright's `page.keyboard.press()` for integration
- Need to verify shortcuts don't fire during text editing

**Test Strategy for Rebalancing** — How to trigger convergence in tests?
- Unit test: manually create items with positions 1, 2, 3 (forces rebalancing)
- Integration test: perform multiple reorders programmatically until convergence
- E2E test: spec says "50+ drag-and-drop operations" (line 93) to stress-test

**Accessibility Testing** — How to verify ARIA attributes and announcements?
- Component tests can check for presence of ARIA attributes in DOM
- E2E tests can use Playwright's accessibility tree APIs
- Manual testing with screen reader (VoiceOver on macOS, NVDA on Windows)
