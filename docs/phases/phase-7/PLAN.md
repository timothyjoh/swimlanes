# Implementation Plan: Phase 7

## Overview
Add color-based filtering to the board view using clickable color chips that work alongside the existing text search, with URL persistence for shareable filtered links.

## Current State (from Research)
- **Search infrastructure exists**: Text search with URL persistence (`?q=...`), debounced input (300ms), client-side filtering in CardManager, match counting in ColumnManager
- **Color system exists**: 6 predefined colors (red, blue, green, yellow, purple, gray) defined in `CARD_COLORS` array with `COLOR_CLASSES` mapping to Tailwind styles
- **Client-side architecture**: Cards fetched per-column via `/api/cards?columnId=X`, filtered with `useMemo` in CardManager based on props
- **URL pattern established**: `URLSearchParams` + `window.history.replaceState()` for query sync in ColumnManager
- **Test infrastructure**: Real SQLite in unit tests, component tests with @testing-library/react, E2E tests with Playwright following `tests/search.spec.ts` patterns

## Desired End State
- User sees 6 color chips next to search input, can click to toggle selection (multi-select)
- Selected chips show visual distinction (ring/border), cards filter to show only selected colors (OR logic)
- Color filter works alongside text search (both filters applied simultaneously)
- Selected colors persist in URL as `?colors=red,blue` (comma-separated, combines with `?q=...`)
- Clear filters button resets both color and text filters
- All existing functionality (drag-and-drop, keyboard shortcuts, inline editing) works on filtered cards
- Tests pass: 6+ new repository tests, 10+ component tests, 5+ URL persistence tests, 8+ E2E tests

## What We're NOT Doing
- Filter by "no color" (uncolored cards) — deferred
- Filter by date range — deferred
- Filter by column — deferred
- Saved filter presets — deferred
- AND/OR logic toggle — always OR logic for colors
- Any server-side search endpoint — remains client-side only
- Refactoring archive badge refresh mechanism — works, not broken
- Fixing unrelated position-rebalancing E2E test — outside Phase 7 scope

## Implementation Approach
1. **Extend repository layer first**: Add optional `colors` parameter to `searchCards()` to support color filtering at database level (even though current architecture is client-side, this enables future optimization)
2. **Build UI components**: Add color chip selector to ColumnManager, extend CardManager filtering logic
3. **URL persistence**: Add `?colors=...` param using existing URLSearchParams pattern
4. **Test at each layer**: Repository tests with real SQLite → component tests → E2E tests
5. **Document changes**: Update AGENTS.md and README.md with color filter functionality

**Key design decision**: Keep client-side filtering architecture (no new API endpoints) to maintain consistency with existing search implementation. Color chips live in ColumnManager, filtering logic in CardManager.

---

## Task 1: Extend Repository Layer with Color Filtering

### Overview
Add optional `colors` parameter to `searchCards()` function to support filtering by color at the database level.

### Changes Required

**File**: `src/lib/db/cards.ts`

**Function signature update** (line ~57):
```typescript
// Before
export function searchCards(boardId: number, query: string): Card[]

// After
export function searchCards(boardId: number, query: string, colors?: string[]): Card[]
```

**SQL WHERE clause enhancement** (lines ~70-80):
```typescript
// Add after existing LIKE conditions for title/description/color:
if (colors && colors.length > 0) {
  const colorPlaceholders = colors.map(() => '?').join(',');
  whereConditions.push(`c.color IN (${colorPlaceholders})`);
  params.push(...colors);
}
```

**Logic**:
- If `colors` is undefined or empty array, no color filtering (show all cards)
- If `colors` has values, add `c.color IN (?, ?, ...)` to WHERE clause
- Combine with existing text query filter (both conditions apply with AND logic)
- OR logic for multiple colors handled by SQL `IN` operator

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] `searchCards(boardId, '', ['red'])` returns only red cards
- [ ] `searchCards(boardId, '', ['red', 'blue'])` returns red OR blue cards
- [ ] `searchCards(boardId, 'todo', ['red'])` returns red cards matching "todo" (AND logic between text + color)
- [ ] `searchCards(boardId, 'todo', [])` returns all cards matching "todo" (no color filter)
- [ ] `searchCards(boardId, '', undefined)` returns all cards (no color filter)

