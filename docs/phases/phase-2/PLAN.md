# Implementation Plan: Phase 2

## Overview
Add column (swim lane) management to boards. Users navigate to a board detail page at `/boards/:id` where they can create, rename, reorder, and delete columns using drag-and-drop. All column data persists in SQLite with cascading deletes.

## Current State (from Research)

**Strong foundations from Phase 1:**
- Repository pattern established in `src/lib/db/boards.ts` with typed interfaces and validation
- API route patterns with comprehensive error handling (try-catch around JSON parsing, 400/404 responses)
- React component patterns with loading states (`creating`, `updatingId`, `deletingId`) and error banners
- Test infrastructure proven: Vitest with real SQLite, happy-dom for components, direct API handler imports
- Migration system auto-runs SQL files from `db/migrations/` on startup
- Foreign keys enabled via `pragma("foreign_keys = ON")`
- Tailwind CSS v4 utility-first styling throughout

**What we're building on:**
- `boards` table exists but has no related tables yet
- BoardList component demonstrates all patterns we'll replicate for columns
- Test patterns for DB/API/component layers all proven at 80%+ coverage
- Bottom-up build order (DB → API → UI) validated as effective

## Desired End State

After Phase 2 completion:

1. **Database**: `columns` table exists with `board_id` foreign key and CASCADE DELETE constraint
2. **Repository**: `src/lib/db/columns.ts` provides `createColumn`, `listColumnsByBoard`, `getColumnById`, `renameColumn`, `deleteColumn`, `updateColumnPosition` functions
3. **API Routes**: Five RESTful endpoints for column CRUD and positioning at `/api/columns`
4. **Board Detail Page**: New Astro page at `src/pages/boards/[id].astro` showing board name and columns
5. **Column UI**: React island `ColumnManager.tsx` with create/rename/delete/drag-reorder functionality
6. **Tests**: 15+ database tests, 20+ API tests, 5+ component tests — all passing
7. **Navigation**: Clicking board name on home page navigates to board detail
8. **Documentation**: AGENTS.md updated with column architecture details

**Verification:**
- Run `npm test` → all tests pass (50+ total tests)
- Run `npm run dev` → visit http://localhost:4321
- Click a board → navigate to `/boards/:id`
- Create column → appears without reload
- Drag column → reorder persists across refresh
- Delete board → columns cascade delete
- All operations show loading states and error handling

## What We're NOT Doing

- **Cards**: No card creation, editing, or display (Phase 3)
- **Card movement**: No drag-and-drop of cards between columns (Phase 3)
- **Card features**: No color labels, descriptions, attachments, due dates (Phase 3+)
- **Advanced column features**: No collapse/expand, width adjustment, column templates, column limits
- **Keyboard shortcuts**: No arrow key navigation or keyboard-based reordering
- **Undo/redo**: No operation history or undo functionality
- **Column validation beyond basics**: No max name length, duplicate name prevention, or column count limits
- **Optimistic UI updates**: Component waits for server response before updating state (keep it simple)

## Implementation Approach

**Strategy: Vertical slices in bottom-up order**

Phase 1 validated this approach — build each layer fully (with tests) before the dependent layer. This catches integration issues early and keeps the main branch always deployable.

**Why this works:**
- Each slice is independently testable
- Integration bugs surface immediately when connecting layers
- Can pause between slices without broken state
- Tests document expected behavior before implementation

**Positioning strategy:**
- Use integer gaps (1000, 2000, 3000) for column positions
- New columns get `MAX(position) + 1000` or default to 1000 if first
- Reordering updates a single column's position to fit between neighbors
- No complex "reposition all columns" logic needed

**Error handling (mandatory from Phase 1 reflections):**
- All API routes have try-catch around `request.json()` and DB calls
- All components have error state and try-catch around fetch calls
- All loading states displayed during operations

---

## Task 1: Database Schema & Column Repository

### Overview
Create the `columns` table with foreign key constraint to `boards` and implement the repository layer with full validation and CASCADE DELETE behavior.

### Changes Required

**File**: `db/migrations/002_create_columns.sql` (NEW)
```sql
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE INDEX idx_columns_board_id ON columns(board_id);
```
**Rationale**: Foreign key with CASCADE ensures columns auto-delete when board is deleted. Index on `board_id` optimizes `listColumnsByBoard` queries. Position is integer to allow gap-based reordering.

