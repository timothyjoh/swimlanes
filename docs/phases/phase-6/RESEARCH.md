# Research: Phase 6

## Phase Context
Phase 6 adds archive functionality that allows users to soft-delete cards (hiding them without permanent deletion) and restore archived cards. This provides a safety net for accidental deletions. The phase moves permanent delete to the archive view only (safer workflow), adds an archive view page, shows an archive indicator badge on the board view, and excludes archived cards from search results.

## Previous Phase Learnings
Key points from Phase 5 REFLECTIONS.md that affect this phase:

- **PROJECT COMPLETE status** (line 68): Phase 5 declared project complete — all MVP features delivered. Phase 6 is a post-MVP enhancement based on recommended future features (line 96: "Card archiving: Soft-delete cards instead of permanent deletion").
- **Dual card fetching noted** (line 58): ColumnManager fetches all cards for match counting while CardManager fetches per-column. Phase 6 will not refactor this pattern to avoid scope creep — archive view will fetch archived cards separately.
- **Accessibility baseline established** (line 145): Phase 5 maintained strong accessibility (ARIA labels, focus indicators, live regions). Phase 6 must continue this pattern for archive view and badge.
- **Bottom-up build order proven** (line 148): DB migration → repository functions → API routes → UI components with tests at each layer. This pattern has worked flawlessly for 5 phases.
- **Vertical slice principle** (line 150): Every piece connects to user action. Archive/restore is complete user-visible feature: archive → card disappears → restore → card reappears.
- **Real SQLite in unit tests remains gold standard** (line 116): All repository tests use real database (no mocking). Phase 6 continues this pattern.

## Current Codebase State

### Relevant Components

**Database Layer:**
- **Cards table schema** — `db/migrations/003_create_cards.sql:1-14` — Currently has columns: `id`, `column_id`, `title`, `description`, `color`, `position`, `created_at`, `updated_at`. No `archived_at` column exists yet. Foreign key on `column_id` with `ON DELETE CASCADE`.
- **Cards repository** — `src/lib/db/cards.ts:1-197` — Exports `Card` interface (lines 4-13) and functions: `createCard()`, `listCardsByColumn()`, `searchCards()`, `getCardById()`, `updateCard()`, `deleteCard()`, `updateCardPosition()`, `updateCardColumn()`, `rebalanceCardPositions()`.
- **Connection/migration runner** — `src/lib/db/connection.ts:1-53` — `getDb()` function runs migrations from `db/migrations/` directory automatically. New migration for `archived_at` column will be auto-applied on startup.

**API Layer:**
- **Card CRUD endpoints** — `src/pages/api/cards/index.ts:1-86` — POST (create), GET (list by column)
- **Card update/delete endpoints** — `src/pages/api/cards/[id].ts:1-74` — PATCH (update), DELETE (permanent delete)
- **Position/column update endpoints** — `src/pages/api/cards/[id]/position.ts` and `src/pages/api/cards/[id]/column.ts` — Handle reordering and cross-column moves

**UI Components:**
- **CardManager** — `src/components/CardManager.tsx:1-528` — Renders cards within a column. Has create form (lines 507-524), edit mode (lines 401-466), delete button with confirmation (lines 476-482), drag-and-drop handlers (lines 192-311), keyboard shortcuts (lines 313-343), search filtering (lines 56-67). Delete button is visible in normal view (line 476-482) — Phase 6 will remove this and add Archive button instead.
- **ColumnManager** — `src/components/ColumnManager.tsx:1-546` — Manages columns for a board. Has search bar (lines 437-470), fetches all cards for match counting (lines 113-143), renders CardManager for each column (lines 532-538), handles cross-column card drops (lines 353-383).
- **Board detail page** — `src/pages/boards/[id].astro:1-32` — Server-side board lookup, passes `initialSearchQuery` from URL to ColumnManager, renders ColumnManager as React island with `client:load`.

### Existing Patterns to Follow

**Database patterns:**
- **Soft delete pattern**: No existing soft-delete pattern in codebase (all deletes are permanent `DELETE FROM` statements). Phase 6 introduces first soft-delete pattern with `archived_at` timestamp.
- **Timestamp columns**: All tables use `created_at` and `updated_at` with SQLite `datetime('now')` default — `src/lib/db/cards.ts:119` shows pattern: `fields.push("updated_at = datetime('now')")`.
- **Foreign key cascade**: All foreign keys use `ON DELETE CASCADE` — `db/migrations/003_create_cards.sql:10`.
- **NULL for optional fields**: Description and color are nullable in cards table — `db/migrations/003_create_cards.sql:5-6`.

