# Research: Phase 2

## Phase Context
Phase 2 delivers column management functionality, allowing users to view a board detail page, create columns (swim lanes) within boards, and manage those columns through CRUD operations (create, rename, delete, reorder). This builds on Phase 1's board foundation and establishes the hierarchical structure (boards → columns) needed for Phase 3's card implementation.

## Previous Phase Learnings

Key insights from Phase 1 REFLECTIONS.md relevant to Phase 2:

1. **Vertical slice approach validated** — Phase 1 successfully delivered complete functionality (DB → API → UI) in one phase. Phase 2 should follow the same pattern for columns.

2. **Test framework patterns work well** — Using `getTestDb()` for in-memory SQLite testing achieved 86.18% coverage with fast execution (55ms for 17 tests). API tests mock `getDb()` to redirect to test database — this is legitimate infrastructure redirection, not business logic mocking.

3. **Test coverage gap caught in review** — Phase 1 initially missed error path coverage (malformed JSON handler). Phase 2 SPEC addresses this with explicit test case requirements in the Testing Strategy section.

4. **Repository + API test patterns established** — `BoardRepository.test.ts` and `index.test.ts` serve as templates for new entities. Copy their structure for ColumnRepository and column API tests.

5. **Foreign key relationships need explicit testing** — Phase 2 introduces first foreign key relationship (columns.board_id → boards.id). Must test cascade delete behavior explicitly.

6. **Defer drag-and-drop complexity** — Phase 1 reflections recommend simpler column reordering UI (up/down buttons or position input) until Phase 3 when HTML5 drag-and-drop is needed for card movement.

7. **Documentation-first approach pays off** — CLAUDE.md, AGENTS.md, and README.md created during Phase 1 provide clear guidance. Update these as part of Phase 2.

## Current Codebase State

### Relevant Components

#### Database Layer
- **Migration system**: `src/lib/db/connection.ts:35-64` — `runMigrations()` function automatically runs numbered SQL files from `db/migrations/` on startup, tracks applied migrations in `migrations` table
- **Existing migration**: `db/migrations/001_create_boards.sql` — Creates `boards` table with `id`, `name`, `created_at` fields and index on `created_at DESC`
- **Database connections**:
  - `src/lib/db/connection.ts:12-26` — `getDb()` returns singleton connection to `db/swimlanes.db` with WAL mode enabled
  - `src/lib/db/connection.ts:28-33` — `getTestDb()` returns fresh in-memory database with migrations applied
  - `src/lib/db/connection.ts:66-71` — `closeDb()` helper exists but unused (noted as technical debt)

#### Type Definitions
- **Board types**: `src/lib/db/types.ts:1-9` — Exports `Board` interface (id, name, created_at) and `NewBoard` interface (name only)
- **Pattern to follow**: Define `Column` and `NewColumn` interfaces in same file

#### Repository Layer
- **BoardRepository**: `src/lib/repositories/BoardRepository.ts:4-27` — Implements repository pattern with:
  - Constructor takes `Database.Database` instance: `line 5`
  - `create(board: NewBoard): Board` — uses `INSERT ... RETURNING` syntax: `lines 7-11`
  - `findAll(): Board[]` — returns all boards ordered by created_at DESC: `lines 14-18`
  - `findById(id: number): Board | null` — returns single board or null: `lines 21-25`
- **Pattern to follow**: ColumnRepository should follow same structure (constructor, CRUD methods, prepared statements)

#### API Routes
- **Board listing**: `src/pages/api/boards/index.ts:6-14` — GET endpoint returns all boards, 200 status
- **Board creation**: `src/pages/api/boards/index.ts:18-52` — POST endpoint with:
  - Request body validation (lines 23-35): checks name exists, is string, not empty
  - Trims input (line 39)
  - Returns 201 on success, 400 for validation errors, 500 for exceptions
  - Catch block handles malformed JSON and database errors (lines 45-51)
