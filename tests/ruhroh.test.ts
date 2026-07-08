import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adapterSatisfiesRequirements,
  assessRuhrohArtifactCompleteness,
  assessRuhrohEvalQuality,
  buildAgentEnvArgs,
  buildRuhrohPublishCheckReport,
  buildRuhrohRunResultsReport,
  buildRuhrohHarborCommand,
  deriveRuhrohVerdict,
  discoverRuhrohScenarios,
  discoverRuhrohSuites,
  aggregateRuhrohRuns,
  generateHarborDataset,
  generateHarborTask,
  getBuiltinRuhrohSuiteById,
  getBuiltinRuhrohSuitesByScenarioId,
  inspectRuhrohBenchmarkPack,
  loadRuhrohRunResultArtifacts,
  loadRuhrohRunResults,
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
  summarizeRuhrohScenarioCalibration,
  summarizeRuhrohBenchmarkClaim,
  summarizeRuhrohBenchmarkClaimReadiness,
  summarizeRuhrohPairwiseAdapterComparisons,
  summarizeRuhrohReviewQueue,
  summarizeRuhrohRun,
  summarizeRuhrohSuiteAdapters,
  loadRuhrohRerunLedger,
  validateRuhrohPublishBundle,
  validateRuhrohBenchmarkClaim,
  validateRuhrohRerunLedger,
  validateRuhrohScenario,
  validateRuhrohScenarioSource,
  validateRuhrohSuite,
  validateRuhrohSuiteSource,
  verifyRuhrohBenchmarkClaimSources,
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
      contaminationReview: "Original fixture with no known public benchmark solution.",
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

test("scenario calibration summary reports expected judgment coverage", () => {
  assert.deepEqual(summarizeRuhrohScenarioCalibration(scenario({
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
      calibrationCases: [
        {
          id: "clear-pass",
          inputSummary: "The app runs locally and all requested workflows are demonstrated.",
          expectedStatus: "passed",
          rationale: "The delivered behavior is complete and independently inspectable.",
        },
        {
          id: "ambiguous-review",
          inputSummary: "The app starts, but the transcript lacks evidence for one core workflow.",
          expectedStatus: "review",
          rationale: "The evaluator should escalate when evidence is incomplete.",
        },
      ],
    },
  })), {
    total: 2,
    byExpectedStatus: { passed: 1, failed: 0, review: 1 },
    coveredStatuses: ["passed", "review"],
    missingStatuses: ["failed"],
    warnings: ["evaluation.calibrationCases is missing failed expected judgment anchors"],
  });

  assert.deepEqual(summarizeRuhrohScenarioCalibration(scenario({
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
    },
  })).warnings, ["evaluation.calibrationCases has no expected judgment anchors"]);
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
  const claimIndexSchema = JSON.parse(readFileSync(path.resolve("schemas", "claim-index-v1.schema.json"), "utf8"));
  const evalCalibrationReportSchema = JSON.parse(readFileSync(path.resolve("schemas", "eval-calibration-report-v1.schema.json"), "utf8"));
  const evalResultSchema = JSON.parse(readFileSync(path.resolve("schemas", "eval-result-v1.schema.json"), "utf8"));
  const loopResultSchema = JSON.parse(readFileSync(path.resolve("schemas", "loop-result-v1.schema.json"), "utf8"));
  const publishBundleSchema = JSON.parse(readFileSync(path.resolve("schemas", "publish-bundle-v1.schema.json"), "utf8"));
  const publishCheckSchema = JSON.parse(readFileSync(path.resolve("schemas", "publish-check-v1.schema.json"), "utf8"));
  const runManifestSchema = JSON.parse(readFileSync(path.resolve("schemas", "run-manifest-v1.schema.json"), "utf8"));
  const runPlanSchema = JSON.parse(readFileSync(path.resolve("schemas", "run-plan-v1.schema.json"), "utf8"));
  const rerunLedgerSchema = JSON.parse(readFileSync(path.resolve("schemas", "rerun-ledger-v1.schema.json"), "utf8"));
  const scenarioSchema = JSON.parse(readFileSync(path.resolve("schemas", "scenario-v2.schema.json"), "utf8"));
  const suiteSchema = JSON.parse(readFileSync(path.resolve("schemas", "suite-v1.schema.json"), "utf8"));
  const workspaceSummarySchema = JSON.parse(readFileSync(path.resolve("schemas", "workspace-summary-v1.schema.json"), "utf8"));
  const exampleNewsletter = JSON.parse(readFileSync(path.resolve("examples", "scenarios", "simple-newsletter", "scenario.json"), "utf8"));
  const exampleGroceryPlanner = JSON.parse(readFileSync(path.resolve("examples", "scenarios", "grocery-budget-planner", "scenario.json"), "utf8"));
  const docsSampleNewsletter = JSON.parse(readFileSync(path.resolve("docs", "public", "samples", "ruhroh", "scenarios", "simple-newsletter", "scenario.json"), "utf8"));
  const docsSampleCalibrationReport = JSON.parse(readFileSync(path.resolve("docs", "public", "samples", ".generated", "ruhroh", "evaluator-calibration", "ruhroh-evaluator-calibration-report.json"), "utf8"));
  const docsSamplePublishCheck = JSON.parse(readFileSync(path.resolve("docs", "public", "samples", "publish-check.json"), "utf8"));
  const docsSamplePublishBundleManifest = JSON.parse(readFileSync(path.resolve("docs", "public", "samples", "ruhroh-publication", "manifest.json"), "utf8"));
  const docsSampleBundledPublishCheck = JSON.parse(readFileSync(path.resolve("docs", "public", "samples", "ruhroh-publication", "publish-check.json"), "utf8"));
  const exampleScenarioValidations = [
    validateRuhrohScenarioSource(path.resolve("examples", "scenarios", "simple-newsletter")),
    validateRuhrohScenarioSource(path.resolve("examples", "scenarios", "grocery-budget-planner")),
  ];
  const docsSampleNewsletterValidation = validateRuhrohScenarioSource(path.resolve("docs", "public", "samples", "ruhroh", "scenarios", "simple-newsletter"));
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
  assert.equal(shippedGlobs.includes("!docs/.vitepress/**"), true, "generated VitePress output must be excluded from the npm package");
  assert.equal(shippedGlobs.includes("!docs/public/**"), true, "generated public docs samples must be excluded from the npm package");

  assert.equal(packageJson.exports["./schemas/benchmark-claim-v1.schema.json"], "./schemas/benchmark-claim-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/benchmark-summary-v1.schema.json"], "./schemas/benchmark-summary-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/claim-index-v1.schema.json"], "./schemas/claim-index-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/eval-calibration-report-v1.schema.json"], "./schemas/eval-calibration-report-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/eval-result-v1.schema.json"], "./schemas/eval-result-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/loop-result-v1.schema.json"], "./schemas/loop-result-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/publish-bundle-v1.schema.json"], "./schemas/publish-bundle-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/publish-check-v1.schema.json"], "./schemas/publish-check-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/run-manifest-v1.schema.json"], "./schemas/run-manifest-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/run-plan-v1.schema.json"], "./schemas/run-plan-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/rerun-ledger-v1.schema.json"], "./schemas/rerun-ledger-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/scenario-v2.schema.json"], "./schemas/scenario-v2.schema.json");
  assert.equal(packageJson.exports["./schemas/suite-v1.schema.json"], "./schemas/suite-v1.schema.json");
  assert.equal(packageJson.exports["./schemas/workspace-summary-v1.schema.json"], "./schemas/workspace-summary-v1.schema.json");
  assert.equal(packageJson.bin.ruhroh, "./dist/cli.js");
  assert.equal(packageJson.description, "Realistic user-request benchmarks for coding agents");
  assert.equal(existsSync(path.resolve("examples", "adapters", "fixture-newsletter", "run.sh")), true);
  assert.equal(existsSync(path.resolve("examples", "adapters", "aider", "run.sh")), true);
  assert.equal(existsSync(path.resolve("examples", "adapters", "aider", "README.md")), true);
  assert.equal(existsSync(path.resolve("examples", "ci", "ruhroh-pack-registry.yml")), true);
  assert.equal(existsSync(path.resolve("examples", "ci", "ruhroh-claim-publication.yml")), true);
  assert.equal(existsSync(path.resolve("examples", "ci", "ruhroh-sharded-collection.yml")), true);
  const packRegistryWorkflow = readFileSync(path.resolve("examples", "ci", "ruhroh-pack-registry.yml"), "utf8");
  assert.match(packRegistryWorkflow, /pull-requests: write/u);
  assert.match(packRegistryWorkflow, /Write benchmark pack summary/u);
  assert.match(packRegistryWorkflow, /actions\/github-script@v7/u);
  assert.match(packRegistryWorkflow, /ruhroh-pack-inspection-summary\.md/u);
  assert.equal(existsSync(path.resolve("examples", "evaluators", "fixture-newsletter", "run.sh")), true);
  assert.equal(existsSync(path.resolve("suites", "ruhroh-smoke", "suite.json")), true);
  assert.equal(existsSync(path.resolve("docs", "benchmark-pack-tutorial.md")), true);
  assert.equal(existsSync(path.resolve("docs", "benchmark-methodology.md")), true);
  assert.equal(existsSync(path.resolve("docs", "contract-evolution.md")), true);
  assert.equal(claimSchema.properties.version.const, "ruhroh_benchmark_claim_v1");
  assert.equal(benchmarkSummarySchema.properties.version.const, "ruhroh_benchmark_summary_v1");
  assert.equal(claimIndexSchema.properties.version.const, "ruhroh_claim_index_v1");
  assert.equal(claimIndexSchema.properties.claims.items.$ref, "#/$defs/claimIndexEntry");
  assert.equal(evalCalibrationReportSchema.properties.version.const, "ruhroh_eval_calibration_report_v1");
  assert.equal(evalCalibrationReportSchema.properties.results.items.$ref, "#/$defs/calibrationCaseResult");
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
  assert.equal(rerunLedgerSchema.properties.version.const, "ruhroh_rerun_ledger_v1");
  assert.deepEqual(rerunLedgerSchema.$defs.ledgerEntry.properties.decision.enum, ["exclude", "rerun"]);
  assert.deepEqual(rerunLedgerSchema.$defs.ledgerEntry.properties.reasonKind.enum, ["infrastructure", "invalid_artifact", "operator_error", "other"]);
  assert.equal(evalResultSchema.properties.version.const, "ruhroh_eval_result_v1");
  assert.equal(evalResultSchema.required.includes("evidenceRefs"), true);
  assert.equal(loopResultSchema.properties.version.const, "ruhroh_loop_result_v1");
  assert.equal(loopResultSchema.required.includes("implementationRuns"), true);
  assert.equal(publishCheckSchema.properties.version.const, "ruhroh_publish_check_v1");
  assert.equal(publishCheckSchema.properties.compare.properties.version.const, "ruhroh_compare_v1");
  assert.equal(publishCheckSchema.properties.remediation.items.$ref, "#/$defs/remediation");
  assert.equal(publishBundleSchema.properties.version.const, "ruhroh_publish_bundle_v1");
  assert.deepEqual(publishBundleSchema.properties.source.required, ["resultsPath", "bundlePath"]);
  assert.equal(publishBundleSchema.properties.files.items.$ref, "#/$defs/bundleFile");
  assert.equal(runManifestSchema.properties.version.const, "ruhroh_run_manifest_v1");
  assert.equal(runManifestSchema.properties.environment.properties.fingerprint.$ref, "#/$defs/fingerprint");
  assert.equal(runManifestSchema.properties.runAgent.required.includes("adapterId"), true);
  assert.equal(runPlanSchema.properties.version.const, "ruhroh_run_plan_v1");
  assert.deepEqual(runPlanSchema.properties.selection.properties.shard.required, ["index", "total"]);
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
  for (const [index, exampleScenario] of [exampleNewsletter, exampleGroceryPlanner].entries()) {
    assert.equal(exampleScenario.version, "ruhroh_scenario_v2");
    assert.equal(exampleScenario.driver, undefined);
    assert.equal(exampleScenario.run.mode, "build");
    assert.equal(exampleScenario.metadata.visibility, "public");
    assert.deepEqual(exampleScenario.evaluation.calibrationCases.map((item: { expectedStatus: string }) => item.expectedStatus), ["passed", "failed", "review"]);
    assert.deepEqual(exampleScenarioValidations[index]?.calibration?.missingStatuses, []);
    assert.deepEqual(exampleScenarioValidations[index]?.calibration?.warnings, []);
  }
  assert.deepEqual(
    docsSampleNewsletter.evaluation.calibrationCases.map((item: { expectedStatus: string }) => item.expectedStatus),
    exampleNewsletter.evaluation.calibrationCases.map((item: { expectedStatus: string }) => item.expectedStatus),
  );
  assert.deepEqual(docsSampleNewsletterValidation.calibration?.missingStatuses, []);
  assert.deepEqual(docsSampleNewsletterValidation.calibration?.warnings, []);
  assert.equal(docsSampleCalibrationReport.version, "ruhroh_eval_calibration_report_v1");
  assert.equal(docsSampleCalibrationReport.caseCount, docsSampleNewsletter.evaluation.calibrationCases.length);
  assert.equal(docsSampleCalibrationReport.matchedCount, docsSampleNewsletter.evaluation.calibrationCases.length);
  assert.equal(docsSampleCalibrationReport.mismatchCount, 0);
  assert.equal(docsSamplePublishCheck.$schema, "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json");
  assert.equal(docsSamplePublishCheck.version, "ruhroh_publish_check_v1");
  assert.equal(docsSamplePublishCheck.compare.version, "ruhroh_compare_v1");
  assert.equal(Array.isArray(docsSamplePublishCheck.remediation) && docsSamplePublishCheck.remediation.length > 0, true);
  assert.equal(docsSamplePublishBundleManifest.$schema, "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json");
  assert.equal(docsSamplePublishBundleManifest.version, "ruhroh_publish_bundle_v1");
  assert.equal(docsSamplePublishBundleManifest.files.some((file: { role: string }) => file.role === "publish-check"), true);
  assert.equal(docsSampleBundledPublishCheck.$schema, "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json");
  assert.equal(docsSampleBundledPublishCheck.source.resultsPath, "sources/results");
  assert.deepEqual(
    docsSampleCalibrationReport.results.map((item: { expectedStatus: string; actualStatus: string; matched: boolean }) => ({
      expectedStatus: item.expectedStatus,
      actualStatus: item.actualStatus,
      matched: item.matched,
    })),
    docsSampleNewsletter.evaluation.calibrationCases.map((item: { expectedStatus: string }) => ({
      expectedStatus: item.expectedStatus,
      actualStatus: item.expectedStatus,
      matched: true,
    })),
  );
  for (const result of docsSampleCalibrationReport.results as Array<{ inputPath: string; outputPath: string; workspacePath: string }>) {
    assert.equal(existsSync(path.resolve("docs", "public", "samples", result.inputPath)), true);
    assert.equal(existsSync(path.resolve("docs", "public", "samples", result.outputPath)), true);
    assert.equal(existsSync(path.resolve("docs", "public", "samples", result.workspacePath, "CALIBRATION.md")), true);
  }
});