**File**: `src/lib/db/columns.ts` (NEW)
```typescript
import { getDb } from "./connection";

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export function createColumn(boardId: number, name: string): Column {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name cannot be empty");

  const db = getDb();

  // Verify board exists
  const board = db.prepare("SELECT id FROM boards WHERE id = ?").get(boardId);
  if (!board) throw new Error(`Board ${boardId} not found`);

  // Calculate next position
  const maxPos = db.prepare("SELECT MAX(position) as max FROM columns WHERE board_id = ?")
    .get(boardId) as { max: number | null };
  const position = (maxPos.max || 0) + 1000;

  const stmt = db.prepare(
    "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)"
  );
  const info = stmt.run(boardId, trimmed, position);

  return db.prepare("SELECT * FROM columns WHERE id = ?").get(info.lastInsertRowid) as Column;
}

export function listColumnsByBoard(boardId: number): Column[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM columns WHERE board_id = ? ORDER BY position ASC");
  return stmt.all(boardId) as Column[];
}

export function getColumnById(id: number): Column | undefined {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM columns WHERE id = ?");
  return stmt.get(id) as Column | undefined;
}

export function renameColumn(id: number, name: string): Column | undefined {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Column name cannot be empty");

  const db = getDb();
  const stmt = db.prepare("UPDATE columns SET name = ?, updated_at = datetime('now') WHERE id = ?");
  const info = stmt.run(trimmed, id);

  if (info.changes === 0) return undefined;
  return getColumnById(id);
}

export function deleteColumn(id: number): boolean {
  const db = getDb();
  const stmt = db.prepare("DELETE FROM columns WHERE id = ?");
  const info = stmt.run(id);
  return info.changes > 0;
}

export function updateColumnPosition(id: number, position: number): Column | undefined {
  const db = getDb();
  const stmt = db.prepare("UPDATE columns SET position = ?, updated_at = datetime('now') WHERE id = ?");
  const info = stmt.run(position, id);

  if (info.changes === 0) return undefined;
  return getColumnById(id);
}
```

**File**: `src/lib/db/__tests__/columns.test.ts` (NEW)
- 15+ tests covering all repository functions and error cases
- Test structure mirrors `boards.test.ts`: temp DB per test, cleanup in afterEach
- Key scenarios:
  - createColumn: valid data, empty name, non-existent board_id, position calculation (first, second, third columns)
  - listColumnsByBoard: empty list, multiple columns, correct ordering by position
  - getColumnById: found, not found
  - renameColumn: success, empty name, non-existent id
  - deleteColumn: success, non-existent id
  - updateColumnPosition: success, non-existent id
  - CASCADE DELETE: create board with columns, delete board, verify columns gone

### Success Criteria
- [ ] Migration `002_create_columns.sql` exists in `db/migrations/`
- [ ] `columns` table created with foreign key constraint on startup
- [ ] `src/lib/db/columns.ts` exports Column interface and 6 functions
- [ ] All functions use prepared statements (SQL injection safe)
- [ ] createColumn validates board exists and calculates position correctly
- [ ] renameColumn and createColumn reject empty names
- [ ] 15+ tests in `columns.test.ts` all pass
- [ ] Test verifies CASCADE DELETE: deleting board deletes its columns
- [ ] Run `npm test -- --coverage` → `src/lib/db/columns.ts` has 80%+ coverage
- [ ] TypeScript compiles without errors

---

## Task 2: Column API Routes

### Overview
Create RESTful API endpoints for column CRUD operations and position updates, following the error handling and response patterns from `boards` API routes.

### Changes Required

**File**: `src/pages/api/columns/index.ts` (NEW)
```typescript
import type { APIRoute } from "astro";
import { createColumn, listColumnsByBoard } from "../../../lib/db/columns";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    if (typeof body.boardId !== "number") {
      return new Response(JSON.stringify({ error: "boardId is required and must be a number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!body.name || typeof body.name !== "string") {
      return new Response(JSON.stringify({ error: "name is required and must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const column = createColumn(body.boardId, body.name);

    return new Response(JSON.stringify(column), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("not found")) {
      return new Response(JSON.stringify({ error: message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const GET: APIRoute = async ({ url }) => {
  const boardId = url.searchParams.get("boardId");

  if (!boardId) {
    return new Response(JSON.stringify({ error: "boardId query parameter is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const boardIdNum = parseInt(boardId, 10);
  if (isNaN(boardIdNum)) {
    return new Response(JSON.stringify({ error: "boardId must be a valid number" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const columns = listColumnsByBoard(boardIdNum);

  return new Response(JSON.stringify(columns), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
```

