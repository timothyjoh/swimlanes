# Phase 3 Implementation Plan — Interactive CRUD UI

**Date:** 2026-02-15
**Phase:** 3 — Interactive UI & CRUD Operations
**Status:** 📋 READY TO IMPLEMENT

---

## Executive Summary

Phase 3 transforms the read-only kanban board into a fully interactive application. Users will be able to create, edit, and delete boards, columns, and cards through intuitive UI controls. This phase completes approximately 70% of the MVP, leaving only drag-and-drop for Phase 4.

**Key Implementation Strategy:**
1. Install Headless UI for accessible modals
2. Build reusable UI components (Modal, Button, ConfirmDialog, etc.)
3. Add state management to Board component
4. Implement CRUD operations for boards, columns, and cards
5. Add inline editing for titles/names
6. Test thoroughly across devices and browsers

---

## Phase Dependencies

### Prerequisites (Already Complete)
- ✅ Phase 1: Database schema and repositories
- ✅ Phase 2: API endpoints and display-only UI
- ✅ All API endpoints tested and working
- ✅ Board, Column, and Card components exist

### New Dependencies to Install
```bash
npm install @headlessui/react
```

**Why Headless UI?**
- Accessible modals and dialogs out of the box
- Built by Tailwind Labs (perfect integration)
- Handles focus management, keyboard navigation, ARIA attributes
- Lightweight (~30KB)

---

## Implementation Order

### Stage 1: Foundation (Reusable UI Components)
**Goal:** Build the building blocks for all interactive features.

#### 1.1 Install Dependencies
**File:** `package.json`
**Action:** Install Headless UI
```bash
npm install @headlessui/react
```

**Verify installation:**
```bash
npm run build
```

---

#### 1.2 Create API Utility Helper
**File:** `src/utils/api.ts` (NEW)
**Purpose:** Centralized fetch wrapper with type safety and error handling

**Implementation:**
```typescript
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    const json = await response.json();

    if (!response.ok) {
      return { success: false, error: json.error || 'Request failed' };
    }

    return { success: true, data: json.data };

  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' };
  }
}
```

**Benefits:**
- Type-safe API calls throughout the app
- Consistent error handling
- Reduces boilerplate in components
- Easy to add auth headers later

**Tests:** Manual testing (no unit tests for Phase 3)

---

#### 1.3 Create Button Component
**File:** `src/components/Button.tsx` (NEW)
**Purpose:** Consistent button styling with variants

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `disabled`: boolean
- `loading`: boolean (shows spinner)
- `onClick`: handler
- `type`: 'button' | 'submit'
- `className`: additional styles
- `children`: button content

**Variants:**
- **Primary:** Blue background, white text (main actions)
- **Secondary:** Gray background, dark text (cancel actions)
- **Danger:** Red background, white text (delete actions)
- **Ghost:** Transparent with hover effect (icon buttons)

**Usage Example:**
```tsx
<Button variant="primary" onClick={handleSave}>Save</Button>
<Button variant="danger" onClick={handleDelete}>Delete</Button>
```

---

#### 1.4 Create Modal Component
**File:** `src/components/Modal.tsx` (NEW)
**Purpose:** Reusable modal wrapper using Headless UI Dialog

**Props:**
- `isOpen`: boolean
- `onClose`: () => void
- `title`: string
- `children`: React.ReactNode
- `maxWidth?`: 'sm' | 'md' | 'lg' (default: 'md')

**Features:**
- Backdrop overlay (dark with opacity)
- Centered modal panel
- Close on Escape key (handled by Headless UI)
- Close on backdrop click (handled by Headless UI)
- Focus trap (handled by Headless UI)
- Title with bottom border
- Responsive sizing

**Usage Example:**
```tsx
<Modal isOpen={isOpen} onClose={handleClose} title="Create Card">
  <form>...</form>
</Modal>
```

---

#### 1.5 Create ConfirmDialog Component
**File:** `src/components/ConfirmDialog.tsx` (NEW)
**Purpose:** Confirmation dialog for destructive actions using Headless UI

**Props:**
- `isOpen`: boolean
- `onClose`: () => void
- `onConfirm`: () => void | Promise<void>
- `title`: string
- `message`: string
- `confirmText?`: string (default: "Confirm")
- `cancelText?`: string (default: "Cancel")
- `danger?`: boolean (default: false, shows red button)

**Features:**
- Warning icon for danger actions
- Clear Cancel and Confirm buttons
- Danger variant has red confirm button
- Loading state on confirm button during async operations
- Keyboard support (Enter to confirm, Escape to cancel)

**Usage Example:**
```tsx
<ConfirmDialog
  isOpen={showDeleteConfirm}
  onClose={() => setShowDeleteConfirm(false)}
  onConfirm={handleDeleteBoard}
  title="Delete Board"
  message="Are you sure you want to delete this board? All columns and cards will be permanently deleted."
  confirmText="Delete Board"
  danger={true}
/>
```

---

#### 1.6 Create FormInput Component
**File:** `src/components/FormInput.tsx` (NEW)
**Purpose:** Reusable input field with validation display

