# Implementation Plan: Phase 2 — Columns (Swim Lanes)

## Overview
Deliver complete column management functionality: users can navigate to a board detail page, create/rename/delete/reorder columns within boards, and see their changes persisted in SQLite with proper foreign key relationships.

## Current State (from Research)

### What Exists
- **Board CRUD**: Complete implementation with `BoardRepository`, API routes, and UI
- **Database foundation**: Migration system, singleton connection (`getDb()`), test database factory (`getTestDb()`)
- **Test patterns**: Repository unit tests (100% coverage on `BoardRepository`), API integration tests with `getDb()` mocking, 86.18% overall coverage
- **UI patterns**: Astro SSR pages with React islands (`client:load`), Tailwind CSS styling
- **Routing**: Home page at `/` shows board list, but no navigation to individual boards yet

### Patterns to Follow
- **Repository pattern**: Class with constructor accepting `Database.Database`, prepared statements for all queries
- **Migration pattern**: Numbered SQL files (`002_`, `003_`, etc.) with idempotent DDL (`IF NOT EXISTS`)
- **API conventions**: RESTful routes, JSON responses, validation with appropriate status codes (200, 201, 400, 404, 500)
- **Test strategy**: Real database operations in tests (no business logic mocking), in-memory SQLite via `getTestDb()`

## Desired End State

After Phase 2 completion:
- **Database**: `columns` table with foreign key to `boards`, cascade delete enabled
- **Repository**: `ColumnRepository` with create, findByBoardId, findById, update, delete methods
- **API routes**:
  - `POST /api/boards/:boardId/columns` (create)
  - `GET /api/boards/:boardId/columns` (list, ordered by position)
  - `PATCH /api/columns/:id` (update name or position)
  - `DELETE /api/columns/:id` (delete)
- **UI**: Board detail page at `/boards/:id` showing columns horizontally with add/rename/delete/reorder controls
- **Navigation**: Board cards on home page are clickable links to board detail pages
- **Tests**: >80% coverage on all new code, foreign key cascade behavior verified

### Verification
- Click board from home page → navigate to `/boards/:id`
- Add column → appears on board
- Rename column → updates displayed name
- Reorder column → changes position in display
- Delete column → removes from board
- Delete board → all its columns also deleted (cascade)
- All tests pass (`npm test`)
- Coverage report shows >80% on new files (`npm run test:coverage`)

## What We're NOT Doing
- **Cards within columns** (Phase 3)
- **HTML5 drag-and-drop** (deferred until Phase 3 when cards exist — too complex for column-only UI)
- **Board editing/deletion UI** (can be a polish phase)
- **Column color coding, collapse/expand, WIP limits** (advanced features)
- **Undo/redo, real-time updates, optimistic UI** (out of scope)
- **Column description or metadata fields** (just name and position for now)

## Implementation Approach

### Resolved Design Decisions

#### 1. Navigation Implementation (from RESEARCH.md open question)
**Decision**: Wrap entire board card in `<a>` tag with `href="/boards/{id}"`
**Rationale**: Standard HTML approach, works with Astro SSR, supports browser navigation (middle-click, right-click), no JavaScript required, keeps BoardList as Astro component (no React conversion needed)

