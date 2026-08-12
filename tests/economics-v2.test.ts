import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildRuhrohCompareV2,
  aggregateRuhrohRuns,
  summarizeRuhrohPairwiseAdapterComparisons,
  summarizeRuhrohRun,
  validateRuhrohBenchmarkClaim,
  validateRuhrohBenchmarkSummary,
  validateRuhrohCompareV2,
  type RuhrohLoopResult,
} from "../src/results.js";
import {
  buildRuhrohOutcomeFrontier,
  validateRuhrohOutcomeFrontier,
} from "../src/economics.js";
import {
  validateRuhrohSuite,
  type RuhrohBenchmarkSuiteV2,
} from "../src/suites.js";
import {
  buildRuhrohClaimIndexEntryV2,
  buildRuhrohPublicationBundleV2,
  buildRuhrohPublicationIndexV2,
  buildRuhrohPublicationV2,
  buildRuhrohPublishCheckV2,
  validateRuhrohPublicationBundleV2,
  validateRuhrohPublicationIndexV2,
  validateRuhrohPublicationV2,
  validateRuhrohClaimIndex,
  validateRuhrohPublishBundleManifest,
  validateRuhrohPublishCheckReport,
  validateRuhrohPublishCheckV2,
  type RuhrohPublicationArtifactReferenceV2,
} from "../src/publication.js";

function suite(overrides: Partial<RuhrohBenchmarkSuiteV2["methodology"]["efficiency"]> = {}): RuhrohBenchmarkSuiteV2 {
  return {
    version: "ruhroh_suite_v2",
    id: "economics-v2",
    title: "Economics v2",
    suiteVersion: "2.0.0",
    description: "Outcome-constrained economics fixture.",
    scenarioIds: ["scenario-a"],
    scenarioVersions: { "scenario-a": "1.0.0" },
    methodology: {
      minRuns: 5,
      aggregationUnit: "scenario_benchmark_target",
      reportPolicy: "pass_rate_ci_pass_at_k_outcome_frontier",
      confidenceLevel: 0.95,
      retryPolicy: "No automatic retries.",
      efficiency: {
        denominator: {
          id: "accepted_scenario_outcome",
          predicate: "score_1_and_eval_passed",
          failedWork: "included_in_resource_numerator",
        },
        aggregation: {
          weighting: "run_plan",
          failedWork: "included_in_resource_numerator",
        },
        suitableWorkloads: ["Repeated coding-agent tasks with a stable evaluator."],
        requiredEvidence: ["Run-plan sample weights and complete selected economic metrics."],
        hiddenWork: ["Provider-side work not exposed by the execution adapter."],
        gamingRisks: ["Optimizing for evaluator quirks instead of the user outcome."],
        qualityFloor: {
          metric: "pass_rate",
          rule: "wilson_lower_bound_gte",
          threshold: 0.5,
          scope: "each_scenario",
        },
        objectives: ["cost_per_accepted_outcome", "p95_implementation_wall_time_ms"],
        bootstrap: {
          resamples: 1000,
          minValidResamples: 950,
          confidenceLevel: 0.95,
          stratification: "scenario",
        },
        ...overrides,
      },
    },
    governance: {
      owner: "ruhroh",
      changelog: ["Initial v2 fixture."],
      acceptanceCriteria: ["All locked scenarios are represented."],
      contaminationReview: "Reviewed.",
      rewardHackingReview: "Reviewed.",
      reviewChecklist: ["Check target identity."],
      deprecationPolicy: "Version changes are explicit.",
    },
  };
}

