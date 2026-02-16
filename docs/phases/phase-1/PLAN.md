# Implementation Plan: Phase 1

## Overview
Establish the complete project foundation by implementing the first vertical slice: a user can create a board and see it displayed on the home page. This proves the full stack (SQLite database, Astro API routes, React UI) works end-to-end with automated tests and comprehensive documentation.

## Current State (from Research)
- **Greenfield project** — only documentation exists (BRIEF.md, SPEC.md, pipeline scripts)
- **No source code** — no package.json, no src/ directory, no dependencies
- **Git repository initialized** — with .gitignore already configured for node_modules, .astro, dist, db/*.db
- **Clear architecture guidance** — BRIEF.md defines repository pattern, migration system, Astro SSR with React islands, RESTful API conventions

## Desired End State
After Phase 1 completion:
- User visits `http://localhost:4321` and sees the home page with a board creation form
- User creates a board, sees it appear immediately in the list
- Browser refresh shows persisted boards (data survives restart)
- `npm test` runs all tests with >80% coverage on repository and API layers
- `npm run dev` starts the development server successfully
- SQLite database file (`db/swimlanes.db`) is created automatically on first run
- Three documentation files (CLAUDE.md, AGENTS.md, README.md) guide developers and AI agents

**Verification:**
```bash
# Install and run
npm install
npm run dev  # visit http://localhost:4321

# Test suite
npm test
npm run test:coverage  # verify >80% coverage

# Database persistence
ls db/swimlanes.db  # file exists after first run
```

## What We're NOT Doing
- **No columns/swim lanes** — Phase 2 concern
- **No cards** — Phase 3 concern
- **No drag and drop** — later phases
- **No board editing/deletion** — future functionality
- **No responsive mobile layout** — basic desktop layout only
- **No authentication** — boards are public for now
- **No board metadata** — only name field, no descriptions/colors/etc
- **No error UI** — basic form validation only, detailed error handling comes later
- **No API versioning** — `/api/boards`, not `/api/v1/boards`
- **No database connection pooling** — better-sqlite3 is synchronous, single connection is sufficient
- **No separate dev/test/prod databases** — use same DB file for dev, in-memory for tests

## Implementation Approach
We'll build in vertical slices, each delivering end-to-end testable functionality:
1. **Project scaffold** — set up Astro + React + Tailwind, prove build works
2. **Database foundation** — SQLite migrations + repository layer with tests
3. **API layer** — RESTful endpoints with integration tests
4. **UI layer** — home page with board creation form and list view
5. **Documentation** — CLAUDE.md, AGENTS.md, README.md for developers and AI agents

Each slice builds on the previous one and includes tests, ensuring we can verify progress incrementally.

---

## Task 1: Project Scaffold

### Overview
Initialize the Astro project with React, TypeScript, Tailwind CSS, and Vitest. Verify the build system works and all dependencies are correctly configured.

### Changes Required

**Create `package.json`:**
```json
{
  "name": "swimlanes",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@astrojs/react": "^3.0.0",
    "@astrojs/tailwind": "^5.0.0",
    "astro": "^5.0.0",
    "better-sqlite3": "^11.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

**Create `astro.config.mjs`:**
```js
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',  // SSR mode for API routes
  integrations: [
    react(),
    tailwind()
  ],
  vite: {
    optimizeDeps: {
      exclude: ['better-sqlite3']  // native module, don't pre-bundle
    }
  }
});
```

**Create `tsconfig.json`:**
```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@db/*": ["./db/*"]
    }
  },
  "include": ["src/**/*", "db/**/*"],
  "exclude": ["node_modules", "dist", ".astro"]
}
```

**Create `vitest.config.ts`:**
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**/*.ts', 'src/pages/api/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts']
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@db': '/db'
    }
  }
});
```

**Create `tailwind.config.mjs`:**
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Create directory structure:**
```bash
mkdir -p src/pages/api
mkdir -p src/components
mkdir -p src/lib/repositories
mkdir -p src/lib/db
mkdir -p db/migrations
```

**Create `src/env.d.ts`:**
```ts
/// <reference types="astro/client" />
```