**Props:**
- `label`: string
- `value`: string
- `onChange`: (value: string) => void
- `placeholder?`: string
- `required?`: boolean
- `error?`: string
- `autoFocus?`: boolean
- `type?`: 'text' | 'textarea'
- `rows?`: number (for textarea)

**Features:**
- Label with required indicator (*)
- Input/textarea styling consistent with design
- Error message display (red text below input)
- Red border when error exists
- Auto-focus support

**Usage Example:**
```tsx
<FormInput
  label="Board Name"
  value={boardName}
  onChange={setBoardName}
  required={true}
  error={nameError}
  placeholder="Enter board name"
/>
```

---

#### 1.7 Create ColorPicker Component
**File:** `src/components/ColorPicker.tsx` (NEW)
**Purpose:** Grid of color buttons for card color selection

**Props:**
- `selectedColor`: CardColor ('red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray')
- `onChange`: (color: CardColor) => void

**Features:**
- 3x2 grid layout
- Large touch targets (64x64px buttons)
- Selected color has thick border and scale effect
- Hover effect on all colors
- Uses existing `getColorForLabel()` utility from Phase 2
- Checkmark icon on selected color
- ARIA labels for accessibility

**Colors (from Phase 2):**
- Red, Blue, Green, Yellow, Purple, Gray

**Usage Example:**
```tsx
<ColorPicker
  selectedColor={cardColor}
  onChange={setCardColor}
/>
```

---

#### 1.8 Create EditableText Component
**File:** `src/components/EditableText.tsx` (NEW)
**Purpose:** Inline editing for board/column names

**Props:**
- `value`: string
- `onSave`: (newValue: string) => Promise<void>
- `placeholder?`: string
- `className?`: string (for styling the display text)
- `inputClassName?`: string (for styling the input field)

**States:**
- **View mode:** Display text with hover indicator (subtle underline)
- **Edit mode:** Input field with current value selected
- **Loading mode:** Disabled input with spinner during save
- **Error mode:** Red border with error message

**Keyboard shortcuts:**
- Click to enter edit mode
- Enter to save
- Escape to cancel
- Blur (click outside) to save

**Features:**
- Auto-focus input when entering edit mode
- Select all text for easy replacement
- Validation (non-empty string)
- Optimistic update with rollback on error

**Usage Example:**
```tsx
<EditableText
  value={boardName}
  onSave={handleUpdateBoardName}
  className="text-2xl font-bold"
/>
```

---

### Stage 2: Board Management UI

#### 2.1 Add "New Board" Button to Homepage
**File:** `src/pages/index.astro` (MODIFY)
**Changes:**
1. Add "New Board" button at top of page (before board grid)
2. Add state for create modal open/closed
3. Add CreateBoardModal component
4. Handle form submission to POST /api/boards
5. Optimistic update: add new board to list immediately
6. Redirect to new board page on success

**UI Layout:**
```
+------------------------------------------+
| SwimLanes                                |
| [+ New Board]                            |
|                                          |
| [Board 1]  [Board 2]  [Board 3]         |
+------------------------------------------+
```

**Implementation Notes:**
- Convert page to use a React island for interactivity
- Or keep Astro-only and use a form with server-side redirect
- **Decision:** Use React island for consistency with Board component

**New Component:** `src/components/BoardList.tsx` (NEW)
- Replace Astro's board grid with React island
- State management for boards
- Create board modal
- Optimistic updates

---

#### 2.2 Add Edit Board Name Feature
**File:** `src/pages/boards/[id].astro` (MODIFY)
**Changes:**
1. Convert board title to use EditableText component
2. Handle PUT /api/boards/[id] when saving
3. Update board name in state optimistically

**Before:**
```astro
<h1 class="text-3xl font-bold">{board.name}</h1>
```

**After:**
```tsx
<EditableText
  value={board.name}
  onSave={handleUpdateBoardName}
  className="text-3xl font-bold cursor-pointer hover:underline"
/>
```

---

#### 2.3 Add Delete Board Button
**File:** `src/components/Board.tsx` (MODIFY)
**Changes:**
1. Add delete button near board title (trash icon)
2. Show ConfirmDialog when clicked
3. Handle DELETE /api/boards/[id]
4. Redirect to homepage on success

**UI Layout:**
```
+------------------------------------------+
| < Back to Boards          [Board Name] [🗑️]
+------------------------------------------+
```

**Warning message:**
"Are you sure you want to delete this board? All columns and cards will be permanently deleted. This action cannot be undone."

---

### Stage 3: Column Management UI

#### 3.1 Add "Add Column" Button
**File:** `src/components/Board.tsx` (MODIFY)
**Changes:**
1. Add "+ Add Column" button at right edge of column container
2. Click opens inline form or modal (choose inline for simplicity)
3. Form has single input for column name + Cancel/Create buttons
4. Handle POST /api/columns with boardId
5. New column appears at end immediately (optimistic update)

**UI Layout:**
```
+------------------------------------------------------------+
| [Column 1]  [Column 2]  [Column 3]  [+ Add Column]       |
+------------------------------------------------------------+
```