---

## Task 2: Add Repository Layer Tests

### Overview
Create comprehensive unit tests for color filtering in `searchCards()` function using real SQLite database.

### Changes Required

**File**: `src/lib/db/__tests__/cards.test.ts`

**New test suite** (add after existing `searchCards` tests, around line ~400+):
```typescript
describe('searchCards with color filtering', () => {
  test('filters by single color', async () => {
    // Setup: Create cards with different colors
    const { boardId, columnId } = await setupBoardAndColumn();
    await createCard(columnId, 'Red card', 'Description', 'red');
    await createCard(columnId, 'Blue card', 'Description', 'blue');
    await createCard(columnId, 'No color card', 'Description', null);

    // Act
    const results = searchCards(boardId, '', ['red']);

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Red card');
  });

  test('filters by multiple colors (OR logic)', async () => {
    // Setup: Create cards with different colors
    // Act: searchCards(boardId, '', ['red', 'blue'])
    // Assert: Returns both red AND blue cards
  });

  test('combines text search with color filter (AND logic)', async () => {
    // Setup: Create "Red todo" (red), "Blue todo" (blue), "Red done" (red)
    // Act: searchCards(boardId, 'todo', ['red'])
    // Assert: Returns only "Red todo" (matches text AND color)
  });

  test('empty colors array returns all matching text query', async () => {
    // Setup: Create cards with different colors
    // Act: searchCards(boardId, 'card', [])
    // Assert: Returns all cards matching "card" regardless of color
  });

  test('color filter with empty text query returns all cards with selected colors', async () => {
    // Setup: Create red/blue/green cards
    // Act: searchCards(boardId, '', ['red', 'blue'])
    // Assert: Returns red and blue cards only
  });

  test('color filter handles invalid color names gracefully', async () => {
    // Setup: Create cards with valid colors
    // Act: searchCards(boardId, '', ['invalid-color'])
    // Assert: Returns empty array (no cards match)
  });

  test('color filter excludes archived cards', async () => {
    // Setup: Create red card, archive it
    // Act: searchCards(boardId, '', ['red'])
    // Assert: Returns empty array (archived cards excluded)
  });
});
```

### Success Criteria
- [ ] All 7 new tests pass
- [ ] Tests use real SQLite database (no mocking)
- [ ] Test coverage on `searchCards()` remains 80%+
- [ ] Tests follow existing patterns (setupBoardAndColumn helper, descriptive names)

---

## Task 3: Add Color Filter State to ColumnManager

### Overview
Add state management for selected colors in ColumnManager and sync to URL query params.

### Changes Required

**File**: `src/components/ColumnManager.tsx`

**State additions** (after existing searchQuery state, around line ~43):
```typescript
const [selectedColors, setSelectedColors] = useState<string[]>([]);
```

**Initialize from URL on mount** (in useEffect alongside query param reading, around line ~55):
```typescript
useEffect(() => {
  // Existing: Read ?q=... param
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  setSearchQuery(q);

  // NEW: Read ?colors=... param
  const colorsParam = params.get('colors');
  if (colorsParam) {
    setSelectedColors(colorsParam.split(',').filter(c => c.trim()));
  }
}, []);
```

