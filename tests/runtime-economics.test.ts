import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  budgetCapabilityErrors,
  evaluateResourceBudgets,
  finalizeEconomicTraceJsonl,
  legacyUsageToEconomicsEnvelope,
  normalizeEconomicsObservations,
  runAdapterConformance,
  sha256CanonicalJson,
  validateEconomicTrace,
  validateEconomicTraceSpan,
  validateProcessTermination,
  validateResourceBudgetOutcome,
  validateRunAgentResultV2,
  type RuhrohAdapterManifestV1,
  type RuhrohEconomicsObservationV1,
  type RuhrohResourceBudgetsV1,
} from "../src/economics-runtime.js";

const observation = (
  observationId: string,
  sequence: number,
  aggregation: "delta" | "cumulative",
  totalTokens: number,
  seriesId = "tokens",
): RuhrohEconomicsObservationV1 => ({
  version: "ruhroh_economics_observation_v1",
  observationId,
  seriesId,
  sequence,
  scope: "turn",
  aggregation,
  accounting: "exclusive",
  coverage: { status: "complete" },
  source: { kind: "provider_api", name: "fixture", quality: "reported" },
  usage: { totalTokens },
});

const manifest: RuhrohAdapterManifestV1 = {
  version: "ruhroh_adapter_manifest_v1",
  adapterId: "fixture",
  adapterVersion: "1.0.0",
  resultProtocol: "ruhroh_run_agent_result_v2",
  traceProtocol: "ruhroh_economic_trace_span_v1",
  resources: {
    totalTokens: { observable: true, enforcement: "boundary", source: "connector" },
  },
};

test("economics observations normalize delta and cumulative series without double counting", () => {
  const delta = normalizeEconomicsObservations([
    observation("delta-1", 1, "delta", 4, "delta-a"),
    observation("delta-2", 2, "delta", 6, "delta-a"),
  ]);
  assert.equal(delta.envelope.totals.usage.totalTokens, 10);
  assert.deepEqual(delta.errors, []);

  const cumulative = normalizeEconomicsObservations([
    observation("cumulative-1", 1, "cumulative", 4),
    observation("cumulative-2", 2, "cumulative", 10),
  ]);
  assert.equal(cumulative.envelope.totals.usage.totalTokens, 10);
  assert.deepEqual(cumulative.errors, []);

  const decreasing = normalizeEconomicsObservations([
    observation("decreasing-1", 1, "cumulative", 10),
    observation("decreasing-2", 2, "cumulative", 9),
  ]);
  assert.match(decreasing.errors.join("\n"), /decreased/u);

  const mixed = normalizeEconomicsObservations([
    observation("mixed-1", 1, "delta", 4),
    observation("mixed-2", 2, "cumulative", 10),
  ]);
  assert.match(mixed.errors.join("\n"), /mixes delta and cumulative/u);

  const depth = normalizeEconomicsObservations([
    { ...observation("depth-1", 1, "delta", 1, "depth-a"), usage: { maxAgentDepth: 2 } },
    { ...observation("depth-2", 2, "delta", 1, "depth-a"), usage: { maxAgentDepth: 3 } },
  ]);
  assert.equal(depth.envelope.totals.usage.maxAgentDepth, 3);

  const duplicate = normalizeEconomicsObservations([
    observation("duplicate", 1, "delta", 4, "duplicates"),
    observation("duplicate", 2, "delta", 6, "duplicates"),
  ]);
  assert.equal(duplicate.envelope.totals.usage.totalTokens, 4);
  assert.match(duplicate.errors.join("\n"), /duplicate observationId/u);
});

test("legacy usage remains unknown and cannot become claim-ready economics", () => {
  const envelope = legacyUsageToEconomicsEnvelope({ totalTokens: 42, costUsd: 0.25 });
  assert.ok(envelope);
  assert.equal(envelope.legacy, true);
  assert.equal(envelope.coverage.totalTokens?.status, "unknown");
  assert.match(envelope.warnings.join("\n"), /not eligible/u);
});

