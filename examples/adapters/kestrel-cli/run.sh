#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_WORKSPACE_PATH:-${RUHROH_WORKSPACE:-}}"
message="${RUHROH_MESSAGE:-}"
iteration="${RUHROH_ITERATION:-1}"
scenario_id="${RUHROH_SCENARIO_ID:-ruhroh-scenario}"
session_handle="${RUHROH_SESSION_HANDLE:-}"
result_path="${RUHROH_RESULT_PATH:-}"
kestrel_bin="${KESTREL_CLI_BIN:-kestrel}"
adapter_version="${KESTREL_CLI_ADAPTER_VERSION:-0.1.0}"
run_mode="${RUHROH_RUN_MODE:-build}"

if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE or RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

if [[ -z "$session_handle" ]]; then
  echo "RUHROH_SESSION_HANDLE is required for Kestrel continuity" >&2
  exit 2
fi

if ! command -v "$kestrel_bin" >/dev/null 2>&1; then
  echo "Kestrel CLI not found: $kestrel_bin" >&2
  echo "Install Kestrel and set KESTREL_CLI_BIN if the binary is not named kestrel." >&2
  exit 127
fi

case "$run_mode" in
  build|plan|chat) ;;
  *)
    echo "Unsupported RUHROH_RUN_MODE: $run_mode" >&2
    exit 2
    ;;
esac

artifact_dir="$workspace/.ruhroh/kestrel-cli"
mkdir -p "$artifact_dir"
job_input_path="$artifact_dir/job-input-${iteration}.json"
job_output_path="$artifact_dir/job-output-${iteration}.json"
event_log_path="$artifact_dir/events-${iteration}.jsonl"
transcript_path="$artifact_dir/transcript-${iteration}.log"
: > "$event_log_path"

JOB_INPUT_PATH="$job_input_path" \
WORKSPACE="$workspace" \
MESSAGE="$message" \
ITERATION="$iteration" \
SCENARIO_ID="$scenario_id" \
SESSION_HANDLE="$session_handle" \
RUN_MODE="$run_mode" \
node --input-type=module <<'NODE'
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputPath = process.env.JOB_INPUT_PATH;
const workspace = process.env.WORKSPACE;
const sessionId = process.env.SESSION_HANDLE;
const runMode = process.env.RUN_MODE;
if (!outputPath || !workspace || !sessionId || !runMode) {
  throw new Error("Kestrel adapter input environment is incomplete");
}

const actSubmode = runMode === "build"
  ? (process.env.KESTREL_ACT_SUBMODE || "full_auto")
  : undefined;
const profileId = process.env.KESTREL_PROFILE_ID?.trim();
const input = {
  version: "job_input_v1",
  storeDriver: process.env.KESTREL_STORE_DRIVER || "auto",
  approvalPolicyPackId: process.env.KESTREL_APPROVAL_POLICY_PACK_ID || "dev",
  ...(profileId ? { profileId } : {}),
  turn: {
    sessionId,
    message: process.env.MESSAGE || "",
    eventType: "job.run",
    interactionMode: runMode,
    ...(actSubmode ? { actSubmode } : {}),
    metadata: {
      ruhroh: {
        scenarioId: process.env.SCENARIO_ID || "ruhroh-scenario",
        iteration: Number.parseInt(process.env.ITERATION || "1", 10),
        sampleId: process.env.RUHROH_SAMPLE_ID || undefined,
        sampleSeed: process.env.RUHROH_SAMPLE_SEED || undefined,
      },
    },
    workspace: {
      workspaceId: `ruhroh:${process.env.SCENARIO_ID || "scenario"}`,
      workspaceRoot: workspace,
      appRoot: workspace,
      commands: {},
      label: `Ruhroh ${process.env.SCENARIO_ID || "scenario"}`,
    },
  },
};

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
NODE