**Sync selectedColors to URL** (new useEffect after debounced query sync, around line ~115):
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);

  // Preserve existing ?q=... param
  if (debouncedQuery.trim()) {
    params.set('q', debouncedQuery.trim());
  } else {
    params.delete('q');
  }

  // Add/update/remove ?colors=... param
  if (selectedColors.length > 0) {
    params.set('colors', selectedColors.join(','));
  } else {
    params.delete('colors');
  }

  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
}, [selectedColors, debouncedQuery]);
```

**Color chip toggle handler** (new function after search handlers, around line ~180):
```typescript
const handleColorToggle = (color: string) => {
  setSelectedColors(prev =>
    prev.includes(color)
      ? prev.filter(c => c !== color)  // Deselect
      : [...prev, color]               // Select
  );
};
```

**Clear filters handler update** (modify existing clearSearch, around line ~170):
```typescript
const handleClearFilters = () => {
  setSearchQuery('');
  setSelectedColors([]);
  if (searchInputRef.current) {
    searchInputRef.current.value = '';
    searchInputRef.current.blur();
  }
};
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] `selectedColors` state initializes from URL on mount
- [ ] Clicking color chip toggles selection (adds/removes from array)
- [ ] URL updates with `?colors=red,blue` when colors selected
- [ ] URL removes `?colors=...` when all colors deselected
- [ ] Clear filters button resets both search query and selected colors
- [ ] URL preserves both `?q=...` and `?colors=...` params when both active

---

## Task 4: Build Color Chip UI Component

### Overview
Add color chip selector UI to ColumnManager, rendering 6 clickable chips with visual feedback for selection state.

### Changes Required

**File**: `src/components/ColumnManager.tsx`

**Color constants import** (add at top, around line ~10):
```typescript
const CARD_COLORS = ["red", "blue", "green", "yellow", "purple", "gray"];
const COLOR_CLASSES = {
  red: 'bg-red-200 text-red-900',
  blue: 'bg-blue-200 text-blue-900',
  green: 'bg-green-200 text-green-900',
  yellow: 'bg-yellow-200 text-yellow-900',
  purple: 'bg-purple-200 text-purple-900',
  gray: 'bg-gray-200 text-gray-900',
};
```

**Color chip selector UI** (add before search input, around line ~460):
```typescript
{/* Color filter chips */}
<div className="flex items-center gap-2 mb-3">
  <span className="text-sm font-medium text-gray-700">Filter by color:</span>
  <div className="flex gap-2">
    {CARD_COLORS.map(color => {
      const isSelected = selectedColors.includes(color);
      return (
        <button
          key={color}
          onClick={() => handleColorToggle(color)}
          aria-label={`Filter by ${color} cards`}
          aria-pressed={isSelected}
          className={`
            px-3 py-1.5 rounded text-sm font-medium capitalize
            transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${COLOR_CLASSES[color as keyof typeof COLOR_CLASSES]}
            ${isSelected ? 'ring-2 ring-offset-2 ring-blue-600' : 'opacity-70 hover:opacity-100'}
          `}
        >
          {color}
        </button>
      );
    })}
  </div>
</div>
```

**Update search input section** (modify existing search UI, around line ~465):
```typescript
{/* Search input */}
<div className="flex items-center gap-2 mb-4">
  <div className="relative flex-1">
    <input
      ref={searchInputRef}
      type="text"
      placeholder="Search cards..."
      defaultValue={initialSearchQuery}
      onChange={handleSearchChange}
      onKeyDown={handleSearchKeyDown}
      aria-label="Search cards"
      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {searchQuery && (
      <button
        onClick={handleClearFilters}
        aria-label="Clear filters"
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    )}
  </div>
  {(searchQuery || selectedColors.length > 0) && (
    <button
      onClick={handleClearFilters}
      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
    >
      Clear Filters
    </button>
  )}
</div>
```

### Success Criteria
- [ ] 6 color chips render horizontally above search input
- [ ] Each chip has correct background color from `COLOR_CLASSES`
- [ ] Clicking chip toggles selection (adds/removes ring visual)
- [ ] Selected chips show `ring-2 ring-offset-2 ring-blue-600`
- [ ] Unselected chips show `opacity-70` with `hover:opacity-100`
- [ ] Chips have `aria-label` and `aria-pressed` for accessibility
- [ ] Chips support keyboard focus with `focus:ring-2 ring-blue-500`
- [ ] Clear filters button appears when search query OR colors selected
- [ ] Clear button label updated from "Clear search" to "Clear filters"

