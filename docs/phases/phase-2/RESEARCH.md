# Research: Phase 2

## Phase Context
Phase 2 adds the column (swim lane) layer to the application. Users will navigate to a board detail page at `/boards/:id` and be able to create, rename, reorder, and delete columns within that board. Columns are stored in SQLite with a `board_id` foreign key using CASCADE DELETE. The repository pattern, API routes, and React island approach established in Phase 1 will be extended to support column operations. This includes drag-to-reorder functionality using HTML5 drag-and-drop API, integer-based positioning with gaps (1000, 2000, 3000), and full test coverage across database, API, and component layers.

## Previous Phase Learnings

Phase 1 (from `REFLECTIONS.md`) established several critical patterns and identified gaps that Phase 2 must address:

### Key Successes to Continue:
- **Repository pattern works well** — Clean abstraction in `src/lib/db/boards.ts` with typed interfaces and validation
- **Bottom-up build order (DB → API → UI)** — Each layer fully tested before dependent layers reduced debugging time
- **Testing approach is solid** — Vitest with real SQLite in tests, happy-dom for component tests, direct API handler imports (no test server)
- **TypeScript strict mode** — No `any` types; all interfaces properly typed

### Critical Gaps Fixed in Phase 1 That Phase 2 MUST Include From Start:
1. **Error handling is mandatory** — All API routes need try-catch around `request.json()` and database calls; all components need error state and try-catch around fetch calls; SPEC must explicitly require this
2. **Loading states are required** — All async operations must show loading indicators (creating, updating, deleting); SPEC must explicitly require this
3. **Component tests must verify observable behavior** — No "smoke tests"; must use happy-dom and verify actual rendering, loading states, error states
4. **Cascade delete must be tested** — Phase 1 deferred foreign keys; Phase 2 adds them and must test CASCADE DELETE behavior

### Technical Debt from Phase 1 Relevant to Phase 2:
- **No database foreign keys yet** — `boards` table exists but no FK constraints. Phase 2 adds `columns` table with `board_id` foreign key and `ON DELETE CASCADE` constraint — `db/migrations/001_create_boards.sql:1-6`
- **Component uses client:load** — May impact performance with multiple islands, but not a problem for Phase 2 — `src/pages/index.astro:9`

## Current Codebase State

### Database Layer

**Migration System** — `src/lib/db/connection.ts:20-45`
- Auto-applies SQL files from `db/migrations/` on server startup
- Tracks applied migrations in `_migrations` table
- Files run in sorted order (001_, 002_, etc.)
- Foreign keys enabled via `pragma("foreign_keys = ON")` — `src/lib/db/connection.ts:14`

