# Phase 3 — Interactive CRUD UI

## Objective
Transform the read-only display from Phase 2 into a fully interactive application. Users should be able to create, edit, and delete boards, columns, and cards through intuitive UI controls. This phase unlocks the core user experience, making the app usable for real-world task management.

## Current State
After Phase 2, we have:
- ✅ Complete API layer (13 endpoints for boards, columns, cards)
- ✅ Display-only UI showing boards, columns, and cards
- ✅ Responsive kanban layout with proper styling
- ❌ **No way to create, edit, or delete anything through the UI**

## Scope

### 1. Board Management UI

#### Create Board Form (Homepage)
- Add "New Board" button at top of homepage
- Modal or inline form with:
  - Board name input (required)
  - Cancel and Create buttons
  - Client-side validation
- Form submission calls `POST /api/boards`
- Optimistic UI update or page refresh on success
- Error handling with user-friendly messages

#### Edit Board Name (Board Detail Page)
- Make board title clickable/editable
- Inline editing pattern:
  - Click title to enter edit mode
  - Show input field with current name
  - Save on Enter or blur
  - Cancel on Escape
- Calls `PUT /api/boards/[id]`
- Update UI optimistically

#### Delete Board (Board Detail Page)
- Add delete button (icon or text) near board title
- Confirmation dialog before deletion
- Calls `DELETE /api/boards/[id]`
- Redirect to homepage on success
- Prevent accidental deletion with clear warning

### 2. Column Management UI

#### Add Column (Board Detail Page)
- "Add Column" button at right edge of column container
- Modal or inline form with:
  - Column name input (required)
  - Position auto-calculated (append to end)
- Form submission calls `POST /api/columns`
- New column appears immediately on success

#### Edit Column Name
- Click column header to enter edit mode
- Inline editing (same pattern as board title)
- Calls `PUT /api/columns/[id]`
- Update UI optimistically

#### Delete Column
- Delete button (icon) in column header
- Confirmation dialog warns about cascading card deletion
- Calls `DELETE /api/columns/[id]`
- Column and all cards removed from UI

#### Reorder Columns (Simple Version)
- **Option A:** Up/Down arrow buttons in column header
- **Option B:** Defer to Phase 4 (drag-and-drop)
- Calls `PUT /api/columns/[id]/position`
- Visual feedback during reorder

**Decision:** Use arrow buttons for Phase 3, upgrade to drag-and-drop in Phase 4.

### 3. Card Management UI

#### Add Card (Inside Column)
- "Add Card" button at bottom of each column
- Modal with form fields:
  - Title (required)
  - Description (textarea, optional)
  - Color picker (predefined palette)
  - Position auto-calculated (append to end)
- Form submission calls `POST /api/cards`
- New card appears in column immediately

#### Edit Card
- Click card to open edit modal
- Modal with form fields (same as create):
  - Title (editable)
  - Description (editable)
  - Color picker (changeable)
  - Save and Cancel buttons
- Calls `PUT /api/cards/[id]`
- Card updates in place

#### Delete Card
- Delete button (icon) on card or in edit modal
- Confirmation dialog (less critical than board/column)
- Calls `DELETE /api/cards/[id]`
- Card removed from UI

#### Reorder Cards (Simple Version)
- **Option A:** Up/Down arrow buttons on each card
- **Option B:** Defer to Phase 4 (drag-and-drop)
- Calls `PUT /api/cards/[id]/position`

**Decision:** Use arrow buttons for Phase 3, upgrade to drag-and-drop in Phase 4.

#### Move Card Between Columns (Simple Version)
- **Option A:** Dropdown/select in edit modal to choose column
- **Option B:** Defer entirely to Phase 4 (drag-and-drop)
- Calls `PUT /api/cards/[id]/move`

**Decision:** Defer to Phase 4. Focus on create/edit/delete first.

### 4. Client-Side State Management

#### React State Architecture
- Lift state to Board component for shared data
- State includes:
  - Board data (name, columns)
  - Column data (name, cards)
  - Card data (title, description, color)
  - UI state (modals open/closed, editing mode)
- Pass state and update functions down to child components