---

## Task 5: Extend CardManager Filtering Logic

### Overview
Update CardManager to accept `selectedColors` prop and apply color filter alongside existing text search.

### Changes Required

**File**: `src/components/CardManager.tsx`

**Props interface update** (around line ~37):
```typescript
interface CardManagerProps {
  column: Column;
  onColumnUpdate?: () => void;
  onCardDrop?: (cardId: number, targetColumnId: number) => void;
  onArchive?: () => void;
  searchQuery?: string;
  selectedColors?: string[];  // NEW
}
```

**Destructure prop** (around line ~42):
```typescript
const {
  column,
  onColumnUpdate,
  onCardDrop,
  onArchive,
  searchQuery,
  selectedColors = [],  // NEW with default
} = props;
```

**Update filtering logic** (modify existing useMemo, around lines ~59-69):
```typescript
const filteredCards = useMemo(() => {
  if (!searchQuery && selectedColors.length === 0) {
    return cards;
  }

  return cards.filter(card => {
    // Text search filter (existing logic)
    const matchesTextSearch = !searchQuery || (
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.color && card.color.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Color filter (NEW)
    const matchesColorFilter = selectedColors.length === 0 ||
      (card.color && selectedColors.includes(card.color));

    // Both filters must match (AND logic)
    return matchesTextSearch && matchesColorFilter;
  });
}, [cards, searchQuery, selectedColors]);
```

**Empty state message update** (around line ~392):
```typescript
{filteredCards.length === 0 && cards.length > 0 && (
  <div className="text-sm text-gray-500 p-4 text-center">
    No matching cards
  </div>
)}
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] CardManager accepts `selectedColors` prop (optional, defaults to `[]`)
- [ ] Filtering logic applies both text search AND color filter
- [ ] Empty colors array shows all cards (no color filtering)
- [ ] Text search alone works (no colors selected)
- [ ] Color filter alone works (no text query)
- [ ] Combined filters show cards matching BOTH conditions
- [ ] Empty state displays when no cards match combined filters

---

## Task 6: Connect ColumnManager to CardManager with Color Prop

### Overview
Pass `selectedColors` prop from ColumnManager down to CardManager islands.

### Changes Required

**File**: `src/components/ColumnManager.tsx`

**Update CardManager rendering** (around line ~570):
```typescript
<CardManager
  key={`${column.id}-${cardRefreshKey}`}
  column={column}
  searchQuery={debouncedQuery}
  selectedColors={selectedColors}  // NEW
  onCardDrop={handleCardDrop}
  onArchive={handleCardArchived}
  client:load
/>
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] `selectedColors` prop passes from ColumnManager to CardManager
- [ ] Cards filter correctly when colors selected in ColumnManager
- [ ] Drag-and-drop still works on filtered cards
- [ ] Keyboard shortcuts still work on filtered cards
- [ ] Inline editing still works on filtered cards

---

## Task 7: Update Match Count Logic

### Overview
Update match counting in ColumnManager to include color filter in count calculation.

### Changes Required

**File**: `src/components/ColumnManager.tsx`

**Update match counting logic** (around lines ~151-160):
```typescript
const matchCount = useMemo(() => {
  if (!debouncedQuery && selectedColors.length === 0) return null;

  return allCards.filter(card => {
    // Text search filter
    const matchesTextSearch = !debouncedQuery || (
      card.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      card.description.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
      (card.color && card.color.toLowerCase().includes(debouncedQuery.toLowerCase()))
    );

    // Color filter
    const matchesColorFilter = selectedColors.length === 0 ||
      (card.color && selectedColors.includes(card.color));

    // Both filters must match
    return matchesTextSearch && matchesColorFilter;
  }).length;
}, [allCards, debouncedQuery, selectedColors]);
```

**Update live region rendering** (around line ~500):
```typescript
{matchCount !== null && (
  <div role="status" aria-live="polite" className="sr-only">
    {matchCount} {matchCount === 1 ? 'card' : 'cards'} found
  </div>
)}

{matchCount !== null && (
  <p className="text-sm text-gray-600 mb-2">
    {matchCount} {matchCount === 1 ? 'card' : 'cards'} found
  </p>
)}
```

