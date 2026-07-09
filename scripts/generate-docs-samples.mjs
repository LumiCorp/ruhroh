import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleRoot = path.join(repoRoot, "docs", "public", "samples");
const resultsRoot = path.join(sampleRoot, "sample-results");
const scenarioRoot = path.join(sampleRoot, "ruhroh", "scenarios");
const suiteRoot = path.join(sampleRoot, "ruhroh", "suites");
const suiteDir = path.join(suiteRoot, "ruhroh-sample");
const adapterPath = path.join(sampleRoot, "ruhroh", "adapters", "fixture-newsletter", "run.sh");
const evaluatorPath = path.join(sampleRoot, "ruhroh", "evaluators", "fixture-newsletter", "run.sh");
const harborBinPath = path.join(sampleRoot, "bin", "harbor");
const generatedRoot = path.join(sampleRoot, ".generated", "ruhroh");
const runPlanPath = path.join(sampleRoot, "ruhroh-run-plan.json");
const publishBundlePath = path.join(sampleRoot, "ruhroh-publication");
const cliPath = path.join(repoRoot, "dist", "cli.js");
const publicSampleTimestamp = "2026-07-08T12:00:00.000Z";
const sampleBenchmarkTarget = {
  targetId: "docs-fixture-native-stack",
  stream: "native-stack",
  adapterId: "agent-a",
  harness: { name: "fixture-newsletter", version: "docs-sample-v1" },
  requestedModel: {
    provider: "docs",
    model: "sample-agent",
    canonicalId: "docs/sample-agent",
    version: "2026-07-08",
    protocol: "fixture-command",
    promptVersion: "docs-v1",
  },
  actualModel: {
    provider: "docs",
    model: "sample-agent",
    canonicalId: "docs/sample-agent",
    version: "2026-07-08",
    protocol: "fixture-command",
    promptVersion: "docs-v1",
  },
  providerPath: { provider: "docs", protocol: "fixture-command" },
  recommendedStack: { recommended: true, rationale: "Docs sample uses the maintained fixture adapter with its native fixture model." },
};

rmSync(sampleRoot, { recursive: true, force: true });
mkdirSync(resultsRoot, { recursive: true });
mkdirSync(suiteDir, { recursive: true });
writeSampleWorkspace();

writeJson(path.join(suiteDir, "suite.json"), {
  version: "ruhroh_suite_v1",
  id: "ruhroh-sample",
  title: "Ruhroh Sample Evidence Pack",
  suiteVersion: "0.1.0",
  description: "Small docs sample that demonstrates comparison, publish blockers, and evidence links.",
  scenarioIds: ["simple-newsletter"],
  scenarioVersions: { "simple-newsletter": "1.0.0" },
  methodology: {
    minRuns: 5,
    aggregationUnit: "scenario_adapter",
    reportPolicy: "pass_rate_ci_pass_at_k",
    confidenceLevel: 0.95,
    retryPolicy: "Docs sample only; real claims should collect the full planned run set.",
  },
  governance: {
    owner: "ruhroh-maintainers",
    createdAt: "2026-07-08",
    updatedAt: "2026-07-08",
    changelog: ["0.1.0: Initial docs sample."],
    acceptanceCriteria: ["Demonstrate evidence-backed compare output."],
    contaminationReview: "Docs sample uses synthetic example evidence.",
    rewardHackingReview: "Docs sample is not a publishable benchmark claim.",
    reviewChecklist: ["Inspect report links, publish blockers, and next actions."],
    deprecationPolicy: "Regenerate with scripts/generate-docs-samples.mjs when report contracts change.",
  },
});

writeSampleRun({
  runDir: path.join(resultsRoot, "run-one"),
  runId: "sample-newsletter-agent-a-1",
  sampleId: "simple-newsletter/agent-a/1-of-2",
  sampleSeed: "docs-seed-one",
  score: 1,
  status: "completed",
  failureKind: "none",
  failureBucket: "none",
  evalStatus: "passed",
  evalGoalMet: true,
  evalConfidence: "high",
  evalReasons: ["The workspace contains a newsletter page with three articles."],
  unmetCriteria: [],
  finalSummary: "The sample workspace satisfies the newsletter scenario.",
  timelineNote: "Implemented a static newsletter page and verified the article count.",
});

writeSampleRun({
  runDir: path.join(resultsRoot, "run-two"),
  runId: "sample-newsletter-agent-a-2",
  sampleId: "simple-newsletter/agent-a/2-of-2",
  sampleSeed: "docs-seed-two",
  score: 0,
  status: "failed",
  failureKind: "goal_mismatch",
  failureBucket: "goal_mismatch",
  evalStatus: "failed",
  evalGoalMet: false,
  evalConfidence: "high",
  evalReasons: ["The workspace has a page, but it only includes one article."],
  unmetCriteria: ["Newsletter must include three sample stories."],
  finalSummary: "The sample workspace is incomplete and does not satisfy the user outcome.",
  timelineNote: "Created a partial newsletter page but missed required story content.",
});