### Success Criteria
- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles successfully
- [ ] `npm run dev` starts server on http://localhost:4321
- [ ] TypeScript strict mode enabled in tsconfig.json
- [ ] Vitest config includes path aliases matching tsconfig
- [ ] Directory structure matches SPEC.md conventions
- [ ] No TypeScript compilation errors

---

## Task 2: Database Foundation

### Overview
Set up SQLite with migration system, create the boards table, and implement the repository pattern with comprehensive unit tests.

### Changes Required

**File**: `db/migrations/001_create_boards.sql`
```sql
-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for listing boards by creation date
CREATE INDEX idx_boards_created_at ON boards(created_at DESC);
```

**File**: `src/lib/db/connection.ts`
```ts
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../..');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbDir = join(projectRoot, 'db');
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const dbPath = join(dbDir, 'swimlanes.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');  // Better concurrency

    runMigrations(db);
  }
  return db;
}

export function getTestDb(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('journal_mode = WAL');
  runMigrations(testDb);
  return testDb;
}

function runMigrations(database: Database.Database): void {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = join(projectRoot, 'db/migrations');
  if (!existsSync(migrationsDir)) return;

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = database.prepare(
      'SELECT 1 FROM migrations WHERE filename = ?'
    ).get(file);

    if (!applied) {
      const sql = readdirSync(join(migrationsDir, file), 'utf-8');
      database.exec(sql);
      database.prepare('INSERT INTO migrations (filename) VALUES (?)').run(file);
      console.log(`Applied migration: ${file}`);
    }
  }
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**File**: `src/lib/db/types.ts`
```ts
export interface Board {
  id: number;
  name: string;
  created_at: string;
}

export interface NewBoard {
  name: string;
}
```

**File**: `src/lib/repositories/BoardRepository.ts`
```ts
import type Database from 'better-sqlite3';
import type { Board, NewBoard } from '../db/types';

export class BoardRepository {
  constructor(private db: Database.Database) {}

  create(board: NewBoard): Board {
    const stmt = this.db.prepare(
      'INSERT INTO boards (name) VALUES (?) RETURNING id, name, created_at'
    );
    return stmt.get(board.name) as Board;
  }

  findAll(): Board[] {
    const stmt = this.db.prepare(
      'SELECT id, name, created_at FROM boards ORDER BY created_at DESC'
    );
    return stmt.all() as Board[];
  }

  findById(id: number): Board | null {
    const stmt = this.db.prepare(
      'SELECT id, name, created_at FROM boards WHERE id = ?'
    );
    return (stmt.get(id) as Board) || null;
  }
}
```

**File**: `src/lib/repositories/BoardRepository.test.ts`
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '../db/connection';
import { BoardRepository } from './BoardRepository';
import type Database from 'better-sqlite3';

describe('BoardRepository', () => {
  let db: Database.Database;
  let repo: BoardRepository;

  beforeEach(() => {
    db = getTestDb();  // Fresh in-memory DB for each test
    repo = new BoardRepository(db);
  });

  describe('create', () => {
    it('creates a board and returns it with id and timestamp', () => {
      const board = repo.create({ name: 'Test Board' });

      expect(board).toMatchObject({
        id: expect.any(Number),
        name: 'Test Board',
        created_at: expect.any(String)
      });
      expect(board.id).toBeGreaterThan(0);
    });

    it('auto-increments board ids', () => {
      const board1 = repo.create({ name: 'Board 1' });
      const board2 = repo.create({ name: 'Board 2' });

      expect(board2.id).toBe(board1.id + 1);
    });
  });

  describe('findAll', () => {
    it('returns empty array when no boards exist', () => {
      const boards = repo.findAll();
      expect(boards).toEqual([]);
    });

    it('returns all boards ordered by created_at DESC', () => {
      const board1 = repo.create({ name: 'First' });
      const board2 = repo.create({ name: 'Second' });
      const board3 = repo.create({ name: 'Third' });

      const boards = repo.findAll();
      expect(boards).toHaveLength(3);
      // Most recent first
      expect(boards[0].id).toBe(board3.id);
      expect(boards[1].id).toBe(board2.id);
      expect(boards[2].id).toBe(board1.id);
    });
  });

  describe('findById', () => {
    it('returns board when id exists', () => {
      const created = repo.create({ name: 'Find Me' });
      const found = repo.findById(created.id);

      expect(found).toEqual(created);
    });

    it('returns null when id does not exist', () => {
      const found = repo.findById(999);
      expect(found).toBeNull();
    });
  });
});
```

