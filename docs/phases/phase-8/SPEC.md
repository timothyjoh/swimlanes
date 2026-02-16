# Phase 8: Uncolored Card Filter and Dark Mode

## Objective
Add the ability to filter for cards without color labels and implement a dark mode theme toggle, delivering two complementary UX enhancements that build on existing infrastructure. The "no color" filter completes the color filtering system from Phase 7, while dark mode addresses a commonly requested visual preference, improving accessibility and reducing eye strain for users working in low-light environments.

## Scope

### In Scope
- **"No color" filter chip** — 7th chip in color filter UI to isolate uncolored cards
- **"No color" filter logic** — filter cards where `color` column is NULL
- **Combine with existing filters** — "no color" works alongside text search and other color filters (OR logic)
- **Dark mode toggle** — button in board header to switch between light and dark themes
- **Dark mode persistence** — theme preference saved to localStorage, persists across sessions
- **Dark mode styling** — Tailwind dark mode classes on all components (header, columns, cards, search, filters, archive view)
- **Color chip dark mode adaptation** — adjust color chip styles for readability in dark mode (use darker color backgrounds)
- **Full test coverage** — unit tests for "no color" filter logic, component tests for dark mode toggle, E2E tests for both features
- Update AGENTS.md with "no color" filter and dark mode documentation
- Update README.md with both feature instructions

### Out of Scope
- **Scheduled dark mode** (auto-switch based on time of day) — defer to future enhancement
- **System theme sync** (match OS dark mode preference) — defer to future enhancement
- **Custom themes** or color scheme editor — defer to future enhancement
- **Dark mode for print styles** — defer if print functionality added
- **Filter by date range** — deferred from Phase 7
- **Filter by column** — deferred from Phase 7
- **Saved filter presets** — deferred from Phase 7
- Bulk card operations — deferred from Phase 6
- Card templates — deferred from Phase 6
- Auto-archive by date — deferred from Phase 6
- Archive export — deferred from Phase 6
- Board-level search — deferred from Phase 6

## Requirements
- "No color" chip must visually indicate null/unset color (e.g., gray chip with "None" label or diagonal line icon)
- "No color" filter uses same OR logic as other colors: selecting "no color" + "red" shows cards that are EITHER uncolored OR red
- "No color" filter works alongside text search (both filters applied together)
- Dark mode toggle must be easily discoverable (header location, moon/sun icon)
- Dark mode must apply to ALL components: header, columns, cards, search input, color chips, archive view, empty states, modals
- Dark mode must maintain contrast ratios per WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Color chips in dark mode must remain distinguishable (use darker backgrounds, e.g., red-800 instead of red-200)
- Dark mode preference must persist in localStorage key `theme` with values `light` or `dark`
- Initial theme on first visit defaults to light mode
- All new code must maintain TypeScript strictness (no `any` types)
- All async operations show loading indicators (not applicable for theme toggle, but maintain pattern)
- All error paths handled with try-catch and user-visible error messages

## Acceptance Criteria
- [ ] User sees 7th color chip labeled "None" or with clear visual indication of "no color" option
- [ ] User can click "no color" chip to filter for cards without color labels
- [ ] "No color" filter combines with other colors using OR logic (e.g., "no color" + "red" shows uncolored OR red cards)
- [ ] "No color" filter works alongside text search (both filters applied simultaneously)
- [ ] "No color" filter persists in URL query param (`?colors=none,red`)
- [ ] Dark mode toggle button appears in board header with clear icon (moon/sun or similar)
- [ ] Clicking dark mode toggle switches theme immediately (no page reload)
- [ ] Dark mode preference saves to localStorage and persists across sessions
- [ ] Dark mode applies to all UI components: header, columns, cards, search, filters, archive view
- [ ] Color chips in dark mode use darker color values for readability (e.g., red-800 instead of red-200)
- [ ] Dark mode maintains WCAG AA contrast ratios for all text (4.5:1 for normal, 3:1 for large)
- [ ] URL query param correctly handles "none" value alongside color names (`?colors=none,blue,green`)
- [ ] Match count updates correctly when "no color" filter is active
- [ ] All tests pass (unit, integration, component, E2E)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on "no color" filter functions is 80%+
- [ ] Documentation updated with both features

## Testing Strategy
- **Framework**: Vitest for unit/integration/component tests, Playwright for E2E tests (continue from Phase 7)
- **Coverage**: Run `npm run test:coverage` to verify 80%+ on filter functions
- **Key test scenarios**:
  - **Repository layer tests for "no color" filter** (5+ new tests):
    - `searchCards(boardId, query, ['none'])` returns only cards with NULL color
    - `searchCards(boardId, query, ['none', 'red'])` returns cards with NULL color OR red color (OR logic)
    - `searchCards(boardId, '', ['none'])` with empty text query returns all uncolored cards
    - "No color" filter combines with text search correctly
    - "No color" filter handles edge case: board with no uncolored cards returns empty array
  - **Component interaction tests for filters** (5+ tests):
    - Clicking "no color" chip toggles selection
    - "No color" chip shows visual distinction when selected
    - Cards filter to show only uncolored cards when "no color" selected
    - Match count updates when "no color" selected
    - URL updates to include `?colors=none` when "no color" selected
  - **Dark mode component tests** (8+ tests):
    - Dark mode toggle button renders in header
    - Clicking toggle switches theme class on document root
    - Dark mode preference saves to localStorage
    - Page load reads localStorage and applies saved theme
    - Dark mode classes apply to header, columns, cards, search input
    - Color chips use dark mode color variants (e.g., `dark:bg-red-800`)
    - Empty states render correctly in dark mode
    - Archive view renders correctly in dark mode
  - **E2E tests for "no color" filter** (4+ scenarios):
    - Create board with mix of colored and uncolored cards, filter by "no color"
    - Filter by "no color" + another color (e.g., red), verify OR logic
    - Combine "no color" filter with text search, verify both filters apply
    - "No color" filter persists in URL when navigating back/forward
  - **E2E tests for dark mode** (6+ scenarios):
    - Toggle dark mode on, verify all components switch to dark theme
    - Toggle dark mode off, verify all components switch back to light theme
    - Dark mode preference persists after browser refresh
    - Color chips remain distinguishable in dark mode
    - Search and filter UI remains usable in dark mode
    - Archive view remains usable in dark mode