test("economic traces accept hashes and reject raw request or prompt fields", () => {
  const span = {
    version: "ruhroh_economic_trace_span_v1" as const,
    traceId: "trace-safe",
    spanId: "span-safe",
    kind: "inference" as const,
    status: "ok" as const,
    startedAt: "2026-08-12T00:00:00Z",
    inference: { requestIdHash: "a".repeat(64), routeHash: "b".repeat(64) },
  };
  assert.deepEqual(validateEconomicTraceSpan(span), []);
  assert.match(validateEconomicTraceSpan({ ...span, prompt: "secret" }).join("\n"), /forbidden/u);
  assert.match(validateEconomicTraceSpan({ ...span, inference: { requestId: "raw-id" } }).join("\n"), /forbidden/u);
  assert.match(validateEconomicTrace([{ ...span, parentSpanId: "missing" }]).join("\n"), /missing parent/u);
});

test("run-agent result v2 validates structured economics and rejects malformed arrays", () => {
  const valid = {
    version: "ruhroh_run_agent_result_v2",
    status: "goal_satisfied",
    economicsObservations: [observation("result-one", 1, "delta", 2)],
    adapterManifest: manifest,
  };
  assert.deepEqual(validateRunAgentResultV2(valid), []);
  assert.match(validateRunAgentResultV2({ ...valid, economicsObservations: [null] }).join("\n"), /must be an object/u);
  assert.match(validateRunAgentResultV2({ ...valid, status: "maybe" }).join("\n"), /status/u);
});

test("economic trace JSONL finalization hashes complete records and drops only a truncated tail", () => {
  const span = {
    version: "ruhroh_economic_trace_span_v1",
    traceId: "trace-safe",
    spanId: "span-safe",
    kind: "agent_turn",
    status: "ok",
    startedAt: "2026-08-12T00:00:00Z",
  };
  const finalized = finalizeEconomicTraceJsonl(`${JSON.stringify(span)}\n{\"version\":`);
  assert.equal(finalized.truncatedFinalRecord, true);
  assert.equal(finalized.spans.length, 1);
  assert.deepEqual(finalized.errors, []);
  assert.match(finalized.sha256 ?? "", /^[a-f0-9]{64}$/u);
  assert.equal(Buffer.byteLength(finalized.jsonl), finalized.byteLength);
  assert.deepEqual(finalizeEconomicTraceJsonl(""), {
    spans: [],
    jsonl: "",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    byteLength: 0,
    truncatedFinalRecord: false,
    errors: [],
  });

  const malformedInterior = finalizeEconomicTraceJsonl(`{bad}\n${JSON.stringify(span)}\n`);
  assert.equal(malformedInterior.truncatedFinalRecord, false);
  assert.match(malformedInterior.errors.join("\n"), /line 1/u);
  assert.equal(malformedInterior.sha256, undefined);
});

test("budgets are capability-gated and exact completion is inclusive", () => {
  const budgets: RuhrohResourceBudgetsV1 = {
    version: "ruhroh_resource_budgets_v1",
    scope: "implementation",
    onUnobservable: "fail",
    limits: [{ resource: "totalTokens", max: 10, requiredEnforcement: "boundary" }],
  };
  assert.match(budgetCapabilityErrors({ ...manifest, resources: {} }, budgets).join("\n"), /not observable/u);
  const observed = { values: { totalTokens: 10 }, costs: {}, coverage: { totalTokens: "complete" as const } };
  assert.equal(evaluateResourceBudgets(budgets, observed, manifest.resources, false).status, "exhausted");
  assert.equal(evaluateResourceBudgets(budgets, observed, manifest.resources, true).status, "within");
  assert.equal(evaluateResourceBudgets(budgets, { values: {}, costs: {}, coverage: {} }, manifest.resources, false).status, "unobservable");
});

