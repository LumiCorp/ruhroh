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

if [[ -n "${CODEX_MODEL:-${RUHROH_AGENT_MODEL:-}}" ]]; then
  codex_args+=(--model "$codex_model")
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

RESULT_PATH="$result_path" \
ADAPTER_VERSION="$codex_adapter_version" \
MODEL_PROVIDER="${RUHROH_AGENT_PROVIDER:-openai}" \
MODEL_NAME="$codex_model" \
MODEL_CANONICAL_ID="${RUHROH_AGENT_MODEL_CANONICAL_ID:-}" \
MODEL_PROTOCOL="${RUHROH_AGENT_PROTOCOL:-}" \
MODEL_VERSION="${RUHROH_AGENT_MODEL_VERSION:-}" \
MODEL_PROMPT_VERSION="${RUHROH_AGENT_PROMPT_VERSION:-}" \
SUMMARY="Codex CLI completed the Ruhroh turn." \
PROMPT_PATH="$prompt_path" \
TRANSCRIPT_PATH="$transcript_path" \
LAST_MESSAGE_PATH="$last_message_path" \
node --input-type=module <<'NODE'
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const artifacts = {
  prompt: process.env.PROMPT_PATH,
  transcript: process.env.TRANSCRIPT_PATH,
  lastMessage: process.env.LAST_MESSAGE_PATH,
};
const summary = process.env.SUMMARY ?? "Codex CLI completed the Ruhroh turn.";
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
