# Phase 5: Search and Filter Cards

## Objective
Add global search and filtering capabilities to help users quickly find cards across all columns on a board. This phase delivers a user-visible feature that becomes essential as boards grow beyond a handful of cards, improving both productivity and user experience.

## Scope

### In Scope
- **Global search input** — search bar at board level that filters visible cards across all columns
- **Real-time filtering** — cards filter as user types (debounced for performance)
- **Multi-field search** — search matches against card title, description, and color label
- **Case-insensitive search** — "TODO" matches "todo", "Todo", etc.
- **Visual feedback** — show count of matching cards and highlight which columns have matches
- **Empty state messaging** — clear message when no cards match search query
- **Search state persistence** — search query persists in URL query param for shareable links
- **Keyboard shortcut** — `Ctrl+F` or `Cmd+F` to focus search input (override browser default)
- **Clear search button** — quick way to reset filter with keyboard support (`Escape` clears search)
- **Repository layer enhancement** — add `searchCards(boardId, query)` function for backend search
- **Full test coverage** — unit tests for search logic, component tests for UI interactions, E2E tests for full flow
- Update AGENTS.md with search functionality documentation
- Update README.md with search feature instructions and keyboard shortcuts

### Out of Scope
- **Advanced filters** (filter by color only, filter by date created, etc.) — defer to future enhancement
- **Saved searches** or search history — defer to future enhancement
- **Search across all boards** (global workspace search) — defer to future enhancement
- **Search highlighting** (yellow highlight on matched text) — defer to future enhancement
- **Regex or advanced query syntax** — simple substring matching only
- Export/import board functionality (future enhancement)
- Dark mode theme toggle (future enhancement)
- Card archiving/soft delete (future enhancement)
- Undo/redo functionality (future enhancement)
- Mobile touch drag improvements (noted in Phase 4 reflections but separate concern)

## Requirements
- Search must be fast (< 100ms perceived latency) even with 100+ cards
- Search input must debounce keystrokes (300ms delay before filtering)
- Search must be case-insensitive and trim whitespace
- Search query must persist in URL as `?q=search+term` for shareable links
- Empty search query shows all cards (no filter applied)
- Search must preserve all existing functionality (drag-and-drop, keyboard shortcuts, inline editing)
- Search must work with all existing card features (colors, descriptions, positions)
- All new code must maintain TypeScript strictness (no `any` types)
- All async operations show loading indicators
- All error paths handled with try-catch and user-visible error messages

## Acceptance Criteria
- [ ] User can type in search input to filter cards in real-time
- [ ] Search matches card title, description, and color label (case-insensitive)
- [ ] Search query persists in URL query param (`?q=...`)
- [ ] User can navigate to board with `?q=...` param and see filtered results
- [ ] User can press `Ctrl+F` (or `Cmd+F` on Mac) to focus search input
- [ ] User can press `Escape` in search input to clear search and show all cards
- [ ] Clear button appears in search input when query is non-empty
- [ ] Empty state message displays when no cards match search query
- [ ] Match count displays (e.g., "3 cards found") when search is active
- [ ] Columns with no matching cards remain visible but show "No matching cards" message
- [ ] Drag-and-drop, keyboard shortcuts, and inline editing continue to work on filtered cards
- [ ] Search input debounces keystrokes (300ms) to avoid excessive re-renders
- [ ] All tests pass (unit, integration, component, E2E)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on search functions is 80%+
- [ ] Documentation updated with search functionality and keyboard shortcuts

