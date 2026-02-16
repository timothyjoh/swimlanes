# Implementation Plan: Phase 3

## Overview
Phase 3 completes the SwimLanes MVP by delivering cards with full CRUD functionality, drag-and-drop both within columns and between columns, Playwright E2E test infrastructure, and shared positioning utilities. This phase closes all remaining BRIEF.md MVP features and brings the project into compliance with E2E testing requirements.

## Current State (from Research)

### What Exists
- **Database layer**: Boards and columns tables with CASCADE DELETE, connection singleton with auto-migrations, repository pattern established
- **API layer**: RESTful endpoints for boards and columns with validation, error handling, proper status codes
- **UI layer**: BoardList and ColumnManager components with inline editing, drag-and-drop, loading states, error banners
- **Test infrastructure**: Vitest with 83 passing tests, 100% coverage on critical paths, real SQLite in tests (no mocks)
- **Positioning strategy**: Integer gaps (1000, 2000, 3000) with midpoint calculation for reordering

### What Patterns to Follow
- **Repository pattern**: `src/lib/db/*.ts` — Export plain functions, validate inputs, throw Error on validation, return undefined for not-found
- **API routes**: JSON parsing with try-catch, validate inputs, return 200/201/204/400/404, error messages in response body
- **Component state**: Separate useState for items/loading/error/form/operation-in-progress IDs, optimistic updates, inline editing, loading indicators during operations
- **Drag-and-drop**: HTML5 DnD API with onDragStart/onDragOver/onDrop, calculate midpoint position, visual feedback with opacity
- **Database schema**: snake_case columns, INTEGER PRIMARY KEY AUTOINCREMENT, created_at/updated_at TEXT fields, ON DELETE CASCADE foreign keys, indexes on FK columns
- **Test strategy**: Real database in tests, beforeEach setup with temp file, afterEach cleanup with WAL/SHM files, comprehensive edge cases

## Desired End State

After Phase 3 is complete:
- Cards table exists with column_id foreign key (CASCADE DELETE)
- Cards can be created within columns with title, optional description, optional color label
- Cards can be edited inline (title, description, color)
- Cards can be deleted with confirmation
- Cards can be dragged to reorder within a column (position updates)
- Cards can be dragged from one column to another (column_id and position update)
- Shared positioning utility module exists at `src/lib/utils/positioning.ts` (used by both columns and cards)
- Playwright is installed and configured with headless and UI test modes
- E2E tests cover all MVP features: board CRUD, column CRUD, card CRUD, drag-within-column, drag-between-columns
- All tests pass (unit, integration, component, E2E) with 80%+ coverage on cards.ts
- AGENTS.md and README.md updated with card architecture, E2E test commands, feature completion status

### Verification
1. Run `npm test` — all Vitest tests pass
2. Run `npm run test:e2e` — all Playwright tests pass in headless mode
3. Run `npm run test:e2e:ui` — Playwright UI mode launches successfully
4. Run `npm run dev`, navigate to board detail, create cards, drag cards within column, drag cards between columns — all persist on reload
5. Delete a column — cards cascade delete
6. Run `npm run test:coverage` — cards.ts shows 80%+ coverage

## What We're NOT Doing
- Due dates, assignments, attachments (non-goals per BRIEF.md)
- Real-time collaboration or multi-user features
- Keyboard shortcuts for card navigation
- Undo/redo functionality
- Advanced card features (subtasks, comments, file uploads)
- Position rebalancing logic for integer overflow (deferred technical debt)
- Mobile-specific responsive refinements (basic Tailwind responsiveness is sufficient)
- Card archiving or soft-delete
- Card search or filtering
- Card templates or duplication
- Activity logs or audit trails

## Implementation Approach

### High-Level Strategy
1. **Bottom-up build order** (validated in Phases 1 & 2): DB → API → UI with tests at each layer
2. **Shared positioning utility first**: Extract position calculation logic before implementing cards so both columns and cards use the same utility from day one
3. **Vertical slices**: Each task delivers testable functionality end-to-end (e.g., Task 3 = card create from DB to UI to tests)
4. **E2E tests early**: Install Playwright after card API is working but before UI is built, allowing TDD approach for UI interactions
5. **Color labels as simple strings**: Store color as TEXT in database (nullable), validate against predefined list in UI component (not DB constraint), display as Tailwind classes

### Key Design Decisions

**Decision 1: Positioning Utility Extraction Timing**
- **Choice**: Create `src/lib/utils/positioning.ts` in Task 1 (before cards implementation)
- **Rationale**: Phase 2 REFLECTIONS.md line 126 recommends extraction. Doing it first means both columns and cards use it immediately, avoiding duplication and making future rebalancing easier
- **Impact**: Columns code needs minor refactor to use utility, but this validates the utility works before cards depend on it

**Decision 2: Color Label Implementation**
- **Choice**: Color stored as TEXT in database (nullable), predefined array in component, no database enum constraint
- **Rationale**: Simple to implement, easy to extend colors later, no schema changes needed, database remains flexible
- **Values**: 6 colors — `red`, `blue`, `green`, `yellow`, `purple`, `gray` (stored as lowercase strings)
- **UI**: Dropdown selector in edit mode, displayed as colored badge using Tailwind classes (bg-red-200, bg-blue-200, etc.)

**Decision 3: Card Description Display**
- **Choice**: Show description inline on all cards (not modal, not expand/collapse)
- **Rationale**: Simplest implementation, consistent with kanban UX patterns, avoids modal complexity
- **UI**: Title in bold, description below in smaller text, both visible always if description exists

**Decision 4: Drag-Between-Columns API**
- **Choice**: Single endpoint `PATCH /api/cards/:id/column` that updates both column_id AND position
- **Rationale**: Moving a card between columns always requires recalculating position (becomes last in target column), atomic update in one API call avoids race conditions
- **Alternative**: Separate position endpoint would require two API calls (move column, then update position), increasing complexity

**Decision 5: E2E Test Setup Timing**
- **Choice**: Install Playwright in Task 5 (after card API routes are working, before CardManager UI)
- **Rationale**: API must exist for E2E tests to work, but installing early allows TDD approach for UI (write E2E test, then implement UI to pass it)
- **Impact**: E2E tests written incrementally as UI features are built (Task 6, 7, 8)

**Decision 6: Card Edit UX**
- **Choice**: Inline editing (same as columns) — click card to enter edit mode, show form with title/description/color fields, save on blur or explicit save button
- **Rationale**: Consistent with column editing UX, no modal complexity, mobile-friendly
- **Alternative rejected**: Modal dialog would require more UI code and doesn't add value for this use case

