# Phase 2 Implementation Plan — Complete API Layer & Basic UI

**Created:** 2026-02-15
**Phase:** 2 (Complete API Layer & Basic UI)
**Status:** Ready for Implementation

---

## Overview

Phase 2 builds on the solid foundation from Phase 1 by completing the API layer (columns and cards endpoints) and implementing the basic UI layer with Astro pages and React islands. By the end of this phase, users will be able to view boards with columns and cards in a clean kanban layout.

**Key Principle:** Display-only UI in Phase 2. No editing, creating, or deleting through the UI yet—that comes in Phase 3. Focus on getting data to display correctly and beautifully.

---

## Implementation Order

### Stage 1: Complete API Layer (Columns & Cards)
Build remaining API endpoints following Phase 1 patterns.

### Stage 2: UI Components (React Islands)
Create display-only React components for Board, Column, and Card.

### Stage 3: Astro Pages (SSR)
Build homepage and board detail pages with server-side data fetching.

### Stage 4: Styling & Polish
Apply Tailwind CSS for kanban layout, responsive design, and visual polish.

### Stage 5: Integration & Testing
Manual testing, bug fixes, and final verification.

---

## Stage 1: Complete API Layer

### 1.1 Column Endpoints

**Files to Create:**

#### `src/pages/api/columns/index.ts`
**Purpose:** Handle column listing and creation

**Exports:**
- `GET /api/columns?boardId=:id` — List all columns for a board
  - **Query param validation:**
    - `boardId` required, must be valid integer
    - Return 400 if missing or invalid
  - **Response:** `{ data: Column[] }` sorted by position
  - **Status codes:** 200 success, 400 bad request

- `POST /api/columns` — Create new column
  - **Body validation:**
    - `boardId` (required, number)
    - `name` (required, non-empty string)
    - `position` (required, number ≥ 0)
  - **Process:**
    1. Validate inputs
    2. Call `ColumnRepository.create()`
    3. Return created column
  - **Response:** `{ data: Column }`
  - **Status codes:** 201 created, 400 bad request, 500 server error

**Implementation notes:**
- Use existing `ColumnRepository.findByBoardId()` for GET
- Use existing `ColumnRepository.create()` for POST
- Follow Phase 1 error handling patterns
- Consistent response format: `{ data: ... }` or `{ error: "..." }`

#### `src/pages/api/columns/[id].ts`
**Purpose:** Handle individual column operations

**Exports:**
- `GET /api/columns/:id` — Get single column
  - **Validation:** ID must be valid integer
  - **Process:**
    1. Parse and validate ID
    2. Call `ColumnRepository.findById()`
    3. Return 404 if not found
  - **Response:** `{ data: Column }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

- `PUT /api/columns/:id` — Update column name
  - **Body validation:**
    - `name` (required, non-empty string)
  - **Process:**
    1. Validate ID and name
    2. Call `ColumnRepository.update()`
    3. Return 404 if column doesn't exist
  - **Response:** `{ data: Column }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

- `DELETE /api/columns/:id` — Delete column (cascades to cards)
  - **Process:**
    1. Validate ID
    2. Call `ColumnRepository.delete()`
    3. Return 204 (no content)
  - **Status codes:** 204 success, 400 bad request, 404 not found

#### `src/pages/api/columns/[id]/position.ts`
**Purpose:** Handle column reordering

