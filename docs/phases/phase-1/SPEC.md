# Phase 1: Create and Manage Boards

## Objective
Deliver the foundational vertical slice of SwimLanes: a user can create boards, see them listed on a home page, rename them, and delete them. This phase establishes the full stack (Astro 5 + React islands + SQLite + Tailwind CSS) with a working, tested feature end-to-end.

## Scope

### In Scope
- Project scaffolding: Astro 5 with React, Tailwind CSS, TypeScript
- SQLite database setup with better-sqlite3 and initial migration for `boards` table
- Repository pattern for board data access
- Astro API routes: `POST /api/boards`, `GET /api/boards`, `PATCH /api/boards/:id`, `DELETE /api/boards/:id`
- Home page listing all boards with create/rename/delete actions
- React island for interactive board list (create form, inline rename, delete with confirmation)
- Test framework setup with code coverage reporting
- Initial tests: database layer, API routes, and component smoke tests
- Project documentation: AGENTS.md, CLAUDE.md, README.md

### Out of Scope
- Columns/swim lanes (Phase 2)
- Cards (Phase 3+)
- Drag and drop (Phase 3+)
- Color labels, descriptions, or any card-level features
- Mobile-specific responsive layout refinements (basic responsiveness from Tailwind is fine)
- Board detail/view page (just the listing page this phase)

## Requirements
- Astro 5 in SSR mode (Node adapter)
- TypeScript throughout — no `any` types in application code
- SQLite database stored as a local file (`db/swimlanes.db`)
- Migrations stored in `db/migrations/` and applied on server startup
- Repository pattern: `src/lib/db/` for database access layer
- API routes under `src/pages/api/boards/`
- React island component(s) under `src/components/`
- Tailwind CSS for all styling — no custom CSS files
- All API responses use proper HTTP status codes and JSON

## Acceptance Criteria
- [ ] Running `npm run dev` starts the app and shows a home page
- [ ] User can create a new board by typing a name and submitting
- [ ] Newly created board appears in the list without page reload
- [ ] User can rename an existing board inline
- [ ] User can delete a board (with confirmation)
- [ ] Boards persist across server restarts (SQLite)
- [ ] API routes return proper status codes (201 on create, 200 on list/update, 204 on delete)
- [ ] Database layer has unit tests
- [ ] API routes have integration tests
- [ ] All tests pass
- [ ] Code compiles without TypeScript errors or warnings
- [ ] AGENTS.md, CLAUDE.md, and README.md exist and are accurate

## Testing Strategy
- **Framework**: Vitest (fast, native TypeScript/ESM support, works well with Astro)
- **Coverage**: vitest with `--coverage` flag (v8 or istanbul provider)
- **Key test scenarios**:
  - Database: create board, list boards, rename board, delete board, reject empty names
  - API: test each endpoint for success and error cases (missing name, invalid ID, etc.)
  - Smoke: React component renders without crashing
- **Coverage expectation**: 80%+ on `src/lib/` (data layer), best-effort on components

## Documentation Updates
- **CLAUDE.md**: Create with pointer to AGENTS.md, brief project description
- **AGENTS.md**: Create with install, run, test commands, project structure, conventions
- **README.md**: Create with project description, getting started, available scripts

## Dependencies
- Node.js 18+ installed
- npm available
- No external services — SQLite is file-based

## Adjustments from Previous Phase
First phase — no prior adjustments.
