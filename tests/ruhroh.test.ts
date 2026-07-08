import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adapterSatisfiesRequirements,
  assessRuhrohArtifactCompleteness,
  assessRuhrohEvalQuality,
  buildAgentEnvArgs,
  buildRuhrohHarborCommand,
  deriveRuhrohVerdict,
  discoverRuhrohScenarios,
  discoverRuhrohSuites,
  aggregateRuhrohRuns,
  generateHarborDataset,
  generateHarborTask,
  getBuiltinRuhrohSuiteById,
  getBuiltinRuhrohSuitesByScenarioId,
  loadRuhrohScenario,
  loadRuhrohSuite,
  loadBuiltinRuhrohSuites,
  lintRuhrohScenarioEvaluation,
  lintRuhrohScenarioEvaluationDetailed,
  mapEvalResultToVerdict,
  normalizeRuhrohEvalResult,
  redactEnvAssignment,
  readImplementationTimeline,
  readRunUsage,
  resolveRuhrohBuiltinSuiteDir,
  scoreForEvalStatus,
  summarizeRuhrohBenchmarkClaim,
  summarizeRuhrohBenchmarkClaimReadiness,
  summarizeRuhrohPairwiseAdapterComparisons,
  summarizeRuhrohReviewQueue,
  summarizeRuhrohRun,
  summarizeRuhrohSuiteAdapters,
  validateRuhrohBenchmarkClaim,
  validateRuhrohScenario,
  validateRuhrohScenarioSource,
  validateRuhrohSuite,
  validateRuhrohSuiteSource,
  type RuhrohBenchmarkSuite,
  type RuhrohLoopResult,
  type RuhrohRunAgentAdapterCapabilities,
  type RuhrohScenario,
} from "../src/index.js";
import { buildHarborSpawnEnv, parseRuhrohCliArgs, resolveRuhrohPythonPath, runRuhrohCli } from "../src/cli.js";

const kestrelCapabilities: RuhrohRunAgentAdapterCapabilities = {
  adapter: "kestrel",
  continuity: "native_session",
  tools: ["filesystem", "shell"],
  network: true,
};

function scenario(overrides: Partial<RuhrohScenario> = {}): RuhrohScenario {
  return {
    version: "ruhroh_scenario_v2",
    id: "example-scenario",
    title: "Example Scenario",
    tier: "smoke",
    kind: "real_user",
    userPrompt: "Build a local app.",
    run: {
      mode: "build",
      timeoutSeconds: 300,
    },
    requires: {
      continuity: "workspace_plus_transcript",
      tools: ["filesystem", "shell"],
      network: false,
    },
    loop: {
      defaultMaxIterations: 3,
      stopPolicy: "goal_satisfied_or_max",
    },
    evaluation: {
      mode: "agentic_goal_review",
      scenarioContext: ["Local app task."],
      goalRubric: ["The app satisfies the user goal."],
      evidenceGuidance: ["Inspect and run the app."],
      calibrationCases: [{
        id: "passing-delivery",
        inputSummary: "The final workspace runs locally and satisfies the requested workflow.",
        expectedStatus: "passed",
        rationale: "The user-visible outcome is complete and supported by reviewer evidence.",
      }],
    },
    ...overrides,
  };
}

function suite(overrides: Partial<RuhrohBenchmarkSuite> = {}): RuhrohBenchmarkSuite {
  return {
    version: "ruhroh_suite_v1",
    id: "example-suite",
    title: "Example Suite",
    suiteVersion: "1.0.0",
    description: "A small repeatable benchmark pack.",
    scenarioIds: ["example-scenario"],
    scenarioVersions: { "example-scenario": "1.0.0" },
    methodology: {
      minRuns: 5,
      aggregationUnit: "scenario_adapter",
      reportPolicy: "pass_rate_ci_pass_at_k",
      confidenceLevel: 0.95,
      retryPolicy: "Retry only proven infrastructure failures.",
    },
    governance: {
      owner: "ruhroh-maintainers",
      createdAt: "2026-07-07",
      updatedAt: "2026-07-07",
      changelog: ["1.0.0: Initial suite."],
      acceptanceCriteria: ["Scenarios judge outcome behavior."],
      contaminationReview: "Original fixture.",
      rewardHackingReview: "Reviewed for filename and static-output shortcuts.",
      reviewChecklist: ["Confirm outcome behavior is judged."],
      deprecationPolicy: "Bump suiteVersion for membership changes.",
    },
    ...overrides,
  };
}

function loopResultFixture(overrides: Partial<RuhrohLoopResult> = {}): RuhrohLoopResult {
  return {
    version: "ruhroh_loop_result_v1",
    adapter: "ruhroh-harbor",
    dataset: "ruhroh@local",
    scenarioId: "example-scenario",
    task_id: "example-scenario",
    status: "completed",
    failure_kind: "none",
    failureBucket: "none",
    score: 1,
    iterationsUsed: 1,
    implementationIterationsUsed: 1,
    implementationStoppedReason: "goal_satisfied",
    stoppedReason: "goal_satisfied",
    duration_ms: 100,
    runAgent: {
      adapterId: "agent-a",
      continuityLevel: "workspace_only",
      sessionHandle: "session",
      runIds: [],
      transcriptPaths: [],
      eventLogPaths: [],
      artifactPaths: {},
    },
    runAgentAdapterId: "agent-a",
    continuityLevel: "workspace_only",
    sessionHandle: "session",
    runIds: [],
    implementationRuns: [],
    ...overrides,
  };
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath, "utf8")).digest("hex");
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

test("scenario validation accepts portable v2 scenarios", () => {
  assert.deepEqual(
    validateRuhrohScenario(scenario(), { adapters: { kestrel: kestrelCapabilities } }),
    [],
  );
});

test("scenario validation accepts benchmark metadata and rejects malformed metadata", () => {
  assert.deepEqual(
    validateRuhrohScenario(scenario({
      metadata: {
        scenarioVersion: "1.0.0",
        provenance: "authored from a real support workflow",
        createdAt: "2026-07-07",
        updatedAt: "2026-07-07T12:00:00Z",
        difficulty: "standard",
        tags: ["local-app", "persistence"],
        visibility: "public",
        expectedRuntimeSeconds: 600,
        contaminationNotes: "No public canonical solution.",
        maintainers: ["ruhroh-maintainers"],
        changelog: ["1.0.0: Initial scenario."],
        lifecycle: { status: "active" },
      },
    })),
    [],
  );

  const errors = validateRuhrohScenario(scenario({
    metadata: {
      scenarioVersion: "",
      createdAt: "July 7",
      difficulty: "medium" as never,
      tags: ["ok", ""],
      visibility: "draft" as never,
      expectedRuntimeSeconds: 0,
      privateEvalRationale: "",
      changelog: [],
      lifecycle: {
        status: "paused" as never,
        reason: "",
        replacementId: "../unsafe",
        sunsetAt: "soon",
      },
    },
  })).join("\n");

  assert.match(errors, /metadata\.scenarioVersion/u);
  assert.match(errors, /metadata\.createdAt/u);
  assert.match(errors, /metadata\.difficulty/u);
  assert.match(errors, /metadata\.tags/u);
  assert.match(errors, /metadata\.visibility/u);
  assert.match(errors, /metadata\.expectedRuntimeSeconds/u);
  assert.match(errors, /metadata\.privateEvalRationale/u);
  assert.match(errors, /metadata\.changelog/u);
  assert.match(errors, /metadata\.lifecycle\.status/u);
  assert.match(errors, /metadata\.lifecycle\.reason/u);
  assert.match(errors, /metadata\.lifecycle\.replacementId/u);
  assert.match(errors, /metadata\.lifecycle\.sunsetAt/u);

  const publicErrors = validateRuhrohScenario(scenario({
    requires: {
      continuity: "workspace_plus_transcript",
      tools: ["filesystem", "shell"],
      network: true,
    },
    metadata: {
      scenarioVersion: "1.0.0",
      visibility: "public",
    },
  })).join("\n");

  assert.match(publicErrors, /metadata\.provenance is required for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.createdAt is required for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.difficulty is required for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.tags must include at least one entry for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.expectedRuntimeSeconds is required for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.maintainers must include at least one entry for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.changelog must include at least one entry for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.lifecycle\.status is required for public or held_out scenarios/u);
  assert.match(publicErrors, /metadata\.networkRationale is required when public or held_out scenarios require network access/u);

  const heldOutWithoutPrivateEval = validateRuhrohScenario(scenario({
    metadata: {
      scenarioVersion: "1.0.0",
      provenance: "authored from a real support workflow",
      createdAt: "2026-07-07",
      updatedAt: "2026-07-07",
      difficulty: "standard",
      tags: ["local-app", "persistence"],
      visibility: "held_out",
      expectedRuntimeSeconds: 600,
      contaminationNotes: "No public canonical solution.",
      maintainers: ["ruhroh-maintainers"],
      changelog: ["1.0.0: Initial scenario."],
      lifecycle: { status: "active" },
    },
  })).join("\n");

  assert.match(heldOutWithoutPrivateEval, /metadata\.privateEvalRationale is required for held_out scenarios without evaluation\.privateAssets/u);

  assert.deepEqual(validateRuhrohScenario(scenario({
    metadata: {
      scenarioVersion: "1.0.0",
      provenance: "authored from a real support workflow",
      createdAt: "2026-07-07",
      updatedAt: "2026-07-07",
      difficulty: "standard",
      tags: ["local-app", "persistence"],
      visibility: "held_out",
      expectedRuntimeSeconds: 600,
      contaminationNotes: "No public canonical solution.",
      privateEvalRationale: "Expected outputs live in a private evaluator service.",
      maintainers: ["ruhroh-maintainers"],
      changelog: ["1.0.0: Initial scenario."],
      lifecycle: { status: "active" },
    },
  })), []);
});

test("scenario validation accepts evaluator calibration cases and rejects malformed anchors", () => {
  assert.deepEqual(validateRuhrohScenario(scenario({
    evaluation: {
      mode: "agentic_goal_review",
      scenarioContext: ["Local app task.", "The user wants outcome behavior."],
      goalRubric: [
        "The final app implements the requested workflow end to end.",
        "The app can be run or opened locally by a reviewer.",
        "The delivered result avoids prose-only output.",
      ],
      evidenceGuidance: [
        "Inspect the final workspace behavior.",
        "Use command output and transcripts as supporting evidence.",
      ],
      calibrationCases: [{
        id: "review-needed",
        inputSummary: "The app mostly works, but one core workflow could not be verified.",
        expectedStatus: "review",
        rationale: "The evaluator should request review when evidence is ambiguous.",
      }],
    },
  })), []);

  const errors = validateRuhrohScenario(scenario({
    evaluation: {
      mode: "agentic_goal_review",
      scenarioContext: ["Local app task.", "The user wants outcome behavior."],
      goalRubric: [
        "The final app implements the requested workflow end to end.",
        "The app can be run or opened locally by a reviewer.",
        "The delivered result avoids prose-only output.",
      ],
      evidenceGuidance: [
        "Inspect the final workspace behavior.",
        "Use command output and transcripts as supporting evidence.",
      ],
      calibrationCases: [{
        id: "",
        inputSummary: "",
        expectedStatus: "maybe" as never,
        rationale: "",
      }],
    },
  })).join("\n");

  assert.match(errors, /evaluation\.calibrationCases\[0\]\.id/u);
  assert.match(errors, /evaluation\.calibrationCases\[0\]\.inputSummary/u);
  assert.match(errors, /evaluation\.calibrationCases\[0\]\.expectedStatus/u);
  assert.match(errors, /evaluation\.calibrationCases\[0\]\.rationale/u);
});

test("scenario evaluation lint flags generic rubric and weak evidence guidance", () => {
  const weakScenario = {
    ...scenario(),
    evaluation: {
      mode: "agentic_goal_review",
      scenarioContext: ["Local app task."],
      goalRubric: ["The app satisfies the user goal."],
      evidenceGuidance: ["Inspect source filenames."],
    },
  } satisfies RuhrohScenario;

  assert.deepEqual(lintRuhrohScenarioEvaluation(weakScenario), [
    "evaluation.scenarioContext should include at least 2 context notes for evaluator calibration",
    "evaluation.calibrationCases should include at least 1 expected judgment anchor",
    "evaluation.goalRubric should include at least 3 concrete outcome criteria",
    "evaluation.evidenceGuidance should include at least 2 evidence collection instructions",
    "evaluation.goalRubric[0] is terse; prefer a concrete, auditable outcome",
    "evaluation.goalRubric[0] is generic; state the specific behavior the evaluator must verify",
    "evaluation.evidenceGuidance should prioritize delivered behavior over source-text or filename checks",
  ]);
  assert.deepEqual(lintRuhrohScenarioEvaluationDetailed(weakScenario).map((diagnostic) => ({
    code: diagnostic.code,
    category: diagnostic.category,
    field: diagnostic.field,
  })), [
    {
      code: "evaluation_context_minimum",
      category: "calibration",
      field: "evaluation.scenarioContext",
    },
    {
      code: "evaluation_calibration_cases_minimum",
      category: "calibration",
      field: "evaluation.calibrationCases",
    },
    {
      code: "evaluation_goal_rubric_minimum",
      category: "rubric",
      field: "evaluation.goalRubric",
    },
    {
      code: "evaluation_evidence_guidance_minimum",
      category: "evidence",
      field: "evaluation.evidenceGuidance",
    },
    {
      code: "evaluation_goal_rubric_terse",
      category: "rubric",
      field: "evaluation.goalRubric[0]",
    },
    {
      code: "evaluation_goal_rubric_generic",
      category: "rubric",
      field: "evaluation.goalRubric[0]",
    },
    {
      code: "evaluation_evidence_proxy_source",
      category: "evidence",
      field: "evaluation.evidenceGuidance",
    },
  ]);
});

test("scenario validation rejects adapter identity in v2 scenarios", () => {
  const errors = validateRuhrohScenario({
    ...scenario(),
    driver: { adapter: "kestrel", timeoutSeconds: 300 },
  }).join("\n");

  assert.match(errors, /driver is not allowed in ruhroh_scenario_v2/u);
});

test("published package contract ships benchmark authoring assets", () => {
  const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  const claimSchema = JSON.parse(readFileSync(path.resolve("schemas", "benchmark-claim-v1.schema.json"), "utf8"));
  const benchmarkSummarySchema = JSON.parse(readFileSync(path.resolve("schemas", "benchmark-summary-v1.schema.json"), "utf8"));
  const evalResultSchema = JSON.parse(readFileSync(path.resolve("schemas", "eval-result-v1.schema.json"), "utf8"));
  const loopResultSchema = JSON.parse(readFileSync(path.resolve("schemas", "loop-result-v1.schema.json"), "utf8"));
  const runManifestSchema = JSON.parse(readFileSync(path.resolve("schemas", "run-manifest-v1.schema.json"), "utf8"));
  const runPlanSchema = JSON.parse(readFileSync(path.resolve("schemas", "run-plan-v1.schema.json"), "utf8"));
  const scenarioSchema = JSON.parse(readFileSync(path.resolve("schemas", "scenario-v2.schema.json"), "utf8"));
  const suiteSchema = JSON.parse(readFileSync(path.resolve("schemas", "suite-v1.schema.json"), "utf8"));
  const workspaceSummarySchema = JSON.parse(readFileSync(path.resolve("schemas", "workspace-summary-v1.schema.json"), "utf8"));
  const exampleNewsletter = JSON.parse(readFileSync(path.resolve("examples", "scenarios", "simple-newsletter", "scenario.json"), "utf8"));
  const exampleGroceryPlanner = JSON.parse(readFileSync(path.resolve("examples", "scenarios", "grocery-budget-planner", "scenario.json"), "utf8"));
  const shippedGlobs = packageJson.files as string[];

  for (const expectedGlob of [
    "dist",
    "python/**/*.py",
    "python/**/*.sh",
    "scenarios/**/*",
    "schemas/**/*",
    "suites/**/*",
    "examples/**/*",
    "docs/**/*.md",
    "README.md",
    "LICENSE",
  ]) {
    assert.equal(shippedGlobs.includes(expectedGlob), true, `${expectedGlob} must be included in the npm package`);
  }

  assert.equal(packageJson.exports["./schemas/benchmark-claim-v1.schema.json"], "./schemas/benchmark-claim-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/benchmark-summary-v1.schema.json"], "./schemas/benchmark-summary-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/eval-result-v1.schema.json"], "./schemas/eval-result-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/loop-result-v1.schema.json"], "./schemas/loop-result-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/run-manifest-v1.schema.json"], "./schemas/run-manifest-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/run-plan-v1.schema.json"], "./schemas/run-plan-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/scenario-v2.schema.json"], "./schemas/scenario-v2.schema.json");
  assert.equal(packageJson.exports["./schemas/suite-v1.schema.json"], "./schemas/suite-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/workspace-summary-v1.schema.json"], "./schemas/workspace-summary-v1.schema.json");
  assert.equal(packageJson.bin.ruhroh, "./dist/cli.js");
  assert.equal(packageJson.description, "Realistic user-request benchmarks for coding agents");
  assert.equal(existsSync(path.resolve("examples", "adapters", "fixture-newsletter", "run.sh")), true);
  assert.equal(existsSync(path.resolve("examples", "evaluators", "fixture-newsletter", "run.sh")), true);
  assert.equal(existsSync(path.resolve("suites", "ruhroh-smoke", "suite.json")), true);
  assert.equal(existsSync(path.resolve("docs", "benchmark-methodology.md")), true);
  assert.equal(claimSchema.properties.version.const, "ruhroh_benchmark_claim_v1");
  assert.equal(benchmarkSummarySchema.properties.version.const, "ruhroh_benchmark_summary_v1");
  assert.equal(benchmarkSummarySchema.properties.rows.items.$ref, "#/$defs/summaryRow");
  assert.equal(claimSchema.properties.suiteCoverage.$ref, "#/$defs/suiteCoverage");
  assert.equal(claimSchema.properties.readiness.required.includes("publishable"), true);
  assert.equal(claimSchema.$defs.scenarioResult.required.includes("meanScoreCi95"), true);
  assert.equal(claimSchema.$defs.scenarioResult.required.includes("usage"), true);
  assert.equal(claimSchema.$defs.adapterSummary.required.includes("usage"), true);
  assert.equal(claimSchema.$defs.usage.required.includes("runsWithCost"), true);
  assert.equal(benchmarkSummarySchema.$defs.summaryRow.required.includes("usage"), true);
  assert.equal(claimSchema.properties.methodology.properties.statisticalMethods.items.enum.includes("bootstrap_mean_score_ci"), true);
  assert.equal(claimSchema.properties.evidence.required.includes("runPlanPresent"), true);
  assert.equal(claimSchema.properties.evidence.required.includes("artifactValidationErrors"), true);
  assert.equal(evalResultSchema.properties.version.const, "ruhroh_eval_result_v1");
  assert.equal(evalResultSchema.required.includes("evidenceRefs"), true);
  assert.equal(loopResultSchema.properties.version.const, "ruhroh_loop_result_v1");
  assert.equal(loopResultSchema.required.includes("implementationRuns"), true);
  assert.equal(runManifestSchema.properties.version.const, "ruhroh_run_manifest_v1");
  assert.equal(runManifestSchema.properties.environment.properties.fingerprint.$ref, "#/$defs/fingerprint");
  assert.equal(runManifestSchema.properties.runAgent.required.includes("adapterId"), true);
  assert.equal(runPlanSchema.properties.version.const, "ruhroh_run_plan_v1");
  assert.equal(runPlanSchema.properties.samples.items.$ref, "#/$defs/plannedSample");
  assert.equal(scenarioSchema.properties.version.const, "ruhroh_scenario_v2");
  assert.equal(scenarioSchema.$defs.metadata.properties.privateEvalRationale.type, "string");
  assert.deepEqual(scenarioSchema.properties.evaluation.required, ["mode", "scenarioContext", "goalRubric", "evidenceGuidance"]);
  assert.equal(suiteSchema.properties.version.const, "ruhroh_suite_v1");
  assert.equal(suiteSchema.properties.governance.required.includes("contaminationReview"), true);
  assert.equal(suiteSchema.properties.governance.required.includes("rewardHackingReview"), true);
  assert.equal(suiteSchema.properties.governance.required.includes("reviewChecklist"), true);
  assert.equal(suiteSchema.properties.governance.required.includes("deprecationPolicy"), true);
  assert.equal(workspaceSummarySchema.properties.version.const, "ruhroh_workspace_summary_v1");
  assert.equal(workspaceSummarySchema.properties.sampleFiles.items.$ref, "#/$defs/sampleFile");
  for (const exampleScenario of [exampleNewsletter, exampleGroceryPlanner]) {
    assert.equal(exampleScenario.version, "ruhroh_scenario_v2");
    assert.equal(exampleScenario.driver, undefined);
    assert.equal(exampleScenario.run.mode, "build");
    assert.equal(exampleScenario.metadata.visibility, "public");
  }
});