function run(input: {
  id: string;
  targetId: string;
  executionAdapterId?: string;
  score?: number;
  evalStatus?: "passed" | "failed" | "review" | "infra_failed";
  costUsd?: number;
  totalTokens?: number;
  durationMs?: number;
  includeImplementationRuntime?: boolean;
}): RuhrohLoopResult {
  const executionAdapterId = input.executionAdapterId ?? "shared-executor";
  const score = input.score ?? 1;
  const evalStatus = input.evalStatus ?? "passed";
  return {
    version: "ruhroh_loop_result_v1",
    runId: input.id,
    adapter: input.targetId,
    dataset: "fixture",
    scenarioId: "scenario-a",
    task_id: "scenario-a",
    status: evalStatus === "passed" ? "completed" : "failed",
    failure_kind: evalStatus === "passed" ? "none" : "evaluation_failed",
    failureBucket: evalStatus === "passed" ? "none" : "evaluation_failed",
    score,
    iterationsUsed: 1,
    implementationIterationsUsed: 1,
    implementationStoppedReason: "completed",
    stoppedReason: "completed",
    duration_ms: input.durationMs ?? 100,
    runAgent: {
      adapterId: executionAdapterId,
      continuityLevel: "workspace_only",
      sessionHandle: input.id,
      runIds: [input.id],
      implementationRuns: [],
      artifactPaths: {},
      economics: {
        version: "ruhroh_economics_envelope_v1",
        scope: "run",
        observations: [],
        totals: {
          usage: input.totalTokens === undefined ? {} : { totalTokens: input.totalTokens },
          costs: input.costUsd === undefined ? [] : [{ amount: input.costUsd, currency: "USD", kind: "metered" }],
        },
        ...(input.includeImplementationRuntime === false ? {} : {
          runtime: { wallTimeMs: input.durationMs ?? 100, implementationIterations: 1 },
        }),
        coverage: {
          cost: {
            status: input.costUsd === undefined ? "unavailable" : "complete",
            observationCount: input.costUsd === undefined ? 0 : 1,
            completeObservationCount: input.costUsd === undefined ? 0 : 1,
          },
          totalTokens: {
            status: input.totalTokens === undefined ? "unavailable" : "complete",
            observationCount: input.totalTokens === undefined ? 0 : 1,
            completeObservationCount: input.totalTokens === undefined ? 0 : 1,
          },
        },
        legacy: false,
        warnings: [],
      },
    },
    runAgentAdapterId: executionAdapterId,
    continuityLevel: "workspace_only",
    sessionHandle: input.id,
    runIds: [input.id],
    implementationRuns: [],
    artifactPaths: {},
    evalResult: {
      version: "ruhroh_eval_result_v1",
      status: evalStatus,
      goalMet: evalStatus === "passed",
      confidence: "high",
      reasons: ["Fixture judgment."],
      unmetCriteria: [],
      evidenceRefs: [{ kind: "fixture", ref: input.id, summary: "Fixture evidence." }],
      commandsRun: [],
      artifacts: {},
      finalSummary: "Fixture evaluator produced a deterministic judgment.",
      criteriaResults: [{
        id: "goal",
        description: "Goal",
        status: evalStatus === "passed" ? "passed" : "failed",
        score: evalStatus === "passed" ? 1 : 0,
        evidenceRefs: [{ kind: "fixture", ref: input.id, summary: "Fixture evidence." }],
      }],
      judge: { kind: "fixture", version: "1" },
    },
    runManifest: {
      version: "ruhroh_run_manifest_v1",
      runId: input.id,
      scenario: { id: "scenario-a", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "fixture", adapter: input.targetId },
      timing: { startedAt: "2026-08-12T00:00:00.000Z", durationMs: input.durationMs ?? 100 },
      loop: { maxIterations: 1, implementationIterationsUsed: 1, stoppedReason: "completed" },
      sample: { id: input.id, index: 1, count: 1, seed: input.id, weight: 1 },
      runAgent: {
        adapterId: executionAdapterId,
        adapterVersion: "1.0.0",
        continuityLevel: "workspace_only",
        sessionHandle: input.id,
        runIds: [input.id],
        model: { provider: "fixture", model: input.targetId, canonicalId: input.targetId, promptVersion: "1" },
      },
      evaluator: {
        judge: { kind: "fixture", version: "1" },
        model: { provider: "fixture", model: "judge", canonicalId: "fixture/judge", promptVersion: "1" },
        inputSummary: {
          scenarioContextCount: 1,
          goalRubricCount: 1,
          evidenceGuidanceCount: 1,
          calibrationCaseCount: 1,
          privateAssetCount: 0,
        },
      },
      environment: { fingerprint: { method: "sha256", sha256: "a".repeat(64) } },
      usage: {
        ...(input.costUsd === undefined ? {} : { costUsd: input.costUsd }),
        ...(input.totalTokens === undefined ? {} : { totalTokens: input.totalTokens }),
      },
      benchmarkTarget: {
        targetId: input.targetId,
        stream: "model-controlled",
        requestedModel: { model: input.targetId },
        actualModel: { model: input.targetId },
      },
      effectiveBudgetSha256: "budget-hash-v1",
      effectiveCapabilitiesSha256: "capabilities-hash-v1",
    },
  } as RuhrohLoopResult;
}

