# Reflections: Phase 1

## Looking Back

### What Went Well

- **Greenfield advantage leveraged effectively** — Starting from scratch allowed us to establish clean patterns (repository pattern, migration system, test framework) without fighting existing code. All architectural decisions from BRIEF.md were implemented exactly as specified.

- **Vertical slice approach proved the architecture end-to-end** — Rather than building infrastructure first, we delivered one complete feature (board create + list) that exercises the entire stack: SQLite → Repository → API → UI. This gave us immediate confidence that Astro SSR, React islands, better-sqlite3, and TypeScript work together seamlessly.

- **Test framework established with strong patterns** — Achieved 86.18% coverage (exceeds 80% target) with real database operations. Using in-memory SQLite via `getTestDb()` for test isolation works brilliantly — tests are fast (55ms for 17 tests) and don't require mocking business logic.

- **Documentation-first approach paid off** — Creating CLAUDE.md, AGENTS.md, and README.md as part of the phase ensures future developers (human or AI) have clear guidance. The research → spec → plan → build → review → reflect pipeline enforced this discipline.

- **Legitimate infrastructure mocking pattern validated** — API tests mock `getDb()` to redirect the singleton connection to in-memory test database. This was initially flagged in review but confirmed as necessary and acceptable — it's not mocking business logic, just redirecting infrastructure plumbing. All SQL operations and repository methods use real implementations.

### What Didn't Work

- **Minor test gap in error path initially missed** — The catch block in `POST /api/boards` (handling malformed JSON) wasn't covered by tests initially. Coverage showed 88.46% on index.ts with lines 46-51 uncovered. Fixed during review by adding test for malformed JSON body → 500 error.
  - **Why it happened:** Focus on happy paths and validation errors, overlooked the catch-all error handler.
  - **Learning:** Always check coverage reports for uncovered error handlers, even when test count seems comprehensive.

### Spec vs Reality

- **Delivered as spec'd:**
  - ✅ Project scaffolding (Astro 5, React, TypeScript, Tailwind, SQLite, Vitest)
  - ✅ SQLite database with migration system (automatic on startup)
  - ✅ Board creation and listing (data layer, API, UI)
  - ✅ Repository pattern (`BoardRepository` with create, findAll, findById)
  - ✅ RESTful API routes (`POST /api/boards`, `GET /api/boards`, `GET /api/boards/:id`)
  - ✅ React island hydration (`BoardForm` with `client:load`)
  - ✅ Test framework with >80% coverage (86.18% achieved)
  - ✅ All documentation (CLAUDE.md, AGENTS.md, README.md)
  - ✅ All 11 acceptance criteria from SPEC.md

- **Deviated from spec:**
  - None. Implementation matches SPEC.md exactly.

- **Deferred:**
  - None. All Phase 1 scope completed.

### Review Findings Impact

- **Test gap (malformed JSON error path)** → Fixed immediately by adding test case in `index.test.ts`. Now 17 tests passing, error handler coverage complete.

- **Test mocking concern (getDb redirected to getTestDb)** → Analyzed and confirmed as legitimate infrastructure pattern. Not business logic mocking — only redirects singleton connection source. Documented rationale in REVIEW.md for future reference.

- **Coverage gaps in connection.ts (singleton management, closeDb helper)** → Acknowledged as acceptable. Lines 13-26 (singleton setup) and 67-71 (`closeDb()` unused helper) are low-risk utility code. Would require complex integration tests to cover. Not worth the effort for minimal risk code.

## Looking Forward

### Recommendations for Next Phase

- **Build columns as another vertical slice** — Follow the same pattern that worked in Phase 1: database migration → repository → API routes → UI component → tests. This keeps the codebase in a working state at all times.

- **Continue avoiding infrastructure-only work** — Don't build a "column management service" without UI. Each phase should deliver user-facing functionality, not just APIs.

- **Watch for foreign key relationships** — Columns will belong to boards (many-to-one). Test the cascade behavior carefully: what happens when you delete a board with columns? SPEC should address this explicitly.

- **Maintain test coverage discipline** — 80%+ coverage was achievable in Phase 1, keep it there. Always check `npm run test:coverage` after implementation, before review step.

- **Reuse the repository + API test pattern** — The mock-for-connection-redirect pattern works. Future phases can copy `BoardRepository.test.ts` and `index.test.ts` as templates for new entities.

### What Should Next Phase Build?

Based on BRIEF.md remaining goals (features 2-5 incomplete):

**Phase 2 should focus on Columns (Swim Lanes)**

Scope:
- Add `columns` table with foreign key to `boards` (board_id, name, position for ordering)
- Create `ColumnRepository` with CRUD operations
- API routes: `POST /api/boards/:boardId/columns`, `GET /api/boards/:boardId/columns`, `PATCH /api/columns/:id` (for renaming), `DELETE /api/columns/:id`
- Update board detail page (new route: `/boards/:id`) to display columns
- UI: Show columns horizontally across the board, with ability to add/rename/delete columns
- Reordering columns (drag-and-drop or up/down buttons — defer HTML5 DnD complexity until cards exist)

**Why this is the right next step:**
- Columns are the next logical entity in the hierarchy (boards → columns → cards)
- Proves the architecture scales to related entities (foreign keys, joins)
- Sets up the structure for Phase 3 (cards belong to columns)
- Follows the vertical slice principle: complete feature from DB to UI

**Out of scope for Phase 2:**
- Cards (Phase 3)
- Drag-and-drop for columns (defer until cards exist, then implement both at once)
- Board editing/deletion (can be a polish phase)

### Technical Debt Noted

- **No max length validation for board names** — SQLite TEXT type accepts arbitrarily long strings. Could add UX validation (e.g., max 100 chars) in a future polish phase. Not blocking: `src/pages/api/boards/index.ts:28-35`

- **`closeDb()` helper unused** — `connection.ts:67-71` exports a `closeDb()` function that nothing calls. Either use it in a graceful shutdown handler or remove it. Low priority. `src/lib/db/connection.ts:67-71`

- **Error messages inconsistent casing** — Some errors say "name is required" (lowercase), others might use different formats. Could standardize error message format in a polish phase. Not blocking.

### Process Improvements

- **Keep the pipeline structure** — The research → spec → plan → build → review → reflect workflow works extremely well. Each document has a clear purpose and the handoffs are clean.

- **Fix test coverage in review, not after** — The malformed JSON test gap was caught in review. This is good! But ideally coverage should be 100% on new code before review step starts. Suggestion: Add "run coverage and inspect gaps" as explicit step before exiting build phase.

- **Spec Writer should include explicit test cases** — SPEC.md had acceptance criteria but could have been more prescriptive about specific test cases. For example: "Test that malformed JSON returns 500" would have prevented the gap. Next phase's SPEC should include a "Test Cases" section with specific scenarios.

- **The reflection step is valuable** — Writing this document forced me to articulate what worked, what didn't, and why. Keep this step for all phases — it's the memory that prevents repeating mistakes.
