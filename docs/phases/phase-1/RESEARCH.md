# Research: Phase 1

## Phase Context
Phase 1 delivers the first vertical slice of SwimLanes: users can create, list, rename, and delete boards. This requires scaffolding the full Astro 5 + React + SQLite + Tailwind stack, setting up Vitest with coverage, creating API routes and a React island for board management, and producing foundational documentation (AGENTS.md, CLAUDE.md, README.md).

## Previous Phase Learnings
First phase — no prior reflections.

## Current Codebase State

### Relevant Components
This is a **greenfield project**. The repository contains only:

- `BRIEF.md` — Project vision and tech stack decisions
- `docs/phases/phase-1/SPEC.md` — The phase 1 specification
- `.pipeline/` — Build pipeline orchestration files (state.json, pipeline.jsonl, run.sh, current-prompt.md)
- `.git/` — Git repository (initialized, with commit history from pipeline setup)

There are **no source files**, no `package.json`, no configuration files, no `src/` directory, no tests, and no documentation files (CLAUDE.md, AGENTS.md, README.md).

### Existing Patterns to Follow
No existing code patterns — everything will be established in this phase. The BRIEF.md defines the target patterns:

- **Astro SSR mode** with Node adapter — `BRIEF.md:34`
- **API routes** under `src/pages/api/` — `BRIEF.md:34`
- **React components** for interactive islands — `BRIEF.md:35`
- **SQLite migrations** in `db/migrations/` — `BRIEF.md:36`
- **Repository pattern** for data access — `BRIEF.md:37`

### Dependencies & Integration Points
No existing dependencies. The SPEC requires these npm packages to be installed:

- **astro** (v5) — core framework
- **@astrojs/react** — React integration for islands
- **@astrojs/node** — SSR adapter
- **@astrojs/tailwind** or Tailwind CSS v4 integration — styling
- **react** + **react-dom** — interactive components
- **better-sqlite3** + **@types/better-sqlite3** — SQLite database driver
- **typescript** — type safety
- **vitest** — test framework
- **@vitest/coverage-v8** or **@vitest/coverage-istanbul** — coverage reporting

### Test Infrastructure
No test infrastructure exists. The SPEC calls for:

- **Vitest** as the test framework — `SPEC.md:53`
- **Coverage** via `--coverage` flag with v8 or istanbul provider — `SPEC.md:54`
- Test targets: database layer unit tests, API route integration tests, React component smoke tests — `SPEC.md:55-58`
- Coverage expectation: 80%+ on `src/lib/` — `SPEC.md:59`

## Code References
- `BRIEF.md:1-43` — Complete project brief, tech stack, features, architecture guidance
- `docs/phases/phase-1/SPEC.md:1-72` — Full phase 1 specification

## Open Questions
- **Astro 5 + Tailwind integration**: Astro 5 may use Tailwind v4 with the Vite plugin (`@tailwindcss/vite`) rather than the older `@astrojs/tailwind` integration. The planner should verify the current recommended approach.
- **Vitest + Astro compatibility**: Testing Astro API routes may require specific Vitest configuration or test helpers. The planner should determine whether to test API routes by importing handler functions directly or by spinning up a test server.
- **better-sqlite3 native module**: This is a native Node addon. It works fine in Node but may need special handling in Vitest config (e.g., `deps.external` or `deps.inline` settings).