#### 2. Column Position Strategy (from RESEARCH.md open question)
**Decision**: Use integer `position` field (1, 2, 3, ...) with reordering logic that updates affected rows
**Rationale**:
- Simple to understand and query (`ORDER BY position`)
- Sufficient for expected scale (boards unlikely to have >100 columns)
- Reordering updates only 1-2 rows in typical case (swap positions)
- Can optimize later if performance becomes issue (float positions, linked list)
- Reference: [SQLite Forum on maintaining arbitrary order](https://sqlite.org/forum/info/65a52ad3def88fd0)

#### 3. Cascade Delete Testing (from RESEARCH.md open question)
**Decision**: Test by creating board with columns, deleting board, then querying for columns by board_id — assert empty array
**Rationale**: SQLite supports `ON DELETE CASCADE` in `FOREIGN KEY` constraints (requires `PRAGMA foreign_keys = ON`, which better-sqlite3 enables by default). Tests verify behavior by checking side effects.
**Reference**: [SQLite Foreign Key Support](https://sqlite.org/foreignkeys.html)

#### 4. Board Detail Page Routing (from RESEARCH.md open question)
**Decision**: Use SSR page `src/pages/boards/[id].astro` with frontmatter data fetching via `Astro.params.id`
**Rationale**: Astro's SSR mode (`output: 'server'` in config) allows dynamic routes to access `Astro.params` and fetch data at request time. Matches home page pattern (SSR with repository calls in frontmatter). No `getStaticPaths()` needed in SSR mode.
**Reference**: [Astro SSR and dynamic routes](https://www.luisllamas.es/en/astro-ssr-server-side-rendering/)

### Vertical Slicing Strategy
Break work into 6 tasks, each delivering testable end-to-end functionality:
1. **Database + Types**: Column table, TypeScript types (verifiable via migration success)
2. **Repository Layer**: ColumnRepository with unit tests (verifiable via `npm test`)
3. **API Routes**: Column CRUD endpoints with integration tests (verifiable via `npm test`)
4. **Board Detail Page**: SSR page displaying board and columns (verifiable in browser)
5. **Column Management UI**: React components for add/rename/delete (verifiable in browser)
6. **Column Reordering**: Position update UI and logic (verifiable in browser)

Each task builds on the previous and can be tested independently.

---

## Task 1: Database Schema and Type Definitions

### Overview
Create the `columns` table with foreign key relationship to `boards`, and define TypeScript interfaces for type safety.

### Changes Required

**File**: `db/migrations/002_create_columns.sql` (new file)
```sql
-- Create columns table with foreign key to boards
CREATE TABLE IF NOT EXISTS columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

-- Index for fetching columns by board (most common query)
CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);

-- Index for ordering columns within a board
CREATE INDEX IF NOT EXISTS idx_columns_board_position ON columns(board_id, position);
```

**File**: `src/lib/db/types.ts`
```typescript
// Add after Board interfaces:

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
}

export interface NewColumn {
  board_id: number;
  name: string;
  position: number;
}
```

### Success Criteria
- [ ] Migration file created with correct syntax
- [ ] Dev server starts without errors (`npm run dev`)
- [ ] Database file `db/swimlanes.db` contains `columns` table with correct schema
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Can query `sqlite3 db/swimlanes.db ".schema columns"` and see table definition

---

## Task 2: Column Repository with Unit Tests

### Overview
Create `ColumnRepository` following the established repository pattern with full CRUD operations and comprehensive unit tests.

### Changes Required

**File**: `src/lib/repositories/ColumnRepository.ts` (new file)
```typescript
import type { Database } from 'better-sqlite3';
import type { Column, NewColumn } from '@/lib/db/types';

export class ColumnRepository {
  constructor(private db: Database) {}

  create(column: NewColumn): Column {
    const stmt = this.db.prepare(`
      INSERT INTO columns (board_id, name, position)
      VALUES (?, ?, ?)
      RETURNING id, board_id, name, position, created_at
    `);
    return stmt.get(column.board_id, column.name, column.position) as Column;
  }

  findByBoardId(boardId: number): Column[] {
    const stmt = this.db.prepare(`
      SELECT id, board_id, name, position, created_at
      FROM columns
      WHERE board_id = ?
      ORDER BY position ASC
    `);
    return stmt.all(boardId) as Column[];
  }

  findById(id: number): Column | null {
    const stmt = this.db.prepare(`
      SELECT id, board_id, name, position, created_at
      FROM columns
      WHERE id = ?
    `);
    return (stmt.get(id) as Column) || null;
  }

  update(id: number, updates: Partial<Pick<Column, 'name' | 'position'>>): Column | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.position !== undefined) {
      fields.push('position = ?');
      values.push(updates.position);
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const stmt = this.db.prepare(`
      UPDATE columns
      SET ${fields.join(', ')}
      WHERE id = ?
      RETURNING id, board_id, name, position, created_at
    `);
    return stmt.get(...values) as Column;
  }

  delete(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM columns WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}
```

**File**: `src/lib/repositories/ColumnRepository.test.ts` (new file)
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '@/lib/db/connection';
import { ColumnRepository } from './ColumnRepository';
import { BoardRepository } from './BoardRepository';
import type { Database } from 'better-sqlite3';

describe('ColumnRepository', () => {
  let db: Database;
  let columnRepo: ColumnRepository;
  let boardRepo: BoardRepository;
  let testBoardId: number;

  beforeEach(() => {
    db = getTestDb();
    columnRepo = new ColumnRepository(db);
    boardRepo = new BoardRepository(db);

    // Create a test board for foreign key relationship
    const board = boardRepo.create({ name: 'Test Board' });
    testBoardId = board.id;
  });

  describe('create', () => {
    it('should create a new column with all fields', () => {
      const newColumn = {
        board_id: testBoardId,
        name: 'To Do',
        position: 1,
      };

      const column = columnRepo.create(newColumn);

      expect(column.id).toBeGreaterThan(0);
      expect(column.board_id).toBe(testBoardId);
      expect(column.name).toBe('To Do');
      expect(column.position).toBe(1);
      expect(column.created_at).toBeDefined();
    });

    it('should auto-increment IDs for multiple columns', () => {
      const col1 = columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
      const col2 = columnRepo.create({ board_id: testBoardId, name: 'Col 2', position: 2 });

      expect(col2.id).toBeGreaterThan(col1.id);
    });
  });

  describe('findByBoardId', () => {
    it('should return all columns for a board ordered by position', () => {
      columnRepo.create({ board_id: testBoardId, name: 'Done', position: 3 });
      columnRepo.create({ board_id: testBoardId, name: 'To Do', position: 1 });
      columnRepo.create({ board_id: testBoardId, name: 'In Progress', position: 2 });

      const columns = columnRepo.findByBoardId(testBoardId);

      expect(columns).toHaveLength(3);
      expect(columns[0].name).toBe('To Do');
      expect(columns[1].name).toBe('In Progress');
      expect(columns[2].name).toBe('Done');
      expect(columns[0].position).toBe(1);
      expect(columns[1].position).toBe(2);
      expect(columns[2].position).toBe(3);
    });

    it('should return empty array when board has no columns', () => {
      const columns = columnRepo.findByBoardId(testBoardId);
      expect(columns).toEqual([]);
    });

    it('should not return columns from other boards', () => {
      const board2 = boardRepo.create({ name: 'Other Board' });
      columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
      columnRepo.create({ board_id: board2.id, name: 'Col 2', position: 1 });

      const columns = columnRepo.findByBoardId(testBoardId);

      expect(columns).toHaveLength(1);
      expect(columns[0].name).toBe('Col 1');
    });
  });

  describe('findById', () => {
    it('should return a column by ID', () => {
      const created = columnRepo.create({ board_id: testBoardId, name: 'Test', position: 1 });
      const found = columnRepo.findById(created.id);

      expect(found).toEqual(created);
    });

    it('should return null when column does not exist', () => {
      const found = columnRepo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('update', () => {
    it('should update column name', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Old Name', position: 1 });
      const updated = columnRepo.update(column.id, { name: 'New Name' });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.position).toBe(1); // Unchanged
    });

    it('should update column position', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Test', position: 1 });
      const updated = columnRepo.update(column.id, { position: 5 });

      expect(updated).not.toBeNull();
      expect(updated!.position).toBe(5);
      expect(updated!.name).toBe('Test'); // Unchanged
    });

    it('should update both name and position', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Old', position: 1 });
      const updated = columnRepo.update(column.id, { name: 'New', position: 3 });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New');
      expect(updated!.position).toBe(3);
    });

    it('should return null when updating non-existent column', () => {
      const updated = columnRepo.update(99999, { name: 'Test' });
      expect(updated).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a column and return true', () => {
      const column = columnRepo.create({ board_id: testBoardId, name: 'Test', position: 1 });
      const deleted = columnRepo.delete(column.id);

      expect(deleted).toBe(true);
      expect(columnRepo.findById(column.id)).toBeNull();
    });

    it('should return false when deleting non-existent column', () => {
      const deleted = columnRepo.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('cascade delete', () => {
    it('should delete columns when parent board is deleted', () => {
      // Create columns for the board
      const col1 = columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
      const col2 = columnRepo.create({ board_id: testBoardId, name: 'Col 2', position: 2 });

      // Verify columns exist
      expect(columnRepo.findById(col1.id)).not.toBeNull();
      expect(columnRepo.findById(col2.id)).not.toBeNull();

      // Delete the board (should cascade to columns)
      const stmt = db.prepare('DELETE FROM boards WHERE id = ?');
      stmt.run(testBoardId);

      // Verify columns are gone
      expect(columnRepo.findById(col1.id)).toBeNull();
      expect(columnRepo.findById(col2.id)).toBeNull();
      expect(columnRepo.findByBoardId(testBoardId)).toEqual([]);
    });
  });
});
```

### Success Criteria
- [ ] `ColumnRepository.ts` compiles without TypeScript errors
- [ ] All unit tests pass (`npm test`)
- [ ] Coverage report shows 100% coverage on `ColumnRepository` methods
- [ ] Cascade delete test verifies foreign key behavior

---

## Task 3: Column API Routes with Integration Tests

### Overview
Implement RESTful API endpoints for column operations with comprehensive integration tests covering all status codes and edge cases.

### Changes Required

**File**: `src/pages/api/boards/[boardId]/columns.ts` (new file)
```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

// GET /api/boards/:boardId/columns - List all columns for a board
export const GET: APIRoute = async ({ params }) => {
  try {
    const boardId = parseInt(params.boardId || '', 10);
    if (isNaN(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const boardRepo = new BoardRepository(db);
    const columnRepo = new ColumnRepository(db);

    // Check if board exists
    const board = boardRepo.findById(boardId);
    if (!board) {
      return new Response(JSON.stringify({ error: 'Board not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const columns = columnRepo.findByBoardId(boardId);
    return new Response(JSON.stringify(columns), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching columns:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// POST /api/boards/:boardId/columns - Create a new column
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const boardId = parseInt(params.boardId || '', 10);
    if (isNaN(boardId)) {
      return new Response(JSON.stringify({ error: 'Invalid board ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validation
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return new Response(JSON.stringify({ error: 'Column name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const boardRepo = new BoardRepository(db);
    const columnRepo = new ColumnRepository(db);

    // Check if board exists
    const board = boardRepo.findById(boardId);
    if (!board) {
      return new Response(JSON.stringify({ error: 'Board not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Calculate position (append to end)
    const existingColumns = columnRepo.findByBoardId(boardId);
    const position = existingColumns.length > 0
      ? Math.max(...existingColumns.map(c => c.position)) + 1
      : 1;

    const newColumn = {
      board_id: boardId,
      name: body.name.trim(),
      position,
    };

    const column = columnRepo.create(newColumn);
    return new Response(JSON.stringify(column), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating column:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

**File**: `src/pages/api/boards/[boardId]/columns.test.ts` (new file)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './columns';
import { getTestDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';
import type { Database } from 'better-sqlite3';

// Mock the getDb function to use test database
vi.mock('@/lib/db/connection', async () => {
  const actual = await vi.importActual('@/lib/db/connection');
  let testDb: Database;

  return {
    ...actual,
    getDb: () => {
      if (!testDb) {
        testDb = (actual as any).getTestDb();
      }
      return testDb;
    },
  };
});

describe('GET /api/boards/:boardId/columns', () => {
  let db: Database;
  let boardRepo: BoardRepository;
  let columnRepo: ColumnRepository;
  let testBoardId: number;

  beforeEach(() => {
    db = getTestDb();
    boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    testBoardId = board.id;
  });

  it('should return all columns for a board ordered by position', async () => {
    columnRepo.create({ board_id: testBoardId, name: 'Done', position: 3 });
    columnRepo.create({ board_id: testBoardId, name: 'To Do', position: 1 });
    columnRepo.create({ board_id: testBoardId, name: 'In Progress', position: 2 });

    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`);
    const response = await GET({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(3);
    expect(data[0].name).toBe('To Do');
    expect(data[1].name).toBe('In Progress');
    expect(data[2].name).toBe('Done');
  });

  it('should return empty array when board has no columns', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`);
    const response = await GET({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual([]);
  });

  it('should return 404 when board does not exist', async () => {
    const request = new Request('http://localhost/api/boards/99999/columns');
    const response = await GET({ params: { boardId: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Board not found');
  });

  it('should return 400 for invalid board ID format', async () => {
    const request = new Request('http://localhost/api/boards/abc/columns');
    const response = await GET({ params: { boardId: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid board ID');
  });
});

describe('POST /api/boards/:boardId/columns', () => {
  let db: Database;
  let boardRepo: BoardRepository;
  let columnRepo: ColumnRepository;
  let testBoardId: number;

  beforeEach(() => {
    db = getTestDb();
    boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    testBoardId = board.id;
  });

  it('should create a new column with auto-calculated position', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name: 'To Do' }),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.name).toBe('To Do');
    expect(data.board_id).toBe(testBoardId);
    expect(data.position).toBe(1);
  });

  it('should append new column after existing ones', async () => {
    columnRepo.create({ board_id: testBoardId, name: 'Col 1', position: 1 });
    columnRepo.create({ board_id: testBoardId, name: 'Col 2', position: 2 });

    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Col 3' }),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.position).toBe(3);
  });

  it('should return 400 when name is missing', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Column name is required');
  });

  it('should return 400 when name is empty string', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: JSON.stringify({ name: '   ' }),
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Column name is required');
  });

  it('should return 400 for invalid JSON', async () => {
    const request = new Request(`http://localhost/api/boards/${testBoardId}/columns`, {
      method: 'POST',
      body: 'not valid json',
    });

    const response = await POST({ params: { boardId: testBoardId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('should return 404 when board does not exist', async () => {
    const request = new Request('http://localhost/api/boards/99999/columns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await POST({ params: { boardId: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Board not found');
  });

  it('should return 400 for invalid board ID format', async () => {
    const request = new Request('http://localhost/api/boards/abc/columns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await POST({ params: { boardId: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid board ID');
  });
});
```

**File**: `src/pages/api/columns/[id].ts` (new file)
```typescript
import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';

// PATCH /api/columns/:id - Update column name or position
export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid column ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const columnRepo = new ColumnRepository(db);

    const updates: any = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return new Response(JSON.stringify({ error: 'Column name must be a non-empty string' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.name = body.name.trim();
    }
    if (body.position !== undefined) {
      if (typeof body.position !== 'number' || body.position < 1) {
        return new Response(JSON.stringify({ error: 'Position must be a positive integer' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      updates.position = body.position;
    }

    const column = columnRepo.update(id, updates);
    if (!column) {
      return new Response(JSON.stringify({ error: 'Column not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(column), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error updating column:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

// DELETE /api/columns/:id - Delete a column
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '', 10);
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'Invalid column ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDb();
    const columnRepo = new ColumnRepository(db);

    const deleted = columnRepo.delete(id);
    if (!deleted) {
      return new Response(JSON.stringify({ error: 'Column not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting column:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
```

**File**: `src/pages/api/columns/[id].test.ts` (new file)
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PATCH, DELETE } from './[id]';
import { getTestDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';
import type { Database } from 'better-sqlite3';

// Mock the getDb function to use test database
vi.mock('@/lib/db/connection', async () => {
  const actual = await vi.importActual('@/lib/db/connection');
  let testDb: Database;

  return {
    ...actual,
    getDb: () => {
      if (!testDb) {
        testDb = (actual as any).getTestDb();
      }
      return testDb;
    },
  };
});

describe('PATCH /api/columns/:id', () => {
  let db: Database;
  let columnRepo: ColumnRepository;
  let testColumnId: number;

  beforeEach(() => {
    db = getTestDb();
    const boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    const column = columnRepo.create({ board_id: board.id, name: 'Test Column', position: 1 });
    testColumnId = column.id;
  });

  it('should update column name', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.name).toBe('New Name');
  });

  it('should update column position', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: 5 }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.position).toBe(5);
  });

  it('should return 404 when column does not exist', async () => {
    const request = new Request('http://localhost/api/columns/99999', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' }),
    });

    const response = await PATCH({ params: { id: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Column not found');
  });

  it('should return 400 for invalid column ID', async () => {
    const request = new Request('http://localhost/api/columns/abc', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    });

    const response = await PATCH({ params: { id: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid column ID');
  });

  it('should return 400 for invalid JSON', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: 'not json',
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid JSON in request body');
  });

  it('should return 400 for empty name', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: '   ' }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Column name must be a non-empty string');
  });

  it('should return 400 for invalid position', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'PATCH',
      body: JSON.stringify({ position: 0 }),
    });

    const response = await PATCH({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Position must be a positive integer');
  });
});

describe('DELETE /api/columns/:id', () => {
  let db: Database;
  let columnRepo: ColumnRepository;
  let testColumnId: number;

  beforeEach(() => {
    db = getTestDb();
    const boardRepo = new BoardRepository(db);
    columnRepo = new ColumnRepository(db);
    const board = boardRepo.create({ name: 'Test Board' });
    const column = columnRepo.create({ board_id: board.id, name: 'Test Column', position: 1 });
    testColumnId = column.id;
  });

  it('should delete a column and return 204', async () => {
    const request = new Request(`http://localhost/api/columns/${testColumnId}`, {
      method: 'DELETE',
    });

    const response = await DELETE({ params: { id: testColumnId.toString() }, request } as any);

    expect(response.status).toBe(204);
    expect(columnRepo.findById(testColumnId)).toBeNull();
  });

  it('should return 404 when column does not exist', async () => {
    const request = new Request('http://localhost/api/columns/99999', {
      method: 'DELETE',
    });

    const response = await DELETE({ params: { id: '99999' }, request } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Column not found');
  });

  it('should return 400 for invalid column ID', async () => {
    const request = new Request('http://localhost/api/columns/abc', {
      method: 'DELETE',
    });

    const response = await DELETE({ params: { id: 'abc' }, request } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid column ID');
  });
});
```

### Success Criteria
- [ ] All API route files compile without TypeScript errors
- [ ] All integration tests pass (`npm test`)
- [ ] Coverage report shows >80% on API route files
- [ ] All HTTP status codes tested (200, 201, 400, 404, 500)
- [ ] Error paths covered (malformed JSON, missing fields, invalid IDs)

---

## Task 4: Board Detail Page with SSR

### Overview
Create board detail page at `/boards/:id` that displays board information and its columns using Astro SSR.

### Changes Required

**File**: `src/pages/boards/[id].astro` (new file)
```astro
---
import { getDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';
import { ColumnRepository } from '@/lib/repositories/ColumnRepository';

const { id } = Astro.params;
const boardId = parseInt(id || '', 10);

// Validate ID
if (isNaN(boardId)) {
  return Astro.redirect('/404');
}

const db = getDb();
const boardRepo = new BoardRepository(db);
const columnRepo = new ColumnRepository(db);

const board = boardRepo.findById(boardId);
if (!board) {
  return Astro.redirect('/404');
}

const columns = columnRepo.findByBoardId(boardId);
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{board.name} - SwimLanes</title>
  </head>
  <body class="bg-gray-50 min-h-screen">
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="flex items-center justify-between">
          <div>
            <a href="/" class="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
              ← Back to Boards
            </a>
            <h1 class="text-3xl font-bold text-gray-900">{board.name}</h1>
            <p class="text-gray-600 text-sm mt-1">
              Created {new Date(board.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      {columns.length === 0 ? (
        <div class="text-center py-12">
          <p class="text-gray-500 text-lg mb-4">No columns yet. Add your first column to get started!</p>
          <p class="text-gray-400 text-sm">Columns help you organize your tasks (like "To Do", "In Progress", "Done")</p>
        </div>
      ) : (
        <div class="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div class="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-lg font-semibold text-gray-900">{column.name}</h2>
                <span class="text-xs text-gray-500">Position {column.position}</span>
              </div>
              <div class="text-sm text-gray-400 italic">
                Cards will appear here (Phase 3)
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  </body>
</html>
```

**File**: `src/components/BoardList.astro` (modify existing)

Update the board card to be a clickable link:

```astro
---
// ... existing imports and props ...
---

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {boards.length === 0 ? (
    <p class="col-span-full text-gray-500 text-center py-8">
      No boards yet. Create your first board above!
    </p>
  ) : (
    boards.map((board) => (
      <a
        href={`/boards/${board.id}`}
        class="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow hover:border-blue-300"
      >
        <h3 class="text-lg font-semibold text-gray-900">{board.name}</h3>
        <p class="text-sm text-gray-500 mt-1">
          Created {new Date(board.created_at).toLocaleDateString()}
        </p>
      </a>
    ))
  )}
</div>
```

### Success Criteria
- [ ] `/boards/:id` route renders without errors
- [ ] Board name displays correctly in header
- [ ] Back link navigates to home page
- [ ] Empty state message displays when no columns exist
- [ ] Columns display horizontally when present
- [ ] Column position numbers display correctly
- [ ] Invalid board ID redirects to 404
- [ ] Board cards on home page are clickable links
- [ ] Hover state shows visual feedback on board cards

---

## Task 5: Column Management UI Components

### Overview
Create React components for adding, renaming, and deleting columns with form validation and error handling.

### Changes Required

**File**: `src/components/ColumnForm.tsx` (new file)
```typescript
import { useState } from 'react';
import type { Column } from '@/lib/db/types';

interface ColumnFormProps {
  boardId: number;
  onColumnAdded: (column: Column) => void;
}

export function ColumnForm({ boardId, onColumnAdded }: ColumnFormProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Column name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/boards/${boardId}/columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create column');
      }

      const column = await response.json();
      setName('');
      onColumnAdded(column);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter column name (e.g., To Do, In Progress, Done)"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Adding...' : 'Add Column'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-red-600 text-sm">{error}</p>
      )}
    </form>
  );
}
```

**File**: `src/components/ColumnCard.tsx` (new file)
```typescript
import { useState } from 'react';
import type { Column } from '@/lib/db/types';

interface ColumnCardProps {
  column: Column;
  onColumnUpdated: (column: Column) => void;
  onColumnDeleted: (columnId: number) => void;
}

export function ColumnCard({ column, onColumnUpdated, onColumnDeleted }: ColumnCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(column.name);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!editName.trim()) {
      setError('Column name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update column');
      }

      const updated = await response.json();
      onColumnUpdated(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditName(column.name);
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${column.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete column');
      }

      onColumnDeleted(column.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 px-2 py-1 border border-gray-300 rounded text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUpdating}
            autoFocus
          />
        ) : (
          <h2 className="text-lg font-semibold text-gray-900">{column.name}</h2>
        )}

        <div className="flex gap-1 ml-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isUpdating}
                className="px-2 py-1 text-sm text-green-600 hover:text-green-800 disabled:text-gray-400"
                title="Save"
              >
                ✓
              </button>
              <button
                onClick={handleCancel}
                disabled={isUpdating}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-400"
                title="Cancel"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-2 py-1 text-sm text-blue-600 hover:text-blue-800"
                title="Rename"
              >
                ✎
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                title="Delete"
              >
                🗑
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-2">{error}</p>
      )}

      <div className="text-sm text-gray-400 italic">
        Cards will appear here (Phase 3)
      </div>
    </div>
  );
}
```

**File**: `src/components/ColumnList.tsx` (new file)
```typescript
import { useState } from 'react';
import { ColumnForm } from './ColumnForm';
import { ColumnCard } from './ColumnCard';
import type { Column } from '@/lib/db/types';

interface ColumnListProps {
  boardId: number;
  initialColumns: Column[];
}

export function ColumnList({ boardId, initialColumns }: ColumnListProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  const handleColumnAdded = (column: Column) => {
    setColumns([...columns, column]);
  };

  const handleColumnUpdated = (updated: Column) => {
    setColumns(columns.map(c => c.id === updated.id ? updated : c));
  };

  const handleColumnDeleted = (columnId: number) => {
    setColumns(columns.filter(c => c.id !== columnId));
  };

  return (
    <div>
      <ColumnForm boardId={boardId} onColumnAdded={handleColumnAdded} />

      {columns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No columns yet. Add your first column to get started!</p>
          <p className="text-gray-400 text-sm">Columns help you organize your tasks (like "To Do", "In Progress", "Done")</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <ColumnCard
              key={column.id}
              column={column}
              onColumnUpdated={handleColumnUpdated}
              onColumnDeleted={handleColumnDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**File**: `src/pages/boards/[id].astro` (modify existing)

Replace the main content section with the React component:

```astro
---
// ... existing imports ...
import { ColumnList } from '@/components/ColumnList';
// ... rest of frontmatter ...
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- ... existing head content ... -->
  </head>
  <body class="bg-gray-50 min-h-screen">
    <header class="bg-white shadow-sm">
      <!-- ... existing header content ... -->
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <ColumnList client:load boardId={boardId} initialColumns={columns} />
    </main>
  </body>
</html>
```

### Success Criteria
- [ ] Column form appears on board detail page
- [ ] Adding column creates new column card
- [ ] Column cards display with edit and delete buttons
- [ ] Clicking edit button enables inline editing
- [ ] Saving edit updates column name
- [ ] Canceling edit reverts changes
- [ ] Delete button shows confirmation dialog
- [ ] Confirming delete removes column from display
- [ ] All operations update UI optimistically
- [ ] Error messages display for failed operations

---

## Task 6: Column Reordering UI

### Overview
Implement simple up/down buttons for column reordering, updating positions via API.

### Changes Required

**File**: `src/components/ColumnCard.tsx` (modify existing)

Add reordering buttons and logic:

```typescript
interface ColumnCardProps {
  column: Column;
  onColumnUpdated: (column: Column) => void;
  onColumnDeleted: (columnId: number) => void;
  canMoveUp: boolean;        // NEW
  canMoveDown: boolean;      // NEW
  onMoveUp: () => void;      // NEW
  onMoveDown: () => void;    // NEW
}

export function ColumnCard({
  column,
  onColumnUpdated,
  onColumnDeleted,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ColumnCardProps) {
  // ... existing state and handlers ...

  return (
    <div className="flex-shrink-0 w-80 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        {/* ... existing name editing UI ... */}

        <div className="flex gap-1 ml-2">
          {!isEditing && (
            <div className="flex flex-col">
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp || isDeleting}
                className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                title="Move left"
              >
                ←
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown || isDeleting}
                className="text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                title="Move right"
              >
                →
              </button>
            </div>
          )}

          {/* ... existing edit/delete buttons ... */}
        </div>
      </div>

      {/* ... rest of component ... */}
    </div>
  );
}
```

**File**: `src/components/ColumnList.tsx` (modify existing)

Add reordering logic:

```typescript
export function ColumnList({ boardId, initialColumns }: ColumnListProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns);

  // ... existing handlers ...

  const handleMoveUp = async (columnId: number) => {
    const index = columns.findIndex(c => c.id === columnId);
    if (index <= 0) return;

    const currentColumn = columns[index];
    const prevColumn = columns[index - 1];

    // Swap positions
    try {
      await Promise.all([
        fetch(`/api/columns/${currentColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: prevColumn.position }),
        }),
        fetch(`/api/columns/${prevColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: currentColumn.position }),
        }),
      ]);

      // Update local state
      const newColumns = [...columns];
      [newColumns[index], newColumns[index - 1]] = [newColumns[index - 1], newColumns[index]];
      setColumns(newColumns.map((c, i) => ({ ...c, position: i + 1 })));
    } catch (err) {
      console.error('Failed to reorder columns:', err);
      // Could add toast notification here
    }
  };

  const handleMoveDown = async (columnId: number) => {
    const index = columns.findIndex(c => c.id === columnId);
    if (index >= columns.length - 1) return;

    const currentColumn = columns[index];
    const nextColumn = columns[index + 1];

    // Swap positions
    try {
      await Promise.all([
        fetch(`/api/columns/${currentColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: nextColumn.position }),
        }),
        fetch(`/api/columns/${nextColumn.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: currentColumn.position }),
        }),
      ]);

      // Update local state
      const newColumns = [...columns];
      [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
      setColumns(newColumns.map((c, i) => ({ ...c, position: i + 1 })));
    } catch (err) {
      console.error('Failed to reorder columns:', err);
      // Could add toast notification here
    }
  };

  return (
    <div>
      <ColumnForm boardId={boardId} onColumnAdded={handleColumnAdded} />

      {columns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg mb-4">No columns yet. Add your first column to get started!</p>
          <p className="text-gray-400 text-sm">Columns help you organize your tasks (like "To Do", "In Progress", "Done")</p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column, index) => (
            <ColumnCard
              key={column.id}
              column={column}
              onColumnUpdated={handleColumnUpdated}
              onColumnDeleted={handleColumnDeleted}
              canMoveUp={index > 0}
              canMoveDown={index < columns.length - 1}
              onMoveUp={() => handleMoveUp(column.id)}
              onMoveDown={() => handleMoveDown(column.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Success Criteria
- [ ] Up/down arrow buttons appear on column cards
- [ ] First column's up button is disabled
- [ ] Last column's down button is disabled
- [ ] Clicking up button moves column left
- [ ] Clicking down button moves column right
- [ ] Column order persists after page reload
- [ ] Reordering updates positions in database
- [ ] UI updates immediately after reorder

---

## Testing Strategy

### Unit Tests (Repository Layer)
- **ColumnRepository.test.ts**: 14+ test cases covering:
  - Create: basic creation, auto-increment IDs
  - FindByBoardId: ordered results, empty results, isolation between boards
  - FindById: found and not-found cases
  - Update: name only, position only, both fields, non-existent column
  - Delete: successful deletion, non-existent column
  - Cascade delete: verify columns deleted when board deleted

**Coverage target**: 100% on ColumnRepository

### Integration Tests (API Layer)
- **columns.test.ts** (nested under boards): 8+ test cases covering:
  - GET: list columns ordered by position, empty array, 404 for non-existent board, 400 for invalid ID
  - POST: create with auto position, append to end, 400 for missing/empty name, 400 for malformed JSON, 404 for non-existent board, 400 for invalid board ID

- **[id].test.ts** (columns by ID): 10+ test cases covering:
  - PATCH: update name, update position, 404 for non-existent column, 400 for invalid ID/JSON/empty name/invalid position
  - DELETE: successful deletion (204), 404 for non-existent column, 400 for invalid ID

**Coverage target**: >80% on all API route files

### Manual Testing (UI)
Since UI components use React with client-side state, automated testing is deferred to a future polish phase. Manual verification checklist:

- [ ] Navigate from home to board detail page
- [ ] Add new column via form
- [ ] Rename column inline
- [ ] Delete column with confirmation
- [ ] Reorder columns with up/down buttons
- [ ] Verify empty state message
- [ ] Verify error messages display correctly
- [ ] Test on mobile viewport (responsive layout)

### Test Execution Commands
```bash
npm test                # Run all tests
npm run test:watch      # TDD workflow
npm run test:coverage   # Generate coverage report (inspect before review)
```

---

## Risk Assessment

### Medium Risks

**Risk**: Cascade delete not working if foreign keys disabled
**Mitigation**: better-sqlite3 enables `PRAGMA foreign_keys = ON` by default. Add explicit test in `ColumnRepository.test.ts` to verify cascade behavior.

**Risk**: Position conflicts during concurrent reordering
**Mitigation**: Phase 2 uses simple integer positions with swap logic. For single-user application, concurrency unlikely. Document as known limitation; can address with optimistic locking in future phase if needed.

### Low Risks

**Risk**: Long column names breaking layout
**Mitigation**: CSS truncation (`overflow: hidden; text-overflow: ellipsis`) can be added in polish phase. Not blocking for Phase 2.

**Risk**: Many columns (>10) causing horizontal scroll confusion
**Mitigation**: Acceptable UX for Phase 2. Can add pagination or virtual scrolling in future phase if needed.

---

## Documentation Updates

After implementation completes, update:

**CLAUDE.md**:
- Add section on Column entity and ColumnRepository
- Document nested API route pattern (`/api/boards/:boardId/columns`)
- Document foreign key cascade behavior and testing approach
- Update project structure to mention board detail page route
- Add note on column reordering strategy (integer position with swap)

**README.md**:
- Update project status to "Phase 2 complete — board and column management"
- Add column CRUD features to feature list
- Mention column reordering capability

---

## References

### External Resources
- [SQLite Foreign Key Support](https://sqlite.org/foreignkeys.html) — ON DELETE CASCADE syntax
- [SQLite Forum: Maintaining arbitrary order](https://sqlite.org/forum/info/65a52ad3def88fd0) — Position field strategies
- [Astro SSR Documentation](https://www.luisllamas.es/en/astro-ssr-server-side-rendering/) — Dynamic routes with SSR
- [Astro Routing Guide](https://docs.astro.build/en/guides/routing/) — Dynamic route parameters

### Internal Patterns
- Phase 1 patterns: `BoardRepository`, API routes, test structure
- REFLECTIONS.md: Lessons learned (vertical slices, test coverage discipline, mock-for-infrastructure pattern)
