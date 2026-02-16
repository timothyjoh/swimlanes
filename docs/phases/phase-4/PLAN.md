# Implementation Plan: Phase 4

## Overview
Phase 4 addresses position convergence by implementing automatic rebalancing when positions get too close (gaps < 10), adds keyboard shortcuts for navigation and editing (Enter, Escape, arrows, Delete), and improves visual feedback with drag previews, drop zone highlighting, focus indicators, and ARIA labels for accessibility.

## Current State (from Research)

**Position System** (`src/lib/utils/positioning.ts`):
- Integer gaps of 1000 between items (POSITION_GAP = 1000)
- `calculateReorderPosition()` uses midpoint: `Math.floor((before.position + after.position) / 2)`
- Known limitation: after many reorders, midpoint calculation converges below 1
- No rebalancing logic exists

**Repository Layer** (`src/lib/db/cards.ts`, `src/lib/db/columns.ts`):
- `listCardsByColumn(columnId)` returns cards ordered by position ASC
- `listColumnsByBoard(boardId)` returns columns ordered by position ASC
- `updateCardPosition(id, position)` and `updateColumnPosition(id, position)` exist
- Better-sqlite3 supports `db.transaction()` for atomicity
- No rebalancing functions exist

**UI Components** (`src/components/CardManager.tsx`, `src/components/ColumnManager.tsx`):
- Inline editing already uses Escape key to cancel (ColumnManager lines 332-335)
- Drag-and-drop uses HTML5 DnD with `opacity-50` on dragged item
- No keyboard shortcuts for Enter, arrow keys, or Delete
- No drop zone highlighting or ARIA attributes
- No focus state tracking for keyboard navigation

**Test Infrastructure**:
- Vitest for unit/integration tests with 80%+ coverage requirement on `src/lib/`
- Playwright for E2E tests with `getByRole()` patterns
- 173 passing tests currently

## Desired End State

After Phase 4:
1. **Positions remain usable indefinitely** — After 50+ drag-and-drop operations, positions maintain gaps ≥ 1000
2. **Rebalancing is transparent** — When positions converge (gap < 10), automatic rebalancing renumbers items to 1000, 2000, 3000, ...
3. **Keyboard navigation works** — Enter starts editing, Escape cancels, arrow keys navigate between cards, Delete triggers confirmation
4. **Visual feedback is clear** — Dragged items show semi-transparent preview, drop zones highlight on hover, focus indicators visible
5. **Accessibility improved** — ARIA labels on all interactive elements, screen reader announcements for drag operations
6. **Documentation updated** — AGENTS.md documents rebalancing strategy and keyboard shortcuts, README.md lists keyboard shortcuts

**Verification**:
- Run E2E stress test: perform 50+ drag operations, verify positions remain valid
- Use keyboard to navigate, edit, and delete cards without touching mouse
- Inspect DOM for ARIA attributes (`aria-label`, `aria-live`, `role="status"`)
- Test with VoiceOver/NVDA to verify screen reader announcements

## What We're NOT Doing

- Card search/filtering (future enhancement)
- Undo/redo functionality (significant architecture change)
- Export board to JSON/CSV (future enhancement)
- Dark mode theme toggle (future enhancement)
- Card archiving/soft delete (future enhancement)
- Mobile touch-based drag improvements (not critical per Phase 3 reflections)
- Multi-board views or board templates
- Custom keyboard shortcut configuration (future enhancement)
- Drag preview with custom image via `setDragImage()` (simple approach sufficient)

## Implementation Approach

**Bottom-up build order** (proven in all phases): DB → API → UI with tests at each layer.

**Rebalancing strategy**:
- Detect convergence after drag-and-drop operations (implicit approach)
- Check if any gap between consecutive items is < 10 (threshold from spec)
- Rebalance in single transaction using better-sqlite3's `db.transaction()`
- Renumber items to 1000, 2000, 3000, ... maintaining relative order
- Return boolean flag to indicate if rebalancing occurred (for debugging/logging)

**Keyboard shortcuts strategy**:
- Track `focusedCardId` state in CardManager for arrow key navigation
- Track `focusedColumnId` state in ColumnManager for column-level shortcuts
- Disable shortcuts during inline editing (check `editingId === null`)
- Use `onKeyDown` handlers with `e.key` checks
- Apply focus styles via Tailwind classes when item is focused

**Visual feedback strategy**:
- Track `dropTargetId` state in CardManager for drop zone highlighting
- Apply different background/border when `dropTargetId` matches item
- Use Tailwind classes: `ring-2 ring-blue-500` for focus, `bg-blue-50 border-blue-300` for drop zones
- Drag preview: keep existing `opacity-50` on original, no need for custom ghost

**ARIA strategy**:
- Add `aria-label` attributes to all draggable items (e.g., "Card: Task title")
- Add live region (`role="status" aria-live="polite"`) in ColumnManager
- Update live region text after successful drag-and-drop (e.g., "Moved 'Task title' to 'Done' column")
- Add `aria-describedby` to cards pointing to color label

---

## Task 1: Implement Rebalancing Logic in Repository Layer

### Overview
Add `rebalanceColumnPositions(boardId)` and `rebalanceCardPositions(columnId)` functions to repository layer. These functions detect when positions converge below threshold (gap < 10) and renumber all items to 1000, 2000, 3000, ... in a single transaction.

### Changes Required

**File**: `src/lib/db/cards.ts`

