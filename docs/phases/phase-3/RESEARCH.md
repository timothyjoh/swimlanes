# Phase 3 Research — Interactive CRUD UI

**Date:** 2026-02-15
**Phase:** 3 — Interactive UI & CRUD Operations
**Focus:** Component libraries, state management, modal patterns, and form handling

---

## Overview

Phase 3 transforms the read-only display into a fully interactive application. This research covers the technical decisions needed for:
1. Modal/dialog components
2. Client-side state management
3. Form handling and validation
4. Inline editing patterns
5. Optimistic UI updates
6. Component reusability

---

## 1. Modal/Dialog Component Strategy

### Options Considered

#### Option A: Build Custom Modal with Tailwind
**Pros:**
- No additional dependencies
- Full control over styling and behavior
- Lightweight (just a few hundred bytes)
- Matches existing Tailwind aesthetic perfectly
- Easy to customize for specific needs

**Cons:**
- Need to implement accessibility manually
- Focus management requires extra work
- Trap focus, ARIA attributes, etc.
- Testing keyboard navigation takes time

**Implementation Pattern:**
```typescript
// Simple modal with backdrop, Escape key, click-outside
<div className="fixed inset-0 bg-black/50 flex items-center justify-center">
  <div className="bg-white rounded-lg p-6 max-w-md w-full">
    {children}
  </div>
</div>
```

#### Option B: Radix UI Primitives
**Pros:**
- Excellent accessibility out of the box
- Unstyled primitives (bring your own styles)
- Focus management handled automatically
- Small bundle size (tree-shakeable)
- Well-documented and maintained
- Works great with Tailwind

**Cons:**
- Additional dependency (~50KB)
- Learning curve for API
- Might be overkill for simple modals

**Installation:**
```bash
npm install @radix-ui/react-dialog @radix-ui/react-alert-dialog
```

#### Option C: Headless UI
**Pros:**
- Built by Tailwind Labs (seamless integration)
- Excellent accessibility
- Simple API, easy to learn
- Good documentation with Tailwind examples
- Smaller than Radix (~30KB)

**Cons:**
- Additional dependency
- Less flexible than Radix for complex cases

**Installation:**
```bash
npm install @headlessui/react
```

### Recommendation: **Headless UI**

**Rationale:**
- Best balance of simplicity and accessibility
- Built specifically for Tailwind CSS projects
- Provides exactly what we need: Dialog and AlertDialog
- Smaller footprint than Radix
- Excellent documentation with React + Tailwind examples
- Handles all accessibility concerns (focus trap, ARIA, Escape key, etc.)
- Still allows full control over styling

**What we'll use:**
- `Dialog` component for create/edit modals
- `AlertDialog` for confirmation dialogs (destructive actions)

---

## 2. Client-Side State Management

### Options Considered

#### Option A: React useState in Board Component
**Pros:**
- No additional dependencies
- Simple and straightforward
- Sufficient for this app's complexity
- Easy to reason about
- React's built-in solution

**Cons:**
- Prop drilling if component tree gets deep
- No global state sharing between pages
- State resets on page navigation

**Pattern:**
```typescript
const Board = ({ initialBoard }) => {
  const [board, setBoard] = useState(initialBoard);
  const [columns, setColumns] = useState(initialBoard.columns);
  // ... handle CRUD operations
};
```

#### Option B: React Context API
**Pros:**
- No additional dependencies
- Avoids prop drilling
- Built-in React solution
- Can share state across components

**Cons:**
- More boilerplate than useState
- Re-renders can be tricky to optimize
- Overkill for our single-page board view

**Pattern:**
```typescript
const BoardContext = createContext();

const BoardProvider = ({ children, initialData }) => {
  const [board, setBoard] = useState(initialData);
  // ... state and actions
  return (
    <BoardContext.Provider value={{ board, actions }}>
      {children}
    </BoardContext.Provider>
  );
};
```

#### Option C: Zustand
**Pros:**
- Tiny library (~1KB)
- Simple API
- Good for global state
- No Context boilerplate

**Cons:**
- Additional dependency
- Overkill for single-page state
- Not needed since we use SSR

#### Option D: React Query / TanStack Query
**Pros:**
- Excellent for server state management
- Built-in caching and refetching
- Optimistic updates built-in
- Loading/error states handled

**Cons:**
- Large dependency (~40KB)
- Complex API for simple needs
- Overkill for our use case
- We already have API routes with simple fetch

### Recommendation: **React useState in Board Component**

