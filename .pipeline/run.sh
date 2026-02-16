#!/usr/bin/env bash
set -euo pipefail

# ─── Artifact-Driven CC Pipeline v2 ───
# Dumb bash loop. CC does all the thinking.
# Each step: generate prompt → run CC (claude -p) in tmux → CC exits → gate check → advance → loop
# No AI in the orchestration layer. Intelligence lives in the prompt.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/.pipeline"
STATE_FILE="$PIPELINE_DIR/state.json"
PHASES_DIR="$PROJECT_DIR/docs/phases"
LOG_FILE="$PIPELINE_DIR/progress.log"
TMUX_SESSION="${1:-swimlanes}"
MAX_PHASES=20

STEPS=("spec" "research" "plan" "build" "review" "reflect")

cd "$PROJECT_DIR"

# ─── Logging ───

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

# ─── State ───

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
  local phase step
  phase=$(read_state phase)
  step=$(read_state step)
  cat > "$STATE_FILE" <<EOF
{
  "phase": $phase,
  "step": "$step",
  "status": "complete",
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
  echo "$PHASES_DIR/phase-$1"
}

# ─── Test Gate ───
# Reads CLAUDE.md for test command. If no CLAUDE.md or no test section, skips gate.

get_test_command() {
  local claude_md="$PROJECT_DIR/CLAUDE.md"
  if [ ! -f "$claude_md" ]; then
    echo ""
    return
  fi
  # Look for a line starting with ``` after a "## Testing" or "## Test" heading
  # Or a line that looks like a command after the testing heading
  local in_testing=false
  while IFS= read -r line; do
    if echo "$line" | grep -qiE '^##\s*test'; then
      in_testing=true
      continue
    fi
    if [ "$in_testing" = true ]; then
      # Skip empty lines and prose
      if echo "$line" | grep -qE '^\s*```'; then
        continue
      fi
      if echo "$line" | grep -qE '^\s*(npm|npx|yarn|pnpm|mix|pytest|cargo|go) '; then
        echo "$line" | sed 's/^\s*//'
        return
      fi
      # Stop at next heading
      if echo "$line" | grep -qE '^##'; then
        break
      fi
    fi
  done < "$claude_md"
  echo ""
}

# ─── Status Dashboard ───

