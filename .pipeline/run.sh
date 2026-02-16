#!/usr/bin/env bash
set -uo pipefail

# ─── YAML-Driven CC Pipeline Engine ───
# Reads workflow.yaml for step order, agents, and routing.
# State derived from pipeline.jsonl (append-only, no state file).
# Agents: claude-piped, claude-interactive, codex-exec, codex-interactive, bash

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIPELINE_DIR="$PROJECT_DIR/.pipeline"
WORKFLOW_FILE="$PIPELINE_DIR/workflow.yaml"
PHASES_DIR=$(yq '.phases_dir // "docs/phases"' "$WORKFLOW_FILE")
LOG_FILE="$PIPELINE_DIR/pipeline.jsonl"
TMUX_SESSION="$(basename "$PROJECT_DIR")"
RUN_PHASES="${1:-0}"  # 0 = unlimited (up to MAX_PHASES)
MAX_PHASES=20

cd "$PROJECT_DIR"

# ─── Signal Handling ───

CHILD_PID=""

cleanup() {
  echo ""
  log "Pipeline interrupted by user (SIGINT)"
  if [ -n "$CHILD_PID" ]; then
    kill "$CHILD_PID" 2>/dev/null || true
    wait "$CHILD_PID" 2>/dev/null || true
  fi
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

# ─── Workflow Parsing ───

get_step_count() {
  yq '.steps | length' "$WORKFLOW_FILE"
}

get_step_field() {
  # get_step_field <index> <field>
  yq ".steps[$1].$2 // \"\"" "$WORKFLOW_FILE" | sed 's/^null$//'
}

get_step_names() {
  yq '.steps[].name' "$WORKFLOW_FILE"
}

get_step_index_by_name() {
  local target="$1"
  local count
  count=$(get_step_count)
  for ((i=0; i<count; i++)); do
    local name
    name=$(get_step_field "$i" "name")
    if [ "$name" = "$target" ]; then
      echo "$i"
      return
    fi
  done
  echo "-1"
}

next_step_name() {
  local current="$1"
  local count
  count=$(get_step_count)
  local idx
  idx=$(get_step_index_by_name "$current")
  local next=$((idx + 1))
  if [ "$next" -ge "$count" ]; then
    echo "done"
  else
    get_step_field "$next" "name"
  fi
}

first_step_name() {
  get_step_field 0 "name"
}

# ─── State (derived from JSONL) ───

get_current_state() {
  if [ ! -f "$LOG_FILE" ]; then
    echo "1 pending ready"
    return
  fi

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

# ─── Prompt Generation ───

generate_prompt() {
  local phase="$1" prompt_path="$2"
  local prompt_file="$PIPELINE_DIR/$prompt_path"
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
      if echo "$line" | grep -qE '^\s*```'; then continue; fi
      if echo "$line" | grep -qE '^\s*(npm|npx|yarn|pnpm|mix|pytest|cargo|go) '; then
        echo "$line" | sed 's/^\s*//'
        return
      fi
      if echo "$line" | grep -qE '^##'; then break; fi
    fi
  done < "$claude_md"
  echo ""
}

run_test_gate() {
  local phase="$1" step="$2"
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
# $(basename "$PROJECT_DIR") — Build Status

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
  echo -e "\n---\n*Auto-updated by pipeline*" >> "$PROJECT_DIR/STATUS.md"
}

# ─── Agent: claude-piped ───

run_claude_piped() {
  local phase="$1" step="$2" prompt_path="$3" model="$4"
  local prompt
  prompt=$(generate_prompt "$phase" "$prompt_path")
  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  local model_flag=""
  if [ -n "$model" ]; then
    model_flag="--model $model"
  fi

  claude -p --dangerously-skip-permissions $model_flag "$(cat "$prompt_file")" > "$PIPELINE_DIR/step-output.log" 2>&1 &
  CHILD_PID=$!
  wait $CHILD_PID
  local exit_code=$?
  CHILD_PID=""
  return $exit_code
}

# ─── Agent: codex-exec ───

run_codex_exec() {
  local phase="$1" step="$2" prompt_path="$3" model="$4"
  local prompt
  prompt=$(generate_prompt "$phase" "$prompt_path")
  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  local model_flag=""
  if [ -n "$model" ]; then
    model_flag="--model $model"
  fi

  codex exec $model_flag "$(cat "$prompt_file")" > "$PIPELINE_DIR/step-output.log" 2>&1 &
  CHILD_PID=$!
  wait $CHILD_PID
  local exit_code=$?
  CHILD_PID=""
  return $exit_code
}

# ─── Agent: Interactive (claude or codex in tmux) ───

start_interactive() {
  local agent="$1" model="$2"
  local cmd

  if [ "$agent" = "claude-interactive" ]; then
    cmd="cd $PROJECT_DIR && claude --dangerously-skip-permissions"
    if [ -n "$model" ]; then
      cmd="cd $PROJECT_DIR && claude --model $model --dangerously-skip-permissions"
    fi
  elif [ "$agent" = "codex-interactive" ]; then
    cmd="cd $PROJECT_DIR && codex"
    if [ -n "$model" ]; then
      cmd="cd $PROJECT_DIR && codex --model $model"
    fi
  fi

  # Ensure tmux session exists
  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux new-session -d -s "$TMUX_SESSION" -c "$PROJECT_DIR"
  fi

  log "Starting $agent session in tmux..."
  tmux send-keys -t "$TMUX_SESSION" "$cmd" Enter

  local attempts=0
  while [ $attempts -lt 30 ]; do
    local pane_content
    pane_content=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -5 2>/dev/null)
    if echo "$pane_content" | grep -qE '(bypass permissions|Welcome back|Claude Code v|Codex CLI)'; then
      sleep 3
      break
    fi
    sleep 2
    attempts=$((attempts + 1))
  done
  if [ $attempts -ge 30 ]; then
    log "ERROR: $agent failed to start after 60s"
    exit 1
  fi
  log "$agent session started"
}

stop_interactive() {
  log "Stopping interactive session..."
  local pane_content
  pane_content=$(tmux capture-pane -t "$TMUX_SESSION" -p -S -3 2>/dev/null)
  if echo "$pane_content" | grep -qE '(^\$|%\s*$)'; then
    log "Session already exited"
    return
  fi
  tmux send-keys -t "$TMUX_SESSION" "/exit"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Escape
  sleep 0.5
  tmux send-keys -t "$TMUX_SESSION" Enter
  sleep 2
  log "Session stopped"
}

run_interactive() {
  local phase="$1" step="$2" prompt_path="$3" agent="$4" model="$5"
  local prompt
  prompt=$(generate_prompt "$phase" "$prompt_path")
  local prompt_file="$PIPELINE_DIR/current-prompt.md"
  echo -e "$prompt" > "$prompt_file"

  # Append sentinel
  local sentinel="$PIPELINE_DIR/.step-done"
  rm -f "$sentinel"
  echo -e "\n\n---\nWhen you have completed ALL tasks above, run this command as your FINAL action:\n\`touch $sentinel\`" >> "$prompt_file"

  start_interactive "$agent" "$model"

  # Send prompt via load-buffer
  tmux load-buffer "$prompt_file"
  tmux paste-buffer -t "$TMUX_SESSION"
  sleep 1
  tmux send-keys -t "$TMUX_SESSION" Enter

  # Wait for sentinel
  while [ ! -f "$sentinel" ]; do
    sleep 5
  done
  rm -f "$sentinel"
  sleep 1

  stop_interactive
}

# ─── Agent: bash ───

run_bash() {
  local phase="$1" command_template="$2"
  local cmd="${command_template//\{\{PHASE\}\}/$phase}"
  eval "$cmd" 2>/dev/null || true
}

# ─── Usage Check ───

check_usage() {
  local phase="$1" step="$2"

  if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    tmux new-session -d -s "$TMUX_SESSION" -c "$PROJECT_DIR"
  fi

  local usage_window="usage-check"
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

# ─── Run One Step (YAML-driven router) ───

run_step() {
  local phase="$1" step_name="$2"
  local idx
  idx=$(get_step_index_by_name "$step_name")

  if [ "$idx" = "-1" ]; then
    log "ERROR: Unknown step: $step_name"
    exit 1
  fi

  local agent prompt_path model skip_unless output test_gate command
  agent=$(get_step_field "$idx" "agent")
  prompt_path=$(get_step_field "$idx" "prompt")
  model=$(get_step_field "$idx" "model")
  skip_unless=$(get_step_field "$idx" "skip_unless")
  output=$(get_step_field "$idx" "output")
  test_gate=$(get_step_field "$idx" "test_gate")
  command=$(get_step_field "$idx" "command")

  # Check skip_unless condition
  if [ -n "$skip_unless" ]; then
    local check_file="$PHASES_DIR/phase-$phase/$skip_unless"
    if [ ! -f "$check_file" ]; then
      log_event "step_skip" phase="$phase" step="$step_name" reason="$skip_unless not found"
      return
    fi
  fi

  # Ensure phase dir exists
  mkdir -p "$(phase_dir "$phase")"

  log_event "step_start" phase="$phase" step="$step_name" agent="$agent" model="${model:-default}"

  # Route to agent
  case "$agent" in
    claude-piped)
      run_claude_piped "$phase" "$step_name" "$prompt_path" "$model"
      ;;
    codex-exec)
      run_codex_exec "$phase" "$step_name" "$prompt_path" "$model"
      ;;
    claude-interactive|codex-interactive)
      run_interactive "$phase" "$step_name" "$prompt_path" "$agent" "$model"
      ;;
    bash)
      run_bash "$phase" "$command"
      ;;
    *)
      log "ERROR: Unknown agent: $agent"
      exit 1
      ;;
  esac

  log_event "step_done" phase="$phase" step="$step_name" agent="$agent" status="ok"

  # Validate output if specified
  if [ -n "$output" ]; then
    local output_file="$PHASES_DIR/phase-$phase/$output"
    if [ -f "$output_file" ]; then
      log_event "output_verified" phase="$phase" step="$step_name" file="$output"
    else
      log_event "output_missing" phase="$phase" step="$step_name" file="$output"
      log "WARNING: Expected output $output not found after $step_name"
    fi
  fi

  # Test gate if configured
  if [ "$test_gate" = "true" ]; then
    run_test_gate "$phase" "$step_name"
  fi

  update_status "$phase" "$step_name"
  log_event "step_complete" phase="$phase" step="$step_name"
}

