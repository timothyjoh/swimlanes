# Phase 6: Card Archiving and Restoration

## Objective
Add archive functionality that allows users to hide cards without permanently deleting them, with the ability to restore archived cards. This provides a safety net for accidental deletions and helps users manage completed or deprecated work without cluttering active columns. This phase delivers a complete user-visible feature that enhances the existing card lifecycle.

## Scope

### In Scope
- **Archive card action** — new "Archive" button in card edit mode (replaces permanent delete)
- **Move Delete to archive view** — permanent delete only available from archive view (safer workflow)
- **Archive view page** — dedicated page listing all archived cards for the current board
- **Restore card action** — restore archived card back to its original column (or first column if original was deleted)
- **Archive indicator** — badge/icon in board view showing count of archived cards with link to archive view
- **Archive in database** — add `archived_at` column to `cards` table (NULL = active, timestamp = archived)
- **Archive filters search** — archived cards excluded from search results by default
- **Repository layer functions** — `archiveCard(id)`, `listArchivedCards(boardId)`, `restoreCard(id)`, `deleteCardPermanently(id)`
- **Full test coverage** — unit tests for archive logic, component tests for UI, E2E tests for archive → restore → delete flow
- Update AGENTS.md with archive architecture documentation
- Update README.md with archive feature instructions

### Out of Scope
- **Bulk archive operations** — archive multiple cards at once (defer to future enhancement)
- **Auto-archive by date** — automatically archive cards older than X days (defer to future enhancement)
- **Archive search** — search within archived cards only (defer to future enhancement)
- **Archive export** — export archived cards separately from active cards (defer to future enhancement)
- **Archive across boards** — global archive view across all boards (defer to future enhancement)
- Advanced filters (filter by color, date) — deferred from Phase 5
- Saved searches — deferred from Phase 5
- Search highlighting — deferred from Phase 5
- Bulk operations on active cards — defer to future enhancement
- Undo/redo — defer to future enhancement
- Dark mode — defer to future enhancement

## Requirements
- Archived cards must not appear in normal column views or search results
- Archiving must preserve all card data (title, description, color, position, column_id)
- Restoring must place card back in its original column if it still exists
- If original column was deleted, restore to first available column in board
- Permanent delete must only be accessible from archive view (safer workflow)
- Archive view must show card preview with original column name
- Archive operations must update `updated_at` timestamp
- All archive operations must have confirmation dialogs for permanent delete only
- All new code must maintain TypeScript strictness (no `any` types)
- All async operations show loading indicators
- All error paths handled with try-catch and user-visible error messages

## Acceptance Criteria
- [ ] User can archive a card from card edit mode (replaces delete button in active view)
- [ ] Archived card immediately disappears from column view
- [ ] Board view shows count of archived cards (e.g., "5 archived") if any exist
- [ ] User can click archive count/link to navigate to archive view page
- [ ] Archive view lists all archived cards for current board with card preview
- [ ] Archive view shows original column name for each archived card
- [ ] User can restore archived card from archive view
- [ ] Restored card reappears in its original column (or first column if original deleted)
- [ ] User can permanently delete archived card from archive view with confirmation
- [ ] Archived cards excluded from search results in normal board view
- [ ] Repository function `archiveCard(id)` sets `archived_at` timestamp
- [ ] Repository function `restoreCard(id)` clears `archived_at` timestamp
- [ ] Repository function `listArchivedCards(boardId)` returns only archived cards
- [ ] All tests pass (unit, integration, component, E2E)
- [ ] Code compiles without TypeScript errors or warnings
- [ ] Test coverage on archive functions is 80%+
- [ ] Documentation updated with archive functionality