#### State Update Patterns
- **Optimistic updates:** Update UI immediately, rollback on error
- **API error handling:** Display toast/alert messages
- **Loading states:** Disable buttons during API calls
- **Form validation:** Client-side checks before API submission

#### Optional: Context API
- If prop drilling becomes unwieldy, use React Context
- Context for board-level data and actions
- Keep it simple (avoid over-engineering)

### 5. UI Components & Patterns

#### Modal Component
- Reusable modal for forms (create card, edit card)
- Props: `isOpen`, `onClose`, `title`, `children`
- Close on Escape key or backdrop click
- Focus management for accessibility
- Consider using Radix UI or Headless UI for accessibility

#### Confirmation Dialog
- Reusable confirmation dialog for destructive actions
- Props: `isOpen`, `onClose`, `onConfirm`, `message`, `danger`
- "Cancel" and "Confirm" buttons
- Red/destructive styling for delete actions

#### Button Component
- Consistent button styling across app
- Variants: primary, secondary, danger, icon-only
- Loading state (spinner + disabled)
- Proper hover and focus states

#### Form Input Components
- Text input with validation styling
- Textarea for descriptions
- Color picker (grid of color squares)
- Error message display
- Label and required indicators

#### Toast/Notification System (Optional)
- Non-blocking feedback for actions
- Success: "Board created", "Card updated"
- Error: "Failed to delete column"
- Auto-dismiss after 3-5 seconds
- Position: top-right or bottom-center

**Decision:** Start with simple alert messages, upgrade to toast system if time permits.

### 6. Inline Editing Pattern

#### Visual States
- **View mode:** Title/name displayed as text (with subtle edit hint)
- **Edit mode:** Input field replaces text, focused automatically
- **Loading state:** Disabled input with spinner during save
- **Error state:** Red border with error message

#### Keyboard Shortcuts
- Enter to save
- Escape to cancel
- Tab to cycle through editable fields (future enhancement)

#### UX Considerations
- Auto-focus input when entering edit mode
- Select all text for easy replacement
- Visual feedback on hover (underline or pencil icon)
- Clear distinction between view and edit modes

### 7. Color Picker UI

#### Design
- Grid of color squares (2x3 or 3x2)
- Colors: red, blue, green, yellow, purple, gray
- Selected color has border/checkmark indicator
- Large enough click targets (40x40px minimum)

#### Implementation
- Radio button group styled as color grid
- Update card immediately on selection
- Works in both create and edit modals
- Matches color system from `src/utils/cardColors.ts`

## Acceptance Criteria

### Board Management
- [ ] "New Board" button opens form on homepage
- [ ] Board creation form validates required fields
- [ ] New board appears in list after creation
- [ ] Board title is editable inline on board detail page
- [ ] Board name updates save successfully
- [ ] Delete board button shows confirmation dialog
- [ ] Deleting board redirects to homepage

### Column Management
- [ ] "Add Column" button creates new column at end
- [ ] Column creation form validates name
- [ ] New column appears immediately in board
- [ ] Column header name is editable inline
- [ ] Column name updates save successfully
- [ ] Delete column button shows warning about cascading deletion
- [ ] Deleting column removes it and all cards
- [ ] Up/down arrows reorder columns correctly

### Card Management
- [ ] "Add Card" button opens modal with form
- [ ] Card creation form validates title (required)
- [ ] Description field supports multi-line text
- [ ] Color picker displays all 6 colors correctly
- [ ] New card appears in column after creation
- [ ] Clicking card opens edit modal
- [ ] Card updates (title, description, color) save successfully
- [ ] Delete card button removes card from column
- [ ] Up/down arrows reorder cards within column

### UI/UX Quality
- [ ] All modals close on Escape key and backdrop click
- [ ] Confirmation dialogs prevent accidental deletions
- [ ] Forms have clear Cancel and Submit buttons
- [ ] Loading states disable buttons during API calls
- [ ] Error messages display for failed operations
- [ ] Success feedback for completed operations (subtle, non-blocking)
- [ ] All interactive elements have proper hover states
- [ ] Keyboard navigation works (Enter to submit, Escape to cancel)

