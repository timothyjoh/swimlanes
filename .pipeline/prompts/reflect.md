You are building a project. Read BRIEF.md for the full project description.
Current phase: {{PHASE}} | Current step: reflect

{{PREV_REFLECTIONS}}
{{CLAUDE_MD}}

TASK: Reflect on phase {{PHASE}} and set direction.
Read all artifacts in docs/phases/phase-{{PHASE}}/.
Write: what was built, what worked, what didn't, tech debt, carry-forward.
Decide what the NEXT phase should focus on (based on BRIEF.md remaining goals).
If ALL goals in BRIEF.md are now complete, write 'PROJECT COMPLETE' as the first line.
Output: docs/phases/phase-{{PHASE}}/REFLECTIONS.md

When done, commit with message 'phase {{PHASE}}: reflect'