writeJson(runPlanPath, {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/run-plan-v1.schema.json",
  version: "ruhroh_run_plan_v1",
  createdAt: "2026-07-08T12:00:00Z",
  selection: {
    scenarioDir: samplePath("ruhroh", "scenarios"),
    suiteDir: samplePath("ruhroh", "suites"),
    suiteId: "ruhroh-sample",
    runs: 2,
    adapters: ["agent-a"],
    targets: [sampleBenchmarkTarget.targetId],
  },
  suite: {
    id: "ruhroh-sample",
    title: "Ruhroh Sample Evidence Pack",
    suiteVersion: "0.1.0",
    scenarioIds: ["simple-newsletter"],
    scenarioVersions: { "simple-newsletter": "1.0.0" },
    source: {
      suitePath: samplePath("ruhroh", "suites", "ruhroh-sample", "suite.json"),
      suiteSha256: sha256File(path.join(suiteDir, "suite.json")),
    },
  },
  generated: {
    generatedDir: samplePath(".generated", "ruhroh"),
    datasetPath: samplePath(".generated", "ruhroh", "harbor"),
  },
  scenarios: [{
    id: "simple-newsletter",
    title: "Simple Newsletter",
    tier: "smoke",
    scenarioVersion: "1.0.0",
  }],
  samples: [
    plannedSample(1, "docs-seed-one"),
    plannedSample(2, "docs-seed-two"),
  ],
});

const sampleScenario = JSON.parse(readFileSync(path.join(scenarioRoot, "simple-newsletter", "scenario.json"), "utf8"));
const sampleCalibrationCases = sampleScenario.evaluation.calibrationCases;
const calibrationReportPath = path.join(generatedRoot, "evaluator-calibration", "ruhroh-evaluator-calibration-report.json");
writeJson(calibrationReportPath, {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/eval-calibration-report-v1.schema.json",
  version: "ruhroh_eval_calibration_report_v1",
  source: {
    scenarioDir: samplePath("ruhroh", "scenarios"),
    generatedDir: samplePath(".generated", "ruhroh"),
    evaluatorCommand: samplePath("ruhroh", "evaluators", "fixture-newsletter", "run.sh"),
    reportPath: samplePathForFile(calibrationReportPath),
  },
  ok: true,
  scenarioCount: 1,
  caseCount: sampleCalibrationCases.length,
  matchedCount: sampleCalibrationCases.length,
  mismatchCount: 0,
  infraFailedCount: 0,
  warnings: [],
  nextActions: [],
  results: sampleCalibrationCases.map((calibrationCase) => writeSampleCalibrationCase(calibrationCase)),
});

const sampleCwd = { cwd: sampleRoot };