## Testing Strategy
- **Framework**: Vitest for unit/integration/component tests, Playwright for E2E tests (continue from Phase 4)
- **Coverage**: Run `npm run test:coverage` to verify 80%+ on search functions
- **Key test scenarios**:
  - **Repository layer tests** (8+ tests):
    - `searchCards(boardId, query)` returns matching cards across all columns
    - Search matches title (case-insensitive)
    - Search matches description (case-insensitive)
    - Search matches color label
    - Search trims whitespace from query
    - Empty query returns all cards
    - Search returns cards ordered by column position, then card position
    - Search handles special characters in query (quotes, wildcards, etc.)
  - **Component interaction tests** (12+ tests):
    - Typing in search input filters cards
    - Search input debounces keystrokes (mock timers)
    - Clear button appears when query is non-empty
    - Clicking clear button resets search
    - Pressing `Escape` in search input clears search
    - Empty state message appears when no matches
    - Match count updates correctly
    - Filtered cards support drag-and-drop
    - Filtered cards support inline editing
    - Keyboard shortcuts work on filtered cards
    - Search preserves focus after filter
  - **URL persistence tests** (5+ tests):
    - Search query updates URL query param
    - URL query param updates search input on page load
    - Changing URL manually triggers search
    - Empty query removes `?q=...` param from URL
    - Special characters in query are URL-encoded correctly
  - **E2E tests** (8+ scenarios):
    - Create board with 20+ cards, search filters correctly
    - Search with partial matches (substring)
    - Search with no matches shows empty state
    - Search persists when navigating back/forward in browser
    - Clear button resets search and shows all cards
    - Drag-and-drop works on filtered cards
    - `Ctrl+F` focuses search input
    - `Escape` clears search
- **Coverage expectation**: 80%+ on search functions, 80%+ on component interaction code

## Documentation Updates
- **AGENTS.md**: Add "Search and Filter" section documenting:
  - Search functionality (what fields are searched, case-insensitivity)
  - URL query param format (`?q=...`)
  - Keyboard shortcuts (`Ctrl+F` to focus, `Escape` to clear)
  - Repository function: `searchCards(boardId, query)`
  - Performance characteristics (debouncing, max card count tested)
- **CLAUDE.md**: No changes needed (AGENTS.md is sufficient)
- **README.md**: Add "Search and Filter" section to features list with:
  - How to use search (type in search bar, cards filter in real-time)
  - Keyboard shortcuts (`Ctrl+F` / `Cmd+F` to focus, `Escape` to clear)
  - Shareable search links (URL includes query param)

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 4 complete (position rebalancing and keyboard shortcuts delivered)
- No new npm dependencies required (search is client-side filtering with optional backend optimization)
- URL search params use native `URLSearchParams` API (no library needed)

## Adjustments from Previous Phase

Based on Phase 4 REFLECTIONS.md lessons learned:

1. **Write component interaction tests BEFORE E2E tests**:
   - Phase 4 REFLECTIONS line 67 recommends writing component tests first for faster feedback
   - Phase 5 will write component tests using `@testing-library/user-event` to test search input interactions (typing, clearing, keyboard shortcuts) before E2E scenarios
   - This catches bugs early in the feedback loop (unit → component → E2E)

2. **Consider React event propagation early**:
   - Phase 4 REFLECTIONS line 70 notes event bubbling caused Enter key bug in nested components
   - Phase 5 search input handlers must explicitly consider: will `Ctrl+F` or `Escape` events bubble? Do we need `stopPropagation()`?
   - Document keyboard event flow in code comments

3. **Continue bottom-up build order**:
   - DB → API → UI with tests at each layer has worked flawlessly for 4 phases
   - Phase 5 follows the same pattern: `searchCards()` in repository layer first (with unit tests), then optional API endpoint (if server-side search is needed), then UI component integration

4. **Maintain accessibility baseline**:
   - Phase 4 established strong accessibility baseline (ARIA labels, focus indicators, live regions)
   - Phase 5 search input must have `aria-label`, match count must have `aria-live="polite"`, empty state must be announced
   - Keyboard shortcuts must not break existing keyboard navigation

5. **Debouncing for performance**:
   - Searching 100+ cards on every keystroke could cause lag
   - Phase 5 debounces search input (300ms) to avoid excessive filtering/re-renders
   - E2E stress test with 50+ cards validates performance

6. **Vertical slice principle**:
   - Search/filter is a complete user-visible feature: user types → cards filter → user finds card
   - Testable end-to-end: "Can a user search for a card by title and find it?"
   - No infrastructure-only work — every piece connects to user action