test("suite validation accepts governed benchmark packs and rejects broken references", () => {
  assert.deepEqual(validateRuhrohSuite(suite(), {
    availableScenarioIds: ["example-scenario"],
    availableScenarioVersions: { "example-scenario": "1.0.0" },
  }), []);

  const errors = validateRuhrohSuite(suite({
    id: "bad/id",
    scenarioIds: ["missing", "missing"],
    scenarioVersions: { missing: "0.1.0", extra: "1.0.0" },
    methodology: {
      minRuns: 0,
      aggregationUnit: "scenario_adapter",
      reportPolicy: "pass_rate_ci_pass_at_k",
      confidenceLevel: 0.95,
      retryPolicy: "",
    },
    governance: {
      owner: "",
      changelog: [],
      acceptanceCriteria: [""],
    },
  }), {
    availableScenarioIds: ["example-scenario"],
    availableScenarioVersions: { missing: "1.0.0" },
  }).join("\n");

  assert.match(errors, /id contains unsafe characters/u);
  assert.match(errors, /duplicate scenario id/u);
  assert.match(errors, /references unknown scenario/u);
  assert.match(errors, /scenarioVersions\.missing=0\.1\.0 does not match scenario metadata version 1\.0\.0/u);
  assert.match(errors, /scenarioVersions contains entry for non-member scenario: extra/u);
  assert.match(errors, /methodology\.minRuns/u);
  assert.match(errors, /methodology\.retryPolicy/u);
  assert.match(errors, /governance\.owner/u);
  assert.match(errors, /governance\.changelog/u);
  assert.match(errors, /governance\.acceptanceCriteria/u);
  assert.match(errors, /governance\.contaminationReview/u);
  assert.match(errors, /governance\.rewardHackingReview/u);
  assert.match(errors, /governance\.reviewChecklist/u);
  assert.match(errors, /governance\.deprecationPolicy/u);
});

test("scenario validation rejects missing fields and incompatible adapters", () => {
  const invalid = scenario({
    id: "bad/id",
    run: { timeoutSeconds: 0 },
    requires: { continuity: "workspace_plus_transcript", tools: ["filesystem"], network: true },
    evaluation: {
      mode: "agentic_goal_review",
      scenarioContext: [""],
      goalRubric: [],
      evidenceGuidance: ["Inspect."],
    },
  });

  const errors = validateRuhrohScenario(invalid).join("\n");

  assert.match(errors, /id contains unsafe characters/u);
  assert.match(errors, /run.timeoutSeconds must be positive/u);
  assert.match(errors, /evaluation.goalRubric/u);
});

test("adapter capability compatibility reports exact gaps", () => {
  assert.deepEqual(
    adapterSatisfiesRequirements(
      { adapter: "custom-shell", continuity: "workspace_only", tools: ["filesystem"], network: false },
      { continuity: "workspace_plus_transcript", tools: ["filesystem", "shell"], network: true },
    ),
    [
      "adapter custom-shell does not satisfy required continuity workspace_plus_transcript",
      "adapter custom-shell does not provide required tool shell",
      "adapter custom-shell does not provide required network access",
    ],
  );
});

test("verdict mapping is binary and preserves failure buckets", () => {
  assert.equal(scoreForEvalStatus("passed"), 1);
  assert.equal(scoreForEvalStatus("review"), 0);
  assert.deepEqual(mapEvalResultToVerdict({ status: "passed" }), { status: "completed", failure_kind: "none", score: 1 });
  assert.deepEqual(mapEvalResultToVerdict({ status: "failed" }), { status: "failed", failure_kind: "goal_mismatch", score: 0 });
  assert.deepEqual(
    deriveRuhrohVerdict([{ status: "failed", failureKind: "adapter_failed" }], { status: "passed" }),
    { status: "failed", failure_kind: "adapter_failed", score: 0 },
  );
});

test("eval result normalization preserves legacy compatibility and enriched evidence", () => {
  const legacy = normalizeRuhrohEvalResult({
    version: "ruhroh_eval_result_v1",
    status: "passed",
    reasons: ["done"],
  });

  assert.equal(legacy.status, "passed");
  assert.equal(legacy.goalMet, true);
  assert.equal(legacy.confidence, "medium");
  assert.equal(scoreForEvalStatus(legacy.status), 1);

  const enriched = normalizeRuhrohEvalResult({
    version: "ruhroh_eval_result_v1",
    status: "failed",
    goalMet: false,
    confidence: "high",
    criteriaResults: [{
      id: "build",
      description: "App builds",
      status: "partial",
      score: 0.5,
      evidenceRefs: [{ kind: "command", ref: "npm test", summary: "one test failed" }],
      notes: "Needs repair.",
    }],
    subscores: { functionality: 0.25, evidenceQuality: 1.5 },
    judge: { kind: "hybrid", model: "eval-model", version: "2026-07-07" },
    judgeVotes: [
      {
        judge: { kind: "model", model: "eval-model-a", version: "2026-07-07" },
        status: "failed",
        confidence: "high",
        rationale: "Export is missing.",
        evidenceRefs: [{ kind: "command", ref: "npm test", summary: "one test failed" }],
      },
      {
        judge: { kind: "model", model: "eval-model-b", version: "2026-07-07" },
        status: "failed",
        confidence: "medium",
        rationale: "The core workflow is incomplete.",
        evidenceRefs: [{ kind: "file", ref: "README.md", summary: "no app workflow evidence" }],
      },
    ],
  });

  assert.equal(enriched.status, "failed");
  assert.equal(enriched.criteriaResults?.[0]?.score, 0.5);
  assert.equal(enriched.subscores?.functionality, 0.25);
  assert.equal(enriched.subscores?.evidenceQuality, 1);
  assert.deepEqual(enriched.judge, { kind: "hybrid", model: "eval-model", version: "2026-07-07" });
  assert.equal(enriched.judgeVotes?.length, 2);
  assert.equal(enriched.judgeAgreement?.votes, 2);
  assert.equal(enriched.judgeAgreement?.unanimous, true);
  assert.equal(enriched.judgeAgreement?.majorityStatus, "failed");
  assert.deepEqual(enriched.judgeAgreement?.statusCounts, { passed: 0, failed: 2, review: 0, infra_failed: 0 });
  assert.equal(mapEvalResultToVerdict(enriched).score, 0);
});

test("eval quality assessment flags weak or unauditable judgments", () => {
  const weak = normalizeRuhrohEvalResult({
    version: "ruhroh_eval_result_v1",
    status: "review",
    confidence: "low",
    reasons: ["unsure"],
    finalSummary: "ok",
  });

  assert.deepEqual(assessRuhrohEvalQuality(weak), [
    "eval requested human review",
    "eval confidence is low",
    "eval result has no top-level evidenceRefs",
    "eval result has no criteriaResults",
    "eval result has no judge metadata",
    "eval finalSummary is too terse for audit",
  ]);

  const disputed = normalizeRuhrohEvalResult({
    version: "ruhroh_eval_result_v1",
    status: "passed",
    confidence: "high",
    reasons: ["primary judge passed"],
    evidenceRefs: [{ kind: "command", ref: "npm test", summary: "tests passed" }],
    commandsRun: [{ command: "npm test", exitCode: 0, summary: "passed" }],
    finalSummary: "One judge passed the final workspace while another found missing user-visible workflow evidence.",
    criteriaResults: [{
      id: "workflow",
      description: "Workflow is complete",
      status: "passed",
      score: 1,
      evidenceRefs: [{ kind: "command", ref: "npm test", summary: "tests passed" }],
    }],
    judge: { kind: "hybrid", model: "arbiter", version: "2026-07-07" },
    judgeVotes: [
      {
        judge: { kind: "model", model: "eval-a", version: "2026-07-07" },
        status: "passed",
        confidence: "high",
        rationale: "The app works.",
        evidenceRefs: [{ kind: "command", ref: "npm test", summary: "tests passed" }],
      },
      {
        judge: { kind: "model", model: "eval-b", version: "2026-07-07" },
        status: "failed",
        confidence: "medium",
        rationale: "The visible workflow is incomplete.",
        evidenceRefs: [],
      },
    ],
  });
  assert.deepEqual(disputed.judgeAgreement?.statusCounts, { passed: 1, failed: 1, review: 0, infra_failed: 0 });
  const disputedWarnings = assessRuhrohEvalQuality(disputed);
  assert.equal(disputedWarnings.includes("eval judgeVotes disagree; human review recommended"), true);
  assert.equal(disputedWarnings.includes("judge vote model/eval-b@2026-07-07 has no evidenceRefs"), true);

  const strong = normalizeRuhrohEvalResult({
    version: "ruhroh_eval_result_v1",
    status: "passed",
    confidence: "high",
    reasons: ["verified"],
    evidenceRefs: [{ kind: "file", ref: "index.html", summary: "newsletter exists" }],
    commandsRun: [{ command: "node smoke.js", exitCode: 0, summary: "passed" }],
    finalSummary: "The evaluator inspected the delivered workspace and verified the requested newsletter behavior.",
    criteriaResults: [{
      id: "newsletter",
      description: "Newsletter exists",
      status: "passed",
      score: 1,
      evidenceRefs: [{ kind: "file", ref: "index.html", summary: "three stories" }],
    }],
    judge: { kind: "fixture", version: "fixture-v1" },
  });

  assert.deepEqual(assessRuhrohEvalQuality(strong), []);
});

test("run usage parser preserves non-negative cost and token metadata", () => {
  assert.deepEqual(readRunUsage({
    costUsd: 0.125,
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
  }), {
    costUsd: 0.125,
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
  });

  assert.deepEqual(readRunUsage({ costUsd: -1, totalTokens: "100" }), undefined);
});

test("env helper formats placeholders without exposing secret values", () => {
  assert.deepEqual(buildAgentEnvArgs({ OPENROUTER_API_KEY: "secret", RUHROH_EVAL_MODEL: "eval-model" }), [
    "--agent-env",
    "OPENROUTER_API_KEY=${OPENROUTER_API_KEY}",
    "--agent-env",
    "RUHROH_EVAL_MODEL=${RUHROH_EVAL_MODEL}",
  ]);
  assert.equal(redactEnvAssignment("OPENROUTER_API_KEY=secret"), "OPENROUTER_API_KEY=${OPENROUTER_API_KEY}");
});

test("Harbor command construction includes adapter and artifacts", () => {
  const command = buildRuhrohHarborCommand({
    scenario: scenario({
      metadata: {
        scenarioVersion: "1.0.0",
        difficulty: "intro",
      },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app task."],
        goalRubric: ["The app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app."],
        calibrationCases: [{
          id: "failed-delivery",
          inputSummary: "The app is only a README describing what would be built.",
          expectedStatus: "failed",
          rationale: "A prose-only result is not a delivered workspace.",
        }],
        privateAssets: ["private/rubric.json"],
      },
    }),
    adapter: "kestrel",
    datasetPath: path.resolve("/repo", ".generated/ruhroh/harbor"),
    iterations: 2,
    env: {
      OPENROUTER_API_KEY: "secret",
      RUHROH_RUN_AGENT_COMMAND_SHELL: "1",
      RUHROH_EVAL_COMMAND_SHELL: "1",
    },
  });

  assert.equal(command.scenarioId, "example-scenario");
  assert.deepEqual(command.args.slice(0, 6), [
    "run",
    "--path",
    path.resolve("/repo", ".generated/ruhroh/harbor/tasks/example-scenario"),
    "--agent-import-path",
    "ruhroh.harbor_agent:RuhrohHarborAgent",
    "--n-concurrent",
  ]);
  assert.equal(command.args.includes("RUHROH_MAX_ITERATIONS=2"), true);
  assert.equal(command.args.includes("RUHROH_RUN_AGENT_ADAPTER=kestrel"), true);
  assert.equal(command.args.includes("RUHROH_RUN_MODE=build"), true);
  assert.equal(command.args.includes("RUHROH_SCENARIO_METADATA_JSON={\"scenarioVersion\":\"1.0.0\",\"difficulty\":\"intro\"}"), true);
  assert.equal(command.args.includes("RUHROH_EVAL_GOAL_RUBRIC_JSON=[\"The app satisfies the user goal.\"]"), true);
  assert.equal(command.args.includes("RUHROH_EVAL_CALIBRATION_CASES_JSON=[{\"id\":\"failed-delivery\",\"inputSummary\":\"The app is only a README describing what would be built.\",\"expectedStatus\":\"failed\",\"rationale\":\"A prose-only result is not a delivered workspace.\"}]"), true);
  assert.equal(command.args.includes(`RUHROH_EVAL_PRIVATE_ASSETS_JSON=${JSON.stringify([path.resolve("/repo", ".generated/ruhroh/harbor/tasks/example-scenario/private-eval-assets/private/rubric.json")])}`), true);
  assert.equal(command.args.includes("OPENROUTER_API_KEY=${OPENROUTER_API_KEY}"), true);
  assert.equal(command.args.includes("RUHROH_RUN_AGENT_COMMAND_SHELL=${RUHROH_RUN_AGENT_COMMAND_SHELL}"), true);
  assert.equal(command.args.includes("RUHROH_EVAL_COMMAND_SHELL=${RUHROH_EVAL_COMMAND_SHELL}"), true);
  assert.equal(command.args.includes("/installed-agent/ruhroh-run-manifest.json"), true);
  assert.equal(command.args.includes("/installed-agent/ruhroh-loop-eval-input.json"), true);
  assert.equal(command.args.includes("/installed-agent/ruhroh-workspace-summary.json"), true);
  assert.equal(command.args.filter((arg) => arg === "--artifact").length, 11);
});

