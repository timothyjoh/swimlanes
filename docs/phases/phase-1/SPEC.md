# Phase 1: Project Foundation and First Board

## Objective
Set up the project infrastructure and deliver the first vertical slice: a user can create a board and see it displayed on the home page. This establishes the full stack (SQLite database, Astro API routes, React UI) with a complete test framework and documentation, proving the architecture works end-to-end.

## Scope

### In Scope
- Project scaffolding with Astro 5, React, TypeScript, Tailwind CSS, and SQLite
- Test framework setup with code coverage reporting (Vitest)
- SQLite database initialization with migrations
- Board creation and listing functionality (data layer, API, and UI)
- Basic UI layout with header and board list view
- Repository pattern for board data access
- Initial project documentation (CLAUDE.md, AGENTS.md, README.md)

### Out of Scope
- Columns/swim lanes (Phase 2)
- Cards (Phase 3)
- Drag and drop functionality (later phases)
- Board editing/deletion (later phases)
- Responsive mobile layout (will refine in later phases)
- Complex styling beyond basic Tailwind setup

## Requirements
- User can create a new board with a name
- User sees all boards listed on the home page
- All boards persist in SQLite database across restarts
- TypeScript strict mode enabled throughout
- Test framework configured and running with coverage reports
- Database migrations properly versioned and applied on startup
- API routes follow RESTful conventions (`POST /api/boards`, `GET /api/boards`)
- Repository pattern separates data access from business logic
- React island hydration works for interactive board creation form

## Acceptance Criteria
- [ ] User can visit the home page and see an empty board list
- [ ] User can create a new board via a form and see it appear in the list immediately
- [ ] Refreshing the page shows the persisted boards
- [ ] API endpoint `POST /api/boards` accepts `{ name: string }` and returns created board
- [ ] API endpoint `GET /api/boards` returns array of all boards
- [ ] Repository has unit tests for board creation and retrieval
- [ ] At least one integration test verifies API → DB → API flow
- [ ] Test coverage command runs and reports coverage percentage
- [ ] All tests pass
- [ ] Code compiles without TypeScript warnings
- [ ] `npm run dev` starts the development server successfully
- [ ] SQLite database file is created automatically on first run

## Testing Strategy
- **Framework**: Vitest (fast, Vite-native, TypeScript support)
- **Coverage Tool**: c8 or vitest coverage provider
- **Unit Tests**: Repository layer (board CRUD operations)
- **Integration Tests**: API routes with in-memory or test database
- **Test Commands**:
  - `npm test` — run all tests
  - `npm run test:coverage` — run with coverage report
- **Coverage Expectations**: Aim for >80% coverage on repository and API layers
- **Test Isolation**: Each test uses a fresh database state (in-memory or teardown/setup)

## Documentation Updates
- **CLAUDE.md** (create):
  - Project tech stack (Astro 5, React, SQLite, Tailwind)
  - How to install dependencies (`npm install`)
  - How to run dev server (`npm run dev`)
  - How to run tests (`npm test`)
  - How to run tests with coverage (`npm run test:coverage`)
  - How to run database migrations (automatic on startup)
  - Project structure overview (directories: src/pages, src/components, db/migrations, src/lib/repositories)
  - Repository pattern explanation
  - API route conventions

- **AGENTS.md** (create):
  - "Read CLAUDE.md for all project conventions"
  - Brief project description: "SwimLanes — a Trello-like kanban board app with SQLite backend"
  - Ensures Codex CLI and other agents follow the same conventions

- **README.md** (create):
  - Project description and goals
  - Tech stack summary
  - Getting started (install, dev server, test)
  - Scripts reference (`npm run dev`, `npm test`, `npm run test:coverage`)
  - Project status (Phase 1 complete)

## Dependencies
- Node.js 18+ (check with `node --version`)
- npm or pnpm for package management
- No external services required (SQLite is file-based)

## Adjustments from Previous Phase
First phase — no prior adjustments.
