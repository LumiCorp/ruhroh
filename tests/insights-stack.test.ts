import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  analyzeRuhrohScaleExperiment,
  type RuhrohScaleExperimentV1,
  type RuhrohScaleObservationV1,
} from "../src/scale.js";
import {
  assessRuhrohFinding,
  validateRuhrohFindings,
} from "../src/findings.js";
import {
  compareRuhrohProviderBaseline,
  holmAdjustRuhrohProviderTests,
  type RuhrohProviderBaselineV1,
  type RuhrohProviderBaselineControlsV1,
} from "../src/drift.js";

const HASH = "a".repeat(64);
const REF = { path: "evidence.json", sha256: HASH };

test("findings require controlled equal-quality evidence before confirmation", () => {
  const base = {
    detectorId: "retry_loop_amplification" as const,
    scope: { benchmarkTargetId: "target-a", runIds: ["run-1"] },
    measurements: { retryCount: 3, equivalentRetryCount: 2 },
    evidenceRefs: [REF],
  };
  const candidate = assessRuhrohFinding(base);
  assert.equal(candidate.status, "candidate");
  const confirmed = assessRuhrohFinding({
    ...base,
    controlledCountercase: { present: true, equalQuality: true, relevantCoverageComplete: true, evidenceRefs: [REF] },
  });
  assert.equal(confirmed.status, "confirmed");
  assert.deepEqual(validateRuhrohFindings({ version: "ruhroh_findings_v1", findings: [confirmed] }), []);
  const invalid = structuredClone(confirmed) as unknown as Record<string, unknown>;
  invalid.confirmationChecks = { signatureObserved: true };
  assert.match(validateRuhrohFindings({ version: "ruhroh_findings_v1", findings: [invalid] }).join("\n"), /controlledCountercase/u);
});

test("provider drift refuses attribution when controls change", () => {
  const controls: RuhrohProviderBaselineControlsV1 = {
    suiteId: "suite",
    suiteVersion: "1.0.0",
    scenarioVersions: { task: "1.0.0" },
    benchmarkTargetId: "target-a",
    harnessId: "kestrel",
    providerPath: "direct",
    promptHash: HASH,
    evaluatorSignature: HASH,
    judgeIdentity: "judge-a",
    environmentPolicyHash: HASH,
  };
  const baseline: RuhrohProviderBaselineV1 = {
    version: "ruhroh_provider_baseline_v1",
    baselineId: "base-1",
    createdAt: "2026-01-01T00:00:00Z",
    controls,
    margins: { qualityPassRateDelta: 0.05, latencyRatio: 1.2, consumptionRatio: 1.2, priceRatio: 1.1 },
    metrics: { passRate: 0.9, passRateCi95: { lower: 0.8, upper: 0.96 }, observedModelFingerprint: "model-a", sampleCount: 20 },
    source: REF,
  };
  const confounded = compareRuhrohProviderBaseline({
    baseline,
    currentControls: { ...controls, promptHash: "b".repeat(64) },
    currentMetrics: baseline.metrics,
  });
  assert.equal(confounded.classification, "confounded");
  const identity = compareRuhrohProviderBaseline({
    baseline,
    currentControls: controls,
    currentMetrics: { ...baseline.metrics, observedModelFingerprint: "model-b" },
  });
  assert.equal(identity.classifications.includes("identity_drift"), true);
  const adjusted = holmAdjustRuhrohProviderTests({ quality: 0.01, latency: 0.02, consumption: 0.2 });
  assert.equal(adjusted.find((item) => item.metric === "quality")?.holmAdjustedPValue, 0.03);
  assert.equal(adjusted.find((item) => item.metric === "latency")?.holmAdjustedPValue, 0.04);
  const qualityRegression = compareRuhrohProviderBaseline({
    baseline,
    currentControls: controls,
    currentMetrics: {
      ...baseline.metrics,
      passRate: 0.5,
      passRateCi95: { lower: 0.4, upper: 0.6 },
      metricTestPValues: { quality: 0.001, latency: 0.8 },
    },
  });
  assert.equal(qualityRegression.classifications.includes("quality_regression"), true);
  assert.equal(qualityRegression.multipleTesting.familySize, 2);
});

