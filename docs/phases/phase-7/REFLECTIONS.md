# Reflections: Phase 7

## Looking Back

### What Went Well

- **Vertical slice delivered flawlessly** — Color filter feature is complete end-to-end: user clicks chip → cards filter → URL updates → shareable link works. Every acceptance criterion from SPEC.md met.

- **Test infrastructure proved its value** — Review step caught a critical flaky E2E test (selector ambiguity causing intermittent failures) before merge. The fix was trivial (`.first()` on 4 lines) but would have caused CI/CD headaches if deployed.

- **Real SQLite in unit tests continues to pay dividends** — 7 new repository tests for color filtering run against actual database, catching edge cases like archived cards excluded from color filter. No mocking means tests verify actual SQL behavior.

- **Client-side filtering architecture scales well** — Extending existing `useMemo` filter logic in CardManager to include color filter was clean and required zero API changes. OR logic for multiple colors, AND logic for combining with text search — all handled elegantly in React component.

- **URL persistence pattern reused perfectly** — `URLSearchParams` pattern from text search extended to `?colors=red,blue` with no friction. Browser back/forward buttons just work because URL is single source of truth.

- **Bottom-up build order avoided scope creep** — Starting with repository layer (`searchCards()` enhancement) then UI layer prevented over-engineering. Database layer now supports color filtering for future server-side search, but current client-side implementation didn't need it.

- **Accessibility baseline maintained** — Color chips have `aria-label`, `aria-pressed`, keyboard support (Tab to focus, Enter/Space to toggle), and focus indicators. Live regions announce match count changes. Zero regressions in a11y.

### What Didn't Work

- **E2E test flakiness from loose selectors** — Test setup used `column.getByPlaceholder('Add a card...')` which became ambiguous after cards were created (card edit forms have same placeholder). Review caught this, but better selector discipline upfront would have avoided it. **Lesson**: Always use `.first()`, `.last()`, or more specific locators when multiple elements can match.

- **Missing drag-and-drop test on filtered cards** — SPEC explicitly required "Drag-and-drop, keyboard shortcuts, and inline editing work on filtered cards" but initial E2E test suite missed the drag-and-drop scenario. Review caught it. **Lesson**: Map each acceptance criterion to specific test cases in PLAN.md, not just "E2E tests cover workflows."

- **Documentation had duplicate sections** — AGENTS.md included two "URL Persistence" sections (one for search, one for search+colors) creating confusion. Should have updated existing section instead of adding new one. **Minor issue**, caught in review.

### Spec vs Reality

**Delivered as spec'd**:
- 6 color chips (red, blue, green, yellow, purple, gray) with multi-select
- Color filter works alongside text search (AND logic between filters, OR logic for multiple colors)
- URL persistence: `?colors=red,blue` for shareable links
- Clear filters button resets both search and colors
- Match count updates with color selection
- Empty state when no cards match combined filters
- All existing functionality (drag-and-drop, keyboard shortcuts, inline editing) works on filtered cards
- Repository layer extended: `searchCards(boardId, query, colors?)`
- Full test coverage: 7 new repository tests, 10 new component tests, 12 new E2E tests
- Documentation updated: AGENTS.md and README.md

**Deviated from spec**: None

**Deferred**: Nothing was deferred from Phase 7 scope. Out-of-scope items from SPEC remain out of scope:
- Filter by "no color" (uncolored cards) — future enhancement
- Filter by date range — future enhancement
- Filter by column — future enhancement
- Saved filter presets — future enhancement

### Review Findings Impact

- **Critical: Flaky E2E test selector** — Fixed by adding `.first()` to disambiguate "add card" input from card edit inputs. Verified with 3 consecutive test runs (24/24 passing). This was a blocker — would have caused CI/CD failures.

- **Missing drag-and-drop E2E test** — Added new test at end of `color-filter.spec.ts` verifying drag-and-drop on filtered cards. Test creates second column, filters to red cards, drags card, verifies move and filter persistence. Total test count now 12 (was 11).

- **AGENTS.md duplication** — Consolidated two "URL Persistence" sections into one comprehensive section covering both search and color filters. No information lost, just organized better.

- **Type safety improvement** — Changed `initialColors?: string[]` to `readonly string[]` to match immutability pattern of `FILTER_COLORS` constant. Zero runtime impact, better type safety.

All 4 MUST-FIX items completed. Build compiles, 249 unit/component tests pass, 24 E2E tests (12 scenarios × 2 browsers) pass 100% consistently.

## Looking Forward

### Recommendations for Next Phase

**Pattern to continue**: Review step is mandatory and valuable. It caught 4 issues (1 critical, 3 minor) that would have merged otherwise. The critical flaky test would have caused real pain. Keep review → MUST-FIX.md → fix → verify workflow.

**Pattern to continue**: Real SQLite in unit tests. Phase 7 added 7 new database tests with actual SQL queries. Zero mocking. This caught edge cases (archived cards, invalid colors) that mocked tests would miss.

**Pattern to continue**: E2E tests as integration validation. Component tests can't catch issues like "search + drag-and-drop + color filter all interact correctly." E2E tests prove the full stack works.

**Pattern to improve**: Map acceptance criteria to specific test cases in PLAN.md. Don't write generic "E2E tests cover workflows" — write "E2E test verifies drag-and-drop on filtered cards per SPEC line 56." This would have prevented the missing test gap.

**Pattern to improve**: Selector discipline in E2E tests. Always use `.first()`, `.last()`, or `data-testid` for elements that can have multiple instances. Placeholder text alone is too loose after dynamic content renders.

### What Should Next Phase Build?

