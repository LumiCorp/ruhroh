#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
message="${RUHROH_MESSAGE:-}"
iteration="${RUHROH_ITERATION:-1}"
session_handle="${RUHROH_SESSION_HANDLE:-ruhroh-custom-shell}"
result_path="${RUHROH_RESULT_PATH:-}"
gemini_bin="${GEMINI_CLI_BIN:-gemini}"
gemini_model="${GEMINI_MODEL:-${RUHROH_AGENT_MODEL:-gemini-cli}}"
gemini_adapter_version="${GEMINI_CLI_ADAPTER_VERSION:-0.1.0}"

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

RESULT_PATH="$result_path" \
ADAPTER_VERSION="$gemini_adapter_version" \
MODEL_PROVIDER="google" \
MODEL_NAME="$gemini_model" \
SUMMARY="Gemini CLI completed the Ruhroh turn." \
PROMPT_PATH="$prompt_path" \
TRANSCRIPT_PATH="$transcript_path" \
node --input-type=module <<'NODE'
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const artifacts = {
  prompt: process.env.PROMPT_PATH,
  transcript: process.env.TRANSCRIPT_PATH,
};
const summary = process.env.SUMMARY ?? "Gemini CLI completed the Ruhroh turn.";
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