test("Big-T scale analysis keeps quality separate and emits an empirical linear candidate", () => {
  const levels = [1, 2, 4, 8, 16].map((n) => ({
    id: `n-${n}`,
    n,
    scenarioId: `scale-${n}`,
    scenarioVersion: "1.0.0",
    fixtureSha256: HASH,
    requestIds: Array.from({ length: n }, (_, index) => `change-${index + 1}`),
  }));
  const experiment: RuhrohScaleExperimentV1 = {
    version: "ruhroh_scale_experiment_v1",
    id: "change-request-growth-v1",
    suite: { id: "scale-suite", suiteVersion: "1.0.0" },
    variable: { symbol: "n", name: "ordered_change_requests", unit: "change_request" },
    levels,
    hypothesis: { expectedClass: "T(n)", rationale: "Each independent change should add bounded work." },
    controls: {
      targetIds: ["target-a"],
      frozenBaselineSha256: HASH,
      promptTemplateSha256: HASH,
      evaluatorSignature: HASH,
      fixedRequestOrderSha256: HASH,
      sessionPolicy: "fresh_per_sample",
      levelPolicy: "prefix_nested",
    },
    qualityFloor: { perChangeCompletionRate: 0.9, zeroCriticalRegressions: true },
    resourceMetric: "totalTokens",
    bootstrapSamples: 1000,
  };
  const observations: RuhrohScaleObservationV1[] = levels.flatMap((level) => Array.from({ length: 3 }, (_, sampleIndex) => ({
    version: "ruhroh_scale_observation_v1",
    experimentId: experiment.id,
    targetId: "target-a",
    levelId: level.id,
    n: level.n,
    sampleId: `${level.id}-${sampleIndex}`,
    changeResults: level.requestIds.map((requestId) => ({ requestId, status: "passed" as const })),
    totalTokens: level.n * 100,
    modelCalls: 1,
    retryAttempts: 0,
    childAgentMaxDepth: 0,
    childAgentMaxFanout: 0,
    resourceBudgetStatus: "within" as const,
  })));
  const analysis = analyzeRuhrohScaleExperiment({ experiment, observations, createdAt: "2026-01-01T00:00:00Z" });
  assert.deepEqual(analysis.errors, []);
  assert.equal(analysis.targets[0]?.classificationStatus, "eligible");
  assert.equal(analysis.targets[0]?.bestFitCandidate, "T(n)");
  assert.equal(analysis.targets[0]?.levels[0]?.totalTokens, 300);
  assert.equal(analysis.targets[0]?.levels[0]?.totalModelCalls, 3);
  assert.equal(analysis.targets[0]?.levels[0]?.p95RetryAttempts, 0);
  assert.match(analysis.targets[0]?.caveat ?? "", /not a formal complexity proof/u);

  const analyzeShape = (shape: (n: number) => number, includeOpaqueDimensions: boolean) => analyzeRuhrohScaleExperiment({
    experiment,
    createdAt: "2026-01-01T00:00:00Z",
    observations: levels.flatMap((level) => Array.from({ length: 3 }, (_, sampleIndex) => ({
      version: "ruhroh_scale_observation_v1" as const,
      experimentId: experiment.id,
      targetId: "target-a",
      levelId: level.id,
      n: level.n,
      sampleId: `${level.id}-shape-${sampleIndex}`,
      changeResults: level.requestIds.map((requestId) => ({ requestId, status: "passed" as const })),
      totalTokens: shape(level.n),
      ...(includeOpaqueDimensions ? {} : { modelCalls: 1, childAgentMaxFanout: 0 }),
      resourceBudgetStatus: "within" as const,
    }))),
  });
  assert.equal(analyzeShape(() => 500, false).targets[0]?.bestFitCandidate, "T(1)");
  assert.equal(analyzeShape((n) => 500 * (1 + Math.log2(n)), false).targets[0]?.bestFitCandidate, "T(log_n)");
  const opaque = analyzeShape((n) => n * 100, true);
  assert.equal(opaque.targets[0]?.fits.find((fit) => fit.candidate === "T(n_k)")?.observable, false);
  assert.equal(opaque.targets[0]?.fits.find((fit) => fit.candidate === "T(n_k_a)")?.observable, false);
});

