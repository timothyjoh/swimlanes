# Implementation Plan: Phase 5

## Overview
Add global search and filtering to help users quickly find cards across all columns. Users can type in a search bar to filter cards in real-time, with search matching title, description, and color (case-insensitive). Search query persists in URL for shareable links.

## Current State (from Research)
- **Repository layer**: `listCardsByColumn(columnId)` fetches cards for a single column
- **UI architecture**: ColumnManager renders columns, each column contains CardManager that fetches its own cards
- **State management**: Components use React `useState` hooks, no global state
- **Keyboard shortcuts**: Existing shortcuts (Arrow keys, Enter, Delete, Escape) must continue to work on filtered cards
- **Test infrastructure**: Vitest for unit/component tests, Playwright for E2E tests
- **Phase 4 lessons**: Write component interaction tests BEFORE E2E tests for faster feedback loop, consider React event propagation early, maintain accessibility baseline

## Desired End State
- User can type in search input above columns to filter visible cards
- Search matches title, description, or color (case-insensitive, debounced 300ms)
- Search query persists in URL as `?q=search+term`
- Match count displays (e.g., "3 cards found")
- Columns with no matches show "No matching cards" message
- `Ctrl+F`/`Cmd+F` focuses search input, `Escape` clears search
- All existing functionality (drag-and-drop, keyboard shortcuts, inline editing) works on filtered cards
- 80%+ test coverage on search functions
- Documentation updated

## What We're NOT Doing
- Advanced filters (filter by color only, by date created)
- Saved searches or search history
- Search across all boards (global workspace search)
- Search highlighting (yellow highlight on matched text)
- Regex or advanced query syntax (simple substring matching only)
- Full-text search indexes (FTS5) — simple `String.includes()` matching only
- Refactoring CardManager to accept cards as props (defer to future)

## Implementation Approach
**Hybrid architecture**: Build `searchCards(boardId, query)` repository function for testability and future API use, but implement client-side filtering in ColumnManager for Phase 5. This avoids API/fetch refactoring while maintaining clean architecture.

**Component interaction first**: Write component tests with `@testing-library/user-event` before E2E tests to catch bugs early (Phase 4 lesson).

**Minimal invasiveness**: CardManager continues fetching internally, accepts optional `searchQuery` prop to filter displayed cards.

---

## Task 1: Add searchCards() Repository Function

### Overview
Add `searchCards(boardId, query)` function to repository layer that returns all matching cards for a board (across all columns). This provides testable search logic and enables future server-side search API.

### Changes Required

**File**: `src/lib/db/cards.ts`

Add function after `listCardsByColumn()`:

```typescript
/**
 * Search cards across all columns on a board
 * @param boardId - Board ID to search within
 * @param query - Search query (case-insensitive, matches title, description, or color)
 * @returns Array of matching cards ordered by column position, then card position
 */
export function searchCards(boardId: number, query: string): Card[] {
  const trimmed = query.trim();
  if (!trimmed) {
    // Empty query returns all cards for the board
    const stmt = db.prepare(`
      SELECT c.* FROM cards c
      JOIN columns col ON c.column_id = col.id
      WHERE col.board_id = ?
      ORDER BY col.position ASC, c.position ASC
    `);
    return stmt.all(boardId) as Card[];
  }

  // Case-insensitive search on title, description, or color
  const searchPattern = `%${trimmed.toLowerCase()}%`;
  const stmt = db.prepare(`
    SELECT c.* FROM cards c
    JOIN columns col ON c.column_id = col.id
    WHERE col.board_id = ?
      AND (
        LOWER(c.title) LIKE ?
        OR LOWER(c.description) LIKE ?
        OR LOWER(c.color) LIKE ?
      )
    ORDER BY col.position ASC, c.position ASC
  `);

  return stmt.all(boardId, searchPattern, searchPattern, searchPattern) as Card[];
}
```

### Success Criteria
- [ ] Code compiles without TypeScript errors
- [ ] Function signature is `searchCards(boardId: number, query: string): Card[]`
- [ ] Empty/whitespace-only query returns all cards for board
- [ ] Non-empty query searches title, description, and color (case-insensitive)
- [ ] Results ordered by column position, then card position

---

## Task 2: Unit Tests for searchCards()

### Overview
Write comprehensive unit tests for `searchCards()` function covering all search scenarios and edge cases.

### Changes Required

**File**: `src/lib/db/__tests__/cards.test.ts`

Add test suite after existing card tests:

