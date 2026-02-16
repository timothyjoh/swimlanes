# SwimLanes

A Trello-like kanban board app with swim lanes for organizing notes and tasks. Built with Astro, React, SQLite, and Tailwind CSS.

## Features

- **Boards** — Create, rename, and delete kanban boards
- **Columns (Swim Lanes)** — Add, rename, reorder (drag-and-drop), and delete columns within boards
- **Cards** — Create, edit (title, description, color label), delete, and reorder cards within columns
- **Drag-and-Drop** — Reorder columns and cards; move cards between columns
- **Persistence** — All data stored locally in SQLite with automatic migrations
- **Cascade Delete** — Deleting a board removes its columns; deleting a column removes its cards
- **Responsive** — Mobile-friendly Tailwind CSS layout

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install
```bash
npm install
```

### Run
```bash
npm run dev
```
Open http://localhost:4321 to see the app.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run unit/integration tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:e2e` | Run Playwright E2E tests (headless) |
| `npm run test:e2e:ui` | Run Playwright E2E tests (interactive) |

## Testing

### Unit & Integration Tests

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

### E2E Tests

Run Playwright tests in headless mode:

```bash
npm run test:e2e
```

Run Playwright tests with interactive UI:

```bash
npm run test:e2e:ui
```

## Tech Stack
- **Astro 5** — SSR framework with Node adapter
- **React** — Interactive UI islands
- **Tailwind CSS v4** — Utility-first styling
- **SQLite** — Local file database (better-sqlite3)
- **TypeScript** — Type safety throughout
- **Vitest** — Fast unit/integration test framework
- **Playwright** — E2E test framework

## Project Structure
```
src/
  components/     — React island components
  layouts/        — Astro layout templates
  lib/db/         — Database access layer
  lib/utils/      — Shared utilities (positioning)
  pages/          — Pages and API routes
  styles/         — Global styles
db/
  migrations/     — SQL migration files
tests/            — Playwright E2E tests
```