**Exports:**
- `PUT /api/columns/:id/position` — Reorder column within board
  - **Body validation:**
    - `position` (required, number ≥ 0)
  - **Process:**
    1. Validate ID and position
    2. Call `ColumnRepository.updatePosition()`
    3. Return updated column
  - **Response:** `{ data: Column }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

**Implementation notes:**
- Create directory: `src/pages/api/columns/[id]/`
- Position update is atomic (no transaction needed—repository handles it)

---

### 1.2 Card Endpoints

**Files to Create:**

#### `src/pages/api/cards/index.ts`
**Purpose:** Handle card listing and creation

**Exports:**
- `GET /api/cards?columnId=:id` — List all cards in a column
  - **Query param validation:**
    - `columnId` required, must be valid integer
    - Return 400 if missing or invalid
  - **Response:** `{ data: Card[] }` sorted by position
  - **Status codes:** 200 success, 400 bad request

- `POST /api/cards` — Create new card
  - **Body validation:**
    - `columnId` (required, number)
    - `title` (required, non-empty string)
    - `description` (optional, string, can be null)
    - `color` (optional, string, must be one of: red, blue, green, yellow, purple, gray, or null)
    - `position` (required, number ≥ 0)
  - **Process:**
    1. Validate all inputs
    2. If color provided, validate against allowed list
    3. Call `CardRepository.create()`
    4. Return created card
  - **Response:** `{ data: Card }`
  - **Status codes:** 201 created, 400 bad request, 500 server error

**Implementation notes:**
- Validate color against predefined list: `['red', 'blue', 'green', 'yellow', 'purple', 'gray']`
- Trim title to prevent whitespace-only values
- Description can be null or empty string

#### `src/pages/api/cards/[id].ts`
**Purpose:** Handle individual card operations

**Exports:**
- `GET /api/cards/:id` — Get single card
  - **Validation:** ID must be valid integer
  - **Process:**
    1. Parse and validate ID
    2. Call `CardRepository.findById()`
    3. Return 404 if not found
  - **Response:** `{ data: Card }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

- `PUT /api/cards/:id` — Update card details
  - **Body validation (all optional but at least one required):**
    - `title` (optional, non-empty string)
    - `description` (optional, string, can be null)
    - `color` (optional, string, must be one of allowed colors or null)
  - **Process:**
    1. Validate ID
    2. Check at least one field provided
    3. Validate color if provided
    4. Call `CardRepository.update()`
    5. Return 404 if card doesn't exist
  - **Response:** `{ data: Card }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

- `DELETE /api/cards/:id` — Delete card
  - **Process:**
    1. Validate ID
    2. Call `CardRepository.delete()`
    3. Return 204 (no content)
  - **Status codes:** 204 success, 400 bad request, 404 not found

#### `src/pages/api/cards/[id]/position.ts`
**Purpose:** Handle card reordering within same column

**Exports:**
- `PUT /api/cards/:id/position` — Reorder card within its column
  - **Body validation:**
    - `position` (required, number ≥ 0)
  - **Process:**
    1. Validate ID and position
    2. Call `CardRepository.updatePosition()`
    3. Return updated card
  - **Response:** `{ data: Card }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

#### `src/pages/api/cards/[id]/move.ts`
**Purpose:** Handle moving cards between columns

**Exports:**
- `PUT /api/cards/:id/move` — Move card to different column
  - **Body validation:**
    - `columnId` (required, number)
    - `position` (required, number ≥ 0)
  - **Process:**
    1. Validate ID, columnId, and position
    2. Call `CardRepository.move(cardId, columnId, position)`
    3. Return updated card
  - **Response:** `{ data: Card }`
  - **Status codes:** 200 success, 400 bad request, 404 not found

**Implementation notes:**
- Create directory: `src/pages/api/cards/[id]/`
- Move operation uses transaction (repository handles it)

---

### 1.3 API Layer Testing Strategy

**No automated tests for API endpoints in Phase 2** (repository tests from Phase 1 cover data logic)

**Manual testing checklist:**
- Use browser console `fetch()` or curl to test each endpoint
- Verify success responses return correct data
- Verify error responses return 400/404 with meaningful messages
- Test edge cases: invalid IDs, missing fields, invalid colors
- Verify cascading deletes (delete column → cards deleted)

**Testing will happen in Stage 5 after all endpoints are built.**

---

## Stage 2: UI Components (React Islands)

### 2.1 Card Color Utility

**File to Create:** `src/utils/cardColors.ts`

**Purpose:** Define color palette and helper function for card labels

