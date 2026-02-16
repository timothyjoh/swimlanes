# SwimLanes

A Trello-like kanban board app with swim lanes for organizing notes and tasks. Built with Astro, React, SQLite, and Tailwind CSS.

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
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Tech Stack
- **Astro 5** — SSR framework with Node adapter
- **React** — Interactive UI islands
- **Tailwind CSS v4** — Utility-first styling
- **SQLite** — Local file database (better-sqlite3)
- **TypeScript** — Type safety throughout
- **Vitest** — Fast test framework

## Project Structure
```
src/
  components/     — React island components
  layouts/        — Astro layout templates
  lib/db/         — Database access layer
  pages/          — Pages and API routes
  styles/         — Global styles
db/
  migrations/     — SQL migration files
```
