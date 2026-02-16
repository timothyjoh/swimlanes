# Research: Phase 5

## Phase Context
Phase 5 adds global search and filtering capabilities to help users quickly find cards across all columns on a board. The feature includes a search bar at board level that filters cards in real-time as the user types, with search matching against card title, description, and color label (case-insensitive). Search query persists in URL query parameter for shareable links. Keyboard shortcuts `Ctrl+F`/`Cmd+F` focus search input and `Escape` clears search. All existing functionality (drag-and-drop, keyboard shortcuts, inline editing) must continue to work on filtered cards.

## Previous Phase Learnings
From Phase 4 REFLECTIONS.md:

- **Write component interaction tests BEFORE E2E tests** (line 67) — Phase 4 skipped component tests for keyboard shortcuts and went straight to E2E, which meant bugs were caught late in slow E2E runs. Phase 5 should write component tests using `@testing-library/user-event` to test search input interactions (typing, clearing, keyboard shortcuts) before E2E scenarios for faster feedback loop.

- **Consider React event propagation early** (line 70) — Event bubbling in nested interactive components caused Enter key bug in Phase 4. Phase 5 search input keyboard handlers must explicitly consider: will `Ctrl+F` or `Escape` events bubble? Do we need `stopPropagation()`?

- **Bottom-up build order continues to work perfectly** — DB → API → UI layering with tests at each layer has worked flawlessly for all 4 phases. Phase 5 follows the same pattern: `searchCards()` in repository layer first (with unit tests), then optional API endpoint (if server-side search is needed), then UI component integration.

- **Maintain accessibility baseline** (line 76) — Phase 4 established strong accessibility baseline (ARIA labels, focus indicators, live regions). Phase 5 search input must have `aria-label`, match count must have `aria-live="polite"`, empty state must be announced.

- **Debouncing for performance** — Searching 100+ cards on every keystroke could cause lag. Phase 5 debounces search input (300ms) to avoid excessive filtering/re-renders.

## Current Codebase State

### Relevant Components

#### Repository Layer
- **`src/lib/db/cards.ts:47-52`** — `listCardsByColumn(columnId)` returns cards for a column sorted by `position ASC`. This is the current data fetching pattern. Phase 5 will add `searchCards(boardId, query)` function here that returns matching cards across all columns for a board.

- **`src/lib/db/cards.ts:4-13`** — `Card` interface defines card structure: `id`, `column_id`, `title`, `description` (nullable), `color` (nullable), `position`, timestamps. Search will match against `title`, `description`, and `color` fields.

- **`src/lib/db/connection.ts`** — Database connection singleton with migration runner. No changes needed for Phase 5.

#### API Layer
- **`src/pages/api/cards/index.ts:56-85`** — `GET /api/cards?columnId=X` endpoint fetches cards for a single column. Phase 5 may add a new query parameter like `?boardId=X&q=search` to support server-side search, or search may be client-side only (filtering in React state). SPEC line 18 mentions "Repository layer enhancement" with `searchCards(boardId, query)`, suggesting backend search support.

- **API pattern**: All API routes return JSON with proper HTTP status codes (200, 201, 400, 404, 204). Error responses have `{ error: "message" }` format. Phase 5 search API should follow this pattern.

#### UI Components
- **`src/components/ColumnManager.tsx`** — Main board view component that manages columns and cards for a board. This component will host the search input UI since it has board-level scope.
  - **State management pattern** (lines 18-32): Uses multiple `useState` hooks for different concerns (loading, error, editing state, drag state, focused state). Phase 5 will add `searchQuery` and `filteredCards` state here.
  - **Keyboard event handling** (lines 287-297): `handleColumnKeyDown` handles Enter (edit) and Delete/Backspace. Phase 5 will add global keyboard listener for `Ctrl+F`/`Cmd+F` to focus search input.
  - **Cross-column card drop** (lines 256-285): `handleCardDrop` callback manages moving cards between columns. Phase 5 search must not break this functionality when filtering is active.
  - **Lines 344-407**: Horizontal scrollable layout of columns (`.flex.gap-4.overflow-x-auto`), each column rendered with fixed width (`.w-72`). Search bar will be added above this layout, below the "Add Column" form (lines 319-337).

