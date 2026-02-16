# Reflections: Phase 2

## Looking Back

### What Went Well

- **Phase 1 patterns scaled perfectly** — The repository pattern, API route structure, component state management, and test infrastructure established in Phase 1 were directly replicated for columns with zero architectural friction. Every pattern worked first-time.

- **Bottom-up implementation order validated again** — Building DB → API → UI with tests at each layer caught integration issues immediately. The CASCADE DELETE constraint was tested at the database layer before the UI was even built, preventing potential bugs.

- **Error handling from day one paid off** — Phase 1's lesson about mandatory error handling was baked into the spec. All async operations have try-catch, all API routes validate inputs, all components show error banners. No post-implementation retrofitting needed.

- **Loading states throughout** — Every operation (create, rename, delete, drag-reorder) shows user feedback. This was a Phase 1 gap; Phase 2 shipped with it from the start.

- **Test quality is exceptional** — 100% coverage on critical paths (columns.ts, boards.ts), 83 passing tests, zero mock abuse, comprehensive edge cases. Tests genuinely validate behavior, not just pass green.

- **Integer gap positioning strategy** — The 1000-gap approach for column positions worked elegantly. Reordering updates a single column (not all columns), and the midpoint calculation handles all edge cases (first, middle, last position).

- **Native HTML5 drag-and-drop** — No library dependencies needed. The implementation is simple, works across Chrome/Firefox, and provides visual feedback (opacity during drag).

- **Documentation was thorough** — AGENTS.md update included schema, positioning rationale, CASCADE DELETE behavior, API contracts. Future phases have everything they need.

### What Didn't Work

- **Spec mentioned E2E tests but plan deferred them** — BRIEF.md line 29 requires Playwright tests for UI features, but PLAN.md Task 7 only implemented component tests. The phase proceeded without E2E tests because "E2E scenarios are limited" without cards. This was a judgment call that deviated from the brief.

- **Component tests don't verify interactions** — ColumnManager.test.tsx only tests rendering states (loading, error, empty). No tests for form submission, inline edit, delete confirmation, or drag-reorder. The spec only required 5+ tests covering render/loading/error, so this technically passes, but it's a gap in user interaction validation.

- **No rebalancing logic for position integer overflow** — PLAN.md identified the risk (lines 1224-1241) of positions converging after many reorders (e.g., 1000 → 1001 → 1001.5 → rounding collisions). Decision was to defer rebalancing to Phase 3. This is documented but unimplemented, so it's a known edge case that could surface in heavy usage.

### Spec vs Reality

- **Delivered as spec'd**:
  - Columns table with CASCADE DELETE foreign key constraint — `db/migrations/002_create_columns.sql`
  - Repository layer with 6 functions (create, list, get, rename, delete, updatePosition) — `src/lib/db/columns.ts`
  - 5 REST API endpoints (POST, GET, PATCH, DELETE, PATCH position) — `src/pages/api/columns/`
  - Board detail page at `/boards/:id` with navigation — `src/pages/boards/[id].astro`
  - ColumnManager React island with create/rename/delete/drag-reorder — `src/components/ColumnManager.tsx`
  - 21 database tests, 25 API tests, 5 component tests (spec required 15+, 20+, 5+)
  - 100% coverage on columns.ts (spec required 80%+)
  - AGENTS.md updated with column architecture details

- **Deviated from spec**:
  - **No E2E tests** — BRIEF.md line 29 says "E2E tests required for any UI feature (use Playwright)". Phase 2 added column UI (create, rename, delete, reorder) but no Playwright tests were written. PLAN.md deferred this to Phase 3 reasoning that E2E tests are most valuable for complete user flows (board → columns → cards → move cards). This is a deviation from the brief's strict requirement.

- **Deferred**:
  - Position rebalancing logic (if positions converge below gap threshold, renumber all columns with 1000 gaps) — documented in PLAN.md lines 1224-1241, deferred to Phase 3

### Review Findings Impact

- **Review verdict was PASS with no fixes needed** — REVIEW.md lines 2-3 state "No fixes needed. Phase 2 has been implemented to spec with excellent code quality and comprehensive test coverage."

- **Test quality rated 5 stars** — REVIEW.md lines 173-183 rated tests as STRONG: no mock abuse, comprehensive edge cases, strong assertions, integration testing, test independence, coverage exceeds requirements.

- **Zero issues identified** — REVIEW.md line 196 confirms "Recommendation: Ship it. No fixes needed."

- **No technical debt flagged** — The only note was that user interaction tests (create, rename, delete, drag) would strengthen component coverage but are not required by spec — REVIEW.md lines 143-158.

## Looking Forward

### Recommendations for Next Phase

- **Add Playwright E2E tests now** — Phase 3 will add cards and card movement. This completes the "full kanban flow" that PLAN.md used to justify deferring E2E tests. However, BRIEF.md requires E2E tests for *any* UI feature. Recommendation: Add Playwright setup in Phase 3 and write E2E tests covering:
  1. Board CRUD (create board, rename, delete)
  2. Column CRUD (navigate to board, create column, rename, reorder, delete)
  3. Card CRUD (create card, edit, delete)
  4. Drag-and-drop (move card between columns, reorder within column)

  This will bring the project into compliance with BRIEF.md line 29 and provide regression protection as the app grows.

