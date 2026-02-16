# SwimLanes — Project Brief

## What
A Trello-like kanban board app with swim lanes for organizing notes/tasks. Simple, local-first, fast.

## Tech Stack
- **Astro 5** with React islands for interactive components
- **SQLite** via better-sqlite3 (local file DB, no server)
- **Astro API routes** for CRUD endpoints
- **Vanilla drag-and-drop** (HTML5 DnD API, no heavy libraries)
- **Tailwind CSS** for styling

## Features (MVP)
1. **Boards** — create/rename/delete boards
2. **Columns (Swim Lanes)** — add/rename/reorder/delete columns per board
3. **Cards** — create/edit/delete cards with title + description + color label
4. **Drag & Drop** — move cards between columns, reorder within column
5. **Persistence** — all state in SQLite, survives restart
6. **Responsive** — works on desktop and mobile

## Non-Goals (for now)
- No auth/users (single user, local app)
- No real-time collaboration
- No file attachments
- No due dates or assignments

## Quality Bar
- All data operations have unit tests
- **E2E tests required** for any UI feature (use Playwright)
- TypeScript throughout
- Clean component architecture
- Works in Brave/Chrome/Firefox

## Architecture Guidance
- Astro SSR mode with API routes under `src/pages/api/`
- React components for interactive islands (board, column, card)
- SQLite migrations in `db/migrations/`
- Repository pattern for data access

## Phase Approach
Build iteratively. Each phase should produce working, tested code that builds on the last. CC decides what each phase contains based on what's been built so far. Aim for ~4 phases to reach MVP.

Write "PROJECT COMPLETE" in REFLECTIONS.md when all MVP features above are working.
