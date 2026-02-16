# Phase 7: Card Color Filtering

## Objective
Add color-based filtering to complement the existing text search, allowing users to quickly isolate cards by their color labels. This phase delivers a small, focused enhancement that makes color labels more actionable and helps users organize visual workflows (e.g., "show only red cards" to see blockers, "show only green cards" to see completed work).

## Scope

### In Scope
- **Color filter selector** — clickable color chips next to search input in board view
- **Multi-select colors** — user can select multiple colors simultaneously (e.g., "show red AND yellow cards")
- **Combine with text search** — color filter works alongside existing text search (both filters applied together)
- **URL persistence** — selected colors persist in URL query param (e.g., `?colors=red,blue`) for shareable links
- **Visual feedback** — selected color chips have distinct styling (ring/border), unselected cards gray out
- **Clear filters button** — single button to reset both color filter and text search
- **Repository layer enhancement** — extend `searchCards()` to accept optional `colors` parameter
- **Full test coverage** — unit tests for filtering logic, component tests for UI interactions, E2E tests for full flow
- Update AGENTS.md with color filter documentation
- Update README.md with color filter instructions

### Out of Scope
- **Filter by "no color" (uncolored cards)** — defer to future enhancement
- **Filter by date range** — defer to future enhancement
- **Filter by column** — defer to future enhancement
- **Saved filter presets** — defer to future enhancement
- **Filter combinations (AND vs OR logic toggle)** — always use OR logic for colors (show cards matching ANY selected color)
- Bulk card operations — deferred from Phase 6
- Card templates — deferred from Phase 6
- Auto-archive by date — deferred from Phase 6
- Archive export — deferred from Phase 6
- Dark mode — deferred from Phase 5/6
- Board-level search — deferred from Phase 6

## Requirements
- Color filter must work alongside existing text search (both filters applied together)
- Selected colors use OR logic: show cards matching ANY selected color
- Empty color selection shows all cards (no color filter applied)
- Color filter must preserve all existing functionality (drag-and-drop, keyboard shortcuts, inline editing)
- URL format: `?colors=red,blue` (comma-separated list, no spaces, URL-encoded)
- Browser back/forward buttons must respect filter state
- Color chips must use same visual colors as card labels (red, blue, green, yellow, purple, gray)
- All new code must maintain TypeScript strictness (no `any` types)
- All async operations show loading indicators
- All error paths handled with try-catch and user-visible error messages

## Acceptance Criteria
- [ ] User sees 6 color chips (red, blue, green, yellow, purple, gray) next to search input
- [ ] User can click a color chip to toggle selection (click again to deselect)
- [ ] Selected color chips show visual distinction (ring/border)
- [ ] Cards filter to show only selected colors (OR logic: show cards with ANY selected color)
- [ ] Color filter works alongside text search (both filters applied simultaneously)
- [ ] Selected colors persist in URL query param (`?colors=red,blue`)
- [ ] User can navigate to board with `?colors=...` param and see filtered results
- [ ] Clear filters button resets both color filter and text search
- [ ] Empty state message displays when no cards match combined filters
- [ ] Match count displays correct count when filters are active
- [ ] Drag-and-drop, keyboard shortcuts, and inline editing work on filtered cards
- [ ] All tests pass (unit, integration, component, E2E)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on filter functions is 80%+
- [ ] Documentation updated with color filter functionality

