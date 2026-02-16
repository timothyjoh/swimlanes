#!/usr/bin/env bash
set -euo pipefail

# ─── Artifact-Driven CC Pipeline ───
# Each step: generate prompt → run CC in tmux (claude -p) → CC exits → update state → loop
# Rita doesn't verify. Artifacts on disk are the API. State file is the program counter.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/.pipeline"
STATE_FILE="$PIPELINE_DIR/state.json"
PHASES_DIR="$PROJECT_DIR/docs/phases"
TMUX_SESSION="${TMUX_SESSION:-rita}"
MAX_PHASES=20

# Step order within a phase
STEPS=("spec" "research" "plan" "build" "review" "reflect")

cd "$PROJECT_DIR"

# ─── Helpers ───

read_state() {
  jq -r ".$1" "$STATE_FILE"
}

write_state() {
  local phase="$1" step="$2" status="$3"
  local complete
  complete=$(jq -r '.project_complete' "$STATE_FILE")
  cat > "$STATE_FILE" <<EOF
{
  "phase": $phase,
  "step": "$step",
  "status": "$status",
  "project_complete": $complete
}
EOF
}

mark_complete() {
  local phase step status
  phase=$(read_state phase)
  step=$(read_state step)
  status=$(read_state status)
  cat > "$STATE_FILE" <<EOF
{
  "phase": $phase,
  "step": "$step",
  "status": "$status",
  "project_complete": true
}
EOF
}

next_step() {
  local current="$1"
  case "$current" in
    pending)  echo "spec" ;;
    spec)     echo "research" ;;
    research) echo "plan" ;;
    plan)     echo "build" ;;
    build)    echo "review" ;;
    review)   echo "reflect" ;;
    reflect)  echo "done" ;;
    *)        echo "spec" ;;
  esac
}

phase_dir() {
  local phase="$1"
  echo "$PHASES_DIR/phase-$phase"
}

# ─── Status Dashboard ───

update_status() {
  local phase="$1" step="$2"
  local commit_count test_count file_count
  commit_count=$(git -C "$PROJECT_DIR" rev-list --count HEAD 2>/dev/null || echo "?")
  test_count=$(find "$PROJECT_DIR/src" -name "*.test.*" 2>/dev/null | wc -l | tr -d ' ')
  file_count=$(find "$PROJECT_DIR/src" -name "*.ts" -o -name "*.tsx" -o -name "*.astro" 2>/dev/null | wc -l | tr -d ' ')
  
  local phases_done=$((phase - 1))
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')

  cat > "$PROJECT_DIR/STATUS.md" <<STATUSEOF
# SwimLanes — Build Status

## Current
**Phase:** $phase | **Step:** $step ✅ | **Updated:** $timestamp

## Progress
- **Phases complete:** $phases_done
- **Commits:** $commit_count
- **Source files:** $file_count
- **Test files:** $test_count

## Phase History
STATUSEOF

  # Append phase summaries from reflections
  for pdir in "$PHASES_DIR"/phase-*/; do
    [ -d "$pdir" ] || continue
    local pname
    pname=$(basename "$pdir")
    local reflect="$pdir/REFLECTIONS.md"
    if [ -f "$reflect" ]; then
      local title
      title=$(head -1 "$reflect" | sed 's/^#* *//')
      echo "- **$pname:** $title" >> "$PROJECT_DIR/STATUS.md"
    fi
  done

  echo "" >> "$PROJECT_DIR/STATUS.md"
  echo "---" >> "$PROJECT_DIR/STATUS.md"
  echo "*Auto-updated by pipeline*" >> "$PROJECT_DIR/STATUS.md"
}

# ─── Prompt Generation ───