set +e
KESTREL_JOB_EVENT_LOG_PATH="$event_log_path" \
  "$kestrel_bin" job run --json-in "$job_input_path" --json-out "$job_output_path" \
  >"$transcript_path" 2>&1
kestrel_exit_code=$?
set -e

RESULT_PATH="$result_path" \
JOB_INPUT_PATH="$job_input_path" \
JOB_OUTPUT_PATH="$job_output_path" \
EVENT_LOG_PATH="$event_log_path" \
TRANSCRIPT_PATH="$transcript_path" \
ADAPTER_VERSION="$adapter_version" \
KESTREL_EXIT_CODE="$kestrel_exit_code" \
node --input-type=module <<'NODE'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const jobOutputPath = process.env.JOB_OUTPUT_PATH;
let output;
let parseError;
if (jobOutputPath && existsSync(jobOutputPath)) {
  try {
    output = JSON.parse(readFileSync(jobOutputPath, "utf8"));
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }
}

const kestrelExitCode = Number.parseInt(process.env.KESTREL_EXIT_CODE || "1", 10);
const job = output && typeof output === "object" && !Array.isArray(output)
  ? output.job
  : undefined;
const terminalEventType = output?.terminalEventType;
const jobStatus = job?.status;
let status = "runtime_failure";
if (kestrelExitCode === 0 && (terminalEventType === "job.cancelled" || jobStatus === "CANCELLED")) {
  status = "cancelled";
} else if (kestrelExitCode === 0 && terminalEventType === "job.completed") {
  if (jobStatus === "COMPLETED") {
    status = "goal_satisfied";
  } else if (jobStatus === "WAITING") {
    status = "continue";
  }
}

const summary = status === "goal_satisfied"
  ? "Kestrel completed the Ruhroh turn."
  : status === "continue"
    ? "Kestrel is waiting and the Ruhroh loop should continue the same session."
    : status === "cancelled"
      ? "Kestrel cancelled the Ruhroh turn."
    : `Kestrel job failed (exit=${kestrelExitCode}, terminal=${String(terminalEventType)}, status=${String(jobStatus)}${parseError ? `, parse=${parseError}` : ""}).`;
const artifacts = {
  jobInput: process.env.JOB_INPUT_PATH,
  jobOutput: jobOutputPath,
  eventLog: process.env.EVENT_LOG_PATH,
  transcript: process.env.TRANSCRIPT_PATH,
};
const finalizedPayload = job?.result?.finalizedPayload;
const result = {
  version: "ruhroh_run_agent_result_v1",
  status,
  adapterVersion: process.env.ADAPTER_VERSION,
  model: {
    provider: process.env.RUHROH_AGENT_PROVIDER || "kestrel",
    model: process.env.RUHROH_AGENT_MODEL || process.env.KCHAT_MODEL || "configured-by-kestrel",
    canonicalId: process.env.RUHROH_AGENT_MODEL_CANONICAL_ID || undefined,
    protocol: process.env.RUHROH_AGENT_PROTOCOL || "kestrel-job-v1",
    version: process.env.RUHROH_AGENT_MODEL_VERSION || undefined,
    promptVersion: process.env.RUHROH_AGENT_PROMPT_VERSION || undefined,
  },
  summary,
  runId: typeof job?.runId === "string" ? job.runId : undefined,
  threadId: typeof job?.threadId === "string" ? job.threadId : undefined,
  eventLogPath: process.env.EVENT_LOG_PATH,
  jobInputPath: process.env.JOB_INPUT_PATH,
  jobOutputPath,
  finalizedPayload,
  waitFor: job?.waitFor,
  replay: job?.replay,
  artifacts,
};
const resultPath = process.env.RESULT_PATH;
if (resultPath) {
  mkdirSync(path.dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify({ status, summary, artifacts }));
if (status === "runtime_failure") {
  process.exitCode = kestrelExitCode === 0 ? 2 : kestrelExitCode;
}
NODE