### Success Criteria
- [ ] Match count displays when search query OR colors selected
- [ ] Match count is null when no filters active (no text shows)
- [ ] Match count updates in real-time when colors toggled
- [ ] Match count reflects combined text + color filtering
- [ ] Live region announces count changes for screen readers
- [ ] Count is accurate (matches actual filtered cards visible)

---

## Task 8: Add Server-Side Color Param Reading

### Overview
Update board detail page to read `?colors=...` param from URL and pass to ColumnManager.

### Changes Required

**File**: `src/pages/boards/[id].astro`

**Read colors param** (after existing query param reading, around line ~19):
```typescript
const initialSearchQuery = Astro.url.searchParams.get('q') || '';
const initialColorsParam = Astro.url.searchParams.get('colors') || '';
const initialColors = initialColorsParam ? initialColorsParam.split(',').filter(c => c.trim()) : [];
```

**Pass to ColumnManager** (around line ~29):
```typescript
<ColumnManager
  boardId={board.id}
  initialSearchQuery={initialSearchQuery}
  initialColors={initialColors}
  client:load
/>
```

**File**: `src/components/ColumnManager.tsx`

**Update props interface** (around line ~22):
```typescript
interface ColumnManagerProps {
  boardId: number;
  initialSearchQuery?: string;
  initialColors?: string[];  // NEW
}
```

**Initialize state from prop** (update useState, around line ~43):
```typescript
const [selectedColors, setSelectedColors] = useState<string[]>(initialColors || []);
```

### Success Criteria
- [ ] Compiles without TypeScript errors
- [ ] Navigating to `/boards/123?colors=red,blue` shows red and blue chips selected
- [ ] Cards filter correctly on page load when URL has `?colors=...`
- [ ] Browser back/forward buttons respect color filter state
- [ ] URL with both `?q=todo&colors=red` loads with both filters active
- [ ] Invalid colors in URL are handled gracefully (ignored)

---

## Task 9: Add Component Tests for Color Filtering

### Overview
Create component tests for color chip interactions and filtering logic using @testing-library/react.

### Changes Required

**File**: `src/components/__tests__/ColumnManager.test.tsx`

**New test suite** (add after existing tests, around line ~200+):
```typescript
describe('Color filtering', () => {
  test('renders 6 color chips', () => {
    // Render ColumnManager
    // Assert: 6 color buttons visible (red, blue, green, yellow, purple, gray)
  });

  test('clicking color chip toggles selection', () => {
    // Render ColumnManager
    // Click red chip
    // Assert: Red chip has aria-pressed="true" and ring visual
    // Click red chip again
    // Assert: Red chip has aria-pressed="false", no ring
  });

  test('multiple chips can be selected simultaneously', () => {
    // Click red, blue, green chips
    // Assert: All 3 have aria-pressed="true"
  });

  test('selected colors update URL query param', () => {
    // Click red and blue chips
    // Assert: URL contains ?colors=red,blue
  });

  test('clear filters button resets colors', () => {
    // Click red chip
    // Click "Clear Filters" button
    // Assert: Red chip deselected, URL has no ?colors param
  });
});
```

**File**: `src/components/__tests__/CardManager.test.tsx`

