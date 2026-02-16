# SwimLanes — Project Guide

## Overview
SwimLanes is a Trello-like kanban board application built with Astro 5, React, SQLite, and Tailwind CSS. Users can create boards, organize tasks into columns (swim lanes), and manage cards using drag-and-drop.

**Current Status**: Phase 1 complete — basic board creation and listing.

## Tech Stack
- **Astro 5** — SSR framework with API routes
- **React 18** — interactive island components
- **TypeScript** — strict mode enabled throughout
- **Tailwind CSS** — utility-first styling
- **SQLite** (better-sqlite3) — local file-based database
- **Vitest** — fast test framework with coverage reporting

## Getting Started

### Prerequisites
- Node.js 18+ (`node --version` to check)
- npm or pnpm

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Starts server at http://localhost:4321

### Build for Production
```bash
npm run build
npm run preview  # Preview production build
```

### Testing
```bash
npm test                # Run all tests
npm run test:watch      # Watch mode for TDD
npm run test:coverage   # Run with coverage report (target: >80%)
```

Coverage reports are generated in `coverage/` directory.

## Project Structure

```
swimlanes/
├── src/
│   ├── pages/               # Astro pages and API routes
│   │   ├── index.astro      # Home page
│   │   └── api/
│   │       └── boards/      # Board API endpoints
│   ├── components/          # React components (islands)
│   │   ├── BoardForm.tsx    # Board creation form
│   │   └── BoardList.astro  # Board list display
│   ├── lib/
│   │   ├── db/              # Database utilities
│   │   │   ├── connection.ts    # DB connection and migration runner
│   │   │   └── types.ts         # TypeScript types for entities
│   │   └── repositories/    # Repository pattern (data access)
│   │       └── BoardRepository.ts
│   └── env.d.ts             # Astro type definitions
├── db/
│   ├── migrations/          # SQL migration files (numbered)
│   │   └── 001_create_boards.sql
│   └── swimlanes.db         # SQLite database (gitignored)
├── astro.config.mjs         # Astro configuration
├── tsconfig.json            # TypeScript configuration
├── vitest.config.ts         # Test configuration
└── tailwind.config.mjs      # Tailwind configuration
```

## Architecture Patterns

### Repository Pattern
Data access is isolated in repository classes. Repositories encapsulate all SQL queries and provide a clean API for business logic.

**Example:**
```typescript
const db = getDb();
const repo = new BoardRepository(db);
const boards = repo.findAll();  // No SQL in API routes
```

**Location**: `src/lib/repositories/`

### Database Migrations
SQL migrations live in `db/migrations/` with numeric prefixes (e.g., `001_create_boards.sql`). Migrations run automatically on application startup.

**Migration tracking**: `migrations` table in SQLite tracks which migrations have been applied.

### API Route Conventions
- RESTful endpoints under `src/pages/api/`
- Use Astro's APIRoute type
- Export named HTTP methods: `export const GET: APIRoute = ...`
- Return JSON with appropriate status codes
- Validate input and return 400 for bad requests

**Example:**
```typescript
// src/pages/api/boards/index.ts
export const GET: APIRoute = async () => {
  const boards = repo.findAll();
  return new Response(JSON.stringify(boards), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
```

### React Islands
Interactive components use React with Astro's island architecture. Add `client:load` directive to hydrate on page load.

**Example:**
```astro
<BoardForm client:load />
```

**Location**: `src/components/` (`.tsx` files)

### TypeScript Configuration
- Strict mode enabled
- Path aliases: `@/*` maps to `src/*`, `@db/*` maps to `db/*`
- All code must type-check with zero errors

## Database

### Connection Management
- **Development**: Single connection to `db/swimlanes.db`
- **Testing**: In-memory database (`:memory:`) via `getTestDb()`
- **WAL mode**: Enabled for better concurrency

### Accessing the Database
```typescript
import { getDb, getTestDb } from '@/lib/db/connection';

// In application code
const db = getDb();

// In tests
const db = getTestDb();  // Fresh in-memory DB
```

### Writing Migrations
1. Create file in `db/migrations/` with numeric prefix: `002_add_columns.sql`
2. Write idempotent SQL (use `IF NOT EXISTS`)
3. Restart server — migration runs automatically

## Testing

### Test Strategy
- **Unit tests**: Repository layer (no mocking — use in-memory SQLite)
- **Integration tests**: API routes with real database operations
- **Coverage target**: >80% on `src/lib/` and `src/pages/api/`

### Test Files
- Place tests next to implementation: `BoardRepository.test.ts` next to `BoardRepository.ts`
- Use `.test.ts` or `.spec.ts` suffix

### Best Practices
- Use `beforeEach` to create fresh test database
- Prefer real implementations over mocks
- Test both happy paths and error cases
- Verify HTTP status codes and response shapes in API tests

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Write tests first** (TDD): `npm run test:watch`
3. **Implement feature**: code in `src/`
4. **Verify tests pass**: `npm test`
5. **Check coverage**: `npm run test:coverage`
6. **Build to verify**: `npm run build`

## Common Tasks

### Adding a New Entity
1. Create migration in `db/migrations/XXX_create_entity.sql`
2. Add TypeScript types in `src/lib/db/types.ts`
3. Create repository in `src/lib/repositories/EntityRepository.ts`
4. Write unit tests in `EntityRepository.test.ts`
5. Add API routes in `src/pages/api/entity/`
6. Write integration tests for API routes

### Adding a React Component
1. Create `.tsx` file in `src/components/`
2. Use TypeScript for props interface
3. Import and use in `.astro` page with `client:load` directive
4. Style with Tailwind CSS classes

## Troubleshooting

### Database Issues
- **Migration not applied**: Check `db/migrations/` for syntax errors
- **File locked**: Ensure only one dev server is running
- **Reset database**: Delete `db/swimlanes.db` and restart server

### Test Failures
- **Module not found**: Check path aliases in `vitest.config.ts` match `tsconfig.json`
- **Database errors**: Ensure `getTestDb()` is called in `beforeEach`

### TypeScript Errors
- **Cannot find module**: Run `npm install` to ensure dependencies are installed
- **Path alias not resolved**: Check `tsconfig.json` paths configuration