- **Board by ID**: `src/pages/api/boards/[id].ts:6-31` — GET endpoint with:
  - ID parsing and validation (lines 7-14): returns 400 for invalid format
  - Returns 404 when board not found (lines 20-25)
  - Returns 200 with board data on success (lines 27-30)
- **Pattern to follow**: Column API routes should follow same conventions (validation, status codes, error handling)

#### UI Components
- **Home page**: `src/pages/index.astro:1-40` — SSR page that:
  - Imports and calls BoardRepository directly in frontmatter (lines 2-9)
  - Renders BoardForm with `client:load` directive (line 30)
  - Passes boards data to BoardList component (line 35)
  - Uses Tailwind CSS for styling (header, sections, spacing)
- **BoardForm**: `src/components/BoardForm.tsx:1-78` — React island component with:
  - State management for name, isSubmitting, error (lines 9-11)
  - Form submission handler (lines 13-52): POST to `/api/boards`, handles errors, reloads page on success
  - Validation: checks empty names client-side (lines 17-20)
  - Tailwind CSS styling: flexbox form, input with focus ring, button with hover/disabled states
- **BoardList**: `src/components/BoardList.astro:1-27` — Astro component displaying:
  - Grid layout (responsive: 1/2/3 columns) (line 11)
  - Empty state message when no boards (lines 12-15)
  - Board cards with name and formatted date (lines 17-24)
  - **Note**: Currently NO clickable links to board detail pages — Phase 2 needs to add this
- **Pattern to follow**: Create board detail page at `src/pages/boards/[id].astro` to display columns

### Existing Patterns to Follow

#### Repository Pattern
- **Structure**: Class with constructor accepting `Database.Database`, methods for CRUD operations
- **SQL prepared statements**: Use `db.prepare()` for all queries — `src/lib/repositories/BoardRepository.ts:8-10, 15-16, 22-23`
- **Return types**: Match TypeScript interfaces from `types.ts`
- **Null handling**: Return `null` for not-found cases, not undefined

#### Database Migration Pattern
- **Naming convention**: Numbered prefix (001_, 002_, etc.) — `db/migrations/001_create_boards.sql`
- **Idempotency**: Use `IF NOT EXISTS` clauses — `db/migrations/001_create_boards.sql:2`
- **Indexing**: Create indexes for common queries (e.g., created_at DESC) — `db/migrations/001_create_boards.sql:9`
- **Application**: Migrations run automatically on `getDb()` or `getTestDb()` call
- **Tracking**: `migrations` table stores applied filenames with timestamp

#### API Route Conventions
- **File structure**: `src/pages/api/entity/` for entity routes, `[id].ts` for single resource
- **Export format**: Named exports (`export const GET: APIRoute`, `export const POST: APIRoute`)
- **Response format**: Always include `Content-Type: application/json` header
- **Status codes**: 200 (success), 201 (created), 400 (validation), 404 (not found), 500 (server error)
- **Error responses**: JSON object with `error` field containing message
- **Validation**: Check required fields and types before processing — `src/pages/api/boards/index.ts:23-35`
- **ID parsing**: Use `parseInt()` with validation for route parameters — `src/pages/api/boards/[id].ts:7-14`

#### Test Patterns
- **Unit tests** (Repository layer):
  - File location: Next to implementation (e.g., `BoardRepository.test.ts` next to `BoardRepository.ts`)
  - Structure: `describe` blocks per method, `it` blocks per test case — `src/lib/repositories/BoardRepository.test.ts`
  - Setup: `beforeEach` creates fresh `getTestDb()` instance — `src/lib/repositories/BoardRepository.test.ts:10-13`
  - Assertions: Use real database operations, no mocking
  - Coverage: Happy paths + edge cases (empty results, not found, auto-increment)

