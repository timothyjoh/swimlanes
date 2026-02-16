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

## Commands
- `npm install` — Install dependencies
- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm test` — Run tests once
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report

## Project Structure
```
src/
  components/        # React island components
  layouts/           # Astro layout templates
  lib/db/            # Database access layer (repository pattern)
    connection.ts    # SQLite connection singleton + migration runner
    boards.ts        # Board CRUD functions
    columns.ts       # Column CRUD functions
  pages/             # Astro pages and API routes
    api/boards/      # Board CRUD API endpoints
    api/columns/     # Column CRUD + position API endpoints
    boards/[id]      # Board detail page
  styles/            # Global CSS (Tailwind import)
db/
  migrations/        # SQL migration files (applied on startup)
  swimlanes.db       # SQLite database file (gitignored)
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

### Positioning Strategy

Columns use integer-based positioning with gaps of 1000:
- First column: position = 1000
- Second column: position = 2000
- Third column: position = 3000

**Why gaps?** This allows reordering by updating a single column's position to fit between neighbors without renumbering all columns.

**Reordering algorithm:**
1. User drags column A to position of column B
2. Calculate new position: average of B's neighbors' positions
3. Update column A's position via PATCH to `/api/columns/:id/position`
4. Re-sort columns by position on client

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

**Board Detail Page**: `src/pages/boards/[id].astro`
- Server-side board lookup, redirects to home if not found
- Renders ColumnManager island with `client:load`

## Conventions
- **TypeScript strict** — No `any` types in application code
- **Tailwind only** — No custom CSS files; use utility classes
- **Repository pattern** — All DB access through `src/lib/db/` functions
- **API routes** — Under `src/pages/api/`, return JSON with proper HTTP status codes
- **React islands** — Use `client:load` for interactive components
- **Vitest** — Tests colocated in `__tests__/` directories; use real SQLite for DB tests
- **Migrations** — SQL files in `db/migrations/`, auto-applied on server startup
- **Coverage target** — 80%+ on `src/lib/` (enforced in vitest config)