runCli(["report", path.join("sample-results", "run-one"), "--html", "ruhroh-report.html"], sampleCwd);
const reviewQueue = runCli([
  "review",
  "sample-results",
  "--html",
  "ruhroh-review.html",
  "--json",
], sampleCwd);
writeFileSync(path.join(sampleRoot, "ruhroh-review.json"), reviewQueue.stdout, "utf8");
const evalQuality = runCli([
  "eval-quality",
  "sample-results",
  "--html",
  "ruhroh-eval-quality.html",
  "--json",
], { ...sampleCwd, allowStatus: 2 });
writeFileSync(path.join(sampleRoot, "ruhroh-eval-quality.json"), evalQuality.stdout, "utf8");
runCli([
  "compare",
  "sample-results",
  "--suite-dir",
  "ruhroh/suites",
  "--suite",
  "ruhroh-sample",
  "--run-plan",
  "ruhroh-run-plan.json",
  "--html",
  "ruhroh-compare.html",
  "--benchmark-claim",
  "benchmark-claim.json",
  "--benchmark-summary",
  "benchmark-summary.json",
], sampleCwd);
const publishCheck = runCli([
  "publish-check",
  "sample-results",
  "--suite-dir",
  "ruhroh/suites",
  "--suite",
  "ruhroh-sample",
  "--run-plan",
  "ruhroh-run-plan.json",
  "--generated-dir",
  ".generated/ruhroh",
  "--benchmark-claim",
  "benchmark-claim.json",
  "--benchmark-summary",
  "benchmark-summary.json",
  "--bundle",
  "ruhroh-publication",
  "--verify-sources",
  "--json",
], { ...sampleCwd, allowStatus: 2 });
writeFileSync(path.join(sampleRoot, "publish-check.json"), publishCheck.stdout, "utf8");
assertPublishCheckSample(JSON.parse(publishCheck.stdout));
assertCleanSourceVerification(JSON.parse(publishCheck.stdout));
const publishBundleValidation = runCli([
  "validate-bundle",
  "ruhroh-publication",
  "--json",
], { ...sampleCwd, allowStatus: 2 });
writeFileSync(path.join(sampleRoot, "publish-bundle-validation.json"), publishBundleValidation.stdout, "utf8");
assertCleanBundleValidation(JSON.parse(publishBundleValidation.stdout));
const claimIndex = runCli([
  "claim-index",
  "ruhroh-publication",
  "--html",
  "ruhroh-claims.html",
  "--json",
], sampleCwd);
writeFileSync(path.join(sampleRoot, "claim-index.json"), claimIndex.stdout, "utf8");
assertClaimIndex(JSON.parse(claimIndex.stdout));
runCli([
  "workflow",
  "sample-results",
  "--suite",
  "ruhroh-sample",
  "--run-plan",
  "ruhroh-run-plan.json",
  "--generated-dir",
  ".generated/ruhroh",
  "--harbor-bin",
  "bin/harbor",
  "--html",
  "ruhroh-workflow.html",
], {
  cwd: sampleRoot,
  env: {
    RUHROH_RUN_AGENT_COMMAND: adapterPath,
    RUHROH_EVAL_COMMAND: evaluatorPath,
  },
});
assertWorkflowSample(readFileSync(path.join(sampleRoot, "ruhroh-workflow.html"), "utf8"));
assertPublicHtmlDoesNotLeakLocalPaths();
scrubPublicSampleTextArtifacts();
refreshScrubbedPublicSampleHashes();
refreshScrubbedPublishBundleHashes();
assertPublishCheckSample(JSON.parse(readFileSync(path.join(sampleRoot, "publish-check.json"), "utf8")));
assertPublishBundleManifestSample(JSON.parse(readFileSync(path.join(publishBundlePath, "manifest.json"), "utf8")));
assertPublishCheckSample(JSON.parse(readFileSync(path.join(publishBundlePath, "publish-check.json"), "utf8")));
assertBenchmarkTargetSample(JSON.parse(readFileSync(path.join(sampleRoot, "benchmark-claim.json"), "utf8")));
const scrubbedPublishBundleValidation = runCli([
  "validate-bundle",
  "ruhroh-publication",
  "--json",
], { ...sampleCwd, allowStatus: 2 });
writeFileSync(path.join(sampleRoot, "publish-bundle-validation.json"), scrubPublicJsonText(scrubbedPublishBundleValidation.stdout), "utf8");
assertCleanBundleValidation(JSON.parse(scrubbedPublishBundleValidation.stdout));
assertPublicSamplesDoNotLeakLocalPaths();

function writeSampleWorkspace() {
  const scenarioDir = path.join(scenarioRoot, "simple-newsletter");
  mkdirSync(scenarioDir, { recursive: true });
  copyFileSync(path.join(repoRoot, "examples", "scenarios", "simple-newsletter", "scenario.json"), path.join(scenarioDir, "scenario.json"));
  copyFileSync(path.join(repoRoot, "examples", "scenarios", "simple-newsletter", "instruction.md"), path.join(scenarioDir, "instruction.md"));
  mkdirSync(path.dirname(adapterPath), { recursive: true });
  copyFileSync(path.join(repoRoot, "examples", "adapters", "fixture-newsletter", "run.sh"), adapterPath);
  chmodSync(adapterPath, 0o755);
  mkdirSync(path.dirname(evaluatorPath), { recursive: true });
  copyFileSync(path.join(repoRoot, "examples", "evaluators", "fixture-newsletter", "run.sh"), evaluatorPath);
  chmodSync(evaluatorPath, 0o755);
  mkdirSync(path.dirname(harborBinPath), { recursive: true });
  writeFileSync(harborBinPath, "#!/usr/bin/env bash\nprintf 'harbor docs-sample\\n'\n", "utf8");
  chmodSync(harborBinPath, 0o755);
}

