# Implementation Plan: Phase 1

## Overview
Deliver the foundational vertical slice of SwimLanes: scaffold the full Astro 5 + React + SQLite + Tailwind stack, implement board CRUD (create, list, rename, delete) end-to-end with API routes and a React island, set up Vitest with coverage, and produce project documentation.

## Current State (from Research)
This is a **greenfield project**. The repository contains only `BRIEF.md`, the phase-1 spec, and pipeline files. There are no source files, no `package.json`, no configuration, no tests, and no documentation. Everything will be established in this phase.

## Desired End State
After this phase:
- `npm run dev` starts an Astro SSR app showing a home page with a board list
- Users can create, rename, and delete boards via the UI (React island)
- All board data persists in SQLite (`db/swimlanes.db`)
- API routes handle CRUD with proper HTTP status codes
- `npm test` runs Vitest with 80%+ coverage on `src/lib/`
- CLAUDE.md, AGENTS.md, and README.md exist and are accurate

**Verification**: Run `npm run dev`, create/rename/delete boards in the browser, restart the server, confirm boards persist. Run `npm test` and confirm all pass with coverage targets met.

## What We're NOT Doing
- Board detail/view page (just the listing)
- Columns, swim lanes, or cards (Phase 2+)
- Drag and drop (Phase 3+)
- Color labels, descriptions, or card-level features
- Mobile-specific layout refinements beyond default Tailwind responsiveness
- Authentication or multi-user support
- Any CSS files — Tailwind only
- Server-side rendering of React components (React is client-only islands)

## Implementation Approach
Build bottom-up in vertical slices: project scaffolding first, then database layer with tests, then API routes with tests, then UI, then documentation. Each task produces testable/verifiable output before moving to the next.

### Open Questions Resolved
1. **Tailwind v4 integration**: Use `@tailwindcss/vite` plugin directly in Astro config (the `@astrojs/tailwind` integration is deprecated). Create `src/styles/global.css` with `@import "tailwindcss"`.
2. **Testing API routes**: Test API route handler functions by importing them directly and calling them with mock `Request` objects — no test server needed. Astro API routes export functions like `GET`, `POST` that accept `APIContext`, making them unit-testable.
3. **better-sqlite3 in Vitest**: Since Vitest runs in Node by default and better-sqlite3 is a Node native module, it should work without special config. Set the test environment to `"node"` explicitly in vitest config.

---

## Task 1: Project Scaffolding

### Overview
Initialize the Astro 5 project with all dependencies, configuration files, and directory structure.

### Changes Required

**Action**: Create new Astro project and install dependencies
```bash
npm create astro@latest . -- --template minimal --typescript strict --install --no-git
npm install @astrojs/react @astrojs/node react react-dom better-sqlite3
npm install -D @types/better-sqlite3 tailwindcss @tailwindcss/vite vitest @vitest/coverage-v8
```

**File**: `astro.config.mjs`
```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
```

**File**: `vitest.config.ts`
```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

**File**: `src/styles/global.css`
```css
@import "tailwindcss";
```

**File**: `src/layouts/Layout.astro`
A base layout that imports `global.css`, sets up HTML boilerplate with `<slot />`.

**File**: `src/pages/index.astro`
A minimal home page using `Layout.astro` that renders a placeholder heading.

**File**: `tsconfig.json`
Update to include `"jsx": "react-jsx"` and any necessary path aliases.

**Action**: Add scripts to `package.json`:
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

**Directories to create**: `db/migrations/`, `src/lib/db/`, `src/components/`, `src/pages/api/boards/`

### Success Criteria
- [ ] `npm run dev` starts without errors and shows the home page at localhost:4321
- [ ] Tailwind classes work in the rendered page
- [ ] `npm test` runs (no tests yet, exits cleanly)
- [ ] TypeScript compiles without errors
- [ ] Directory structure matches spec requirements

---

## Task 2: Database Layer with Migrations

### Overview
Set up SQLite database, migration system, board repository with full CRUD, and unit tests for the data layer.

### Changes Required

**File**: `db/migrations/001_create_boards.sql`
```sql
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**File**: `src/lib/db/connection.ts`
- Export a function `getDb()` that returns a `better-sqlite3` Database instance (singleton)
- Database file path: `db/swimlanes.db`
- On first call, run all migrations from `db/migrations/` in order
- Use a `_migrations` table to track which migrations have been applied

```ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.resolve("db/swimlanes.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  const migrationsDir = path.resolve("db/migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
  const applied = new Set(
    db.prepare("SELECT name FROM _migrations").all().map((r: any) => r.name)
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(file);
  }
}

// For testing: close and reset the singleton
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**File**: `src/lib/db/boards.ts`
- Export `BoardRepository` object with functions: `create(name)`, `list()`, `getById(id)`, `rename(id, name)`, `remove(id)`
- All functions use `getDb()` internally
- Validate: name must be non-empty trimmed string
- Return types use a `Board` interface

```ts
import { getDb } from "./connection";

