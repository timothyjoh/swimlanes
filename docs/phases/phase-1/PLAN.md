# Phase 1 — Implementation Plan

## Overview
This plan details the step-by-step implementation approach for Phase 1: Foundation & Database Layer. The goal is to establish the project scaffolding, SQLite database infrastructure, repository layer, and basic API routes.

---

## Implementation Order

### Step 1: Project Initialization
**Goal**: Create Astro 5 project with all necessary dependencies and configuration

**Files to Create/Modify**:
- `package.json` — project metadata and dependencies
- `astro.config.mjs` — Astro configuration (SSR mode, Node adapter, React integration)
- `tsconfig.json` — TypeScript strict mode configuration
- `tailwind.config.cjs` — Tailwind CSS configuration
- `vitest.config.ts` — Vitest test framework configuration
- `.gitignore` — ignore node_modules, db files, build artifacts

**Actions**:
1. Initialize Astro project with SSR template:
   ```bash
   npm create astro@latest . -- --template minimal --typescript strict
   ```
2. Install production dependencies:
   ```bash
   npm install @astrojs/node @astrojs/react @astrojs/tailwind react react-dom better-sqlite3
   ```
3. Install development dependencies:
   ```bash
   npm install -D @types/better-sqlite3 @types/react @types/react-dom vitest tailwindcss
   ```
4. Configure Astro for SSR mode with Node adapter and React integration
5. Set up Tailwind CSS with Astro integration
6. Configure Vitest for testing
7. Add npm scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `test:coverage`

**Validation**:
- `npm run dev` starts development server successfully
- TypeScript compiles without errors

---

### Step 2: Database Schema & Migration System
**Goal**: Create SQLite database infrastructure with version-controlled migrations

**Files to Create**:
- `db/migrations/001_initial_schema.sql` — initial database schema with boards, columns, cards tables
- `src/db/migrate.ts` — migration runner that applies unapplied migrations
- `src/db/init.ts` — database initialization and connection management
- `.gitignore` — add `db/*.db` to ignore SQLite database files

**Migration SQL** (`001_initial_schema.sql`):
```sql
-- Migrations tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Boards table
CREATE TABLE boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Columns table (swim lanes)
CREATE TABLE columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE INDEX idx_columns_board_id ON columns(board_id);
CREATE INDEX idx_columns_position ON columns(board_id, position);

-- Cards table
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT,
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_position ON cards(column_id, position);
```

**Migration Runner Logic** (`migrate.ts`):
1. Read all `.sql` files from `db/migrations/` directory (sorted alphabetically)
2. Query `migrations` table for already-applied migrations
3. Execute unapplied migrations in order within transactions
4. Record successful migrations in `migrations` table
5. Handle errors gracefully with rollback

**Database Initialization** (`init.ts`):
1. Export singleton database instance
2. Create database file at `db/swimlanes.db` if not exists
3. Enable foreign key constraints: `PRAGMA foreign_keys = ON`
4. Run migrations on startup
5. Export `getDb()` function for repository access

**Actions**:
1. Create directory structure: `db/migrations/`
2. Write initial schema migration SQL
3. Implement migration runner with transaction support
4. Implement database initialization module
5. Add database file to `.gitignore`

**Validation**:
- Database file is created on first run
- Migrations table is created and tracks applied migrations
- All tables, indexes, and foreign key constraints exist
- Running migrations multiple times is idempotent (no errors)

---

### Step 3: TypeScript Type Definitions
**Goal**: Define TypeScript interfaces for all entities

**Files to Create**:
- `src/types/entities.ts` — TypeScript interfaces for Board, Column, Card

**Type Definitions**:
```typescript
export interface Board {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: number;
  board_id: number;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

// Extended types for nested queries
export interface BoardWithColumns extends Board {
  columns: ColumnWithCards[];
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}
```

**Actions**:
1. Create `src/types/entities.ts`
2. Define all entity interfaces matching database schema
3. Define extended types for nested data structures

**Validation**:
- TypeScript compiles without errors
- All fields match database schema exactly

---

### Step 4: Repository Layer — BoardRepository
**Goal**: Implement BoardRepository with full CRUD operations

**Files to Create**:
- `src/repositories/BoardRepository.ts` — BoardRepository class
- `src/repositories/BoardRepository.test.ts` — comprehensive unit tests