test("public API validates rerun ledger contracts", () => {
  const ledger = {
    version: "ruhroh_rerun_ledger_v1",
    entries: [
      {
        sampleId: "simple-newsletter/agent-a/2-of-2",
        decision: "exclude",
        reasonKind: "infrastructure",
        reason: "Worker VM was preempted before artifacts uploaded.",
        decidedBy: "ci",
        decidedAt: "2026-07-08T12:00:00.000Z",
      },
    ],
  };

  const validation = validateRuhrohRerunLedger(ledger);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.ledger?.entries[0]?.sampleId, "simple-newsletter/agent-a/2-of-2");

  const duplicateValidation = validateRuhrohRerunLedger({
    ...ledger,
    entries: [ledger.entries[0], ledger.entries[0]],
  });
  assert.equal(duplicateValidation.valid, false);
  assert.match(duplicateValidation.errors.join("\n"), /duplicate sampleId simple-newsletter\/agent-a\/2-of-2/u);

  const invalidReasonValidation = validateRuhrohRerunLedger({
    ...ledger,
    entries: [{ ...ledger.entries[0], reasonKind: "flaky_agent" }],
  });
  assert.equal(invalidReasonValidation.valid, false);
  assert.match(invalidReasonValidation.errors.join("\n"), /reasonKind must be infrastructure, invalid_artifact, operator_error, or other/u);

  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-rerun-ledger-api-"));
  try {
    const ledgerPath = path.join(tmp, "ruhroh-rerun-ledger.json");
    writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
    assert.equal(loadRuhrohRerunLedger(ledgerPath).entries.length, 1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
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
  assert.deepEqual(command.args.slice(0, 8), [
    "run",
    "--path",
    path.resolve("/repo", ".generated/ruhroh/harbor/tasks"),
    "--include-task-name",
    "example-scenario",
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
  assert.equal(command.args.includes("OPENROUTER_API_KEY=secret"), true);
  assert.equal(command.args.includes("RUHROH_RUN_AGENT_COMMAND_SHELL=1"), true);
  assert.equal(command.args.includes("RUHROH_EVAL_COMMAND_SHELL=1"), true);
  assert.equal(command.displayArgs.includes("OPENROUTER_API_KEY=${OPENROUTER_API_KEY}"), true);
  assert.equal(command.displayArgs.includes("RUHROH_RUN_AGENT_COMMAND_SHELL=${RUHROH_RUN_AGENT_COMMAND_SHELL}"), true);
  assert.equal(command.displayArgs.includes("RUHROH_EVAL_COMMAND_SHELL=${RUHROH_EVAL_COMMAND_SHELL}"), true);
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
    assert.deepEqual(result.calibration, {
      total: 0,
      byExpectedStatus: { passed: 0, failed: 0, review: 0 },
      coveredStatuses: [],
      missingStatuses: ["passed", "failed", "review"],
      warnings: ["evaluation.calibrationCases has no expected judgment anchors"],
    });
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

test("scenario source validation rejects private evaluator asset exposure", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-source-private-asset-exposure-"));
  try {
    const scenarioDir = path.join(tmp, "simple-newsletter");
    mkdirSync(path.join(scenarioDir, "assets", "public"), { recursive: true });
    mkdirSync(path.join(scenarioDir, "assets", "private"), { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Build a tiny newsletter page.\n");
    writeFileSync(path.join(scenarioDir, "assets", "public", "audience.txt"), "founders\n");
    writeFileSync(path.join(scenarioDir, "assets", "private", "expected.txt"), "held-out expectation\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "simple-newsletter",
      title: "Simple Newsletter",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      assets: ["assets"],
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
      loop: { defaultMaxIterations: 3, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task.", "The user wants a finished page."],
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
        privateAssets: ["assets/private/expected.txt"],
      },
    }));

    const result = validateRuhrohScenarioSource(scenarioDir);
    assert.match(result.errors.join("\n"), /evaluation\.privateAssets must not overlap public assets: assets\/private\/expected\.txt is exposed by assets entry assets/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("scenario source validation warns when changelog omits current scenario version", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-source-version-warning-"));
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
      metadata: {
        scenarioVersion: "1.2.0",
        changelog: ["1.1.0: Clarified rubric wording."],
      },
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

    const result = validateRuhrohScenarioSource(scenarioDir);
    assert.deepEqual(result.errors, []);
    assert.match(result.warnings.join("\n"), /metadata\.changelog should mention current scenarioVersion 1\.2\.0/u);
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

test("benchmark pack inspection summarizes scenarios, suites, validation, and calibration", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-pack-inspection-"));
  try {
    const scenarioRoot = path.join(tmp, "scenarios");
    const suiteRoot = path.join(tmp, "suites");
    mkdirSync(path.join(scenarioRoot, "simple-newsletter"), { recursive: true });
    mkdirSync(path.join(scenarioRoot, "simple-newsletter", "assets", "fixtures"), { recursive: true });
    mkdirSync(path.join(suiteRoot, "local-smoke"), { recursive: true });
    const publicAssetPath = path.join(scenarioRoot, "simple-newsletter", "assets", "fixtures", "audience.txt");
    const privateAssetPath = path.join(scenarioRoot, "simple-newsletter", "assets", "private-review-notes.txt");
    writeFileSync(publicAssetPath, "founders\noperators\n");
    writeFileSync(privateAssetPath, "private evaluator-only acceptance notes\n");
    writeFileSync(path.join(scenarioRoot, "simple-newsletter", "scenario.json"), JSON.stringify(scenario({
      id: "simple-newsletter",
      title: "Simple Newsletter",
      assets: ["assets/fixtures"],
      metadata: {
        scenarioVersion: "1.0.0",
        visibility: "public",
        difficulty: "intro",
        tags: ["smoke"],
        provenance: "Original test fixture.",
        createdAt: "2026-07-08",
        updatedAt: "2026-07-08",
        contaminationNotes: "No public canonical solution.",
        expectedRuntimeSeconds: 300,
        maintainers: ["ruhroh-maintainers"],
        changelog: ["1.0.0: Initial fixture."],
        lifecycle: { status: "active" },
      },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task.", "Fixture smoke path."],
        goalRubric: [
          "The app renders the requested newsletter signup workflow.",
          "The workflow includes visible confirmation after submission.",
          "The final workspace can run locally without network access.",
        ],
        evidenceGuidance: [
          "Inspect the final workspace files.",
          "Run the app or relevant tests when useful.",
        ],
        privateAssets: ["assets/private-review-notes.txt"],
      },
    })));
    writeFileSync(path.join(suiteRoot, "local-smoke", "suite.json"), JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["simple-newsletter"],
      scenarioVersions: { "simple-newsletter": "1.0.0" },
    })));

    const inspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot });
    assert.equal(inspection.version, "ruhroh_benchmark_pack_inspection_v1");
    assert.equal(inspection.requirements.requireFullCalibration, false);
    assert.equal(inspection.requirements.requireRiskReviewed, false);
    assert.equal(inspection.ready, true);
    assert.deepEqual(inspection.summary, {
      scenarioCount: 1,
      validScenarioCount: 1,
      invalidScenarioCount: 0,
      suiteCount: 1,
      validSuiteCount: 1,
      invalidSuiteCount: 0,
      calibrationWarningCount: 1,
      riskReviewWarningCount: 0,
      difficultyCounts: {
        intro: 1,
        standard: 0,
        hard: 0,
        expert: 0,
        unknown: 0,
      },
      runtimeEstimate: {
        knownScenarioCount: 1,
        unknownScenarioCount: 0,
        totalExpectedRuntimeSeconds: 300,
        minExpectedRuntimeSeconds: 300,
        maxExpectedRuntimeSeconds: 300,
      },
    });
    assert.equal(inspection.scenarios[0].id, "simple-newsletter");
    assert.equal(inspection.scenarios[0].scenarioVersion, "1.0.0");
    assert.equal(inspection.scenarios[0].expectedRuntimeSeconds, 300);
    assert.deepEqual(inspection.scenarios[0].tags, ["smoke"]);
    assert.equal(inspection.scenarios[0].riskReview.status, "documented");
    assert.deepEqual(inspection.scenarios[0].riskReview.warnings, []);
    assert.equal(inspection.scenarios[0].content.scenarioPath, path.join(scenarioRoot, "simple-newsletter", "scenario.json"));
    assert.match(inspection.scenarios[0].content.scenarioSha256 ?? "", /^[a-f0-9]{64}$/u);
    assert.equal(inspection.scenarios[0].content.promptPath, undefined);
    assert.deepEqual(inspection.scenarios[0].content.assetFingerprints.map((fingerprint) => ({
      path: fingerprint.path,
      status: fingerprint.status,
      kind: fingerprint.kind,
      fileCount: fingerprint.fileCount,
      sizeBytes: fingerprint.sizeBytes,
    })), [{
      path: "assets/fixtures",
      status: "ok",
      kind: "directory",
      fileCount: 1,
      sizeBytes: readFileSync(publicAssetPath).length,
    }]);
    assert.match(inspection.scenarios[0].content.assetFingerprints[0]?.sha256 ?? "", /^[a-f0-9]{64}$/u);
    assert.deepEqual(inspection.scenarios[0].content.privateAssetFingerprints.map((fingerprint) => ({
      path: fingerprint.path,
      status: fingerprint.status,
      kind: fingerprint.kind,
      fileCount: fingerprint.fileCount,
      sizeBytes: fingerprint.sizeBytes,
      sha256: fingerprint.sha256,
    })), [{
      path: "assets/private-review-notes.txt",
      status: "ok",
      kind: "file",
      fileCount: 1,
      sizeBytes: readFileSync(privateAssetPath).length,
      sha256: sha256File(privateAssetPath),
    }]);
    assert.equal(inspection.scenarios[0].calibration?.warnings[0], "evaluation.calibrationCases has no expected judgment anchors");
    assert.equal(inspection.suites[0].id, "local-smoke");
    assert.equal(inspection.suites[0].minRuns, 5);
    assert.deepEqual(inspection.suites[0].difficultyCounts, {
      intro: 1,
      standard: 0,
      hard: 0,
      expert: 0,
      unknown: 0,
    });
    assert.deepEqual(inspection.suites[0].runtimeEstimate, {
      knownScenarioCount: 1,
      unknownScenarioCount: 0,
      totalExpectedRuntimeSeconds: 300,
      minExpectedRuntimeSeconds: 300,
      maxExpectedRuntimeSeconds: 300,
    });
    assert.equal(inspection.suites[0].estimatedCollectionSeconds, 1500);
    assert.equal(inspection.suites[0].riskReview.status, "documented");
    assert.deepEqual(inspection.suites[0].riskReview.warnings, []);

    const strictInspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot, requireFullCalibration: true });
    assert.equal(strictInspection.requirements.requireFullCalibration, true);
    assert.equal(strictInspection.requirements.requireRiskReviewed, false);
    assert.equal(strictInspection.ready, false);
    assert.equal(strictInspection.blockers.some((blocker) => blocker.includes("calibration requirement failed")), true);
    assert.equal(strictInspection.blockers.some((blocker) => blocker.includes("add passed, failed, review anchor(s)")), true);

    const inspectJsonStdout: string[] = [];
    const inspectJsonCode = await runRuhrohCli(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites", "--json"], {
      spawn: (() => assert.fail("inspect-pack should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { inspectJsonStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const inspectJson = JSON.parse(inspectJsonStdout.join(""));
    assert.equal(inspectJsonCode, 0);
    assert.equal(inspectJson.version, "ruhroh_benchmark_pack_inspection_v1");
    assert.equal(inspectJson.ready, true);
    assert.equal(inspectJson.requirements.requireFullCalibration, false);
    assert.equal(inspectJson.requirements.requireRiskReviewed, false);
    assert.equal(inspectJson.summary.validScenarioCount, 1);
    assert.equal(inspectJson.summary.riskReviewWarningCount, 0);
    assert.equal(inspectJson.summary.difficultyCounts.intro, 1);
    assert.equal(inspectJson.summary.runtimeEstimate.totalExpectedRuntimeSeconds, 300);
    assert.equal(inspectJson.summary.runtimeEstimate.minExpectedRuntimeSeconds, 300);
    assert.equal(inspectJson.suites[0].difficultyCounts.intro, 1);
    assert.equal(inspectJson.suites[0].runtimeEstimate.totalExpectedRuntimeSeconds, 300);
    assert.equal(inspectJson.suites[0].estimatedCollectionSeconds, 1500);
    assert.equal(inspectJson.scenarios[0].riskReview.status, "documented");
    assert.equal(inspectJson.scenarios[0].expectedRuntimeSeconds, 300);
    assert.equal(inspectJson.scenarios[0].content.assetFingerprints[0].path, "assets/fixtures");
    assert.equal(inspectJson.scenarios[0].content.assetFingerprints[0].kind, "directory");
    assert.match(inspectJson.scenarios[0].content.assetFingerprints[0].sha256, /^[a-f0-9]{64}$/u);

    const strictJsonStdout: string[] = [];
    const strictJsonStderr: string[] = [];
    const strictJsonCode = await runRuhrohCli(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites", "--require-calibrated", "--json"], {
      spawn: (() => assert.fail("strict inspect-pack should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { strictJsonStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { strictJsonStderr.push(chunk); return true; } },
    });
    const strictJson = JSON.parse(strictJsonStdout.join(""));
    assert.equal(strictJsonCode, 1);
    assert.equal(strictJson.requirements.requireFullCalibration, true);
    assert.equal(strictJson.requirements.requireRiskReviewed, false);
    assert.equal(strictJson.ready, false);
    assert.equal(strictJson.blockers.some((blocker: string) => blocker.includes("calibration requirement failed")), true);
    assert.equal(strictJson.blockers.some((blocker: string) => blocker.includes("add passed, failed, review anchor(s)")), true);
    assert.match(strictJsonStderr.join(""), /inspect-pack failed readiness gate/u);

    writeFileSync(path.join(scenarioRoot, "simple-newsletter", "scenario.json"), JSON.stringify(scenario({
      id: "simple-newsletter",
      title: "Simple Newsletter",
      assets: ["assets/fixtures"],
      metadata: {
        scenarioVersion: "1.0.0",
        visibility: "public",
        difficulty: "intro",
        tags: ["smoke"],
        provenance: "Original test fixture.",
        createdAt: "2026-07-08",
        updatedAt: "2026-07-08",
        contaminationNotes: "No public canonical solution.",
        expectedRuntimeSeconds: 300,
        maintainers: ["ruhroh-maintainers"],
        changelog: ["1.0.0: Initial fixture."],
        lifecycle: { status: "active" },
      },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task.", "Fixture smoke path."],
        goalRubric: [
          "The app renders the requested newsletter signup workflow.",
          "The workflow includes visible confirmation after submission.",
          "The final workspace can run locally without network access.",
        ],
        evidenceGuidance: [
          "Inspect the final workspace files.",
          "Run the app or relevant tests when useful.",
        ],
        calibrationCases: [
          {
            id: "complete-newsletter-pass",
            inputSummary: "The workspace contains the requested newsletter page and a visible confirmation workflow.",
            expectedStatus: "passed",
            rationale: "Complete delivered work should pass.",
          },
          {
            id: "missing-workflow-failure",
            inputSummary: "The workspace only contains an unchanged starter page with no newsletter workflow.",
            expectedStatus: "failed",
            rationale: "Missing the core requested outcome should fail.",
          },
          {
            id: "unclear-run-path-review",
            inputSummary: "The workspace appears partially implemented, but the available artifacts do not show how to inspect or run it.",
            expectedStatus: "review",
            rationale: "Ambiguous evidence should be escalated rather than force-passed.",
          },
        ],
        privateAssets: ["assets/private-review-notes.txt"],
      },
    })));
    const calibratedStrictInspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot, requireFullCalibration: true });
    assert.equal(calibratedStrictInspection.ready, true);
    assert.deepEqual(calibratedStrictInspection.scenarios[0].calibration?.missingStatuses, []);
    assert.deepEqual(calibratedStrictInspection.scenarios[0].calibration?.warnings, []);

    const riskReviewedStrictInspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot, requireFullCalibration: true, requireRiskReviewed: true });
    assert.equal(riskReviewedStrictInspection.requirements.requireRiskReviewed, true);
    assert.equal(riskReviewedStrictInspection.ready, true);

    const inspectTextStdout: string[] = [];
    const inspectTextCode = await runRuhrohCli(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites"], {
      spawn: (() => assert.fail("text inspect-pack should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { inspectTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(inspectTextCode, 0);
    assert.match(inspectTextStdout.join(""), /Ruhroh benchmark pack inspection/u);
    assert.match(inspectTextStdout.join(""), /ready: yes/u);
    assert.match(inspectTextStdout.join(""), /requireRiskReviewed: no/u);
    assert.match(inspectTextStdout.join(""), /risk review warnings: 0/u);
    assert.match(inspectTextStdout.join(""), /difficulty mix: intro=1/u);
    assert.match(inspectTextStdout.join(""), /expected runtime: total=5m, range=5m-5m, known=1/u);
    assert.match(inspectTextStdout.join(""), /content fingerprints: 1 scenario manifests, 0 prompts, 1 public asset entries, 1 private asset entries/u);

    const inspectHtmlStdout: string[] = [];
    const inspectHtmlPath = path.join(tmp, "ruhroh-pack-inspection.html");
    const inspectHtmlCode = await runRuhrohCli(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites", "--html", "ruhroh-pack-inspection.html"], {
      spawn: (() => assert.fail("HTML inspect-pack should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { inspectHtmlStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const inspectHtml = readFileSync(inspectHtmlPath, "utf8");
    assert.equal(inspectHtmlCode, 0);
    assert.equal(existsSync(inspectHtmlPath), true);
    assert.match(inspectHtmlStdout.join(""), /Ruhroh benchmark pack inspection/u);
    assert.match(inspectHtml, /Ruhroh benchmark pack inspection/u);
    assert.match(inspectHtml, /Benchmark pack overview/u);
    assert.match(inspectHtml, /Risk review warnings/u);
    assert.match(inspectHtml, /Risk review gate/u);
    assert.match(inspectHtml, /Difficulty mix/u);
    assert.match(inspectHtml, /Expected runtime/u);
    assert.match(inspectHtml, /Collection estimate/u);
    assert.match(inspectHtml, /Content Fingerprints/u);
    assert.match(inspectHtml, /assets\/fixtures/u);

    writeFileSync(path.join(scenarioRoot, "simple-newsletter", "scenario.json"), JSON.stringify(scenario({
      id: "simple-newsletter",
      title: "Simple Newsletter",
      assets: ["assets/fixtures"],
      metadata: {
        scenarioVersion: "1.0.0",
        visibility: "public",
        difficulty: "intro",
        tags: ["smoke"],
        provenance: "Original test fixture.",
        createdAt: "2026-07-08",
        updatedAt: "2026-07-08",
        contaminationNotes: "TBD",
        expectedRuntimeSeconds: 300,
        maintainers: ["ruhroh-maintainers"],
        changelog: ["1.0.0: Initial fixture."],
        lifecycle: { status: "active" },
      },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task.", "Fixture smoke path."],
        goalRubric: [
          "The app renders the requested newsletter signup workflow.",
          "The workflow includes visible confirmation after submission.",
          "The final workspace can run locally without network access.",
        ],
        evidenceGuidance: [
          "Inspect the final workspace files.",
          "Run the app or relevant tests when useful.",
        ],
        privateAssets: ["assets/private-review-notes.txt"],
      },
    })));
    writeFileSync(path.join(suiteRoot, "local-smoke", "suite.json"), JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["simple-newsletter"],
      scenarioVersions: { "simple-newsletter": "1.0.0" },
      governance: {
        owner: "ruhroh-maintainers",
        createdAt: "2026-07-07",
        updatedAt: "2026-07-07",
        changelog: ["1.0.0: Initial suite."],
        acceptanceCriteria: ["Scenarios judge outcome behavior."],
        contaminationReview: "TBD",
        rewardHackingReview: "unknown",
        reviewChecklist: ["Confirm outcome behavior is judged."],
        deprecationPolicy: "Bump suiteVersion for membership changes.",
      },
    })));
    const weakRiskInspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot });
    assert.equal(weakRiskInspection.ready, true);
    assert.equal(weakRiskInspection.summary.riskReviewWarningCount, 3);
    assert.equal(weakRiskInspection.scenarios[0].riskReview.status, "needs_review");
    assert.equal(weakRiskInspection.suites[0].riskReview.status, "needs_review");
    assert.equal(weakRiskInspection.warnings.some((warning) => warning.includes("metadata.contaminationNotes")), true);
    assert.equal(weakRiskInspection.warnings.some((warning) => warning.includes("governance.contaminationReview")), true);
    assert.equal(weakRiskInspection.warnings.some((warning) => warning.includes("governance.rewardHackingReview")), true);

    const strictRiskInspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot, requireRiskReviewed: true });
    assert.equal(strictRiskInspection.requirements.requireRiskReviewed, true);
    assert.equal(strictRiskInspection.ready, false);
    assert.equal(strictRiskInspection.blockers.filter((blocker) => blocker.includes("risk review requirement failed")).length, 3);

    const strictRiskStdout: string[] = [];
    const strictRiskStderr: string[] = [];
    const strictRiskCode = await runRuhrohCli(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites", "--require-risk-reviewed", "--json"], {
      spawn: (() => assert.fail("strict risk inspect-pack should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { strictRiskStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { strictRiskStderr.push(chunk); return true; } },
    });
    const strictRiskJson = JSON.parse(strictRiskStdout.join(""));
    assert.equal(strictRiskCode, 1);
    assert.equal(strictRiskJson.requirements.requireRiskReviewed, true);
    assert.equal(strictRiskJson.blockers.some((blocker: string) => blocker.includes("metadata.contaminationNotes")), true);
    assert.match(strictRiskStderr.join(""), /inspect-pack failed readiness gate/u);

    writeFileSync(path.join(scenarioRoot, "simple-newsletter", "scenario.json"), JSON.stringify(scenario({
      id: "simple-newsletter",
      title: "Simple Newsletter",
      assets: ["assets/fixtures"],
      metadata: {
        scenarioVersion: "1.0.0",
        visibility: "public",
        difficulty: "intro",
        tags: ["smoke"],
        provenance: "Original test fixture.",
        createdAt: "2026-07-08",
        updatedAt: "2026-07-08",
        contaminationNotes: "No public canonical solution.",
        expectedRuntimeSeconds: 300,
        maintainers: ["ruhroh-maintainers"],
        changelog: ["1.0.0: Initial fixture."],
        lifecycle: { status: "active" },
      },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Local app creation task.", "Fixture smoke path."],
        goalRubric: [
          "The app renders the requested newsletter signup workflow.",
          "The workflow includes visible confirmation after submission.",
          "The final workspace can run locally without network access.",
        ],
        evidenceGuidance: [
          "Inspect the final workspace files.",
          "Run the app or relevant tests when useful.",
        ],
        privateAssets: ["assets/private-review-notes.txt"],
      },
    })));

    writeFileSync(path.join(suiteRoot, "local-smoke", "suite.json"), JSON.stringify(suite({
      id: "local-smoke",
      title: "Local Smoke",
      scenarioIds: ["missing-task"],
      scenarioVersions: { "missing-task": "1.0.0" },
    })));
    const blockedInspection = inspectRuhrohBenchmarkPack({ scenarioDir: scenarioRoot, suiteDir: suiteRoot });
    assert.equal(blockedInspection.ready, false);
    assert.equal(blockedInspection.summary.invalidSuiteCount, 1);
    assert.equal(blockedInspection.blockers.some((blocker) => blocker.includes("scenarioIds references unknown scenario: missing-task")), true);

    const blockedStderr: string[] = [];
    const blockedCode = await runRuhrohCli(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites", "--json"], {
      spawn: (() => assert.fail("blocked inspect-pack should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { blockedStderr.push(chunk); return true; } },
    });
    assert.equal(blockedCode, 1);
    assert.match(blockedStderr.join(""), /inspect-pack failed readiness gate/u);
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
    writeFileSync(path.join(scenarioDir, "assets", "draft-secret.txt"), "do not copy\n");
    writeFileSync(path.join(scenarioDir, "private", "expected.json"), "{\"requiredStories\":3}\n");

    const result = generateHarborTask({
      scenario: scenario({
        version: "ruhroh_scenario_v2",
        id: "grocery-budget-planner",
        title: "Grocery Budget Planner",
        assets: ["assets/budget.csv"],
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
    assert.match(taskToml, /network_mode = "no-network"/u);
    assert.equal(existsSync(path.join(result.taskDir, "environment", "Dockerfile")), true);
    assert.equal(existsSync(path.join(result.taskDir, "solution", "solve.sh")), true);
    assert.equal(readFileSync(path.join(result.taskDir, "assets", "budget.csv"), "utf8"), "category,amount\nfood,42\n");
    assert.equal(existsSync(path.join(result.taskDir, "assets", "draft-secret.txt")), false);
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

    const listAliasStdout: string[] = [];
    const listAliasCode = await runRuhrohCli(["list", "--scenario-dir", "ruhroh/scenarios"], {
      spawn: (() => assert.fail("list alias should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { listAliasStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(listAliasCode, 0);
    assert.match(listAliasStdout.join(""), /simple-newsletter\tsmoke\tSimple Newsletter/u);

    const listJsonStdout: string[] = [];
    const listJsonCode = await runRuhrohCli(["list", "--scenario-dir", "ruhroh/scenarios", "--json"], {
      spawn: (() => assert.fail("list JSON should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { listJsonStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const listJson = JSON.parse(listJsonStdout.join(""));
    assert.equal(listJsonCode, 0);
    assert.equal(listJson.version, "ruhroh_scenario_list_v1");
    assert.equal(listJson.source.scenarioDir, path.join(tmp, "ruhroh", "scenarios"));
    assert.equal(listJson.scenarios[0].id, "simple-newsletter");
    assert.equal(listJson.scenarios[0].tier, "smoke");
    assert.equal(listJson.scenarios[0].sourcePath, path.join("ruhroh", "scenarios", "simple-newsletter", "scenario.json"));

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

    const listAliasStdout: string[] = [];
    const listAliasCode = await runRuhrohCli(["list-suites", "--suite-dir", "ruhroh/suites"], {
      spawn: (() => assert.fail("list-suites alias should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { listAliasStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(listAliasCode, 0);
    assert.match(listAliasStdout.join(""), /local-smoke\t1\.0\.0\t1\tLocal Smoke/u);

    const listJsonStdout: string[] = [];
    const listJsonCode = await runRuhrohCli(["list-suites", "--suite-dir", "ruhroh/suites", "--json"], {
      spawn: (() => assert.fail("list-suites JSON should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { listJsonStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const listJson = JSON.parse(listJsonStdout.join(""));
    assert.equal(listJsonCode, 0);
    assert.equal(listJson.version, "ruhroh_suite_list_v1");
    assert.equal(listJson.suites[0].id, "local-smoke");
    assert.equal(listJson.suites[0].suiteVersion, "1.0.0");

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

    const planStdout: string[] = [];
    const planCode = await runRuhrohCli([
      "plan",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--suite-dir",
      "ruhroh/suites",
      "--suite",
      "local-smoke",
      "--adapter",
      "custom-shell",
      "--runs",
      "3",
      "--json",
    ], {
      spawn: (() => assert.fail("plan should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { planStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const plan = JSON.parse(planStdout.join(""));
    const planRunPlanPath = path.join(tmp, ".generated", "ruhroh", "ruhroh-run-plan.json");
    assert.equal(planCode, 0);
    assert.equal(plan.version, "ruhroh_plan_report_v1");
    assert.equal(plan.runPlanPath, planRunPlanPath);
    assert.equal(plan.sampleCount, 3);
    assert.deepEqual(plan.scenarios, ["simple-newsletter"]);
    assert.deepEqual(plan.adapters, ["custom-shell"]);
    assert.equal(plan.runPlan.sampleCount, 3);
    assert.equal(plan.runPlan.samples[0].sampleId, "simple-newsletter/custom-shell/1-of-3");
    assert.match(plan.runPlan.samples[0].sampleSeed, /^[a-f0-9]{16}$/u);
    assert.equal(existsSync(planRunPlanPath), true);

    const shardPlanStdout: string[] = [];
    const shardPlanCode = await runRuhrohCli([
      "plan",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--suite-dir",
      "ruhroh/suites",
      "--suite",
      "local-smoke",
      "--adapter",
      "custom-shell",
      "--runs",
      "5",
      "--shard",
      "2/2",
      "--json",
    ], {
      spawn: (() => assert.fail("sharded plan should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { shardPlanStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const shardPlan = JSON.parse(shardPlanStdout.join(""));
    assert.equal(shardPlanCode, 0);
    assert.equal(shardPlan.sampleCount, 2);
    assert.deepEqual(shardPlan.runPlan.selection.shard, { index: 2, total: 2 });
    assert.deepEqual(shardPlan.runPlan.samples.map((sample: { sampleId: string }) => sample.sampleId), [
      "simple-newsletter/custom-shell/2-of-5",
      "simple-newsletter/custom-shell/4-of-5",
    ]);
    assert.deepEqual(shardPlan.runPlan.samples.map((sample: { runIndex: number; runCount: number }) => [sample.runIndex, sample.runCount]), [[2, 5], [4, 5]]);

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
  const parsed = parseRuhrohCliArgs(["init", "benchmarks", "--adapter", "codex-cli", "--json"], "/tmp/project");
  assert.equal(parsed.command, "init");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "benchmarks"));
  assert.equal(parsed.adapter, "codex-cli");
  assert.equal(parsed.json, true);

  const templateParsed = parseRuhrohCliArgs(["init", "--template", "claude-code"], "/tmp/project");
  assert.equal(templateParsed.command, "init");
  assert.equal(templateParsed.adapterTemplate, "claude-code");
  assert.equal(templateParsed.templateExplicit, true);
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

test("public CLI parses run shards", () => {
  const parsed = parseRuhrohCliArgs(["plan", "--suite", "ruhroh-smoke", "--adapter", "custom-shell", "--runs", "10", "--shard", "3/4"], "/tmp/project");
  assert.deepEqual(parsed.shard, { index: 3, total: 4 });
  assert.throws(() => parseRuhrohCliArgs(["plan", "--suite", "ruhroh-smoke", "--adapter", "custom-shell", "--shard", "5/4"], "/tmp/project"), /index must be less than or equal to total/u);
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

test("public CLI parses plan command", () => {
  const parsed = parseRuhrohCliArgs(["plan", "--suite", "ruhroh-smoke", "--adapter", "custom-shell", "--runs", "5", "--json"], "/tmp/project");
  assert.equal(parsed.command, "plan");
  assert.equal(parsed.suiteId, "ruhroh-smoke");
  assert.deepEqual(parsed.adapters, ["custom-shell"]);
  assert.equal(parsed.runs, 5);
  assert.equal(parsed.json, true);
});

test("public CLI parses benchmark pack inspection command", () => {
  const parsed = parseRuhrohCliArgs(["inspect-pack", "--scenario-dir", "scenarios", "--suite-dir", "suites", "--require-calibrated", "--require-risk-reviewed", "--html", "pack.html", "--json"], "/tmp/project");
  assert.equal(parsed.command, "inspect-pack");
  assert.equal(parsed.scenarioDir, path.join("/tmp/project", "scenarios"));
  assert.equal(parsed.suiteDir, path.join("/tmp/project", "suites"));
  assert.equal(parsed.requireCalibrated, true);
  assert.equal(parsed.requireRiskReviewed, true);
  assert.equal(parsed.htmlPath, path.join("/tmp/project", "pack.html"));
  assert.equal(parsed.json, true);
});

test("public CLI parses compare publishability gate", () => {
  const parsed = parseRuhrohCliArgs(["compare", "results", "--require-publishable", "--benchmark-claim", "claim.json", "--benchmark-summary", "summary.json"], "/tmp/project");
  assert.equal(parsed.command, "compare");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "results"));
  assert.equal(parsed.requirePublishable, true);
  assert.equal(parsed.benchmarkClaimPath, path.join("/tmp/project", "claim.json"));
  assert.equal(parsed.benchmarkSummaryPath, path.join("/tmp/project", "summary.json"));
});

test("public CLI parses review queue command", () => {
  const parsed = parseRuhrohCliArgs(["review", "results", "--html", "review.html", "--json"], "/tmp/project");
  assert.equal(parsed.command, "review");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "results"));
  assert.equal(parsed.htmlPath, path.join("/tmp/project", "review.html"));
  assert.equal(parsed.json, true);
});

test("public CLI parses eval-quality command", () => {
  const parsed = parseRuhrohCliArgs(["eval-quality", "results", "--html", "eval-quality.html", "--json"], "/tmp/project");
  assert.equal(parsed.command, "eval-quality");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "results"));
  assert.equal(parsed.htmlPath, path.join("/tmp/project", "eval-quality.html"));
  assert.equal(parsed.json, true);
});

test("public CLI parses examples command", () => {
  const parsed = parseRuhrohCliArgs(["examples", "--json"], "/tmp/project");
  assert.equal(parsed.command, "examples");
  assert.equal(parsed.json, true);
});

test("public CLI parses adapter template scaffolding", () => {
  const parsed = parseRuhrohCliArgs(["new-adapter", "codex-local", "--template", "codex-cli", "--json"], "/tmp/project");
  assert.equal(parsed.command, "new-adapter");
  assert.equal(parsed.adapter, "codex-local");
  assert.equal(parsed.adapterTemplate, "codex-cli");
  assert.equal(parsed.json, true);
});

test("public CLI parses first-run onboarding command", () => {
  const parsed = parseRuhrohCliArgs(["first-run", "--json"], "/tmp/project");
  assert.equal(parsed.command, "first-run");
  assert.equal(parsed.json, true);
});

test("public CLI parses workflow guide command", () => {
  const parsed = parseRuhrohCliArgs(["workflow", "results", "--html", "workflow.html", "--json"], "/tmp/project");
  assert.equal(parsed.command, "workflow");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "results"));
  assert.equal(parsed.htmlPath, path.join("/tmp/project", "workflow.html"));
  assert.equal(parsed.json, true);
});

test("public CLI parses publish-check workflow", () => {
  const parsed = parseRuhrohCliArgs([
    "publish-check",
    "results",
    "--suite",
    "ruhroh-smoke",
    "--run-plan",
    ".generated/ruhroh/ruhroh-run-plan.json",
    "--rerun-ledger",
    "ruhroh-rerun-ledger.json",
    "--benchmark-claim",
    "claim.json",
    "--benchmark-summary",
    "summary.json",
    "--html",
    "compare.html",
    "--summary-md",
    "step-summary.md",
    "--bundle",
    "publication",
    "--verify-sources",
    "--json",
  ], "/tmp/project");
  assert.equal(parsed.command, "publish-check");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "results"));
  assert.equal(parsed.suiteId, "ruhroh-smoke");
  assert.equal(parsed.runPlanPath, path.join("/tmp/project", ".generated/ruhroh/ruhroh-run-plan.json"));
  assert.equal(parsed.rerunLedgerPath, path.join("/tmp/project", "ruhroh-rerun-ledger.json"));
  assert.equal(parsed.benchmarkClaimPath, path.join("/tmp/project", "claim.json"));
  assert.equal(parsed.benchmarkSummaryPath, path.join("/tmp/project", "summary.json"));
  assert.equal(parsed.htmlPath, path.join("/tmp/project", "compare.html"));
  assert.equal(parsed.summaryMarkdownPath, path.join("/tmp/project", "step-summary.md"));
  assert.equal(parsed.bundlePath, path.join("/tmp/project", "publication"));
  assert.equal(parsed.verifySources, true);
  assert.equal(parsed.json, true);
});

test("public CLI parses explain remediation command", () => {
  const parsed = parseRuhrohCliArgs(["explain", "run_plan_mismatch", "--json"], "/tmp/project");
  assert.equal(parsed.command, "explain");
  assert.equal(parsed.explainCode, "run_plan_mismatch");
  assert.equal(parsed.json, true);
});

test("public CLI parses new-evaluator command", () => {
  const parsed = parseRuhrohCliArgs(["new-evaluator", "local-evaluator", "--template", "hybrid", "--json"], "/tmp/project");
  assert.equal(parsed.command, "new-evaluator");
  assert.equal(parsed.evaluator, "local-evaluator");
  assert.equal(parsed.evaluatorTemplate, "hybrid");
  assert.equal(parsed.json, true);
});

test("public CLI parses evaluator calibration command", () => {
  const parsed = parseRuhrohCliArgs(["calibrate-evaluator", "--scenario", "calibration-demo", "--generated-dir", ".generated/calibration", "--json"], "/tmp/project");
  assert.equal(parsed.command, "calibrate-evaluator");
  assert.equal(parsed.scenarioId, "calibration-demo");
  assert.equal(parsed.generatedDir, path.join("/tmp/project", ".generated/calibration"));
  assert.equal(parsed.json, true);
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

test("public CLI parses publication bundle validation", () => {
  const parsed = parseRuhrohCliArgs(["validate-bundle", "publication", "--json"], "/tmp/project");
  assert.equal(parsed.command, "validate-bundle");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "publication"));
  assert.equal(parsed.json, true);
});

test("public CLI parses claim index command", () => {
  const parsed = parseRuhrohCliArgs(["claim-index", "claims", "--html", "claims.html", "--json"], "/tmp/project");
  assert.equal(parsed.command, "claim-index");
  assert.equal(parsed.inputPath, path.join("/tmp/project", "claims"));
  assert.equal(parsed.htmlPath, path.join("/tmp/project", "claims.html"));
  assert.equal(parsed.json, true);
});

test("public CLI lists bundled examples for adapter discovery", async () => {
  const jsonStdout: string[] = [];
  const jsonCode = await runRuhrohCli(["examples", "--json"], {
    spawn: (() => assert.fail("examples should not spawn Harbor")) as never,
    env: {},
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => { jsonStdout.push(chunk); return true; } },
    stderr: { write: () => true },
  });
  const catalog = JSON.parse(jsonStdout.join(""));
  assert.equal(jsonCode, 0);
  assert.equal(catalog.version, "ruhroh_examples_v1");
  assert.equal(catalog.adapters.some((item: { id: string; command: string }) => item.id === "codex-cli" && item.command === "examples/adapters/codex-cli/run.sh"), true);
  assert.equal(catalog.adapters.some((item: { id: string; command: string }) => item.id === "aider" && item.command === "examples/adapters/aider/run.sh"), true);
  assert.equal(catalog.adapters.some((item: { id: string; credentialFree: boolean }) => item.id === "fixture-newsletter" && item.credentialFree), true);
  assert.equal(catalog.evaluators.some((item: { id: string; credentialFree: boolean }) => item.id === "fixture-newsletter" && item.credentialFree), true);
  assert.equal(catalog.evaluatorTemplates.some((item: { template: string; command: string }) => item.template === "deterministic" && item.command.includes("new-evaluator")), true);
  assert.equal(catalog.evaluatorTemplates.some((item: { template: string; nextCommand: string }) => item.template === "hybrid" && item.nextCommand.includes("calibrate-evaluator")), true);
  assert.equal(catalog.scenarios.some((item: { id: string }) => item.id === "simple-newsletter"), true);
  assert.equal(existsSync(catalog.adapters.find((item: { id: string }) => item.id === "codex-cli").docs), true);
  assert.equal(existsSync(catalog.adapters.find((item: { id: string }) => item.id === "aider").docs), true);

  const textStdout: string[] = [];
  const textCode = await runRuhrohCli(["examples"], {
    spawn: (() => assert.fail("text examples should not spawn Harbor")) as never,
    env: {},
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => { textStdout.push(chunk); return true; } },
    stderr: { write: () => true },
  });
  const text = textStdout.join("");
  assert.equal(textCode, 0);
  assert.match(text, /Ruhroh examples/u);
  assert.match(text, /fixture-newsletter/u);
  assert.match(text, /Evaluator templates:/u);
  assert.match(text, /local-deterministic --template deterministic/u);
  assert.match(text, /calibrate-evaluator/u);
  assert.match(text, /Live agent wrapper pattern:/u);
  assert.match(text, /RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line/u);
});

test("public CLI explains publish-check remediation codes", async () => {
  const jsonStdout: string[] = [];
  const jsonCode = await runRuhrohCli(["explain", "run_plan_mismatch", "--json"], {
    spawn: (() => assert.fail("explain should not spawn Harbor")) as never,
    env: {},
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => { jsonStdout.push(chunk); return true; } },
    stderr: { write: () => true },
  });
  const report = JSON.parse(jsonStdout.join(""));
  assert.equal(jsonCode, 0);
  assert.equal(report.version, "ruhroh_explain_v1");
  assert.equal(report.code, "run_plan_mismatch");
  assert.equal(report.remediation.length, 1);
  assert.equal(report.remediation[0].code, "run_plan_mismatch");
  assert.equal(report.remediation[0].category, "run_plan");
  assert.match(report.remediation[0].action, /run plan/u);
  assert.match(report.remediation[0].docs, /publish-claims/u);

  const textStdout: string[] = [];
  const textCode = await runRuhrohCli(["explain"], {
    spawn: (() => assert.fail("text explain should not spawn Harbor")) as never,
    env: {},
    cwd: process.cwd(),
    stdout: { write: (chunk: string) => { textStdout.push(chunk); return true; } },
    stderr: { write: () => true },
  });
  const text = textStdout.join("");
  assert.equal(textCode, 0);
  assert.match(text, /Ruhroh publish-check remediation codes/u);
  assert.match(text, /suite_required/u);
  assert.match(text, /run_plan_mismatch/u);
  assert.match(text, /example blocker:/u);

  const unknownStderr: string[] = [];
  const unknownCode = await runRuhrohCli(["explain", "not_a_code"], {
    spawn: (() => assert.fail("unknown explain should not spawn Harbor")) as never,
    env: {},
    cwd: process.cwd(),
    stdout: { write: () => true },
    stderr: { write: (chunk: string) => { unknownStderr.push(chunk); return true; } },
  });
  assert.equal(unknownCode, 1);
  assert.match(unknownStderr.join(""), /Unknown remediation code: not_a_code/u);
  assert.match(unknownStderr.join(""), /run_plan_mismatch/u);
});

test("public CLI checks first-run fixture readiness", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-first-run-"));
  const harborOk = (() => ({ status: 0, error: undefined, stdout: "", stderr: "" })) as never;
  try {
    const missingStdout: string[] = [];
    const missingCode = await runRuhrohCli(["first-run", "--json"], {
      spawn: harborOk,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { missingStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const missing = JSON.parse(missingStdout.join(""));
    assert.equal(missingCode, 1);
    assert.equal(missing.version, "ruhroh_first_run_check_v1");
    assert.equal(missing.ready, false);
    assert.equal(missing.dryRunReady, false);
    assert.equal(missing.fullRunReady, false);
    assert.equal(missing.nextAction.stageId, "first_fixture_loop");
    assert.equal(missing.nextAction.command, "pnpm exec ruhroh init");
    assert.match(missing.nextAction.summary, /Fix local-starter/u);
    assert.equal(missing.checks.some((check: { name: string; status: string }) => check.name === "local-starter" && check.status === "failed"), true);
    assert.equal(missing.checks.some((check: { name: string; status: string }) => check.name === "adapter-env" && check.status === "failed"), true);
    assert.deepEqual(missing.nextCommands, ["pnpm exec ruhroh init", "pnpm exec ruhroh first-run"]);

    const initCode = await runRuhrohCli(["init"], {
      spawn: (() => assert.fail("init should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: () => true },
    });
    assert.equal(initCode, 0);

    const adapterCommand = path.join(tmp, "ruhroh", "adapters", "fixture-newsletter", "run.sh");
    const evaluatorCommand = path.join(tmp, "ruhroh", "evaluators", "fixture-newsletter", "run.sh");
    const envMissingStdout: string[] = [];
    const envMissingCode = await runRuhrohCli(["first-run", "--json"], {
      spawn: harborOk,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { envMissingStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const envMissing = JSON.parse(envMissingStdout.join(""));
    assert.equal(envMissingCode, 1);
    assert.equal(envMissing.nextAction.command, "export RUHROH_RUN_AGENT_COMMAND=\"$PWD/ruhroh/adapters/fixture-newsletter/run.sh\"");
    assert.deepEqual(envMissing.nextCommands, [
      "export RUHROH_RUN_AGENT_COMMAND=\"$PWD/ruhroh/adapters/fixture-newsletter/run.sh\"",
      "export RUHROH_EVAL_COMMAND=\"$PWD/ruhroh/evaluators/fixture-newsletter/run.sh\"",
      "pnpm exec ruhroh first-run",
    ]);

    const readyStdout: string[] = [];
    const readyCode = await runRuhrohCli(["first-run", "--json"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { readyStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const ready = JSON.parse(readyStdout.join(""));
    assert.equal(readyCode, 0);
    assert.equal(ready.ready, true);
    assert.equal(ready.dryRunReady, true);
    assert.equal(ready.fullRunReady, true);
    assert.equal(ready.mode, "local_fixture");
    assert.equal(ready.scenarioId, "simple-newsletter");
    assert.equal(ready.suiteId, "ruhroh-smoke");
    assert.equal(ready.nextAction.stageId, "first_fixture_loop");
    assert.match(ready.nextAction.command, /--adapter custom-shell/u);
    assert.match(ready.nextAction.summary, /credential-free fixture loop/u);
    assert.equal(ready.checks.every((check: { status: string }) => check.status === "ok"), true);
    assert.equal(ready.nextCommands.some((command: string) => command.includes("--dry-run")), true);
    assert.equal(ready.nextCommands.some((command: string) => command.endsWith("--adapter custom-shell")), true);

    const textStdout: string[] = [];
    const textCode = await runRuhrohCli(["first-run"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { textStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(textCode, 0);
    assert.match(textStdout.join(""), /Ruhroh first-run: ready/u);
    assert.match(textStdout.join(""), /dry-run ready: yes/u);
    assert.match(textStdout.join(""), /full-run ready: yes/u);
    assert.match(textStdout.join(""), /next action: Run the credential-free fixture loop/u);
    assert.match(textStdout.join(""), /command: pnpm exec ruhroh run --scenario-dir ruhroh\/scenarios/u);
    assert.match(textStdout.join(""), /next commands:/u);

    const harborMissing = (() => ({ status: 1, error: undefined, stdout: "", stderr: "harbor missing" })) as never;
    const dryRunOnlyStdout: string[] = [];
    const dryRunOnlyCode = await runRuhrohCli(["first-run", "--json"], {
      spawn: harborMissing,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { dryRunOnlyStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const dryRunOnly = JSON.parse(dryRunOnlyStdout.join(""));
    assert.equal(dryRunOnlyCode, 1);
    assert.equal(dryRunOnly.ready, false);
    assert.equal(dryRunOnly.dryRunReady, true);
    assert.equal(dryRunOnly.fullRunReady, false);
    assert.equal(dryRunOnly.checks.some((check: { name: string; status: string }) => check.name === "harbor" && check.status === "failed"), true);
    assert.match(dryRunOnly.nextAction.summary, /dry-run now/u);
    assert.match(dryRunOnly.nextAction.command, /--dry-run/u);

    const dryRunAllowedStdout: string[] = [];
    const dryRunAllowedCode = await runRuhrohCli(["first-run", "--allow-dry-run", "--json"], {
      spawn: harborMissing,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { dryRunAllowedStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const dryRunAllowed = JSON.parse(dryRunAllowedStdout.join(""));
    assert.equal(dryRunAllowedCode, 0);
    assert.equal(dryRunAllowed.ready, false);
    assert.equal(dryRunAllowed.dryRunReady, true);
    assert.equal(dryRunAllowed.fullRunReady, false);
    assert.match(dryRunAllowed.nextAction.command, /--dry-run/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI guides the end-to-end workflow", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-workflow-"));
  const harborOk = (() => ({ status: 0, error: undefined, stdout: "", stderr: "" })) as never;
  try {
    const missingStdout: string[] = [];
    const missingCode = await runRuhrohCli(["workflow", "--json"], {
      spawn: harborOk,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { missingStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const missing = JSON.parse(missingStdout.join(""));
    assert.equal(missingCode, 0);
    assert.equal(missing.version, "ruhroh_workflow_guide_v1");
    assert.equal(missing.currentStage, "first_fixture_loop");
    assert.equal(missing.nextAction.stageId, "first_fixture_loop");
    assert.equal(missing.nextAction.command, "pnpm exec ruhroh init");
    assert.match(missing.nextAction.summary, /First local fixture loop/u);
    assert.equal(missing.stages.length, 7);
    assert.equal(missing.stages[0].id, "first_fixture_loop");
    assert.equal(missing.stages[0].status, "needs_action");
    assert.equal(missing.stages[0].commands[0], "pnpm exec ruhroh init");
    assert.equal(missing.stages.some((stage: { id: string; commands: string[] }) => stage.id === "pack_preflight" && stage.commands[0].includes("inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --require-calibrated --require-risk-reviewed")), true);
    assert.equal(missing.stages.some((stage: { id: string; commands: string[] }) => stage.id === "compare_results" && stage.commands.some((command) => command.includes("compare results --suite-dir ruhroh/suites --suite ruhroh-smoke"))), true);
    assert.equal(missing.stages.some((stage: { id: string; commands: string[] }) => stage.id === "publish_claim" && stage.commands.some((command) => command.includes("publish-check results --suite-dir ruhroh/suites --suite ruhroh-smoke"))), true);
    assert.equal(missing.stages.find((stage: { id: string }) => stage.id === "publish_claim").checks.some((check: { name: string; status: string }) => check.name === "registry-index" && check.status === "warning"), true);
    assert.equal(missing.stages.find((stage: { id: string }) => stage.id === "publish_claim").commands.includes("pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json"), true);

    const initCode = await runRuhrohCli(["init"], {
      spawn: (() => assert.fail("init should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: () => true },
    });
    assert.equal(initCode, 0);

    const adapterCommand = path.join(tmp, "ruhroh", "adapters", "fixture-newsletter", "run.sh");
    const evaluatorCommand = path.join(tmp, "ruhroh", "evaluators", "fixture-newsletter", "run.sh");
    const readyStdout: string[] = [];
    const readyCode = await runRuhrohCli(["workflow", "--json"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { readyStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const ready = JSON.parse(readyStdout.join(""));
    assert.equal(readyCode, 0);
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "first_fixture_loop").status, "needs_action");
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "first_fixture_loop").checks.some((check: { name: string; status: string }) => check.name === "fixture-result" && check.status === "failed"), true);
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "author_benchmark").status, "ready");
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "evaluator_quality").checks.some((check: { name: string; status: string }) => check.name === "calibration-report" && check.status === "failed"), true);
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "pack_preflight").commands[0].includes("--require-calibrated --require-risk-reviewed"), true);
    assert.equal(ready.docs.includes("benchmark-pack-registry"), true);
    assert.equal(ready.currentStage, "first_fixture_loop");
    assert.equal(ready.nextAction.stageId, "first_fixture_loop");
    assert.match(ready.nextAction.command, /ruhroh run/u);
    assert.doesNotMatch(ready.nextAction.command, /--dry-run/u);
    assert.match(ready.nextAction.summary, /No ruhroh-loop-result\.json artifact was found/u);
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "compare_results").commands[0].includes("--suite-dir ruhroh/suites --suite ruhroh-smoke"), true);
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "publish_claim").commands[0].includes("--suite-dir ruhroh/suites --suite ruhroh-smoke"), true);
    assert.equal(ready.stages.find((stage: { id: string }) => stage.id === "publish_claim").commands.includes("pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json"), true);
    assert.equal(ready.docs.includes("publish-claims"), true);
    assert.equal(ready.docs.includes("claim-registry"), true);

    const fixtureResultDir = path.join(tmp, "results", "run-one");
    mkdirSync(fixtureResultDir, { recursive: true });
    writeFileSync(path.join(fixtureResultDir, "ruhroh-loop-result.json"), `${JSON.stringify(loopResultFixture({ scenarioId: "simple-newsletter", task_id: "simple-newsletter" }), null, 2)}\n`);
    const completedFirstLoopStdout: string[] = [];
    const completedFirstLoopCode = await runRuhrohCli(["workflow", "--json"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { completedFirstLoopStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const completedFirstLoop = JSON.parse(completedFirstLoopStdout.join(""));
    assert.equal(completedFirstLoopCode, 0);
    assert.equal(completedFirstLoop.stages.find((stage: { id: string }) => stage.id === "first_fixture_loop").status, "ready");
    assert.equal(completedFirstLoop.stages.find((stage: { id: string }) => stage.id === "first_fixture_loop").checks.some((check: { name: string; status: string }) => check.name === "fixture-result" && check.status === "ok"), true);
    assert.equal(completedFirstLoop.stages.find((stage: { id: string }) => stage.id === "first_fixture_loop").commands.some((command: string) => command.includes("ruhroh report results/run-one/ruhroh-loop-result.json")), true);
    assert.equal(completedFirstLoop.currentStage, "evaluator_quality");
    assert.equal(completedFirstLoop.nextAction.stageId, "evaluator_quality");
    assert.match(completedFirstLoop.nextAction.command, /calibrate-evaluator/u);
    assert.match(completedFirstLoop.nextAction.summary, /No preserved evaluator calibration report was found/u);

    const calibrationReportPath = path.join(tmp, ".generated", "ruhroh", "evaluator-calibration", "ruhroh-evaluator-calibration-report.json");
    mkdirSync(path.dirname(calibrationReportPath), { recursive: true });
    writeFileSync(calibrationReportPath, JSON.stringify({
      version: "ruhroh_eval_calibration_report_v1",
      ok: true,
      caseCount: 1,
      mismatchCount: 0,
      infraFailedCount: 0,
    }, null, 2));
    const calibratedWorkflowStdout: string[] = [];
    const calibratedWorkflowCode = await runRuhrohCli(["workflow", "--json"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { calibratedWorkflowStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const calibratedWorkflow = JSON.parse(calibratedWorkflowStdout.join(""));
    assert.equal(calibratedWorkflowCode, 0);
    assert.equal(calibratedWorkflow.stages.find((stage: { id: string }) => stage.id === "evaluator_quality").checks.some((check: { name: string; status: string; details: string }) => check.name === "calibration-report" && check.status === "ok" && /passed 1 case/.test(check.details)), true);
    assert.equal(calibratedWorkflow.stages.find((stage: { id: string }) => stage.id === "pack_preflight").checks.some((check: { name: string; status: string; details: string }) => check.name === "strict-pack-inspection" && check.status === "ok" && /calibration and risk-review gates satisfied/.test(check.details)), true);
    assert.equal(calibratedWorkflow.currentStage, "plan_runs");
    assert.equal(calibratedWorkflow.nextAction.stageId, "plan_runs");
    assert.match(calibratedWorkflow.nextAction.command, /ruhroh plan/u);
    assert.match(calibratedWorkflow.nextAction.summary, /Plan repeated agent runs/u);

    const harborMissing = (() => ({ status: 1, error: undefined, stdout: "", stderr: "harbor missing" })) as never;
    const dryRunOnlyWorkflowStdout: string[] = [];
    const dryRunOnlyWorkflowCode = await runRuhrohCli(["workflow", "empty-results", "--json"], {
      spawn: harborMissing,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { dryRunOnlyWorkflowStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const dryRunOnlyWorkflow = JSON.parse(dryRunOnlyWorkflowStdout.join(""));
    assert.equal(dryRunOnlyWorkflowCode, 0);
    assert.equal(dryRunOnlyWorkflow.currentStage, "first_fixture_loop");
    assert.match(dryRunOnlyWorkflow.nextAction.summary, /dry-run now/u);
    assert.match(dryRunOnlyWorkflow.nextAction.command, /--dry-run/u);
    assert.match(dryRunOnlyWorkflow.stages[0].commands[0], /--dry-run/u);

    const customPathWorkflowStdout: string[] = [];
    const customPathWorkflowCode = await runRuhrohCli(["workflow", "custom-results", "--run-plan", "custom-plan.json", "--json"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { customPathWorkflowStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const customPathWorkflow = JSON.parse(customPathWorkflowStdout.join(""));
    assert.equal(customPathWorkflowCode, 0);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "compare_results").commands[0].includes("compare custom-results"), true);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "compare_results").commands[0].includes("--run-plan custom-plan.json"), true);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "compare_results").commands.some((command: string) => command.includes("review custom-results")), true);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "compare_results").commands.some((command: string) => command.includes("eval-quality custom-results")), true);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "publish_claim").commands[0].includes("publish-check custom-results"), true);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "publish_claim").commands[0].includes("--run-plan custom-plan.json"), true);
    assert.equal(customPathWorkflow.stages.find((stage: { id: string }) => stage.id === "publish_claim").commands.includes("pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json"), true);

    const sampleRoot = path.join(tmp, "docs", "public", "samples");
    const sampleResultsPath = path.join(sampleRoot, "sample-results");
    const sampleRunDir = path.join(sampleResultsPath, "run-one");
    const sampleRunPlanPath = path.join(sampleRoot, "ruhroh-run-plan.json");
    mkdirSync(sampleRunDir, { recursive: true });
    mkdirSync(path.join(sampleRoot, "ruhroh-publication"), { recursive: true });
    writeFileSync(path.join(sampleRunDir, "ruhroh-loop-result.json"), `${JSON.stringify(loopResultFixture({ scenarioId: "simple-newsletter", task_id: "simple-newsletter" }), null, 2)}\n`);
    writeFileSync(sampleRunPlanPath, "{\"version\":\"ruhroh_run_plan_v1\"}\n");
    writeFileSync(path.join(sampleRoot, "ruhroh-publication", "manifest.json"), "{\"version\":\"ruhroh_publish_bundle_manifest_v1\"}\n");
    writeFileSync(path.join(sampleRoot, "claim-index.json"), "{\"version\":\"ruhroh_claim_index_v1\"}\n");

    const nestedWorkflowStdout: string[] = [];
    const nestedWorkflowCode = await runRuhrohCli(["workflow", sampleResultsPath, "--run-plan", sampleRunPlanPath, "--json"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { nestedWorkflowStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const nestedWorkflow = JSON.parse(nestedWorkflowStdout.join(""));
    const nestedPublishStage = nestedWorkflow.stages.find((stage: { id: string }) => stage.id === "publish_claim");
    assert.equal(nestedWorkflowCode, 0);
    assert.equal(nestedPublishStage.checks.some((check: { name: string; status: string; details: string }) => check.name === "claim-or-bundle" && check.status === "ok" && check.details === "publication bundle manifest exists"), true);
    assert.equal(nestedPublishStage.checks.some((check: { name: string; status: string; details: string }) => check.name === "bundle-validation" && check.status === "failed" && check.details.includes("Publication bundle validation failed")), true);
    assert.equal(nestedPublishStage.checks.some((check: { name: string; status: string; details: string }) => check.name === "registry-index" && check.status === "failed" && check.details.includes("registryReady is false")), true);
    assert.equal(nestedPublishStage.commands[0].includes("--bundle docs/public/samples/ruhroh-publication"), true);
    assert.equal(nestedPublishStage.commands.includes("pnpm exec ruhroh claim-index docs/public/samples/ruhroh-publication --html docs/public/samples/ruhroh-claims.html --json > docs/public/samples/claim-index.json"), true);

    const nestedWorkflowHtmlPath = path.join(sampleRoot, "ruhroh-workflow.html");
    const nestedWorkflowHtmlCode = await runRuhrohCli(["workflow", sampleResultsPath, "--run-plan", sampleRunPlanPath, "--html", nestedWorkflowHtmlPath], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: () => true },
    });
    const nestedWorkflowHtml = readFileSync(nestedWorkflowHtmlPath, "utf8");
    assert.equal(nestedWorkflowHtmlCode, 0);
    assert.match(nestedWorkflowHtml, /<strong>Next action<\/strong><span class="fail">Publish an audit-ready claim<\/span>/u);
    assert.match(nestedWorkflowHtml, /Publication bundle validation failed/u);
    assert.equal(nestedWorkflowHtml.includes(tmp), false);

    const htmlStdout: string[] = [];
    const workflowHtmlPath = path.join(tmp, "ruhroh-workflow.html");
    const htmlCode = await runRuhrohCli(["workflow", "custom-results", "--run-plan", "custom-plan.json", "--html", workflowHtmlPath], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { htmlStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const workflowHtml = readFileSync(workflowHtmlPath, "utf8");
    assert.equal(htmlCode, 0);
    assert.match(htmlStdout.join(""), /Wrote Ruhroh workflow HTML guide/u);
    assert.match(workflowHtml, /Ruhroh workflow guide/u);
    assert.match(workflowHtml, /Next Action/u);
    assert.match(workflowHtml, /publish-check custom-results/u);
    assert.match(workflowHtml, /Compare agents with evidence/u);

    const textStdout: string[] = [];
    const textCode = await runRuhrohCli(["workflow"], {
      spawn: harborOk,
      env: {
        RUHROH_RUN_AGENT_COMMAND: adapterCommand,
        RUHROH_EVAL_COMMAND: evaluatorCommand,
      },
      cwd: tmp,
      stdout: { write: (chunk: string) => { textStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const text = textStdout.join("");
    assert.equal(textCode, 0);
    assert.match(text, /Ruhroh workflow guide/u);
    assert.match(text, /next action: Plan repeated agent runs/u);
    assert.match(text, /command: pnpm exec ruhroh plan/u);
    assert.match(text, /First local fixture loop/u);
    assert.match(text, /Publish an audit-ready claim/u);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
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
      "adapter-metadata",
      "eval",
      "command-safety",
    ]);
    assert.equal(parsed.checks.filter((check: { status: string }) => check.status === "ok").length, 7);
    assert.match(parsed.checks.find((check: { name: string }) => check.name === "package-assets").details, /schemas, bundled scenarios, suites/u);
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "scenarios").status, "warning");
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "suites").status, "warning");
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").status, "warning");
    assert.match(parsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").details, /RUHROH_RESULT_PATH/u);
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
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").status, "warning");

    const templateStdout: string[] = [];
    const templateCode = await runRuhrohCli([
      "doctor",
      "--scenario-dir",
      "ruhroh/scenarios",
      "--adapter",
      path.resolve("examples", "adapters", "codex-cli", "run.sh"),
      "--json",
    ], {
      spawn: (() => ({ status: 0, stdout: "", stderr: "" })) as never,
      env: { RUHROH_EVAL_COMMAND: "./eval.sh" },
      cwd: tmp,
      stdout: { write: (chunk: string) => { templateStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const templateParsed = JSON.parse(templateStdout.join(""));
    assert.equal(templateCode, 0);
    assert.equal(templateParsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").status, "ok");
    assert.match(templateParsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").details, /ready for repeated comparisons with adapterVersion, model, artifacts/u);
    assert.match(templateParsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").details, /optional missing: usage/u);
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
    const adapterMetadata = parsed.checks.find((check: { name: string }) => check.name === "adapter-metadata");
    assert.equal(code, 0);
    assert.equal(adapterMetadata.status, "warning");
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
    assert.equal(parsed.checks.find((check: { name: string }) => check.name === "adapter-metadata").status, "warning");
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
    assert.equal(parsed.files.length, 21);
    assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);
    assert.deepEqual(parsed.nextCommands.fixture.slice(0, 3), [
      "cd starter",
      "export RUHROH_RUN_AGENT_COMMAND=\"$PWD/ruhroh/adapters/fixture-newsletter/run.sh\"",
      "export RUHROH_EVAL_COMMAND=\"$PWD/ruhroh/evaluators/fixture-newsletter/run.sh\"",
    ]);
    assert.deepEqual(parsed.nextCommands.selectedAdapter, []);
    assert.equal(existsSync(path.join(root, "README.md")), true);
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "benchmark-claim-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_benchmark_claim_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "benchmark-summary-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_benchmark_summary_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "claim-index-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_claim_index_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "eval-calibration-report-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_eval_calibration_report_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "eval-result-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_eval_result_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "loop-result-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_loop_result_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "publish-bundle-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_publish_bundle_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "publish-check-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_publish_check_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "run-manifest-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_run_manifest_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "run-plan-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_run_plan_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "rerun-ledger-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_rerun_ledger_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "scenario-v2.schema.json"), "utf8")).properties.version.const, "ruhroh_scenario_v2");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "suite-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_suite_v1");
    assert.equal(JSON.parse(readFileSync(path.join(root, "schemas", "workspace-summary-v1.schema.json"), "utf8")).properties.version.const, "ruhroh_workspace_summary_v1");
    assert.equal(existsSync(path.join(root, "scenarios", "simple-newsletter", "scenario.json")), true);
    const starterReadmeText = readFileSync(path.join(root, "README.md"), "utf8");
    assert.match(starterReadmeText, /pnpm exec ruhroh first-run/u);
    assert.match(starterReadmeText, /pnpm exec ruhroh workflow --html ruhroh-workflow\.html/u);
    assert.match(starterReadmeText, /dry-run command previews the\s+Harbor invocation/u);
    assert.match(starterReadmeText, /ruhroh publish-check --bundle/u);
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

test("public CLI init can include a maintained adapter template", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-init-adapter-"));
  try {
    const stdout: string[] = [];
    const code = await runRuhrohCli(["init", "starter", "--adapter", "codex-cli", "--json"], {
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
    assert.deepEqual(parsed.adapter, { id: "codex-cli", template: "codex-cli" });
    assert.equal(parsed.nextCommands.fixture[0], "cd starter");
    assert.deepEqual(parsed.nextCommands.selectedAdapter, [
      "cd starter",
      "pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/codex-cli/run.sh",
      "pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter ./ruhroh/adapters/codex-cli/run.sh --dry-run",
    ]);
    assert.equal(parsed.files.length, 23);
    assert.equal(existsSync(path.join(root, "schemas", "publish-bundle-v1.schema.json")), true);
    assert.equal(existsSync(path.join(root, "schemas", "publish-check-v1.schema.json")), true);
    assert.equal(existsSync(path.join(root, "schemas", "rerun-ledger-v1.schema.json")), true);
    assert.equal(existsSync(path.join(root, "adapters", "fixture-newsletter", "run.sh")), true);
    assert.equal(existsSync(path.join(root, "adapters", "codex-cli", "run.sh")), true);
    assert.equal(existsSync(path.join(root, "adapters", "codex-cli", "README.md")), true);
    assert.equal(existsSync(path.join(root, "evaluators", "fixture-newsletter", "run.sh")), true);
    assert.match(readFileSync(path.join(root, "adapters", "codex-cli", "run.sh"), "utf8"), /codex/u);
    assert.match(readFileSync(path.join(root, "adapters", "codex-cli", "README.md"), "utf8"), /Template: `codex-cli`/u);
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
    assert.deepEqual(parsed.nextCommands, [
      "$EDITOR scenarios/csv-cleanup/instruction.md",
      "$EDITOR scenarios/csv-cleanup/scenario.json",
      "pnpm exec ruhroh validate --scenario-dir scenarios --scenario csv-cleanup --json",
      "pnpm exec ruhroh new-suite local-smoke --scenario-dir scenarios --suite-dir suites --scenario csv-cleanup",
    ]);

    const manifest = JSON.parse(readFileSync(path.join(scenarioDir, "scenario.json"), "utf8"));
    assert.equal(manifest.id, "csv-cleanup");
    assert.equal(manifest.title, "Csv Cleanup");
    assert.equal(manifest.tier, "nightly");
    assert.equal(manifest.metadata.visibility, "private");
    assert.equal(manifest.userPromptPath, "instruction.md");
    assert.deepEqual(manifest.evaluation.calibrationCases.map((item: { expectedStatus: string }) => item.expectedStatus), ["passed", "failed", "review"]);
    assert.match(readFileSync(path.join(scenarioDir, "instruction.md"), "utf8"), /Describe the user task/u);

    const validation = validateRuhrohScenarioSource(scenarioDir);
    assert.deepEqual(validation.errors, []);
    assert.deepEqual(validation.warnings, []);
    assert.deepEqual(validation.calibration?.missingStatuses, []);
    assert.deepEqual(validation.calibration?.warnings, []);

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
    assert.deepEqual(parsed.nextCommands, [
      "pnpm exec ruhroh validate --scenario-dir scenarios --suite-dir suites --suite local-data --json",
      "pnpm exec ruhroh inspect-pack --scenario-dir scenarios --suite-dir suites --json",
      "pnpm exec ruhroh inspect-pack --scenario-dir scenarios --suite-dir suites --require-calibrated --require-risk-reviewed --json",
      "pnpm exec ruhroh plan --scenario-dir scenarios --suite-dir suites --suite local-data --adapter <adapter-command> --runs 7 --json",
    ]);

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
    assert.equal(parsed.template, "generic");
    assert.equal(parsed.files.length, 2);
    assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);
    assert.deepEqual(parsed.nextCommands, [
      "$EDITOR ruhroh/adapters/local-agent/run.sh",
      "pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh",
      "pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh --json",
      "pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario <scenario-id> --adapter ./ruhroh/adapters/local-agent/run.sh --dry-run",
    ]);
    assert.equal(existsSync(runPath), true);
    assert.equal((statSync(runPath).mode & 0o111) !== 0, true);
    assert.match(readFileSync(runPath, "utf8"), /ruhroh_run_agent_result_v1/u);
    assert.match(readFileSync(runPath, "utf8"), /status": "runtime_failure"/u);
    const readme = readFileSync(path.join(adapterDir, "README.md"), "utf8");
    assert.match(readme, /custom-shell adapter scaffold/u);
    assert.match(readme, /Comparison Readiness/u);
    assert.match(readme, /adapter-metadata/u);
    assert.match(readme, /adapterVersion/u);
    assert.match(readme, /model\.provider/u);
    assert.match(readme, /artifacts\.transcript/u);
    assert.match(readme, /ruhroh-run-manifest\.json/u);
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

test("public CLI new-adapter scaffolds maintained CLI wrapper templates", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-new-adapter-template-"));
  try {
    for (const template of ["codex-cli", "claude-code", "gemini-cli", "aider", "fixture"] as const) {
      const adapterId = `${template}-adapter`;
      const stdout: string[] = [];
      const code = await runRuhrohCli(["new-adapter", adapterId, "--template", template, "--json"], {
        spawn: (() => assert.fail("new-adapter template should not spawn Harbor")) as never,
        env: {},
        cwd: tmp,
        stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
        stderr: { write: () => true },
      });
      const parsed = JSON.parse(stdout.join(""));
      const adapterDir = path.join(tmp, "ruhroh", "adapters", adapterId);
      const runPath = path.join(adapterDir, "run.sh");
      const readme = readFileSync(path.join(adapterDir, "README.md"), "utf8");
      const script = readFileSync(runPath, "utf8");
      assert.equal(code, 0);
      assert.equal(parsed.template, template);
      assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);
      assert.equal(parsed.nextCommands.at(2), `pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/${adapterId}/run.sh --json`);
      assert.equal(parsed.nextCommands.at(-1), `pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario <scenario-id> --adapter ./ruhroh/adapters/${adapterId}/run.sh --dry-run`);
      assert.equal((statSync(runPath).mode & 0o111) !== 0, true);
      assert.equal(spawnSync("bash", ["-n", runPath]).status, 0);
      assert.equal(readme.includes(`Template: \`${template}\``), true);
      assert.match(readme, /Comparison Readiness/u);
      assert.match(readme, /adapter-metadata/u);
      assert.match(readme, /ruhroh_run_agent_result_v1/u);
      assert.match(script, /ruhroh_run_agent_result_v1/u);
      if (template === "codex-cli") {
        assert.match(script, /CODEX_CLI_BIN/u);
        assert.match(readme, /Codex CLI setup/u);
      }
      if (template === "claude-code") {
        assert.match(script, /CLAUDE_CODE_BIN/u);
        assert.match(readme, /Claude Code setup/u);
      }
      if (template === "gemini-cli") {
        assert.match(script, /GEMINI_CLI_BIN/u);
        assert.match(readme, /Gemini CLI setup/u);
      }
      if (template === "aider") {
        assert.match(script, /AIDER_BIN/u);
        assert.match(script, /--message-file/u);
        assert.match(readme, /Aider setup/u);
      }
      if (template === "fixture") {
        assert.match(script, /Fixture Newsletter/u);
        assert.match(readme, /deterministic adapter/u);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI new-evaluator scaffolds a review-first command evaluator", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-new-evaluator-"));
  try {
    const stdout: string[] = [];
    const code = await runRuhrohCli(["new-evaluator", "local-evaluator", "--json"], {
      spawn: (() => assert.fail("new-evaluator should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const parsed = JSON.parse(stdout.join(""));
    const evaluatorDir = path.join(tmp, "ruhroh", "evaluators", "local-evaluator");
    const runPath = path.join(evaluatorDir, "run.sh");
    assert.equal(code, 0);
    assert.equal(parsed.version, "ruhroh_new_evaluator_v1");
    assert.equal(parsed.evaluatorDir, evaluatorDir);
    assert.equal(parsed.files.length, 2);
    assert.equal(parsed.files.every((file: { status: string }) => file.status === "created"), true);
    assert.deepEqual(parsed.nextCommands, [
      "$EDITOR ruhroh/evaluators/local-evaluator/run.sh",
      "export RUHROH_EVAL_COMMAND=\"$PWD/ruhroh/evaluators/local-evaluator/run.sh\"",
      "pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell",
      "pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --json",
      "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>",
    ]);
    assert.equal(existsSync(runPath), true);
    assert.equal((statSync(runPath).mode & 0o111) !== 0, true);
    assert.match(readFileSync(runPath, "utf8"), /ruhroh_eval_result_v1/u);
    assert.match(readFileSync(runPath, "utf8"), /"status": "review"/u);
    const readme = readFileSync(path.join(evaluatorDir, "README.md"), "utf8");
    assert.match(readme, /command-backed evaluator scaffold/u);
    assert.match(readme, /pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh\/scenarios --scenario <scenario-id>/u);
    assert.equal(spawnSync("bash", ["-n", runPath]).status, 0);

    const workspace = path.join(tmp, "workspace");
    const outputPath = path.join(tmp, "eval-result.json");
    const inputPath = path.join(tmp, "eval-input.json");
    mkdirSync(workspace, { recursive: true });
    writeFileSync(path.join(workspace, "README.md"), "# Delivered workspace\n");
    writeFileSync(inputPath, JSON.stringify({ version: "ruhroh_eval_input_v1", scenarioId: "example" }));
    const scaffoldRun = spawnSync(runPath, [], {
      env: {
        ...process.env,
        RUHROH_EVAL_INPUT_PATH: inputPath,
        RUHROH_EVAL_OUTPUT_PATH: outputPath,
        RUHROH_EVAL_WORKSPACE_PATH: workspace,
      },
      encoding: "utf8",
    });
    assert.equal(scaffoldRun.status, 0);
    const evalResult = JSON.parse(readFileSync(outputPath, "utf8"));
    assert.equal(evalResult.$schema, "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json");
    assert.equal(evalResult.version, "ruhroh_eval_result_v1");
    assert.equal(evalResult.status, "review");
    assert.equal(evalResult.goalMet, false);
    assert.equal(evalResult.evidenceRefs.length, 1);
    assert.equal(evalResult.criteriaResults[0].status, "review");
    assert.equal(evalResult.judge.kind, "command");
    assert.equal(evalResult.judge.model, "local-evaluator");

    const secondStdout: string[] = [];
    const secondCode = await runRuhrohCli(["new-evaluator", "local-evaluator", "--json"], {
      spawn: (() => assert.fail("new-evaluator rerun should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { secondStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(secondCode, 0);
    assert.equal(JSON.parse(secondStdout.join("")).files.every((file: { status: string }) => file.status === "unchanged"), true);

    writeFileSync(path.join(evaluatorDir, "README.md"), "# Local edits\n");
    const stderr: string[] = [];
    const overwriteCode = await runRuhrohCli(["new-evaluator", "local-evaluator"], {
      spawn: (() => assert.fail("new-evaluator overwrite check should not spawn Harbor")) as never,
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

test("public CLI new-evaluator supports evaluator quality templates", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-new-evaluator-template-"));
  try {
    for (const template of ["deterministic", "model", "hybrid"] as const) {
      const stdout: string[] = [];
      const evaluatorId = `${template}-evaluator`;
      const code = await runRuhrohCli(["new-evaluator", evaluatorId, "--template", template, "--json"], {
        spawn: (() => assert.fail("new-evaluator template should not spawn Harbor")) as never,
        env: {},
        cwd: tmp,
        stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
        stderr: { write: () => true },
      });
      const parsed = JSON.parse(stdout.join(""));
      const evaluatorDir = path.join(tmp, "ruhroh", "evaluators", evaluatorId);
      const runPath = path.join(evaluatorDir, "run.sh");
      const readme = readFileSync(path.join(evaluatorDir, "README.md"), "utf8");
      assert.equal(code, 0);
      assert.equal(parsed.template, template);
      assert.equal(parsed.nextCommands.at(-1), "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>");
      assert.equal(spawnSync("bash", ["-n", runPath]).status, 0);
      assert.match(readme, new RegExp(`Template: \`${template}\``, "u"));
      assert.match(readme, /calibrate-evaluator/u);

      const workspace = path.join(tmp, `${template}-workspace`);
      const outputPath = path.join(tmp, `${template}-eval-result.json`);
      const inputPath = path.join(tmp, `${template}-eval-input.json`);
      mkdirSync(workspace, { recursive: true });
      writeFileSync(path.join(workspace, "README.md"), "# Delivered workspace\n");
      writeFileSync(inputPath, JSON.stringify({
        version: "ruhroh_eval_input_v1",
        scenarioId: "example",
        goalRubric: ["The delivered workspace satisfies the task."],
      }));
      const scaffoldRun = spawnSync(runPath, [], {
        env: {
          ...process.env,
          RUHROH_EVAL_INPUT_PATH: inputPath,
          RUHROH_EVAL_OUTPUT_PATH: outputPath,
          RUHROH_EVAL_WORKSPACE_PATH: workspace,
        },
        encoding: "utf8",
      });
      assert.equal(scaffoldRun.status, 0);
      const evalResult = JSON.parse(readFileSync(outputPath, "utf8"));
      assert.equal(evalResult.version, "ruhroh_eval_result_v1");
      assert.equal(evalResult.status, "review");
      assert.equal(evalResult.goalMet, false);
      if (template === "model") {
        assert.equal(evalResult.judge.kind, "model");
        assert.match(evalResult.reasons.join("\n"), /RUHROH_EVAL_MODEL_COMMAND/u);
      }
      if (template === "hybrid") {
        assert.equal(evalResult.judge.kind, "hybrid");
        assert.equal(evalResult.judgeVotes.length, 2);
      }
      if (template === "deterministic") {
        assert.equal(evalResult.judge.kind, "command");
        assert.match(evalResult.reasons.join("\n"), /Deterministic evaluator template needs/u);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI calibrates evaluator against scenario anchors", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-calibrate-evaluator-"));
  try {
    const scenarioRoot = path.join(tmp, "ruhroh", "scenarios");
    const scenarioDir = path.join(scenarioRoot, "calibration-demo");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(path.join(scenarioDir, "instruction.md"), "Deliver the calibration demo outcome.\n");
    writeFileSync(path.join(scenarioDir, "scenario.json"), JSON.stringify({
      version: "ruhroh_scenario_v2",
      id: "calibration-demo",
      title: "Calibration Demo",
      tier: "smoke",
      kind: "real_user",
      userPromptPath: "instruction.md",
      run: { timeoutSeconds: 600 },
      requires: { continuity: "workspace_only", tools: ["filesystem"], network: false },
      loop: { defaultMaxIterations: 2, stopPolicy: "goal_satisfied_or_max" },
      evaluation: {
        mode: "agentic_goal_review",
        scenarioContext: ["Calibration test scenario.", "Evaluator should follow expected anchors."],
        goalRubric: [
          "The evaluator distinguishes successful delivery from failed delivery.",
          "The evaluator can request review for ambiguous evidence.",
          "The evaluator cites concrete evidence.",
        ],
        evidenceGuidance: ["Read the calibration workspace summary.", "Use the active calibration case as the anchor."],
        calibrationCases: [{
          id: "good-delivery",
          inputSummary: "The workspace includes the intended feature and clear evidence.",
          expectedStatus: "passed",
          rationale: "Complete delivery should pass.",
        }, {
          id: "broken-delivery",
          inputSummary: "The workspace is incomplete and misses the intended feature.",
          expectedStatus: "failed",
          rationale: "Incomplete delivery should fail.",
        }],
      },
    }, null, 2));

    const evaluatorPath = path.join(tmp, "calibration-evaluator.cjs");
    writeFileSync(evaluatorPath, `#!/usr/bin/env node
const fs = require("node:fs");
const active = JSON.parse(process.env.RUHROH_EVAL_ACTIVE_CALIBRATION_CASE_JSON || "{}");
const status = process.env.RUHROH_FORCE_STATUS || active.expectedStatus || "review";
const outputPath = process.env.RUHROH_EVAL_OUTPUT_PATH;
fs.mkdirSync(require("node:path").dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({
  "$schema": "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
  version: "ruhroh_eval_result_v1",
  status,
  goalMet: status === "passed",
  confidence: "high",
  reasons: ["calibrated " + active.id],
  unmetCriteria: status === "passed" ? [] : ["calibration unmet"],
  evidenceRefs: [{ kind: "file", ref: "CALIBRATION.md", summary: active.inputSummary || "" }],
  commandsRun: [],
  artifacts: { workspacePath: process.env.RUHROH_EVAL_WORKSPACE_PATH },
  finalSummary: "calibration " + active.id,
  criteriaResults: [{
    id: "calibration-anchor",
    description: "Calibration anchor matched.",
    status,
    score: status === "passed" ? 1 : 0,
    evidenceRefs: [{ kind: "file", ref: "CALIBRATION.md", summary: active.rationale || "" }]
  }],
  judge: { kind: "command", model: "calibration-evaluator", version: "test" }
}, null, 2) + "\\n");
`, "utf8");
    chmodSync(evaluatorPath, 0o755);

    const stdout: string[] = [];
    const code = await runRuhrohCli([
      "calibrate-evaluator",
      "--scenario-dir",
      scenarioRoot,
      "--scenario",
      "calibration-demo",
      "--generated-dir",
      path.join(tmp, ".generated", "ruhroh"),
      "--json",
    ], {
      spawn: spawnSync,
      env: { ...process.env, RUHROH_EVAL_COMMAND: evaluatorPath },
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const report = JSON.parse(stdout.join(""));
    assert.equal(code, 0);
    assert.equal(report.$schema, "https://lumicorp.github.io/ruhroh/schemas/eval-calibration-report-v1.schema.json");
    assert.equal(report.version, "ruhroh_eval_calibration_report_v1");
    assert.equal(report.ok, true);
    assert.equal(report.caseCount, 2);
    assert.equal(report.matchedCount, 2);
    assert.equal(report.results[0].expectedStatus, "passed");
    assert.equal(report.results[0].actualStatus, "passed");
    assert.equal(existsSync(report.source.reportPath), true);
    assert.equal(JSON.parse(readFileSync(report.source.reportPath, "utf8")).$schema, "https://lumicorp.github.io/ruhroh/schemas/eval-calibration-report-v1.schema.json");
    assert.equal(JSON.parse(readFileSync(report.source.reportPath, "utf8")).version, "ruhroh_eval_calibration_report_v1");
    assert.equal(existsSync(report.results[0].outputPath), true);
    const calibrationInput = JSON.parse(readFileSync(report.results[0].inputPath, "utf8"));
    assert.equal(calibrationInput.calibrationCase.id, "good-delivery");

    const mismatchStdout: string[] = [];
    const mismatchStderr: string[] = [];
    const mismatchCode = await runRuhrohCli([
      "calibrate-evaluator",
      "--scenario-dir",
      scenarioRoot,
      "--scenario",
      "calibration-demo",
      "--generated-dir",
      path.join(tmp, ".generated", "mismatch"),
      "--json",
    ], {
      spawn: spawnSync,
      env: { ...process.env, RUHROH_EVAL_COMMAND: evaluatorPath, RUHROH_FORCE_STATUS: "failed" },
      cwd: tmp,
      stdout: { write: (chunk: string) => { mismatchStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { mismatchStderr.push(chunk); return true; } },
    });
    const mismatch = JSON.parse(mismatchStdout.join(""));
    assert.equal(mismatchCode, 2);
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.mismatchCount, 1);
    assert.equal(mismatch.results.some((item: { caseId: string; expectedStatus: string; actualStatus: string; matched: boolean }) => item.caseId === "good-delivery" && item.expectedStatus === "passed" && item.actualStatus === "failed" && item.matched === false), true);
    assert.match(mismatchStderr.join(""), /calibrate-evaluator failed calibration gate/u);
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
    assert.deepEqual(parsed.results[0].calibration, {
      total: 0,
      byExpectedStatus: { passed: 0, failed: 0, review: 0 },
      coveredStatuses: [],
      missingStatuses: ["passed", "failed", "review"],
      warnings: ["evaluation.calibrationCases has no expected judgment anchors"],
    });
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

  const resultApiTmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-results-api-"));
  try {
    mkdirSync(path.join(resultApiTmp, "run-one"), { recursive: true });
    mkdirSync(path.join(resultApiTmp, "run-two"), { recursive: true });
    writeFileSync(path.join(resultApiTmp, "run-one", "ruhroh-loop-result.json"), `${JSON.stringify(passedRun, null, 2)}\n`);
    writeFileSync(path.join(resultApiTmp, "run-two", "ruhroh-loop-result.json"), `${JSON.stringify(failedRun, null, 2)}\n`);
    writeFileSync(path.join(resultApiTmp, "ignore.json"), "{\"version\":\"not_ruhroh\"}\n");

    const resultArtifacts = loadRuhrohRunResultArtifacts(resultApiTmp);
    assert.equal(resultArtifacts.length, 2);
    assert.deepEqual(resultArtifacts.map((artifact) => path.basename(path.dirname(artifact.path))), ["run-one", "run-two"]);
    assert.match(resultArtifacts[0]?.sha256 ?? "", /^[a-f0-9]{64}$/u);
    assert.equal(loadRuhrohRunResults(resultApiTmp).length, 2);

    const resultReport = buildRuhrohRunResultsReport({
      resultsPath: resultApiTmp,
      aggregate: { minRuns: 2, expectedScenarioVersions: { "simple-newsletter": "1.0.0" } },
      createdAt: "2026-07-07T12:30:00.000Z",
      tool: { name: "@kestrel-agents/ruhroh", version: "0.6.0-beta.0" },
      source: { runPlanPath: path.join(resultApiTmp, "ruhroh-run-plan.json") },
      runPlanPresent: true,
    });
    assert.equal(resultReport.version, "ruhroh_run_results_report_v1");
    assert.equal(resultReport.source.resultCount, 2);
    assert.equal(resultReport.artifacts.length, 2);
    assert.equal(resultReport.summaries.length, 2);
    assert.equal(resultReport.groups[0]?.runs, 2);
    assert.equal(resultReport.groups[0]?.statisticalWarnings.includes("fewer than 5 runs; treat pass rate and pass@k as directional"), false);
    assert.equal(resultReport.reviewQueue.length, 2);
    assert.equal(resultReport.claimReadiness.scope, "ad_hoc_compare");
    assert.equal(resultReport.claimReadiness.blockers.some((blocker) => blocker.includes("no suite selected")), true);
    assert.equal(resultReport.benchmarkClaim.source?.resultsPath, resultApiTmp);
    assert.equal(resultReport.benchmarkClaim.source?.resultArtifacts?.length, 2);
    assert.equal(resultReport.benchmarkClaim.evidence.runPlanPresent, true);
    assert.equal(resultReport.benchmarkSummary.rows.length, resultReport.benchmarkClaim.scenarioResults.length);
  } finally {
    rmSync(resultApiTmp, { recursive: true, force: true });
  }

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
    assert.match(compareHtml, /Publication and Evidence Overview/u);
    assert.match(compareHtml, /Result sources/u);
    assert.match(compareHtml, /Named artifacts/u);
    assert.match(compareHtml, /Review queue/u);
    assert.match(compareHtml, /2 hashed result JSON sources/u);
    assert.match(compareHtml, /Claim Readiness/u);
    assert.match(compareHtml, /Comparison Matrix/u);
    assert.match(compareHtml, /50% \(1\/2\); CI/u);
    assert.match(compareHtml, /Failure Triage/u);
    assert.match(compareHtml, /goal_mismatch=1/u);
    assert.match(compareHtml, /Restore missing or incomplete artifacts before publication\./u);
    assert.match(compareHtml, /Cost and Efficiency/u);
    assert.match(compareHtml, /1\/2 runs/u);
    assert.match(compareHtml, /Run Plan Warnings/u);
    assert.match(compareHtml, /run plan sample has no result artifact/u);
    assert.match(compareHtml, /Review Queue/u);
    assert.match(compareHtml, /Evidence Browser/u);
    assert.match(compareHtml, /Open the preserved evidence for each run/u);
    assert.match(compareHtml, /<strong>manifest<\/strong>: <a href="\.\/run-one\/ruhroh-run-manifest\.json">/u);
    assert.match(compareHtml, /<strong>journey<\/strong>: <a href="\.\/run-one\/ruhroh-journey\.jsonl">/u);
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

    const compareTextStdout: string[] = [];
    const compareTextCode = await runRuhrohCli(["compare", "."], {
      spawn: (() => assert.fail("text compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { compareTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const compareText = compareTextStdout.join("");
    assert.equal(compareTextCode, 0);
    assert.match(compareText, /Comparison matrix:/u);
    assert.match(compareText, /simple-newsletter \| agent-a: 50% \(1\/2\)/u);

    const evalQualityStdout: string[] = [];
    const evalQualityStderr: string[] = [];
    const evalQualityHtmlPath = path.join(tmp, "eval-quality.html");
    const evalQualityCode = await runRuhrohCli(["eval-quality", ".", "--html", evalQualityHtmlPath, "--json"], {
      spawn: (() => assert.fail("eval-quality should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { evalQualityStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { evalQualityStderr.push(chunk); return true; } },
    });
    const evalQuality = JSON.parse(evalQualityStdout.join(""));
    const evalQualityHtml = readFileSync(evalQualityHtmlPath, "utf8");
    assert.equal(evalQualityCode, 2);
    assert.equal(evalQuality.version, "ruhroh_eval_quality_v1");
    assert.equal(evalQuality.ok, false);
    assert.equal(evalQuality.source.resultsPath, tmp);
    assert.equal(evalQuality.source.resultCount, 2);
    assert.equal(evalQuality.htmlPath, evalQualityHtmlPath);
    assert.equal(evalQuality.warningCounts["eval result has no top-level evidenceRefs"], 2);
    assert.equal(evalQuality.warningCount >= 2, true);
    assert.equal(evalQuality.humanReviewRequiredCount, 0);
    assert.equal(evalQuality.runs.some((run: { runId: string; evidenceRefCount: number; judge: string }) => run.runId === "simple-newsletter-agent-a-1" && run.evidenceRefCount === 0 && run.judge === "hybrid/arbiter@2026-07-07"), true);
    assert.equal(evalQuality.nextActions.some((action: string) => action.includes("evidenceRefs")), true);
    assert.match(evalQualityStderr.join(""), /eval-quality failed audit gate: \d+ warnings/u);
    assert.match(evalQualityHtml, /Ruhroh eval-quality/u);
    assert.match(evalQualityHtml, /Gate/u);
    assert.match(evalQualityHtml, /needs attention/u);
    assert.match(evalQualityHtml, /Warning Counts/u);
    assert.match(evalQualityHtml, /eval result has no top-level evidenceRefs/u);
    assert.match(evalQualityHtml, /Next Actions/u);
    assert.match(evalQualityHtml, /Evaluator Runs/u);
    assert.match(evalQualityHtml, /hybrid\/arbiter@2026-07-07/u);
    assert.match(evalQualityHtml, /href="\.\/run-one\/ruhroh-loop-result\.json"/u);

    const evalQualityHtmlOnlyStdout: string[] = [];
    const evalQualityHtmlOnlyStderr: string[] = [];
    const evalQualityHtmlOnlyPath = path.join(tmp, "eval-quality-only.html");
    const evalQualityHtmlOnlyCode = await runRuhrohCli(["eval-quality", ".", "--html", evalQualityHtmlOnlyPath], {
      spawn: (() => assert.fail("html eval-quality should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { evalQualityHtmlOnlyStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { evalQualityHtmlOnlyStderr.push(chunk); return true; } },
    });
    assert.equal(evalQualityHtmlOnlyCode, 2);
    assert.match(evalQualityHtmlOnlyStdout.join(""), /Wrote Ruhroh eval-quality HTML/u);
    assert.match(evalQualityHtmlOnlyStderr.join(""), /eval-quality failed audit gate/u);
    assert.match(readFileSync(evalQualityHtmlOnlyPath, "utf8"), /Evaluator Runs/u);

    const evalQualityTextStdout: string[] = [];
    const evalQualityTextCode = await runRuhrohCli(["eval-quality", "."], {
      spawn: (() => assert.fail("text eval-quality should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { evalQualityTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(evalQualityTextCode, 2);
    assert.match(evalQualityTextStdout.join(""), /Ruhroh eval-quality/u);
    assert.match(evalQualityTextStdout.join(""), /warning: eval result has no top-level evidenceRefs/u);
    assert.match(evalQualityTextStdout.join(""), /next actions:/u);

    const reviewStdout: string[] = [];
    const reviewPath = path.join(tmp, "review.html");
    const reviewCode = await runRuhrohCli(["review", ".", "--html", reviewPath, "--json"], {
      spawn: (() => assert.fail("review should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { reviewStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const review = JSON.parse(reviewStdout.join(""));
    const reviewHtml = readFileSync(reviewPath, "utf8");
    assert.equal(reviewCode, 0);
    assert.equal(review.version, "ruhroh_review_queue_v1");
    assert.equal(review.source.resultsPath, tmp);
    assert.equal(review.source.resultCount, 2);
    assert.equal(review.itemCount, 2);
    assert.equal(review.requiredCount, 0);
    assert.equal(review.recommendedCount, 2);
    assert.equal(review.reviewQueue.some((item: { priority: string; reasons: string[] }) => item.priority === "recommended" && item.reasons.includes("non-passing run: goal_mismatch")), true);
    assert.equal(review.htmlPath, reviewPath);
    assert.match(reviewHtml, /Ruhroh review queue/u);
    assert.match(reviewHtml, /Adjudication Checklist/u);
    assert.match(reviewHtml, /transcript\.log/u);

    const reviewTextStdout: string[] = [];
    const reviewTextCode = await runRuhrohCli(["review", "."], {
      spawn: (() => assert.fail("text review should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { reviewTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const reviewText = reviewTextStdout.join("");
    assert.equal(reviewTextCode, 0);
    assert.match(reviewText, /Ruhroh review queue:/u);
    assert.match(reviewText, /items: 2 required=0 recommended=2/u);
    assert.match(reviewText, /Next steps:/u);
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

    const rerunLedgerPath = path.join(tmp, "ruhroh-rerun-ledger.json");
    writeFileSync(rerunLedgerPath, `${JSON.stringify({
      version: "ruhroh_rerun_ledger_v1",
      entries: [{
        sampleId: "simple-newsletter/agent-a/2-of-2",
        decision: "exclude",
        reasonKind: "infrastructure",
        reason: "Harbor worker was interrupted before artifacts were uploaded.",
        decidedBy: "benchmark-owner",
        decidedAt: "2026-07-07T12:45:00.000Z",
      }],
    }, null, 2)}\n`);
    const ledgerCompareStdout: string[] = [];
    const ledgerCompareCode = await runRuhrohCli(["compare", ".", "--run-plan", "ruhroh-run-plan.json", "--rerun-ledger", "ruhroh-rerun-ledger.json", "--json"], {
      spawn: (() => assert.fail("rerun-ledger compare should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { ledgerCompareStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const ledgerCompare = JSON.parse(ledgerCompareStdout.join(""));
    assert.equal(ledgerCompareCode, 0);
    assert.equal(ledgerCompare.rerunLedger.version, "ruhroh_rerun_ledger_v1");
    assert.equal(ledgerCompare.rerunLedger.acceptedExclusionCount, 1);
    assert.deepEqual(ledgerCompare.rerunLedger.acceptedExclusions, ["simple-newsletter/agent-a/2-of-2"]);
    assert.equal(ledgerCompare.runPlanWarnings.some((warning: string) => warning.includes("simple-newsletter/agent-a/2-of-2")), false);
    assert.equal(ledgerCompare.runPlanWarnings.some((warning: string) => warning.includes("result has no sample id")), true);
    assert.equal(ledgerCompare.benchmarkClaim.source.rerunLedgerPath, rerunLedgerPath);
    assert.equal(ledgerCompare.benchmarkClaim.source.rerunLedgerSha256, sha256File(rerunLedgerPath));

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

    const publishCheckStdout: string[] = [];
    const publishCheckStderr: string[] = [];
    const publishCheckClaimPath = path.join(tmp, "publish-check-claim.json");
    const publishCheckSummaryPath = path.join(tmp, "publish-check-summary.json");
    const publishCheckMarkdownPath = path.join(tmp, "publish-check-summary.md");
    const publishBundlePath = path.join(tmp, "publish-bundle");
    const calibrationReportPath = path.join(tmp, ".generated", "ruhroh", "evaluator-calibration", "ruhroh-evaluator-calibration-report.json");
    const calibrationCaseDir = path.join(tmp, ".generated", "ruhroh", "evaluator-calibration", "clear-pass");
    const calibrationInputPath = path.join(calibrationCaseDir, "ruhroh-eval-calibration-input.json");
    const calibrationOutputPath = path.join(calibrationCaseDir, "ruhroh-eval-result.json");
    const calibrationWorkspacePath = path.join(calibrationCaseDir, "workspace");
    mkdirSync(path.dirname(calibrationReportPath), { recursive: true });
    mkdirSync(calibrationWorkspacePath, { recursive: true });
    writeFileSync(path.join(calibrationWorkspacePath, "CALIBRATION.md"), "complete delivery should pass\n", "utf8");
    writeFileSync(calibrationInputPath, `${JSON.stringify({
      version: "ruhroh_eval_calibration_input_v1",
      scenarioId: "simple-newsletter",
      calibrationCase: {
        id: "clear-pass",
        inputSummary: "The app is complete.",
        expectedStatus: "passed",
        rationale: "Complete delivery should pass.",
      },
      workspacePath: calibrationWorkspacePath,
    }, null, 2)}\n`, "utf8");
    writeFileSync(calibrationOutputPath, `${JSON.stringify({
      $schema: "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
      version: "ruhroh_eval_result_v1",
      status: "passed",
      goalMet: true,
      confidence: "high",
      reasons: ["calibrated clear-pass"],
      unmetCriteria: [],
      evidenceRefs: [{ kind: "file", ref: "CALIBRATION.md", summary: "complete delivery should pass" }],
      commandsRun: [],
      artifacts: { workspacePath: calibrationWorkspacePath },
      finalSummary: "calibrated clear-pass",
      criteriaResults: [{
        id: "calibration-anchor",
        description: "Calibration anchor matched.",
        status: "passed",
        score: 1,
        evidenceRefs: [{ kind: "file", ref: "CALIBRATION.md", summary: "complete delivery should pass" }],
      }],
      judge: { kind: "command", model: "calibration-evaluator", version: "test" },
    }, null, 2)}\n`, "utf8");
    writeFileSync(calibrationReportPath, `${JSON.stringify({
      $schema: "https://lumicorp.github.io/ruhroh/schemas/eval-calibration-report-v1.schema.json",
      version: "ruhroh_eval_calibration_report_v1",
      source: {
        scenarioDir: path.join(tmp, "scenarios"),
        generatedDir: path.join(tmp, ".generated", "ruhroh"),
        evaluatorCommand: path.join(tmp, "eval.sh"),
        reportPath: calibrationReportPath,
      },
      ok: true,
      scenarioCount: 1,
      caseCount: 1,
      matchedCount: 1,
      mismatchCount: 0,
      infraFailedCount: 0,
      warnings: [],
      nextActions: [],
      results: [{
        scenarioId: "simple-newsletter",
        caseId: "clear-pass",
        expectedStatus: "passed",
        actualStatus: "passed",
        matched: true,
        outputPath: calibrationOutputPath,
        inputPath: calibrationInputPath,
        workspacePath: calibrationWorkspacePath,
        details: "clear-pass matched",
      }],
    }, null, 2)}\n`, "utf8");
    const publishCheckCode = await runRuhrohCli([
      "publish-check",
      ".",
      "--run-plan",
      "ruhroh-run-plan.json",
      "--benchmark-claim",
      "publish-check-claim.json",
      "--benchmark-summary",
      "publish-check-summary.json",
      "--summary-md",
      "publish-check-summary.md",
      "--bundle",
      "publish-bundle",
      "--verify-sources",
      "--json",
    ], {
      spawn: (() => assert.fail("publish-check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { publishCheckStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { publishCheckStderr.push(chunk); return true; } },
    });
    const publishCheck = JSON.parse(publishCheckStdout.join(""));
    assert.equal(publishCheckCode, 2);
    assert.equal(publishCheck.$schema, "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json");
    assert.equal(publishCheck.version, "ruhroh_publish_check_v1");
    assert.equal(publishCheck.publishable, false);
    assert.equal(publishCheck.source.resultsPath, tmp);
    assert.equal(publishCheck.source.runPlanPath, runPlanPath);
    assert.equal(publishCheck.source.benchmarkClaimPath, publishCheckClaimPath);
    assert.equal(publishCheck.source.benchmarkSummaryPath, publishCheckSummaryPath);
    assert.equal(publishCheck.source.summaryMarkdownPath, publishCheckMarkdownPath);
    assert.equal(publishCheck.source.bundlePath, publishBundlePath);
    assert.equal(publishCheck.source.evaluatorCalibrationReportPath, calibrationReportPath);
    assert.equal(existsSync(publishCheckClaimPath), true);
    assert.equal(existsSync(publishCheckSummaryPath), true);
    assert.equal(existsSync(publishCheckMarkdownPath), true);
    assert.match(readFileSync(publishCheckMarkdownPath, "utf8"), /# Ruhroh Publish Check/u);
    assert.match(readFileSync(publishCheckMarkdownPath, "utf8"), /\*\*Status:\*\* blocked/u);
    assert.match(readFileSync(publishCheckMarkdownPath, "utf8"), /## Next Actions/u);
    assert.equal(existsSync(path.join(publishBundlePath, "manifest.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "publish-check.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "ruhroh-compare.html")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "benchmark-claim.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "benchmark-summary.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "ruhroh-review.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "ruhroh-review.html")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "ruhroh-eval-quality.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "ruhroh-eval-quality.html")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "README.md")), true);
    assert.equal(publishCheck.sourceVerification.checked, true);
    assert.deepEqual(publishCheck.sourceVerification.errors, []);
    assert.equal(publishCheck.sourceVerification.checks.some((check: { name: string; status: string }) => check.name === "evaluatorCalibrationReport" && check.status === "ok"), true);
    assert.equal(publishCheck.blockers.some((item: string) => item.includes("no suite selected")), true);
    assert.equal(publishCheck.blockers.some((item: string) => item.includes("run plan warning")), true);
    assert.equal(publishCheck.remediation.some((item: { code: string; category: string; action: string }) => item.code === "suite_required" && item.category === "suite" && item.action.includes("--suite")), true);
    assert.equal(publishCheck.remediation.some((item: { code: string; category: string; action: string }) => item.code === "run_plan_mismatch" && item.category === "run_plan" && item.action.includes("run plan")), true);
    assert.equal(publishCheck.remediation.some((item: { code: string; category: string }) => item.code === "artifact_evidence_incomplete" && item.category === "artifacts"), true);
    assert.equal(publishCheck.remediation.every((item: { severity: string; blocker: string; docs: string }) => item.severity === "blocker" && item.blocker.length > 0 && item.docs.length > 0), true);
    assert.equal(publishCheck.compare.benchmarkClaim.source.benchmarkClaimPath, publishCheckClaimPath);
    assert.equal(publishCheck.compare.benchmarkClaim.source.evaluatorCalibrationReportPath, calibrationReportPath);
    assert.equal(typeof publishCheck.compare.benchmarkClaim.source.evaluatorCalibrationReportSha256, "string");
    assert.deepEqual(buildRuhrohPublishCheckReport({
      source: publishCheck.source,
      compare: publishCheck.compare,
      sourceVerification: publishCheck.sourceVerification,
    }), publishCheck);
    const publishBundleManifest = JSON.parse(readFileSync(path.join(publishBundlePath, "manifest.json"), "utf8"));
    assert.equal(publishBundleManifest.$schema, "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json");
    assert.equal(publishBundleManifest.version, "ruhroh_publish_bundle_v1");
    assert.equal(publishBundleManifest.source.resultsPath, "sources/results");
    assert.equal(publishBundleManifest.source.bundlePath, ".");
    assert.equal(publishBundleManifest.publishable, false);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "review-html" && file.path === "ruhroh-review.html"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "eval-quality" && file.path === "ruhroh-eval-quality.json"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "eval-quality-html" && file.path === "ruhroh-eval-quality.html"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "evaluator-calibration-report" && file.path === "sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "evaluator-calibration-clear-pass-input" && file.path === "sources/evaluator-calibration/clear-pass/ruhroh-eval-calibration-input.json"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "evaluator-calibration-clear-pass-output" && file.path === "sources/evaluator-calibration/clear-pass/ruhroh-eval-result.json"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "source-run-plan" && file.path === "sources/ruhroh-run-plan.json"), true);
    assert.equal(publishBundleManifest.files.some((file: { role: string; path: string }) => file.role === "source-result-1" && file.path === "sources/results/run-1/ruhroh-loop-result.json"), true);
    assert.equal(existsSync(path.join(publishBundlePath, "sources", "ruhroh-run-plan.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "sources", "evaluator-calibration", "ruhroh-evaluator-calibration-report.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "sources", "evaluator-calibration", "clear-pass", "ruhroh-eval-calibration-input.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "sources", "evaluator-calibration", "clear-pass", "ruhroh-eval-result.json")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "sources", "evaluator-calibration", "clear-pass", "workspace", "CALIBRATION.md")), true);
    assert.equal(existsSync(path.join(publishBundlePath, "sources", "results", "run-1", "ruhroh-loop-result.json")), true);
    const bundledPublishCheck = JSON.parse(readFileSync(path.join(publishBundlePath, "publish-check.json"), "utf8"));
    assert.equal(bundledPublishCheck.$schema, "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json");
    assert.equal(bundledPublishCheck.version, "ruhroh_publish_check_v1");
    assert.equal(bundledPublishCheck.source.bundlePath, ".");
    assert.equal(bundledPublishCheck.source.resultsPath, "sources/results");
    assert.equal(bundledPublishCheck.source.evaluatorCalibrationReportPath, "sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json");
    assert.deepEqual(bundledPublishCheck.sourceVerification.errors, []);
    assert.deepEqual(bundledPublishCheck.sourceVerification.warnings, []);
    const bundledClaim = JSON.parse(readFileSync(path.join(publishBundlePath, "benchmark-claim.json"), "utf8"));
    assert.equal(bundledClaim.source.resultsPath, "sources/results");
    assert.equal(bundledClaim.source.runPlanPath, "sources/ruhroh-run-plan.json");
    assert.equal(bundledClaim.source.evaluatorCalibrationReportPath, "sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json");
    assert.equal(bundledClaim.source.evaluatorCalibrationReportSha256, sha256File(path.join(publishBundlePath, "sources", "evaluator-calibration", "ruhroh-evaluator-calibration-report.json")));
    assert.equal(bundledClaim.source.benchmarkClaimPath, "benchmark-claim.json");
    assert.equal(bundledClaim.source.resultArtifacts[0].path, "sources/results/run-1/ruhroh-loop-result.json");
    assert.deepEqual(bundledClaim, bundledPublishCheck.compare.benchmarkClaim);
    const bundledCalibrationReportPath = path.join(publishBundlePath, "sources", "evaluator-calibration", "ruhroh-evaluator-calibration-report.json");
    const bundledCalibrationReport = JSON.parse(readFileSync(bundledCalibrationReportPath, "utf8"));
    assert.equal(bundledCalibrationReport.source.reportPath, "sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json");
    assert.equal(bundledCalibrationReport.results[0].inputPath, "sources/evaluator-calibration/clear-pass/ruhroh-eval-calibration-input.json");
    assert.equal(bundledCalibrationReport.results[0].outputPath, "sources/evaluator-calibration/clear-pass/ruhroh-eval-result.json");
    assert.equal(bundledCalibrationReport.results[0].workspacePath, "sources/evaluator-calibration/clear-pass/workspace");
    const bundledSummary = JSON.parse(readFileSync(path.join(publishBundlePath, "benchmark-summary.json"), "utf8"));
    assert.equal(bundledSummary.source.resultsPath, "sources/results");
    assert.deepEqual(bundledSummary, bundledPublishCheck.compare.benchmarkSummary);
    const bundledReview = JSON.parse(readFileSync(path.join(publishBundlePath, "ruhroh-review.json"), "utf8"));
    assert.equal(bundledReview.version, "ruhroh_review_queue_v1");
    assert.equal(bundledReview.source.resultCount, 2);
    const bundledReviewHtml = readFileSync(path.join(publishBundlePath, "ruhroh-review.html"), "utf8");
    assert.match(bundledReviewHtml, /Ruhroh review queue/u);
    const bundledEvalQuality = JSON.parse(readFileSync(path.join(publishBundlePath, "ruhroh-eval-quality.json"), "utf8"));
    assert.equal(bundledEvalQuality.version, "ruhroh_eval_quality_v1");
    assert.equal(bundledEvalQuality.source.resultCount, 2);
    const bundledEvalQualityHtml = readFileSync(path.join(publishBundlePath, "ruhroh-eval-quality.html"), "utf8");
    assert.match(bundledEvalQualityHtml, /Ruhroh eval-quality/u);
    assert.match(bundledEvalQualityHtml, /Evaluator Runs/u);
    const bundledReadme = readFileSync(path.join(publishBundlePath, "README.md"), "utf8");
    assert.match(bundledReadme, /Status: blocked/u);
    assert.match(bundledReadme, /## Review Order/u);
    assert.match(bundledReadme, /Open ruhroh-eval-quality\.html to inspect evaluator evidence warnings/u);
    assert.match(publishCheckStderr.join(""), /publish-check failed publishability gate: \d+ blockers/u);

    const implicitBundleStdout: string[] = [];
    const implicitBundlePath = path.join(tmp, "publish-bundle-implicit");
    const implicitBundleCode = await runRuhrohCli([
      "publish-check",
      ".",
      "--run-plan",
      "ruhroh-run-plan.json",
      "--bundle",
      "publish-bundle-implicit",
      "--verify-sources",
      "--json",
    ], {
      spawn: (() => assert.fail("implicit bundle publish-check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { implicitBundleStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const implicitBundle = JSON.parse(implicitBundleStdout.join(""));
    assert.equal(implicitBundleCode, 2);
    assert.equal(implicitBundle.source.benchmarkClaimPath, path.join(implicitBundlePath, "benchmark-claim.json"));
    assert.equal(implicitBundle.source.benchmarkSummaryPath, path.join(implicitBundlePath, "benchmark-summary.json"));
    assert.equal(implicitBundle.sourceVerification.warnings.some((warning: string) => warning.includes("benchmarkClaimPath")), false);
    assert.equal(implicitBundle.compare.benchmarkClaim.source.benchmarkClaimPath, path.join(implicitBundlePath, "benchmark-claim.json"));
    const implicitBundledClaim = JSON.parse(readFileSync(path.join(implicitBundlePath, "benchmark-claim.json"), "utf8"));
    const implicitBundledPublishCheck = JSON.parse(readFileSync(path.join(implicitBundlePath, "publish-check.json"), "utf8"));
    assert.equal(implicitBundledClaim.source.benchmarkClaimPath, "benchmark-claim.json");
    assert.equal(implicitBundledClaim.source.resultArtifacts[0].path, "sources/results/run-1/ruhroh-loop-result.json");
    assert.deepEqual(implicitBundledPublishCheck.sourceVerification.errors, []);

    const validateBundleStdout: string[] = [];
    const validateBundleStderr: string[] = [];
    const validateBundleCode = await runRuhrohCli(["validate-bundle", "publish-bundle", "--json"], {
      spawn: (() => assert.fail("bundle validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { validateBundleStdout.push(chunk); return true; } },
      stderr: { write: (chunk: string) => { validateBundleStderr.push(chunk); return true; } },
    });
    const validateBundle = JSON.parse(validateBundleStdout.join(""));
    assert.equal(validateBundleCode, 2);
    assert.equal(validateBundle.version, "ruhroh_publish_bundle_validation_report_v1");
    assert.equal(validateBundle.valid, true);
    assert.equal(validateBundle.publishable, false);
    assert.equal(validateBundle.source.bundlePath, publishBundlePath);
    assert.equal(validateBundle.errors.length, 0);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "manifest.$schema" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "evaluator-calibration-report.version" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "evaluator-calibration-report.source.reportPath" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "evaluator-calibration-report.results[0].inputPath" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "evaluator-calibration-report.results[0].outputPath" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "evaluator-calibration-report.results[0].workspacePath" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "benchmark-claim.cross-reference" && check.status === "ok"), true);
    assert.equal(validateBundle.checks.some((check: { name: string; status: string }) => check.name === "benchmark-summary.cross-reference" && check.status === "ok"), true);
    assert.match(validateBundleStderr.join(""), /validate-bundle failed publishability gate/u);
    const apiSourceVerification = verifyRuhrohBenchmarkClaimSources(bundledClaim, path.join(publishBundlePath, "benchmark-claim.json"));
    assert.equal(apiSourceVerification.version, "ruhroh_claim_source_verification_v1");
    assert.deepEqual(apiSourceVerification.errors, []);
    assert.equal(apiSourceVerification.checks.some((check) => check.name === "evaluatorCalibrationReport" && check.status === "ok"), true);
    const apiBundleValidation = validateRuhrohPublishBundle(publishBundlePath);
    assert.equal(apiBundleValidation.version, "ruhroh_publish_bundle_validation_report_v1");
    assert.equal(apiBundleValidation.valid, true);
    assert.equal(apiBundleValidation.publishable, false);
    assert.deepEqual(apiBundleValidation.errors, []);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "manifest.$schema" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "benchmark-claim.source.evaluatorCalibrationReport" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "evaluator-calibration-report.version" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "evaluator-calibration-report.source.reportPath" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "evaluator-calibration-report.results[0].inputPath" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "evaluator-calibration-report.results[0].outputPath" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "evaluator-calibration-report.results[0].workspacePath" && check.status === "ok"), true);
    assert.equal(apiBundleValidation.checks.some((check) => check.name === "files.eval-quality-html" && check.status === "ok"), true);

    const originalBundledCalibrationReportText = readFileSync(bundledCalibrationReportPath, "utf8");
    const brokenBundledCalibrationReport = JSON.parse(originalBundledCalibrationReportText);
    brokenBundledCalibrationReport.results[0].inputPath = "sources/evaluator-calibration/clear-pass/missing-input.json";
    writeFileSync(bundledCalibrationReportPath, `${JSON.stringify(brokenBundledCalibrationReport, null, 2)}\n`, "utf8");
    const brokenCalibrationEvidenceBundle = validateRuhrohPublishBundle(publishBundlePath);
    assert.equal(brokenCalibrationEvidenceBundle.valid, false);
    assert.equal(brokenCalibrationEvidenceBundle.errors.some((error) => error.includes("evaluator-calibration-report.results[0].inputPath")), true);
    writeFileSync(bundledCalibrationReportPath, originalBundledCalibrationReportText, "utf8");

    const claimIndexStdout: string[] = [];
    const claimIndexHtmlPath = path.join(tmp, "claim-index.html");
    const claimIndexCode = await runRuhrohCli(["claim-index", ".", "--html", claimIndexHtmlPath, "--json"], {
      spawn: (() => assert.fail("claim-index should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { claimIndexStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const claimIndex = JSON.parse(claimIndexStdout.join(""));
    const claimIndexHtml = readFileSync(claimIndexHtmlPath, "utf8");
    assert.equal(claimIndexCode, 0);
    assert.equal(claimIndex.$schema, "https://lumicorp.github.io/ruhroh/schemas/claim-index-v1.schema.json");
    assert.equal(claimIndex.version, "ruhroh_claim_index_v1");
    assert.equal(claimIndex.registryReady, false);
    assert.equal(claimIndex.registryBlockers.some((blocker: string) => blocker.includes("blocked claim")), true);
    assert.equal(claimIndex.claimCount >= 3, true);
    assert.equal(claimIndex.invalidCount, 0);
    assert.equal(claimIndex.blockedCount >= 1, true);
    assert.equal(claimIndex.totalRuns >= 2, true);
    assert.equal(claimIndex.claims.some((claim: { bundlePath?: string; claimPath: string; publishable: boolean; blockers: string[] }) => claim.bundlePath === publishBundlePath && claim.claimPath === path.join(publishBundlePath, "benchmark-claim.json") && claim.publishable === false && claim.blockers.some((blocker) => blocker.includes("run plan warning"))), true);
    assert.match(claimIndexHtml, /Ruhroh claim index/u);
    assert.match(claimIndexHtml, /benchmark-claim\.json/u);
    assert.match(claimIndexHtml, /Review Packet/u);
    assert.match(claimIndexHtml, /href="\.\/publish-bundle\/README\.md">README<\/a>/u);
    assert.match(claimIndexHtml, /href="\.\/publish-bundle\/ruhroh-eval-quality\.html">eval-quality<\/a>/u);
    assert.match(claimIndexHtml, /href="\.\/publish-bundle\/ruhroh-review\.html">review<\/a>/u);

    const claimIndexTextStdout: string[] = [];
    const claimIndexTextCode = await runRuhrohCli(["claim-index", "publish-bundle"], {
      spawn: (() => assert.fail("text claim-index should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { claimIndexTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(claimIndexTextCode, 0);
    assert.match(claimIndexTextStdout.join(""), /Ruhroh claim index: 1 claim/u);
    assert.match(claimIndexTextStdout.join(""), /registry ready: no/u);
    assert.match(claimIndexTextStdout.join(""), /bundle: publish-bundle/u);

    const claimIndexStrictStderr: string[] = [];
    const claimIndexStrictCode = await runRuhrohCli(["claim-index", "publish-bundle", "--require-publishable", "--json"], {
      spawn: (() => assert.fail("strict claim-index should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: (chunk: string) => { claimIndexStrictStderr.push(chunk); return true; } },
    });
    assert.equal(claimIndexStrictCode, 2);
    assert.match(claimIndexStrictStderr.join(""), /claim-index failed registry readiness gate/u);

    const originalBundleManifestText = readFileSync(path.join(publishBundlePath, "manifest.json"), "utf8");
    const missingEvalQualityHtmlManifest = JSON.parse(originalBundleManifestText);
    missingEvalQualityHtmlManifest.files = missingEvalQualityHtmlManifest.files.filter((file: { role: string }) => file.role !== "eval-quality-html");
    writeFileSync(path.join(publishBundlePath, "manifest.json"), `${JSON.stringify(missingEvalQualityHtmlManifest, null, 2)}\n`, "utf8");
    const missingEvalQualityHtmlBundle = validateRuhrohPublishBundle(publishBundlePath);
    assert.equal(missingEvalQualityHtmlBundle.valid, false);
    assert.equal(missingEvalQualityHtmlBundle.errors.some((error) => error.includes("required role eval-quality-html")), true);
    writeFileSync(path.join(publishBundlePath, "manifest.json"), originalBundleManifestText, "utf8");

    writeFileSync(path.join(publishBundlePath, "benchmark-claim.json"), "{}\n");
    const invalidBundleStdout: string[] = [];
    const invalidBundleCode = await runRuhrohCli(["validate-bundle", "publish-bundle", "--json"], {
      spawn: (() => assert.fail("invalid bundle validation should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { invalidBundleStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    const invalidBundle = JSON.parse(invalidBundleStdout.join(""));
    assert.equal(invalidBundleCode, 1);
    assert.equal(invalidBundle.valid, false);
    assert.equal(invalidBundle.errors.some((error: string) => error.includes("benchmark-claim.version")), true);
    assert.equal(invalidBundle.errors.some((error: string) => error.includes("benchmark-claim.cross-reference")), true);

    const publishCheckTextStdout: string[] = [];
    const publishCheckTextCode = await runRuhrohCli([
      "publish-check",
      ".",
      "--run-plan",
      "ruhroh-run-plan.json",
    ], {
      spawn: (() => assert.fail("text publish-check should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { publishCheckTextStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(publishCheckTextCode, 2);
    assert.match(publishCheckTextStdout.join(""), /next actions:/u);
    assert.match(publishCheckTextStdout.join(""), /\[suite_required\]/u);
    assert.match(publishCheckTextStdout.join(""), /\[run_plan_mismatch\]/u);

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
    assert.match(output, /No Harbor task directories, run plan, Harbor process, or agent calls were written or started/u);
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
    const evalPath = path.join(tmp, "eval-agent.mjs");
    const instructionPath = path.join(scenarioDir, "instruction.md");
    const scenarioPath = path.join(scenarioDir, "scenario.json");
    mkdirSync(scenarioDir, { recursive: true });
    writeFileSync(agentTwoPath, "#!/usr/bin/env node\nconsole.log('agent-two');\n");
    writeFileSync(evalPath, "#!/usr/bin/env node\nconsole.log('eval-agent');\n");
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
    const spawnArgs: string[][] = [];
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
        spawnArgs.push(__);
        if (options?.env !== undefined) {
          spawnEnvs.push(options.env);
        }
        return { status: 0 } as never;
      }) as never,
      env: { PYTHONPATH: "/already-there", OPENAI_API_KEY: "super-secret", RUHROH_EVAL_COMMAND: evalPath },
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
    assert.equal(spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND, "/installed-agent/local-commands/agent-two.mjs");
    assert.equal(spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND_INLINE_NAME, "agent-two.mjs");
    assert.equal(Buffer.from(spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64 ?? "", "base64").toString("utf8"), readFileSync(agentTwoPath, "utf8"));
    assert.equal(spawnEnvs[2]?.RUHROH_EVAL_COMMAND, "/installed-agent/local-commands/eval-agent.mjs");
    assert.equal(spawnEnvs[2]?.RUHROH_EVAL_COMMAND_INLINE_NAME, "eval-agent.mjs");
    assert.equal(Buffer.from(spawnEnvs[2]?.RUHROH_EVAL_COMMAND_INLINE_BASE64 ?? "", "base64").toString("utf8"), readFileSync(evalPath, "utf8"));
    assert.notEqual(spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64, spawnEnvs[2]?.RUHROH_EVAL_COMMAND_INLINE_BASE64);
    assert.equal(spawnArgs[2]?.includes(`RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64=${spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64}`), true);
    assert.equal(spawnArgs[2]?.includes(`RUHROH_EVAL_COMMAND_INLINE_BASE64=${spawnEnvs[2]?.RUHROH_EVAL_COMMAND_INLINE_BASE64}`), true);
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
    assert.doesNotMatch(runPlanText, /console\.log\('agent-two'\)|console\.log\('eval-agent'\)/u);
    assert.equal(runPlanText.includes(spawnEnvs[2]?.RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64 ?? "missing-run-payload"), false);
    assert.equal(runPlanText.includes(spawnEnvs[2]?.RUHROH_EVAL_COMMAND_INLINE_BASE64 ?? "missing-eval-payload"), false);
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

test("package Python runtime overwrites colliding inline command names", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-inline-command-collision-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const installed = path.join(tmp, "installed");
    const commandPath = path.join(installed, "local-commands", "run.sh");
    const adapterScript = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "printf '<article>One</article><article>Two</article><article>Three</article>' > \"$RUHROH_WORKSPACE_PATH/index.html\"",
      "printf '{\"status\":\"goal_satisfied\"}\\n' > \"$RUHROH_RESULT_PATH\"",
      "printf '{\"status\":\"goal_satisfied\"}\\n'",
      "",
    ].join("\n");
    const evaluatorScript = [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "test -f \"$RUHROH_EVAL_WORKSPACE_PATH/index.html\"",
      "cat > \"$RUHROH_EVAL_OUTPUT_PATH\" <<'JSON'",
      "{\"version\":\"ruhroh_eval_result_v1\",\"status\":\"passed\",\"goalMet\":true,\"confidence\":\"high\",\"reasons\":[\"ok\"],\"unmetCriteria\":[],\"evidenceRefs\":[{\"kind\":\"file\",\"ref\":\"index.html\",\"summary\":\"exists\"}],\"commandsRun\":[],\"artifacts\":{},\"finalSummary\":\"ok\",\"judge\":{\"kind\":\"command\",\"model\":\"fixture\"}}",
      "JSON",
      "",
    ].join("\n");
    const script = [
      "from pathlib import Path",
      "from ruhroh.loop_controller import run_ruhroh_trial",
      `result = run_ruhroh_trial('Build it', 'scenario', 1, Path(${JSON.stringify(workspace)}), Path(${JSON.stringify(installed)}))`,
      "manifest = result['runManifest']",
      "print(result['status'])",
      "print(result['evalResult']['status'])",
      "print(manifest['runAgent']['command']['inlineSha256'])",
      "print(manifest['evaluator']['command']['inlineSha256'])",
      "print(Path(manifest['artifactPaths']['evalResult']).exists())",
    ].join("\n");

    mkdirSync(workspace, { recursive: true });
    const result = spawnSync("python3", ["-c", script], {
      env: {
        ...process.env,
        PYTHONPATH: resolveRuhrohPythonPath(),
        RUHROH_RUN_AGENT_COMMAND: commandPath,
        RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64: Buffer.from(adapterScript, "utf8").toString("base64"),
        RUHROH_RUN_AGENT_COMMAND_INLINE_NAME: "run.sh",
        RUHROH_RUN_AGENT_ADAPTER: "custom-shell",
        RUHROH_EVAL_COMMAND: commandPath,
        RUHROH_EVAL_COMMAND_INLINE_BASE64: Buffer.from(evaluatorScript, "utf8").toString("base64"),
        RUHROH_EVAL_COMMAND_INLINE_NAME: "run.sh",
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), [
      "completed",
      "passed",
      sha256Text(adapterScript),
      sha256Text(evaluatorScript),
      "True",
    ]);
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
    path.resolve("examples", "adapters", "aider", "run.sh"),
    path.resolve("examples", "evaluators", "fixture-newsletter", "run.sh"),
  ];

  for (const script of scripts) {
    const result = spawnSync("bash", ["-n", script], { encoding: "utf8" });
    assert.equal(result.status, 0, `${script}\n${result.stderr}`);
  }
});

test("public live adapter templates emit valid escaped JSON metadata", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-adapter-json-"));
  try {
    const binDir = path.join(tmp, "bin");
    const workspace = path.join(tmp, "workspace with \"quotes\"");
    mkdirSync(binDir, { recursive: true });
    mkdirSync(workspace, { recursive: true });

    for (const binName of ["codex", "claude", "gemini", "aider"]) {
      const binPath = path.join(binDir, binName);
      writeFileSync(binPath, "#!/usr/bin/env bash\ncat >/dev/null || true\nprintf '%s stub\\n' \"$0\"\n", "utf8");
      chmodSync(binPath, 0o755);
    }

    const adapters = [
      {
        id: "codex-cli",
        script: path.resolve("examples", "adapters", "codex-cli", "run.sh"),
        modelEnv: "CODEX_MODEL",
        versionEnv: "CODEX_CLI_ADAPTER_VERSION",
        provider: "openai",
      },
      {
        id: "claude-code",
        script: path.resolve("examples", "adapters", "claude-code", "run.sh"),
        modelEnv: "CLAUDE_MODEL",
        versionEnv: "CLAUDE_CODE_ADAPTER_VERSION",
        provider: "anthropic",
      },
      {
        id: "gemini-cli",
        script: path.resolve("examples", "adapters", "gemini-cli", "run.sh"),
        modelEnv: "GEMINI_MODEL",
        versionEnv: "GEMINI_CLI_ADAPTER_VERSION",
        provider: "google",
      },
      {
        id: "aider",
        script: path.resolve("examples", "adapters", "aider", "run.sh"),
        modelEnv: "AIDER_MODEL",
        versionEnv: "AIDER_ADAPTER_VERSION",
        provider: "aider",
      },
    ];

    for (const adapter of adapters) {
      const resultPath = path.join(tmp, `${adapter.id}-result.json`);
      const model = `${adapter.id} "quoted" model`;
      const adapterVersion = `${adapter.id} "quoted" adapter`;
      const env = {
        ...process.env,
        PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
        RUHROH_WORKSPACE_PATH: workspace,
        RUHROH_MESSAGE: "Implement the \"quoted\" benchmark task.\nPreserve evidence.",
        RUHROH_ITERATION: "7",
        RUHROH_RESULT_PATH: resultPath,
        [adapter.modelEnv]: model,
        [adapter.versionEnv]: adapterVersion,
      };
      const result = spawnSync("bash", [adapter.script], { env, encoding: "utf8" });
      assert.equal(result.status, 0, `${adapter.id}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);

      const completion = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1) ?? "{}");
      const resultJson = JSON.parse(readFileSync(resultPath, "utf8"));
      assert.equal(completion.status, "goal_satisfied");
      assert.equal(resultJson.version, "ruhroh_run_agent_result_v1");
      assert.equal(resultJson.adapterVersion, adapterVersion);
      assert.deepEqual(resultJson.model, { provider: adapter.provider, model });
      assert.equal(resultJson.artifacts.prompt.includes(workspace), true);
      assert.match(readFileSync(resultJson.artifacts.prompt, "utf8"), /"quoted" benchmark task/u);
      assert.equal(existsSync(resultJson.artifacts.transcript), true);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
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