**New test suite** (add after existing tests):
```typescript
describe('Color filtering', () => {
  test('filters cards by single color', () => {
    // Setup: Mock cards with different colors
    // Render CardManager with selectedColors={['red']}
    // Assert: Only red card visible
  });

  test('filters cards by multiple colors (OR logic)', () => {
    // Setup: Red, blue, green cards
    // Render with selectedColors={['red', 'blue']}
    // Assert: Red and blue cards visible, green hidden
  });

  test('combines text search with color filter', () => {
    // Setup: "Red todo" (red), "Blue todo" (blue), "Red done" (red)
    // Render with searchQuery="todo" and selectedColors={['red']}
    // Assert: Only "Red todo" visible
  });

  test('filtered cards support drag-and-drop', () => {
    // Setup: Cards with colors
    // Render with selectedColors={['red']}
    // Assert: Red cards have draggable attribute
  });

  test('filtered cards support inline editing', () => {
    // Setup: Cards with colors
    // Render with selectedColors={['red']}
    // Click edit button on red card
    // Assert: Edit mode activated
  });

  test('keyboard shortcuts work on filtered cards', () => {
    // Setup: Cards with colors
    // Render with selectedColors={['red']}
    // Focus red card, press Delete
    // Assert: Archive API called
  });
});
```

### Success Criteria
- [ ] All 11 new component tests pass (5 ColumnManager + 6 CardManager)
- [ ] Tests use @testing-library/react patterns (getByRole, userEvent)
- [ ] Tests verify visual feedback (aria-pressed, CSS classes)
- [ ] Tests verify URL updates with color selection
- [ ] Tests verify filtering logic with various color combinations

---

## Task 10: Add E2E Tests for Color Filter Workflows

### Overview
Create end-to-end tests for complete color filtering user flows using Playwright.

### Changes Required

**New file**: `tests/color-filter.spec.ts`

**Test structure** (follow `tests/search.spec.ts` patterns):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Color filtering', () => {
  let boardId: number;

  test.beforeEach(async ({ page }) => {
    // Create board via API
    // Create 3 columns
    // Create cards with different colors:
    //   - Red card (title: "Blocker")
    //   - Blue card (title: "Feature")
    //   - Green card (title: "Done")
    //   - Yellow card (title: "Warning")
    //   - Card with no color (title: "Plain")
    // Navigate to board
  });

  test('filters by single color', async ({ page }) => {
    // Click red chip
    // Assert: Only "Blocker" visible, others hidden
    // Assert: URL contains ?colors=red
  });

  test('filters by multiple colors (OR logic)', async ({ page }) => {
    // Click red and blue chips
    // Assert: "Blocker" and "Feature" visible
    // Assert: URL contains ?colors=red,blue
  });

  test('combines text search with color filter', async ({ page }) => {
    // Type "b" in search input (matches "Blocker")
    // Click red chip
    // Assert: Only "Blocker" visible (matches text AND color)
    // Assert: URL contains ?q=b&colors=red
  });

  test('clear filters button resets both filters', async ({ page }) => {
    // Type "feature" in search
    // Click blue chip
    // Click "Clear Filters" button
    // Assert: All cards visible, search cleared, chip deselected
    // Assert: URL has no query params
  });

  test('color filter persists in URL across navigation', async ({ page }) => {
    // Click red chip
    // Navigate to home
    // Click browser back button
    // Assert: Red chip still selected, cards filtered
  });

  test('drag-and-drop works on filtered cards', async ({ page }) => {
    // Click red chip to filter
    // Drag red card to different column
    // Assert: Card moved successfully
    // Assert: Card still visible after filter reapplies
  });

  test('color selection persists in shareable URL', async ({ page }) => {
    // Click red and blue chips
    // Copy URL from address bar
    // Navigate to home
    // Navigate to copied URL
    // Assert: Red and blue chips selected, cards filtered
  });

  test('empty state when no cards match combined filters', async ({ page }) => {
    // Type "nonexistent" in search
    // Click red chip
    // Assert: "No matching cards" message displays
    // Assert: Match count shows "0 cards found"
  });

  test('match count updates with color selection', async ({ page }) => {
    // Click red chip
    // Assert: Match count shows "1 card found"
    // Click blue chip (add to selection)
    // Assert: Match count shows "2 cards found"
  });

  test('keyboard navigation works with color chips', async ({ page }) => {
    // Tab to red chip
    // Assert: Red chip has focus indicator
    // Press Enter
    // Assert: Red chip selected, cards filtered
    // Press Space
    // Assert: Red chip deselected
  });

  test('loads color filter from URL on page load', async ({ page }) => {
    // Navigate to /boards/:id?colors=red,blue directly
    // Assert: Red and blue chips selected
    // Assert: Cards filtered correctly
  });
});
```

### Success Criteria
- [ ] All 11 E2E tests pass
- [ ] Tests follow existing patterns from `tests/search.spec.ts`
- [ ] Tests use accessibility selectors (getByLabel, getByRole)
- [ ] Tests verify visual state (color chip selection, card visibility)
- [ ] Tests verify URL state (query params)
- [ ] Tests cover integration with existing features (search, drag-and-drop, keyboard shortcuts)

---

## Task 11: Update Documentation

### Overview
Update AGENTS.md and README.md to document color filtering functionality.

### Changes Required

**File**: `AGENTS.md`

**Update "Search and Filter" section** (around line ~298, after existing search documentation):
```markdown
### Color Filtering