# ─── Main Loop ───

# Print attach instructions
echo "Attach to tmux session with: tmux attach -t $TMUX_SESSION"
echo ""

# Usage check at start
usage_when=$(yq '.usage_check.when // "phase_boundary"' "$WORKFLOW_FILE")
check_usage "0" "pipeline_start"

# Banner
workflow_name=$(yq '.name // "Pipeline"' "$WORKFLOW_FILE")
step_names=$(yq '.steps[].name' "$WORKFLOW_FILE" | tr '\n' ',' | sed 's/,$//')
log "╔═══════════════════════════════════════╗"
log "║   $workflow_name"
log "║   Project: $(basename "$PROJECT_DIR")"
log "║   Steps: $step_names"
log "║   tmux: $TMUX_SESSION"
log "╚═══════════════════════════════════════╝"

# Derive state from JSONL
state_line=$(get_current_state)
phase=$(echo "$state_line" | awk '{print $1}')
current_step=$(echo "$state_line" | awk '{print $2}')
status=$(echo "$state_line" | awk '{print $3}')

log "Resumed state: phase=$phase step=$current_step status=$status"

# Advance past completed steps
if [ "$current_step" = "pending" ] || [ "$status" = "complete" ]; then
  if [ "$current_step" = "pending" ] || [ "$current_step" = "done" ]; then
    current_step=$(first_step_name)
    if [ "$current_step" = "done" ] || [ "$status" = "complete" ] && [ "$current_step" != "pending" ]; then
      current_step=$(next_step_name "$current_step")
      # If last step was complete, we need to advance
      if [ "$status" = "complete" ] && [ "$(echo "$state_line" | awk '{print $2}')" != "pending" ] && [ "$(echo "$state_line" | awk '{print $2}')" != "done" ]; then
        current_step=$(next_step_name "$(echo "$state_line" | awk '{print $2}')")
      fi
    fi
  else
    current_step=$(next_step_name "$current_step")
  fi
elif [ "$status" = "running" ]; then
  log "Resuming interrupted step: phase $phase / $current_step"
fi

if [ "$current_step" = "done" ]; then
  phase=$((phase + 1))
  current_step=$(first_step_name)
fi

phases_run=0
while [ "$phase" -le "$MAX_PHASES" ]; do
  # Check for PROJECT COMPLETE
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
    current_step=$(next_step_name "$current_step")
  done

  log_event "phase_complete" phase="$phase"

  # Usage check at phase boundary
  if [ "$usage_when" = "phase_boundary" ] || [ "$usage_when" = "every_step" ]; then
    check_usage "$phase" "phase_end"
  fi

  phases_run=$((phases_run + 1))

  if [ "$RUN_PHASES" -gt 0 ] && [ "$phases_run" -ge "$RUN_PHASES" ]; then
    log "Completed $phases_run phase(s) as requested. Stopping."
    exit 0
  fi

  phase=$((phase + 1))
  current_step=$(first_step_name)
  sleep 5
done

log "Hit MAX_PHASES ($MAX_PHASES). Stopping."