```typescript
describe("searchCards", () => {
  it("returns all cards for board when query is empty", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "Card 1", description: null, color: null, position: 1000 });
    await createCard({ column_id: columnIds[1], title: "Card 2", description: null, color: null, position: 1000 });

    const results = searchCards(boardId, "");
    expect(results).toHaveLength(2);
  });

  it("searches title case-insensitively", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "TODO: Write Tests", description: null, color: null, position: 1000 });
    await createCard({ column_id: columnIds[0], title: "DONE: Bug Fix", description: null, color: null, position: 2000 });

    const results = searchCards(boardId, "todo");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("TODO: Write Tests");
  });

  it("searches description case-insensitively", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "Card 1", description: "Fix authentication BUG", color: null, position: 1000 });
    await createCard({ column_id: columnIds[0], title: "Card 2", description: "Add feature", color: null, position: 2000 });

    const results = searchCards(boardId, "bug");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Card 1");
  });

  it("searches color case-insensitively", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "Card 1", description: null, color: "red", position: 1000 });
    await createCard({ column_id: columnIds[0], title: "Card 2", description: null, color: "blue", position: 2000 });

    const results = searchCards(boardId, "RED");
    expect(results).toHaveLength(1);
    expect(results[0].color).toBe("red");
  });

  it("trims whitespace from query", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "Test Card", description: null, color: null, position: 1000 });

    const results = searchCards(boardId, "  test  ");
    expect(results).toHaveLength(1);
  });

  it("returns cards ordered by column position then card position", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns(); // Creates 2 columns with positions 1000, 2000
    await createCard({ column_id: columnIds[1], title: "Test B", description: null, color: null, position: 2000 });
    await createCard({ column_id: columnIds[0], title: "Test A", description: null, color: null, position: 2000 });
    await createCard({ column_id: columnIds[0], title: "Test C", description: null, color: null, position: 1000 });

    const results = searchCards(boardId, "test");
    expect(results).toHaveLength(3);
    expect(results[0].title).toBe("Test C"); // Column 0 (pos 1000), card pos 1000
    expect(results[1].title).toBe("Test A"); // Column 0 (pos 1000), card pos 2000
    expect(results[2].title).toBe("Test B"); // Column 1 (pos 2000), card pos 2000
  });

  it("handles special characters in query", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "Test [brackets]", description: null, color: null, position: 1000 });
    await createCard({ column_id: columnIds[0], title: "Test 'quotes'", description: null, color: null, position: 2000 });

    const results = searchCards(boardId, "[brackets]");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test [brackets]");
  });

  it("returns empty array when no matches", async () => {
    const { boardId, columnIds } = await setupBoardWithColumns();
    await createCard({ column_id: columnIds[0], title: "Card 1", description: null, color: null, position: 1000 });

    const results = searchCards(boardId, "nonexistent");
    expect(results).toHaveLength(0);
  });

  it("only returns cards from specified board", async () => {
    const board1 = createBoard({ name: "Board 1" });
    const board2 = createBoard({ name: "Board 2" });
    const col1 = createColumn({ board_id: board1.id, name: "Col 1", position: 1000 });
    const col2 = createColumn({ board_id: board2.id, name: "Col 2", position: 1000 });
    await createCard({ column_id: col1.id, title: "Test A", description: null, color: null, position: 1000 });
    await createCard({ column_id: col2.id, title: "Test B", description: null, color: null, position: 1000 });

    const results = searchCards(board1.id, "test");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test A");
  });
});
```

### Success Criteria
- [ ] All 9+ tests pass
- [ ] Tests cover: empty query, title search, description search, color search, trimming, ordering, special characters, no matches, board isolation
- [ ] Tests use real SQLite (no mocking), follow existing test patterns
- [ ] Code coverage on `searchCards()` is 100%

---

## Task 3: Add Search UI to ColumnManager

### Overview
Add search input UI to ColumnManager above the column list. Includes input field, clear button, match count display, and empty state message.

### Changes Required

**File**: `src/components/ColumnManager.tsx`

**Add state** (after line 31):
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [debouncedQuery, setDebouncedQuery] = useState("");
const searchInputRef = useRef<HTMLInputElement>(null);
```

**Add debounce effect** (after line 52):
```typescript
// Debounce search query (300ms)
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedQuery(searchQuery);
  }, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

**Add URL sync effect** (after debounce effect):
```typescript
// Sync search query to URL query param
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (debouncedQuery.trim()) {
    params.set('q', debouncedQuery.trim());
  } else {
    params.delete('q');
  }
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}, [debouncedQuery]);
```

**Add keyboard shortcut listener** (after URL sync effect):
```typescript
// Ctrl+F / Cmd+F focuses search input
useEffect(() => {
  function handleGlobalKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault(); // Prevent browser's find dialog
      searchInputRef.current?.focus();
    }
  }

  window.addEventListener('keydown', handleGlobalKeyDown);
  return () => window.removeEventListener('keydown', handleGlobalKeyDown);
}, []);
```

**Add search input handler**:
```typescript
function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
  setSearchQuery(e.target.value);
}

function handleClearSearch() {
  setSearchQuery("");
  searchInputRef.current?.focus();
}

function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Escape') {
    handleClearSearch();
  }
}
```