**Implementation:**
- State for "adding column" mode (boolean)
- When true, show input field + buttons instead of "+ Add Column" button
- Auto-focus input when entering add mode
- Position calculated automatically (append to end)

---

#### 3.2 Add Edit Column Name Feature
**File:** `src/components/Column.tsx` (MODIFY)
**Changes:**
1. Replace column header text with EditableText component
2. Handle PUT /api/columns/[id] when saving
3. Update column name in Board state

**Before:**
```tsx
<h2 className="text-lg font-semibold">{column.name}</h2>
```

**After:**
```tsx
<EditableText
  value={column.name}
  onSave={handleUpdateColumnName}
  className="text-lg font-semibold"
/>
```

---

#### 3.3 Add Delete Column Button
**File:** `src/components/Column.tsx` (MODIFY)
**Changes:**
1. Add delete button in column header (trash icon, small)
2. Show ConfirmDialog with cascade warning
3. Handle DELETE /api/columns/[id]
4. Remove column from Board state on success

**UI Layout:**
```
+-------------------------+
| Column Name    [↑] [↓] [🗑️]
| (3 cards)              |
+-------------------------+
```

**Warning message:**
"Delete column '[Name]'? All cards in this column will be permanently deleted."

---

#### 3.4 Add Column Reordering Buttons
**File:** `src/components/Column.tsx` (MODIFY)
**Changes:**
1. Add up/down arrow buttons in column header
2. Disable up arrow for first column
3. Disable down arrow for last column
4. Handle PUT /api/columns/[id]/position
5. Swap column positions in state optimistically

**UI Layout:**
```
+-------------------------+
| Column Name    [↑] [↓] [🗑️]
| (3 cards)              |
+-------------------------+
```

**Logic:**
- Up arrow: move column left (decrease position)
- Down arrow: move column right (increase position)
- API handles position recalculation

---

### Stage 4: Card Management UI

#### 4.1 Add "Add Card" Button to Columns
**File:** `src/components/Column.tsx` (MODIFY)
**Changes:**
1. Add "+ Add Card" button at bottom of card list
2. Click opens CreateCardModal
3. Modal has form with: title (required), description (optional), color picker
4. Handle POST /api/cards with columnId
5. New card appears at bottom of column immediately

**UI Layout:**
```
+-------------------------+
| Column Name            |
| [Card 1]               |
| [Card 2]               |
| [+ Add Card]           |
+-------------------------+
```

**New Component:** `src/components/CreateCardModal.tsx` (NEW)
- Form fields: title, description (textarea), color picker
- Validation: title required
- Cancel and Create buttons
- Default color: gray

---

#### 4.2 Add Edit Card Modal
**File:** `src/components/Card.tsx` (MODIFY)
**Changes:**
1. Make entire card clickable (cursor-pointer)
2. Click opens EditCardModal
3. Modal shows same form as CreateCardModal, pre-filled
4. Handle PUT /api/cards/[id]
5. Update card in state optimistically

**New Component:** `src/components/EditCardModal.tsx` (NEW)
- Form fields: title, description, color picker
- Pre-filled with current card data
- Save and Cancel buttons
- Optional: Add delete button here instead of on card

---

#### 4.3 Add Delete Card Button
**File:** `src/components/Card.tsx` OR `EditCardModal.tsx` (MODIFY)
**Changes:**
1. **Option A:** Add small delete icon on card (shows on hover)
2. **Option B:** Add delete button in EditCardModal
3. **Recommendation:** Option B (less visual clutter)
4. Show ConfirmDialog (simpler message than board/column)
5. Handle DELETE /api/cards/[id]
6. Remove card from state

**Warning message:**
"Delete this card? This action cannot be undone."

---

#### 4.4 Add Card Reordering Buttons
**File:** `src/components/Card.tsx` (MODIFY)
**Changes:**
1. Add up/down arrow buttons on right side of card
2. Show on hover or always visible (choose based on design)
3. Disable up arrow for first card in column
4. Disable down arrow for last card in column
5. Handle PUT /api/cards/[id]/position
6. Swap card positions in state optimistically

**UI Layout:**
```
+-------------------------+
| Card Title       [↑] [↓]|
| Description...         |
| [color bar]            |
+-------------------------+
```

**Note:** This is temporary for Phase 3. Phase 4 will replace with drag-and-drop.

---

### Stage 5: State Management in Board Component

#### 5.1 Update Board Component State Architecture
**File:** `src/components/Board.tsx` (MAJOR REFACTOR)
**Current:** Receives static props, no interactivity
**New:** Manages all board state and CRUD operations

**State Structure:**
```typescript
const Board = ({ initialBoard }: { initialBoard: BoardWithColumns }) => {
  // Core data state
  const [board, setBoard] = useState(initialBoard);
  const [columns, setColumns] = useState(initialBoard.columns);

  // UI state
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [createCardModal, setCreateCardModal] = useState<{
    isOpen: boolean;
    columnId: number | null;
  }>({ isOpen: false, columnId: null });
  const [editCardModal, setEditCardModal] = useState<{
    isOpen: boolean;
    card: Card | null;
  }>({ isOpen: false, card: null });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'board' | 'column' | 'card';
    id: number;
    name: string;
  } | null>(null);

  // CRUD handlers (see below)
};
```