test("groups by benchmark target while preserving the execution adapter", () => {
  const groups = aggregateRuhrohRuns([
    run({ id: "a", targetId: "target-a", executionAdapterId: "aider", costUsd: 1, totalTokens: 100 }),
    run({ id: "b", targetId: "target-b", executionAdapterId: "aider", costUsd: 2, totalTokens: 200 }),
  ]);
  assert.deepEqual(groups.map((group) => group.adapter), ["target-a", "target-b"]);
  assert.deepEqual(groups.map((group) => group.benchmarkTargetId), ["target-a", "target-b"]);
  assert.deepEqual(groups.map((group) => group.executionAdapterIds), [["aider"], ["aider"]]);
  assert.deepEqual(groups.map((group) => group.cohort.effectiveBudgetHashes), [["budget-hash-v1"], ["budget-hash-v1"]]);
  assert.deepEqual(groups.map((group) => group.cohort.effectiveCapabilitiesHashes), [["capabilities-hash-v1"], ["capabilities-hash-v1"]]);
});

test("mixed effective budget and capability hashes remain visible and block comparability", () => {
  const left = run({ id: "left", targetId: "target-a", costUsd: 1 });
  const right = run({ id: "right", targetId: "target-a", costUsd: 1 });
  if (right.runManifest !== undefined) {
    right.runManifest.effectiveBudgetSha256 = "budget-hash-v2";
    right.runManifest.effectiveCapabilitiesSha256 = "capabilities-hash-v2";
  }
  const group = aggregateRuhrohRuns([left, right])[0];
  assert.deepEqual(group?.cohort.effectiveBudgetHashes, ["budget-hash-v1", "budget-hash-v2"]);
  assert.deepEqual(group?.cohort.effectiveCapabilitiesHashes, ["capabilities-hash-v1", "capabilities-hash-v2"]);
  assert.ok(group?.statisticalWarnings.includes("mixed effective budget hashes in aggregate group"));
  assert.ok(group?.statisticalWarnings.includes("mixed effective capabilities hashes in aggregate group"));
});

test("accepted outcomes require score=1 and evalStatus=passed", () => {
  const summary = summarizeRuhrohRun(run({ id: "mismatch", targetId: "target-a", score: 1, evalStatus: "failed", costUsd: 4 }));
  assert.equal(summary.acceptedOutcome, false);
  assert.match(summary.acceptedOutcomeInvariantWarnings[0] ?? "", /invariant mismatch/u);
  const group = aggregateRuhrohRuns([run({ id: "mismatch", targetId: "target-a", score: 1, evalStatus: "failed", costUsd: 4 })])[0];
  assert.equal(group?.passes, 0);
  assert.equal(group?.usage.costPerAcceptedOutcome, undefined);
});

test("cost and token coverage are independent and partial numerators suppress ratios", () => {
  const group = aggregateRuhrohRuns([
    run({ id: "one", targetId: "target-a", costUsd: 1, totalTokens: 100 }),
    run({ id: "two", targetId: "target-a", totalTokens: 200 }),
  ])[0];
  assert.equal(group?.usage.coverage.cost.status, "partial");
  assert.equal(group?.usage.coverage.totalTokens.status, "complete");
  assert.equal(group?.usage.costPerPass, undefined);
  assert.equal(group?.usage.costPerAcceptedOutcome, undefined);
  assert.equal(group?.usage.tokensPerAcceptedOutcome, 150);
});

test("all-unavailable cost evidence stays unavailable while token coverage remains complete", () => {
  const group = aggregateRuhrohRuns([
    run({ id: "one", targetId: "target-a", totalTokens: 100 }),
    run({ id: "two", targetId: "target-a", totalTokens: 200 }),
  ])[0];
  assert.equal(group?.usage.coverage.cost.status, "unavailable");
  assert.equal(group?.usage.coverage.cost.completeRuns, 0);
  assert.equal(group?.usage.coverage.totalTokens.status, "complete");
  assert.equal(group?.usage.costPerAcceptedOutcome, undefined);
  assert.equal(group?.usage.tokensPerAcceptedOutcome, 150);
});

test("estimated and manual cost totals cannot produce accepted-outcome ratios", () => {
  for (const kind of ["estimated", "manual"] as const) {
    const result = run({ id: kind, targetId: "target-a", costUsd: 4 });
    const envelope = result.runAgent.economics as { totals: { costs: Array<{ kind: string }> } };
    if (envelope.totals.costs[0] !== undefined) envelope.totals.costs[0].kind = kind;
    const summary = summarizeRuhrohRun(result);
    const group = aggregateRuhrohRuns([result])[0];
    assert.equal(summary.usageCoverage.cost, "partial");
    assert.equal(group?.usage.coverage.cost.status, "partial");
    assert.equal(group?.usage.costPerAcceptedOutcome, undefined);
  }
});