- **Visual regression testing** (optional but recommended):
  - Playwright screenshot comparison for dark mode vs light mode
  - Verify color chip contrast in both themes
- **Coverage expectation**: 80%+ on filter functions, 80%+ on dark mode toggle logic

## Documentation Updates
- **AGENTS.md**: Update "Search and Filter" section to include:
  - "No color" filter chip description and behavior
  - URL query param format with "none" value (`?colors=none,red`)
  - Repository function behavior: `searchCards(boardId, query, ['none'])` filters NULL color
  - Add "Dark Mode" section documenting:
    - Dark mode toggle location (header)
    - localStorage persistence (key: `theme`, values: `light` | `dark`)
    - Tailwind dark mode implementation (`class` strategy)
    - Color chip dark mode variants (e.g., `bg-red-200 dark:bg-red-800`)
- **README.md**: Update "Search and Filter" section to include:
  - How to filter by "no color" (click "None" chip)
  - Add "Dark Mode" section to features list with:
    - How to toggle dark mode (click moon/sun icon in header)
    - Theme preference persistence across sessions

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 7 complete (color filtering delivered)
- No new npm dependencies required (both features build on existing infrastructure)
- Tailwind CSS dark mode must be configured in `tailwind.config.mjs` (likely already set to `class` strategy, verify in plan phase)

## Adjustments from Previous Phase

Based on Phase 7 REFLECTIONS.md lessons learned:

1. **Continue post-MVP enhancement pattern**:
   - Phase 7 REFLECTIONS line 79 declares "MVP is complete" — Phase 8 continues post-MVP work
   - Line 125 explicitly recommends Phase 8: "Filter by no color + Dark mode"
   - Both features are small, focused enhancements that deliver user value without bloating scope

2. **Map acceptance criteria to specific test cases in PLAN.md**:
   - Phase 7 REFLECTIONS line 154 recommends explicit test-to-criterion mapping to prevent gaps
   - Phase 8 plan must include: "E2E test verifies SPEC line X" for each acceptance criterion
   - Prevents missing test scenarios like Phase 7's initially-missing drag-and-drop test

3. **Selector discipline in E2E tests**:
   - Phase 7 REFLECTIONS line 23 caught flaky test from ambiguous `.getByPlaceholder()` selector
   - Phase 8 E2E tests must use `.first()`, `.last()`, or `data-testid` for elements with multiple instances
   - Call out potential selector ambiguities during plan phase

4. **Build on existing infrastructure**:
   - "No color" extends Phase 7 color filter UI (adds 7th chip) and repository logic (handles NULL color)
   - Dark mode uses existing Tailwind CSS setup (add `dark:` variants to existing classes)
   - Avoids duplication and maintains single source of truth for filtering and styling

5. **Continue bottom-up build order**:
   - DB/repository → API (if needed) → UI with tests at each layer
   - For "no color": repository function enhancement → UI chip → tests
   - For dark mode: localStorage + Tailwind config → header toggle → global class application → tests

6. **Maintain accessibility baseline**:
   - "No color" chip must have `aria-label="Filter by uncolored cards"`, keyboard support (Tab/Enter/Space)
   - Dark mode toggle must have `aria-label="Toggle dark mode"`, `aria-pressed` for on/off state
   - Color chips in dark mode must maintain contrast ratios per WCAG AA

7. **Real SQLite in unit tests**:
   - Phase 7 REFLECTIONS line 69 emphasizes "Real SQLite in unit tests remains gold standard"
   - Phase 8 continues this pattern: all repository tests for "no color" filter use real database (no mocking)

8. **Review step is mandatory**:
   - Phase 7 REFLECTIONS line 148 confirms review caught critical flaky test before merge
   - Phase 8 must include review step with MUST-FIX.md → fix → verify workflow

9. **Documentation review before build**:
   - Phase 7 REFLECTIONS line 159 recommends checking for documentation duplication/conflicts
   - Phase 8 plan must review AGENTS.md "Search and Filter" section before adding "no color" documentation

10. **Vertical slice principle**:
    - "No color" filter is a complete user action: user clicks chip → uncolored cards appear → user finds card
    - Dark mode is a complete user action: user clicks toggle → theme switches → user sees dark UI
    - Both testable end-to-end with clear user-visible outcomes