- **`src/components/CardManager.tsx`** — Renders cards within a single column. Phase 5 will need to modify this component to accept and render only filtered cards when search is active.
  - **State management** (lines 38-52): Manages cards array, loading, error, editing, dragging, focus states. Phase 5 may pass filtered cards as prop from parent ColumnManager instead of fetching internally, OR CardManager continues to fetch but ColumnManager passes search query to filter displayed cards.
  - **Fetch pattern** (lines 55-72): `useEffect` fetches cards on mount via `/api/cards?columnId=${columnId}`. If search is client-side, CardManager continues to fetch all cards but ColumnManager filters which cards to display.
  - **Keyboard shortcuts** (lines 298-328): Arrow keys (up/down), Enter (edit), Delete/Backspace work on focused cards. Phase 5 must ensure these continue to work on filtered cards.
  - **Drag-and-drop** (lines 176-296): Full drag-and-drop implementation with visual feedback (opacity-50 drag preview, drop target highlighting). Phase 5 must ensure drag-and-drop works on filtered cards and that dropped cards remain visible even when filtered.
  - **Inline editing** (lines 380-445): Click card to edit title/description/color with Save/Cancel buttons. Phase 5 must ensure editing works on filtered cards.
  - **ARIA/accessibility** (lines 342-348): Live region with `role="status" aria-live="polite"` for announcements, cards have `aria-label="Card: ${title}"`. Phase 5 search must announce match count and empty state.

#### Page/Layout
- **`src/pages/boards/[id].astro`** — Board detail page. Fetches board server-side (lines 3-17), renders ColumnManager with `client:load` (line 27). Phase 5 search query from URL (`?q=...`) will be passed as prop to ColumnManager here, likely via `Astro.url.searchParams.get('q')`.

- **Current URL structure**: Board pages are at `/boards/:id`. Phase 5 adds query param: `/boards/:id?q=search+term`.

#### Utilities
- **`src/lib/utils/positioning.ts`** — Position calculation utilities for drag-and-drop reordering. Not directly relevant to search, but search must not break position calculations when cards are filtered.

### Existing Patterns to Follow

#### State Management Pattern
All components use React `useState` hooks for local state. No global state management (Redux, Context) exists in the codebase. Pattern:
```typescript
const [data, setData] = useState<Type[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```
Phase 5 will add `searchQuery` state and manage filtered results using this pattern.

#### Data Fetching Pattern
Components fetch data in `useEffect` with try-catch error handling:
```typescript
useEffect(() => {
  async function fetchData() {
    try {
      const res = await fetch(`/api/resource?param=${value}`);
      if (!res.ok) throw new Error(await res.json().error);
      setData(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  fetchData();
}, [dependency]);
```
Phase 5 search will either:
- Add `searchCards()` repository function and new API endpoint following this pattern, OR
- Fetch all cards client-side and filter in React state

#### TypeScript Strictness
- No `any` types in application code (convention from AGENTS.md line 189)
- All interfaces explicitly typed
- Optional fields marked with `?` or `| null`
Phase 5 search functions and state must follow this strictness.

#### Error Handling Pattern
All async operations have try-catch with user-visible error messages:
- API routes return `{ error: "message" }` in JSON (example: `src/pages/api/cards/index.ts:9-12`)
- Components display errors in red banner: `<div className="p-2 bg-red-100 text-red-900 rounded text-sm">{error}</div>` (example: `CardManager.tsx:350-353`)
Phase 5 search must follow this error display pattern.

#### Keyboard Event Handling Pattern
Keyboard shortcuts use `onKeyDown` handlers with:
- Check if editing mode is active: `if (editingId !== null) return;`
- Prevent default and stop propagation: `e.preventDefault(); e.stopPropagation();`
- Key checks: `e.key === "Enter"`, `e.key === "Escape"`, `e.key === "ArrowDown"`, etc.
Phase 5 `Ctrl+F`/`Cmd+F` shortcut must:
- Check for meta key: `(e.ctrlKey || e.metaKey) && e.key === 'f'`
- Prevent browser default find dialog: `e.preventDefault()`
- Focus search input: `searchInputRef.current?.focus()`

#### Accessibility Pattern
All interactive elements have:
- `aria-label` for screen readers (example: `aria-label="Card: ${title}"` in CardManager.tsx:373)
- Live regions for dynamic announcements: `<div role="status" aria-live="polite" className="sr-only">{announceText}</div>` (example: CardManager.tsx:342-348)
- Focus indicators: `ring-2 ring-blue-500` class when focused (example: CardManager.tsx:377)
Phase 5 search must:
- Add `aria-label="Search cards"` to search input
- Add live region for match count: `<div role="status" aria-live="polite" className="sr-only">{matchCount} cards found</div>`
- Add `aria-label="Clear search"` to clear button

### Dependencies & Integration Points

#### Database Schema
- **`db/migrations/003_create_cards.sql`** — Cards table has `title TEXT NOT NULL`, `description TEXT` (nullable), `color TEXT` (nullable). These three fields are search targets. No database schema changes needed for Phase 5 — search uses existing columns.
- **Indexes**: `idx_cards_column_id` on `column_id` (line 13), `idx_cards_position` on `position` (line 14). No index on `title` or `description` currently exists. For Phase 5, search may be slow on large boards (100+ cards) without indexes, but SPEC line 36 says "< 100ms perceived latency even with 100+ cards" and uses debouncing (300ms) to mitigate. Full-text search indexes (FTS5) are out of scope for Phase 5 — simple substring matching only (SPEC line 28).