## Testing Strategy
- **Framework**: Vitest for unit/integration/component tests, Playwright for E2E tests (continue from Phase 5)
- **Coverage**: Run `npm run test:coverage` to verify 80%+ on archive functions
- **Key test scenarios**:
  - **Repository layer tests** (10+ tests):
    - `archiveCard(id)` sets `archived_at` to current timestamp
    - `archiveCard(id)` returns false for non-existent card
    - `listArchivedCards(boardId)` returns only archived cards
    - `listArchivedCards(boardId)` excludes active cards
    - `listArchivedCards(boardId)` orders by `archived_at` DESC (most recent first)
    - `restoreCard(id)` clears `archived_at` (sets to NULL)
    - `restoreCard(id)` returns false for non-existent card
    - `restoreCard(id)` preserves original column_id
    - `restoreCard(id)` handles deleted column (moves to first column)
    - `deleteCardPermanently(id)` deletes archived card from database
    - `listCardsByColumn(columnId)` excludes archived cards
    - `searchCards(boardId, query)` excludes archived cards
  - **Component interaction tests** (10+ tests):
    - Archive button appears in card edit mode
    - Clicking archive button hides card from column
    - Archive count badge appears when archived cards exist
    - Archive count badge shows correct number
    - Clicking archive badge navigates to archive view
    - Archive view lists archived cards with previews
    - Restore button appears in archive view
    - Clicking restore button moves card back to column
    - Delete button in archive view shows confirmation
    - Confirming delete permanently removes card
  - **E2E tests** (12+ scenarios):
    - Create card, archive it, verify it disappears from board
    - Archive card, navigate to archive view, verify it appears
    - Archive multiple cards, verify count badge updates
    - Restore archived card, verify it reappears in original column
    - Archive card, delete original column, restore card, verify it goes to first column
    - Permanently delete archived card from archive view
    - Search does not return archived cards
    - Archive view shows correct column name for each card
    - Archive view empty state when no archived cards
    - Archive and restore preserve card color
    - Archive and restore preserve card description
    - Keyboard navigation works in archive view
- **Coverage expectation**: 80%+ on archive functions, 80%+ on component interaction code

## Documentation Updates
- **AGENTS.md**: Add "Card Archiving" section documenting:
  - Database schema: `archived_at` column on `cards` table
  - Repository functions: `archiveCard()`, `listArchivedCards()`, `restoreCard()`, `deleteCardPermanently()`
  - API routes: archive, restore, permanent delete endpoints
  - UI components: archive view page, archive badge in board view
  - Behavior: archived cards excluded from search and column views
- **CLAUDE.md**: No changes needed (AGENTS.md is sufficient)
- **README.md**: Add "Archived Cards" section to features list with:
  - How to archive a card (from edit mode)
  - How to view archived cards (click archive count badge)
  - How to restore an archived card (from archive view)
  - How to permanently delete (only from archive view)

Documentation is part of "done" — code without updated docs is incomplete.

## Dependencies
- Phase 5 complete (search functionality delivered)
- No new npm dependencies required (archive is database column + UI)
- Database migration required: add `archived_at` column to `cards` table

## Adjustments from Previous Phase

Based on Phase 5 REFLECTIONS.md lessons learned:

1. **PROJECT COMPLETE — Building Beyond MVP**:
   - REFLECTIONS.md line 68 declares "PROJECT COMPLETE" — all MVP features delivered
   - Phase 6 is a post-MVP enhancement based on recommended future features (line 96: "Card archiving: Soft-delete cards instead of permanent deletion")
   - This phase follows the same quality standards as MVP phases

2. **Address dual card fetching concern**:
   - REFLECTIONS.md line 58 notes inefficiency in match count fetching (ColumnManager fetches all cards, CardManager fetches per-column)
   - Phase 6 will NOT refactor this pattern to avoid scope creep
   - Archive view will fetch archived cards separately (simpler architecture for new feature)

3. **Maintain accessibility baseline**:
   - Phase 5 established strong accessibility baseline (ARIA labels, focus indicators, live regions)
   - Phase 6 archive view must have proper ARIA labels, archive badge must announce count changes

4. **Continue bottom-up build order**:
   - DB migration → repository functions → API routes → UI components with tests at each layer
   - This pattern has worked flawlessly for 5 phases

5. **Vertical slice principle**:
   - Archive/restore is a complete user-visible feature: user archives card → card disappears → user restores → card reappears
   - Testable end-to-end: "Can a user archive a card and restore it later?"
   - No infrastructure-only work — every piece connects to user action

6. **Safety-first delete workflow**:
   - Current phase moves permanent delete to archive view only (safer than delete-from-active-view)
   - This aligns with common UX patterns (Gmail, Slack, Trello) where archive is primary action, delete is secondary

7. **Real SQLite in unit tests**:
   - REFLECTIONS.md line 116 emphasizes "Real SQLite in unit tests remains gold standard"
   - Phase 6 continues this pattern: all repository tests use real database (no mocking)