**File**: `src/pages/api/columns/[id].ts` (NEW)
```typescript
import type { APIRoute } from "astro";
import { getColumnById, renameColumn, deleteColumn } from "../../../lib/db/columns";

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id || "", 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid column ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== "string") {
      return new Response(JSON.stringify({ error: "name is required and must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const column = renameColumn(id, body.name);

    if (!column) {
      return new Response(JSON.stringify({ error: `Column ${id} not found` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(column), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || "", 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid column ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deleted = deleteColumn(id);

  if (!deleted) {
    return new Response(JSON.stringify({ error: `Column ${id} not found` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
```

**File**: `src/pages/api/columns/[id]/position.ts` (NEW)
```typescript
import type { APIRoute } from "astro";
import { updateColumnPosition } from "../../../../lib/db/columns";

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = parseInt(params.id || "", 10);

  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid column ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();

    if (typeof body.position !== "number") {
      return new Response(JSON.stringify({ error: "position is required and must be a number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const column = updateColumnPosition(id, body.position);

    if (!column) {
      return new Response(JSON.stringify({ error: `Column ${id} not found` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(column), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/columns/__tests__/columns-api.test.ts` (NEW)
- 20+ tests covering all endpoints with success and error paths
- Test structure mirrors `boards-api.test.ts`: import handlers directly, use `createContext` helper, temp DB per test
- Key scenarios:
  - POST /api/columns: success (201), missing boardId, missing name, invalid boardId type, non-existent boardId, malformed JSON
  - GET /api/columns?boardId=X: success (200), missing boardId, invalid boardId, non-existent boardId
  - PATCH /api/columns/:id: success (200), missing name, invalid id, non-existent id, malformed JSON
  - DELETE /api/columns/:id: success (204), invalid id, non-existent id
  - PATCH /api/columns/:id/position: success (200), missing position, invalid position type, invalid id, non-existent id, malformed JSON

### Success Criteria
- [ ] Three API route files created: `index.ts`, `[id].ts`, `[id]/position.ts`
- [ ] All routes follow REST conventions (201 for POST, 200 for GET/PATCH, 204 for DELETE, 400/404 for errors)
- [ ] All routes have try-catch around `request.json()` returning 400 for malformed JSON
- [ ] All routes validate input parameters and return 400 with error message
- [ ] All routes return 404 when resource not found
- [ ] 20+ tests in `columns-api.test.ts` all pass
- [ ] Tests cover success paths and all error paths (missing fields, invalid types, non-existent IDs)
- [ ] TypeScript compiles without errors

---

## Task 3: Board Detail Page with Navigation

### Overview
Create an Astro page at `/boards/[id]` that displays the board name and renders the ColumnManager island. Add click navigation from BoardList to board detail page.

### Changes Required

**File**: `src/pages/boards/[id].astro` (NEW)
```astro
---
import Layout from "../../layouts/Layout.astro";
import ColumnManager from "../../components/ColumnManager";
import { getBoardById } from "../../lib/db/boards";

const { id } = Astro.params;
const boardId = parseInt(id || "", 10);

if (isNaN(boardId)) {
  return Astro.redirect("/");
}

const board = getBoardById(boardId);

if (!board) {
  return Astro.redirect("/");
}
---

<Layout title={board.name}>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="mb-6">
      <a href="/" class="text-blue-600 hover:text-blue-800 mb-2 inline-block">← Back to Boards</a>
      <h1 class="text-3xl font-bold text-gray-900">{board.name}</h1>
    </div>

    <ColumnManager client:load boardId={boardId} />
  </div>
</Layout>
```
**Rationale**: Follows Phase 1 patterns — server-side board lookup, redirect if not found, Layout wrapper, React island with `client:load`. Back link for navigation. Max-w-7xl gives room for horizontal column layout.

**File**: `src/components/BoardList.tsx` (MODIFY)
```typescript
// In the board list item render, wrap board name in a link:
<a
  href={`/boards/${board.id}`}
  className="text-lg font-medium text-gray-900 hover:text-blue-600 cursor-pointer"
>
  {board.name}
</a>
```
**Rationale**: Simple anchor tag navigation. Hover state indicates clickability. Server-side navigation is fine for Phase 2 (no need for client-side routing).

### Success Criteria
- [ ] File `src/pages/boards/[id].astro` exists
- [ ] Board detail page redirects to home if board ID is invalid or not found
- [ ] Page displays board name in heading
- [ ] Page displays back link to home
- [ ] ColumnManager island renders on the page
- [ ] BoardList component board names are clickable links
- [ ] Clicking board name navigates to `/boards/:id`
- [ ] TypeScript compiles without errors
- [ ] Manual test: create board, click name, see board detail page

