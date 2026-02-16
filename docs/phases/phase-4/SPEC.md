# Phase 4 — Drag & Drop (MVP Complete)

## Objective
Complete the MVP by implementing drag-and-drop functionality for cards and columns. Replace the temporary arrow-based reordering with intuitive drag-and-drop interactions, and enable moving cards between columns. This is the final phase to deliver a fully-featured kanban board application.

## Current State
After Phase 3, we have:
- ✅ Complete API layer (13 endpoints including move operations)
- ✅ Full CRUD UI for boards, columns, and cards
- ✅ Arrow-based reordering for cards and columns (functional but not ideal UX)
- ❌ **No drag-and-drop functionality**
- ❌ **Cannot move cards between columns via UI**

## Scope

### 1. Drag-and-Drop Library Selection

#### Research & Decision
Evaluate drag-and-drop libraries based on:
- **Bundle size** — minimize impact on performance
- **Touch support** — mobile devices must work well
- **Accessibility** — keyboard navigation support
- **TypeScript support** — full type definitions
- **Maintenance** — active development and community

#### Library Options
- **@dnd-kit/core** — Modern, lightweight (~15KB), excellent touch support, fully accessible
- **react-beautiful-dnd** — Popular but deprecated, no longer maintained
- **react-dnd** — Powerful but heavy (~50KB), complex API
- **Native HTML5 DnD** — Zero dependencies but poor mobile support

**Recommended: @dnd-kit/core**
- Best balance of features, size, and maintenance
- Built-in touch support with @dnd-kit/touch-sensors
- Accessibility features out of the box
- Active development and excellent documentation
- TypeScript-first design

