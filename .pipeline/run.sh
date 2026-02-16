#!/usr/bin/env bash
set -uo pipefail
# Note: -e removed intentionally — we handle errors explicitly. 
# With -e, any failed command in update_status or status dashboard kills the whole pipeline.

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

STEPS=("spec" "research" "plan" "build" "review" "reflect" "commit")

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
    reflect)  echo "commit" ;;
    commit)   echo "done" ;;
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

  local prompt_file="$PIPELINE_DIR/prompts/$step.md"
  if [ ! -f "$prompt_file" ]; then
    log "ERROR: Prompt file not found: $prompt_file"
    exit 1
  fi

  # Build template variables
  local prev_reflections=""
  if [ "$phase" -gt 1 ]; then
    local prev_reflect="$PHASES_DIR/phase-$((phase - 1))/REFLECTIONS.md"
    if [ -f "$prev_reflect" ]; then
      prev_reflections="Previous phase reflections (read this file): $prev_reflect"
    fi
  fi

  # Read prompt template and substitute variables
  local prompt
  prompt=$(cat "$prompt_file")
  prompt="${prompt//\{\{PHASE\}\}/$phase}"
  prompt="${prompt//\{\{PREV_REFLECTIONS\}\}/$prev_reflections}"

  echo "$prompt"
}

# ─── Wait for CC ───

wait_for_cc() {
  local sentinel="$PIPELINE_DIR/.step-done"
  # Poll for sentinel file — CC creates it when done
  while [ ! -f "$sentinel" ]; do
    sleep 5
  done
  rm -f "$sentinel"
  sleep 1
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

  # Run CC in tmux — use a sentinel file to detect completion (more reliable than prompt regex)
  local sentinel="$PIPELINE_DIR/.step-done"
  rm -f "$sentinel"

  # Chain: run CC, then touch sentinel when done
  tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude -p --dangerously-skip-permissions \"\$(cat $prompt_file)\" > $PIPELINE_DIR/step-output.log 2>&1 && touch $sentinel" Enter

  log "Waiting for CC to finish..."
  wait_for_cc
  log "CC finished"

  # Test gate after build and review steps
  if [ "$step" = "build" ] || [ "$step" = "review" ]; then
    local test_cmd
    test_cmd=$(get_test_command)
    if [ -n "$test_cmd" ]; then
      log "Running test gate: $test_cmd"
      if eval "$test_cmd" 2>&1 | tee "$PIPELINE_DIR/test-output.log"; then
        log "✅ Tests passed!"
      else
        log "🛑 Tests failing after $step step. Pipeline stopped."
        write_state "$phase" "$step" "failed"
        update_status "$phase" "$step-FAILED"
        exit 1
      fi
    else
      log "⚠️  No test command found in CLAUDE.md — skipping test gate"
    fi
  fi

  # After commit step: push to remote
  if [ "$step" = "commit" ]; then
    git push origin master 2>/dev/null || true
    log "Pushed to remote"
  fi

  # Update status
  update_status "$phase" "$step"

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
