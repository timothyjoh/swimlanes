#!/usr/bin/env bash
set -uo pipefail
# Note: -e removed intentionally — we handle errors explicitly.

# ─── Artifact-Driven CC Pipeline v3 (Hybrid) ───
# Doc steps (spec, research, plan, review, reflect) → claude -p (piped mode, no tmux)
# Build step → interactive CC in tmux (needs agent teams, tools, multi-step)
# Commit step → pure bash (no CC needed)
# Usage check → interactive CC in separate tmux window

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/.pipeline"
PHASES_DIR="$PROJECT_DIR/docs/phases"
LOG_FILE="$PIPELINE_DIR/pipeline.jsonl"
TMUX_SESSION="$(basename "$PROJECT_DIR")"
RUN_PHASES="${1:-0}"  # 0 = unlimited (up to MAX_PHASES)
MAX_PHASES=20

STEPS=("spec" "research" "plan" "build" "review" "fix" "reflect" "commit")

# Steps that use piped mode (output docs only)
PIPED_STEPS="spec research plan review reflect"

cd "$PROJECT_DIR"

# ─── Signal Handling ───

cleanup() {
  echo ""
  log "Pipeline interrupted by user (SIGINT)"
  # Kill any running claude -p subprocess
  pkill -P $$ 2>/dev/null || true
  exit 130
}

trap cleanup SIGINT SIGTERM

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

# ─── State (derived from JSONL) ───

get_current_state() {
  # Returns "phase step status" from the last relevant event in the log
  # If no log exists, returns "1 pending ready"
  if [ ! -f "$LOG_FILE" ]; then
    echo "1 pending ready"
    return
  fi

  # Find the last step-related event
  local last_event
  last_event=$(jq -s '[.[] | select(.event=="step_start" or .event=="step_done" or .event=="step_complete" or .event=="step_skip" or .event=="phase_complete")] | last' "$LOG_FILE" 2>/dev/null)

  if [ -z "$last_event" ] || [ "$last_event" = "null" ]; then
    echo "1 pending ready"
    return
  fi

  local event phase step
  event=$(echo "$last_event" | jq -r '.event')
  phase=$(echo "$last_event" | jq -r '.phase')
  step=$(echo "$last_event" | jq -r '.step // "pending"')

  case "$event" in
    step_start)
      echo "$phase $step running"
      ;;
    step_done|step_complete|step_skip)
      echo "$phase $step complete"
      ;;
    phase_complete)
      echo "$phase done complete"
      ;;
    *)
      echo "1 pending ready"
      ;;
  esac
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

is_piped_step() {
  echo "$PIPED_STEPS" | grep -qw "$1"
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

# ─── Piped Mode (doc steps) ───

run_step_piped() {
  local phase="$1" step="$2"
  local prompt
  prompt=$(generate_prompt "$phase" "$step")

  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  log_event "step_start" phase="$phase" step="$step" mode="piped"

  # Run CC in piped mode — simple, no tmux needed
  if claude -p --dangerously-skip-permissions "$(cat "$prompt_file")" > "$PIPELINE_DIR/step-output.log" 2>&1; then
    log_event "step_done" phase="$phase" step="$step" status="ok" mode="piped"
  else
    log_event "step_done" phase="$phase" step="$step" status="error" mode="piped"
  fi
}

# ─── Interactive Mode (build step) ───

start_cc() {
  log "Starting interactive CC session in tmux..."
  tmux send-keys -t "$TMUX_SESSION" "cd $PROJECT_DIR && claude --dangerously-skip-permissions" Enter
  local attempts=0
  while [ $attempts -lt 30 ]; do
    local pane_content
    pane_content=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -5 2>/dev/null)
    if echo "$pane_content" | grep -qE '(bypass permissions|Welcome back|Claude Code v)'; then
      sleep 3
      break
    fi
    sleep 2
    attempts=$((attempts + 1))
  done
  if [ $attempts -ge 30 ]; then
    log "ERROR: CC failed to start after 60s"
    exit 1
  fi
  log "CC session started"
}

stop_cc() {
  log "Stopping CC session..."
  local pane_content
  pane_content=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -3 2>/dev/null)
  if echo "$pane_content" | grep -qE '(^\$|%\s*$)'; then
    log "CC already exited"
    return
  fi
  tmux send-keys -t "$TMUX_SESSION" "/exit"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 0.5
  tmux send-keys -t "$TMUX_SESSION" Enter
  sleep 2
  log "CC session stopped"
}

send_prompt_to_cc() {
  local prompt_file="$1"
  tmux load-buffer "$prompt_file"
  tmux paste-buffer -t "$TMUX_SESSION"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Enter
}

wait_for_cc() {
  local sentinel="$PIPELINE_DIR/.step-done"
  while [ ! -f "$sentinel" ]; do
    sleep 5
  done
  rm -f "$sentinel"
  sleep 1
}

