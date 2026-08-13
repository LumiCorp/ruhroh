import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  runRuhrohEconomicsCommand,
  validateRuhrohEconomicsContract,
} from "../src/economics-cli.js";
import { parseRuhrohCliArgs, runRuhrohCli } from "../src/cli.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HASH = "a".repeat(64);
const REF = { path: "evidence.json", sha256: HASH };

function fixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, "examples", "economics", name), "utf8")) as Record<string, unknown>;
}

function command(command: string, input: unknown) {
  return runRuhrohEconomicsCommand({ version: "ruhroh_economics_command_v1", command, input });
}

test("contract dispatch validates known versions and rejects unknown versions", () => {
  const valid = validateRuhrohEconomicsContract(fixture("workload-profile.json"));
  assert.equal(valid.supported, true);
  assert.deepEqual(valid.errors, []);

  const unknown = command("validate", { version: "ruhroh_future_economics_v9" });
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors.join("\n"), /unsupported contract version/u);
});

test("public CLI routes economics operations through a JSON input file", async () => {
  const inputPath = path.join(REPO_ROOT, "examples", "economics", "workload-profile.json");
  const parsed = parseRuhrohCliArgs(["economics", "validate", inputPath, "--json"], REPO_ROOT);
  assert.equal(parsed.command, "economics");
  assert.equal(parsed.economicsCommand, "validate");
  const stdout: string[] = [];
  const code = await runRuhrohCli(["economics", "validate", inputPath, "--json"], {
    spawn: (() => assert.fail("economics validation should not spawn")) as never,
    env: {},
    cwd: REPO_ROOT,
    stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
    stderr: { write: () => true },
  });
  assert.equal(code, 0);
  const result = JSON.parse(stdout.join(""));
  assert.equal(result.command, "validate");
  assert.equal(result.ok, true);
  assert.equal(result.contractVersion, "ruhroh_workload_profile_v1");
});

test("conformance command reconciles a safe two-turn delta trace", () => {
  const manifest = {
    version: "ruhroh_adapter_manifest_v1",
    adapterId: "fixture-agent",
    adapterVersion: "1.0.0",
    resultProtocol: "ruhroh_run_agent_result_v2",
    traceProtocol: "ruhroh_economic_trace_span_v1",
    resources: {
      totalTokens: { observable: true, enforcement: "boundary", source: "connector" },
    },
  };
  const observations = [1, 2].map((sequence) => ({
    version: "ruhroh_economics_observation_v1",
    observationId: `turn-${sequence}-usage`,
    seriesId: "fixture-turns",
    sequence,
    scope: "turn",
    aggregation: "delta",
    accounting: "exclusive",
    coverage: { status: "complete" },
    source: { kind: "adapter", name: "fixture-agent", quality: "reported" },
    usage: { totalTokens: sequence * 100 },
  }));
  const spans = [1, 2].map((sequence) => ({
    version: "ruhroh_economic_trace_span_v1",
    traceId: "trace-demo-001",
    spanId: `turn-span-00${sequence}`,
    kind: "agent_turn",
    status: "ok",
    startedAt: `2026-01-01T00:00:0${sequence}.000Z`,
    durationMs: 100,
    iteration: sequence,
    resourceObservationRefs: [`turn-${sequence}-usage`],
  }));
  const result = command("conformance", { manifest, observations, spans });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal((result.output as { passed: boolean }).passed, true);
});

