# Phase 1 — Foundation & Database Layer

## Objective
Establish the project foundation with Astro 5 setup, SQLite database infrastructure, and core data models. This phase creates the essential scaffolding and persistence layer that all future features will build upon.

## Scope

### 1. Project Setup
- Initialize Astro 5 project with SSR mode enabled
- Configure TypeScript with strict mode
- Set up Tailwind CSS for styling
- Install and configure better-sqlite3
- Create basic project structure (`src/pages/`, `src/components/`, `db/`, etc.)
- Add necessary dev dependencies and scripts

### 2. Database Infrastructure
- Create SQLite database initialization module
- Implement migration system for schema versioning
- Design and create initial schema for:
  - **boards** table (id, name, created_at, updated_at)
  - **columns** table (id, board_id, name, position, created_at, updated_at)
  - **cards** table (id, column_id, title, description, color, position, created_at, updated_at)
- Create seed data script for development/testing

### 3. Data Access Layer
- Implement repository pattern for clean data access
- Create repositories for:
  - **BoardRepository** — CRUD operations for boards
  - **ColumnRepository** — CRUD operations for columns, including reordering
  - **CardRepository** — CRUD operations for cards, including moving between columns
- Add TypeScript types/interfaces for all entities
- Include basic error handling and validation

### 4. Testing Infrastructure
- Set up test framework (Vitest recommended for Astro)
- Create test helpers for database setup/teardown
- Write comprehensive unit tests for all repository methods
- Ensure tests use isolated in-memory SQLite databases

### 5. Basic API Routes
- Create Astro API routes under `src/pages/api/`:
  - `GET /api/boards` — list all boards
  - `POST /api/boards` — create new board
  - `GET /api/boards/[id]` — get board with columns and cards
  - `PUT /api/boards/[id]` — update board name
  - `DELETE /api/boards/[id]` — delete board
- Return proper HTTP status codes and JSON responses
- Add basic request validation

## Acceptance Criteria

### Database & Schema
- [ ] SQLite database file is created on first run
- [ ] Migration system applies all migrations automatically on startup
- [ ] Schema includes boards, columns, and cards tables with proper relationships
- [ ] Foreign key constraints are enforced (ON DELETE CASCADE)
- [ ] Position fields support proper ordering for columns and cards

### Data Access
- [ ] All repository methods work correctly with SQLite
- [ ] Repositories handle edge cases (not found, constraint violations)
- [ ] TypeScript types accurately represent database entities
- [ ] Repositories return consistent data structures

### Testing
- [ ] 100% test coverage for all repository methods
- [ ] Tests run in isolation (no shared state between tests)
- [ ] Tests validate both success and error cases
- [ ] `npm test` passes with zero failures

### API Routes
- [ ] All board API endpoints return valid JSON
- [ ] Endpoints handle invalid input gracefully (400 responses)
- [ ] GET /api/boards/[id] returns full board data with nested columns and cards
- [ ] API responses include appropriate HTTP status codes
- [ ] No TypeScript errors in API route handlers

### Build & Development
- [ ] `npm run dev` starts development server successfully
- [ ] `npm run build` produces production build with no errors
- [ ] No console errors or warnings in browser console
- [ ] Project follows consistent code style (consider adding ESLint/Prettier)

## Out of Scope
- No UI components yet (pure API/backend work)
- No drag-and-drop functionality
- No column or card management endpoints (only boards for now)
- No client-side React components

## Technical Notes
- Use `better-sqlite3` synchronous API (simpler than async for local DB)
- Store database file in `db/swimlanes.db` (add to .gitignore)
- Use prepared statements for all queries (security + performance)
- Consider transaction support for complex operations
- Keep repository interfaces simple and focused

## Success Metrics
Phase 1 is complete when:
1. All acceptance criteria checkboxes are marked complete
2. All tests pass (`npm test`)
3. Build succeeds (`npm run build`)
4. A simple manual test can create/read/update/delete a board via API endpoints (curl or Postman)

## Next Phase Preview
Phase 2 will focus on building the UI layer with Astro pages and React islands for displaying boards, columns, and cards (no interactivity yet).