### Success Criteria
- [ ] `db/migrations/001_create_boards.sql` defines boards table with id, name, created_at
- [ ] `src/lib/db/connection.ts` provides getDb() and getTestDb() functions
- [ ] Migrations run automatically on first getDb() call
- [ ] In-memory test database (getTestDb) applies all migrations
- [ ] BoardRepository implements create(), findAll(), findById()
- [ ] All repository unit tests pass
- [ ] Tests use real SQLite in-memory database (no mocking)
- [ ] `npm test` runs repository tests successfully

---

## Task 3: API Layer

### Overview
Create RESTful API endpoints (`POST /api/boards`, `GET /api/boards`) with integration tests that verify the full API → Repository → Database flow.

### Changes Required

**File**: `src/pages/api/boards/index.ts`
```ts
import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

// GET /api/boards - list all boards
export const GET: APIRoute = async () => {
  const db = getDb();
  const repo = new BoardRepository(db);
  const boards = repo.findAll();

  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

// POST /api/boards - create a board
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validation
    if (!body.name || typeof body.name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'name is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'name cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const db = getDb();
    const repo = new BoardRepository(db);
    const board = repo.create({ name: body.name.trim() });

    return new Response(JSON.stringify(board), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating board:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
```

**File**: `src/pages/api/boards/[id].ts`
```ts
import type { APIRoute } from 'astro';
import { getDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

// GET /api/boards/:id - get a single board
export const GET: APIRoute = async ({ params }) => {
  const id = parseInt(params.id || '', 10);

  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid board id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const db = getDb();
  const repo = new BoardRepository(db);
  const board = repo.findById(id);

  if (!board) {
    return new Response(
      JSON.stringify({ error: 'Board not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify(board), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
```

**File**: `src/pages/api/boards/index.test.ts`
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from './index';
import { getTestDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

describe('POST /api/boards', () => {
  it('creates a board and returns 201 with board data', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Board' })
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toMatchObject({
      id: expect.any(Number),
      name: 'New Board',
      created_at: expect.any(String)
    });
  });

  it('returns 400 when name is missing', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('name is required');
  });

  it('returns 400 when name is empty string', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' })
    });

    const response = await POST({ request } as any);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('cannot be empty');
  });

  it('trims whitespace from board name', async () => {
    const request = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '  Trimmed Board  ' })
    });

    const response = await POST({ request } as any);
    const data = await response.json();
    expect(data.name).toBe('Trimmed Board');
  });
});

describe('GET /api/boards', () => {
  let db: ReturnType<typeof getTestDb>;
  let repo: BoardRepository;

  beforeEach(() => {
    db = getTestDb();
    repo = new BoardRepository(db);
  });

  it('returns empty array when no boards exist', async () => {
    const request = new Request('http://localhost/api/boards');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual([]);
  });

  it('returns all boards ordered by created_at DESC', async () => {
    repo.create({ name: 'First' });
    repo.create({ name: 'Second' });
    repo.create({ name: 'Third' });

    const request = new Request('http://localhost/api/boards');
    const response = await GET({ request } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(3);
    expect(data[0].name).toBe('Third');  // Most recent first
    expect(data[1].name).toBe('Second');
    expect(data[2].name).toBe('First');
  });
});

describe('Integration: POST → GET flow', () => {
  it('creates a board via POST and retrieves it via GET', async () => {
    // Create board
    const postRequest = new Request('http://localhost/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Integration Test Board' })
    });
    const postResponse = await POST({ request: postRequest } as any);
    const createdBoard = await postResponse.json();

    // Retrieve boards
    const getRequest = new Request('http://localhost/api/boards');
    const getResponse = await GET({ request: getRequest } as any);
    const boards = await getResponse.json();

    // Verify
    expect(boards).toContainEqual(createdBoard);
  });
});
```

**File**: `src/pages/api/boards/[id].test.ts`
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './[id]';
import { getTestDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';

describe('GET /api/boards/:id', () => {
  let db: ReturnType<typeof getTestDb>;
  let repo: BoardRepository;

  beforeEach(() => {
    db = getTestDb();
    repo = new BoardRepository(db);
  });

  it('returns board when id exists', async () => {
    const created = repo.create({ name: 'Test Board' });

    const response = await GET({
      params: { id: String(created.id) }
    } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual(created);
  });

  it('returns 404 when board not found', async () => {
    const response = await GET({
      params: { id: '999' }
    } as any);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('not found');
  });

  it('returns 400 for invalid id format', async () => {
    const response = await GET({
      params: { id: 'not-a-number' }
    } as any);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid');
  });
});
```