**Rationale:**
- Simplest solution that meets our needs
- No additional dependencies
- State is naturally scoped to the board view
- Prop drilling is minimal (Board → Column → Card is only 3 levels)
- Easy to refactor to Context later if needed
- Works perfectly with Astro's SSR (initial data from server)

**Implementation Strategy:**
```typescript
const Board = ({ initialBoard }: { initialBoard: BoardWithColumns }) => {
  // Core state
  const [board, setBoard] = useState(initialBoard);
  const [columns, setColumns] = useState(initialBoard.columns);

  // UI state
  const [isCreateCardModalOpen, setIsCreateCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{type: string, id: number} | null>(null);

  // CRUD handlers
  const handleCreateColumn = async (name: string) => { /* ... */ };
  const handleUpdateColumn = async (id: number, name: string) => { /* ... */ };
  const handleDeleteColumn = async (id: number) => { /* ... */ };
  // ... similar for cards

  return (
    <div>
      {/* Render columns and cards */}
      {/* Modals */}
    </div>
  );
};
```

---

## 3. Form Handling

### Options Considered

#### Option A: Controlled Components with useState
**Pros:**
- Built-in React solution
- Full control over form state
- Easy to add validation
- No dependencies

**Cons:**
- Boilerplate for each input
- Manual validation logic
- Repetitive onChange handlers

**Pattern:**
```typescript
const [formData, setFormData] = useState({ title: '', description: '', color: 'gray' });

<input
  value={formData.title}
  onChange={e => setFormData({ ...formData, title: e.target.value })}
/>
```

#### Option B: React Hook Form
**Pros:**
- Minimal re-renders (uncontrolled inputs)
- Built-in validation
- Less boilerplate
- Good TypeScript support

**Cons:**
- Additional dependency (~25KB)
- Learning curve
- Overkill for simple forms

#### Option C: Formik
**Pros:**
- Comprehensive form solution
- Built-in validation
- Well-documented

**Cons:**
- Larger bundle (~50KB)
- More complex API
- Overkill for our needs

### Recommendation: **Controlled Components with useState**

**Rationale:**
- Our forms are simple (1-3 fields each)
- No complex validation rules
- Performance is not a concern (small forms)
- No additional dependencies
- Clear and explicit behavior
- Easy to integrate with optimistic updates

**Validation Strategy:**
- Client-side validation before submission
- Required field checks (board name, column name, card title)
- No complex rules needed for MVP
- API will validate on server-side as backup

---

## 4. Inline Editing Pattern

### Research: Best Practices

#### Pattern: Click-to-Edit
**User Flow:**
1. Display text with subtle hover indicator (pencil icon or underline)
2. Click to enter edit mode
3. Input field appears with current value selected
4. Auto-focus and select all text
5. Save on Enter or blur
6. Cancel on Escape
7. Return to display mode

**Implementation Strategy:**
```typescript
const EditableTitle = ({ value, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue.trim()) {
      await onSave(editValue);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="..."
      />
    );
  }

  return (
    <h2 onClick={() => setIsEditing(true)} className="cursor-pointer hover:underline">
      {value}
    </h2>
  );
};
```

**Accessibility Considerations:**
- Use `aria-label="Click to edit"` on display text
- Ensure keyboard navigation works (Tab, Enter, Escape)
- Provide visual focus indicator
- Announce state changes to screen readers

---

## 5. Optimistic UI Updates

### Strategy: Update First, Rollback on Error

#### Pattern Implementation
```typescript
const handleCreateCard = async (cardData: CreateCardData) => {
  // 1. Generate temporary ID for optimistic update
  const tempId = Date.now();
  const tempCard = { id: tempId, ...cardData, position: cards.length };

  // 2. Update UI immediately
  const previousCards = [...cards];
  setCards([...previousCards, tempCard]);

  try {
    // 3. Call API
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardData)
    });

    if (!response.ok) throw new Error('Failed to create card');

    const { data: newCard } = await response.json();

    // 4. Replace temp card with real card
    setCards(prev => prev.map(c => c.id === tempId ? newCard : c));

  } catch (error) {
    // 5. Rollback on error
    setCards(previousCards);
    showError('Failed to create card. Please try again.');
  }
};
```

#### Benefits
- Instant feedback for users
- App feels fast and responsive
- Network latency doesn't block UI
- Graceful error handling

#### Considerations
- Keep snapshot of previous state for rollback
- Handle race conditions (multiple rapid updates)
- Temporary IDs for optimistic items
- Replace temp items with server response

---

## 6. Color Picker UI

### Design Pattern: Grid of Color Buttons

