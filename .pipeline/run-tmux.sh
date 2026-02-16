#!/usr/bin/env bash
set -uo pipefail

# ─── Artifact-Driven CC Pipeline v3 (All-Interactive / tmux) ───
# All steps run in a single interactive CC session in tmux.
# Between steps: /clear wipes context, then paste next prompt.
# CC stays running the entire pipeline — no start/stop overhead.
# Uses load-buffer + paste-buffer for reliable prompt delivery.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/.pipeline"
STATE_FILE="$PIPELINE_DIR/state.json"
PHASES_DIR="$PROJECT_DIR/docs/phases"
LOG_FILE="$PIPELINE_DIR/pipeline.jsonl"
TMUX_SESSION="$(basename "$PROJECT_DIR")"
RUN_PHASES="${1:-0}"  # 0 = unlimited (up to MAX_PHASES)
MAX_PHASES=20

STEPS=("spec" "research" "plan" "build" "review" "fix" "reflect" "commit")

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
  local event="$1"; shift
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  local json="{\"ts\":\"$timestamp\",\"event\":\"$event\""
  local display="[$event]"
  while [ $# -gt 0 ]; do
    local key="${1%%=*}"
    local val="${1#*=}"
    json="$json,\"$key\":$(jq -Rn --arg v "$val" '$v')"
    display="$display $key=$val"
    shift
  done
  json="$json}"
  echo "$json" >> "$LOG_FILE"
  echo "$display"
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
    review)   echo "fix" ;;
    fix)      echo "reflect" ;;
    reflect)  echo "commit" ;;
    commit)   echo "done" ;;
    *)        echo "spec" ;;
  esac
}

phase_dir() {
  echo "$PHASES_DIR/phase-$1"
}

# ─── Test Gate ───

get_test_command() {
  local claude_md="$PROJECT_DIR/CLAUDE.md"
  if [ ! -f "$claude_md" ]; then
    echo ""
    return
  fi
  local in_testing=false
  while IFS= read -r line; do
    if echo "$line" | grep -qiE '^##\s*test'; then
      in_testing=true
      continue
    fi
    if [ "$in_testing" = true ]; then
      if echo "$line" | grep -qE '^\s*```'; then
        continue
      fi
      if echo "$line" | grep -qE '^\s*(npm|npx|yarn|pnpm|mix|pytest|cargo|go) '; then
        echo "$line" | sed 's/^\s*//'
        return
      fi
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
  local file_count test_cmd
  file_count=$(find "$PROJECT_DIR/src" -name "*.ts" -o -name "*.tsx" -o -name "*.astro" -o -name "*.ex" -o -name "*.py" 2>/dev/null | wc -l | tr -d ' ')
  test_cmd=$(get_test_command)
  
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M')

  cat > "$PROJECT_DIR/STATUS.md" <<STATUSEOF
# SwimLanes — Build Status

## Current
**Phase:** $phase | **Step:** $step | **Updated:** $timestamp

## Progress
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

  local prev_reflections=""
  if [ "$phase" -gt 1 ]; then
    local prev_reflect="$PHASES_DIR/phase-$((phase - 1))/REFLECTIONS.md"
    if [ -f "$prev_reflect" ]; then
      prev_reflections="Previous phase reflections (read this file): $prev_reflect"
    fi
  fi

  local prompt
  prompt=$(cat "$prompt_file")
  prompt="${prompt//\{\{PHASE\}\}/$phase}"
  prompt="${prompt//\{\{PREV_REFLECTIONS\}\}/$prev_reflections}"

  echo "$prompt"
}

# ─── CC Session Management ───

cc_is_running() {
  local pane_content
  pane_content=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -5 2>/dev/null)
  if echo "$pane_content" | grep -qE '(bypass permissions|Welcome back|Claude Code v|Crunched)'; then
    return 0  # CC is running
  fi
  return 1  # CC is not running (shell prompt)
}

ensure_cc() {
  # Make sure tmux session exists
  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux new-session -d -s "$TMUX_SESSION" -c "$PROJECT_DIR"
    log "Created tmux session: $TMUX_SESSION"
  fi

  # Check if CC is already running
  if cc_is_running; then
    log "CC already running"
    return
  fi

  # Start CC
  log "Starting CC in tmux..."
  tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude --dangerously-skip-permissions" Enter

  # Wait for CC to be ready
  local attempts=0
  while [ $attempts -lt 30 ]; do
    if cc_is_running; then
      sleep 3  # Buffer for full readiness
      log "CC is ready"
      return
    fi
    sleep 2
    attempts=$((attempts + 1))
  done

  log "ERROR: CC failed to start after 60s"
  exit 1
}