- **Integration tests** (API routes):
  - File location: Next to route file (e.g., `index.test.ts` next to `index.ts`)
  - Mock strategy: Mock `getDb()` to redirect to `getTestDb()` using `vi.mock` — `src/pages/api/boards/index.test.ts:11-22`
  - Setup: `beforeEach` creates fresh test database instance — `src/pages/api/boards/index.test.ts:24-27`
  - Request objects: Create mock Request with `new Request()` — `src/pages/api/boards/index.test.ts:31-35`
  - API context: Cast to `as any` to pass minimal context — `src/pages/api/boards/index.test.ts:37`
  - Coverage: Test all status codes (200, 201, 400, 404, 500) and error messages

#### React Component Patterns
- **Interactive components**: Use `.tsx` files in `src/components/`, export function component
- **State management**: `useState` for local state (form inputs, loading, errors)
- **Event handlers**: Async functions for API calls with try-catch-finally — `src/components/BoardForm.tsx:13-52`
- **Styling**: Tailwind CSS utility classes, responsive design (hover states, disabled states)
- **Error display**: Conditional rendering for error messages — `src/components/BoardForm.tsx:73-75`
- **Island hydration**: Use `client:load` in `.astro` files to hydrate React components — `src/pages/index.astro:30`

### Dependencies & Integration Points

#### Package Dependencies
- **better-sqlite3**: Native SQLite driver, version ^11.0.0 — synchronous API, requires `optimizeDeps.exclude` in Vite config
- **astro**: SSR framework version ^5.0.0 with Node adapter in standalone mode
- **react/react-dom**: Version ^18.0.0 for interactive islands
- **tailwindcss**: Version ^3.4.0 for styling
- **vitest**: Version ^1.0.0 with @vitest/coverage-v8 for testing

#### Path Aliases
- **TypeScript**: `@/*` → `src/*`, `@db/*` → `db/*` — `tsconfig.json:14-17`
- **Vitest**: Same aliases configured — `vitest.config.ts:14-19`
- **Usage**: Import as `@/lib/db/connection`, `@/lib/repositories/BoardRepository`

#### Astro Configuration
- **Output mode**: SSR (`output: 'server'`) — `astro.config.mjs:7`
- **Adapter**: Node.js standalone mode — `astro.config.mjs:8-10`
- **Integrations**: React and Tailwind — `astro.config.mjs:11-14`
- **Vite optimizations**: Exclude better-sqlite3 from pre-bundling — `astro.config.mjs:15-18`

#### File System Structure
- **Source**: `src/` with subdirectories for pages, components, lib
- **Database**: `db/migrations/` for SQL files, `db/swimlanes.db` for data (gitignored)
- **Tests**: Co-located with implementation (`.test.ts` files)
- **Build output**: `dist/` directory (gitignored)

### Test Infrastructure

