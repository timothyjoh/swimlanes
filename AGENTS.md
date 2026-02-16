# AGENTS.md

**For AI Agents and Codex CLI**

Read `CLAUDE.md` for all project conventions, tech stack, and development workflows.

## Project Summary
SwimLanes — a Trello-like kanban board application with SQLite backend, built using Astro 5, React, TypeScript, and Tailwind CSS.

## Key Commands
- `npm run dev` — start development server
- `npm test` — run all tests
- `npm run test:coverage` — run tests with coverage report

## Architecture Patterns
- Repository pattern for data access
- Database migrations in `db/migrations/`
- RESTful API routes in `src/pages/api/`
- React islands with `client:load` directive

See `CLAUDE.md` for detailed guidance.
