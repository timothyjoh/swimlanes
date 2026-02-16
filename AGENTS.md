# SwimLanes — Agent Guide

## Project Description
A Trello-like kanban board app with swim lanes for organizing notes/tasks. Local-first, SQLite-backed.

## Tech Stack
- **Astro 5** — SSR mode with Node adapter
- **React** — Interactive islands (client-side components)
- **Tailwind CSS v4** — Styling via `@tailwindcss/vite` plugin
- **SQLite** — Local file database via better-sqlite3
- **TypeScript** — Strict mode, no `any` in application code
- **Vitest** — Test framework with v8 coverage

## Commands
- `npm install` — Install dependencies
- `npm run dev` — Start dev server (localhost:4321)
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm test` — Run tests once
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Run tests with coverage report

## Project Structure
```
src/
  components/        # React island components
  layouts/           # Astro layout templates
  lib/db/            # Database access layer (repository pattern)
    connection.ts    # SQLite connection singleton + migration runner
    boards.ts        # Board CRUD functions
  pages/             # Astro pages and API routes
    api/boards/      # Board CRUD API endpoints
  styles/            # Global CSS (Tailwind import)
db/
  migrations/        # SQL migration files (applied on startup)
  swimlanes.db       # SQLite database file (gitignored)
```

## Conventions
- **TypeScript strict** — No `any` types in application code
- **Tailwind only** — No custom CSS files; use utility classes
- **Repository pattern** — All DB access through `src/lib/db/` functions
- **API routes** — Under `src/pages/api/`, return JSON with proper HTTP status codes
- **React islands** — Use `client:load` for interactive components
- **Vitest** — Tests colocated in `__tests__/` directories; use real SQLite for DB tests
- **Migrations** — SQL files in `db/migrations/`, auto-applied on server startup
- **Coverage target** — 80%+ on `src/lib/` (enforced in vitest config)
