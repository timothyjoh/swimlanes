# Research: Phase 7

## Phase Context
Phase 7 adds color-based filtering to the board view, allowing users to select one or more color chips (red, blue, green, yellow, purple, gray) to filter cards alongside the existing text search. Selected colors persist in URL query params (`?colors=red,blue`) for shareable links, and both filters apply simultaneously (text search AND color filter, with OR logic for multiple colors).

## Previous Phase Learnings
Key points from Phase 6 REFLECTIONS.md that affect Phase 7:

1. **Real SQLite in unit tests remains gold standard** (line 116) — Phase 7 will continue using real SQLite database in repository tests, no mocking.
2. **Review step caught critical issues** (line 80) — Keep review step mandatory; it caught buggy restoreCard logic and missing badge refresh in Phase 6.
3. **E2E tests as integration validation** (line 82) — E2E tests caught badge refresh issue that unit tests missed. Continue prioritizing E2E coverage for user-facing workflows.
4. **Bottom-up build order** — DB/repository → API (if needed) → UI with tests at each layer. This pattern has worked flawlessly for 6 phases.
5. **Vertical slice principle** — Complete user-visible feature from end to end, testable at each layer.
6. **Archive count badge refresh via localStorage works but not elegant** (line 75) — Phase 7 will NOT refactor this to avoid scope creep. Focus stays on delivering new user value.

## Current Codebase State

### Relevant Components

#### Database & Repository Layer
- **Card schema**: `db/migrations/003_create_cards.sql:1-14` — Cards table includes `color TEXT` nullable column, no database constraint on values
- **Card interface**: `src/lib/db/cards.ts:4-15` — TypeScript interface defines `color: string | null`
- **searchCards function**: `src/lib/db/cards.ts:57-85` — Current implementation:
  - Accepts `(boardId: number, query: string): Card[]`
  - Filters by title, description, OR color using LIKE with `LOWER()` for case-insensitivity
  - Empty query returns all non-archived cards for board
  - Orders by `col.position ASC, c.position ASC` (column position, then card position)
  - Excludes archived cards via `c.archived_at IS NULL`
  - Uses JOIN with columns table to filter by board_id
- **listCardsByColumn function**: `src/lib/db/cards.ts:50-55` — Returns cards for a single column, excludes archived cards
- **Card colors**: No database-level validation on color field; validation happens in UI only

#### UI Components
- **Color constants**: `src/components/CardManager.tsx:25-34` — Defines 6 predefined colors:
  - `CARD_COLORS` array: `["red", "blue", "green", "yellow", "purple", "gray"]`
  - `COLOR_CLASSES` object maps colors to Tailwind classes: `bg-{color}-200 text-{color}-900`
- **ColumnManager**: `src/components/ColumnManager.tsx:1-582` — Board view container:
  - Manages search state: `searchQuery` (raw input) and `debouncedQuery` (300ms delay) — lines 42-43
  - Fetches columns on mount — lines 50-67
  - Handles search input change, clear, and keyboard shortcuts (Ctrl+F, Escape) — lines 162-175
  - Syncs search query to URL query param `?q=...` — lines 102-114
  - Fetches all cards for match counting when search active — lines 129-148
  - Calculates match count with client-side filtering — lines 151-160
  - Passes `searchQuery={debouncedQuery}` prop to CardManager — line 571
  - Manages cross-column card drops — lines 371-400
  - Displays archive count badge with link to archive view — lines 480-496
- **CardManager**: `src/components/CardManager.tsx:1-543` — Column-level card manager:
  - Receives optional `searchQuery` prop — line 39
  - Filters cards with `useMemo` based on search query — lines 59-69
  - Filters by title, description, or color (case-insensitive substring match)
  - Shows "No matching cards" empty state when filtered to zero — lines 390-394
  - Handles inline editing (title, description, color dropdown) — lines 416-481
  - Supports drag-and-drop for reordering and cross-column moves — lines 207-326
  - Keyboard shortcuts: Enter (edit), Arrow up/down (navigate), Delete/Backspace (archive) — lines 328-358
  - Color label display: chips with Tailwind classes from COLOR_CLASSES — lines 505-517