**BoardRepository Methods**:
- `findAll(): Board[]` — get all boards
- `findById(id: number): Board | undefined` — get single board by id
- `findByIdWithColumns(id: number): BoardWithColumns | undefined` — get board with nested columns and cards
- `create(name: string): Board` — create new board
- `update(id: number, name: string): Board | undefined` — update board name
- `delete(id: number): boolean` — delete board (cascades to columns and cards)

**Implementation Details**:
- Use prepared statements for all queries
- Set `updated_at = CURRENT_TIMESTAMP` on updates
- Return `undefined` for not-found cases
- Use transactions for complex operations if needed

**Testing Strategy**:
- Test happy path for all CRUD operations
- Test edge cases: not found, empty results, constraint violations
- Test cascading deletes (deleting board removes columns and cards)
- Use in-memory SQLite database (`:memory:`) for test isolation
- Create test helper: `createTestDb()` that initializes schema

**Actions**:
1. Implement `BoardRepository` class with all methods
2. Create test helper in `src/db/testHelpers.ts`:
   ```typescript
   export function createTestDb(): Database {
     const db = new Database(':memory:');
     db.pragma('foreign_keys = ON');
     runMigrations(db);
     return db;
   }
   ```
3. Write comprehensive tests for all repository methods
4. Achieve 100% code coverage for repository

**Validation**:
- All tests pass (`npm test`)
- 100% coverage for BoardRepository
- TypeScript compiles without errors

---

### Step 5: Repository Layer — ColumnRepository
**Goal**: Implement ColumnRepository with CRUD and reordering operations

**Files to Create**:
- `src/repositories/ColumnRepository.ts` — ColumnRepository class
- `src/repositories/ColumnRepository.test.ts` — comprehensive unit tests

**ColumnRepository Methods**:
- `findAll(): Column[]` — get all columns
- `findById(id: number): Column | undefined` — get single column by id
- `findByBoardId(boardId: number): Column[]` — get all columns for a board (ordered by position)
- `create(boardId: number, name: string, position: number): Column` — create new column
- `update(id: number, name: string): Column | undefined` — update column name
- `updatePosition(id: number, newPosition: number): boolean` — reorder column within board
- `delete(id: number): boolean` — delete column (cascades to cards)

**Implementation Details**:
- Position management: when creating/deleting/reordering columns, ensure positions are contiguous (0, 1, 2, ...)
- Use transactions for position updates affecting multiple columns
- Set `updated_at = CURRENT_TIMESTAMP` on updates

**Testing Strategy**:
- Test all CRUD operations
- Test position management and reordering logic
- Test cascading deletes (deleting column removes cards)
- Test foreign key constraint (invalid board_id)

**Actions**:
1. Implement `ColumnRepository` class
2. Write comprehensive tests
3. Achieve 100% code coverage

**Validation**:
- All tests pass
- 100% coverage for ColumnRepository
- Position logic works correctly (no gaps, proper reordering)

---

### Step 6: Repository Layer — CardRepository
**Goal**: Implement CardRepository with CRUD, moving, and reordering operations

**Files to Create**:
- `src/repositories/CardRepository.ts` — CardRepository class
- `src/repositories/CardRepository.test.ts` — comprehensive unit tests

**CardRepository Methods**:
- `findAll(): Card[]` — get all cards
- `findById(id: number): Card | undefined` — get single card by id
- `findByColumnId(columnId: number): Card[]` — get all cards in a column (ordered by position)
- `create(columnId: number, title: string, description?: string, color?: string, position?: number): Card` — create new card
- `update(id: number, updates: Partial<Pick<Card, 'title' | 'description' | 'color'>>): Card | undefined` — update card fields
- `move(id: number, targetColumnId: number, targetPosition: number): boolean` — move card to different column/position
- `updatePosition(id: number, newPosition: number): boolean` — reorder card within same column
- `delete(id: number): boolean` — delete card

**Implementation Details**:
- Position management: ensure positions are contiguous within each column
- `move()` method uses transaction (update positions in source column, move card, update positions in target column)
- Validate color format if provided (hex codes like "#FF5733")
- Set `updated_at = CURRENT_TIMESTAMP` on updates

**Testing Strategy**:
- Test all CRUD operations
- Test position management within single column
- Test moving cards between columns with position updates
- Test foreign key constraint (invalid column_id)
- Test partial updates (only changing title, or only color, etc.)

**Actions**:
1. Implement `CardRepository` class
2. Write comprehensive tests
3. Achieve 100% code coverage