generate_prompt() {
  local phase="$1" step="$2"
  local pdir
  pdir=$(phase_dir "$phase")
  mkdir -p "$pdir"

  local prompt=""
  
  # Base context: always include BRIEF
  prompt+="You are building a project. Read BRIEF.md for the full project description.\n\n"
  prompt+="Current phase: $phase | Current step: $step\n\n"

  # Include previous phase reflections for context
  if [ "$phase" -gt 1 ]; then
    local prev_phase=$((phase - 1))
    local prev_reflect="$PHASES_DIR/phase-$prev_phase/REFLECTIONS.md"
    if [ -f "$prev_reflect" ]; then
      prompt+="Previous phase reflections (read this file): $prev_reflect\n\n"
    fi
  fi

  case "$step" in
    spec)
      prompt+="TASK: Write a SPEC for phase $phase of this project.\n"
      prompt+="Read BRIEF.md. Review what's been built so far (check existing code, tests, previous phase artifacts in docs/phases/).\n"
      prompt+="Decide what this phase should accomplish. Write acceptance criteria.\n"
      prompt+="Output: docs/phases/phase-$phase/SPEC.md\n"
      prompt+="When done, commit with message 'phase $phase: spec'\n"
      ;;
    research)
      prompt+="TASK: Research for phase $phase.\n"
      prompt+="Read docs/phases/phase-$phase/SPEC.md.\n"
      prompt+="Research any technical decisions, library choices, or patterns needed.\n"
      prompt+="Output: docs/phases/phase-$phase/RESEARCH.md\n"
      prompt+="When done, commit with message 'phase $phase: research'\n"
      ;;
    plan)
      prompt+="TASK: Create implementation plan for phase $phase.\n"
      prompt+="Read SPEC.md and RESEARCH.md in docs/phases/phase-$phase/.\n"
      prompt+="Write a detailed implementation plan: files to create/modify, order of operations, test strategy.\n"
      prompt+="Output: docs/phases/phase-$phase/PLAN.md\n"
      prompt+="When done, commit with message 'phase $phase: plan'\n"
      ;;
    build)
      prompt+="TASK: Implement phase $phase.\n"
      prompt+="Read SPEC.md, RESEARCH.md, and PLAN.md in docs/phases/phase-$phase/.\n"
      prompt+="Write the code AND tests. Follow the plan. All tests must pass.\n"
      prompt+="Run tests before committing. Fix any failures.\n"
      prompt+="When done, commit with message 'phase $phase: build'\n"
      ;;
    review)
      prompt+="TASK: Review the build output for phase $phase.\n"
      prompt+="Read the SPEC.md (acceptance criteria) and review ALL code changes in this phase.\n"
      prompt+="Check: Do all tests pass? Are acceptance criteria met? Any bugs or missed requirements?\n"
      prompt+="If issues found, fix them and re-run tests.\n"
      prompt+="Output: docs/phases/phase-$phase/REVIEW.md (findings + any fixes made)\n"
      prompt+="When done, commit with message 'phase $phase: review'\n"
      ;;
    reflect)
      prompt+="TASK: Reflect on phase $phase and set direction for next phase.\n"
      prompt+="Read all artifacts in docs/phases/phase-$phase/.\n"
      prompt+="Write: what was built, what worked, what didn't, tech debt, carry-forward items.\n"
      prompt+="Decide: what should the NEXT phase focus on? (based on BRIEF.md remaining goals)\n"
      prompt+="If ALL goals in BRIEF.md are now complete, write 'PROJECT COMPLETE' as the first line.\n"
      prompt+="Output: docs/phases/phase-$phase/REFLECTIONS.md\n"
      prompt+="When done, commit with message 'phase $phase: reflect'\n"
      ;;
  esac

  echo -e "$prompt"
}

# ─── Run One Step ───

