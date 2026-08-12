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
turn_started_at="$(node --input-type=module -e 'process.stdout.write(new Date().toISOString())')"
turn_started_epoch_ms="$(node --input-type=module -e 'process.stdout.write(String(Date.now()))')"

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
ITERATION="$iteration" \
SCENARIO_ID="$scenario_id" \
SESSION_HANDLE="$session_handle" \
TURN_STARTED_AT="$turn_started_at" \
TURN_STARTED_EPOCH_MS="$turn_started_epoch_ms" \
node --input-type=module <<'NODE'
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fileEvidence = (artifact) => existsSync(artifact)
  ? { artifact, sha256: sha256(readFileSync(artifact)) }
  : undefined;

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
const resultProtocol = process.env.RUHROH_RUN_AGENT_RESULT_PROTOCOL;
const emitV2 = resultProtocol === "ruhroh_run_agent_result_v2";
const eventTypes = [];
const eventLogPath = process.env.EVENT_LOG_PATH;
if (eventLogPath && existsSync(eventLogPath)) {
  for (const line of readFileSync(eventLogPath, "utf8").split(/\r?\n/u)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (typeof event?.type === "string" && /^[A-Za-z0-9._:-]{1,128}$/u.test(event.type) && !eventTypes.includes(event.type)) {
        eventTypes.push(event.type);
      }
    } catch {
      // Malformed event lines are not promoted into the economic trace.
    }
  }
}
const endedAt = new Date().toISOString();
const startedEpochMs = Number.parseInt(process.env.TURN_STARTED_EPOCH_MS || "", 10);
const traceId = sha256(`kestrel-trace:${process.env.SCENARIO_ID || "scenario"}:${process.env.SESSION_HANDLE || "session"}`);
const spanId = sha256(`${traceId}:turn:${process.env.ITERATION || "1"}`);
const evidenceRefs = [
  jobOutputPath ? fileEvidence(jobOutputPath) : undefined,
  eventLogPath ? fileEvidence(eventLogPath) : undefined,
].filter(Boolean);
const economicTraceSpans = emitV2 ? [{
  version: "ruhroh_economic_trace_span_v1",
  traceId,
  spanId,
  kind: "agent_turn",
  status: status === "runtime_failure" ? "error" : status === "cancelled" ? "cancelled" : "ok",
  startedAt: process.env.TURN_STARTED_AT || endedAt,
  endedAt,
  durationMs: Number.isFinite(startedEpochMs) ? Math.max(0, Date.now() - startedEpochMs) : undefined,
  iteration: Number.parseInt(process.env.ITERATION || "1", 10),
  agent: {
    adapterId: "kestrel-cli",
    agentIdHash: sha256(`kestrel-agent:${process.env.SESSION_HANDLE || "session"}`),
    depth: 0,
  },
  evidenceRefs,
  eventTypes,
}] : undefined;
const result = {
  version: emitV2 ? "ruhroh_run_agent_result_v2" : "ruhroh_run_agent_result_v1",
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
  ...(emitV2 ? {
    economicTraceSpans,
    adapterManifest: {
      version: "ruhroh_adapter_manifest_v1",
      adapterId: "kestrel-cli",
      adapterVersion: process.env.ADAPTER_VERSION,
      resultProtocol: "ruhroh_run_agent_result_v2",
      traceProtocol: "ruhroh_economic_trace_span_v1",
      resources: {},
    },
  } : {}),
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