**Contents:**
```typescript
export const CARD_COLORS = {
  red: '#ef4444',      // Tailwind red-500
  blue: '#3b82f6',     // Tailwind blue-500
  green: '#10b981',    // Tailwind green-500
  yellow: '#f59e0b',   // Tailwind yellow-500
  purple: '#a855f7',   // Tailwind purple-500
  gray: '#6b7280',     // Tailwind gray-500
} as const;

export type CardColor = keyof typeof CARD_COLORS;

export function getColorForLabel(color: string | null | undefined): string {
  if (!color || !(color in CARD_COLORS)) {
    return CARD_COLORS.gray;
  }
  return CARD_COLORS[color as CardColor];
}
```

**Why this file:**
- Centralized color definitions
- Type-safe color keys
- Default to gray if invalid/null color
- Used by Card component for border color

---

### 2.2 Card Component

**File to Create:** `src/components/Card.tsx`

**Purpose:** Display individual card with title, description, and color label

**Props Interface:**
```typescript
import type { Card } from '../types/entities';

interface CardProps {
  card: Card;
}
```

**Rendering Logic:**
- Display card title as `<h3>` (font-medium, prominent)
- Display description as `<p>` (text-sm, text-gray-600) if present
- Use left border (`border-l-4`) for color label
- Compact, clean card design with white background and shadow

**Tailwind Classes:**
- Container: `bg-white p-3 rounded shadow-sm border-l-4`
- Title: `font-medium text-gray-900`
- Description: `text-sm text-gray-600 mt-1` (only if description exists)
- Inline style for border color: `style={{ borderLeftColor: getColorForLabel(card.color) }}`

**Key Details:**
- Regular React component (not an island)
- Display-only, no interactivity
- Handles null/undefined description gracefully
- Truncate description if very long (use CSS `line-clamp-3`)

---

### 2.3 Column Component

**File to Create:** `src/components/Column.tsx`

**Purpose:** Display column header and list of cards

**Props Interface:**
```typescript
import type { Column, Card } from '../types/entities';

interface ColumnProps {
  column: Column & { cards: Card[] };
}
```

**Rendering Logic:**
- Column header with name and card count
- Vertical list of cards with consistent spacing
- Scrollable container for cards (overflow-y-auto)
- Empty state message if no cards
- Fixed width (320px on desktop)

**Tailwind Classes:**
- Container: `flex-shrink-0 w-full md:w-80 flex flex-col bg-gray-100 rounded-lg max-h-screen`
- Header: `p-3 font-semibold border-b bg-gray-50 flex items-center justify-between`
- Card count badge: `text-xs text-gray-500 font-normal`
- Card container: `flex-1 overflow-y-auto p-2 space-y-2`
- Empty state: `text-center py-4 text-gray-400 text-sm`

**Key Details:**
- Regular React component (not an island)
- Maps over `column.cards` array
- Uses Card component for each card
- Show "No cards yet" if cards array is empty

---

### 2.4 Board Component

**File to Create:** `src/components/Board.tsx`

**Purpose:** Main React island that renders columns horizontally

**Props Interface:**
```typescript
import type { Board, Column, Card } from '../types/entities';

type ColumnWithCards = Column & { cards: Card[] };
type BoardWithColumns = Board & { columns: ColumnWithCards[] };

interface BoardProps {
  board: BoardWithColumns;
}
```

**Rendering Logic:**
- Horizontal scrolling container for columns
- Maps over `board.columns` array
- Empty state message if no columns
- Responsive: horizontal on desktop, vertical on mobile

**Tailwind Classes:**
- Container: `flex flex-col md:flex-row gap-4 p-4 overflow-x-auto h-screen bg-gray-50`
- Empty state: `text-center py-12 text-gray-500 w-full`

**Key Details:**
- **This is the React island** (used with `client:load` in Astro)
- Display-only, no state management
- Handles empty columns array gracefully
- Scrolls horizontally on desktop if columns exceed viewport

---

## Stage 3: Astro Pages (SSR)

### 3.1 Homepage (Board List)

**File to Modify:** `src/pages/index.astro`

**Current State:** Placeholder "Hello, world!"

**New Implementation:**

