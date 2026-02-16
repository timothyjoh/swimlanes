# Must-Fix Items: Phase 1

## Summary
3 critical issues, 3 minor issues found in review. All fixed.

---

## Tasks

### Task 1: Fix component test to actually test rendering
**Status:** ✅ Fixed
**What was done:** Installed happy-dom, @testing-library/react, and @testing-library/jest-dom. Rewrote BoardList.test.tsx to use happy-dom environment, mock fetch, and test three real behaviors: renders without crashing (checks for input placeholder after loading), shows loading state initially (uses a hanging fetch promise), and shows empty state when no boards (waits for fetch to resolve with empty array).

---

### Task 2: Add JSON parsing error handling to API routes
**Status:** ✅ Fixed
**What was done:** Wrapped `await request.json()` in try-catch in both `src/pages/api/boards/index.ts` (POST handler) and `src/pages/api/boards/[id].ts` (PATCH handler). Malformed JSON now returns 400 with `{"error":"Invalid JSON"}`. Added verification tests for both endpoints confirming the 400 response.

---

### Task 3: Add error handling to BoardList component
**Status:** ✅ Fixed
**What was done:** Added `error` state to BoardList. Updated initial fetch to check `res.ok` and catch errors. Wrapped handleCreate, handleRename, and handleDelete in try-catch blocks that check `res.ok` and set error state on failure. Added error banner display in JSX with red styling. Used `err instanceof Error` checks instead of `any` type for TypeScript compliance.

---

### Task 4: Fix whitespace-only rename behavior
**Status:** ✅ Fixed
**What was done:** Updated handleRename to restore the original board name from state when the trimmed edit name is empty, before closing edit mode. This ensures the UI always shows the correct name when a rename is cancelled due to empty/whitespace input.

---

### Task 5: Show user feedback for operations in progress
**Status:** ✅ Fixed
**What was done:** Added `creating`, `updatingId`, and `deletingId` loading states. Create button shows "Creating..." and is disabled during creation (also disabled when input is empty). Edit and Delete buttons show "Saving..."/"Deleting..." and are disabled during their respective operations. Edit input is also disabled during a rename operation. All buttons have `disabled:opacity-50 disabled:cursor-not-allowed` styling.

---

### Task 6: Add API tests for edge cases
**Status:** ✅ Fixed
**What was done:** Added 4 new test cases to boards-api.test.ts: malformed JSON in POST (400 with "Invalid JSON" error), malformed JSON in PATCH (400 with "Invalid JSON" error), POST with missing body (400), and POST with null name (400). All 32 tests pass.