test("process termination evidence records the wall-limit boundary and containment overrun", () => {
  const termination = {
    version: "ruhroh_process_termination_v1" as const,
    scope: "process_group" as const,
    reason: "wall_time_limit" as const,
    timeoutMs: 100,
    timeoutObservedAtMs: 101,
    gracePeriodMs: 5000 as const,
    signalsSent: ["SIGTERM", "SIGKILL"] as Array<"SIGTERM" | "SIGKILL">,
    terminatedBy: "SIGKILL" as const,
    terminationDurationMs: 5002,
    terminatedAtMs: 5103,
    limitMs: 100,
    overrunMs: 5003,
  };
  assert.deepEqual(validateProcessTermination(termination), []);
  assert.deepEqual(validateResourceBudgetOutcome({
    version: "ruhroh_resource_budget_outcome_v1",
    scope: "implementation",
    status: "exhausted",
    limits: [{
      resource: "wallTimeMs",
      limit: 100,
      observed: 100,
      enforcement: "preemptive",
      coverage: "complete",
      status: "exhausted",
    }],
    termination,
  }), []);
  assert.match(validateProcessTermination({ ...termination, signalsSent: ["SIGKILL"] }).join("\n"), /preceded by SIGTERM/u);
  assert.match(validateProcessTermination({ ...termination, overrunMs: 1 }).join("\n"), /overrunMs/u);
});

test("adapter conformance binds validated evidence to a stable manifest hash", () => {
  const result = runAdapterConformance({ manifest, observations: [observation("one", 1, "delta", 3)], spans: [] });
  assert.equal(result.passed, true);
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/u);
  const missingCapability = runAdapterConformance({ manifest: { ...manifest, resources: {} }, observations: [observation("two", 1, "delta", 3)] });
  assert.equal(missingCapability.passed, false);
  assert.match(missingCapability.checks.find((check) => check.name === "capabilities")?.details ?? "", /not declared observable/u);
});

test("Python runtime matches normalization, privacy, and capability-gate semantics", () => {
  const python = [
    "import json",
    "from ruhroh.loop_controller import normalize_economics_observations, legacy_usage_observation, validate_economic_trace_span, budget_capability_errors, finalize_economic_trace_jsonl",
    `observations = ${JSON.stringify([observation("one", 1, "cumulative", 4), observation("two", 2, "cumulative", 10)])}`,
    "envelope, errors = normalize_economics_observations(observations)",
    "legacy, legacy_errors = normalize_economics_observations([legacy_usage_observation({'totalTokens': 5})])",
    `manifest = ${JSON.stringify({ ...manifest, resources: {} })}`,
    `budgets = ${JSON.stringify({ version: "ruhroh_resource_budgets_v1", scope: "implementation", onUnobservable: "fail", limits: [{ resource: "totalTokens", max: 10, requiredEnforcement: "boundary" }] })}`,
    "span = {'version':'ruhroh_economic_trace_span_v1','traceId':'trace-safe','spanId':'span-safe','kind':'agent_turn','status':'ok','startedAt':'now'}",
    "finalized = finalize_economic_trace_jsonl(json.dumps(span) + '\\n{\"version\":')",
    "print(json.dumps({'total': envelope['totals']['usage']['totalTokens'], 'errors': errors, 'legacyCoverage': legacy['coverage']['totalTokens']['status'], 'privacy': validate_economic_trace_span({**span, 'prompt':'secret'}), 'capability': budget_capability_errors(manifest, budgets), 'truncated': finalized['truncatedFinalRecord'], 'traceSha': finalized['sha256']}))",
  ].join("\n");
  const completed = spawnSync("python3", ["-c", python], {
    env: { ...process.env, PYTHONPATH: path.resolve("python") },
    encoding: "utf8",
  });
  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout) as Record<string, unknown>;
  assert.equal(result.total, 10);
  assert.deepEqual(result.errors, []);
  assert.equal(result.legacyCoverage, "unknown");
  assert.match(String(result.privacy), /forbidden/u);
  assert.match(String(result.capability), /not observable/u);
  assert.equal(result.truncated, true);
  assert.match(String(result.traceSha), /^[a-f0-9]{64}$/u);
});