**Add search UI** (after "Add Column" form, before column list):
```tsx
{/* Search bar */}
<div className="mb-6">
  <div className="relative max-w-md">
    <input
      ref={searchInputRef}
      type="text"
      value={searchQuery}
      onChange={handleSearchChange}
      onKeyDown={handleSearchKeyDown}
      placeholder="Search cards..."
      aria-label="Search cards"
      className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {searchQuery && (
      <button
        onClick={handleClearSearch}
        aria-label="Clear search"
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )}
  </div>

  {/* Match count - shown when search is active */}
  {debouncedQuery.trim() && (
    <div className="mt-2 text-sm text-gray-600">
      <span role="status" aria-live="polite">
        {/* Match count will be calculated in next task */}
      </span>
    </div>
  )}
</div>
```

### Success Criteria
- [ ] Search input renders above column list
- [ ] Clear button (X icon) appears when query is non-empty
- [ ] Typing in search input updates `searchQuery` state
- [ ] Pressing Escape in search input clears query and refocuses input
- [ ] Search input is accessible (aria-label, proper focus handling)

---

## Task 4: Pass searchQuery Prop to CardManager

### Overview
Modify CardManager to accept optional `searchQuery` prop and filter displayed cards based on the query.

### Changes Required

**File**: `src/components/CardManager.tsx`

**Update interface** (line ~35):
```typescript
interface CardManagerProps {
  columnId: number;
  onCardDrop?: (cardId: number, targetColumnId: number, position: number) => void;
  refreshKey?: number;
  searchQuery?: string; // NEW
}
```

**Update destructuring** (line ~37):
```typescript
export default function CardManager({
  columnId,
  onCardDrop,
  refreshKey,
  searchQuery = "", // NEW with default
}: CardManagerProps) {
```

**Add filtered cards computed value** (after line 52):
```typescript
// Filter cards based on search query
const filteredCards = useMemo(() => {
  const trimmed = searchQuery.trim().toLowerCase();
  if (!trimmed) return cards;

  return cards.filter(card => {
    const titleMatch = card.title.toLowerCase().includes(trimmed);
    const descMatch = card.description?.toLowerCase().includes(trimmed) ?? false;
    const colorMatch = card.color?.toLowerCase().includes(trimmed) ?? false;
    return titleMatch || descMatch || colorMatch;
  });
}, [cards, searchQuery]);
```

**Update all `cards.map()` calls to use `filteredCards.map()`**

**Add empty state for no matches** (in the cards list section):
```tsx
{filteredCards.length === 0 && cards.length > 0 && (
  <div className="p-4 text-center text-gray-500 text-sm">
    No matching cards
  </div>
)}
```

**Update ARIA announcements** to announce filter status:
```typescript
// After filtering, announce match count
useEffect(() => {
  if (searchQuery.trim() && filteredCards.length !== cards.length) {
    setAnnounceText(`${filteredCards.length} cards visible in this column`);
  }
}, [filteredCards.length, cards.length, searchQuery]);
```

### Success Criteria
- [ ] CardManager accepts `searchQuery` prop
- [ ] Cards are filtered client-side when `searchQuery` is non-empty
- [ ] Filtering is case-insensitive and matches title, description, or color
- [ ] Empty state message shows when no cards match in a column
- [ ] All existing functionality (drag-and-drop, editing, keyboard shortcuts) works on filtered cards

---

## Task 5: Wire Search Query from ColumnManager to CardManager

### Overview
Pass `debouncedQuery` from ColumnManager to each CardManager component so filtering happens in real-time.

### Changes Required

**File**: `src/components/ColumnManager.tsx`

Update the `<CardManager>` render call (in the columns map):
```tsx
<CardManager
  key={column.id}
  columnId={column.id}
  onCardDrop={handleCardDrop}
  refreshKey={cardRefreshKey}
  searchQuery={debouncedQuery} {/* NEW */}
/>
```

**Calculate total match count** for display:
```typescript
const [totalMatches, setTotalMatches] = useState(0);

// This will be calculated after CardManager reports its filtered count
// For now, we'll need to lift this state or pass a callback
// Simpler approach: ColumnManager fetches all cards and counts matches
```

**Alternative simpler approach**: Calculate match count in ColumnManager by fetching all cards once:

Add state:
```typescript
const [allCards, setAllCards] = useState<Card[]>([]);
```

Add fetch effect:
```typescript
// Fetch all cards for the board (for search match counting)
useEffect(() => {
  async function fetchAllCards() {
    if (!debouncedQuery.trim()) {
      setAllCards([]);
      return;
    }

    try {
      // Fetch cards for each column and combine
      const allCardsPromises = columns.map(col =>
        fetch(`/api/cards?columnId=${col.id}`).then(r => r.json())
      );
      const results = await Promise.all(allCardsPromises);
      setAllCards(results.flat());
    } catch (err) {
      console.error("Failed to fetch cards for search:", err);
    }
  }
  fetchAllCards();
}, [columns, debouncedQuery]);
```