#### API Routes
- **GET /api/cards?columnId=X**: `src/pages/api/cards/index.ts:56-85` — Returns cards for a column via `listCardsByColumn()`
- **POST /api/cards**: `src/pages/api/cards/index.ts:4-54` — Creates card with optional color field
- **PATCH /api/cards/:id**: `src/pages/api/cards/[id].ts` — Updates card including color field
- **No API endpoint for search** — Search is client-side only; CardManager filters locally

#### Board Detail Page
- **Page**: `src/pages/boards/[id].astro:1-32` — Server-side rendered board view:
  - Extracts `?q=` query param from URL — line 19: `const initialSearchQuery = Astro.url.searchParams.get('q') || '';`
  - Passes `initialSearchQuery` prop to ColumnManager — line 29
  - Server-side checks board existence before rendering

### Existing Patterns to Follow

#### URL Query Parameter Pattern
- **Search persistence**: `src/components/ColumnManager.tsx:102-114` — Uses `URLSearchParams` to sync state to URL
  - Updates URL on debounced query change (300ms delay)
  - `params.set("q", debouncedQuery.trim())` when query non-empty
  - `params.delete("q")` when query empty
  - `window.history.replaceState({}, "", newUrl)` to update URL without page reload
  - Browser back/forward buttons work automatically because URL changes
- **Server-side reading**: `src/pages/boards/[id].astro:19` — Reads query param with `Astro.url.searchParams.get('q')`
- **Pattern for Phase 7**: Add `?colors=red,blue` param using same URLSearchParams approach, combine with existing `?q=` param

#### Search/Filter Architecture Pattern
- **Client-side filtering**: `src/components/CardManager.tsx:59-69` — Filters cards with `useMemo` in React component
  - No server-side search endpoint; cards fetched per-column via `/api/cards?columnId=X`
  - Filtering logic lives in React component, not backend
  - ColumnManager passes search query down to CardManager via prop
- **Match counting**: `src/components/ColumnManager.tsx:129-160` — Fetches all cards from all columns when search active, filters client-side to count matches
  - Shows "N cards found" text with live region for screen readers
- **Pattern for Phase 7**: Extend client-side filtering in CardManager to include color filter, update match counting logic in ColumnManager

#### Color System Pattern
- **Predefined colors only**: `src/components/CardManager.tsx:25` — 6 hardcoded colors: red, blue, green, yellow, purple, gray
- **Tailwind color classes**: `src/components/CardManager.tsx:27-34` — Maps colors to `bg-{color}-200 text-{color}-900`
- **Nullable color field**: Cards can have `color: null` (no color assigned)
- **Dropdown in edit mode**: `src/components/CardManager.tsx:446-464` — Select element with "No color" option plus 6 color options
- **Pattern for Phase 7**: Use same `CARD_COLORS` array to render clickable color chips, apply same `COLOR_CLASSES` for consistent visual appearance

#### Debouncing Pattern
- **300ms delay**: `src/components/ColumnManager.tsx:94-99` — Uses `setTimeout` to debounce search input
  - Raw input stored in `searchQuery` state
  - Debounced value stored in `debouncedQuery` state after 300ms
  - Components use `debouncedQuery` for filtering to avoid excessive re-renders
- **Pattern for Phase 7**: Color chip clicks are instant (no debouncing needed), but combine with debounced text search

#### Accessibility Pattern
- **ARIA labels**: All interactive elements have descriptive labels
  - Search input: `aria-label="Search cards"` — `src/components/ColumnManager.tsx:464`
  - Clear button: `aria-label="Clear search"` — `src/components/ColumnManager.tsx:470`
  - Cards: `aria-label="Card: ${title}"` — `src/components/CardManager.tsx:409`
- **Live regions**: `role="status" aria-live="polite"` announces dynamic changes
  - Match count: `src/components/ColumnManager.tsx:500` — Announces "N cards found"
  - Drag-and-drop: `src/components/CardManager.tsx:372-379` — Announces card moves
