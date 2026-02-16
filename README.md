# SwimLanes

A modern kanban board application built with Astro, React, and SQLite. Organize your work with boards, columns (swim lanes), and draggable cards.

## Features
- ✅ **Phase 1**: Board creation and listing (current)
- 🚧 **Phase 2**: Columns and swim lanes (planned)
- 🚧 **Phase 3**: Cards with drag-and-drop (planned)
- 🚧 **Phase 4**: Persistence and polish (planned)

## Tech Stack
- **Astro 5** — SSR framework with API routes
- **React 18** — interactive components
- **TypeScript** — type-safe development
- **Tailwind CSS** — utility-first styling
- **SQLite** — local file-based database
- **Vitest** — fast testing with coverage

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm (comes with Node.js)

### Installation
```bash
git clone <repository-url>
cd swimlanes
npm install
```

### Run Development Server
```bash
npm run dev
```
Visit http://localhost:4321 to see the app.

### Run Tests
```bash
npm test                # Run all tests
npm run test:coverage   # Run with coverage report
```

### Build for Production
```bash
npm run build
npm run preview  # Preview production build
```

## Scripts Reference
- `npm run dev` — Start development server (http://localhost:4321)
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm test` — Run all tests
- `npm run test:watch` — Run tests in watch mode
- `npm run test:coverage` — Generate coverage report

## Project Structure
```
swimlanes/
├── src/
│   ├── pages/           # Astro pages and API routes
│   ├── components/      # React components
│   └── lib/             # Business logic and data access
├── db/
│   └── migrations/      # SQL migration files
├── CLAUDE.md            # Developer guide
└── README.md            # This file
```

## Development
See `CLAUDE.md` for detailed development guidelines, architecture patterns, and testing strategies.

## Project Status
**Phase 1: Complete** ✅
- Project scaffolding with Astro, React, TypeScript, Tailwind CSS
- SQLite database with migration system
- Board creation and listing functionality
- Test framework with >80% coverage
- Comprehensive documentation

**Next**: Phase 2 will add columns/swim lanes to boards.

## License
MIT
