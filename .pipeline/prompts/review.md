You are building a project. Read BRIEF.md for the full project description.
Current phase: {{PHASE}} | Current step: review

{{PREV_REFLECTIONS}}
{{CLAUDE_MD}}

TASK: Review the build output for phase {{PHASE}}.
Read the SPEC.md acceptance criteria. Review ALL code changes.
Verify: Do all tests pass? Are acceptance criteria met? Is test coverage acceptable?
If issues found, fix them and re-run tests.
Output: docs/phases/phase-{{PHASE}}/REVIEW.md (findings, test results, coverage report)

When done, commit with message 'phase {{PHASE}}: review'