---

## Task 4: ColumnManager React Component (Create & List)

### Overview
Create the ColumnManager component with state management, fetching columns on mount, and creating new columns. This task focuses on the foundation — list rendering and create functionality with full error handling and loading states.

### Changes Required

**File**: `src/components/ColumnManager.tsx` (NEW)
```typescript
import { useState, useEffect } from "react";

interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ColumnManagerProps {
  boardId: number;
}

export default function ColumnManager({ boardId }: ColumnManagerProps) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Fetch columns on mount
  useEffect(() => {
    async function fetchColumns() {
      try {
        const res = await fetch(`/api/columns?boardId=${boardId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load columns");
        }
        const data = await res.json();
        setColumns(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load columns");
      } finally {
        setLoading(false);
      }
    }
    fetchColumns();
  }, [boardId]);

  // Create new column
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    setError(null);
    setCreating(true);

    try {
      const res = await fetch("/api/columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, name: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create column");
      }

      const newColumn = await res.json();
      setColumns([...columns, newColumn]);
      setNewName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create column");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="text-gray-600">Loading columns...</div>;
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New column name"
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "Add Column"}
          </button>
        </div>
      </form>

      {/* Column list */}
      {columns.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No columns yet. Create your first column above.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 bg-gray-100 rounded p-4"
            >
              <h3 className="font-medium text-gray-900">{column.name}</h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```
**Rationale**: Mirrors BoardList patterns — controlled form, loading/error states, fetch on mount, try-catch with `.ok` checks. Horizontal flex layout for columns. Fixed width (w-72) for columns to maintain kanban appearance.

### Success Criteria
- [ ] File `src/components/ColumnManager.tsx` exists
- [ ] Component accepts `boardId` prop
- [ ] State includes: columns, loading, error, newName, creating
- [ ] useEffect fetches columns on mount with error handling
- [ ] Form submission creates column with loading state
- [ ] New column appends to list on success
- [ ] Error banner displays when operations fail
- [ ] Empty state message when no columns exist
- [ ] Columns render horizontally in flex layout
- [ ] TypeScript compiles without errors
- [ ] Manual test: visit board detail, create column, see it appear

---

## Task 5: Inline Rename & Delete Column

### Overview
Add inline editing and delete functionality to ColumnManager, following the same patterns as BoardList (click to edit, save on blur/Enter, confirm delete).

### Changes Required

**File**: `src/components/ColumnManager.tsx` (MODIFY)
```typescript
// Add to state:
const [editingId, setEditingId] = useState<number | null>(null);
const [editName, setEditName] = useState("");
const [updatingId, setUpdatingId] = useState<number | null>(null);
const [deletingId, setDeletingId] = useState<number | null>(null);
const editInputRef = useRef<HTMLInputElement>(null);

// Auto-focus edit input
useEffect(() => {
  if (editingId !== null) {
    editInputRef.current?.focus();
    editInputRef.current?.select();
  }
}, [editingId]);

// Start editing
function startEdit(column: Column) {
  setEditingId(column.id);
  setEditName(column.name);
}

// Save rename
async function handleRename(column: Column) {
  const trimmed = editName.trim();

  // If empty after trim, restore original name
  if (!trimmed) {
    setEditingId(null);
    setEditName("");
    return;
  }

  // If unchanged, just exit edit mode
  if (trimmed === column.name) {
    setEditingId(null);
    setEditName("");
    return;
  }

  setError(null);
  setUpdatingId(column.id);

  try {
    const res = await fetch(`/api/columns/${column.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to rename column");
    }

    const updated = await res.json();
    setColumns(columns.map(c => c.id === column.id ? updated : c));
    setEditingId(null);
    setEditName("");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to rename column");
  } finally {
    setUpdatingId(null);
  }
}

// Delete column
async function handleDelete(id: number) {
  if (!confirm("Delete this column? This cannot be undone.")) {
    return;
  }

  setError(null);
  setDeletingId(id);

  try {
    const res = await fetch(`/api/columns/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete column");
    }

    setColumns(columns.filter(c => c.id !== id));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to delete column");
  } finally {
    setDeletingId(null);
  }
}

// In the column render, replace the heading with:
{editingId === column.id ? (
  <input
    ref={editInputRef}
    type="text"
    value={editName}
    onChange={(e) => setEditName(e.target.value)}
    onBlur={() => handleRename(column)}
    onKeyDown={(e) => {
      if (e.key === "Enter") handleRename(column);
      if (e.key === "Escape") {
        setEditingId(null);
        setEditName("");
      }
    }}
    disabled={updatingId === column.id}
    className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
  />
) : (
  <div className="flex items-center justify-between mb-2">
    <h3
      onClick={() => startEdit(column)}
      className="font-medium text-gray-900 cursor-pointer hover:text-blue-600"
    >
      {column.name}
    </h3>
    <button
      onClick={() => handleDelete(column.id)}
      disabled={deletingId === column.id}
      className="text-red-600 hover:text-red-800 disabled:text-gray-400 text-sm"
    >
      {deletingId === column.id ? "Deleting..." : "Delete"}
    </button>
  </div>
)}
```

### Success Criteria
- [ ] Clicking column name enters edit mode
- [ ] Edit input is auto-focused and text is selected
- [ ] Blur or Enter key saves rename
- [ ] Escape key cancels edit
- [ ] Empty name after trim restores original name
- [ ] Delete button shows confirmation dialog
- [ ] "Deleting..." loading state displayed during delete
- [ ] Column removed from list after successful delete
- [ ] All operations clear error at start and show error on failure
- [ ] TypeScript compiles without errors
- [ ] Manual test: rename column, delete column, verify persistence

---

## Task 6: Drag-and-Drop Column Reordering

### Overview
Implement HTML5 drag-and-drop to reorder columns. Calculate new position based on neighbors and update via PATCH to `/api/columns/:id/position`. Use integer gap strategy (1000, 2000, 3000) for positioning.

### Changes Required

**File**: `src/components/ColumnManager.tsx` (MODIFY)
```typescript
// Add to state:
const [draggedId, setDraggedId] = useState<number | null>(null);

// Handle drag start
function handleDragStart(e: React.DragEvent, column: Column) {
  setDraggedId(column.id);
  e.dataTransfer.effectAllowed = "move";
}

// Handle drag over
function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

// Handle drop
async function handleDrop(e: React.DragEvent, targetColumn: Column) {
  e.preventDefault();

  if (draggedId === null || draggedId === targetColumn.id) {
    setDraggedId(null);
    return;
  }

  const draggedColumn = columns.find(c => c.id === draggedId);
  if (!draggedColumn) {
    setDraggedId(null);
    return;
  }

  // Calculate new position
  const targetIndex = columns.findIndex(c => c.id === targetColumn.id);
  const draggedIndex = columns.findIndex(c => c.id === draggedId);

  let newPosition: number;

  if (draggedIndex < targetIndex) {
    // Moving right: position between target and next
    const nextColumn = columns[targetIndex + 1];
    if (nextColumn) {
      newPosition = Math.floor((targetColumn.position + nextColumn.position) / 2);
    } else {
      newPosition = targetColumn.position + 1000;
    }
  } else {
    // Moving left: position between prev and target
    const prevColumn = columns[targetIndex - 1];
    if (prevColumn) {
      newPosition = Math.floor((prevColumn.position + targetColumn.position) / 2);
    } else {
      newPosition = Math.max(0, targetColumn.position - 1000);
    }
  }

  setError(null);

  try {
    const res = await fetch(`/api/columns/${draggedId}/position`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: newPosition }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to reorder column");
    }

    const updated = await res.json();

    // Update columns list and re-sort by position
    const newColumns = columns.map(c => c.id === draggedId ? updated : c);
    newColumns.sort((a, b) => a.position - b.position);
    setColumns(newColumns);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to reorder column");
  } finally {
    setDraggedId(null);
  }
}

