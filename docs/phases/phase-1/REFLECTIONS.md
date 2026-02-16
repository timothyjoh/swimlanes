# Reflections: Phase 1

## Looking Back

### What Went Well

- **Greenfield scaffold was clean and complete**: Starting from zero, the full Astro 5 + React + SQLite + Tailwind stack was set up correctly on first try. The architecture choices (Astro SSR, repository pattern, Vitest testing) all proved sound.

- **Database layer was rock-solid**: The SQLite migration system with better-sqlite3 worked flawlessly. All 13 database unit tests passed immediately, achieving 93.33% statement coverage on `src/lib/`. The repository pattern abstraction was clean and testable.

- **Bottom-up build order paid off**: Building in vertical slices (DB → API → UI) meant each layer was fully tested before the next layer depended on it. This caught issues early and reduced debugging time.

- **API route testing approach worked**: Testing Astro API routes by importing handler functions directly (not spinning up a test server) was fast and effective. 16 integration tests covered success and error cases thoroughly.

- **Spec was detailed and accurate**: Having concrete file paths, code snippets, and test case lists in PLAN.md made implementation straightforward. The plan's open questions (Tailwind v4 integration, testing API routes) were all resolved correctly upfront.

- **Review process caught critical gaps**: The adversarial review identified real problems (missing error handling, fake component test) that would have caused production failures. The 3 critical + 3 minor issues were all fixed systematically.

### What Didn't Work

- **Component test was a facade**: The initial `BoardList.test.tsx` only checked `typeof BoardList === "function"`, providing zero actual coverage. This false positive created dangerous false confidence in the test suite. **Why**: The plan suggested a "smoke test" without defining what that meant, and the implementer took the path of least resistance.

- **Error handling was an afterthought**: None of the initial implementation included try-catch blocks or `.ok` checks. API routes would crash on malformed JSON, and the React component would fail silently on network errors. **Why**: The SPEC focused on happy-path acceptance criteria without explicitly requiring error handling, and no one thought adversarially during implementation.

- **Missing operational feedback**: The UI had no loading states or error messages. Users would click "Create" and have no idea if anything happened. **Why**: The SPEC's acceptance criteria said "newly created board appears in the list" but didn't require "user sees feedback while creating."

- **Review happened too late**: The fix step came after implementation was considered "done." If review had happened during implementation, these issues would have been caught before they became a batch of fixes. **Why**: The pipeline structure treated review as a post-implementation gate rather than an integrated process.

### Spec vs Reality

