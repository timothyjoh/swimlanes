# Implementation Plan: Phase 6

## Overview
Add soft-delete card archiving with restore functionality and dedicated archive view page, replacing permanent delete in active card view with safer archive-first workflow.

## Current State (from Research)
- Cards table has no `archived_at` column — all deletes are permanent (`DELETE FROM` statements)
- Delete button exists in normal card view (`CardManager.tsx:476-482`)
- Repository has 9 functions: create, list, search, get, update, delete, position/column updates, rebalance
- Search uses `searchCards()` in repository layer with client-side filtering via `filteredCards` in CardManager
- All timestamps use SQLite `datetime('now')` pattern; nullable columns use NULL
- Tests use real SQLite with temp databases (no mocking); 214 unit/component tests passing
- Foreign keys use `ON DELETE CASCADE`; validation throws errors; updates return updated entity or undefined

## Desired End State
After Phase 6:
- Cards table has `archived_at TIMESTAMP NULL` column with index for filtering
- Archive workflow: user archives card from edit mode → card disappears from column → archive badge shows count → click to archive view → restore or permanent delete
- Repository exports 4 new functions: `archiveCard(id)`, `listArchivedCards(boardId)`, `restoreCard(id)`, `deleteCardPermanently(id)`
- API has 3 new endpoints: `POST /api/cards/[id]/archive`, `POST /api/cards/[id]/restore`, `DELETE /api/cards/[id]/permanent`
- Archive view page at `/boards/[id]/archive` shows archived cards with column names, restore button, permanent delete button
- Board view shows archive badge (e.g., "5 archived") near search bar when archived cards exist
- `listCardsByColumn()` and `searchCards()` filter out archived cards with `WHERE archived_at IS NULL`
- CardManager replaces delete button with archive button in normal view
- Tests cover archive lifecycle: archive → disappears → restore → reappears → permanent delete

**Verification**: Run `npm test` (all pass), create card → archive it → verify disappears → click archive badge → see in archive view → restore → verify reappears → archive again → permanent delete → verify removed.

## What We're NOT Doing
- Bulk archive operations (archive multiple cards at once)
- Auto-archive by date (automatically archive cards older than X days)
- Archive search (search within archived cards only)
- Archive export (export archived cards separately)
- Archive across boards (global archive view)
- Advanced filters (filter by color/date) — deferred from Phase 5
- Saved searches — deferred from Phase 5
- Search highlighting — deferred from Phase 5
- Refactoring dual card fetch pattern (ColumnManager + CardManager) — intentionally avoiding scope creep

## Implementation Approach
Bottom-up vertical slices following proven Phase 1-5 pattern:
1. **Database migration** → add `archived_at` column
2. **Repository functions** → 4 new functions with unit tests using real SQLite
3. **API endpoints** → 3 new routes with integration tests
4. **UI: Archive button** → replace delete in CardManager with archive
5. **UI: Archive view page** → new Astro page + React component for archived cards list
6. **UI: Archive badge** → count badge in ColumnManager with link to archive view
7. **Filter updates** → exclude archived from search/list functions
8. **E2E tests** → complete archive → restore → delete flow

Each slice delivers testable functionality. Tests written alongside implementation (not after).

---

## Task 1: Database Migration — Add archived_at Column

### Overview
Add nullable `archived_at` timestamp column to cards table with index for efficient filtering. This establishes the schema foundation for soft-delete pattern.

### Changes Required

**File**: `db/migrations/004_add_archived_at_to_cards.sql` (new file)
```sql
-- Add archived_at column for soft-delete functionality
ALTER TABLE cards ADD COLUMN archived_at TEXT DEFAULT NULL;

-- Index for filtering archived vs active cards
CREATE INDEX idx_cards_archived_at ON cards(archived_at);
```

**File**: `src/lib/db/cards.ts`
**Changes**: Update `Card` interface to include optional `archived_at` field:
```typescript
export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null; // NEW: NULL = active, timestamp = archived
}
```

### Success Criteria
- [ ] Migration file exists at `db/migrations/004_add_archived_at_to_cards.sql`
- [ ] Running `npm run dev` applies migration automatically (check with SQLite viewer or query)
- [ ] Card interface includes `archived_at: string | null` field
- [ ] TypeScript compiles without errors
- [ ] Existing unit tests pass (migration is additive, should not break existing code)

---

## Task 2: Repository — Archive and Restore Functions

### Overview
Implement 4 new repository functions for archive lifecycle: archive (set timestamp), list archived (query with filter), restore (clear timestamp), permanent delete. All functions follow existing patterns and use real SQLite in tests.

### Changes Required

**File**: `src/lib/db/cards.ts`
**Changes**: Add 4 new exported functions after existing `deleteCard()` function (around line 133):