---

#### 5.2 Implement Board CRUD Handlers
**File:** `src/components/Board.tsx` (ADD FUNCTIONS)

**Update Board Name:**
```typescript
const handleUpdateBoardName = async (newName: string) => {
  const previousName = board.name;
  setBoard({ ...board, name: newName }); // Optimistic

  const result = await apiCall(`/api/boards/${board.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName })
  });

  if (!result.success) {
    setBoard({ ...board, name: previousName }); // Rollback
    alert(`Failed to update board name: ${result.error}`);
  }
};
```

**Delete Board:**
```typescript
const handleDeleteBoard = async () => {
  const result = await apiCall(`/api/boards/${board.id}`, {
    method: 'DELETE'
  });

  if (result.success) {
    window.location.href = '/'; // Redirect to homepage
  } else {
    alert(`Failed to delete board: ${result.error}`);
  }
};
```

---

#### 5.3 Implement Column CRUD Handlers
**File:** `src/components/Board.tsx` (ADD FUNCTIONS)

**Create Column:**
```typescript
const handleCreateColumn = async () => {
  if (!newColumnName.trim()) return;

  const tempId = Date.now();
  const tempColumn = {
    id: tempId,
    boardId: board.id,
    name: newColumnName,
    position: columns.length,
    cards: []
  };

  const previousColumns = [...columns];
  setColumns([...previousColumns, tempColumn]); // Optimistic
  setNewColumnName('');
  setIsAddingColumn(false);

  const result = await apiCall('/api/columns', {
    method: 'POST',
    body: JSON.stringify({
      boardId: board.id,
      name: newColumnName,
      position: columns.length
    })
  });

  if (result.success) {
    // Replace temp column with real column
    setColumns(prev => prev.map(c => c.id === tempId ? result.data : c));
  } else {
    setColumns(previousColumns); // Rollback
    alert(`Failed to create column: ${result.error}`);
  }
};
```

**Update Column Name:**
```typescript
const handleUpdateColumnName = async (columnId: number, newName: string) => {
  const previousColumns = [...columns];
  setColumns(prev => prev.map(c =>
    c.id === columnId ? { ...c, name: newName } : c
  )); // Optimistic

  const result = await apiCall(`/api/columns/${columnId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: newName })
  });

  if (!result.success) {
    setColumns(previousColumns); // Rollback
    alert(`Failed to update column name: ${result.error}`);
  }
};
```

**Delete Column:**
```typescript
const handleDeleteColumn = async (columnId: number) => {
  const previousColumns = [...columns];
  setColumns(prev => prev.filter(c => c.id !== columnId)); // Optimistic

  const result = await apiCall(`/api/columns/${columnId}`, {
    method: 'DELETE'
  });

  if (!result.success) {
    setColumns(previousColumns); // Rollback
    alert(`Failed to delete column: ${result.error}`);
  }
};
```

**Reorder Column:**
```typescript
const handleMoveColumn = async (columnId: number, direction: 'up' | 'down') => {
  const columnIndex = columns.findIndex(c => c.id === columnId);
  if (columnIndex === -1) return;

  const newIndex = direction === 'up' ? columnIndex - 1 : columnIndex + 1;
  if (newIndex < 0 || newIndex >= columns.length) return;

  const previousColumns = [...columns];
  const reordered = [...columns];
  [reordered[columnIndex], reordered[newIndex]] = [reordered[newIndex], reordered[columnIndex]];
  setColumns(reordered); // Optimistic

  const result = await apiCall(`/api/columns/${columnId}/position`, {
    method: 'PUT',
    body: JSON.stringify({ position: newIndex })
  });

  if (!result.success) {
    setColumns(previousColumns); // Rollback
    alert(`Failed to reorder column: ${result.error}`);
  }
};
```

---

#### 5.4 Implement Card CRUD Handlers
**File:** `src/components/Board.tsx` (ADD FUNCTIONS)

**Create Card:**
```typescript
const handleCreateCard = async (columnId: number, cardData: {
  title: string;
  description: string;
  color: string;
}) => {
  const column = columns.find(c => c.id === columnId);
  if (!column) return;

  const tempId = Date.now();
  const tempCard = {
    id: tempId,
    columnId,
    position: column.cards.length,
    ...cardData
  };

  const previousColumns = [...columns];
  setColumns(prev => prev.map(c =>
    c.id === columnId
      ? { ...c, cards: [...c.cards, tempCard] }
      : c
  )); // Optimistic

  const result = await apiCall('/api/cards', {
    method: 'POST',
    body: JSON.stringify({
      columnId,
      position: column.cards.length,
      ...cardData
    })
  });

  if (result.success) {
    // Replace temp card with real card
    setColumns(prev => prev.map(c =>
      c.id === columnId
        ? { ...c, cards: c.cards.map(card => card.id === tempId ? result.data : card) }
        : c
    ));
  } else {
    setColumns(previousColumns); // Rollback
    alert(`Failed to create card: ${result.error}`);
  }

  setCreateCardModal({ isOpen: false, columnId: null });
};
```

**Update Card:**
```typescript
const handleUpdateCard = async (cardId: number, updates: {
  title?: string;
  description?: string;
  color?: string;
}) => {
  const previousColumns = [...columns];
  setColumns(prev => prev.map(c => ({
    ...c,
    cards: c.cards.map(card =>
      card.id === cardId ? { ...card, ...updates } : card
    )
  }))); // Optimistic

  const result = await apiCall(`/api/cards/${cardId}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });

  if (!result.success) {
    setColumns(previousColumns); // Rollback
    alert(`Failed to update card: ${result.error}`);
  }

  setEditCardModal({ isOpen: false, card: null });
};
```

**Delete Card:**
```typescript
const handleDeleteCard = async (cardId: number) => {
  const previousColumns = [...columns];
  setColumns(prev => prev.map(c => ({
    ...c,
    cards: c.cards.filter(card => card.id !== cardId)
  }))); // Optimistic

  const result = await apiCall(`/api/cards/${cardId}`, {
    method: 'DELETE'
  });

  if (!result.success) {
    setColumns(previousColumns); // Rollback
    alert(`Failed to delete card: ${result.error}`);
  }

  setDeleteConfirm(null);
};
```

**Reorder Card:**
```typescript
const handleMoveCard = async (columnId: number, cardId: number, direction: 'up' | 'down') => {
  const column = columns.find(c => c.id === columnId);
  if (!column) return;

  const cardIndex = column.cards.findIndex(card => card.id === cardId);
  if (cardIndex === -1) return;

  const newIndex = direction === 'up' ? cardIndex - 1 : cardIndex + 1;
  if (newIndex < 0 || newIndex >= column.cards.length) return;

  const previousColumns = [...columns];
  const updatedCards = [...column.cards];
  [updatedCards[cardIndex], updatedCards[newIndex]] = [updatedCards[newIndex], updatedCards[cardIndex]];

  setColumns(prev => prev.map(c =>
    c.id === columnId ? { ...c, cards: updatedCards } : c
  )); // Optimistic

  const result = await apiCall(`/api/cards/${cardId}/position`, {
    method: 'PUT',
    body: JSON.stringify({ position: newIndex })
  });

  if (!result.success) {
    setColumns(previousColumns); // Rollback
    alert(`Failed to reorder card: ${result.error}`);
  }
};
```

---

### Stage 6: Update Child Components

#### 6.1 Update Column Component
**File:** `src/components/Column.tsx` (MODIFY)
**Changes:**
1. Add EditableText for column name
2. Add up/down/delete buttons in header
3. Add "+ Add Card" button at bottom
4. Pass callbacks from Board component as props

**New Props:**
```typescript
interface ColumnProps {
  column: ColumnWithCards;
  isFirst: boolean;
  isLast: boolean;
  onUpdateName: (columnId: number, name: string) => Promise<void>;
  onDelete: (columnId: number) => void;
  onMove: (columnId: number, direction: 'up' | 'down') => void;
  onAddCard: (columnId: number) => void;
  onEditCard: (card: Card) => void;
  onMoveCard: (columnId: number, cardId: number, direction: 'up' | 'down') => void;
}
```

---

#### 6.2 Update Card Component
**File:** `src/components/Card.tsx` (MODIFY)
**Changes:**
1. Make card clickable (entire card opens edit modal)
2. Add up/down arrow buttons (small, on right side)
3. Optional hover effect to show it's clickable

**New Props:**
```typescript
interface CardProps {
  card: Card;
  columnId: number;
  isFirst: boolean;
  isLast: boolean;
  onClick: (card: Card) => void;
  onMove: (columnId: number, cardId: number, direction: 'up' | 'down') => void;
}
```

---

### Stage 7: Homepage Board Management

#### 7.1 Create BoardList Component
**File:** `src/components/BoardList.tsx` (NEW)
**Purpose:** Replace static Astro board grid with interactive React island

**Features:**
- Display boards in responsive grid (same as current Astro page)
- "New Board" button at top
- CreateBoardModal
- Handle POST /api/boards
- Optimistic update when creating board
- Navigate to new board on success

**Props:**
```typescript
interface BoardListProps {
  initialBoards: Board[];
}
```

**State:**
```typescript
const [boards, setBoards] = useState(initialBoards);
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
```

---

#### 7.2 Create CreateBoardModal Component
**File:** `src/components/CreateBoardModal.tsx` (NEW)
**Purpose:** Modal for creating new boards

**Form Fields:**
- Board name (required)

**Buttons:**
- Cancel (close modal)
- Create (submit form, call API)

**Usage:**
```tsx
<CreateBoardModal
  isOpen={isCreateModalOpen}
  onClose={() => setIsCreateModalOpen(false)}
  onSubmit={handleCreateBoard}