- **Continue the bottom-up build order** — DB → API → UI with tests at each layer worked flawlessly in both phases. Do not change this approach.

- **Keep error handling and loading states mandatory** — These are no longer "nice-to-have" after Phase 1. Phase 2 proved that baking them into the spec upfront works. Every async operation in Phase 3 must have error handling and loading indicators.

- **Watch for position integer overflow** — As users create and reorder cards within columns, the same position gap strategy will be used. Monitor for positions converging below 1 (e.g., 1000 → 500 → 250 → 125 → 62 → 31 → 15 → 7 → 3 → 1 → 0). If this happens, implement rebalancing logic that renumbers all items with 1000 gaps.

- **Consider component interaction tests** — Phase 2 component tests only verify rendering states, not user interactions. Phase 3's CardManager component could include interaction tests (form submit, inline edit, drag-reorder) using `@testing-library/user-event` to strengthen coverage. This is optional but valuable.

### What Should Next Phase Build?

**Phase 3: Cards**

Based on BRIEF.md remaining goals (line 13-18), the next phase should add:

1. **Cards table** — Schema with `column_id` foreign key (CASCADE DELETE), `title`, `description`, `color`, `position` fields
2. **Card repository** — Functions for createCard, listCardsByColumn, getCardById, updateCard, deleteCard, updateCardPosition
3. **Card API routes** — POST /api/cards, GET /api/cards?columnId=X, PATCH /api/cards/:id, DELETE /api/cards/:id, PATCH /api/cards/:id/position
4. **CardManager component** — Inline create, edit title/description/color, delete, drag-to-reorder within column
5. **Card drag between columns** — Drag card from one column to another, updates column_id and position
6. **Playwright E2E tests** — Full user flows (board → columns → cards → move cards) as required by BRIEF.md line 29

**Scope priorities**:
- **In scope**: Card CRUD, drag within column, drag between columns, color labels, E2E test setup
- **Out of scope**: Due dates, assignments, attachments, collaborative editing (all listed as non-goals in BRIEF.md lines 21-25)

**Verification criteria**:
- All BRIEF.md MVP features complete (boards ✅, columns ✅, cards ⬜, drag-and-drop ⬜, persistence ✅, responsive ⬜)
- E2E tests covering all features
- 80%+ test coverage on card repository and API routes
- Component tests for CardManager covering render/loading/error/empty states

After Phase 3, the project will be feature-complete for MVP. Write "PROJECT COMPLETE" in Phase 3's REFLECTIONS.md if all BRIEF.md features are working with E2E test coverage.

### Technical Debt Noted

- **Position rebalancing unimplemented**: Columns (and future cards) use integer gap positioning. After many reorders, positions can converge below 1, causing rounding collisions. Need rebalancing function that renumbers all items with 1000 gaps when gap falls below threshold. Documented in PLAN.md lines 1224-1241, deferred to Phase 3. — `src/lib/db/columns.ts:21-24` (position calculation logic)

- **No E2E tests yet**: BRIEF.md line 29 requires Playwright tests for UI features. Phase 2 added column UI but no E2E tests. This is a deviation from the brief's requirement. — BRIEF.md:29

- **Component tests skip interactions**: ColumnManager.test.tsx only tests rendering states, not user interactions (form submit, inline edit, drag-reorder). This is acceptable per spec but leaves a gap in interaction validation. — `src/components/__tests__/ColumnManager.test.tsx`

- **Connection.ts has uncovered error path**: Line 36 (error handling in migration runner) is not covered by tests. Current coverage: 88.88% statements, 70% branch, 80% functions. Not critical (error path is logging only) but could add test that triggers migration failure. — `src/lib/db/connection.ts:36`

### Process Improvements

- **E2E test requirement must be explicit in spec** — Phase 2 spec mentioned E2E tests in the testing strategy section but didn't make them a hard acceptance criterion. Result: plan deferred them, and they didn't get built. Lesson: If BRIEF.md says "required", then SPEC.md must include it in acceptance criteria with a checkbox.

- **Document deviations in plan, flag in review** — PLAN.md Task 7 section on "E2E Test Considerations" (lines 1218-1223) documented the decision to defer E2E tests with rationale. However, this deviation from BRIEF.md wasn't flagged as a blocker in REVIEW.md. Future reviews should explicitly check if any BRIEF.md requirements were deferred and whether that's acceptable or needs addressing.

- **Phase reflections should read BRIEF.md** — This reflection process discovered the E2E test gap by comparing PLAN.md to BRIEF.md. Future reflection agents should always read BRIEF.md to ensure phase deliverables align with project goals, not just with the phase spec.

- **Keep building in vertical slices** — Both phases validated that vertical slices (DB → API → UI → tests) are the right granularity. Don't change to horizontal slices (all DB layers → all API layers → all UI layers) — that loses the tight feedback loop.

- **Test coverage metrics are a forcing function** — The 80%+ requirement in spec ensures comprehensive testing. Phase 2 achieved 100% on critical paths. Keep this requirement in future specs.

- **Position gap strategy should be extracted to a shared utility** — Both columns and cards will use the same positioning logic. Phase 3 should create `src/lib/utils/positioning.ts` with `calculateInitialPosition(items)` and `calculateReorderPosition(items, sourceIndex, targetIndex)` functions. This reduces duplication and makes rebalancing easier to add later.