#### Implementation
```typescript
const ColorPicker = ({ selectedColor, onChange }) => {
  const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];

  return (
    <div className="grid grid-cols-3 gap-2">
      {colors.map(color => (
        <button
          key={color}
          onClick={() => onChange(color)}
          className={`
            w-16 h-16 rounded-lg border-2 transition-all
            ${selectedColor === color ? 'border-gray-900 scale-110' : 'border-gray-300'}
            hover:scale-105
          `}
          style={{ backgroundColor: getColorForLabel(color) }}
          aria-label={`Select ${color} color`}
        >
          {selectedColor === color && (
            <svg className="w-6 h-6 text-white mx-auto" /* checkmark icon */ />
          )}
        </button>
      ))}
    </div>
  );
};
```

**Features:**
- Large touch targets (64x64px)
- Visual selection indicator (border + scale)
- Hover feedback
- Accessible labels
- Uses existing `getColorForLabel()` utility

---

## 7. Reordering UI (Non-DnD)

### Simple Arrow Button Approach

**For Phase 3:** Use up/down arrows to reorder items
**For Phase 4:** Replace with drag-and-drop

#### Implementation Pattern
```typescript
const ReorderButtons = ({ index, totalItems, onMoveUp, onMoveDown }) => {
  return (
    <div className="flex gap-1">
      <button
        onClick={onMoveUp}
        disabled={index === 0}
        className="p-1 hover:bg-gray-100 disabled:opacity-30"
        aria-label="Move up"
      >
        ↑
      </button>
      <button
        onClick={onMoveDown}
        disabled={index === totalItems - 1}
        className="p-1 hover:bg-gray-100 disabled:opacity-30"
        aria-label="Move down"
      >
        ↓
      </button>
    </div>
  );
};
```

**API Calls:**
- Column reorder: `PUT /api/columns/[id]/position` with new position
- Card reorder: `PUT /api/cards/[id]/position` with new position

**UX Considerations:**
- Disable up arrow for first item
- Disable down arrow for last item
- Provide visual feedback during reorder (brief animation)
- Update positions optimistically

---

## 8. Error Handling & User Feedback

### Toast Notification vs Alert Messages

#### Option A: Browser Alert/Confirm (Simplest)
**Pros:**
- No dependencies
- Built-in browser UI
- Works everywhere

**Cons:**
- Blocks UI (modal dialogs)
- Not customizable
- Not elegant

#### Option B: Toast Notifications
**Pros:**
- Non-blocking
- Professional appearance
- Can show multiple at once
- Auto-dismiss

**Cons:**
- Need to build or add library
- More complexity

#### Option C: Inline Error Messages
**Pros:**
- Clear and contextual
- No extra UI elements
- Simple to implement

**Cons:**
- Takes up space
- Not suitable for global errors

### Recommendation: **Start Simple, Add Toasts Later**

**Phase 3 Strategy:**
- Use inline error messages for form validation
- Use Headless UI `AlertDialog` for confirmations
- Use simple state flag for temporary success/error messages
- If time permits, add simple toast component at end

**Simple Toast Implementation (if time permits):**
```typescript
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`
      fixed top-4 right-4 p-4 rounded-lg shadow-lg
      ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}
      text-white
    `}>
      {message}
    </div>
  );
};
```

---

## 9. Component Architecture

### Proposed Component Structure

```
src/components/
├── Board.tsx              [EXISTS] Update with state management
├── Column.tsx             [EXISTS] Add editing, delete, reorder buttons
├── Card.tsx               [EXISTS] Add click handler for edit modal
├── Modal.tsx              [NEW] Reusable modal wrapper (Headless UI Dialog)
├── ConfirmDialog.tsx      [NEW] Confirmation for destructive actions
├── CreateCardModal.tsx    [NEW] Form for creating cards
├── EditCardModal.tsx      [NEW] Form for editing cards
├── CreateColumnForm.tsx   [NEW] Inline or modal form for new columns
├── EditableText.tsx       [NEW] Inline editing component
├── ColorPicker.tsx        [NEW] Color selection grid
├── Button.tsx             [NEW] Reusable button with variants
└── FormInput.tsx          [NEW] Reusable input with validation display
```

### Component Responsibilities

**Board.tsx** (Main Container)
- State management for board, columns, cards
- Modal state (open/closed, editing item)
- CRUD operation handlers
- Pass data and handlers to child components

**Column.tsx**
- Display column with cards
- Inline editing for column name
- Delete button with confirmation
- Up/down reorder buttons
- "Add Card" button

**Card.tsx**
- Display card details
- Click handler to open edit modal
- Delete button
- Up/down reorder buttons (optional, or in edit modal)

**Reusable UI Components**
- Modal, ConfirmDialog, Button, FormInput, ColorPicker, EditableText
- Used across multiple features
- Consistent styling and behavior