/>
```

---

#### 7.3 Update Homepage to Use BoardList
**File:** `src/pages/index.astro` (MODIFY)
**Changes:**
1. Replace static board grid HTML with BoardList component
2. Pass boards data as props
3. Use `client:load` directive for hydration

**Before:**
```astro
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {boards.map(board => (
    <a href={`/boards/${board.id}`}>...</a>
  ))}
</div>
```

**After:**
```astro
<BoardList initialBoards={boards} client:load />
```

---

## File Inventory

### New Files (13)
1. `src/utils/api.ts` — API utility helper
2. `src/components/Button.tsx` — Reusable button component
3. `src/components/Modal.tsx` — Modal wrapper (Headless UI)
4. `src/components/ConfirmDialog.tsx` — Confirmation dialog
5. `src/components/FormInput.tsx` — Input with validation
6. `src/components/ColorPicker.tsx` — Color selection grid
7. `src/components/EditableText.tsx` — Inline editing component
8. `src/components/CreateCardModal.tsx` — Create card form modal
9. `src/components/EditCardModal.tsx` — Edit card form modal
10. `src/components/BoardList.tsx` — Homepage board grid (React)
11. `src/components/CreateBoardModal.tsx` — Create board form modal
12. `docs/phases/phase-3/PLAN.md` — This document
13. `docs/phases/phase-3/REVIEW.md` — Post-implementation review (future)

### Modified Files (4)
1. `src/components/Board.tsx` — Add state management and CRUD handlers
2. `src/components/Column.tsx` — Add editing, delete, reorder, add card
3. `src/components/Card.tsx` — Add click handler, reorder buttons
4. `src/pages/index.astro` — Use BoardList component instead of static HTML

### Dependencies (1)
1. `package.json` — Add @headlessui/react

**Total:** 18 files created/modified

---

## Testing Strategy

### Manual Testing Checklist

Since we don't have E2E tests, thorough manual testing is critical.

#### Board Management
- [ ] Click "New Board" on homepage → modal opens
- [ ] Create board with valid name → board appears in list
- [ ] Create board with empty name → validation error shown
- [ ] Click board card → navigates to board detail page
- [ ] Click board title on detail page → inline editing activates
- [ ] Edit board name and press Enter → name updates
- [ ] Edit board name and press Escape → editing cancels
- [ ] Click delete board button → confirmation dialog appears
- [ ] Confirm delete → redirects to homepage, board gone
- [ ] Cancel delete → board remains

#### Column Management
- [ ] Click "Add Column" → inline form appears
- [ ] Create column with valid name → column appears at end
- [ ] Create column with empty name → validation error shown
- [ ] Click column name → inline editing activates
- [ ] Edit column name → updates successfully
- [ ] Click up arrow on first column → button is disabled
- [ ] Click down arrow on last column → button is disabled
- [ ] Click up/down arrows → columns reorder correctly
- [ ] Click delete column → confirmation with cascade warning
- [ ] Confirm delete column → column and all cards removed

#### Card Management
- [ ] Click "Add Card" in column → modal opens
- [ ] Create card with title only → card appears in column
- [ ] Create card with title + description → both fields save
- [ ] Create card with empty title → validation error shown
- [ ] Select different colors → color border updates
- [ ] Click card → edit modal opens with current data
- [ ] Edit card title → updates successfully
- [ ] Edit card description → updates successfully
- [ ] Change card color → color updates
- [ ] Click delete in edit modal → confirmation dialog
- [ ] Confirm delete → card removed
- [ ] Click up/down arrows on card → card reorders within column
- [ ] First card has disabled up arrow
- [ ] Last card has disabled down arrow

#### Error Handling
- [ ] Network failure during create → shows error, no item added
- [ ] Network failure during update → shows error, reverts change
- [ ] Network failure during delete → shows error, item remains
- [ ] Invalid API responses handled gracefully

#### UI/UX
- [ ] All modals close on Escape key
- [ ] All modals close on backdrop click
- [ ] All forms have clear Cancel and Submit buttons
- [ ] Loading states show during async operations
- [ ] Error messages are clear and helpful
- [ ] Success feedback visible (or silent success is acceptable)
- [ ] Hover states work on all interactive elements
- [ ] Focus visible on all keyboard navigation

#### Responsive Design
- [ ] Test on mobile viewport (375px width)
  - [ ] Modals are usable
  - [ ] Forms are easy to fill out
  - [ ] Buttons are easy to tap (44x44px minimum)
  - [ ] Color picker works well
  - [ ] Inline editing works on touch
- [ ] Test on tablet (768px width)
- [ ] Test on desktop (1280px+ width)

#### Browser Compatibility
- [ ] Chrome/Brave — all features work
- [ ] Firefox — all features work
- [ ] Safari (if available) — all features work

#### Accessibility
- [ ] All modals trap focus correctly
- [ ] Tab key navigates through interactive elements in logical order
- [ ] Enter key submits forms
- [ ] Escape key cancels/closes modals
- [ ] Icon-only buttons have aria-label attributes
- [ ] Screen reader announces modal titles
- [ ] Sufficient color contrast on all text

#### Data Persistence
- [ ] Create board, refresh page → board still exists
- [ ] Edit card, refresh page → changes persisted
- [ ] Delete column, refresh page → column gone, cards gone
- [ ] All CRUD operations persist across page refreshes

---

## Build & Development Checks

### Pre-Implementation Checks
- [ ] Current code builds successfully (`npm run build`)
- [ ] Current tests pass (`npm test`)
- [ ] Dev server runs without errors (`npm run dev`)

### During Implementation
- [ ] Install Headless UI successfully
- [ ] No TypeScript errors during development
- [ ] HMR (Hot Module Replacement) works
- [ ] No console errors in browser

### Post-Implementation Checks
- [ ] `npm run build` succeeds with no errors
- [ ] `npm test` passes (no new test failures)
- [ ] No TypeScript errors (`tsc --noEmit` if needed)
- [ ] No console errors or warnings in browser
- [ ] No hydration mismatches
- [ ] Build output size reasonable (<500KB for main bundle)

---

## Risk Mitigation

### Risk: State Management Becomes Complex
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Start simple with useState in Board component
- If prop drilling becomes unwieldy, refactor to Context API
- Keep state updates in handler functions, not scattered
- Use functional setState for state that depends on previous state

### Risk: Optimistic Updates Fail
**Likelihood:** Low
**Impact:** Medium
**Mitigation:**
- Always keep snapshot of previous state before update
- Implement proper rollback on API errors
- Show clear error messages to user
- Test error scenarios with network throttling

### Risk: Accessibility Gaps
**Likelihood:** Low
**Impact:** High
**Mitigation:**
- Use Headless UI for modals (accessibility built-in)
- Follow WCAG 2.1 checklist
- Test with keyboard-only navigation
- Use semantic HTML (button, form, dialog)
- Add aria-label to icon-only buttons

### Risk: Mobile Touch UX Issues
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:**
- Ensure all touch targets are minimum 44x44px
- Test on real mobile devices if possible
- Use browser dev tools mobile emulation
- Consider larger buttons on mobile (responsive sizing)

### Risk: Race Conditions (Rapid Updates)
**Likelihood:** Low
**Impact:** Low
**Mitigation:**
- Use functional setState: `setState(prev => ...)`
- Disable buttons during async operations (loading state)
- Consider debouncing inline edit saves (optional)

---

## Success Criteria

Phase 3 is **COMPLETE** when:

### Functional Requirements
- [x] User can create new boards from homepage
- [x] User can edit board names inline
- [x] User can delete boards with confirmation
- [x] User can add columns to boards
- [x] User can edit column names inline
- [x] User can delete columns (with cascade warning)
- [x] User can reorder columns with arrow buttons
- [x] User can create cards in columns
- [x] User can edit card details (title, description, color)
- [x] User can delete cards
- [x] User can reorder cards within columns
- [x] All CRUD operations persist across page refreshes

### Quality Requirements
- [x] No TypeScript errors
- [x] Build succeeds cleanly
- [x] No console errors or warnings
- [x] All interactive elements work on mobile
- [x] Keyboard navigation works (Tab, Enter, Escape)
- [x] Confirmation dialogs prevent accidental deletion
- [x] Error messages display for failed operations
- [x] Optimistic updates work correctly
- [x] Loading states prevent double-submissions

### Code Quality
- [x] Components are reusable and well-structured
- [x] State management is clean and maintainable
- [x] API calls use centralized utility
- [x] Consistent styling with Tailwind
- [x] Proper TypeScript types throughout

---

## Next Phase Preview

**Phase 4: Drag & Drop** (Final phase for MVP completion)

What will be replaced/enhanced:
- Replace column reorder arrows with drag-and-drop
- Replace card reorder arrows with drag-and-drop
- Add card drag between columns (move operation)
- Add touch support for mobile devices
- Add visual feedback during drag (ghost element, drop zones)
- Add smooth animations

Research needed for Phase 4:
- Drag-and-drop library comparison (dnd-kit vs React DnD)
- Touch gesture support
- Animation library (Framer Motion or CSS transitions)
- Drop zone visual feedback

After Phase 4 → **MVP COMPLETE!** 🎉

---

## Implementation Timeline Estimate

Based on component complexity and dependencies:

**Stage 1: Foundation** (~2-3 hours)
- Install dependencies: 5 minutes
- API utility: 15 minutes
- Button component: 20 minutes
- Modal component: 30 minutes
- ConfirmDialog: 30 minutes
- FormInput: 20 minutes
- ColorPicker: 30 minutes
- EditableText: 45 minutes

**Stage 2: Board Management** (~1 hour)
- Homepage create board: 30 minutes
- Edit board name: 15 minutes
- Delete board: 15 minutes

**Stage 3: Column Management** (~1.5 hours)
- Add column: 30 minutes
- Edit column name: 15 minutes
- Delete column: 15 minutes
- Reorder columns: 30 minutes

**Stage 4: Card Management** (~2 hours)
- CreateCardModal: 45 minutes
- EditCardModal: 45 minutes
- Delete card: 15 minutes
- Reorder cards: 30 minutes

**Stage 5: Board State Management** (~2 hours)
- State architecture: 30 minutes
- Board handlers: 20 minutes
- Column handlers: 40 minutes
- Card handlers: 50 minutes

**Stage 6: Child Component Updates** (~1 hour)
- Update Column component: 30 minutes
- Update Card component: 30 minutes

**Stage 7: Homepage Updates** (~1 hour)
- BoardList component: 45 minutes
- Update index.astro: 15 minutes

**Testing & Refinement** (~3-4 hours)
- Manual testing all features: 2 hours
- Bug fixes and polish: 1-2 hours

**Total Estimated Time:** 14-16 hours of focused development

**Note:** This is an estimate. Actual time may vary based on debugging, design decisions, and unexpected issues.

---

## Implementation Order Summary

Follow this sequence for smooth implementation:

1. **Install @headlessui/react**
2. **Build foundation components** (Button, Modal, etc.)
3. **Create API utility helper**
4. **Update Board component** with state management
5. **Implement board management** (create, edit, delete)
6. **Implement column management** (create, edit, delete, reorder)
7. **Implement card management** (create, edit, delete, reorder)
8. **Update child components** (Column, Card) with new props
9. **Update homepage** with BoardList component
10. **Test thoroughly** using checklist above
11. **Fix bugs** and polish UX
12. **Write REVIEW.md** documenting what was built

---

## Key Design Decisions

### 1. State Management: useState (Not Context)
**Rationale:** Component tree is shallow (Board → Column → Card). Prop drilling is minimal. Context adds complexity without clear benefit for this use case.

### 2. Modals: Headless UI (Not Custom)
**Rationale:** Accessibility is critical and complex. Headless UI handles focus trapping, keyboard navigation, and ARIA attributes automatically. Worth the 30KB for peace of mind.

### 3. Reordering: Arrow Buttons (Not Drag-and-Drop Yet)
**Rationale:** Drag-and-drop is Phase 4. Arrow buttons provide functionality now with simpler implementation. Easy to replace later.

### 4. Forms: Controlled Components (Not React Hook Form)
**Rationale:** Forms are simple (1-3 fields). No complex validation. Controlled components are straightforward and sufficient.

### 5. Error Handling: Simple Alerts (Not Toast System)
**Rationale:** Start simple. Browser alerts are functional, if not elegant. Can upgrade to toast notifications later if time permits or in future phase.

### 6. Optimistic Updates: Always
**Rationale:** Makes app feel fast and responsive. Network latency doesn't block UI. Proper error handling ensures data integrity.

### 7. API Utility: Custom (Not React Query)
**Rationale:** React Query is overkill for our needs. Custom utility provides type safety and error handling with zero dependencies.

### 8. Homepage: React Island (Not Pure Astro)
**Rationale:** Consistency with Board component. Easier to manage state for board creation. Still uses SSR for initial data load.

---

## Appendix: Component Prop Signatures

### Button
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  className?: string;
  children: React.ReactNode;
}
```