### State Management
- [ ] Board component manages state for all child components
- [ ] Optimistic updates work correctly (UI updates before API response)
- [ ] Errors rollback optimistic updates
- [ ] Page refreshes load current data correctly
- [ ] No stale data issues after CRUD operations

### Styling & Responsiveness
- [ ] All new UI elements match existing Tailwind design
- [ ] Modals are centered and responsive on mobile
- [ ] Forms are easy to use on touch devices
- [ ] Color picker works well on mobile (large touch targets)
- [ ] Buttons and icons are appropriately sized

### Build & Development
- [ ] `npm run dev` works without errors
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No console errors or warnings in browser
- [ ] No hydration mismatches

### Manual Testing
- [ ] Can create, edit, and delete boards
- [ ] Can create, edit, reorder, and delete columns
- [ ] Can create, edit, reorder, and delete cards
- [ ] All confirmations prevent accidental data loss
- [ ] All data persists across page refreshes
- [ ] Error handling works for network failures

## Out of Scope

### Deferred to Phase 4
- Drag-and-drop for cards (moving between columns)
- Drag-and-drop for columns (reordering)
- Drag-and-drop for cards within column (reordering)
- Touch-based drag gestures
- Visual drag feedback and animations

### Not in MVP
- Keyboard shortcuts (j/k navigation, n for new)
- Search/filter functionality
- Bulk operations (multi-select)
- Undo/redo functionality
- Export/import boards
- Card labels/tags (beyond colors)
- Due dates and assignments
- File attachments
- User authentication

## Technical Notes

### Component Architecture
```
Board (React island, client:load)
├── State Management (all CRUD operations)
├── Modal Management (open/close state)
├── "Add Column" Button → ColumnCreateForm Modal
├── Column (multiple)
│   ├── Inline Edit for name
│   ├── Delete Button → Confirmation Dialog
│   ├── Up/Down Arrows → Position Update
│   ├── "Add Card" Button → CardCreateModal
│   └── Card (multiple)
│       ├── Click → CardEditModal
│       ├── Up/Down Arrows → Position Update
│       └── Delete Button → Confirmation Dialog
└── Shared Modals (create/edit card, confirmations)
```

### API Integration
- All API calls use `fetch()` with proper error handling
- Response format: `{ data: {...} }` or `{ error: "..." }`
- Status codes: 200/201 success, 400 validation error, 404 not found, 500 server error
- Content-Type: `application/json` for both requests and responses

### Form Validation
- Client-side validation before API calls
- Required fields: board name, column name, card title
- Optional fields: card description
- Color validation: must be one of 6 predefined colors
- Error messages displayed inline with fields

### Optimistic Updates Pattern
```typescript
// 1. Update UI immediately
setColumns([...columns, newColumn]);

// 2. Call API
const response = await fetch('/api/columns', { ... });

// 3. If error, rollback UI
if (!response.ok) {
  setColumns(originalColumns);
  showError("Failed to create column");
}
```

### Modal Management
- Use React state for modal open/closed
- One modal instance per type (create card, edit card, confirm delete)
- Pass data to modal via props
- Close modal on successful operation or cancel

## Success Metrics

Phase 3 is complete when:
1. All acceptance criteria are met
2. User can perform all CRUD operations without touching the API directly
3. Application is usable for real task management
4. No console errors or TypeScript warnings
5. Build succeeds cleanly
6. All data persists correctly across page refreshes

## Next Phase Preview

**Phase 4: Drag & Drop** (Final phase for MVP)
- Replace up/down arrows with drag-and-drop
- Move cards between columns by dragging
- Reorder columns by dragging
- Touch support for mobile devices
- Visual feedback during drag (ghost card, drop zones)
- Smooth animations

After Phase 4 → **MVP COMPLETE!** 🎉

## Estimated Complexity

**Phase 3 is the most complex phase** due to:
- State management across multiple components
- Multiple modal/dialog implementations
- Form handling and validation
- Inline editing patterns
- Optimistic updates and error handling

However, all API endpoints are already built and tested, so the focus is purely on the UI/UX layer.

**Expected file count:**
- ~8-12 new React components (modals, forms, buttons)
- ~2-3 modified components (Board, Column, Card)
- ~1-2 new utility files (API helpers, form validation)

**Total:** ~12-15 files created/modified