function writeSampleRun(input) {
  mkdirSync(input.runDir, { recursive: true });
  const resultPath = path.join(input.runDir, "ruhroh-loop-result.json");
  const manifestPath = path.join(input.runDir, "ruhroh-run-manifest.json");
  const evalPath = path.join(input.runDir, "ruhroh-loop-eval.json");
  const workspaceSummaryPath = path.join(input.runDir, "ruhroh-workspace-summary.json");
  const iterationsPath = path.join(input.runDir, "ruhroh-loop-iterations.jsonl");
  const journeyPath = path.join(input.runDir, "ruhroh-loop-journey.json");
  const evalInputPath = path.join(input.runDir, "ruhroh-loop-eval-input.json");
  const transcriptPath = path.join(input.runDir, "transcript.log");
  const eventLogPath = path.join(input.runDir, "events.jsonl");
  const workspaceTarballPath = path.join(input.runDir, "ruhroh-workspace.tar.gz");
  const eventsTarballPath = path.join(input.runDir, "ruhroh-loop-events.tar.gz");
  const transcriptsTarballPath = path.join(input.runDir, "ruhroh-loop-transcripts.tar.gz");
  const transcriptPublicPath = samplePathForFile(transcriptPath);
  const eventLogPublicPath = samplePathForFile(eventLogPath);
  const artifactPaths = {
    result: samplePathForFile(resultPath),
    runManifest: samplePathForFile(manifestPath),
    evalResult: samplePathForFile(evalPath),
    workspaceSummary: samplePathForFile(workspaceSummaryPath),
    implementationRuns: samplePathForFile(iterationsPath),
    journey: samplePathForFile(journeyPath),
    evalInput: samplePathForFile(evalInputPath),
    transcript: transcriptPublicPath,
    events: eventLogPublicPath,
    workspaceTarball: samplePathForFile(workspaceTarballPath),
    eventsTarball: samplePathForFile(eventsTarballPath),
    transcriptsTarball: samplePathForFile(transcriptsTarballPath),
  };

  const evalResult = {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
    version: "ruhroh_eval_result_v1",
    status: input.evalStatus,
    goalMet: input.evalGoalMet,
    confidence: input.evalConfidence,
    reasons: input.evalReasons,
    unmetCriteria: input.unmetCriteria,
    evidenceRefs: [
      { kind: "file", ref: "index.html", summary: input.finalSummary },
      { kind: "command", ref: "fixture article-count", summary: `status=${input.evalStatus}` },
    ],
    commandsRun: [
      { command: "fixture article-count", exitCode: input.evalStatus === "passed" ? 0 : 1, summary: input.finalSummary },
    ],
    artifacts: { workspacePath: "/docs/sample/workspace" },
    finalSummary: input.finalSummary,
    criteriaResults: [{
      id: "newsletter-outcome",
      description: "The delivered workspace contains a newsletter page with three stories.",
      status: input.evalStatus === "passed" ? "passed" : "failed",
      score: input.score,
      evidenceRefs: [{ kind: "file", ref: "index.html", summary: input.finalSummary }],
    }],
    subscores: {
      functionality: input.score,
      workflow: input.score,
      buildRun: 1,
      persistence: 0,
      constraintCompliance: input.score,
      evidenceQuality: 1,
    },
    judge: { kind: "hybrid", model: "docs-fixture-evaluator", version: "2026-07-08" },
    judgeVotes: [{
      judge: { kind: "command", model: "docs-fixture-evaluator", version: "2026-07-08" },
      status: input.evalStatus,
      confidence: input.evalConfidence,
      rationale: input.finalSummary,
      evidenceRefs: [{ kind: "file", ref: "index.html", summary: input.finalSummary }],
    }, {
      judge: { kind: "model", model: "docs-arbiter", version: "2026-07-08" },
      status: input.evalStatus,
      confidence: input.evalConfidence,
      rationale: input.finalSummary,
      evidenceRefs: [{ kind: "command", ref: "fixture article-count", summary: `status=${input.evalStatus}` }],
    }],
  };
  const runManifest = {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/run-manifest-v1.schema.json",
    version: "ruhroh_run_manifest_v1",
    runId: input.runId,
    scenario: { id: "simple-newsletter", scenarioVersion: "1.0.0" },
    benchmark: { dataset: "ruhroh-docs-sample", adapter: "ruhroh-harbor", harborAgent: "ruhroh-harbor" },
    timing: { startedAt: "2026-07-08T12:00:00Z", endedAt: "2026-07-08T12:01:00Z", durationMs: 60000 },
    loop: { maxIterations: 3, implementationIterationsUsed: 1, stoppedReason: "goal_satisfied" },
    sample: { id: input.sampleId, index: input.sampleId.endsWith("1-of-2") ? 1 : 2, count: 2, seed: input.sampleSeed },
    runAgent: {
      adapterId: "agent-a",
      adapterVersion: "docs-sample-v1",
      continuityLevel: "workspace_only",
      sessionHandle: input.runId,
      runIds: [input.runId],
      model: { provider: "docs", model: "sample-agent", canonicalId: "docs/sample-agent", version: "2026-07-08", promptVersion: "docs-v1" },
    },
    evaluator: {
      model: {
        provider: "docs",
        model: "docs-fixture-evaluator",
        version: "2026-07-08",
        promptVersion: "docs-eval-v1",
      },
      inputSummary: {
        scenarioId: "simple-newsletter",
        rubricSha256: "2".repeat(64),
        privateAssetsSha256: "3".repeat(64),
      },
      judge: { kind: "hybrid", model: "docs-fixture-evaluator", version: "2026-07-08" },
    },
    environment: { fingerprint: { sha256: "1".repeat(64), source: "docs sample" } },
    usage: { costUsd: input.score === 1 ? 0.03 : 0.02, totalTokens: input.score === 1 ? 900 : 700 },
    benchmarkTarget: cloneJson(sampleBenchmarkTarget),
  };
  const result = {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/loop-result-v1.schema.json",
    version: "ruhroh_loop_result_v1",
    runId: input.runId,
    adapter: "ruhroh-harbor",
    dataset: "ruhroh-docs-sample",
    scenarioId: "simple-newsletter",
    task_id: "simple-newsletter",
    status: input.status,
    failure_kind: input.failureKind,
    failureBucket: input.failureBucket,
    score: input.score,
    iterationsUsed: 1,
    implementationIterationsUsed: 1,
    implementationStoppedReason: "goal_satisfied",
    stoppedReason: "goal_satisfied",
    duration_ms: 60000,
    runAgent: {
      adapterId: "agent-a",
      adapterVersion: "docs-sample-v1",
      continuityLevel: "workspace_only",
      sessionHandle: input.runId,
      runIds: [input.runId],
      transcriptPaths: [transcriptPublicPath],
      eventLogPaths: [eventLogPublicPath],
      artifactPaths: {},
    },
    runAgentAdapterId: "agent-a",
    continuityLevel: "workspace_only",
    sessionHandle: input.runId,
    runIds: [input.runId],
    implementationRuns: [{
      iteration: 1,
      adapterId: "agent-a",
      status: input.status,
      failureKind: input.failureKind,
      completionStatus: { state: "done", reason: "goal_satisfied" },
      stopReason: "goal_satisfied",
      runId: input.runId,
      transcriptPath: transcriptPublicPath,
      eventLogPath: eventLogPublicPath,
      notes: input.timelineNote,
    }],
    evalResult,
    runManifest,
    artifactPaths,
  };

  writeJson(resultPath, result);
  writeJson(manifestPath, runManifest);
  writeJson(evalPath, evalResult);
  writeJson(workspaceSummaryPath, {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/workspace-summary-v1.schema.json",
    version: "ruhroh_workspace_summary_v1",
    generatedAt: "2026-07-08T12:01:00Z",
    workspaceRoot: "/docs/sample/workspace",
    exists: true,
    totalFiles: 2,
    totalDirectories: 0,
    totalBytes: 128,
    topLevelEntries: [{ path: "index.html", type: "file" }, { path: "README.md", type: "file" }],
    projectMarkers: ["README.md"],
    sampleFiles: [{ path: "index.html", sizeBytes: 96 }, { path: "README.md", sizeBytes: 32 }],
    truncated: false,
  });
  writeFileSync(iterationsPath, `${JSON.stringify(result.implementationRuns[0])}\n`, "utf8");
  writeJson(journeyPath, { version: "ruhroh_implementation_journey_v1", runId: input.runId, summary: input.timelineNote });
  writeJson(evalInputPath, { version: "ruhroh_eval_input_v1", scenarioId: "simple-newsletter", workspacePath: "/docs/sample/workspace" });
  writeFileSync(transcriptPath, `${input.timelineNote}\n`, "utf8");
  writeFileSync(eventLogPath, `${JSON.stringify({ event: "sample", runId: input.runId })}\n`, "utf8");
  writeFileSync(workspaceTarballPath, `sample workspace archive for ${input.runId}\n`, "utf8");
  writeFileSync(eventsTarballPath, `sample event archive for ${input.runId}\n`, "utf8");
  writeFileSync(transcriptsTarballPath, `sample transcript archive for ${input.runId}\n`, "utf8");
}