test("mixed or non-USD native cost totals are not implicitly converted", () => {
  const nonUsd = run({ id: "non-usd", targetId: "target-a", costUsd: 4 });
  const nonUsdEnvelope = nonUsd.runAgent.economics as { totals: { costs: Array<{ currency: string }> } };
  if (nonUsdEnvelope.totals.costs[0] !== undefined) nonUsdEnvelope.totals.costs[0].currency = "EUR";
  if (nonUsd.runManifest?.usage !== undefined) delete nonUsd.runManifest.usage.costUsd;
  const nonUsdGroup = aggregateRuhrohRuns([nonUsd])[0];
  assert.equal(nonUsdGroup?.usage.coverage.cost.status, "partial");
  assert.equal(nonUsdGroup?.usage.totalCostUsd, undefined);
  assert.equal(nonUsdGroup?.usage.costPerAcceptedOutcome, undefined);

  const mixed = run({ id: "mixed", targetId: "target-a", costUsd: 4 });
  const mixedEnvelope = mixed.runAgent.economics as { totals: { costs: Array<{ amount: number; currency: string; kind: string }> } };
  mixedEnvelope.totals.costs.push({ amount: 3, currency: "EUR", kind: "metered" });
  const mixedGroup = aggregateRuhrohRuns([mixed])[0];
  assert.equal(mixedGroup?.usage.coverage.cost.status, "partial");
  assert.equal(mixedGroup?.usage.costPerAcceptedOutcome, undefined);
});

test("legacy usage without an economics completeness contract stays unknown", () => {
  const legacy = run({ id: "legacy", targetId: "target-a", costUsd: 1, totalTokens: 100 });
  delete legacy.runAgent.economics;
  const group = aggregateRuhrohRuns([legacy])[0];
  assert.equal(group?.usage.coverage.cost.status, "unknown");
  assert.equal(group?.usage.coverage.cost.observedRuns, 1);
  assert.equal(group?.usage.coverage.cost.completeRuns, 0);
  assert.equal(group?.usage.costPerAcceptedOutcome, undefined);
  assert.equal(group?.usage.tokensPerAcceptedOutcome, undefined);
});

test("economics envelope totals override contradictory legacy usage projections", () => {
  const result = run({ id: "authoritative", targetId: "target-a", costUsd: 1, totalTokens: 100 });
  if (result.runManifest !== undefined) {
    result.runManifest.usage = { costUsd: 999, totalTokens: 999_999 };
  }
  const group = aggregateRuhrohRuns([result])[0];
  assert.equal(group?.usage.totalCostUsd, 1);
  assert.equal(group?.usage.totalTokens, 100);
  assert.equal(group?.usage.costPerAcceptedOutcome, 1);
  assert.equal(group?.usage.tokensPerAcceptedOutcome, 100);
});

test("suite v2 rejects an unreachable Wilson floor and retains valid v1 semantics", () => {
  const unreachable = suite({
    qualityFloor: {
      metric: "pass_rate",
      rule: "wilson_lower_bound_gte",
      threshold: 0.9,
      scope: "each_scenario",
    },
  });
  assert.ok(validateRuhrohSuite(unreachable).some((error) => error.includes("unreachable")));
  assert.deepEqual(validateRuhrohSuite(suite()), []);
});

test("frontier uses deterministic stratified bootstrap and reports Pareto plus robust dominance", () => {
  const runs = [
    ...Array.from({ length: 5 }, (_, index) => run({ id: `cheap-${index}`, targetId: "cheap", costUsd: 1, totalTokens: 100, durationMs: 100 })),
    ...Array.from({ length: 5 }, (_, index) => run({ id: `expensive-${index}`, targetId: "expensive", costUsd: 2, totalTokens: 200, durationMs: 200 })),
  ];
  const summaries = runs.map(summarizeRuhrohRun);
  const first = buildRuhrohOutcomeFrontier({ summaries, suite: suite() });
  const second = buildRuhrohOutcomeFrontier({ summaries, suite: suite() });
  assert.deepEqual(first, second);
  assert.equal(first.status, "available");
  assert.deepEqual(first.paretoFrontierTargetIds, ["cheap"]);
  assert.deepEqual(first.robustFrontierTargetIds, ["cheap"]);
  assert.equal(first.targets.find((target) => target.benchmarkTargetId === "expensive")?.paretoStatus, "dominated");
  assert.deepEqual(validateRuhrohOutcomeFrontier(first).errors, []);
});

