# SwimLanes — Agent Guide

## Project Description
A Trello-like kanban board app with swim lanes for organizing notes/tasks. Local-first, SQLite-backed.

## Tech Stack
- **Astro 5** — SSR mode with Node adapter
- **React** — Interactive islands (client-side components)
- **Tailwind CSS v4** — Styling via `@tailwindcss/vite` plugin
- **SQLite** — Local file database via better-sqlite3
- **TypeScript** — Strict mode, no `any` in application code
- **Vitest** — Test framework with v8 coverage
- **Playwright** — E2E testing framework

## Commands
- `npm install` — Install dependencies
- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm test` — Run tests once
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report
- `npm run test:e2e` — Run Playwright E2E tests (headless)
- `npm run test:e2e:ui` — Run Playwright E2E tests (interactive UI)
- `npm run test:e2e:debug` — Run Playwright E2E tests with debugger

## Project Structure
```
src/
  components/        # React island components
  layouts/           # Astro layout templates
  lib/db/            # Database access layer (repository pattern)
    connection.ts    # SQLite connection singleton + migration runner
    boards.ts        # Board CRUD functions
    columns.ts       # Column CRUD functions
    cards.ts         # Card CRUD functions
  lib/utils/         # Shared utility modules
    positioning.ts   # Position calculation for columns and cards
  pages/             # Astro pages and API routes
    api/boards/      # Board CRUD API endpoints
    api/columns/     # Column CRUD + position API endpoints
    api/cards/       # Card CRUD + position + column move endpoints
    boards/[id]      # Board detail page
  styles/            # Global CSS (Tailwind import)
db/
  migrations/        # SQL migration files (applied on startup)
  swimlanes.db       # SQLite database file (gitignored)