export interface Board {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export function createBoard(name: string): Board {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Board name cannot be empty");

  const db = getDb();
  const result = db.prepare(
    "INSERT INTO boards (name) VALUES (?)"
  ).run(trimmed);

  return getBoardById(Number(result.lastInsertRowid))!;
}

export function listBoards(): Board[] {
  return getDb().prepare("SELECT * FROM boards ORDER BY created_at DESC").all() as Board[];
}

export function getBoardById(id: number): Board | undefined {
  return getDb().prepare("SELECT * FROM boards WHERE id = ?").get(id) as Board | undefined;
}

export function renameBoard(id: number, name: string): Board | undefined {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Board name cannot be empty");

  const db = getDb();
  const result = db.prepare(
    "UPDATE boards SET name = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(trimmed, id);

  if (result.changes === 0) return undefined;
  return getBoardById(id);
}

export function deleteBoard(id: number): boolean {
  const result = getDb().prepare("DELETE FROM boards WHERE id = ?").run(id);
  return result.changes > 0;
}
```

**File**: `src/lib/db/__tests__/boards.test.ts`
```ts
// Tests use an in-memory or temp-file database
// Before each: set up fresh DB with migrations
// After each: close DB

// Test cases:
// - createBoard: creates and returns board with id, name, timestamps
// - createBoard: trims whitespace from name
// - createBoard: throws on empty name
// - createBoard: throws on whitespace-only name
// - listBoards: returns empty array when no boards
// - listBoards: returns boards in reverse-chronological order
// - getBoardById: returns board when exists
// - getBoardById: returns undefined for nonexistent id
// - renameBoard: updates name and updated_at
// - renameBoard: returns undefined for nonexistent id
// - renameBoard: throws on empty name
// - deleteBoard: returns true when board deleted
// - deleteBoard: returns false for nonexistent id
```

**Testing approach**: For tests, override the database path to use a temp file (or modify `connection.ts` to accept a path option for testing). Use `beforeEach`/`afterEach` to create a fresh DB per test. No mocking needed — test against real SQLite.

### Success Criteria
- [ ] Migration runs and creates `boards` table
- [ ] All board repository functions work correctly
- [ ] 13+ unit tests pass
- [ ] Coverage on `src/lib/db/` is 80%+

---

## Task 3: API Routes

### Overview
Create Astro API routes for board CRUD operations with proper HTTP status codes and error handling.

### Changes Required

**File**: `src/pages/api/boards/index.ts`
```ts
import type { APIRoute } from "astro";
import { createBoard, listBoards } from "../../../lib/db/boards";

// GET /api/boards — returns all boards
export const GET: APIRoute = async () => {
  const boards = listBoards();
  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// POST /api/boards — creates a new board
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const name = body?.name;

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(JSON.stringify({ error: "Name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const board = createBoard(name);
  return new Response(JSON.stringify(board), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
```

**File**: `src/pages/api/boards/[id].ts`
```ts
import type { APIRoute } from "astro";
import { renameBoard, deleteBoard, getBoardById } from "../../../lib/db/boards";

// PATCH /api/boards/:id — rename a board
export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const name = body?.name;

  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response(JSON.stringify({ error: "Name is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const board = renameBoard(id, name);
  if (!board) {
    return new Response(JSON.stringify({ error: "Board not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(board), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

// DELETE /api/boards/:id — delete a board
export const DELETE: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deleted = deleteBoard(id);
  if (!deleted) {
    return new Response(JSON.stringify({ error: "Board not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(null, { status: 204 });
};
```

**File**: `src/pages/api/boards/__tests__/boards-api.test.ts`
Test by importing the handler functions directly and calling them with constructed `Request` objects and mock `APIContext` params:

```ts
// Test cases:
// GET /api/boards
// - returns 200 with empty array when no boards
// - returns 200 with boards after creating some

// POST /api/boards
// - returns 201 with created board when name provided
// - returns 400 when name missing
// - returns 400 when name is empty string

// PATCH /api/boards/:id
// - returns 200 with updated board
// - returns 400 when name missing
// - returns 404 when board doesn't exist
// - returns 400 for invalid id

// DELETE /api/boards/:id
// - returns 204 on successful delete
// - returns 404 when board doesn't exist
// - returns 400 for invalid id
```

**Testing approach**: Import handler functions directly (`import { GET, POST } from "../index"`), call with `new Request(url, { method, body })` and a minimal params object `{ params: { id: "1" } }`. Uses real SQLite (temp DB per test, same pattern as Task 2).

### Success Criteria
- [ ] All 4 API endpoints return correct status codes
- [ ] Error cases return JSON error messages
- [ ] 12+ integration tests pass
- [ ] API correctly validates input (empty names, invalid IDs)

---

## Task 4: React Board List Component and Home Page

### Overview
Build the React island for board management (create, rename, delete) and integrate it into the Astro home page.

### Changes Required

**File**: `src/components/BoardList.tsx`
A React component that:
- Fetches boards from `GET /api/boards` on mount
- Displays boards in a list/grid
- Has a "Create Board" form (text input + submit button)
- On create: `POST /api/boards`, add returned board to state (no page reload)
- Each board shows its name with an "Edit" and "Delete" button
- Edit: inline text input, save on Enter/blur, cancel on Escape. Calls `PATCH /api/boards/:id`
- Delete: `window.confirm()` dialog, then `DELETE /api/boards/:id`
- Shows loading state on initial fetch
- Shows empty state when no boards exist

Key implementation details:
- Use `useState` for boards array, loading state, create form value, editing state
- Use `useEffect` for initial fetch
- All API calls use `fetch()` with proper error handling
- Styling with Tailwind utility classes only

```tsx
// Approximate structure:
export default function BoardList() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => { fetchBoards(); }, []);

  // fetchBoards, handleCreate, handleRename, handleDelete functions
  // Render: form + board list with inline edit and delete actions
}
```

**File**: `src/pages/index.astro`
Update to import and render `<BoardList client:load />` inside the Layout.

**File**: `src/components/__tests__/BoardList.test.tsx`
Smoke test that the component renders without crashing. Use a minimal setup — since this is a client component that calls `fetch`, the smoke test verifies the component mounts. No need for a full DOM testing library; just verify the module exports a function and can be called (or use `jsdom` environment for this one test file via `@vitest-environment jsdom` comment).

### Success Criteria
- [ ] Board list loads and displays boards from the API
- [ ] Create form adds a board to the list without page reload
- [ ] Inline rename works (Enter to save, Escape to cancel)
- [ ] Delete shows confirmation, removes board on confirm
- [ ] Empty state shown when no boards
- [ ] Component smoke test passes
- [ ] All Tailwind styling, no custom CSS

---

## Task 5: Documentation

### Overview
Create CLAUDE.md, AGENTS.md, and README.md with accurate project information.

### Changes Required

**File**: `CLAUDE.md`
```markdown
# SwimLanes

A Trello-like kanban board app. See AGENTS.md for project details and conventions.
```

**File**: `AGENTS.md`
Content covering:
- Project description
- Tech stack summary
- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`, `npm run test:coverage`
- Build: `npm run build`
- Project structure (src/pages, src/components, src/lib/db, db/migrations)
- Conventions: TypeScript strict, no `any`, Tailwind only, repository pattern, Vitest for tests
- Database: SQLite via better-sqlite3, migrations auto-applied on startup

**File**: `README.md`
Content covering:
- Project name and description
- Getting started (prerequisites, install, run)
- Available scripts
- Tech stack
- Project structure overview

### Success Criteria
- [ ] All three docs exist
- [ ] Commands documented in AGENTS.md actually work
- [ ] Project structure in docs matches actual structure

---

## Testing Strategy

### Unit Tests (`src/lib/db/__tests__/boards.test.ts`)
- All CRUD operations on boards
- Edge cases: empty names, whitespace-only names, nonexistent IDs
- Migration system applies SQL files in order
- Uses real SQLite (temp file per test), no mocking

### Integration Tests (`src/pages/api/boards/__tests__/boards-api.test.ts`)
- All API endpoints tested for success and error responses
- Validates HTTP status codes, response bodies, Content-Type headers
- Uses real SQLite, imports handler functions directly
- Minimal mocking: only construct `Request` objects and `params` — everything else is real

### Component Smoke Tests (`src/components/__tests__/BoardList.test.tsx`)
- Component module exports correctly
- Component renders without throwing (requires jsdom or happy-dom for this test file)
- No heavy DOM testing — this is a smoke test only

### Running Tests
- `npm test` — run all tests once
- `npm run test:coverage` — run with coverage report
- Coverage threshold: 80% on `src/lib/` (enforced in vitest config)

## Risk Assessment
- **Astro 5 + Tailwind v4 compatibility**: Low risk — this is the officially recommended setup since Astro 5.2. Mitigation: follow exact setup from Tailwind docs.
- **better-sqlite3 native compilation**: Low risk — standard Node native module. Mitigation: ensure Node version matches, `npm rebuild` if needed.
- **Testing API routes via direct import**: Medium risk — Astro handler signatures may need specific `APIContext` properties. Mitigation: inspect Astro's `APIRoute` type and construct minimal conforming objects for tests; if problematic, fall back to supertest with a running server.
- **Vitest + Astro config**: Low risk — Astro provides `getViteConfig` helper specifically for this. Mitigation: use official helper.