#### Frontmatter (Server-Side):
```typescript
---
import { getDb } from '../db/init';
import { BoardRepository } from '../repositories/BoardRepository';

const db = getDb();
const boardRepo = new BoardRepository(db);
const boards = boardRepo.findAll();
---
```

#### HTML Structure:
- Page title: "SwimLanes"
- Header with app name
- Grid of board cards (responsive: 1 column mobile, 2-3 columns desktop)
- Each board card shows:
  - Board name (clickable link to `/boards/:id`)
  - Created timestamp (formatted date)
  - Number of columns (if available)
- Empty state: "No boards yet. Create your first board to get started!"
- **No create board form yet** (Phase 3)—just display existing boards

#### Tailwind Layout:
- Container: `max-w-7xl mx-auto px-4 py-8`
- Header: `text-3xl font-bold mb-8 text-gray-900`
- Board grid: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Board card: `bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200`
- Board link: `text-xl font-semibold text-blue-600 hover:text-blue-700`
- Timestamp: `text-sm text-gray-500 mt-2`

**Key Details:**
- Server-side data fetching (no loading state)
- Static HTML with links (no React needed)
- Responsive grid layout
- Clean, professional design

---

### 3.2 Board Detail Page

**File to Create:** `src/pages/boards/[id].astro`

**Purpose:** Display board with columns and cards

#### Frontmatter (Server-Side):
```typescript
---
import { getDb } from '../../db/init';
import { BoardRepository } from '../../repositories/BoardRepository';
import Board from '../../components/Board';

const id = parseInt(Astro.params.id || '', 10);

if (isNaN(id)) {
  return Astro.redirect('/');
}

const db = getDb();
const boardRepo = new BoardRepository(db);
const board = boardRepo.findByIdWithColumns(id);

if (!board) {
  // Handle 404 inline
}
---
```

#### HTML Structure:
- Page title: `{board.name} | SwimLanes`
- Header navigation:
  - Back link to homepage: `← All Boards`
  - Board name as h1
- Board React island: `<Board client:load board={board} />`
- 404 state: "Board not found" with link back home

#### Tailwind Layout:
- Header container: `bg-white border-b border-gray-200 px-4 py-4`
- Back link: `text-blue-600 hover:text-blue-700 text-sm mb-2`
- Board title: `text-2xl font-bold text-gray-900`
- Main content: `h-[calc(100vh-80px)]` (full height minus header)
- 404 container: `max-w-2xl mx-auto text-center py-12`

**Key Details:**
- Server-side data fetching with `findByIdWithColumns()` (single query, nested data)
- Handle invalid/missing ID gracefully
- Pass fully nested data structure to Board component
- Clean navigation back to homepage

---

### 3.3 Layout & Shared Styles

**File to Create:** `src/layouts/Layout.astro` (optional)

**Purpose:** Shared HTML structure, meta tags, and Tailwind setup

**Contents:**
- HTML boilerplate with proper meta tags
- Title prop for dynamic page titles
- Tailwind CSS import
- Viewport meta for mobile responsiveness
- Basic body styles

**Usage:**
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="SwimLanes">
  <!-- Page content -->