test("JSON scenario discovery loads prompt files", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-scenarios-"));
  try {
    const scenarioDir = path.join(tmp, "simple-newsletter");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const sources = discoverRuhrohScenarios(tmp);
    assert.equal(sources.length, 1);
    const loaded = loadRuhrohScenario(sources[0] ?? assert.fail("missing source"));
    assert.equal(loaded.scenario.version, "ruhroh_scenario_v2");
    assert.equal(loaded.scenario.id, "simple-newsletter");
    assert.equal(loaded.scenario.userPrompt, "Build a tiny newsletter page.");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("scenario source validation reports missing declared assets", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-source-validation-"));
  try {
    const scenarioDir = path.join(tmp, "simple-newsletter");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: ["assets/missing.csv"],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
        privateAssets: ["private/missing-rubric.json"],
      },
    }));

    const result = validateRuhrohScenarioSource(scenarioDir);
    assert.match(result.errors.join("\n"), /declared asset does not exist/u);
    assert.match(result.errors.join("\n"), /declared evaluation\.privateAssets asset does not exist/u);
    assert.match(result.warnings.join("\n"), /evaluation\.goalRubric should include/u);
    assert.deepEqual(result.warningDetails.map((diagnostic) => diagnostic.code), [
      "evaluation_context_minimum",
      "evaluation_calibration_cases_minimum",
      "evaluation_goal_rubric_minimum",
      "evaluation_evidence_guidance_minimum",
      "evaluation_goal_rubric_terse",
      "evaluation_goal_rubric_generic",
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("suite discovery loads manifests and validates referenced scenarios", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-suite-"));
  try {
    const scenarioDir = path.join(tmp, "scenarios", "simple-newsletter");
    const suiteDir = path.join(tmp, "suites", "local-smoke");
    mkdirSync(scenarioDir, { recursive: true });
    mkdirSync(suiteDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));
    writeFileSync(path.join(suiteDir, "suite.json"), JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["simple-newsletter"],
      scenarioVersions: { "simple-newsletter": "1.0.0" },
    })));

    const scenarioIds = discoverRuhrohScenarios(path.join(tmp, "scenarios"))
      .map((source) => loadRuhrohScenario(source).scenario.id);
    const suiteSources = discoverRuhrohSuites(path.join(tmp, "suites"));
    assert.equal(suiteSources.length, 1);
    assert.equal(loadRuhrohSuite(suiteSources[0] ?? assert.fail("missing suite")).id, "local-smoke");
    const validation = validateRuhrohSuiteSource(suiteSources[0] ?? assert.fail("missing suite"), { availableScenarioIds: scenarioIds });
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.suite?.scenarioIds[0], "simple-newsletter");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("built-in suite helpers expose bundled benchmark packs", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-builtin-suite-"));
  try {
    const suiteRoot = path.join(tmp, "suites");
    const smokeDir = path.join(suiteRoot, "ruhroh-smoke");
    const productivityDir = path.join(suiteRoot, "ruhroh-productivity");
    mkdirSync(smokeDir, { recursive: true });
    mkdirSync(productivityDir, { recursive: true });
    writeFileSync(path.join(smokeDir, "suite.json"), JSON.stringify(suite({
      id: "ruhroh-smoke",
      title: "Ruhroh Smoke",
      scenarioIds: ["simple-newsletter"],
      scenarioVersions: { "simple-newsletter": "1.0.0" },
    })));
    writeFileSync(path.join(productivityDir, "suite.json"), JSON.stringify(suite({
      id: "ruhroh-productivity",
      title: "Ruhroh Productivity",
      scenarioIds: ["simple-newsletter", "grocery-budget-planner"],
      scenarioVersions: { "simple-newsletter": "1.0.0", "grocery-budget-planner": "1.0.0" },
    })));

    assert.equal(resolveRuhrohBuiltinSuiteDir("/tmp/package-root"), path.join("/tmp/package-root", "suites"));
    const suites = loadBuiltinRuhrohSuites(suiteRoot);
    assert.deepEqual(suites.map((item) => item.id), ["ruhroh-productivity", "ruhroh-smoke"]);
    assert.equal(getBuiltinRuhrohSuiteById("ruhroh-smoke", suiteRoot)?.title, "Ruhroh Smoke");
    assert.deepEqual(
      getBuiltinRuhrohSuitesByScenarioId("simple-newsletter", suiteRoot).map((item) => item.id),
      ["ruhroh-productivity", "ruhroh-smoke"],
    );
    assert.equal(getBuiltinRuhrohSuiteById("missing", suiteRoot), undefined);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("JSON scenario loader maps legacy v1 driver defaults into run defaults", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-legacy-scenario-"));
  try {
    const scenarioDir = path.join(tmp, "legacy-newsletter");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v1",
      id: "legacy-newsletter",
      title: "Legacy Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      driver: { adapter: "custom-shell", mode: "build", timeoutSeconds: 123 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Legacy fixture."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const loaded = loadRuhrohScenario(scenarioDir);
    assert.equal(loaded.scenario.version, "ruhroh_scenario_v1");
    assert.equal(loaded.scenario.run.mode, "build");
    assert.equal(loaded.scenario.run.timeoutSeconds, 123);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Harbor task generation writes app-agnostic verifier and copies assets", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-generate-"));
  try {
    const scenarioDir = path.join(tmp, "scenarios", "grocery-budget-planner");
    mkdirSync(path.join(scenarioDir, "assets"), { recursive: true });
    mkdirSync(path.join(scenarioDir, "private"), { recursive: true });
    writeFileSync(path.join(scenarioDir, "assets", "budget.csv"), "category,amount\nfood,42\n");
    writeFileSync(path.join(scenarioDir, "private", "expected.json"), "{\"requiredStories\":3}\n");

    const result = generateHarborTask({
      scenario: scenario({
        version: "ruhroh_scenario_v2",
        id: "grocery-budget-planner",
        title: "Grocery Budget Planner",
        metadata: {
          scenarioVersion: "1.2.0",
          difficulty: "standard",
          tags: ["budget", "local-app"],
          visibility: "public",
          expectedRuntimeSeconds: 600,
          lifecycle: { status: "deprecated", replacementId: "grocery-budget-planner-v2" },
        },
        userPrompt: "Build a grocery budget planner.",
        run: { mode: "build", timeoutSeconds: 600 },
        requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
        evaluation: {
          mode: "agentic_goal_review",
          scenarioContext: ["Budget planning task.", "Private expected values are evaluator-only."],
          goalRubric: [
            "The final app lets the user enter grocery budget categories and amounts.",
            "The app computes visible totals for the grocery budget.",
            "The app can be opened or run locally by a reviewer.",
          ],
          evidenceGuidance: [
            "Run or inspect the delivered app.",
            "Use private evaluator assets only for judging, not as public prompt material.",
          ],
          privateAssets: ["private/expected.json"],
        },
      }),
      scenarioDir,
      outputRoot: path.join(tmp, "out"),
    });

    const instruction = readFileSync(path.join(result.taskDir, "instruction.md"), "utf8");
    const taskToml = readFileSync(path.join(result.taskDir, "task.toml"), "utf8");
    const verifier = readFileSync(path.join(result.taskDir, "tests", "test.sh"), "utf8");

    assert.equal(instruction, "Build a grocery budget planner.\n");
    assert.match(taskToml, /schema_version = "1\.3"/u);
    assert.match(taskToml, /scenario_id = "grocery-budget-planner"/u);
    assert.match(taskToml, /scenario_version = "1\.2\.0"/u);
    assert.match(taskToml, /run_mode = "build"/u);
    assert.match(taskToml, /difficulty = "standard"/u);
    assert.match(taskToml, /visibility = "public"/u);
    assert.match(taskToml, /lifecycle_status = "deprecated"/u);
    assert.match(taskToml, /lifecycle_replacement_id = "grocery-budget-planner-v2"/u);
    assert.match(taskToml, /tags = \["budget", "local-app"\]/u);
    assert.match(taskToml, /network_mode = "none"/u);
    assert.equal(existsSync(path.join(result.taskDir, "environment", "Dockerfile")), true);
    assert.equal(existsSync(path.join(result.taskDir, "solution", "solve.sh")), true);
    assert.equal(readFileSync(path.join(result.taskDir, "assets", "budget.csv"), "utf8"), "category,amount\nfood,42\n");
    assert.equal(readFileSync(path.join(result.taskDir, "private-eval-assets", "private", "expected.json"), "utf8"), "{\"requiredStories\":3}\n");
    assert.equal(existsSync(path.join(result.taskDir, "assets", "private", "expected.json")), false);
    assert.equal(result.filesWritten.includes(path.join(result.taskDir, "private-eval-assets", "private", "expected.json")), true);
    assert.match(verifier, /ruhroh-loop-result\.json/u);
    assert.match(verifier, /eval_result\.get\("status"\) != "passed"/u);
    assert.doesNotMatch(verifier, /required files|source text|route smoke|Build a grocery budget planner/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Harbor task generation reflects scenario network requirements", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-network-"));
  try {
    const scenarioDir = path.join(tmp, "scenarios", "networked-app");
    mkdirSync(scenarioDir, { recursive: true });
    const result = generateHarborTask({
      scenario: scenario({
        id: "networked-app",
        title: "Networked App",
        requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: true },
      }),
      scenarioDir,
      outputRoot: path.join(tmp, "out"),
    });

    assert.match(readFileSync(path.join(result.taskDir, "task.toml"), "utf8"), /network_mode = "public"/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("Harbor dataset generation returns a dataset root usable by Harbor commands", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-dataset-"));
  try {
    const loaded = {
      scenario: scenario({ id: "simple-newsletter" }),
      source: {
        scenarioDir: path.join(tmp, "scenarios", "simple-newsletter"),
        scenarioPath: path.join(tmp, "scenarios", "simple-newsletter", "scenario.json"),
      },
    };
    mkdirSync(loaded.source.scenarioDir, { recursive: true });

    const generated = generateHarborDataset({
      scenarios: [loaded],
      outputRoot: path.join(tmp, "generated"),
    });

    assert.equal(generated.datasetPath, path.join(tmp, "generated", "harbor"));
    assert.equal(generated.tasks.length, 1);
    assert.equal(existsSync(path.join(generated.datasetPath, "tasks", "simple-newsletter", "task.toml")), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI lists and generates scenarios from a clean fixture project", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const listStdout: string[] = [];
    const listCode = await runRuhrohCli(["--scenario-dir", "ruhroh/scenarios", "--list"], {
      spawn: (() => assert.fail("list should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { listStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(listCode, 0);
    assert.match(listStdout.join(""), /simple-newsletter\tsmoke\tSimple Newsletter/u);

    const generateStdout: string[] = [];
    const generateCode = await runRuhrohCli(["--scenario-dir", "ruhroh/scenarios", "--scenario", "simple-newsletter", "--generate-only"], {
      spawn: (() => assert.fail("generate-only should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { generateStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(generateCode, 0);
    assert.match(generateStdout.join(""), /generate-only complete/u);
    assert.equal(existsSync(path.join(tmp, ".generated", "ruhroh", "harbor", "tasks", "simple-newsletter", "task.toml")), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI lists and generates benchmark suites from a clean fixture project", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-suite-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    const suiteDir = path.join(tmp, "ruhroh", "suites", "local-smoke");
    mkdirSync(scenarioDir, { recursive: true });
    mkdirSync(suiteDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));
    writeFileSync(path.join(suiteDir, "suite.json"), JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["simple-newsletter"],
      scenarioVersions: { "simple-newsletter": "1.0.0" },
    })));

    const listStdout: string[] = [];
    const listCode = await runRuhrohCli(["--suite-dir", "ruhroh/suites", "--list-suites"], {
      spawn: (() => assert.fail("list-suites should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { listStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(listCode, 0);
    assert.match(listStdout.join(""), /local-smoke\t1\.0\.0\t1\tLocal Smoke/u);

    const generateStdout: string[] = [];
    const generateCode = await runRuhrohCli([
      "--scenario-dir",
      "ruhroh/scenarios",
      "--suite-dir",
      "ruhroh/suites",
      "--suite",
      "local-smoke",
      "--generate-only",
    ], {
      spawn: (() => assert.fail("suite generate-only should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { generateStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(generateCode, 0);
    assert.match(generateStdout.join(""), /generated simple-newsletter/u);
    assert.equal(existsSync(path.join(tmp, ".generated", "ruhroh", "harbor", "tasks", "simple-newsletter", "task.toml")), true);

    const validateStdout: string[] = [];
    const validateCode = await runRuhrohCli([
      "validate",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--suite-dir",
      "ruhroh/suites",
      "--suite",
      "local-smoke",
      "--json",
    ], {
      spawn: (() => assert.fail("suite validate should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { validateStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const validation = JSON.parse(validateStdout.join(""));
    assert.equal(validateCode, 0);
    assert.equal(validation.suiteResults[0].suite.id, "local-smoke");
    assert.equal(validation.results[0].scenario.id, "simple-newsletter");

    const runStdout: string[] = [];
    const runCode = await runRuhrohCli([
      "--scenario-dir",
      "ruhroh/scenarios",
      "--suite-dir",
      "ruhroh/suites",
      "--suite",
      "local-smoke",
      "--adapter",
      "custom-shell",
    ], {
      spawn: (() => ({ status: 0 })) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { runStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const runPlanPath = path.join(tmp, ".generated", "ruhroh", "ruhroh-run-plan.json");
    const runPlan = JSON.parse(readFileSync(runPlanPath, "utf8"));
    assert.equal(runCode, 0);
    assert.match(runStdout.join(""), /run plan:/u);
    assert.equal(runPlan.selection.suiteId, "local-smoke");
    assert.equal(runPlan.suite.id, "local-smoke");
    assert.equal(runPlan.suite.suiteVersion, "1.0.0");
    assert.equal(runPlan.suite.source.suitePath, path.join(suiteDir, "suite.json"));
    assert.equal(runPlan.suite.source.suiteSha256, sha256File(path.join(suiteDir, "suite.json")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI parses doctor command", () => {
  const parsed = parseRuhrohCliArgs(["doctor", "--json", "--adapter", "custom-shell"], "/tmp/project");
  assert.equal(parsed.command, "doctor");
  assert.equal(parsed.json, true);
  assert.equal(parsed.adapter, "custom-shell");
});

test("public CLI parses init command target directory", () => {
  const parsed = parseRuhrohCliArgs(["init", "benchmarks", "--json"], "/tmp/project");
  assert.equal(parsed.command, "init");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "benchmarks"));
  assert.equal(parsed.json, true);
});

test("public CLI parses suite selection as mutually exclusive with tiers", () => {
  const parsed = parseRuhrohCliArgs(["--tier", "nightly", "--suite", "ruhroh-smoke", "--suite-dir", "suites"], "/tmp/project");
  assert.equal(parsed.suiteId, "ruhroh-smoke");
  assert.equal(parsed.tier, undefined);
  assert.equal(parsed.scenarioId, undefined);
  assert.equal(parsed.suiteDir, path.join("/tmp/project", "suites"));
});

test("public CLI parses repeated run counts", () => {
  const parsed = parseRuhrohCliArgs(["--scenario", "simple-newsletter", "--adapter", "custom-shell", "--runs", "5"], "/tmp/project");
  assert.equal(parsed.runs, 5);
});

test("public CLI parses repeated adapter selections", () => {
  const parsed = parseRuhrohCliArgs([
    "--scenario",
    "simple-newsletter",
    "--adapter",
    "custom-shell",
    "--adapter",
    "./adapters/agent-two.mjs",
  ], "/tmp/project");
  assert.equal(parsed.adapter, "./adapters/agent-two.mjs");
  assert.deepEqual(parsed.adapters, ["custom-shell", "./adapters/agent-two.mjs"]);
});

test("public CLI parses compare publishability gate", () => {
  const parsed = parseRuhrohCliArgs(["compare", "results", "--require-publishable", "--benchmark-claim", "claim.json", "--benchmark-summary", "summary.json"], "/tmp/project");
  assert.equal(parsed.command, "compare");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "results"));
  assert.equal(parsed.requirePublishable, true);
  assert.equal(parsed.benchmarkClaimPath, path.join("/tmp/project", "claim.json"));
  assert.equal(parsed.benchmarkSummaryPath, path.join("/tmp/project", "summary.json"));
});

test("public CLI parses benchmark claim validation", () => {
  const parsed = parseRuhrohCliArgs(["validate-claim", "claim.json", "--require-publishable", "--verify-sources", "--json"], "/tmp/project");
  assert.equal(parsed.command, "validate-claim");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "claim.json"));
  assert.equal(parsed.requirePublishable, true);
  assert.equal(parsed.verifySources, true);
  assert.equal(parsed.json, true);
});

test("public CLI parses benchmark summary validation", () => {
  const parsed = parseRuhrohCliArgs(["validate-summary", "summary.json", "--json"], "/tmp/project");
  assert.equal(parsed.command, "validate-summary");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "summary.json"));
  assert.equal(parsed.json, true);
});

test("public CLI doctor reports readiness checks as JSON", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-doctor-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    const adapterPath = path.join(tmp, "adapter.sh");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(adapterPath, "#!/usr/bin/env bash\n");
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const stdout: string[] = [];
    const spawned: string[] = [];
    const code = await runRuhrohCli([
      "doctor",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--adapter",
      "./adapter.sh",
      "--harbor-bin",
      "harbor",
      "--json",
    ], {
      spawn: ((command, args) => {
        spawned.push([command, ...(args ?? [])].join(" "));
        return { status: 0, stdout: "", stderr: "" } as never;
      }) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_doctor_v1");
    assert.deepEqual(parsed.checks.map((check: { name: string }) => check.name), [
      "package",
      "package-assets",
      "python-path",
      "scenarios",
      "suites",
      "python-import",
      "harbor",
      "adapter",
      "eval",
      "command-safety",
    ]);
    assert.equal(parsed.checks.filter((check: { status: string }) => check.status === "ok").length, 7);
    assert.match(parsed.checks.find((check: { name: string }) => check.name === "package-assets").details, /schemas, bundled scenarios, suites/u);
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "scenarios").status, "warning");
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "suites").status, "warning");
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "eval").status, "warning");
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "command-safety").status, "ok");
    assert.equal(spawned.some((command) => command.startsWith("python3 -c")), true);
    assert.equal(spawned.includes("harbor --version"), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI doctor checks configured eval command", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-doctor-eval-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    const adapterPath = path.join(tmp, "adapter.sh");
    const evalPath = path.join(tmp, "eval.sh");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(adapterPath, "#!/usr/bin/env bash\n");
    writeFileSync(evalPath, "#!/usr/bin/env bash\n");
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const stdout: string[] = [];
    const code = await runRuhrohCli([
      "doctor",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--adapter",
      "./adapter.sh",
      "--json",
    ], {
      spawn: (() => ({ status: 0, stdout: "", stderr: "" })) as never,
      env: { RUHROH_EVAL_COMMAND: "./eval.sh" },
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    assert.equal(code, 0);
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "eval").status, "ok");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI doctor warns about risky command-backed adapter and eval shell configuration", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-doctor-command-safety-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    const adapterPath = path.join(tmp, "adapter.sh");
    const evalPath = path.join(tmp, "eval.sh");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(adapterPath, "#!/usr/bin/env bash\n");
    writeFileSync(evalPath, "#!/usr/bin/env bash\n");
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const stdout: string[] = [];
    const code = await runRuhrohCli([
      "doctor",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--adapter",
      "./adapter.sh && echo unsafe",
      "--json",
    ], {
      spawn: (() => ({ status: 0, stdout: "", stderr: "" })) as never,
      env: {
        RUHROH_EVAL_COMMAND: "./eval.sh",
        RUHROH_EVAL_COMMAND_SHELL: "1",
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    const commandSafety = parsed.checks.find((check: { name: string }) => check.name === "command-safety");
    assert.equal(code, 0);
    assert.equal(commandSafety.status, "warning");
    assert.match(commandSafety.details, /adapter adapter\.sh command contains shell syntax \(&&\) but shell execution is disabled/u);
    assert.match(commandSafety.details, /eval enables shell execution via RUHROH_EVAL_COMMAND_SHELL/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI doctor validates local benchmark suites", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-doctor-suite-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    const suiteDir = path.join(tmp, "ruhroh", "suites", "local-smoke");
    const adapterPath = path.join(tmp, "adapter.sh");
    const evalPath = path.join(tmp, "eval.sh");
    mkdirSync(scenarioDir, { recursive: true });
    mkdirSync(suiteDir, { recursive: true });
    writeFileSync(adapterPath, "#!/usr/bin/env bash\n");
    writeFileSync(evalPath, "#!/usr/bin/env bash\n");
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      metadata: { scenarioVersion: "1.0.0" },
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task.", "The user needs a finished page."],
        goalRubric: [
          "The final page presents newsletter content matching the user request.",
          "The workspace can be inspected locally without relying on external services.",
          "The implementation preserves the requested constraints and visible behavior.",
        ],
        evidenceGuidance: ["Inspect the generated page.", "Run a local smoke check when useful."],
        calibrationCases: [{
          id: "passing",
          inputSummary: "The page is complete and locally inspectable.",
          expectedStatus: "passed",
          rationale: "The requested outcome is present.",
        }],
      },
    }));
    writeFileSync(path.join(suiteDir, "suite.json"), JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["simple-newsletter"],
      scenarioVersions: { "simple-newsletter": "1.0.0" },
    })));

    const stdout: string[] = [];
    const code = await runRuhrohCli([
      "doctor",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--suite-dir",
      "ruhroh/suites",
      "--suite",
      "local-smoke",
      "--adapter",
      "./adapter.sh",
      "--json",
    ], {
      spawn: (() => ({ status: 0, stdout: "", stderr: "" })) as never,
      env: { RUHROH_EVAL_COMMAND: "./eval.sh" },
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    assert.equal(code, 0);
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "suites").status, "ok");
    assert.match(parsed.checks.find((check: { name: string }) => check.name === "suites").details, /1 suite\(s\) valid/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI init scaffolds a local benchmark starter without overwriting changes", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-init-"));
  try {
    const stdout: string[] = [];
    const code = await runRuhrohCli(["init", "starter", "--json"], {
      spawn: (() => assert.fail("init should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    const root = path.join(tmp, "starter", "ruhroh");
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_init_v1");
    assert.equal(parsed.files.length, 16);
    assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);
    assert.equal(existsSync(path.join(root, "README.md")), true);
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "benchmark-claim-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_benchmark_claim_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "benchmark-summary-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_benchmark_summary_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "eval-result-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_eval_result_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "loop-result-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_loop_result_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "run-manifest-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_run_manifest_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "run-plan-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_run_plan_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "scenario-v2.schema.json"), "utf8")).properties.version.const, "ruhroh_scenario_v2");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "suite-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_suite_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "workspace-summary-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_workspace_summary_v1");
    assert.equal(existsSync(path.join(root, "scenarios", "simple-newsletter", "scenario.json")), true);
    assert.equal(JSON.parse(readFileSync(path.join(root, "suites", "ruhroh-smoke", "suite.json"), "utf8")).id, "ruhroh-smoke");
    assert.equal(existsSync(path.join(root, "adapters", "fixture-newsletter", "run.sh")), true);
    assert.equal(existsSync(path.join(root, "evaluators", "fixture-newsletter", "run.sh")), true);

    const validation = validateRuhrohScenarioSource(path.join(root, "scenarios", "simple-newsletter"));
    assert.deepEqual(validation.errors, []);
    assert.deepEqual(validation.warnings, []);
    const suiteValidation = validateRuhrohSuiteSource(path.join(root, "suites", "ruhroh-smoke"), {
      availableScenarioIds: [validation.scenario?.id ?? ""],
      availableScenarioVersions: { "simple-newsletter": validation.scenario?.metadata?.scenarioVersion ?? "" },
    });
    assert.deepEqual(suiteValidation.errors, []);
    assert.deepEqual(suiteValidation.warnings, []);

    const secondStdout: string[] = [];
    const secondCode = await runRuhrohCli(["init", "starter", "--json"], {
      spawn: (() => assert.fail("init rerun should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { secondStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(secondCode, 0);
    assert.equal(JSON.parse(secondStdout.join("")).files.every((file: { status: string }) => file.status === "unchanged"), true);

    writeFileSync(path.join(root, "README.md"), "# Local edits\n");
    const stderr: string[] = [];
    const overwriteCode = await runRuhrohCli(["init", "starter"], {
      spawn: (() => assert.fail("init overwrite check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { stderr.push(chunk); return true; } },
    });
    assert.equal(overwriteCode, 1);
    assert.match(stderr.join(""), /refusing to overwrite existing file/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI new-scenario scaffolds a validation-ready local scenario", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-new-scenario-"));
  try {
    const stdout: string[] = [];
    const code = await runRuhrohCli(["new-scenario", "csv-cleanup", "--scenario-dir", "scenarios", "--tier", "nightly", "--json"], {
      spawn: (() => assert.fail("new-scenario should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    const scenarioDir = path.join(tmp, "scenarios", "csv-cleanup");
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_new_scenario_v1");
    assert.equal(parsed.scenarioDir, scenarioDir);
    assert.equal(parsed.files.length, 2);
    assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);

    const manifest = JSON.parse(readFileSync(path.join(scenarioDir, "scenario.json"), "utf8"));
    assert.equal(manifest.id, "csv-cleanup");
    assert.equal(manifest.title, "Csv Cleanup");
    assert.equal(manifest.tier, "nightly");
    assert.equal(manifest.metadata.visibility, "private");
    assert.equal(manifest.userPromptPath, "instruction.md");
    assert.match(readFileSync(path.join(scenarioDir, "instruction.md"), "utf8"), /Describe the user task/u);

    const validation = validateRuhrohScenarioSource(scenarioDir);
    assert.deepEqual(validation.errors, []);
    assert.deepEqual(validation.warnings, []);

    const secondStdout: string[] = [];
    const secondCode = await runRuhrohCli(["new-scenario", "csv-cleanup", "--scenario-dir", "scenarios", "--tier", "nightly", "--json"], {
      spawn: (() => assert.fail("new-scenario rerun should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { secondStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(secondCode, 0);
    assert.equal(JSON.parse(secondStdout.join("")).files.every((file: { status: string }) => file.status === "unchanged"), true);

    writeFileSync(path.join(scenarioDir, "instruction.md"), "Local edits.\n");
    const stderr: string[] = [];
    const overwriteCode = await runRuhrohCli(["new-scenario", "csv-cleanup", "--scenario-dir", "scenarios"], {
      spawn: (() => assert.fail("new-scenario overwrite check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { stderr.push(chunk); return true; } },
    });
    assert.equal(overwriteCode, 1);
    assert.match(stderr.join(""), /refusing to overwrite existing file/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI new-suite scaffolds a version-locked local suite", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-new-suite-"));
  try {
    assert.equal(await runRuhrohCli(["new-scenario", "csv-cleanup", "--scenario-dir", "scenarios", "--tier", "nightly"], {
      spawn: (() => assert.fail("new-scenario should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: () => true },
    }), 0);

    const stdout: string[] = [];
    const code = await runRuhrohCli([
      "new-suite",
      "local-data",
      "--scenario-dir",
      "scenarios",
      "--suite-dir",
      "suites",
      "--scenario",
      "csv-cleanup",
      "--runs",
      "7",
      "--json",
    ], {
      spawn: (() => assert.fail("new-suite should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    const suiteDir = path.join(tmp, "suites", "local-data");
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_new_suite_v1");
    assert.equal(parsed.suiteDir, suiteDir);
    assert.equal(parsed.files.length, 1);
    assert.equal(parsed.files[0].status, "created");

    const manifest = JSON.parse(readFileSync(path.join(suiteDir, "suite.json"), "utf8"));
    assert.equal(manifest.id, "local-data");
    assert.deepEqual(manifest.scenarioIds, ["csv-cleanup"]);
    assert.deepEqual(manifest.scenarioVersions, { "csv-cleanup": "0.1.0" });
    assert.equal(manifest.methodology.minRuns, 7);
    assert.equal(manifest.governance.owner, "local-author");
    assert.match(manifest.governance.rewardHackingReview, /shortcuts/u);
    assert.equal(manifest.governance.reviewChecklist.length >= 3, true);

    const scenarioValidation = validateRuhrohScenarioSource(path.join(tmp, "scenarios", "csv-cleanup"));
    const suiteValidation = validateRuhrohSuiteSource(suiteDir, {
      availableScenarioIds: [scenarioValidation.scenario?.id ?? ""],
      availableScenarioVersions: { "csv-cleanup": scenarioValidation.scenario?.metadata?.scenarioVersion ?? "" },
    });
    assert.deepEqual(suiteValidation.errors, []);
    assert.deepEqual(suiteValidation.warnings, []);

    const secondStdout: string[] = [];
    const secondCode = await runRuhrohCli([
      "new-suite",
      "local-data",
      "--scenario-dir",
      "scenarios",
      "--suite-dir",
      "suites",
      "--scenario",
      "csv-cleanup",
      "--runs",
      "7",
      "--json",
    ], {
      spawn: (() => assert.fail("new-suite rerun should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { secondStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(secondCode, 0);
    assert.equal(JSON.parse(secondStdout.join("")).files[0].status, "unchanged");

    const missingStderr: string[] = [];
    const missingCode = await runRuhrohCli([
      "new-suite",
      "bad-suite",
      "--scenario-dir",
      "scenarios",
      "--suite-dir",
      "suites",
      "--scenario",
      "missing",
    ], {
      spawn: (() => assert.fail("new-suite missing check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { missingStderr.push(chunk); return true; } },
    });
    assert.equal(missingCode, 1);
    assert.match(missingStderr.join(""), /references unknown scenario/u);

    const duplicateStderr: string[] = [];
    const duplicateCode = await runRuhrohCli([
      "new-suite",
      "dupe-suite",
      "--scenario-dir",
      "scenarios",
      "--suite-dir",
      "suites",
      "--scenario",
      "csv-cleanup",
      "--scenario",
      "csv-cleanup",
    ], {
      spawn: (() => assert.fail("new-suite duplicate check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { duplicateStderr.push(chunk); return true; } },
    });
    assert.equal(duplicateCode, 1);
    assert.match(duplicateStderr.join(""), /duplicate id/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI new-adapter scaffolds an edit-me command adapter", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-new-adapter-"));
  try {
    const stdout: string[] = [];
    const code = await runRuhrohCli(["new-adapter", "local-agent", "--json"], {
      spawn: (() => assert.fail("new-adapter should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    const adapterDir = path.join(tmp, "ruhroh", "adapters", "local-agent");
    const runPath = path.join(adapterDir, "run.sh");
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_new_adapter_v1");
    assert.equal(parsed.adapterDir, adapterDir);
    assert.equal(parsed.files.length, 2);
    assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);
    assert.equal(existsSync(runPath), true);
    assert.equal((statSync(runPath).mode & 0o111) !== 0, true);
    assert.match(readFileSync(runPath, "utf8"), /ruhroh_run_agent_result_v1/u);
    assert.match(readFileSync(runPath, "utf8"), /status": "runtime_failure"/u);
    assert.match(readFileSync(path.join(adapterDir, "README.md"), "utf8"), /custom-shell adapter scaffold/u);
    assert.equal(spawnSync("bash", ["-n", runPath]).status, 0);

    const runResultPath = path.join(tmp, "result.json");
    const workspace = path.join(tmp, "workspace");
    mkdirSync(workspace, { recursive: true });
    const scaffoldRun = spawnSync(runPath, [], {
      env: {
        ...process.env,
        RUHROH_WORKSPACE: workspace,
        RUHROH_MESSAGE: "Build the thing.",
        RUHROH_RESULT_PATH: runResultPath,
        RUHROH_ITERATION: "1",
      },
      encoding: "utf8",
    });
    assert.equal(scaffoldRun.status, 2);
    assert.match(scaffoldRun.stderr, /not wired/u);
    assert.equal(JSON.parse(readFileSync(runResultPath, "utf8")).status, "runtime_failure");

    const secondStdout: string[] = [];
    const secondCode = await runRuhrohCli(["new-adapter", "local-agent", "--json"], {
      spawn: (() => assert.fail("new-adapter rerun should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { secondStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(secondCode, 0);
    assert.equal(JSON.parse(secondStdout.join("")).files.every((file: { status: string }) => file.status === "unchanged"), true);

    writeFileSync(path.join(adapterDir, "README.md"), "# Local edits\n");
    const stderr: string[] = [];
    const overwriteCode = await runRuhrohCli(["new-adapter", "local-agent"], {
      spawn: (() => assert.fail("new-adapter overwrite check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { stderr.push(chunk); return true; } },
    });
    assert.equal(overwriteCode, 1);
    assert.match(stderr.join(""), /refusing to overwrite existing file/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI validates scenarios with JSON output", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-validate-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const stdout: string[] = [];
    const code = await runRuhrohCli(["validate", "--scenario-dir", "ruhroh/scenarios", "--json"], {
      spawn: (() => assert.fail("validate should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_validation_report_v1");
    assert.equal(parsed.results[0].scenario.id, "simple-newsletter");
    assert.deepEqual(parsed.results[0].errors, []);
    assert.deepEqual(parsed.results[0].warningDetails.map((diagnostic: { code: string }) => diagnostic.code), [
      "evaluation_context_minimum",
      "evaluation_calibration_cases_minimum",
      "evaluation_goal_rubric_minimum",
      "evaluation_evidence_guidance_minimum",
      "evaluation_goal_rubric_terse",
      "evaluation_goal_rubric_generic",
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("run summaries and aggregates include enriched evaluator evidence", () => {
  const passedRun = loopResultFixture({
    scenarioId: "simple-newsletter",
    runAgentAdapterId: "agent-a",
    score: 1,
    status: "completed",
    failure_kind: "none",
    failureBucket: "none",
    duration_ms: 1000,
    implementationIterationsUsed: 2,
    evalResult: {
      version: "ruhroh_eval_result_v1",
      status: "passed",
      goalMet: true,
      confidence: "high",
      reasons: ["ok"],
      unmetCriteria: [],
      evidenceRefs: [],
      commandsRun: [{ command: "npm test", exitCode: 0, summary: "passed" }],
      artifacts: { workspacePath: "/tmp/workspace" },
      finalSummary: "Delivered.",
      subscores: { functionality: 1, workflow: 0.5 },
    },
    runManifest: {
      version: "ruhroh_run_manifest_v1",
      runId: "pass-run",
      scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
      timing: { startedAt: "2026-07-07T12:00:00Z", durationMs: 1000 },
      loop: { maxIterations: 3, implementationIterationsUsed: 2, stoppedReason: "goal_satisfied" },
      sample: { id: "simple-newsletter/agent-a/1-of-2", index: 1, count: 2, seed: "seed-pass" },
      runAgent: { adapterId: "agent-a", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      evaluator: {
        inputSummary: {
          scenarioContextCount: 2,
          goalRubricCount: 3,
          evidenceGuidanceCount: 2,
          calibrationCaseCount: 1,
          privateAssetCount: 1,
          privateAssetPathHashes: ["asset-a"],
        },
      },
      usage: { costUsd: 0.2, totalTokens: 1000 },
    },
  });
  const failedRun = loopResultFixture({
    scenarioId: "simple-newsletter",
    runAgentAdapterId: "agent-a",
    score: 0,
    status: "failed",
    failure_kind: "goal_mismatch",
    failureBucket: "goal_mismatch",
    duration_ms: 3000,
    implementationIterationsUsed: 3,
    evalResult: {
      version: "ruhroh_eval_result_v1",
      status: "failed",
      goalMet: false,
      confidence: "high",
      reasons: ["missing export"],
      unmetCriteria: ["CSV export"],
      evidenceRefs: [],
      commandsRun: [],
      artifacts: {},
      finalSummary: "Not delivered.",
      subscores: { functionality: 0 },
    },
    runManifest: {
      version: "ruhroh_run_manifest_v1",
      runId: "fail-run",
      scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
      timing: { startedAt: "2026-07-07T12:02:00Z", durationMs: 3000 },
      loop: { maxIterations: 3, implementationIterationsUsed: 3, stoppedReason: "goal_mismatch" },
      sample: { id: "simple-newsletter/agent-a/2-of-2", index: 2, count: 2, seed: "seed-fail" },
      runAgent: { adapterId: "agent-a", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      evaluator: {
        inputSummary: {
          scenarioContextCount: 2,
          goalRubricCount: 4,
          evidenceGuidanceCount: 2,
          calibrationCaseCount: 1,
          privateAssetCount: 1,
          privateAssetPathHashes: ["asset-a"],
        },
      },
      usage: { costUsd: 0.4, totalTokens: 3000 },
    },
  });

  const summary = summarizeRuhrohRun(passedRun);
  assert.equal(summary.evalStatus, "passed");
  assert.equal(summary.commandsRun[0]?.command, "npm test");
  assert.equal(summary.evalQualityWarnings.includes("eval result has no top-level evidenceRefs"), true);
  assert.equal(summary.humanReviewRequired, false);
  assert.equal(summary.usage?.costUsd, 0.2);
  assert.equal(summary.sample?.id, "simple-newsletter/agent-a/1-of-2");
  assert.equal(summary.sample?.seed, "seed-pass");
  assert.equal(summary.artifactCompletenessWarnings.includes("missing artifact path: runManifest"), true);

  const reviewQueue = summarizeRuhrohReviewQueue([summarizeRuhrohRun(passedRun), summarizeRuhrohRun(failedRun)]);
  assert.equal(reviewQueue.length, 2);
  const failedReview = reviewQueue.find((item) => item.runId === "fail-run") ?? assert.fail("missing failed review item");
  assert.equal(failedReview.scenarioId, "simple-newsletter");
  assert.equal(failedReview.priority, "recommended");
  assert.equal(failedReview.reasons.includes("non-passing run: goal_mismatch"), true);
  assert.equal(failedReview.reasons.includes("missing artifact path: journey"), true);
  assert.equal(failedReview.unmetCriteria.includes("CSV export"), true);

  const aggregate = aggregateRuhrohRuns([passedRun, failedRun]);
  assert.equal(aggregate[0]?.runs, 2);
  assert.equal(aggregate[0]?.passRate, 0.5);
  assert.equal(aggregate[0]?.passAtK["pass@1"], 0.5);
  assert.equal(aggregate[0]?.passAtK["pass@2"], 1);
  assert.equal(aggregate[0]?.statisticalWarnings.includes("fewer than 5 runs; treat pass rate and pass@k as directional"), true);
  assert.equal(aggregate[0]?.statisticalWarnings.includes("missing agent model metadata in aggregate group"), true);
  assert.equal(aggregate[0]?.statisticalWarnings.includes("mixed evaluator input setup in aggregate group"), true);
  assert.equal(aggregate[0]?.statisticalWarnings.includes("missing environment fingerprint metadata in aggregate group"), true);
  assert.deepEqual(aggregate[0]?.cohort.scenarioVersions, ["1.0.0"]);
  assert.deepEqual(aggregate[0]?.cohort.sampleIds, ["simple-newsletter/agent-a/1-of-2", "simple-newsletter/agent-a/2-of-2"]);
  assert.deepEqual(aggregate[0]?.cohort.sampleSeeds, ["seed-fail", "seed-pass"]);
  assert.deepEqual(aggregate[0]?.cohort.agentModels, ["unknown"]);
  assert.equal(aggregate[0]?.cohort.evaluatorInputSignatures.length, 2);
  assert.equal(aggregate[0]?.cohort.evaluatorInputSignatures.some((item) => item.includes("rubric=3")), true);
  assert.equal(aggregate[0]?.cohort.evaluatorInputSignatures.some((item) => item.includes("rubric=4")), true);
  const fingerprintedAggregate = aggregateRuhrohRuns([loopResultFixture({
    scenarioId: "simple-newsletter",
    runAgentAdapterId: "agent-a",
    runManifest: {
      version: "ruhroh_run_manifest_v1",
      runId: "fingerprinted-run",
      scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
      timing: { startedAt: "2026-07-07T12:00:00Z", durationMs: 1000 },
      loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
      runAgent: { adapterId: "agent-a", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      environment: {
        fingerprint: {
          method: "sha256",
          sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          components: { pythonVersion: "3.12.0", platform: "test-platform" },
        },
        pythonVersion: "3.12.0",
        platform: "test-platform",
      },
    },
  })]);
  assert.deepEqual(fingerprintedAggregate[0]?.cohort.environmentFingerprints, ["sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"]);
  assert.equal(fingerprintedAggregate[0]?.statisticalWarnings.includes("missing environment fingerprint metadata in aggregate group"), false);
  assert.equal(aggregate[0]?.evalQualityWarnings["eval result has no top-level evidenceRefs"], 2);
  assert.equal(aggregate[0]?.artifactCompletenessWarnings["missing artifact path: runManifest"], 2);
  assert.equal(aggregate[0]?.artifactCompletenessWarnings["missing artifact path: journey"], 2);
  assert.equal(aggregate[0]?.reviewRequired, 0);
  assert.equal(aggregate[0]?.usage.runsWithUsage, 2);
  assert.equal(aggregate[0]?.usage.runsWithCost, 2);
  assert.equal(aggregate[0]?.usage.runsWithTokens, 2);
  assert.equal(Number(aggregate[0]?.usage.totalCostUsd?.toFixed(3)), 0.6);
  assert.equal(Number(aggregate[0]?.usage.meanCostUsd?.toFixed(3)), 0.3);
  assert.equal(Number(aggregate[0]?.usage.costPerPass?.toFixed(3)), 0.6);
  assert.equal(aggregate[0]?.usage.totalTokens, 4000);
  assert.equal(aggregate[0]?.usage.tokensPerPass, 4000);
  assert.equal(aggregate[0]?.passRateCi95.method, "wilson");
  assert.equal((aggregate[0]?.passRateCi95.lower ?? 1) < 0.5, true);
  assert.equal((aggregate[0]?.passRateCi95.upper ?? 0) > 0.5, true);
  assert.equal(aggregate[0]?.meanScore, 0.5);
  assert.equal(aggregate[0]?.meanScoreCi95.method, "bootstrap_percentile");
  assert.equal((aggregate[0]?.meanScoreCi95.lower ?? 1) <= 0.5, true);
  assert.equal((aggregate[0]?.meanScoreCi95.upper ?? 0) >= 0.5, true);
  assert.equal(aggregate[0]?.meanSubscores.functionality, 0.5);
  assert.equal(aggregate[0]?.medianDurationMs, 2000);
  assert.deepEqual(assessRuhrohArtifactCompleteness(loopResultFixture({
    artifactPaths: {
      runManifest: "/tmp/ruhroh-run-manifest.json",
      implementationRuns: "/tmp/ruhroh-loop-iterations.jsonl",
      journey: "/tmp/ruhroh-loop-journey.json",
      evalResult: "/tmp/ruhroh-loop-eval.json",
      evalInput: "/tmp/ruhroh-loop-eval-input.json",
      workspaceSummary: "/tmp/ruhroh-workspace-summary.json",
      workspaceTarball: "/tmp/ruhroh-workspace.tar.gz",
      eventsTarball: "/tmp/ruhroh-loop-events.tar.gz",
      transcriptsTarball: "/tmp/ruhroh-loop-transcripts.tar.gz",
    },
  })), []);

  const agentBPass = loopResultFixture({
    runId: "agent-b-pass",
    scenarioId: "simple-newsletter",
    runAgentAdapterId: "agent-b",
    score: 1,
    status: "completed",
    failure_kind: "none",
    failureBucket: "none",
    runManifest: {
      version: "ruhroh_run_manifest_v1",
      runId: "agent-b-pass",
      scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
      timing: { startedAt: "2026-07-07T12:03:00Z", durationMs: 1000 },
      loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
      sample: { id: "simple-newsletter/agent-b/1-of-2", index: 1, count: 2, seed: "seed-b-1" },
      runAgent: { adapterId: "agent-b", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
    },
  });
  const agentBPassTwo = loopResultFixture({
    runId: "agent-b-pass-2",
    scenarioId: "simple-newsletter",
    runAgentAdapterId: "agent-b",
    score: 1,
    status: "completed",
    failure_kind: "none",
    failureBucket: "none",
    runManifest: {
      version: "ruhroh_run_manifest_v1",
      runId: "agent-b-pass-2",
      scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
      timing: { startedAt: "2026-07-07T12:04:00Z", durationMs: 1000 },
      loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
      sample: { id: "simple-newsletter/agent-b/2-of-2", index: 2, count: 2, seed: "seed-b-2" },
      runAgent: { adapterId: "agent-b", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
    },
  });
  const comparisonGroups = aggregateRuhrohRuns([
    passedRun,
    failedRun,
    agentBPass,
    agentBPassTwo,
  ]);
  const pairwise = summarizeRuhrohPairwiseAdapterComparisons(comparisonGroups);
  assert.equal(pairwise.length, 1);
  assert.equal(pairwise[0]?.scenarioId, "simple-newsletter");
  assert.equal(pairwise[0]?.baselineAdapter, "agent-a");
  assert.equal(pairwise[0]?.contenderAdapter, "agent-b");
  assert.equal(pairwise[0]?.baselinePassRate, 0.5);
  assert.equal(pairwise[0]?.contenderPassRate, 1);
  assert.equal(pairwise[0]?.passRateDelta, 0.5);
  assert.equal(pairwise[0]?.passRateDeltaCi95.method, "normal_approximation");
  assert.equal(pairwise[0]?.significance.method, "fisher_exact_two_sided");
  assert.equal(pairwise[0]?.significance.pValue, 1);
  assert.equal(pairwise[0]?.significance.significant, false);
  assert.equal(pairwise[0]?.conclusion, "inconclusive");
  assert.equal(pairwise[0]?.warnings.some((warning) => warning.includes("delta 95% CI includes 0")), true);
  assert.equal(pairwise[0]?.warnings.some((warning) => warning.includes("Fisher exact test is not significant")), true);

  const suiteSummaries = summarizeRuhrohSuiteAdapters(aggregate, {
    scenarioIds: ["simple-newsletter", "missing-scenario"],
    minRuns: 3,
  });
  assert.equal(suiteSummaries[0]?.adapter, "agent-a");
  assert.equal(suiteSummaries[0]?.coveredScenarios, 1);
  assert.equal(suiteSummaries[0]?.expectedScenarios, 2);
  assert.deepEqual(suiteSummaries[0]?.missingScenarioIds, ["missing-scenario"]);
  assert.equal(suiteSummaries[0]?.runs, 2);
  assert.equal(suiteSummaries[0]?.passes, 1);
  assert.equal(suiteSummaries[0]?.runWeightedPassRate, 0.5);
  assert.equal(suiteSummaries[0]?.meanScenarioPassRate, 0.5);
  assert.equal(suiteSummaries[0]?.minRunsSatisfied, false);
  assert.equal(suiteSummaries[0]?.warnings.includes("missing suite scenario: missing-scenario"), true);
  assert.equal(suiteSummaries[0]?.warnings.includes("simple-newsletter has 2/3 required runs"), true);

  const claimReadiness = summarizeRuhrohBenchmarkClaimReadiness(aggregate, {
    suiteId: "example-suite",
    suiteWarnings: ["suite scenario has no result artifacts: missing-scenario"],
    suiteAdapterSummaries: suiteSummaries,
    reviewQueue,
  });
  assert.equal(claimReadiness.scope, "suite");
  assert.equal(claimReadiness.publishable, false);
  assert.equal(claimReadiness.blockers.some((item) => item.includes("suite warning")), true);
  assert.equal(claimReadiness.blockers.some((item) => item.includes("suite minimum runs")), true);
  assert.equal(claimReadiness.blockers.some((item) => item.includes("fewer than 5 runs")), true);
  assert.equal(claimReadiness.blockers.some((item) => item.includes("eval-quality warnings present")), true);
  assert.equal(claimReadiness.blockers.some((item) => item.includes("artifact-completeness warnings present")), true);
  assert.equal(claimReadiness.advisories.some((item) => item.includes("eval result has no top-level evidenceRefs")), true);
  assert.equal(claimReadiness.advisories.some((item) => item.includes("missing artifact path: runManifest")), true);
  assert.equal(claimReadiness.advisories.some((item) => item.includes("review recommended")), true);

  const comparisonSuiteSummaries = summarizeRuhrohSuiteAdapters(comparisonGroups, {
    scenarioIds: ["simple-newsletter", "missing-scenario"],
    minRuns: 3,
  });
  const comparisonClaimReadiness = summarizeRuhrohBenchmarkClaimReadiness(comparisonGroups, {
    suiteId: "example-suite",
    suiteWarnings: ["suite scenario has no result artifacts: missing-scenario"],
    suiteAdapterSummaries: comparisonSuiteSummaries,
    pairwiseComparisons: pairwise,
    reviewQueue,
  });
  assert.equal(comparisonClaimReadiness.blockers.some((item) => item.includes("agent-b vs agent-a")), true);
  assert.equal(comparisonClaimReadiness.blockers.some((item) => item.includes("Fisher exact test is not significant")), true);
  const benchmarkClaim = summarizeRuhrohBenchmarkClaim(comparisonGroups, {
    createdAt: "2026-07-07T12:30:00.000Z",
    tool: { name: "@kestrel-agents/ruhroh", version: "0.6.0-beta.0" },
    suite: {
      id: "example-suite",
      title: "Example Suite",
      suiteVersion: "1.0.0",
      scenarioIds: ["simple-newsletter", "missing-scenario"],
      scenarioVersions: { "simple-newsletter": "1.0.0", "missing-scenario": "1.0.0" },
      minRuns: 3,
      retryPolicy: "Retry only proven infrastructure failures.",
    },
    suiteAdapterSummaries: comparisonSuiteSummaries,
    pairwiseComparisons: pairwise,
    reviewQueue,
    claimReadiness: comparisonClaimReadiness,
    source: {
      resultsPath: "/tmp/ruhroh/results",
      runPlanPath: "/tmp/ruhroh/ruhroh-run-plan.json",
    },
    runPlanPresent: true,
    runPlanWarnings: ["missing planned sample"],
  });
  assert.equal(benchmarkClaim.version, "ruhroh_benchmark_claim_v1");
  assert.equal(benchmarkClaim.$schema, "https://lumicorp.github.io/ruhroh/schemas/benchmark-claim-v1.schema.json");
  assert.equal(benchmarkClaim.createdAt, "2026-07-07T12:30:00.000Z");
  assert.deepEqual(benchmarkClaim.tool, { name: "@kestrel-agents/ruhroh", version: "0.6.0-beta.0" });
  assert.equal(benchmarkClaim.scope, "suite");
  assert.equal(benchmarkClaim.publishable, false);
  assert.deepEqual(benchmarkClaim.source, {
    resultsPath: "/tmp/ruhroh/results",
    runPlanPath: "/tmp/ruhroh/ruhroh-run-plan.json",
  });
  assert.equal(benchmarkClaim.suite?.id, "example-suite");
  assert.equal(benchmarkClaim.methodology.minRuns, 3);
  assert.equal(benchmarkClaim.methodology.statisticalMethods.includes("wilson_pass_rate_ci"), true);
  assert.equal(benchmarkClaim.methodology.statisticalMethods.includes("fisher_exact_two_sided"), true);
  assert.equal(benchmarkClaim.methodology.statisticalMethods.includes("bootstrap_mean_score_ci"), true);
  assert.equal(benchmarkClaim.summary.scenarioCount, 1);
  assert.equal(benchmarkClaim.summary.adapterCount, 2);
  assert.equal(benchmarkClaim.summary.totalRuns, 4);
  assert.equal(benchmarkClaim.summary.totalPasses, 3);
  assert.equal(benchmarkClaim.summary.runWeightedPassRate, 0.75);
  assert.equal(benchmarkClaim.summary.reviewRecommended, 2);
  assert.equal(benchmarkClaim.summary.pairwiseComparisonCount, 1);
  const agentAClaimSummary = benchmarkClaim.adapterSummaries.find((item) => item.adapter === "agent-a") ?? assert.fail("missing agent-a claim summary");
  assert.equal(agentAClaimSummary.minRunsSatisfied, false);
  assert.equal(benchmarkClaim.suiteCoverage?.expectedScenarios, 2);
  assert.equal(benchmarkClaim.suiteCoverage?.coveredScenarios, 1);
  assert.deepEqual(benchmarkClaim.suiteCoverage?.missingScenarioIds, ["missing-scenario"]);
  assert.equal(benchmarkClaim.suiteCoverage?.minRunsSatisfied, false);
  const agentAClaimCoverage = benchmarkClaim.suiteCoverage?.adapters.find((item) => item.adapter === "agent-a") ?? assert.fail("missing agent-a claim coverage");
  assert.equal(agentAClaimCoverage.expectedScenarios, 2);
  assert.equal(agentAClaimCoverage.coveredScenarios, 1);
  assert.deepEqual(agentAClaimCoverage.missingScenarioIds, ["missing-scenario"]);
  assert.deepEqual(agentAClaimCoverage.scenarioRuns, { "simple-newsletter": 2 });
  assert.equal(agentAClaimCoverage.minRunsSatisfied, false);
  assert.equal(agentAClaimCoverage.warnings.includes("simple-newsletter has 2/3 required runs"), true);
  assert.equal(benchmarkClaim.scenarioResults[0]?.scenarioId, "simple-newsletter");
  assert.equal(benchmarkClaim.scenarioResults[0]?.meanScore, 0.5);
  assert.equal(benchmarkClaim.scenarioResults[0]?.meanScoreCi95.method, "bootstrap_percentile");
  assert.equal(benchmarkClaim.pairwiseComparisons[0]?.contenderAdapter, "agent-b");
  assert.equal(benchmarkClaim.readiness.blockers.length, comparisonClaimReadiness.blockers.length);
  assert.equal(benchmarkClaim.evidence.runPlanPresent, true);
  assert.deepEqual(benchmarkClaim.evidence.runPlanWarnings, ["missing planned sample"]);
  assert.equal(benchmarkClaim.evidence.artifactValidationErrors, 0);
  assert.equal(benchmarkClaim.evidence.artifactValidationWarnings, 0);
  assert.equal(benchmarkClaim.evidence.artifactCompletenessWarnings > 0, true);

  const validation = validateRuhrohBenchmarkClaim(benchmarkClaim);
  assert.equal(validation.version, "ruhroh_benchmark_claim_validation_v1");
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.warnings, []);

  const invalidClaim: Record<string, unknown> = { ...benchmarkClaim };
  delete invalidClaim.suiteCoverage;
  invalidClaim.readiness = {
    scope: "suite",
    publishable: true,
    blockers: ["still blocked"],
    advisories: [],
  };
  const invalidValidation = validateRuhrohBenchmarkClaim(invalidClaim);
  assert.equal(invalidValidation.errors.includes("suite claims must include suiteCoverage"), true);
  assert.equal(invalidValidation.errors.includes("readiness.publishable must match publishable"), true);
  assert.equal(invalidValidation.errors.includes("readiness.publishable cannot be true when blockers are present"), true);
});

test("implementation timeline summarizes preserved run-agent turns", () => {
  const timeline = readImplementationTimeline([{
    iteration: 2,
    adapterId: "custom-shell",
    status: "completed",
    failureKind: "none",
    completionStatus: { state: "done", reason: "goal_satisfied" },
    stopReason: "goal_satisfied",
    runId: "run-2",
    transcriptPath: "/tmp/transcript.log",
    eventLogPath: "/tmp/events.jsonl",
    artifactPaths: { result: "/tmp/result.json" },
    notes: "  Completed the task and verified the app.  ",
  }]);

  assert.deepEqual(timeline, [{
    iteration: 2,
    adapterId: "custom-shell",
    status: "completed",
    failureKind: "none",
    completionState: "done",
    stopReason: "goal_satisfied",
    runId: "run-2",
    transcriptPath: "/tmp/transcript.log",
    eventLogPath: "/tmp/events.jsonl",
    artifactPaths: { result: "/tmp/result.json" },
    notes: "Completed the task and verified the app.",
  }]);
});

test("public CLI validates preserved run artifact directories", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-validate-artifacts-"));
  try {
    const runDir = path.join(tmp, "run-ok");
    const brokenDir = path.join(tmp, "run-broken");
    mkdirSync(runDir, { recursive: true });
    mkdirSync(brokenDir, { recursive: true });

    const runManifest = {
      $schema: "https://lumicorp.github.io/ruhroh/schemas/run-manifest-v1.schema.json",
      version: "ruhroh_run_manifest_v1",
      runId: "run-ok-1",
      scenario: { id: "example-scenario", scenarioVersion: "1.0.0" },
      benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
      timing: { startedAt: "2026-07-07T12:00:00Z", durationMs: 100 },
      loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
      runAgent: { adapterId: "agent-a", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
    };
    const evalResult = {
      $schema: "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
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
    };
    const workspaceSummary = {
      $schema: "https://lumicorp.github.io/ruhroh/schemas/workspace-summary-v1.schema.json",
      version: "ruhroh_workspace_summary_v1",
      generatedAt: "2026-07-07T12:00:00Z",
      workspaceRoot: "/workspace",
      exists: true,
      totalFiles: 1,
      totalDirectories: 0,
      totalBytes: 12,
      topLevelEntries: [{ path: "README.md", type: "file" }],
      projectMarkers: ["README.md"],
      sampleFiles: [{ path: "README.md", sizeBytes: 12 }],
      truncated: false,
    };
    const result = {
      ...loopResultFixture({
        runId: "run-ok-1",
        runManifest,
        evalResult,
        artifactPaths: {
          result: "/installed-agent/ruhroh-loop-result.json",
          runManifest: "/installed-agent/ruhroh-run-manifest.json",
          evalResult: "/installed-agent/ruhroh-loop-eval.json",
          workspaceSummary: "/installed-agent/ruhroh-workspace-summary.json",
          implementationRuns: "/installed-agent/ruhroh-loop-iterations.jsonl",
          journey: "/installed-agent/ruhroh-loop-journey.json",
          evalInput: "/installed-agent/ruhroh-loop-eval-input.json",
        },
      }),
      $schema: "https://lumicorp.github.io/ruhroh/schemas/loop-result-v1.schema.json",
    };
    writeFileSync(path.join(runDir, "ruhroh-loop-result.json"), JSON.stringify(result, null, 2));
    writeFileSync(path.join(runDir, "ruhroh-run-manifest.json"), JSON.stringify(runManifest, null, 2));
    writeFileSync(path.join(runDir, "ruhroh-loop-eval.json"), JSON.stringify(evalResult, null, 2));
    writeFileSync(path.join(runDir, "ruhroh-workspace-summary.json"), JSON.stringify(workspaceSummary, null, 2));
    writeFileSync(path.join(runDir, "ruhroh-loop-iterations.jsonl"), "{\"iteration\":1}\n");
    writeFileSync(path.join(runDir, "ruhroh-loop-journey.json"), "{\"version\":\"ruhroh_implementation_journey_v1\"}\n");
    writeFileSync(path.join(runDir, "ruhroh-loop-eval-input.json"), "{\"version\":\"ruhroh_eval_input_v1\"}\n");

    const okStdout: string[] = [];
    const okCode = await runRuhrohCli(["validate-artifacts", runDir, "--json"], {
      spawn: (() => assert.fail("validate-artifacts should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { okStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const okReport = JSON.parse(okStdout.join(""));
    assert.equal(okCode, 0);
    assert.equal(okReport.version, "ruhroh_artifact_validation_report_v1");
    assert.equal(okReport.valid, true);
    assert.deepEqual(okReport.errors, []);
    assert.deepEqual(okReport.warnings, []);
    assert.equal(okReport.checks.some((check: { name: string; status: string }) => check.name === "runManifest.runId" && check.status === "ok"), true);

    writeFileSync(path.join(brokenDir, "ruhroh-loop-result.json"), JSON.stringify(loopResultFixture({ runId: "broken-1" }), null, 2));
    const brokenStdout: string[] = [];
    const brokenCode = await runRuhrohCli(["validate-artifacts", brokenDir, "--json"], {
      spawn: (() => assert.fail("validate-artifacts should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { brokenStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const brokenReport = JSON.parse(brokenStdout.join(""));
    assert.equal(brokenCode, 1);
    assert.equal(brokenReport.valid, false);
    assert.equal(brokenReport.errors.some((item: string) => item.includes("runManifest: artifact file is missing")), true);
    assert.equal(brokenReport.warnings.some((item: string) => item.includes("loop-result.schema: missing $schema")), true);

    const rootStdout: string[] = [];
    const rootCode = await runRuhrohCli(["validate-artifacts", tmp, "--json"], {
      spawn: (() => assert.fail("validate-artifacts should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { rootStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const rootReport = JSON.parse(rootStdout.join(""));
    assert.equal(rootCode, 1);
    assert.equal(rootReport.valid, false);
    assert.equal(rootReport.runs.length, 2);
    assert.equal(rootReport.source.resultPath, undefined);
    assert.equal(rootReport.source.resultPaths.length, 2);
    assert.deepEqual(rootReport.runs.map((run: { valid: boolean }) => run.valid), [false, true]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI reports and compares run artifacts", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-report-"));
  try {
    const runOne = path.join(tmp, "run-one");
    const runTwo = path.join(tmp, "run-two");
    const runOneResultPath = path.join(runOne, "ruhroh-loop-result.json");
    const runTwoResultPath = path.join(runTwo, "ruhroh-loop-result.json");
    const runOneJourneyPath = path.join(runOne, "ruhroh-journey.jsonl");
    const runOneManifestPath = path.join(runOne, "ruhroh-run-manifest.json");
    const runTwoJourneyPath = path.join(runTwo, "missing-journey.jsonl");
    const suiteDir = path.join(tmp, "suites", "local-smoke");
    const suitePath = path.join(suiteDir, "suite.json");
    const runPlanPath = path.join(tmp, "ruhroh-run-plan.json");
    mkdirSync(runOne, { recursive: true });
    mkdirSync(runTwo, { recursive: true });
    mkdirSync(suiteDir, { recursive: true });
    writeFileSync(runOneJourneyPath, "{\"event\":\"agent_turn\",\"summary\":\"implemented newsletter\"}\n");
    writeFileSync(runOneManifestPath, "{\"version\":\"ruhroh_run_manifest_v1\"}\n");
    writeFileSync(suitePath, JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["simple-newsletter", "missing-scenario"],
      scenarioVersions: { "simple-newsletter": "1.0.0", "missing-scenario": "1.0.0" },
      methodology: {
        minRuns: 3,
        aggregationUnit: "scenario_adapter",
        reportPolicy: "pass_rate_ci_pass_at_k",
        confidenceLevel: 0.95,
        retryPolicy: "Retry only proven infrastructure failures.",
      },
    })));
    writeFileSync(runOneResultPath, JSON.stringify(loopResultFixture({
      runId: "simple-newsletter-agent-a-1",
      scenarioId: "simple-newsletter",
      runAgentAdapterId: "agent-a",
      score: 1,
      status: "completed",
      failure_kind: "none",
      failureBucket: "none",
      artifactPaths: {
        journey: runOneJourneyPath,
        runManifest: runOneManifestPath,
      },
      implementationRuns: [{
        iteration: 1,
        adapterId: "agent-a",
        status: "completed",
        failureKind: "none",
        completionStatus: { state: "done", reason: "goal_satisfied" },
        stopReason: "goal_satisfied",
        runId: "agent-run-1",
        transcriptPath: "/tmp/transcript.log",
        artifactPaths: { transcript: "/tmp/transcript.log" },
        notes: "Implemented and verified the newsletter.",
      }],
      evalResult: {
        version: "ruhroh_eval_result_v1",
        status: "passed",
        goalMet: true,
        confidence: "high",
        reasons: ["ok"],
        unmetCriteria: [],
        evidenceRefs: [],
        commandsRun: [],
        artifacts: {},
        finalSummary: "Delivered <ok>.",
        judge: { kind: "hybrid", model: "arbiter", version: "2026-07-07" },
        judgeVotes: [
          {
            judge: { kind: "model", model: "eval-a", version: "2026-07-07" },
            status: "passed",
            confidence: "high",
            rationale: "The newsletter is complete.",
            evidenceRefs: [{ kind: "file", ref: "index.html", summary: "newsletter page exists" }],
          },
          {
            judge: { kind: "command", version: "fixture-v1" },
            status: "passed",
            confidence: "high",
            rationale: "Fixture checks passed.",
            evidenceRefs: [{ kind: "command", ref: "fixture", summary: "three stories found" }],
          },
        ],
      },
      runManifest: {
        version: "ruhroh_run_manifest_v1",
        runId: "simple-newsletter-agent-a-1",
        scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
        benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor", harborAgent: "ruhroh-harbor" },
        timing: { startedAt: "2026-07-07T12:00:00Z", endedAt: "2026-07-07T12:01:00Z", durationMs: 60000 },
        loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
        sample: { id: "simple-newsletter/agent-a/1-of-2", index: 1, count: 2, seed: "seed-one" },
        runAgent: {
          adapterId: "agent-a",
          adapterVersion: "0.1.0",
          continuityLevel: "workspace_only",
          sessionHandle: "session",
          runIds: [],
          model: { provider: "example", model: "agent-model", version: "2026-07-07" },
        },
        evaluator: {
          fixtureConfigured: false,
          model: { provider: "example", model: "eval-model" },
        },
        usage: {
          costUsd: 0.25,
          totalTokens: 1200,
        },
      },
    })));
    writeFileSync(runTwoResultPath, JSON.stringify(loopResultFixture({
      scenarioId: "simple-newsletter",
      runAgentAdapterId: "agent-a",
      score: 0,
      status: "failed",
      failure_kind: "goal_mismatch",
      failureBucket: "goal_mismatch",
      artifactPaths: {
        journey: runTwoJourneyPath,
      },
      evalResult: {
        version: "ruhroh_eval_result_v1",
        status: "failed",
        goalMet: false,
        confidence: "high",
        reasons: ["missing"],
        unmetCriteria: ["Export"],
        evidenceRefs: [],
        commandsRun: [],
        artifacts: {},
        finalSummary: "Not delivered.",
      },
    })));
    writeFileSync(runPlanPath, JSON.stringify({
      version: "ruhroh_run_plan_v1",
      createdAt: "2026-07-07T12:00:00Z",
      selection: {
        scenarioDir: path.join(tmp, "scenarios"),
        suiteDir,
        runs: 2,
        adapters: ["agent-a"],
      },
      suite: {
        id: "local-smoke",
        title: "Local Smoke",
        suiteVersion: "0.9.0",
        scenarioIds: ["simple-newsletter"],
        scenarioVersions: { "simple-newsletter": "1.0.0" },
        source: {
          suitePath,
          suiteSha256: "0".repeat(64),
        },
      },
      generated: {
        generatedDir: path.join(tmp, ".generated", "ruhroh"),
        datasetPath: path.join(tmp, ".generated", "ruhroh", "harbor"),
      },
      scenarios: [{ id: "simple-newsletter", title: "Simple Newsletter", tier: "smoke", scenarioVersion: "1.0.0" }],
      samples: [
        {
          label: "agent-a:simple-newsletter#1/2",
          scenarioId: "simple-newsletter",
          adapter: "agent-a",
          sampleId: "simple-newsletter/agent-a/1-of-2",
          sampleSeed: "seed-one",
          runIndex: 1,
          runCount: 2,
          forwardedEnvKeys: ["RUHROH_SAMPLE_ID"],
          harborCommand: { bin: "harbor", args: [], display: "harbor ..." },
        },
        {
          label: "agent-a:simple-newsletter#2/2",
          scenarioId: "simple-newsletter",
          adapter: "agent-a",
          sampleId: "simple-newsletter/agent-a/2-of-2",
          sampleSeed: "seed-two",
          runIndex: 2,
          runCount: 2,
          forwardedEnvKeys: ["RUHROH_SAMPLE_ID"],
          harborCommand: { bin: "harbor", args: [], display: "harbor ..." },
        },
      ],
    }));

    const reportStdout: string[] = [];
    const reportCode = await runRuhrohCli(["report", "run-one", "--json"], {
      spawn: (() => assert.fail("report should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { reportStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(reportCode, 0);
    const report = JSON.parse(reportStdout.join(""));
    assert.equal(report.summary.evalStatus, "passed");
    assert.equal(report.summary.runId, "simple-newsletter-agent-a-1");
    assert.equal(report.summary.runManifest.scenario.scenarioVersion, "1.0.0");
    assert.equal(report.summary.evalQualityWarnings.includes("eval result has no top-level evidenceRefs"), true);
    assert.equal(report.summary.evalJudge.model, "arbiter");
    assert.equal(report.summary.evalJudgeVotes.length, 2);
    assert.equal(report.summary.evalJudgeAgreement.votes, 2);
    assert.equal(report.summary.evalJudgeAgreement.unanimous, true);
    assert.equal(report.summary.evalJudgeAgreement.majorityStatus, "passed");
    assert.equal(report.summary.implementationTimeline[0].runId, "agent-run-1");
    assert.equal(report.summary.implementationTimeline[0].completionState, "done");
    assert.deepEqual(report.summary.artifactInventory.map((item: { name: string }) => item.name), ["journey", "runManifest"]);
    assert.equal(report.summary.artifactInventory[0].available, true);
    assert.equal(report.summary.artifactInventory[0].sizeBytes, readFileSync(runOneJourneyPath).length);
    assert.equal(report.summary.artifactInventory[0].sha256, sha256File(runOneJourneyPath));
    assert.equal(report.reviewQueue[0].scenarioId, "simple-newsletter");
    assert.equal(report.reviewQueue[0].priority, "recommended");
    assert.equal(report.reviewQueue[0].reasons.includes("eval result has no top-level evidenceRefs"), true);
    assert.equal(report.reviewQueue[0].transcriptPaths[0], "/tmp/transcript.log");

    const htmlStdout: string[] = [];
    const htmlPath = path.join(tmp, "report.html");
    const htmlCode = await runRuhrohCli(["report", "run-one", "--html", htmlPath], {
      spawn: (() => assert.fail("HTML report should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { htmlStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const html = readFileSync(htmlPath, "utf8");
    assert.equal(htmlCode, 0);
    assert.match(htmlStdout.join(""), /Wrote Ruhroh HTML report/u);
    assert.match(html, /<!doctype html>/u);
    assert.match(html, /Implementation Timeline/u);
    assert.match(html, /Review Queue/u);
    assert.match(html, /Evaluator Judges/u);
    assert.match(html, /Artifact Inventory/u);
    assert.match(html, /SHA-256/u);
    assert.match(html, /available/u);
    assert.match(html, /href="\.\/run-one\/ruhroh-journey\.jsonl"/u);
    assert.match(html, new RegExp(sha256File(runOneJourneyPath), "u"));
    assert.match(html, /hybrid\/arbiter@2026-07-07/u);
    assert.match(html, /model\/eval-a@2026-07-07/u);
    assert.match(html, /agent-run-1/u);
    assert.match(html, /Delivered &lt;ok&gt;\./u);

    const compareHtmlStdout: string[] = [];
    const compareHtmlPath = path.join(tmp, "compare.html");
    const compareHtmlCode = await runRuhrohCli(["compare", ".", "--run-plan", "ruhroh-run-plan.json", "--html", compareHtmlPath], {
      spawn: (() => assert.fail("HTML compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { compareHtmlStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const compareHtml = readFileSync(compareHtmlPath, "utf8");
    assert.equal(compareHtmlCode, 0);
    assert.match(compareHtmlStdout.join(""), /Wrote Ruhroh compare HTML report/u);
    assert.match(compareHtml, /Ruhroh compare/u);
    assert.match(compareHtml, /simple-newsletter/u);
    assert.match(compareHtml, /Claim Readiness/u);
    assert.match(compareHtml, /Run Plan Warnings/u);
    assert.match(compareHtml, /run plan sample has no result artifact/u);
    assert.match(compareHtml, /Review Queue/u);
    assert.match(compareHtml, /Result Artifacts/u);
    assert.match(compareHtml, /href="\.\/run-one\/ruhroh-loop-result\.json"/u);
    assert.match(compareHtml, /href="\.\/run-one\/ruhroh-journey\.jsonl"/u);
    assert.match(compareHtml, /journey: available/u);
    assert.match(compareHtml, /95% CI/u);
    assert.match(compareHtml, /scenarioVersion=1\.0\.0\|unknown/u);
    assert.match(compareHtml, /mixed scenario versions in aggregate group/u);
    assert.match(compareHtml, /costPerPass=\$0\.25/u);

    const textStdout: string[] = [];
    const textCode = await runRuhrohCli(["report", "run-one"], {
      spawn: (() => assert.fail("text report should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { textStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const textReport = textStdout.join("");
    assert.equal(textCode, 0);
    assert.match(textReport, /Artifact inventory:/u);
    assert.match(textReport, /journey: available/u);
    assert.match(textReport, new RegExp(sha256File(runOneJourneyPath), "u"));

    const compareStdout: string[] = [];
    const compareCode = await runRuhrohCli(["compare", ".", "--json"], {
      spawn: (() => assert.fail("compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { compareStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const compare = JSON.parse(compareStdout.join(""));
    assert.equal(compareCode, 0);
    assert.equal(compare.groups[0].runs, 2);
    assert.equal(compare.groups[0].passRate, 0.5);
    assert.equal(compare.groups[0].passAtK["pass@2"], 1);
    assert.equal(compare.groups[0].meanScoreCi95.method, "bootstrap_percentile");
    assert.deepEqual(compare.groups[0].cohort.scenarioVersions, ["1.0.0", "unknown"]);
    assert.deepEqual(compare.groups[0].cohort.agentModels, ["example/agent-model@2026-07-07", "unknown"]);
    assert.equal(compare.groups[0].cohort.comparabilityWarnings.includes("mixed scenario versions in aggregate group"), true);
    assert.equal(compare.groups[0].statisticalWarnings.includes("fewer than 5 runs; treat pass rate and pass@k as directional"), true);
    assert.equal(compare.groups[0].statisticalWarnings.includes("mixed agent models in aggregate group"), true);
    assert.equal(compare.groups[0].evalQualityWarnings["eval result has no top-level evidenceRefs"], 2);
    assert.equal(compare.reviewQueue.length, 2);
    assert.equal(compare.reviewQueue.some((item: { reasons: string[] }) => item.reasons.includes("non-passing run: goal_mismatch")), true);
  assert.equal(compare.groups[0].usage.runsWithUsage, 1);
  assert.equal(compare.groups[0].usage.runsWithCost, 1);
  assert.equal(compare.groups[0].usage.runsWithTokens, 1);
  assert.equal(compare.groups[0].usage.totalCostUsd, 0.25);
    assert.equal(compare.groups[0].usage.costPerPass, 0.25);
    assert.equal(compare.groups[0].usage.totalTokens, 1200);
    assert.equal(compare.artifactValidation.version, "ruhroh_artifact_validation_report_v1");
    assert.equal(compare.artifactValidation.valid, false);
    assert.equal(compare.artifactValidation.runs.length, 2);
    assert.equal(compare.artifactValidation.errors.length > 0, true);
    assert.equal(compare.claimReadiness.scope, "ad_hoc_compare");
    assert.equal(compare.claimReadiness.publishable, false);
    assert.equal(compare.claimReadiness.blockers.includes("no suite selected; use compare --suite for publishable benchmark claims"), true);
    assert.equal(compare.claimReadiness.blockers.some((item: string) => item.includes("artifact validation failed")), true);
    assert.equal(compare.claimReadiness.blockers.some((item: string) => item.includes("fewer than 5 runs")), true);
    assert.equal(compare.benchmarkClaim.version, "ruhroh_benchmark_claim_v1");
    assert.equal(compare.benchmarkClaim.evidence.artifactValidationErrors, compare.artifactValidation.errors.length);
    assert.equal(compare.benchmarkClaim.evidence.artifactValidationWarnings, compare.artifactValidation.warnings.length);
    assert.equal(compare.benchmarkClaim.tool.name, "@kestrel-agents/ruhroh");
    assert.equal(compare.benchmarkClaim.tool.version, "0.6.0-beta.0");
    assert.equal(compare.benchmarkClaim.scope, "ad_hoc_compare");
    assert.equal(compare.benchmarkClaim.publishable, false);
    assert.equal(compare.benchmarkClaim.summary.totalRuns, 2);
    assert.equal(compare.benchmarkClaim.summary.totalPasses, 1);
    assert.equal(compare.benchmarkClaim.summary.runWeightedPassRate, 0.5);
    assert.equal(compare.benchmarkClaim.adapterSummaries[0].usage.runsWithUsage, 1);
    assert.equal(compare.benchmarkClaim.adapterSummaries[0].usage.costPerPass, 0.25);
    assert.equal(compare.benchmarkClaim.scenarioResults[0].meanScoreCi95.method, "bootstrap_percentile");
    assert.equal(compare.benchmarkClaim.scenarioResults[0].usage.runsWithUsage, 1);
    assert.equal(compare.benchmarkClaim.scenarioResults[0].usage.tokensPerPass, 1200);
    assert.equal(compare.benchmarkClaim.source.resultsPath, tmp);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts.length, 2);
    assert.deepEqual(compare.benchmarkClaim.source.resultArtifacts.map((artifact: { path: string }) => artifact.path), [runOneResultPath, runTwoResultPath]);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].sha256, sha256File(runOneResultPath));
    assert.match(compare.benchmarkClaim.source.resultArtifacts[0].sha256, /^[a-f0-9]{64}$/u);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].runId, "simple-newsletter-agent-a-1");
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].sampleId, "simple-newsletter/agent-a/1-of-2");
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].scenarioVersion, "1.0.0");
    assert.deepEqual(compare.benchmarkClaim.source.resultArtifacts[0].artifactInventory.map((item: { name: string }) => item.name), ["journey", "runManifest"]);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].artifactInventory[0].path, runOneJourneyPath);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].artifactInventory[0].available, true);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].artifactInventory[0].sizeBytes, readFileSync(runOneJourneyPath).length);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[0].artifactInventory[0].sha256, sha256File(runOneJourneyPath));
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[1].path, runTwoResultPath);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[1].artifactInventory[0].available, false);
    assert.equal(compare.benchmarkClaim.source.resultArtifacts[1].artifactInventory[0].error, "missing");
    assert.equal(compare.benchmarkClaim.adapterSummaries[0].adapter, "agent-a");
    assert.equal(compare.benchmarkClaim.scenarioResults[0].scenarioId, "simple-newsletter");
    assert.equal(compare.benchmarkClaim.evidence.runPlanPresent, false);

    const compareRunPlanStdout: string[] = [];
    const benchmarkClaimPath = path.join(tmp, "benchmark-claim.json");
    const benchmarkSummaryPath = path.join(tmp, "benchmark-summary.json");
    const compareRunPlanCode = await runRuhrohCli(["compare", ".", "--run-plan", "ruhroh-run-plan.json", "--benchmark-claim", "benchmark-claim.json", "--benchmark-summary", "benchmark-summary.json", "--json"], {
      spawn: (() => assert.fail("run-plan compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { compareRunPlanStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const compareRunPlan = JSON.parse(compareRunPlanStdout.join(""));
    assert.equal(compareRunPlanCode, 0);
    assert.equal(compareRunPlan.benchmarkClaimPath, benchmarkClaimPath);
    assert.equal(compareRunPlan.benchmarkSummaryPath, benchmarkSummaryPath);
    assert.equal(compareRunPlan.benchmarkClaim.source.resultsPath, tmp);
    assert.equal(compareRunPlan.benchmarkClaim.source.runPlanPath, path.join(tmp, "ruhroh-run-plan.json"));
    assert.equal(compareRunPlan.benchmarkClaim.source.runPlanSha256, sha256File(runPlanPath));
    assert.equal(compareRunPlan.benchmarkClaim.source.benchmarkClaimPath, benchmarkClaimPath);
    assert.equal(compareRunPlan.benchmarkClaim.source.benchmarkSummaryPath, benchmarkSummaryPath);
    assert.equal(compareRunPlan.benchmarkClaim.source.resultArtifacts.length, 2);
    assert.equal(compareRunPlan.benchmarkClaim.source.resultArtifacts[0].sha256, sha256File(runOneResultPath));
    assert.equal(compareRunPlan.runPlan.sampleCount, 2);
    assert.equal(compareRunPlan.runPlanWarnings.some((warning: string) => warning.includes("simple-newsletter/agent-a/2-of-2")), true);
    assert.equal(compareRunPlan.runPlanWarnings.some((warning: string) => warning.includes("result has no sample id")), true);
    assert.equal(compareRunPlan.claimReadiness.blockers.some((item: string) => item.includes("run plan warning")), true);
    assert.equal(compareRunPlan.benchmarkClaim.evidence.runPlanPresent, true);
    assert.equal(compareRunPlan.benchmarkClaim.evidence.runPlanWarnings.length, compareRunPlan.runPlanWarnings.length);
    assert.equal(compareRunPlan.benchmarkSummary.version, "ruhroh_benchmark_summary_v1");
    assert.equal(compareRunPlan.benchmarkSummary.claimVersion, "ruhroh_benchmark_claim_v1");
    assert.equal(compareRunPlan.benchmarkSummary.rows.length, compareRunPlan.benchmarkClaim.scenarioResults.length);
    assert.equal(compareRunPlan.benchmarkSummary.rows[0].scenarioId, "simple-newsletter");
    assert.equal(compareRunPlan.benchmarkSummary.rows[0].adapter, "agent-a");
    assert.equal(compareRunPlan.benchmarkSummary.rows[0].meanScoreCi95.method, "bootstrap_percentile");
    assert.deepEqual(compareRunPlan.benchmarkSummary.rows[0].usage, compareRunPlan.benchmarkClaim.scenarioResults[0].usage);
    const exportedClaim = JSON.parse(readFileSync(benchmarkClaimPath, "utf8"));
    assert.deepEqual(exportedClaim, compareRunPlan.benchmarkClaim);
    const exportedSummary = JSON.parse(readFileSync(benchmarkSummaryPath, "utf8"));
    assert.deepEqual(exportedSummary, compareRunPlan.benchmarkSummary);

    const validateSummaryStdout: string[] = [];
    const validateSummaryCode = await runRuhrohCli(["validate-summary", "benchmark-summary.json", "--json"], {
      spawn: (() => assert.fail("summary validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { validateSummaryStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const validateSummary = JSON.parse(validateSummaryStdout.join(""));
    assert.equal(validateSummaryCode, 0);
    assert.equal(validateSummary.version, "ruhroh_benchmark_summary_validation_report_v1");
    assert.equal(validateSummary.source.summaryPath, benchmarkSummaryPath);
    assert.deepEqual(validateSummary.validation.errors, []);

    const invalidSummaryPath = path.join(tmp, "invalid-summary.json");
    const invalidSummary: Record<string, unknown> = {
      ...exportedSummary,
      rows: [
        {
          ...exportedSummary.rows[0],
          scope: "suite",
          passes: exportedSummary.rows[0].runs + 1,
        },
        ...exportedSummary.rows.slice(1),
      ],
    };
    writeFileSync(invalidSummaryPath, `${JSON.stringify(invalidSummary, null, 2)}\n`);
    const invalidSummaryStdout: string[] = [];
    const invalidSummaryCode = await runRuhrohCli(["validate-summary", "invalid-summary.json", "--json"], {
      spawn: (() => assert.fail("invalid summary validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { invalidSummaryStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const invalidSummaryReport = JSON.parse(invalidSummaryStdout.join(""));
    assert.equal(invalidSummaryCode, 1);
    assert.equal(invalidSummaryReport.validation.errors.includes("rows[0].scope must match summary scope"), true);
    assert.equal(invalidSummaryReport.validation.errors.includes("rows[0].passes must be <= rows[0].runs"), true);

    const validateClaimStdout: string[] = [];
    const validateClaimCode = await runRuhrohCli(["validate-claim", "benchmark-claim.json", "--json"], {
      spawn: (() => assert.fail("claim validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { validateClaimStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const validateClaim = JSON.parse(validateClaimStdout.join(""));
    assert.equal(validateClaimCode, 0);
    assert.equal(validateClaim.version, "ruhroh_benchmark_claim_validation_report_v1");
    assert.equal(validateClaim.source.claimPath, benchmarkClaimPath);
    assert.deepEqual(validateClaim.validation.errors, []);

    const verifySourcesStdout: string[] = [];
    const verifySourcesCode = await runRuhrohCli(["validate-claim", "benchmark-claim.json", "--verify-sources", "--json"], {
      spawn: (() => assert.fail("claim source verification should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { verifySourcesStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const verifySources = JSON.parse(verifySourcesStdout.join(""));
    assert.equal(verifySourcesCode, 0);
    assert.equal(verifySources.sourceVerification.version, "ruhroh_claim_source_verification_v1");
    assert.equal(verifySources.sourceVerification.checked, true);
    assert.deepEqual(verifySources.sourceVerification.errors, []);
    assert.equal(verifySources.sourceVerification.checks.some((check: { name: string; status: string }) => check.name === "runPlan" && check.status === "ok"), true);
    assert.equal(verifySources.sourceVerification.checks.some((check: { name: string; status: string }) => check.name === "resultArtifacts[0]" && check.status === "ok"), true);
    assert.equal(verifySources.sourceVerification.checks.some((check: { name: string; status: string }) => check.name === "resultArtifacts[0].artifactInventory[0]" && check.status === "ok"), true);

    const driftedClaimPath = path.join(tmp, "drifted-claim.json");
    const driftedClaim = JSON.parse(JSON.stringify(exportedClaim));
    driftedClaim.source.resultArtifacts[0].sha256 = "f".repeat(64);
    writeFileSync(driftedClaimPath, `${JSON.stringify(driftedClaim, null, 2)}\n`);
    const driftedClaimStdout: string[] = [];
    const driftedClaimCode = await runRuhrohCli(["validate-claim", "drifted-claim.json", "--verify-sources", "--json"], {
      spawn: (() => assert.fail("drifted claim source verification should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { driftedClaimStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const driftedClaimReport = JSON.parse(driftedClaimStdout.join(""));
    assert.equal(driftedClaimCode, 1);
    assert.equal(driftedClaimReport.sourceVerification.errors.some((item: string) => item.includes("resultArtifacts[0]") && item.includes("hash mismatch")), true);

    const validateClaimGateStdout: string[] = [];
    const validateClaimGateStderr: string[] = [];
    const validateClaimGateCode = await runRuhrohCli(["validate-claim", "benchmark-claim.json", "--require-publishable", "--json"], {
      spawn: (() => assert.fail("claim publishability validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { validateClaimGateStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { validateClaimGateStderr.push(chunk); return true; } },
    });
    const validateClaimGate = JSON.parse(validateClaimGateStdout.join(""));
    assert.equal(validateClaimGateCode, 2);
    assert.deepEqual(validateClaimGate.validation.errors, []);
    assert.equal(validateClaimGate.publishabilityGate.required, true);
    assert.equal(validateClaimGate.publishabilityGate.publishable, false);
    assert.equal(validateClaimGate.publishabilityGate.blockers.some((item: string) => item.includes("run plan warning")), true);
    assert.match(validateClaimGateStderr.join(""), /validate-claim failed publishability gate: \d+ blockers/u);

    const invalidClaimPath = path.join(tmp, "invalid-claim.json");
    const invalidClaim: Record<string, unknown> = { ...exportedClaim };
    invalidClaim.readiness = {
      scope: "ad_hoc_compare",
      publishable: true,
      blockers: ["still blocked"],
      advisories: [],
    };
    writeFileSync(invalidClaimPath, `${JSON.stringify(invalidClaim, null, 2)}\n`);
    const invalidClaimStdout: string[] = [];
    const invalidClaimCode = await runRuhrohCli(["validate-claim", "invalid-claim.json", "--json"], {
      spawn: (() => assert.fail("invalid claim validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { invalidClaimStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const invalidClaimReport = JSON.parse(invalidClaimStdout.join(""));
    assert.equal(invalidClaimCode, 1);
    assert.equal(invalidClaimReport.validation.errors.includes("readiness.publishable must match publishable"), true);
    assert.equal(invalidClaimReport.validation.errors.includes("readiness.publishable cannot be true when blockers are present"), true);

    const forgedPublishableClaimPath = path.join(tmp, "forged-publishable-claim.json");
    const forgedPublishableClaim: Record<string, unknown> = {
      ...exportedClaim,
      scope: "ad_hoc_compare",
      publishable: true,
      readiness: {
        scope: "ad_hoc_compare",
        publishable: true,
        blockers: [],
        advisories: [],
      },
    };
    writeFileSync(forgedPublishableClaimPath, `${JSON.stringify(forgedPublishableClaim, null, 2)}\n`);
    const forgedPublishableClaimStdout: string[] = [];
    const forgedPublishableClaimCode = await runRuhrohCli(["validate-claim", "forged-publishable-claim.json", "--require-publishable", "--json"], {
      spawn: (() => assert.fail("publishable claim validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { forgedPublishableClaimStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const forgedPublishableClaimReport = JSON.parse(forgedPublishableClaimStdout.join(""));
    assert.equal(forgedPublishableClaimCode, 2);
    assert.equal(forgedPublishableClaimReport.publishabilityGate.publishable, false);
    assert.equal(forgedPublishableClaimReport.publishabilityGate.blockers.some((item: string) => item.includes("no suite selected")), true);
    assert.equal(forgedPublishableClaimReport.publishabilityGate.blockers.some((item: string) => item.includes("run plan warning")), true);
    assert.equal(forgedPublishableClaimReport.publishabilityGate.blockers.some((item: string) => item.includes("artifact-completeness warnings present")), true);

    const compareGateStdout: string[] = [];
    const compareGateStderr: string[] = [];
    const compareGateCode = await runRuhrohCli(["compare", ".", "--run-plan", "ruhroh-run-plan.json", "--require-publishable", "--json"], {
      spawn: (() => assert.fail("publishability-gated compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { compareGateStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { compareGateStderr.push(chunk); return true; } },
    });
    const compareGate = JSON.parse(compareGateStdout.join(""));
    assert.equal(compareGateCode, 2);
    assert.equal(compareGate.claimReadiness.publishable, false);
    assert.equal(compareGate.claimReadiness.blockers.some((item: string) => item.includes("run plan warning")), true);
    assert.match(compareGateStderr.join(""), /publishability gate: \d+ blockers/u);

    const suiteCompareStdout: string[] = [];
    const suiteCompareCode = await runRuhrohCli(["compare", ".", "--suite-dir", "suites", "--suite", "local-smoke", "--json"], {
      spawn: (() => assert.fail("suite compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { suiteCompareStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const suiteCompare = JSON.parse(suiteCompareStdout.join(""));
    assert.equal(suiteCompareCode, 0);
    assert.equal(suiteCompare.suite.id, "local-smoke");
    assert.deepEqual(suiteCompare.suiteWarnings, ["suite scenario has no result artifacts: missing-scenario"]);
    assert.equal(suiteCompare.suiteAdapterSummaries[0].adapter, "agent-a");
    assert.equal(suiteCompare.suiteAdapterSummaries[0].coveredScenarios, 1);
    assert.equal(suiteCompare.suiteAdapterSummaries[0].expectedScenarios, 2);
    assert.equal(suiteCompare.suiteAdapterSummaries[0].minRunsSatisfied, false);
    assert.equal(suiteCompare.suiteAdapterSummaries[0].warnings.includes("missing suite scenario: missing-scenario"), true);
    assert.equal(suiteCompare.groups[0].statisticalWarnings.includes("fewer than 3 runs; suite methodology requires 3 for publishable comparison"), true);
    assert.equal(suiteCompare.groups[0].statisticalWarnings.includes("scenario simple-newsletter mixes suite-locked scenarioVersion 1.0.0 with other scenario versions"), true);
    assert.equal(suiteCompare.claimReadiness.scope, "suite");
    assert.equal(suiteCompare.claimReadiness.publishable, false);
    assert.equal(suiteCompare.claimReadiness.blockers.some((item: string) => item.includes("suite warning")), true);
    assert.equal(suiteCompare.claimReadiness.blockers.some((item: string) => item.includes("suite minimum runs")), true);
    assert.equal(suiteCompare.claimReadiness.blockers.some((item: string) => item.includes("eval-quality warnings present")), true);
    assert.equal(suiteCompare.benchmarkClaim.scope, "suite");
    assert.equal(suiteCompare.benchmarkClaim.suite.id, "local-smoke");
    assert.equal(suiteCompare.benchmarkClaim.suite.minRuns, 3);
    assert.equal(suiteCompare.benchmarkClaim.source.suitePath, suitePath);
    assert.equal(suiteCompare.benchmarkClaim.source.suiteSha256, sha256File(suitePath));
    assert.equal(suiteCompare.benchmarkClaim.adapterSummaries[0].minRunsSatisfied, false);
    assert.equal(suiteCompare.benchmarkClaim.suiteCoverage.expectedScenarios, 2);
    assert.equal(suiteCompare.benchmarkClaim.suiteCoverage.coveredScenarios, 1);
    assert.deepEqual(suiteCompare.benchmarkClaim.suiteCoverage.missingScenarioIds, ["missing-scenario"]);
    assert.equal(suiteCompare.benchmarkClaim.suiteCoverage.minRunsSatisfied, false);
    assert.deepEqual(suiteCompare.benchmarkClaim.suiteCoverage.adapters[0].scenarioRuns, { "simple-newsletter": 2 });

    const suiteHtmlPath = path.join(tmp, "suite-compare.html");
    const suiteHtmlStdout: string[] = [];
    const suiteHtmlCode = await runRuhrohCli(["compare", ".", "--suite-dir", "suites", "--suite", "local-smoke", "--html", suiteHtmlPath], {
      spawn: (() => assert.fail("suite HTML compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { suiteHtmlStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const suiteHtml = readFileSync(suiteHtmlPath, "utf8");
    assert.equal(suiteHtmlCode, 0);
    assert.match(suiteHtmlStdout.join(""), /Wrote Ruhroh compare HTML report/u);
    assert.match(suiteHtml, /Suite Adapter Summary/u);
    assert.match(suiteHtml, /Missing scenarios/u);
    assert.match(suiteHtml, /Scenario runs/u);
    assert.match(suiteHtml, /missing-scenario/u);
    assert.match(suiteHtml, /simple-newsletter=2/u);

    const suiteTextStdout: string[] = [];
    const suiteTextCode = await runRuhrohCli(["compare", ".", "--suite-dir", "suites", "--suite", "local-smoke"], {
      spawn: (() => assert.fail("suite text compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { suiteTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const suiteText = suiteTextStdout.join("");
    assert.equal(suiteTextCode, 0);
    assert.match(suiteText, /Suite adapter summary/u);
    assert.match(suiteText, /missing=missing-scenario/u);
    assert.match(suiteText, /scenarioRuns=simple-newsletter=2/u);

    const suiteRunPlanStdout: string[] = [];
    const suiteRunPlanCode = await runRuhrohCli(["compare", ".", "--suite-dir", "suites", "--suite", "local-smoke", "--run-plan", "ruhroh-run-plan.json", "--json"], {
      spawn: (() => assert.fail("suite run-plan compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { suiteRunPlanStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const suiteRunPlan = JSON.parse(suiteRunPlanStdout.join(""));
    assert.equal(suiteRunPlanCode, 0);
    assert.equal(suiteRunPlan.runPlan.suite.id, "local-smoke");
    assert.equal(suiteRunPlan.runPlanWarnings.some((warning: string) => warning.includes("run plan suiteVersion mismatch")), true);
    assert.equal(suiteRunPlan.runPlanWarnings.some((warning: string) => warning.includes("run plan suite manifest hash mismatch")), true);
    assert.equal(suiteRunPlan.claimReadiness.blockers.some((item: string) => item.includes("run plan warning")), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI compare warns when result sample metadata contradicts run plan", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-run-plan-mismatch-"));
  try {
    const resultDir = path.join(tmp, "run-one");
    const resultPath = path.join(resultDir, "ruhroh-loop-result.json");
    const runPlanPath = path.join(tmp, "ruhroh-run-plan.json");
    mkdirSync(resultDir, { recursive: true });
    writeFileSync(resultPath, JSON.stringify(loopResultFixture({
      runId: "actual-scenario-agent-b-1",
      scenarioId: "actual-scenario",
      runAgentAdapterId: "agent-b",
      score: 1,
      status: "completed",
      failure_kind: "none",
      failureBucket: "none",
      evalResult: {
        version: "ruhroh_eval_result_v1",
        status: "passed",
        goalMet: true,
        confidence: "high",
        reasons: ["ok"],
        unmetCriteria: [],
        evidenceRefs: [{ kind: "file", ref: "index.html", summary: "delivered" }],
        commandsRun: [],
        artifacts: {},
        finalSummary: "The delivered workspace satisfies the requested workflow.",
        criteriaResults: [{
          id: "workflow",
          description: "Workflow works.",
          status: "passed",
          score: 1,
          evidenceRefs: [{ kind: "file", ref: "index.html", summary: "delivered" }],
        }],
        judge: { kind: "fixture", version: "fixture-v1" },
      },
      runManifest: {
        version: "ruhroh_run_manifest_v1",
        runId: "actual-scenario-agent-b-1",
        scenario: { id: "actual-scenario", scenarioVersion: "1.0.0" },
        benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
        timing: { startedAt: "2026-07-07T12:00:00Z", durationMs: 1000 },
        loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
        sample: { id: "planned-scenario/agent-a/1-of-1", index: 2, count: 3, seed: "wrong-seed" },
        runAgent: { adapterId: "agent-b", adapterVersion: "0.1.0", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      },
      artifactPaths: {
        runManifest: "/tmp/ruhroh-run-manifest.json",
        implementationRuns: "/tmp/ruhroh-loop-iterations.jsonl",
        journey: "/tmp/ruhroh-loop-journey.json",
        evalResult: "/tmp/ruhroh-loop-eval.json",
        evalInput: "/tmp/ruhroh-loop-eval-input.json",
        workspaceSummary: "/tmp/ruhroh-workspace-summary.json",
        workspaceTarball: "/tmp/ruhroh-workspace.tar.gz",
        eventsTarball: "/tmp/ruhroh-loop-events.tar.gz",
        transcriptsTarball: "/tmp/ruhroh-loop-transcripts.tar.gz",
      },
    })));
    writeFileSync(runPlanPath, JSON.stringify({
      version: "ruhroh_run_plan_v1",
      createdAt: "2026-07-07T12:00:00Z",
      selection: {
        scenarioDir: path.join(tmp, "scenarios"),
        suiteDir: path.join(tmp, "suites"),
        runs: 1,
        adapters: ["agent-a"],
      },
      generated: {
        generatedDir: path.join(tmp, ".generated", "ruhroh"),
        datasetPath: path.join(tmp, ".generated", "ruhroh", "harbor"),
      },
      scenarios: [{ id: "planned-scenario", title: "Planned Scenario", tier: "smoke", scenarioVersion: "1.0.0" }],
      samples: [{
        label: "agent-a:planned-scenario#1/1",
        scenarioId: "planned-scenario",
        adapter: "agent-a",
        sampleId: "planned-scenario/agent-a/1-of-1",
        sampleSeed: "seed-one",
        runIndex: 1,
        runCount: 1,
        forwardedEnvKeys: ["RUHROH_SAMPLE_ID"],
        harborCommand: { bin: "harbor", args: [], display: "harbor ..." },
      }],
    }));

    const stdout: string[] = [];
    const code = await runRuhrohCli(["compare", ".", "--run-plan", "ruhroh-run-plan.json", "--json"], {
      spawn: (() => assert.fail("run-plan mismatch compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const parsed = JSON.parse(stdout.join(""));

    assert.equal(code, 0);
    assert.equal(parsed.runPlanWarnings.some((warning: string) => warning.includes("scenario mismatch")), true);
    assert.equal(parsed.runPlanWarnings.some((warning: string) => warning.includes("adapter mismatch")), true);
    assert.equal(parsed.runPlanWarnings.some((warning: string) => warning.includes("seed mismatch")), true);
    assert.equal(parsed.runPlanWarnings.some((warning: string) => warning.includes("index mismatch")), true);
    assert.equal(parsed.runPlanWarnings.some((warning: string) => warning.includes("count mismatch")), true);
    assert.equal(parsed.claimReadiness.blockers.some((item: string) => item.includes("run plan warning")), true);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI compare includes pairwise adapter comparisons", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-pairwise-"));
  try {
    const writeResult = (dirName: string, overrides: Partial<RuhrohLoopResult>): void => {
      const runDir = path.join(tmp, dirName);
      mkdirSync(runDir, { recursive: true });
      writeFileSync(path.join(runDir, "ruhroh-loop-result.json"), JSON.stringify(loopResultFixture({
        scenarioId: "simple-newsletter",
        status: overrides.score === 1 ? "completed" : "failed",
        failure_kind: overrides.score === 1 ? "none" : "goal_mismatch",
        failureBucket: overrides.score === 1 ? "none" : "goal_mismatch",
        ...overrides,
      })));
    };

    writeResult("agent-a-pass", {
      runId: "agent-a-pass",
      runAgentAdapterId: "agent-a",
      score: 1,
      runManifest: {
        version: "ruhroh_run_manifest_v1",
        runId: "agent-a-pass",
        scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
        benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
        timing: { startedAt: "2026-07-07T12:00:00Z", durationMs: 1000 },
        loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
        sample: { id: "simple-newsletter/agent-a/1-of-2", index: 1, count: 2, seed: "seed-a-1" },
        runAgent: { adapterId: "agent-a", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      },
    });
    writeResult("agent-a-fail", {
      runId: "agent-a-fail",
      runAgentAdapterId: "agent-a",
      score: 0,
      runManifest: {
        version: "ruhroh_run_manifest_v1",
        runId: "agent-a-fail",
        scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
        benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
        timing: { startedAt: "2026-07-07T12:01:00Z", durationMs: 1000 },
        loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_mismatch" },
        sample: { id: "simple-newsletter/agent-a/2-of-2", index: 2, count: 2, seed: "seed-a-2" },
        runAgent: { adapterId: "agent-a", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      },
    });
    writeResult("agent-b-pass-one", {
      runId: "agent-b-pass-one",
      runAgentAdapterId: "agent-b",
      score: 1,
      runManifest: {
        version: "ruhroh_run_manifest_v1",
        runId: "agent-b-pass-one",
        scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
        benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
        timing: { startedAt: "2026-07-07T12:02:00Z", durationMs: 1000 },
        loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
        sample: { id: "simple-newsletter/agent-b/1-of-2", index: 1, count: 2, seed: "seed-b-1" },
        runAgent: { adapterId: "agent-b", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      },
    });
    writeResult("agent-b-pass-two", {
      runId: "agent-b-pass-two",
      runAgentAdapterId: "agent-b",
      score: 1,
      runManifest: {
        version: "ruhroh_run_manifest_v1",
        runId: "agent-b-pass-two",
        scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
        benchmark: { dataset: "ruhroh@local", adapter: "ruhroh-harbor" },
        timing: { startedAt: "2026-07-07T12:03:00Z", durationMs: 1000 },
        loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
        sample: { id: "simple-newsletter/agent-b/2-of-2", index: 2, count: 2, seed: "seed-b-2" },
        runAgent: { adapterId: "agent-b", continuityLevel: "workspace_only", sessionHandle: "session", runIds: [] },
      },
    });

    const jsonStdout: string[] = [];
    const jsonCode = await runRuhrohCli(["compare", ".", "--json"], {
      spawn: (() => assert.fail("compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { jsonStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const compare = JSON.parse(jsonStdout.join(""));
    assert.equal(jsonCode, 0);
    assert.equal(compare.pairwiseComparisons.length, 1);
    assert.equal(compare.pairwiseComparisons[0].scenarioId, "simple-newsletter");
    assert.equal(compare.pairwiseComparisons[0].baselineAdapter, "agent-a");
    assert.equal(compare.pairwiseComparisons[0].contenderAdapter, "agent-b");
    assert.equal(compare.pairwiseComparisons[0].baselinePassRate, 0.5);
    assert.equal(compare.pairwiseComparisons[0].contenderPassRate, 1);
    assert.equal(compare.pairwiseComparisons[0].passRateDelta, 0.5);
    assert.equal(compare.pairwiseComparisons[0].passRateDeltaCi95.method, "normal_approximation");
    assert.equal(compare.pairwiseComparisons[0].significance.method, "fisher_exact_two_sided");
    assert.equal(compare.pairwiseComparisons[0].significance.pValue, 1);
    assert.equal(compare.pairwiseComparisons[0].significance.significant, false);
    assert.equal(compare.pairwiseComparisons[0].conclusion, "inconclusive");
    assert.equal(compare.pairwiseComparisons[0].warnings.some((warning: string) => warning.includes("delta 95% CI includes 0")), true);
    assert.equal(compare.pairwiseComparisons[0].warnings.some((warning: string) => warning.includes("Fisher exact test is not significant")), true);
    assert.equal(compare.claimReadiness.blockers.some((item: string) => item.includes("agent-b vs agent-a")), true);
    assert.equal(compare.claimReadiness.blockers.some((item: string) => item.includes("Fisher exact test is not significant")), true);
    assert.equal(compare.benchmarkClaim.summary.pairwiseComparisonCount, 1);
    assert.equal(compare.benchmarkClaim.pairwiseComparisons[0].contenderAdapter, "agent-b");
    assert.equal(compare.benchmarkClaim.pairwiseComparisons[0].significance.pValue, 1);

    const textStdout: string[] = [];
    const textCode = await runRuhrohCli(["compare", "."], {
      spawn: (() => assert.fail("text compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { textStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const text = textStdout.join("");
    assert.equal(textCode, 0);
    assert.match(text, /Pairwise adapter comparisons/u);
    assert.match(text, /agent-b vs agent-a delta=\+50%/u);
    assert.match(text, /95% CI .* to /u);
    assert.match(text, /fisherP=1 significant=false/u);
    assert.match(text, /conclusion=inconclusive/u);

    const htmlStdout: string[] = [];
    const htmlPath = path.join(tmp, "compare.html");
    const htmlCode = await runRuhrohCli(["compare", ".", "--html", htmlPath], {
      spawn: (() => assert.fail("HTML compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { htmlStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const html = readFileSync(htmlPath, "utf8");
    assert.equal(htmlCode, 0);
    assert.match(htmlStdout.join(""), /Wrote Ruhroh compare HTML report/u);
    assert.match(html, /Pairwise Adapter Comparisons/u);
    assert.match(html, /agent-b/u);
    assert.match(html, /\+50%/u);
    assert.match(html, /Fisher p/u);
    assert.match(html, />1</u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI dry-run supports adapter override without printing secrets", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-dry-run-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const stdout: string[] = [];
    const code = await runRuhrohCli([
      "--scenario-dir",
      "ruhroh/scenarios",
      "--scenario",
      "simple-newsletter",
      "--adapter",
      "custom-shell",
      "--adapter",
      "./agent-two.mjs",
      "--runs",
      "2",
      "--dry-run",
    ], {
      spawn: (() => assert.fail("dry-run should not spawn Harbor")) as never,
      env: { OPENAI_API_KEY: "secret" },
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const output = stdout.join("");
    assert.equal(code, 0);
    assert.match(output, /selected=custom-shell:simple-newsletter#1\/2,custom-shell:simple-newsletter#2\/2,agent-two:simple-newsletter#1\/2,agent-two:simple-newsletter#2\/2/u);
    assert.match(output, /RUHROH_RUN_AGENT_ADAPTER=custom-shell/u);
    assert.match(output, /RUHROH_RUN_AGENT_ADAPTER=agent-two/u);
    assert.match(output, /RUHROH_SAMPLE_ID=\$\{RUHROH_SAMPLE_ID\}/u);
    assert.match(output, /RUHROH_SAMPLE_SEED=\$\{RUHROH_SAMPLE_SEED\}/u);
    assert.match(output, /RUHROH_RUN_SEED=\$\{RUHROH_RUN_SEED\}/u);
    assert.match(output, /RUHROH_RUN_INDEX=\$\{RUHROH_RUN_INDEX\}/u);
    assert.match(output, /RUHROH_RUN_COUNT=\$\{RUHROH_RUN_COUNT\}/u);
    assert.match(output, /ruhroh\.harbor_agent:RuhrohHarborAgent/u);
    assert.match(output, /OPENAI_API_KEY=\$\{OPENAI_API_KEY\}/u);
    assert.doesNotMatch(output, /secret/u);
    assert.doesNotMatch(output, /benchmarks\.ralph_loop|\/opt\/kestrel-harness|kestrel-harness\.tar\.gz/u);
    assert.equal(existsSync(path.join(tmp, ".generated", "ruhroh", "harbor", "tasks", "simple-newsletter", "task.toml")), false);
    assert.equal(existsSync(path.join(tmp, ".generated", "ruhroh", "ruhroh-run-plan.json")), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI spawns Harbor with package Python runtime importable", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-pythonpath-"));
  try {
    const scenarioDir = path.join(tmp, "ruhroh", "scenarios", "simple-newsletter");
    const agentTwoPath = path.join(tmp, "agent-two.mjs");
    const instructionPath = path.join(scenarioDir, "instruction.md");
    const scenarioPath = path.join(scenarioDir, "scenario.json");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(agentTwoPath, "#!/usr/bin/env node\n");
    writeFileSync(instructionPath, "Build a tiny newsletter page.\n");
    writeFileSync(scenarioPath, JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: [],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task."],
        goalRubric: ["The final app satisfies the user goal."],
        evidenceGuidance: ["Inspect and run the app when useful."],
      },
    }));

    const spawnEnvs: NodeJS.ProcessEnv[] = [];
    const code = await runRuhrohCli([
      "--scenario-dir",
      "ruhroh/scenarios",
      "--scenario",
      "simple-newsletter",
      "--adapter",
      "custom-shell",
      "--adapter",
      "./agent-two.mjs",
      "--runs",
      "2",
    ], {
      spawn: ((_, __, options) => {
        if (options?.env !== undefined) {
          spawnEnvs.push(options.env);
        }
        return { status: 0 } as never;
      }) as never,
      env: { PYTHONPATH: "/already-there", OPENAI_API_KEY: "super-secret" },
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: () => true },
    });

    assert.equal(code, 0);
    assert.equal(spawnEnvs.length, 4);
    assert.equal(spawnEnvs[0]?.RUHROH_RUN_INDEX, "1");
    assert.equal(spawnEnvs[1]?.RUHROH_RUN_INDEX, "2");
    assert.equal(spawnEnvs[2]?.RUHROH_RUN_INDEX, "1");
    assert.equal(spawnEnvs[3]?.RUHROH_RUN_INDEX, "2");
    assert.equal(spawnEnvs[0]?.RUHROH_RUN_COUNT, "2");
    assert.equal(spawnEnvs[0]?.RUHROH_SAMPLE_ID, "simple-newsletter/custom-shell/1-of-2");
    assert.equal(spawnEnvs[1]?.RUHROH_SAMPLE_ID, "simple-newsletter/custom-shell/2-of-2");
    assert.equal(spawnEnvs[2]?.RUHROH_SAMPLE_ID, "simple-newsletter/agent-two/1-of-2");
    assert.match(spawnEnvs[0]?.RUHROH_SAMPLE_SEED ?? "", /^[a-f0-9]{16}$/u);
    assert.equal(spawnEnvs[0]?.RUHROH_RUN_SEED, spawnEnvs[0]?.RUHROH_SAMPLE_SEED);
    assert.equal(spawnEnvs[0]?.RUHROH_RUN_AGENT_COMMAND, undefined);
    assert.equal(spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND, agentTwoPath);
    assert.equal(spawnEnvs[0]?.PYTHONPATH?.startsWith(`${resolveRuhrohPythonPath()}${path.delimiter}`), true);
    assert.match(spawnEnvs[0]?.PYTHONPATH ?? "", /\/already-there$/u);

    const runPlanPath = path.join(tmp, ".generated", "ruhroh", "ruhroh-run-plan.json");
    const runPlanText = readFileSync(runPlanPath, "utf8");
    const runPlan = JSON.parse(runPlanText);
    assert.equal(runPlan.version, "ruhroh_run_plan_v1");
    assert.equal(runPlan.$schema, "https://lumicorp.github.io/ruhroh/schemas/run-plan-v1.schema.json");
    assert.equal(runPlan.selection.runs, 2);
    assert.deepEqual(runPlan.selection.adapters, ["custom-shell", "agent-two"]);
    assert.equal(runPlan.generated.datasetPath, path.join(tmp, ".generated", "ruhroh", "harbor"));
    assert.equal(runPlan.scenarios[0].source.scenarioPath, scenarioPath);
    assert.equal(runPlan.scenarios[0].source.scenarioSha256, sha256File(scenarioPath));
    assert.equal(runPlan.scenarios[0].source.instructionPath, instructionPath);
    assert.equal(runPlan.scenarios[0].source.instructionSha256, sha256File(instructionPath));
    assert.equal(runPlan.samples.length, 4);
    assert.equal(runPlan.samples[0].sampleId, "simple-newsletter/custom-shell/1-of-2");
    assert.equal(runPlan.samples[0].forwardedEnvKeys.includes("OPENAI_API_KEY"), true);
    assert.equal(runPlan.samples[0].forwardedEnvKeys.includes("RUHROH_SAMPLE_ID"), true);
    assert.match(runPlan.samples[0].harborCommand.display, /OPENAI_API_KEY=\$\{OPENAI_API_KEY\}/u);
    assert.doesNotMatch(runPlanText, /super-secret/u);
    assert.doesNotMatch(runPlanText, new RegExp(agentTwoPath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("package Python runtime path resolves to bundled python directory", () => {
  assert.equal(resolveRuhrohPythonPath().endsWith(path.join("ruhroh", "python")), true);
  assert.equal(buildHarborSpawnEnv({ PYTHONPATH: "/existing" }).PYTHONPATH, `${resolveRuhrohPythonPath()}${path.delimiter}/existing`);
});

test("package Python Harbor agent imports from package runtime path", () => {
  const result = spawnSync("python3", ["-c", "from ruhroh.harbor_agent import RuhrohHarborAgent; print(RuhrohHarborAgent.name())"], {
    env: {
      ...process.env,
      PYTHONPATH: resolveRuhrohPythonPath(),
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout.trim(), "ruhroh-harbor");
});

test("package Python Harbor agent forwards command shell and calibration env into runtime env file", () => {
  const script = [
    "import json",
    "from ruhroh.harbor_agent import build_run_env_values",
    "env = build_run_env_values(7)",
    "print(json.dumps({key: env.get(key) for key in [",
    "  'RUHROH_MAX_ITERATIONS',",
    "  'RUHROH_RUN_MODE',",
    "  'RUHROH_RUN_AGENT_COMMAND_SHELL',",
    "  'RUHROH_EVAL_COMMAND_SHELL',",
    "  'RUHROH_EVAL_CALIBRATION_CASES_JSON',",
    "  'RUHROH_EVAL_PRIVATE_ASSETS_JSON',",
    "  'OPENAI_API_KEY',",
    "]}, sort_keys=True))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", script], {
    env: {
      ...process.env,
      PYTHONPATH: resolveRuhrohPythonPath(),
      RUHROH_RUN_MODE: "build",
      RUHROH_RUN_AGENT_COMMAND_SHELL: "1",
      RUHROH_EVAL_COMMAND_SHELL: "1",
      RUHROH_EVAL_CALIBRATION_CASES_JSON: "[{\"id\":\"case\"}]",
      RUHROH_EVAL_PRIVATE_ASSETS_JSON: "[\"/private/rubric.json\"]",
      OPENAI_API_KEY: "super-secret",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    OPENAI_API_KEY: null,
    RUHROH_EVAL_CALIBRATION_CASES_JSON: "[{\"id\":\"case\"}]",
    RUHROH_EVAL_COMMAND_SHELL: "1",
    RUHROH_EVAL_PRIVATE_ASSETS_JSON: "[\"/private/rubric.json\"]",
    RUHROH_MAX_ITERATIONS: "7",
    RUHROH_RUN_MODE: "build",
    RUHROH_RUN_AGENT_COMMAND_SHELL: "1",
  });
});

test("package Python runtime supports generic external command adapters", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-command-adapter-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const runRoot = path.join(tmp, "run");
    const installed = path.join(tmp, "installed");
    const command = path.join(tmp, "fake-kestrel.sh");
    const shellExpansionPath = path.join(tmp, "shell-expansion-ran");
    writeFileSync(command, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '{\"status\":\"goal_satisfied\"}\\n' > \"$RUHROH_RESULT_PATH\"",
      "printf '{\"status\":\"goal_satisfied\"}\\n'",
      "",
    ].join("\n"));
    chmodExecutable(command);
    const script = [
      "from pathlib import Path",
      "from ruhroh.loop_controller import build_run_agent_adapter",
      `adapter = build_run_agent_adapter(adapter_id='test-agent', scenario_id='scenario', workspace_root=Path(${JSON.stringify(workspace)}), installed_dir=Path(${JSON.stringify(installed)}), run_root=Path(${JSON.stringify(runRoot)}))`,
      "turn = adapter.run_turn(iteration=1, message='Build the app')",
      "completion = adapter.detect_completion(turn)",
      "manifest = adapter.collect_artifacts()",
      "print(completion['state'])",
      "print(manifest['adapterId'])",
      "print(manifest['continuityLevel'])",
    ].join("\n");

    mkdirSync(workspace, { recursive: true });
    const result = spawnSync("python3", ["-c", script], {
      env: {
        ...process.env,
        PYTHONPATH: resolveRuhrohPythonPath(),
        RUHROH_RUN_AGENT_COMMAND: `${command} ; touch ${shellExpansionPath}`,
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), ["done", "test-agent", "workspace_only"]);
    assert.equal(existsSync(shellExpansionPath), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("package Python runtime supports external eval command", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-eval-command-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const originalWorkspace = path.join(tmp, "original");
    const journeyPath = path.join(tmp, "journey.json");
    const evalInputPath = path.join(tmp, "eval-input.json");
    const evalOutputPath = path.join(tmp, "eval.json");
    const command = path.join(tmp, "fake-eval.sh");
    const shellExpansionPath = path.join(tmp, "eval-shell-expansion-ran");
    writeFileSync(command, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cat > \"$RUHROH_EVAL_OUTPUT_PATH\" <<'JSON'",
      "{\"version\":\"ruhroh_eval_result_v1\",\"status\":\"passed\",\"goalMet\":true,\"confidence\":\"high\",\"reasons\":[\"external eval passed\"],\"unmetCriteria\":[],\"evidenceRefs\":[],\"commandsRun\":[],\"artifacts\":{},\"finalSummary\":\"ok\",\"judgeVotes\":[{\"judge\":{\"kind\":\"model\",\"model\":\"eval-a\"},\"status\":\"passed\",\"confidence\":\"high\",\"rationale\":\"looks good\",\"evidenceRefs\":[]}]}",
      "JSON",
      "",
    ].join("\n"));
    chmodExecutable(command);
    const script = [
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_eval_agent",
      `result = run_eval_agent('scenario', Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(originalWorkspace)}), Path(${JSON.stringify(journeyPath)}), Path(${JSON.stringify(evalInputPath)}), Path(${JSON.stringify(evalOutputPath)}))`,
      "print(result['status'])",
      "print(Path(" + JSON.stringify(evalOutputPath) + ").exists())",
      "print(Path(" + JSON.stringify(evalInputPath) + ").exists())",
      "print(len(result['judgeVotes']))",
    ].join("\n");

    mkdirSync(workspace, { recursive: true });
    mkdirSync(originalWorkspace, { recursive: true });
    writeFileSync(journeyPath, "{}\n");
    const result = spawnSync("python3", ["-c", script], {
      env: {
        ...process.env,
        PYTHONPATH: resolveRuhrohPythonPath(),
        RUHROH_EVAL_COMMAND: `${command} ; touch ${shellExpansionPath}`,
        RUHROH_EVAL_GOAL_RUBRIC_JSON: "[\"The app works.\"]",
        RUHROH_EVAL_CALIBRATION_CASES_JSON: JSON.stringify([{
          id: "passing-delivery",
          inputSummary: "The final workspace runs locally and satisfies the requested workflow.",
          expectedStatus: "passed",
          rationale: "The evaluator should pass complete delivered work.",
        }]),
        RUHROH_EVAL_PRIVATE_ASSETS_JSON: JSON.stringify(["/tmp/private-rubric.json"]),
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), ["passed", "True", "True", "1"]);
    assert.equal(existsSync(shellExpansionPath), false);
    assert.match(readFileSync(evalInputPath, "utf8"), /The app works\./u);
    assert.match(readFileSync(evalInputPath, "utf8"), /passing-delivery/u);
    assert.match(readFileSync(evalInputPath, "utf8"), /private-rubric\.json/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("package Python runtime writes a run manifest without secret values", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-run-manifest-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const command = path.join(tmp, "fake-agent.sh");
    writeFileSync(command, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf 'done\\n' > \"$RUHROH_WORKSPACE_PATH/delivered.txt\"",
      "cat > \"$RUHROH_RESULT_PATH\" <<'JSON'",
      "{\"status\":\"goal_satisfied\",\"runId\":\"agent-run-1\",\"adapterVersion\":\"9.9.9\",\"model\":{\"provider\":\"adapter-provider\",\"model\":\"adapter-model\",\"version\":\"2026-07-07\",\"promptVersion\":\"adapter-prompt\"},\"usage\":{\"costUsd\":0.75,\"totalTokens\":777}}",
      "JSON",
      "printf '{\"status\":\"goal_satisfied\"}\\n'",
      "",
    ].join("\n"));
    chmodExecutable(command);
    const script = [
      "import json",
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build it', 'scenario', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      "manifest = result['runManifest']",
      "manifest_text = Path(result['artifactPaths']['runManifest']).read_text(encoding='utf-8')",
      "workspace_summary = json.loads(Path(result['artifactPaths']['workspaceSummary']).read_text(encoding='utf-8'))",
      "print(result['status'])",
      "print(result['$schema'])",
      "print(result['evalResult']['$schema'])",
      "print(Path(result['artifactPaths']['runManifest']).exists())",
      "print(manifest['$schema'])",
      "print(manifest['version'])",
      "print(manifest['scenario']['scenarioVersion'])",
      "print(manifest['scenario']['runMode'])",
      "print(manifest['runAgent']['adapterVersion'])",
      "print(manifest['runAgent']['model']['provider'])",
      "print(manifest['runAgent']['model']['model'])",
      "print(manifest['runAgent']['model']['promptVersion'])",
      "print(manifest['runAgent']['usage']['totalTokens'])",
      "print(manifest['sample']['id'])",
      "print(manifest['sample']['index'])",
      "print(manifest['sample']['count'])",
      "print(manifest['sample']['seed'])",
      "print(manifest['environment']['runIndex'])",
      "print(manifest['environment']['runCount'])",
      "print(manifest['environment']['fingerprint']['method'])",
      "print(manifest['environment']['fingerprint']['sha256'])",
      "print(manifest['environment']['fingerprint']['components']['pythonVersion'] == manifest['environment']['pythonVersion'])",
      "print(manifest['usage']['costUsd'])",
      "print(manifest['usage']['totalTokens'])",
      "print(manifest['runAgent']['command']['shellEnabled'])",
      "print(manifest['evaluator']['inputSummary']['scenarioContextCount'])",
      "print(manifest['evaluator']['inputSummary']['goalRubricCount'])",
      "print(manifest['evaluator']['inputSummary']['evidenceGuidanceCount'])",
      "print(manifest['evaluator']['inputSummary']['calibrationCaseCount'])",
      "print(manifest['evaluator']['inputSummary']['privateAssetCount'])",
      "print(manifest['evaluator']['inputSummary']['privateAssetPathHashes'][0])",
      "print('/tmp/private-rubric.json' in manifest_text)",
      "print('OPENAI_API_KEY' in manifest['env']['secretKeysPresent'])",
      "print('super-secret' in manifest_text)",
      "print(Path(result['artifactPaths']['workspaceSummary']).exists())",
      "print(workspace_summary['$schema'])",
      "print(workspace_summary['version'])",
      "print(workspace_summary['totalFiles'])",
      "print(workspace_summary['sampleFiles'][0]['path'])",
    ].join("\n");

    mkdirSync(workspace, { recursive: true });
    const result = spawnSync("python3", ["-c", script], {
      env: {
        ...process.env,
        PYTHONPATH: resolveRuhrohPythonPath(),
        RUHROH_RUN_AGENT_COMMAND: command,
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_RUN_AGENT_ADAPTER_VERSION: "0.1.0",
        RUHROH_RUN_MODE: "build",
        RUHROH_SCENARIO_METADATA_JSON: JSON.stringify({ scenarioVersion: "1.2.3", difficulty: "intro" }),
        RUHROH_EVAL_SCENARIO_CONTEXT_JSON: JSON.stringify(["Local app task.", "The user wants a working delivery."]),
        RUHROH_EVAL_GOAL_RUBRIC_JSON: JSON.stringify([
          "The delivered workspace implements the requested behavior.",
          "The app can be inspected locally.",
          "The output is not a prose-only response.",
        ]),
        RUHROH_EVAL_EVIDENCE_GUIDANCE_JSON: JSON.stringify(["Inspect the workspace.", "Use transcripts as supporting evidence."]),
        RUHROH_EVAL_CALIBRATION_CASES_JSON: JSON.stringify([{
          id: "passing-delivery",
          inputSummary: "The app is complete and locally inspectable.",
          expectedStatus: "passed",
          rationale: "Complete deliveries should pass.",
        }]),
        RUHROH_EVAL_PRIVATE_ASSETS_JSON: JSON.stringify(["/tmp/private-rubric.json"]),
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
          judge: { kind: "fixture", version: "1" },
        }),
        RUHROH_AGENT_PROVIDER: "example",
        RUHROH_AGENT_MODEL: "agent-model",
        RUHROH_SAMPLE_ID: "scenario/custom-shell/02-of-05",
        RUHROH_SAMPLE_SEED: "abc123def4567890",
        RUHROH_RUN_INDEX: "2",
        RUHROH_RUN_COUNT: "5",
        RUHROH_TOTAL_TOKENS: "42",
        OPENAI_API_KEY: "super-secret",
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = result.stdout.trim().split(/\r?\n/u);
    assert.equal(output[19], "sha256");
    assert.match(output[20] ?? "", /^[a-f0-9]{64}$/u);
    assert.equal(output[21], "True");
    assert.deepEqual(output, [
      "completed",
      "https://lumicorp.github.io/ruhroh/schemas/loop-result-v1.schema.json",
      "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
      "True",
      "https://lumicorp.github.io/ruhroh/schemas/run-manifest-v1.schema.json",
      "ruhroh_run_manifest_v1",
      "1.2.3",
      "build",
      "9.9.9",
      "adapter-provider",
      "adapter-model",
      "adapter-prompt",
      "777",
      "scenario/custom-shell/02-of-05",
      "2",
      "5",
      "abc123def4567890",
      "2",
      "5",
      "sha256",
      output[20],
      "True",
      "0.75",
      "777",
      "False",
      "2",
      "3",
      "2",
      "1",
      "1",
      sha256Text("/tmp/private-rubric.json"),
      "False",
      "True",
      "False",
      "True",
      "https://lumicorp.github.io/ruhroh/schemas/workspace-summary-v1.schema.json",
      "ruhroh_workspace_summary_v1",
      "1",
      "delivered.txt",
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("example fixture adapter and evaluator complete a credential-free run", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-fixture-example-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const adapter = path.resolve("examples", "adapters", "fixture-newsletter", "run.sh");
    const evaluator = path.resolve("examples", "evaluators", "fixture-newsletter", "run.sh");
    const script = [
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build me a simple newsletter page with three sample stories.', 'simple-newsletter', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      "print(result['status'])",
      "print(result['evalResult']['status'])",
      "print(Path(result['artifactPaths']['runManifest']).exists())",
      "print(Path(result['artifactPaths']['evalResult']).exists())",
    ].join("\n");

    const result = spawnSync("python3", ["-c", script], {
      env: {
        ...process.env,
        PYTHONPATH: resolveRuhrohPythonPath(),
        RUHROH_RUN_AGENT_COMMAND: adapter,
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_EVAL_COMMAND: evaluator,
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), ["completed", "passed", "True", "True"]);
    assert.match(readFileSync(path.join(workspace, "index.html"), "utf8"), /Fixture Newsletter/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public adapter example scripts pass shell syntax checks", () => {
  const scripts = [
    path.resolve("examples", "adapters", "fixture-newsletter", "run.sh"),
    path.resolve("examples", "adapters", "codex-cli", "run.sh"),
    path.resolve("examples", "adapters", "claude-code", "run.sh"),
    path.resolve("examples", "adapters", "gemini-cli", "run.sh"),
    path.resolve("examples", "evaluators", "fixture-newsletter", "run.sh"),
  ];

  for (const script of scripts) {
    const result = spawnSync("bash", ["-n", script], { encoding: "utf8" });
    assert.equal(result.status, 0, `${script}\n${result.stderr}`);
  }
});

test("public CLI parser supports generate subcommand defaults", () => {
  const options = parseRuhrohCliArgs(["generate", "--tier", "smoke"], "/repo");
  assert.equal(options.command, "generate");
  assert.equal(options.generateOnly, true);
  assert.equal(options.scenarioDir, path.join(resolveRuhrohPythonPath(), "..", "scenarios"));
  assert.equal(options.generatedDir, path.join("/repo", ".generated", "ruhroh"));
});

function chmodExecutable(filePath: string): void {
  spawnSync("chmod", ["+x", filePath], { stdio: "ignore" });
}
