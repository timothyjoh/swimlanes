# Phase 2 Research — Complete API Layer & Basic UI

**Research Date:** 2026-02-15
**Phase:** 2 (Complete API Layer & Basic UI)

---

## Overview

Phase 2 focuses on completing the API endpoints for columns and cards, then building the foundational UI layer with Astro pages and React islands. This research document covers technical decisions, library choices, and implementation patterns needed for this phase.

---

## 1. Astro SSR & React Islands Integration

### 1.1 Data Flow Pattern

**Server-Side Rendering (SSR) to React Islands:**

```astro
---
// src/pages/boards/[id].astro
import { getDb } from '../../db/init';
import { BoardRepository } from '../../repositories/BoardRepository';
import Board from '../../components/Board';

const id = parseInt(Astro.params.id || '', 10);
const db = getDb();
const repo = new BoardRepository(db);
const board = repo.findByIdWithColumns(id);

if (!board) {
  return Astro.redirect('/404');
}
---

<html>
  <head>
    <title>{board.name} | SwimLanes</title>
  </head>
  <body>
    <Board client:load board={board} />
  </body>
</html>
```

**Key Points:**
- Astro pages run server-side, can directly import and use repositories
- Data fetched in frontmatter is serialized and passed to React components as props
- No need for `useEffect` + fetch pattern; data is available immediately
- Props must be JSON-serializable (no functions, class instances, etc.)

### 1.2 Client Directives for Hydration

**Available options:**
- `client:load` — hydrates immediately on page load (best for interactive content above fold)
- `client:idle` — hydrates when browser is idle (good for lower-priority interactive content)
- `client:visible` — hydrates when component enters viewport (lazy loading)
- `client:only` — no SSR, renders only on client (avoid for SEO/performance)

**Recommendation for Phase 2:**
- Use `client:load` for the Board component since it's the primary interactive content
- In Phase 3+ when adding forms/modals, consider `client:idle` for secondary UI elements

### 1.3 TypeScript Type Safety

**Shared types between Astro and React:**
```typescript
// src/types/entities.ts exports are used by both Astro pages and React components
import type { BoardWithColumns } from '../types/entities';

interface BoardProps {
  board: BoardWithColumns;
}

export default function Board({ board }: BoardProps) {
  // Type-safe access to board data
}
```

**Decision:** ✅ Continue using shared type definitions from `src/types/entities.ts`

---

## 2. API Route Organization & Patterns

### 2.1 File Structure for Column & Card Endpoints

**Astro API routes use file-based routing:**

```
src/pages/api/
├── boards/
│   ├── index.ts          → GET, POST /api/boards
│   └── [id].ts           → GET, PUT, DELETE /api/boards/:id
├── columns/
│   ├── index.ts          → GET, POST /api/columns
│   ├── [id].ts           → GET, PUT, DELETE /api/columns/:id
│   └── [id]/
│       └── position.ts   → PUT /api/columns/:id/position
└── cards/
    ├── index.ts          → GET, POST /api/cards
    ├── [id].ts           → GET, PUT, DELETE /api/cards/:id
    ├── [id]/
    │   ├── position.ts   → PUT /api/cards/:id/position
    │   └── move.ts       → PUT /api/cards/:id/move
```

**Pattern established in Phase 1:**
- Collection operations (list, create) → `index.ts` with GET, POST exports
- Individual resource operations (get, update, delete) → `[id].ts`
- Special operations (position, move) → nested `[id]/operation.ts`

**Query parameters for filtering:**
```typescript
// GET /api/columns?boardId=123
export const GET: APIRoute = async ({ url }) => {
  const boardId = url.searchParams.get('boardId');
  if (!boardId) {
    return new Response(
      JSON.stringify({ error: 'boardId query parameter is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const id = parseInt(boardId, 10);
  if (isNaN(id)) {
    return new Response(
      JSON.stringify({ error: 'Invalid boardId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const columns = repo.findByBoardId(id);
  return new Response(JSON.stringify({ data: columns }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
```

