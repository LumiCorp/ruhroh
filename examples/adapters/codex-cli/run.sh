#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
message="${RUHROH_MESSAGE:-}"
iteration="${RUHROH_ITERATION:-1}"
result_path="${RUHROH_RESULT_PATH:-}"
codex_bin="${CODEX_CLI_BIN:-codex}"
codex_model="${CODEX_MODEL:-${RUHROH_AGENT_MODEL:-codex-cli}}"
codex_adapter_version="${CODEX_CLI_ADAPTER_VERSION:-0.1.0}"

if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE or RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

if ! command -v "$codex_bin" >/dev/null 2>&1; then
  echo "Codex CLI not found: $codex_bin" >&2
  echo "Install Codex CLI and set CODEX_CLI_BIN if the binary is not named codex." >&2
  exit 127
fi

mkdir -p "$workspace/.ruhroh"
prompt_path="$workspace/.ruhroh/codex-prompt-${iteration}.md"
transcript_path="$workspace/.ruhroh/codex-transcript-${iteration}.log"
last_message_path="$workspace/.ruhroh/codex-last-message-${iteration}.md"

cat > "$prompt_path" <<PROMPT
You are running inside a Ruhroh benchmark workspace.

Original/continuation task:

${message}

Work only inside this workspace:

${workspace}

Implement the requested app or continue the existing implementation. Preserve useful files and commands in the workspace. When the user goal is satisfied, stop normally; the wrapper will emit the Ruhroh completion signal.
PROMPT

codex_args=(
  exec
  --skip-git-repo-check
  --sandbox "${CODEX_SANDBOX:-workspace-write}"
  --ask-for-approval "${CODEX_APPROVAL_POLICY:-never}"
  --output-last-message "$last_message_path"
)

if [[ -n "${CODEX_MODEL:-}" ]]; then
  codex_args+=(--model "$CODEX_MODEL")
fi

if [[ -n "${CODEX_PROFILE:-}" ]]; then
  codex_args+=(--profile "$CODEX_PROFILE")
fi

if [[ -n "${CODEX_CLI_EXTRA_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  extra_args=($CODEX_CLI_EXTRA_ARGS)
  codex_args+=("${extra_args[@]}")
fi

codex_args+=(-)

(
  cd "$workspace"
  "$codex_bin" "${codex_args[@]}" < "$prompt_path"
) >"$transcript_path" 2>&1

if [[ -n "$result_path" ]]; then
  mkdir -p "$(dirname "$result_path")"
  cat > "$result_path" <<JSON
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "adapterVersion": "$codex_adapter_version",
  "model": {
    "provider": "openai",
    "model": "$codex_model"
  },
  "summary": "Codex CLI completed the Ruhroh turn.",
  "artifacts": {
    "prompt": "$prompt_path",
    "transcript": "$transcript_path",
    "lastMessage": "$last_message_path"
  }
}
JSON
fi

printf '{"status":"goal_satisfied","summary":"Codex CLI completed the Ruhroh turn.","artifacts":{"prompt":"%s","transcript":"%s","lastMessage":"%s"}}\n' "$prompt_path" "$transcript_path" "$last_message_path"
