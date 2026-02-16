# Phase 1 — Research & Technical Decisions

## Overview
This document captures research findings and technical decisions for Phase 1: Foundation & Database Layer.

---

## 1. Astro 5 Setup

### Framework Choice
**Astro 5** with SSR (Server-Side Rendering) mode is ideal for this project because:
- Built-in API routes (`src/pages/api/`) for backend endpoints
- React islands architecture allows interactive components while keeping bundle size minimal
- SSR mode enables dynamic server-side operations with SQLite
- Excellent TypeScript support out of the box

### Configuration Decisions
- **Output mode**: `server` (enables SSR and API routes)
- **Adapter**: `@astrojs/node` for standalone Node.js deployment
- **Integration**: `@astrojs/react` for interactive islands
- **TypeScript**: Strict mode for maximum type safety

### Package Manager
Use **npm** (standard with Node.js ecosystem, good compatibility with better-sqlite3 native bindings)

---

## 2. Database Layer — SQLite with better-sqlite3

### Library Choice: better-sqlite3 vs Alternatives

**Selected: better-sqlite3**
- **Pros**:
  - Synchronous API (simpler code, no async/await complexity for local operations)
  - Faster than async SQLite libraries for local use cases
  - Excellent performance with prepared statements
  - Mature, well-maintained package
  - Works seamlessly in Node.js/Astro API routes
- **Cons**:
  - Requires native compilation (node-gyp)
  - Won't work in edge/serverless environments (not a concern for local-first app)

**Alternatives Considered**:
- `sql.js` (WASM-based, slower, less feature-complete)
- `better-sqlite3-multiple-ciphers` (adds unnecessary encryption overhead)
- Native Node.js SQLite bindings (less ergonomic API)

### Schema Design

#### Boards Table
```sql
CREATE TABLE boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Columns Table
```sql
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
```

#### Cards Table
```sql
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

**Key Design Decisions**:
- Use `INTEGER PRIMARY KEY AUTOINCREMENT` for auto-generated IDs
- `ON DELETE CASCADE` ensures cleanup when parent entities are deleted
- `position` field uses integers for flexible ordering (allows inserting between items)
- Indexes on foreign keys + position for efficient queries
- `color` stored as TEXT (hex color codes like "#FF5733")

### Migration System Design

**Approach**: File-based migrations with version tracking

```
db/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_add_card_colors.sql (future)
│   └── ...
├── swimlanes.db (gitignored)
└── init.ts (handles migration logic)
```

**Migration Tracking**:
```sql
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Logic**:
1. On app startup, read all `.sql` files in `db/migrations/` (sorted alphabetically)
2. Check which migrations have been applied via `migrations` table
3. Execute unapplied migrations in order within transactions
4. Record successful migrations

---

## 3. Repository Pattern

### Pattern Justification
The repository pattern provides:
- **Separation of concerns**: Data access logic isolated from business/API logic
- **Testability**: Easy to mock repositories in tests
- **Consistency**: Single source of truth for database operations
- **Type safety**: Strong TypeScript interfaces for entities

### Repository Structure

```typescript
// Example: BoardRepository interface
export interface Board {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export class BoardRepository {
  constructor(private db: Database) {}

  findAll(): Board[]
  findById(id: number): Board | undefined
  create(name: string): Board
  update(id: number, name: string): Board | undefined
  delete(id: number): boolean
}
```

**Key Decisions**:
- Use classes (not just functions) for repositories to encapsulate database connection
- Methods return domain objects (typed interfaces), not raw database rows
- Use `undefined` for "not found" cases (not `null`)
- Prepared statements for all queries (prevent SQL injection, improve performance)

### Transaction Support
For operations that modify multiple tables (e.g., moving a card between columns with reordering):
```typescript
const updateCardPosition = db.transaction((cardId, newColumnId, newPosition) => {
  // Multiple statements executed atomically
});
```

---

## 4. Testing Strategy

### Framework: Vitest

**Why Vitest**:
- Built by Vite team, excellent Astro compatibility
- Fast with smart watch mode
- Compatible with Jest API (familiar to most developers)
- Built-in TypeScript support
- Native ESM support

**Installation**:
```bash
npm install -D vitest
```

### Test Database Strategy
- **In-memory databases**: Each test gets fresh `:memory:` SQLite instance
- **Isolation**: No shared state between tests
- **Setup/teardown**: Helper utilities to initialize schema before each test

```typescript
// Test helper example
export function createTestDb(): Database {
  const db = new Database(':memory:');
  // Apply schema
  runMigrations(db);
  return db;
}
```

### Coverage Goals
- **100% repository coverage**: All CRUD operations tested
- **Edge cases**: Not found, constraint violations, cascading deletes
- **Success and error paths**: Both happy path and error handling

### Test File Organization
```
src/
├── repositories/
│   ├── BoardRepository.ts
│   ├── BoardRepository.test.ts
│   ├── ColumnRepository.ts
│   ├── ColumnRepository.test.ts
│   ├── CardRepository.ts
│   └── CardRepository.test.ts
└── db/
    └── testHelpers.ts
```

---

## 5. API Route Design

### Astro API Routes
Astro's file-based routing in `src/pages/api/` automatically creates endpoints:

```
src/pages/api/
├── boards/
│   ├── index.ts          → GET/POST /api/boards
│   └── [id].ts           → GET/PUT/DELETE /api/boards/:id
├── columns/
│   └── [id].ts           → (Phase 2+)
└── cards/
    └── [id].ts           → (Phase 2+)
```

### HTTP Method Handling
Each route file exports handler functions:

```typescript
// src/pages/api/boards/index.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
  // Handle GET request
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  // Handle POST request
};
```

### Response Format Standards
**Success Response (200, 201)**:
```json
{
  "data": { /* entity or array */ }
}
```

**Error Response (400, 404, 500)**:
```json
{
  "error": "Human-readable error message"
}
```

### Status Code Guidelines
- `200 OK`: Successful GET/PUT
- `201 Created`: Successful POST
- `204 No Content`: Successful DELETE
- `400 Bad Request`: Invalid input
- `404 Not Found`: Resource doesn't exist
- `500 Internal Server Error`: Unexpected errors

### Input Validation
Use simple validation (no heavy libraries for Phase 1):
```typescript
async function parseCreateBoardRequest(request: Request) {
  const body = await request.json();
  if (!body.name || typeof body.name !== 'string') {
    throw new Error('Invalid board name');
  }
  return { name: body.name.trim() };
}
```

---

## 6. Project Structure

```
swimlanes/
├── src/
│   ├── pages/
│   │   ├── api/
│   │   │   └── boards/
│   │   │       ├── index.ts
│   │   │       └── [id].ts
│   │   └── index.astro (placeholder page)
│   ├── components/ (empty for Phase 1)
│   ├── repositories/
│   │   ├── BoardRepository.ts
│   │   ├── ColumnRepository.ts
│   │   ├── CardRepository.ts
│   │   └── *.test.ts
│   ├── db/
│   │   ├── init.ts (database initialization)
│   │   ├── migrate.ts (migration runner)
│   │   └── testHelpers.ts
│   └── types/
│       └── entities.ts (shared TypeScript types)
├── db/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── swimlanes.db (gitignored)
├── astro.config.mjs
├── tsconfig.json
├── tailwind.config.cjs
├── vitest.config.ts
├── package.json
└── .gitignore
```

---

## 7. Development Workflow

### NPM Scripts
```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Database Initialization
- On first `npm run dev`, initialize database if not exists
- Run migrations automatically on startup
- For tests, create fresh in-memory databases per test suite