**Delivered as spec'd:**
- ✅ Project scaffolding with all dependencies correctly installed
- ✅ SQLite database with migrations in `db/migrations/`
- ✅ Repository pattern in `src/lib/db/boards.ts`
- ✅ All 4 API routes (`POST /api/boards`, `GET /api/boards`, `PATCH /api/boards/:id`, `DELETE /api/boards/:id`)
- ✅ React island `BoardList.tsx` with create/rename/delete functionality
- ✅ Database layer has 13 unit tests (100% of spec'd behaviors)
- ✅ API routes have 16 integration tests (100% of spec'd behaviors, plus extras)
- ✅ All tests pass (32/32)
- ✅ Documentation: AGENTS.md, CLAUDE.md, README.md created
- ✅ All acceptance criteria met (10/10)

**Deviated from spec:**
- **Enhanced test coverage**: The fix step added 4 extra API test cases (malformed JSON, missing body) beyond the original plan. This was a positive deviation.
- **Added component DOM tests**: The spec called for a "smoke test" but the fix upgraded it to proper happy-dom rendering tests with 3 scenarios. Again, a positive deviation.
- **Added loading states**: The spec didn't require in-progress indicators but the fix added them (`creating`, `updatingId`, `deletingId` states). This improved UX beyond the spec.
- **Added error state UI**: The spec didn't require error messages, but the fix added an error banner component. Another UX enhancement.

**Deferred:**
- Nothing was deferred from phase 1 scope. All in-scope items were completed.

### Review Findings Impact

- **Fake component test (critical)**: Rewrote `BoardList.test.tsx` to use happy-dom, mock fetch, and test 3 real rendering behaviors. Test count stayed the same but now provides real confidence.

- **Missing API error handling (critical)**: Added try-catch around `request.json()` in both POST and PATCH handlers. Malformed JSON now returns 400 instead of crashing. Added 4 test cases to verify.

- **Missing component error handling (critical)**: Added `error` state to `BoardList`, wrapped all fetch calls in try-catch with `.ok` checks. Error banner now shows when operations fail.

- **Whitespace-only rename bug (minor)**: Fixed handleRename to restore original name when trimmed input is empty. UI now stays consistent.

- **No user feedback (minor)**: Added loading states for all operations with disabled buttons and "Creating..."/"Saving..."/"Deleting..." text. Users now see clear feedback.

- **Missing API edge case tests (minor)**: Added 4 test cases for malformed JSON, missing body, null name. Coverage is now more thorough.

**Result:** All 6 review findings were fixed. Test suite grew from 28 to 32 tests, and all tests still pass.

## Looking Forward

### Recommendations for Next Phase

- **Write error-handling requirements into the spec**: Don't rely on implementers to think adversarially. Explicitly require try-catch blocks, error state in components, and tests for error paths in the acceptance criteria.

- **Define "smoke test" concretely**: If a test doesn't verify observable behavior, it's not a test. Future specs should say "renders without errors in happy-dom" not "smoke test."

- **Integrate review during implementation**: Instead of a post-implementation review step, consider inline checkpoints. For example, after the API routes are done, run a mini-review before moving to the UI layer.

- **Test loading states explicitly**: If the UI should show feedback during async operations, add that to the acceptance criteria. Future specs should say "Create button shows 'Creating...' and is disabled during creation."

- **Watch for better-sqlite3 quirks**: This phase had no issues, but be aware that better-sqlite3 is a native module. If CI/CD or deployment environments differ from dev, there could be build issues. Document the Node version requirement clearly.

### What Should Next Phase Build?

Based on BRIEF.md remaining goals, **Phase 2 should add Columns (Swim Lanes)** to boards. Specifically:

**Scope:**
- Navigate to a board detail page (click a board from the list)
- Create/rename/reorder/delete columns within a board
- Columns stored in SQLite with a `board_id` foreign key
- API routes: `POST /api/columns`, `PATCH /api/columns/:id`, `DELETE /api/columns/:id`, `PATCH /api/columns/:id/position`
- React island for column management with inline edit and drag-to-reorder
- Full test coverage (unit tests for column repository, integration tests for column API routes)

**Not in Phase 2:**
- Cards (Phase 3)
- Drag-and-drop for cards (Phase 3)
- Card-level features like color labels or descriptions (Phase 3+)

**Why this scope:** Columns are the logical next layer after boards. They're required before cards can exist. This keeps the vertical slice approach: build one complete feature (boards) then the next layer (columns), rather than trying to do boards+columns+cards all at once.

**Key decisions for Phase 2:**
- Column ordering: Use an integer `position` field or a linked-list pattern? Recommend integer with gaps (e.g., 1000, 2000, 3000) for easy reordering.
- Column deletion: Cascade delete or prevent deletion if cards exist? Recommend cascade delete (simpler for Phase 2, can add protection in Phase 3 if needed).
- Board detail URL: `/boards/:id` or `/boards/:id/view`? Recommend `/boards/:id` (simpler, follows REST conventions).

### Technical Debt Noted

- **No database foreign keys yet**: The `boards` table exists but there's no foreign key constraints setup. When columns are added in Phase 2, we'll need to add `ON DELETE CASCADE` constraints. This is expected and not a problem, just note it. — `db/migrations/001_create_boards.sql:1-6`

- **No validation on board name length**: The database and API accept arbitrarily long board names. SQLite TEXT columns are unbounded. If UI breaks with very long names, add a `maxLength` constraint in Phase 2. — `src/lib/db/boards.ts:22-30`

- **Component uses client:load for everything**: The `BoardList` component is loaded immediately with `client:load`. If the app grows to have many islands, consider switching to `client:idle` or `client:visible` for better performance. Not a problem for Phase 1. — `src/pages/index.astro:9`

- **No debouncing on rename**: If the user types rapidly while renaming, every change triggers a PATCH request. Consider adding debouncing in Phase 3 if this becomes a problem. — `src/components/BoardList.tsx:55-66`

### Process Improvements

- **Add "error handling" as a top-level acceptance criterion**: Every phase spec should have "All error paths are handled gracefully with user feedback" as a mandatory AC.

- **Require loading states in AC**: If the AC says "user can create X," it should also say "user sees loading indicator during creation and error message on failure."

- **Make component tests observable-behavior-based**: Future PLAN.md should specify exactly what a component test must verify (e.g., "renders the expected heading," "shows loading spinner," "displays error message").

- **Consider a "definition of done" checklist**: Before marking a task complete, verify: (1) happy path works, (2) error paths are handled, (3) user feedback exists, (4) tests cover both paths.

- **Pipeline timing improvement**: The fix step was very effective but came after a full "done" commit. In Phase 2, consider running review+fix before the final commit to avoid "fix after done" artifacts in git history.