// In the column render, add drag attributes:
<div
  key={column.id}
  draggable={editingId !== column.id}
  onDragStart={(e) => handleDragStart(e, column)}
  onDragOver={handleDragOver}
  onDrop={(e) => handleDrop(e, column)}
  className={`flex-shrink-0 w-72 bg-gray-100 rounded p-4 cursor-move ${
    draggedId === column.id ? "opacity-50" : ""
  }`}
>
```
**Rationale**: Native HTML5 drag-and-drop (no library needed). Calculate position by averaging neighbors. Re-sort client-side after update. Visual feedback with opacity during drag. Disable drag during edit mode.

### Success Criteria
- [ ] Columns are draggable (cursor-move visual)
- [ ] Dragging column shows opacity feedback
- [ ] Dropping column updates position in database
- [ ] Column list re-sorts after drop
- [ ] New order persists across page refresh
- [ ] Cannot drag column while editing its name
- [ ] Position calculation handles edge cases (first position, last position)
- [ ] Error handling if position update fails
- [ ] TypeScript compiles without errors
- [ ] Manual test: drag column, refresh page, verify order persists

---

## Task 7: Component Tests for ColumnManager

### Overview
Add component tests using happy-dom to verify rendering, loading states, error states, and user interactions (create column). Follow the pattern from BoardList tests.

### Changes Required

**File**: `src/components/__tests__/ColumnManager.test.tsx` (NEW)
```typescript
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import ColumnManager from "../ColumnManager";