Calculate match count:
```typescript
const matchCount = useMemo(() => {
  if (!debouncedQuery.trim()) return 0;
  const trimmed = debouncedQuery.trim().toLowerCase();
  return allCards.filter(card => {
    const titleMatch = card.title.toLowerCase().includes(trimmed);
    const descMatch = card.description?.toLowerCase().includes(trimmed) ?? false;
    const colorMatch = card.color?.toLowerCase().includes(trimmed) ?? false;
    return titleMatch || descMatch || colorMatch;
  }).length;
}, [allCards, debouncedQuery]);
```

Update match count display:
```tsx
{debouncedQuery.trim() && (
  <div className="mt-2 text-sm text-gray-600">
    <span role="status" aria-live="polite">
      {matchCount} {matchCount === 1 ? 'card' : 'cards'} found
    </span>
  </div>
)}
```

### Success Criteria
- [ ] Typing in search input filters cards across all columns in real-time (300ms debounce)
- [ ] Match count displays correctly (e.g., "3 cards found")
- [ ] Match count has `aria-live="polite"` for screen reader announcements
- [ ] Empty columns show "No matching cards" message when search is active

---

## Task 6: Add Initial Search Query from URL

### Overview
Read search query from URL query param on page load and pass as initial prop to ColumnManager.

### Changes Required

**File**: `src/pages/boards/[id].astro`

**Read query param** (after line 17):
```typescript
const initialSearchQuery = Astro.url.searchParams.get('q') || '';
```

**Pass to ColumnManager** (line 27):
```astro
<ColumnManager client:load boardId={boardId} initialSearchQuery={initialSearchQuery} />
```

**File**: `src/components/ColumnManager.tsx`

**Update interface** (line ~15):
```typescript
interface ColumnManagerProps {
  boardId: number;
  initialSearchQuery?: string; // NEW
}
```

**Update destructuring** (line ~17):
```typescript
export default function ColumnManager({ boardId, initialSearchQuery = "" }: ColumnManagerProps) {
```

**Initialize searchQuery state** (line ~30, replace existing `useState("")`):
```typescript
const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
```

### Success Criteria
- [ ] Navigating to `/boards/123?q=test` loads page with search input populated with "test"
- [ ] Cards are filtered on page load based on URL query param
- [ ] Navigating back/forward in browser preserves search query

---

## Task 7: Component Interaction Tests

### Overview
Write component tests using `@testing-library/user-event` to test search input interactions before E2E tests (Phase 4 lesson).

### Changes Required

**File**: `src/components/__tests__/ColumnManager.test.tsx` (new file)

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColumnManager from "../ColumnManager";