---

## Task 1: Extract Positioning Utility Module

### Overview
Create shared positioning utility at `src/lib/utils/positioning.ts` with functions for calculating initial positions and reorder positions. Refactor `columns.ts` and `ColumnManager.tsx` to use this utility, validating it works before cards depend on it.

### Changes Required

**File**: `src/lib/utils/positioning.ts` (new file)
```typescript
export interface PositionedItem {
  id: number;
  position: number;
}

export const POSITION_GAP = 1000;

/**
 * Calculate position for a new item (appended to end of list)
 * @param items - Current items sorted by position
 * @returns Position for new item (max position + POSITION_GAP)
 */
export function calculateInitialPosition(items: PositionedItem[]): number {
  if (items.length === 0) return POSITION_GAP;
  const maxPosition = Math.max(...items.map(item => item.position));
  return maxPosition + POSITION_GAP;
}

/**
 * Calculate position when reordering item within same list
 * @param items - All items sorted by position
 * @param draggedItem - Item being moved
 * @param targetIndex - Target index (0-based)
 * @returns New position for dragged item
 */
export function calculateReorderPosition(
  items: PositionedItem[],
  draggedItem: PositionedItem,
  targetIndex: number
): number {
  // Remove dragged item from consideration
  const otherItems = items.filter(item => item.id !== draggedItem.id);

  if (otherItems.length === 0) return POSITION_GAP;

  // Moving to first position
  if (targetIndex === 0) {
    return Math.max(0, otherItems[0].position - POSITION_GAP);
  }

  // Moving to last position
  if (targetIndex >= otherItems.length) {
    return otherItems[otherItems.length - 1].position + POSITION_GAP;
  }

  // Moving between two items
  const before = otherItems[targetIndex - 1];
  const after = otherItems[targetIndex];
  return Math.floor((before.position + after.position) / 2);
}
```

**File**: `src/lib/db/columns.ts`
**Changes**: Replace inline position calculation with utility function
```typescript
// Add import at top
import { calculateInitialPosition, type PositionedItem } from "../utils/positioning.js";

// In createColumn function (line 21-24), replace:
const maxPos = db
  .prepare<[], { max: number }>("SELECT MAX(position) as max FROM columns WHERE board_id = ?")
  .get(boardId);
const position = (maxPos.max || 0) + 1000;

// With:
const existingColumns = db
  .prepare<[], PositionedItem>("SELECT id, position FROM columns WHERE board_id = ? ORDER BY position ASC")
  .all(boardId);
const position = calculateInitialPosition(existingColumns);
```

**File**: `src/components/ColumnManager.tsx`
**Changes**: Replace inline position calculation with utility function
```typescript
// Add import at top
import { calculateReorderPosition, type PositionedItem } from "../lib/utils/positioning";

// In handleDrop function (lines 193-211), replace entire position calculation block with:
const newPosition = calculateReorderPosition(
  columns as PositionedItem[],
  draggedColumn as PositionedItem,
  targetIndex
);
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Existing column tests pass (no regressions)
- [ ] Unit tests for positioning utility pass (8+ tests covering edge cases)
- [ ] Columns can still be created and reordered in UI (manual verification)

### Tests Required
**File**: `src/lib/utils/__tests__/positioning.test.ts` (new file)
- calculateInitialPosition: empty list returns 1000
- calculateInitialPosition: single item returns 2000
- calculateInitialPosition: multiple items returns max+1000
- calculateReorderPosition: move to first position (returns target-1000)
- calculateReorderPosition: move to last position (returns target+1000)
- calculateReorderPosition: move between two items (returns midpoint)
- calculateReorderPosition: move within single-item list (returns 1000)
- calculateReorderPosition: edge case with positions close together (floor rounding)

---

## Task 2: Database Migration for Cards Table

### Overview
Create SQLite migration `003_create_cards.sql` adding cards table with column_id foreign key (CASCADE DELETE), title, description, color, position fields. Verify foreign key constraint and cascade delete behavior.

### Changes Required

**File**: `db/migrations/003_create_cards.sql` (new file)
```sql
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
);

CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_position ON cards(position);
```

**No code changes needed** — Migration auto-runs on next server start via `connection.ts`

### Success Criteria
- [ ] Migration file exists at `db/migrations/003_create_cards.sql`
- [ ] Server starts without errors (migration runs successfully)
- [ ] `cards` table exists in database with correct schema
- [ ] Foreign key constraint enforced (cannot insert card with invalid column_id)
- [ ] Cascade delete works (deleting column deletes its cards)

### Tests Required
Manual verification after migration:
1. Start dev server: `npm run dev`
2. Check logs for migration success message
3. Use SQLite CLI to verify schema: `.schema cards`
4. Create board → create column → create card → delete column → verify card deleted

---

## Task 3: Card Repository Layer

### Overview
Create `src/lib/db/cards.ts` repository module with functions for createCard, listCardsByColumn, getCardById, updateCard, deleteCard, updateCardPosition, updateCardColumn. Follow repository pattern established in boards.ts and columns.ts.

### Changes Required

**File**: `src/lib/db/cards.ts` (new file)
```typescript
import { getDb } from "./connection.js";
import { calculateInitialPosition, type PositionedItem } from "../utils/positioning.js";

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

export function createCard(
  columnId: number,
  title: string,
  description?: string | null,
  color?: string | null
): Card {
  const db = getDb();

  // Validate title
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Card title cannot be empty");
  }

  // Validate column exists
  const column = db.prepare("SELECT id FROM columns WHERE id = ?").get(columnId);
  if (!column) {
    throw new Error("Column not found");
  }

  // Calculate position
  const existingCards = db
    .prepare<[], PositionedItem>("SELECT id, position FROM cards WHERE column_id = ? ORDER BY position ASC")
    .all(columnId);
  const position = calculateInitialPosition(existingCards);

  // Insert card
  const result = db
    .prepare(
      "INSERT INTO cards (column_id, title, description, color, position) VALUES (?, ?, ?, ?, ?)"
    )
    .run(columnId, trimmedTitle, description || null, color || null, position);

  // Fetch and return
  const card = db.prepare<[], Card>("SELECT * FROM cards WHERE id = ?").get(result.lastInsertRowid);
  if (!card) throw new Error("Failed to create card");
  return card;
}