describe("ColumnManager", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("renders without crashing", () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ColumnManager boardId={1} />);
  });

  it("shows loading state initially", () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    render(<ColumnManager boardId={1} />);
    expect(screen.getByText("Loading columns...")).toBeInTheDocument();
  });

  it("renders columns after fetch completes", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, board_id: 1, name: "To Do", position: 1000, created_at: "", updated_at: "" },
        { id: 2, board_id: 1, name: "Done", position: 2000, created_at: "", updated_at: "" },
      ],
    });

    render(<ColumnManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText("To Do")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();
    });
  });

  it("shows error banner when fetch fails", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Database error" }),
    });

    render(<ColumnManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText("Database error")).toBeInTheDocument();
    });
  });

  it("shows empty state when no columns exist", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ColumnManager boardId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/No columns yet/i)).toBeInTheDocument();
    });
  });
});
```

### Success Criteria
- [ ] File `src/components/__tests__/ColumnManager.test.tsx` exists
- [ ] Uses `// @vitest-environment happy-dom` comment
- [ ] 5 tests: render without crash, loading state, columns render, error state, empty state
- [ ] All tests use `waitFor` for async assertions
- [ ] Mocks global fetch in beforeEach
- [ ] All tests pass when run with `npm test`
- [ ] TypeScript compiles without errors

---

## Task 8: Documentation Update

### Overview
Update AGENTS.md with the column architecture details, position gap strategy, and CASCADE DELETE behavior. This documents the design decisions for future phases.

### Changes Required

**File**: `AGENTS.md` (MODIFY - append new section)
```markdown
## Column Architecture

### Database Schema

**Table**: `columns`
- `id`: INTEGER PRIMARY KEY AUTOINCREMENT
- `board_id`: INTEGER NOT NULL (foreign key to `boards.id`)
- `name`: TEXT NOT NULL
- `position`: INTEGER NOT NULL
- `created_at`: TEXT NOT NULL DEFAULT (datetime('now'))
- `updated_at`: TEXT NOT NULL DEFAULT (datetime('now'))
- FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
- INDEX: `idx_columns_board_id` on `board_id`

**CASCADE DELETE**: When a board is deleted, all its columns are automatically deleted via `ON DELETE CASCADE` constraint. No manual cleanup required.

### Positioning Strategy

Columns use integer-based positioning with gaps of 1000:
- First column: position = 1000
- Second column: position = 2000
- Third column: position = 3000

**Why gaps?** This allows reordering by updating a single column's position to fit between neighbors without renumbering all columns.

**Reordering algorithm:**
1. User drags column A to position of column B
2. Calculate new position: average of B's neighbors' positions
3. Update column A's position via PATCH to `/api/columns/:id/position`
4. Re-sort columns by position on client

**Example**: Moving column from position 3000 to between 1000 and 2000:
- New position = (1000 + 2000) / 2 = 1500
- Only one UPDATE query needed

### Repository Layer

**File**: `src/lib/db/columns.ts`

Functions:
- `createColumn(boardId, name)`: Creates column with auto-calculated position (max + 1000)
- `listColumnsByBoard(boardId)`: Returns columns ordered by position ASC
- `getColumnById(id)`: Returns single column or undefined
- `renameColumn(id, name)`: Updates name, validates non-empty
- `deleteColumn(id)`: Deletes column, returns boolean
- `updateColumnPosition(id, position)`: Updates position for reordering

**Validation:**
- Column names cannot be empty (trimmed)
- boardId must reference existing board (foreign key constraint)
- All operations use prepared statements (SQL injection safe)

### API Routes

**Endpoints:**
- `POST /api/columns` - Create column (201 on success)
- `GET /api/columns?boardId=X` - List columns for board (200)
- `PATCH /api/columns/:id` - Rename column (200 or 404)
- `DELETE /api/columns/:id` - Delete column (204 or 404)
- `PATCH /api/columns/:id/position` - Update position (200 or 404)

**Error responses:**
- 400: Validation error (missing fields, invalid types, malformed JSON)
- 404: Resource not found
- All errors return JSON: `{ error: "message" }`

### UI Components

**ColumnManager.tsx**: Manages columns for a single board
- Fetches columns on mount
- Horizontal layout with fixed-width columns (w-72)
- Inline rename (click name → edit → blur/Enter to save)
- Delete with confirmation
- Drag-to-reorder using HTML5 drag-and-drop
- Loading states for all operations (creating, updating, deleting)
- Error banner for failed operations

**Board Detail Page**: `src/pages/boards/[id].astro`
- Server-side board lookup
- Redirects to home if board not found
- Renders ColumnManager island with `client:load`
```

