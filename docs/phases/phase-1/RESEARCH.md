# Research: Phase 1

## Phase Context

Phase 1 establishes the complete project foundation from scratch. We're building the first vertical slice: a user can create a board and see it displayed on the home page. This requires setting up the entire tech stack (Astro 5, React, TypeScript, Tailwind CSS, SQLite), implementing the full stack (database, API routes, UI), and establishing the test framework with coverage reporting. The goal is to prove the architecture works end-to-end with a minimal but complete feature.

## Previous Phase Learnings

First phase — no prior reflections. This is a greenfield project starting from scratch.

## Current Codebase State

### Project Status: Greenfield

The repository currently contains:
- **Project documentation only** — `BRIEF.md` at root
- **Phase specifications** — `docs/phases/phase-1/SPEC.md`
- **Pipeline infrastructure** — `.pipeline/` directory with automation scripts
- **Git repository** — initialized and tracking changes
- **No source code** — no `package.json`, no `src/` directory, no dependencies installed

### Existing Files

- `BRIEF.md:1-43` — Project brief defining the overall vision:
  - Tech stack: Astro 5, React, SQLite (better-sqlite3), Tailwind CSS, vanilla HTML5 drag-and-drop
  - MVP features: boards, columns, cards, drag & drop, persistence
  - Architecture: Astro SSR with API routes, React islands, SQLite migrations, repository pattern
  - Quality bar: tests for all data operations, TypeScript throughout
  - Iterative phase approach with ~4 phases to MVP

- `docs/phases/phase-1/SPEC.md:1-92` — Detailed Phase 1 specification:
  - Scope: project scaffolding, test framework, SQLite setup, board CRUD (create + list)
  - Requirements: repository pattern, RESTful API (`POST /api/boards`, `GET /api/boards`), React island hydration
  - Testing: Vitest with coverage (>80% target), unit tests for repository, integration tests for API
  - Documentation: must create CLAUDE.md, AGENTS.md, README.md
  - Acceptance criteria: 11 checkboxes covering functionality, tests, and build

- `.gitignore:1-5` — Basic ignore patterns already set up:
  - `node_modules/`
  - `.astro/`
  - `dist/`
  - `db/*.db` (will ignore SQLite database files)

- `.pipeline/state.json:1-6` — Pipeline automation state tracking:
  - Currently at phase 1, research step, running status
  - Project not yet complete

### Existing Patterns to Follow

**From BRIEF.md architecture guidance:**
- Repository pattern for data access — `BRIEF.md:37`
- SQLite migrations in `db/migrations/` — `BRIEF.md:36`
- Astro API routes under `src/pages/api/` — `BRIEF.md:34`
- React components for interactive islands — `BRIEF.md:35`
- Astro SSR mode — `BRIEF.md:34`

**From Phase 1 SPEC:**
- Directory structure conventions — `docs/phases/phase-1/SPEC.md:69`:
  - `src/pages/` — Astro pages and API routes
  - `src/components/` — React components
  - `db/migrations/` — Database schema migrations
  - `src/lib/repositories/` — Repository layer
- RESTful API conventions — `docs/phases/phase-1/SPEC.md:32,71`:
  - `POST /api/boards` — create board, accepts `{ name: string }`
  - `GET /api/boards` — list all boards
- TypeScript strict mode — `docs/phases/phase-1/SPEC.md:29`
- Test isolation with fresh database state per test — `docs/phases/phase-1/SPEC.md:59`

### Dependencies & Integration Points

**Required dependencies (from BRIEF.md and SPEC.md):**
- Astro 5 — SSR framework, API routes
- React — interactive island components (board creation form)
- TypeScript — type safety throughout
- Tailwind CSS — styling framework
- SQLite via better-sqlite3 — local file-based database
- Vitest — test framework (Vite-native, TypeScript support)
- c8 or Vitest coverage provider — code coverage reporting

**Integration points to establish:**
- Astro ↔ React: island hydration for interactive components
- Astro API routes ↔ Repository layer: business logic calls data access
- Repository ↔ SQLite: database operations with better-sqlite3
- Migration system ↔ SQLite: automatic schema application on startup
- Vitest ↔ Repository/API: unit and integration test coverage

### Test Infrastructure

**Framework selection (from SPEC.md:51-59):**
- Vitest — chosen for Vite-native integration, TypeScript support, speed
- Coverage tool: c8 or Vitest's built-in coverage provider
- Test commands to implement:
  - `npm test` — run all tests
  - `npm run test:coverage` — run with coverage report
- Coverage target: >80% on repository and API layers

**Test strategy:**
- Unit tests: repository layer (board CRUD operations) — `docs/phases/phase-1/SPEC.md:53`
- Integration tests: API routes with in-memory or test database — `docs/phases/phase-1/SPEC.md:54`
- Test isolation: fresh database state per test (in-memory DB or setup/teardown) — `docs/phases/phase-1/SPEC.md:59`
- Acceptance: at least one integration test verifying API → DB → API flow — `docs/phases/phase-1/SPEC.md:43`

**No existing test patterns** — this is the first phase, so we establish the patterns.

### Documentation Requirements

Phase 1 must create three documentation files (from SPEC.md:61-83):

1. **CLAUDE.md** — comprehensive project conventions:
   - Tech stack overview
   - Installation: `npm install`
   - Dev server: `npm run dev`
   - Test commands: `npm test`, `npm run test:coverage`
   - Database migrations: automatic on startup
   - Project structure: directories and their purposes
   - Repository pattern explanation
   - API route conventions

2. **AGENTS.md** — brief reference for AI agents:
   - Directive: "Read CLAUDE.md for all project conventions"
   - Project description: "SwimLanes — a Trello-like kanban board app with SQLite backend"
   - Ensures Codex CLI and other agents follow conventions

3. **README.md** — user-facing documentation:
   - Project description and goals
   - Tech stack summary
   - Getting started: install, dev server, test
   - Scripts reference
   - Project status: Phase 1 complete

### Environment Requirements

**From SPEC.md:85-88:**
- Node.js 18+ — runtime requirement
- npm or pnpm — package manager
- No external services — SQLite is file-based, everything local

### Git Context

**Recent commits (from git log):**
- `cb149be` — "pipeline: enforce vertical slices - no infrastructure-only phases"
- `386cade` — "pipeline: single commit step per phase, remove retry logic, no mid-step commits"
- `10a7147` — "pipeline: add AGENTS.md to phase 1 requirements"
- `8320fe6` — "pipeline: remove CLAUDE_MD injection - CC auto-loads it"
- `eb1bddb` — "pipeline: proper prompt templates based on original cc-agent-teams prompts"

These commits show the project is using an automated pipeline with structured phases, strict commit conventions, and documentation-first requirements.

## Code References

Since this is a greenfield project, there are no existing code files to reference. All implementation will be created fresh in Phase 1.

## Open Questions

None — the SPEC.md is comprehensive and clear. The greenfield nature of the project means we have complete freedom to implement the architecture as specified without working around existing code. The BRIEF.md and SPEC.md together provide sufficient guidance for implementation.