### Success Criteria
- [ ] `POST /api/boards` accepts `{ name: string }` and returns 201 with created board
- [ ] `POST /api/boards` returns 400 for missing/empty name
- [ ] `POST /api/boards` trims whitespace from board name
- [ ] `GET /api/boards` returns all boards ordered by created_at DESC
- [ ] `GET /api/boards/:id` returns board when id exists
- [ ] `GET /api/boards/:id` returns 404 when board not found
- [ ] Integration test verifies POST → GET flow with real database
- [ ] All API tests pass
- [ ] No database mocking — tests use in-memory SQLite

---

## Task 4: UI Layer

### Overview
Create the home page with a React island for board creation form and an Astro component to display the board list. Prove React hydration and full-stack integration work.

### Changes Required

**File**: `src/components/BoardForm.tsx`
```tsx
import React, { useState } from 'react';
import type { Board } from '@/lib/db/types';

interface BoardFormProps {
  onBoardCreated?: (board: Board) => void;
}

export function BoardForm({ onBoardCreated }: BoardFormProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length === 0) {
      setError('Board name cannot be empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to create board');
        return;
      }

      const board = await response.json();
      setName('');  // Clear form

      if (onBoardCreated) {
        onBoardCreated(board);
      } else {
        // Fallback: reload page to show new board
        window.location.reload();
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error creating board:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter board name"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Creating...' : 'Create Board'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </form>
  );
}
```

**File**: `src/components/BoardList.astro`
```astro
---
import type { Board } from '@/lib/db/types';

interface Props {
  boards: Board[];
}

const { boards } = Astro.props;
---

<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {boards.length === 0 ? (
    <p class="col-span-full text-gray-500 text-center py-8">
      No boards yet. Create your first board above!
    </p>
  ) : (
    boards.map((board) => (
      <div class="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
        <h3 class="text-lg font-semibold text-gray-900">{board.name}</h3>
        <p class="text-sm text-gray-500 mt-1">
          Created {new Date(board.created_at).toLocaleDateString()}
        </p>
      </div>
    ))
  )}
</div>
```

**File**: `src/pages/index.astro`
```astro
---
import { getDb } from '@/lib/db/connection';
import { BoardRepository } from '@/lib/repositories/BoardRepository';
import { BoardForm } from '@/components/BoardForm';
import BoardList from '@/components/BoardList.astro';

const db = getDb();
const repo = new BoardRepository(db);
const boards = repo.findAll();
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SwimLanes - Kanban Boards</title>
  </head>
  <body class="bg-gray-50 min-h-screen">
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 py-6">
        <h1 class="text-3xl font-bold text-gray-900">SwimLanes</h1>
        <p class="text-gray-600 mt-1">Organize your work with kanban boards</p>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 py-8">
      <section class="mb-8">
        <h2 class="text-2xl font-semibold text-gray-900 mb-4">Create a Board</h2>
        <BoardForm client:load />
      </section>

      <section>
        <h2 class="text-2xl font-semibold text-gray-900 mb-4">Your Boards</h2>
        <BoardList boards={boards} />
      </section>
    </main>
  </body>
</html>
```