---

## 10. API Integration Utilities

### Centralized Fetch Wrapper

#### Recommended Pattern
```typescript
// src/utils/api.ts

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function apiCall<T>(
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
    return { success: false, error: 'Network error' };
  }
}

// Usage:
const result = await apiCall<Card>('/api/cards', {
  method: 'POST',
  body: JSON.stringify(cardData)
});

if (result.success) {
  // result.data is Card
} else {
  // result.error is string
}
```

**Benefits:**
- Type-safe API calls
- Consistent error handling
- Centralized request configuration
- Easy to add auth headers later
- Reduces boilerplate in components

---

## 11. Accessibility Checklist

### WCAG 2.1 Level AA Compliance

#### Keyboard Navigation
- [ ] All interactive elements accessible via Tab
- [ ] Enter to submit forms
- [ ] Escape to close modals and cancel edits
- [ ] Arrow keys for reordering (optional enhancement)
- [ ] Space to activate buttons

#### Focus Management
- [ ] Modal traps focus (Headless UI handles this)
- [ ] Focus returns to trigger element on modal close
- [ ] Visible focus indicators on all interactive elements
- [ ] Logical tab order

#### Screen Reader Support
- [ ] ARIA labels on icon-only buttons
- [ ] ARIA live regions for dynamic content
- [ ] Semantic HTML (button, form, dialog)
- [ ] Alt text for any icons/images

#### Color & Contrast
- [ ] 4.5:1 contrast ratio for normal text
- [ ] 3:1 for large text and UI components
- [ ] Don't rely solely on color (use icons/text too)

#### Form Accessibility
- [ ] Labels associated with inputs
- [ ] Required field indicators
- [ ] Error messages announced to screen readers
- [ ] Help text provided where needed

**Note:** Headless UI handles most of this automatically for modals.

---

## 12. Testing Strategy

### Manual Testing Checklist

Since we don't have E2E tests yet, comprehensive manual testing is critical:

#### Board Management
- [ ] Create board from homepage
- [ ] Edit board name inline
- [ ] Delete board with confirmation
- [ ] Navigate between boards

#### Column Management
- [ ] Add column to board
- [ ] Edit column name inline
- [ ] Delete column (confirm cascade warning)
- [ ] Reorder columns with arrows

#### Card Management
- [ ] Create card in column
- [ ] Edit card details (title, description, color)
- [ ] Delete card
- [ ] Reorder cards with arrows

#### Error Handling
- [ ] Invalid form submissions (empty required fields)
- [ ] Network errors (test with dev tools offline mode)
- [ ] Rollback on failed operations

#### Responsive Design
- [ ] Test on mobile viewport (375px)
- [ ] Test on tablet (768px)
- [ ] Test on desktop (1280px+)
- [ ] Touch interactions on mobile

#### Browser Compatibility
- [ ] Chrome/Brave
- [ ] Firefox
- [ ] Safari (if available)

### Future: Add Integration Tests
Consider adding Playwright or Cypress in Phase 4 for automated E2E testing.

---

## 13. Performance Considerations

### Optimization Strategies

#### Keep It Simple for Phase 3
- No premature optimization
- React's default behavior is fine for our data size
- Typical board: 5-10 columns, 10-50 cards (small dataset)

#### If Performance Issues Arise
- `React.memo()` on Card component (most numerous)
- `useMemo()` for expensive computations (not needed yet)
- Debounce inline editing save operations
- Lazy load images (no images in MVP)

#### Bundle Size
- Headless UI adds ~30KB (acceptable)
- No other heavy dependencies planned
- Astro's island architecture already optimizes hydration

**Decision:** Don't optimize prematurely. Build cleanly and refactor if needed.

---

## 14. Timeline & Complexity Estimate

### Complexity Assessment

**Phase 3 is the most complex phase** due to:
1. Multiple new components (8-12 files)
2. State management across component tree
3. Form handling and validation
4. Modal management
5. Optimistic updates and error handling
6. Inline editing patterns

### Estimated File Breakdown

**New Components (9 files):**
1. Modal.tsx
2. ConfirmDialog.tsx
3. CreateCardModal.tsx
4. EditCardModal.tsx
5. CreateColumnForm.tsx
6. EditableText.tsx
7. ColorPicker.tsx
8. Button.tsx
9. FormInput.tsx

**Modified Components (3 files):**
1. Board.tsx (major: add state management)
2. Column.tsx (moderate: add buttons and editing)
3. Card.tsx (minor: add click handler)

**New Utilities (1 file):**
1. api.ts (API wrapper utility)