#### Dependencies to Add
```json
{
  "@dnd-kit/core": "^6.1.0",
  "@dnd-kit/sortable": "^8.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

### 2. Column Drag-and-Drop

#### Horizontal Reordering
- Replace left/right arrow buttons with drag handles
- Horizontal drag to reorder columns
- Snap to grid positions (column widths)
- Visual feedback during drag:
  - Semi-transparent ghost/overlay of dragged column
  - Drop indicator showing where column will land
  - Other columns shift to show new position

#### Implementation Details
- Wrap column container in `<DndContext>`
- Use `<SortableContext>` with horizontal strategy
- Each column becomes a `<SortableItem>`
- Add drag handle icon (six dots/hamburger icon) to column header
- Calls existing `PUT /api/columns/:id/position` endpoint
- Optimistic update with rollback on error

#### Visual Design
- Drag handle appears on hover in column header
- Cursor changes to grab/grabbing during drag
- Dragged column has reduced opacity (0.5)
- Drop zones highlighted with border or background change
- Smooth CSS transitions for column position changes

### 3. Card Drag-and-Drop (Within Column)

#### Vertical Reordering
- Replace up/down arrow buttons with drag handles
- Vertical drag to reorder cards within same column
- Visual feedback during drag:
  - Ghost card showing dragged item
  - Gap/space showing where card will drop
  - Smooth transitions for other cards

#### Implementation Details
- Each column has its own `<SortableContext>` with vertical strategy
- Each card becomes a `<SortableItem>`
- Add drag handle icon (visible on hover) to card
- Calls existing `PUT /api/cards/:id/position` endpoint
- Optimistic update with rollback on error

#### Visual Design
- Drag handle appears on hover (left side of card)
- Cursor changes to grab/grabbing during drag
- Dragged card has drop shadow and reduced opacity
- Drop zone shows gap between cards
- Smooth height transitions as cards shift

### 4. Card Drag Between Columns

#### Cross-Column Movement
- Enable dragging cards from one column to another
- Update both card's column and position
- Visual feedback:
  - Valid drop zones highlighted when dragging over
  - Invalid drop zones grayed out (if any restrictions)
  - Clear indication of which column card will land in

#### Implementation Details
- Use `<DndContext>` at Board level (wraps all columns)
- Handle `onDragEnd` event to detect column changes
- Detect if card dropped in different column
- Calculate new position in target column
- Calls existing `PUT /api/cards/:id/move` endpoint with:
  ```json
  {
    "columnId": 2,
    "position": 3
  }
  ```
- Optimistic update:
  - Remove card from source column
  - Add card to target column at position
  - Rollback both if API fails

#### Visual Design
- Column drop zones highlight on dragover
- Dragged card shows which column it's over
- Target column shows where card will insert
- Smooth transitions as cards reflow in both columns

### 5. Touch Support for Mobile

#### Touch Sensor Configuration
- Install `@dnd-kit/touch-sensors` if separate package
- Configure touch sensor in DndContext:
  ```typescript
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );
  ```
- Long-press (250ms) to initiate drag
- Tolerance to distinguish drag from scroll

#### Mobile UX Considerations
- Increase drag handle size on mobile (48x48px minimum)
- Prevent page scroll during drag
- Visual feedback scaled for finger targets
- Test on real iOS and Android devices
- Ensure drop zones large enough for touch

#### Testing Requirements
- Test on iPhone (Safari)
- Test on Android (Chrome)
- Test on iPad (larger screen)
- Verify scroll behavior
- Verify drag initiation (long-press works)
- Verify drop accuracy

### 6. Visual Feedback & Polish

#### Drag State Visuals
- **Dragging Card:**
  - Opacity 0.5 on original position
  - Drop shadow on ghost/overlay
  - Slight scale increase (1.02) for depth
  - Z-index elevated above other content

- **Dragging Column:**
  - Opacity 0.5 on original position
  - Border highlight on ghost/overlay
  - Maintains width during drag

- **Drop Zones:**
  - Subtle background color change (blue-50)
  - Dashed border to indicate drop target
  - Smooth transition on hover enter/exit

#### Animations
- Use CSS transitions for smooth movement:
  ```css
  .card {
    transition: transform 200ms ease;
  }
  ```
- Consider adding subtle spring physics for natural feel
- Avoid janky animations (60fps target)
- Test animation performance on lower-end devices

#### Accessibility
- Keyboard-based drag-and-drop:
  - Space to pick up item
  - Arrow keys to move
  - Space again to drop
  - Escape to cancel
- Screen reader announcements:
  - Announce when item picked up
  - Announce current position during move
  - Announce when item dropped
- Focus management during drag operations

### 7. Remove Arrow Button Code

#### Cleanup Tasks
- Remove up/down arrow buttons from Card component
- Remove left/right arrow buttons from Column component
- Remove related handler functions:
  - `handleCardReorder` (replaced by drag)
  - `handleColumnReorder` (replaced by drag)
- Remove arrow button state logic (isFirst, isLast checks)
- Clean up CSS for arrow buttons
- Update tests if any specifically tested arrow buttons

#### Code Reduction
Expected removal of ~200-300 lines:
- Arrow button JSX in Column.tsx
- Arrow button JSX in Card.tsx
- Position calculation logic in Board.tsx
- Related props and TypeScript interfaces
- Arrow button styling

### 8. Error Handling & Edge Cases

#### Drag Failures
- Network error during position update → rollback to previous state
- Invalid drop target → return to original position with animation
- Concurrent drag operations → queue or cancel previous

#### State Consistency
- Ensure optimistic updates don't cause race conditions
- Handle rapid drag operations gracefully
- Maintain position integrity during errors
- Validate API response before finalizing UI state

#### User Feedback
- Show error message if drag fails (toast or inline)
- Animate return to original position on failure
- Disable drag during API call (optional, if lag is noticeable)
- Loading indicator for slow networks (optional)

## Acceptance Criteria

### Column Drag-and-Drop
- [ ] Columns have visible drag handles on hover
- [ ] Clicking and dragging a column reorders it horizontally
- [ ] Visual feedback shows dragged column and drop position
- [ ] Releasing drag updates column order in database
- [ ] Column order persists across page refresh
- [ ] Drag animation is smooth (no jank)
- [ ] Left/right arrow buttons are removed

### Card Drag-and-Drop (Within Column)
- [ ] Cards have visible drag handles on hover
- [ ] Clicking and dragging a card reorders it within column
- [ ] Visual feedback shows dragged card and drop gap
- [ ] Releasing drag updates card position in database
- [ ] Card order persists across page refresh
- [ ] Drag animation is smooth
- [ ] Up/down arrow buttons are removed

### Card Drag Between Columns
- [ ] Dragging card over different column highlights drop zone
- [ ] Releasing card in different column moves it
- [ ] Card appears in new column at correct position
- [ ] Card removed from original column
- [ ] Move operation persists across page refresh
- [ ] Both columns update correctly in UI
- [ ] API call uses `/api/cards/:id/move` endpoint

### Touch Support (Mobile)
- [ ] Long-press (250ms) initiates drag on touch devices
- [ ] Touch drag works for columns (horizontal)
- [ ] Touch drag works for cards (vertical and cross-column)
- [ ] Page doesn't scroll during drag
- [ ] Drop zones large enough for finger accuracy
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome

### Visual Feedback
- [ ] Dragged item has semi-transparent ghost/overlay
- [ ] Drop zones highlighted during drag
- [ ] Smooth transitions when items reorder
- [ ] Cursor changes to grab/grabbing during drag
- [ ] Clear visual distinction between drag states
- [ ] No flickering or visual glitches

### Accessibility
- [ ] Keyboard users can drag with Space + Arrows
- [ ] Screen reader announces drag operations
- [ ] Focus management works during drag
- [ ] Escape key cancels drag operation
- [ ] All drag handles have proper ARIA labels
- [ ] Keyboard-only users can perform all drag operations

### Error Handling
- [ ] Failed drag operations rollback to previous state
- [ ] Error messages display when drag fails
- [ ] Invalid drops return item to original position
- [ ] Concurrent operations handled gracefully
- [ ] No data corruption on network errors

### Code Quality
- [ ] Arrow button code completely removed
- [ ] No unused state or functions remaining
- [ ] TypeScript compiles with no errors
- [ ] All drag handlers properly typed
- [ ] Code follows existing style/patterns
- [ ] No console warnings or errors

### Build & Testing
- [ ] `npm run dev` works without errors
- [ ] `npm run build` succeeds
- [ ] All repository tests still pass (60/60)
- [ ] No hydration mismatches
- [ ] Bundle size increase acceptable (<50KB)
- [ ] No performance regressions

### Manual Testing
- [ ] Can reorder columns by dragging
- [ ] Can reorder cards within column by dragging
- [ ] Can move cards between columns by dragging
- [ ] Touch drag works on mobile devices
- [ ] Keyboard drag works without mouse
- [ ] All data persists correctly
- [ ] Rapid drag operations work smoothly
- [ ] Network failures handled gracefully

## Out of Scope

### Not in Phase 4
- Drag-and-drop for boards (no multi-board view)
- Drag multiple cards at once (bulk operations)
- Drag to delete (drop in trash zone)
- Custom drag animations beyond basic transitions
- Drag preview customization (e.g., mini card preview)

### Post-MVP Enhancements
- Advanced animations (spring physics, particle effects)
- Drag-and-drop between different boards
- Multi-select and bulk drag
- Drag gestures (flick to move to end, etc.)
- Undo/redo for drag operations
- Drag operation history/audit log

## Technical Notes

### DnD Kit Architecture

#### Context Setup
```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';