**Validation**:
- All tests pass
- 100% coverage for CardRepository
- Move and reorder logic works correctly

---

### Step 7: API Routes — Boards
**Goal**: Create RESTful API endpoints for board operations

**Files to Create**:
- `src/pages/api/boards/index.ts` — GET /api/boards, POST /api/boards
- `src/pages/api/boards/[id].ts` — GET /api/boards/:id, PUT /api/boards/:id, DELETE /api/boards/:id

**Endpoint Specifications**:

#### `GET /api/boards`
- Returns array of all boards
- Response: `{ data: Board[] }`
- Status: 200

#### `POST /api/boards`
- Request body: `{ name: string }`
- Creates new board
- Response: `{ data: Board }`
- Status: 201
- Error: 400 if name is missing/invalid

#### `GET /api/boards/:id`
- Returns single board with nested columns and cards
- Response: `{ data: BoardWithColumns }`
- Status: 200
- Error: 404 if board not found

#### `PUT /api/boards/:id`
- Request body: `{ name: string }`
- Updates board name
- Response: `{ data: Board }`
- Status: 200
- Error: 404 if board not found, 400 if name invalid

#### `DELETE /api/boards/:id`
- Deletes board and all associated columns/cards
- Response: empty (204 No Content)
- Status: 204
- Error: 404 if board not found

**Implementation Details**:
- Use Astro's `APIRoute` type for type safety
- Parse JSON request bodies with error handling
- Return consistent response format (see RESEARCH.md section 5)
- Use repository layer for all database operations
- Add input validation (non-empty strings, valid IDs)

**Error Handling**:
```typescript
try {
  // operation
} catch (error) {
  console.error('Error in API route:', error);
  return new Response(
    JSON.stringify({ error: 'Internal server error' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}
```

**Actions**:
1. Create `src/pages/api/boards/index.ts` with GET and POST handlers
2. Create `src/pages/api/boards/[id].ts` with GET, PUT, DELETE handlers
3. Add input validation helpers
4. Test all endpoints manually with curl or HTTP client

**Validation**:
- All endpoints return correct status codes
- Responses follow consistent JSON format
- Invalid input returns 400 with error message
- Not found cases return 404
- Manual testing with curl confirms functionality

---

### Step 8: Placeholder Homepage
**Goal**: Create minimal homepage to verify Astro is serving correctly

**Files to Create**:
- `src/pages/index.astro` — simple placeholder page

**Content**:
```astro
---
// src/pages/index.astro
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SwimLanes</title>
</head>
<body class="bg-gray-100 p-8">
  <h1 class="text-4xl font-bold text-gray-800">SwimLanes</h1>
  <p class="mt-4 text-gray-600">Kanban board app coming soon...</p>
  <p class="mt-2 text-sm text-gray-500">API endpoints available at /api/boards</p>
</body>
</html>
```

**Actions**:
1. Create basic Astro page with Tailwind classes
2. Verify page renders in browser at http://localhost:4321

**Validation**:
- Page loads without errors
- Tailwind styles are applied
- No console errors

---

### Step 9: Final Integration & Testing
**Goal**: Ensure all components work together and pass acceptance criteria

**Actions**:
1. Run full test suite: `npm test` — all tests must pass
2. Run build: `npm run build` — must complete without errors
3. Manual API testing with curl/HTTPie:
   ```bash
   # Create board
   curl -X POST http://localhost:4321/api/boards \
     -H "Content-Type: application/json" \
     -d '{"name":"My First Board"}'

   # Get all boards
   curl http://localhost:4321/api/boards

   # Get board by ID
   curl http://localhost:4321/api/boards/1

   # Update board
   curl -X PUT http://localhost:4321/api/boards/1 \
     -H "Content-Type: application/json" \
     -d '{"name":"Updated Board Name"}'

   # Delete board
   curl -X DELETE http://localhost:4321/api/boards/1
   ```
4. Verify database persistence (restart dev server, data should persist)
5. Check for TypeScript errors: `npx tsc --noEmit`
6. Review all acceptance criteria from SPEC.md

**Validation**:
- ✅ All tests pass
- ✅ Build succeeds
- ✅ All API endpoints work as expected
- ✅ Data persists across server restarts
- ✅ No TypeScript errors
- ✅ No console errors or warnings

---

## Test Strategy

### Unit Tests (Repositories)
**Scope**: 100% coverage for all repository methods