describe("ColumnManager search functionality", () => {
  beforeEach(() => {
    // Mock fetch for columns and cards
    global.fetch = vi.fn((url) => {
      if (url.includes("/api/columns")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, board_id: 1, name: "Todo", position: 1000 },
          ]),
        });
      }
      if (url.includes("/api/cards")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            { id: 1, column_id: 1, title: "Test Card", description: "Test description", color: "red", position: 1000 },
            { id: 2, column_id: 1, title: "Another Card", description: null, color: "blue", position: 2000 },
          ]),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
  });

  it("renders search input", async () => {
    render(<ColumnManager boardId={1} />);
    await waitFor(() => expect(screen.getByLabelText("Search cards")).toBeInTheDocument());
  });

  it("shows clear button when query is non-empty", async () => {
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    const input = await screen.findByLabelText("Search cards");
    await user.type(input, "test");

    expect(screen.getByLabelText("Clear search")).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", async () => {
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    const input = await screen.findByLabelText("Search cards");
    await user.type(input, "test");

    const clearBtn = screen.getByLabelText("Clear search");
    await user.click(clearBtn);

    expect(input).toHaveValue("");
  });

  it("clears search when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    const input = await screen.findByLabelText("Search cards");
    await user.type(input, "test");
    await user.keyboard("{Escape}");

    expect(input).toHaveValue("");
  });

  it("focuses search input on Ctrl+F", async () => {
    const user = userEvent.setup();
    render(<ColumnManager boardId={1} />);

    await screen.findByLabelText("Search cards");
    await user.keyboard("{Control>}f{/Control}");

    expect(screen.getByLabelText("Search cards")).toHaveFocus();
  });

  it("debounces search input", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null }); // Disable userEvent delay

    render(<ColumnManager boardId={1} />);
    const input = await screen.findByLabelText("Search cards");

    await user.type(input, "test");

    // Match count should not appear immediately
    expect(screen.queryByText(/cards found/)).not.toBeInTheDocument();

    // Fast-forward 300ms
    vi.advanceTimersByTime(300);

    // Now match count should appear
    await waitFor(() => expect(screen.getByText(/cards found/)).toBeInTheDocument());

    vi.useRealTimers();
  });

  it("displays match count when search is active", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });

    render(<ColumnManager boardId={1} />);
    const input = await screen.findByLabelText("Search cards");

    await user.type(input, "test");
    vi.advanceTimersByTime(300);

    await waitFor(() => expect(screen.getByText(/1 card found/)).toBeInTheDocument());

    vi.useRealTimers();
  });

  it("initializes search query from prop", async () => {
    render(<ColumnManager boardId={1} initialSearchQuery="test" />);

    const input = await screen.findByLabelText("Search cards");
    expect(input).toHaveValue("test");
  });

  it("updates URL when search query changes", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<ColumnManager boardId={1} />);
    const input = await screen.findByLabelText("Search cards");

    await user.type(input, "test");
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledWith({}, "", expect.stringContaining("?q=test"));
    });

    vi.useRealTimers();
  });

  it("removes query param from URL when search is cleared", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ delay: null });
    const replaceState = vi.spyOn(window.history, "replaceState");

    render(<ColumnManager boardId={1} initialSearchQuery="test" />);
    const input = await screen.findByLabelText("Search cards");

    await user.clear(input);
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledWith({}, "", expect.not.stringContaining("?q="));
    });

    vi.useRealTimers();
  });
});
```

**File**: `src/components/__tests__/CardManager.test.tsx` (add to existing file)

```typescript
describe("CardManager search filtering", () => {
  it("filters cards by title", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, column_id: 1, title: "Test Card", description: null, color: null, position: 1000 },
          { id: 2, column_id: 1, title: "Another Card", description: null, color: null, position: 2000 },
        ]),
      })
    );

    render(<CardManager columnId={1} searchQuery="test" />);

    await waitFor(() => {
      expect(screen.getByText("Test Card")).toBeInTheDocument();
      expect(screen.queryByText("Another Card")).not.toBeInTheDocument();
    });
  });

  it("filters cards by description", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, column_id: 1, title: "Card 1", description: "test description", color: null, position: 1000 },
          { id: 2, column_id: 1, title: "Card 2", description: "other description", color: null, position: 2000 },
        ]),
      })
    );

    render(<CardManager columnId={1} searchQuery="test" />);

    await waitFor(() => {
      expect(screen.getByText("Card 1")).toBeInTheDocument();
      expect(screen.queryByText("Card 2")).not.toBeInTheDocument();
    });
  });

  it("filters cards by color", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, column_id: 1, title: "Card 1", description: null, color: "red", position: 1000 },
          { id: 2, column_id: 1, title: "Card 2", description: null, color: "blue", position: 2000 },
        ]),
      })
    );

    render(<CardManager columnId={1} searchQuery="red" />);

    await waitFor(() => {
      expect(screen.getByText("Card 1")).toBeInTheDocument();
      expect(screen.queryByText("Card 2")).not.toBeInTheDocument();
    });
  });

  it("shows 'No matching cards' when no cards match", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, column_id: 1, title: "Card 1", description: null, color: null, position: 1000 },
        ]),
      })
    );

    render(<CardManager columnId={1} searchQuery="nonexistent" />);

    await waitFor(() => {
      expect(screen.getByText("No matching cards")).toBeInTheDocument();
    });
  });

  it("drag-and-drop works on filtered cards", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, column_id: 1, title: "Test Card", description: null, color: null, position: 1000 },
          { id: 2, column_id: 1, title: "Another Card", description: null, color: null, position: 2000 },
        ]),
      })
    );

    render(<CardManager columnId={1} searchQuery="test" />);

    const card = await screen.findByText("Test Card");
    expect(card.closest('[draggable="true"]')).toBeInTheDocument();
  });

  it("keyboard shortcuts work on filtered cards", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { id: 1, column_id: 1, title: "Test Card", description: null, color: null, position: 1000 },
        ]),
      })
    );

    const user = userEvent.setup();
    render(<CardManager columnId={1} searchQuery="test" />);

    const card = await screen.findByText("Test Card");
    await user.click(card.closest("li")!);
    await user.keyboard("{Enter}");

    // Should enter edit mode
    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Card")).toBeInTheDocument();
    });
  });
});
```

### Success Criteria
- [ ] 12+ component interaction tests pass
- [ ] Tests cover: typing, clear button, Escape key, Ctrl+F focus, debouncing, match count, URL sync, initial query, filtering, empty state, drag-and-drop on filtered cards, keyboard shortcuts on filtered cards
- [ ] Tests use `@testing-library/user-event` for realistic user interactions
- [ ] Tests run faster than E2E tests (< 5 seconds total)

---

## Task 8: E2E Tests for Search

### Overview
Write end-to-end tests using Playwright to validate complete search workflows.

### Changes Required

**File**: `tests/search.spec.ts` (new file)

```typescript
import { test, expect } from "@playwright/test";