---

## 8. Dependencies

### Production Dependencies
```json
{
  "astro": "^5.0.0",
  "@astrojs/node": "^9.0.0",
  "@astrojs/react": "^4.0.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "better-sqlite3": "^11.0.0"
}
```

### Development Dependencies
```json
{
  "@types/better-sqlite3": "^7.6.0",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "vitest": "^2.0.0",
  "typescript": "^5.6.0",
  "tailwindcss": "^3.4.0",
  "@astrojs/tailwind": "^6.0.0"
}
```

---

## 9. Key Technical Risks & Mitigations

### Risk: better-sqlite3 Native Compilation Issues
**Mitigation**: Ensure node-gyp prerequisites are documented. Most modern systems have build tools already. Fallback: Use Docker for consistent build environment.

### Risk: SQLite Locking in SSR Mode
**Mitigation**: better-sqlite3 handles locking well. Use transactions for multi-step operations. Single-user app reduces concurrency concerns.

### Risk: Migration System Complexity
**Mitigation**: Keep it simple — sequential SQL files, no down migrations for Phase 1. Add sophistication later if needed.

---

## 10. Acceptance Criteria Validation Plan

Each acceptance criterion will be validated through:

1. **Database & Schema**: Manual inspection + migration tests
2. **Data Access**: Comprehensive unit tests (100% coverage goal)
3. **Testing**: `npm test` must pass with 0 failures
4. **API Routes**: Manual testing with curl/HTTPie + potential integration tests
5. **Build & Development**: `npm run build` and `npm run dev` smoke tests

---

## 11. Implementation Order

Recommended sequence for Phase 1:

1. **Project initialization**
   - `npm create astro@latest` with SSR mode
   - Install dependencies
   - Configure Astro, TypeScript, Tailwind

2. **Database infrastructure**
   - Create migration system (`db/migrate.ts`)
   - Write initial schema migration (`001_initial_schema.sql`)
   - Create database initialization module (`src/db/init.ts`)

3. **Repository layer**
   - Define TypeScript types (`src/types/entities.ts`)
   - Implement `BoardRepository` with all CRUD methods
   - Implement `ColumnRepository` and `CardRepository`

4. **Testing setup**
   - Configure Vitest
   - Create test helpers (`src/db/testHelpers.ts`)
   - Write tests for all repositories

5. **API routes**
   - Implement board endpoints (`src/pages/api/boards/`)
   - Test with curl/HTTP client

6. **Final validation**
   - Run full test suite
   - Test build process
   - Manual API testing

---

## 12. Open Questions / Decisions Needed

### Q1: Color Palette for Cards
**Decision**: Store colors as hex codes (e.g., "#FF5733"). UI will provide predefined palette later. For now, accept any valid hex color.

### Q2: Position Field Implementation
**Decision**: Use simple integer positions (0, 1, 2, ...). When inserting/reordering, update positions of affected items. Alternative (fractional positions) adds complexity without clear benefit at this stage.

### Q3: Updated_at Automation
**Decision**: Use SQLite triggers or application-level updates. **Recommendation**: Application-level (repository methods explicitly set `updated_at = CURRENT_TIMESTAMP`) for clarity and testability.

---

## Summary

Phase 1 establishes a solid foundation:
- ✅ Modern, performant tech stack (Astro 5, better-sqlite3)
- ✅ Clean architecture (repository pattern, separation of concerns)
- ✅ Robust testing strategy (Vitest, 100% repository coverage)
- ✅ Extensible migration system
- ✅ RESTful API design

This foundation supports iterative development in subsequent phases while maintaining code quality and type safety throughout.