tests/               # Playwright E2E tests
```

## Column Architecture

### Database Schema

**Table**: `columns`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `board_id`: INTEGER NOT NULL (foreign key to `boards.id`)
- `name`: TEXT NOT NULL
- `position`: INTEGER NOT NULL
- `created_at`: TEXT NOT NULL DEFAULT (datetime('now'))
- `updated_at`: TEXT NOT NULL DEFAULT (datetime('now'))
- FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
- INDEX: `idx_columns_board_id` on `board_id`

**CASCADE DELETE**: When a board is deleted, all its columns are automatically deleted via `ON DELETE CASCADE` constraint. No manual cleanup required.

### Repository Layer

**File**: `src/lib/db/columns.ts`

Functions:
- `createColumn(boardId, name)`: Creates column with auto-calculated position (max + 1000)
- `listColumnsByBoard(boardId)`: Returns columns ordered by position ASC
- `getColumnById(id)`: Returns single column or undefined
- `renameColumn(id, name)`: Updates name, validates non-empty
- `deleteColumn(id)`: Deletes column, returns boolean
- `updateColumnPosition(id, position)`: Updates position for reordering

### API Routes

**Endpoints:**
- `POST /api/columns` — Create column (201 on success)
- `GET /api/columns?boardId=X` — List columns for board (200)
- `PATCH /api/columns/:id` — Rename column (200 or 404)
- `DELETE /api/columns/:id` — Delete column (204 or 404)
- `PATCH /api/columns/:id/position` — Update position (200 or 404)

### UI Components

**ColumnManager.tsx**: Manages columns for a single board
- Horizontal layout with fixed-width columns (w-72)
- Inline rename (click name → edit → blur/Enter to save)
- Delete with confirmation
- Drag-to-reorder using HTML5 drag-and-drop
- Loading states for all operations
- Renders CardManager for each column

**Board Detail Page**: `src/pages/boards/[id].astro`
- Server-side board lookup, redirects to home if not found
- Renders ColumnManager island with `client:load`

## Card Architecture

### Database Schema

**Table**: `cards` (defined in `db/migrations/003_create_cards.sql`)
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `column_id`: INTEGER NOT NULL (foreign key to `columns.id`)
- `title`: TEXT NOT NULL
- `description`: TEXT (nullable, optional)
- `color`: TEXT (nullable, one of: red, blue, green, yellow, purple, gray)
- `position`: INTEGER NOT NULL (for ordering within column)
- `created_at`: TEXT NOT NULL DEFAULT (datetime('now'))
- `updated_at`: TEXT NOT NULL DEFAULT (datetime('now'))
- FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
- INDEX: `idx_cards_column_id` on `column_id`
- INDEX: `idx_cards_position` on `position`

**CASCADE DELETE**: When a column is deleted, all cards in that column are automatically deleted via `ON DELETE CASCADE` foreign key constraint. No application code needed.

### Repository Layer

**File**: `src/lib/db/cards.ts`

Functions:
- `createCard(columnId, title, description?, color?)` — Create card, validates title non-empty, validates column exists, calculates position
- `listCardsByColumn(columnId)` — Returns cards for column sorted by position ASC
- `getCardById(id)` — Returns card or undefined
- `updateCard(id, { title?, description?, color? })` — Updates card fields, validates title if provided
- `deleteCard(id)` — Deletes card, returns true if deleted
- `updateCardPosition(id, position)` — Updates position for reordering within column
- `updateCardColumn(id, columnId, position)` — Moves card to different column, validates column exists

### API Routes

**Endpoints:**
- `POST /api/cards` — Create card (body: `{ columnId, title, description?, color? }`) → 201
- `GET /api/cards?columnId=X` — List cards for column → 200
- `PATCH /api/cards/:id` — Update card (body: `{ title?, description?, color? }`) → 200
- `DELETE /api/cards/:id` — Delete card → 204
- `PATCH /api/cards/:id/position` — Update position (body: `{ position }`) → 200
- `PATCH /api/cards/:id/column` — Move card to column (body: `{ columnId, position }`) → 200

### UI Component

**CardManager.tsx**: Renders cards within a column
- Create card with title input form
- Inline edit: click card title to enter edit mode (title, description, color fields)
- Delete with confirmation dialog
- Drag-to-reorder within column (HTML5 DnD)
- Drag to different column (passes data via dataTransfer, handled by ColumnManager)
- Loading states for all operations (creating, saving, deleting)
- Error banner for failures

**Color Labels**: 6 predefined colors stored as lowercase strings — `red`, `blue`, `green`, `yellow`, `purple`, `gray`. Displayed using Tailwind classes (bg-{color}-200 text-{color}-900). No database constraint; validation in UI only.

## Positioning Utility

**File**: `src/lib/utils/positioning.ts` — Shared positioning logic for columns and cards

Exports:
- `POSITION_GAP` — Constant (1000)
- `PositionedItem` — Interface with `id` and `position` fields
- `calculateInitialPosition(items)` — Calculate position for new item (max position + 1000, or 1000 for empty list)
- `calculateReorderPosition(items, draggedItem, targetIndex)` — Calculate position when reordering an item within its list

**Strategy**: Integer gaps of 1000 between items. Reordering calculates midpoint between neighbors. Automatic rebalancing prevents position convergence (see Position Rebalancing section).

## E2E Tests

Playwright tests covering all MVP features.

### Commands
- `npm run test:e2e` — Run tests in headless mode (CI-friendly)
- `npm run test:e2e:ui` — Run tests with Playwright UI (interactive)
- `npm run test:e2e:debug` — Run tests with debugger

### Test Files
- `tests/boards.spec.ts` — Board CRUD (create, rename, delete)
- `tests/columns.spec.ts` — Column CRUD + drag-to-reorder
- `tests/cards.spec.ts` — Card CRUD + drag-within-column + drag-between-columns + cascade delete
- `tests/keyboard-shortcuts.spec.ts` — Keyboard navigation, editing, and deletion shortcuts
- `tests/position-rebalancing.spec.ts` — Position rebalancing stress tests (50+ drags)
- `tests/search.spec.ts` — Search and filter cards across columns
- `tests/archive.spec.ts` — Card archive lifecycle (archive, restore, permanent delete, badge count)

### Configuration
`playwright.config.ts` — Configured for Chromium and Firefox, auto-starts dev server, headless by default

## Conventions
- **TypeScript strict** — No `any` types in application code
- **Tailwind only** — No custom CSS files; use utility classes
- **Repository pattern** — All DB access through `src/lib/db/` functions
- **API routes** — Under `src/pages/api/`, return JSON with proper HTTP status codes
- **React islands** — Use `client:load` for interactive components
- **Vitest** — Tests colocated in `__tests__/` directories; use real SQLite for DB tests
- **Playwright** — E2E tests in `tests/` directory; excluded from Vitest via config
- **Migrations** — SQL files in `db/migrations/`, auto-applied on server startup
- **Coverage target** — 80%+ on `src/lib/` (enforced in vitest config)

## Position Rebalancing

**Automatic rebalancing** prevents position convergence after many drag-and-drop operations.

**Trigger**: After any position update (card reorder, cross-column move, column reorder), check if any gap between consecutive items is < 10.

**Algorithm**:
1. Fetch all items in list ordered by position ASC
2. Check gaps between consecutive items: `items[i].position - items[i-1].position`
3. If any gap < 10, renumber all items to 1000, 2000, 3000, ... in single transaction
4. Maintains relative order (no position swaps)

**Implementation**:
- `rebalanceCardPositions(columnId)` — Rebalance cards in a column (`src/lib/db/cards.ts`)
- `rebalanceColumnPositions(boardId)` — Rebalance columns in a board (`src/lib/db/columns.ts`)
- Called automatically after position updates in API endpoints
- Returns `true` if rebalancing occurred, `false` if positions were healthy

**Testing**: E2E stress test performs 50+ drag operations to verify positions remain usable.

## Keyboard Shortcuts

SwimLanes supports keyboard navigation for accessibility and power users:

| Shortcut | Action | Context |
|----------|--------|---------|
| `Enter` | Start editing card/column | When card/column is focused |
| `Escape` | Cancel editing | During inline editing |
| `↑` | Move focus to previous card | When card is focused |
| `↓` | Move focus to next card | When card is focused |
| `Delete` or `Backspace` | Archive card / Delete column | When card/column is focused |

**Focus management**:
- Cards and columns have `tabIndex={0}` for keyboard focus
- Focus indicators: blue ring (`ring-2 ring-blue-500`) when focused
- Keyboard shortcuts disabled during inline editing

## Accessibility Features

**ARIA attributes**:
- All cards have `aria-label="Card: ${title}"`
- All columns have `aria-label="Column: ${name}"`

**Screen reader announcements**:
- Live region (`role="status" aria-live="polite"`) announces drag-and-drop operations
- Example: "Moved card 'Task title' to new position"
- Example: "Moved column 'Column name' to new position"

**Visual feedback**:
- Focus indicators (blue ring) for keyboard navigation
- Drop zone highlighting (blue background/border) during drag-and-drop
- Drag preview (semi-transparent) shows item being dragged

## Card Archiving

Soft-delete functionality allows cards to be archived instead of permanently deleted.

### Database Schema

**Column added to `cards` table** (migration: `db/migrations/004_add_archived_at_to_cards.sql`):
- `archived_at`: TEXT DEFAULT NULL — timestamp when card was archived
- INDEX: `idx_cards_archived_at` on `archived_at`

### Repository Functions

**File**: `src/lib/db/cards.ts`

- `archiveCard(id)` — Sets `archived_at` to current timestamp. Returns undefined if card not found or already archived.
- `listArchivedCards(boardId)` — Returns archived cards with `column_name` via JOIN, ordered by `archived_at DESC`.
- `restoreCard(id)` — Clears `archived_at`. Restores to original column if it exists, otherwise moves to first available column on the board.
- `deleteCardPermanently(id)` — Hard deletes a card from the database.

**Filtering**: `listCardsByColumn` and `searchCards` exclude archived cards (`WHERE archived_at IS NULL`).

### API Routes

- `POST /api/cards/:id/archive` — Archive a card (200 or 404)
- `POST /api/cards/:id/restore` — Restore an archived card (200 or 404)
- `DELETE /api/cards/:id/permanent` — Permanently delete a card (204 or 404)
- `GET /api/cards/archived?boardId=X` — List archived cards for a board (200)

### UI Components

**CardManager.tsx**: "Archive" button (yellow) replaces "Delete". Keyboard shortcut `Delete`/`Backspace` archives instead of deleting.

**ArchivedCardsManager.tsx**: Displays archived cards with restore and permanent delete options.
- Located at `/boards/:id/archive`
- Shows card title, description, color, original column name, and archived timestamp
- "Restore" returns card to its original column
- "Delete" permanently removes with confirmation dialog

**ColumnManager.tsx**: Archive count badge (e.g., "3 archived") links to archive page. Only visible when archived cards exist.

### E2E Tests

- `tests/archive.spec.ts` — Archive lifecycle, restore, permanent delete, badge count, search exclusion

## Search and Filter

Global search allows users to quickly find cards across all columns on a board.

### Search Functionality
- **Location**: Search input appears above column list in board view
- **Search fields**: Matches against card title, description, or color label
- **Case-insensitivity**: "TODO" matches "todo", "Todo", etc.
- **Substring matching**: "auth" matches "authentication", "authorize", etc.
- **Debouncing**: 300ms delay before filtering to avoid excessive re-renders

### Search UI
- **Search input**: Text field with placeholder "Search cards..."
- **Clear button**: X icon button appears when query is non-empty
- **Match count**: Displays "N cards found" when search is active
- **Empty state**: Columns with no matches show "No matching cards" message

### URL Persistence
- **Query parameter**: Search query persists in URL as `?q=search+term`
- **Shareable links**: Users can share links with pre-populated search queries
- **Navigation**: Search query persists when using browser back/forward buttons
- **Format**: Special characters are URL-encoded using `URLSearchParams`

### Search Keyboard Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+F` / `Cmd+F` | Focus search input | Overrides browser default find |
| `Escape` | Clear search query | When search input is focused |

### Repository Function
- **Function**: `searchCards(boardId: number, query: string): Card[]`
- **Location**: `src/lib/db/cards.ts`
- **Behavior**: Returns matching cards across all columns for a board
- **Empty query**: Returns all cards for the board
- **Ordering**: Cards ordered by column position, then card position

### Implementation Details
- **Architecture**: Client-side filtering in React state (cards fetched per-column by CardManager, filtered via `useMemo`)
- **State management**: `searchQuery` (raw input) and `debouncedQuery` (after 300ms delay) in ColumnManager
- **Filtering**: CardManager accepts optional `searchQuery` prop, filters with `useMemo`
- **Match counting**: ColumnManager fetches all cards when search is active to calculate total matches
- **Compatibility**: All existing functionality (drag-and-drop, keyboard shortcuts, inline editing) works on filtered cards

### Accessibility
- **Search input**: `aria-label="Search cards"`
- **Clear button**: `aria-label="Clear search"`
- **Match count**: Live region with `aria-live="polite"` announces count