test("frontier treats equal complete points as jointly non-dominated", () => {
  const runs = [
    ...Array.from({ length: 5 }, (_, index) => run({ id: `left-${index}`, targetId: "left", costUsd: 1, durationMs: 100 })),
    ...Array.from({ length: 5 }, (_, index) => run({ id: `right-${index}`, targetId: "right", costUsd: 1, durationMs: 100 })),
  ];
  const frontier = buildRuhrohOutcomeFrontier({ summaries: runs.map(summarizeRuhrohRun), suite: suite() });
  assert.deepEqual(frontier.paretoFrontierTargetIds, ["left", "right"]);
  assert.deepEqual(frontier.robustFrontierTargetIds, ["left", "right"]);
});

test("a failing per-scenario Wilson floor excludes only that target from the frontier", () => {
  const runs = [
    ...Array.from({ length: 5 }, (_, index) => run({ id: `good-${index}`, targetId: "good", costUsd: 1 })),
    ...Array.from({ length: 5 }, (_, index) => run({
      id: `bad-${index}`,
      targetId: "bad",
      costUsd: 1,
      ...(index < 4 ? { score: 0, evalStatus: "failed" as const } : {}),
    })),
  ];
  const frontier = buildRuhrohOutcomeFrontier({ summaries: runs.map(summarizeRuhrohRun), suite: suite() });
  const bad = frontier.targets.find((target) => target.benchmarkTargetId === "bad");
  assert.equal(bad?.quality.floorStatus, "failed");
  assert.equal(bad?.paretoStatus, "ineligible");
  assert.ok(bad?.reasonCodes.includes("quality_floor_failed"));
});

test("partial objective coverage makes the frontier unavailable without inventing a ratio", () => {
  const runs = [
    ...Array.from({ length: 5 }, (_, index) => run({ id: `complete-${index}`, targetId: "complete", costUsd: 1 })),
    ...Array.from({ length: 5 }, (_, index) => run({ id: `partial-${index}`, targetId: "partial", ...(index === 0 ? {} : { costUsd: 2 }) })),
  ];
  const frontier = buildRuhrohOutcomeFrontier({
    summaries: runs.map(summarizeRuhrohRun),
    suite: suite({ objectives: ["cost_per_accepted_outcome"] }),
  });
  const partial = frontier.targets.find((target) => target.benchmarkTargetId === "partial")?.objectives[0];
  assert.equal(frontier.status, "unavailable");
  assert.equal(partial?.status, "partial");
  assert.equal(partial?.value, undefined);
  assert.equal(partial?.ci95, undefined);
});

test("frontier stays explicitly unavailable when no suite declares efficiency methodology", () => {
  const summaries = [run({ id: "ad-hoc", targetId: "target-a", costUsd: 1 })].map(summarizeRuhrohRun);
  const frontier = buildRuhrohOutcomeFrontier({ summaries });
  assert.equal(frontier.status, "unavailable");
  assert.deepEqual(frontier.reasonCodes, ["suite_not_declared"]);
  assert.equal(frontier.methodology, undefined);
  assert.deepEqual(validateRuhrohOutcomeFrontier(frontier).errors, []);
});

test("implementation latency uses envelope runtime and is unavailable for legacy total duration", () => {
  const runs = Array.from({ length: 5 }, (_, index) => run({
    id: `legacy-duration-${index}`,
    targetId: "target-a",
    durationMs: 10 + index,
    includeImplementationRuntime: false,
  }));
  const frontier = buildRuhrohOutcomeFrontier({
    summaries: runs.map(summarizeRuhrohRun),
    suite: suite({ objectives: ["p95_implementation_wall_time_ms"] }),
  });
  const objective = frontier.targets[0]?.objectives[0];
  assert.equal(objective?.coverage.status, "unavailable");
  assert.equal(objective?.status, "unavailable");
  assert.equal(objective?.value, undefined);
  assert.ok(objective?.reasonCodes.includes("metric_unavailable"));
});