```typescript
/**
 * Archive a card by setting archived_at timestamp
 * Returns updated card if successful, undefined if card not found
 */
export function archiveCard(id: number): Card | undefined {
  const db = getDb();

  const info = db
    .prepare("UPDATE cards SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND archived_at IS NULL")
    .run(id);

  if (info.changes === 0) return undefined;

  return db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined;
}

/**
 * List all archived cards for a board, ordered by most recently archived first
 * Includes column name via join for display in archive view
 */
export function listArchivedCards(boardId: number): Array<Card & { column_name: string }> {
  const db = getDb();

  return db
    .prepare(`
      SELECT c.*, col.name as column_name
      FROM cards c
      JOIN columns col ON c.column_id = col.id
      WHERE col.board_id = ? AND c.archived_at IS NOT NULL
      ORDER BY c.archived_at DESC
    `)
    .all(boardId) as Array<Card & { column_name: string }>;
}

/**
 * Restore an archived card back to active state
 * If original column was deleted, moves card to first available column in board
 * Returns updated card if successful, undefined if card not found or already active
 */
export function restoreCard(id: number): Card | undefined {
  const db = getDb();

  // Get archived card
  const card = db.prepare("SELECT * FROM cards WHERE id = ? AND archived_at IS NOT NULL").get(id) as Card | undefined;
  if (!card) return undefined;

  // Check if original column still exists
  const columnExists = db.prepare("SELECT id FROM columns WHERE id = ?").get(card.column_id);

  let targetColumnId = card.column_id;

  // If column was deleted, find first column in same board
  if (!columnExists) {
    const boardId = db.prepare("SELECT board_id FROM columns WHERE id IN (SELECT column_id FROM cards WHERE id = ?)").get(id) as { board_id: number } | undefined;
    if (!boardId) return undefined; // Orphaned card, shouldn't happen with CASCADE

    const firstColumn = db.prepare("SELECT id FROM columns WHERE board_id = ? ORDER BY position ASC LIMIT 1").get(boardId.board_id) as { id: number } | undefined;
    if (!firstColumn) return undefined; // Board has no columns

    targetColumnId = firstColumn.id;
  }

  // Restore card (clear archived_at, update column if needed)
  db.prepare("UPDATE cards SET archived_at = NULL, column_id = ?, updated_at = datetime('now') WHERE id = ?")
    .run(targetColumnId, id);

  return db.prepare("SELECT * FROM cards WHERE id = ?").get(id) as Card | undefined;
}

/**
 * Permanently delete a card from database (hard delete)
 * Should only be called from archive view on already-archived cards
 * Returns true if deleted, false if card not found
 */
export function deleteCardPermanently(id: number): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  return info.changes > 0;
}
```

**File**: `src/lib/db/cards.ts` (existing functions)
**Changes**: Update `listCardsByColumn()` to exclude archived cards (around line 47):
```typescript
export function listCardsByColumn(columnId: number): Card[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM cards WHERE column_id = ? AND archived_at IS NULL ORDER BY position ASC")
    .all(columnId) as Card[];
}
```

**Changes**: Update `searchCards()` to exclude archived cards (around line 58):
```typescript
export function searchCards(boardId: number, query: string): Card[] {
  const db = getDb();
  const searchPattern = `%${query}%`;

  return db
    .prepare(`
      SELECT c.*
      FROM cards c
      JOIN columns col ON c.column_id = col.id
      WHERE col.board_id = ?
        AND c.archived_at IS NULL
        AND (
          c.title LIKE ? COLLATE NOCASE
          OR c.description LIKE ? COLLATE NOCASE
          OR c.color LIKE ? COLLATE NOCASE
        )
      ORDER BY c.position ASC
    `)
    .all(boardId, searchPattern, searchPattern, searchPattern) as Card[];
}
```

**File**: `src/lib/db/__tests__/cards.test.ts` (new tests)
**Changes**: Add 12 new test cases at end of file:

```typescript
describe("archiveCard", () => {
  it("archives card by setting archived_at timestamp", () => {
    const { columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Test Card");

    const archived = archiveCard(card.id);

    expect(archived).toBeDefined();
    expect(archived!.id).toBe(card.id);
    expect(archived!.archived_at).not.toBeNull();
    expect(archived!.archived_at).toMatch(/^\d{4}-\d{2}-\d{2}/); // ISO date format
  });

  it("returns undefined for non-existent card", () => {
    const result = archiveCard(999999);
    expect(result).toBeUndefined();
  });

  it("returns undefined if card already archived", () => {
    const { columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Test Card");
    archiveCard(card.id);

    const secondArchive = archiveCard(card.id);
    expect(secondArchive).toBeUndefined();
  });
});

describe("listArchivedCards", () => {
  it("returns only archived cards for board", () => {
    const { boardId, columnId } = setupBoardAndColumn();
    const active = createCard(columnId, "Active Card");
    const archived = createCard(columnId, "Archived Card");
    archiveCard(archived.id);

    const result = listArchivedCards(boardId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(archived.id);
    expect(result[0].title).toBe("Archived Card");
  });

  it("includes column name via join", () => {
    const { boardId, columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Test Card");
    archiveCard(card.id);

    const result = listArchivedCards(boardId);

    expect(result[0].column_name).toBe("Test Column"); // from setupBoardAndColumn
  });

  it("orders by archived_at DESC (most recent first)", () => {
    const { boardId, columnId } = setupBoardAndColumn();
    const first = createCard(columnId, "First");
    const second = createCard(columnId, "Second");
    archiveCard(first.id);
    archiveCard(second.id);

    const result = listArchivedCards(boardId);

    expect(result[0].id).toBe(second.id); // second archived last, should be first
    expect(result[1].id).toBe(first.id);
  });

  it("excludes active cards", () => {
    const { boardId, columnId } = setupBoardAndColumn();
    createCard(columnId, "Active Card");

    const result = listArchivedCards(boardId);

    expect(result).toHaveLength(0);
  });
});

describe("restoreCard", () => {
  it("clears archived_at timestamp", () => {
    const { columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Test Card");
    archiveCard(card.id);

    const restored = restoreCard(card.id);

    expect(restored).toBeDefined();
    expect(restored!.archived_at).toBeNull();
  });

  it("preserves original column_id if column still exists", () => {
    const { columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Test Card");
    const originalColumnId = card.column_id;
    archiveCard(card.id);

    const restored = restoreCard(card.id);

    expect(restored!.column_id).toBe(originalColumnId);
  });

  it("moves to first column if original was deleted", () => {
    const { boardId, columnId } = setupBoardAndColumn();
    const secondColumn = createColumn(boardId, "Second Column");
    const card = createCard(columnId, "Test Card");
    archiveCard(card.id);
    deleteColumn(columnId); // Delete original column

    const restored = restoreCard(card.id);

    expect(restored).toBeDefined();
    expect(restored!.column_id).toBe(secondColumn.id); // Should move to remaining column
  });

  it("returns undefined for non-existent card", () => {
    const result = restoreCard(999999);
    expect(result).toBeUndefined();
  });

  it("returns undefined if card is not archived", () => {
    const { columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Active Card");

    const result = restoreCard(card.id);
    expect(result).toBeUndefined();
  });
});

describe("deleteCardPermanently", () => {
  it("permanently deletes card from database", () => {
    const { columnId } = setupBoardAndColumn();
    const card = createCard(columnId, "Test Card");
    archiveCard(card.id);

    const result = deleteCardPermanently(card.id);

    expect(result).toBe(true);
    expect(getCardById(card.id)).toBeUndefined();
  });

  it("returns false for non-existent card", () => {
    const result = deleteCardPermanently(999999);
    expect(result).toBe(false);
  });
});

describe("listCardsByColumn with archived cards", () => {
  it("excludes archived cards from results", () => {
    const { columnId } = setupBoardAndColumn();
    const active = createCard(columnId, "Active Card");
    const archived = createCard(columnId, "Archived Card");
    archiveCard(archived.id);

    const result = listCardsByColumn(columnId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(active.id);
  });
});

describe("searchCards with archived cards", () => {
  it("excludes archived cards from search results", () => {
    const { boardId, columnId } = setupBoardAndColumn();
    const active = createCard(columnId, "Search Term");
    const archived = createCard(columnId, "Search Term Archived");
    archiveCard(archived.id);

    const result = searchCards(boardId, "Search Term");

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(active.id);
  });
});
```