#### Test Framework
- **Runner**: Vitest version ^1.0.0 with globals enabled — `vitest.config.ts:3-6`
- **Environment**: Node.js (not jsdom, since we're testing backend code) — `vitest.config.ts:6`
- **Coverage provider**: v8 with text/html/lcov reporters — `vitest.config.ts:7-9`
- **Coverage includes**: `src/lib/**/*.ts`, `src/pages/api/**/*.ts` — `vitest.config.ts:10`
- **Coverage excludes**: Test files, types.ts — `vitest.config.ts:11`

#### Test Commands
- `npm test`: Run all tests once — `package.json:9`
- `npm run test:watch`: Run tests in watch mode (TDD workflow) — `package.json:10`
- `npm run test:coverage`: Generate coverage report — `package.json:11`

#### Test Database Strategy
- **In-memory SQLite**: Every test gets fresh `:memory:` database via `getTestDb()`
- **Migration application**: Migrations run automatically on each `getTestDb()` call
- **Isolation**: No test state persists between tests, no cleanup needed
- **Speed**: Fast execution (Phase 1: 55ms for 17 tests)

#### Current Test Coverage
- **Overall**: 86.18% (from Phase 1 reflections)
- **BoardRepository**: 100% coverage on all CRUD methods
- **API routes**: 88.46% on index.ts initially, fixed to cover error handlers
- **Target**: >80% on new code (acceptance criteria)

#### Test File Organization
- **Unit tests**: `src/lib/repositories/BoardRepository.test.ts` (68 lines, 3 describe blocks, 7 test cases)
- **API integration tests**:
  - `src/pages/api/boards/index.test.ts` (173 lines, 3 describe blocks, 8 test cases)
  - `src/pages/api/boards/[id].test.ts` (68 lines, 1 describe block, 3 test cases)
- **Totals**: 17 passing tests across 3 test files

## Code References

### Database & Migrations
- `db/migrations/001_create_boards.sql:1-10` — Current schema (boards table only)
- `src/lib/db/connection.ts:12-26` — Singleton connection function
- `src/lib/db/connection.ts:28-33` — Test database factory
- `src/lib/db/connection.ts:35-64` — Migration runner logic
- `src/lib/db/types.ts:1-9` — Type definitions for Board entity

### Repository Layer
- `src/lib/repositories/BoardRepository.ts:1-28` — Complete repository implementation
- `src/lib/repositories/BoardRepository.test.ts:1-69` — Unit tests with 100% coverage

### API Layer
- `src/pages/api/boards/index.ts:1-53` — GET (list) and POST (create) endpoints
- `src/pages/api/boards/index.test.ts:1-173` — Integration tests for list/create
- `src/pages/api/boards/[id].ts:1-32` — GET single board endpoint
- `src/pages/api/boards/[id].test.ts:1-68` — Integration tests for single board

### UI Layer
- `src/pages/index.astro:1-40` — Home page with board list
- `src/components/BoardForm.tsx:1-79` — React form component for creating boards
- `src/components/BoardList.astro:1-27` — Astro component displaying board grid

### Configuration
- `astro.config.mjs:1-21` — Astro SSR configuration with React and Tailwind
- `tsconfig.json:1-22` — TypeScript strict mode with path aliases
- `vitest.config.ts:1-21` — Test framework configuration with coverage settings
- `package.json:1-32` — Dependencies and npm scripts

## Open Questions

### Navigation Implementation
**Question**: How should users navigate from board list to board detail page?

**Context**: `BoardList.astro` currently renders board cards without any links (lines 18-24). Phase 2 SPEC requires "User can click a board from the home page to view its detail page" (requirement line 28).

**Options**:
1. Add `<a>` tag wrapping the entire card div
2. Add "View Board" button within the card
3. Make card clickable with JavaScript onclick handler

**Investigation needed**: Check if we should convert BoardList to React component for interactive click handling, or use standard `<a>` tag with Astro routing.

### Column Position Strategy
**Question**: What's the best approach for managing column position/order?

**Context**: Phase 2 SPEC mentions "manual column reordering via position field (up/down or manual drag)" (line 16). Previous phase reflections recommend deferring HTML5 drag-and-drop until Phase 3 (cards exist).

**Options**:
1. Integer position field (1, 2, 3...) with reordering logic that updates multiple rows
2. Float position field (1.0, 2.0, 2.5...) allowing insertion without updating all rows
3. Linked list approach (each column has `next_column_id`)

**Investigation needed**: Research best practice for sortable lists in SQLite. Phase 1 doesn't have similar pattern to reference.

### Cascade Delete Testing
**Question**: How to test foreign key cascade behavior?

**Context**: Phase 2 SPEC requires testing "deleting board cascades to columns" (line 52). Phase 1 has no foreign keys to reference.

**Investigation needed**: Verify SQLite supports `ON DELETE CASCADE` syntax, and determine best way to assert cascade behavior in tests (count columns before/after board deletion).

### Board Detail Page Routing
**Question**: Should board detail page use static or dynamic rendering?

**Context**: Home page (`index.astro`) uses SSR to fetch boards in frontmatter. Phase 2 adds `/boards/:id` route which needs to fetch one board + its columns.

**Options**:
1. SSR page like home (fetch board + columns in frontmatter)
2. Client-side fetching (load page skeleton, fetch data with React)
3. Hybrid (SSR board data, client-side fetch columns)

**Investigation needed**: Determine if Astro's `[id].astro` dynamic routes support SSR frontmatter data fetching.