#### Component Hierarchy
```
BoardDetailPage (Astro)
└── ColumnManager (React client:load)
    ├── Search input (NEW in Phase 5)
    └── Columns (map)
        └── CardManager (for each column)
            └── Cards (map)
```
Phase 5 search input will be added to ColumnManager at board level. Search state (`searchQuery`) will be managed in ColumnManager and either:
- **Option A**: ColumnManager fetches ALL cards for board once, filters them by column and search query, then passes filtered cards as props to each CardManager
- **Option B**: CardManager continues to fetch cards per-column, ColumnManager passes `searchQuery` prop to each CardManager, CardManager filters its own cards

Option A is cleaner (single source of truth for cards) but requires refactoring CardManager to accept cards as prop instead of fetching internally. Option B is less invasive but means multiple fetch calls. SPEC doesn't specify, so either is valid.

#### URL State Management
- **Astro URL parsing**: `Astro.url.searchParams.get('q')` in `boards/[id].astro` to read search query from URL on page load
- **Client-side URL updates**: Use `window.history.pushState()` or `window.history.replaceState()` to update URL when search query changes, without page reload
- **URL encoding**: Use `URLSearchParams` to encode/decode special characters in search query (SPEC line 95: "Special characters in query are URL-encoded correctly")
Example pattern:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (searchQuery) {
    params.set('q', searchQuery);
  } else {
    params.delete('q');
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}, [searchQuery]);
```

#### Debouncing for Performance
SPEC line 37 requires 300ms debounce delay. Pattern:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [debouncedQuery, setDebouncedQuery] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// Use debouncedQuery for filtering, searchQuery for input value
```

### Test Infrastructure

#### Unit/Integration Tests (Vitest)
- **Location**: Tests colocated in `__tests__/` directories next to source files
- **Framework**: Vitest with Node environment (vitest.config.ts:5)
- **Database**: Tests use real SQLite in temp files (example: `src/lib/db/__tests__/cards.test.ts:19-35`). Pattern: create temp DB in `beforeEach`, delete in `afterEach`
- **Coverage**: 80%+ threshold on `src/lib/` (vitest.config.ts:9-15)
- **Existing card tests**: `src/lib/db/__tests__/cards.test.ts` has 100+ tests covering all card CRUD operations, position calculations, rebalancing. Phase 5 will add `searchCards()` tests here following same pattern.

#### Component Tests (Vitest + Testing Library)
- **Location**: `src/components/__tests__/`
- **Framework**: Vitest with happy-dom environment (CardManager.test.tsx:1)
- **Pattern**: Mock fetch API, render component, assert on DOM (example: CardManager.test.tsx:17-27)
- **Current state**: CardManager.test.tsx only tests rendering states (loading, error, success) — no interaction tests (Phase 4 REFLECTIONS line 22 notes this gap)
- **Phase 5 needs**: Component interaction tests for:
  - Typing in search input (debounced)
  - Clicking clear button
  - Pressing Escape to clear
  - Pressing Ctrl+F to focus search
  - Filtering cards by search query
  - Empty state when no matches
Use `@testing-library/user-event` (already in package.json:31) for realistic user interactions.

#### E2E Tests (Playwright)
- **Location**: `tests/` directory (separate from Vitest tests)
- **Files**: `boards.spec.ts`, `columns.spec.ts`, `cards.spec.ts`, `keyboard-shortcuts.spec.ts`, `position-rebalancing.spec.ts`
- **Pattern**: Create fresh board/columns in `beforeEach`, test user flows (example: tests/cards.spec.ts:3-21)
- **Phase 5 needs**: New test file `tests/search.spec.ts` with scenarios:
  - Create board with 20+ cards, search filters correctly
  - Search with partial matches (substring)
  - Search with no matches shows empty state
  - Search persists when navigating back/forward
  - Clear button resets search
  - Drag-and-drop works on filtered cards
  - Ctrl+F focuses search input
  - Escape clears search

#### Test Execution
- `npm test` — Run Vitest unit/integration tests once
- `npm run test:coverage` — Run with coverage report
- `npm run test:e2e` — Run Playwright E2E tests (headless)
- `npm run test:e2e:ui` — Run Playwright E2E tests (interactive UI)

### Color Labels
Cards support 6 predefined colors: `red`, `blue`, `green`, `yellow`, `purple`, `gray` (CardManager.tsx:23). Colors are stored as lowercase strings in database `color` column (nullable). Search must match color field case-insensitively (e.g., searching "Blue" should match cards with `color: "blue"`).

