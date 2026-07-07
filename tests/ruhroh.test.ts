import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  adapterSatisfiesRequirements,
  buildAgentEnvArgs,
  buildRuhrohHarborCommand,
  deriveRuhrohVerdict,
  discoverRuhrohScenarios,
  aggregateRuhrohRuns,
  generateHarborDataset,
  generateHarborTask,
  loadRuhrohScenario,
  mapEvalResultToVerdict,
  normalizeRuhrohEvalResult,
  redactEnvAssignment,
  scoreForEvalStatus,
  summarizeRuhrohRun,
  validateRuhrohScenario,
  validateRuhrohScenarioSource,
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

test("scenario validation accepts portable v2 scenarios", () => {
  assert.deepEqual(
    validateRuhrohScenario(scenario(), { adapters: { kestrel: kestrelCapabilities } }),
    [],
  );
});

test("scenario validation rejects adapter identity in v2 scenarios", () => {
  const errors = validateRuhrohScenario({
    ...scenario(),
    driver: { adapter: "kestrel", timeoutSeconds: 300 },
  }).join("\n");

  assert.match(errors, /driver is not allowed in ruhroh_scenario_v2/u);
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
  });

  assert.equal(enriched.status, "failed");
  assert.equal(enriched.criteriaResults?.[0]?.score, 0.5);
  assert.equal(enriched.subscores?.functionality, 0.25);
  assert.equal(enriched.subscores?.evidenceQuality, 1);
  assert.deepEqual(enriched.judge, { kind: "hybrid", model: "eval-model", version: "2026-07-07" });
  assert.equal(mapEvalResultToVerdict(enriched).score, 0);
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
    scenario: scenario(),
    adapter: "kestrel",
    datasetPath: path.resolve("/repo", ".generated/ruhroh/harbor"),
    iterations: 2,
    env: { OPENROUTER_API_KEY: "secret" },
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
  assert.equal(command.args.includes("RUHROH_EVAL_GOAL_RUBRIC_JSON=[\"The app satisfies the user goal.\"]"), true);
  assert.equal(command.args.includes("OPENROUTER_API_KEY=${OPENROUTER_API_KEY}"), true);
  assert.equal(command.args.includes("/installed-agent/ruhroh-loop-eval-input.json"), true);
  assert.equal(command.args.filter((arg) => arg === "--artifact").length, 9);
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
      },
    }));

    const result = validateRuhrohScenarioSource(scenarioDir);
    assert.match(result.errors.join("\n"), /declared asset does not exist/u);
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
    writeFileSync(path.join(scenarioDir, "assets", "budget.csv"), "category,amount\nfood,42\n");

    const result = generateHarborTask({
      scenario: scenario({
        version: "ruhroh_scenario_v2",
        id: "grocery-budget-planner",
        title: "Grocery Budget Planner",
        userPrompt: "Build a grocery budget planner.",
        run: { timeoutSeconds: 600 },
        requires: { continuity: "workspace_only", tools: ["filesystem", "shell"], network: false },
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
    assert.match(taskToml, /network_mode = "none"/u);
    assert.equal(existsSync(path.join(result.taskDir, "environment", "Dockerfile")), true);
    assert.equal(existsSync(path.join(result.taskDir, "solution", "solve.sh")), true);
    assert.equal(readFileSync(path.join(result.taskDir, "assets", "budget.csv"), "utf8"), "category,amount\nfood,42\n");
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
  });

  const summary = summarizeRuhrohRun(passedRun);
  assert.equal(summary.evalStatus, "passed");
  assert.equal(summary.commandsRun[0]?.command, "npm test");

  const aggregate = aggregateRuhrohRuns([passedRun, failedRun]);
  assert.equal(aggregate[0]?.runs, 2);
  assert.equal(aggregate[0]?.passRate, 0.5);
  assert.equal(aggregate[0]?.meanSubscores.functionality, 0.5);
  assert.equal(aggregate[0]?.medianDurationMs, 2000);
});