test("v2 compare preserves legacy runs with an explicit non-publishable identity fallback", () => {
  const legacy = run({ id: "legacy-target", targetId: "old-target", executionAdapterId: "old-adapter", costUsd: 1 });
  if (legacy.runManifest !== undefined) delete legacy.runManifest.benchmarkTarget;
  const summaries = [summarizeRuhrohRun(legacy)];
  const groups = aggregateRuhrohRuns([legacy]);
  const compare = buildRuhrohCompareV2({
    groups,
    outcomeFrontier: buildRuhrohOutcomeFrontier({ summaries }),
    createdAt: "2026-08-12T00:00:00.000Z",
    claimReadiness: {
      scope: "ad_hoc_compare",
      publishable: false,
      blockers: ["no suite selected; use compare --suite for publishable benchmark claims"],
      advisories: [],
    },
  });
  assert.equal(compare.benchmarkClaim.targetSummaries[0]?.benchmarkTargetId, "legacy_execution_adapter:old-adapter");
  assert.equal(compare.benchmarkClaim.targetSummaries[0]?.identityStatus, "legacy_execution_adapter_fallback");
  assert.equal(compare.benchmarkClaim.publishable, false);
  assert.ok(compare.benchmarkClaim.readiness.publication.blockers.some((blocker) => blocker.includes("legacy execution-adapter fallback")));
  assert.deepEqual(validateRuhrohCompareV2(compare).errors, []);
});

test("frontier aggregation honors declared run-plan weights and rejects incomplete weight coverage", () => {
  const weightedRuns = [
    ...[1, 1, 1, 1, 10].map((costUsd, index) => run({ id: `weighted-${index}`, targetId: "weighted", costUsd })),
    ...Array.from({ length: 5 }, (_, index) => run({ id: `flat-${index}`, targetId: "flat", costUsd: 2 })),
  ];
  if (weightedRuns[0]?.runManifest?.sample !== undefined) weightedRuns[0].runManifest.sample.weight = 10;
  const frontier = buildRuhrohOutcomeFrontier({
    summaries: weightedRuns.map(summarizeRuhrohRun),
    suite: suite({ objectives: ["cost_per_accepted_outcome"] }),
  });
  const weighted = frontier.targets.find((target) => target.benchmarkTargetId === "weighted")?.objectives[0];
  assert.ok(weighted?.value !== undefined);
  assert.ok(Math.abs((weighted?.value ?? 0) - 23 / 14) < 1e-12);
  assert.equal(weighted?.weightedAcceptedOutcomes, 14);

  if (weightedRuns[1]?.runManifest?.sample !== undefined) delete weightedRuns[1].runManifest.sample.weight;
  const incomplete = buildRuhrohOutcomeFrontier({
    summaries: weightedRuns.map(summarizeRuhrohRun),
    suite: suite({ objectives: ["cost_per_accepted_outcome"] }),
  }).targets.find((target) => target.benchmarkTargetId === "weighted")?.objectives[0];
  assert.equal(incomplete?.planWeightCoverage.status, "partial");
  assert.equal(incomplete?.value, undefined);
  assert.equal(incomplete?.ci95, undefined);
});

test("compare, claim, and summary v2 builders produce mutually consistent validated artifacts", () => {
  const runs = [
    ...Array.from({ length: 5 }, (_, index) => run({ id: `cheap-${index}`, targetId: "cheap", costUsd: 1, durationMs: 100 })),
    ...Array.from({ length: 5 }, (_, index) => run({ id: `expensive-${index}`, targetId: "expensive", costUsd: 2, durationMs: 200 })),
  ];
  const groups = aggregateRuhrohRuns(runs, { minRuns: 5, expectedScenarioVersions: { "scenario-a": "1.0.0" } });
  const pairwiseComparisons = summarizeRuhrohPairwiseAdapterComparisons(groups, { minRuns: 5 });
  const outcomeFrontier = buildRuhrohOutcomeFrontier({ summaries: runs.map(summarizeRuhrohRun), suite: suite() });
  const compare = buildRuhrohCompareV2({
    groups,
    pairwiseComparisons,
    outcomeFrontier,
    createdAt: "2026-08-12T00:00:00.000Z",
    suite: {
      id: "economics-v2",
      title: "Economics v2",
      suiteVersion: "2.0.0",
      scenarioIds: ["scenario-a"],
      scenarioVersions: { "scenario-a": "1.0.0" },
      minRuns: 5,
      retryPolicy: "No automatic retries.",
    },
    claimReadiness: { scope: "suite", publishable: true, blockers: [], advisories: [] },
    runPlanPresent: true,
  });
  assert.equal(compare.benchmarkClaim.summary.targetCount, 2);
  assert.equal(compare.benchmarkClaim.summary.totalAcceptedOutcomes, 10);
  assert.equal(compare.benchmarkClaim.publishable, compare.benchmarkClaim.readiness.publication.publishable);
  assert.deepEqual(validateRuhrohBenchmarkClaim(compare.benchmarkClaim).errors, []);
  assert.deepEqual(validateRuhrohBenchmarkSummary(compare.benchmarkSummary).errors, []);
  assert.deepEqual(validateRuhrohCompareV2(compare).errors, []);

  const inconsistent = structuredClone(compare);
  inconsistent.benchmarkSummary.summary.totalAcceptedOutcomes += 1;
  assert.ok(validateRuhrohCompareV2(inconsistent).errors.some((error) => error.includes("totalAcceptedOutcomes") || error.includes("must match")));

  const inconsistentGroup = structuredClone(compare);
  if (inconsistentGroup.groups[0] !== undefined) inconsistentGroup.groups[0].runs += 1;
  assert.ok(validateRuhrohCompareV2(inconsistentGroup).errors.some((error) => error.includes("groups[0].runs")));

  const invalidReadiness = structuredClone(compare);
  invalidReadiness.claimReadiness.blockers.push("new blocker");
  assert.ok(validateRuhrohCompareV2(invalidReadiness).errors.some((error) => error.includes("claimReadiness.publishable")));

  const invalidFrontierClaim = structuredClone(compare.benchmarkClaim);
  const invalidObjective = invalidFrontierClaim.outcomeFrontier.targets[0]?.objectives[0];
  if (invalidObjective !== undefined) invalidObjective.validBootstrapSamples = 949;
  assert.ok(validateRuhrohBenchmarkClaim(invalidFrontierClaim).errors.some((error) => error.includes("validBootstrapSamples")));
});