**Decision:** ✅ Follow Phase 1 patterns for consistency:
- Query params for list filtering
- Request body for create/update operations
- Consistent error handling and status codes
- All responses in `{ data: ... }` or `{ error: "..." }` format

### 2.2 Input Validation Pattern

**Established pattern from Phase 1:**
1. Parse and validate ID parameters (return 400 if invalid)
2. Parse JSON body (return 400 if malformed)
3. Validate required fields and types (return 400 if invalid)
4. Call repository method
5. Return 404 if resource not found
6. Return 201 for successful creates, 200 for updates, 204 for deletes

**Example validation for card creation:**
```typescript
// Validate required fields
if (!body.columnId || typeof body.columnId !== 'number') {
  return new Response(
    JSON.stringify({ error: 'columnId is required and must be a number' }),
    { status: 400 }
  );
}

if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
  return new Response(
    JSON.stringify({ error: 'title is required and must be a non-empty string' }),
    { status: 400 }
  );
}

// Optional fields validation
if (body.color !== undefined && body.color !== null) {
  const validColors = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];
  if (!validColors.includes(body.color)) {
    return new Response(
      JSON.stringify({ error: `color must be one of: ${validColors.join(', ')}` }),
      { status: 400 }
    );
  }
}
```

**Decision:** ✅ Apply thorough input validation to all new endpoints

---

## 3. Tailwind CSS Kanban Layout Patterns

### 3.1 Horizontal Scrolling Columns

**Classic kanban board layout:**
- Horizontal container with `overflow-x-auto` for scrolling
- Fixed-width columns (280-320px typical)
- Flexbox or Grid for column arrangement
- Vertical scrolling within each column

**Recommended implementation:**

```jsx
// Board component
<div className="flex gap-4 overflow-x-auto p-4 h-screen">
  {columns.map(column => (
    <Column key={column.id} column={column} />
  ))}
</div>

// Column component
<div className="flex-shrink-0 w-80 flex flex-col bg-gray-100 rounded-lg">
  <div className="p-3 font-semibold border-b">{column.name}</div>
  <div className="flex-1 overflow-y-auto p-2 space-y-2">
    {column.cards.map(card => (
      <Card key={card.id} card={card} />
    ))}
  </div>
</div>

// Card component
<div className="bg-white p-3 rounded shadow-sm border-l-4"
     style={{ borderLeftColor: getColorForLabel(card.color) }}>
  <h3 className="font-medium">{card.title}</h3>
  {card.description && (
    <p className="text-sm text-gray-600 mt-1">{card.description}</p>
  )}
</div>
```

**Key Tailwind classes:**
- `overflow-x-auto` — horizontal scroll for board
- `overflow-y-auto` — vertical scroll within column
- `flex-shrink-0` — prevent columns from shrinking below `w-80`
- `space-y-2` — consistent vertical spacing between cards
- `gap-4` — spacing between columns

### 3.2 Responsive Strategy

**Desktop (≥768px):**
- Horizontal scrolling layout
- Fixed column widths (~320px)
- Side-by-side columns

**Mobile (<768px):**
- Vertical stacking (one column per row)
- Full-width columns
- No horizontal scroll

**Implementation:**
```jsx
<div className="flex flex-col md:flex-row md:overflow-x-auto gap-4 p-4">
  {columns.map(column => (
    <div className="w-full md:w-80 md:flex-shrink-0">
      {/* Column content */}
    </div>
  ))}
</div>
```

**Decision:** ✅ Use responsive Tailwind classes for mobile/desktop layouts

### 3.3 Color Palette for Card Labels

**Tailwind default colors provide excellent options:**

```typescript
// src/utils/cardColors.ts
export const CARD_COLORS = {
  red: '#ef4444',      // Tailwind red-500
  blue: '#3b82f6',     // Tailwind blue-500
  green: '#10b981',    // Tailwind green-500
  yellow: '#f59e0b',   // Tailwind yellow-500
  purple: '#a855f7',   // Tailwind purple-500
  gray: '#6b7280',     // Tailwind gray-500
};

export function getColorForLabel(color: string | null): string {
  if (!color || !(color in CARD_COLORS)) {
    return CARD_COLORS.gray;
  }
  return CARD_COLORS[color as keyof typeof CARD_COLORS];
}
```