</Layout>
```

**Why Optional:**
- Pages are simple enough to inline HTML structure
- Can add later if repetition becomes an issue
- **Recommendation:** Skip for Phase 2, add in Phase 3 if needed

---

## Stage 4: Styling & Polish

### 4.1 Kanban Layout Implementation

**Target Design:**
- Horizontal scrolling columns on desktop
- Vertical stacking on mobile
- Fixed-width columns (320px)
- Cards stack vertically within columns
- Smooth scrolling behavior

**Key Tailwind Utilities:**
- `overflow-x-auto` — horizontal scroll
- `overflow-y-auto` — vertical scroll within columns
- `flex-shrink-0` — prevent column width collapse
- `space-y-2` — consistent card spacing
- `gap-4` — spacing between columns

**Responsive Breakpoints:**
- Mobile (< 768px): `flex-col` (vertical stack)
- Desktop (≥ 768px): `md:flex-row md:overflow-x-auto` (horizontal scroll)

---

### 4.2 Visual Design Tokens

**Color Palette:**
- Background: `bg-gray-50` (light gray for page background)
- Columns: `bg-gray-100` (slightly darker for column containers)
- Cards: `bg-white` (white cards with shadows)
- Text hierarchy:
  - Primary: `text-gray-900` (board/column names)
  - Secondary: `text-gray-600` (card descriptions)
  - Tertiary: `text-gray-500` (metadata, timestamps)
- Interactive: `text-blue-600 hover:text-blue-700` (links)

**Typography Scale:**
- Board title: `text-2xl font-bold`
- Column header: `font-semibold`
- Card title: `font-medium`
- Description: `text-sm`
- Metadata: `text-xs`

**Spacing Scale:**
- Page padding: `p-4` or `p-8`
- Card padding: `p-3`
- Column padding: `p-2` or `p-3`
- Component gaps: `gap-4` (columns), `space-y-2` (cards)

**Shadows:**
- Cards: `shadow-sm` (subtle)
- Board cards on homepage: `shadow hover:shadow-md` (on hover)

---

### 4.3 Responsive Design Strategy

**Mobile (<768px):**
- Single column layout (vertical stack)
- Full-width columns
- Touch-friendly spacing
- No horizontal scroll

**Tablet (768px - 1024px):**
- 2-3 columns visible
- Horizontal scrolling if more columns
- Side padding for breathing room

**Desktop (>1024px):**
- 4-5 columns visible
- Smooth horizontal scrolling
- Optimal kanban experience

**Implementation:**
- Use Tailwind's `md:` and `lg:` prefixes
- Test in browser responsive mode
- Ensure touch targets are at least 44x44px

---

### 4.4 Empty States

**No Boards (Homepage):**
```
No boards yet. Create your first board to get started!
```
- Centered text, gray color
- Friendly, inviting tone

**No Columns (Board Detail):**
```
This board has no columns. Add a column to start organizing cards.
```
- Centered in board area
- Gray color, informative

**No Cards (Within Column):**
```
No cards yet
```
- Small text in column center
- Light gray, subtle

---

## Stage 5: Integration & Testing

### 5.1 Manual API Testing

**Test Each Endpoint:**

#### Column Endpoints:
- ✓ `GET /api/columns?boardId=1` → Returns columns for board
- ✓ `POST /api/columns` with valid body → Creates column
- ✓ `POST /api/columns` with missing fields → Returns 400
- ✓ `GET /api/columns/1` → Returns single column
- ✓ `PUT /api/columns/1` with new name → Updates column
- ✓ `PUT /api/columns/1/position` with new position → Reorders column
- ✓ `DELETE /api/columns/1` → Deletes column and cascades to cards

#### Card Endpoints:
- ✓ `GET /api/cards?columnId=1` → Returns cards for column
- ✓ `POST /api/cards` with valid body → Creates card
- ✓ `POST /api/cards` with invalid color → Returns 400
- ✓ `GET /api/cards/1` → Returns single card
- ✓ `PUT /api/cards/1` with updates → Updates card
- ✓ `PUT /api/cards/1/position` with new position → Reorders card
- ✓ `PUT /api/cards/1/move` to new column → Moves card
- ✓ `DELETE /api/cards/1` → Deletes card

**Test Tools:**
- Browser console `fetch()` API
- curl commands
- Postman/Insomnia (optional)

---

### 5.2 Visual Testing

**Browser Testing:**
- ✓ Chrome/Brave: Dev Tools responsive mode
- ✓ Firefox: Responsive Design Mode
- ✓ Safari: If available (macOS)

**Screen Sizes:**
- ✓ Mobile: 375px (iPhone SE)
- ✓ Tablet: 768px (iPad)
- ✓ Desktop: 1440px (common laptop)
- ✓ Large: 1920px (desktop monitor)

**Visual Checks:**
- ✓ Columns scroll horizontally on desktop
- ✓ Columns stack vertically on mobile
- ✓ Cards display with correct colors
- ✓ Text hierarchy is clear
- ✓ Spacing is consistent
- ✓ Empty states display correctly
- ✓ Navigation links work

---

### 5.3 Build & Runtime Checks

**TypeScript Validation:**
```bash
npm run build
```
- ✓ No TypeScript errors
- ✓ Astro check passes
- ✓ Build succeeds

**Development Server:**
```bash
npm run dev
```
- ✓ Server starts without errors
- ✓ Pages load correctly
- ✓ Hot module replacement works
- ✓ No console errors/warnings

**Data Flow Verification:**
- ✓ Homepage shows all boards from database
- ✓ Clicking board navigates to detail page
- ✓ Board detail page shows correct columns and cards
- ✓ All data displays accurately
- ✓ Back navigation returns to homepage

---

### 5.4 Bug Fixes & Polish

**Common Issues to Watch For:**
- Hydration errors (React mismatch between server/client)
- Missing keys in map iterations
- Null/undefined handling in components
- TypeScript type mismatches
- Incorrect Astro params parsing
- CSS overflow issues (scrolling not working)

**Resolution Strategy:**
1. Reproduce issue in browser
2. Check browser console for errors
3. Verify TypeScript compilation
4. Fix root cause
5. Test again in all browsers/sizes

---

## Files Summary

### Files to Create (New):

#### API Routes:
1. `src/pages/api/columns/index.ts` — Column list & create
2. `src/pages/api/columns/[id].ts` — Column get/update/delete
3. `src/pages/api/columns/[id]/position.ts` — Column reorder
4. `src/pages/api/cards/index.ts` — Card list & create
5. `src/pages/api/cards/[id].ts` — Card get/update/delete
6. `src/pages/api/cards/[id]/position.ts` — Card reorder
7. `src/pages/api/cards/[id]/move.ts` — Card move between columns

#### React Components:
8. `src/components/Card.tsx` — Card display component
9. `src/components/Column.tsx` — Column display component
10. `src/components/Board.tsx` — Board island component

#### Utilities:
11. `src/utils/cardColors.ts` — Color palette and helpers

#### Pages:
12. `src/pages/boards/[id].astro` — Board detail page

### Files to Modify (Existing):
13. `src/pages/index.astro` — Update homepage with board list

### Directories to Create:
- `src/pages/api/columns/[id]/`
- `src/pages/api/cards/[id]/`
- `src/pages/boards/`
- `src/components/`
- `src/utils/`

**Total:** 13 files (12 new, 1 modified)

---

## Success Criteria (from SPEC.md)

### API Endpoints
- [x] All column endpoints work correctly (GET, POST, PUT, DELETE)
- [x] All card endpoints work correctly (GET, POST, PUT, DELETE)
- [x] Position updates work for both columns and cards
- [x] Card move operation correctly changes column and position
- [x] All endpoints return proper status codes and error messages
- [x] Invalid requests return 400 with error description
- [x] Non-existent resources return 404

### UI Pages
- [x] Homepage displays all boards in a grid
- [x] Clicking a board navigates to board detail page
- [x] Board detail page shows board name and all columns/cards
- [x] Navigation back to homepage works
- [x] 404 handling shows if board not found

### React Components
- [x] Board component renders columns horizontally
- [x] Column component displays header and cards
- [x] Card component shows title, description, and color
- [x] Components receive correct props and render without errors
- [x] No hydration errors in browser console

### Styling
- [x] Horizontal swim lane layout works on desktop
- [x] Columns scroll horizontally if they exceed viewport
- [x] Cards are visually distinct with borders/shadows
- [x] Color labels are clearly visible
- [x] Layout is responsive (stacks on mobile)
- [x] Typography is clear and hierarchical

### Build & Development
- [x] `npm run dev` works without errors
- [x] `npm run build` succeeds
- [x] No TypeScript errors
- [x] No console errors or warnings in browser
- [x] Pages load and display data correctly

---

## Test Strategy

**Unit Tests:** ✅ Already covered by Phase 1 repository tests (60 tests)

**API Tests:** ⚠️ Manual testing only
- Use browser console or curl
- Test each endpoint with success and error cases
- Verify response format and status codes

**UI Tests:** ⚠️ Manual visual testing
- Test in multiple browsers
- Test responsive layouts at different screen sizes
- Verify data displays correctly

**Integration Tests:** ⚠️ Manual end-to-end testing
- Navigate from homepage → board detail → back
- Verify data persistence across page refreshes
- Check that nested data displays correctly

**Rationale:** Repository tests provide confidence in data layer. API routes are thin wrappers. UI is display-only with no complex logic. Manual testing is sufficient for Phase 2 MVP.

---

## Estimated Timeline

**Stage 1 (API Layer):** ~2-3 hours
- 7 API endpoint files
- Input validation and error handling
- Manual testing with curl/browser

**Stage 2 (Components):** ~1-2 hours
- 3 React components (Card, Column, Board)
- 1 utility file (cardColors)
- Simple display-only logic

**Stage 3 (Pages):** ~1 hour
- 1 new page (board detail)
- 1 updated page (homepage)
- Server-side data fetching

**Stage 4 (Styling):** ~1-2 hours
- Tailwind CSS layout implementation
- Responsive design
- Visual polish and refinement

**Stage 5 (Testing):** ~1-2 hours
- Manual API testing
- Visual testing in browsers
- Bug fixes and adjustments

**Total Estimated Time:** ~6-10 hours of focused development

---

## Dependencies

**All dependencies already installed from Phase 1:**
- ✅ Astro 5 with Node adapter
- ✅ React 18
- ✅ Tailwind CSS
- ✅ better-sqlite3
- ✅ TypeScript
- ✅ Vitest

**No new dependencies needed for Phase 2.**

---

## Risks & Mitigations

### Risk 1: Hydration Errors
**Description:** React hydration mismatches between server and client rendering

**Mitigation:**
- Keep components simple and display-only
- Avoid conditional rendering based on client-only state
- Test thoroughly in browser console
- Use React Strict Mode to catch issues early

### Risk 2: Responsive Layout Issues
**Description:** Horizontal scrolling might not work on all devices/browsers

**Mitigation:**
- Test on real devices if possible
- Use standard Tailwind patterns (well-tested)
- Fallback to vertical layout on mobile
- Check browser developer tools responsive mode

### Risk 3: API Validation Gaps
**Description:** Missing input validation could allow invalid data

**Mitigation:**
- Follow Phase 1 validation patterns consistently
- Test error cases manually
- Return clear 400 errors with helpful messages
- Validate all user inputs server-side

### Risk 4: TypeScript Type Mismatches
**Description:** Type errors between Astro and React components

**Mitigation:**
- Use shared type definitions from `src/types/entities.ts`
- Run `npm run build` frequently to catch errors
- Ensure props are JSON-serializable (no functions/classes)
- Use TypeScript strict mode for maximum safety

---

## Carry Forward to Phase 3

**After Phase 2 is complete, Phase 3 should focus on:**

1. **Interactive UI:**
   - Inline editing for board/column/card names
   - Create/delete buttons and forms
   - Modals or inline forms for user input

2. **Client-Side State:**
   - React state management (useState or Context)
   - Optimistic updates for better UX
   - Form validation

3. **Navigation Enhancements:**
   - Confirm dialogs before delete
   - Success/error toast notifications
   - Loading states for async operations

4. **Preparation for Drag-and-Drop (Phase 4):**
   - Research drag-and-drop libraries
   - Plan reordering UX patterns
   - Consider touch support for mobile

---

## Conclusion

Phase 2 implementation plan is clear, detailed, and actionable. Following this plan will result in:

✅ Complete API layer with all CRUD operations for columns and cards
✅ Functional UI with server-side rendering and React islands
✅ Clean, responsive kanban board layout
✅ Professional visual design with Tailwind CSS
✅ Solid foundation for Phase 3 interactivity

**All work builds on Phase 1's solid foundation.** Repository pattern, migration system, and comprehensive testing provide confidence. TypeScript ensures type safety throughout the stack.

**Ready to implement Phase 2.** 🚀