- **Location**: Color chips appear above search input in board view
- **Colors**: 6 predefined colors (red, blue, green, yellow, purple, gray)
- **Multi-select**: Users can select multiple colors simultaneously
- **Filter logic**: OR logic for colors (show cards with ANY selected color)
- **Combination**: Color filter works alongside text search (AND logic between filters)

### Color Filter UI
- **Color chips**: Clickable buttons with color background and text
- **Selection state**: Selected chips show ring border (`ring-2 ring-offset-2 ring-blue-600`)
- **Clear filters**: Single button resets both text search and color selection
- **Match count**: Displays total matches when either filter is active

### URL Persistence
- **Query parameter**: Selected colors persist in URL as `?colors=red,blue` (comma-separated)
- **Shareable links**: Users can share links with pre-populated color filters
- **Navigation**: Color filter persists when using browser back/forward buttons
- **Combination**: Colors combine with text search in URL (`?q=todo&colors=red,blue`)

### Repository Function Update
- **Function**: `searchCards(boardId: number, query: string, colors?: string[]): Card[]`
- **Location**: `src/lib/db/cards.ts`
- **Behavior**: Filters by text query AND selected colors (OR logic for multiple colors)
- **Empty colors**: `colors` parameter is optional; undefined or empty array returns all cards matching text query

### Accessibility
- **Color chips**: `aria-label="Filter by {color} cards"` and `aria-pressed` state
- **Keyboard support**: Tab to focus chips, Enter/Space to toggle selection
- **Focus indicators**: Blue ring appears on focused chips
```

**File**: `README.md`

**Update "Search and Filter" section** (find existing search section, enhance):
```markdown
### Search and Filter

**Text Search**:
- Search input above column list filters cards by title, description, or color
- Case-insensitive, substring matching
- Search query persists in URL: `?q=search+term`

**Color Filtering**:
- Click color chips (red, blue, green, yellow, purple, gray) to filter cards by color
- Select multiple colors to see cards with ANY selected color (OR logic)
- Selected colors persist in URL: `?colors=red,blue`

**Combined Filtering**:
- Text search and color filters apply together (AND logic)
- Example: Search for "todo" and filter by red color shows only red cards matching "todo"
- Match count displays total cards matching both filters
- Clear Filters button resets both text search and color selection

**Keyboard Shortcuts**:
- `Ctrl+F` / `Cmd+F`: Focus search input
- `Tab`: Navigate to color chips
- `Enter` or `Space`: Toggle color chip selection
- `Escape`: Clear all filters (when search input focused)