test("decision packets enforce strict zero-touch and full seven-day rework coverage", async (t) => {
  const decision = await import("../src/decision.js").catch(() => undefined);
  if (decision === undefined) {
    t.skip("decision packet layer is introduced by the next stack tip");
    return;
  }
  const { buildRuhrohDecisionPacket, projectRuhrohProductEngineeringDecision, validateRuhrohDecisionPacket } = decision;
  const context: any = {
    version: "ruhroh_decision_context_v1",
    contextId: "context-1",
    authoredAt: "2026-01-01T00:00:00Z",
    workloadBinding: {
      version: "ruhroh_workload_binding_v1",
      experimentId: "experiment-1",
      workloadId: "workload-1",
      projectId: "project-1",
      workflowInstanceId: "workflow-1",
    },
    benchmarkClaimRef: REF,
    qualityEnvelope: { minimumPassRateWilsonLower: 0.5 },
    value: { mode: "displaced_work", indicatorId: "minutes_saved", unit: "minutes", baseline: 60, hypothesis: "Reduce bounded work." },
    observationWindow: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-01-02T00:00:00Z" },
    interventionPolicy: { autonomy: "strict_zero_touch", passiveObservationCountsAsIntervention: false, reworkWindowDays: 7 },
    stopRules: [{ id: "stop-cost", condition: "cost exceeds envelope", action: "stop" }],
    owners: {
      technical_owner: "role:technical",
      product_workload_owner: "role:product",
      financial_owner: "role:finance",
      governance_owner: "role:governance",
      accountable_decision_owner: "role:accountable",
    },
    privacy: { classification: "internal", publicReportingGrain: "workload" },
  };
  const ledger: any = {
    version: "ruhroh_intervention_ledger_v1",
    ledgerId: "ledger-1",
    workloadBinding: context.workloadBinding,
    coverage: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-01-10T00:00:00Z", complete: true, missingReasons: [] },
    verification: "measured",
    events: [],
  };
  const technical: any = { conclusion: "supported", evidenceLevel: "measured", reasons: ["quality floor met"], evidenceRefs: [REF] };
  const packet = buildRuhrohDecisionPacket({
    packetId: "packet-1",
    createdAt: "2026-01-10T00:00:00Z",
    context,
    contextRef: REF,
    technicalOutcome: technical,
    interventionLedger: ledger,
    interventionLedgerRef: REF,
    economicsEnvelopeRef: REF,
    budgetOutcomeRef: REF,
    findingsRef: REF,
    unitEconomics: { status: "supported", coverage: "complete", tokensPerAcceptedOutcome: 1000, reasons: ["complete"] },
    containmentEvidence: { budgetStatus: "within", reasons: ["within"] },
    traceFindings: { confirmed: 1, candidate: 0, notObservable: 0 },
    businessValueEvidence: { indicatorId: "minutes_saved", conclusion: "supported", evidenceLevel: "measured", observedValue: 45, evidenceRefs: [REF], reasons: ["observed against baseline"] },
    decision: { action: "continue", signerRole: "accountable_decision_owner", signedAt: "2026-01-10T00:00:00Z", signatureRef: REF, rationale: "Evidence supports continuation." },
  });
  assert.equal(packet.tiers.autonomousDeflection.conclusion, "supported");
  assert.equal(packet.readiness, "decision_ready");
  assert.deepEqual(validateRuhrohDecisionPacket(packet), []);
  assert.equal(projectRuhrohProductEngineeringDecision(packet).containment.interventionCount, 0);
  assert.equal(projectRuhrohProductEngineeringDecision(packet).unitEconomics.tokensPerAcceptedOutcome, 1000);
  assert.equal(projectRuhrohProductEngineeringDecision(packet).traceFindings.confirmed, 1);
  assert.equal(projectRuhrohProductEngineeringDecision(packet).rework.coverageComplete, true);

  const assisted = buildRuhrohDecisionPacket({
    packetId: "packet-2",
    createdAt: "2026-01-10T00:00:00Z",
    context,
    contextRef: REF,
    technicalOutcome: technical,
    interventionLedger: {
      ...ledger,
      events: [{ version: "ruhroh_intervention_event_v1", eventId: "approval-1", kind: "approval", actorRole: "reviewer", startedAt: "2026-01-02T00:00:00Z", durationMinutes: 1, workflowInstanceId: "workflow-1", reason: "mandatory approval", evidenceRefs: [REF] }],
    },
    interventionLedgerRef: REF,
  });
  assert.equal(assisted.tiers.autonomousDeflection.conclusion, "not_supported");
});