test("Python process-tree termination sends TERM, waits five seconds, then sends KILL", () => {
  const python = [
    "import json, signal, subprocess",
    "from unittest.mock import patch",
    "from ruhroh.loop_controller import terminate_process_tree",
    "class FakeProcess:",
    "    pid = 4242",
    "    def __init__(self): self.waits = []",
    "    def poll(self): return None",
    "    def wait(self, timeout=None):",
    "        self.waits.append(timeout)",
    "        if timeout == 5: raise subprocess.TimeoutExpired('fake', timeout)",
    "        return 0",
    "process = FakeProcess()",
    "signals = []",
    "with patch('os.killpg', side_effect=lambda pid, sig: signals.append([pid, sig])):",
    "    evidence = terminate_process_tree(process)",
    "print(json.dumps({'signals': signals, 'waits': process.waits, 'evidence': evidence}))",
  ].join("\n");
  const completed = spawnSync("python3", ["-c", python], {
    env: { ...process.env, PYTHONPATH: path.resolve("python") },
    encoding: "utf8",
  });
  assert.equal(completed.status, 0, completed.stderr);
  const result = JSON.parse(completed.stdout) as { signals: Array<[number, number]>; waits: Array<number | null>; evidence: Record<string, unknown> };
  assert.deepEqual(result.signals, [[4242, 15], [4242, 9]]);
  assert.deepEqual(result.waits, [5, null]);
  assert.deepEqual(result.evidence.signalsSent, ["SIGTERM", "SIGKILL"]);
  assert.equal(result.evidence.gracePeriodMs, 5000);
  assert.equal(result.evidence.scope, "process_group");
  assert.equal(result.evidence.terminatedBy, "SIGKILL");
});

test("runtime economics schemas are valid JSON and expose their intended versions", () => {
  for (const [file, version] of [
    ["economics-envelope-v1.schema.json", "ruhroh_economics_envelope_v1"],
    ["economic-trace-span-v1.schema.json", "ruhroh_economic_trace_span_v1"],
    ["adapter-manifest-v1.schema.json", "ruhroh_adapter_manifest_v1"],
    ["resource-budgets-v1.schema.json", "ruhroh_resource_budgets_v1"],
    ["resource-budget-outcome-v1.schema.json", "ruhroh_resource_budget_outcome_v1"],
    ["run-agent-result-v2.schema.json", "ruhroh_run_agent_result_v2"],
  ] as const) {
    const schema = JSON.parse(readFileSync(path.resolve("schemas", file), "utf8")) as { properties: { version: { const: string } } };
    assert.equal(schema.properties.version.const, version);
  }
});