test("public CLI reports and compares run artifacts", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-report-"));
  try {
    const runOne = path.join(tmp, "run-one");
    const runTwo = path.join(tmp, "run-two");
    mkdirSync(runOne, { recursive: true });
    mkdirSync(runTwo, { recursive: true });
    writeFileSync(path.join(runOne, "ruhroh-loop-result.json"), JSON.stringify(loopResultFixture({
      scenarioId: "simple-newsletter",
      runAgentAdapterId: "agent-a",
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
        evidenceRefs: [],
        commandsRun: [],
        artifacts: {},
        finalSummary: "Delivered.",
      },
    })));
    writeFileSync(path.join(runTwo, "ruhroh-loop-result.json"), JSON.stringify(loopResultFixture({
      scenarioId: "simple-newsletter",
      runAgentAdapterId: "agent-a",
      score: 0,
      status: "failed",
      failure_kind: "goal_mismatch",
      failureBucket: "goal_mismatch",
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

    const reportStdout: string[] = [];
    const reportCode = await runRuhrohCli(["report", "run-one", "--json"], {
      spawn: (() => assert.fail("report should not spawn Harbor")) as never,
      env: {},
      cwd: tmp,
      stdout: { write: (chunk: string) => { reportStdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });
    assert.equal(reportCode, 0);
    assert.equal(JSON.parse(reportStdout.join("")).summary.evalStatus, "passed");

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
    const code = await runRuhrohCli(["--scenario-dir", "ruhroh/scenarios", "--scenario", "simple-newsletter", "--adapter", "custom-shell", "--dry-run"], {
      spawn: (() => assert.fail("dry-run should not spawn Harbor")) as never,
      env: { OPENAI_API_KEY: "secret" },
      cwd: tmp,
      stdout: { write: (chunk: string) => { stdout.push(chunk); return true; } },
      stderr: { write: () => true },
    });

    const output = stdout.join("");
    assert.equal(code, 0);
    assert.match(output, /RUHROH_RUN_AGENT_ADAPTER=custom-shell/u);
    assert.match(output, /ruhroh\.harbor_agent:RuhrohHarborAgent/u);
    assert.match(output, /OPENAI_API_KEY=\$\{OPENAI_API_KEY\}/u);
    assert.doesNotMatch(output, /secret/u);
    assert.doesNotMatch(output, /benchmarks\.ralph_loop|\/opt\/kestrel-harness|kestrel-harness\.tar\.gz/u);
    assert.equal(existsSync(path.join(tmp, ".generated", "ruhroh", "harbor", "tasks", "simple-newsletter", "task.toml")), false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("public CLI spawns Harbor with package Python runtime importable", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-cli-pythonpath-"));
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

    let spawnEnv: NodeJS.ProcessEnv | undefined;
    const code = await runRuhrohCli(["--scenario-dir", "ruhroh/scenarios", "--scenario", "simple-newsletter", "--adapter", "custom-shell"], {
      spawn: ((_, __, options) => {
        spawnEnv = options?.env;
        return { status: 0 } as never;
      }) as never,
      env: { PYTHONPATH: "/already-there" },
      cwd: tmp,
      stdout: { write: () => true },
      stderr: { write: () => true },
    });

    assert.equal(code, 0);
    assert.equal(spawnEnv?.PYTHONPATH?.startsWith(`${resolveRuhrohPythonPath()}${path.delimiter}`), true);
    assert.match(spawnEnv?.PYTHONPATH ?? "", /\/already-there$/u);
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

test("package Python runtime supports generic external command adapters", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "ruhroh-command-adapter-"));
  try {
    const workspace = path.join(tmp, "workspace");
    const runRoot = path.join(tmp, "run");
    const installed = path.join(tmp, "installed");
    const command = path.join(tmp, "fake-kestrel.sh");
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
        RUHROH_RUN_AGENT_COMMAND: command,
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), ["done", "test-agent", "workspace_only"]);
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
    writeFileSync(command, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      "cat > \"$RUHROH_EVAL_OUTPUT_PATH\" <<'JSON'",
      "{\"version\":\"ruhroh_eval_result_v1\",\"status\":\"passed\",\"goalMet\":true,\"confidence\":\"high\",\"reasons\":[\"external eval passed\"],\"unmetCriteria\":[],\"evidenceRefs\":[],\"commandsRun\":[],\"artifacts\":{},\"finalSummary\":\"ok\"}",
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
    ].join("\n");

    mkdirSync(workspace, { recursive: true });
    mkdirSync(originalWorkspace, { recursive: true });
    writeFileSync(journeyPath, "{}\n");
    const result = spawnSync("python3", ["-c", script], {
      env: {
        ...process.env,
        PYTHONPATH: resolveRuhrohPythonPath(),
        RUHROH_EVAL_COMMAND: command,
        RUHROH_EVAL_GOAL_RUBRIC_JSON: "[\"The app works.\"]",
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/u), ["passed", "True", "True"]);
    assert.match(readFileSync(evalInputPath, "utf8"), /The app works\./u);
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
