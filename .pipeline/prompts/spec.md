You are building a project. Read BRIEF.md for the full project description.
Current phase: {{PHASE}} | Current step: spec

{{PREV_REFLECTIONS}}
{{CLAUDE_MD}}

TASK: Write a SPEC for phase {{PHASE}}.
Read BRIEF.md. Review what's been built so far (existing code, tests, previous phase artifacts in docs/phases/).
Decide what this phase should accomplish. Write clear acceptance criteria.
Output: docs/phases/phase-{{PHASE}}/SPEC.md

If this is phase 1, the spec MUST include:
1. Project scaffolding and dependency installation
2. Choose and configure a test framework appropriate for this stack, WITH code coverage reporting
3. Write initial tests that prove the setup works
4. Create CLAUDE.md at the project root documenting:
   - How to install dependencies
   - How to run the project
   - How to run tests (exact command)
   - How to run tests with coverage (exact command)
   - Project structure overview
5. Create README.md at the project root with:
   - Project description
   - Getting started (install, run, test)
   - Any scripts added and how to use them
Phase 1 is the foundation. Every future phase depends on a solid test framework and clear documentation.

For ALL phases (including phase 1), the spec must include a "Documentation Updates" section specifying:
- What to add/update in CLAUDE.md (new commands, conventions, architecture decisions, changed test patterns)
- What to add/update in README.md (new features, new scripts, changed usage instructions)
Documentation is part of "done" — code without updated docs is incomplete.

When done, commit with message 'phase {{PHASE}}: spec'