- **Focus indicators**: `ring-2 ring-blue-500` on focused elements
- **Pattern for Phase 7**: Color chips need `aria-label="Filter by {color} cards"`, keyboard support (Tab to focus, Enter/Space to toggle), focus indicators

#### TypeScript Strictness Pattern
- **No `any` types**: Project uses TypeScript strict mode — `vitest.config.ts` enforces coverage on `src/lib/**`
- **Interface definitions**: All data shapes explicitly typed
  - Card interface: `src/lib/db/cards.ts:4-15`
  - Column interface: `src/components/ColumnManager.tsx:4-11`
  - Component props: Explicit interface definitions (e.g., `ColumnManagerProps` at line 22-25)
- **Pattern for Phase 7**: Define explicit types for color filter state, URL param parsing, and filter functions

### Dependencies & Integration Points

#### React State Management
- **ColumnManager → CardManager**: `src/components/ColumnManager.tsx:567-573` — ColumnManager renders CardManager islands:
  - Passes `searchQuery` prop for filtering
  - Passes `onCardDrop` callback for cross-column drag-and-drop
  - Passes `onArchive` callback to refresh archive count badge
  - Uses `key={${column.id}-${cardRefreshKey}}` to force remount on card moves
- **Integration for Phase 7**: ColumnManager will manage selected colors state, pass down to CardManager via new prop (e.g., `selectedColors: string[]`)

#### Database Query Pattern
- **Real SQLite in tests**: `src/lib/db/__tests__/cards.test.ts:24-40` — Creates temp database file per test, runs migrations, cleans up after
  - `beforeEach`: Close existing connection, create temp DB, run migrations
  - `afterEach`: Close connection, delete temp DB files (including `-wal` and `-shm`)
- **Migration runner**: `src/lib/db/connection.ts` automatically applies migrations on startup
- **Integration for Phase 7**: Extend `searchCards()` function signature to accept optional `colors` parameter, add color filtering to SQL WHERE clause

#### API Endpoint Pattern
- **RESTful routes**: All endpoints under `src/pages/api/{resource}/`
  - `GET /api/cards?columnId=X` — List cards by column
  - `POST /api/cards` — Create card
  - `PATCH /api/cards/:id` — Update card
  - `DELETE /api/cards/:id/permanent` — Permanent delete
  - `POST /api/cards/:id/archive` — Archive card
- **Response format**: JSON with proper HTTP status codes (200, 201, 204, 400, 404)
- **Integration for Phase 7**: No new API endpoints needed; color filtering happens client-side (same as text search)

#### Drag-and-Drop Integration
- **HTML5 DnD**: `src/components/CardManager.tsx:207-326` — Uses native drag-and-drop API
  - `dataTransfer.setData("text/plain", JSON.stringify({cardId, sourceColumnId}))`
  - ColumnManager handles cross-column drops via `onCardDrop` callback
  - CardManager handles same-column reordering via `updateCardPosition`
- **Integration for Phase 7**: Filtered cards must remain draggable; existing DnD handlers should work without modification

#### Keyboard Shortcuts Integration
- **Global shortcuts**: `src/components/ColumnManager.tsx:117-127` — Ctrl+F/Cmd+F focuses search input
  - Uses `window.addEventListener("keydown", handleGlobalKeyDown)`
- **Local shortcuts**: `src/components/CardManager.tsx:328-358` — Card-level keyboard navigation
  - Enter: Start editing
  - Arrow up/down: Navigate between cards
  - Delete/Backspace: Archive card
- **Integration for Phase 7**: Color chips need keyboard support (Tab to focus, Enter/Space to toggle), but should not interfere with existing shortcuts

### Test Infrastructure

#### Unit Test Framework
- **Vitest**: `vitest.config.ts:1-18` — Node environment, excludes Playwright tests
  - Coverage provider: v8
  - Coverage target: 80% on `src/lib/**` (lines, functions, branches, statements)
  - Test files: `src/**/__tests__/*.test.ts` (co-located with source)
  - Current status: 231 tests passing across 10 test files (boards, columns, cards, API routes, components)