function Board() {
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      {/* Columns */}
      <SortableContext
        items={columns.map(c => c.id)}
        strategy={horizontalListSortingStrategy}
      >
        {columns.map(column => (
          <Column key={column.id}>
            {/* Cards */}
            <SortableContext
              items={column.cards.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {column.cards.map(card => <Card key={card.id} />)}
            </SortableContext>
          </Column>
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

#### Sortable Item Component
```typescript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function Card({ card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div {...listeners} className="drag-handle">
        {/* Drag handle icon */}
      </div>
      {/* Card content */}
    </div>
  );
}
```

#### Drag End Handler
```typescript
function handleDragEnd(event) {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  // Detect if dragging card or column
  const draggedCard = findCard(active.id);
  const draggedColumn = findColumn(active.id);

  if (draggedCard) {
    // Card drag logic
    const sourceColumn = findColumnByCardId(active.id);
    const targetColumn = findColumnByCardId(over.id);

    if (sourceColumn.id !== targetColumn.id) {
      // Move between columns
      await moveCardToColumn(draggedCard.id, targetColumn.id, newPosition);
    } else {
      // Reorder within column
      await reorderCard(draggedCard.id, newPosition);
    }
  } else if (draggedColumn) {
    // Column drag logic
    await reorderColumn(draggedColumn.id, newPosition);
  }
}
```

### Performance Considerations
- Use `useMemo` for drag sensor configuration
- Avoid re-creating handler functions on every render
- Debounce position calculations if needed
- Monitor bundle size (target: <30KB for dnd-kit)
- Profile drag performance (60fps target)

### Mobile Touch Configuration
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8, // 8px movement to start drag (prevents accidental drags)
    },
  }),
  useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,        // 250ms hold to start drag
      tolerance: 5,      // 5px tolerance during hold
    },
  })
);
```

### Optimistic Update Pattern
```typescript
async function handleDragEnd(event) {
  // 1. Calculate new positions
  const newState = calculateNewState(event);

  // 2. Snapshot current state
  const previousState = { ...state };

  // 3. Update UI optimistically
  setState(newState);

  // 4. Call API
  const result = await apiCall(...);

  // 5. Rollback on error
  if (!result.success) {
    setState(previousState);
    showError(result.error);
  }
}
```

## Success Metrics

Phase 4 (and MVP) is complete when:
1. All acceptance criteria are met
2. User can drag-and-drop cards and columns smoothly
3. Touch drag works on mobile devices
4. Arrow buttons are completely removed
5. All 60 repository tests still pass
6. No console errors or TypeScript warnings
7. Build succeeds cleanly
8. Performance is smooth (no lag during drag)

## MVP Completion

After Phase 4 is complete, **all MVP features from BRIEF.md will be implemented:**

### ✅ Completed Features
1. **Boards** — create/rename/delete boards ✅ (Phase 1-3)
2. **Columns (Swim Lanes)** — add/rename/reorder/delete columns ✅ (Phase 1-4)
3. **Cards** — create/edit/delete cards with title + description + color ✅ (Phase 1-3)
4. **Drag & Drop** — move cards between columns, reorder within column ✅ (Phase 4)
5. **Persistence** — all state in SQLite, survives restart ✅ (Phase 1)
6. **Responsive** — works on desktop and mobile ✅ (Phase 2-4)

### ✅ Quality Bar Met
- All data operations have tests (60 passing) ✅
- TypeScript throughout ✅
- Clean component architecture ✅
- Works in Brave/Chrome/Firefox ✅

### 🎉 Project Complete Message

When Phase 4 is done, update the reflections with:

```markdown
## PROJECT COMPLETE