### Success Criteria
- [ ] TypeScript compiles without errors
- [ ] All 12 new unit tests pass
- [ ] All existing tests still pass (listCardsByColumn and searchCards updated correctly)
- [ ] Run `npm run test:coverage` — archive functions have 80%+ coverage
- [ ] Archive/restore/delete operations verified via manual SQLite inspection

---

## Task 3: API Endpoints — Archive, Restore, Permanent Delete

### Overview
Add 3 new API routes for archive operations following existing patterns: status codes (200/404/400), error handling with try-catch, JSON responses. Separate permanent delete from existing DELETE endpoint.

### Changes Required

**File**: `src/pages/api/cards/[id]/archive.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { archiveCard } from "../../../../lib/db/cards";

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || "");
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid card ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = archiveCard(id);
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found or already archived" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Archive card error:", error);
    return new Response(JSON.stringify({ error: "Failed to archive card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/cards/[id]/restore.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { restoreCard } from "../../../../lib/db/cards";

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || "");
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid card ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = restoreCard(id);
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found or not archived" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Restore card error:", error);
    return new Response(JSON.stringify({ error: "Failed to restore card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/cards/[id]/permanent.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { deleteCardPermanently } from "../../../../lib/db/cards";

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || "");
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: "Invalid card ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const success = deleteCardPermanently(id);
    if (!success) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Delete card permanently error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete card" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/cards/archived.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { listArchivedCards } from "../../../lib/db/cards";

export const GET: APIRoute = async ({ url }) => {
  try {
    const boardId = parseInt(url.searchParams.get("boardId") || "");
    if (isNaN(boardId)) {
      return new Response(JSON.stringify({ error: "Invalid board ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cards = listArchivedCards(boardId);
    return new Response(JSON.stringify(cards), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List archived cards error:", error);
    return new Response(JSON.stringify({ error: "Failed to list archived cards" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

### Success Criteria
- [ ] TypeScript compiles without errors
- [ ] `npm run dev` starts server successfully
- [ ] Manual test: `curl -X POST http://localhost:4321/api/cards/1/archive` returns 200 with card JSON
- [ ] Manual test: `curl -X POST http://localhost:4321/api/cards/1/restore` returns 200 with card JSON
- [ ] Manual test: `curl -X DELETE http://localhost:4321/api/cards/1/permanent` returns 204
- [ ] Manual test: `curl http://localhost:4321/api/cards/archived?boardId=1` returns 200 with array

---

## Task 4: UI — Replace Delete with Archive Button

### Overview
Replace the delete button in CardManager's normal view with an archive button. Archive action calls new API endpoint, removes card from UI optimistically, shows loading state. This makes archive the primary action and removes permanent delete from active view.

### Changes Required

**File**: `src/components/CardManager.tsx`
**Changes**: Update around lines 150-177 — replace `handleDelete` with `handleArchive`:

```typescript
// Replace handleDelete function
const handleArchive = async (id: number) => {
  if (archivingId) return;

  setArchivingId(id);
  setError(null);

  try {
    const res = await fetch(`/api/cards/${id}/archive`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to archive card");
    }

    // Optimistically remove from UI
    setCards((prev) => prev.filter((c) => c.id !== id));

    // If this was the editing card, clear edit mode
    if (editingId === id) {
      setEditingId(null);
      setEditForm({ title: "", description: "", color: "" });
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to archive card");
  } finally {
    setArchivingId(null);
  }
};
```

**Changes**: Update state variable name from `deletingId` to `archivingId` (around line 44):
```typescript
const [archivingId, setArchivingId] = useState<number | null>(null);
```

**Changes**: Replace delete button with archive button (around lines 476-482):
```typescript
<button
  onClick={() => handleArchive(card.id)}
  disabled={archivingId === card.id}
  className="ml-2 text-yellow-600 hover:text-yellow-800 text-xs disabled:opacity-50"
  aria-label={`Archive card ${card.title}`}
>
  {archivingId === card.id ? "..." : "Archive"}
</button>
```

**File**: `src/components/__tests__/CardManager.test.tsx`
**Changes**: Update delete tests to archive tests:

```typescript
describe("Card archiving", () => {
  it("archives card when archive button clicked", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<CardManager columnId={1} columnName="Test Column" searchQuery="" />);

    await waitFor(() => screen.getByText("Test Card"));

    const archiveButton = screen.getByRole("button", { name: /archive card test card/i });
    await user.click(archiveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/cards/1/archive", {
        method: "POST",
      });
    });
  });

  it("shows loading state during archive", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    render(<CardManager columnId={1} columnName="Test Column" searchQuery="" />);

    await waitFor(() => screen.getByText("Test Card"));

    const archiveButton = screen.getByRole("button", { name: /archive card test card/i });
    await user.click(archiveButton);

    await waitFor(() => {
      expect(archiveButton).toBeDisabled();
      expect(archiveButton).toHaveTextContent("...");
    });
  });

  it("removes card from UI after successful archive", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<CardManager columnId={1} columnName="Test Column" searchQuery="" />);

    await waitFor(() => screen.getByText("Test Card"));

    const archiveButton = screen.getByRole("button", { name: /archive card test card/i });
    await user.click(archiveButton);

    await waitFor(() => {
      expect(screen.queryByText("Test Card")).not.toBeInTheDocument();
    });
  });

  it("shows error if archive fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Archive failed" }),
      });

    render(<CardManager columnId={1} columnName="Test Column" searchQuery="" />);

    await waitFor(() => screen.getByText("Test Card"));

    const archiveButton = screen.getByRole("button", { name: /archive card test card/i });
    await user.click(archiveButton);

    await waitFor(() => {
      expect(screen.getByText(/archive failed/i)).toBeInTheDocument();
    });
  });
});
```

### Success Criteria
- [ ] TypeScript compiles without errors
- [ ] All 4 new component tests pass
- [ ] Manual test: Click archive button on card → card disappears from column
- [ ] Manual test: Archive button shows "..." during loading
- [ ] Manual test: Error banner appears if archive fails (test by stopping server)
- [ ] Accessibility: Archive button has proper `aria-label`

---

## Task 5: UI — Archive View Page

### Overview
Create new Astro page at `/boards/[id]/archive` with React component that lists archived cards, shows original column name, provides restore button, and provides permanent delete button with confirmation. Follows existing patterns for page structure and component architecture.

### Changes Required

**File**: `src/pages/boards/[id]/archive.astro` (new file)
```astro
---
import Layout from "../../../layouts/Layout.astro";
import { getDb } from "../../../lib/db/connection";

const { id } = Astro.params;
const boardId = parseInt(id || "");

if (isNaN(boardId)) {
  return Astro.redirect("/");
}

const db = getDb();
const board = db.prepare("SELECT * FROM boards WHERE id = ?").get(boardId);

if (!board) {
  return Astro.redirect("/");
}
---

<Layout title={`Archive - ${(board as any).name}`}>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="flex items-center gap-4 mb-6">
      <a
        href={`/boards/${boardId}`}
        class="text-blue-600 hover:text-blue-800 font-medium"
      >
        ← Back to Board
      </a>
      <h1 class="text-3xl font-bold text-gray-900">
        Archived Cards - {(board as any).name}
      </h1>
    </div>

    <div id="archive-root" data-board-id={boardId}></div>
  </div>

  <script>
    import { createRoot } from "react-dom/client";
    import { createElement } from "react";
    import ArchivedCardsManager from "../../../components/ArchivedCardsManager";

    const container = document.getElementById("archive-root");
    if (container) {
      const boardId = parseInt(container.dataset.boardId || "");
      const root = createRoot(container);
      root.render(createElement(ArchivedCardsManager, { boardId }));
    }
  </script>
</Layout>
```

