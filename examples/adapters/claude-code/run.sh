#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
message="${RUHROH_MESSAGE:-}"
iteration="${RUHROH_ITERATION:-1}"
result_path="${RUHROH_RESULT_PATH:-}"
claude_bin="${CLAUDE_CODE_BIN:-claude}"
claude_model="${CLAUDE_MODEL:-${RUHROH_AGENT_MODEL:-claude-code}}"
claude_adapter_version="${CLAUDE_CODE_ADAPTER_VERSION:-0.1.0}"

if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE or RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

if ! command -v "$claude_bin" >/dev/null 2>&1; then
  echo "Claude Code CLI not found: $claude_bin" >&2
  echo "Install Claude Code and set CLAUDE_CODE_BIN if the binary is not named claude." >&2
  exit 127
fi

mkdir -p "$workspace/.ruhroh"
prompt_path="$workspace/.ruhroh/claude-prompt-${iteration}.md"
transcript_path="$workspace/.ruhroh/claude-transcript-${iteration}.log"

cat > "$prompt_path" <<PROMPT
You are running inside a Ruhroh benchmark workspace.

Original/continuation task:

${message}

Work only inside this workspace:

${workspace}

Implement the requested app or continue the existing implementation. Preserve useful files and commands in the workspace. When the user goal is satisfied, stop normally; the wrapper will emit the Ruhroh completion signal.
PROMPT

claude_args=(
  --print
  --permission-mode "${CLAUDE_PERMISSION_MODE:-acceptEdits}"
  --output-format "${CLAUDE_OUTPUT_FORMAT:-text}"
  --add-dir "$workspace"
)

if [[ -n "${CLAUDE_MODEL:-}" ]]; then
  claude_args+=(--model "$CLAUDE_MODEL")
fi

if [[ -n "${CLAUDE_CODE_EXTRA_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  extra_args=($CLAUDE_CODE_EXTRA_ARGS)
  claude_args+=("${extra_args[@]}")
fi

(
  cd "$workspace"
  "$claude_bin" "${claude_args[@]}" "$(cat "$prompt_path")"
) >"$transcript_path" 2>&1

if [[ -n "$result_path" ]]; then
  mkdir -p "$(dirname "$result_path")"
  cat > "$result_path" <<JSON
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "adapterVersion": "$claude_adapter_version",
  "model": {
    "provider": "anthropic",
    "model": "$claude_model"
  },
  "summary": "Claude Code completed the Ruhroh turn.",
  "artifacts": {
    "prompt": "$prompt_path",
    "transcript": "$transcript_path"
  }
}
JSON
fi

printf '{"status":"goal_satisfied","summary":"Claude Code completed the Ruhroh turn.","artifacts":{"prompt":"%s","transcript":"%s"}}\n' "$prompt_path" "$transcript_path"
