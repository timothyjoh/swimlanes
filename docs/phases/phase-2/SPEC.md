# Phase 2 — Complete API Layer & Basic UI

## Objective
Complete the API endpoints for columns and cards, then build the foundational UI layer with Astro pages and React islands to display boards, columns, and cards. Users should be able to view boards and their contents in a clean kanban layout, but no editing or drag-and-drop yet.

## Scope

### 1. Complete API Layer

#### Column Endpoints (`src/pages/api/columns/`)
- `GET /api/columns?boardId=:id` — list all columns for a board
- `POST /api/columns` — create new column
  - Body: `{ boardId, name, position }`
  - Returns 201 with created column
- `PUT /api/columns/[id]` — update column name
  - Body: `{ name }`
  - Returns 200 with updated column
- `PUT /api/columns/[id]/position` — reorder column within board
  - Body: `{ position }`
  - Returns 200 with updated column
- `DELETE /api/columns/[id]` — delete column (cascades to cards)
  - Returns 204 on success

#### Card Endpoints (`src/pages/api/cards/`)
- `GET /api/cards?columnId=:id` — list all cards in a column
- `POST /api/cards` — create new card
  - Body: `{ columnId, title, description, color, position }`
  - Returns 201 with created card
- `PUT /api/cards/[id]` — update card details
  - Body: `{ title?, description?, color? }`
  - Returns 200 with updated card
- `PUT /api/cards/[id]/position` — reorder card within same column
  - Body: `{ position }`
  - Returns 200 with updated card
- `PUT /api/cards/[id]/move` — move card to different column
  - Body: `{ columnId, position }`
  - Returns 200 with updated card
- `DELETE /api/cards/[id]` — delete card
  - Returns 204 on success

#### Requirements for All API Endpoints
- Proper HTTP status codes (200, 201, 204, 400, 404, 500)
- JSON request/response bodies
- Input validation (return 400 for invalid data)
- Error handling with meaningful error messages
- Consistent response format: `{ data: {...} }` for success, `{ error: "..." }` for errors

### 2. Board Display UI

#### Homepage (`src/pages/index.astro`)
- Replace placeholder with functional board list
- Display all boards as clickable cards
- Include "Create Board" form/button
- Show board creation timestamp
- Responsive grid layout using Tailwind

#### Board Detail Page (`src/pages/boards/[id].astro`)
- Server-side render board data using `BoardRepository.findByIdWithColumns()`
- Display board name as page title
- Handle 404 if board not found
- Pass board data to React Board component
- Include navigation back to homepage

### 3. React Islands for Display

#### Board Component (`src/components/Board.tsx`)
- React island that receives board data as props
- Renders columns horizontally in a scrollable container
- No interactivity yet (static display)
- Props: `{ board: Board & { columns: (Column & { cards: Card[] })[] } }`

#### Column Component (`src/components/Column.tsx`)
- Displays column name as header
- Renders all cards vertically within column
- Shows card count
- Fixed-width column design
- Props: `{ column: Column & { cards: Card[] } }`

#### Card Component (`src/components/Card.tsx`)
- Displays card title prominently
- Shows description (truncated if long)
- Color label displayed as left border or badge
- Clean, compact card design
- Props: `{ card: Card }`

### 4. Styling & Layout

#### Tailwind CSS Implementation
- Horizontal swim lane layout (columns side-by-side)
- Each column has fixed width (~280-320px), scrollable container
- Cards have consistent spacing and borders
- Color labels use predefined palette (e.g., red, blue, green, yellow, purple)
- Responsive: stack columns vertically on mobile (< 768px)
- Clean, modern aesthetic with proper shadows and borders

#### Design Tokens
- Define card color classes in Tailwind config or use Tailwind's default colors
- Consistent spacing scale (p-2, p-4, etc.)
- Typography hierarchy (board title > column header > card title > description)

### 5. Navigation & UX

#### Board List (Homepage)
- Each board card shows:
  - Board name
  - Number of columns
  - Created date
  - Click to open
- "New Board" button/form at top
- Empty state message if no boards exist

#### Board Detail Page
- Breadcrumb or back link to homepage
- Board name as h1
- Columns arranged horizontally
- Empty state message if board has no columns

## Acceptance Criteria

### API Endpoints
- [ ] All column endpoints work correctly (GET, POST, PUT, DELETE)
- [ ] All card endpoints work correctly (GET, POST, PUT, DELETE)
- [ ] Position updates work for both columns and cards
- [ ] Card move operation correctly changes column and position
- [ ] All endpoints return proper status codes and error messages
- [ ] Invalid requests return 400 with error description
- [ ] Non-existent resources return 404

### UI Pages
- [ ] Homepage displays all boards in a grid
- [ ] Clicking a board navigates to board detail page
- [ ] Board detail page shows board name and all columns/cards
- [ ] Navigation back to homepage works
- [ ] 404 page shows if board not found

### React Components
- [ ] Board component renders columns horizontally
- [ ] Column component displays header and cards
- [ ] Card component shows title, description, and color
- [ ] Components receive correct props and render without errors
- [ ] No hydration errors in browser console

### Styling
- [ ] Horizontal swim lane layout works on desktop
- [ ] Columns scroll horizontally if they exceed viewport
- [ ] Cards are visually distinct with borders/shadows
- [ ] Color labels are clearly visible
- [ ] Layout is responsive (stacks on mobile)
- [ ] Typography is clear and hierarchical

### Build & Development
- [ ] `npm run dev` works without errors
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No console errors or warnings in browser
- [ ] Pages load and display data correctly

### Testing (Optional for Phase 2)
- [ ] Manual testing confirms all pages work
- [ ] Can create board from homepage
- [ ] Can view board with columns and cards
- [ ] Data persists across page refreshes

## Out of Scope
- No drag-and-drop functionality (Phase 3)
- No inline editing of boards/columns/cards (Phase 3)
- No delete buttons or edit forms (Phase 3)
- No card reordering UI (Phase 3)
- No color picker UI (Phase 3)
- No API endpoint tests (have repository tests from Phase 1)

## Technical Notes

### React Islands in Astro
- Use `client:load` directive for immediate hydration
- Pass serialized data from Astro to React via props
- Keep React components simple (display-only for now)

### Data Flow
```
Astro Page (SSR) → Fetch Data from Repos → Pass to React Island → Render
```

### Error Handling
- API errors should return JSON with `{ error: "message" }`
- UI should handle missing data gracefully (empty states)
- Log errors server-side for debugging

### Positioning Logic
- Positions are integers (0, 1, 2, ...)
- When creating new items, use `MAX(position) + 1` or 0 if empty
- When reordering, update position field directly (no need to reorder all items)

## Success Metrics
Phase 2 is complete when:
1. All acceptance criteria are met
2. User can navigate from homepage → board detail → back
3. All columns and cards display correctly with styling
4. All API endpoints work (manual testing with curl or Postman)
5. Build succeeds with no errors
6. Application looks clean and professional

## Next Phase Preview
Phase 3 will focus on interactivity:
- Inline editing for board/column/card names
- Create/delete buttons for columns and cards
- Basic forms and modals
- Client-side state management
- Preparing for drag-and-drop in Phase 4