### Success Criteria
- [ ] Home page (`/`) renders with header, board form, and board list
- [ ] BoardForm is a React island with `client:load` directive
- [ ] User can type in the form input and submit
- [ ] Form submission creates a board via POST /api/boards
- [ ] Page reloads after successful submission to show new board
- [ ] Empty board list shows helpful message
- [ ] Board cards display name and creation date
- [ ] Tailwind CSS styles render correctly
- [ ] React hydration works (form is interactive)
- [ ] `npm run dev` serves the page at http://localhost:4321

---

## Task 5: Documentation

### Overview
Create comprehensive documentation (CLAUDE.md, AGENTS.md, README.md) to guide developers and AI agents through the project setup, conventions, and workflows.

### Changes Required

**File**: `CLAUDE.md`
```markdown
# SwimLanes — Project Guide

## Overview
SwimLanes is a Trello-like kanban board application built with Astro 5, React, SQLite, and Tailwind CSS. Users can create boards, organize tasks into columns (swim lanes), and manage cards using drag-and-drop.

**Current Status**: Phase 1 complete — basic board creation and listing.

## Tech Stack
- **Astro 5** — SSR framework with API routes
- **React 18** — interactive island components
- **TypeScript** — strict mode enabled throughout
- **Tailwind CSS** — utility-first styling
- **SQLite** (better-sqlite3) — local file-based database
- **Vitest** — fast test framework with coverage reporting

## Getting Started

### Prerequisites
- Node.js 18+ (`node --version` to check)
- npm or pnpm

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Starts server at http://localhost:4321

### Build for Production
```bash
npm run build
npm run preview  # Preview production build
```

### Testing
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode for TDD
npm run test:coverage   # Run with coverage report (target: >80%)
```

Coverage reports are generated in `coverage/` directory.

## Project Structure

```
swimlanes/
├── src/
│   ├── pages/               # Astro pages and API routes
│   │   ├── index.astro      # Home page
│   │   └── api/
│   │       └── boards/      # Board API endpoints
│   ├── components/          # React components (islands)
│   │   ├── BoardForm.tsx    # Board creation form
│   │   └── BoardList.astro  # Board list display
│   ├── lib/
│   │   ├── db/              # Database utilities
│   │   │   ├── connection.ts    # DB connection and migration runner
│   │   │   └── types.ts         # TypeScript types for entities
│   │   └── repositories/    # Repository pattern (data access)
│   │       └── BoardRepository.ts
│   └── env.d.ts             # Astro type definitions
├── db/
│   ├── migrations/          # SQL migration files (numbered)
│   │   └── 001_create_boards.sql
│   └── swimlanes.db         # SQLite database (gitignored)
├── astro.config.mjs         # Astro configuration
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Test configuration
└── tailwind.config.mjs      # Tailwind configuration
```

## Architecture Patterns

### Repository Pattern
Data access is isolated in repository classes. Repositories encapsulate all SQL queries and provide a clean API for business logic.

**Example:**
```typescript
const db = getDb();
const repo = new BoardRepository(db);
const boards = repo.findAll();  // No SQL in API routes
```

**Location**: `src/lib/repositories/`

### Database Migrations
SQL migrations live in `db/migrations/` with numeric prefixes (e.g., `001_create_boards.sql`). Migrations run automatically on application startup.

**Migration tracking**: `migrations` table in SQLite tracks which migrations have been applied.

### API Route Conventions
- RESTful endpoints under `src/pages/api/`
- Use Astro's APIRoute type
- Export named HTTP methods: `export const GET: APIRoute = ...`
- Return JSON with appropriate status codes
- Validate input and return 400 for bad requests