Add new function at end of file (after `updateCardColumn`):

```typescript
/**
 * Rebalance card positions in a column if positions are too close together.
 * Renumbers cards to 1000, 2000, 3000, ... maintaining relative order.
 *
 * @param columnId - The column to rebalance
 * @returns true if rebalancing occurred, false if positions were healthy
 */
export function rebalanceCardPositions(columnId: number): boolean {
  const db = getDb();
  const cards = listCardsByColumn(columnId); // Already ordered by position ASC

  if (cards.length <= 1) return false; // Single item or empty: no rebalancing needed

  // Check if any gap between consecutive items is < 10
  let needsRebalancing = false;
  for (let i = 1; i < cards.length; i++) {
    const gap = cards[i].position - cards[i - 1].position;
    if (gap < 10) {
      needsRebalancing = true;
      break;
    }
  }

  if (!needsRebalancing) return false;

  // Rebalance in single transaction
  const rebalance = db.transaction(() => {
    for (let i = 0; i < cards.length; i++) {
      const newPosition = (i + 1) * 1000; // 1000, 2000, 3000, ...
      db.prepare(
        "UPDATE cards SET position = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newPosition, cards[i].id);
    }
  });

  rebalance();
  return true;
}
```

**File**: `src/lib/db/columns.ts`

Add similar function at end of file (after `updateColumnPosition`):