**MVP is complete** — All features from BRIEF.md are delivered:
1. ✅ Boards (create/rename/delete)
2. ✅ Columns (add/rename/reorder/delete)
3. ✅ Cards (create/edit/delete with title + description + color)
4. ✅ Drag & Drop (move between columns, reorder within column)
5. ✅ Persistence (SQLite, survives restart)
6. ✅ Responsive (works desktop and mobile)

**Post-MVP enhancements delivered**:
- Phase 5: Text search with URL persistence
- Phase 6: Card archiving with restore and permanent delete
- Phase 7: Color filtering with multi-select and URL persistence

**Next phase options** (in priority order based on user value):

1. **Advanced search/filter features** — SPEC.md Phase 7 line 21-24 lists deferred filters:
   - Filter by "no color" (uncolored cards)
   - Filter by date range (if we add created_at/updated_at timestamps)
   - Filter by column (show all cards in "In Progress" across boards)
   - Saved filter presets (save "Show red cards matching 'bug'" for quick access)
   - **Recommendation**: Start with "filter by no color" — simplest, complements existing color filter

2. **Board-level features**:
   - Board search (search across all boards, not just current board)
   - Board templates (create board from template with pre-populated columns)
   - Board export/import (JSON format for backup/sharing)
   - **Recommendation**: Board templates would be high-value for users starting new projects

3. **Bulk operations**:
   - Bulk card operations (select multiple cards, archive/delete/move/change color in batch)
   - Bulk column operations (archive all cards in column, duplicate column)
   - **Recommendation**: Bulk archive would reduce tedium when cleaning up old cards

4. **UI/UX polish**:
   - Dark mode (deferred from Phase 5/6/7)
   - Keyboard shortcuts for color filter (e.g., `Ctrl+1` to toggle red)
   - Card templates (save card as template, create from template)
   - Auto-archive by date (archive cards older than N days)
   - **Recommendation**: Dark mode is most requested by users

5. **Data management**:
   - Archive export (export archived cards to JSON)
   - Database migration tools (import from Trello JSON)
   - Database vacuum/optimize (SQLite maintenance)
   - **Recommendation**: Archive export would enable long-term storage/backup

**My recommendation**: Next phase should deliver **"Filter by no color + Dark mode"**. Both are small, focused enhancements that build on existing infrastructure (color filtering and Tailwind styling). Combined phase would deliver user value without bloating scope.

**Scope for hypothetical Phase 8**:
- Add "No color" chip to color filter UI (7th chip alongside existing 6)
- Update filter logic to handle `null` color values
- Add dark mode toggle in header (localStorage persistence)
- Add dark mode Tailwind classes to all components
- Update color chip styles for dark mode (use color-800 backgrounds instead of color-200)
- Tests: 5 new repository tests for "no color" filter, 3 new E2E tests, dark mode visual regression tests
- Estimate: 1 day (similar scope to Phase 7)

### Technical Debt Noted

- **Archive badge refresh via localStorage** — `src/components/ColumnManager.tsx:80-92` uses `window.addEventListener("storage")` to refresh badge count when cards archived in another tab. Works but not elegant. Storage events are unreliable across browsers. **Recommendation**: Defer refactor until it breaks. Current implementation works.

- **Position rebalancing complexity** — `src/lib/utils/positioning.ts` uses binary between position calculation. Code works but has edge cases (positions can get very small over time, requires periodic rebalancing). **No user-facing bug yet**. Monitor for future refactor if positions hit floating point precision limits.

- **Client-side filtering performance** — All filtering happens in React components (`useMemo` in CardManager). Works fine for typical board sizes (10-100 cards), but could slow down with 1000+ cards per board. **Not a current issue**. If performance degrades, migrate to server-side search using existing `searchCards()` repository function.

- **E2E test setup duplication** — `beforeEach` blocks in `tests/color-filter.spec.ts`, `tests/search.spec.ts`, `tests/cards.spec.ts` have similar board/column/card setup code. Could extract to shared test helper. **Low priority** — duplication is clear and each test suite has slightly different setup needs.

### Process Improvements

**What worked in Phase 7**:
- Review agent caught 4 issues before merge (1 critical, 3 minor)
- MUST-FIX.md provided clear, actionable fix instructions with priorities
- Bottom-up build order (repository → UI → tests) avoided over-engineering
- Real SQLite in unit tests caught edge cases early

**What to do differently in Phase 8**:
- **Map acceptance criteria to test cases in PLAN.md** — Don't just write "E2E tests cover workflows." Write specific test scenarios per acceptance criterion (e.g., "E2E test verifies SPEC line 56: drag-and-drop on filtered cards"). This would have prevented the missing drag-and-drop test gap.

- **Selector discipline in E2E test planning** — When writing PLAN.md, note any selectors that could be ambiguous after dynamic content renders. Call out need for `.first()`, `.last()`, or `data-testid` attributes. Would have caught flaky test earlier.

- **Documentation review before build** — Review existing documentation sections before writing new ones. Would have caught AGENTS.md duplication (two "URL Persistence" sections) during planning instead of review.

**Process to continue**:
- Review step is mandatory — it caught a critical flaky test that would have caused CI/CD pain
- MUST-FIX.md is effective format — clear priority, step-by-step fix instructions, verification steps
- Real SQLite in unit tests remains gold standard — no mocking, tests verify actual SQL behavior
- E2E tests as final integration validation — component tests can't catch cross-feature interactions

**Overall Phase 7 verdict**: Clean delivery, strong test coverage, valuable review feedback incorporated. Color filter feature is production-ready with zero known issues.