**Example:**
```typescript
// src/pages/api/boards/index.ts
export const GET: APIRoute = async () => {
  const boards = repo.findAll();
  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### React Islands
Interactive components use React with Astro's island architecture. Add `client:load` directive to hydrate on page load.

**Example:**
```astro
<BoardForm client:load />
```

**Location**: `src/components/` (`.tsx` files)

### TypeScript Configuration
- Strict mode enabled
- Path aliases: `@/*` maps to `src/*`, `@db/*` maps to `db/*`
- All code must type-check with zero errors

## Database

### Connection Management
- **Development**: Single connection to `db/swimlanes.db`
- **Testing**: In-memory database (`:memory:`) via `getTestDb()`
- **WAL mode**: Enabled for better concurrency

### Accessing the Database
```typescript
import { getDb, getTestDb } from '@/lib/db/connection';

// In application code
const db = getDb();

// In tests
const db = getTestDb();  // Fresh in-memory DB
```

### Writing Migrations
1. Create file in `db/migrations/` with numeric prefix: `002_add_columns.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`)
3. Restart server — migration runs automatically

## Testing

### Test Strategy
- **Unit tests**: Repository layer (no mocking — use in-memory SQLite)
- **Integration tests**: API routes with real database operations
- **Coverage target**: >80% on `src/lib/` and `src/pages/api/`

### Test Files
- Place tests next to implementation: `BoardRepository.test.ts` next to `BoardRepository.ts`
- Use `.test.ts` or `.spec.ts` suffix

### Best Practices
- Use `beforeEach` to create fresh test database
- Prefer real implementations over mocks
- Test both happy paths and error cases
- Verify HTTP status codes and response shapes in API tests

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Write tests first** (TDD): `npm run test:watch`
3. **Implement feature**: code in `src/`
4. **Verify tests pass**: `npm test`
5. **Check coverage**: `npm run test:coverage`
6. **Build to verify**: `npm run build`

## Common Tasks

### Adding a New Entity
1. Create migration in `db/migrations/XXX_create_entity.sql`
2. Add TypeScript types in `src/lib/db/types.ts`
3. Create repository in `src/lib/repositories/EntityRepository.ts`
4. Write unit tests in `EntityRepository.test.ts`
5. Add API routes in `src/pages/api/entity/`
6. Write integration tests for API routes

### Adding a React Component
1. Create `.tsx` file in `src/components/`
2. Use TypeScript for props interface
3. Import and use in `.astro` page with `client:load` directive
4. Style with Tailwind CSS classes

## Troubleshooting

### Database Issues
- **Migration not applied**: Check `db/migrations/` for syntax errors
- **File locked**: Ensure only one dev server is running
- **Reset database**: Delete `db/swimlanes.db` and restart server

### Test Failures
- **Module not found**: Check path aliases in `vitest.config.ts` match `tsconfig.json`
- **Database errors**: Ensure `getTestDb()` is called in `beforeEach`

### TypeScript Errors
- **Cannot find module**: Run `npm install` to ensure dependencies are installed
- **Path alias not resolved**: Check `tsconfig.json` paths configuration
```

**File**: `AGENTS.md`
```markdown
# AGENTS.md

**For AI Agents and Codex CLI**

Read `CLAUDE.md` for all project conventions, tech stack, and development workflows.

## Project Summary
SwimLanes — a Trello-like kanban board application with SQLite backend, built using Astro 5, React, TypeScript, and Tailwind CSS.

## Key Commands
- `npm run dev` — start development server
- `npm test` — run all tests
- `npm run test:coverage` — run tests with coverage report

## Architecture Patterns
- Repository pattern for data access
- Database migrations in `db/migrations/`
- RESTful API routes in `src/pages/api/`
- React islands with `client:load` directive

See `CLAUDE.md` for detailed guidance.
```

**File**: `README.md`
```markdown
# SwimLanes

A modern kanban board application built with Astro, React, and SQLite. Organize your work with boards, columns (swim lanes), and draggable cards.

## Features
- ✅ **Phase 1**: Board creation and listing (current)
- 🚧 **Phase 2**: Columns and swim lanes (planned)
- 🚧 **Phase 3**: Cards with drag-and-drop (planned)
- 🚧 **Phase 4**: Persistence and polish (planned)

## Tech Stack
- **Astro 5** — SSR framework with API routes
- **React 18** — interactive components
- **TypeScript** — type-safe development
- **Tailwind CSS** — utility-first styling
- **SQLite** — local file-based database
- **Vitest** — fast testing with coverage

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm (comes with Node.js)

### Installation
```bash
git clone <repository-url>
cd swimlanes
npm install
```

### Run Development Server
```bash
npm run dev
```
Visit http://localhost:4321 to see the app.

### Run Tests
```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

### Build for Production
```bash
npm run build
npm run preview  # Preview production build
```

## Scripts Reference
- `npm run dev` — Start development server (http://localhost:4321)
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm test` — Run all tests
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Generate coverage report

## Project Structure
```
swimlanes/
├── src/
│   ├── pages/           # Astro pages and API routes
│   ├── components/      # React components
│   └── lib/             # Business logic and data access
├── db/
│   └── migrations/      # SQL migration files
├── CLAUDE.md            # Developer guide
└── README.md            # This file
```

## Development
See `CLAUDE.md` for detailed development guidelines, architecture patterns, and testing strategies.

## Project Status
**Phase 1: Complete** ✅
- Project scaffolding with Astro, React, TypeScript, Tailwind CSS
- SQLite database with migration system
- Board creation and listing functionality
- Test framework with >80% coverage
- Comprehensive documentation

**Next**: Phase 2 will add columns/swim lanes to boards.

## License
MIT
```

### Success Criteria
- [ ] `CLAUDE.md` created with comprehensive project guide
- [ ] `CLAUDE.md` includes tech stack, getting started, project structure, architecture patterns
- [ ] `AGENTS.md` created with reference to CLAUDE.md
- [ ] `README.md` created with project description and quick start
- [ ] All documentation is accurate and matches implemented code
- [ ] Documentation includes all required sections from SPEC.md

---

## Testing Strategy

### Unit Tests
**Location**: `src/lib/repositories/*.test.ts`

**What to test:**
- Repository CRUD operations (create, findAll, findById)
- Edge cases: empty results, invalid inputs, duplicate handling
- Database constraints and indexes

**Key edge cases:**
- Creating multiple boards (auto-increment works)
- Finding boards when none exist (empty array)
- Finding board by non-existent id (returns null)

**Mocking strategy:**
- **NO MOCKING** — use real SQLite in-memory database via `getTestDb()`
- Each test gets a fresh database with migrations applied
- Rationale: SQLite is fast enough, real database catches more bugs

### Integration/E2E Tests
**Location**: `src/pages/api/**/*.test.ts`

**End-to-end scenarios:**
- POST → GET flow: create board via API, retrieve it via API, verify match
- Validation: missing name returns 400, empty name returns 400
- Full stack: API → Repository → SQLite → Repository → API

**Test approach:**
- Create Request objects with fetch API structure
- Call API route handlers directly (no HTTP server needed)
- Use `getTestDb()` for isolated database state
- Verify status codes, headers, and response body shape

## Risk Assessment

### Risk: Database file permissions
**Mitigation**:
- Create `db/` directory automatically in `connection.ts`
- Handle missing directory gracefully
- Document in CLAUDE.md that `db/*.db` is gitignored

### Risk: Path alias resolution in tests
**Mitigation**:
- Configure both `tsconfig.json` and `vitest.config.ts` with same aliases
- Test alias resolution early in Task 1
- Document troubleshooting in CLAUDE.md

### Risk: React island not hydrating
**Mitigation**:
- Use `client:load` directive in index.astro
- Verify in browser DevTools that React is loaded
- Test form submission interactivity manually

### Risk: Migration system not running
**Mitigation**:
- Call `runMigrations()` in `getDb()` before returning connection
- Log migration application to console for debugging
- Test with both fresh database and existing database scenarios

### Risk: In-memory test database not applying migrations
**Mitigation**:
- Call `runMigrations()` in `getTestDb()` before returning
- Verify in first repository test that table exists
- Fail fast with clear error if migrations don't run

### Risk: Coverage not meeting 80% threshold
**Mitigation**:
- Write tests for all repository methods (3 methods = 3 test suites)
- Write tests for all API routes (GET, POST = 2 test suites)
- Include error path tests (validation failures, not found, etc.)
- Run `npm run test:coverage` frequently to track progress