test("scale, finding, and provider-drift commands produce review artifacts", () => {
  const experiment = fixture("scale-experiment.json") as any;
  const observations = experiment.levels.map((level: any) => ({
    version: "ruhroh_scale_observation_v1",
    experimentId: experiment.id,
    targetId: "target-synthetic-agent",
    levelId: level.id,
    n: level.n,
    sampleId: `${level.id}-sample-1`,
    changeResults: level.requestIds.map((requestId: string) => ({ requestId, status: "passed" })),
    totalTokens: level.n * 100,
    modelCalls: level.n,
    retryAttempts: 0,
    childAgentMaxDepth: 0,
    childAgentMaxFanout: 0,
    resourceBudgetStatus: "within",
  }));
  const scale = command("scale-analyze", { experiment, observations, createdAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(scale.ok, true, scale.errors.join("\n"));
  assert.equal((scale.output as any).targets[0].bestFitCandidate, "T(n)");

  const findings = command("findings", {
    createdAt: "2026-01-01T00:00:00.000Z",
    assessments: [{
      detectorId: "retry_loop_amplification",
      scope: { benchmarkTargetId: "target-a", runIds: ["run-1"] },
      measurements: { retryCount: 3, equivalentRetryCount: 2 },
      evidenceRefs: [{ artifact: "economic-trace", sha256: HASH }],
    }],
  });
  assert.equal(findings.ok, true, findings.errors.join("\n"));
  assert.equal((findings.output as any).findings[0].status, "candidate");

  const baseline = fixture("provider-baseline.json") as any;
  const drift = command("provider-drift", {
    baseline,
    currentControls: baseline.controls,
    currentMetrics: baseline.metrics,
  });
  assert.equal(drift.ok, true, drift.errors.join("\n"));
  assert.equal((drift.output as any).classification, "no_drift");
});

test("decision-packet command keeps human decision and value gates explicit", () => {
  const context = fixture("decision-context.json") as any;
  const ledger = fixture("intervention-ledger.json") as any;
  const result = command("decision-packet", {
    packetId: "packet-cli-test",
    createdAt: "2026-07-16T00:00:00.000Z",
    context,
    contextRef: REF,
    technicalOutcome: {
      conclusion: "supported",
      evidenceLevel: "measured",
      reasons: ["quality floor met"],
      evidenceRefs: [REF],
    },
    interventionLedger: ledger,
    interventionLedgerRef: REF,
    businessValueEvidence: {
      indicatorId: "median_completion_minutes",
      conclusion: "supported",
      evidenceLevel: "measured",
      observedValue: 12,
      evidenceRefs: [REF],
      reasons: ["measured against the declared baseline"],
    },
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  const packet = result.output as any;
  assert.equal(packet.tiers.autonomousDeflection.conclusion, "supported");
  assert.equal(packet.readiness, "review_required");
  assert.equal(packet.decision, undefined);
});

test("billing-reconcile command accepts CSV without leaking raw rows into its artifact", () => {
  const requestId = "request-demo-001";
  const billingSource = {
    ...fixture("billing-source-manifest.json"),
    rowCount: 1,
  } as any;
  const mappingProfile = {
    ...fixture("billing-mapping-profile.json"),
    allocations: [],
  } as any;
  const result = command("billing-reconcile", {
    reconciliationId: "reconciliation-cli-test",
    createdAt: "2026-08-01T00:00:00.000Z",
    benchmarkClaimRef: REF,
    billingSource,
    billingSourceRef: REF,
    mappingProfile,
    mappingProfileRef: REF,
    billing: {
      format: "csv",
      text: `line_id,net_amount,currency_code,fact_kind,observed_at,request_ref,principal_key,workload_key,model_key,sku_key\nline-001,10,USD,usage_charge,2026-07-03T14:30:00.000Z,${requestId},principal-1,workload-support-resolution,synthetic-model-001,synthetic-input-output-bundle\n`,
    },
    technicalFacts: [{
      version: "ruhroh_technical_economic_fact_v1",
      factId: "fact-1",
      runId: "run-1",
      benchmarkTargetId: "target-1",
      workloadId: "workload-support-resolution",
      occurredAt: "2026-07-03T14:30:00.000Z",
      providerRequestIdHash: createHash("sha256").update(requestId).digest("hex"),
      principalRef: "principal-1",
      model: "synthetic-model-001",
      sku: "synthetic-input-output-bundle",
      evidenceRef: REF,
    }],
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  const reconciliation = result.output as any;
  assert.equal(reconciliation.ready, true);
  assert.equal(reconciliation.coverage.exactRows, 1);
  assert.equal(JSON.stringify(reconciliation).includes(requestId), false);
});

test("billing-reconcile-v2 keeps exact decimal strings", () => {
  const result = command("billing-reconcile-v2", {
    reconciliationId: "v2-cli", createdAt: "2026-08-12T20:00:00Z", benchmarkClaimRef: REF, billingSourceRef: REF, mappingProfileRef: REF,
    billingSource: { version: "ruhroh_billing_source_manifest_v2", sourceId: "source", format: "records", externalSchemaVersion: "test", billingPeriod: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-02-01T00:00:00Z" }, currencies: ["USD"], rowCount: 1, sourceRef: REF, privacyClassification: "restricted" },
    mappingProfile: { version: "ruhroh_billing_mapping_profile_v2", profileId: "v2", provider: "neutral", externalSchemaVersion: "test", fields: { sourceRowId: "id", amountDecimal: "amount", currency: "currency", kind: "kind", workloadId: "workload", sku: "sku", occurredAt: "at" }, kindValues: { charge: ["Usage"] }, matching: { boundedWindowSeconds: 60, boundedFields: ["workloadId", "sku"] }, allocations: [] },
    billing: { format: "records", records: [{ id: "row", amount: "9007199254740993.01", currency: "USD", kind: "Usage", workload: "work", sku: "sku", at: "2026-01-02T00:00:00Z" }] },
    technicalFacts: [{ version: "ruhroh_technical_economic_fact_v1", factId: "fact", runId: "run", benchmarkTargetId: "target", workloadId: "work", occurredAt: "2026-01-02T00:00:01Z", sku: "sku", evidenceRef: REF }],
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal((result.output as any).currencies[0].sourceTotalDecimal, "9007199254740993.01");
});

test("FOCUS update commands keep working drafts review-only", () => {
  const catalog = { version: "ruhroh_focus_catalog_v1", catalogId: "1.4", focusVersion: "1.4", modelRef: REF, datasets: [] };
  const check = command("focus-check-update", { fromCatalog: catalog, toCatalog: catalog });
  assert.equal(check.ok, true, check.errors.join("\n"));
  assert.deepEqual((check.output as any).changes, []);
  const proposal = command("focus-propose-update", { reviewId: "preview", createdAt: "2026-08-12T20:00:00Z", fromSpecLockRef: REF, toSpecLockRef: REF, candidateReleaseStatus: "preview", fromCatalog: catalog, toCatalog: catalog });
  assert.equal(proposal.ok, true, proposal.errors.join("\n"));
  assert.equal((proposal.output as any).recommendation, "review_required");
});