**Repository patterns:**
- **Real SQLite in tests**: All tests use temporary databases — `src/lib/db/__tests__/cards.test.ts:20-36` shows pattern: create temp path, `getDb(tempDbPath)`, cleanup in `afterEach`.
- **Return undefined for not found**: `getCardById()` returns `Card | undefined` — `src/lib/db/cards.ts:83-87`.
- **Validation throws errors**: Title validation throws "Card title cannot be empty" — `src/lib/db/cards.ts:22`.
- **Position calculation**: Use `calculateInitialPosition()` for new items — `src/lib/db/cards.ts:32`.
- **Update returns updated entity**: All update functions return updated entity or undefined — `src/lib/db/cards.ts:89-128`.

**API endpoint patterns:**
- **Status codes**: 201 for create, 200 for success, 204 for delete, 404 for not found, 400 for validation errors — `src/pages/api/cards/index.ts:39`, `src/pages/api/cards/[id].ts:72`.
- **Error responses**: JSON with `{ error: "message" }` — `src/pages/api/cards/index.ts:9`.
- **Request validation**: Validate request body before calling repository — `src/pages/api/cards/index.ts:15-33`.
- **Try-catch for error handling**: Wrap repository calls in try-catch — `src/pages/api/cards/index.ts:35-53`.

**UI patterns:**
- **Loading states**: Boolean state + disabled buttons + "Loading..." text — `src/components/CardManager.tsx:44`, `src/components/CardManager.tsx:456`.
- **Error banners**: Red background with error message — `src/components/CardManager.tsx:365-369`.
- **Confirmation dialogs**: Use `confirm()` for destructive actions — `src/components/CardManager.tsx:170`.
- **Edit mode**: Boolean `editingId` state to track which item is being edited — `src/components/CardManager.tsx:45`.
- **Inline editing**: Click item to enter edit mode, blur/Enter to save, Escape to cancel — `src/components/CardManager.tsx:119-133`.
- **Keyboard shortcuts**: Handle in `onKeyDown`, check if editing mode is active first — `src/components/CardManager.tsx:313-343`.
- **Accessibility**: ARIA labels on interactive elements, live regions for announcements, focus indicators — `src/components/CardManager.tsx:394`, `src/components/CardManager.tsx:358-364`.

**Search patterns:**
- **Client-side filtering with useMemo**: CardManager filters cards based on `searchQuery` prop — `src/components/CardManager.tsx:56-67`.
- **Debounced search**: ColumnManager debounces search input by 300ms — `src/components/ColumnManager.tsx:76-82`.
- **URL persistence**: Search query syncs to URL with `history.replaceState()` — `src/components/ColumnManager.tsx:84-97`.
- **Match counting**: ColumnManager fetches all cards when search active to count matches — `src/components/ColumnManager.tsx:113-143`.
- **Empty state**: Show "No matching cards" when filtered list is empty — `src/components/CardManager.tsx:375-379`.

### Dependencies & Integration Points

**Cards depend on columns:**
- Foreign key `column_id` references `columns(id)` with `ON DELETE CASCADE` — `db/migrations/003_create_cards.sql:10`
- `createCard()` validates column exists — `src/lib/db/cards.ts:26-27`
- `updateCardColumn()` validates column exists — `src/lib/db/cards.ts:156-157`

**Search depends on cards:**
- `searchCards()` joins cards with columns to filter by board — `src/lib/db/cards.ts:58-80`
- ColumnManager fetches cards for match counting — `src/components/ColumnManager.tsx:113-131`
- CardManager filters cards client-side — `src/components/CardManager.tsx:56-67`

**Phase 6 integration points:**
- **Archive must exclude from search**: `searchCards()` and `listCardsByColumn()` must add `WHERE archived_at IS NULL` filter
- **Restore must handle deleted columns**: If original column was deleted, `restoreCard()` must fallback to first column in board (requires joining to `columns` table)
- **Archive view needs column names**: Join archived cards with columns to display original column name
- **Board view needs archive count**: Query count of archived cards for badge (new endpoint needed)

### Test Infrastructure