test("v2 publication contracts stay thin, target-aware, and mutually valid", () => {
  const runs = [
    ...Array.from({ length: 5 }, (_, index) => run({ id: `pub-a-${index}`, targetId: "target-a", costUsd: 1 })),
    ...Array.from({ length: 5 }, (_, index) => run({ id: `pub-b-${index}`, targetId: "target-b", costUsd: 2 })),
  ];
  const groups = aggregateRuhrohRuns(runs, { minRuns: 5, expectedScenarioVersions: { "scenario-a": "1.0.0" } });
  const compare = buildRuhrohCompareV2({
    groups,
    pairwiseComparisons: summarizeRuhrohPairwiseAdapterComparisons(groups, { minRuns: 5 }),
    outcomeFrontier: buildRuhrohOutcomeFrontier({ summaries: runs.map(summarizeRuhrohRun), suite: suite() }),
    createdAt: "2026-08-12T00:00:00.000Z",
    suite: {
      id: "economics-v2",
      title: "Economics v2",
      suiteVersion: "2.0.0",
      scenarioIds: ["scenario-a"],
      scenarioVersions: { "scenario-a": "1.0.0" },
      minRuns: 5,
      retryPolicy: "No automatic retries.",
    },
    claimReadiness: { scope: "suite", publishable: true, blockers: [], advisories: [] },
    runPlanPresent: true,
  });
  const publishCheck = buildRuhrohPublishCheckV2({ source: { resultsPath: "./results", suiteId: "economics-v2" }, compare });
  assert.deepEqual(validateRuhrohPublishCheckV2(publishCheck).errors, []);

  const bundleRoles = [
    "manifest", "publish-check", "compare", "compare-html", "benchmark-claim", "benchmark-summary",
    "outcome-frontier", "publication", "review-json", "review-html", "eval-quality", "eval-quality-html", "readme",
  ];
  const bundle = buildRuhrohPublicationBundleV2({
    createdAt: "2026-08-12T00:00:00.000Z",
    source: { resultsPath: "./results", bundlePath: "./publication", suiteId: "economics-v2" },
    publishCheck,
    files: bundleRoles.map((role) => ({ role, path: `${role}.json`, description: `${role} artifact` })),
  });
  assert.deepEqual(validateRuhrohPublicationBundleV2(bundle).errors, []);

  const indexEntry = buildRuhrohClaimIndexEntryV2({
    claimPath: "./publication/benchmark-claim.json",
    bundlePath: "./publication",
    claim: compare.benchmarkClaim,
  });
  const index = buildRuhrohPublicationIndexV2({
    generatedAt: "2026-08-12T00:00:00.000Z",
    source: { inputPath: "./publication" },
    claims: [indexEntry],
  });
  assert.equal(index.targetCount, 2);
  assert.deepEqual(validateRuhrohPublicationIndexV2(index).errors, []);

  const artifacts: RuhrohPublicationArtifactReferenceV2[] = [
    ["publish-check", "ruhroh_publish_check_v2"],
    ["bundle-manifest", "ruhroh_publish_bundle_v2"],
    ["compare", "ruhroh_compare_v2"],
    ["benchmark-claim", "ruhroh_benchmark_claim_v2"],
    ["benchmark-summary", "ruhroh_benchmark_summary_v2"],
    ["outcome-frontier", "ruhroh_outcome_frontier_v1"],
    ["claim-index", "ruhroh_claim_index_v2"],
    ["economic-trace", "ruhroh_economic_trace_span_v1"],
    ["intervention-ledger", "ruhroh_intervention_ledger_v1"],
    ["cost-reconciliation", "ruhroh_cost_reconciliation_v1"],
    ["decision-packet", "ruhroh_decision_packet_v1"],
  ].map(([role, contractVersion]) => ({
    role: role as RuhrohPublicationArtifactReferenceV2["role"],
    path: `./${role}.json`,
    sha256: "a".repeat(64),
    contractVersion: contractVersion as RuhrohPublicationArtifactReferenceV2["contractVersion"],
  }));
  const publication = buildRuhrohPublicationV2({
    createdAt: "2026-08-12T00:00:00.000Z",
    publishable: publishCheck.publishable,
    artifacts,
  });
  assert.equal(Object.hasOwn(publication, "compare"), false);
  assert.deepEqual(validateRuhrohPublicationV2(publication).errors, []);
});