### No External Dependencies Needed
SPEC line 124 states "No new npm dependencies required". All dependencies for Phase 5 already exist:
- `URLSearchParams` — Native browser API for URL query params (SPEC line 125)
- `@testing-library/user-event` — Already in package.json:31 for component interaction tests
- No search library needed — simple substring matching using JavaScript `String.includes()` or SQL `LIKE '%query%'`

## Code References

### Repository Layer
- `src/lib/db/cards.ts:47-52` — `listCardsByColumn()` current card fetching
- `src/lib/db/cards.ts:4-13` — `Card` interface definition
- `src/lib/db/cards.ts:139-167` — `rebalanceCardPositions()` pattern for transaction-based batch updates

### API Layer
- `src/pages/api/cards/index.ts:56-85` — `GET /api/cards?columnId=X` endpoint
- `src/pages/api/cards/index.ts:4-54` — `POST /api/cards` error handling pattern

### UI Components
- `src/components/ColumnManager.tsx:17-32` — State management pattern with multiple `useState` hooks
- `src/components/ColumnManager.tsx:256-285` — Cross-column card drop callback
- `src/components/ColumnManager.tsx:287-297` — Keyboard event handling pattern
- `src/components/ColumnManager.tsx:319-337` — Add Column form location (search bar goes below this)
- `src/components/ColumnManager.tsx:344-407` — Column list layout (horizontal scroll)
- `src/components/CardManager.tsx:55-72` — Data fetching pattern in `useEffect`
- `src/components/CardManager.tsx:298-328` — Card keyboard shortcuts (must work with filtered cards)
- `src/components/CardManager.tsx:176-296` — Drag-and-drop implementation (must work with filtered cards)
- `src/components/CardManager.tsx:380-445` — Inline editing implementation (must work with filtered cards)
- `src/components/CardManager.tsx:342-348` — ARIA live region for announcements

### Page/Layout
- `src/pages/boards/[id].astro:6-17` — Board fetching and redirect logic
- `src/pages/boards/[id].astro:27` — ColumnManager rendering with `client:load`

### Tests
- `src/lib/db/__tests__/cards.test.ts:37-41` — Board/column setup helper function
- `src/lib/db/__tests__/cards.test.ts:43-55` — Example unit test structure
- `src/components/__tests__/CardManager.test.tsx:7-14` — Mock setup pattern in `beforeEach`
- `src/components/__tests__/CardManager.test.tsx:17-27` — Component rendering test pattern
- `tests/cards.spec.ts:3-21` — E2E test setup pattern with board/column creation

## Open Questions

1. **Search architecture**: Should search be:
   - **Option A**: Client-side filtering (fetch all cards for board once in ColumnManager, filter in React state)
   - **Option B**: Server-side search API (add `GET /api/cards?boardId=X&q=search` endpoint calling `searchCards()` repository function)
   - **Option C**: Hybrid (fetch all cards on page load, filter client-side, but add `searchCards()` repository function for future server-side search or API usage)

   SPEC line 18 says "Repository layer enhancement — add `searchCards(boardId, query)` function for backend search", suggesting Option B or C. Option C (hybrid) may be most pragmatic: build repository function for testability and future API usage, but use client-side filtering for Phase 5 to avoid refactoring API/fetch patterns.

2. **CardManager refactoring**: Should CardManager:
   - **Option A**: Continue to fetch cards internally via `/api/cards?columnId=X`, accept optional `searchQuery` prop, filter cards in CardManager before rendering
   - **Option B**: Accept `cards` prop from parent ColumnManager instead of fetching internally, ColumnManager fetches all cards for board and distributes filtered cards to each CardManager

   Option A is less invasive (no CardManager refactoring), but means CardManager has two sources of truth (fetched cards vs. filtered cards). Option B is cleaner (single source of truth) but requires significant CardManager refactoring and may break existing tests. Recommendation: Start with Option A for Phase 5, defer Option B as future refactoring.

3. **Empty state behavior**: When search has no matches, should:
   - **Option A**: Hide columns with no matching cards entirely (only show columns with matches)
   - **Option B**: Show all columns but display "No matching cards" message in columns with no matches

   SPEC line 58 says "Columns with no matching cards remain visible but show 'No matching cards' message", so Option B is specified.

4. **URL query param timing**: When should URL update?
   - **Option A**: Immediately on keystroke (URL updates every 300ms after debounce)
   - **Option B**: Only after debounce completes and filter is applied

   Recommendation: Option B (update URL when debounced query changes, not on every keystroke) to avoid excessive history entries and URL flicker.

5. **Search persistence across navigation**: If user navigates away from board (e.g., to home page) and clicks back button, should search query persist?
   - **Current behavior**: Browser back button preserves URL including `?q=...` param
   - **Desired behavior**: SPEC line 51 says "User can navigate to board with `?q=...` param and see filtered results", confirming persistence is required
   - **Implementation**: Read `Astro.url.searchParams.get('q')` in `boards/[id].astro`, pass as initial prop to ColumnManager