## Testing Strategy
- **Framework**: Vitest for unit/integration/component tests, Playwright for E2E tests (continue from Phase 6)
- **Coverage**: Run `npm run test:coverage` to verify 80%+ on filter functions
- **Key test scenarios**:
  - **Repository layer tests** (6+ new tests):
    - `searchCards(boardId, query, colors)` filters by single color
    - `searchCards(boardId, query, colors)` filters by multiple colors (OR logic)
    - `searchCards(boardId, query, colors)` combines text search + color filter
    - Empty colors array returns all matching text query
    - Color filter with empty text query returns all cards with selected colors
    - Color filter handles invalid color names gracefully
  - **Component interaction tests** (10+ tests):
    - Clicking color chip toggles selection
    - Clicking selected chip deselects it
    - Multiple chips can be selected simultaneously
    - Selected chips show visual distinction
    - Cards filter to show only selected colors
    - Match count updates when colors selected
    - Clear filters button resets colors and text search
    - Filtered cards support drag-and-drop
    - Filtered cards support inline editing
    - Keyboard shortcuts work on filtered cards
  - **URL persistence tests** (5+ tests):
    - Selected colors update URL query param
    - URL query param updates color selection on page load
    - Changing URL manually triggers color filter
    - Empty colors removes `?colors=...` param from URL
    - Colors combine with text search in URL (`?q=todo&colors=red,blue`)
  - **E2E tests** (8+ scenarios):
    - Create board with cards of different colors, filter by single color
    - Filter by multiple colors, verify OR logic (show cards with ANY selected color)
    - Combine text search + color filter, verify both apply
    - Clear filters button resets both filters
    - Color filter persists when navigating back/forward in browser
    - Drag-and-drop works on color-filtered cards
    - Color selection persists in shareable URL
    - Empty state when no cards match combined filters
- **Coverage expectation**: 80%+ on filter functions, 80%+ on component interaction code

## Documentation Updates
- **AGENTS.md**: Update "Search and Filter" section to include:
  - Color filter UI (6 color chips, multi-select)
  - URL query param format (`?colors=red,blue`)
  - Filter combination logic (text search AND color filter, OR logic for multiple colors)
  - Repository function signature update: `searchCards(boardId, query, colors?)`
- **README.md**: Update "Search and Filter" section to include:
  - How to filter by color (click color chips, multiple selections allowed)
  - How filters combine (text search + colors apply together)
  - Shareable filter links (URL includes both query and colors params)

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 6 complete (card archiving delivered)
- No new npm dependencies required (color filter builds on existing search infrastructure)
- Existing color system: 6 predefined colors (red, blue, green, yellow, purple, gray)

## Adjustments from Previous Phase

Based on Phase 6 REFLECTIONS.md lessons learned:

1. **Continue post-MVP enhancements**:
   - Phase 6 REFLECTIONS line 60 declares "PROJECT COMPLETE" — Phase 7 continues post-MVP work
   - This phase follows the same quality standards as MVP phases (full test coverage, vertical slice, documentation)

2. **Build on existing infrastructure**:
   - Search functionality exists (Phase 5), color labels exist (Phase 3)
   - Color filter extends `searchCards()` function rather than creating parallel system
   - Avoids duplication and maintains single source of truth for filtering logic

3. **Keep scope small and focused**:
   - Phase 6 REFLECTIONS line 66 recommends "Advanced filters" as future work
   - Phase 7 delivers only color filtering (not date, not column, not saved presets)
   - Small scope ensures quick delivery and thorough testing

4. **Maintain accessibility baseline**:
   - Phase 6 continued strong accessibility baseline (ARIA labels, focus indicators, live regions)
   - Phase 7 color chips must have accessible labels (e.g., `aria-label="Filter by red cards"`)
   - Color chips must support keyboard navigation (Tab to focus, Enter/Space to toggle)

5. **Continue bottom-up build order**:
   - DB/repository → API (if needed) → UI with tests at each layer
   - This pattern has worked flawlessly for 6 phases

6. **Vertical slice principle**:
   - Color filter is a complete user-visible feature: user clicks color chip → cards filter → user finds cards
   - Testable end-to-end: "Can a user filter cards by color and see only red cards?"
   - No infrastructure-only work — every piece connects to user action

7. **Real SQLite in unit tests**:
   - Phase 6 REFLECTIONS line 116 emphasizes "Real SQLite in unit tests remains gold standard"
   - Phase 7 continues this pattern: all repository tests use real database (no mocking)

8. **Address technical debt proactively if simple**:
   - Phase 6 REFLECTIONS line 75 notes "Archive count badge refresh via localStorage works but not elegant"
   - Phase 7 will NOT refactor this to avoid scope creep (badge works, no user-facing bug)
   - Focus stays on delivering new user value