test("neutral billing reconciliation preserves exact and allocated facts per currency", async (t) => {
  const billing = await import("../src/billing.js").catch(() => undefined);
  if (billing === undefined) {
    t.skip("billing reconciliation layer is introduced by the final stack tip");
    return;
  }
  const { buildRuhrohCostReconciliation, parseRuhrohBillingCsv, validateRuhrohCostReconciliation } = billing;
  const profile: any = {
    version: "ruhroh_billing_mapping_profile_v1",
    profileId: "provider-csv-v1",
    provider: "example",
    externalSchemaVersion: "2026-01",
    fields: { sourceRowId: "id", amount: "amount", currency: "currency", kind: "kind", occurredAt: "at", providerRequestId: "request" },
    kindValues: { charge: ["usage"], credit: ["credit"] },
    matching: { boundedWindowSeconds: 60, boundedFields: ["model"] },
    allocations: [{ sourceRowId: "row-2", targets: [{ workloadId: "workload-a", weight: 0.5 }, { workloadId: "workload-b", weight: 0.5 }] }],
    tolerance: 1e-9,
  };
  const parsed = parseRuhrohBillingCsv("id,amount,currency,kind,at,request\nrow-1,10,USD,usage,2026-01-01T00:00:00Z,request-1\nrow-2,-2,USD,credit,2026-01-01T00:01:00Z,\n", profile);
  assert.deepEqual(parsed.errors, []);
  const fact = (factId: string, workloadId: string): any => ({
    version: "ruhroh_technical_economic_fact_v1",
    factId,
    runId: `run-${factId}`,
    benchmarkTargetId: "target-a",
    workloadId,
    occurredAt: "2026-01-01T00:00:00Z",
    ...(factId === "fact-1" ? { providerRequestIdHash: createHash("sha256").update("request-1").digest("hex") } : {}),
    evidenceRef: REF,
  });
  const source: any = {
    version: "ruhroh_billing_source_manifest_v1",
    sourceId: "bill-1",
    format: "csv",
    externalSchemaVersion: "2026-01",
    billingPeriod: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-02-01T00:00:00Z" },
    currencies: ["USD"],
    rowCount: 2,
    sourceRef: REF,
    privacyClassification: "restricted",
  };
  const reconciliation = buildRuhrohCostReconciliation({
    reconciliationId: "recon-1",
    createdAt: "2026-02-02T00:00:00Z",
    benchmarkClaimRef: REF,
    billingSource: source,
    billingSourceRef: REF,
    mappingProfile: profile,
    mappingProfileRef: REF,
    billingRows: parsed.rows,
    technicalFacts: [fact("fact-1", "workload-a"), fact("fact-2", "workload-b")],
  });
  assert.equal(reconciliation.coverage.exactRows, 1);
  assert.equal(reconciliation.coverage.allocatedRows, 1);
  assert.equal(reconciliation.currencies[0]?.sourceTotal, 8);
  assert.equal(reconciliation.currencies[0]?.assignedTotal, 8);
  assert.equal(reconciliation.ready, true);
  assert.deepEqual(validateRuhrohCostReconciliation(reconciliation), []);
});