All MVP features from BRIEF.md are implemented and working:
- ✅ Boards (create/rename/delete)
- ✅ Columns (add/rename/reorder/delete)
- ✅ Cards (create/edit/delete with title, description, color)
- ✅ Drag & Drop (move cards between columns, reorder cards/columns)
- ✅ Persistence (SQLite)
- ✅ Responsive (desktop and mobile)

The SwimLanes kanban board application is ready for use! 🎉
```

## Estimated Complexity

**Phase 4 Complexity: Medium-High**

### Challenges
1. Learning @dnd-kit API and patterns
2. Coordinating nested drag contexts (columns + cards)
3. Handling cross-column card movement
4. Touch support with proper gestures
5. Maintaining state consistency during drag
6. Smooth animations without jank
7. Removing old arrow code cleanly

### Time Estimate
- Library research and setup: 1-2 hours
- Column drag-and-drop: 2-3 hours
- Card drag within column: 2-3 hours
- Card drag between columns: 3-4 hours
- Touch support and mobile testing: 2-3 hours
- Visual polish and animations: 2-3 hours
- Arrow code removal: 1 hour
- Testing and bug fixes: 2-3 hours

**Total: 15-20 hours of focused work**

### File Changes Expected
- **Modified:** Board.tsx, Column.tsx, Card.tsx (major refactor)
- **Created:** useDragAndDrop.ts (custom hook), DragOverlay.tsx (optional)
- **Removed:** Arrow button code from multiple components
- **Package.json:** +3 dependencies

**Total: ~3-5 files modified/created**

## Next Steps After MVP

Once Phase 4 is complete, consider these enhancements:

### High-Value Enhancements
1. **Toast notifications** — replace browser alerts
2. **Keyboard shortcuts** — j/k navigation, n for new card
3. **Search/filter** — find cards across board
4. **Export/import** — backup boards as JSON
5. **Dark mode** — system preference detection

### Future Features
1. Card labels/tags beyond colors
2. Due dates and assignments
3. File attachments
4. Multi-board view
5. User authentication (if sharing needed)

These are all **post-MVP** and not required for the project completion.