function plannedSample(index, seed) {
  return {
    label: `agent-a:simple-newsletter#${index}/2`,
    scenarioId: "simple-newsletter",
    adapter: "agent-a",
    sampleId: `simple-newsletter/agent-a/${index}-of-2`,
    sampleSeed: seed,
    runIndex: index,
    runCount: 2,
    forwardedEnvKeys: ["RUHROH_SAMPLE_ID"],
    harborCommand: { bin: "harbor", args: [], display: "harbor run ..." },
    benchmarkTarget: cloneJson(sampleBenchmarkTarget),
  };
}

function writeSampleCalibrationCase(calibrationCase) {
  const caseDir = path.join(generatedRoot, "evaluator-calibration", calibrationCase.id);
  const workspacePath = path.join(caseDir, "workspace");
  const inputPath = path.join(caseDir, "ruhroh-eval-calibration-input.json");
  const outputPath = path.join(caseDir, "ruhroh-loop-eval.json");
  mkdirSync(workspacePath, { recursive: true });
  writeFileSync(
    path.join(workspacePath, "CALIBRATION.md"),
    [
      `# ${calibrationCase.id}`,
      "",
      calibrationCase.inputSummary,
      "",
      `Expected status: ${calibrationCase.expectedStatus}`,
      "",
      calibrationCase.rationale,
      "",
    ].join("\n"),
    "utf8",
  );
  writeJson(inputPath, {
    version: "ruhroh_eval_calibration_input_v1",
    scenarioId: "simple-newsletter",
    calibrationCase,
    workspacePath: samplePathForFile(workspacePath),
  });
  writeJson(outputPath, {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
    version: "ruhroh_eval_result_v1",
    status: calibrationCase.expectedStatus,
    goalMet: calibrationCase.expectedStatus === "passed",
    confidence: "high",
    reasons: [`Docs sample calibration case ${calibrationCase.id} matched ${calibrationCase.expectedStatus}.`],
    unmetCriteria: calibrationCase.expectedStatus === "passed" ? [] : [calibrationCase.rationale],
    evidenceRefs: [{ kind: "file", ref: "CALIBRATION.md", summary: calibrationCase.inputSummary }],
    commandsRun: [],
    artifacts: { workspacePath: samplePathForFile(workspacePath) },
    finalSummary: calibrationCase.rationale,
    criteriaResults: [{
      id: "calibration-anchor",
      description: "Reviewer calibration anchor.",
      status: calibrationCase.expectedStatus,
      score: calibrationCase.expectedStatus === "passed" ? 1 : 0,
      evidenceRefs: [{ kind: "file", ref: "CALIBRATION.md", summary: calibrationCase.rationale }],
    }],
    judge: { kind: "command", model: "docs-fixture-evaluator", version: "2026-07-08" },
  });
  return {
    scenarioId: "simple-newsletter",
    caseId: calibrationCase.id,
    expectedStatus: calibrationCase.expectedStatus,
    actualStatus: calibrationCase.expectedStatus,
    matched: true,
    outputPath: samplePathForFile(outputPath),
    inputPath: samplePathForFile(inputPath),
    workspacePath: samplePathForFile(workspacePath),
    details: `Synthetic docs sample calibration anchor ${calibrationCase.id} matched ${calibrationCase.expectedStatus}.`,
  };
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function samplePath(...segments) {
  return `./${path.posix.join(...segments)}`;
}

function samplePathForFile(filePath) {
  return samplePath(...path.relative(sampleRoot, filePath).split(path.sep));
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
  });
  const allowed = new Set([0, options.allowStatus].filter((item) => item !== undefined));
  if (!allowed.has(result.status)) {
    throw new Error(`ruhroh ${args.join(" ")} failed with ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

function assertCleanSourceVerification(report) {
  const sourceVerification = report.sourceVerification;
  if (sourceVerification === undefined) {
    throw new Error("docs sample publish-check did not include source verification");
  }
  if (sourceVerification.errors.length > 0 || sourceVerification.warnings.length > 0) {
    throw new Error([
      "docs sample publish-check source verification must be clean",
      ...sourceVerification.errors,
      ...sourceVerification.warnings,
    ].join("\n"));
  }
}

function assertPublishCheckSample(report) {
  if (report.$schema !== "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json") {
    throw new Error("docs sample publish-check must include the publish-check schema URL");
  }
  if (report.version !== "ruhroh_publish_check_v1") {
    throw new Error("docs sample publish-check must be versioned as ruhroh_publish_check_v1");
  }
  if (report.compare?.version !== "ruhroh_compare_v1") {
    throw new Error("docs sample publish-check must embed compare output");
  }
  if (!Array.isArray(report.remediation) || report.remediation.length === 0) {
    throw new Error("docs sample publish-check must include remediation actions");
  }
}

function assertPublishBundleManifestSample(report) {
  if (report.$schema !== "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json") {
    throw new Error("docs sample publication packet manifest must include the publish-bundle schema URL");
  }
  if (report.version !== "ruhroh_publish_bundle_v1") {
    throw new Error("docs sample publication packet manifest must be versioned as ruhroh_publish_bundle_v1");
  }
  if (!Array.isArray(report.files) || !report.files.some((file) => file.role === "publish-check")) {
    throw new Error("docs sample publication packet manifest must list the bundled publish-check file");
  }
}

function assertCleanBundleValidation(report) {
  if (report.valid !== true || report.errors.length > 0 || report.warnings.length > 0) {
    throw new Error([
      "docs sample publication packet must be structurally valid without validation warnings",
      ...report.errors,
      ...report.warnings,
    ].join("\n"));
  }
}

function assertClaimIndex(report) {
  if (report.$schema !== "https://lumicorp.github.io/ruhroh/schemas/claim-index-v1.schema.json") {
    throw new Error("docs sample claim index must include the claim-index schema URL");
  }
  if (report.version !== "ruhroh_claim_index_v1" || report.claimCount !== 1 || report.invalidCount !== 0) {
    throw new Error("docs sample claim index must contain one valid claim");
  }
  if (!Array.isArray(report.claims) || report.claims[0]?.bundlePath === undefined) {
    throw new Error("docs sample claim index must point at the publication packet");
  }
  const context = report.claims[0]?.benchmarkContext;
  if (!context?.streams?.includes("native-stack") || !context?.targets?.includes(sampleBenchmarkTarget.targetId)) {
    throw new Error("docs sample claim index must expose benchmark stream and target context");
  }
  const claimsHtml = readFileSync(path.join(sampleRoot, "ruhroh-claims.html"), "utf8");
  if (!claimsHtml.includes("Benchmark context") || !claimsHtml.includes("target=docs-fixture-native-stack")) {
    throw new Error("docs sample claim index HTML must expose benchmark context");
  }
}

function assertBenchmarkTargetSample(claim) {
  const artifactTarget = claim.source?.resultArtifacts?.[0]?.benchmarkTarget;
  if (artifactTarget?.targetId !== sampleBenchmarkTarget.targetId) {
    throw new Error("docs sample benchmark claim must preserve the source artifact benchmark target");
  }
  const cohort = claim.scenarioResults?.[0]?.cohort;
  if (!cohort?.benchmarkStreams?.includes("native-stack") || !cohort?.benchmarkTargets?.includes(sampleBenchmarkTarget.targetId)) {
    throw new Error("docs sample benchmark claim must summarize concrete benchmark target cohort metadata");
  }
  const compareHtml = readFileSync(path.join(sampleRoot, "ruhroh-compare.html"), "utf8");
  for (const expected of [
    "Stack</strong>: target=docs-fixture-native-stack",
    "Benchmark target",
    "stream=native-stack",
    "harness=fixture-newsletter@docs-sample-v1",
    "requested=docs/sample-agent",
    "actual=docs/sample-agent",
    "providerPath=provider=docs|protocol=fixture-command",
  ]) {
    if (!compareHtml.includes(expected)) {
      throw new Error(`docs sample compare HTML must include benchmark target detail: ${expected}`);
    }
  }
}

function assertWorkflowSample(html) {
  if (!html.includes("ruhroh-loop-result.json file(s) found for first-loop inspection")) {
    throw new Error("docs sample workflow must show a preserved first-loop result artifact");
  }
  if (!html.includes("pnpm exec ruhroh report sample-results/run-one/ruhroh-loop-result.json --html ruhroh-report.html")) {
    throw new Error("docs sample workflow must point reviewers at the first-loop report command");
  }
  if (!html.includes("publication packet inventory exists")) {
    throw new Error("docs sample workflow must show the generated publication packet");
  }
  if (!html.includes("claim-index.json exists but registry is blocked")) {
    throw new Error("docs sample workflow must show the generated claim index readiness gate");
  }
  if (!html.includes('<strong>Next action</strong><span class="fail">Publish an audit-ready benchmark result</span>')) {
    throw new Error("docs sample workflow must show blocked publication readiness for the synthetic sample");
  }
  if (!html.includes("Publication packet is valid but embedded publish-check or ready-to-publish checks are blocked.")) {
    throw new Error("docs sample workflow must show bundle validation readiness details");
  }
  if (html.includes("No benchmark-claim.json or ruhroh-publication packet has been written yet.")) {
    throw new Error("docs sample workflow must not show stale missing-publication guidance");
  }
  if (html.includes("missing local fixture file(s)") || html.includes("RUHROH_RUN_AGENT_COMMAND is not set")) {
    throw new Error("docs sample workflow must not show stale first-run setup failures");
  }
}

function assertPublicHtmlDoesNotLeakLocalPaths() {
  const files = [
    "ruhroh-workflow.html",
    "ruhroh-report.html",
    "ruhroh-review.html",
    "ruhroh-eval-quality.html",
    "ruhroh-compare.html",
    "ruhroh-claims.html",
  ];
  for (const file of files) {
    const html = readFileSync(path.join(sampleRoot, file), "utf8");
    if (html.includes(repoRoot) || html.includes(sampleRoot)) {
      throw new Error(`docs sample ${file} must not include local absolute paths`);
    }
  }
}

function scrubPublicSampleTextArtifacts() {
  for (const file of walkFiles(sampleRoot)) {
    if (!isPublicTextArtifact(file)) {
      continue;
    }
    writeFileSync(file, scrubPublicText(readFileSync(file, "utf8")), "utf8");
  }
}

function scrubPublicJsonText(value) {
  return `${JSON.stringify(scrubPublicValue(JSON.parse(value)), null, 2)}\n`;
}

function scrubPublicValue(value) {
  if (typeof value === "string") {
    return scrubPublicText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubPublicValue(item));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubPublicValue(item)]));
  }
  return value;
}

function scrubPublicText(value) {
  return value
    .split(sampleRoot).join(".")
    .split(repoRoot).join("ruhroh-package")
    .replace(/"(createdAt|generatedAt)": "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z"/gu, `"$1": "${publicSampleTimestamp}"`)
    .replace(/^Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/gmu, `Generated: ${publicSampleTimestamp}`)
    .replace(/[ \t]+$/gm, "");
}

function isPublicTextArtifact(file) {
  return [
    ".html",
    ".json",
    ".jsonl",
    ".log",
    ".md",
    ".sh",
    ".txt",
  ].some((extension) => file.endsWith(extension));
}

function refreshScrubbedPublicSampleHashes() {
  refreshScrubbedClaimArtifacts(sampleRoot);
}

function refreshScrubbedPublishBundleHashes() {
  refreshScrubbedClaimArtifacts(publishBundlePath);
}

function refreshScrubbedClaimArtifacts(basePath) {
  const claimPath = path.join(basePath, "benchmark-claim.json");
  const summaryPath = path.join(basePath, "benchmark-summary.json");
  const publishCheckPath = path.join(basePath, "publish-check.json");
  const claim = JSON.parse(readFileSync(claimPath, "utf8"));
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const publishCheck = JSON.parse(readFileSync(publishCheckPath, "utf8"));
  refreshClaimSourceHashes(claim, basePath);
  refreshClaimSourceHashes(summary, basePath);
  if (publishCheck.compare?.benchmarkClaim !== undefined) {
    publishCheck.compare.benchmarkClaim = claim;
  }
  if (publishCheck.compare?.benchmarkSummary !== undefined) {
    publishCheck.compare.benchmarkSummary = summary;
  }
  writeJson(claimPath, claim);
  writeJson(summaryPath, summary);
  writeJson(publishCheckPath, publishCheck);
}

function refreshClaimSourceHashes(claim, basePath) {
  const source = claim.source;
  if (source === undefined || source === null || typeof source !== "object") {
    return;
  }
  refreshSourceHash(source, "suitePath", "suiteSha256", basePath);
  refreshSourceHash(source, "runPlanPath", "runPlanSha256", basePath);
  refreshSourceHash(source, "rerunLedgerPath", "rerunLedgerSha256", basePath);
  refreshSourceHash(source, "evaluatorCalibrationReportPath", "evaluatorCalibrationReportSha256", basePath);
  if (!Array.isArray(source.resultArtifacts)) {
    return;
  }
  for (const artifact of source.resultArtifacts) {
    if (artifact === null || typeof artifact !== "object") {
      continue;
    }
    refreshPathHash(artifact, basePath);
    if (!Array.isArray(artifact.artifactInventory)) {
      continue;
    }
    for (const item of artifact.artifactInventory) {
      if (item !== null && typeof item === "object") {
        refreshPathHash(item, basePath);
      }
    }
  }
}

function refreshSourceHash(source, pathField, hashField, basePath) {
  if (typeof source[pathField] !== "string") {
    return;
  }
  source[hashField] = sha256File(resolvePublicArtifactPath(source[pathField], basePath));
}

function refreshPathHash(item, basePath) {
  if (typeof item.path !== "string") {
    return;
  }
  const resolved = resolvePublicArtifactPath(item.path, basePath);
  item.sha256 = sha256File(resolved);
  item.sizeBytes = statSync(resolved).size;
}

function resolvePublicArtifactPath(itemPath, basePath) {
  return path.isAbsolute(itemPath) ? itemPath : path.join(basePath, itemPath);
}

function assertPublicSamplesDoNotLeakLocalPaths() {
  const leaks = [];
  for (const file of walkFiles(sampleRoot)) {
    const text = readFileSync(file, "utf8");
    if (text.includes(repoRoot) || text.includes(sampleRoot)) {
      leaks.push(path.relative(sampleRoot, file));
    }
  }
  if (leaks.length > 0) {
    throw new Error(`docs public samples must not include local absolute paths: ${leaks.join(", ")}`);
  }
}

function walkFiles(root) {
  const entries = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkFiles(entryPath));
    } else if (entry.isFile()) {
      entries.push(entryPath);
    }
  }
  return entries;
}