**File**: `src/components/ArchivedCardsManager.tsx` (new file)
```typescript
import { useEffect, useState } from "react";

interface ArchivedCard {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  column_name: string;
}

interface Props {
  boardId: number;
}

export default function ArchivedCardsManager({ boardId }: Props) {
  const [cards, setCards] = useState<ArchivedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchArchivedCards = async () => {
    try {
      const res = await fetch(`/api/cards/archived?boardId=${boardId}`);
      if (!res.ok) throw new Error("Failed to load archived cards");
      const data = await res.json();
      setCards(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchivedCards();
  }, [boardId]);

  const handleRestore = async (id: number) => {
    if (restoringId) return;

    setRestoringId(id);
    setError(null);

    try {
      const res = await fetch(`/api/cards/${id}/restore`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to restore card");
      }

      // Remove from UI
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore card");
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (id: number, title: string) => {
    if (deletingId) return;

    const confirmed = confirm(
      `Permanently delete "${title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/cards/${id}/permanent`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete card");
      }

      // Remove from UI
      setCards((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete card");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading archived cards...</div>;
  }

  return (
    <div>
      {error && (
        <div
          className="mb-4 p-3 bg-red-100 text-red-800 rounded"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="text-gray-600 text-center py-8">
          No archived cards. Cards you archive will appear here.
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {cards.length} archived {cards.length === 1 ? "card" : "cards"}
          </div>
          {cards.map((card) => (
            <div
              key={card.id}
              className="border border-gray-300 rounded p-4 bg-white"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{card.title}</h3>
                    {card.color && (
                      <span
                        className="inline-block w-4 h-4 rounded"
                        style={{ backgroundColor: card.color }}
                        aria-label={`Color: ${card.color}`}
                      />
                    )}
                  </div>
                  {card.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {card.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    Originally in: <strong>{card.column_name}</strong>
                  </p>
                  <p className="text-xs text-gray-500">
                    Archived: {new Date(card.archived_at!).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestore(card.id)}
                    disabled={restoringId === card.id || deletingId === card.id}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                    aria-label={`Restore card ${card.title}`}
                  >
                    {restoringId === card.id ? "..." : "Restore"}
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(card.id, card.title)}
                    disabled={restoringId === card.id || deletingId === card.id}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm"
                    aria-label={`Permanently delete card ${card.title}`}
                  >
                    {deletingId === card.id ? "..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**File**: `src/components/__tests__/ArchivedCardsManager.test.tsx` (new file)
```typescript
// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArchivedCardsManager from "../ArchivedCardsManager";

const mockCard = {
  id: 1,
  column_id: 1,
  title: "Archived Card",
  description: "Test description",
  color: "#ff0000",
  position: 0,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  archived_at: "2024-01-02T00:00:00Z",
  column_name: "Test Column",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("confirm", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ArchivedCardsManager", () => {
  it("shows loading state initially", () => {
    global.fetch = vi.fn(() => new Promise(() => {}));

    render(<ArchivedCardsManager boardId={1} />);

    expect(screen.getByText(/loading archived cards/i)).toBeInTheDocument();
  });

  it("fetches and displays archived cards", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [mockCard],
    });

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Archived Card")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
      expect(screen.getByText(/originally in: test column/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no archived cards", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/no archived cards/i)).toBeInTheDocument();
    });
  });

  it("restores card when restore button clicked", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => screen.getByText("Archived Card"));

    const restoreButton = screen.getByRole("button", { name: /restore card archived card/i });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/cards/1/restore", {
        method: "POST",
      });
    });
  });

  it("removes card from UI after successful restore", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => screen.getByText("Archived Card"));

    const restoreButton = screen.getByRole("button", { name: /restore card archived card/i });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(screen.queryByText("Archived Card")).not.toBeInTheDocument();
    });
  });

  it("shows confirmation dialog before permanent delete", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [mockCard],
    });

    global.confirm = vi.fn().mockReturnValueOnce(false);

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => screen.getByText("Archived Card"));

    const deleteButton = screen.getByRole("button", { name: /permanently delete card archived card/i });
    await user.click(deleteButton);

    expect(global.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Permanently delete "Archived Card"')
    );
  });

  it("permanently deletes card when confirmed", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({ ok: true });

    global.confirm = vi.fn().mockReturnValueOnce(true);

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => screen.getByText("Archived Card"));

    const deleteButton = screen.getByRole("button", { name: /permanently delete card archived card/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/cards/1/permanent", {
        method: "DELETE",
      });
    });
  });

  it("shows error if restore fails", async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockCard],
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Restore failed" }),
      });

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => screen.getByText("Archived Card"));

    const restoreButton = screen.getByRole("button", { name: /restore card archived card/i });
    await user.click(restoreButton);

    await waitFor(() => {
      expect(screen.getByText(/restore failed/i)).toBeInTheDocument();
    });
  });

  it("displays color badge if card has color", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => [mockCard],
    });

    render(<ArchivedCardsManager boardId={1} />);

    await waitFor(() => {
      const colorBadge = screen.getByLabelText(/color: #ff0000/i);
      expect(colorBadge).toBeInTheDocument();
    });
  });
});
```

### Success Criteria
- [ ] TypeScript compiles without errors
- [ ] All 9 component tests pass
- [ ] Navigate to `/boards/1/archive` → see archived cards list
- [ ] Click restore → card disappears from archive view
- [ ] Navigate back to board → restored card appears in column
- [ ] Click delete on archived card → confirmation dialog appears
- [ ] Confirm delete → card permanently removed
- [ ] Empty state shows when no archived cards
- [ ] Accessibility: ARIA labels on buttons, live regions for status

---

## Task 6: UI — Archive Count Badge in Board View

### Overview
Add archive count badge to board view near search bar that shows count of archived cards and links to archive view. Badge only appears when archived cards exist. Follows existing accessibility patterns with ARIA live region.

### Changes Required

**File**: `src/components/ColumnManager.tsx`
**Changes**: Add state and fetch logic for archive count (after existing state declarations around line 50):

```typescript
const [archivedCount, setArchivedCount] = useState<number>(0);

// Fetch archived count
useEffect(() => {
  const fetchArchivedCount = async () => {
    try {
      const res = await fetch(`/api/cards/archived?boardId=${boardId}`);
      if (res.ok) {
        const cards = await res.json();
        setArchivedCount(cards.length);
      }
    } catch (err) {
      console.error("Failed to fetch archived count:", err);
    }
  };

  fetchArchivedCount();
}, [boardId]);
```

**Changes**: Add archive badge next to search bar (around line 460, after search bar div):

```typescript
{/* Search bar */}
<div className="mb-4">
  <div className="flex items-center gap-2 max-w-md">
    <div className="relative flex-1">
      {/* existing search input */}
    </div>
    {searchQuery && (
      <button
        onClick={handleClearSearch}
        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
        aria-label="Clear search"
      >
        Clear
      </button>
    )}
  </div>

  {/* Archive count badge */}
  {archivedCount > 0 && (
    <div className="mt-2">
      <a
        href={`/boards/${boardId}/archive`}
        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
        aria-label={`View ${archivedCount} archived ${archivedCount === 1 ? "card" : "cards"}`}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
        <span>{archivedCount} archived</span>
      </a>
      <div className="sr-only" role="status" aria-live="polite">
        {archivedCount} {archivedCount === 1 ? "card" : "cards"} archived
      </div>
    </div>
  )}

  {/* Existing match count */}
  {debouncedQuery && (
    <div className="mt-2 text-sm text-gray-600" role="status" aria-live="polite">
      {/* existing match count logic */}
    </div>
  )}
</div>
```

**File**: `src/components/__tests__/ColumnManager.test.tsx`
**Changes**: Add 3 new tests for archive badge:

```typescript
describe("Archive count badge", () => {
  it("shows archive badge when archived cards exist", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: "Column 1" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 1, title: "Archived 1" },
          { id: 2, title: "Archived 2" },
        ],
      });

    render(<ColumnManager boardId={1} initialSearchQuery="" />);

    await waitFor(() => {
      expect(screen.getByText("2 archived")).toBeInTheDocument();
    });
  });

  it("hides archive badge when no archived cards", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: "Column 1" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

    render(<ColumnManager boardId={1} initialSearchQuery="" />);

    await waitFor(() => {
      expect(screen.queryByText(/archived/i)).not.toBeInTheDocument();
    });
  });

  it("links to archive view page", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, name: "Column 1" }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, title: "Archived" }],
      });

    render(<ColumnManager boardId={1} initialSearchQuery="" />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /view 1 archived card/i });
      expect(link).toHaveAttribute("href", "/boards/1/archive");
    });
  });
});
```

### Success Criteria
- [ ] TypeScript compiles without errors
- [ ] All 3 new component tests pass
- [ ] Manual test: Archive a card → badge appears showing "1 archived"
- [ ] Manual test: Archive second card → badge updates to "2 archived"
- [ ] Manual test: Click badge → navigates to archive view page
- [ ] Manual test: Restore all archived cards → badge disappears
- [ ] Accessibility: Badge has proper ARIA label and live region announces count

---

## Task 7: E2E Tests — Archive Lifecycle

### Overview
Add comprehensive E2E tests covering complete archive workflows: archive → restore → permanent delete. Tests verify UI state changes, persistence after reload, error handling, and interaction with other features (search, drag-and-drop).

### Changes Required

**File**: `tests/archive.spec.ts` (new file)
```typescript
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");

  // Create test board
  await page.getByPlaceholder("New board name").fill("Archive Test Board");
  await page.getByRole("button", { name: "Add Board" }).click();
  await expect(page.getByText("Archive Test Board")).toBeVisible();
  await page.getByText("Archive Test Board").click();

  // Create test column
  await page.getByPlaceholder("New column name").fill("Test Column");
  await page.getByRole("button", { name: "Add Column" }).click();
  await expect(page.getByText("Test Column")).toBeVisible();
});

test("archives card and removes from board view", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create card
  await column.getByPlaceholder("New card title").fill("Card to Archive");
  await column.getByRole("button", { name: "Add Card" }).click();
  await expect(column.getByText("Card to Archive")).toBeVisible();

  // Archive card
  const archiveButton = column.getByRole("button", { name: /archive card card to archive/i });
  await archiveButton.click();

  // Card should disappear
  await expect(column.getByText("Card to Archive")).not.toBeVisible();
});

test("shows archive count badge after archiving", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create and archive card
  await column.getByPlaceholder("New card title").fill("Test Card");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card test card/i }).click();

  // Badge should appear
  await expect(page.getByText("1 archived")).toBeVisible();
});

test("navigates to archive view and lists archived cards", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create and archive card
  await column.getByPlaceholder("New card title").fill("Archived Card");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card archived card/i }).click();

  // Click archive badge
  await page.getByRole("link", { name: /view 1 archived card/i }).click();

  // Should see archived card in archive view
  await expect(page.getByText("Archived Card")).toBeVisible();
  await expect(page.getByText(/originally in: test column/i)).toBeVisible();
});

test("restores archived card back to column", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create and archive card
  await column.getByPlaceholder("New card title").fill("Restore Me");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card restore me/i }).click();

  // Go to archive view
  await page.getByRole("link", { name: /view 1 archived card/i }).click();

  // Restore card
  await page.getByRole("button", { name: /restore card restore me/i }).click();
  await expect(page.getByText("Restore Me")).not.toBeVisible();

  // Go back to board
  await page.getByRole("link", { name: /back to board/i }).click();

  // Card should reappear
  await expect(column.getByText("Restore Me")).toBeVisible();
});

test("permanently deletes archived card with confirmation", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create and archive card
  await column.getByPlaceholder("New card title").fill("Delete Forever");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card delete forever/i }).click();

  // Go to archive view
  await page.getByRole("link", { name: /view 1 archived card/i }).click();

  // Set up dialog handler
  page.on("dialog", (dialog) => {
    expect(dialog.message()).toContain('Permanently delete "Delete Forever"');
    dialog.accept();
  });

  // Delete permanently
  await page.getByRole("button", { name: /permanently delete card delete forever/i }).click();

  // Card should disappear from archive view
  await expect(page.getByText("Delete Forever")).not.toBeVisible();
  await expect(page.getByText(/no archived cards/i)).toBeVisible();
});

test("archive persists after page reload", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create and archive card
  await column.getByPlaceholder("New card title").fill("Persistent Archive");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card persistent archive/i }).click();

  // Reload page
  await page.reload();

  // Badge should still show
  await expect(page.getByText("1 archived")).toBeVisible();

  // Go to archive view
  await page.getByRole("link", { name: /view 1 archived card/i }).click();
  await expect(page.getByText("Persistent Archive")).toBeVisible();
});

test("archived cards excluded from search results", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create two cards
  await column.getByPlaceholder("New card title").fill("Active Searchable");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByPlaceholder("New card title").fill("Archived Searchable");
  await column.getByRole("button", { name: "Add Card" }).click();

  // Archive second card
  await column.getByRole("button", { name: /archive card archived searchable/i }).click();

  // Search for "Searchable"
  await page.getByPlaceholder("Search cards...").fill("Searchable");

  // Only active card should appear
  await expect(column.getByText("Active Searchable")).toBeVisible();
  await expect(column.getByText("Archived Searchable")).not.toBeVisible();
  await expect(page.getByText("1 match")).toBeVisible();
});

test("archive count updates when multiple cards archived", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create and archive first card
  await column.getByPlaceholder("New card title").fill("Card 1");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card card 1/i }).click();
  await expect(page.getByText("1 archived")).toBeVisible();

  // Create and archive second card
  await column.getByPlaceholder("New card title").fill("Card 2");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByRole("button", { name: /archive card card 2/i }).click();
  await expect(page.getByText("2 archived")).toBeVisible();
});

test("restores card to first column if original was deleted", async ({ page }) => {
  // Create second column
  await page.getByPlaceholder("New column name").fill("Second Column");
  await page.getByRole("button", { name: "Add Column" }).click();

  const firstColumn = page.locator('div.w-72').filter({ hasText: "Test Column" });
  const secondColumn = page.locator('div.w-72').filter({ hasText: "Second Column" });

  // Create card in second column
  await secondColumn.getByPlaceholder("New card title").fill("Orphaned Card");
  await secondColumn.getByRole("button", { name: "Add Card" }).click();

  // Archive card
  await secondColumn.getByRole("button", { name: /archive card orphaned card/i }).click();

  // Delete second column
  await secondColumn.getByRole("button", { name: /delete column second column/i }).click();

  // Go to archive view and restore
  await page.getByRole("link", { name: /view 1 archived card/i }).click();
  await page.getByRole("button", { name: /restore card orphaned card/i }).click();

  // Go back to board
  await page.getByRole("link", { name: /back to board/i }).click();

  // Card should appear in first column (only remaining column)
  await expect(firstColumn.getByText("Orphaned Card")).toBeVisible();
});

test("archive preserves card color and description", async ({ page }) => {
  const column = page.locator('div.w-72').filter({ hasText: "Test Column" });

  // Create card with color and description
  await column.getByPlaceholder("New card title").fill("Colorful Card");
  await column.getByRole("button", { name: "Add Card" }).click();

  // Click to edit
  await column.getByText("Colorful Card").click();
  await column.getByPlaceholder("Description (optional)").fill("Test description");
  await column.getByLabel("Color").selectOption("#ff0000");
  await column.getByRole("button", { name: "Save" }).click();

  // Archive card
  await column.getByRole("button", { name: /archive card colorful card/i }).click();

  // Go to archive view
  await page.getByRole("link", { name: /view 1 archived card/i }).click();

  // Verify color and description preserved
  await expect(page.getByText("Test description")).toBeVisible();
  await expect(page.locator('[aria-label="Color: #ff0000"]')).toBeVisible();

  // Restore
  await page.getByRole("button", { name: /restore card colorful card/i }).click();
  await page.getByRole("link", { name: /back to board/i }).click();

  // Click to edit and verify
  await column.getByText("Colorful Card").click();
  await expect(column.getByPlaceholder("Description (optional)")).toHaveValue("Test description");
});

test("archive view shows empty state when no archived cards", async ({ page }) => {
  // Navigate directly to archive view
  await page.goto("/boards/1/archive"); // Assumes board ID is 1

  await expect(page.getByText(/no archived cards/i)).toBeVisible();
});
```

### Success Criteria
- [ ] TypeScript compiles without errors
- [ ] All 12 E2E tests pass
- [ ] Tests run in under 60 seconds total
- [ ] All tests use proper Playwright selectors (getByRole, getByText, etc.)
- [ ] Manual verification: Run `npm run test:e2e` successfully

---

## Task 8: Documentation Updates

### Overview
Update AGENTS.md with archive architecture documentation and README.md with user-facing archive feature instructions. Documentation is part of "done" — code without updated docs is incomplete.

### Changes Required

**File**: `AGENTS.md`
**Changes**: Add new "Card Archiving" section after "Card Management" section (around line 150):

```markdown
## Card Archiving

### Database Schema
Cards table includes `archived_at` column (nullable timestamp):
- `NULL` = active card (visible in columns, included in search)
- Timestamp = archived card (hidden from columns, excluded from search, visible only in archive view)

Index: `idx_cards_archived_at` for efficient filtering.

### Repository Functions (`src/lib/db/cards.ts`)
- `archiveCard(id)` — Sets `archived_at` to current timestamp, returns updated card or undefined
- `listArchivedCards(boardId)` — Returns archived cards for board with column names, ordered by `archived_at DESC`
- `restoreCard(id)` — Clears `archived_at`, restores to original column (or first column if deleted)
- `deleteCardPermanently(id)` — Hard delete from database (only called from archive view)
- `listCardsByColumn(columnId)` — Filters out archived cards with `WHERE archived_at IS NULL`
- `searchCards(boardId, query)` — Filters out archived cards with `WHERE c.archived_at IS NULL`

### API Routes
- `POST /api/cards/[id]/archive` — Archive a card (returns 200 with card JSON, 404 if not found)
- `POST /api/cards/[id]/restore` — Restore archived card (returns 200 with card JSON, 404 if not found)
- `DELETE /api/cards/[id]/permanent` — Permanently delete archived card (returns 204, 404 if not found)
- `GET /api/cards/archived?boardId={id}` — List archived cards for board (returns 200 with array)

### UI Components
- **CardManager** (`src/components/CardManager.tsx`) — Archive button replaces delete in normal view
- **ColumnManager** (`src/components/ColumnManager.tsx`) — Archive count badge with link to archive view
- **ArchivedCardsManager** (`src/components/ArchivedCardsManager.tsx`) — Archive view component with restore/delete actions
- **Archive page** (`src/pages/boards/[id]/archive.astro`) — Dedicated page for archived cards

### Behavior
- Archived cards excluded from column views and search results by default
- Archive is soft-delete: all card data preserved (title, description, color, position, column_id)
- Restore places card back in original column if it still exists
- If original column was deleted, restore moves card to first available column in board
- Permanent delete only accessible from archive view (safer workflow)
- All archive operations update `updated_at` timestamp
- Permanent delete shows confirmation dialog

### Testing
- Unit tests: 12 tests for archive functions in `src/lib/db/__tests__/cards.test.ts`
- Component tests: 4 tests for CardManager archive button, 9 tests for ArchivedCardsManager, 3 tests for ColumnManager badge
- E2E tests: 12 scenarios in `tests/archive.spec.ts` covering full lifecycle
```

**File**: `README.md`
**Changes**: Add "Archived Cards" section to features list (after "Search and Filter" section):

```markdown
## Archived Cards

Archive cards to hide them from your board without permanently deleting them. Archived cards can be restored later or permanently deleted from the archive view.

### How to Use

**Archive a Card:**
1. Click on any card to open edit mode
2. Click the "Archive" button (yellow button on the right)
3. The card immediately disappears from your board

**View Archived Cards:**
- When you have archived cards, a badge appears near the search bar showing the count (e.g., "5 archived")
- Click the badge to navigate to the archive view page

**Restore an Archived Card:**
1. Navigate to the archive view page
2. Find the card you want to restore
3. Click the green "Restore" button
4. The card reappears in its original column (or the first column if the original was deleted)

**Permanently Delete an Archived Card:**
1. Navigate to the archive view page
2. Find the card you want to delete forever
3. Click the red "Delete" button
4. Confirm the deletion in the dialog
5. The card is permanently removed from the database

### Notes
- Archived cards are excluded from search results
- Archived cards preserve all data (title, description, color)
- You can only permanently delete cards from the archive view (safer workflow)
```

### Success Criteria
- [ ] AGENTS.md updated with complete archive architecture documentation
- [ ] README.md updated with user-facing archive instructions
- [ ] Documentation is clear, accurate, and matches implementation
- [ ] Code references (file paths, function names) are correct
- [ ] Manual verification: Read docs and follow instructions to test feature

---

## Testing Strategy

### Unit Tests (Repository Layer)
- **What to test**: Archive lifecycle (archive → restore → delete), filtering (archived excluded from list/search), edge cases (non-existent card, already archived, deleted column)
- **Key edge cases**:
  - Archive already-archived card → returns undefined
  - Restore non-archived card → returns undefined
  - Restore card with deleted column → moves to first column
  - List/search excludes archived cards
- **Mocking strategy**: NO MOCKING. All tests use real SQLite with temp database (Phase 1-5 gold standard).

### Component Tests (React Components)
- **What to test**: Archive button click → card disappears, archive badge visibility, archive view list/restore/delete actions, loading states, error handling
- **Key scenarios**:
  - Archive button shows loading ("...") during API call
  - Card removed from UI after successful archive
  - Archive badge appears when count > 0, hidden when count = 0
  - Archive view empty state
  - Restore button removes card from archive view
  - Delete shows confirmation dialog
- **Mocking strategy**: Mock fetch API only (not repository functions). Use `@testing-library/user-event` for realistic interactions.

### E2E Tests (Playwright)
- **What to test**: Complete user workflows across pages (archive → archive view → restore → board, permanent delete flow), persistence after reload, integration with search
- **Key scenarios**:
  - Archive card → verify disappears → reload → verify still gone
  - Archive → navigate to archive view → restore → navigate to board → verify reappears
  - Archive multiple cards → badge shows correct count
  - Archived cards excluded from search
  - Restore to first column when original deleted
  - Color and description preserved through archive/restore
- **Approach**: Real browser interactions, no mocking. Test full user journey.

### Coverage Expectation
- 80%+ on new archive functions (`archiveCard`, `listArchivedCards`, `restoreCard`, `deleteCardPermanently`)
- 80%+ on new component code (ArchivedCardsManager, CardManager archive logic, ColumnManager badge)
- All E2E scenarios passing

### Test Execution Order
1. Run unit tests first (fast feedback on repository logic)
2. Run component tests second (validate UI interactions)
3. Run E2E tests last (slow but comprehensive)

---

## Risk Assessment

### Potential Issues & Mitigations

**Risk**: Migration fails on existing databases with cards
- **Mitigation**: Migration uses `ALTER TABLE ADD COLUMN` with `DEFAULT NULL` (safe additive change). Test migration on copy of production database before deploying.

**Risk**: Archived cards leak into search results due to missed `WHERE archived_at IS NULL` filter
- **Mitigation**: Update both `listCardsByColumn()` and `searchCards()` in same task. Unit tests explicitly verify filtering. E2E test confirms search exclusion.

**Risk**: Restore to deleted column fails if column lookup logic is incorrect
- **Mitigation**: Unit test explicitly covers "restore to first column if original deleted" scenario. E2E test validates end-to-end behavior.

**Risk**: Archive count badge shows stale data after restore (doesn't refresh)
- **Mitigation**: Archive view removes card from UI on restore (optimistic update). Badge refreshes on navigation back to board (fresh fetch). If needed, add event-based refresh in future.

**Risk**: Permanent delete called on active card (not archived)
- **Mitigation**: Permanent delete button only exists in archive view. API endpoint has no restriction, but UI prevents misuse. Consider adding `WHERE archived_at IS NOT NULL` check in `deleteCardPermanently()` for extra safety.

**Risk**: Position rebalancing issues with archived cards
- **Mitigation**: Archived cards keep their position value but are filtered out of all queries. When restored, card returns to same position (may need rebalance if positions changed). Existing `rebalanceCardPositions()` already handles this.

**Risk**: Test coverage below 80% on archive functions
- **Mitigation**: Write tests alongside implementation (not after). Task 2 includes 12 unit tests covering all paths. Run coverage report after each task.

**Risk**: Performance degradation with large number of archived cards
- **Mitigation**: `idx_cards_archived_at` index ensures efficient filtering. `listArchivedCards()` uses index for `WHERE archived_at IS NOT NULL` query. For boards with 1000+ archived cards, consider pagination in future.