**Visual representation:**
- Use left border (`border-l-4`) for color label
- Or use small badge/dot in top-right corner
- Default to gray if no color specified

**Decision:** ✅ Use Tailwind's default color palette with 6 predefined options

### 3.4 Empty States

**Important UX consideration:**

```jsx
// No boards
{boards.length === 0 && (
  <div className="text-center py-12 text-gray-500">
    <p>No boards yet. Create your first board to get started!</p>
  </div>
)}

// No columns in board
{columns.length === 0 && (
  <div className="text-center py-12 text-gray-500">
    <p>This board has no columns. Add a column to start organizing cards.</p>
  </div>
)}

// No cards in column
{cards.length === 0 && (
  <div className="text-center py-4 text-gray-400 text-sm">
    No cards yet
  </div>
)}
```

**Decision:** ✅ Include empty states for all lists (boards, columns, cards)

---

## 4. Component Architecture Patterns

### 4.1 Component Hierarchy

```
Page (Astro SSR)
└── Board (React Island)
    └── Column (React Component)
        └── Card (React Component)
```

**Why this structure:**
- Only Board needs to be a "island" (hydrated component)
- Column and Card can be regular React components imported by Board
- Reduces hydration overhead (only one island vs. multiple)
- Simpler prop passing (no need for `client:load` on every component)

**Implementation:**
```tsx
// src/components/Board.tsx (React Island)
import Column from './Column';

export default function Board({ board }: BoardProps) {
  return (
    <div className="...">
      {board.columns.map(column => (
        <Column key={column.id} column={column} />
      ))}
    </div>
  );
}

// src/components/Column.tsx (Regular React Component)
import Card from './Card';

export default function Column({ column }: ColumnProps) {
  return (
    <div className="...">
      <h2>{column.name}</h2>
      {column.cards.map(card => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  );
}

// src/components/Card.tsx (Regular React Component)
export default function Card({ card }: CardProps) {
  return (
    <div className="...">
      <h3>{card.title}</h3>
      {card.description && <p>{card.description}</p>}
    </div>
  );
}
```

**Decision:** ✅ Single island (Board), child components are regular React components

### 4.2 Props Interface Pattern

**Type-safe props using entities:**

```typescript
// src/components/Board.tsx
import type { BoardWithColumns } from '../types/entities';

interface BoardProps {
  board: BoardWithColumns;
}

// src/components/Column.tsx
import type { ColumnWithCards } from '../types/entities';

interface ColumnProps {
  column: ColumnWithCards;
}

// src/components/Card.tsx
import type { Card } from '../types/entities';

interface CardProps {
  card: Card;
}
```

**Decision:** ✅ Use existing entity types for component props

### 4.3 Display-Only Components (Phase 2)

**No interactivity in Phase 2:**
- No state management needed
- No event handlers (onClick, onChange, etc.)
- Pure display components
- Read-only presentation of data

**Phase 3+ will add:**
- Form inputs for editing
- Buttons for create/delete
- Event handlers for user interactions
- Client-side state management

**Decision:** ✅ Keep components simple and display-only for Phase 2

---

## 5. Navigation & Routing

### 5.1 Page Structure

```
src/pages/
├── index.astro           → Homepage (board list)
├── boards/
│   └── [id].astro        → Board detail page
└── api/                  → API routes (already covered)
```

### 5.2 Navigation Links

**Homepage to Board:**
```astro
<a href={`/boards/${board.id}`} className="...">
  {board.name}
</a>
```

**Board back to Homepage:**
```astro
<a href="/" className="...">← Back to Boards</a>
```

**Decision:** ✅ Use standard HTML anchor tags (no client-side router needed)

### 5.3 404 Handling