```typescript
/**
 * Rebalance column positions in a board if positions are too close together.
 * Renumbers columns to 1000, 2000, 3000, ... maintaining relative order.
 *
 * @param boardId - The board to rebalance
 * @returns true if rebalancing occurred, false if positions were healthy
 */
export function rebalanceColumnPositions(boardId: number): boolean {
  const db = getDb();
  const columns = listColumnsByBoard(boardId); // Already ordered by position ASC

  if (columns.length <= 1) return false; // Single item or empty: no rebalancing needed

  // Check if any gap between consecutive items is < 10
  let needsRebalancing = false;
  for (let i = 1; i < columns.length; i++) {
    const gap = columns[i].position - columns[i - 1].position;
    if (gap < 10) {
      needsRebalancing = true;
      break;
    }
  }

  if (!needsRebalancing) return false;

  // Rebalance in single transaction
  const rebalance = db.transaction(() => {
    for (let i = 0; i < columns.length; i++) {
      const newPosition = (i + 1) * 1000; // 1000, 2000, 3000, ...
      db.prepare(
        "UPDATE columns SET position = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(newPosition, columns[i].id);
    }
  });

  rebalance();
  return true;
}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Unit tests pass (see Task 2)
- [ ] Functions return `true` when rebalancing occurs, `false` when positions are healthy
- [ ] Rebalancing maintains relative order of items
- [ ] Single item or empty list returns `false` immediately (no-op)

---

## Task 2: Add Unit Tests for Rebalancing Logic

### Overview
Write comprehensive unit tests for `rebalanceCardPositions()` and `rebalanceColumnPositions()` covering convergence detection, rebalancing output, edge cases, and transaction rollback.

### Changes Required

**File**: `src/lib/db/__tests__/cards.test.ts`

Add new test suite at end of file:

```typescript
describe('rebalanceCardPositions', () => {
  test('returns false when positions are healthy (gap ≥ 10)', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    await createCard(columnId, 'Card 1'); // position 1000
    await createCard(columnId, 'Card 2'); // position 2000
    await createCard(columnId, 'Card 3'); // position 3000

    const result = rebalanceCardPositions(columnId);
    expect(result).toBe(false);
  });

  test('returns true and rebalances when gap < 10', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    const card1 = await createCard(columnId, 'Card 1');
    const card2 = await createCard(columnId, 'Card 2');
    const card3 = await createCard(columnId, 'Card 3');

    // Manually set positions to force convergence
    updateCardPosition(card1.id, 1000);
    updateCardPosition(card2.id, 1005);
    updateCardPosition(card3.id, 1008); // gap = 3, triggers rebalancing

    const result = rebalanceCardPositions(columnId);
    expect(result).toBe(true);

    // Verify positions after rebalancing
    const cards = listCardsByColumn(columnId);
    expect(cards[0].position).toBe(1000);
    expect(cards[1].position).toBe(2000);
    expect(cards[2].position).toBe(3000);
  });

  test('maintains relative order during rebalancing', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    const cardA = await createCard(columnId, 'Card A');
    const cardB = await createCard(columnId, 'Card B');
    const cardC = await createCard(columnId, 'Card C');

    // Set positions with small gaps
    updateCardPosition(cardA.id, 100);
    updateCardPosition(cardB.id, 105);
    updateCardPosition(cardC.id, 107);

    rebalanceCardPositions(columnId);

    const cards = listCardsByColumn(columnId);
    expect(cards[0].id).toBe(cardA.id); // A is still first
    expect(cards[1].id).toBe(cardB.id); // B is still second
    expect(cards[2].id).toBe(cardC.id); // C is still third
  });

  test('returns false for single card (no rebalancing needed)', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    await createCard(columnId, 'Only Card');

    const result = rebalanceCardPositions(columnId);
    expect(result).toBe(false);
  });

  test('returns false for empty column', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();

    const result = rebalanceCardPositions(columnId);
    expect(result).toBe(false);
  });

  test('rebalances correctly with positions below 10', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    const card1 = await createCard(columnId, 'Card 1');
    const card2 = await createCard(columnId, 'Card 2');

    // Extreme convergence: positions 0 and 1
    updateCardPosition(card1.id, 0);
    updateCardPosition(card2.id, 1);

    const result = rebalanceCardPositions(columnId);
    expect(result).toBe(true);

    const cards = listCardsByColumn(columnId);
    expect(cards[0].position).toBe(1000);
    expect(cards[1].position).toBe(2000);
  });

  test('handles many cards (10+ items)', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    const cardIds = [];

    // Create 15 cards with converged positions
    for (let i = 0; i < 15; i++) {
      const card = await createCard(columnId, `Card ${i + 1}`);
      updateCardPosition(card.id, 1000 + i); // positions 1000, 1001, 1002, ...
      cardIds.push(card.id);
    }

    const result = rebalanceCardPositions(columnId);
    expect(result).toBe(true);

    const cards = listCardsByColumn(columnId);
    expect(cards.length).toBe(15);
    expect(cards[0].position).toBe(1000);
    expect(cards[14].position).toBe(15000);

    // Verify order is preserved
    for (let i = 0; i < 15; i++) {
      expect(cards[i].id).toBe(cardIds[i]);
    }
  });
});
```

**File**: `src/lib/db/__tests__/columns.test.ts`

Add similar test suite (mirror the card tests for columns):

```typescript
describe('rebalanceColumnPositions', () => {
  // Same test structure as cards, but for columns in a board
  // 7 tests total: healthy positions, rebalancing, order preservation, single column, empty board, extreme convergence, many columns
});
```

### Success Criteria
- [ ] All 14 unit tests pass (7 for cards, 7 for columns)
- [ ] Tests cover: healthy positions (no-op), convergence detection, rebalancing output, order preservation, edge cases (single item, empty list, positions < 10), many items (10+)
- [ ] Coverage on rebalancing functions is 100%

---

## Task 3: Integrate Rebalancing into Position Update Endpoints

### Overview
Call rebalancing functions automatically after position updates in API endpoints. This makes rebalancing transparent to the UI — no explicit API calls needed.

### Changes Required

**File**: `src/pages/api/cards/[id]/position.ts`

Modify the `PATCH` handler to call rebalancing after updating position:

```typescript
import type { APIRoute } from "astro";
import { updateCardPosition, rebalanceCardPositions, getCardById } from "../../../../lib/db/cards";

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = Number(params.id);
  if (isNaN(id)) {
    return new Response(JSON.stringify({ error: "Invalid card ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (typeof body.position !== "number") {
    return new Response(
      JSON.stringify({
        error: "position is required and must be a number",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const card = updateCardPosition(id, body.position);
  if (!card) {
    return new Response(
      JSON.stringify({ error: `Card ${id} not found` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check if rebalancing is needed after position update
  rebalanceCardPositions(card.column_id);

  // Re-fetch card to get updated position if rebalancing occurred
  const updatedCard = getCardById(id);

  return new Response(JSON.stringify(updatedCard), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
```

**File**: `src/pages/api/cards/[id]/column.ts`

Add rebalancing call after moving card to different column:

```typescript
// After updateCardColumn call, add:
rebalanceCardPositions(body.columnId);
const updatedCard = getCardById(id);
```

**File**: `src/pages/api/columns/[id]/position.ts`

Modify to call rebalancing after column position update:

```typescript
import type { APIRoute } from "astro";
import { updateColumnPosition, rebalanceColumnPositions, getColumnById } from "../../../../lib/db/columns";

export const PATCH: APIRoute = async ({ params, request }) => {
  // ... existing validation code ...

  const column = updateColumnPosition(id, body.position);
  if (!column) {
    return new Response(
      JSON.stringify({ error: `Column ${id} not found` }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Check if rebalancing is needed after position update
  rebalanceColumnPositions(column.board_id);

  // Re-fetch column to get updated position if rebalancing occurred
  const updatedColumn = getColumnById(id);

  return new Response(JSON.stringify(updatedColumn), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] API endpoint tests pass (existing tests still work)
- [ ] Integration test: after multiple position updates, positions remain above threshold (see Task 4)
- [ ] Re-fetching after rebalancing ensures UI gets latest positions

---

## Task 4: Add Integration Tests for Rebalancing After Position Updates

### Overview
Write integration tests that call API endpoints multiple times to force convergence, then verify rebalancing maintains positions ≥ 1000.

### Changes Required

**File**: `src/pages/api/cards/__tests__/cards-api.test.ts`

Add new test suite at end of file:

```typescript
describe('Automatic rebalancing', () => {
  test('rebalances card positions after multiple reorders', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    const card1 = await createCard(columnId, 'Card 1');
    const card2 = await createCard(columnId, 'Card 2');
    const card3 = await createCard(columnId, 'Card 3');

    // Simulate multiple reorders by repeatedly setting positions to midpoints
    // This mimics user dragging cards back and forth
    for (let i = 0; i < 20; i++) {
      const cards = listCardsByColumn(columnId);
      const midpoint = Math.floor((cards[0].position + cards[1].position) / 2);
      updateCardPosition(cards[2].id, midpoint); // Move card3 between card1 and card2
    }

    // After many reorders, rebalancing should have kicked in
    const finalCards = listCardsByColumn(columnId);

    // All positions should be ≥ 1000 (healthy gaps)
    expect(finalCards[0].position).toBeGreaterThanOrEqual(1000);
    expect(finalCards[1].position).toBeGreaterThanOrEqual(1000);
    expect(finalCards[2].position).toBeGreaterThanOrEqual(1000);

    // Gaps should be ≥ 1000 (rebalanced output)
    const gap1 = finalCards[1].position - finalCards[0].position;
    const gap2 = finalCards[2].position - finalCards[1].position;
    expect(gap1).toBeGreaterThanOrEqual(1000);
    expect(gap2).toBeGreaterThanOrEqual(1000);
  });

  test('rebalancing preserves relative order during API calls', async () => {
    const { boardId, columnId } = await setupBoardAndColumn();
    const cardA = await createCard(columnId, 'Card A');
    const cardB = await createCard(columnId, 'Card B');
    const cardC = await createCard(columnId, 'Card C');

    // Force convergence by setting close positions
    updateCardPosition(cardA.id, 1000);
    updateCardPosition(cardB.id, 1005);
    updateCardPosition(cardC.id, 1008); // This should trigger rebalancing

    const cards = listCardsByColumn(columnId);
    expect(cards[0].id).toBe(cardA.id);
    expect(cards[1].id).toBe(cardB.id);
    expect(cards[2].id).toBe(cardC.id);
  });
});
```

**File**: `src/pages/api/columns/__tests__/columns-api.test.ts`

Add similar test suite for column rebalancing:

```typescript
describe('Automatic rebalancing', () => {
  // Same structure: rebalances after multiple reorders, preserves order
  // 2 tests total
});
```

### Success Criteria
- [ ] All 4 integration tests pass (2 for cards, 2 for columns)
- [ ] Tests verify positions remain ≥ 1000 after many reorders
- [ ] Tests verify relative order is preserved after rebalancing

---

## Task 5: Add Keyboard Focus State and Visual Indicators

### Overview
Add `focusedCardId` state to CardManager and `focusedColumnId` state to ColumnManager. Add visual focus indicators (ring-2 ring-blue-500) when items are focused. This prepares for keyboard navigation in next tasks.

### Changes Required

**File**: `src/components/CardManager.tsx`

Add state variable after existing state declarations (after line 49):

```typescript
const [focusedCardId, setFocusedCardId] = useState<number | null>(null);
```

Add focus indicator to card rendering (around line 310, modify the className):

```typescript
className={`
  bg-white rounded shadow-sm border border-gray-200 p-4 cursor-pointer
  ${draggedId === card.id ? "opacity-50" : ""}
  ${focusedCardId === card.id ? "ring-2 ring-blue-500" : ""}
`}
tabIndex={0}
onFocus={() => setFocusedCardId(card.id)}
onBlur={() => setFocusedCardId(null)}
```

**File**: `src/components/ColumnManager.tsx`

Add state variable after existing state declarations (after line 28):

```typescript
const [focusedColumnId, setFocusedColumnId] = useState<number | null>(null);
```

Add focus indicator to column rendering (around line 318, modify the className):

```typescript
className={`
  bg-gray-100 rounded p-4 w-80 flex-shrink-0
  ${draggedId === column.id ? "opacity-50" : ""}
  ${focusedColumnId === column.id ? "ring-2 ring-blue-500" : ""}
`}
tabIndex={0}
onFocus={() => setFocusedColumnId(column.id)}
onBlur={() => setFocusedColumnId(null)}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Clicking a card shows blue ring around it
- [ ] Clicking another card moves focus ring
- [ ] Same behavior for columns
- [ ] Focus ring disappears on blur

---

## Task 6: Implement Enter Key to Start Editing

### Overview
Add `onKeyDown` handler to cards and columns to detect Enter key press and start inline editing when focused item is not already being edited.

### Changes Required

**File**: `src/components/CardManager.tsx`

Add keyboard handler function (after `handleDrop`, around line 260):

```typescript
function handleKeyDown(e: React.KeyboardEvent, cardId: number) {
  // Ignore keyboard shortcuts during inline editing
  if (editingId !== null) return;

  if (e.key === "Enter") {
    e.preventDefault();
    startEdit(cardId);
  }
}
```

Add `onKeyDown` handler to card element (around line 310):

```typescript
onKeyDown={(e) => handleKeyDown(e, card.id)}
```

**File**: `src/components/ColumnManager.tsx`

Add similar keyboard handler (after drag handlers, around line 240):

```typescript
function handleKeyDown(e: React.KeyboardEvent, columnId: number) {
  // Ignore keyboard shortcuts during inline editing
  if (editingId !== null) return;

  if (e.key === "Enter") {
    e.preventDefault();
    startEdit(columnId);
  }
}
```

Add `onKeyDown` handler to column header element (around line 318):

```typescript
onKeyDown={(e) => handleKeyDown(e, column.id)}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Focusing a card and pressing Enter starts editing that card
- [ ] Focusing a column and pressing Enter starts editing that column name
- [ ] Enter during editing does NOT trigger (no nested edit)
- [ ] Component tests verify Enter key starts editing (see Task 10)

---

## Task 7: Implement Arrow Key Navigation Between Cards

### Overview
Add arrow key handlers (ArrowUp, ArrowDown) to navigate focus between cards in the same column.

### Changes Required

**File**: `src/components/CardManager.tsx`

Enhance `handleKeyDown` function to handle arrow keys:

```typescript
function handleKeyDown(e: React.KeyboardEvent, cardId: number) {
  // Ignore keyboard shortcuts during inline editing
  if (editingId !== null) return;

  if (e.key === "Enter") {
    e.preventDefault();
    startEdit(cardId);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    const currentIndex = cards.findIndex((c) => c.id === cardId);
    if (currentIndex < cards.length - 1) {
      const nextCard = cards[currentIndex + 1];
      setFocusedCardId(nextCard.id);
      // Focus the next card element
      document.querySelector<HTMLElement>(`[data-card-id="${nextCard.id}"]`)?.focus();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    const currentIndex = cards.findIndex((c) => c.id === cardId);
    if (currentIndex > 0) {
      const prevCard = cards[currentIndex - 1];
      setFocusedCardId(prevCard.id);
      // Focus the previous card element
      document.querySelector<HTMLElement>(`[data-card-id="${prevCard.id}"]`)?.focus();
    }
  }
}
```

Add `data-card-id` attribute to card element for querySelector (around line 310):

```typescript
data-card-id={card.id}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Arrow down moves focus to next card in column
- [ ] Arrow up moves focus to previous card in column
- [ ] Arrow down on last card does nothing (no wrap-around)
- [ ] Arrow up on first card does nothing (no wrap-around)
- [ ] Component tests verify arrow key navigation (see Task 10)

---

## Task 8: Implement Delete Key with Confirmation

### Overview
Add Delete and Backspace key handlers to trigger delete confirmation dialog for focused card or column.

### Changes Required

**File**: `src/components/CardManager.tsx`

Enhance `handleKeyDown` to handle Delete/Backspace:

```typescript
function handleKeyDown(e: React.KeyboardEvent, cardId: number) {
  // Ignore keyboard shortcuts during inline editing
  if (editingId !== null) return;

  if (e.key === "Enter") {
    e.preventDefault();
    startEdit(cardId);
  } else if (e.key === "ArrowDown") {
    // ... existing code ...
  } else if (e.key === "ArrowUp") {
    // ... existing code ...
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    handleDelete(cardId);
  }
}
```

**File**: `src/components/ColumnManager.tsx`

Enhance `handleKeyDown` to handle Delete/Backspace:

```typescript
function handleKeyDown(e: React.KeyboardEvent, columnId: number) {
  // Ignore keyboard shortcuts during inline editing
  if (editingId !== null) return;

  if (e.key === "Enter") {
    e.preventDefault();
    startEdit(columnId);
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    handleDelete(columnId);
  }
}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Delete key on focused card triggers confirmation dialog
- [ ] Backspace key on focused card triggers confirmation dialog
- [ ] Delete key on focused column triggers confirmation dialog
- [ ] Confirmation dialog shows correct item name
- [ ] Component tests verify Delete key triggers handleDelete (see Task 10)

---

## Task 9: Add Drop Zone Highlighting During Drag

### Overview
Add `dropTargetId` state to track which card/column is the current drop target. Apply visual highlighting (bg-blue-50 border-blue-300) to valid drop zones during drag.

### Changes Required

**File**: `src/components/CardManager.tsx`

Add state variable (after focusedCardId):

```typescript
const [dropTargetId, setDropTargetId] = useState<number | null>(null);
```

Modify `handleDragOver` to set drop target (around line 187):

```typescript
function handleDragOver(e: React.DragEvent, targetCard: Card) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  setDropTargetId(targetCard.id);
}
```

Add `handleDragLeave` function (after handleDragOver):

```typescript
function handleDragLeave(e: React.DragEvent) {
  setDropTargetId(null);
}
```

Modify `handleDrop` to clear drop target (add at start of function, around line 192):

```typescript
setDropTargetId(null);
```

Add drop zone styling to card className (around line 310):

```typescript
className={`
  bg-white rounded shadow-sm border border-gray-200 p-4 cursor-pointer
  ${draggedId === card.id ? "opacity-50" : ""}
  ${focusedCardId === card.id ? "ring-2 ring-blue-500" : ""}
  ${dropTargetId === card.id ? "bg-blue-50 border-blue-300" : ""}
`}
```

Add `onDragLeave` handler to card element:

```typescript
onDragLeave={handleDragLeave}
```

**File**: `src/components/ColumnManager.tsx`

Apply same pattern for column drop zone highlighting:
- Add `dropTargetId` state
- Modify `handleDragOver` to set drop target
- Add `handleDragLeave` to clear drop target
- Modify `handleDrop` to clear drop target
- Add drop zone styling to column className

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Dragging a card over another card highlights the target card with blue background
- [ ] Dragging away from card removes highlighting
- [ ] Dropping card clears highlighting
- [ ] Same behavior for column drag-and-drop

---

## Task 10: Add Unit Tests for Keyboard Shortcuts

### Overview
Write component tests using `@testing-library/user-event` to verify keyboard shortcuts work correctly and don't fire during inline editing.

### Changes Required

**File**: `src/components/__tests__/CardManager.test.tsx`

Add new test suite:

```typescript
import { fireEvent } from '@testing-library/react';

describe('Keyboard shortcuts', () => {
  test('Enter key starts editing when card is focused', async () => {
    // Mock fetch to return cards
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, title: 'Test Card', description: '', color: 'blue', position: 1000 }
        ]),
      })
    ) as typeof fetch;

    const { getByText } = render(<CardManager columnId={1} onCardDrop={vi.fn()} />);

    await waitFor(() => {
      expect(getByText('Test Card')).toBeInTheDocument();
    });

    const cardElement = getByText('Test Card').closest('[data-card-id]') as HTMLElement;
    cardElement.focus();
    fireEvent.keyDown(cardElement, { key: 'Enter' });

    // Should show edit form
    expect(getByText('Update')).toBeInTheDocument();
  });

  test('Escape key cancels editing', async () => {
    // Similar test: start editing, press Escape, verify edit form closes
  });

  test('Arrow down moves focus to next card', async () => {
    // Mock fetch to return 3 cards
    // Focus first card, press ArrowDown, verify second card is focused
  });

  test('Arrow up moves focus to previous card', async () => {
    // Focus second card, press ArrowUp, verify first card is focused
  });

  test('Delete key triggers delete confirmation', async () => {
    // Focus card, press Delete, verify handleDelete was called (mock window.confirm)
  });

  test('keyboard shortcuts disabled during inline editing', async () => {
    // Start editing a card, press Arrow down, verify focus does not move
  });
});
```

**File**: `src/components/__tests__/ColumnManager.test.tsx`

Add similar tests for column keyboard shortcuts:
- Enter starts editing column name
- Escape cancels editing
- Delete triggers delete confirmation

### Success Criteria
- [ ] All 10+ keyboard shortcut tests pass (6 for CardManager, 4+ for ColumnManager)
- [ ] Tests verify shortcuts work when focused
- [ ] Tests verify shortcuts disabled during editing
- [ ] Tests verify arrow navigation moves focus correctly

---

## Task 11: Add ARIA Labels and Screen Reader Announcements

### Overview
Add ARIA attributes to all interactive elements for accessibility. Add live region for screen reader announcements after drag-and-drop operations.

### Changes Required

**File**: `src/components/CardManager.tsx`

Add `aria-label` to card element (around line 310):

```typescript
aria-label={`Card: ${card.title}`}
```

Add live region at top of component return (before card list, around line 280):

```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className="sr-only"
  ref={liveRegionRef}
>
  {announceText}
</div>
```

Add state and ref for announcements (after dropTargetId):

```typescript
const [announceText, setAnnounceText] = useState<string>("");
const liveRegionRef = useRef<HTMLDivElement>(null);
```

Add announcement after successful drop (in `handleDrop`, around line 244 after API call):

```typescript
setAnnounceText(`Moved card '${draggedCard.title}' to new position`);
setTimeout(() => setAnnounceText(""), 1000); // Clear after 1 second
```

Add `aria-describedby` for color label (on card element):

```typescript
aria-describedby={`card-${card.id}-color`}
```

Add color label with id (in card content, around line 295):

```typescript
<span id={`card-${card.id}-color`} className="sr-only">
  Color: {card.color}
</span>
```

**File**: `src/components/ColumnManager.tsx`

Add similar ARIA labels and live region:
- `aria-label` on column element: `Column: ${column.name}`
- Live region for column move announcements
- Announcement after successful column drop: "Moved column '${column.name}' to new position"
- Announcement after card moves between columns: "Moved card '${cardTitle}' from '${sourceColumnName}' to '${targetColumnName}'"

**File**: `src/index.css` (add sr-only utility if not present)

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] All cards and columns have `aria-label` attributes
- [ ] Live region exists with `role="status"` and `aria-live="polite"`
- [ ] Screen reader announces card/column moves after drag-and-drop
- [ ] Color labels have `aria-describedby` linking to hidden color text
- [ ] Manual testing with VoiceOver/NVDA confirms announcements

---

## Task 12: Add E2E Tests for Keyboard Shortcuts

### Overview
Write Playwright E2E tests to verify keyboard shortcuts work end-to-end in real browser.

### Changes Required

**File**: `tests/keyboard-shortcuts.spec.ts` (new file)

```typescript
import { test, expect } from "@playwright/test";

test("keyboard navigation: arrow keys move focus between cards", async ({ page }) => {
  await page.goto("/");

  // Create board, column, and 3 cards
  const boardName = `Board ${Date.now()}`;
  await page.getByPlaceholder("Board name").fill(boardName);
  await page.getByRole("button", { name: "Create Board" }).click();
  await expect(page.getByRole("heading", { name: boardName, level: 1 })).toBeVisible();

  await page.getByPlaceholder("Column name").fill("Test Column");
  await page.getByRole("button", { name: "Add Column" }).click();

  const column = page.locator(".bg-gray-100").filter({ hasText: "Test Column" });
  await column.getByPlaceholder("Card title").fill("Card 1");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByPlaceholder("Card title").fill("Card 2");
  await column.getByRole("button", { name: "Add Card" }).click();
  await column.getByPlaceholder("Card title").fill("Card 3");
  await column.getByRole("button", { name: "Add Card" }).click();

  // Focus first card and navigate with arrow keys
  const card1 = column.getByText("Card 1").locator("..");
  await card1.focus();
  await page.keyboard.press("ArrowDown");

  // Verify focus moved to Card 2
  const card2 = column.getByText("Card 2").locator("..");
  await expect(card2).toBeFocused();

  await page.keyboard.press("ArrowUp");
  await expect(card1).toBeFocused();
});

test("keyboard shortcuts: Enter starts editing", async ({ page }) => {
  // Create board, column, card
  // Focus card, press Enter, verify edit form appears
});

test("keyboard shortcuts: Escape cancels editing", async ({ page }) => {
  // Create board, column, card
  // Start editing, press Escape, verify edit form closes
});

test("keyboard shortcuts: Delete key deletes card", async ({ page }) => {
  // Create board, column, card
  // Focus card, press Delete
  // Handle confirmation dialog
  // Verify card is deleted

  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete');
    await dialog.accept();
  });

  // ... test implementation ...
});

test("keyboard shortcuts work on columns too", async ({ page }) => {
  // Test Enter, Delete on column elements
});
```

### Success Criteria
- [ ] All 5+ E2E keyboard tests pass
- [ ] Tests verify arrow key navigation in real browser
- [ ] Tests verify Enter, Escape, Delete shortcuts
- [ ] Tests verify shortcuts work on both cards and columns

---

## Task 13: Add E2E Stress Test for Position Rebalancing

### Overview
Write Playwright E2E test that performs 50+ drag-and-drop operations and verifies positions remain valid (no convergence below 1).

### Changes Required

**File**: `tests/position-rebalancing.spec.ts` (new file)

```typescript
import { test, expect } from "@playwright/test";

test("position rebalancing: 50+ drags maintain valid positions", async ({ page }) => {
  await page.goto("/");

  // Create board and column
  const boardName = `Board ${Date.now()}`;
  await page.getByPlaceholder("Board name").fill(boardName);
  await page.getByRole("button", { name: "Create Board" }).click();
  await expect(page.getByRole("heading", { name: boardName, level: 1 })).toBeVisible();

  await page.getByPlaceholder("Column name").fill("Test Column");
  await page.getByRole("button", { name: "Add Column" }).click();

  // Create 5 cards
  const column = page.locator(".bg-gray-100").filter({ hasText: "Test Column" });
  for (let i = 1; i <= 5; i++) {
    await column.getByPlaceholder("Card title").fill(`Card ${i}`);
    await column.getByRole("button", { name: "Add Card" }).click();
  }

  // Perform 50 drag-and-drop operations
  // Alternate between dragging Card 5 to top and Card 1 to bottom
  for (let i = 0; i < 50; i++) {
    if (i % 2 === 0) {
      // Drag last card to top
      const lastCard = column.getByText(/^Card \d+$/).last();
      const firstCard = column.getByText(/^Card \d+$/).first();
      await lastCard.dragTo(firstCard);
    } else {
      // Drag first card to bottom
      const firstCard = column.getByText(/^Card \d+$/).first();
      const lastCard = column.getByText(/^Card \d+$/).last();
      await firstCard.dragTo(lastCard);
    }

    await page.waitForLoadState('networkidle');
  }

  // Verify all cards still exist (no errors during rebalancing)
  await expect(column.getByText(/^Card \d+$/)).toHaveCount(5);

  // Verify positions are still usable by doing one more drag
  const firstCard = column.getByText(/^Card \d+$/).first();
  const secondCard = column.getByText(/^Card \d+$/).nth(1);
  const firstCardText = await firstCard.textContent();

  await firstCard.dragTo(secondCard);
  await page.waitForLoadState('networkidle');

  // Verify drag succeeded (card moved)
  const newSecondCard = column.getByText(/^Card \d+$/).nth(1);
  const newSecondCardText = await newSecondCard.textContent();
  expect(newSecondCardText).toBe(firstCardText);
});

test("position rebalancing: cross-column drags maintain positions", async ({ page }) => {
  // Create 2 columns
  // Create 5 cards in column A
  // Drag cards back and forth between columns 50 times
  // Verify positions remain valid
});
```

### Success Criteria
- [ ] Both E2E stress tests pass
- [ ] Test performs 50+ drag operations without errors
- [ ] Test verifies cards still draggable after stress test (positions are usable)
- [ ] Test completes in reasonable time (< 2 minutes)

---

## Task 14: Update AGENTS.md Documentation

### Overview
Document rebalancing strategy, keyboard shortcuts, and accessibility features in AGENTS.md.

### Changes Required

**File**: `AGENTS.md`

Add new section after positioning utility documentation (after line 170):

```markdown
### Position Rebalancing

**Automatic rebalancing** prevents position convergence after many drag-and-drop operations.

**Trigger**: After any position update (card reorder, cross-column move, column reorder), check if any gap between consecutive items is < 10.

**Algorithm**:
1. Fetch all items in list ordered by position ASC
2. Check gaps between consecutive items: `items[i].position - items[i-1].position`
3. If any gap < 10, renumber all items to 1000, 2000, 3000, ... in single transaction
4. Maintains relative order (no position swaps)

**Implementation**:
- `rebalanceCardPositions(columnId)` — Rebalance cards in a column
- `rebalanceColumnPositions(boardId)` — Rebalance columns in a board
- Called automatically after position updates in API endpoints
- Returns `true` if rebalancing occurred, `false` if positions were healthy

**Testing**: E2E stress test performs 50+ drag operations to verify positions remain usable.

### Keyboard Shortcuts

SwimLanes supports keyboard navigation for accessibility and power users:

| Shortcut | Action | Context |
|----------|--------|---------|
| `Enter` | Start editing card/column | When card/column is focused |
| `Escape` | Cancel editing | During inline editing |
| `↑` | Move focus to previous card | When card is focused |
| `↓` | Move focus to next card | When card is focused |
| `Delete` or `Backspace` | Delete card/column | When card/column is focused |

**Focus management**:
- Cards and columns have `tabIndex={0}` for keyboard focus
- Focus indicators: blue ring (`ring-2 ring-blue-500`) when focused
- Keyboard shortcuts disabled during inline editing

### Accessibility Features

**ARIA attributes**:
- All cards have `aria-label="Card: ${title}"`
- All columns have `aria-label="Column: ${name}"`
- Color labels use `aria-describedby` pointing to hidden color text

**Screen reader announcements**:
- Live region (`role="status" aria-live="polite"`) announces drag-and-drop operations
- Example: "Moved card 'Task title' to new position"
- Example: "Moved card 'Task title' from 'Todo' to 'Done'"

**Visual feedback**:
- Focus indicators (blue ring) for keyboard navigation
- Drop zone highlighting (blue background) during drag-and-drop
- Drag preview (semi-transparent) shows item being dragged
```

Update positioning utility section (around line 169) to remove "Known limitation" note:

```markdown
**Strategy**: Integer gaps of 1000 between items. Reordering calculates midpoint between neighbors. Automatic rebalancing prevents position convergence (see Position Rebalancing section).
```

### Success Criteria
- [ ] AGENTS.md includes rebalancing section with algorithm and implementation details
- [ ] AGENTS.md includes keyboard shortcuts table
- [ ] AGENTS.md includes accessibility features section
- [ ] Known limitation note removed from positioning utility section

---

## Task 15: Update README.md with Keyboard Shortcuts

### Overview
Add user-facing keyboard shortcuts section to README.md for end users.

### Changes Required

**File**: `README.md`

Add new section after Features section (around line 35):

```markdown
## Keyboard Shortcuts

SwimLanes supports keyboard navigation for faster workflow:

| Shortcut | Action |
|----------|--------|
| `Enter` | Start editing the focused card or column |
| `Escape` | Cancel editing |
| `↑` / `↓` | Navigate between cards in a column |
| `Delete` or `Backspace` | Delete the focused card or column |

**Tip**: Click a card or column to focus it, then use keyboard shortcuts to edit, navigate, or delete.
```

### Success Criteria
- [ ] README.md includes keyboard shortcuts table
- [ ] Shortcuts described in user-friendly language
- [ ] Tip explains how to focus items

---

## Testing Strategy

### Unit Tests (30+ tests)
**Rebalancing logic** (`src/lib/db/__tests__/cards.test.ts`, `columns.test.ts`):
- Detect convergence (gap < 10)
- Rebalance output (1000, 2000, 3000)
- Maintain relative order
- No-op for healthy positions
- Edge cases: single item, empty list, positions < 10
- Many items (10+ cards/columns)

**No mocking**: Use real SQLite in temp files (existing pattern).

### Integration Tests (10+ tests)
**API endpoints** (`src/pages/api/cards/__tests__/`, `columns/__tests__/`):
- Rebalancing triggers after multiple position updates
- Positions remain ≥ 1000 after many reorders
- Order preserved after rebalancing
- Cross-column moves trigger rebalancing

**No mocking**: Use real DB and repository functions.

### Component Tests (10+ tests)
**Keyboard shortcuts** (`src/components/__tests__/CardManager.test.tsx`, `ColumnManager.test.tsx`):
- Enter starts editing
- Escape cancels editing
- Arrow keys move focus
- Delete triggers confirmation
- Shortcuts disabled during editing

**Minimal mocking**: Mock `global.fetch` only, use real DOM via `@testing-library/react`.

### E2E Tests (12+ scenarios)
**Keyboard navigation** (`tests/keyboard-shortcuts.spec.ts`):
- Arrow keys navigate between cards
- Enter starts editing
- Escape cancels editing
- Delete key deletes card/column
- Shortcuts work on columns

**Position rebalancing** (`tests/position-rebalancing.spec.ts`):
- 50+ drag operations maintain valid positions
- Cross-column drags trigger rebalancing
- Final drag verifies positions still usable

**No mocking**: Real browser with Playwright, real dev server.

### Coverage Expectation
- 80%+ on `src/lib/db/cards.ts` and `columns.ts` (rebalancing functions)
- 80%+ on `src/lib/utils/positioning.ts` (existing utility)
- Enforced by vitest.config.ts

---

## Risk Assessment

**Position convergence testing** — Risk: E2E stress test (50+ drags) may be slow or flaky.
- Mitigation: Use `page.waitForLoadState('networkidle')` instead of arbitrary timeouts. If too slow, reduce to 30 drags (still validates rebalancing logic).

**Keyboard focus management** — Risk: Focus state may conflict with React re-renders.
- Mitigation: Use `tabIndex={0}` and native focus events. Keep focused state synchronized with DOM focus via `onFocus`/`onBlur`.

**Screen reader testing** — Risk: ARIA announcements are hard to test automatically.
- Mitigation: Component tests verify ARIA attributes exist. Manual testing with VoiceOver/NVDA confirms announcements work. E2E tests not required for ARIA (DOM inspection sufficient).

**Transaction rollback** — Risk: better-sqlite3 transaction API may not work as expected.
- Mitigation: Unit tests will catch transaction issues immediately. better-sqlite3 `db.transaction()` is well-documented and widely used.

**Arrow key navigation boundaries** — Risk: Arrow up on first card or down on last card may cause errors.
- Mitigation: Explicitly check `currentIndex > 0` before moving up, `currentIndex < cards.length - 1` before moving down. Component tests verify boundary behavior.

**Drop zone highlighting flicker** — Risk: `onDragLeave` may fire when dragging over child elements.
- Mitigation: If flicker occurs, add check in `handleDragLeave` to ignore events with `relatedTarget` inside card element. Can be addressed during testing if needed.