**Boards Table** — `db/migrations/001_create_boards.sql:1-6`
```sql
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
- No foreign keys or indexes yet
- TEXT columns unbounded (no length constraint)

**Repository Pattern** — `src/lib/db/boards.ts`
- Interface: `Board { id, name, created_at, updated_at }` — lines 3-8
- Functions: `createBoard`, `listBoards`, `getBoardById`, `renameBoard`, `deleteBoard`
- Validation: trims whitespace, throws on empty names — lines 11-12, 32-33
- All functions use prepared statements (SQL injection safe)

### API Routes

**Boards CRUD** — `src/pages/api/boards/index.ts`, `src/pages/api/boards/[id].ts`
- `GET /api/boards` — Returns all boards ordered by `created_at DESC` — `index.ts:4-10`
- `POST /api/boards` — Creates board, returns 201 with created object — `index.ts:12-37`
- `PATCH /api/boards/:id` — Updates board name, returns 200 or 404 — `[id].ts:4-44`
- `DELETE /api/boards/:id` — Deletes board, returns 204 or 404 — `[id].ts:46-64`

**Error Handling Pattern** — Both API files follow same pattern:
- Try-catch around `request.json()` returns 400 with `{ error: "Invalid JSON" }` — `index.ts:14-21`, `[id].ts:14-21`
- Validate request body fields, return 400 if missing/invalid — `index.ts:25-30`, `[id].ts:25-30`
- Check ID validity, return 400 for invalid IDs — `[id].ts:5-11`
- Return 404 when resource not found — `[id].ts:33-38`, `[id].ts:55-61`

### UI Layer

**Page Structure** — `src/pages/index.astro`
- Uses Layout component with title prop — line 6
- Renders BoardList React island with `client:load` — line 9
- Tailwind classes: `max-w-4xl mx-auto px-4 py-8` for centering/spacing — line 7

**Layout Component** — `src/layouts/Layout.astro`
- HTML boilerplate with charset, viewport — lines 13-15
- Body has `bg-gray-50 min-h-screen` for light gray background — line 18
- Imports global CSS (Tailwind) — line 2

**BoardList Component** — `src/components/BoardList.tsx`
- State management:
  - `boards: Board[]` — list of boards — line 11
  - `loading: boolean` — initial load state — line 12
  - `error: string | null` — error banner state — line 13
  - `newName: string` — create form input — line 14
  - `editingId: number | null` — which board is being edited — line 15
  - `editName: string` — inline edit input — line 16
  - `creating, updatingId, deletingId` — loading states per operation — lines 17-19
  - `editInputRef` — ref for auto-focus on edit — line 20

- Fetch pattern (lines 22-31):
  - Fetch on mount with useEffect
  - Check `res.ok`, throw if false
  - Set error state in catch
  - Set loading false in finally

- Create pattern (lines 40-66):
  - Form submit handler
  - Sets `creating` true during operation
  - Error handling: try-catch, displays error banner
  - Success: adds board to top of list, clears form

- Rename pattern (lines 68-100):
  - Inline edit with input field replacing span
  - If empty after trim, restores original name (lines 69-76)
  - Sets `updatingId` during operation
  - Enter key to save, Escape to cancel — lines 169-170
  - Auto-focus and select text with ref — lines 33-38

- Delete pattern (lines 102-118):
  - Confirmation dialog with `window.confirm`
  - Sets `deletingId` during operation
  - Removes board from list on success

- Loading states displayed:
  - "Loading boards..." while initial fetch — lines 125-127
  - "Creating..." on submit button — line 149
  - "Saving..." / "Deleting..." on action buttons — lines 187, 194

- Error state:
  - Red banner at top when error exists — lines 131-135
  - Error cleared at start of each operation — lines 44, 78, 105

### Styling Approach

**Tailwind CSS v4** — `src/styles/global.css:1`
- Single line: `@import "tailwindcss";`
- Configured via Vite plugin — `astro.config.mjs:12`
- Utility-first classes throughout components
- Color palette: gray-50 backgrounds, gray-900 text, blue-600 primary, red-600 delete
- Spacing: px-4 py-3 for padding, gap-2 for flex gaps
- Borders: rounded, border-gray-200/300
- Focus: focus:ring-2 focus:ring-blue-500 on inputs

### Test Infrastructure

**Vitest Configuration** — `vitest.config.ts`
- Default environment: `node` — line 5
- Coverage: v8 provider, includes `src/lib/**`, 80% thresholds — lines 6-14
- Component tests override with `// @vitest-environment happy-dom` — `BoardList.test.tsx:1`

**Database Test Pattern** — `src/lib/db/__tests__/boards.test.ts`
- Uses temp DB per test — lines 16-23
- Cleanup in afterEach: close DB, unlink .db/.db-wal/.db-shm files — lines 25-30
- 13 tests covering all CRUD operations and error cases
- Test structure: describe blocks per function, it blocks per scenario
- Assertions: `toBeTypeOf`, `toBe`, `toThrow`, `toEqual`, `toHaveLength`

**API Test Pattern** — `src/pages/api/boards/__tests__/boards-api.test.ts`
- Helper functions:
  - `createContext(request, params)` — mock Astro context — lines 11-16
  - `jsonRequest(url, method, body)` — create Request with JSON — lines 18-28
- Imports handlers directly (no test server): `import { GET, POST } from "../index"` — line 6
- 16 tests covering success and error paths for all routes
- Tests malformed JSON, missing body, invalid IDs, 404s — lines 95-105, 172-183, 211-219

**Component Test Pattern** — `src/components/__tests__/BoardList.test.tsx`
- Uses happy-dom environment — line 1
- Imports `@testing-library/react` and `@testing-library/jest-dom/vitest` — lines 3-4
- Mocks global fetch in beforeEach — lines 7-10
- 3 tests: renders without crashing, loading state, empty state — lines 20-39
- Pattern: render component, use `screen.getByText/getByPlaceholderText`, `waitFor` for async

### Existing Patterns to Follow

**Repository Function Signature Pattern**:
- Create: `(name: string) => Entity` — returns created entity with ID
- List: `() => Entity[]` — returns all, ordered
- Get: `(id: number) => Entity | undefined` — returns one or undefined
- Update: `(id: number, ...fields) => Entity | undefined` — returns updated or undefined
- Delete: `(id: number) => boolean` — returns true if deleted

**API Route Response Pattern**:
- Success: JSON body with proper content-type header
- 200: successful GET/PATCH
- 201: successful POST (resource created)
- 204: successful DELETE (no content)
- 400: validation error with `{ error: "message" }`
- 404: resource not found with `{ error: "message" }`
- All error responses include JSON body with `error` field

**Component State Pattern**:
- Single source of truth: `items` array state
- Optimistic updates: update state immediately on success, revert on error
- Loading states: boolean or ID for per-item operations
- Error state: string or null, cleared at start of operations
- Form inputs: controlled components with dedicated state

**Test File Location**:
- `src/lib/db/__tests__/` for database tests
- `src/pages/api/[route]/__tests__/` for API tests
- `src/components/__tests__/` for component tests

### Dependencies & Integration Points

**NPM Dependencies** (from `package.json`):
- Runtime:
  - `astro@^5.17.1` — SSR framework
  - `@astrojs/node@^9.5.3` — Node adapter for SSR
  - `@astrojs/react@^4.4.2` — React integration
  - `react@^19.2.4`, `react-dom@^19.2.4` — React runtime
  - `better-sqlite3@^12.6.2` — SQLite driver (native module)
  - `typescript@^5.9.3` — TypeScript compiler

- Dev/Test:
  - `@tailwindcss/vite@^4.1.18` — Tailwind CSS v4 Vite plugin
  - `vitest@^4.0.18` — Test framework
  - `@vitest/coverage-v8@^4.0.18` — Coverage provider
  - `happy-dom@^20.6.1` — DOM implementation for component tests
  - `@testing-library/react@^16.3.2`, `@testing-library/jest-dom@^6.9.1` — Testing utilities

**No External Drag-and-Drop Library** — Phase 2 will use native HTML5 drag-and-drop API (no new dependencies)

**Database Integration**:
- `getDb()` singleton — `src/lib/db/connection.ts:7-18`
- Returns same database instance across calls
- Migrations auto-run on first call
- Repository functions call `getDb()` internally

**API-to-Database Integration**:
- API handlers import repository functions — `src/pages/api/boards/index.ts:2`
- No middleware or error boundaries; error handling in each route
- Synchronous database calls (better-sqlite3 is sync)

**Component-to-API Integration**:
- Fetch API with JSON content-type
- Error handling: check `res.ok`, parse error from response JSON
- No API client library or fetch wrapper

### Current Test Coverage

**Database Layer** — `src/lib/db/__tests__/boards.test.ts`:
- 13 tests across 5 describe blocks
- Coverage: createBoard (4 tests), listBoards (2 tests), getBoardById (2 tests), renameBoard (3 tests), deleteBoard (2 tests)
- All success paths and error paths covered
- After Phase 1 fixes: 93.33% statement coverage on `src/lib/` (from REFLECTIONS.md)

**API Layer** — `src/pages/api/boards/__tests__/boards-api.test.ts`:
- 16 tests across 4 describe blocks (GET, POST, PATCH, DELETE)
- Covers: success cases, missing fields, invalid IDs, malformed JSON, missing body, null values
- Response status codes verified for all paths

**Component Layer** — `src/components/__tests__/BoardList.test.tsx`:
- 3 tests: render, loading state, empty state
- After Phase 1 fixes: upgraded from fake smoke test to real happy-dom tests
- No tests for create/rename/delete interactions yet (acceptable for Phase 1)

## Code References

### Migration System
- `src/lib/db/connection.ts:7-18` — Database singleton with auto-migration
- `src/lib/db/connection.ts:20-45` — Migration runner (reads `db/migrations/*.sql`)
- `src/lib/db/connection.ts:14` — Foreign keys enabled

### Boards Table & Repository
- `db/migrations/001_create_boards.sql:1-6` — Boards table schema
- `src/lib/db/boards.ts:3-8` — Board interface
- `src/lib/db/boards.ts:10-17` — createBoard function
- `src/lib/db/boards.ts:19-23` — listBoards function
- `src/lib/db/boards.ts:25-29` — getBoardById function
- `src/lib/db/boards.ts:31-44` — renameBoard function
- `src/lib/db/boards.ts:46-49` — deleteBoard function

### API Routes
- `src/pages/api/boards/index.ts:4-10` — GET handler (list boards)
- `src/pages/api/boards/index.ts:12-37` — POST handler (create board)
- `src/pages/api/boards/[id].ts:4-44` — PATCH handler (rename board)
- `src/pages/api/boards/[id].ts:46-64` — DELETE handler (delete board)

### UI Components
- `src/pages/index.astro:6-11` — Home page with BoardList island
- `src/layouts/Layout.astro:1-22` — Base HTML layout
- `src/components/BoardList.tsx:1-204` — Main board management component
- `src/components/BoardList.tsx:22-31` — Fetch on mount pattern
- `src/components/BoardList.tsx:40-66` — Create board pattern
- `src/components/BoardList.tsx:68-100` — Rename board pattern
- `src/components/BoardList.tsx:102-118` — Delete board pattern
- `src/components/BoardList.tsx:131-135` — Error banner component

### Testing
- `vitest.config.ts:1-17` — Vitest configuration
- `src/lib/db/__tests__/boards.test.ts:16-30` — Database test setup/teardown
- `src/pages/api/boards/__tests__/boards-api.test.ts:11-28` — API test helpers
- `src/components/__tests__/BoardList.test.tsx:1-41` — Component test with happy-dom

### Configuration
- `astro.config.mjs:7-14` — Astro SSR config with Node adapter and Tailwind plugin
- `tsconfig.json:1-8` — TypeScript strict mode, React JSX
- `package.json:1-36` — Dependencies and scripts

## Open Questions

None. The codebase is well-documented and consistent. Phase 2 can proceed with:
1. Creating the columns migration with `board_id` FK and ON DELETE CASCADE
2. Adding columns repository following the boards pattern
3. Creating column API routes following the boards pattern
4. Building a board detail page at `/boards/:id`
5. Creating a column management React island following BoardList patterns
6. Adding comprehensive tests following existing test patterns

All patterns are established and working. Phase 2 will extend these patterns to the column layer without architectural changes.