run_step() {
  local phase="$1" step="$2"
  local prompt
  prompt=$(generate_prompt "$phase" "$step")
  
  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  echo "═══════════════════════════════════════"
  echo "Phase $phase | Step: $step"
  echo "═══════════════════════════════════════"

  write_state "$phase" "$step" "running"

  # Run CC in tmux — claude -p reads from stdin, outputs, exits
  # Using heredoc via temp file to avoid escaping issues
  tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude -p < $prompt_file 2>&1 | tee $PIPELINE_DIR/step-output.log" Enter

  # Wait for CC to finish (shell prompt returns)
  echo "Waiting for CC to finish..."
  while true; do
    sleep 10
    # Check if tmux pane shows shell prompt (CC exited)
    local last_line
    last_line=$(tmux capture-pane -t "$TMUX_SESSION" -p | grep -v '^$' | tail -1)
    
    # Shell prompt means CC finished — $ or % at end of line
    if echo "$last_line" | grep -qE '[\$%]\s*$'; then
      echo "CC finished (shell prompt detected)"
      break
    fi
    # Also check if the step output file stopped growing
  done

  sleep 2  # Brief pause for file writes to flush

  # Gate: after build step, tests MUST pass or we re-run CC
  if [ "$step" = "build" ]; then
    local max_retries=3
    local attempt=0
    while [ $attempt -lt $max_retries ]; do
      if npm test 2>&1 | tee "$PIPELINE_DIR/test-output.log"; then
        echo "✅ Tests passed!"
        break
      else
        attempt=$((attempt + 1))
        echo "❌ Tests failed (attempt $attempt/$max_retries)"
        if [ $attempt -lt $max_retries ]; then
          echo "Re-running CC to fix failing tests..."
          local fix_prompt="Tests are failing. Here is the output:\n\n\$(cat $PIPELINE_DIR/test-output.log)\n\nFix all failing tests. Run 'npm test' to verify. Do not commit until all tests pass."
          echo -e "$fix_prompt" > "$PIPELINE_DIR/current-prompt.md"
          tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude -p --dangerously-skip-permissions \"\$(cat $PIPELINE_DIR/current-prompt.md)\" 2>&1 | tee $PIPELINE_DIR/step-output.log" Enter
          sleep 15
          while true; do
            sleep 10
            local fix_line
            fix_line=$(tmux capture-pane -t "$TMUX_SESSION" -p | grep -v '^$' | tail -1)
            if echo "$fix_line" | grep -qE '@SmolButters .+ [%\$]\s*$'; then
              echo "CC fix attempt finished"
              break
            fi
          done
          sleep 2
        else
          echo "🛑 Tests still failing after $max_retries attempts. Stopping pipeline."
          write_state "$phase" "$step" "failed"
          update_status "$phase" "$step FAILED"
          git add -A STATUS.md .pipeline/ 2>/dev/null
          git commit -m "status: phase $phase build FAILED - tests not passing" 2>/dev/null || true
          git push origin master 2>/dev/null || true
          exit 1
        fi
      fi
    done
  fi

  # Update STATUS.md
  update_status "$phase" "$step"
  
  # Commit status + push
  git add -A STATUS.md .pipeline/state.json 2>/dev/null
  git commit -m "status: phase $phase $step complete" --allow-empty 2>/dev/null || true
  git push origin master 2>/dev/null || true
  
  write_state "$phase" "$step" "complete"
  echo "Step complete: phase $phase / $step"
}

# ─── Main Loop ───

echo "╔═══════════════════════════════════════╗"
echo "║   Artifact-Driven CC Pipeline v2      ║"
echo "║   Project: $(basename "$PROJECT_DIR")  "
echo "╚═══════════════════════════════════════╝"

phase=$(read_state phase)
current_step=$(read_state step)
is_complete=$(read_state project_complete)

if [ "$is_complete" = "true" ]; then
  echo "Project already marked complete. Exiting."
  exit 0
fi

# If current step is complete or pending, advance to next
if [ "$current_step" = "pending" ] || [ "$(read_state status)" = "complete" ]; then
  current_step=$(next_step "$current_step")
fi

# If step is "done", advance to next phase
if [ "$current_step" = "done" ]; then
  phase=$((phase + 1))
  current_step="spec"
fi

while [ "$phase" -le "$MAX_PHASES" ]; do
  # Check for PROJECT COMPLETE in last reflections
  local_reflect="$PHASES_DIR/phase-$((phase - 1))/REFLECTIONS.md"
  if [ -f "$local_reflect" ] && head -1 "$local_reflect" | grep -qi "PROJECT COMPLETE"; then
    mark_complete
    echo "🎉 PROJECT COMPLETE detected in phase $((phase - 1)) reflections!"
    exit 0
  fi

  # Run remaining steps in this phase
  while [ "$current_step" != "done" ]; do
    run_step "$phase" "$current_step"
    current_step=$(next_step "$current_step")
  done

  # Phase done — commit state and advance
  echo "Phase $phase complete! Advancing..."
  phase=$((phase + 1))
  current_step="spec"
  write_state "$phase" "pending" "ready"
  
  # Brief pause between phases
  sleep 5
done

echo "Hit MAX_PHASES ($MAX_PHASES). Stopping."