test.describe("Card Search and Filter", () => {
  let boardId: number;

  test.beforeEach(async ({ page }) => {
    // Create a board with columns and many cards
    await page.goto("/");
    await page.fill('input[placeholder="Board name"]', "Test Board");
    await page.click("button:has-text('Create Board')");

    // Extract board ID from URL
    await expect(page).toHaveURL(/\/boards\/\d+/);
    const url = page.url();
    boardId = parseInt(url.match(/\/boards\/(\d+)/)![1], 10);

    // Create columns
    await page.fill('input[placeholder="Column name"]', "Todo");
    await page.click("button:has-text('Add Column')");
    await page.fill('input[placeholder="Column name"]', "In Progress");
    await page.click("button:has-text('Add Column')");

    // Create multiple cards across columns
    const todoColumn = page.locator("section").filter({ hasText: "Todo" }).first();
    await todoColumn.locator('input[placeholder="Card title"]').fill("Bug fix authentication");
    await todoColumn.locator("button:has-text('Add Card')").click();
    await todoColumn.locator('input[placeholder="Card title"]').fill("Feature red button");
    await todoColumn.locator("button:has-text('Add Card')").click();
    await todoColumn.locator('input[placeholder="Card title"]').fill("Write tests");
    await todoColumn.locator("button:has-text('Add Card')").click();

    const inProgressColumn = page.locator("section").filter({ hasText: "In Progress" }).first();
    await inProgressColumn.locator('input[placeholder="Card title"]').fill("Refactor authentication");
    await inProgressColumn.locator("button:has-text('Add Card')").click();
    await inProgressColumn.locator('input[placeholder="Card title"]').fill("Add blue theme");
    await inProgressColumn.locator("button:has-text('Add Card')").click();
  });

  test("filters cards by title in real-time", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");

    // Wait for debounce
    await page.waitForTimeout(350);

    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
    await expect(page.locator("text=Refactor authentication")).toBeVisible();
    await expect(page.locator("text=Feature red button")).not.toBeVisible();
    await expect(page.locator("text=Write tests")).not.toBeVisible();
    await expect(page.locator("text=Add blue theme")).not.toBeVisible();
  });

  test("displays correct match count", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");

    await page.waitForTimeout(350);

    await expect(page.locator("text=2 cards found")).toBeVisible();
  });

  test("shows clear button when search is active", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("test");

    const clearButton = page.locator('button[aria-label="Clear search"]');
    await expect(clearButton).toBeVisible();
  });

  test("clears search when clear button is clicked", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");

    await page.waitForTimeout(350);
    await expect(page.locator("text=2 cards found")).toBeVisible();

    await page.locator('button[aria-label="Clear search"]').click();

    // All cards should be visible again
    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
    await expect(page.locator("text=Feature red button")).toBeVisible();
    await expect(page.locator("text=Write tests")).toBeVisible();
  });

  test("clears search when Escape is pressed", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");

    await page.waitForTimeout(350);
    await expect(page.locator("text=2 cards found")).toBeVisible();

    await searchInput.press("Escape");

    // All cards should be visible again
    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
    await expect(page.locator("text=Feature red button")).toBeVisible();
  });

  test("focuses search input on Ctrl+F", async ({ page }) => {
    await page.keyboard.press("Control+f");

    const searchInput = page.locator('input[aria-label="Search cards"]');
    await expect(searchInput).toBeFocused();
  });

  test("persists search query in URL", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");

    await page.waitForTimeout(350);

    expect(page.url()).toContain("?q=authentication");
  });

  test("loads search query from URL on page load", async ({ page }) => {
    await page.goto(`/boards/${boardId}?q=authentication`);

    const searchInput = page.locator('input[aria-label="Search cards"]');
    await expect(searchInput).toHaveValue("authentication");

    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
    await expect(page.locator("text=Feature red button")).not.toBeVisible();
  });

  test("search persists when navigating back/forward", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");
    await page.waitForTimeout(350);

    // Navigate away
    await page.goto("/");

    // Navigate back
    await page.goBack();

    await expect(searchInput).toHaveValue("authentication");
    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
  });

  test("shows 'No matching cards' when no matches in a column", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("xyz");

    await page.waitForTimeout(350);

    await expect(page.locator("text=No matching cards")).toBeVisible();
    await expect(page.locator("text=0 cards found")).toBeVisible();
  });

  test("drag-and-drop works on filtered cards", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");
    await page.waitForTimeout(350);

    // Drag "Bug fix authentication" to "In Progress" column
    const card = page.locator("text=Bug fix authentication").locator("..");
    const targetColumn = page.locator("section").filter({ hasText: "In Progress" });

    await card.dragTo(targetColumn);

    // Card should now be in "In Progress" column
    const inProgressColumn = page.locator("section").filter({ hasText: "In Progress" });
    await expect(inProgressColumn.locator("text=Bug fix authentication")).toBeVisible();
  });

  test("search matches color labels", async ({ page }) => {
    // Edit a card to add red color
    const card = page.locator("text=Feature red button").locator("..");
    await card.click();
    await page.keyboard.press("Enter");

    // Select red color
    const redColorBtn = page.locator('button[aria-label="red"]');
    await redColorBtn.click();

    // Save
    await page.locator("button:has-text('Save')").click();

    // Search for "red"
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("red");
    await page.waitForTimeout(350);

    await expect(page.locator("text=Feature red button")).toBeVisible();
    await expect(page.locator("text=1 card found")).toBeVisible();
  });

  test("search matches descriptions", async ({ page }) => {
    // Edit a card to add description
    const card = page.locator("text=Bug fix authentication").locator("..");
    await card.click();
    await page.keyboard.press("Enter");

    // Add description
    const descField = page.locator('textarea[placeholder="Description (optional)"]');
    await descField.fill("Fix the session token validation issue");
    await page.locator("button:has-text('Save')").click();

    // Search for "session"
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("session");
    await page.waitForTimeout(350);

    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
    await expect(page.locator("text=1 card found")).toBeVisible();
  });

  test("case-insensitive search", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("AUTHENTICATION");
    await page.waitForTimeout(350);

    await expect(page.locator("text=Bug fix authentication")).toBeVisible();
    await expect(page.locator("text=Refactor authentication")).toBeVisible();
  });

  test("keyboard shortcuts work on filtered cards", async ({ page }) => {
    const searchInput = page.locator('input[aria-label="Search cards"]');
    await searchInput.fill("authentication");
    await page.waitForTimeout(350);

    const card = page.locator("text=Bug fix authentication").locator("..");
    await card.click();

    // Press Enter to edit
    await page.keyboard.press("Enter");

    // Should show edit form
    await expect(page.locator('input[value="Bug fix authentication"]')).toBeVisible();
  });
});
```

### Success Criteria
- [ ] All 15 E2E tests pass
- [ ] Tests cover: real-time filtering, match count, clear button, Escape key, Ctrl+F, URL persistence, page load, navigation persistence, empty state, drag-and-drop, color search, description search, case-insensitivity, keyboard shortcuts
- [ ] Tests use realistic user workflows (create board → add cards → search)
- [ ] Tests run in < 60 seconds total

---

## Task 9: Update Documentation

### Overview
Update AGENTS.md and README.md with search functionality documentation.

### Changes Required

**File**: `AGENTS.md`

Add section after "Keyboard Shortcuts":

```markdown
## Search and Filter

