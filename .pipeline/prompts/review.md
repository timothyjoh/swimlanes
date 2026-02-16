# Review Phase Implementation

You are reviewing the completed phase work. You perform TWO review passes — code quality AND adversarial test review — and output both to a single file.

## Context — Read These First

1. **Phase Spec**: `docs/phases/phase-{{PHASE}}/SPEC.md` — what was supposed to be built
2. **Phase Plan**: `docs/phases/phase-{{PHASE}}/PLAN.md` — how it was supposed to be built
3. **Phase Research**: `docs/phases/phase-{{PHASE}}/RESEARCH.md` — codebase state before build
4. {{CLAUDE_MD}}

Current phase: {{PHASE}}

## Pass 1: Code Quality Review

Review the code changes for quality, correctness, and adherence to spec.

- Run `git diff HEAD~1` to see all changes from the build step
- Run the build command to verify it compiles
- Run the test suite to verify tests pass

Review for:
1. **Spec Compliance** — Does the code deliver what SPEC.md requires?
2. **Plan Adherence** — Were the tasks in PLAN.md completed as specified?
3. **Code Quality** — Clean, readable, follows existing patterns from RESEARCH.md?
4. **Error Handling** — Edge cases covered? Failures handled gracefully?
5. **Architecture** — Does it fit the existing architecture? Any concerning patterns?
6. **Missing Pieces** — Anything in the SPEC that wasn't implemented?

## Pass 2: Adversarial Test Review

Scrutinize test quality — are the tests actually testing what they claim?

Review for:
1. **Mock Abuse** — Are tests heavily mocked to the point they're testing mocks, not code? Flag any test where >50% of the setup is mocking.
2. **Happy Path Only** — Do tests only cover the success case? Where are the failure tests?
3. **Boundary Conditions** — Are edge cases tested? Empty inputs, max values, null/undefined?
4. **Integration Gaps** — Unit tests exist, but do components actually work together?
5. **Assertion Quality** — Are assertions specific enough? `expect(result).toBeTruthy()` is weak. `expect(result.status).toBe(200)` is better.
6. **Missing Test Cases** — Based on the SPEC, what scenarios are NOT tested?
7. **Test Independence** — Do tests depend on execution order or shared state?

## Fix Issues

If you find issues in either review pass:
- **Fix them now** — don't just document, actually fix the code/tests
- Re-run tests after fixes
- Document what you found AND what you fixed

## Output

Write to `docs/phases/phase-{{PHASE}}/REVIEW.md`:

```markdown
# Phase Review: Phase {{PHASE}}

## Code Quality Review

### Summary
[Overall assessment: ready / needs-revision]

### Findings
1. **[Category]**: [Finding] — `file:line`
   - Action: [Fixed / Deferred with reason]

### Spec Compliance Checklist
- [x] [Requirement met]
- [ ] [Requirement NOT met — details]

## Adversarial Test Review

### Summary
[Overall test quality: strong / adequate / weak]

### Findings
1. **[Category]**: [Finding] — `test_file:line`
   - Action: [Fixed / Added test / Deferred]

### Test Coverage
- [Coverage numbers if available]
- [Missing test cases identified and added]

## Fixes Applied
- [What was fixed during this review]

## Remaining Issues
- [Critical] [Must fix before next phase]
- [Minor] [Can defer]
```

Be ruthless in review. Be thorough in fixes. The goal is quality code with honest test coverage.

When done, commit with message 'phase {{PHASE}}: review'