**Approach**:
- Use Vitest with in-memory SQLite databases
- Each test suite gets fresh database instance
- Test helper creates and initializes test database
- Test both success and error paths
- Test edge cases (not found, constraint violations, cascading deletes)

**Test Structure**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../db/testHelpers';
import { BoardRepository } from './BoardRepository';

describe('BoardRepository', () => {
  let db: Database;
  let repo: BoardRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new BoardRepository(db);
  });

  it('creates a new board', () => {
    const board = repo.create('Test Board');
    expect(board.name).toBe('Test Board');
    expect(board.id).toBeGreaterThan(0);
  });

  it('returns undefined for non-existent board', () => {
    const board = repo.findById(999);
    expect(board).toBeUndefined();
  });

  // ... more tests
});
```

### Integration Tests (API Routes)
**Scope**: Manual testing for Phase 1 (automated API tests in Phase 2+)

**Approach**:
- Use curl or HTTPie to test all endpoints
- Verify correct status codes and response formats
- Test error cases (invalid input, not found)
- Verify data persistence

### Manual Testing Checklist
- [ ] Create board via POST /api/boards
- [ ] List boards via GET /api/boards
- [ ] Get single board via GET /api/boards/:id
- [ ] Update board via PUT /api/boards/:id
- [ ] Delete board via DELETE /api/boards/:id
- [ ] Verify 404 for non-existent board
- [ ] Verify 400 for invalid input
- [ ] Restart server and verify data persists

---

## Files Summary

### New Files to Create
```
src/
├── db/
│   ├── init.ts                      — database initialization and connection
│   ├── migrate.ts                   — migration runner
│   └── testHelpers.ts               — test database utilities
├── types/
│   └── entities.ts                  — TypeScript entity interfaces
├── repositories/
│   ├── BoardRepository.ts           — board data access layer
│   ├── BoardRepository.test.ts      — board repository tests
│   ├── ColumnRepository.ts          — column data access layer
│   ├── ColumnRepository.test.ts     — column repository tests
│   ├── CardRepository.ts            — card data access layer
│   └── CardRepository.test.ts       — card repository tests
├── pages/
│   ├── index.astro                  — placeholder homepage
│   └── api/
│       └── boards/
│           ├── index.ts             — GET/POST /api/boards
│           └── [id].ts              — GET/PUT/DELETE /api/boards/:id
db/
└── migrations/
    └── 001_initial_schema.sql       — initial database schema

```

### Configuration Files to Create/Modify
- `package.json` — dependencies and scripts
- `astro.config.mjs` — Astro SSR configuration
- `tsconfig.json` — TypeScript configuration
- `tailwind.config.cjs` — Tailwind CSS configuration
- `vitest.config.ts` — Vitest test configuration
- `.gitignore` — ignore db/*.db, node_modules, build artifacts

---

## Success Criteria

Phase 1 is complete when:
- [x] Project structure is set up with Astro 5, TypeScript, Tailwind
- [x] SQLite database is initialized with schema and migration system
- [x] All three repositories (Board, Column, Card) are implemented and tested
- [x] All repository tests pass with 100% coverage
- [x] Board API endpoints are implemented and functional
- [x] Manual API testing confirms all endpoints work correctly
- [x] `npm run dev` starts server without errors
- [x] `npm run build` completes successfully
- [x] `npm test` passes all tests
- [x] Data persists across server restarts
- [x] No TypeScript errors
- [x] All acceptance criteria from SPEC.md are met

---

## Risk Mitigation

### Risk: better-sqlite3 Compilation Issues
**Mitigation**: Document prerequisites (build tools). Most systems have these already. Can use Docker if needed.

### Risk: Migration System Complexity
**Mitigation**: Keep it simple — sequential SQL files, apply in order, track in migrations table. No rollback for Phase 1.

### Risk: Position Management Bugs
**Mitigation**: Comprehensive tests for reordering and moving operations. Use transactions for multi-step position updates.

### Risk: API Input Validation
**Mitigation**: Simple validation (check required fields, types). Use TypeScript for type safety. Add more robust validation later if needed.

---

## Next Phase Preview

Phase 2 will focus on:
- UI layer with Astro pages displaying boards
- React islands for interactive components (columns, cards)
- API endpoints for columns and cards
- Basic styling with Tailwind CSS

Phase 1 provides the complete backend foundation for Phase 2's frontend work.