export function listCardsByColumn(columnId: number): Card[] {
  const db = getDb();
  return db.prepare<[], Card>("SELECT * FROM cards WHERE column_id = ? ORDER BY position ASC").all(columnId);
}

export function getCardById(id: number): Card | undefined {
  const db = getDb();
  return db.prepare<[], Card>("SELECT * FROM cards WHERE id = ?").get(id);
}

export function updateCard(
  id: number,
  updates: { title?: string; description?: string | null; color?: string | null }
): Card | undefined {
  const db = getDb();

  // Validate title if provided
  if (updates.title !== undefined) {
    const trimmedTitle = updates.title.trim();
    if (!trimmedTitle) {
      throw new Error("Card title cannot be empty");
    }
    updates.title = trimmedTitle;
  }

  // Build update query dynamically
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) {
    fields.push("title = ?");
    values.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    values.push(updates.description);
  }
  if (updates.color !== undefined) {
    fields.push("color = ?");
    values.push(updates.color);
  }

  if (fields.length === 0) return getCardById(id);

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const result = db
    .prepare(`UPDATE cards SET ${fields.join(", ")} WHERE id = ?`)
    .run(...values);

  if (result.changes === 0) return undefined;
  return getCardById(id);
}

export function deleteCard(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  return result.changes > 0;
}

export function updateCardPosition(id: number, position: number): Card | undefined {
  const db = getDb();
  const result = db
    .prepare("UPDATE cards SET position = ?, updated_at = datetime('now') WHERE id = ?")
    .run(position, id);
  if (result.changes === 0) return undefined;
  return getCardById(id);
}

export function updateCardColumn(id: number, columnId: number, position: number): Card | undefined {
  const db = getDb();

  // Validate column exists
  const column = db.prepare("SELECT id FROM columns WHERE id = ?").get(columnId);
  if (!column) {
    throw new Error("Column not found");
  }

  const result = db
    .prepare("UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?")
    .run(columnId, position, id);
  if (result.changes === 0) return undefined;
  return getCardById(id);
}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Unit tests pass (20+ tests covering all functions and edge cases)
- [ ] Test coverage on cards.ts is 80%+
- [ ] Can create/update/delete cards via Node REPL (manual smoke test)

### Tests Required
**File**: `src/lib/db/__tests__/cards.test.ts` (new file, 20+ tests)
- **createCard**:
  - Success: creates card with title only
  - Success: creates card with title, description, color
  - Success: calculates position correctly (first card = 1000, second = 2000)
  - Error: rejects empty title
  - Error: rejects whitespace-only title
  - Error: rejects non-existent column_id
- **listCardsByColumn**:
  - Returns empty array for column with no cards
  - Returns cards sorted by position ASC
  - Returns only cards for specified column (not other columns)
- **getCardById**:
  - Returns card for valid ID
  - Returns undefined for non-existent ID
- **updateCard**:
  - Updates title successfully
  - Updates description successfully
  - Updates color successfully
  - Updates multiple fields at once
  - Error: rejects empty title
  - Returns undefined for non-existent ID
- **deleteCard**:
  - Deletes card and returns true
  - Returns false for non-existent ID
- **updateCardPosition**:
  - Updates position successfully
  - Returns undefined for non-existent ID
- **updateCardColumn**:
  - Moves card to different column
  - Updates both column_id and position
  - Error: rejects non-existent column_id
  - Returns undefined for non-existent card ID
- **CASCADE DELETE**:
  - Deleting column cascades and deletes all its cards

---

## Task 4: Card API Routes

### Overview
Create RESTful API endpoints for cards: `POST /api/cards`, `GET /api/cards`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id`, `PATCH /api/cards/:id/position`, `PATCH /api/cards/:id/column`. Follow API route pattern from boards and columns.

### Changes Required

**File**: `src/pages/api/cards/index.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { createCard, listCardsByColumn } from "../../../lib/db/cards.js";