clear_cc() {
  # /clear → Escape (dismiss autocomplete) → Enter
  tmux send-keys -t "$TMUX_SESSION" "/clear"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 0.5
  tmux send-keys -t "$TMUX_SESSION" Enter
  sleep 2
  log "CC context cleared"
}

send_prompt() {
  local prompt_file="$1"
  tmux load-buffer "$prompt_file"
  tmux paste-buffer -t "$TMUX_SESSION"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Enter
}

wait_for_sentinel() {
  local sentinel="$PIPELINE_DIR/.step-done"
  while [ ! -f "$sentinel" ]; do
    sleep 5
  done
  rm -f "$sentinel"
  sleep 1
}

# ─── Usage Check ───

check_usage() {
  local phase="$1" step="$2"

  ensure_cc
  clear_cc

  tmux send-keys -t "$TMUX_SESSION" "/usage"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 0.5
  tmux send-keys -t "$TMUX_SESSION" Enter
  sleep 3

  local usage_raw
  usage_raw=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -30 2>/dev/null || echo "capture failed")

  local usage_escaped
  usage_escaped=$(echo "$usage_raw" | jq -Rsn '[inputs] | join("\\n")' 2>/dev/null || echo "\"parse error\"")
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  echo "{\"ts\":\"$timestamp\",\"event\":\"usage_check\",\"phase\":\"$phase\",\"step\":\"$step\",\"usage\":$usage_escaped}" >> "$LOG_FILE"

  # Dismiss the usage panel
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 1
}

# ─── Run One Step ───

run_step() {
  local phase="$1" step="$2"

  # Commit step is pure bash — no CC needed
  if [ "$step" = "commit" ]; then
    log_event "step_start" phase="$phase" step="commit" mode="bash"
    write_state "$phase" "commit" "running"
    git add -A
    git commit -m "Phase $phase complete" 2>/dev/null || true
    git push origin master 2>/dev/null || true
    log_event "git_push" phase="$phase"
    log_event "step_done" phase="$phase" step="commit" status="ok" mode="bash"
    update_status "$phase" "$step"
    write_state "$phase" "$step" "complete"
    log_event "step_complete" phase="$phase" step="$step"
    return
  fi

  # Fix step is conditional — skip if no MUST-FIX.md
  if [ "$step" = "fix" ]; then
    local must_fix="$PHASES_DIR/phase-$phase/MUST-FIX.md"
    if [ ! -f "$must_fix" ]; then
      log_event "step_skip" phase="$phase" step="fix" reason="no MUST-FIX.md (review passed)"
      write_state "$phase" "$step" "complete"
      return
    fi
  fi

  local prompt
  prompt=$(generate_prompt "$phase" "$step")

  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  log_event "step_start" phase="$phase" step="$step" mode="interactive"
  write_state "$phase" "$step" "running"

  # Append sentinel instruction
  local sentinel="$PIPELINE_DIR/.step-done"
  rm -f "$sentinel"
  echo -e "\n\n---\nWhen you have completed ALL tasks above, run this command as your FINAL action:\n\`touch $sentinel\`" >> "$prompt_file"

  # Ensure CC is running, clear context, send prompt
  ensure_cc
  clear_cc
  send_prompt "$prompt_file"

  wait_for_sentinel
  log_event "step_done" phase="$phase" step="$step" status="ok" mode="interactive"

  # Test gate after build and fix steps
  if [ "$step" = "build" ] || [ "$step" = "fix" ]; then
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

  update_status "$phase" "$step"
  write_state "$phase" "$step" "complete"
  log_event "step_complete" phase="$phase" step="$step"
}

# ─── Main Loop ───

echo "Attach to tmux session with: tmux attach -t $TMUX_SESSION"
echo ""

# Initial usage check
check_usage "0" "pipeline_start"

log "╔═══════════════════════════════════════╗"
log "║   CC Pipeline v3 (All-Interactive)   ║"
log "║   Project: $(basename "$PROJECT_DIR")"
log "║   tmux: $TMUX_SESSION"
log "║   Mode: /clear between steps"
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
fi

if [ "$current_step" = "done" ]; then
  phase=$((phase + 1))
  current_step="spec"
fi

phases_run=0
while [ "$phase" -le "$MAX_PHASES" ]; do
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
