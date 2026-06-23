#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
message="${RUHROH_MESSAGE:-}"
iteration="${RUHROH_ITERATION:-1}"
session_handle="${RUHROH_SESSION_HANDLE:-ruhroh-custom-shell}"
result_path="${RUHROH_RESULT_PATH:-}"
gemini_bin="${GEMINI_CLI_BIN:-gemini}"

if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE or RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

if ! command -v "$gemini_bin" >/dev/null 2>&1; then
  echo "Gemini CLI not found: $gemini_bin" >&2
  echo "Install the official Gemini CLI and set GEMINI_CLI_BIN if the binary is not named gemini." >&2
  exit 127
fi

mkdir -p "$workspace/.ruhroh"
prompt_path="$workspace/.ruhroh/gemini-prompt-${iteration}.md"
transcript_path="$workspace/.ruhroh/gemini-transcript-${iteration}.log"

cat > "$prompt_path" <<PROMPT
You are running inside a Ruhroh benchmark workspace.

Original/continuation task:

${message}

Work only inside this workspace:

${workspace}

Implement the requested app or continue the existing implementation. Preserve useful files and commands in the workspace. When the user goal is satisfied, finish normally; the wrapper will emit the Ruhroh completion signal.
PROMPT

(
  cd "$workspace"
  "$gemini_bin" -p "$(cat "$prompt_path")"
) >"$transcript_path" 2>&1

if [[ -n "$result_path" ]]; then
  mkdir -p "$(dirname "$result_path")"
  cat > "$result_path" <<JSON
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "summary": "Gemini CLI completed the Ruhroh turn.",
  "artifacts": {
    "prompt": "$prompt_path",
    "transcript": "$transcript_path"
  }
}
JSON
fi

printf '{"status":"goal_satisfied","summary":"Gemini CLI completed the Ruhroh turn.","artifacts":{"prompt":"%s","transcript":"%s"}}\n' "$prompt_path" "$transcript_path"