test("publication readers retain archived v1 contract support", () => {
  const publishCheck = {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json",
    version: "ruhroh_publish_check_v1",
    source: { resultsPath: "./archived-results" },
    publishable: false,
    blockerCount: 1,
    blockers: ["archived blocker"],
    remediation: [{
      code: "archived",
      category: "claim",
      severity: "blocker",
      blocker: "archived blocker",
      action: "Retain the original evidence.",
      docs: "contract-evolution",
    }],
    advisoryCount: 0,
    advisories: [],
    compare: { version: "ruhroh_compare_v1" },
  };
  const bundle = {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json",
    version: "ruhroh_publish_bundle_v1",
    createdAt: "2026-01-01T00:00:00.000Z",
    source: { resultsPath: "./archived-results", bundlePath: "." },
    publishable: false,
    blockerCount: 1,
    advisoryCount: 0,
    files: [],
  };
  const index = {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/claim-index-v1.schema.json",
    version: "ruhroh_claim_index_v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    source: { inputPath: "./archive" },
    registryReady: false,
    registryBlockers: [],
    claimCount: 0,
    publishableCount: 0,
    blockedCount: 0,
    invalidCount: 0,
    suiteCount: 0,
    adapterCount: 0,
    totalRuns: 0,
    claims: [],
  };
  assert.equal(validateRuhrohPublishCheckReport(publishCheck).version, "ruhroh_publish_check_validation_v1");
  assert.deepEqual(validateRuhrohPublishCheckReport(publishCheck).errors, []);
  assert.equal(validateRuhrohPublishBundleManifest(bundle).version, "ruhroh_publish_bundle_manifest_validation_v1");
  assert.deepEqual(validateRuhrohPublishBundleManifest(bundle).errors, []);
  assert.equal(validateRuhrohClaimIndex(index).version, "ruhroh_claim_index_validation_v1");
  assert.deepEqual(validateRuhrohClaimIndex(index).errors, []);
});

test("v2 schema files expose the versioned contracts", () => {
  for (const [file, version] of [
    ["schemas/suite-v2.schema.json", "ruhroh_suite_v2"],
    ["schemas/outcome-frontier-v1.schema.json", "ruhroh_outcome_frontier_v1"],
    ["schemas/compare-v2.schema.json", "ruhroh_compare_v2"],
    ["schemas/benchmark-claim-v2.schema.json", "ruhroh_benchmark_claim_v2"],
    ["schemas/benchmark-summary-v2.schema.json", "ruhroh_benchmark_summary_v2"],
    ["schemas/publication-v2.schema.json", "ruhroh_publication_v2"],
    ["schemas/publish-check-v2.schema.json", "ruhroh_publish_check_v2"],
    ["schemas/publish-bundle-v2.schema.json", "ruhroh_publish_bundle_v2"],
    ["schemas/claim-index-v2.schema.json", "ruhroh_claim_index_v2"],
  ]) {
    const schema = JSON.parse(readFileSync(file, "utf8")) as { properties?: { version?: { const?: string } } };
    assert.equal(schema.properties?.version?.const, version);
  }
});