update_status() {
  local phase="$1" step="$2"
  local commit_count file_count test_cmd coverage_info
  commit_count=$(git rev-list --count HEAD 2>/dev/null || echo "?")
  file_count=$(find "$PROJECT_DIR/src" -name "*.ts" -o -name "*.tsx" -o -name "*.astro" -o -name "*.ex" -o -name "*.py" 2>/dev/null | wc -l | tr -d ' ')
  test_cmd=$(get_test_command)
  
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')

  cat > "$PROJECT_DIR/STATUS.md" <<STATUSEOF
# SwimLanes — Build Status

## Current
**Phase:** $phase | **Step:** $step | **Updated:** $timestamp

## Progress
- **Commits:** $commit_count
- **Source files:** $file_count
- **Test command:** ${test_cmd:-"not yet configured"}

## Phase History
STATUSEOF

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
  prompt+="You are building a project. Read BRIEF.md for the full project description.\n"
  prompt+="Current phase: $phase | Current step: $step\n\n"

  # Include previous phase reflections
  if [ "$phase" -gt 1 ]; then
    local prev_reflect="$PHASES_DIR/phase-$((phase - 1))/REFLECTIONS.md"
    if [ -f "$prev_reflect" ]; then
      prompt+="Previous phase reflections (read this file): $prev_reflect\n\n"
    fi
  fi

  # Include CLAUDE.md reference for all phases after 1
  if [ "$phase" -gt 1 ] && [ -f "$PROJECT_DIR/CLAUDE.md" ]; then
    prompt+="Read CLAUDE.md for project conventions, test commands, and development setup.\n\n"
  fi

  case "$step" in
    spec)
      prompt+="TASK: Write a SPEC for phase $phase.\n"
      prompt+="Read BRIEF.md. Review what's been built so far (existing code, tests, previous phase artifacts in docs/phases/).\n"
      prompt+="Decide what this phase should accomplish. Write clear acceptance criteria.\n"
      prompt+="Output: docs/phases/phase-$phase/SPEC.md\n"
      
      if [ "$phase" -eq 1 ]; then
        prompt+="\n=== PHASE 1 REQUIREMENTS ===\n"
        prompt+="Phase 1 MUST include all of the following in its spec:\n"
        prompt+="1. Project scaffolding and dependency installation\n"
        prompt+="2. Choose and configure a test framework appropriate for this stack, WITH code coverage reporting\n"
        prompt+="3. Write initial tests that prove the setup works\n"
        prompt+="4. Create CLAUDE.md at the project root documenting:\n"
        prompt+="   - How to install dependencies\n"
        prompt+="   - How to run the project\n"
        prompt+="   - How to run tests (exact command)\n"
        prompt+="   - How to run tests with coverage (exact command)\n"
        prompt+="   - Project structure overview\n"
        prompt+="5. Create/update README.md at the project root with:\n"
        prompt+="   - Project description\n"
        prompt+="   - Getting started (install, run, test)\n"
        prompt+="   - Any scripts added and how to use them\n"
        prompt+="Phase 1 is the foundation. Every future phase depends on a solid test framework and clear documentation.\n"
        prompt+="=== END PHASE 1 REQUIREMENTS ===\n"
      fi
      
      prompt+="\nWhen done, commit with message 'phase $phase: spec'\n"
      ;;
    research)
      prompt+="TASK: Research for phase $phase.\n"
      prompt+="Read docs/phases/phase-$phase/SPEC.md.\n"
      prompt+="Research technical decisions, library choices, or patterns needed.\n"
      prompt+="Output: docs/phases/phase-$phase/RESEARCH.md\n"
      prompt+="When done, commit with message 'phase $phase: research'\n"
      ;;
    plan)
      prompt+="TASK: Create implementation plan for phase $phase.\n"
      prompt+="Read SPEC.md and RESEARCH.md in docs/phases/phase-$phase/.\n"
      prompt+="Write a detailed plan: files to create/modify, order of operations, test strategy.\n"
      prompt+="Output: docs/phases/phase-$phase/PLAN.md\n"
      prompt+="When done, commit with message 'phase $phase: plan'\n"
      ;;
    build)
      prompt+="TASK: Implement phase $phase.\n"
      prompt+="Read SPEC.md, RESEARCH.md, and PLAN.md in docs/phases/phase-$phase/.\n"
      if [ -f "$PROJECT_DIR/CLAUDE.md" ]; then
        prompt+="Read CLAUDE.md for test commands and project conventions.\n"
      fi
      prompt+="Write code AND tests. All tests must pass before you commit.\n"
      prompt+="Run the test command to verify. Run coverage to confirm coverage is not decreasing.\n"
      prompt+="Update README.md if you add any new scripts or commands.\n"
      prompt+="When done, commit with message 'phase $phase: build'\n"
      ;;
    review)
      prompt+="TASK: Review the build output for phase $phase.\n"
      prompt+="Read the SPEC.md acceptance criteria. Review ALL code changes.\n"
      prompt+="Verify: Do all tests pass? Are acceptance criteria met? Is test coverage acceptable?\n"
      prompt+="If issues found, fix them and re-run tests.\n"
      prompt+="Output: docs/phases/phase-$phase/REVIEW.md (findings, test results, coverage report)\n"
      prompt+="When done, commit with message 'phase $phase: review'\n"
      ;;
    reflect)
      prompt+="TASK: Reflect on phase $phase and set direction.\n"
      prompt+="Read all artifacts in docs/phases/phase-$phase/.\n"
      prompt+="Write: what was built, what worked, what didn't, tech debt, carry-forward.\n"
      prompt+="Decide what the NEXT phase should focus on (based on BRIEF.md remaining goals).\n"
      prompt+="If ALL goals in BRIEF.md are now complete, write 'PROJECT COMPLETE' as the first line.\n"
      prompt+="Output: docs/phases/phase-$phase/REFLECTIONS.md\n"
      prompt+="When done, commit with message 'phase $phase: reflect'\n"
      ;;
  esac

  echo -e "$prompt"
}

# ─── Wait for CC ───

wait_for_cc() {
  sleep 15  # Give CC time to start
  while true; do
    sleep 10
    local last_line
    last_line=$(tmux capture-pane -t "$TMUX_SESSION" -p | grep -v '^$' | tail -1)
    # Shell prompt: user@host dir % or $
    if echo "$last_line" | grep -qE '@.+ .+ [%$]'; then
      break
    fi
  done
  sleep 2
}

# ─── Run One Step ───