Global search allows users to quickly find cards across all columns on a board.

### Search Functionality
- **Location**: Search input appears above column list in board view
- **Search fields**: Matches against card title, description, or color label
- **Case-insensitivity**: "TODO" matches "todo", "Todo", etc.
- **Substring matching**: "auth" matches "authentication", "authorize", etc.
- **Debouncing**: 300ms delay before filtering to avoid excessive re-renders
- **Performance**: Tested with 100+ cards, < 100ms perceived latency

### Search UI
- **Search input**: Text field with placeholder "Search cards..."
- **Clear button**: X icon button appears when query is non-empty
- **Match count**: Displays "N cards found" when search is active
- **Empty state**: Columns with no matches show "No matching cards" message

### URL Persistence
- **Query parameter**: Search query persists in URL as `?q=search+term`
- **Shareable links**: Users can share links with pre-populated search queries
- **Navigation**: Search query persists when using browser back/forward buttons
- **Format**: Special characters are URL-encoded using `URLSearchParams`

### Keyboard Shortcuts
- **`Ctrl+F` / `Cmd+F`**: Focus search input (overrides browser default find)
- **`Escape`**: Clear search query and show all cards

### Repository Function
- **Function**: `searchCards(boardId: number, query: string): Card[]`
- **Location**: `src/lib/db/cards.ts`
- **Behavior**: Returns matching cards across all columns for a board
- **Empty query**: Returns all cards for the board
- **Ordering**: Cards ordered by column position, then card position

### Implementation Details
- **Architecture**: Client-side filtering in React state (cards fetched per-column)
- **Debouncing**: Search input debounces at 300ms to avoid performance issues
- **State management**: `searchQuery` (raw input) and `debouncedQuery` (filtered)
- **Filtering**: `useMemo` hook filters cards in CardManager component
- **Compatibility**: All existing functionality (drag-and-drop, keyboard shortcuts, inline editing) works on filtered cards