**Board not found:**
```astro
---
const board = repo.findByIdWithColumns(id);
if (!board) {
  return Astro.redirect('/404');
}
---
```

**Or inline error:**
```astro
---
const board = repo.findByIdWithColumns(id);
---
{!board ? (
  <div>Board not found. <a href="/">Return home</a></div>
) : (
  <Board client:load board={board} />
)}
```

**Decision:** ✅ Handle 404 inline with helpful message and link back home

---

## 6. Data Fetching & Performance

### 6.1 SSR Data Fetching

**Advantages of Astro SSR:**
- No loading spinners (data ready on page load)
- No flash of empty content
- SEO-friendly (content in initial HTML)
- Fast initial render
- SQLite queries are synchronous and fast

**Pattern:**
```astro
---
// Runs on server only
const data = repo.findSomething(id);
---
<Component data={data} />
```

**Decision:** ✅ Leverage SSR for all initial data fetching

### 6.2 Nested Data Query

**Phase 1 already provides optimal query:**
```typescript
// BoardRepository.findByIdWithColumns() returns:
{
  id: 1,
  name: "My Board",
  columns: [
    {
      id: 1,
      name: "To Do",
      cards: [
        { id: 1, title: "Task 1", ... },
        { id: 2, title: "Task 2", ... }
      ]
    },
    // ...more columns
  ]
}
```

**Single database query** fetches board → columns → cards with joins. No N+1 query problem.

**Decision:** ✅ Use existing `findByIdWithColumns()` method for board pages

---

## 7. Development Workflow

### 7.1 Hot Module Replacement (HMR)

**Astro dev server:**
- `npm run dev` starts dev server on port 4321
- HMR works for `.astro`, `.tsx`, and `.ts` files
- Browser auto-refreshes on save
- Fast rebuild times

### 7.2 TypeScript Checking

**Build process:**
```bash
npm run build     # Runs astro check + astro build
```

**Astro check** validates:
- TypeScript types in `.astro` files
- Props passed to components
- Import/export correctness

**Decision:** ✅ Continue running `npm run build` to verify TypeScript correctness

### 7.3 Testing Strategy for Phase 2

**Phase 1 testing coverage:**
- ✅ Repository layer fully tested (60 tests)
- ✅ All database operations validated

**Phase 2 testing:**
- ❌ No automated API endpoint tests (manual testing with browser)
- ❌ No React component tests (visual verification)
- ❌ No E2E tests

**Rationale:**
- Repository tests cover data logic
- API routes are thin wrappers around repositories
- UI is display-only (no complex logic to test)
- Manual testing is sufficient for MVP

**Decision:** ✅ Continue with manual testing for Phase 2; defer automated UI tests to later phases if needed

---

## 8. Security Considerations

### 8.1 XSS Prevention

**React's built-in protection:**
- React escapes all strings rendered in JSX by default
- Safe to render user-generated content (card titles, descriptions)
- No need for manual sanitization

**Example:**
```jsx
<h3>{card.title}</h3>  {/* Automatically escaped */}
```

If `card.title` is `<script>alert('xss')</script>`, React renders it as text, not executable code.

**Decision:** ✅ Trust React's built-in XSS protection

### 8.2 SQL Injection Prevention

**Phase 1 already uses prepared statements:**
```typescript
const stmt = this.db.prepare('SELECT * FROM cards WHERE id = ?');
stmt.get(id);  // Parameter is safely escaped
```

**Decision:** ✅ Continue using parameterized queries in all repositories

### 8.3 Input Validation

**Server-side validation in API routes:**
- Validate all inputs (IDs, names, positions, colors)
- Return 400 errors for invalid data
- Trim strings to prevent whitespace-only values
- Constrain color values to allowed list

**Decision:** ✅ Add thorough validation to all new API endpoints

---