### Modal
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg';
}
```

### ConfirmDialog
```typescript
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
```

### FormInput
```typescript
interface FormInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  autoFocus?: boolean;
  type?: 'text' | 'textarea';
  rows?: number;
}
```

### ColorPicker
```typescript
interface ColorPickerProps {
  selectedColor: 'red' | 'blue' | 'green' | 'yellow' | 'purple' | 'gray';
  onChange: (color: string) => void;
}
```

### EditableText
```typescript
interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}
```

### Board (Updated)
```typescript
interface BoardProps {
  initialBoard: BoardWithColumns;
}
```

### Column (Updated)
```typescript
interface ColumnProps {
  column: ColumnWithCards;
  isFirst: boolean;
  isLast: boolean;
  onUpdateName: (columnId: number, name: string) => Promise<void>;
  onDelete: (columnId: number) => void;
  onMove: (columnId: number, direction: 'up' | 'down') => void;
  onAddCard: (columnId: number) => void;
  onEditCard: (card: Card) => void;
  onMoveCard: (columnId: number, cardId: number, direction: 'up' | 'down') => void;
}
```

### Card (Updated)
```typescript
interface CardProps {
  card: Card;
  columnId: number;
  isFirst: boolean;
  isLast: boolean;
  onClick: (card: Card) => void;
  onMove: (columnId: number, cardId: number, direction: 'up' | 'down') => void;
}
```

### BoardList
```typescript
interface BoardListProps {
  initialBoards: Board[];
}
```

### CreateCardModal
```typescript
interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnId: number;
  onSubmit: (columnId: number, data: {
    title: string;
    description: string;
    color: string;
  }) => Promise<void>;
}
```

### EditCardModal
```typescript
interface EditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: Card | null;
  onSubmit: (cardId: number, updates: {
    title?: string;
    description?: string;
    color?: string;
  }) => Promise<void>;
  onDelete: (cardId: number) => void;
}
```

### CreateBoardModal
```typescript
interface CreateBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}
```

---

## Final Notes

This plan provides a **comprehensive blueprint** for implementing Phase 3. Follow the stages in order for smooth progress. Each stage builds on the previous one, ensuring dependencies are met.

**Key Principles:**
1. Build reusable components first
2. Add state management to Board component
3. Implement CRUD operations with optimistic updates
4. Test thoroughly at each stage
5. Keep it simple — no premature optimization

**Communication:**
- Commit after each major stage completion
- Use descriptive commit messages
- Final commit: "phase 3: plan" (this document)
- Implementation commit: "phase 3: build"
- Review commit: "phase 3: review"

**Ready to implement Phase 3!** 🚀