test("Python runtime rejects an unsupported provider budget before executing the adapter", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-budget-preflight-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const marker = path.join(tmp, "adapter-ran");
    const adapter = path.join(tmp, "adapter.sh");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(adapter, `#!/usr/bin/env bash\nset -euo pipefail\nprintf ran > ${JSON.stringify(marker)}\n`, "utf8");
    chmodSync(adapter, 0o755);
    const budgets = {
      version: "ruhroh_resource_budgets_v1",
      scope: "implementation",
      onUnobservable: "fail",
      limits: [{ resource: "totalTokens", max: 10, requiredEnforcement: "boundary" }],
    };
    const python = [
      "import json",
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build it', 'budget-preflight', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      "print(json.dumps({'failure': result['failure_kind'], 'iterations': result['implementationIterationsUsed']}))",
    ].join("\n");
    const completed = spawnSync("python3", ["-c", python], {
      env: {
        ...process.env,
        PYTHONPATH: path.resolve("python"),
        RUHROH_RUN_AGENT_COMMAND: adapter,
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_RESOURCE_BUDGETS_JSON: JSON.stringify(budgets),
      },
      encoding: "utf8",
    });
    assert.equal(completed.status, 0, completed.stderr);
    assert.deepEqual(JSON.parse(completed.stdout), { failure: "resource_budget_unobservable", iterations: 0 });
    assert.equal(existsSync(marker), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("wall-time containment preserves budget-stop, termination, evaluator, and workspace evidence", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-wall-budget-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const adapter = path.join(tmp, "adapter.sh");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(adapter, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "trap 'exit 143' TERM",
      "sleep 5",
      "",
    ].join("\n"), "utf8");
    chmodSync(adapter, 0o755);
    const wallLimitMs = 40;
    const budgets = {
      version: "ruhroh_resource_budgets_v1",
      scope: "implementation",
      onUnobservable: "fail",
      limits: [{ resource: "wallTimeMs", max: wallLimitMs, requiredEnforcement: "preemptive" }],
    };
    const python = [
      "import json",
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build it', 'wall-budget', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      "print(json.dumps(result))",
    ].join("\n");
    const completed = spawnSync("python3", ["-c", python], {
      env: {
        ...process.env,
        PYTHONPATH: path.resolve("python"),
        RUHROH_RUN_AGENT_COMMAND: adapter,
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_RESOURCE_BUDGETS_JSON: JSON.stringify(budgets),
        RUHROH_EVAL_RESULT_FIXTURE: JSON.stringify({
          version: "ruhroh_eval_result_v1",
          status: "passed",
          goalMet: true,
          confidence: "high",
          reasons: ["workspace retained"],
          unmetCriteria: [],
          evidenceRefs: [],
          commandsRun: [],
          artifacts: {},
          finalSummary: "Evaluator evidence must not override containment.",
        }),
      },
      encoding: "utf8",
    });
    assert.equal(completed.status, 0, completed.stderr);
    const result = JSON.parse(completed.stdout) as Record<string, any>;
    assert.equal(result.status, "failed");
    assert.equal(result.failure_kind, "resource_budget_exhausted");
    assert.equal(result.score, 0);
    assert.equal(result.evalResult.status, "passed");
    assert.equal(result.resourceBudgetOutcome.status, "exhausted");
    assert.equal(result.resourceBudgetOutcome.limits[0].observed, wallLimitMs);
    assert.equal(result.resourceBudgetOutcome.termination.reason, "wall_time_limit");
    assert.equal(result.resourceBudgetOutcome.termination.gracePeriodMs, 5000);
    assert.equal(result.resourceBudgetOutcome.termination.limitMs, wallLimitMs);
    assert.ok(result.resourceBudgetOutcome.termination.signalsSent.includes("SIGTERM"));
    assert.ok(result.resourceBudgetOutcome.termination.overrunMs >= 0);
    assert.equal(result.implementationRuns[0].implementationBoundary.kind, "budget_stop");
    assert.equal(result.implementationRuns[0].implementationBoundary.elapsedMs, wallLimitMs);
    assert.deepEqual(result.implementationRuns[0].termination, result.resourceBudgetOutcome.termination);
    assert.equal(result.economics.runtime.wallTimeMs, wallLimitMs);
    assert.equal(existsSync(result.artifactPaths.workspaceSummary), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("telemetry loss after execution preserves an unobservable verdict and evaluator evidence", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-budget-unobservable-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const adapter = path.join(tmp, "adapter.sh");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(adapter, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '{\"version\":\"ruhroh_run_agent_result_v2\",\"status\":\"goal_satisfied\"}\\n' > \"$RUHROH_RESULT_PATH\"",
      "",
    ].join("\n"), "utf8");
    chmodSync(adapter, 0o755);
    const adapterManifest = {
      version: "ruhroh_adapter_manifest_v1",
      adapterId: "custom-shell",
      adapterVersion: "1.0.0",
      resultProtocol: "ruhroh_run_agent_result_v2",
      resources: { totalTokens: { observable: true, enforcement: "boundary", source: "connector" } },
    };
    const budgets = {
      version: "ruhroh_resource_budgets_v1",
      scope: "implementation",
      onUnobservable: "fail",
      limits: [{ resource: "totalTokens", max: 10, requiredEnforcement: "boundary" }],
    };
    const python = [
      "import json",
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build it', 'telemetry-loss', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      "print(json.dumps(result))",
    ].join("\n");
    const completed = spawnSync("python3", ["-c", python], {
      env: {
        ...process.env,
        PYTHONPATH: path.resolve("python"),
        RUHROH_RUN_AGENT_COMMAND: adapter,
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_ADAPTER_MANIFEST_JSON: JSON.stringify(adapterManifest),
        RUHROH_RESOURCE_BUDGETS_JSON: JSON.stringify(budgets),
        RUHROH_EVAL_RESULT_FIXTURE: JSON.stringify({
          version: "ruhroh_eval_result_v1",
          status: "passed",
          goalMet: true,
          confidence: "high",
          reasons: ["workspace retained"],
          unmetCriteria: [],
          evidenceRefs: [],
          commandsRun: [],
          artifacts: {},
          finalSummary: "Telemetry loss must remain fail closed.",
        }),
      },
      encoding: "utf8",
    });
    assert.equal(completed.status, 0, completed.stderr);
    const result = JSON.parse(completed.stdout) as Record<string, any>;
    assert.equal(result.status, "failed");
    assert.equal(result.failure_kind, "resource_budget_unobservable");
    assert.equal(result.score, 0);
    assert.equal(result.evalResult.status, "passed");
    assert.equal(result.resourceBudgetOutcome.status, "unobservable");
    assert.equal(result.implementationRuns[0].resourceBudgetOutcome.status, "unobservable");
    assert.equal(existsSync(result.artifactPaths.workspaceSummary), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Kestrel v2 maps only structured event evidence and declares no unsupported usage", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-kestrel-economics-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const resultPath = path.join(tmp, "result.json");
    const fakeKestrel = path.join(tmp, "kestrel");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(fakeKestrel, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "json_out=''",
      "while [[ $# -gt 0 ]]; do",
      "  case \"$1\" in",
      "    --json-out) json_out=\"$2\"; shift 2 ;;",
      "    *) shift ;;",
      "  esac",
      "done",
      "printf '{\"terminalEventType\":\"job.completed\",\"job\":{\"status\":\"COMPLETED\",\"runId\":\"run-1\",\"threadId\":\"thread-1\",\"result\":{}}}' > \"$json_out\"",
      "printf '{\"type\":\"run.progress\",\"prompt\":\"must-not-leak\"}\\n' > \"$KESTREL_JOB_EVENT_LOG_PATH\"",
      "",
    ].join("\n"), "utf8");
    chmodSync(fakeKestrel, 0o755);
    const completed = spawnSync("bash", [path.resolve("examples/adapters/kestrel-cli/run.sh")], {
      env: {
        ...process.env,
        RUHROH_WORKSPACE_PATH: workspace,
        RUHROH_MESSAGE: "sensitive prompt",
        RUHROH_ITERATION: "1",
        RUHROH_SCENARIO_ID: "structured-only",
        RUHROH_SESSION_HANDLE: "session-1",
        RUHROH_RESULT_PATH: resultPath,
        RUHROH_RUN_AGENT_RESULT_PROTOCOL: "ruhroh_run_agent_result_v2",
        KESTREL_CLI_BIN: fakeKestrel,
      },
      encoding: "utf8",
    });
    assert.equal(completed.status, 0, completed.stderr);
    const result = JSON.parse(readFileSync(resultPath, "utf8")) as Record<string, any>;
    assert.equal(result.version, "ruhroh_run_agent_result_v2");
    assert.equal(result.economicTraceSpans.length, 1);
    assert.deepEqual(result.economicTraceSpans[0].eventTypes, ["run.progress"]);
    assert.deepEqual(result.adapterManifest.resources, {});
    assert.equal("usage" in result, false);
    assert.equal(JSON.stringify(result.economicTraceSpans).includes("must-not-leak"), false);
    assert.equal(JSON.stringify(result.economicTraceSpans).includes("sensitive prompt"), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Harbor forwards and run manifests snapshot workload and budget provenance", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-runtime-provenance-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const adapter = path.join(tmp, "adapter.sh");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(adapter, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '{\"version\":\"ruhroh_run_agent_result_v2\",\"status\":\"goal_satisfied\"}\\n' > \"$RUHROH_RESULT_PATH\"",
      "",
    ].join("\n"), "utf8");
    chmodSync(adapter, 0o755);
    const adapterManifest = {
      version: "ruhroh_adapter_manifest_v1",
      adapterId: "custom-shell",
      adapterVersion: "1.0.0",
      resultProtocol: "ruhroh_run_agent_result_v2",
      resources: {},
    };
    const budgets = {
      version: "ruhroh_resource_budgets_v1",
      scope: "implementation",
      onUnobservable: "fail",
      limits: [{ resource: "implementationIterations", max: 1, requiredEnforcement: "preemptive" }],
    };
    const workloadBinding = {
      version: "ruhroh_workload_binding_v1",
      experimentId: "experiment-opaque",
      workloadId: "workload-opaque",
      projectId: "project-opaque",
      workflowInstanceId: "workflow-opaque",
    };
    const workloadProfile = {
      version: "ruhroh_workload_profile_v1",
      profileId: "profile-opaque",
      taxonomy: { namespace: "example.com:workloads", version: "1" },
      archetype: { id: "software-change" },
      unitOfWork: { id: "accepted-change", label: "Accepted change" },
    };
    const forwardedKeys = [
      "RUHROH_SAMPLE_WEIGHT",
      "RUHROH_WORKLOAD_BINDING_JSON",
      "RUHROH_WORKLOAD_PROFILE_JSON",
      "RUHROH_ADAPTER_MANIFEST_JSON",
      "RUHROH_ADAPTER_MANIFEST_SHA256",
      "RUHROH_RESOURCE_BUDGETS_JSON",
      "RUHROH_EFFECTIVE_BUDGET_SHA256",
    ];
    const python = [
      "import json",
      "from pathlib import Path",
      "from ruhroh.harbor_agent import build_run_env_values",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build it', 'provenance', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      `keys = ${JSON.stringify(forwardedKeys)}`,
      "manifest = result['runManifest']",
      "print(json.dumps({'forwarded': all(key in build_run_env_values(1) for key in keys), 'sampleWeight': manifest['sample']['weight'], 'binding': manifest['workloadBinding'], 'profile': manifest['workloadProfile'], 'adapterManifest': manifest['adapterManifest'], 'adapterSha': manifest['adapterManifestSha256'], 'budgets': manifest['resourceBudgets'], 'budgetSha': manifest['effectiveBudgetSha256']}))",
    ].join("\n");
    const adapterSha = sha256CanonicalJson(adapterManifest);
    const budgetSha = sha256CanonicalJson(budgets);
    const completed = spawnSync("python3", ["-c", python], {
      env: {
        ...process.env,
        PYTHONPATH: path.resolve("python"),
        RUHROH_RUN_AGENT_COMMAND: adapter,
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_SAMPLE_WEIGHT: "2.5",
        RUHROH_EVAL_RESULT_FIXTURE: JSON.stringify({
          version: "ruhroh_eval_result_v1",
          status: "passed",
          goalMet: true,
          confidence: "high",
          reasons: ["ok"],
          unmetCriteria: [],
          evidenceRefs: [],
          commandsRun: [],
          artifacts: {},
          finalSummary: "ok",
        }),
        RUHROH_WORKLOAD_BINDING_JSON: JSON.stringify(workloadBinding),
        RUHROH_WORKLOAD_PROFILE_JSON: JSON.stringify(workloadProfile),
        RUHROH_ADAPTER_MANIFEST_JSON: JSON.stringify(adapterManifest),
        RUHROH_ADAPTER_MANIFEST_SHA256: adapterSha,
        RUHROH_RESOURCE_BUDGETS_JSON: JSON.stringify(budgets),
        RUHROH_EFFECTIVE_BUDGET_SHA256: budgetSha,
      },
      encoding: "utf8",
    });
    assert.equal(completed.status, 0, completed.stderr);
    const result = JSON.parse(completed.stdout) as Record<string, any>;
    assert.equal(result.forwarded, true);
    assert.equal(result.sampleWeight, 2.5);
    assert.deepEqual(result.binding, workloadBinding);
    assert.deepEqual(result.profile, workloadProfile);
    assert.deepEqual(result.adapterManifest, adapterManifest);
    assert.equal(result.adapterSha, adapterSha);
    assert.deepEqual(result.budgets, budgets);
    assert.equal(result.budgetSha, budgetSha);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