**Test framework:**
- **Vitest** for unit/integration/component tests — `vitest.config.ts:3-18`
- **Playwright** for E2E tests — `playwright.config.ts` (not read but referenced in AGENTS.md:186-188)
- **Coverage target**: 80%+ on `src/lib/` — `vitest.config.ts:9-16`

**Test patterns (from card tests):**
- **Unit tests**: Use real SQLite with temp database — `src/lib/db/__tests__/cards.test.ts:1-36`
- **Setup helpers**: `setupBoardAndColumn()` creates board and column for tests — `src/lib/db/__tests__/cards.test.ts:38-42`
- **Cleanup**: `closeDb()` and `unlinkSync()` in `afterEach` — `src/lib/db/__tests__/cards.test.ts:31-36`
- **Test descriptions**: Descriptive names like "creates and returns card with id, title, position, timestamps" — `src/lib/db/__tests__/cards.test.ts:45`

**Component test patterns:**
- **Happy DOM environment**: Use `// @vitest-environment happy-dom` comment — `src/components/__tests__/CardManager.test.tsx:1`
- **Mock fetch**: Use `vi.fn()` to mock global fetch — `src/components/__tests__/CardManager.test.tsx:8-9`
- **Testing Library**: Use `render()`, `screen`, `waitFor()`, `fireEvent` from `@testing-library/react` — `src/components/__tests__/CardManager.test.tsx:3`
- **User event simulation**: Import `@testing-library/user-event` for realistic interactions (referenced in Phase 5 REFLECTIONS.md:11)
- **Cleanup**: Call `cleanup()` in `afterEach` — `src/components/__tests__/CardManager.test.tsx:12-14`

**E2E test patterns:**
- **Before each setup**: Create fresh board and columns — `tests/cards.spec.ts:4-21`
- **Playwright selectors**: Use `getByRole()`, `getByPlaceholder()`, `getByLabel()`, `locator()` with filters — `tests/cards.spec.ts:8-20`
- **Wait for visibility**: Use `expect(element).toBeVisible()` after actions — `tests/cards.spec.ts:11`
- **Column selection**: Use `page.locator('div.w-72').filter({ hasText: 'Column Name' })` — `tests/cards.spec.ts:25`
- **Reload for persistence**: Reload page and verify data persists — `tests/cards.spec.ts:68-72`

**Current test coverage:**
- 214 unit/component tests passing (Phase 5 REFLECTIONS.md:17)
- 63/66 E2E tests passing (3 failures in position-rebalancing unrelated to Phase 6) (Phase 5 REFLECTIONS.md:17)
- Test files exist for boards, columns, cards, keyboard shortcuts, position rebalancing, search

## Code References

**Repository layer (where archive functions will live):**
- `src/lib/db/cards.ts:1-197` — Current card repository functions
- `src/lib/db/cards.ts:47-52` — `listCardsByColumn()` — needs `WHERE archived_at IS NULL` filter
- `src/lib/db/cards.ts:54-81` — `searchCards()` — needs `WHERE c.archived_at IS NULL` filter
- `src/lib/db/cards.ts:130-133` — `deleteCard()` — permanent delete logic (will be used in archive view only)

**API endpoints (where archive routes will be added):**
- `src/pages/api/cards/[id].ts:52-73` — DELETE endpoint — currently permanent delete, will move to archive view only
- Future routes needed: `src/pages/api/cards/[id]/archive.ts`, `src/pages/api/cards/[id]/restore.ts`

**UI components (where archive UI will be added):**
- `src/components/CardManager.tsx:476-482` — Delete button in normal view — will be replaced with Archive button
- `src/components/ColumnManager.tsx:437-470` — Search bar location — archive badge will go near here
- `src/pages/boards/[id].astro:1-32` — Board detail page — will add link to archive view here

**Migration location:**
- `db/migrations/` — Add `004_add_archived_at_to_cards.sql` for `archived_at` column

**Test locations:**
- `src/lib/db/__tests__/cards.test.ts` — Add archive function tests here
- `src/components/__tests__/CardManager.test.tsx` — Add archive button tests here
- `tests/` — Add archive E2E tests (new file or extend cards.spec.ts)

## Open Questions

None — Phase 6 spec is comprehensive and existing patterns provide clear implementation path. All acceptance criteria are testable, and architecture aligns with existing codebase conventions.