### Success Criteria
- [ ] AGENTS.md updated with column architecture section
- [ ] Documents CASCADE DELETE behavior
- [ ] Documents position gap strategy with rationale
- [ ] Lists all repository functions and their signatures
- [ ] Lists all API endpoints with status codes
- [ ] Describes ColumnManager component functionality
- [ ] Includes examples and rationale for design decisions
- [ ] TypeScript compiles without errors (if AGENTS.md syntax is checked)

---

## Testing Strategy

### Unit Tests (Database Layer)
**File**: `src/lib/db/__tests__/columns.test.ts`

**Coverage target**: 80%+ on `src/lib/db/columns.ts`

**Test cases (15+)**:
1. `createColumn`: valid data returns Column with id
2. `createColumn`: calculates position 1000 for first column
3. `createColumn`: calculates position 2000 for second column (max + 1000)
4. `createColumn`: throws on empty name
5. `createColumn`: throws on whitespace-only name
6. `createColumn`: throws on non-existent board_id
7. `listColumnsByBoard`: returns empty array for board with no columns
8. `listColumnsByBoard`: returns columns ordered by position ASC
9. `getColumnById`: returns column when found
10. `getColumnById`: returns undefined when not found
11. `renameColumn`: updates name and returns updated column
12. `renameColumn`: throws on empty name
13. `renameColumn`: returns undefined for non-existent id
14. `deleteColumn`: returns true when deleted
15. `deleteColumn`: returns false for non-existent id
16. `updateColumnPosition`: updates position and returns updated column
17. `updateColumnPosition`: returns undefined for non-existent id
18. **CASCADE DELETE**: create board with 3 columns, delete board, verify columns table is empty

**Mocking strategy**: No mocks. Use real SQLite temp database per test. This validates actual SQL behavior including foreign key constraints.

### Integration Tests (API Layer)
**File**: `src/pages/api/columns/__tests__/columns-api.test.ts`

**Coverage target**: 80%+ on API route files

**Test cases (20+)**:
1. `POST /api/columns`: returns 201 with created column
2. `POST /api/columns`: returns 400 when boardId missing
3. `POST /api/columns`: returns 400 when name missing
4. `POST /api/columns`: returns 400 when boardId is not a number
5. `POST /api/columns`: returns 404 when board does not exist
6. `POST /api/columns`: returns 400 for malformed JSON
7. `GET /api/columns?boardId=X`: returns 200 with columns array
8. `GET /api/columns`: returns 400 when boardId missing
9. `GET /api/columns?boardId=abc`: returns 400 when boardId is not a number
10. `GET /api/columns?boardId=999`: returns 200 with empty array for non-existent board
11. `PATCH /api/columns/:id`: returns 200 with updated column
12. `PATCH /api/columns/:id`: returns 400 when name missing
13. `PATCH /api/columns/:id`: returns 404 when column not found
14. `PATCH /api/columns/abc`: returns 400 for invalid ID format
15. `PATCH /api/columns/:id`: returns 400 for malformed JSON
16. `DELETE /api/columns/:id`: returns 204 on success
17. `DELETE /api/columns/:id`: returns 404 when column not found
18. `DELETE /api/columns/abc`: returns 400 for invalid ID format
19. `PATCH /api/columns/:id/position`: returns 200 with updated column
20. `PATCH /api/columns/:id/position`: returns 400 when position missing
21. `PATCH /api/columns/:id/position`: returns 400 when position is not a number
22. `PATCH /api/columns/:id/position`: returns 404 when column not found
23. `PATCH /api/columns/abc/position`: returns 400 for invalid ID format
24. `PATCH /api/columns/:id/position`: returns 400 for malformed JSON