run_step_interactive() {
  local phase="$1" step="$2"
  local prompt
  prompt=$(generate_prompt "$phase" "$step")

  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  log_event "step_start" phase="$phase" step="$step" mode="interactive"

  # Append sentinel instruction
  local sentinel="$PIPELINE_DIR/.step-done"
  rm -f "$sentinel"
  echo -e "\n\n---\nWhen you have completed ALL tasks above, run this command as your FINAL action:\n\`touch $sentinel\`" >> "$prompt_file"

  start_cc
  send_prompt_to_cc "$prompt_file"

  wait_for_cc
  log_event "step_done" phase="$phase" step="$step" status="ok" mode="interactive"
  stop_cc
}

# ─── Usage Check (separate tmux window) ───

check_usage() {
  local phase="$1" step="$2"
  local usage_window="usage-check"

  # Ensure tmux session exists for usage check
  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux new-session -d -s "$TMUX_SESSION" -c "$PROJECT_DIR"
  fi

  tmux new-window -t "$TMUX_SESSION" -n "$usage_window" -d "cd $PROJECT_DIR && claude --dangerously-skip-permissions"

  local attempts=0
  while [ $attempts -lt 30 ]; do
    local pane_content
    pane_content=$(tmux capture-pane -t "$TMUX_SESSION:$usage_window" -p -S -5 2>/dev/null)
    if echo "$pane_content" | grep -qE '(bypass permissions|Welcome back|Claude Code v)'; then
      sleep 2
      break
    fi
    sleep 2
    attempts=$((attempts + 1))
  done

  if [ $attempts -lt 30 ]; then
    tmux send-keys -t "$TMUX_SESSION:$usage_window" "/usage"
    sleep 1
    tmux send-keys -t "$TMUX_SESSION:$usage_window" Escape
    sleep 0.5
    tmux send-keys -t "$TMUX_SESSION:$usage_window" Enter
    sleep 3

    local usage_raw
    usage_raw=$(tmux capture-pane -t "$TMUX_SESSION:$usage_window" -p -S -30 2>/dev/null || echo "capture failed")

    local usage_escaped
    usage_escaped=$(echo "$usage_raw" | jq -Rsn '[inputs] | join("\\n")' 2>/dev/null || echo "\"parse error\"")
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    echo "{\"ts\":\"$timestamp\",\"event\":\"usage_check\",\"phase\":\"$phase\",\"step\":\"$step\",\"usage\":$usage_escaped}" >> "$LOG_FILE"

    tmux send-keys -t "$TMUX_SESSION:$usage_window" Escape
    sleep 0.5
    tmux send-keys -t "$TMUX_SESSION:$usage_window" "/exit"
    sleep 1
    tmux send-keys -t "$TMUX_SESSION:$usage_window" Escape
    sleep 0.5
    tmux send-keys -t "$TMUX_SESSION:$usage_window" Enter
    sleep 2
  fi

  tmux kill-window -t "$TMUX_SESSION:$usage_window" 2>/dev/null || true
}

# ─── Commit Step (pure bash) ───

run_step_commit() {
  local phase="$1"
  log_event "step_start" phase="$phase" step="commit" mode="bash"

  git add -A
  git commit -m "Phase $phase complete" 2>/dev/null || true
  git push origin master 2>/dev/null || true
  log_event "git_push" phase="$phase"

  log_event "step_done" phase="$phase" step="commit" status="ok" mode="bash"
}

# ─── Run One Step (router) ───

run_step() {
  local phase="$1" step="$2"

  if [ "$step" = "commit" ]; then
    run_step_commit "$phase"
  elif [ "$step" = "fix" ]; then
    # Conditional — only run if MUST-FIX.md exists
    local must_fix="$PHASES_DIR/phase-$phase/MUST-FIX.md"
    if [ -f "$must_fix" ]; then
      run_step_interactive "$phase" "$step"
    else
      log_event "step_skip" phase="$phase" step="fix" reason="no MUST-FIX.md (review passed)"
      return
    fi
  elif [ "$step" = "build" ]; then
    run_step_interactive "$phase" "$step"
  elif is_piped_step "$step"; then
    run_step_piped "$phase" "$step"
  else
    run_step_interactive "$phase" "$step"
  fi

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
        update_status "$phase" "$step-FAILED"
        exit 1
      fi
    else
      log_event "test_gate_skip" phase="$phase" step="$step" reason="no test command"
    fi
  fi

  update_status "$phase" "$step"
  log_event "step_complete" phase="$phase" step="$step"
}

# ─── Main Loop ───

# Initial usage check
check_usage "0" "pipeline_start"

log "╔═══════════════════════════════════════╗"
log "║   CC Pipeline v3 (Hybrid)            ║"
log "║   Project: $(basename "$PROJECT_DIR")"
log "║   Piped: spec,research,plan,review,reflect"
log "║   Interactive: build (tmux: $TMUX_SESSION)"
log "║   State: derived from pipeline.jsonl"
log "╚═══════════════════════════════════════╝"

# Derive state from JSONL log
state_line=$(get_current_state)
phase=$(echo "$state_line" | awk '{print $1}')
current_step=$(echo "$state_line" | awk '{print $2}')
status=$(echo "$state_line" | awk '{print $3}')

log "Resumed state: phase=$phase step=$current_step status=$status"

# Advance past completed/skipped steps
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
    log_event "project_complete" phase="$((phase - 1))"
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
  sleep 5
done

log "Hit MAX_PHASES ($MAX_PHASES). Stopping."