## 9. Decisions Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Astro-React integration** | SSR pages + React islands with `client:load` | Optimal performance, simple data flow |
| **Component architecture** | Single Board island, child components are regular React | Reduces hydration overhead |
| **API route structure** | File-based routing with query params | Consistent with Phase 1 patterns |
| **Layout system** | Tailwind CSS with flexbox | Standard, well-documented, responsive |
| **Color palette** | Tailwind default colors (6 colors) | Built-in, accessible, no custom config |
| **Responsive strategy** | Horizontal scroll on desktop, vertical stack on mobile | Standard kanban UX pattern |
| **Data fetching** | Server-side with existing nested query | Fast, no loading states, SEO-friendly |
| **Navigation** | Standard HTML anchor tags | Simple, no router needed |
| **Testing** | Manual testing only (Phase 2) | Repository tests cover data logic |
| **Security** | React XSS protection + prepared statements | Standard best practices |

---

## 10. Open Questions & Future Considerations

### 10.1 Resolved for Phase 2
- ✅ How to structure API routes? → Follow Phase 1 patterns
- ✅ How to pass data from Astro to React? → Props via frontmatter
- ✅ Which client directive to use? → `client:load` for Board
- ✅ How to handle responsive layout? → Tailwind breakpoints
- ✅ Which colors for labels? → Tailwind defaults

### 10.2 Deferred to Phase 3+
- ❓ Client-side state management library? (React Context, Zustand, or simple useState?)
- ❓ Form validation library? (Zod, React Hook Form, or plain validation?)
- ❓ Modal/dialog component? (Headless UI, Radix, or custom?)
- ❓ Drag-and-drop library? (React DnD, dnd-kit, or native HTML5?)
- ❓ Optimistic updates for better UX?

---

## 11. Implementation Checklist

Based on this research, the implementation plan should include:

### API Layer
- [ ] Column endpoints: index, [id], [id]/position
- [ ] Card endpoints: index, [id], [id]/position, [id]/move
- [ ] Input validation for all new endpoints
- [ ] Consistent error handling and status codes

### UI Layer
- [ ] Homepage: board list with create form
- [ ] Board detail page: display board name and pass data to React
- [ ] Board component: render columns horizontally
- [ ] Column component: render column header and cards
- [ ] Card component: render card with title, description, color
- [ ] Card color utility function

### Styling
- [ ] Horizontal scrolling layout for desktop
- [ ] Responsive vertical layout for mobile
- [ ] Card color labels (left border)
- [ ] Empty states for boards, columns, cards
- [ ] Typography hierarchy

### Testing & Verification
- [ ] Manual API testing with browser/curl
- [ ] Visual testing in Brave/Chrome/Firefox
- [ ] Responsive testing (desktop and mobile sizes)
- [ ] Build succeeds with no TypeScript errors
- [ ] No console errors or warnings

---

## 12. Resources & References

### Official Documentation
- **Astro:** https://docs.astro.build/
  - Server-side rendering: https://docs.astro.build/en/guides/server-side-rendering/
  - React integration: https://docs.astro.build/en/guides/integrations-guide/react/
  - API routes: https://docs.astro.build/en/core-concepts/endpoints/
- **Tailwind CSS:** https://tailwindcss.com/docs
  - Flexbox: https://tailwindcss.com/docs/flex
  - Responsive design: https://tailwindcss.com/docs/responsive-design
- **React:** https://react.dev/
  - TypeScript: https://react.dev/learn/typescript

### Community Resources
- Kanban board layout patterns (CSS-Tricks, Tailwind UI examples)
- Astro + React islands examples (Astro blog, community showcases)

---

## Conclusion

All technical decisions for Phase 2 have been researched and documented. The path forward is clear:

1. **Complete API layer** using established patterns from Phase 1
2. **Build Astro pages** with server-side data fetching
3. **Create React components** for display-only UI
4. **Style with Tailwind** using responsive kanban layout patterns
5. **Manual testing** to verify everything works

No new dependencies needed. All required packages are already installed:
- ✅ Astro 5 with Node adapter
- ✅ React 18
- ✅ Tailwind CSS
- ✅ better-sqlite3
- ✅ TypeScript
- ✅ Vitest

**Ready to proceed with implementation planning.**
