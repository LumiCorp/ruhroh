#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
message="${RUHROH_MESSAGE:-}"
iteration="${RUHROH_ITERATION:-1}"
result_path="${RUHROH_RESULT_PATH:-}"
aider_bin="${AIDER_BIN:-aider}"
aider_model="${AIDER_MODEL:-${RUHROH_AGENT_MODEL:-aider}}"
aider_adapter_version="${AIDER_ADAPTER_VERSION:-0.1.0}"

if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE or RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

if ! command -v "$aider_bin" >/dev/null 2>&1; then
  echo "Aider CLI not found: $aider_bin" >&2
  echo "Install Aider and set AIDER_BIN if the binary is not named aider." >&2
  exit 127
fi

mkdir -p "$workspace/.ruhroh"
prompt_path="$workspace/.ruhroh/aider-prompt-${iteration}.md"
transcript_path="$workspace/.ruhroh/aider-transcript-${iteration}.log"
chat_history_path="$workspace/.ruhroh/aider-chat-history.md"
input_history_path="$workspace/.ruhroh/aider-input-history"
llm_history_path="$workspace/.ruhroh/aider-llm-history.md"
env_file_path="$workspace/.ruhroh/aider.env"
touch "$env_file_path"

cat > "$prompt_path" <<PROMPT
You are running inside a Ruhroh benchmark workspace.

Original/continuation task:

${message}

Work only inside this workspace:

${workspace}

Implement the requested app or continue the existing implementation. Preserve useful files and commands in the workspace. When the user goal is satisfied, stop normally; the wrapper will emit the Ruhroh completion signal.
PROMPT

aider_args=(
  --yes-always
  --no-check-update
  --analytics-disable
  --map-tokens
  0
  --no-stream
  --timeout
  "${AIDER_TIMEOUT:-120}"
  --no-auto-commits
  --no-git
  --no-gitignore
  --chat-history-file
  "$chat_history_path"
  --input-history-file
  "$input_history_path"
  --llm-history-file
  "$llm_history_path"
  --env-file
  "$env_file_path"
  --message-file "$prompt_path"
)

if [[ -n "${AIDER_FILES:-}" ]]; then
  IFS=":" read -r -a aider_files <<< "$AIDER_FILES"
  for aider_file in "${aider_files[@]}"; do
    if [[ -n "$aider_file" ]]; then
      aider_args+=(--file "$aider_file")
    fi
  done
fi

if [[ -n "${AIDER_MODEL:-${RUHROH_AGENT_MODEL:-}}" ]]; then
  aider_args+=(--model "$aider_model")
fi

if [[ -n "${AIDER_EXTRA_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  extra_args=($AIDER_EXTRA_ARGS)
  aider_args+=("${extra_args[@]}")
fi

if [[ "${RUHROH_STREAM_AGENT_OUTPUT:-}" =~ ^(1|true|yes|on)$ ]]; then
  (
    cd "$workspace"
    "$aider_bin" "${aider_args[@]}"
  ) 2>&1 | tee "$transcript_path"
else
  (
    cd "$workspace"
    "$aider_bin" "${aider_args[@]}"
  ) >"$transcript_path" 2>&1
fi

RESULT_PATH="$result_path" \
ADAPTER_VERSION="$aider_adapter_version" \
MODEL_PROVIDER="${RUHROH_AGENT_PROVIDER:-aider}" \
MODEL_NAME="$aider_model" \
MODEL_CANONICAL_ID="${RUHROH_AGENT_MODEL_CANONICAL_ID:-}" \
MODEL_PROTOCOL="${RUHROH_AGENT_PROTOCOL:-}" \
MODEL_VERSION="${RUHROH_AGENT_MODEL_VERSION:-}" \
MODEL_PROMPT_VERSION="${RUHROH_AGENT_PROMPT_VERSION:-}" \
SUMMARY="Aider completed the Ruhroh turn." \
PROMPT_PATH="$prompt_path" \
TRANSCRIPT_PATH="$transcript_path" \
node --input-type=module <<'NODE'
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const artifacts = {
  prompt: process.env.PROMPT_PATH,
  transcript: process.env.TRANSCRIPT_PATH,
};
const summary = process.env.SUMMARY ?? "Aider completed the Ruhroh turn.";
const resultPath = process.env.RESULT_PATH;

if (resultPath !== undefined && resultPath.length > 0) {
  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify({
    version: "ruhroh_run_agent_result_v1",
    status: "goal_satisfied",
    adapterVersion: process.env.ADAPTER_VERSION,
    model: {
      provider: process.env.MODEL_PROVIDER,
      model: process.env.MODEL_NAME,
      canonicalId: process.env.MODEL_CANONICAL_ID || undefined,
      protocol: process.env.MODEL_PROTOCOL || undefined,
      version: process.env.MODEL_VERSION || undefined,
      promptVersion: process.env.MODEL_PROMPT_VERSION || undefined,
    },
    summary,
    artifacts,
  }, null, 2)}\n`);
}

console.log(JSON.stringify({
  status: "goal_satisfied",
  summary,
  artifacts,
}));
NODE
