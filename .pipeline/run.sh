#!/usr/bin/env bash
set -uo pipefail
# Note: -e removed intentionally — we handle errors explicitly. 
# With -e, any failed command in update_status or status dashboard kills the whole pipeline.

# ─── Artifact-Driven CC Pipeline v3 ───
# Dumb bash loop. CC does all the thinking.
# Each step: generate prompt → paste into interactive CC via load-buffer → wait for sentinel → gate check → advance → loop
# Uses tmux load-buffer + paste-buffer for reliable prompt delivery (no shell escaping issues).
# No AI in the orchestration layer. Intelligence lives in the prompt.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/.pipeline"
STATE_FILE="$PIPELINE_DIR/state.json"
PHASES_DIR="$PROJECT_DIR/docs/phases"
LOG_FILE="$PIPELINE_DIR/pipeline.jsonl"
TMUX_SESSION="$(basename "$PROJECT_DIR")"
RUN_PHASES="${1:-0}"  # 0 = unlimited (up to MAX_PHASES)
MAX_PHASES=20

STEPS=("spec" "research" "plan" "build" "review" "reflect" "commit")

cd "$PROJECT_DIR"

# ─── Logging ───

log() {
  local msg="$*"
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  echo "$msg"
  echo "{\"ts\":\"$timestamp\",\"msg\":$(jq -Rn --arg m "$msg" '$m')}" >> "$LOG_FILE"
}

log_event() {
  # Structured log entry: log_event <event> [key=value ...]
  local event="$1"; shift
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  local json="{\"ts\":\"$timestamp\",\"event\":\"$event\""
  while [ $# -gt 0 ]; do
    local key="${1%%=*}"
    local val="${1#*=}"
    json="$json,\"$key\":$(jq -Rn --arg v "$val" '$v')"
    shift
  done
  json="$json}"
  echo "$json" >> "$LOG_FILE"
  echo "[$event] $@"
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

# ─── Interactive CC Session Management ───

start_cc() {
  log "Starting interactive CC session in tmux..."
  tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude --dangerously-skip-permissions" Enter
  sleep 3  # Give CC time to start up
  log "CC session started"
}

stop_cc() {
  log "Stopping CC session..."
  # /exit → Escape (dismiss autocomplete) → Enter
  tmux send-keys -t "$TMUX_SESSION" "/exit"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 0.5
  tmux send-keys -t "$TMUX_SESSION" Enter
  sleep 2
  log "CC session stopped"
}

check_usage() {
  # Start CC, run /usage, capture output, exit
  local phase="$1" step="$2"
  start_cc

  # /usage → Escape → Enter to get usage info
  tmux send-keys -t "$TMUX_SESSION" "/usage"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 0.5
  tmux send-keys -t "$TMUX_SESSION" Enter
  sleep 3  # Give it time to display

  # Capture the pane and extract usage text
  local usage_raw
  usage_raw=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -20 2>/dev/null || echo "capture failed")
  
  # Log raw usage to JSONL (escape for JSON)
  local usage_escaped
  usage_escaped=$(echo "$usage_raw" | jq -Rsn '[inputs] | join("\\n")' 2>/dev/null || echo "\"parse error\"")
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  echo "{\"ts\":\"$timestamp\",\"event\":\"usage_check\",\"phase\":\"$phase\",\"step\":\"$step\",\"usage\":$usage_escaped}" >> "$LOG_FILE"

  stop_cc
}

send_prompt_to_cc() {
  local prompt_file="$1"
  # load-buffer + paste-buffer: reliable for any prompt size, no escaping issues
  tmux load-buffer "$prompt_file"
  tmux paste-buffer -t "$TMUX_SESSION"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Enter
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

  log_event "step_start" phase="$phase" step="$step"
  write_state "$phase" "$step" "running"

  # Append sentinel instruction to prompt so CC touches it when done
  local sentinel="$PIPELINE_DIR/.step-done"
  rm -f "$sentinel"
  echo -e "\n\n---\nWhen you have completed ALL tasks above, run this command as your FINAL action:\n\`touch $sentinel\`" >> "$prompt_file"

  # Fresh CC session per step (clean context each time)
  start_cc
  send_prompt_to_cc "$prompt_file"

  wait_for_cc
  log_event "step_done" phase="$phase" step="$step" status="ok"
  stop_cc

  # Test gate after build and review steps
  if [ "$step" = "build" ] || [ "$step" = "review" ]; then
    local test_cmd
    test_cmd=$(get_test_command)
    if [ -n "$test_cmd" ]; then
      log_event "test_gate_start" phase="$phase" step="$step" cmd="$test_cmd"
      if eval "$test_cmd" 2>&1 | tee "$PIPELINE_DIR/test-output.log"; then
        log_event "test_gate_pass" phase="$phase" step="$step"
      else
        log_event "test_gate_fail" phase="$phase" step="$step"
        write_state "$phase" "$step" "failed"
        update_status "$phase" "$step-FAILED"
        exit 1
      fi
    else
      log_event "test_gate_skip" phase="$phase" step="$step" reason="no test command"
    fi
  fi

  # After commit step: push to remote
  if [ "$step" = "commit" ]; then
    git push origin master 2>/dev/null || true
    log_event "git_push" phase="$phase"
  fi

  # Update status
  update_status "$phase" "$step"

  write_state "$phase" "$step" "complete"
  log_event "step_complete" phase="$phase" step="$step"
}

# ─── Main Loop ───

log "╔═══════════════════════════════════════╗"
log "║   Artifact-Driven CC Pipeline v3      ║"
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

status=$(read_state status)
if [ "$current_step" = "pending" ] || [ "$status" = "complete" ]; then
  current_step=$(next_step "$current_step")
elif [ "$status" = "running" ]; then
  log "Resuming interrupted step: phase $phase / $current_step"
  # Re-run the interrupted step
fi

if [ "$current_step" = "done" ]; then
  phase=$((phase + 1))
  current_step="spec"
fi

phases_run=0
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

  log_event "phase_complete" phase="$phase"
  check_usage "$phase" "phase_end"
  phases_run=$((phases_run + 1))

  if [ "$RUN_PHASES" -gt 0 ] && [ "$phases_run" -ge "$RUN_PHASES" ]; then
    log "Completed $phases_run phase(s) as requested. Stopping."
    exit 0
  fi

  phase=$((phase + 1))
  current_step="spec"
  write_state "$phase" "pending" "ready"
  sleep 5
done

log "Hit MAX_PHASES ($MAX_PHASES). Stopping."