**Modified Pages (1 file):**
1. index.astro (add "New Board" button and form)

**Documentation (3 files):**
1. RESEARCH.md (this document)
2. PLAN.md
3. REVIEW.md

**Total: ~17 files created/modified**

---

## 15. Deferred Decisions (Phase 4)

### Items NOT Researched Yet

The following are intentionally deferred to Phase 4:

1. **Drag-and-Drop Library Choice**
   - React DnD vs dnd-kit vs react-beautiful-dnd
   - Touch support requirements
   - Performance with many cards

2. **Animation Library**
   - CSS transitions vs Framer Motion
   - Drag animations and visual feedback

3. **Mobile Drag Gestures**
   - Long-press to initiate drag
   - Touch event handling
   - Scroll-while-dragging behavior

**Rationale:** Phase 3 uses arrow buttons for reordering. Phase 4 will replace these with drag-and-drop, requiring separate research.

---

## 16. Key Decisions Summary

### Technology Choices

| Decision Point | Choice | Rationale |
|---|---|---|
| Modal Library | Headless UI | Best balance of simplicity, accessibility, and Tailwind integration |
| State Management | React useState | Sufficient for single-page scope; no prop drilling issues |
| Form Handling | Controlled components | Simple forms don't need heavy library |
| Inline Editing | Custom component | Simple pattern, no library needed |
| API Wrapper | Custom utility | Lightweight, type-safe, centralized error handling |
| Color Picker | Custom grid | Simple 6-color palette, no library needed |
| Reordering (Phase 3) | Arrow buttons | Defer drag-and-drop to Phase 4 |
| Error Feedback | Inline messages + AlertDialog | Start simple; add toast if time permits |

### Dependencies to Add

```bash
npm install @headlessui/react
```

**Total added weight:** ~30KB (acceptable for accessibility benefits)

---

## 17. Risk Assessment

### Potential Challenges

#### Risk: State Management Complexity
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:** Start with simple useState, refactor to Context if prop drilling becomes unwieldy

#### Risk: Accessibility Gaps
**Likelihood:** Low
**Impact:** High
**Mitigation:** Use Headless UI for modals; follow WCAG checklist; test with keyboard and screen reader

#### Risk: Optimistic Updates Failing
**Likelihood:** Low
**Impact:** Medium
**Mitigation:** Keep snapshot of previous state; implement rollback on error; test error scenarios

#### Risk: Race Conditions (Multiple Rapid Updates)
**Likelihood:** Low
**Impact:** Low
**Mitigation:** Use functional setState updates; consider debouncing inline edits

#### Risk: Mobile Touch UX
**Likelihood:** Medium
**Impact:** Medium
**Mitigation:** Test on real devices; ensure touch targets are 44x44px minimum; test with Chrome mobile emulator

### Overall Risk: **Low to Medium**

All identified risks have clear mitigation strategies. No critical blockers anticipated.

---

## 18. Success Criteria

Phase 3 research is complete and successful if:

- [x] Modal/dialog strategy decided (Headless UI)
- [x] State management approach defined (useState)
- [x] Form handling pattern established (controlled components)
- [x] Inline editing pattern researched
- [x] Optimistic update strategy designed
- [x] Component architecture planned
- [x] API integration utilities designed
- [x] Accessibility checklist created
- [x] Risk assessment completed
- [x] All technical decisions documented

**Status:** ✅ **COMPLETE**

---

## 19. Next Steps (Phase 3 Plan)

1. Install Headless UI dependency
2. Create reusable UI components (Modal, Button, etc.)
3. Update Board component with state management
4. Add create/edit/delete operations for boards
5. Add create/edit/delete operations for columns
6. Add create/edit/delete operations for cards
7. Implement inline editing for board/column names
8. Add color picker to card forms
9. Add up/down arrows for reordering
10. Test all CRUD operations
11. Test responsive design on mobile
12. Test keyboard navigation and accessibility
13. Write REVIEW.md

---

## Conclusion

Phase 3 research has identified clear technical solutions for all requirements:

- **Headless UI** provides accessible modals with minimal overhead
- **React useState** is sufficient for state management
- **Controlled components** are simple and effective for forms
- **Custom utilities** handle API calls and inline editing
- **Optimistic updates** will make the app feel fast and responsive
- **Arrow buttons** provide temporary reordering until Phase 4 drag-and-drop

All design patterns are well-established in the React ecosystem. No experimental or risky approaches are required. The foundation from Phase 1-2 (API endpoints, repositories, types) makes implementation straightforward.

**Ready to proceed with Phase 3 PLAN.** 🚀