### Accessibility
- **Search input**: `aria-label="Search cards"`
- **Clear button**: `aria-label="Clear search"`
- **Match count**: Live region with `aria-live="polite"` announces count
- **Empty state**: Announced by screen readers when no matches
```

**File**: `README.md`

Add to "Features" section:

```markdown
- **Search and filter** — Find cards quickly across all columns with real-time filtering
  - Keyboard shortcuts: `Ctrl+F` / `Cmd+F` to focus search, `Escape` to clear
  - Shareable search links via URL query params (e.g., `?q=search+term`)
```

### Success Criteria
- [ ] AGENTS.md updated with search functionality documentation
- [ ] README.md updated with search feature in features list
- [ ] Documentation includes keyboard shortcuts, URL format, and repository function

---

## Testing Strategy

### Unit Tests (Vitest)
**Location**: `src/lib/db/__tests__/cards.test.ts`

**Coverage**: 9+ tests for `searchCards()` function
- Empty query returns all cards
- Search title (case-insensitive)
- Search description (case-insensitive)
- Search color (case-insensitive)
- Trim whitespace from query
- Ordering (by column position, then card position)
- Special characters in query
- No matches returns empty array
- Board isolation (only returns cards from specified board)

**Approach**: Use real SQLite in temp files (no mocking), follow existing test patterns in `cards.test.ts`

### Component Tests (Vitest + Testing Library)
**Location**: `src/components/__tests__/ColumnManager.test.tsx`, `src/components/__tests__/CardManager.test.tsx`

**Coverage**: 12+ tests for search UI interactions
- Search input renders
- Clear button appears when query is non-empty
- Clicking clear button clears search
- Pressing Escape clears search
- Ctrl+F focuses search input
- Debouncing (300ms delay)
- Match count displays correctly
- Initial query from prop
- URL updates when search changes
- URL query param removed when search cleared
- Cards filter by title/description/color
- "No matching cards" empty state
- Drag-and-drop works on filtered cards
- Keyboard shortcuts work on filtered cards

**Approach**: Use `@testing-library/user-event` for realistic interactions, mock fetch API, use `vi.useFakeTimers()` for debounce testing

### E2E Tests (Playwright)
**Location**: `tests/search.spec.ts`

**Coverage**: 15+ tests for end-to-end search workflows
- Filters cards by title in real-time
- Displays correct match count
- Shows clear button when search is active
- Clears search when clear button clicked
- Clears search when Escape pressed
- Focuses search input on Ctrl+F
- Persists search query in URL
- Loads search query from URL on page load
- Search persists when navigating back/forward
- Shows "No matching cards" empty state
- Drag-and-drop works on filtered cards
- Search matches color labels
- Search matches descriptions
- Case-insensitive search
- Keyboard shortcuts work on filtered cards

**Approach**: Create board with 5+ cards across multiple columns in `beforeEach`, test complete user workflows

### Coverage Expectations
- **Unit tests**: 100% coverage on `searchCards()` function
- **Component tests**: 80%+ coverage on search UI logic (debouncing, filtering, URL sync)
- **E2E tests**: All critical user paths covered

### Test Execution Order
1. **Unit tests first**: Fast feedback on repository logic
2. **Component tests second**: Validate UI interactions in isolation (Phase 4 lesson)
3. **E2E tests last**: Validate complete workflows

## Risk Assessment

**Risk**: Searching 100+ cards on every keystroke could cause performance issues
**Mitigation**: 300ms debounce delay before filtering, `useMemo` for filtering computation

**Risk**: URL updates on every debounce could create excessive browser history entries
**Mitigation**: Use `history.replaceState()` instead of `pushState()` to update URL without adding history entries

**Risk**: Ctrl+F keyboard shortcut conflicts with browser's native find dialog
**Mitigation**: `e.preventDefault()` in global keydown listener to override browser default

**Risk**: Event bubbling could cause Escape key to propagate and close other modals
**Mitigation**: Test event propagation carefully, use `stopPropagation()` if needed (Phase 4 lesson)

**Risk**: Drag-and-drop might break when cards are filtered (dropped card could disappear if it doesn't match search)
**Mitigation**: After card drop, either clear search automatically OR ensure dropped card remains visible even if it doesn't match (no-op, cards remain filtered)

**Risk**: CardManager fetches cards per-column, so counting total matches requires fetching all cards again in ColumnManager
**Mitigation**: Acceptable for Phase 5 (fetch is fast with small boards), defer optimization to future phase with single board-level fetch

**Risk**: Special characters in search query could break URL encoding
**Mitigation**: Use `URLSearchParams` API for automatic encoding/decoding

**Risk**: Search state could get out of sync between `searchQuery` (input value) and `debouncedQuery` (filtered results)
**Mitigation**: Test debouncing thoroughly in component tests with fake timers