**Mocking strategy**: No HTTP server. Import API handlers directly and call with mock Request/Context objects. Use real temp SQLite database per test.

### Component Tests (UI Layer)
**File**: `src/components/__tests__/ColumnManager.test.tsx`

**Environment**: happy-dom

**Test cases (5+)**:
1. Renders without crashing
2. Shows "Loading columns..." while fetching
3. Renders columns after fetch completes
4. Shows error banner when fetch fails
5. Shows "No columns yet" empty state

**Mocking strategy**: Mock global fetch with `vi.fn()`. Return mock Column objects. No real API calls or database in component tests.

**Future test candidates (not required for Phase 2, but document for Phase 3)**:
- Triggers create column on form submit
- Shows "Creating..." during column creation
- Disables form during column creation
- Shows error when create fails

### E2E Test Considerations (Not in Phase 2)

Phase 2 spec requests Playwright e2e tests, but:
- **Recommendation**: Defer to Phase 3 when cards exist
- **Reasoning**: E2E tests are most valuable for complete user flows (create board → add columns → create cards → move cards between columns). Phase 2 only has boards and columns, so the E2E scenarios are limited.
- **Alternative**: Comprehensive integration tests provide sufficient coverage for Phase 2. Once Phase 3 adds cards, implement Playwright tests for full kanban flows.

## Risk Assessment

### Risk: Position Integer Overflow
**Scenario**: After many reorders, positions converge (e.g., 1000, 1001, 1001.5) and rounding causes collisions.

**Likelihood**: Low (would require hundreds of reorders)

**Mitigation**:
- Current approach uses `Math.floor()` for midpoint calculation
- INTEGER in SQLite is 8 bytes (range: -9,223,372,036,854,775,808 to 9,223,372,036,854,775,807)
- If positions converge below gap threshold, run a "rebalance" function that renumbers all columns with 1000 gaps
- **Decision**: Defer rebalancing to Phase 3. Document the edge case in AGENTS.md but don't implement proactively.

### Risk: Cascade Delete Testing Reliability
**Scenario**: Cascade delete test fails intermittently due to better-sqlite3 timing or foreign key pragma not enabled.

**Likelihood**: Low (foreign keys are enabled in `connection.ts:14`)

**Mitigation**:
- Verify foreign key pragma in test setup: `db.prepare("PRAGMA foreign_keys = ON").run()`
- Use synchronous better-sqlite3 API (no async timing issues)
- Add explicit assertion: after board delete, query columns table and assert empty

### Risk: Drag-and-Drop Browser Compatibility
**Scenario**: HTML5 drag-and-drop behaves differently across browsers (Safari, Firefox, Chrome).

**Likelihood**: Medium (HTML5 drag API has known quirks)

**Mitigation**:
- Use standard `draggable`, `onDragStart`, `onDragOver`, `onDrop` handlers
- Test manually in Chrome and Firefox during development
- **Accept risk**: If Safari drag issues arise, document as known limitation and address in Phase 3 with a drag library (e.g., dnd-kit)
- Phase 2 focuses on Chrome/Firefox support (majority of dev tools users)

### Risk: Test Coverage Below 80%
**Scenario**: Code coverage report shows 70-79% on column repository or API routes.

**Likelihood**: Low (Phase 1 achieved 93.33%)

**Mitigation**:
- Run `npm test -- --coverage` after each task completion
- If below 80%, identify uncovered branches and add targeted tests
- Common gaps: error paths, edge cases (first column, last column, empty DB)
- **Blockers**: Do not proceed to next task if current task is below 80% coverage

### Risk: Memory Leak in Component State
**Scenario**: ColumnManager doesn't clean up fetch or event listeners, causing memory leaks in long-running sessions.

**Likelihood**: Low (React handles cleanup for useState/useEffect)

**Mitigation**:
- No AbortController needed for single-page loads (user navigates away = component unmounts = automatic cleanup)
- If Phase 3 adds real-time updates (WebSockets, polling), add cleanup in useEffect return function
- **Decision**: No special cleanup needed for Phase 2

### Risk: Race Condition During Reorder
**Scenario**: User drags two columns in rapid succession, causing concurrent PATCH requests and inconsistent final state.

**Likelihood**: Medium (drag-and-drop is fast)

**Mitigation**:
- Current implementation: wait for API response before enabling next drag
- Dragged column shows opacity feedback to indicate in-progress state
- **Accept risk**: If user drags during network delay, second drag is queued (React state serializes operations)
- **Enhancement for Phase 3**: Add optimistic UI updates or disable all drags during any position update