export const GET: APIRoute = async ({ url }) => {
  try {
    const columnId = url.searchParams.get("columnId");
    if (!columnId) {
      return new Response(JSON.stringify({ error: "columnId query parameter is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const cards = listCardsByColumn(Number(columnId));
    return new Response(JSON.stringify(cards), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { columnId, title, description, color } = body;

    if (!columnId || typeof columnId !== "number") {
      return new Response(JSON.stringify({ error: "columnId is required and must be a number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!title || typeof title !== "string") {
      return new Response(JSON.stringify({ error: "title is required and must be a string" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = createCard(columnId, title, description, color);
    return new Response(JSON.stringify(card), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") || message.includes("not exist") ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/cards/[id].ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { getCardById, updateCard, deleteCard } from "../../../lib/db/cards.js";

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { title, description, color } = body;

    const card = updateCard(id, { title, description, color });
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = Number(params.id);
    const deleted = deleteCard(id);
    if (!deleted) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/cards/[id]/position.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { updateCardPosition } from "../../../../lib/db/cards.js";

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { position } = body;

    if (typeof position !== "number") {
      return new Response(JSON.stringify({ error: "position is required and must be a number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = updateCardPosition(id, position);
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

**File**: `src/pages/api/cards/[id]/column.ts` (new file)
```typescript
import type { APIRoute } from "astro";
import { updateCardColumn } from "../../../../lib/db/cards.js";

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const id = Number(params.id);
    const body = await request.json();
    const { columnId, position } = body;

    if (typeof columnId !== "number") {
      return new Response(JSON.stringify({ error: "columnId is required and must be a number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (typeof position !== "number") {
      return new Response(JSON.stringify({ error: "position is required and must be a number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const card = updateCardColumn(id, columnId, position);
    if (!card) {
      return new Response(JSON.stringify({ error: "Card not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(card), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("not found") || message.includes("not exist") ? 404 : 400;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
};
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Integration tests pass (25+ tests covering all endpoints and error paths)
- [ ] Test coverage on API routes is 80%+
- [ ] Can test endpoints with curl (manual smoke test)

### Tests Required
**File**: `src/pages/api/cards/__tests__/cards-api.test.ts` (new file, 25+ tests)
- **POST /api/cards**:
  - Success: creates card with title only (returns 201)
  - Success: creates card with all fields (returns 201)
  - Error: missing columnId (returns 400)
  - Error: missing title (returns 400)
  - Error: invalid columnId type (returns 400)
  - Error: non-existent columnId (returns 404)
  - Error: malformed JSON (returns 400)
- **GET /api/cards**:
  - Success: returns cards for column (returns 200)
  - Success: returns empty array for column with no cards (returns 200)
  - Error: missing columnId query param (returns 400)
  - Error: invalid columnId (returns 400)
- **PATCH /api/cards/:id**:
  - Success: updates title (returns 200)
  - Success: updates description (returns 200)
  - Success: updates color (returns 200)
  - Success: updates multiple fields (returns 200)
  - Error: empty title (returns 400)
  - Error: non-existent card ID (returns 404)
  - Error: malformed JSON (returns 400)
- **DELETE /api/cards/:id**:
  - Success: deletes card (returns 204)
  - Error: non-existent card ID (returns 404)
- **PATCH /api/cards/:id/position**:
  - Success: updates position (returns 200)
  - Error: missing position (returns 400)
  - Error: invalid position type (returns 400)
  - Error: non-existent card ID (returns 404)
- **PATCH /api/cards/:id/column**:
  - Success: moves card to different column (returns 200)
  - Error: missing columnId (returns 400)
  - Error: missing position (returns 400)
  - Error: invalid types (returns 400)
  - Error: non-existent card ID (returns 404)
  - Error: non-existent columnId (returns 404)

---

## Task 5: Install and Configure Playwright

### Overview
Install Playwright, configure for headless and UI modes, add test commands to package.json. Create basic Playwright config and example test structure (tests written in later tasks).

### Changes Required

**Command**: Install Playwright
```bash
npm init playwright@latest
```
- Accept defaults for TypeScript and test directory (`tests/` or `e2e/`)
- Browsers will be installed automatically

**File**: `playwright.config.ts` (created by init, verify settings)
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
  },
});
```

**File**: `package.json`
**Changes**: Add test commands
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

**File**: `tests/example.spec.ts` (created by init, replace with placeholder)
```typescript
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('SwimLanes');
});
```

### Success Criteria
- [ ] Playwright installed (`@playwright/test` in package.json)
- [ ] `playwright.config.ts` exists with headless and UI mode support
- [ ] `npm run test:e2e` runs in headless mode without errors
- [ ] `npm run test:e2e:ui` launches Playwright UI
- [ ] Placeholder test passes

---

## Task 6: CardManager Component — Create and List Cards

### Overview
Create `src/components/CardManager.tsx` component that renders cards within a column, allows creating new cards with title input, fetches cards on mount, shows loading states and error banners. Follow component pattern from ColumnManager.tsx.

### Changes Required

**File**: `src/components/CardManager.tsx` (new file)
```typescript
import { useState, useEffect } from "react";

interface Card {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  color: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface CardManagerProps {
  columnId: number;
}

const CARD_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'] as const;

const COLOR_CLASSES: Record<typeof CARD_COLORS[number], string> = {
  red: 'bg-red-200 text-red-900',
  blue: 'bg-blue-200 text-blue-900',
  green: 'bg-green-200 text-green-900',
  yellow: 'bg-yellow-200 text-yellow-900',
  purple: 'bg-purple-200 text-purple-900',
  gray: 'bg-gray-200 text-gray-900',
};

export default function CardManager({ columnId }: CardManagerProps) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  // Fetch cards on mount
  useEffect(() => {
    async function fetchCards() {
      try {
        const res = await fetch(`/api/cards?columnId=${columnId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to load cards");
        }
        const data = await res.json();
        setCards(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load cards");
      } finally {
        setLoading(false);
      }
    }
    fetchCards();
  }, [columnId]);

  // Create card
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || creating) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, title: newTitle }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create card");
      }

      const card = await res.json();
      setCards([...cards, card]);
      setNewTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create card");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="p-2 text-sm text-gray-600">Loading cards...</div>;

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 bg-red-100 text-red-900 rounded text-sm">
          {error}
        </div>
      )}

      {/* Card list */}
      {cards.length === 0 && !error && (
        <div className="p-2 text-sm text-gray-500">No cards yet</div>
      )}

      {cards.map((card) => (
        <div key={card.id} className="p-3 bg-white rounded shadow-sm border border-gray-200">
          <div className="font-medium text-gray-900">{card.title}</div>
          {card.description && (
            <div className="mt-1 text-sm text-gray-600">{card.description}</div>
          )}
          {card.color && (
            <div className="mt-2">
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${COLOR_CLASSES[card.color as typeof CARD_COLORS[number]] || COLOR_CLASSES.gray}`}>
                {card.color}
              </span>
            </div>
          )}
        </div>
      ))}

      {/* Create form */}
      <form onSubmit={handleCreate} className="space-y-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a card..."
          disabled={creating}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "Add Card"}
        </button>
      </form>
    </div>
  );
}
```

**File**: `src/components/ColumnManager.tsx`
**Changes**: Import and render CardManager for each column
```typescript
// Add import at top
import CardManager from "./CardManager";

// In the column render section (around line 290), add CardManager below column name:
<div className="min-w-[300px] max-w-[300px] bg-gray-50 rounded-lg p-4 flex flex-col">
  {/* ...existing column header code... */}

  {/* Add CardManager here */}
  <div className="mt-4 flex-1 overflow-y-auto">
    <CardManager columnId={column.id} />
  </div>
</div>
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Component tests pass (5+ tests covering render/loading/error/create states)
- [ ] Cards render in UI within columns (manual verification)
- [ ] Create form submits and new card appears without page reload (manual verification)

### Tests Required
**File**: `src/components/__tests__/CardManager.test.tsx` (new file, 5+ tests)
- Renders without crashing
- Shows loading state initially
- Shows error banner when fetch fails
- Renders cards after fetch succeeds
- Shows "No cards yet" when column is empty
- Triggers create card on form submit (with mocked fetch)
- Shows "Creating..." button text during card creation

---

## Task 7: CardManager Component — Edit and Delete Cards

### Overview
Add inline editing for card title, description, and color. Add delete functionality with confirmation. Update CardManager to support editingId state, edit form UI, and optimistic state updates.

### Changes Required

**File**: `src/components/CardManager.tsx`
**Changes**: Add edit and delete functionality
```typescript
// Add new state variables
const [editingId, setEditingId] = useState<number | null>(null);
const [editTitle, setEditTitle] = useState("");
const [editDescription, setEditDescription] = useState("");
const [editColor, setEditColor] = useState<string | null>(null);
const [updatingId, setUpdatingId] = useState<number | null>(null);
const [deletingId, setDeletingId] = useState<number | null>(null);

// Enter edit mode
function startEdit(card: Card) {
  setEditingId(card.id);
  setEditTitle(card.title);
  setEditDescription(card.description || "");
  setEditColor(card.color);
}

// Cancel edit mode
function cancelEdit() {
  setEditingId(null);
  setEditTitle("");
  setEditDescription("");
  setEditColor(null);
}

// Save edit
async function handleUpdate(id: number) {
  if (!editTitle.trim() || updatingId) return;

  setUpdatingId(id);
  setError(null);

  try {
    const res = await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        description: editDescription || null,
        color: editColor,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update card");
    }

    const updatedCard = await res.json();
    setCards(cards.map((c) => (c.id === id ? updatedCard : c)));
    setEditingId(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to update card");
  } finally {
    setUpdatingId(null);
  }
}

// Delete card
async function handleDelete(id: number) {
  if (!confirm("Delete this card?")) return;

  setDeletingId(id);
  setError(null);

  try {
    const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to delete card");
    }

    setCards(cards.filter((c) => c.id !== id));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to delete card");
  } finally {
    setDeletingId(null);
  }
}

// Update card render to show edit form when editingId matches:
{cards.map((card) => (
  <div key={card.id} className="p-3 bg-white rounded shadow-sm border border-gray-200">
    {editingId === card.id ? (
      // Edit form
      <div className="space-y-2">
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          disabled={updatingId === card.id}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        />
        <textarea
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
          disabled={updatingId === card.id}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
          rows={3}
        />
        <select
          value={editColor || ""}
          onChange={(e) => setEditColor(e.target.value || null)}
          disabled={updatingId === card.id}
          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
        >
          <option value="">No color</option>
          {CARD_COLORS.map((color) => (
            <option key={color} value={color}>{color}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => handleUpdate(card.id)}
            disabled={updatingId === card.id || !editTitle.trim()}
            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
          >
            {updatingId === card.id ? "Saving..." : "Save"}
          </button>
          <button
            onClick={cancelEdit}
            disabled={updatingId === card.id}
            className="flex-1 px-2 py-1 bg-gray-300 text-gray-900 rounded text-xs hover:bg-gray-400 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    ) : (
      // Display mode
      <>
        <div className="flex justify-between items-start">
          <div
            onClick={() => startEdit(card)}
            className="flex-1 font-medium text-gray-900 cursor-pointer hover:text-blue-600"
          >
            {card.title}
          </div>
          <button
            onClick={() => handleDelete(card.id)}
            disabled={deletingId === card.id}
            className="ml-2 text-red-600 hover:text-red-800 text-xs disabled:opacity-50"
          >
            {deletingId === card.id ? "..." : "Delete"}
          </button>
        </div>
        {card.description && (
          <div className="mt-1 text-sm text-gray-600">{card.description}</div>
        )}
        {card.color && (
          <div className="mt-2">
            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${COLOR_CLASSES[card.color as typeof CARD_COLORS[number]] || COLOR_CLASSES.gray}`}>
              {card.color}
            </span>
          </div>
        )}
      </>
    )}
  </div>
))}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Component tests pass (add 3+ tests for edit/delete)
- [ ] Click card title enters edit mode (manual verification)
- [ ] Edit form saves changes and exits edit mode (manual verification)
- [ ] Delete button shows confirmation and removes card (manual verification)

### Tests Required
Add to `src/components/__tests__/CardManager.test.tsx`:
- Enters edit mode when card title clicked
- Saves changes on Save button click
- Cancels edit mode on Cancel button click
- Triggers delete on Delete button click

---

## Task 8: CardManager Component — Drag-and-Drop Within Column

### Overview
Add HTML5 drag-and-drop handlers to CardManager for reordering cards within the same column. Use positioning utility for calculating new positions. Follow drag-and-drop pattern from ColumnManager.tsx.

### Changes Required

**File**: `src/components/CardManager.tsx`
**Changes**: Add drag-and-drop handlers
```typescript
// Add import at top
import { calculateReorderPosition, type PositionedItem } from "../lib/utils/positioning";

// Add draggedId state (if not already present from earlier tasks)
const [draggedId, setDraggedId] = useState<number | null>(null);

// Add drag handlers
function handleDragStart(e: React.DragEvent, card: Card) {
  if (editingId === card.id) {
    e.preventDefault();
    return;
  }
  setDraggedId(card.id);
  e.dataTransfer.effectAllowed = "move";
}

function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

async function handleDrop(e: React.DragEvent, targetCard: Card) {
  e.preventDefault();

  if (!draggedId || draggedId === targetCard.id) {
    setDraggedId(null);
    return;
  }

  const draggedCard = cards.find((c) => c.id === draggedId);
  if (!draggedCard) {
    setDraggedId(null);
    return;
  }

  const targetIndex = cards.findIndex((c) => c.id === targetCard.id);
  const newPosition = calculateReorderPosition(
    cards as PositionedItem[],
    draggedCard as PositionedItem,
    targetIndex
  );

  setError(null);

  try {
    const res = await fetch(`/api/cards/${draggedId}/position`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ position: newPosition }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to reorder card");
    }

    const updatedCard = await res.json();
    const newCards = cards.map((c) => (c.id === draggedId ? updatedCard : c));
    newCards.sort((a, b) => a.position - b.position);
    setCards(newCards);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to reorder card");
  } finally {
    setDraggedId(null);
  }
}

// Update card render to add drag attributes:
<div
  key={card.id}
  draggable={editingId !== card.id}
  onDragStart={(e) => handleDragStart(e, card)}
  onDragOver={handleDragOver}
  onDrop={(e) => handleDrop(e, card)}
  className={`p-3 bg-white rounded shadow-sm border border-gray-200 cursor-move ${draggedId === card.id ? 'opacity-50' : ''}`}
>
  {/* ...existing card content... */}
</div>
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Cards can be dragged to reorder within column (manual verification)
- [ ] New order persists after page reload (manual verification)
- [ ] Drag visual feedback (opacity) works (manual verification)
- [ ] Drag disabled during edit mode (manual verification)

---

## Task 9: CardManager Component — Drag-and-Drop Between Columns

### Overview
Add support for dragging cards from one column to another. Update drag handlers to detect cross-column drops, calculate new position in target column, and call `/api/cards/:id/column` endpoint.

### Changes Required

**File**: `src/components/CardManager.tsx`
**Changes**: Expose onCardDrop callback for parent component
```typescript
// Update props interface
interface CardManagerProps {
  columnId: number;
  onCardDrop?: (cardId: number, targetColumnId: number) => void;
}

// Update component signature
export default function CardManager({ columnId, onCardDrop }: CardManagerProps) {
  // ...existing code...

  // Update handleDrop to check if drop is cross-column
  async function handleDrop(e: React.DragEvent, targetCard: Card) {
    e.preventDefault();

    if (!draggedId) {
      setDraggedId(null);
      return;
    }

    const draggedCard = cards.find((c) => c.id === draggedId);
    if (!draggedCard) {
      setDraggedId(null);
      return;
    }

    // Same column reorder (existing logic)
    if (draggedCard.column_id === targetCard.column_id) {
      // ...existing reorder logic...
      return;
    }

    // Cross-column move — delegate to parent
    if (onCardDrop) {
      onCardDrop(draggedId, targetCard.column_id);
      setDraggedId(null);
    }
  }

  // Add drop zone for empty column
  function handleDropOnColumn(e: React.DragEvent) {
    e.preventDefault();

    if (!draggedId || !onCardDrop) {
      setDraggedId(null);
      return;
    }

    onCardDrop(draggedId, columnId);
    setDraggedId(null);
  }

  // Update return JSX to add drop zone on empty area
  return (
    <div
      className="space-y-2 min-h-[100px]"
      onDragOver={handleDragOver}
      onDrop={handleDropOnColumn}
    >
      {/* ...existing content... */}
    </div>
  );
}
```

**File**: `src/components/ColumnManager.tsx`
**Changes**: Implement cross-column card move logic
```typescript
// Add card state at top level
const [allCards, setAllCards] = useState<Record<number, any[]>>({});

// Fetch all cards for all columns
useEffect(() => {
  async function fetchAllCards() {
    const cardsByColumn: Record<number, any[]> = {};
    for (const column of columns) {
      const res = await fetch(`/api/cards?columnId=${column.id}`);
      if (res.ok) {
        cardsByColumn[column.id] = await res.json();
      }
    }
    setAllCards(cardsByColumn);
  }
  if (columns.length > 0) fetchAllCards();
}, [columns]);

// Handle cross-column card drop
async function handleCardDrop(cardId: number, targetColumnId: number) {
  try {
    // Calculate position as last in target column
    const targetCards = allCards[targetColumnId] || [];
    const position = targetCards.length > 0
      ? Math.max(...targetCards.map((c: any) => c.position)) + 1000
      : 1000;

    const res = await fetch(`/api/cards/${cardId}/column`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: targetColumnId, position }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to move card");
    }

    // Refresh cards for both columns
    const updatedCard = await res.json();
    const sourceColumnId = updatedCard.column_id;

    // Update allCards state
    setAllCards((prev) => ({
      ...prev,
      [sourceColumnId]: prev[sourceColumnId].filter((c: any) => c.id !== cardId),
      [targetColumnId]: [...(prev[targetColumnId] || []), updatedCard],
    }));
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to move card");
  }
}

// Pass onCardDrop to CardManager
<CardManager columnId={column.id} onCardDrop={handleCardDrop} />
```

**Note**: This implementation is simplified. Full implementation will require passing allCards state down to CardManager or refactoring to lift card state to ColumnManager. Adjust as needed based on component architecture.

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Cards can be dragged from one column to another (manual verification)
- [ ] Card moves to target column and persists on reload (manual verification)
- [ ] Card removed from source column UI (manual verification)

---

## Task 10: Write Playwright E2E Tests

### Overview
Write comprehensive E2E tests covering all MVP features: board CRUD, column CRUD, card CRUD, drag-within-column, drag-between-columns. Use Playwright best practices with page objects and helper functions.

### Changes Required

**File**: `tests/boards.spec.ts` (new file)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Board Management', () => {
  test('can create a new board', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[placeholder*="board name"]', 'Test Board');
    await page.click('button:has-text("Create Board")');

    await expect(page.locator('text=Test Board')).toBeVisible();
  });

  test('can rename a board', async ({ page }) => {
    await page.goto('/');

    // Create board first
    await page.fill('input[placeholder*="board name"]', 'Original Name');
    await page.click('button:has-text("Create Board")');

    // Rename board
    await page.click('text=Original Name');
    await page.fill('input[value="Original Name"]', 'Updated Name');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=Updated Name')).toBeVisible();
    await expect(page.locator('text=Original Name')).not.toBeVisible();
  });

  test('can delete a board', async ({ page }) => {
    await page.goto('/');

    // Create board first
    await page.fill('input[placeholder*="board name"]', 'Board to Delete');
    await page.click('button:has-text("Create Board")');

    // Delete board
    page.on('dialog', dialog => dialog.accept());
    await page.click('text=Board to Delete >> .. >> button:has-text("Delete")');

    await expect(page.locator('text=Board to Delete')).not.toBeVisible();
  });
});
```

**File**: `tests/columns.spec.ts` (new file)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Column Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder*="board name"]', 'Test Board');
    await page.click('button:has-text("Create Board")');
    await page.click('text=Test Board');
  });

  test('can create a column', async ({ page }) => {
    await page.fill('input[placeholder*="column"]', 'To Do');
    await page.click('button:has-text("Add Column")');

    await expect(page.locator('text=To Do')).toBeVisible();
  });

  test('can rename a column', async ({ page }) => {
    await page.fill('input[placeholder*="column"]', 'Original Column');
    await page.click('button:has-text("Add Column")');

    await page.click('text=Original Column');
    await page.fill('input[value="Original Column"]', 'Updated Column');
    await page.keyboard.press('Enter');

    await expect(page.locator('text=Updated Column')).toBeVisible();
  });

  test('can reorder columns via drag-and-drop', async ({ page }) => {
    // Create two columns
    await page.fill('input[placeholder*="column"]', 'Column 1');
    await page.click('button:has-text("Add Column")');
    await page.fill('input[placeholder*="column"]', 'Column 2');
    await page.click('button:has-text("Add Column")');

    // Drag Column 2 before Column 1
    const column1 = page.locator('text=Column 1').first();
    const column2 = page.locator('text=Column 2').first();

    await column2.dragTo(column1);

    // Verify order persists on reload
    await page.reload();
    const columns = page.locator('[draggable="true"]');
    await expect(columns.nth(0)).toContainText('Column 2');
    await expect(columns.nth(1)).toContainText('Column 1');
  });
});
```

**File**: `tests/cards.spec.ts` (new file)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Card Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder*="board name"]', 'Test Board');
    await page.click('button:has-text("Create Board")');
    await page.click('text=Test Board');
    await page.fill('input[placeholder*="column"]', 'To Do');
    await page.click('button:has-text("Add Column")');
  });

  test('can create a card', async ({ page }) => {
    await page.fill('input[placeholder*="card"]', 'New Task');
    await page.click('button:has-text("Add Card")');

    await expect(page.locator('text=New Task')).toBeVisible();
  });

  test('can edit card title, description, and color', async ({ page }) => {
    await page.fill('input[placeholder*="card"]', 'Original Task');
    await page.click('button:has-text("Add Card")');

    // Enter edit mode
    await page.click('text=Original Task');

    // Edit fields
    await page.fill('input[value="Original Task"]', 'Updated Task');
    await page.fill('textarea[placeholder*="Description"]', 'Task description here');
    await page.selectOption('select', 'blue');
    await page.click('button:has-text("Save")');

    await expect(page.locator('text=Updated Task')).toBeVisible();
    await expect(page.locator('text=Task description here')).toBeVisible();
    await expect(page.locator('text=blue')).toBeVisible();
  });

  test('can drag card within column to reorder', async ({ page }) => {
    // Create two cards
    await page.fill('input[placeholder*="card"]', 'Card 1');
    await page.click('button:has-text("Add Card")');
    await page.fill('input[placeholder*="card"]', 'Card 2');
    await page.click('button:has-text("Add Card")');

    // Drag Card 2 above Card 1
    const card1 = page.locator('text=Card 1').first();
    const card2 = page.locator('text=Card 2').first();

    await card2.dragTo(card1);

    // Verify order persists on reload
    await page.reload();
    const cards = page.locator('[draggable="true"]');
    await expect(cards.nth(0)).toContainText('Card 2');
    await expect(cards.nth(1)).toContainText('Card 1');
  });

  test('can drag card from one column to another', async ({ page }) => {
    // Create second column
    await page.fill('input[placeholder*="column"]', 'In Progress');
    await page.click('button:has-text("Add Column")');

    // Create card in first column
    await page.fill('input[placeholder*="card"]', 'Task to Move');
    await page.click('button:has-text("Add Card")');

    // Drag card to second column
    const card = page.locator('text=Task to Move').first();
    const targetColumn = page.locator('text=In Progress').locator('..').locator('..');

    await card.dragTo(targetColumn);

    // Verify card moved
    await expect(targetColumn.locator('text=Task to Move')).toBeVisible();

    // Verify move persists on reload
    await page.reload();
    await expect(targetColumn.locator('text=Task to Move')).toBeVisible();
  });

  test('deleting column cascades and deletes cards', async ({ page }) => {
    // Create card in column
    await page.fill('input[placeholder*="card"]', 'Card to Delete');
    await page.click('button:has-text("Add Card")');

    await expect(page.locator('text=Card to Delete')).toBeVisible();

    // Delete column
    page.on('dialog', dialog => dialog.accept());
    await page.click('text=To Do >> .. >> button:has-text("Delete")');

    // Verify column and card both gone
    await expect(page.locator('text=To Do')).not.toBeVisible();
    await expect(page.locator('text=Card to Delete')).not.toBeVisible();
  });

  test('can delete a card', async ({ page }) => {
    await page.fill('input[placeholder*="card"]', 'Card to Delete');
    await page.click('button:has-text("Add Card")');

    page.on('dialog', dialog => dialog.accept());
    await page.click('text=Card to Delete >> .. >> button:has-text("Delete")');

    await expect(page.locator('text=Card to Delete')).not.toBeVisible();
  });
});
```

### Success Criteria
- [ ] All E2E tests pass in headless mode (`npm run test:e2e`)
- [ ] Tests can run in UI mode (`npm run test:e2e:ui`)
- [ ] 8+ E2E scenarios covered (boards CRUD, columns CRUD, cards CRUD, drag-within-column, drag-between-columns)
- [ ] Tests cover cascade delete behavior

---

## Task 11: Update Documentation

### Overview
Update AGENTS.md with card architecture details (table schema, color label values, drag-between-columns behavior, CASCADE DELETE, positioning utility, E2E test commands). Update README.md with feature completion status and E2E test instructions.

### Changes Required

**File**: `AGENTS.md`
**Changes**: Add new sections for cards, positioning utility, and E2E tests

Add after Columns section:
```markdown
## Cards

Cards belong to columns and can be created, edited, deleted, and reordered via drag-and-drop.

### Schema

Table: `cards` (defined in `db/migrations/003_create_cards.sql`)
- `id` — INTEGER PRIMARY KEY AUTOINCREMENT
- `column_id` — INTEGER NOT NULL, FOREIGN KEY to columns(id) ON DELETE CASCADE
- `title` — TEXT NOT NULL
- `description` — TEXT (nullable, optional)
- `color` — TEXT (nullable, one of: red, blue, green, yellow, purple, gray)
- `position` — INTEGER NOT NULL (for ordering within column)
- `created_at` — TEXT NOT NULL DEFAULT (datetime('now'))
- `updated_at` — TEXT NOT NULL DEFAULT (datetime('now'))

Indexes:
- `idx_cards_column_id` on column_id
- `idx_cards_position` on position

### Repository

`src/lib/db/cards.ts` exports:
- `createCard(columnId, title, description?, color?)` — Create card, validates title non-empty, validates column exists, calculates position
- `listCardsByColumn(columnId)` — Returns cards for column sorted by position ASC
- `getCardById(id)` — Returns card or undefined
- `updateCard(id, { title?, description?, color? })` — Updates card fields, validates title if provided
- `deleteCard(id)` — Deletes card, returns true if deleted
- `updateCardPosition(id, position)` — Updates position for reordering within column
- `updateCardColumn(id, columnId, position)` — Moves card to different column, validates column exists

### API Endpoints

- `POST /api/cards` — Create card (body: `{ columnId, title, description?, color? }`) → 201 with card
- `GET /api/cards?columnId=X` — List cards for column → 200 with array
- `PATCH /api/cards/:id` — Update card (body: `{ title?, description?, color? }`) → 200 with card
- `DELETE /api/cards/:id` — Delete card → 204
- `PATCH /api/cards/:id/position` — Update position (body: `{ position }`) → 200 with card
- `PATCH /api/cards/:id/column` — Move card to different column (body: `{ columnId, position }`) → 200 with card

### UI Component

`src/components/CardManager.tsx` — Renders cards within a column, create form, inline edit, delete, drag-to-reorder

Props:
- `columnId` — Column ID to fetch/create cards for
- `onCardDrop?` — Callback for cross-column card drops

State:
- cards, loading, error, creating, editingId, updatingId, deletingId, draggedId

Features:
- Create card with title input
- Edit card inline (click title to enter edit mode)
- Delete card with confirmation
- Drag card to reorder within column (HTML5 DnD)
- Drag card to different column (calls onCardDrop callback)
- Color label selector (6 colors: red, blue, green, yellow, purple, gray)
- Description field (optional, shown inline)

### Color Labels

Predefined colors (stored as lowercase strings in database):
- `red` — displayed with bg-red-200 text-red-900
- `blue` — displayed with bg-blue-200 text-blue-900
- `green` — displayed with bg-green-200 text-green-900
- `yellow` — displayed with bg-yellow-200 text-yellow-900
- `purple` — displayed with bg-purple-200 text-purple-900
- `gray` — displayed with bg-gray-200 text-gray-900

No database constraint enforced — validation happens in UI component.

### Cascade Delete

When a column is deleted, all cards in that column are automatically deleted via `ON DELETE CASCADE` foreign key constraint. This is enforced at the database layer, no application code needed.
```

Add new section for positioning utility:
```markdown
## Positioning Utility

`src/lib/utils/positioning.ts` — Shared positioning logic for columns and cards

Exports:
- `POSITION_GAP` — Constant (1000)
- `calculateInitialPosition(items)` — Calculate position for new item (max position + 1000)
- `calculateReorderPosition(items, draggedItem, targetIndex)` — Calculate position when reordering item

Strategy: Integer gaps of 1000 between items. Reordering calculates midpoint between neighbors to avoid renumbering all items.

Known limitation: After many reorders, positions can converge (e.g., 1000 → 1001 → 1001.5 → floor rounding collisions). No rebalancing logic implemented yet (deferred technical debt).
```

Add new section for E2E tests:
```markdown
## E2E Tests

Playwright tests covering all MVP features.

### Commands

- `npm run test:e2e` — Run tests in headless mode (CI-friendly)
- `npm run test:e2e:ui` — Run tests with Playwright UI (interactive, watch mode)
- `npm run test:e2e:debug` — Run tests with debugger

### Test Files

- `tests/boards.spec.ts` — Board CRUD (create, rename, delete)
- `tests/columns.spec.ts` — Column CRUD + drag-to-reorder
- `tests/cards.spec.ts` — Card CRUD + drag-within-column + drag-between-columns + cascade delete

### Configuration

`playwright.config.ts` — Configured for Chromium and Firefox, auto-starts dev server, headless by default
```

**File**: `README.md`
**Changes**: Update feature list and add E2E test instructions

Replace feature list section with:
```markdown
## Features

✅ **Boards** — Create, rename, delete boards
✅ **Columns** — Create, rename, delete, reorder columns within board
✅ **Cards** — Create, edit (title, description, color label), delete, reorder cards within column
✅ **Drag-and-Drop** — Reorder columns and cards, move cards between columns
✅ **Persistence** — SQLite database with migrations, foreign key constraints, cascade delete
✅ **Responsive** — Mobile-friendly Tailwind CSS layout
✅ **Testing** — Unit tests (Vitest), integration tests (real SQLite), component tests (React Testing Library), E2E tests (Playwright)

All BRIEF.md MVP features are complete. 🎉
```

Add E2E test section:
```markdown
## Testing

### Unit & Integration Tests

npm test

Run tests with coverage:

npm run test:coverage

### E2E Tests

Run Playwright tests in headless mode:

npm run test:e2e

Run Playwright tests with UI (interactive):

npm run test:e2e:ui
```

### Success Criteria
- [ ] AGENTS.md has card architecture section
- [ ] AGENTS.md has positioning utility section
- [ ] AGENTS.md has E2E test commands section
- [ ] README.md feature list shows all features complete
- [ ] README.md has E2E test instructions

---

## Testing Strategy

### Unit Tests
- Positioning utility (8+ tests): empty list, single item, multiple items, reorder edge cases
- Card repository (20+ tests): CRUD operations, validation errors, position calculation, cascade delete
- Focus on edge cases: empty strings, missing foreign keys, null values, position overflow

### Integration Tests
- Card API routes (25+ tests): success paths, validation errors, 400/404 responses, malformed JSON
- Use real database in tests (no mocks), validate status codes and response bodies

### Component Tests
- CardManager (8+ tests): render states (loading, error, empty), create card, edit card, delete card, drag handlers
- Mock fetch API, test optimistic updates and error handling

### E2E Tests
- Playwright (8+ scenarios): board CRUD, column CRUD, card CRUD, drag-within-column, drag-between-columns, cascade delete
- Use page.dragTo() for drag-and-drop testing
- Verify persistence with page.reload()

### Mocking Strategy
- **Database layer**: No mocks — use real SQLite with temp files
- **API layer**: No mocks — use real database layer
- **Component layer**: Mock fetch API only (use vi.fn())
- **E2E layer**: No mocks — test full stack end-to-end

## Risk Assessment

### Risk: Drag-and-drop cross-browser compatibility
**Issue**: HTML5 DnD API has quirks across browsers, especially on mobile
**Mitigation**: E2E tests run on Chromium and Firefox to catch issues early. Mobile support is basic (no mobile-specific drag libraries needed for MVP).

### Risk: Position integer overflow after many reorders
**Issue**: Positions converge below 1 after many reorders (e.g., 1000 → 500 → 250 → ... → 0)
**Mitigation**: Documented as known limitation in AGENTS.md. Rebalancing logic deferred to post-MVP (not in scope for Phase 3). Average user unlikely to hit this limit in normal usage.

### Risk: Cross-column card drag complexity
**Issue**: CardManager needs to communicate with parent ColumnManager for cross-column drops, requires careful state management
**Mitigation**: Use onCardDrop callback pattern (similar to React event bubbling). Full implementation may require lifting card state to ColumnManager. Plan includes simplified approach; adjust as needed during implementation.

### Risk: E2E test flakiness
**Issue**: Playwright tests can be flaky due to timing issues (animations, async API calls)
**Mitigation**: Use Playwright's built-in waitFor and expect assertions (auto-retry). Configure retries in playwright.config.ts (2 retries in CI). Test on stable URLs (http://localhost:4321) with auto-started dev server.

### Risk: Test count requirements (20+, 25+, 8+) may be too prescriptive
**Issue**: Spec requires specific test counts, but quality matters more than quantity
**Mitigation**: Treat numbers as minimum thresholds, not targets. Write tests for all meaningful scenarios; numbers are estimates based on Phase 1 & 2 patterns.