run_step() {
  local phase="$1" step="$2"
  local prompt
  prompt=$(generate_prompt "$phase" "$step")
  
  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  log "═══ Phase $phase | Step: $step ═══"
  write_state "$phase" "$step" "running"

  # Run CC in tmux
  tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude -p --dangerously-skip-permissions \"\$(cat $prompt_file)\" 2>&1 | tee $PIPELINE_DIR/step-output.log" Enter

  log "Waiting for CC to finish..."
  wait_for_cc
  log "CC finished"

  # Test gate after build step
  if [ "$step" = "build" ]; then
    local test_cmd
    test_cmd=$(get_test_command)
    if [ -n "$test_cmd" ]; then
      log "Running test gate: $test_cmd"
      local max_retries=3
      local attempt=0
      while [ $attempt -lt $max_retries ]; do
        if eval "$test_cmd" 2>&1 | tee "$PIPELINE_DIR/test-output.log"; then
          log "✅ Tests passed!"
          break
        else
          attempt=$((attempt + 1))
          log "❌ Tests failed (attempt $attempt/$max_retries)"
          if [ $attempt -lt $max_retries ]; then
            log "Re-running CC to fix tests..."
            cat > "$PIPELINE_DIR/current-prompt.md" <<FIXEOF
Tests are failing after the build step. Here is the test output:

$(cat "$PIPELINE_DIR/test-output.log")

Fix all failing tests. Run the test command from CLAUDE.md to verify everything passes before committing.
FIXEOF
            tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude -p --dangerously-skip-permissions \"\$(cat $PIPELINE_DIR/current-prompt.md)\" 2>&1 | tee $PIPELINE_DIR/step-output.log" Enter
            wait_for_cc
          else
            log "🛑 Tests still failing after $max_retries attempts. Pipeline stopped."
            write_state "$phase" "$step" "failed"
            update_status "$phase" "$step-FAILED"
            git add -A && git commit -m "status: phase $phase build FAILED" 2>/dev/null || true
            git push origin master 2>/dev/null || true
            exit 1
          fi
        fi
      done
    else
      log "⚠️  No test command found in CLAUDE.md — skipping test gate"
    fi
  fi

  # Update status, commit, push
  update_status "$phase" "$step"
  git add -A STATUS.md .pipeline/state.json .pipeline/progress.log 2>/dev/null
  git commit -m "status: phase $phase $step complete" --allow-empty 2>/dev/null || true
  git push origin master 2>/dev/null || true

  write_state "$phase" "$step" "complete"
  log "Step complete: phase $phase / $step"
}

# ─── Main Loop ───

log "╔═══════════════════════════════════════╗"
log "║   Artifact-Driven CC Pipeline v2      ║"
log "║   Project: $(basename "$PROJECT_DIR")"
log "║   tmux: $TMUX_SESSION"
log "╚═══════════════════════════════════════╝"

phase=$(read_state phase)
current_step=$(read_state step)
is_complete=$(read_state project_complete)

if [ "$is_complete" = "true" ]; then
  log "Project already marked complete. Exiting."
  exit 0
fi

if [ "$current_step" = "pending" ] || [ "$(read_state status)" = "complete" ]; then
  current_step=$(next_step "$current_step")
fi

if [ "$current_step" = "done" ]; then
  phase=$((phase + 1))
  current_step="spec"
fi

while [ "$phase" -le "$MAX_PHASES" ]; do
  # Check for PROJECT COMPLETE
  local_reflect="$PHASES_DIR/phase-$((phase - 1))/REFLECTIONS.md"
  if [ -f "$local_reflect" ] && head -1 "$local_reflect" | grep -qi "PROJECT COMPLETE"; then
    mark_complete
    log "🎉 PROJECT COMPLETE detected in phase $((phase - 1)) reflections!"
    update_status "$phase" "PROJECT COMPLETE"
    git add -A && git commit -m "🎉 PROJECT COMPLETE" 2>/dev/null || true
    git push origin master 2>/dev/null || true
    exit 0
  fi

  while [ "$current_step" != "done" ]; do
    run_step "$phase" "$current_step"
    current_step=$(next_step "$current_step")
  done

  log "Phase $phase complete! Advancing..."
  phase=$((phase + 1))
  current_step="spec"
  write_state "$phase" "pending" "ready"
  sleep 5
done

log "Hit MAX_PHASES ($MAX_PHASES). Stopping."