**Shareable Links**:
- Share filtered views with URL: `/boards/123?q=todo&colors=red,blue`
- Recipients see same filters applied on page load
```

### Success Criteria
- [ ] AGENTS.md updated with color filter documentation (6 new subsections)
- [ ] README.md updated with color filter instructions (enhanced Search section)
- [ ] Documentation explains OR logic for colors, AND logic for text + color combination
- [ ] Documentation includes URL format examples
- [ ] Documentation mentions keyboard accessibility

---

## Testing Strategy

### Unit Tests (Repository Layer)
**File**: `src/lib/db/__tests__/cards.test.ts`
- **What to test**: `searchCards()` function with color filtering
- **Key scenarios**:
  - Single color filter returns only matching cards
  - Multiple colors use OR logic (show cards with ANY selected color)
  - Text search + color filter use AND logic (both conditions must match)
  - Empty colors array ignores color filter
  - Color filter excludes archived cards
- **Mocking strategy**: NO MOCKING — use real SQLite database with temp file per test
- **Expected tests**: 7 new tests for color filtering scenarios

### Component Tests (UI Layer)
**File**: `src/components/__tests__/ColumnManager.test.tsx` and `CardManager.test.tsx`
- **What to test**: Color chip interactions and filtering logic
- **Key scenarios**:
  - Clicking color chip toggles selection
  - Multiple chips can be selected simultaneously
  - Selected colors update URL
  - Clear filters resets colors
  - Filtered cards support drag-and-drop, editing, keyboard shortcuts
- **Mocking strategy**: Mock API calls with `vi.fn()`, use @testing-library/react for DOM interactions
- **Expected tests**: 11 new tests (5 ColumnManager + 6 CardManager)

### E2E Tests (Full User Flow)
**File**: `tests/color-filter.spec.ts`
- **What to test**: Complete color filtering workflows in real browser
- **Key scenarios**:
  - Filter by single/multiple colors
  - Combine text search with color filter
  - URL persistence and shareable links
  - Browser back/forward navigation
  - Drag-and-drop on filtered cards
  - Keyboard navigation with color chips
  - Empty state when no matches
- **Setup**: Create board with cards of different colors via API before each test
- **Expected tests**: 11 E2E scenarios covering all acceptance criteria

### Coverage Goals
- **Repository layer**: 80%+ on `searchCards()` function
- **Component layer**: 80%+ on filtering logic in CardManager
- **E2E layer**: All user-facing workflows covered (click, filter, navigate, share)

---

## Risk Assessment

### Risk: URL encoding edge cases
**Description**: Special characters in color names or multiple query params could break URL parsing
**Mitigation**: Use `URLSearchParams` for all URL operations (auto-handles encoding), validate color names against `CARD_COLORS` array

### Risk: Performance with many cards
**Description**: Client-side filtering could slow down with hundreds of cards
**Mitigation**: Already using `useMemo` for filtering (re-renders only when deps change), filtering is O(n) and fast for typical board sizes

### Risk: Color filter UI clutters small screens
**Description**: 6 color chips + search input + clear button could overflow on mobile
**Mitigation**: Use flexbox with `gap-2` for natural wrapping, chips are compact (`px-3 py-1.5`), test on mobile viewport

### Risk: Keyboard navigation conflicts with existing shortcuts
**Description**: Tab/Enter on color chips could interfere with card navigation
**Mitigation**: Color chips are distinct elements outside card list, Tab naturally navigates to chips before cards, Enter on chip doesn't propagate to cards

### Risk: TypeScript errors from missing color types
**Description**: `selectedColors` prop type mismatches could cause compile errors
**Mitigation**: Define explicit types (`string[]`), use optional props with defaults (`selectedColors = []`), follow existing `searchQuery` pattern

### Risk: E2E tests flaky due to debouncing
**Description**: Text search has 300ms debounce, could cause race conditions in tests
**Mitigation**: Use `await page.waitForTimeout(400)` after search input (existing pattern from `tests/search.spec.ts`), color chips have no debounce (instant)

### Risk: Archive badge refresh still brittle
**Description**: localStorage-based refresh mechanism could fail if localStorage events don't fire
**Mitigation**: Out of scope — badge refresh is unrelated to color filtering, Phase 6 REFLECTIONS noted it works but not elegant, no plan to refactor

### Risk: Position rebalancing E2E test still failing
**Description**: Unrelated test failure could block Phase 7 merge
**Mitigation**: Out of scope — failing test is in `tests/position-rebalancing.spec.ts`, not related to color filtering, note in REFLECTIONS if still failing