#### Repository Layer Tests
- **cards.test.ts**: `src/lib/db/__tests__/cards.test.ts:1-100+` — 69 tests for card CRUD operations
  - Uses real SQLite database (no mocking)
  - Helper function `setupBoardAndColumn()` creates test fixtures
  - Tests for `createCard`, `listCardsByColumn`, `updateCard`, `deleteCard`, `updateCardPosition`, `updateCardColumn`, `archiveCard`, `restoreCard`, `deleteCardPermanently`, `searchCards`
  - `searchCards` tests exist (lines visible suggest comprehensive coverage)
  - Pattern: Create temp DB → run operation → assert results → cleanup

#### Component Tests
- **CardManager.test.tsx**: `src/components/__tests__/CardManager.test.tsx` — 13 tests for card management UI
- **ColumnManager.test.tsx**: `src/components/__tests__/ColumnManager.test.tsx` — 12 tests for column management UI
- **Test environment**: happy-dom (lightweight DOM for component testing)
- **Testing library**: @testing-library/react for component interactions

#### E2E Test Framework
- **Playwright**: `playwright.config.ts:1-30` — End-to-end browser tests
  - Test directory: `tests/`
  - Projects: Chromium and Firefox
  - Auto-starts dev server at `http://localhost:4321`
  - Reporter: HTML
  - Retries: 2 in CI, 0 locally

#### E2E Test Files
- **search.spec.ts**: `tests/search.spec.ts:1-148` — 11 tests for search functionality:
  - Filters by title in real-time (line 39)
  - Displays correct match count (line 50)
  - Clear button clears search (line 57)
  - Escape key clears search (line 73)
  - Ctrl+F focuses search input (line 92)
  - Persists search in URL (line 97)
  - Loads search from URL on page load (line 104)
  - Empty state when no matches (line 120)
  - Case-insensitive search (line 128)
  - Partial matches (line 137)
- **Pattern for Phase 7**: Create `tests/color-filter.spec.ts` following same structure as search.spec.ts

#### Test Patterns
- **Descriptive test names**: `test('filters cards by title in real-time', ...)` — Clear intent
- **Setup in beforeEach**: Create fresh board, columns, cards before each test
- **Explicit waits**: `await page.waitForTimeout(400)` after search input (debounce delay)
- **Accessibility selectors**: `page.getByLabel('Search cards')` instead of CSS selectors
- **Assertions on visibility**: `toBeVisible()`, `toBeHidden()` for filtered results

### Code References
- `src/lib/db/cards.ts:57-85` — `searchCards()` function implementation (SQL query with LIKE for text search)
- `src/lib/db/cards.ts:4-15` — `Card` interface definition
- `src/components/ColumnManager.tsx:42-43` — Search state management (raw + debounced)
- `src/components/ColumnManager.tsx:102-114` — URL sync logic for query params
- `src/components/ColumnManager.tsx:129-160` — Match counting logic
- `src/components/ColumnManager.tsx:162-175` — Search input handlers and keyboard shortcuts
- `src/components/CardManager.tsx:25-34` — Color constants (`CARD_COLORS`, `COLOR_CLASSES`)
- `src/components/CardManager.tsx:59-69` — Client-side filtering with `useMemo`
- `src/components/CardManager.tsx:446-464` — Color dropdown in edit mode
- `src/pages/boards/[id].astro:19` — Server-side query param reading
- `tests/search.spec.ts:1-148` — E2E search tests (pattern to follow)
- `src/lib/db/__tests__/cards.test.ts:1-100+` — Repository test patterns (real SQLite)
- `db/migrations/003_create_cards.sql:1-14` — Cards table schema (color field exists)

## Open Questions
None — codebase is well-documented and Phase 7 requirements are clear. The color filter will extend existing search infrastructure with minimal changes:
- Repository layer: Extend `searchCards(boardId, query, colors?)` to accept optional colors array, add SQL WHERE clause for color filtering
- UI layer: Add color chip selector to ColumnManager, extend CardManager filtering logic to handle selected colors
- URL persistence: Add `?colors=red,blue` param using existing URLSearchParams pattern
- Tests: Follow existing patterns (real SQLite in unit tests, E2E tests for user flows)
