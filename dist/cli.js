#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUHROH_ARTIFACTS, RUHROH_HARBOR_AGENT_IMPORT_PATH, buildRuhrohHarborCommand } from "./harbor.js";
import { discoverRuhrohScenarios, generateHarborDataset, loadRuhrohScenario, validateRuhrohScenarioSource, } from "./generate.js";
import { inspectRuhrohBenchmarkPack } from "./pack.js";
import { buildRuhrohPublishCheckReport, ruhrohPublishCheckRemediationCatalog, ruhrohPublishCheckRemediationForBlocker, validateRuhrohPublishBundle, verifyRuhrohBenchmarkClaimSources, } from "./publication.js";
import { loadRuhrohRerunLedger } from "./rerun-ledger.js";
import { aggregateRuhrohRuns, normalizeRuhrohEvalResult, summarizeRuhrohBenchmarkClaim, summarizeRuhrohBenchmarkSummary, summarizeRuhrohBenchmarkClaimReadiness, summarizeRuhrohPairwiseAdapterComparisons, summarizeRuhrohReviewQueue, summarizeRuhrohRun, summarizeRuhrohSuiteAdapters, validateRuhrohBenchmarkClaim, validateRuhrohBenchmarkSummary, } from "./results.js";
import { discoverRuhrohSuites, loadRuhrohSuite, validateRuhrohSuiteSource, } from "./suites.js";
import { RUHROH_AGENT_ENV_KEYS } from "./env.js";
const RUN_PLAN_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/run-plan-v1.schema.json";
const LOOP_RESULT_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/loop-result-v1.schema.json";
const RUN_MANIFEST_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/run-manifest-v1.schema.json";
const EVAL_RESULT_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json";
const WORKSPACE_SUMMARY_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/workspace-summary-v1.schema.json";
const CLAIM_INDEX_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/claim-index-v1.schema.json";
const EVAL_CALIBRATION_REPORT_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/eval-calibration-report-v1.schema.json";
const PUBLISH_BUNDLE_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json";
const PUBLISH_CHECK_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json";
const EVALUATOR_CALIBRATION_REPORT_FILE = path.join("evaluator-calibration", "ruhroh-evaluator-calibration-report.json");
class HelpRequested extends Error {
}
export function parseRuhrohCliArgs(argv, cwd = process.cwd()) {
    const options = {
        command: "run",
        list: false,
        listSuites: false,
        dryRun: false,
        generateOnly: false,
        json: false,
        allowDryRun: false,
        requirePublishable: false,
        requireCalibrated: false,
        requireRiskReviewed: false,
        verifySources: false,
        harborBin: "harbor",
        scenarioDir: path.join(resolveRuhrohPackageRoot(), "scenarios"),
        scenarioDirExplicit: false,
        suiteDir: path.join(resolveRuhrohPackageRoot(), "suites"),
        suiteDirExplicit: false,
        generatedDir: path.resolve(cwd, ".generated", "ruhroh"),
        runs: 1,
        evaluatorTemplate: "review",
        adapterTemplate: "generic",
        templateExplicit: false,
        adapters: [],
        suiteScenarioIds: [],
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined || arg === "--") {
            continue;
        }
        if (index === 0
            && (arg === "run" || arg === "generate" || arg === "list" || arg === "list-suites" || arg === "plan" || arg === "validate" || arg === "inspect-pack" || arg === "validate-artifacts" || arg === "validate-claim" || arg === "validate-summary" || arg === "validate-bundle" || arg === "claim-index" || arg === "report" || arg === "compare" || arg === "review" || arg === "eval-quality" || arg === "publish-check" || arg === "explain" || arg === "examples" || arg === "first-run" || arg === "workflow" || arg === "doctor" || arg === "init" || arg === "new-scenario" || arg === "new-suite" || arg === "new-adapter" || arg === "new-evaluator" || arg === "calibrate-evaluator")) {
            options.command = arg;
            if (arg === "generate") {
                options.generateOnly = true;
            }
            if (arg === "list") {
                options.list = true;
            }
            if (arg === "list-suites") {
                options.listSuites = true;
            }
            continue;
        }
        if (arg === "--help" || arg === "-h") {
            throw new HelpRequested();
        }
        if (arg === "--list") {
            options.list = true;
            continue;
        }
        if (arg === "--list-suites") {
            options.listSuites = true;
            continue;
        }
        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }
        if (arg === "--json") {
            options.json = true;
            continue;
        }
        if (arg === "--allow-dry-run") {
            options.allowDryRun = true;
            continue;
        }
        if (arg === "--require-publishable") {
            options.requirePublishable = true;
            continue;
        }
        if (arg === "--require-calibrated") {
            options.requireCalibrated = true;
            continue;
        }
        if (arg === "--require-risk-reviewed") {
            options.requireRiskReviewed = true;
            continue;
        }
        if (arg === "--verify-sources") {
            options.verifySources = true;
            continue;
        }
        if (arg === "--html") {
            options.htmlPath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--summary-md") {
            options.summaryMarkdownPath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--run-plan") {
            options.runPlanPath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--rerun-ledger") {
            options.rerunLedgerPath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--benchmark-claim") {
            options.benchmarkClaimPath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--benchmark-summary") {
            options.benchmarkSummaryPath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--bundle") {
            options.bundlePath = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--template") {
            const template = readValue(argv, index, arg);
            options.templateExplicit = true;
            if (options.command === "new-adapter" || options.command === "init") {
                options.adapterTemplate = parseAdapterTemplate(template);
            }
            else {
                options.evaluatorTemplate = parseEvaluatorTemplate(template);
            }
            index += 1;
            continue;
        }
        if (arg === "--generate-only") {
            options.generateOnly = true;
            continue;
        }
        if (arg === "--scenario") {
            if (options.command === "new-suite") {
                options.suiteScenarioIds.push(assertSafeScenarioId(readValue(argv, index, arg)));
                index += 1;
                continue;
            }
            options.scenarioId = assertSafeScenarioId(readValue(argv, index, arg));
            options.tier = undefined;
            options.suiteId = undefined;
            index += 1;
            continue;
        }
        if (arg === "--suite") {
            options.suiteId = assertSafeScenarioId(readValue(argv, index, arg));
            options.scenarioId = undefined;
            options.tier = undefined;
            index += 1;
            continue;
        }
        if (arg === "--tier") {
            options.tier = parseTier(readValue(argv, index, arg));
            if (options.command !== "new-scenario") {
                options.scenarioId = undefined;
            }
            options.suiteId = undefined;
            index += 1;
            continue;
        }
        if (arg === "--scenario-dir") {
            options.scenarioDir = path.resolve(cwd, readValue(argv, index, arg));
            options.scenarioDirExplicit = true;
            index += 1;
            continue;
        }
        if (arg === "--suite-dir") {
            options.suiteDir = path.resolve(cwd, readValue(argv, index, arg));
            options.suiteDirExplicit = true;
            index += 1;
            continue;
        }
        if (arg === "--generated-dir") {
            options.generatedDir = path.resolve(cwd, readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--iterations") {
            options.iterations = parsePositiveInteger(readValue(argv, index, arg), arg);
            index += 1;
            continue;
        }
        if (arg === "--runs") {
            options.runs = parsePositiveInteger(readValue(argv, index, arg), arg);
            index += 1;
            continue;
        }
        if (arg === "--shard") {
            options.shard = parseShard(readValue(argv, index, arg));
            index += 1;
            continue;
        }
        if (arg === "--adapter") {
            const adapter = readValue(argv, index, arg);
            options.adapter = adapter;
            options.adapters.push(adapter);
            index += 1;
            continue;
        }
        if (arg === "--harbor-bin") {
            options.harborBin = readValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (!arg.startsWith("-") && options.command === "new-scenario") {
            if (options.scenarioId !== undefined) {
                throw new Error(`Unexpected extra argument: ${arg}`);
            }
            options.scenarioId = assertSafeScenarioId(arg);
            continue;
        }
        if (!arg.startsWith("-") && options.command === "new-suite") {
            if (options.suiteId !== undefined) {
                throw new Error(`Unexpected extra argument: ${arg}`);
            }
            options.suiteId = assertSafeScenarioId(arg);
            continue;
        }
        if (!arg.startsWith("-") && options.command === "new-adapter") {
            if (options.adapter !== undefined) {
                throw new Error(`Unexpected extra argument: ${arg}`);
            }
            options.adapter = assertSafeScenarioId(arg);
            continue;
        }
        if (!arg.startsWith("-") && options.command === "new-evaluator") {
            if (options.evaluator !== undefined) {
                throw new Error(`Unexpected extra argument: ${arg}`);
            }
            options.evaluator = assertSafeScenarioId(arg);
            continue;
        }
        if (!arg.startsWith("-") && options.command === "explain") {
            if (options.explainCode !== undefined) {
                throw new Error(`Unexpected extra argument: ${arg}`);
            }
            options.explainCode = assertSafeScenarioId(arg);
            continue;
        }
        if (!arg.startsWith("-") && (options.command === "report" || options.command === "compare" || options.command === "review" || options.command === "eval-quality" || options.command === "publish-check" || options.command === "workflow" || options.command === "init" || options.command === "validate-artifacts" || options.command === "validate-claim" || options.command === "validate-summary" || options.command === "validate-bundle" || options.command === "claim-index")) {
            if (options.inputPath !== undefined) {
                throw new Error(`Unexpected extra argument: ${arg}`);
            }
            options.inputPath = path.resolve(cwd, arg);
            continue;
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
    return options;
}
export async function runRuhrohCli(argv, deps) {
    let options;
    try {
        options = parseRuhrohCliArgs(argv, deps.cwd);
    }
    catch (error) {
        if (error instanceof HelpRequested) {
            deps.stdout.write(helpText());
            return 0;
        }
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n\n`);
        deps.stderr.write(helpText());
        return 1;
    }
    if (options.command === "report") {
        return runReportCommand(options, deps);
    }
    if (options.command === "compare") {
        return runCompareCommand(options, deps);
    }
    if (options.command === "review") {
        return runReviewCommand(options, deps);
    }
    if (options.command === "eval-quality") {
        return runEvalQualityCommand(options, deps);
    }
    if (options.command === "publish-check") {
        return runPublishCheckCommand(options, deps);
    }
    if (options.command === "explain") {
        return runExplainCommand(options, deps);
    }
    if (options.command === "examples") {
        return runExamplesCommand(options, deps);
    }
    if (options.command === "first-run") {
        return runFirstRunCommand(options, deps);
    }
    if (options.command === "workflow") {
        return runWorkflowCommand(options, deps);
    }
    if (options.command === "init") {
        return runInitCommand(options, deps);
    }
    if (options.command === "new-scenario") {
        return runNewScenarioCommand(options, deps);
    }
    if (options.command === "new-suite") {
        return runNewSuiteCommand(options, deps);
    }
    if (options.command === "new-adapter") {
        return runNewAdapterCommand(options, deps);
    }
    if (options.command === "new-evaluator") {
        return runNewEvaluatorCommand(options, deps);
    }
    if (options.command === "doctor") {
        return runDoctorCommand(options, deps);
    }
    if (options.command === "validate") {
        return runValidateCommand(options, deps);
    }
    if (options.command === "inspect-pack") {
        return runInspectPackCommand(options, deps);
    }
    if (options.command === "validate-artifacts") {
        return runValidateArtifactsCommand(options, deps);
    }
    if (options.command === "validate-claim") {
        return runValidateClaimCommand(options, deps);
    }
    if (options.command === "validate-summary") {
        return runValidateSummaryCommand(options, deps);
    }
    if (options.command === "validate-bundle") {
        return runValidateBundleCommand(options, deps);
    }
    if (options.command === "claim-index") {
        return runClaimIndexCommand(options, deps);
    }
    if (options.listSuites) {
        return runListSuitesCommand(options, deps);
    }
    let loaded;
    try {
        loaded = discoverRuhrohScenarios(options.scenarioDir).map((source) => loadRuhrohScenario(source));
        if (loaded.length === 0) {
            throw new Error(`No Ruhroh scenarios found in ${options.scenarioDir}`);
        }
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
    if (options.list) {
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({
                version: "ruhroh_scenario_list_v1",
                source: {
                    scenarioDir: options.scenarioDir,
                },
                scenarios: loaded.map(({ scenario, source }) => ({
                    id: scenario.id,
                    title: scenario.title,
                    tier: scenario.tier,
                    kind: scenario.kind,
                    sourcePath: path.relative(deps.cwd, source.scenarioPath) || source.scenarioPath,
                    scenarioVersion: scenario.metadata?.scenarioVersion,
                    visibility: scenario.metadata?.visibility,
                    difficulty: scenario.metadata?.difficulty,
                    tags: scenario.metadata?.tags ?? [],
                    lifecycleStatus: scenario.metadata?.lifecycle?.status,
                })),
            }, null, 2)}\n`);
        }
        else {
            for (const { scenario } of loaded) {
                deps.stdout.write(`${scenario.id}\t${scenario.tier}\t${scenario.title}\n`);
            }
        }
        return 0;
    }
    let selected;
    try {
        selected = selectScenarios(loaded, options);
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
    if (options.command === "calibrate-evaluator") {
        return runCalibrateEvaluatorCommand(selected, options, deps);
    }
    if (options.command === "plan") {
        return runPlanCommand(selected, options, deps);
    }
    let datasetPath = path.join(options.generatedDir, "harbor");
    if (!options.dryRun || options.generateOnly) {
        const generated = generateHarborDataset({
            scenarios: selected,
            outputRoot: options.generatedDir,
            agentImportPath: RUHROH_HARBOR_AGENT_IMPORT_PATH,
            artifacts: RUHROH_ARTIFACTS,
        });
        datasetPath = generated.datasetPath;
        for (const task of generated.tasks) {
            deps.stdout.write(`[ruhroh] generated ${task.scenarioId}: ${path.relative(deps.cwd, task.taskDir)}\n`);
        }
    }
    if (options.generateOnly) {
        deps.stdout.write("[ruhroh] generate-only complete. No Harbor tasks were started.\n");
        return 0;
    }
    let adapters;
    try {
        adapters = resolveAdapterSelections(options, deps.cwd, deps.env);
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
    const commands = shardCommands(buildCommands(selected.map((item) => item.scenario), options, datasetPath, adapters, deps.cwd), options);
    deps.stdout.write(`[ruhroh] selected=${commands.map((command) => command.label).join(",")}\n`);
    const selectedSuite = options.suiteId === undefined ? undefined : loadSelectedSuite(options);
    const runPlanPath = options.dryRun
        ? undefined
        : writeRunPlanManifest({
            options,
            selected,
            suite: selectedSuite,
            commands,
            datasetPath,
            harborBin: options.harborBin,
        });
    if (runPlanPath !== undefined) {
        deps.stdout.write(`[ruhroh] run plan: ${path.relative(deps.cwd, runPlanPath)}\n`);
    }
    for (const command of commands) {
        deps.stdout.write(`[ruhroh] harbor: ${formatCommand(options.harborBin, command.displayArgs)}\n`);
    }
    if (options.dryRun) {
        deps.stdout.write("[ruhroh] dry run complete. No Harbor task directories, run plan, Harbor process, or agent calls were written or started.\n");
        return 0;
    }
    let failed = false;
    for (const command of commands) {
        const result = deps.spawn(options.harborBin, command.args, {
            cwd: deps.cwd,
            env: buildHarborSpawnEnv(command.env),
            stdio: "inherit",
        });
        if (result.status !== 0 || result.error !== undefined) {
            deps.stderr.write(`[ruhroh] Harbor command failed for ${command.label}.\n${formatSpawnFailure(result)}`);
            failed = true;
        }
    }
    return failed ? 1 : 0;
}
function runValidateClaimCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: validate-claim requires a benchmark claim JSON file.\n");
        return 1;
    }
    try {
        const claim = readJsonObject(options.inputPath);
        const validation = validateRuhrohBenchmarkClaim(claim);
        const sourceVerification = options.verifySources ? verifyRuhrohBenchmarkClaimSources(claim, options.inputPath) : undefined;
        const publishabilityGate = options.requirePublishable ? benchmarkClaimPublishabilityGate(claim) : undefined;
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({
                version: "ruhroh_benchmark_claim_validation_report_v1",
                source: { claimPath: options.inputPath },
                validation,
                ...(sourceVerification === undefined ? {} : { sourceVerification }),
                ...(publishabilityGate === undefined ? {} : { publishabilityGate }),
            }, null, 2)}\n`);
        }
        else {
            const status = validation.errors.length === 0 ? "ok" : "failed";
            deps.stdout.write(`benchmark claim ${path.relative(deps.cwd, options.inputPath) || options.inputPath}: ${status}\n`);
            for (const error of validation.errors) {
                deps.stdout.write(`  error: ${error}\n`);
            }
            for (const warning of validation.warnings) {
                deps.stdout.write(`  warning: ${warning}\n`);
            }
            if (sourceVerification !== undefined) {
                deps.stdout.write(`  source verification: ${sourceVerification.errors.length === 0 ? "ok" : "failed"}\n`);
                for (const error of sourceVerification.errors) {
                    deps.stdout.write(`    error: ${error}\n`);
                }
                for (const warning of sourceVerification.warnings) {
                    deps.stdout.write(`    warning: ${warning}\n`);
                }
            }
            if (publishabilityGate !== undefined) {
                deps.stdout.write(`  publishability: ${publishabilityGate.publishable ? "ok" : "failed"}\n`);
                for (const blocker of publishabilityGate.blockers) {
                    deps.stdout.write(`    blocker: ${blocker}\n`);
                }
            }
        }
        if (validation.errors.length > 0) {
            return 1;
        }
        if (sourceVerification !== undefined && sourceVerification.errors.length > 0) {
            return 1;
        }
        if (publishabilityGate !== undefined && !publishabilityGate.publishable) {
            deps.stderr.write(`ruhroh validate-claim failed publishability gate: ${publishabilityGate.blockers.length} blocker${publishabilityGate.blockers.length === 1 ? "" : "s"}\n`);
            return 2;
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runValidateSummaryCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: validate-summary requires a benchmark summary JSON file.\n");
        return 1;
    }
    try {
        const summary = readJsonObject(options.inputPath);
        const validation = validateRuhrohBenchmarkSummary(summary);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({
                version: "ruhroh_benchmark_summary_validation_report_v1",
                source: { summaryPath: options.inputPath },
                validation,
            }, null, 2)}\n`);
        }
        else {
            const status = validation.errors.length === 0 ? "ok" : "failed";
            deps.stdout.write(`benchmark summary ${path.relative(deps.cwd, options.inputPath) || options.inputPath}: ${status}\n`);
            for (const error of validation.errors) {
                deps.stdout.write(`  error: ${error}\n`);
            }
            for (const warning of validation.warnings) {
                deps.stdout.write(`  warning: ${warning}\n`);
            }
        }
        return validation.errors.length === 0 ? 0 : 1;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runValidateBundleCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: validate-bundle requires a publication bundle directory.\n");
        return 1;
    }
    try {
        const report = validateRuhrohPublishBundle(options.inputPath);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatPublishBundleValidationReport(report, deps.cwd));
        }
        if (!report.valid) {
            return 1;
        }
        if (!report.publishable) {
            deps.stderr.write(`ruhroh validate-bundle failed publishability gate: ${report.errors.length} error${report.errors.length === 1 ? "" : "s"}, ${report.warnings.length} warning${report.warnings.length === 1 ? "" : "s"}; embedded publish-check is blocked\n`);
            return 2;
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runClaimIndexCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: claim-index requires a benchmark claim file, publication bundle, or directory of claims.\n");
        return 1;
    }
    try {
        const report = buildClaimIndexReport(options.inputPath, options.htmlPath);
        if (report.claimCount === 0) {
            deps.stderr.write(`ruhroh failed: no benchmark-claim.json files found in ${options.inputPath}\n`);
            return 1;
        }
        if (options.htmlPath !== undefined) {
            mkdirSync(path.dirname(options.htmlPath), { recursive: true });
            writeFileSync(options.htmlPath, formatClaimIndexReportHtml(report, options.htmlPath), "utf8");
        }
        if (options.json) {
            deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatClaimIndexReport(report, deps.cwd));
            if (options.htmlPath !== undefined) {
                deps.stdout.write(`Wrote Ruhroh claim index HTML: ${options.htmlPath}\n`);
            }
        }
        if (report.invalidCount > 0) {
            return 1;
        }
        if (options.requirePublishable && !report.registryReady) {
            deps.stderr.write(`ruhroh claim-index failed registry readiness gate: ${report.registryBlockers.length} blocker${report.registryBlockers.length === 1 ? "" : "s"}\n`);
            return 2;
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function buildClaimIndexReport(inputPath, htmlPath) {
    const claimPaths = discoverBenchmarkClaimPaths(inputPath);
    const claims = claimPaths.map((claimPath) => buildClaimIndexEntry(claimPath));
    const suites = new Set(claims.flatMap((claim) => claim.suite?.id === undefined ? [] : [claim.suite.id]));
    const adapters = new Set(claims.flatMap((claim) => claim.adapters));
    const invalidCount = claims.filter((claim) => !claim.valid).length;
    const blockedCount = claims.filter((claim) => claim.valid && !claim.publishable).length;
    const registryBlockers = buildClaimIndexRegistryBlockers(claims);
    return {
        $schema: CLAIM_INDEX_SCHEMA_URL,
        version: "ruhroh_claim_index_v1",
        generatedAt: new Date().toISOString(),
        source: {
            inputPath: path.resolve(inputPath),
            ...(htmlPath === undefined ? {} : { htmlPath }),
        },
        registryReady: claims.length > 0 && invalidCount === 0 && blockedCount === 0,
        registryBlockers,
        claimCount: claims.length,
        publishableCount: claims.filter((claim) => claim.publishable).length,
        blockedCount,
        invalidCount,
        suiteCount: suites.size,
        adapterCount: adapters.size,
        totalRuns: claims.reduce((total, claim) => total + claim.summary.totalRuns, 0),
        claims,
    };
}
function buildClaimIndexRegistryBlockers(claims) {
    return claims.flatMap((claim) => {
        const label = claim.bundlePath === undefined ? claim.claimPath : claim.bundlePath;
        if (!claim.valid) {
            const reason = claim.validationErrors[0] ?? "claim validation failed";
            return [`invalid claim ${label}: ${reason}`];
        }
        if (!claim.publishable) {
            const reason = claim.blockers[0] ?? "claim is not publishable";
            return [`blocked claim ${label}: ${reason}`];
        }
        return [];
    });
}
function discoverBenchmarkClaimPaths(inputPath) {
    const resolved = path.resolve(inputPath);
    if (!existsSync(resolved)) {
        throw new Error(`Path does not exist: ${resolved}`);
    }
    if (statSync(resolved).isFile()) {
        return [resolved];
    }
    return uniquePreserveOrder(walkJsonFiles(resolved)
        .filter(isBenchmarkClaimFile)).sort((left, right) => left.localeCompare(right));
}
function isBenchmarkClaimFile(filePath) {
    if (path.basename(filePath) === "benchmark-claim.json") {
        return true;
    }
    try {
        return readJsonObject(filePath).version === "ruhroh_benchmark_claim_v1";
    }
    catch {
        return false;
    }
}
function buildClaimIndexEntry(claimPath) {
    const claim = readJsonObject(claimPath);
    const validation = validateRuhrohBenchmarkClaim(claim);
    const gate = validation.errors.length === 0
        ? benchmarkClaimPublishabilityGate(claim)
        : { publishable: false, blockers: validation.errors };
    const summary = isRecord(claim.summary) ? claim.summary : {};
    const evidence = isRecord(claim.evidence) ? claim.evidence : {};
    const readiness = isRecord(claim.readiness) ? claim.readiness : {};
    const source = isRecord(claim.source) ? claim.source : {};
    const suite = isRecord(claim.suite) ? claim.suite : undefined;
    const adapters = recordArrayField(claim, "adapterSummaries")
        .flatMap((adapter) => stringField(adapter, "adapter") ?? [])
        .sort((left, right) => left.localeCompare(right));
    return {
        claimPath,
        ...(claimBundlePath(claimPath) === undefined ? {} : { bundlePath: claimBundlePath(claimPath) }),
        valid: validation.errors.length === 0,
        publishable: validation.errors.length === 0 && gate.publishable,
        ...(stringField(claim, "scope") === undefined ? {} : { scope: stringField(claim, "scope") }),
        ...(stringField(claim, "createdAt") === undefined ? {} : { createdAt: stringField(claim, "createdAt") }),
        ...(suite === undefined ? {} : {
            suite: {
                id: stringField(suite, "id") ?? "unknown",
                ...(stringField(suite, "title") === undefined ? {} : { title: stringField(suite, "title") }),
                ...(stringField(suite, "suiteVersion") === undefined ? {} : { suiteVersion: stringField(suite, "suiteVersion") }),
            },
        }),
        adapters,
        summary: {
            scenarioCount: numberField(summary, "scenarioCount"),
            adapterCount: numberField(summary, "adapterCount"),
            totalRuns: numberField(summary, "totalRuns"),
            totalPasses: numberField(summary, "totalPasses"),
            runWeightedPassRate: numberField(summary, "runWeightedPassRate"),
            reviewRecommended: numberField(summary, "reviewRecommended"),
        },
        evidence: {
            runPlanPresent: evidence.runPlanPresent === true,
            artifactValidationErrors: numberField(evidence, "artifactValidationErrors"),
            artifactCompletenessWarnings: numberField(evidence, "artifactCompletenessWarnings"),
            requiredReviewItems: numberField(evidence, "requiredReviewItems"),
        },
        sourcePaths: {
            ...(stringField(source, "resultsPath") === undefined ? {} : { resultsPath: stringField(source, "resultsPath") }),
            ...(stringField(source, "runPlanPath") === undefined ? {} : { runPlanPath: stringField(source, "runPlanPath") }),
            ...(stringField(source, "rerunLedgerPath") === undefined ? {} : { rerunLedgerPath: stringField(source, "rerunLedgerPath") }),
            ...(stringField(source, "suitePath") === undefined ? {} : { suitePath: stringField(source, "suitePath") }),
        },
        blockers: gate.blockers,
        advisories: stringArrayField(readiness, "advisories"),
        validationErrors: validation.errors,
        validationWarnings: validation.warnings,
    };
}
function claimBundlePath(claimPath) {
    const bundlePath = path.dirname(claimPath);
    const manifestPath = path.join(bundlePath, "manifest.json");
    if (!existsSync(manifestPath) || !statSync(manifestPath).isFile()) {
        return undefined;
    }
    try {
        const manifest = readJsonObject(manifestPath);
        return manifest.version === "ruhroh_publish_bundle_v1" ? bundlePath : undefined;
    }
    catch {
        return undefined;
    }
}
function formatClaimIndexReport(report, cwd) {
    const lines = [
        `Ruhroh claim index: ${report.claimCount} claim${report.claimCount === 1 ? "" : "s"} (${report.publishableCount} publishable, ${report.blockedCount} blocked, ${report.invalidCount} invalid)`,
        `  registry ready: ${report.registryReady ? "yes" : "no"}`,
        `  suites: ${report.suiteCount}`,
        `  adapters: ${report.adapterCount}`,
        `  total runs: ${report.totalRuns}`,
    ];
    if (report.registryBlockers.length > 0) {
        lines.push("  registry blockers:");
        for (const blocker of report.registryBlockers) {
            lines.push(`    - ${blocker}`);
        }
    }
    for (const claim of report.claims) {
        lines.push("", `${path.relative(cwd, claim.claimPath) || claim.claimPath}`, `  status: ${claim.valid ? claim.publishable ? "publishable" : "blocked" : "invalid"}`, `  scope: ${claim.scope ?? "unknown"}`, `  suite: ${claim.suite === undefined ? "none" : `${claim.suite.id}@${claim.suite.suiteVersion ?? "unknown"}`}`, `  adapters: ${formatList(claim.adapters)}`, `  runs: ${claim.summary.totalRuns}, passRate: ${formatPercent(claim.summary.runWeightedPassRate)}`, `  evidence: runPlan=${claim.evidence.runPlanPresent ? "yes" : "no"}, artifactErrors=${claim.evidence.artifactValidationErrors}, artifactWarnings=${claim.evidence.artifactCompletenessWarnings}, reviewRequired=${claim.evidence.requiredReviewItems}`);
        if (claim.bundlePath !== undefined) {
            lines.push(`  bundle: ${path.relative(cwd, claim.bundlePath) || claim.bundlePath}`);
        }
        for (const error of claim.validationErrors) {
            lines.push(`  error: ${error}`);
        }
        for (const blocker of claim.blockers) {
            lines.push(`  blocker: ${blocker}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function formatClaimIndexReportHtml(report, htmlPath) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ruhroh claim index</title>
    <style>
      :root { color-scheme: light; --border: #d8dee4; --muted: #57606a; --bg: #f6f8fa; --bad: #b42318; --ok: #1f7a3f; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #fff; }
      main { max-width: 1280px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: var(--bg); }
      .packet-links a { display: block; margin: 0 0 4px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .metric { border: 1px solid var(--border); padding: 12px; background: var(--bg); }
      .metric strong { display: block; font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Ruhroh claim index</h1>
        <p class="muted">${localPathLinkHtml(report.source.inputPath, htmlPath)}</p>
      </header>
      <section class="grid" aria-label="Claim index overview">
        ${metricHtml("Claims", String(report.claimCount))}
        ${metricHtml("Publishable", String(report.publishableCount), report.invalidCount === 0 && report.blockedCount === 0 ? "pass" : "")}
        ${metricHtml("Blocked", String(report.blockedCount), report.blockedCount === 0 ? "pass" : "fail")}
        ${metricHtml("Invalid", String(report.invalidCount), report.invalidCount === 0 ? "pass" : "fail")}
        ${metricHtml("Registry ready", report.registryReady ? "yes" : "no", report.registryReady ? "pass" : "fail")}
        ${metricHtml("Suites", String(report.suiteCount))}
        ${metricHtml("Adapters", String(report.adapterCount))}
        ${metricHtml("Total runs", String(report.totalRuns))}
      </section>
      ${report.registryBlockers.length === 0 ? "" : sectionHtml("Registry Blockers", `<ul>${report.registryBlockers.map((blocker) => `<li>${escapeHtml(claimIndexHtmlText(blocker, report, htmlPath))}</li>`).join("")}</ul>`)}
      ${sectionHtml("Claims", tableHtml([
        "Status",
        "Suite",
        "Scope",
        "Adapters",
        "Runs",
        "Pass rate",
        "Review",
        "Evidence",
        "Claim",
        "Bundle",
        "Review Packet",
        "Blockers",
    ], report.claims.map((claim) => [
        claim.valid ? claim.publishable ? "publishable" : "blocked" : "invalid",
        claim.suite === undefined ? "" : `${claim.suite.id}@${claim.suite.suiteVersion ?? "unknown"}`,
        claim.scope ?? "",
        claim.adapters.join("; "),
        String(claim.summary.totalRuns),
        formatPercent(claim.summary.runWeightedPassRate),
        String(claim.summary.reviewRecommended),
        `runPlan=${claim.evidence.runPlanPresent ? "yes" : "no"}; artifactErrors=${claim.evidence.artifactValidationErrors}; artifactWarnings=${claim.evidence.artifactCompletenessWarnings}; requiredReview=${claim.evidence.requiredReviewItems}`,
        localPathCell(claim.claimPath, htmlPath),
        claim.bundlePath === undefined ? "" : localPathCell(claim.bundlePath, htmlPath),
        claimIndexReviewPacketCell(claim, htmlPath),
        [...claim.validationErrors, ...claim.blockers].join("; "),
    ])))}
    </main>
  </body>
</html>
  `;
}
function claimIndexReviewPacketCell(claim, htmlPath) {
    if (claim.bundlePath === undefined) {
        return "";
    }
    const packetFiles = [
        ["README", path.join(claim.bundlePath, "README.md")],
        ["compare", path.join(claim.bundlePath, "ruhroh-compare.html")],
        ["eval-quality", path.join(claim.bundlePath, "ruhroh-eval-quality.html")],
        ["review", path.join(claim.bundlePath, "ruhroh-review.html")],
        ["manifest", path.join(claim.bundlePath, "manifest.json")],
        ["sources", path.join(claim.bundlePath, "sources")],
    ];
    const links = packetFiles.filter(([, itemPath]) => existsSync(itemPath));
    if (links.length === 0) {
        return "";
    }
    return {
        html: `<div class="packet-links">${links.map(([label, itemPath]) => localNamedPathLinkHtml(label, itemPath, htmlPath)).join("")}</div>`,
    };
}
function localNamedPathLinkHtml(label, targetPath, htmlPath) {
    const displayHref = localPathDisplay(targetPath, htmlPath);
    const href = displayHref.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
}
function claimIndexHtmlText(value, report, htmlPath) {
    if (htmlPath === undefined) {
        return value;
    }
    let formatted = value;
    const paths = uniquePreserveOrder([
        report.source.inputPath,
        ...report.claims.flatMap((claim) => [
            claim.claimPath,
            ...(claim.bundlePath === undefined ? [] : [claim.bundlePath]),
        ]),
    ]);
    for (const itemPath of paths) {
        if (path.isAbsolute(itemPath)) {
            formatted = formatted.split(itemPath).join(localPathDisplay(itemPath, htmlPath));
        }
    }
    return formatted;
}
function formatPublishBundleValidationReport(report, cwd) {
    const lines = [
        `publication bundle ${path.relative(cwd, report.source.bundlePath) || report.source.bundlePath}: ${report.valid ? "valid" : "failed"}; ${report.publishable ? "publishable" : "blocked"}`,
    ];
    for (const check of report.checks) {
        const location = check.path === undefined ? "" : ` ${path.relative(cwd, check.path) || check.path}`;
        lines.push(`  ${check.status}: ${check.name}${location} - ${check.details}`);
    }
    return `${lines.join("\n")}\n`;
}
function runValidateArtifactsCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: validate-artifacts requires a run artifact directory or ruhroh-loop-result.json file.\n");
        return 1;
    }
    try {
        const report = validateRuhrohArtifacts(options.inputPath);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatArtifactValidationReport(report, deps.cwd));
        }
        return report.valid ? 0 : 1;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function validateRuhrohArtifacts(inputPath) {
    const resultPaths = resolveRunResultPaths(inputPath);
    if (resultPaths.length === 0) {
        throw new Error(`No ruhroh-loop-result.json files found in ${path.resolve(inputPath)}`);
    }
    return validateRuhrohArtifactPaths(resultPaths, inputPath);
}
function validateRuhrohArtifactPaths(resultPaths, inputPath) {
    const runs = resultPaths.map((resultPath) => validateRuhrohArtifactBundle(resultPath));
    const inputRoot = path.resolve(inputPath);
    const checks = runs.flatMap((run) => run.checks);
    const errors = runs.flatMap((run) => run.errors.map((error) => `${path.relative(inputRoot, run.resultPath) || run.resultPath}: ${error}`));
    const warnings = runs.flatMap((run) => run.warnings.map((warning) => `${path.relative(inputRoot, run.resultPath) || run.resultPath}: ${warning}`));
    return {
        version: "ruhroh_artifact_validation_report_v1",
        source: {
            inputPath: inputRoot,
            ...(resultPaths.length === 1 ? { resultPath: resultPaths[0] } : {}),
            resultPaths,
        },
        valid: runs.every((run) => run.valid),
        runs,
        checks,
        errors,
        warnings,
    };
}
function validateRuhrohArtifactBundle(resultPath) {
    const resultDir = path.dirname(resultPath);
    const checks = [];
    const result = readJsonObject(resultPath);
    checks.push(versionCheck("loop-result.version", resultPath, result, "ruhroh_loop_result_v1"));
    checks.push(schemaCheck("loop-result.schema", resultPath, result, LOOP_RESULT_SCHEMA_URL));
    if (!isRuhrohLoopResult(result)) {
        checks.push({
            name: "loop-result.shape",
            status: "failed",
            path: resultPath,
            details: "ruhroh-loop-result.json must include scenarioId, status, and numeric score",
        });
    }
    else {
        checks.push({
            name: "loop-result.shape",
            status: "ok",
            path: resultPath,
            details: `${result.scenarioId}/${result.adapter} status=${result.status}`,
        });
    }
    checks.push(...validateEmbeddedArtifact(resultPath, "runManifest", result.runManifest, "ruhroh_run_manifest_v1", RUN_MANIFEST_SCHEMA_URL));
    checks.push(...validateEmbeddedArtifact(resultPath, "evalResult", result.evalResult, "ruhroh_eval_result_v1", EVAL_RESULT_SCHEMA_URL));
    for (const artifact of [
        { name: "result", fileName: "ruhroh-loop-result.json", version: "ruhroh_loop_result_v1", schemaUrl: LOOP_RESULT_SCHEMA_URL },
        { name: "runManifest", fileName: "ruhroh-run-manifest.json", version: "ruhroh_run_manifest_v1", schemaUrl: RUN_MANIFEST_SCHEMA_URL },
        { name: "evalResult", fileName: "ruhroh-loop-eval.json", version: "ruhroh_eval_result_v1", schemaUrl: EVAL_RESULT_SCHEMA_URL },
        { name: "workspaceSummary", fileName: "ruhroh-workspace-summary.json", version: "ruhroh_workspace_summary_v1", schemaUrl: WORKSPACE_SUMMARY_SCHEMA_URL },
    ]) {
        const artifactPath = resolveRunArtifactPath(result, resultDir, artifact.name, artifact.fileName);
        checks.push(...validateJsonArtifactFile(artifact.name, artifactPath, artifact.version, artifact.schemaUrl));
    }
    for (const artifact of [
        { name: "implementationRuns", fileName: "ruhroh-loop-iterations.jsonl" },
        { name: "journey", fileName: "ruhroh-loop-journey.json" },
        { name: "evalInput", fileName: "ruhroh-loop-eval-input.json" },
    ]) {
        const artifactPath = resolveRunArtifactPath(result, resultDir, artifact.name, artifact.fileName);
        checks.push(filePresenceCheck(artifact.name, artifactPath));
    }
    checks.push(...validateCrossArtifactConsistency(result, resultDir));
    const errors = checks.filter((check) => check.status === "failed").map((check) => `${check.name}: ${check.details}`);
    const warnings = checks.filter((check) => check.status === "warning").map((check) => `${check.name}: ${check.details}`);
    return {
        resultPath,
        valid: errors.length === 0,
        checks,
        errors,
        warnings,
    };
}
function validateEmbeddedArtifact(resultPath, name, value, expectedVersion, expectedSchemaUrl) {
    if (!isRecord(value)) {
        return [{
                name: `${name}.embedded`,
                status: "warning",
                path: resultPath,
                details: `${name} is not embedded in ruhroh-loop-result.json`,
            }];
    }
    return [
        versionCheck(`${name}.embedded.version`, resultPath, value, expectedVersion),
        schemaCheck(`${name}.embedded.schema`, resultPath, value, expectedSchemaUrl),
    ];
}
function validateJsonArtifactFile(name, filePath, expectedVersion, expectedSchemaUrl) {
    const presence = filePresenceCheck(name, filePath);
    if (presence.status === "failed") {
        return [presence];
    }
    try {
        const artifact = readJsonObject(filePath);
        return [
            presence,
            versionCheck(`${name}.version`, filePath, artifact, expectedVersion),
            schemaCheck(`${name}.schema`, filePath, artifact, expectedSchemaUrl),
        ];
    }
    catch (error) {
        return [
            presence,
            {
                name: `${name}.json`,
                status: "failed",
                path: filePath,
                details: error instanceof Error ? error.message : String(error),
            },
        ];
    }
}
function validateCrossArtifactConsistency(result, resultDir) {
    const checks = [];
    const runManifestPath = resolveRunArtifactPath(result, resultDir, "runManifest", "ruhroh-run-manifest.json");
    if (existsSync(runManifestPath) && statSync(runManifestPath).isFile()) {
        try {
            const manifest = readJsonObject(runManifestPath);
            const manifestRunId = typeof manifest.runId === "string" ? manifest.runId : undefined;
            const resultRunId = typeof result.runId === "string" ? result.runId : undefined;
            if (manifestRunId !== undefined && resultRunId !== undefined && manifestRunId !== resultRunId) {
                checks.push({
                    name: "runManifest.runId",
                    status: "failed",
                    path: runManifestPath,
                    details: `run manifest runId ${manifestRunId} does not match loop result runId ${resultRunId}`,
                });
            }
            else {
                checks.push({
                    name: "runManifest.runId",
                    status: "ok",
                    path: runManifestPath,
                    details: manifestRunId === undefined ? "run manifest has no runId to compare" : `runId=${manifestRunId}`,
                });
            }
        }
        catch {
            // The JSON parse failure is already reported by validateJsonArtifactFile.
        }
    }
    return checks;
}
function versionCheck(name, filePath, value, expectedVersion) {
    if (value.version !== expectedVersion) {
        return {
            name,
            status: "failed",
            path: filePath,
            details: `expected version ${expectedVersion}, found ${typeof value.version === "string" ? value.version : "missing"}`,
        };
    }
    return {
        name,
        status: "ok",
        path: filePath,
        details: `version=${expectedVersion}`,
    };
}
function schemaCheck(name, filePath, value, expectedSchemaUrl) {
    if (value.$schema === undefined) {
        return {
            name,
            status: "warning",
            path: filePath,
            details: `missing $schema; expected ${expectedSchemaUrl}`,
        };
    }
    if (value.$schema !== expectedSchemaUrl) {
        return {
            name,
            status: "failed",
            path: filePath,
            details: `expected $schema ${expectedSchemaUrl}, found ${typeof value.$schema === "string" ? value.$schema : "non-string value"}`,
        };
    }
    return {
        name,
        status: "ok",
        path: filePath,
        details: `$schema=${expectedSchemaUrl}`,
    };
}
function filePresenceCheck(name, filePath) {
    if (!existsSync(filePath)) {
        return {
            name,
            status: "failed",
            path: filePath,
            details: "artifact file is missing",
        };
    }
    if (!statSync(filePath).isFile()) {
        return {
            name,
            status: "failed",
            path: filePath,
            details: "artifact path is not a file",
        };
    }
    return {
        name,
        status: "ok",
        path: filePath,
        details: "artifact file is present",
    };
}
function resolveRunResultPaths(inputPath) {
    const resolved = path.resolve(inputPath);
    if (!existsSync(resolved)) {
        throw new Error(`Path does not exist: ${resolved}`);
    }
    if (!statSync(resolved).isDirectory()) {
        return [resolved];
    }
    const directResultPath = path.join(resolved, "ruhroh-loop-result.json");
    if (existsSync(directResultPath)) {
        return [directResultPath];
    }
    return walkJsonFiles(resolved)
        .filter((filePath) => !isPublishBundleSourcePath(filePath))
        .filter((filePath) => path.basename(filePath) === "ruhroh-loop-result.json")
        .sort((left, right) => left.localeCompare(right));
}
function resolveRunArtifactPath(result, resultDir, artifactName, localFileName) {
    const localPath = path.join(resultDir, localFileName);
    if (existsSync(localPath)) {
        return localPath;
    }
    const artifactPaths = isRecord(result.artifactPaths) ? result.artifactPaths : {};
    const manifestPath = artifactPaths[artifactName];
    if (typeof manifestPath === "string" && manifestPath.length > 0) {
        return path.isAbsolute(manifestPath) ? manifestPath : path.resolve(resultDir, manifestPath);
    }
    return localPath;
}
function formatArtifactValidationReport(report, cwd) {
    const lines = [
        `artifact validation ${path.relative(cwd, report.source.inputPath) || report.source.inputPath}: ${report.valid ? "ok" : "failed"} (${report.runs.length} run${report.runs.length === 1 ? "" : "s"})`,
    ];
    for (const run of report.runs) {
        lines.push(`  run ${path.relative(cwd, run.resultPath) || run.resultPath}: ${run.valid ? "ok" : "failed"}`);
        for (const check of run.checks) {
            const location = check.path === undefined ? "" : ` ${path.relative(cwd, check.path) || check.path}`;
            lines.push(`    ${check.status}: ${check.name}${location} - ${check.details}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function benchmarkClaimPublishabilityGate(claim) {
    const readiness = isRecord(claim.readiness) ? claim.readiness : {};
    const evidence = isRecord(claim.evidence) ? claim.evidence : {};
    const suiteCoverage = isRecord(claim.suiteCoverage) ? claim.suiteCoverage : undefined;
    const blockers = [
        ...stringArrayField(readiness, "blockers"),
        ...(claim.scope === "suite" ? [] : ["no suite selected; use compare --suite for publishable benchmark claims"]),
        ...(claim.publishable === true && readiness.publishable === true ? [] : ["claim is not marked publishable"]),
        ...stringArrayField(evidence, "runPlanWarnings").map((warning) => `run plan warning: ${warning}`),
        ...(numberField(evidence, "artifactValidationErrors") > 0 ? [`artifact validation failed: ${numberField(evidence, "artifactValidationErrors")} error(s)`] : []),
        ...(numberField(evidence, "artifactCompletenessWarnings") > 0 ? ["artifact-completeness warnings present"] : []),
        ...(numberField(evidence, "requiredReviewItems") > 0 ? [`${numberField(evidence, "requiredReviewItems")} review item(s) required`] : []),
        ...suiteCoverageBlockers(suiteCoverage),
        ...recordArrayField(claim, "adapterSummaries").flatMap(adapterSummaryPublishabilityBlockers),
        ...recordArrayField(claim, "scenarioResults").flatMap(scenarioResultPublishabilityBlockers),
        ...recordArrayField(claim, "pairwiseComparisons").flatMap(pairwisePublishabilityBlockers),
    ];
    const uniqueBlockers = uniquePreserveOrder(blockers);
    return {
        required: true,
        publishable: uniqueBlockers.length === 0,
        blockers: uniqueBlockers,
    };
}
function suiteCoverageBlockers(suiteCoverage) {
    if (suiteCoverage === undefined) {
        return [];
    }
    return [
        ...(suiteCoverage.minRunsSatisfied === false ? ["suite minimum runs or scenario coverage not satisfied"] : []),
        ...stringArrayField(suiteCoverage, "missingScenarioIds").map((scenarioId) => `missing suite scenario ${scenarioId}`),
        ...recordArrayField(suiteCoverage, "adapters").flatMap((adapter) => [
            ...(adapter.minRunsSatisfied === false ? [`${stringField(adapter, "adapter") ?? "adapter"}: suite minimum runs or scenario coverage not satisfied`] : []),
            ...stringArrayField(adapter, "missingScenarioIds").map((scenarioId) => `${stringField(adapter, "adapter") ?? "adapter"}: missing suite scenario ${scenarioId}`),
            ...stringArrayField(adapter, "warnings").map((warning) => `${stringField(adapter, "adapter") ?? "adapter"}: ${warning}`),
        ]),
    ];
}
function adapterSummaryPublishabilityBlockers(adapterSummary) {
    if (adapterSummary.minRunsSatisfied !== false) {
        return [];
    }
    return [`${stringField(adapterSummary, "adapter") ?? "adapter"}: suite minimum runs or scenario coverage not satisfied`];
}
function scenarioResultPublishabilityBlockers(scenarioResult) {
    const label = `${stringField(scenarioResult, "scenarioId") ?? "scenario"}/${stringField(scenarioResult, "adapter") ?? "adapter"}`;
    return stringArrayField(scenarioResult, "statisticalWarnings").map((warning) => `${label}: ${warning}`);
}
function pairwisePublishabilityBlockers(comparison) {
    const label = [
        stringField(comparison, "scenarioId") ?? "scenario",
        `${stringField(comparison, "contenderAdapter") ?? "contender"} vs ${stringField(comparison, "baselineAdapter") ?? "baseline"}`,
    ].join("/");
    return stringArrayField(comparison, "warnings").map((warning) => `${label}: ${warning}`);
}
function stringArrayField(record, field) {
    const value = record[field];
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
        : [];
}
function recordArrayField(record, field) {
    const value = record[field];
    return Array.isArray(value)
        ? value.filter((item) => isRecord(item))
        : [];
}
function stringField(record, field) {
    const value = record[field];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
function numberField(record, field) {
    const value = record[field];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function runValidateCommand(options, deps) {
    const sources = discoverRuhrohScenarios(options.scenarioDir);
    if (sources.length === 0) {
        deps.stderr.write(`ruhroh failed: No Ruhroh scenarios found in ${options.scenarioDir}\n`);
        return 1;
    }
    const allScenarioResults = sources.map((source) => validateRuhrohScenarioSource(source));
    const results = allScenarioResults.filter((result) => scenarioValidationMatchesSelection(result, options));
    const availableScenarioIds = allScenarioResults
        .map((result) => result.scenario?.id)
        .filter((id) => id !== undefined);
    const availableScenarioVersions = Object.fromEntries(allScenarioResults.flatMap((result) => {
        const id = result.scenario?.id;
        const version = result.scenario?.metadata?.scenarioVersion;
        return id === undefined || version === undefined ? [] : [[id, version]];
    }));
    const suiteResults = options.suiteId === undefined
        ? []
        : discoverRuhrohSuites(options.suiteDir)
            .map((source) => validateRuhrohSuiteSource(source, { availableScenarioIds, availableScenarioVersions }))
            .filter((result) => suiteValidationMatchesSelection(result, options));
    if (results.length === 0) {
        deps.stderr.write(`ruhroh failed: No Ruhroh scenarios matched the requested selection.\n`);
        return 1;
    }
    if (options.suiteId !== undefined && suiteResults.length === 0) {
        deps.stderr.write(`ruhroh failed: No Ruhroh suite matched ${options.suiteId} in ${options.suiteDir}.\n`);
        return 1;
    }
    if (options.json) {
        deps.stdout.write(`${JSON.stringify({ version: "ruhroh_validation_report_v1", results, suiteResults }, null, 2)}\n`);
    }
    else {
        for (const result of suiteResults) {
            const id = result.suite?.id ?? path.basename(result.source.suiteDir);
            const status = result.errors.length === 0 ? "ok" : "failed";
            deps.stdout.write(`suite ${id}: ${status}\n`);
            for (const error of result.errors) {
                deps.stdout.write(`  error: ${error}\n`);
            }
            for (const warning of result.warnings) {
                deps.stdout.write(`  warning: ${warning}\n`);
            }
        }
        for (const result of results) {
            const id = result.scenario?.id ?? path.basename(result.source.scenarioDir);
            const status = result.errors.length === 0 ? "ok" : "failed";
            deps.stdout.write(`${id}: ${status}\n`);
            if (result.calibration !== undefined) {
                const covered = result.calibration.coveredStatuses.length === 0
                    ? "none"
                    : result.calibration.coveredStatuses.join(",");
                const missing = result.calibration.missingStatuses.length === 0
                    ? "none"
                    : result.calibration.missingStatuses.join(",");
                deps.stdout.write(`  calibration: cases=${result.calibration.total} covered=${covered} missing=${missing}\n`);
                for (const warning of result.calibration.warnings) {
                    deps.stdout.write(`  calibration warning: ${warning}\n`);
                }
            }
            for (const error of result.errors) {
                deps.stdout.write(`  error: ${error}\n`);
            }
            for (const warning of result.warnings) {
                deps.stdout.write(`  warning: ${warning}\n`);
            }
        }
    }
    return results.some((result) => result.errors.length > 0) || suiteResults.some((result) => result.errors.length > 0) ? 1 : 0;
}
function runInspectPackCommand(options, deps) {
    const inspection = inspectRuhrohBenchmarkPack({
        scenarioDir: options.scenarioDir,
        suiteDir: options.suiteDir,
        requireFullCalibration: options.requireCalibrated,
        requireRiskReviewed: options.requireRiskReviewed,
    });
    if (options.htmlPath !== undefined) {
        writeFileSync(options.htmlPath, formatBenchmarkPackInspectionHtml(inspection, options.htmlPath), "utf8");
    }
    if (options.json) {
        deps.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
    }
    else {
        deps.stdout.write(formatBenchmarkPackInspection(inspection, deps.cwd));
    }
    if (!inspection.ready) {
        deps.stderr.write(`ruhroh inspect-pack failed readiness gate: ${inspection.blockers.length} blocker${inspection.blockers.length === 1 ? "" : "s"}\n`);
        return 1;
    }
    return 0;
}
function formatBenchmarkPackInspection(inspection, cwd) {
    const promptFingerprintCount = inspection.scenarios.filter((scenario) => scenario.content.promptSha256 !== undefined).length;
    const assetFingerprintCount = inspection.scenarios.reduce((sum, scenario) => sum + scenario.content.assetFingerprints.length, 0);
    const privateAssetFingerprintCount = inspection.scenarios.reduce((sum, scenario) => sum + scenario.content.privateAssetFingerprints.length, 0);
    const lines = [
        "Ruhroh benchmark pack inspection",
        `ready: ${inspection.ready ? "yes" : "no"}`,
        `scenarioDir: ${path.relative(cwd, inspection.source.scenarioDir) || "."}`,
        ...(inspection.source.suiteDir === undefined ? [] : [`suiteDir: ${path.relative(cwd, inspection.source.suiteDir) || "."}`]),
        `requireFullCalibration: ${inspection.requirements.requireFullCalibration ? "yes" : "no"}`,
        `requireRiskReviewed: ${inspection.requirements.requireRiskReviewed ? "yes" : "no"}`,
        `scenarios: ${inspection.summary.validScenarioCount}/${inspection.summary.scenarioCount} valid`,
        `suites: ${inspection.summary.validSuiteCount}/${inspection.summary.suiteCount} valid`,
        `calibration warnings: ${inspection.summary.calibrationWarningCount}`,
        `risk review warnings: ${inspection.summary.riskReviewWarningCount}`,
        `difficulty mix: ${formatPackDifficultyCounts(inspection.summary.difficultyCounts)}`,
        `expected runtime: ${formatPackRuntimeEstimate(inspection.summary.runtimeEstimate)}`,
        `content fingerprints: ${inspection.scenarios.length} scenario manifests, ${promptFingerprintCount} prompts, ${assetFingerprintCount} public asset entries, ${privateAssetFingerprintCount} private asset entries`,
    ];
    if (inspection.blockers.length > 0) {
        lines.push("blockers:");
        for (const blocker of inspection.blockers) {
            lines.push(`  - ${blocker}`);
        }
    }
    if (inspection.warnings.length > 0) {
        lines.push("warnings:");
        for (const warning of inspection.warnings) {
            lines.push(`  - ${warning}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function formatBenchmarkPackInspectionHtml(inspection, htmlPath) {
    const promptFingerprintCount = inspection.scenarios.filter((scenario) => scenario.content.promptSha256 !== undefined).length;
    const assetFingerprintCount = inspection.scenarios.reduce((sum, scenario) => sum + scenario.content.assetFingerprints.length, 0);
    const privateAssetFingerprintCount = inspection.scenarios.reduce((sum, scenario) => sum + scenario.content.privateAssetFingerprints.length, 0);
    const fingerprintRows = inspection.scenarios.flatMap((scenario) => [
        {
            scenario,
            kind: "scenario manifest",
            path: scenario.content.scenarioPath,
            status: scenario.content.scenarioSha256 === undefined ? "missing" : "ok",
            fileCount: "",
            sizeBytes: "",
            sha256: scenario.content.scenarioSha256 ?? "",
            error: "",
        },
        ...(scenario.content.promptPath === undefined ? [] : [{
                scenario,
                kind: "prompt",
                path: scenario.content.promptPath,
                status: scenario.content.promptSha256 === undefined ? "missing" : "ok",
                fileCount: "",
                sizeBytes: "",
                sha256: scenario.content.promptSha256 ?? "",
                error: "",
            }]),
        ...scenario.content.assetFingerprints.map((fingerprint) => ({
            scenario,
            kind: `public ${fingerprint.kind ?? "asset"}`,
            path: fingerprint.sourcePath,
            status: fingerprint.status,
            fileCount: fingerprint.fileCount === undefined ? "" : String(fingerprint.fileCount),
            sizeBytes: fingerprint.sizeBytes === undefined ? "" : String(fingerprint.sizeBytes),
            sha256: fingerprint.sha256 ?? "",
            error: fingerprint.error ?? "",
        })),
        ...scenario.content.privateAssetFingerprints.map((fingerprint) => ({
            scenario,
            kind: `private ${fingerprint.kind ?? "asset"}`,
            path: fingerprint.sourcePath,
            status: fingerprint.status,
            fileCount: fingerprint.fileCount === undefined ? "" : String(fingerprint.fileCount),
            sizeBytes: fingerprint.sizeBytes === undefined ? "" : String(fingerprint.sizeBytes),
            sha256: fingerprint.sha256 ?? "",
            error: fingerprint.error ?? "",
        })),
    ]);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ruhroh benchmark pack inspection</title>
    <style>
      :root { color-scheme: light; --border: #d8dee4; --muted: #57606a; --bg: #f6f8fa; --bad: #b42318; --ok: #1f7a3f; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #fff; }
      main { max-width: 1280px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      h2 { font-size: 18px; margin: 28px 0 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: var(--bg); }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .metric { border: 1px solid var(--border); padding: 12px; background: var(--bg); }
      .metric strong { display: block; font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Ruhroh benchmark pack inspection</h1>
        <p class="muted">${escapeHtml(inspection.source.scenarioDir)}${inspection.source.suiteDir === undefined ? "" : ` / ${escapeHtml(inspection.source.suiteDir)}`}</p>
      </header>
      <section class="grid" aria-label="Benchmark pack overview">
        ${metricHtml("Ready", inspection.ready ? "yes" : "no", inspection.ready ? "pass" : "fail")}
        ${metricHtml("Scenarios", `${inspection.summary.validScenarioCount}/${inspection.summary.scenarioCount} valid`, inspection.summary.invalidScenarioCount === 0 ? "pass" : "fail")}
        ${metricHtml("Suites", `${inspection.summary.validSuiteCount}/${inspection.summary.suiteCount} valid`, inspection.summary.invalidSuiteCount === 0 ? "pass" : "fail")}
        ${metricHtml("Calibration warnings", String(inspection.summary.calibrationWarningCount), inspection.summary.calibrationWarningCount === 0 ? "pass" : "fail")}
        ${metricHtml("Risk review warnings", String(inspection.summary.riskReviewWarningCount), inspection.summary.riskReviewWarningCount === 0 ? "pass" : "fail")}
        ${metricHtml("Difficulty mix", formatPackDifficultyCounts(inspection.summary.difficultyCounts))}
        ${metricHtml("Expected runtime", formatPackRuntimeEstimate(inspection.summary.runtimeEstimate))}
        ${metricHtml("Strict calibration", inspection.requirements.requireFullCalibration ? "required" : "advisory")}
        ${metricHtml("Risk review gate", inspection.requirements.requireRiskReviewed ? "required" : "advisory")}
        ${metricHtml("Fingerprints", `${inspection.scenarios.length + promptFingerprintCount + assetFingerprintCount + privateAssetFingerprintCount} tracked`)}
      </section>
      ${inspection.blockers.length === 0 ? "" : sectionHtml("Blockers", listHtml(inspection.blockers))}
      ${inspection.warnings.length === 0 ? "" : sectionHtml("Warnings", listHtml(inspection.warnings))}
      ${sectionHtml("Scenarios", tableHtml([
        "Status",
        "Scenario",
        "Version",
        "Tier",
        "Difficulty",
        "Expected runtime",
        "Lifecycle",
        "Risk review",
        "Calibration",
        "Lint",
        "Source",
        "Issues",
    ], inspection.scenarios.map((scenario) => [
        scenario.valid ? "valid" : "invalid",
        `${scenario.id ?? "unknown"}${scenario.title === undefined ? "" : ` - ${scenario.title}`}`,
        scenario.scenarioVersion ?? "",
        scenario.tier ?? "",
        scenario.difficulty ?? "",
        scenario.expectedRuntimeSeconds === undefined ? "" : formatSeconds(scenario.expectedRuntimeSeconds),
        scenario.lifecycleStatus ?? "",
        scenario.riskReview.status,
        scenario.calibration === undefined
            ? "missing"
            : `cases=${scenario.calibration.total}; covered=${scenario.calibration.coveredStatuses.join(",") || "none"}; missing=${scenario.calibration.missingStatuses.join(",") || "none"}; warnings=${scenario.calibration.warnings.length}`,
        String(scenario.warningDetails.length),
        localPathCell(scenario.sourcePath, htmlPath),
        [...scenario.errors, ...scenario.warnings, ...scenario.riskReview.warnings, ...(scenario.calibration?.warnings ?? [])].join("; "),
    ])))}
      ${inspection.suites.length === 0 ? "" : sectionHtml("Suites", tableHtml([
        "Status",
        "Suite",
        "Version",
        "Scenarios",
        "Min runs",
        "Difficulty mix",
        "Expected runtime",
        "Collection estimate",
        "Owner",
        "Risk review",
        "Source",
        "Issues",
    ], inspection.suites.map((suite) => [
        suite.valid ? "valid" : "invalid",
        `${suite.id ?? "unknown"}${suite.title === undefined ? "" : ` - ${suite.title}`}`,
        suite.suiteVersion ?? "",
        suite.scenarioIds.join("; "),
        suite.minRuns === undefined ? "" : String(suite.minRuns),
        formatPackDifficultyCounts(suite.difficultyCounts),
        formatPackRuntimeEstimate(suite.runtimeEstimate),
        suite.estimatedCollectionSeconds === undefined ? "" : formatSeconds(suite.estimatedCollectionSeconds),
        suite.owner ?? "",
        suite.riskReview.status,
        localPathCell(suite.sourcePath, htmlPath),
        [...suite.errors, ...suite.warnings, ...suite.riskReview.warnings].join("; "),
    ])))}
      ${sectionHtml("Content Fingerprints", tableHtml([
        "Scenario",
        "Kind",
        "Status",
        "Files",
        "Bytes",
        "SHA-256",
        "Path",
        "Error",
    ], fingerprintRows.map((row) => [
        row.scenario.id ?? row.scenario.sourcePath,
        row.kind,
        row.status,
        row.fileCount,
        row.sizeBytes,
        row.sha256,
        localPathCell(row.path, htmlPath),
        row.error,
    ])))}
    </main>
  </body>
</html>
`;
}
function formatPackDifficultyCounts(counts) {
    const entries = [
        ["intro", counts.intro],
        ["standard", counts.standard],
        ["hard", counts.hard],
        ["expert", counts.expert],
        ["unknown", counts.unknown],
    ];
    return entries.filter(([, count]) => count > 0).map(([label, count]) => `${label}=${count}`).join(", ") || "none";
}
function formatPackRuntimeEstimate(estimate) {
    const parts = [
        `total=${formatSeconds(estimate.totalExpectedRuntimeSeconds)}`,
        estimate.minExpectedRuntimeSeconds === undefined || estimate.maxExpectedRuntimeSeconds === undefined
            ? undefined
            : `range=${formatSeconds(estimate.minExpectedRuntimeSeconds)}-${formatSeconds(estimate.maxExpectedRuntimeSeconds)}`,
        `known=${estimate.knownScenarioCount}`,
        estimate.unknownScenarioCount === 0 ? undefined : `unknown=${estimate.unknownScenarioCount}`,
    ];
    return parts.filter((part) => part !== undefined).join(", ");
}
function formatSeconds(value) {
    if (!Number.isFinite(value)) {
        return "unknown";
    }
    if (value < 60) {
        return `${Math.round(value)}s`;
    }
    if (value % 60 === 0) {
        return `${Math.round(value / 60)}m`;
    }
    return `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;
}
function runListSuitesCommand(options, deps) {
    try {
        const suites = discoverRuhrohSuites(options.suiteDir).map((source) => loadRuhrohSuite(source));
        if (suites.length === 0) {
            throw new Error(`No Ruhroh suites found in ${options.suiteDir}`);
        }
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_suite_list_v1", suites }, null, 2)}\n`);
        }
        else {
            for (const suite of suites) {
                deps.stdout.write(`${suite.id}\t${suite.suiteVersion}\t${suite.scenarioIds.length}\t${suite.title}\n`);
            }
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runInitCommand(options, deps) {
    const rootDir = options.inputPath ?? deps.cwd;
    try {
        const adapterSelection = resolveInitAdapterSelection(options);
        const files = scaffoldRuhrohProject(rootDir, adapterSelection);
        const nextCommands = initNextCommands(rootDir, deps.cwd, adapterSelection);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_init_v1", rootDir, adapter: adapterSelection, files, nextCommands }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh starter initialized at ${path.relative(deps.cwd, rootDir) || "."}\n`);
            deps.stdout.write(`  adapter template: ${adapterSelection.template}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            for (const command of nextCommands.fixture) {
                deps.stdout.write(`  ${command}\n`);
            }
            if (adapterSelection.template !== "fixture") {
                deps.stdout.write("\nSelected adapter checks:\n");
                for (const command of nextCommands.selectedAdapter) {
                    deps.stdout.write(`  ${command}\n`);
                }
            }
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runNewScenarioCommand(options, deps) {
    if (options.scenarioId === undefined) {
        deps.stderr.write("ruhroh failed: new-scenario requires a scenario id.\n");
        return 1;
    }
    const scenarioRoot = options.scenarioDirExplicit
        ? options.scenarioDir
        : path.join(deps.cwd, "ruhroh", "scenarios");
    try {
        const files = scaffoldRuhrohScenario({
            scenarioRoot,
            id: options.scenarioId,
            tier: options.tier ?? "smoke",
        });
        const nextCommands = newScenarioNextCommands(deps.cwd, scenarioRoot, options.scenarioId);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_scenario_v1", scenarioDir: path.join(scenarioRoot, options.scenarioId), files, nextCommands }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh scenario scaffolded at ${path.relative(deps.cwd, path.join(scenarioRoot, options.scenarioId)) || "."}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            for (const command of nextCommands) {
                deps.stdout.write(`  ${command}\n`);
            }
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function newScenarioNextCommands(cwd, scenarioRoot, scenarioId) {
    const scenarioDir = path.join(scenarioRoot, scenarioId);
    const scenarioDirArg = formatWorkflowCommandPath(cwd, scenarioRoot);
    const suiteRootArg = formatWorkflowCommandPath(cwd, siblingSuiteRootForScenarioRoot(scenarioRoot));
    return [
        `$EDITOR ${formatWorkflowCommandPath(cwd, path.join(scenarioDir, "instruction.md"))}`,
        `$EDITOR ${formatWorkflowCommandPath(cwd, path.join(scenarioDir, "scenario.json"))}`,
        `pnpm exec ruhroh validate --scenario-dir ${scenarioDirArg} --scenario ${scenarioId} --json`,
        `pnpm exec ruhroh new-suite local-smoke --scenario-dir ${scenarioDirArg} --suite-dir ${suiteRootArg} --scenario ${scenarioId}`,
    ];
}
function siblingSuiteRootForScenarioRoot(scenarioRoot) {
    return path.join(path.dirname(scenarioRoot), "suites");
}
function runNewSuiteCommand(options, deps) {
    if (options.suiteId === undefined) {
        deps.stderr.write("ruhroh failed: new-suite requires a suite id.\n");
        return 1;
    }
    if (options.suiteScenarioIds.length === 0) {
        deps.stderr.write("ruhroh failed: new-suite requires at least one --scenario.\n");
        return 1;
    }
    const suiteRoot = options.suiteDirExplicit
        ? options.suiteDir
        : path.join(deps.cwd, "ruhroh", "suites");
    try {
        const loaded = discoverRuhrohScenarios(options.scenarioDir).map((source) => loadRuhrohScenario(source));
        const scenarioById = new Map(loaded.map((item) => [item.scenario.id, item.scenario]));
        const missing = options.suiteScenarioIds.filter((scenarioId) => !scenarioById.has(scenarioId));
        if (missing.length > 0) {
            throw new Error(`new-suite references unknown scenario(s) in ${options.scenarioDir}: ${missing.join(", ")}`);
        }
        const duplicateIds = duplicateStrings(options.suiteScenarioIds);
        if (duplicateIds.length > 0) {
            throw new Error(`new-suite scenario list contains duplicate id(s): ${duplicateIds.join(", ")}`);
        }
        const files = scaffoldRuhrohSuite({
            suiteRoot,
            id: options.suiteId,
            scenarioIds: options.suiteScenarioIds,
            scenarioVersions: Object.fromEntries(options.suiteScenarioIds.map((scenarioId) => [
                scenarioId,
                scenarioById.get(scenarioId)?.metadata?.scenarioVersion ?? "0.1.0",
            ])),
            minRuns: Math.max(options.runs, 5),
        });
        const nextCommands = newSuiteNextCommands(deps.cwd, options.scenarioDir, suiteRoot, options.suiteId, Math.max(options.runs, 5));
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_suite_v1", suiteDir: path.join(suiteRoot, options.suiteId), files, nextCommands }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh suite scaffolded at ${path.relative(deps.cwd, path.join(suiteRoot, options.suiteId)) || "."}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            for (const command of nextCommands) {
                deps.stdout.write(`  ${command}\n`);
            }
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function newSuiteNextCommands(cwd, scenarioRoot, suiteRoot, suiteId, runs) {
    const scenarioDirArg = formatWorkflowCommandPath(cwd, scenarioRoot);
    const suiteDirArg = formatWorkflowCommandPath(cwd, suiteRoot);
    return [
        `pnpm exec ruhroh validate --scenario-dir ${scenarioDirArg} --suite-dir ${suiteDirArg} --suite ${suiteId} --json`,
        `pnpm exec ruhroh inspect-pack --scenario-dir ${scenarioDirArg} --suite-dir ${suiteDirArg} --json`,
        `pnpm exec ruhroh inspect-pack --scenario-dir ${scenarioDirArg} --suite-dir ${suiteDirArg} --require-calibrated --require-risk-reviewed --json`,
        `pnpm exec ruhroh plan --scenario-dir ${scenarioDirArg} --suite-dir ${suiteDirArg} --suite ${suiteId} --adapter <adapter-command> --runs ${runs} --json`,
    ];
}
function runNewAdapterCommand(options, deps) {
    if (options.adapter === undefined) {
        deps.stderr.write("ruhroh failed: new-adapter requires an adapter id.\n");
        return 1;
    }
    const adapterRoot = path.join(deps.cwd, "ruhroh", "adapters");
    try {
        const files = scaffoldRuhrohAdapter({
            adapterRoot,
            id: options.adapter,
            template: options.adapterTemplate,
        });
        const nextCommands = newAdapterNextCommands(deps.cwd, adapterRoot, options.adapter);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_adapter_v1", adapterDir: path.join(adapterRoot, options.adapter), template: options.adapterTemplate, files, nextCommands }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh adapter scaffolded at ${path.relative(deps.cwd, path.join(adapterRoot, options.adapter)) || "."}\n`);
            deps.stdout.write(`  template: ${options.adapterTemplate}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            for (const command of nextCommands) {
                deps.stdout.write(`  ${command}\n`);
            }
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function newAdapterNextCommands(cwd, adapterRoot, adapterId) {
    const adapterPath = `./ruhroh/adapters/${adapterId}/run.sh`;
    return [
        `$EDITOR ${formatWorkflowCommandPath(cwd, path.join(adapterRoot, adapterId, "run.sh"))}`,
        `pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ${adapterPath}`,
        `pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ${adapterPath} --json`,
        `pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario <scenario-id> --adapter ${adapterPath} --dry-run`,
    ];
}
function runNewEvaluatorCommand(options, deps) {
    if (options.evaluator === undefined) {
        deps.stderr.write("ruhroh failed: new-evaluator requires an evaluator id.\n");
        return 1;
    }
    const evaluatorRoot = path.join(deps.cwd, "ruhroh", "evaluators");
    try {
        const files = scaffoldRuhrohEvaluator({
            evaluatorRoot,
            id: options.evaluator,
            template: options.evaluatorTemplate,
        });
        const nextCommands = newEvaluatorNextCommands(deps.cwd, evaluatorRoot, options.evaluator);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_evaluator_v1", evaluatorDir: path.join(evaluatorRoot, options.evaluator), template: options.evaluatorTemplate, files, nextCommands }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh evaluator scaffolded at ${path.relative(deps.cwd, path.join(evaluatorRoot, options.evaluator)) || "."}\n`);
            deps.stdout.write(`  template: ${options.evaluatorTemplate}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            for (const command of nextCommands) {
                deps.stdout.write(`  ${command}\n`);
            }
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function newEvaluatorNextCommands(cwd, evaluatorRoot, evaluatorId) {
    return [
        `$EDITOR ${formatWorkflowCommandPath(cwd, path.join(evaluatorRoot, evaluatorId, "run.sh"))}`,
        `export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/${evaluatorId}/run.sh"`,
        "pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell",
        "pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --json",
        "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>",
    ];
}
function runReportCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: report requires a result JSON file or run directory.\n");
        return 1;
    }
    try {
        const run = readRunResult(options.inputPath);
        const summary = summarizeRuhrohRun(run);
        const reviewQueue = summarizeRuhrohReviewQueue([summary]);
        if (options.htmlPath !== undefined) {
            mkdirSync(path.dirname(options.htmlPath), { recursive: true });
            writeFileSync(options.htmlPath, formatRunReportHtml(summary, reviewQueue, options.htmlPath), "utf8");
        }
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_report_v1", summary, reviewQueue, ...(options.htmlPath === undefined ? {} : { htmlPath: options.htmlPath }) }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(options.htmlPath === undefined
                ? formatRunReport(summary, reviewQueue)
                : `Wrote Ruhroh HTML report: ${options.htmlPath}\n`);
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runReviewCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: review requires a result JSON file, run directory, or results directory.\n");
        return 1;
    }
    try {
        const artifacts = readRunResultArtifacts(options.inputPath);
        if (artifacts.length === 0) {
            throw new Error(`No ruhroh_loop_result_v1 JSON files found in ${options.inputPath}`);
        }
        const report = buildReviewQueueReport(options.inputPath, artifacts);
        if (options.htmlPath !== undefined) {
            mkdirSync(path.dirname(options.htmlPath), { recursive: true });
            writeFileSync(options.htmlPath, formatReviewQueueHtml(report, options.htmlPath), "utf8");
        }
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({
                ...report,
                ...(options.htmlPath === undefined ? {} : { htmlPath: options.htmlPath }),
            }, null, 2)}\n`);
        }
        else if (options.htmlPath !== undefined) {
            deps.stdout.write(`Wrote Ruhroh review queue HTML: ${options.htmlPath}\n`);
        }
        else {
            deps.stdout.write(formatReviewQueueReport(report, deps.cwd));
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function buildReviewQueueReport(inputPath, artifacts) {
    const summaries = artifacts.map((artifact) => summarizeRuhrohRun(artifact.run));
    const reviewQueue = summarizeRuhrohReviewQueue(summaries);
    return {
        version: "ruhroh_review_queue_v1",
        source: {
            resultsPath: inputPath,
            resultCount: artifacts.length,
        },
        itemCount: reviewQueue.length,
        requiredCount: reviewQueue.filter((item) => item.priority === "required").length,
        recommendedCount: reviewQueue.filter((item) => item.priority === "recommended").length,
        reviewQueue,
    };
}
function runEvalQualityCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: eval-quality requires a result JSON file, run directory, or results directory.\n");
        return 1;
    }
    try {
        const artifacts = readRunResultArtifacts(options.inputPath);
        if (artifacts.length === 0) {
            throw new Error(`No ruhroh_loop_result_v1 JSON files found in ${options.inputPath}`);
        }
        const report = buildEvalQualityReport(options.inputPath, artifacts);
        if (options.htmlPath !== undefined) {
            mkdirSync(path.dirname(options.htmlPath), { recursive: true });
            writeFileSync(options.htmlPath, formatEvalQualityReportHtml(report, options.htmlPath), "utf8");
        }
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ ...report, ...(options.htmlPath === undefined ? {} : { htmlPath: options.htmlPath }) }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(options.htmlPath === undefined
                ? formatEvalQualityReport(report, deps.cwd)
                : `Wrote Ruhroh eval-quality HTML: ${options.htmlPath}\n`);
        }
        if (!report.ok) {
            deps.stderr.write(`ruhroh eval-quality failed audit gate: ${report.warningCount} warning${report.warningCount === 1 ? "" : "s"} across ${report.source.resultCount} run${report.source.resultCount === 1 ? "" : "s"}\n`);
            return 2;
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function runCalibrateEvaluatorCommand(selected, options, deps) {
    const evaluatorCommand = deps.env.RUHROH_EVAL_COMMAND?.trim();
    if (evaluatorCommand === undefined || evaluatorCommand.length === 0) {
        deps.stderr.write("ruhroh failed: calibrate-evaluator requires RUHROH_EVAL_COMMAND.\n");
        return 1;
    }
    try {
        const report = buildEvalCalibrationReport(selected, options, deps, evaluatorCommand);
        mkdirSync(path.dirname(report.source.reportPath), { recursive: true });
        writeFileSync(report.source.reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        if (options.json) {
            deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatEvalCalibrationReport(report, deps.cwd));
        }
        if (!report.ok) {
            deps.stderr.write(`ruhroh calibrate-evaluator failed calibration gate: ${report.mismatchCount} mismatch${report.mismatchCount === 1 ? "" : "es"}, ${report.infraFailedCount} infrastructure failure${report.infraFailedCount === 1 ? "" : "s"}\n`);
            return 2;
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function buildEvalCalibrationReport(selected, options, deps, evaluatorCommand) {
    const results = [];
    const warnings = [];
    const calibrationRoot = path.join(options.generatedDir, "evaluator-calibration");
    const reportPath = path.join(calibrationRoot, "ruhroh-evaluator-calibration-report.json");
    for (const loaded of selected) {
        const cases = loaded.scenario.evaluation.calibrationCases ?? [];
        if (cases.length === 0) {
            warnings.push(`${loaded.scenario.id}: no calibration cases configured`);
            continue;
        }
        for (const calibrationCase of cases) {
            results.push(runEvalCalibrationCase(loaded, calibrationCase, calibrationRoot, deps, evaluatorCommand));
        }
    }
    const matchedCount = results.filter((result) => result.matched).length;
    const infraFailedCount = results.filter((result) => result.exitCode !== 0 || result.actualStatus === "infra_failed").length;
    const mismatchCount = results.length - matchedCount;
    const ok = results.length > 0 && mismatchCount === 0 && infraFailedCount === 0;
    return {
        $schema: EVAL_CALIBRATION_REPORT_SCHEMA_URL,
        version: "ruhroh_eval_calibration_report_v1",
        source: {
            scenarioDir: options.scenarioDir,
            generatedDir: calibrationRoot,
            evaluatorCommand,
            reportPath,
        },
        ok,
        scenarioCount: selected.length,
        caseCount: results.length,
        matchedCount,
        mismatchCount,
        infraFailedCount,
        warnings,
        nextActions: evalCalibrationNextActions(results, warnings),
        results,
    };
}
function runEvalCalibrationCase(loaded, calibrationCase, calibrationRoot, deps, evaluatorCommand) {
    const caseDir = path.join(calibrationRoot, loaded.scenario.id, safeCalibrationCaseId(calibrationCase.id));
    const workspacePath = path.join(caseDir, "workspace");
    const inputPath = path.join(caseDir, "ruhroh-eval-calibration-input.json");
    const outputPath = path.join(caseDir, "ruhroh-eval-result.json");
    const journeyPath = path.join(caseDir, "ruhroh-loop-journey.json");
    mkdirSync(workspacePath, { recursive: true });
    writeFileSync(path.join(workspacePath, "CALIBRATION.md"), formatCalibrationWorkspaceReadme(loaded.scenario, calibrationCase), "utf8");
    writeJsonFile(journeyPath, {
        version: "ruhroh_implementation_journey_v1",
        scenarioId: loaded.scenario.id,
        calibrationCaseId: calibrationCase.id,
        summary: calibrationCase.inputSummary,
        steps: [],
    });
    writeJsonFile(inputPath, {
        version: "ruhroh_eval_calibration_input_v1",
        scenarioId: loaded.scenario.id,
        scenarioTitle: loaded.scenario.title,
        userPrompt: loaded.scenario.userPrompt,
        scenarioContext: loaded.scenario.evaluation.scenarioContext,
        goalRubric: loaded.scenario.evaluation.goalRubric,
        evidenceGuidance: loaded.scenario.evaluation.evidenceGuidance,
        calibrationCase,
        calibrationCases: loaded.scenario.evaluation.calibrationCases ?? [],
        artifactPaths: {
            workspace: workspacePath,
            journey: journeyPath,
        },
    });
    const invocation = evalCommandInvocation(evaluatorCommand, deps.cwd, deps.env);
    const result = deps.spawn(invocation.command, invocation.args, {
        cwd: deps.cwd,
        env: {
            ...deps.env,
            RUHROH_EVAL_INPUT_PATH: inputPath,
            RUHROH_EVAL_OUTPUT_PATH: outputPath,
            RUHROH_EVAL_WORKSPACE_PATH: workspacePath,
            RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH: workspacePath,
            RUHROH_EVAL_JOURNEY_PATH: journeyPath,
            RUHROH_EVAL_SCENARIO_CONTEXT_JSON: JSON.stringify(loaded.scenario.evaluation.scenarioContext),
            RUHROH_EVAL_GOAL_RUBRIC_JSON: JSON.stringify(loaded.scenario.evaluation.goalRubric),
            RUHROH_EVAL_EVIDENCE_GUIDANCE_JSON: JSON.stringify(loaded.scenario.evaluation.evidenceGuidance),
            RUHROH_EVAL_CALIBRATION_CASES_JSON: JSON.stringify(loaded.scenario.evaluation.calibrationCases ?? []),
            RUHROH_EVAL_ACTIVE_CALIBRATION_CASE_JSON: JSON.stringify(calibrationCase),
            RUHROH_EVAL_PRIVATE_ASSETS_JSON: JSON.stringify([]),
        },
        encoding: "utf8",
        shell: invocation.shell,
    });
    const exitCode = result.status ?? (result.error === undefined ? 0 : 1);
    const stdout = truncateCalibrationOutput(readSpawnText(result.stdout));
    const stderr = truncateCalibrationOutput(readSpawnText(result.stderr));
    if (!existsSync(outputPath)) {
        return {
            scenarioId: loaded.scenario.id,
            caseId: calibrationCase.id,
            expectedStatus: calibrationCase.expectedStatus,
            matched: false,
            exitCode,
            outputPath,
            inputPath,
            workspacePath,
            details: result.error === undefined
                ? "evaluator did not write RUHROH_EVAL_OUTPUT_PATH"
                : `evaluator failed: ${result.error.message}`,
            ...(stdout === undefined ? {} : { stdout }),
            ...(stderr === undefined ? {} : { stderr }),
        };
    }
    try {
        const evalResult = normalizeRuhrohEvalResult(readJsonObject(outputPath));
        const matched = exitCode === 0 && evalResult.status === calibrationCase.expectedStatus;
        return {
            scenarioId: loaded.scenario.id,
            caseId: calibrationCase.id,
            expectedStatus: calibrationCase.expectedStatus,
            actualStatus: evalResult.status,
            matched,
            exitCode,
            outputPath,
            inputPath,
            workspacePath,
            details: matched
                ? "expected status matched evaluator output"
                : `expected ${calibrationCase.expectedStatus}, got ${evalResult.status}${exitCode === 0 ? "" : ` with exit code ${exitCode}`}`,
            ...(stdout === undefined ? {} : { stdout }),
            ...(stderr === undefined ? {} : { stderr }),
        };
    }
    catch (error) {
        return {
            scenarioId: loaded.scenario.id,
            caseId: calibrationCase.id,
            expectedStatus: calibrationCase.expectedStatus,
            matched: false,
            exitCode,
            outputPath,
            inputPath,
            workspacePath,
            details: `could not parse evaluator output: ${error instanceof Error ? error.message : String(error)}`,
            ...(stdout === undefined ? {} : { stdout }),
            ...(stderr === undefined ? {} : { stderr }),
        };
    }
}
function evalCommandInvocation(command, cwd, env) {
    if (commandShellFlagEnabled(env.RUHROH_EVAL_COMMAND_SHELL)) {
        return { command, args: [], shell: true };
    }
    const parts = splitCommandLine(command);
    const executable = parts[0];
    if (executable === undefined) {
        throw new Error("RUHROH_EVAL_COMMAND is empty");
    }
    return {
        command: looksLikeAdapterCommand(executable) && !path.isAbsolute(executable)
            ? path.resolve(cwd, executable)
            : executable,
        args: parts.slice(1),
        shell: false,
    };
}
function splitCommandLine(command) {
    const parts = [];
    let current = "";
    let quote;
    for (let index = 0; index < command.length; index += 1) {
        const char = command[index];
        if (char === undefined) {
            continue;
        }
        if (char === "\\" && quote !== "'") {
            const next = command[index + 1];
            if (next !== undefined) {
                current += next;
                index += 1;
                continue;
            }
        }
        if (char === "\"" || char === "'") {
            if (quote === char) {
                quote = undefined;
                continue;
            }
            if (quote === undefined) {
                quote = char;
                continue;
            }
        }
        if (/\s/u.test(char) && quote === undefined) {
            if (current.length > 0) {
                parts.push(current);
                current = "";
            }
            continue;
        }
        current += char;
    }
    if (quote !== undefined) {
        throw new Error("RUHROH_EVAL_COMMAND contains an unterminated quote");
    }
    if (current.length > 0) {
        parts.push(current);
    }
    return parts;
}
function safeCalibrationCaseId(caseId) {
    const safe = caseId.trim().replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
    return safe.length === 0 || safe === "." || safe === ".." ? "case" : safe;
}
function formatCalibrationWorkspaceReadme(scenario, calibrationCase) {
    return [
        `# Ruhroh Evaluator Calibration: ${scenario.id}/${calibrationCase.id}`,
        "",
        `Scenario: ${scenario.title}`,
        `Expected status: ${calibrationCase.expectedStatus}`,
        "",
        "## Input Summary",
        "",
        calibrationCase.inputSummary,
        "",
        "## Expected Rationale",
        "",
        calibrationCase.rationale,
        "",
    ].join("\n");
}
function evalCalibrationNextActions(results, warnings) {
    const actions = [];
    if (warnings.length > 0) {
        actions.push("Add passed, failed, and review calibration anchors to every selected scenario before trusting evaluator judgments.");
    }
    if (results.some((result) => result.exitCode !== 0)) {
        actions.push("Fix evaluator command failures before collecting benchmark runs.");
    }
    if (results.some((result) => result.actualStatus === undefined)) {
        actions.push("Ensure the evaluator writes ruhroh_eval_result_v1 JSON to RUHROH_EVAL_OUTPUT_PATH for every calibration case.");
    }
    if (results.some((result) => result.actualStatus !== undefined && result.actualStatus !== result.expectedStatus)) {
        actions.push("Tune evaluator rubric handling until calibration case statuses match their expected anchors.");
    }
    if (results.length === 0) {
        actions.push("Select scenarios with evaluation.calibrationCases or add calibration cases to the selected scenarios.");
    }
    return uniquePreserveOrder(actions);
}
function truncateCalibrationOutput(value) {
    if (value === undefined || value.length === 0) {
        return undefined;
    }
    return value.length <= 2000 ? value : `${value.slice(0, 2000)}...`;
}
function formatEvalCalibrationReport(report, cwd) {
    const lines = [
        `evaluator calibration ${path.relative(cwd, report.source.generatedDir) || report.source.generatedDir}: ${report.ok ? "ok" : "failed"}`,
        `  scenarios: ${report.scenarioCount}`,
        `  cases: ${report.caseCount}`,
        `  matched: ${report.matchedCount}`,
        `  mismatches: ${report.mismatchCount}`,
        `  infra failures: ${report.infraFailedCount}`,
    ];
    for (const warning of report.warnings) {
        lines.push(`  warning: ${warning}`);
    }
    for (const result of report.results) {
        lines.push(`  ${result.matched ? "ok" : "failed"}: ${result.scenarioId}/${result.caseId} expected=${result.expectedStatus} actual=${result.actualStatus ?? "missing"} - ${result.details}`);
        lines.push(`    output: ${path.relative(cwd, result.outputPath) || result.outputPath}`);
    }
    if (report.nextActions.length > 0) {
        lines.push("  next actions:");
        for (const action of report.nextActions) {
            lines.push(`    - ${action}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function runPlanCommand(selected, options, deps) {
    try {
        const generated = generateHarborDataset({
            scenarios: selected,
            outputRoot: options.generatedDir,
            agentImportPath: RUHROH_HARBOR_AGENT_IMPORT_PATH,
            artifacts: RUHROH_ARTIFACTS,
        });
        let adapters;
        try {
            adapters = resolveAdapterSelections(options, deps.cwd, deps.env);
        }
        catch (error) {
            deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
            return 1;
        }
        const commands = shardCommands(buildCommands(selected.map((item) => item.scenario), options, generated.datasetPath, adapters, deps.cwd), options);
        const selectedSuite = options.suiteId === undefined ? undefined : loadSelectedSuite(options);
        const runPlanPath = writeRunPlanManifest({
            options,
            selected,
            suite: selectedSuite,
            commands,
            datasetPath: generated.datasetPath,
            harborBin: options.harborBin,
        });
        const runPlan = loadRunPlanManifest(runPlanPath);
        const report = {
            version: "ruhroh_plan_report_v1",
            runPlanPath,
            generatedDir: options.generatedDir,
            datasetPath: generated.datasetPath,
            scenarioCount: selected.length,
            adapterCount: adapters.length,
            sampleCount: commands.length,
            scenarios: selected.map((item) => item.scenario.id),
            adapters: adapters.map((adapter) => adapter.adapterId),
            runPlan: summarizeRunPlan(runPlan),
        };
        if (options.json) {
            deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatPlanReport(report, deps.cwd));
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function formatPlanReport(report, cwd) {
    const selection = isRecord(report.runPlan.selection) ? report.runPlan.selection : undefined;
    const shard = isRecord(selection?.shard) && typeof selection.shard.index === "number" && typeof selection.shard.total === "number"
        ? `${selection.shard.index}/${selection.shard.total}`
        : undefined;
    const lines = [
        `run plan ${path.relative(cwd, report.runPlanPath) || report.runPlanPath}`,
        `  scenarios: ${report.scenarioCount} (${report.scenarios.join(", ")})`,
        `  adapters: ${report.adapterCount} (${report.adapters.join(", ")})`,
        `  samples: ${report.sampleCount}`,
        ...(shard === undefined ? [] : [`  shard: ${shard}`]),
        `  dataset: ${path.relative(cwd, report.datasetPath) || report.datasetPath}`,
    ];
    const samples = Array.isArray(report.runPlan.samples) ? report.runPlan.samples : [];
    for (const sample of samples) {
        if (!isRecord(sample)) {
            continue;
        }
        const label = stringField(sample, "label") ?? "sample";
        const sampleId = stringField(sample, "sampleId") ?? "unknown";
        const sampleSeed = stringField(sample, "sampleSeed") ?? "unknown";
        lines.push(`  - ${label}: ${sampleId} seed=${sampleSeed}`);
    }
    return `${lines.join("\n")}\n`;
}
function buildEvalQualityReport(inputPath, artifacts) {
    const runs = artifacts.map((artifact) => evalQualityRun(artifact));
    const warningCounts = countStringValues(runs.flatMap((run) => run.evalQualityWarnings));
    const humanReviewRequiredCount = runs.filter((run) => run.humanReviewRequired).length;
    const warningCount = Object.values(warningCounts).reduce((total, count) => total + count, 0);
    return {
        version: "ruhroh_eval_quality_v1",
        source: {
            resultsPath: path.resolve(inputPath),
            resultCount: artifacts.length,
        },
        ok: warningCount === 0 && humanReviewRequiredCount === 0,
        warningCount,
        warningCounts,
        humanReviewRequiredCount,
        runs,
        nextActions: evalQualityNextActions(warningCounts, humanReviewRequiredCount),
    };
}
function evalQualityRun(artifact) {
    const summary = summarizeRuhrohRun(artifact.run);
    return {
        resultPath: artifact.path,
        scenarioId: summary.scenarioId,
        adapter: summary.adapter,
        ...(summary.runId === undefined ? {} : { runId: summary.runId }),
        evalStatus: summary.evalStatus,
        score: summary.score,
        evidenceRefCount: summary.evidenceRefs.length,
        criteriaResultCount: summary.criteriaResults.length,
        commandCount: summary.commandsRun.length,
        ...(summary.evalJudge === undefined ? {} : { judge: formatEvalJudge(summary.evalJudge) }),
        judgeVoteCount: summary.evalJudgeVotes.length,
        ...(summary.evalJudgeAgreement === undefined ? {} : {
            judgeAgreement: {
                unanimous: summary.evalJudgeAgreement.unanimous,
                ...(summary.evalJudgeAgreement.majorityStatus === undefined ? {} : { majorityStatus: summary.evalJudgeAgreement.majorityStatus }),
            },
        }),
        evalQualityWarnings: summary.evalQualityWarnings,
        humanReviewRequired: summary.humanReviewRequired,
    };
}
function evalQualityNextActions(warningCounts, humanReviewRequiredCount) {
    const warnings = Object.keys(warningCounts);
    const actions = [];
    if (warnings.some((warning) => warning.includes("evidenceRefs"))) {
        actions.push("Add top-level and criterion-level evidenceRefs that point to inspected files, commands, transcripts, or artifacts.");
    }
    if (warnings.some((warning) => warning.includes("criteriaResults"))) {
        actions.push("Emit criteriaResults for each material rubric item so reviewers can see why the final judgment was reached.");
    }
    if (warnings.some((warning) => warning.includes("judge"))) {
        actions.push("Include judge metadata, model identity, judge votes, and agreement fields for model-backed or hybrid evaluators.");
    }
    if (warnings.some((warning) => warning.includes("confidence"))) {
        actions.push("Resolve low-confidence judgments or route them through the review queue before publishing scores.");
    }
    if (warnings.some((warning) => warning.includes("command evidence"))) {
        actions.push("Explain non-zero evaluator command evidence or fix the evaluator checks that produced it.");
    }
    if (humanReviewRequiredCount > 0) {
        actions.push("Run ruhroh review on the same result root and adjudicate required or recommended human-review items.");
    }
    if (actions.length === 0 && warnings.length > 0) {
        actions.push("Inspect each warning, strengthen evaluator evidence, then rerun ruhroh eval-quality.");
    }
    return uniquePreserveOrder(actions);
}
function formatEvalQualityReport(report, cwd) {
    const lines = [
        `Ruhroh eval-quality ${path.relative(cwd, report.source.resultsPath) || report.source.resultsPath}: ${report.ok ? "ok" : "needs attention"}`,
        `  runs: ${report.source.resultCount}`,
        `  warnings: ${report.warningCount}`,
        `  human review required: ${report.humanReviewRequiredCount}`,
    ];
    if (Object.keys(report.warningCounts).length > 0) {
        lines.push("  warning counts:");
        for (const [warning, count] of Object.entries(report.warningCounts)) {
            lines.push(`    - ${warning}: ${count}`);
        }
    }
    lines.push("  runs:");
    for (const run of report.runs) {
        lines.push(`    - ${run.scenarioId}/${run.adapter}${run.runId === undefined ? "" : ` runId=${run.runId}`} eval=${run.evalStatus} score=${run.score}`);
        lines.push(`      evidenceRefs=${run.evidenceRefCount} criteriaResults=${run.criteriaResultCount} commands=${run.commandCount} judge=${run.judge ?? "none"} judgeVotes=${run.judgeVoteCount}`);
        if (run.evalQualityWarnings.length > 0) {
            for (const warning of run.evalQualityWarnings) {
                lines.push(`      warning: ${warning}`);
            }
        }
        if (run.humanReviewRequired) {
            lines.push("      review: human review required or recommended");
        }
    }
    if (report.nextActions.length > 0) {
        lines.push("  next actions:");
        for (const action of report.nextActions) {
            lines.push(`    - ${action}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function runExamplesCommand(options, deps) {
    const catalog = buildExampleCatalog(resolveRuhrohPackageRoot());
    if (options.json) {
        deps.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
    }
    else {
        deps.stdout.write(formatExampleCatalog(catalog, deps.cwd));
    }
    return 0;
}
function runFirstRunCommand(options, deps) {
    const scenarioDir = options.scenarioDirExplicit ? options.scenarioDir : path.join(deps.cwd, "ruhroh", "scenarios");
    const suiteDir = options.suiteDirExplicit ? options.suiteDir : path.join(deps.cwd, "ruhroh", "suites");
    const scenarioId = options.scenarioId ?? "simple-newsletter";
    const suiteId = options.suiteId ?? "ruhroh-smoke";
    const adapterCommand = path.join(deps.cwd, "ruhroh", "adapters", "fixture-newsletter", "run.sh");
    const evaluatorCommand = path.join(deps.cwd, "ruhroh", "evaluators", "fixture-newsletter", "run.sh");
    const report = buildFirstRunCheckReport({
        options,
        deps,
        scenarioDir,
        suiteDir,
        scenarioId,
        suiteId,
        adapterCommand,
        evaluatorCommand,
    });
    if (options.json) {
        deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
    else {
        deps.stdout.write(formatFirstRunCheckReport(report, deps.cwd));
    }
    return report.ready || (options.allowDryRun && report.dryRunReady) ? 0 : 1;
}
function buildFirstRunCheckReport(input) {
    const checks = [];
    const starterPaths = [
        path.join(input.scenarioDir, input.scenarioId, "scenario.json"),
        path.join(input.suiteDir, input.suiteId, "suite.json"),
        input.adapterCommand,
        input.evaluatorCommand,
    ];
    const missingStarterPaths = starterPaths.filter((itemPath) => !existsSync(itemPath));
    checks.push(missingStarterPaths.length === 0
        ? {
            name: "local-starter",
            status: "ok",
            details: "local fixture scenario, suite, adapter, and evaluator are present",
        }
        : {
            name: "local-starter",
            status: "failed",
            details: `missing local fixture file(s): ${missingStarterPaths.map((itemPath) => path.relative(input.deps.cwd, itemPath) || itemPath).join(", ")}`,
            command: "pnpm exec ruhroh init",
        });
    checks.push(firstRunScenarioCheck(input.scenarioDir, input.scenarioId));
    checks.push(firstRunSuiteCheck(input.suiteDir, input.suiteId, input.scenarioDir, input.scenarioId));
    checks.push(firstRunExecutableCheck("fixture-adapter", input.adapterCommand, "pnpm exec ruhroh init"));
    checks.push(firstRunExecutableCheck("fixture-evaluator", input.evaluatorCommand, "pnpm exec ruhroh init"));
    checks.push(firstRunEnvCheck("adapter-env", "RUHROH_RUN_AGENT_COMMAND", input.deps.env.RUHROH_RUN_AGENT_COMMAND, input.adapterCommand, `export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"`, input.deps.cwd));
    checks.push(firstRunEnvCheck("evaluator-env", "RUHROH_EVAL_COMMAND", input.deps.env.RUHROH_EVAL_COMMAND, input.evaluatorCommand, `export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"`, input.deps.cwd));
    const harborCheck = runSpawnCheck({
        name: "harbor",
        spawn: input.deps.spawn,
        command: input.options.harborBin,
        args: ["--version"],
        cwd: input.deps.cwd,
        env: input.deps.env,
        okDetails: `${input.options.harborBin} is executable`,
    });
    checks.push(harborCheck.status === "failed"
        ? {
            ...runSpawnCheck({
                name: "harbor",
                spawn: input.deps.spawn,
                command: input.options.harborBin,
                args: ["--help"],
                cwd: input.deps.cwd,
                env: input.deps.env,
                okDetails: `${input.options.harborBin} is executable`,
            }),
            command: "install Harbor or pass --harbor-bin <path>",
        }
        : harborCheck);
    const dryRunReady = checks
        .filter((check) => check.name !== "harbor")
        .every((check) => check.status === "ok");
    const fullRunReady = checks.every((check) => check.status === "ok");
    const uniqueNextCommands = firstRunNextCommands(checks, {
        suiteId: input.suiteId,
        scenarioId: input.scenarioId,
        dryRunReady,
        fullRunReady,
    });
    return {
        version: "ruhroh_first_run_check_v1",
        mode: "local_fixture",
        ready: fullRunReady,
        dryRunReady,
        fullRunReady,
        nextAction: firstRunNextAction(checks, uniqueNextCommands, { dryRunReady, fullRunReady }),
        rootDir: input.deps.cwd,
        scenarioDir: input.scenarioDir,
        suiteDir: input.suiteDir,
        scenarioId: input.scenarioId,
        suiteId: input.suiteId,
        adapterCommand: input.adapterCommand,
        evaluatorCommand: input.evaluatorCommand,
        checks,
        nextCommands: uniqueNextCommands,
        docs: ["getting-started", "local-fixture-run", "troubleshooting"],
    };
}
function firstRunNextCommands(checks, input) {
    const commandFor = (name) => checks.find((check) => check.name === name)?.command;
    const starterReady = checks.find((check) => check.name === "local-starter")?.status === "ok";
    if (!starterReady) {
        return ["pnpm exec ruhroh init", "pnpm exec ruhroh first-run"];
    }
    const envCommands = [
        commandFor("adapter-env"),
        commandFor("evaluator-env"),
    ].filter((command) => command !== undefined);
    if (envCommands.length > 0) {
        return uniquePreserveOrder([...envCommands, "pnpm exec ruhroh first-run"]);
    }
    const doctorCommand = `pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ${input.suiteId} --adapter custom-shell`;
    const validateCommand = `pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ${input.suiteId}`;
    const dryRunCommand = `pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario ${input.scenarioId} --adapter custom-shell --dry-run`;
    const fullRunCommand = `pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario ${input.scenarioId} --adapter custom-shell`;
    if (input.dryRunReady && !input.fullRunReady) {
        return [dryRunCommand, "pnpm exec ruhroh first-run"];
    }
    return [doctorCommand, validateCommand, dryRunCommand, fullRunCommand];
}
function firstRunNextAction(checks, nextCommands, readiness) {
    const dryRunCommand = nextCommands.find((command) => command.startsWith("pnpm exec ruhroh run --scenario-dir ") && command.includes("--dry-run") && command.includes("--adapter custom-shell"));
    if (readiness.dryRunReady && !readiness.fullRunReady) {
        return {
            summary: "Run the credential-free dry-run now; install Harbor before the full fixture execution.",
            command: dryRunCommand,
            stageId: "first_fixture_loop",
            docs: ["local-fixture-run", "troubleshooting"],
        };
    }
    const firstBlockingCheck = checks.find((check) => check.status === "failed" && check.command !== undefined);
    if (firstBlockingCheck !== undefined) {
        return {
            summary: `Fix ${firstBlockingCheck.name}: ${firstBlockingCheck.details}`,
            command: firstBlockingCheck.command,
            stageId: "first_fixture_loop",
            docs: ["getting-started", "local-fixture-run", "troubleshooting"],
        };
    }
    const fullRunCommand = nextCommands.find((command) => command.startsWith("pnpm exec ruhroh run --scenario-dir ") && !command.includes("--dry-run") && command.includes("--adapter custom-shell"));
    return {
        summary: "Run the credential-free fixture loop, then inspect the resulting artifacts before wiring a live agent.",
        command: fullRunCommand ?? nextCommands[nextCommands.length - 1],
        stageId: "first_fixture_loop",
        docs: ["local-fixture-run", "artifacts", "report-gallery"],
    };
}
function firstRunScenarioCheck(scenarioDir, scenarioId) {
    const scenarioPath = path.join(scenarioDir, scenarioId);
    if (!existsSync(scenarioPath)) {
        return {
            name: "scenario",
            status: "failed",
            details: `scenario ${scenarioId} not found in ${scenarioDir}`,
            command: "pnpm exec ruhroh init",
        };
    }
    const result = validateRuhrohScenarioSource(scenarioPath);
    if (result.errors.length > 0) {
        return {
            name: "scenario",
            status: "failed",
            details: result.errors.join("; "),
            command: `pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario ${scenarioId}`,
        };
    }
    return {
        name: "scenario",
        status: result.warnings.length === 0 ? "ok" : "warning",
        details: result.warnings.length === 0
            ? `${scenarioId} validates`
            : `${scenarioId} validates with warning(s): ${result.warnings.join("; ")}`,
    };
}
function firstRunSuiteCheck(suiteDir, suiteId, scenarioDir, scenarioId) {
    const suitePath = path.join(suiteDir, suiteId);
    if (!existsSync(suitePath)) {
        return {
            name: "suite",
            status: "failed",
            details: `suite ${suiteId} not found in ${suiteDir}`,
            command: "pnpm exec ruhroh init",
        };
    }
    const scenarioResult = existsSync(path.join(scenarioDir, scenarioId))
        ? validateRuhrohScenarioSource(path.join(scenarioDir, scenarioId))
        : undefined;
    const scenarioVersion = scenarioResult?.scenario?.metadata?.scenarioVersion;
    const result = validateRuhrohSuiteSource(suitePath, {
        availableScenarioIds: scenarioResult?.scenario?.id === undefined ? [] : [scenarioResult.scenario.id],
        availableScenarioVersions: scenarioVersion === undefined ? {} : { [scenarioId]: scenarioVersion },
    });
    if (result.errors.length > 0) {
        return {
            name: "suite",
            status: "failed",
            details: result.errors.join("; "),
            command: `pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ${suiteId}`,
        };
    }
    return {
        name: "suite",
        status: result.warnings.length === 0 ? "ok" : "warning",
        details: result.warnings.length === 0
            ? `${suiteId} validates`
            : `${suiteId} validates with warning(s): ${result.warnings.join("; ")}`,
    };
}
function firstRunExecutableCheck(name, filePath, command) {
    if (!existsSync(filePath)) {
        return {
            name,
            status: "failed",
            details: `${filePath} does not exist`,
            command,
        };
    }
    try {
        const mode = statSync(filePath).mode;
        if ((mode & 0o111) === 0) {
            return {
                name,
                status: "failed",
                details: `${filePath} is not executable`,
                command: `chmod +x ${filePath}`,
            };
        }
    }
    catch (error) {
        return {
            name,
            status: "failed",
            details: `${filePath} could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
            command,
        };
    }
    return {
        name,
        status: "ok",
        details: `${filePath} is executable`,
    };
}
function firstRunEnvCheck(name, envKey, actual, expectedPath, command, cwd) {
    if (actual === undefined || actual.trim().length === 0) {
        return {
            name,
            status: "failed",
            details: `${envKey} is not set for this shell`,
            command,
        };
    }
    const actualPath = firstAdapterCommandPath(actual, cwd) ?? actual;
    if (normalizeExistingPathForCompare(actualPath) !== normalizeExistingPathForCompare(expectedPath)) {
        return {
            name,
            status: "warning",
            details: `${envKey} points at ${actual}; expected the local fixture command ${expectedPath}`,
            command,
        };
    }
    return {
        name,
        status: "ok",
        details: `${envKey} points at the local fixture command`,
    };
}
function normalizeExistingPathForCompare(filePath) {
    const resolved = path.resolve(filePath);
    try {
        return realpathSync(resolved);
    }
    catch {
        return resolved;
    }
}
function formatFirstRunCheckReport(report, cwd) {
    const lines = [
        `Ruhroh first-run: ${report.ready ? "ready" : "not ready"}`,
        `  dry-run ready: ${report.dryRunReady ? "yes" : "no"}`,
        `  full-run ready: ${report.fullRunReady ? "yes" : "no"}`,
        `  next action: ${report.nextAction.summary}`,
        ...(report.nextAction.command === undefined ? [] : [`  command: ${report.nextAction.command}`]),
        `  scenario: ${report.scenarioId} (${path.relative(cwd, report.scenarioDir) || report.scenarioDir})`,
        `  suite: ${report.suiteId} (${path.relative(cwd, report.suiteDir) || report.suiteDir})`,
        "  checks:",
    ];
    for (const check of report.checks) {
        lines.push(`    - ${check.status.toUpperCase()}\t${check.name}\t${check.details}`);
        if (check.command !== undefined) {
            lines.push(`      fix: ${check.command}`);
        }
    }
    lines.push("  next commands:");
    for (const command of report.nextCommands) {
        lines.push(`    ${command}`);
    }
    lines.push(`  docs: ${report.docs.join(", ")}`);
    return `${lines.join("\n")}\n`;
}
function runWorkflowCommand(options, deps) {
    const report = buildWorkflowGuideReport(options, deps);
    if (options.htmlPath !== undefined) {
        mkdirSync(path.dirname(options.htmlPath), { recursive: true });
        writeFileSync(options.htmlPath, formatWorkflowGuideReportHtml(report, options.htmlPath), "utf8");
    }
    if (options.json) {
        deps.stdout.write(`${JSON.stringify({ ...report, ...(options.htmlPath === undefined ? {} : { htmlPath: options.htmlPath }) }, null, 2)}\n`);
    }
    else {
        deps.stdout.write(options.htmlPath === undefined
            ? formatWorkflowGuideReport(report, deps.cwd)
            : `Wrote Ruhroh workflow HTML guide: ${options.htmlPath}\n`);
    }
    return 0;
}
function buildWorkflowGuideReport(options, deps) {
    const scenarioDir = options.scenarioDirExplicit ? options.scenarioDir : path.join(deps.cwd, "ruhroh", "scenarios");
    const suiteDir = options.suiteDirExplicit ? options.suiteDir : path.join(deps.cwd, "ruhroh", "suites");
    const scenarioId = options.scenarioId ?? "simple-newsletter";
    const suiteId = options.suiteId ?? "ruhroh-smoke";
    const adapterCommand = path.join(deps.cwd, "ruhroh", "adapters", "fixture-newsletter", "run.sh");
    const evaluatorCommand = path.join(deps.cwd, "ruhroh", "evaluators", "fixture-newsletter", "run.sh");
    const firstRun = buildFirstRunCheckReport({
        options,
        deps,
        scenarioDir,
        suiteDir,
        scenarioId,
        suiteId,
        adapterCommand,
        evaluatorCommand,
    });
    const runPlanPath = options.runPlanPath ?? path.join(options.generatedDir, "ruhroh-run-plan.json");
    const workflowResultsPath = options.inputPath ?? path.join(deps.cwd, "results");
    const resultPaths = discoverWorkflowResultPaths(deps.cwd, options.inputPath, options.generatedDir);
    const stages = [
        workflowFirstFixtureStage(firstRun, resultPaths, deps.cwd),
        workflowAuthorBenchmarkStage(scenarioDir, suiteDir, scenarioId, suiteId),
        workflowEvaluatorQualityStage(deps, evaluatorCommand, scenarioDir, scenarioId, options.generatedDir),
        workflowPackPreflightStage(deps.cwd, scenarioDir, suiteDir),
        workflowPlanRunsStage(deps.cwd, runPlanPath, scenarioDir, suiteDir, suiteId),
        workflowCompareResultsStage(deps.cwd, resultPaths, workflowResultsPath, runPlanPath, suiteDir, suiteId),
        workflowPublishClaimStage(deps.cwd, resultPaths, workflowResultsPath, runPlanPath, suiteDir, suiteId),
    ];
    const currentStage = stages.find((stage) => stage.status !== "ready" && stage.status !== "optional")?.id ?? "publish_claim";
    const nextAction = workflowNextAction(stages, currentStage);
    return {
        version: "ruhroh_workflow_guide_v1",
        rootDir: deps.cwd,
        scenarioDir,
        suiteDir,
        generatedDir: options.generatedDir,
        currentStage,
        nextAction,
        stages,
        docs: [
            "getting-started",
            "local-fixture-run",
            "concepts",
            "write-a-scenario",
            "write-an-evaluator",
            "write-an-adapter",
            "benchmark-suites",
            "benchmark-pack-registry",
            "publish-claims",
            "claim-registry",
        ],
    };
}
function workflowNextAction(stages, currentStage) {
    const stage = stages.find((item) => item.id === currentStage) ?? stages[0];
    if (stage === undefined) {
        return {
            summary: "No workflow stages are available; run ruhroh first-run to inspect local setup.",
            command: "pnpm exec ruhroh first-run",
            docs: ["getting-started", "troubleshooting"],
        };
    }
    if (stage.id === "first_fixture_loop" && stage.commands[0]?.includes("--dry-run") === true) {
        return {
            summary: "First local fixture loop: Run the credential-free dry-run now; install Harbor before the full fixture execution.",
            command: stage.commands[0],
            stageId: stage.id,
            docs: stage.docs,
        };
    }
    const firstFailedCheck = stage.checks.find((check) => check.status === "failed");
    const firstWarningCheck = stage.checks.find((check) => check.status === "warning");
    const checkSummary = firstFailedCheck === undefined && firstWarningCheck === undefined
        ? stage.summary
        : `${firstFailedCheck?.name ?? firstWarningCheck?.name}: ${firstFailedCheck?.details ?? firstWarningCheck?.details}`;
    return {
        summary: `${stage.title}: ${checkSummary}`,
        command: stage.commands[0],
        stageId: stage.id,
        docs: stage.docs,
    };
}
function workflowFirstFixtureStage(firstRun, resultPaths, cwd) {
    const fixtureResultCheck = resultPaths.length > 0
        ? {
            name: "fixture-result",
            status: "ok",
            details: `${resultPaths.length} ruhroh-loop-result.json file(s) found for first-loop inspection`,
        }
        : {
            name: "fixture-result",
            status: "failed",
            details: "No ruhroh-loop-result.json artifact was found yet; run the full fixture loop before moving on.",
        };
    const hasResultArtifacts = resultPaths.length > 0;
    const firstResultPath = resultPaths[0];
    const commands = hasResultArtifacts
        ? [
            `pnpm exec ruhroh report ${formatWorkflowCommandPath(cwd, firstResultPath)} --html ruhroh-report.html`,
        ]
        : uniquePreserveOrder([
            ...(firstRun.nextAction.command === undefined ? [] : [firstRun.nextAction.command]),
            ...firstRun.nextCommands,
        ]);
    return {
        id: "first_fixture_loop",
        title: "First local fixture loop",
        status: hasResultArtifacts ? "ready" : "needs_action",
        summary: hasResultArtifacts
            ? "A local fixture result artifact exists and can be inspected before authoring or publishing benchmarks."
            : firstRun.ready
                ? "Local fixture setup is ready; run the full fixture loop and inspect its artifacts before moving on."
                : "Start with a credential-free local fixture run before authoring or publishing benchmarks.",
        checks: hasResultArtifacts
            ? [fixtureResultCheck]
            : [
                ...firstRun.checks.map((check) => ({
                    name: check.name,
                    status: check.status,
                    details: check.details,
                })),
                fixtureResultCheck,
            ],
        commands,
        docs: ["getting-started", "local-fixture-run", "troubleshooting", "artifacts", "report-gallery"],
    };
}
function workflowAuthorBenchmarkStage(scenarioDir, suiteDir, scenarioId, suiteId) {
    const scenarioPath = path.join(scenarioDir, scenarioId);
    const suitePath = path.join(suiteDir, suiteId);
    const checks = [
        workflowPathCheck("scenario-dir", scenarioDir, "Run init or new-scenario to create a scenario root."),
        workflowPathCheck("suite-dir", suiteDir, "Run init or new-suite to create a suite root."),
        workflowPathCheck("selected-scenario", scenarioPath, `Create or select scenario ${scenarioId}.`),
        workflowPathCheck("selected-suite", suitePath, `Create or select suite ${suiteId}.`),
    ];
    return {
        id: "author_benchmark",
        title: "Author scenario and suite",
        status: workflowStageStatus(checks),
        summary: workflowStageStatus(checks) === "ready"
            ? "A versioned scenario and suite are present for local benchmark authoring."
            : "Create a scenario, lock it into a suite, and validate both before running agents.",
        checks,
        commands: [
            "pnpm exec ruhroh new-scenario my-task --scenario-dir ruhroh/scenarios",
            "pnpm exec ruhroh new-suite local-smoke --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario my-task",
            "pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke",
        ],
        docs: ["concepts", "write-a-scenario", "scenario-format", "benchmark-suites"],
    };
}
function workflowEvaluatorQualityStage(deps, evaluatorCommand, scenarioDir, scenarioId, generatedDir) {
    const envCommand = deps.env.RUHROH_EVAL_COMMAND;
    const hasEvaluatorCommand = existsSync(evaluatorCommand) || (envCommand !== undefined && envCommand.trim().length > 0);
    const scenarioPath = path.join(scenarioDir, scenarioId);
    const calibrationCount = countScenarioCalibrationCases(scenarioPath);
    const calibrationReportPath = path.join(generatedDir, "evaluator-calibration", "ruhroh-evaluator-calibration-report.json");
    const calibrateCommand = `pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario ${scenarioId} --generated-dir ${path.relative(deps.cwd, generatedDir) || generatedDir} --json`;
    const scaffoldCommands = [
        "pnpm exec ruhroh new-evaluator local-evaluator --template hybrid",
        "export RUHROH_EVAL_COMMAND=\"$PWD/ruhroh/evaluators/local-evaluator/run.sh\"",
    ];
    const checks = [
        hasEvaluatorCommand
            ? {
                name: "evaluator-command",
                status: "ok",
                details: existsSync(evaluatorCommand)
                    ? `local evaluator exists at ${path.relative(deps.cwd, evaluatorCommand) || evaluatorCommand}`
                    : "RUHROH_EVAL_COMMAND is set for this shell",
            }
            : {
                name: "evaluator-command",
                status: "failed",
                details: "No local evaluator command or RUHROH_EVAL_COMMAND was found.",
            },
        calibrationCount > 0
            ? {
                name: "calibration-cases",
                status: "ok",
                details: `${calibrationCount} evaluator calibration case(s) are defined for ${scenarioId}`,
            }
            : {
                name: "calibration-cases",
                status: "failed",
                details: "Add calibration cases so evaluator behavior can be checked before publication.",
            },
        workflowCalibrationReportCheck(calibrationReportPath),
    ];
    const status = workflowStageStatus(checks);
    return {
        id: "evaluator_quality",
        title: "Make evaluator quality operational",
        status,
        summary: status === "ready"
            ? "Evaluator wiring and calibration evidence are ready for repeated benchmark runs."
            : "Configure evaluator calibration and preserve a passing calibration report before collecting repeated runs.",
        checks,
        commands: hasEvaluatorCommand
            ? [calibrateCommand, ...scaffoldCommands]
            : [...scaffoldCommands, calibrateCommand],
        docs: ["write-an-evaluator", "evaluator-cookbook", "adjudication"],
    };
}
function workflowCalibrationReportCheck(reportPath) {
    if (!existsSync(reportPath)) {
        return {
            name: "calibration-report",
            status: "failed",
            details: "No preserved evaluator calibration report was found.",
        };
    }
    try {
        const report = readJsonObject(reportPath);
        if (report.version !== "ruhroh_eval_calibration_report_v1") {
            return {
                name: "calibration-report",
                status: "failed",
                details: `Calibration report has unexpected version in ${reportPath}.`,
            };
        }
        const caseCount = numberField(report, "caseCount");
        const mismatchCount = numberField(report, "mismatchCount");
        const infraFailedCount = numberField(report, "infraFailedCount");
        return report.ok === true
            ? {
                name: "calibration-report",
                status: "ok",
                details: `Calibration report passed ${caseCount} case(s).`,
            }
            : {
                name: "calibration-report",
                status: "failed",
                details: `Calibration report is blocked: ${mismatchCount} mismatch(es), ${infraFailedCount} infrastructure failure(s).`,
            };
    }
    catch (error) {
        return {
            name: "calibration-report",
            status: "failed",
            details: `Calibration report could not be read: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function workflowPackPreflightStage(cwd, scenarioDir, suiteDir) {
    const command = `pnpm exec ruhroh inspect-pack --scenario-dir ${formatWorkflowCommandPath(cwd, scenarioDir)} --suite-dir ${formatWorkflowCommandPath(cwd, suiteDir)} --require-calibrated --require-risk-reviewed --html ruhroh-pack-inspection.html --json`;
    let inspection;
    try {
        inspection = inspectRuhrohBenchmarkPack({
            scenarioDir,
            suiteDir,
            requireFullCalibration: true,
            requireRiskReviewed: true,
        });
    }
    catch (error) {
        return {
            id: "pack_preflight",
            title: "Preflight benchmark pack credibility",
            status: "needs_action",
            summary: "Run strict pack inspection before collecting repeated agent runs.",
            checks: [{
                    name: "inspect-pack",
                    status: "failed",
                    details: `Strict benchmark-pack inspection failed: ${error instanceof Error ? error.message : String(error)}`,
                }],
            commands: [command],
            docs: ["benchmark-pack-registry", "benchmark-methodology", "scenario-evolution", "evaluator-cookbook"],
        };
    }
    const checks = [
        inspection.blockers.length === 0
            ? {
                name: "strict-pack-inspection",
                status: inspection.warnings.length === 0 ? "ok" : "warning",
                details: inspection.warnings.length === 0
                    ? `Pack inspection passed: ${inspection.summary.scenarioCount} scenario(s), ${inspection.summary.suiteCount} suite(s), calibration and risk-review gates satisfied.`
                    : `Pack inspection passed with ${inspection.warnings.length} warning(s); review them before publishing.`,
            }
            : {
                name: "strict-pack-inspection",
                status: "failed",
                details: `Strict pack inspection has ${inspection.blockers.length} blocker(s): ${inspection.blockers.slice(0, 3).join("; ")}${inspection.blockers.length > 3 ? "; ..." : ""}`,
            },
    ];
    const status = workflowStageStatus(checks);
    return {
        id: "pack_preflight",
        title: "Preflight benchmark pack credibility",
        status,
        summary: status === "ready"
            ? "Scenario versions, calibration coverage, contamination review, and reward-hacking review are ready for collection."
            : "Run strict pack inspection before collecting repeated agent runs.",
        checks,
        commands: [command],
        docs: ["benchmark-pack-registry", "benchmark-methodology", "scenario-evolution", "evaluator-cookbook"],
    };
}
function workflowPlanRunsStage(cwd, runPlanPath, scenarioDir, suiteDir, suiteId) {
    const checks = [
        workflowPathCheck("run-plan", runPlanPath, "Generate a versioned run plan before comparing repeated agent runs."),
    ];
    return {
        id: "plan_runs",
        title: "Plan repeated agent runs",
        status: workflowStageStatus(checks),
        summary: existsSync(runPlanPath)
            ? "A run plan exists for repeatable adapter and scenario coverage."
            : "Create a run plan so coverage, sample IDs, and comparison claims are reproducible.",
        checks,
        commands: [
            `pnpm exec ruhroh plan --scenario-dir ${formatWorkflowCommandPath(cwd, scenarioDir)} --suite-dir ${formatWorkflowCommandPath(cwd, suiteDir)} --suite ${suiteId} --adapter custom-shell --runs 5 --json`,
        ],
        docs: ["benchmark-methodology", "benchmark-suites", "cli-reference"],
    };
}
function workflowCompareResultsStage(cwd, resultPaths, workflowResultsPath, runPlanPath, suiteDir, suiteId) {
    const resultsArg = formatWorkflowCommandPath(cwd, workflowResultsPath);
    const runPlanArg = formatWorkflowCommandPath(cwd, runPlanPath);
    const checks = [
        resultPaths.length > 0
            ? {
                name: "run-results",
                status: "ok",
                details: `${resultPaths.length} ruhroh-loop-result.json file(s) found`,
            }
            : {
                name: "run-results",
                status: "failed",
                details: "No run results were found in the provided path, results/, ruhroh/results/, or .generated/ruhroh/.",
            },
        workflowPathCheck("run-plan", runPlanPath, "Compare against the run plan generated for this cohort."),
    ];
    return {
        id: "compare_results",
        title: "Compare agents with evidence",
        status: workflowStageStatus(checks),
        summary: workflowStageStatus(checks) === "ready"
            ? "Run results and a plan are available for artifact-backed comparison."
            : "Collect completed runs and compare them against the planned cohort before publishing claims.",
        checks,
        commands: [
            `pnpm exec ruhroh compare ${resultsArg} --suite-dir ${formatWorkflowCommandPath(cwd, suiteDir)} --suite ${suiteId} --run-plan ${runPlanArg} --html ruhroh-compare.html`,
            `pnpm exec ruhroh review ${resultsArg} --json`,
            `pnpm exec ruhroh eval-quality ${resultsArg} --html ruhroh-eval-quality.html --json`,
        ],
        docs: ["artifacts", "report-gallery", "benchmark-methodology"],
    };
}
function workflowPublishClaimStage(cwd, resultPaths, workflowResultsPath, runPlanPath, suiteDir, suiteId) {
    const resultsArg = formatWorkflowCommandPath(cwd, workflowResultsPath);
    const runPlanArg = formatWorkflowCommandPath(cwd, runPlanPath);
    const publicationRoot = workflowPublicationArtifactRoot(cwd, workflowResultsPath);
    const claimPath = path.join(publicationRoot, "benchmark-claim.json");
    const bundleManifestPath = path.join(publicationRoot, "ruhroh-publication", "manifest.json");
    const bundlePath = path.join(publicationRoot, "ruhroh-publication");
    const claimIndexJsonPath = path.join(publicationRoot, "claim-index.json");
    const claimIndexHtmlPath = path.join(publicationRoot, "ruhroh-claims.html");
    const bundleArg = formatWorkflowCommandPath(cwd, bundlePath);
    const claimIndexJsonArg = formatWorkflowCommandPath(cwd, claimIndexJsonPath);
    const claimIndexHtmlArg = formatWorkflowCommandPath(cwd, claimIndexHtmlPath);
    const checks = [
        resultPaths.length > 0 && existsSync(runPlanPath)
            ? {
                name: "publish-inputs",
                status: "ok",
                details: "Run results and run plan are available for publish-check.",
            }
            : {
                name: "publish-inputs",
                status: "failed",
                details: "Publish-check needs completed run results and the matching run plan.",
            },
        existsSync(claimPath) || existsSync(bundleManifestPath)
            ? {
                name: "claim-or-bundle",
                status: "ok",
                details: existsSync(bundleManifestPath)
                    ? "publication bundle manifest exists"
                    : "benchmark claim JSON exists",
            }
            : {
                name: "claim-or-bundle",
                status: "warning",
                details: "No benchmark-claim.json or ruhroh-publication bundle has been written yet.",
            },
        workflowPublicationBundleValidationCheck(bundlePath, bundleManifestPath),
        existsSync(claimIndexJsonPath) || existsSync(claimIndexHtmlPath)
            ? workflowClaimIndexReadinessCheck(claimIndexJsonPath, claimIndexHtmlPath)
            : {
                name: "registry-index",
                status: "warning",
                details: "No claim-index.json or ruhroh-claims.html registry catalog has been written yet.",
            },
    ];
    const status = workflowStageStatus(checks);
    const hasPublishArtifacts = existsSync(claimPath) || existsSync(bundleManifestPath);
    const summary = status === "ready"
        ? "Publication artifacts are present and validation evidence is available for review."
        : hasPublishArtifacts
            ? "Validate the publication bundle and registry index before making external claims."
            : "Use publish-check to turn comparison results into a source-verified claim or publication bundle.";
    return {
        id: "publish_claim",
        title: "Publish an audit-ready claim",
        status,
        summary,
        checks,
        commands: [
            `pnpm exec ruhroh publish-check ${resultsArg} --suite-dir ${formatWorkflowCommandPath(cwd, suiteDir)} --suite ${suiteId} --run-plan ${runPlanArg} --bundle ${bundleArg} --verify-sources`,
            `pnpm exec ruhroh validate-bundle ${bundleArg} --json`,
            `pnpm exec ruhroh claim-index ${bundleArg} --html ${claimIndexHtmlArg} --json > ${claimIndexJsonArg}`,
        ],
        docs: ["publish-claims", "claim-registry", "result-json-reference", "benchmark-methodology"],
    };
}
function workflowPublicationBundleValidationCheck(bundlePath, bundleManifestPath) {
    if (!existsSync(bundleManifestPath)) {
        return {
            name: "bundle-validation",
            status: "warning",
            details: "No publication bundle manifest is available for validate-bundle yet.",
        };
    }
    try {
        const validation = validateRuhrohPublishBundle(bundlePath);
        if (!validation.valid) {
            const failures = validation.checks
                .filter((check) => check.status === "failed")
                .map((check) => `${check.name}: ${check.details}`)
                .slice(0, 3);
            return {
                name: "bundle-validation",
                status: "failed",
                details: `Publication bundle validation failed: ${failures.join("; ")}`,
            };
        }
        if (!validation.publishable) {
            const warnings = validation.checks
                .filter((check) => check.status === "warning")
                .map((check) => `${check.name}: ${check.details}`)
                .slice(0, 3);
            return {
                name: "bundle-validation",
                status: "failed",
                details: warnings.length === 0
                    ? "Publication bundle is structurally valid but embedded publish-check or claim readiness is blocked."
                    : `Publication bundle is structurally valid but blocked: ${warnings.join("; ")}`,
            };
        }
        return {
            name: "bundle-validation",
            status: "ok",
            details: "Publication bundle is valid and publishable.",
        };
    }
    catch (error) {
        return {
            name: "bundle-validation",
            status: "failed",
            details: `Publication bundle could not be validated: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function workflowClaimIndexReadinessCheck(claimIndexJsonPath, claimIndexHtmlPath) {
    if (!existsSync(claimIndexJsonPath)) {
        return {
            name: "registry-index",
            status: "warning",
            details: "ruhroh-claims.html exists, but claim-index.json is missing for registry ingestion.",
        };
    }
    try {
        const index = readJsonObject(claimIndexJsonPath);
        if (index.version !== "ruhroh_claim_index_v1") {
            return {
                name: "registry-index",
                status: "failed",
                details: "claim-index.json is not a ruhroh_claim_index_v1 report.",
            };
        }
        const registryReady = index.registryReady === true;
        const blockers = Array.isArray(index.registryBlockers)
            ? index.registryBlockers.filter((blocker) => typeof blocker === "string")
            : [];
        if (!registryReady) {
            return {
                name: "registry-index",
                status: "failed",
                details: blockers.length === 0
                    ? "claim-index.json exists but registryReady is false."
                    : `claim-index.json exists but registry is blocked: ${blockers.slice(0, 3).join("; ")}`,
            };
        }
        return {
            name: "registry-index",
            status: "ok",
            details: existsSync(claimIndexHtmlPath)
                ? "claim-index.json is registry-ready and ruhroh-claims.html exists for review."
                : "claim-index.json is registry-ready.",
        };
    }
    catch (error) {
        return {
            name: "registry-index",
            status: "failed",
            details: `claim-index.json could not be read: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
function workflowPublicationArtifactRoot(cwd, workflowResultsPath) {
    const resolvedResultsPath = path.isAbsolute(workflowResultsPath)
        ? workflowResultsPath
        : path.resolve(cwd, workflowResultsPath);
    const relativeFromCwd = path.relative(cwd, resolvedResultsPath);
    if (relativeFromCwd.length === 0) {
        return cwd;
    }
    if (relativeFromCwd.startsWith("..") || path.isAbsolute(relativeFromCwd)) {
        return path.dirname(resolvedResultsPath);
    }
    const firstSegment = relativeFromCwd.split(path.sep)[0];
    return firstSegment === "results" || firstSegment === ".generated"
        ? cwd
        : path.dirname(resolvedResultsPath);
}
function workflowPathCheck(name, itemPath, missingDetails) {
    if (!existsSync(itemPath)) {
        return {
            name,
            status: "failed",
            details: missingDetails,
        };
    }
    return {
        name,
        status: "ok",
        details: `${itemPath} exists`,
    };
}
function workflowStageStatus(checks) {
    return checks.some((check) => check.status === "failed") ? "needs_action" : "ready";
}
function countScenarioCalibrationCases(scenarioPath) {
    if (!existsSync(scenarioPath)) {
        return 0;
    }
    try {
        const result = validateRuhrohScenarioSource(scenarioPath);
        return result.scenario?.evaluation.calibrationCases?.length ?? 0;
    }
    catch {
        return 0;
    }
}
function discoverWorkflowResultPaths(cwd, inputPath, generatedDir) {
    const candidates = inputPath === undefined
        ? uniquePreserveOrder([
            path.join(cwd, "results"),
            path.join(cwd, "ruhroh", "results"),
            generatedDir,
        ])
        : [inputPath];
    const resultPaths = [];
    for (const candidate of candidates) {
        if (!existsSync(candidate)) {
            continue;
        }
        try {
            resultPaths.push(...resolveRunResultPaths(candidate));
        }
        catch {
            continue;
        }
    }
    return uniquePreserveOrder(resultPaths);
}
function quoteWorkflowPath(itemPath) {
    return itemPath.includes(" ") ? JSON.stringify(itemPath) : itemPath;
}
function formatWorkflowCommandPath(cwd, itemPath) {
    const relative = path.relative(cwd, itemPath);
    const displayPath = relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative)
        ? relative
        : itemPath;
    return quoteWorkflowPath(displayPath);
}
function formatWorkflowGuideReport(report, cwd) {
    const lines = [
        "Ruhroh workflow guide",
        `  current stage: ${report.currentStage}`,
        `  next action: ${report.nextAction.summary}`,
        ...(report.nextAction.command === undefined ? [] : [`  command: ${report.nextAction.command}`]),
        `  root: ${path.relative(cwd, report.rootDir) || report.rootDir}`,
        `  generated: ${path.relative(cwd, report.generatedDir) || report.generatedDir}`,
    ];
    for (const stage of report.stages) {
        lines.push("", `${stage.status.toUpperCase()}\t${stage.title}`, `  ${stage.summary}`);
        for (const check of stage.checks) {
            lines.push(`  - ${check.status.toUpperCase()}\t${check.name}\t${check.details}`);
        }
        lines.push("  commands:");
        for (const command of stage.commands) {
            lines.push(`    ${command}`);
        }
        lines.push(`  docs: ${stage.docs.join(", ")}`);
    }
    lines.push("", `Docs path: ${report.docs.join(" -> ")}`);
    return `${lines.join("\n")}\n`;
}
function formatWorkflowGuideReportHtml(report, htmlPath) {
    const nextActionStage = report.nextAction.stageId === undefined
        ? undefined
        : report.stages.find((stage) => stage.id === report.nextAction.stageId);
    const nextActionMetricClass = nextActionStage === undefined
        ? "pass"
        : nextActionStage.status === "ready" || nextActionStage.status === "optional"
            ? "pass"
            : nextActionStage.status === "needs_action" || nextActionStage.status === "blocked"
                ? "fail"
                : "";
    const rootDisplay = htmlPath === undefined ? report.rootDir : ".";
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Ruhroh workflow guide</title>
    <style>
      body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f7f7f2; color: #1f2933; }
      main { max-width: 1120px; margin: 0 auto; padding: 40px 24px 64px; }
      header { margin-bottom: 24px; }
      h1 { margin: 0 0 8px; font-size: 32px; line-height: 1.15; }
      h2 { margin-top: 0; font-size: 18px; }
      h3 { margin: 0 0 8px; font-size: 16px; }
      section { background: #fff; border: 1px solid #d9ded7; border-radius: 8px; padding: 20px; margin: 16px 0; }
      .muted { color: #5f6b6d; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; background: transparent; border: 0; padding: 0; }
      .metric { background: #fff; border: 1px solid #d9ded7; border-radius: 8px; padding: 14px; }
      .metric strong { display: block; color: #5f6b6d; font-size: 12px; text-transform: uppercase; margin-bottom: 6px; }
      .metric span { display: block; font-size: 18px; font-weight: 700; }
      .pass { color: #0f766e; }
      .fail { color: #b42318; }
      .stage { border-left: 6px solid #aeb8b2; }
      .stage.ready { border-left-color: #0f766e; }
      .stage.needs_action, .stage.blocked { border-left-color: #b42318; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
      th, td { border-bottom: 1px solid #e5e8e3; padding: 8px; text-align: left; vertical-align: top; }
      th { color: #5f6b6d; font-size: 12px; text-transform: uppercase; }
      code { background: #eef1ec; border-radius: 4px; padding: 2px 5px; }
      a { color: #265c83; }
      ul { margin: 10px 0 0; padding-left: 20px; }
      li { margin: 6px 0; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Ruhroh workflow guide</h1>
        <p class="muted">A read-only path from first local fixture run to artifact-backed comparison and audit-ready publication.</p>
      </header>
      <section class="grid" aria-label="Workflow overview">
        ${metricHtml("Current stage", workflowStageTitle(report, report.currentStage))}
        ${metricHtml("Next action", report.nextAction.stageId === undefined ? "none" : workflowStageTitle(report, report.nextAction.stageId), nextActionMetricClass)}
        ${metricHtml("Ready stages", `${report.stages.filter((stage) => stage.status === "ready").length}/${report.stages.length}`, report.stages.every((stage) => stage.status === "ready" || stage.status === "optional") ? "pass" : "")}
        ${metricHtml("Root", rootDisplay)}
      </section>
      ${sectionHtml("Next Action", [
        `<p>${escapeHtml(report.nextAction.summary)}</p>`,
        report.nextAction.command === undefined ? "" : `<p><code>${escapeHtml(report.nextAction.command)}</code></p>`,
        report.nextAction.docs.length === 0 ? "" : `<p class="muted">Docs: ${escapeHtml(report.nextAction.docs.join(", "))}</p>`,
    ].join(""))}
      ${sectionHtml("Project Paths", tableHtml([
        "Name",
        "Path",
    ], [
        ["Scenario directory", localPathCell(report.scenarioDir, htmlPath)],
        ["Suite directory", localPathCell(report.suiteDir, htmlPath)],
        ["Generated directory", localPathCell(report.generatedDir, htmlPath)],
    ]))}
      ${report.stages.map((stage) => `<section class="stage ${escapeHtml(stage.status)}">
        <h2>${escapeHtml(stage.title)}</h2>
        <p><strong>Status:</strong> <span class="${stage.status === "ready" ? "pass" : stage.status === "needs_action" || stage.status === "blocked" ? "fail" : ""}">${escapeHtml(stage.status)}</span></p>
        <p>${escapeHtml(stage.summary)}</p>
        ${tableHtml([
        "Check",
        "Status",
        "Details",
    ], stage.checks.map((check) => [
        check.name,
        { html: `<span class="${check.status === "ok" ? "pass" : check.status === "failed" ? "fail" : ""}">${escapeHtml(check.status)}</span>` },
        workflowHtmlDetail(check.details, report.rootDir, htmlPath),
    ]))}
        <h3>Commands</h3>
        ${tableHtml(["Command"], stage.commands.map((command) => [{ html: `<code>${escapeHtml(command)}</code>` }]))}
        <p class="muted">Docs: ${escapeHtml(stage.docs.join(", "))}</p>
      </section>`).join("")}
      ${sectionHtml("Workflow Docs", listHtml(report.docs))}
    </main>
  </body>
</html>
`;
}
function workflowStageTitle(report, stageId) {
    return report.stages.find((stage) => stage.id === stageId)?.title ?? stageId;
}
function workflowHtmlDetail(details, rootDir, htmlPath) {
    if (htmlPath === undefined || rootDir.length === 0) {
        return details;
    }
    const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir.slice(0, -1) : rootDir;
    return details.split(normalizedRoot).join(".");
}
function runExplainCommand(options, deps) {
    const catalog = publishCheckRemediationCatalog();
    const remediation = options.explainCode === undefined
        ? catalog
        : catalog.filter((item) => item.code === options.explainCode);
    if (remediation.length === 0) {
        deps.stderr.write(`ruhroh failed: Unknown remediation code: ${options.explainCode}\n`);
        deps.stderr.write(`Known remediation codes: ${catalog.map((item) => item.code).join(", ")}\n`);
        return 1;
    }
    const report = {
        version: "ruhroh_explain_v1",
        ...(options.explainCode === undefined ? {} : { code: options.explainCode }),
        remediation,
    };
    if (options.json) {
        deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
    else {
        deps.stdout.write(formatExplainReport(report));
    }
    return 0;
}
function formatExplainReport(report) {
    const lines = report.code === undefined
        ? ["Ruhroh publish-check remediation codes:"]
        : [`Ruhroh remediation: ${report.code}`];
    for (const item of report.remediation) {
        lines.push(`  - ${item.code}`);
        lines.push(`      category: ${item.category}`);
        lines.push(`      severity: ${item.severity}`);
        lines.push(`      action: ${item.action}`);
        lines.push(`      docs: ${item.docs}`);
        lines.push(`      example blocker: ${item.blocker}`);
    }
    return `${lines.join("\n")}\n`;
}
function runPublishCheckCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: publish-check requires a directory containing Ruhroh result artifacts.\n");
        return 1;
    }
    const bundlePaths = options.bundlePath === undefined ? undefined : publishBundlePaths(options.bundlePath);
    const compareOptions = {
        ...options,
        json: true,
        requirePublishable: false,
        ...(bundlePaths === undefined || options.htmlPath !== undefined ? {} : { htmlPath: bundlePaths.compareHtmlPath }),
        ...(bundlePaths === undefined || options.benchmarkClaimPath !== undefined ? {} : { benchmarkClaimPath: bundlePaths.benchmarkClaimPath }),
        ...(bundlePaths === undefined || options.benchmarkSummaryPath !== undefined ? {} : { benchmarkSummaryPath: bundlePaths.benchmarkSummaryPath }),
    };
    const effectiveHtmlPath = compareOptions.htmlPath;
    const effectiveBenchmarkClaimPath = compareOptions.benchmarkClaimPath;
    const effectiveBenchmarkSummaryPath = compareOptions.benchmarkSummaryPath;
    const compareStdout = [];
    const compareCode = runCompareCommand(compareOptions, {
        ...deps,
        stdout: {
            write: (chunk) => {
                compareStdout.push(chunk);
                return true;
            },
        },
    });
    if (compareCode !== 0) {
        return compareCode;
    }
    let compare;
    try {
        compare = JSON.parse(compareStdout.join(""));
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: publish-check could not read compare output: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
    const benchmarkClaim = isRecord(compare.benchmarkClaim) ? compare.benchmarkClaim : undefined;
    if (benchmarkClaim === undefined) {
        deps.stderr.write("ruhroh failed: publish-check compare output did not include benchmarkClaim.\n");
        return 1;
    }
    const evaluatorCalibrationReportPath = discoverEvaluatorCalibrationReportPath(options.generatedDir);
    if (evaluatorCalibrationReportPath !== undefined) {
        attachEvaluatorCalibrationReportSource(compare, benchmarkClaim, evaluatorCalibrationReportPath);
        try {
            if (effectiveBenchmarkClaimPath !== undefined) {
                writeJsonFile(effectiveBenchmarkClaimPath, benchmarkClaim);
            }
            const benchmarkSummary = isRecord(compare.benchmarkSummary) ? compare.benchmarkSummary : undefined;
            if (effectiveBenchmarkSummaryPath !== undefined && benchmarkSummary !== undefined) {
                writeJsonFile(effectiveBenchmarkSummaryPath, benchmarkSummary);
            }
        }
        catch (error) {
            deps.stderr.write(`ruhroh failed: publish-check could not update calibration source exports: ${error instanceof Error ? error.message : String(error)}\n`);
            return 1;
        }
    }
    const sourceVerification = options.verifySources
        ? verifyRuhrohBenchmarkClaimSources(benchmarkClaim, effectiveBenchmarkClaimPath ?? path.join(options.inputPath, "benchmark-claim.json"))
        : undefined;
    const report = buildRuhrohPublishCheckReport({
        source: {
            resultsPath: options.inputPath,
            ...(options.suiteId === undefined ? {} : { suiteId: options.suiteId }),
            ...(options.runPlanPath === undefined ? {} : { runPlanPath: options.runPlanPath }),
            ...(options.rerunLedgerPath === undefined ? {} : { rerunLedgerPath: options.rerunLedgerPath }),
            ...(effectiveBenchmarkClaimPath === undefined ? {} : { benchmarkClaimPath: effectiveBenchmarkClaimPath }),
            ...(effectiveBenchmarkSummaryPath === undefined ? {} : { benchmarkSummaryPath: effectiveBenchmarkSummaryPath }),
            ...(effectiveHtmlPath === undefined ? {} : { htmlPath: effectiveHtmlPath }),
            ...(options.summaryMarkdownPath === undefined ? {} : { summaryMarkdownPath: options.summaryMarkdownPath }),
            ...(options.bundlePath === undefined ? {} : { bundlePath: options.bundlePath }),
            ...(evaluatorCalibrationReportPath === undefined ? {} : { evaluatorCalibrationReportPath }),
        },
        compare,
        sourceVerification,
    });
    if (options.bundlePath !== undefined) {
        try {
            writePublishBundle(options, report, benchmarkClaim, deps.cwd);
        }
        catch (error) {
            deps.stderr.write(`ruhroh failed: publish-check could not write bundle: ${error instanceof Error ? error.message : String(error)}\n`);
            return 1;
        }
    }
    if (options.summaryMarkdownPath !== undefined) {
        try {
            mkdirSync(path.dirname(options.summaryMarkdownPath), { recursive: true });
            writeFileSync(options.summaryMarkdownPath, formatPublishCheckMarkdownSummary(report, deps.cwd), "utf8");
        }
        catch (error) {
            deps.stderr.write(`ruhroh failed: publish-check could not write Markdown summary: ${error instanceof Error ? error.message : String(error)}\n`);
            return 1;
        }
    }
    if (options.json) {
        deps.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    }
    else {
        deps.stdout.write(formatPublishCheckReport(report, deps.cwd));
    }
    if (!report.publishable) {
        deps.stderr.write(`ruhroh publish-check failed publishability gate: ${report.blockerCount} blocker${report.blockerCount === 1 ? "" : "s"}\n`);
        return 2;
    }
    return 0;
}
function evaluatorCalibrationReportPath(generatedDir) {
    return path.join(generatedDir, EVALUATOR_CALIBRATION_REPORT_FILE);
}
function discoverEvaluatorCalibrationReportPath(generatedDir) {
    const reportPath = evaluatorCalibrationReportPath(generatedDir);
    return existsSync(reportPath) && statSync(reportPath).isFile() ? reportPath : undefined;
}
function attachEvaluatorCalibrationReportSource(compare, benchmarkClaim, reportPath) {
    const sha256 = sha256File(reportPath);
    attachEvaluatorCalibrationReportSourceFields(benchmarkClaim, reportPath, sha256);
    const benchmarkSummary = isRecord(compare.benchmarkSummary) ? compare.benchmarkSummary : undefined;
    if (benchmarkSummary !== undefined) {
        attachEvaluatorCalibrationReportSourceFields(benchmarkSummary, reportPath, sha256);
    }
    compare.benchmarkClaim = benchmarkClaim;
}
function attachEvaluatorCalibrationReportSourceFields(artifact, reportPath, sha256) {
    const source = isRecord(artifact.source) ? { ...artifact.source } : {};
    source.evaluatorCalibrationReportPath = reportPath;
    source.evaluatorCalibrationReportSha256 = sha256;
    artifact.source = source;
}
function publishBundlePaths(bundlePath) {
    return {
        bundlePath,
        manifestPath: path.join(bundlePath, "manifest.json"),
        readmePath: path.join(bundlePath, "README.md"),
        publishCheckPath: path.join(bundlePath, "publish-check.json"),
        compareHtmlPath: path.join(bundlePath, "ruhroh-compare.html"),
        benchmarkClaimPath: path.join(bundlePath, "benchmark-claim.json"),
        benchmarkSummaryPath: path.join(bundlePath, "benchmark-summary.json"),
        reviewJsonPath: path.join(bundlePath, "ruhroh-review.json"),
        reviewHtmlPath: path.join(bundlePath, "ruhroh-review.html"),
        evalQualityPath: path.join(bundlePath, "ruhroh-eval-quality.json"),
        evalQualityHtmlPath: path.join(bundlePath, "ruhroh-eval-quality.html"),
    };
}
function writePublishBundle(options, report, benchmarkClaim, cwd) {
    if (options.inputPath === undefined || options.bundlePath === undefined) {
        return;
    }
    const paths = publishBundlePaths(options.bundlePath);
    mkdirSync(paths.bundlePath, { recursive: true });
    const artifacts = publishBundleArtifacts(options.inputPath, benchmarkClaim);
    const reviewReport = buildReviewQueueReport(options.inputPath, artifacts);
    const evalQualityReport = buildEvalQualityReport(options.inputPath, artifacts);
    const benchmarkSummary = isRecord(report.compare.benchmarkSummary) ? report.compare.benchmarkSummary : undefined;
    const localized = localizePublishBundleSources(report, benchmarkClaim, benchmarkSummary, paths);
    writeJsonFile(paths.publishCheckPath, localized.report);
    writeJsonFile(paths.benchmarkClaimPath, localized.benchmarkClaim);
    if (localized.benchmarkSummary !== undefined) {
        writeJsonFile(paths.benchmarkSummaryPath, localized.benchmarkSummary);
    }
    if (options.htmlPath !== undefined && path.resolve(options.htmlPath) !== path.resolve(paths.compareHtmlPath)) {
        writeFileSync(paths.compareHtmlPath, readFileSync(options.htmlPath, "utf8"), "utf8");
    }
    writeJsonFile(paths.reviewJsonPath, reviewReport);
    writeFileSync(paths.reviewHtmlPath, formatReviewQueueHtml(reviewReport, paths.reviewHtmlPath), "utf8");
    writeJsonFile(paths.evalQualityPath, evalQualityReport);
    writeFileSync(paths.evalQualityHtmlPath, formatEvalQualityReportHtml(evalQualityReport, paths.evalQualityHtmlPath), "utf8");
    const manifest = buildPublishBundleManifest(localized.report, paths, localized.benchmarkSummary !== undefined, localized.sourceFiles);
    writeJsonFile(paths.manifestPath, manifest);
    writeFileSync(paths.readmePath, formatPublishBundleReadme(manifest, localized.report, cwd), "utf8");
}
function localizePublishBundleSources(report, benchmarkClaim, benchmarkSummary, paths) {
    const sourceFiles = [];
    const localizedClaim = cloneJsonRecord(benchmarkClaim);
    const localizedSource = isRecord(localizedClaim.source) ? { ...localizedClaim.source } : {};
    const sourceRoot = "sources";
    localizedSource.resultsPath = path.join(sourceRoot, "results");
    localizedSource.benchmarkClaimPath = path.relative(paths.bundlePath, paths.benchmarkClaimPath);
    localizedSource.benchmarkSummaryPath = path.relative(paths.bundlePath, paths.benchmarkSummaryPath);
    localizedSource.htmlPath = path.relative(paths.bundlePath, paths.compareHtmlPath);
    localizeOptionalSourceFile(localizedSource, "suitePath", paths, path.join(sourceRoot, "suite", "suite.json"), "source-suite", "Suite manifest hashed by this claim.", sourceFiles);
    localizeOptionalSourceFile(localizedSource, "runPlanPath", paths, path.join(sourceRoot, "ruhroh-run-plan.json"), "source-run-plan", "Run plan hashed by this claim.", sourceFiles);
    localizeOptionalSourceFile(localizedSource, "rerunLedgerPath", paths, path.join(sourceRoot, "ruhroh-rerun-ledger.json"), "source-rerun-ledger", "Rerun/exclusion ledger hashed by this claim.", sourceFiles);
    localizeEvaluatorCalibrationReportSourceFile(localizedSource, paths, path.join(sourceRoot, EVALUATOR_CALIBRATION_REPORT_FILE), sourceFiles);
    localizeResultArtifacts(localizedSource, paths, sourceFiles);
    localizedClaim.source = localizedSource;
    const localizedSummary = benchmarkSummary === undefined ? undefined : cloneJsonRecord(benchmarkSummary);
    if (localizedSummary !== undefined) {
        localizedSummary.source = cloneJsonRecord(localizedSource);
    }
    const localizedReport = clonePublishCheckReport(report);
    localizedReport.source = {
        ...localizedReport.source,
        resultsPath: path.join(sourceRoot, "results"),
        benchmarkClaimPath: path.relative(paths.bundlePath, paths.benchmarkClaimPath),
        benchmarkSummaryPath: path.relative(paths.bundlePath, paths.benchmarkSummaryPath),
        htmlPath: path.relative(paths.bundlePath, paths.compareHtmlPath),
        bundlePath: ".",
        ...(localizedSource.runPlanPath === undefined ? {} : { runPlanPath: String(localizedSource.runPlanPath) }),
        ...(localizedSource.rerunLedgerPath === undefined ? {} : { rerunLedgerPath: String(localizedSource.rerunLedgerPath) }),
        ...(localizedSource.evaluatorCalibrationReportPath === undefined ? {} : { evaluatorCalibrationReportPath: String(localizedSource.evaluatorCalibrationReportPath) }),
    };
    localizedReport.compare = cloneJsonRecord(localizedReport.compare);
    localizedReport.compare.benchmarkClaim = localizedClaim;
    if (localizedSummary !== undefined) {
        localizedReport.compare.benchmarkSummary = localizedSummary;
    }
    localizedReport.sourceVerification = verifyRuhrohBenchmarkClaimSources(localizedClaim, paths.benchmarkClaimPath);
    return {
        report: localizedReport,
        benchmarkClaim: localizedClaim,
        benchmarkSummary: localizedSummary,
        sourceFiles,
    };
}
function localizeOptionalSourceFile(localizedSource, field, paths, relativeTargetPath, role, description, sourceFiles) {
    const originalPath = stringField(localizedSource, field);
    if (originalPath === undefined) {
        return;
    }
    copyPublishBundleSourceFile(originalPath, paths, relativeTargetPath, role, description, sourceFiles);
    localizedSource[field] = relativeTargetPath;
}
function localizeEvaluatorCalibrationReportSourceFile(localizedSource, paths, relativeTargetPath, sourceFiles) {
    const originalPath = stringField(localizedSource, "evaluatorCalibrationReportPath");
    if (originalPath === undefined) {
        return;
    }
    const targetPath = path.join(paths.bundlePath, relativeTargetPath);
    const targetDir = path.dirname(targetPath);
    mkdirSync(targetDir, { recursive: true });
    const report = cloneJsonRecord(readJsonObject(originalPath));
    const results = report.results;
    if (Array.isArray(results)) {
        report.results = results.map((item, index) => {
            if (!isRecord(item)) {
                return item;
            }
            const localizedItem = { ...item };
            const caseId = safeBundleRoleSegment(stringField(item, "caseId") ?? `case-${index + 1}`);
            const caseDir = path.join(path.dirname(relativeTargetPath), caseId);
            localizeCalibrationCaseFile(localizedItem, "inputPath", paths, caseDir, `evaluator-calibration-${caseId}-input`, sourceFiles);
            localizeCalibrationCaseFile(localizedItem, "outputPath", paths, caseDir, `evaluator-calibration-${caseId}-output`, sourceFiles);
            localizeCalibrationCaseWorkspace(localizedItem, paths, caseDir);
            return localizedItem;
        });
    }
    if (isRecord(report.source)) {
        report.source = { ...report.source, reportPath: relativeTargetPath };
    }
    writeJsonFile(targetPath, report);
    sourceFiles.push({
        role: "evaluator-calibration-report",
        path: relativeTargetPath,
        description: "Evaluator calibration report hashed by this claim.",
    });
    localizedSource.evaluatorCalibrationReportPath = relativeTargetPath;
    localizedSource.evaluatorCalibrationReportSha256 = sha256File(targetPath);
}
function localizeCalibrationCaseFile(item, field, paths, caseDir, role, sourceFiles) {
    const originalPath = stringField(item, field);
    if (originalPath === undefined || !existsSync(originalPath) || !statSync(originalPath).isFile()) {
        return;
    }
    const relativeTargetPath = path.join(caseDir, path.basename(originalPath));
    copyPublishBundleSourceFile(originalPath, paths, relativeTargetPath, role, `Evaluator calibration ${field === "inputPath" ? "input" : "output"} for ${stringField(item, "caseId") ?? "case"}.`, sourceFiles);
    item[field] = relativeTargetPath;
}
function localizeCalibrationCaseWorkspace(item, paths, caseDir) {
    const originalPath = stringField(item, "workspacePath");
    if (originalPath === undefined || !existsSync(originalPath) || !statSync(originalPath).isDirectory()) {
        return;
    }
    const relativeTargetPath = path.join(caseDir, "workspace");
    const targetPath = path.join(paths.bundlePath, relativeTargetPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    cpSync(originalPath, targetPath, { recursive: true });
    item.workspacePath = relativeTargetPath;
}
function localizeResultArtifacts(localizedSource, paths, sourceFiles) {
    const resultArtifacts = localizedSource.resultArtifacts;
    if (!Array.isArray(resultArtifacts)) {
        return;
    }
    localizedSource.resultArtifacts = resultArtifacts.map((artifact, artifactIndex) => {
        if (!isRecord(artifact)) {
            return artifact;
        }
        const localizedArtifact = { ...artifact };
        const runDir = path.join("sources", "results", `run-${artifactIndex + 1}`);
        const artifactPath = stringField(artifact, "path");
        if (artifactPath !== undefined) {
            const relativeTargetPath = path.join(runDir, path.basename(artifactPath));
            copyPublishBundleSourceFile(artifactPath, paths, relativeTargetPath, `source-result-${artifactIndex + 1}`, `Result artifact ${artifactIndex + 1} hashed by this claim.`, sourceFiles);
            localizedArtifact.path = relativeTargetPath;
        }
        const inventory = artifact.artifactInventory;
        if (Array.isArray(inventory)) {
            localizedArtifact.artifactInventory = inventory.map((item, inventoryIndex) => {
                if (!isRecord(item)) {
                    return item;
                }
                const localizedItem = { ...item };
                const inventoryPath = stringField(item, "path");
                if (inventoryPath !== undefined && item.available === true) {
                    const relativeTargetPath = path.join(runDir, path.basename(inventoryPath));
                    copyPublishBundleSourceFile(inventoryPath, paths, relativeTargetPath, `source-result-${artifactIndex + 1}-${safeBundleRoleSegment(stringField(item, "name") ?? `artifact-${inventoryIndex + 1}`)}-${inventoryIndex + 1}`, `Run artifact ${stringField(item, "name") ?? inventoryIndex + 1} for result ${artifactIndex + 1}.`, sourceFiles);
                    localizedItem.path = relativeTargetPath;
                }
                return localizedItem;
            });
        }
        return localizedArtifact;
    });
}
function copyPublishBundleSourceFile(originalPath, paths, relativeTargetPath, role, description, sourceFiles) {
    const targetPath = path.join(paths.bundlePath, relativeTargetPath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(originalPath, targetPath);
    if (!sourceFiles.some((file) => file.path === relativeTargetPath)) {
        sourceFiles.push({ role, path: relativeTargetPath, description });
    }
}
function safeBundleRoleSegment(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "artifact";
}
function clonePublishCheckReport(report) {
    return JSON.parse(JSON.stringify(report));
}
function cloneJsonRecord(record) {
    return JSON.parse(JSON.stringify(record));
}
function publishBundleArtifacts(inputPath, benchmarkClaim) {
    const artifacts = readRunResultArtifacts(inputPath);
    const source = isRecord(benchmarkClaim.source) ? benchmarkClaim.source : undefined;
    const resultPaths = source === undefined
        ? new Set()
        : new Set(recordArrayField(source, "resultArtifacts").flatMap((artifact) => {
            const artifactPath = stringField(artifact, "path");
            return artifactPath === undefined ? [] : [path.resolve(artifactPath)];
        }));
    if (resultPaths.size === 0) {
        return artifacts;
    }
    const scopedArtifacts = artifacts.filter((artifact) => resultPaths.has(path.resolve(artifact.path)));
    return scopedArtifacts.length === 0 ? artifacts : scopedArtifacts;
}
function buildPublishBundleManifest(report, paths, includesBenchmarkSummary, sourceFiles = []) {
    const files = [
        {
            role: "manifest",
            path: path.relative(paths.bundlePath, paths.manifestPath),
            description: "Versioned inventory for this publication bundle.",
        },
        {
            role: "publish-check",
            path: path.relative(paths.bundlePath, paths.publishCheckPath),
            description: "Publishability verdict, blockers, remediation, compare output, and optional source verification.",
        },
        {
            role: "compare-html",
            path: path.relative(paths.bundlePath, paths.compareHtmlPath),
            description: "Static aggregate report for human inspection.",
        },
        {
            role: "benchmark-claim",
            path: path.relative(paths.bundlePath, paths.benchmarkClaimPath),
            description: "Compact benchmark claim JSON for archival and downstream publication.",
        },
        {
            role: "review-json",
            path: path.relative(paths.bundlePath, paths.reviewJsonPath),
            description: "Human adjudication queue derived from the claim's result artifacts.",
        },
        {
            role: "review-html",
            path: path.relative(paths.bundlePath, paths.reviewHtmlPath),
            description: "Static human review queue for audit before citation.",
        },
        {
            role: "eval-quality",
            path: path.relative(paths.bundlePath, paths.evalQualityPath),
            description: "Evaluator evidence quality report for the claim's result artifacts.",
        },
        {
            role: "eval-quality-html",
            path: path.relative(paths.bundlePath, paths.evalQualityHtmlPath),
            description: "Static evaluator evidence quality packet for audit before citation.",
        },
        {
            role: "readme",
            path: path.relative(paths.bundlePath, paths.readmePath),
            description: "Human-readable bundle summary.",
        },
    ];
    if (includesBenchmarkSummary) {
        files.splice(4, 0, {
            role: "benchmark-summary",
            path: path.relative(paths.bundlePath, paths.benchmarkSummaryPath),
            description: "Row-oriented benchmark summary JSON for reports or leaderboard ingestion.",
        });
    }
    files.push(...sourceFiles);
    return {
        $schema: PUBLISH_BUNDLE_SCHEMA_URL,
        version: "ruhroh_publish_bundle_v1",
        createdAt: new Date().toISOString(),
        source: {
            resultsPath: report.source.resultsPath,
            bundlePath: report.source.bundlePath ?? paths.bundlePath,
            ...(report.source.suiteId === undefined ? {} : { suiteId: report.source.suiteId }),
            ...(report.source.runPlanPath === undefined ? {} : { runPlanPath: report.source.runPlanPath }),
            ...(report.source.rerunLedgerPath === undefined ? {} : { rerunLedgerPath: report.source.rerunLedgerPath }),
            ...(report.source.evaluatorCalibrationReportPath === undefined ? {} : { evaluatorCalibrationReportPath: report.source.evaluatorCalibrationReportPath }),
        },
        publishable: report.publishable,
        blockerCount: report.blockerCount,
        advisoryCount: report.advisoryCount,
        files,
    };
}
function writeJsonFile(filePath, value) {
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function formatPublishBundleReadme(manifest, report, cwd) {
    const lines = [
        "# Ruhroh Publication Bundle",
        "",
        `Status: ${manifest.publishable ? "publishable" : "blocked"}`,
        `Generated: ${manifest.createdAt}`,
        `Results: ${path.relative(cwd, manifest.source.resultsPath) || manifest.source.resultsPath}`,
    ];
    if (manifest.source.suiteId !== undefined) {
        lines.push(`Suite: ${manifest.source.suiteId}`);
    }
    if (manifest.source.runPlanPath !== undefined) {
        lines.push(`Run plan: ${path.relative(cwd, manifest.source.runPlanPath) || manifest.source.runPlanPath}`);
    }
    if (manifest.source.rerunLedgerPath !== undefined) {
        lines.push(`Rerun ledger: ${path.relative(cwd, manifest.source.rerunLedgerPath) || manifest.source.rerunLedgerPath}`);
    }
    if (manifest.source.evaluatorCalibrationReportPath !== undefined) {
        lines.push(`Evaluator calibration report: ${path.relative(cwd, manifest.source.evaluatorCalibrationReportPath) || manifest.source.evaluatorCalibrationReportPath}`);
    }
    lines.push("", "## Review Order", "", "- Open ruhroh-compare.html for the aggregate outcome, intervals, blockers, and evidence browser.", "- Open ruhroh-eval-quality.html to inspect evaluator evidence warnings before citing the claim.", "- Open ruhroh-review.html for the human adjudication queue and required review items.", "- Inspect sources/ for the hashed run plan, calibration report, result JSON, transcripts, eval outputs, and preserved artifact inventory.");
    lines.push("", "## Files", "");
    for (const file of manifest.files) {
        lines.push(`- ${file.path}: ${file.description}`);
    }
    if (report.blockers.length > 0) {
        lines.push("", "## Blockers", "");
        for (const blocker of report.blockers) {
            lines.push(`- ${blocker}`);
        }
    }
    if (report.remediation.length > 0) {
        lines.push("", "## Next Actions", "");
        for (const item of report.remediation) {
            lines.push(`- ${item.code}: ${item.action}`);
        }
    }
    if (report.advisories.length > 0) {
        lines.push("", "## Advisories", "");
        for (const advisory of report.advisories) {
            lines.push(`- ${advisory}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function publishCheckRemediationCatalog() {
    return ruhrohPublishCheckRemediationCatalog();
}
function formatPublishCheckReport(report, cwd) {
    const lines = [
        `publish check ${path.relative(cwd, report.source.resultsPath) || report.source.resultsPath}: ${report.publishable ? "publishable" : "blocked"}`,
    ];
    if (report.source.suiteId !== undefined) {
        lines.push(`  suite: ${report.source.suiteId}`);
    }
    if (report.source.runPlanPath !== undefined) {
        lines.push(`  run plan: ${path.relative(cwd, report.source.runPlanPath) || report.source.runPlanPath}`);
    }
    if (report.source.rerunLedgerPath !== undefined) {
        lines.push(`  rerun ledger: ${path.relative(cwd, report.source.rerunLedgerPath) || report.source.rerunLedgerPath}`);
    }
    if (report.source.evaluatorCalibrationReportPath !== undefined) {
        lines.push(`  evaluator calibration report: ${path.relative(cwd, report.source.evaluatorCalibrationReportPath) || report.source.evaluatorCalibrationReportPath}`);
    }
    if (report.source.benchmarkClaimPath !== undefined) {
        lines.push(`  benchmark claim: ${path.relative(cwd, report.source.benchmarkClaimPath) || report.source.benchmarkClaimPath}`);
    }
    if (report.source.benchmarkSummaryPath !== undefined) {
        lines.push(`  benchmark summary: ${path.relative(cwd, report.source.benchmarkSummaryPath) || report.source.benchmarkSummaryPath}`);
    }
    if (report.source.htmlPath !== undefined) {
        lines.push(`  html report: ${path.relative(cwd, report.source.htmlPath) || report.source.htmlPath}`);
    }
    if (report.source.summaryMarkdownPath !== undefined) {
        lines.push(`  markdown summary: ${path.relative(cwd, report.source.summaryMarkdownPath) || report.source.summaryMarkdownPath}`);
    }
    if (report.source.bundlePath !== undefined) {
        lines.push(`  bundle: ${path.relative(cwd, report.source.bundlePath) || report.source.bundlePath}`);
    }
    if (report.blockers.length > 0) {
        lines.push("  blockers:");
        for (const blocker of report.blockers) {
            lines.push(`    - ${blocker}`);
        }
    }
    if (report.remediation.length > 0) {
        lines.push("  next actions:");
        for (const item of report.remediation) {
            lines.push(`    - [${item.code}] ${item.action}`);
        }
    }
    if (report.advisories.length > 0) {
        lines.push("  advisories:");
        for (const advisory of report.advisories) {
            lines.push(`    - ${advisory}`);
        }
    }
    if (report.sourceVerification !== undefined) {
        lines.push(`  source verification: ${report.sourceVerification.errors.length === 0 ? "ok" : "failed"}`);
    }
    return `${lines.join("\n")}\n`;
}
function formatPublishCheckMarkdownSummary(report, cwd) {
    const status = report.publishable ? "publishable" : "blocked";
    const lines = [
        "# Ruhroh Publish Check",
        "",
        `**Status:** ${status}`,
        `**Results:** \`${formatMarkdownPath(report.source.resultsPath, cwd)}\``,
        `**Blockers:** ${report.blockerCount}`,
        `**Advisories:** ${report.advisoryCount}`,
    ];
    if (report.source.suiteId !== undefined) {
        lines.push(`**Suite:** \`${report.source.suiteId}\``);
    }
    const sourceRows = [
        ["Run plan", report.source.runPlanPath],
        ["Rerun ledger", report.source.rerunLedgerPath],
        ["Evaluator calibration report", report.source.evaluatorCalibrationReportPath],
        ["Benchmark claim", report.source.benchmarkClaimPath],
        ["Benchmark summary", report.source.benchmarkSummaryPath],
        ["HTML report", report.source.htmlPath],
        ["Publication bundle", report.source.bundlePath],
    ].filter((row) => row[1] !== undefined);
    if (sourceRows.length > 0) {
        lines.push("", "## Evidence Paths", "", "| Artifact | Path |", "| --- | --- |");
        for (const [label, itemPath] of sourceRows) {
            lines.push(`| ${escapeMarkdownTableCell(label)} | \`${escapeMarkdownInline(formatMarkdownPath(itemPath, cwd))}\` |`);
        }
    }
    if (report.blockers.length > 0) {
        lines.push("", "## Blockers", "");
        for (const blocker of report.blockers) {
            lines.push(`- ${blocker}`);
        }
    }
    if (report.remediation.length > 0) {
        lines.push("", "## Next Actions", "");
        for (const item of report.remediation) {
            lines.push(`- \`${item.code}\`: ${item.action}`);
        }
    }
    if (report.advisories.length > 0) {
        lines.push("", "## Advisories", "");
        for (const advisory of report.advisories) {
            lines.push(`- ${advisory}`);
        }
    }
    if (report.sourceVerification !== undefined) {
        lines.push("", "## Source Verification", "", report.sourceVerification.errors.length === 0
            ? "Source verification passed."
            : `Source verification failed with ${report.sourceVerification.errors.length} error(s).`);
    }
    return `${lines.join("\n")}\n`;
}
function formatMarkdownPath(itemPath, cwd) {
    return path.relative(cwd, itemPath) || itemPath;
}
function escapeMarkdownInline(value) {
    return value.replace(/`/gu, "\\`");
}
function escapeMarkdownTableCell(value) {
    return value.replace(/\|/gu, "\\|");
}
function publishCheckRemediationForBlocker(blocker) {
    return ruhrohPublishCheckRemediationForBlocker(blocker);
}
function runCompareCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: compare requires a directory containing Ruhroh result artifacts.\n");
        return 1;
    }
    try {
        const compareSuite = options.suiteId === undefined ? undefined : resolveCompareSuite(options);
        if (options.rerunLedgerPath !== undefined && options.runPlanPath === undefined) {
            throw new Error("--rerun-ledger requires --run-plan so exclusions can be checked against the planned sample matrix");
        }
        const compareRunPlan = options.runPlanPath === undefined ? undefined : loadRunPlanManifest(options.runPlanPath);
        const rerunLedger = options.rerunLedgerPath === undefined ? undefined : loadRuhrohRerunLedger(options.rerunLedgerPath);
        const discoveredArtifacts = readRunResultArtifacts(options.inputPath);
        const discoveredRuns = discoveredArtifacts.map((artifact) => artifact.run);
        if (compareSuite !== undefined) {
            compareSuite.warnings.push(...suiteCoverageWarnings(compareSuite.suite, discoveredRuns));
        }
        const runArtifacts = compareSuite === undefined
            ? discoveredArtifacts
            : discoveredArtifacts.filter((artifact) => compareSuite.suite.scenarioIds.includes(artifact.run.scenarioId));
        const runs = runArtifacts.map((artifact) => artifact.run);
        if (runs.length === 0) {
            if (compareSuite !== undefined) {
                throw new Error(`No ruhroh_loop_result_v1 JSON files for suite ${compareSuite.suite.id} found in ${options.inputPath}`);
            }
            throw new Error(`No ruhroh_loop_result_v1 JSON files found in ${options.inputPath}`);
        }
        const artifactValidation = validateRuhrohArtifactPaths(runArtifacts.map((artifact) => artifact.path), options.inputPath);
        const groups = aggregateRuhrohRuns(runs, compareSuite === undefined ? {} : {
            minRuns: compareSuite.suite.methodology.minRuns,
            expectedScenarioVersions: compareSuite.suite.scenarioVersions,
        });
        const pairwiseComparisons = summarizeRuhrohPairwiseAdapterComparisons(groups, {
            minRuns: compareSuite?.suite.methodology.minRuns,
        });
        const runSummaries = runs.map((run) => summarizeRuhrohRun(run));
        const reviewQueue = summarizeRuhrohReviewQueue(runSummaries);
        const suiteAdapterSummaries = compareSuite === undefined ? undefined : summarizeRuhrohSuiteAdapters(groups, {
            scenarioIds: compareSuite.suite.scenarioIds,
            minRuns: compareSuite.suite.methodology.minRuns,
        });
        const runPlanCoverage = compareRunPlan === undefined
            ? undefined
            : runPlanCoverageWarnings(compareRunPlan, runSummaries, compareSuite?.suite.scenarioIds, rerunLedger);
        const runPlanWarnings = compareRunPlan === undefined
            ? []
            : [
                ...(runPlanCoverage?.warnings ?? []),
                ...runPlanSuiteWarnings(compareRunPlan, compareSuite),
            ];
        const rerunLedgerSummary = rerunLedger === undefined ? undefined : summarizeRerunLedger(rerunLedger, options.rerunLedgerPath ?? "", compareRunPlan, runPlanCoverage?.acceptedExclusions ?? []);
        const claimReadiness = summarizeRuhrohBenchmarkClaimReadiness(groups, {
            ...(compareSuite === undefined ? {} : { suiteId: compareSuite.suite.id, suiteWarnings: compareSuite.warnings, suiteAdapterSummaries }),
            pairwiseComparisons,
            runPlanWarnings,
            artifactValidationErrors: artifactValidation.errors.length,
            artifactValidationWarnings: artifactValidation.warnings.length,
            reviewQueue,
        });
        const benchmarkClaim = summarizeRuhrohBenchmarkClaim(groups, {
            tool: readRuhrohPackageIdentity(),
            source: {
                resultsPath: options.inputPath,
                ...(compareSuite === undefined ? {} : {
                    suitePath: compareSuite.source.suitePath,
                    suiteSha256: sha256File(compareSuite.source.suitePath),
                }),
                ...(options.runPlanPath === undefined ? {} : {
                    runPlanPath: options.runPlanPath,
                    runPlanSha256: sha256File(options.runPlanPath),
                }),
                ...(options.rerunLedgerPath === undefined ? {} : {
                    rerunLedgerPath: options.rerunLedgerPath,
                    rerunLedgerSha256: sha256File(options.rerunLedgerPath),
                }),
                ...(options.htmlPath === undefined ? {} : { htmlPath: options.htmlPath }),
                ...(options.benchmarkClaimPath === undefined ? {} : { benchmarkClaimPath: options.benchmarkClaimPath }),
                ...(options.benchmarkSummaryPath === undefined ? {} : { benchmarkSummaryPath: options.benchmarkSummaryPath }),
                resultArtifacts: runArtifacts.map((artifact) => benchmarkClaimResultArtifact(artifact)),
            },
            ...(compareSuite === undefined ? {} : {
                suite: suiteToBenchmarkClaimSummary(compareSuite.suite),
                suiteAdapterSummaries,
            }),
            pairwiseComparisons,
            reviewQueue,
            claimReadiness,
            runPlanPresent: compareRunPlan !== undefined,
            runPlanWarnings,
            artifactValidationErrors: artifactValidation.errors.length,
            artifactValidationWarnings: artifactValidation.warnings.length,
        });
        const benchmarkSummary = summarizeRuhrohBenchmarkSummary(benchmarkClaim);
        if (options.htmlPath !== undefined) {
            mkdirSync(path.dirname(options.htmlPath), { recursive: true });
            writeFileSync(options.htmlPath, formatCompareReportHtml(groups, compareSuite, suiteAdapterSummaries, pairwiseComparisons, reviewQueue, claimReadiness, compareRunPlan, runPlanWarnings, benchmarkClaim.source?.resultArtifacts ?? [], options.htmlPath), "utf8");
        }
        if (options.benchmarkClaimPath !== undefined) {
            mkdirSync(path.dirname(options.benchmarkClaimPath), { recursive: true });
            writeFileSync(options.benchmarkClaimPath, `${JSON.stringify(benchmarkClaim, null, 2)}\n`, "utf8");
        }
        if (options.benchmarkSummaryPath !== undefined) {
            mkdirSync(path.dirname(options.benchmarkSummaryPath), { recursive: true });
            writeFileSync(options.benchmarkSummaryPath, `${JSON.stringify(benchmarkSummary, null, 2)}\n`, "utf8");
        }
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({
                version: "ruhroh_compare_v1",
                ...(compareSuite === undefined ? {} : { suite: compareSuite.suite, suiteWarnings: compareSuite.warnings, suiteAdapterSummaries }),
                ...(compareRunPlan === undefined ? {} : { runPlan: summarizeRunPlan(compareRunPlan), runPlanWarnings }),
                ...(rerunLedgerSummary === undefined ? {} : { rerunLedger: rerunLedgerSummary }),
                artifactValidation,
                claimReadiness,
                benchmarkClaim,
                benchmarkSummary,
                pairwiseComparisons,
                reviewQueue,
                groups,
                ...(options.htmlPath === undefined ? {} : { htmlPath: options.htmlPath }),
                ...(options.benchmarkClaimPath === undefined ? {} : { benchmarkClaimPath: options.benchmarkClaimPath }),
                ...(options.benchmarkSummaryPath === undefined ? {} : { benchmarkSummaryPath: options.benchmarkSummaryPath }),
            }, null, 2)}\n`);
        }
        else {
            const benchmarkClaimMessage = options.benchmarkClaimPath === undefined
                ? ""
                : `Wrote Ruhroh benchmark claim: ${options.benchmarkClaimPath}\n`;
            const benchmarkSummaryMessage = options.benchmarkSummaryPath === undefined
                ? ""
                : `Wrote Ruhroh benchmark summary: ${options.benchmarkSummaryPath}\n`;
            deps.stdout.write(options.htmlPath === undefined
                ? `${formatCompareReport(groups, compareSuite, suiteAdapterSummaries, pairwiseComparisons, reviewQueue, claimReadiness, compareRunPlan, runPlanWarnings)}${benchmarkClaimMessage}${benchmarkSummaryMessage}`
                : `Wrote Ruhroh compare HTML report: ${options.htmlPath}\n${benchmarkClaimMessage}${benchmarkSummaryMessage}`);
        }
        if (options.requirePublishable && !claimReadiness.publishable) {
            deps.stderr.write(`ruhroh compare failed publishability gate: ${claimReadiness.blockers.length} blocker${claimReadiness.blockers.length === 1 ? "" : "s"}\n`);
            return 2;
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function resolveCompareSuite(options) {
    const { suite, source } = loadSelectedSuite(options);
    const warnings = [];
    return { suite, source, warnings };
}
function suiteToBenchmarkClaimSummary(suite) {
    return {
        id: suite.id,
        title: suite.title,
        suiteVersion: suite.suiteVersion,
        scenarioIds: suite.scenarioIds,
        scenarioVersions: suite.scenarioVersions,
        minRuns: suite.methodology.minRuns,
        retryPolicy: suite.methodology.retryPolicy,
    };
}
function suiteCoverageWarnings(suite, runs) {
    const present = new Set(runs.map((run) => run.scenarioId));
    return suite.scenarioIds.flatMap((scenarioId) => present.has(scenarioId) ? [] : [`suite scenario has no result artifacts: ${scenarioId}`]);
}
function loadRunPlanManifest(filePath) {
    const raw = readJsonObject(filePath);
    if (raw.version !== "ruhroh_run_plan_v1") {
        throw new Error(`Expected ruhroh_run_plan_v1 in ${filePath}`);
    }
    if (!isRecord(raw.selection) || !isRecord(raw.generated) || !Array.isArray(raw.scenarios) || !Array.isArray(raw.samples)) {
        throw new Error(`Invalid Ruhroh run plan manifest: ${filePath}`);
    }
    for (const sample of raw.samples) {
        if (!isRecord(sample)
            || typeof sample.sampleId !== "string"
            || typeof sample.scenarioId !== "string"
            || typeof sample.adapter !== "string") {
            throw new Error(`Invalid Ruhroh run plan sample entry in ${filePath}`);
        }
    }
    return raw;
}
function runPlanCoverageWarnings(runPlan, summaries, scenarioFilter, rerunLedger) {
    const scenarioIds = scenarioFilter === undefined ? undefined : new Set(scenarioFilter);
    const expectedSamples = scenarioIds === undefined
        ? runPlan.samples
        : runPlan.samples.filter((sample) => scenarioIds.has(sample.scenarioId));
    const plannedSamplesById = new Map(expectedSamples.map((sample) => [sample.sampleId, sample]));
    const plannedSampleIds = new Set(plannedSamplesById.keys());
    const presentSampleIds = new Set(summaries.flatMap((summary) => summary.sample?.id === undefined ? [] : [summary.sample.id]));
    const ledgerEntriesBySampleId = new Map((rerunLedger?.entries ?? []).map((entry) => [entry.sampleId, entry]));
    const acceptedExclusions = [];
    const warnings = [];
    for (const sample of expectedSamples) {
        if (presentSampleIds.has(sample.sampleId)) {
            continue;
        }
        const ledgerEntry = ledgerEntriesBySampleId.get(sample.sampleId);
        if (ledgerEntry?.decision === "exclude" && ledgerEntry.reasonKind === "infrastructure") {
            acceptedExclusions.push(sample.sampleId);
            continue;
        }
        if (ledgerEntry !== undefined) {
            warnings.push(`run plan sample has no result artifact and rerun ledger does not provide an infrastructure exclusion: ${sample.sampleId} (${ledgerEntry.decision}/${ledgerEntry.reasonKind})`);
            continue;
        }
        warnings.push(`run plan sample has no result artifact: ${sample.sampleId} (${sample.scenarioId}/${sample.adapter})`);
    }
    for (const summary of summaries) {
        const label = `${summary.scenarioId}/${summary.adapter}${summary.runId === undefined ? "" : `/${summary.runId}`}`;
        if (summary.sample?.id === undefined) {
            warnings.push(`result has no sample id for run plan coverage: ${label}`);
            continue;
        }
        if (!plannedSampleIds.has(summary.sample.id)) {
            warnings.push(`result sample is not in run plan: ${summary.sample.id} (${label})`);
            continue;
        }
        const plannedSample = plannedSamplesById.get(summary.sample.id);
        if (plannedSample === undefined) {
            continue;
        }
        if (summary.scenarioId !== plannedSample.scenarioId) {
            warnings.push(`result sample scenario mismatch for ${summary.sample.id}: result=${summary.scenarioId} plan=${plannedSample.scenarioId}`);
        }
        if (summary.adapter !== plannedSample.adapter) {
            warnings.push(`result sample adapter mismatch for ${summary.sample.id}: result=${summary.adapter} plan=${plannedSample.adapter}`);
        }
        if (summary.sample.seed !== undefined && summary.sample.seed !== plannedSample.sampleSeed) {
            warnings.push(`result sample seed mismatch for ${summary.sample.id}: result=${summary.sample.seed} plan=${plannedSample.sampleSeed}`);
        }
        if (summary.sample.index !== undefined && summary.sample.index !== plannedSample.runIndex) {
            warnings.push(`result sample index mismatch for ${summary.sample.id}: result=${summary.sample.index} plan=${plannedSample.runIndex}`);
        }
        if (summary.sample.count !== undefined && summary.sample.count !== plannedSample.runCount) {
            warnings.push(`result sample count mismatch for ${summary.sample.id}: result=${summary.sample.count} plan=${plannedSample.runCount}`);
        }
    }
    for (const entry of rerunLedger?.entries ?? []) {
        if (!plannedSampleIds.has(entry.sampleId)) {
            warnings.push(`rerun ledger references sample not in compared run plan: ${entry.sampleId}`);
        }
    }
    return {
        warnings: uniquePreserveOrder(warnings),
        acceptedExclusions: uniquePreserveOrder(acceptedExclusions),
    };
}
function summarizeRerunLedger(ledger, ledgerPath, runPlan, acceptedExclusions) {
    const plannedSampleIds = runPlan === undefined
        ? new Set()
        : new Set(runPlan.samples.map((sample) => sample.sampleId));
    const warnings = runPlan === undefined
        ? ["rerun ledger supplied without --run-plan; entries were not checked against a planned sample matrix"]
        : ledger.entries.flatMap((entry) => plannedSampleIds.has(entry.sampleId) ? [] : [`rerun ledger references sample not in compared run plan: ${entry.sampleId}`]);
    return {
        version: ledger.version,
        ledgerPath,
        entryCount: ledger.entries.length,
        acceptedExclusionCount: acceptedExclusions.length,
        acceptedExclusions,
        warnings: uniquePreserveOrder(warnings),
    };
}
function runPlanSuiteWarnings(runPlan, compareSuite) {
    if (compareSuite === undefined) {
        return [];
    }
    const planSuite = runPlan.suite;
    if (!isRecord(planSuite)) {
        return [`run plan has no suite metadata to verify selected suite ${compareSuite.suite.id}`];
    }
    const planSuiteSource = planSuite.source;
    if (typeof planSuite.id !== "string"
        || typeof planSuite.suiteVersion !== "string"
        || !isRecord(planSuiteSource)
        || typeof planSuiteSource.suiteSha256 !== "string") {
        return [`run plan suite metadata is incomplete for selected suite ${compareSuite.suite.id}`];
    }
    const warnings = [];
    if (planSuite.id !== compareSuite.suite.id) {
        warnings.push(`run plan suite mismatch: plan=${planSuite.id} compare=${compareSuite.suite.id}`);
    }
    if (planSuite.suiteVersion !== compareSuite.suite.suiteVersion) {
        warnings.push(`run plan suiteVersion mismatch for ${compareSuite.suite.id}: plan=${planSuite.suiteVersion} compare=${compareSuite.suite.suiteVersion}`);
    }
    const compareSuiteSha256 = sha256File(compareSuite.source.suitePath);
    if (planSuiteSource.suiteSha256 !== compareSuiteSha256) {
        warnings.push(`run plan suite manifest hash mismatch for ${compareSuite.suite.id}: plan=${planSuiteSource.suiteSha256} compare=${compareSuiteSha256}`);
    }
    return warnings;
}
function uniquePreserveOrder(values) {
    const seen = new Set();
    return values.filter((value) => {
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}
function countStringValues(values) {
    const counts = {};
    for (const value of values) {
        counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
}
function summarizeRunPlan(runPlan) {
    return {
        version: runPlan.version,
        createdAt: runPlan.createdAt,
        selection: runPlan.selection,
        ...(runPlan.suite === undefined ? {} : { suite: runPlan.suite }),
        generated: runPlan.generated,
        scenarios: runPlan.scenarios,
        sampleCount: runPlan.samples.length,
        samples: runPlan.samples.map((sample) => ({
            label: sample.label,
            scenarioId: sample.scenarioId,
            adapter: sample.adapter,
            sampleId: sample.sampleId,
            sampleSeed: sample.sampleSeed,
            runIndex: sample.runIndex,
            runCount: sample.runCount,
        })),
    };
}
function initNextCommands(rootDir, cwd, adapterSelection) {
    const commandsPrefix = initCommandsPrefix(rootDir, cwd);
    const fixture = [
        ...commandsPrefix,
        "export RUHROH_RUN_AGENT_COMMAND=\"$PWD/ruhroh/adapters/fixture-newsletter/run.sh\"",
        "export RUHROH_EVAL_COMMAND=\"$PWD/ruhroh/evaluators/fixture-newsletter/run.sh\"",
        "pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell",
        "pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke",
        "pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run",
    ];
    const selectedAdapter = adapterSelection.template === "fixture"
        ? []
        : [
            ...commandsPrefix,
            `pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/${adapterSelection.id}/run.sh`,
            `pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter ./ruhroh/adapters/${adapterSelection.id}/run.sh --dry-run`,
        ];
    return { fixture, selectedAdapter };
}
function initCommandsPrefix(rootDir, cwd) {
    const resolvedRoot = path.resolve(rootDir);
    const resolvedCwd = path.resolve(cwd);
    if (resolvedRoot === resolvedCwd) {
        return [];
    }
    return [`cd ${formatWorkflowCommandPath(resolvedCwd, resolvedRoot)}`];
}
function resolveInitAdapterSelection(options) {
    if (options.adapter !== undefined) {
        const template = parseAdapterTemplate(options.adapter);
        return { id: initAdapterIdForTemplate(template), template };
    }
    if (options.templateExplicit) {
        return { id: initAdapterIdForTemplate(options.adapterTemplate), template: options.adapterTemplate };
    }
    return { id: "fixture-newsletter", template: "fixture" };
}
function initAdapterIdForTemplate(template) {
    if (template === "fixture") {
        return "fixture-newsletter";
    }
    if (template === "generic") {
        return "local-agent";
    }
    return template;
}
function scaffoldRuhrohProject(rootDir, adapterSelection = { id: "fixture-newsletter", template: "fixture" }) {
    const packageRoot = resolveRuhrohPackageRoot();
    const resolvedRoot = path.resolve(rootDir);
    const projectRoot = path.join(resolvedRoot, "ruhroh");
    const files = [];
    mkdirSync(projectRoot, { recursive: true });
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "README.md"),
        content: starterReadme(),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, ".gitignore"),
        content: ".generated/\nresults/\n*.log\n",
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "scenario-v2.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "scenario-v2.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "suite-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "suite-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "benchmark-claim-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "benchmark-claim-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "benchmark-summary-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "benchmark-summary-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "claim-index-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "claim-index-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "eval-calibration-report-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "eval-calibration-report-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "eval-result-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "eval-result-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "loop-result-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "loop-result-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "publish-bundle-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "publish-bundle-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "publish-check-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "publish-check-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "run-manifest-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "run-manifest-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "run-plan-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "run-plan-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "rerun-ledger-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "rerun-ledger-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "workspace-summary-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "workspace-summary-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "scenarios", "simple-newsletter", "scenario.json"),
        content: readFileSync(path.join(packageRoot, "scenarios", "simple-newsletter", "scenario.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "scenarios", "simple-newsletter", "instruction.md"),
        content: readFileSync(path.join(packageRoot, "scenarios", "simple-newsletter", "instruction.md"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "suites", "ruhroh-smoke", "suite.json"),
        content: readFileSync(path.join(packageRoot, "suites", "ruhroh-smoke", "suite.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "adapters", "fixture-newsletter", "run.sh"),
        content: readFileSync(path.join(packageRoot, "examples", "adapters", "fixture-newsletter", "run.sh"), "utf8"),
        mode: 0o755,
    }));
    if (adapterSelection.template !== "fixture") {
        files.push(...scaffoldRuhrohAdapter({
            adapterRoot: path.join(projectRoot, "adapters"),
            id: adapterSelection.id,
            template: adapterSelection.template,
        }));
    }
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "evaluators", "fixture-newsletter", "run.sh"),
        content: readFileSync(path.join(packageRoot, "examples", "evaluators", "fixture-newsletter", "run.sh"), "utf8"),
        mode: 0o755,
    }));
    return files;
}
function writeScaffoldFile(input) {
    if (existsSync(input.filePath)) {
        const existing = readFileSync(input.filePath, "utf8");
        if (existing !== input.content) {
            throw new Error(`refusing to overwrite existing file: ${input.filePath}`);
        }
        if (input.mode !== undefined) {
            chmodSync(input.filePath, input.mode);
        }
        return { path: input.filePath, status: "unchanged" };
    }
    mkdirSync(path.dirname(input.filePath), { recursive: true });
    writeFileSync(input.filePath, input.content, { encoding: "utf8", mode: input.mode });
    return { path: input.filePath, status: "created" };
}
function scaffoldRuhrohScenario(input) {
    const scenarioDir = path.join(input.scenarioRoot, input.id);
    const files = [];
    const today = new Date().toISOString().slice(0, 10);
    files.push(writeScaffoldFile({
        filePath: path.join(scenarioDir, "scenario.json"),
        content: `${JSON.stringify({
            version: "ruhroh_scenario_v2",
            id: input.id,
            title: titleFromScenarioId(input.id),
            tier: input.tier,
            kind: "real_user",
            metadata: {
                scenarioVersion: "0.1.0",
                provenance: "Original local scenario draft.",
                createdAt: today,
                updatedAt: today,
                difficulty: "standard",
                tags: ["draft"],
                expectedRuntimeSeconds: 900,
                contaminationNotes: "New local draft; review before publishing.",
                maintainers: ["local-author"],
                visibility: "private",
                changelog: ["0.1.0: Initial local draft."],
                lifecycle: { status: "active" },
            },
            userPromptPath: "instruction.md",
            assets: [],
            run: { mode: "build", timeoutSeconds: 900 },
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
                scenarioContext: [
                    "This scenario is a realistic coding-agent task authored from a user request.",
                    "The evaluator should judge the delivered workspace outcome, not only logs or implementation notes.",
                ],
                goalRubric: [
                    "The final workspace satisfies the core user goal described in instruction.md.",
                    "The delivered result is inspectable or runnable with the evidence available in the run artifacts.",
                    "The implementation respects the explicit constraints in the user request.",
                ],
                evidenceGuidance: [
                    "Inspect the final workspace and run the app, tests, or smoke checks when useful.",
                    "Use transcripts and command logs as supporting evidence, but base the judgment on the delivered state.",
                ],
                calibrationCases: [
                    {
                        id: "complete-delivery-pass",
                        inputSummary: "The final workspace implements the requested outcome, can be inspected or run locally, and cites concrete evidence for the core workflow.",
                        expectedStatus: "passed",
                        rationale: "Complete, evidence-backed delivered work should pass.",
                    },
                    {
                        id: "incomplete-prose-only-failure",
                        inputSummary: "The agent describes a possible implementation but does not modify the workspace into a usable result.",
                        expectedStatus: "failed",
                        rationale: "Ruhroh scenarios evaluate delivered outcomes, not prose-only plans.",
                    },
                    {
                        id: "ambiguous-evidence-review",
                        inputSummary: "The workspace appears partially implemented, but the available artifacts do not prove one core requirement was delivered.",
                        expectedStatus: "review",
                        rationale: "Ambiguous or incomplete evidence should be escalated for review instead of forced into pass or fail.",
                    },
                ],
            },
        }, null, 2)}\n`,
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(scenarioDir, "instruction.md"),
        content: `Describe the user task here.

Write this like a real request from a developer or product stakeholder. Focus
on the desired outcome, useful constraints, available inputs, and what a
finished result should make possible. Avoid prescribing exact file names or
implementation details unless the user truly cares about them.
`,
    }));
    return files;
}
function scaffoldRuhrohSuite(input) {
    const suiteDir = path.join(input.suiteRoot, input.id);
    const today = new Date().toISOString().slice(0, 10);
    const suite = {
        version: "ruhroh_suite_v1",
        id: input.id,
        title: titleFromScenarioId(input.id),
        suiteVersion: "0.1.0",
        description: "Local benchmark suite draft for repeated coding-agent evaluation.",
        scenarioIds: input.scenarioIds,
        scenarioVersions: input.scenarioVersions,
        methodology: {
            minRuns: input.minRuns,
            aggregationUnit: "scenario_adapter",
            reportPolicy: "pass_rate_ci_pass_at_k",
            confidenceLevel: 0.95,
            retryPolicy: "Do not retry failed agent runs inside a sample. Re-run the full sample only for documented infrastructure failures.",
        },
        governance: {
            owner: "local-author",
            createdAt: today,
            updatedAt: today,
            changelog: ["0.1.0: Initial local suite draft."],
            acceptanceCriteria: [
                "Each scenario represents a realistic user task with outcome-based evaluation.",
                "Each scenario validates cleanly before collecting repeated benchmark samples.",
                "Suite reports must include preserved artifacts, run-plan coverage, and claim-readiness review before publication.",
            ],
            contaminationReview: "Local draft; review scenario prompts, assets, and expected outcomes for public solution leakage before publishing.",
            rewardHackingReview: "Local draft; inspect prompts, assets, rubrics, and evaluator behavior for shortcuts that let agents pass without satisfying the user outcome.",
            reviewChecklist: [
                "Confirm each scenario requires observable user-value delivery rather than a filename or source-text shortcut.",
                "Confirm evaluator evidence guidance would catch superficial UI, hard-coded answers, and missing workflow behavior.",
                "Confirm preserved artifacts are sufficient for a reviewer to reproduce the pass/fail judgment.",
            ],
            deprecationPolicy: "Bump suiteVersion when changing membership, scenario locks, assets, prompts, or acceptance criteria.",
        },
    };
    return [writeScaffoldFile({
            filePath: path.join(suiteDir, "suite.json"),
            content: `${JSON.stringify(suite, null, 2)}\n`,
        })];
}
function scaffoldRuhrohAdapter(input) {
    const adapterDir = path.join(input.adapterRoot, input.id);
    return [
        writeScaffoldFile({
            filePath: path.join(adapterDir, "run.sh"),
            content: adapterRunScript(input.id, input.template),
            mode: 0o755,
        }),
        writeScaffoldFile({
            filePath: path.join(adapterDir, "README.md"),
            content: adapterReadme(input.id, input.template),
        }),
    ];
}
function scaffoldRuhrohEvaluator(input) {
    const evaluatorDir = path.join(input.evaluatorRoot, input.id);
    return [
        writeScaffoldFile({
            filePath: path.join(evaluatorDir, "run.sh"),
            content: evaluatorRunScript(input.id, input.template),
            mode: 0o755,
        }),
        writeScaffoldFile({
            filePath: path.join(evaluatorDir, "README.md"),
            content: evaluatorReadme(input.id, input.template),
        }),
    ];
}
function adapterRunScript(adapterId, template) {
    if (template !== "generic") {
        return readAdapterTemplateScript(template);
    }
    return `#!/usr/bin/env bash
set -euo pipefail

adapter_id="\${RUHROH_ADAPTER_ID:-${adapterId}}"
workspace="\${RUHROH_WORKSPACE_PATH:-\${RUHROH_WORKSPACE:-}}"
message="\${RUHROH_MESSAGE:-}"
iteration="\${RUHROH_ITERATION:-1}"
result_path="\${RUHROH_RESULT_PATH:-}"
adapter_version="\${RUHROH_RUN_AGENT_ADAPTER_VERSION:-0.1.0}"
provider="\${RUHROH_AGENT_PROVIDER:-local}"
model="\${RUHROH_AGENT_MODEL:-${adapterId}}"
prompt_version="\${RUHROH_AGENT_PROMPT_VERSION:-local-wrapper-v1}"

if [[ -z "$workspace" ]]; then
  echo "RUHROH_WORKSPACE or RUHROH_WORKSPACE_PATH is required" >&2
  exit 2
fi

mkdir -p "$workspace/.ruhroh"
prompt_path="$workspace/.ruhroh/${adapterId}-prompt-\${iteration}.md"
transcript_path="$workspace/.ruhroh/${adapterId}-transcript-\${iteration}.log"

cat > "$prompt_path" <<PROMPT
You are running inside a Ruhroh benchmark workspace.

Original/continuation task:

$message

Work only inside this workspace:

$workspace

Implement the requested outcome or continue the existing implementation. Preserve
useful files, commands, and notes in the workspace. When the user goal is
satisfied, exit 0; this wrapper will emit the Ruhroh completion signal.
PROMPT

cat > "$transcript_path" <<TRANSCRIPT
Adapter ${adapterId} has not been wired to a real agent command yet.
Edit ruhroh/adapters/${adapterId}/run.sh and replace this fail-fast block with
your CLI invocation.
TRANSCRIPT

if [[ -n "$result_path" ]]; then
  mkdir -p "$(dirname "$result_path")"
  cat > "$result_path" <<JSON
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "runtime_failure",
  "adapterVersion": "$adapter_version",
  "model": {
    "provider": "$provider",
    "model": "$model",
    "promptVersion": "$prompt_version"
  },
  "summary": "Adapter wrapper is scaffolded but not wired to a real agent command.",
  "artifacts": {
    "prompt": "$prompt_path",
    "transcript": "$transcript_path"
  }
}
JSON
fi

echo "Adapter ${adapterId} is scaffolded but not wired. Edit $0 before live benchmarking." >&2
exit 2
`;
}
function readAdapterTemplateScript(template) {
    const relativePathByTemplate = {
        "codex-cli": "examples/adapters/codex-cli/run.sh",
        "claude-code": "examples/adapters/claude-code/run.sh",
        "gemini-cli": "examples/adapters/gemini-cli/run.sh",
        aider: "examples/adapters/aider/run.sh",
        fixture: "examples/adapters/fixture-newsletter/run.sh",
    };
    const scriptPath = path.join(resolveRuhrohPackageRoot(), relativePathByTemplate[template]);
    return readFileSync(scriptPath, "utf8");
}
function evaluatorRunScript(evaluatorId, template) {
    if (template === "deterministic") {
        return deterministicEvaluatorRunScript(evaluatorId);
    }
    if (template === "model") {
        return modelEvaluatorRunScript(evaluatorId);
    }
    if (template === "hybrid") {
        return hybridEvaluatorRunScript(evaluatorId);
    }
    return `#!/usr/bin/env bash
set -euo pipefail

input_path="\${RUHROH_EVAL_INPUT_PATH:-}"
output_path="\${RUHROH_EVAL_OUTPUT_PATH:?RUHROH_EVAL_OUTPUT_PATH is required}"
workspace="\${RUHROH_EVAL_WORKSPACE_PATH:?RUHROH_EVAL_WORKSPACE_PATH is required}"

python3 - "$input_path" "$output_path" "$workspace" <<'PY'
import json
import os
import sys
from pathlib import Path

input_path = Path(sys.argv[1]) if sys.argv[1] else None
output_path = Path(sys.argv[2])
workspace = Path(sys.argv[3])
evaluator_id = "${evaluatorId}"

eval_input = {}
if input_path is not None and input_path.exists():
    try:
        eval_input = json.loads(input_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        eval_input = {}

sample_files = []
if workspace.exists():
    for path in sorted(workspace.rglob("*")):
        if path.is_file():
            try:
                sample_files.append(str(path.relative_to(workspace)))
            except ValueError:
                sample_files.append(str(path))
        if len(sample_files) >= 20:
            break

reason = (
    "Evaluator scaffold requires scenario-specific checks before it can issue "
    "a pass/fail judgment."
)
evidence_summary = (
    f"workspace_exists={workspace.exists()} sample_file_count={len(sample_files)}"
)

result = {
    "$schema": "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
    "version": "ruhroh_eval_result_v1",
    "status": "review",
    "goalMet": False,
    "confidence": "medium",
    "reasons": [reason],
    "unmetCriteria": [
        "Replace the scaffold with checks that verify this scenario's delivered user outcome."
    ],
    "evidenceRefs": [
        {
            "kind": "directory",
            "ref": str(workspace),
            "summary": evidence_summary,
        }
    ],
    "commandsRun": [],
    "artifacts": {
        "workspacePath": str(workspace),
        **({"evalInputPath": str(input_path)} if input_path is not None else {}),
    },
    "finalSummary": (
        "This scaffold intentionally returns review so a fresh evaluator cannot "
        "create a false benchmark pass. Add deterministic, model-backed, or "
        "hybrid checks that inspect the final workspace and cite concrete evidence."
    ),
    "criteriaResults": [
        {
            "id": "scenario-specific-outcome",
            "description": "Scenario-specific delivered outcome checks have been implemented.",
            "status": "review",
            "score": 0,
            "evidenceRefs": [
                {
                    "kind": "directory",
                    "ref": str(workspace),
                    "summary": evidence_summary,
                }
            ],
            "notes": "Edit this evaluator before collecting publishable benchmark runs.",
        }
    ],
    "subscores": {
        "functionality": 0,
        "workflow": 0,
        "buildRun": 0,
        "persistence": 0,
        "constraintCompliance": 0,
        "evidenceQuality": 1,
    },
    "judge": {
        "kind": "command",
        "model": evaluator_id,
        "version": "0.1.0",
    },
}

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
PY
`;
}
function deterministicEvaluatorRunScript(evaluatorId) {
    return `#!/usr/bin/env bash
set -euo pipefail

input_path="\${RUHROH_EVAL_INPUT_PATH:-}"
output_path="\${RUHROH_EVAL_OUTPUT_PATH:?RUHROH_EVAL_OUTPUT_PATH is required}"
workspace="\${RUHROH_EVAL_WORKSPACE_PATH:?RUHROH_EVAL_WORKSPACE_PATH is required}"

python3 - "$input_path" "$output_path" "$workspace" <<'PY'
import json
import sys
from pathlib import Path

input_path = Path(sys.argv[1]) if sys.argv[1] else None
output_path = Path(sys.argv[2])
workspace = Path(sys.argv[3])
evaluator_id = "${evaluatorId}"

# Edit these for the scenario. The scaffold returns review until at least one
# deterministic check is configured.
required_files = []
required_text = {}

missing_files = [item for item in required_files if not (workspace / item).exists()]
missing_text = []
for relative_path, expected in required_text.items():
    path = workspace / relative_path
    if not path.exists() or expected not in path.read_text(encoding="utf-8", errors="replace"):
        missing_text.append(f"{relative_path} missing text {expected!r}")

checks_configured = bool(required_files or required_text)
passed = checks_configured and not missing_files and not missing_text
status = "passed" if passed else ("failed" if checks_configured else "review")
reasons = []
if passed:
    reasons.append("Configured deterministic checks passed.")
elif checks_configured:
    reasons.append("Configured deterministic checks failed.")
else:
    reasons.append("Deterministic evaluator template needs scenario-specific required_files or required_text checks.")

unmet = [f"missing file: {item}" for item in missing_files] + missing_text
if not checks_configured:
    unmet.append("Configure deterministic checks before collecting publishable runs.")

evidence = [{
    "kind": "directory",
    "ref": str(workspace),
    "summary": f"checks_configured={checks_configured} missing_files={len(missing_files)} missing_text={len(missing_text)}",
}]
result = {
    "$schema": "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
    "version": "ruhroh_eval_result_v1",
    "status": status,
    "goalMet": passed,
    "confidence": "high" if checks_configured else "medium",
    "reasons": reasons,
    "unmetCriteria": unmet,
    "evidenceRefs": evidence,
    "commandsRun": [],
    "artifacts": {
        "workspacePath": str(workspace),
        **({"evalInputPath": str(input_path)} if input_path is not None else {}),
    },
    "finalSummary": "Deterministic evaluator template result. Edit required_files and required_text for this scenario.",
    "criteriaResults": [{
        "id": "deterministic-workspace-checks",
        "description": "Scenario-specific deterministic workspace checks passed.",
        "status": status,
        "score": 1 if passed else 0,
        "evidenceRefs": evidence,
        "notes": "; ".join(unmet) if unmet else "All configured deterministic checks passed.",
    }],
    "subscores": {
        "functionality": 1 if passed else 0,
        "workflow": 1 if passed else 0,
        "buildRun": 1 if checks_configured else 0,
        "persistence": 0,
        "constraintCompliance": 1 if passed else 0,
        "evidenceQuality": 1,
    },
    "judge": {"kind": "command", "model": evaluator_id, "version": "0.1.0"},
}

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
PY
`;
}
function modelEvaluatorRunScript(evaluatorId) {
    return `#!/usr/bin/env bash
set -euo pipefail

input_path="\${RUHROH_EVAL_INPUT_PATH:?RUHROH_EVAL_INPUT_PATH is required}"
output_path="\${RUHROH_EVAL_OUTPUT_PATH:?RUHROH_EVAL_OUTPUT_PATH is required}"
workspace="\${RUHROH_EVAL_WORKSPACE_PATH:?RUHROH_EVAL_WORKSPACE_PATH is required}"
judge_command="\${RUHROH_EVAL_MODEL_COMMAND:-}"
judge_model="\${RUHROH_EVAL_MODEL:-${evaluatorId}}"
judge_version="\${RUHROH_EVAL_MODEL_VERSION:-0.1.0}"

python3 - "$input_path" "$output_path" "$workspace" "$judge_command" "$judge_model" "$judge_version" <<'PY'
import json
import shlex
import subprocess
import sys
from pathlib import Path

input_path = Path(sys.argv[1])
output_path = Path(sys.argv[2])
workspace = Path(sys.argv[3])
judge_command = sys.argv[4]
judge_model = sys.argv[5]
judge_version = sys.argv[6]

eval_input = json.loads(input_path.read_text(encoding="utf-8"))
prompt = {
    "instruction": "Judge whether the final workspace satisfies the Ruhroh scenario. Return JSON with status passed, failed, or review plus reasons.",
    "scenarioId": eval_input.get("scenarioId"),
    "goalRubric": eval_input.get("goalRubric", []),
    "evidenceGuidance": eval_input.get("evidenceGuidance", []),
    "workspacePath": str(workspace),
}

judge_stdout = ""
judge_error = ""
judge_payload = {}
if judge_command:
    completed = subprocess.run(
        shlex.split(judge_command),
        input=json.dumps(prompt),
        text=True,
        capture_output=True,
        timeout=120,
    )
    judge_stdout = completed.stdout.strip()
    judge_error = completed.stderr.strip()
    try:
        judge_payload = json.loads(judge_stdout)
    except json.JSONDecodeError:
        judge_payload = {}

raw_status = judge_payload.get("status")
status = raw_status if raw_status in {"passed", "failed", "review"} else "review"
goal_met = status == "passed"
reasons = judge_payload.get("reasons") if isinstance(judge_payload.get("reasons"), list) else []
if not reasons:
    reasons = ["Model evaluator template needs RUHROH_EVAL_MODEL_COMMAND to return structured judgment JSON."]

evidence = [{
    "kind": "model_judge",
    "ref": judge_model,
    "summary": "model judge command configured" if judge_command else "model judge command not configured",
}]
commands = []
if judge_command:
    commands.append({
        "command": "RUHROH_EVAL_MODEL_COMMAND",
        "exitCode": 0 if judge_payload else 1,
        "summary": judge_stdout[:500] or judge_error[:500] or "model judge produced no structured output",
    })

result = {
    "$schema": "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
    "version": "ruhroh_eval_result_v1",
    "status": status,
    "goalMet": goal_met,
    "confidence": judge_payload.get("confidence", "medium"),
    "reasons": reasons,
    "unmetCriteria": judge_payload.get("unmetCriteria", []),
    "evidenceRefs": evidence,
    "commandsRun": commands,
    "artifacts": {"workspacePath": str(workspace), "evalInputPath": str(input_path)},
    "finalSummary": judge_payload.get("finalSummary", "Model evaluator template returned review until a structured model judgment is wired."),
    "criteriaResults": judge_payload.get("criteriaResults", [{
        "id": "model-judgment",
        "description": "Model judge returned a structured scenario outcome judgment.",
        "status": status,
        "score": 1 if goal_met else 0,
        "evidenceRefs": evidence,
    }]),
    "subscores": judge_payload.get("subscores", {"functionality": 1 if goal_met else 0, "workflow": 1 if goal_met else 0, "evidenceQuality": 1 if judge_payload else 0}),
    "judge": {"kind": "model", "model": judge_model, "version": judge_version},
}

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
PY
`;
}
function hybridEvaluatorRunScript(evaluatorId) {
    return `#!/usr/bin/env bash
set -euo pipefail

input_path="\${RUHROH_EVAL_INPUT_PATH:-}"
output_path="\${RUHROH_EVAL_OUTPUT_PATH:?RUHROH_EVAL_OUTPUT_PATH is required}"
workspace="\${RUHROH_EVAL_WORKSPACE_PATH:?RUHROH_EVAL_WORKSPACE_PATH is required}"
judge_model="\${RUHROH_EVAL_MODEL:-${evaluatorId}}"

python3 - "$input_path" "$output_path" "$workspace" "$judge_model" <<'PY'
import json
import sys
from pathlib import Path

input_path = Path(sys.argv[1]) if sys.argv[1] else None
output_path = Path(sys.argv[2])
workspace = Path(sys.argv[3])
judge_model = sys.argv[4]
evaluator_id = "${evaluatorId}"

# Edit these checks, then optionally add a model judge command. The scaffold
# returns review until deterministic checks are configured.
required_files = []
deterministic_missing = [item for item in required_files if not (workspace / item).exists()]
deterministic_configured = bool(required_files)
deterministic_passed = deterministic_configured and not deterministic_missing

status = "review"
reasons = ["Hybrid evaluator template needs deterministic checks and optional model adjudication before publication."]
unmet = []
if deterministic_configured and not deterministic_passed:
    status = "failed"
    reasons = ["Deterministic gate failed before model adjudication."]
    unmet = [f"missing file: {item}" for item in deterministic_missing]
elif deterministic_passed:
    status = "review"
    reasons = ["Deterministic gate passed; add model or human adjudication before marking passed."]
else:
    unmet = ["Configure deterministic required_files and add model or human adjudication."]

evidence = [{
    "kind": "directory",
    "ref": str(workspace),
    "summary": f"deterministic_configured={deterministic_configured} deterministic_passed={deterministic_passed}",
}]
judge_votes = [
    {
        "judge": {"kind": "command", "model": evaluator_id, "version": "0.1.0"},
        "status": "passed" if deterministic_passed else "review",
        "confidence": "high" if deterministic_configured else "medium",
        "rationale": "Deterministic gate result from configured workspace checks.",
        "evidenceRefs": evidence,
    },
    {
        "judge": {"kind": "model", "model": judge_model, "version": "0.1.0"},
        "status": "review",
        "confidence": "medium",
        "rationale": "Model adjudication placeholder; wire a real judge before publication.",
        "evidenceRefs": evidence,
    },
]

result = {
    "$schema": "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json",
    "version": "ruhroh_eval_result_v1",
    "status": status,
    "goalMet": False,
    "confidence": "medium",
    "reasons": reasons,
    "unmetCriteria": unmet,
    "evidenceRefs": evidence,
    "commandsRun": [],
    "artifacts": {
        "workspacePath": str(workspace),
        **({"evalInputPath": str(input_path)} if input_path is not None else {}),
    },
    "finalSummary": "Hybrid evaluator template combines deterministic gates with model or human adjudication; edit before publishable runs.",
    "criteriaResults": [{
        "id": "hybrid-outcome-review",
        "description": "Deterministic and adjudicated checks support the final scenario judgment.",
        "status": status,
        "score": 0,
        "evidenceRefs": evidence,
    }],
    "subscores": {"functionality": 0, "workflow": 0, "buildRun": 1 if deterministic_configured else 0, "evidenceQuality": 1},
    "judge": {"kind": "hybrid", "model": evaluator_id, "version": "0.1.0"},
    "judgeVotes": judge_votes,
}

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
PY
`;
}
function adapterReadme(adapterId, template) {
    const templateGuidance = adapterTemplateGuidance(template);
    return `# ${titleFromScenarioId(adapterId)} Adapter

This directory contains a local Ruhroh custom-shell adapter scaffold.

Template: \`${template}\`

- \`run.sh\` receives the Ruhroh command-adapter environment.
- The wrapper writes each prompt and transcript under \`$RUHROH_WORKSPACE/.ruhroh/\`.
- The wrapper writes \`ruhroh_run_agent_result_v1\` metadata to \`$RUHROH_RESULT_PATH\`.
- The generic template fails fast until you replace the placeholder block with
  a real agent invocation. Live CLI templates start from maintained example
  wrappers and still need the matching CLI credentials/configuration.

${templateGuidance}

Typical check:

\`\`\`bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/${adapterId}/run.sh
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/${adapterId}/run.sh --json
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario <scenario-id> --adapter ./ruhroh/adapters/${adapterId}/run.sh --dry-run
\`\`\`

## Comparison Readiness

Before collecting repeated live-agent samples, make the \`adapter-metadata\`
check in \`ruhroh doctor --json\` report \`ok\`. The wrapper should write
\`RUHROH_RESULT_PATH\` with \`ruhroh_run_agent_result_v1\` metadata that includes:

- \`adapterVersion\` for wrapper or prompt-harness changes;
- \`model.provider\`, \`model.model\`, and, when available, \`model.version\`;
- \`model.promptVersion\` when system prompts or wrapper instructions can change;
- \`artifacts.transcript\` and any prompt, event, tool-call, or last-message
  artifacts needed to audit the implementation journey;
- optional \`usage.costUsd\`, \`usage.inputTokens\`, \`usage.outputTokens\`, or
  \`usage.totalTokens\` when the agent exposes cost or token data.

Minimal publishable-shape result file:

\`\`\`json
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "adapterVersion": "0.1.0",
  "model": {
    "provider": "local",
    "model": "${adapterId}",
    "version": "2026-07-08",
    "promptVersion": "local-wrapper-v1"
  },
  "artifacts": {
    "prompt": "$RUHROH_WORKSPACE/.ruhroh/${adapterId}-prompt.md",
    "transcript": "$RUHROH_WORKSPACE/.ruhroh/${adapterId}-transcript.log"
  }
}
\`\`\`

Ruhroh copies these fields into \`ruhroh-run-manifest.json\` for cohort
comparison, claim readiness, and artifact-backed review. Without them,
comparison reports can still run, but adapter/model comparability warnings make
published claims harder to defend.
`;
}
function adapterTemplateGuidance(template) {
    if (template === "codex-cli") {
        return `Codex CLI setup:

- Install and authenticate Codex CLI so \`codex\` is on \`PATH\`, or set \`CODEX_CLI_BIN\`.
- Optional controls: \`CODEX_MODEL\`, \`CODEX_PROFILE\`, \`CODEX_SANDBOX\`,
  \`CODEX_APPROVAL_POLICY\`, and \`CODEX_CLI_EXTRA_ARGS\`.
- The wrapper records prompt, transcript, and last-message artifacts for audit.`;
    }
    if (template === "claude-code") {
        return `Claude Code setup:

- Install and authenticate Claude Code so \`claude\` is on \`PATH\`, or set
  \`CLAUDE_CODE_BIN\`.
- Optional controls: \`CLAUDE_MODEL\`, \`CLAUDE_PERMISSION_MODE\`,
  \`CLAUDE_OUTPUT_FORMAT\`, and \`CLAUDE_CODE_EXTRA_ARGS\`.
- The wrapper records prompt and transcript artifacts for audit.`;
    }
    if (template === "gemini-cli") {
        return `Gemini CLI setup:

- Install and authenticate the Gemini CLI so \`gemini\` is on \`PATH\`, or set
  \`GEMINI_CLI_BIN\`.
- Optional controls: \`GEMINI_MODEL\` and \`GEMINI_CLI_EXTRA_ARGS\`.
- The wrapper records prompt and transcript artifacts for audit.`;
    }
    if (template === "aider") {
        return `Aider setup:

- Install and authenticate Aider so \`aider\` is on \`PATH\`, or set
  \`AIDER_BIN\`.
- Optional controls: \`AIDER_MODEL\`, \`AIDER_EXTRA_ARGS\`, and
  \`AIDER_ADAPTER_VERSION\`.
- The wrapper records prompt and transcript artifacts for audit.`;
    }
    if (template === "fixture") {
        return `Fixture setup:

- This deterministic adapter writes a small newsletter page without model
  credentials.
- Use it for local plumbing checks, not agent-quality claims.
- Pair it with the fixture evaluator created by \`ruhroh init\`.`;
    }
    return `Generic setup:

- Replace the fail-fast block in \`run.sh\` with your agent invocation.
- Keep prompt/transcript artifacts and \`ruhroh_run_agent_result_v1\` output.
- Do not mark the adapter passing until the agent has actually delivered the
  requested workspace outcome.`;
}
function evaluatorReadme(evaluatorId, template) {
    const templateGuidance = evaluatorTemplateGuidance(template);
    return `# ${titleFromScenarioId(evaluatorId)} Evaluator

This directory contains a local Ruhroh command-backed evaluator scaffold.

Template: \`${template}\`

- \`run.sh\` receives the Ruhroh eval-agent environment.
- The evaluator inspects \`$RUHROH_EVAL_WORKSPACE_PATH\`, a copied final
  workspace from the implementation run.
- The evaluator must write \`ruhroh_eval_result_v1\` JSON to
  \`$RUHROH_EVAL_OUTPUT_PATH\`.
- Fresh scaffolds avoid false passes until you replace the template logic with
  scenario-specific outcome checks.

${templateGuidance}

Typical check:

\`\`\`bash
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/${evaluatorId}/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --json
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>
\`\`\`

Before publishing comparisons, make sure the evaluator:

- inspects delivered behavior in the final workspace, not only filenames or
  source text;
- records concrete \`evidenceRefs\` and \`criteriaResults\`;
- records \`commandsRun\` when it executes tests, smoke checks, or app probes;
- returns \`review\` instead of \`passed\` when evidence is ambiguous;
- reports stable \`judge.kind\`, \`judge.model\`, and \`judge.version\` values.

Ruhroh copies evaluator metadata into artifacts and treats weak evidence as a
claim-readiness blocker.
`;
}
function evaluatorTemplateGuidance(template) {
    if (template === "deterministic") {
        return `This deterministic template is for file, command, text, or local app checks.
Edit \`required_files\` and \`required_text\` in \`run.sh\`, then add any command or
browser probes needed to verify delivered behavior. It returns \`review\` until at
least one check is configured.`;
    }
    if (template === "model") {
        return `This model template is for an external judge command. Set
\`RUHROH_EVAL_MODEL_COMMAND\`, \`RUHROH_EVAL_MODEL\`, and
\`RUHROH_EVAL_MODEL_VERSION\`. The judge command receives JSON on stdin and should
return structured JSON with \`status\`, \`reasons\`, and optional
\`criteriaResults\`.`;
    }
    if (template === "hybrid") {
        return `This hybrid template combines deterministic gates with model or human
adjudication. Configure deterministic checks first, then replace the placeholder
model vote before using the evaluator for publishable benchmark runs.`;
    }
    return `This review template inventories the workspace and returns
\`status: "review"\` until you replace the placeholder logic with
scenario-specific outcome checks.`;
}
function titleFromScenarioId(id) {
    return id
        .split(/[-_.]+/u)
        .filter((part) => part.length > 0)
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join(" ") || id;
}
function duplicateStrings(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) {
            duplicates.add(value);
        }
        seen.add(value);
    }
    return [...duplicates].sort();
}
function starterReadme() {
    return `# Ruhroh Starter

This directory is a local Ruhroh benchmark starter. It includes a v2
\`simple-newsletter\` scenario, the matching \`ruhroh-smoke\` suite, plus a
credential-free fixture adapter and fixture evaluator so you can verify the full
Ruhroh loop before wiring a live agent.

The \`schemas/\` directory contains JSON Schemas for scenario manifests, suite
manifests, run manifests, exported benchmark claims, evaluator calibration
reports, publication bundles, publish checks, and workspace summary artifacts.
Use them from your editor, CI, or publication pipeline as structural checks;
\`ruhroh validate\`,
\`inspect-pack\`, \`eval-quality\`, and \`publish-check\` remain the
authoritative benchmark-governance gates.

## First Local Loop

\`\`\`bash
pnpm exec ruhroh first-run
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow --html ruhroh-workflow.html
\`\`\`

\`first-run\` is read-only. Before the scaffold is ready it prints only the
missing setup command; after the exports it prints the exact doctor, validate,
dry-run, and full-run commands for this fixture. The dry-run command previews the
Harbor invocation without writing task directories, a run plan, or artifacts.

When Harbor is installed, run the full fixture command to preserve a real
\`ruhroh-loop-result.json\`, then rerun the workflow guide:

\`\`\`bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell
pnpm exec ruhroh workflow --html ruhroh-workflow.html
\`\`\`

## Next Benchmark Work

- Write or edit scenarios under \`ruhroh/scenarios/\`.
- Freeze versioned scenario membership under \`ruhroh/suites/\`.
- Replace the fixture evaluator with \`ruhroh new-evaluator <id>\`, then run
  \`ruhroh calibrate-evaluator\` against scenario calibration anchors.
- Replace the fixture adapter with \`ruhroh new-adapter <id>\` or a maintained
  template such as \`--template codex-cli\`, then run \`ruhroh doctor\`.
- Use \`ruhroh plan\`, repeated \`ruhroh run\`, \`ruhroh compare\`, and
  \`ruhroh publish-check --bundle\` before citing a benchmark score.
`;
}
function runDoctorCommand(options, deps) {
    const checks = [];
    const packageRoot = resolveRuhrohPackageRoot();
    const pythonPath = resolveRuhrohPythonPath();
    checks.push(existsSync(path.join(packageRoot, "package.json"))
        ? { name: "package", status: "ok", details: `package root: ${packageRoot}` }
        : { name: "package", status: "failed", details: `package.json not found under ${packageRoot}` });
    checks.push(packageAssetsDoctorCheck(packageRoot));
    checks.push(existsSync(pythonPath)
        ? { name: "python-path", status: "ok", details: `python runtime: ${pythonPath}` }
        : { name: "python-path", status: "failed", details: `python runtime not found: ${pythonPath}` });
    const scenarioSources = discoverRuhrohScenarios(options.scenarioDir);
    let validationResults = [];
    if (scenarioSources.length === 0) {
        checks.push({ name: "scenarios", status: "failed", details: `no scenarios found in ${options.scenarioDir}` });
    }
    else {
        validationResults = scenarioSources.map((source) => validateRuhrohScenarioSource(source));
        const errorCount = validationResults.reduce((total, result) => total + result.errors.length, 0);
        const warningCount = validationResults.reduce((total, result) => total + result.warnings.length, 0);
        checks.push(errorCount === 0
            ? {
                name: "scenarios",
                status: warningCount === 0 ? "ok" : "warning",
                details: `${scenarioSources.length} scenario(s) valid${warningCount === 0 ? "" : ` with ${warningCount} warning(s)`}`,
            }
            : { name: "scenarios", status: "failed", details: `${errorCount} validation error(s) across ${scenarioSources.length} scenario(s)` });
    }
    checks.push(suiteDoctorCheck(options, validationResults));
    checks.push(runSpawnCheck({
        name: "python-import",
        spawn: deps.spawn,
        command: "python3",
        args: ["-c", "from ruhroh.harbor_agent import RuhrohHarborAgent; print(RuhrohHarborAgent.name())"],
        cwd: deps.cwd,
        env: buildHarborSpawnEnv(deps.env),
        okDetails: "imported ruhroh.harbor_agent",
    }));
    const harborCheck = runSpawnCheck({
        name: "harbor",
        spawn: deps.spawn,
        command: options.harborBin,
        args: ["--version"],
        cwd: deps.cwd,
        env: deps.env,
        okDetails: `${options.harborBin} is executable`,
    });
    checks.push(harborCheck.status === "failed"
        ? runSpawnCheck({
            name: "harbor",
            spawn: deps.spawn,
            command: options.harborBin,
            args: ["--help"],
            cwd: deps.cwd,
            env: deps.env,
            okDetails: `${options.harborBin} is executable`,
        })
        : harborCheck);
    checks.push(adapterDoctorCheck(options, deps.cwd, deps.env));
    checks.push(adapterMetadataDoctorCheck(options, deps.cwd, deps.env));
    checks.push(evalDoctorCheck(deps.cwd, deps.env));
    checks.push(commandSafetyDoctorCheck(options, deps.cwd, deps.env));
    if (options.json) {
        deps.stdout.write(`${JSON.stringify({ version: "ruhroh_doctor_v1", checks }, null, 2)}\n`);
    }
    else {
        deps.stdout.write(formatDoctorReport(checks));
    }
    return checks.some((check) => check.status === "failed") ? 1 : 0;
}
function packageAssetsDoctorCheck(packageRoot) {
    const requiredPaths = [
        "dist/cli.js",
        "dist/index.js",
        "dist/publication.js",
        "dist/publication.d.ts",
        "python/ruhroh/harbor_agent.py",
        "python/ruhroh/loop_controller.py",
        "scenarios/simple-newsletter/scenario.json",
        "suites/ruhroh-smoke/suite.json",
        "schemas/scenario-v2.schema.json",
        "schemas/suite-v1.schema.json",
        "schemas/benchmark-claim-v1.schema.json",
        "schemas/benchmark-summary-v1.schema.json",
        "schemas/claim-index-v1.schema.json",
        "schemas/eval-calibration-report-v1.schema.json",
        "schemas/eval-result-v1.schema.json",
        "schemas/loop-result-v1.schema.json",
        "schemas/publish-bundle-v1.schema.json",
        "schemas/publish-check-v1.schema.json",
        "schemas/run-manifest-v1.schema.json",
        "schemas/run-plan-v1.schema.json",
        "schemas/rerun-ledger-v1.schema.json",
        "schemas/workspace-summary-v1.schema.json",
        "examples/adapters/fixture-newsletter/run.sh",
        "examples/adapters/aider/run.sh",
        "examples/adapters/aider/README.md",
        "examples/evaluators/fixture-newsletter/run.sh",
        "docs/getting-started.md",
        "docs/benchmark-pack-tutorial.md",
        "docs/benchmark-methodology.md",
        "docs/contract-evolution.md",
    ];
    const missing = requiredPaths.filter((relativePath) => !existsSync(path.join(packageRoot, relativePath)));
    if (missing.length > 0) {
        return {
            name: "package-assets",
            status: "failed",
            details: `missing installed package asset(s): ${missing.join(", ")}`,
        };
    }
    return {
        name: "package-assets",
        status: "ok",
        details: "installed package includes CLI, public API modules, Python runtime, schemas, bundled scenarios, suites, maintained adapters, fixture evaluator, and docs",
    };
}
function suiteDoctorCheck(options, scenarioValidationResults) {
    if (options.scenarioDirExplicit && !options.suiteDirExplicit && options.suiteId === undefined) {
        return { name: "suites", status: "warning", details: "--suite-dir not provided; local suite validation skipped" };
    }
    const suiteSources = discoverRuhrohSuites(options.suiteDir);
    if (suiteSources.length === 0) {
        return { name: "suites", status: "warning", details: `no suites found in ${options.suiteDir}` };
    }
    const availableScenarioIds = scenarioValidationResults
        .map((result) => result.scenario?.id)
        .filter((id) => id !== undefined);
    const availableScenarioVersions = Object.fromEntries(scenarioValidationResults.flatMap((result) => {
        const id = result.scenario?.id;
        const version = result.scenario?.metadata?.scenarioVersion;
        return id === undefined || version === undefined ? [] : [[id, version]];
    }));
    const suiteResults = suiteSources
        .map((source) => validateRuhrohSuiteSource(source, { availableScenarioIds, availableScenarioVersions }))
        .filter((result) => options.suiteId === undefined || suiteValidationMatchesSelection(result, options));
    if (options.suiteId !== undefined && suiteResults.length === 0) {
        return { name: "suites", status: "failed", details: `no suite matched ${options.suiteId} in ${options.suiteDir}` };
    }
    const errorCount = suiteResults.reduce((total, result) => total + result.errors.length, 0);
    const warningCount = suiteResults.reduce((total, result) => total + result.warnings.length, 0);
    if (errorCount > 0) {
        return { name: "suites", status: "failed", details: `${errorCount} validation error(s) across ${suiteResults.length} suite(s)` };
    }
    return {
        name: "suites",
        status: warningCount === 0 ? "ok" : "warning",
        details: `${suiteResults.length} suite(s) valid${warningCount === 0 ? "" : ` with ${warningCount} warning(s)`}`,
    };
}
function selectScenarios(loaded, options) {
    if (options.suiteId !== undefined) {
        const { suite } = loadSelectedSuite(options);
        const byId = new Map(loaded.map((item) => [item.scenario.id, item]));
        const selected = suite.scenarioIds.map((scenarioId) => byId.get(scenarioId));
        const missing = suite.scenarioIds.filter((scenarioId, index) => selected[index] === undefined);
        if (missing.length > 0) {
            throw new Error(`Ruhroh suite ${suite.id} references unknown scenario(s): ${missing.join(", ")}`);
        }
        return selected.filter((item) => item !== undefined);
    }
    if (options.scenarioId !== undefined) {
        const scenario = loaded.find((item) => item.scenario.id === options.scenarioId);
        if (scenario === undefined) {
            throw new Error(`Unknown Ruhroh scenario: ${options.scenarioId}`);
        }
        return [scenario];
    }
    return loaded.filter((item) => item.scenario.tier === (options.tier ?? "smoke"));
}
function loadSelectedSuite(options) {
    const suites = discoverRuhrohSuites(options.suiteDir).map((source) => ({ source, suite: loadRuhrohSuite(source) }));
    const selected = suites.find((item) => item.suite.id === options.suiteId);
    if (selected === undefined) {
        throw new Error(`Unknown Ruhroh suite: ${options.suiteId}`);
    }
    return selected;
}
function buildCommands(scenarios, options, datasetPath, adapters, cwd) {
    const commands = [];
    const includeAdapterInLabel = adapters.length > 1;
    for (const adapter of adapters) {
        for (let runIndex = 1; runIndex <= options.runs; runIndex += 1) {
            for (const scenario of scenarios) {
                const sampleEnv = buildSampleEnv({
                    adapterId: adapter.adapterId,
                    scenarioId: scenario.id,
                    runIndex,
                    runCount: options.runs,
                });
                const env = buildPortableCommandEnv({
                    ...adapter.env,
                    ...sampleEnv,
                    RUHROH_RUN_SEED: adapter.env.RUHROH_RUN_SEED ?? sampleEnv.RUHROH_SAMPLE_SEED,
                }, cwd);
                const command = buildRuhrohHarborCommand({
                    scenario,
                    adapter: adapter.adapterId,
                    datasetPath,
                    iterations: options.iterations,
                    env,
                    agentImportPath: RUHROH_HARBOR_AGENT_IMPORT_PATH,
                    artifacts: RUHROH_ARTIFACTS,
                });
                commands.push({
                    ...command,
                    adapterId: adapter.adapterId,
                    label: formatCommandLabel({
                        adapterLabel: adapter.label,
                        scenarioId: scenario.id,
                        runIndex,
                        runCount: options.runs,
                        includeAdapter: includeAdapterInLabel,
                    }),
                    sampleId: sampleEnv.RUHROH_SAMPLE_ID ?? "",
                    sampleSeed: sampleEnv.RUHROH_SAMPLE_SEED ?? "",
                    runIndex,
                    runCount: options.runs,
                    env,
                });
            }
        }
    }
    return commands;
}
function shardCommands(commands, options) {
    if (options.shard === undefined) {
        return commands;
    }
    const shard = options.shard;
    const selected = commands.filter((_, index) => index % shard.total === shard.index - 1);
    if (selected.length === 0) {
        throw new Error(`--shard ${shard.index}/${shard.total} selected no samples from ${commands.length} planned sample(s)`);
    }
    return selected;
}
function writeRunPlanManifest(input) {
    const filePath = path.join(input.options.generatedDir, "ruhroh-run-plan.json");
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(buildRunPlanManifest(input), null, 2)}\n`, "utf8");
    return filePath;
}
function buildRunPlanManifest(input) {
    return {
        $schema: RUN_PLAN_SCHEMA_URL,
        version: "ruhroh_run_plan_v1",
        createdAt: new Date().toISOString(),
        selection: {
            scenarioDir: input.options.scenarioDir,
            suiteDir: input.options.suiteDir,
            ...(input.options.scenarioId === undefined ? {} : { scenarioId: input.options.scenarioId }),
            ...(input.options.suiteId === undefined ? {} : { suiteId: input.options.suiteId }),
            ...(input.options.tier === undefined ? {} : { tier: input.options.tier }),
            runs: input.options.runs,
            adapters: [...new Set(input.commands.map((command) => command.adapterId))],
            ...(input.options.shard === undefined ? {} : { shard: input.options.shard }),
        },
        ...(input.suite === undefined ? {} : {
            suite: {
                id: input.suite.suite.id,
                title: input.suite.suite.title,
                suiteVersion: input.suite.suite.suiteVersion,
                scenarioIds: input.suite.suite.scenarioIds,
                scenarioVersions: input.suite.suite.scenarioVersions,
                source: {
                    suitePath: input.suite.source.suitePath,
                    suiteSha256: sha256File(input.suite.source.suitePath),
                },
            },
        }),
        generated: {
            generatedDir: input.options.generatedDir,
            datasetPath: input.datasetPath,
        },
        scenarios: input.selected.map(({ scenario, source }) => ({
            id: scenario.id,
            title: scenario.title,
            tier: scenario.tier,
            ...(scenario.metadata?.scenarioVersion === undefined ? {} : { scenarioVersion: scenario.metadata.scenarioVersion }),
            source: {
                scenarioPath: source.scenarioPath,
                scenarioSha256: sha256File(source.scenarioPath),
                ...(source.instructionPath === undefined ? {} : {
                    instructionPath: source.instructionPath,
                    instructionSha256: sha256File(source.instructionPath),
                }),
            },
        })),
        samples: input.commands.map((command) => ({
            label: command.label,
            scenarioId: command.scenarioId,
            adapter: command.adapterId,
            sampleId: command.sampleId,
            sampleSeed: command.sampleSeed,
            runIndex: command.runIndex,
            runCount: command.runCount,
            forwardedEnvKeys: forwardedRunPlanEnvKeys(command.env),
            harborCommand: {
                bin: input.harborBin,
                args: command.displayArgs,
                display: formatCommand(input.harborBin, command.displayArgs),
            },
        })),
    };
}
const RUHROH_AGENT_ENV_KEY_SET = new Set(RUHROH_AGENT_ENV_KEYS);
function forwardedRunPlanEnvKeys(env) {
    return Object.keys(env)
        .filter((key) => RUHROH_AGENT_ENV_KEY_SET.has(key))
        .sort();
}
function buildSampleEnv(input) {
    const paddedIndex = String(input.runIndex).padStart(String(input.runCount).length, "0");
    const sampleId = `${input.scenarioId}/${input.adapterId}/${paddedIndex}-of-${input.runCount}`;
    const seedMaterial = `${input.scenarioId}\n${input.adapterId}\n${input.runIndex}\n${input.runCount}`;
    const sampleSeed = createHash("sha256").update(seedMaterial).digest("hex").slice(0, 16);
    return {
        RUHROH_SAMPLE_ID: sampleId,
        RUHROH_SAMPLE_SEED: sampleSeed,
        RUHROH_RUN_INDEX: String(input.runIndex),
        RUHROH_RUN_COUNT: String(input.runCount),
    };
}
function buildPortableCommandEnv(env, cwd) {
    let next = inlineLocalCommandEnv({
        env,
        cwd,
        commandKey: "RUHROH_RUN_AGENT_COMMAND",
        inlineBase64Key: "RUHROH_RUN_AGENT_COMMAND_INLINE_BASE64",
        inlineNameKey: "RUHROH_RUN_AGENT_COMMAND_INLINE_NAME",
        shellKey: "RUHROH_RUN_AGENT_COMMAND_SHELL",
        defaultName: "run-agent.sh",
    });
    next = inlineLocalCommandEnv({
        env: next,
        cwd,
        commandKey: "RUHROH_EVAL_COMMAND",
        inlineBase64Key: "RUHROH_EVAL_COMMAND_INLINE_BASE64",
        inlineNameKey: "RUHROH_EVAL_COMMAND_INLINE_NAME",
        shellKey: "RUHROH_EVAL_COMMAND_SHELL",
        defaultName: "eval-agent.sh",
    });
    return next;
}
function inlineLocalCommandEnv(input) {
    const command = input.env[input.commandKey]?.trim();
    if (command === undefined || command.length === 0 || commandShellFlagEnabled(input.env[input.shellKey]) || /\s/u.test(command)) {
        return input.env;
    }
    const hostPath = path.isAbsolute(command) ? command : path.resolve(input.cwd, command);
    if (!existsSync(hostPath) || !statSync(hostPath).isFile()) {
        return input.env;
    }
    const safeName = safePortableCommandName(path.basename(hostPath) || input.defaultName);
    return {
        ...input.env,
        [input.commandKey]: `/installed-agent/local-commands/${safeName}`,
        [input.inlineBase64Key]: readFileSync(hostPath).toString("base64"),
        [input.inlineNameKey]: safeName,
    };
}
function safePortableCommandName(name) {
    const sanitized = name.replace(/[^A-Za-z0-9._-]/gu, "-").replace(/^-+/u, "");
    return sanitized.length === 0 ? "command.sh" : sanitized;
}
function formatCommandLabel(input) {
    const scenarioLabel = input.runCount === 1
        ? input.scenarioId
        : `${input.scenarioId}#${input.runIndex}/${input.runCount}`;
    return input.includeAdapter ? `${input.adapterLabel}:${scenarioLabel}` : scenarioLabel;
}
function resolveAdapterSelections(options, cwd, env) {
    const adapters = options.adapters.length > 0 ? options.adapters : options.adapter === undefined ? [] : [options.adapter];
    if (adapters.length === 0) {
        throw new Error("--adapter is required for ruhroh run, dry-run, and plan commands");
    }
    return adapters.map((adapter) => resolveAdapterSelection(adapter, cwd, env));
}
function resolveAdapterSelection(adapterInput, cwd, env) {
    const adapter = adapterInput.trim();
    if (adapter.length === 0) {
        throw new Error("--adapter requires a non-empty value");
    }
    if (looksLikeAdapterCommand(adapter)) {
        const command = adapter.includes(" ")
            ? adapter
            : path.resolve(cwd, adapter);
        const adapterId = adapterIdFromCommand(command);
        return {
            adapterId,
            label: adapterId,
            env: {
                ...env,
                RUHROH_RUN_AGENT_COMMAND: command,
            },
        };
    }
    return { adapterId: adapter, label: adapter, env };
}
function looksLikeAdapterCommand(adapter) {
    return /\s/u.test(adapter) || adapter.startsWith(".") || adapter.startsWith("/") || adapter.includes(path.sep);
}
function adapterIdFromCommand(command) {
    const firstPathLikePart = command.split(/\s+/u).find((part) => part.includes(path.sep)) ?? command;
    return path.basename(firstPathLikePart).replace(/\.[cm]?[jt]sx?$/u, "") || "command";
}
export function resolveRuhrohPackageRoot() {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const basename = path.basename(moduleDir);
    return basename === "dist" || basename === "src" ? path.dirname(moduleDir) : moduleDir;
}
export function resolveRuhrohPythonPath() {
    return path.join(resolveRuhrohPackageRoot(), "python");
}
export function buildHarborSpawnEnv(env) {
    const pythonPath = resolveRuhrohPythonPath();
    return {
        ...env,
        PYTHONPATH: env.PYTHONPATH === undefined || env.PYTHONPATH.trim().length === 0
            ? pythonPath
            : `${pythonPath}${path.delimiter}${env.PYTHONPATH}`,
    };
}
function parseTier(value) {
    if (value === "smoke" || value === "nightly" || value === "release") {
        return value;
    }
    throw new Error(`Unknown Ruhroh tier: ${value}`);
}
function parseEvaluatorTemplate(value) {
    if (value === "review" || value === "deterministic" || value === "model" || value === "hybrid") {
        return value;
    }
    throw new Error(`Unknown Ruhroh evaluator template: ${value}`);
}
function parseAdapterTemplate(value) {
    if (value === "generic" || value === "codex-cli" || value === "claude-code" || value === "gemini-cli" || value === "aider" || value === "fixture") {
        return value;
    }
    throw new Error(`Unknown Ruhroh adapter template: ${value}`);
}
function parsePositiveInteger(value, arg) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${arg} must be a positive integer`);
    }
    return parsed;
}
function parseShard(value) {
    const match = /^([1-9]\d*)\/([1-9]\d*)$/u.exec(value);
    if (match === null) {
        throw new Error("--shard must use <index>/<total>, for example 2/4");
    }
    const index = Number.parseInt(match[1] ?? "", 10);
    const total = Number.parseInt(match[2] ?? "", 10);
    if (index > total) {
        throw new Error("--shard index must be less than or equal to total");
    }
    return { index, total };
}
function assertSafeScenarioId(value) {
    if (!/^[a-zA-Z0-9._-]+$/u.test(value) || value === "." || value === "..") {
        throw new Error(`Unsafe Ruhroh scenario id: ${value}`);
    }
    return value;
}
function readValue(argv, index, arg) {
    const value = argv[index + 1];
    if (value === undefined || value.length === 0) {
        throw new Error(`${arg} requires a value`);
    }
    return value;
}
function formatCommand(command, args) {
    return [command, ...args].map((part) => (/^[a-zA-Z0-9_./:=@-]+$/u.test(part) ? part : JSON.stringify(part))).join(" ");
}
function formatSpawnFailure(result) {
    const stdout = result.stdout ?? Buffer.alloc(0);
    const stderr = result.stderr ?? Buffer.alloc(0);
    const parts = [
        `status=${String(result.status)}`,
        result.error === undefined ? "" : `error=${result.error.message}`,
        stdout.length > 0 ? `stdout:\n${stdout.toString("utf8")}` : "",
        stderr.length > 0 ? `stderr:\n${stderr.toString("utf8")}` : "",
    ].filter(Boolean);
    return `${parts.join("\n")}\n`;
}
function runSpawnCheck(input) {
    const result = input.spawn(input.command, input.args, {
        cwd: input.cwd,
        env: input.env,
        encoding: "utf8",
    });
    if (result.status === 0 && result.error === undefined) {
        return { name: input.name, status: "ok", details: input.okDetails };
    }
    return {
        name: input.name,
        status: "failed",
        details: [result.error?.message, readSpawnText(result.stderr), readSpawnText(result.stdout)]
            .filter((part) => part !== undefined && part.trim().length > 0)
            .join("\n")
            .trim() || `${formatCommand(input.command, input.args)} failed`,
    };
}
function adapterDoctorCheck(options, cwd, env) {
    if (options.adapters.length === 0 && (options.adapter === undefined || options.adapter.trim().length === 0)) {
        return { name: "adapter", status: "warning", details: "--adapter not provided; live runs will require one" };
    }
    let adapters;
    try {
        adapters = resolveAdapterSelections(options, cwd, env);
    }
    catch (error) {
        return { name: "adapter", status: "failed", details: error instanceof Error ? error.message : String(error) };
    }
    const missing = adapters.flatMap((adapter) => {
        const commandPath = adapter.env.RUHROH_RUN_AGENT_COMMAND === undefined
            ? undefined
            : firstAdapterCommandPath(adapter.env.RUHROH_RUN_AGENT_COMMAND, cwd);
        return commandPath !== undefined && !existsSync(commandPath)
            ? [`${adapter.adapterId}: ${commandPath}`]
            : [];
    });
    if (missing.length > 0) {
        return { name: "adapter", status: "failed", details: `adapter command not found: ${missing.join(", ")}` };
    }
    return { name: "adapter", status: "ok", details: `adapter selected: ${adapters.map((adapter) => adapter.adapterId).join(", ")}` };
}
function adapterMetadataDoctorCheck(options, cwd, env) {
    if (options.adapters.length === 0 && (options.adapter === undefined || options.adapter.trim().length === 0)) {
        return {
            name: "adapter-metadata",
            status: "warning",
            details: "adapter metadata cannot be inspected until --adapter is provided",
        };
    }
    let adapters;
    try {
        adapters = resolveAdapterSelections(options, cwd, env);
    }
    catch (error) {
        return {
            name: "adapter-metadata",
            status: "warning",
            details: `adapter metadata could not be inspected: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    const warnings = [];
    const okDetails = [];
    for (const adapter of adapters) {
        const command = adapter.env.RUHROH_RUN_AGENT_COMMAND;
        if (command === undefined || command.trim().length === 0) {
            warnings.push(`${adapter.adapterId}: no command wrapper configured for metadata inspection`);
            continue;
        }
        const commandPath = firstAdapterCommandPath(command, cwd);
        if (commandPath === undefined) {
            warnings.push(`${adapter.adapterId}: command is not a readable wrapper path, so result metadata could not be inspected`);
            continue;
        }
        if (!existsSync(commandPath)) {
            warnings.push(`${adapter.adapterId}: command wrapper not found for metadata inspection: ${commandPath}`);
            continue;
        }
        let script;
        try {
            script = readFileSync(commandPath, "utf8");
        }
        catch (error) {
            warnings.push(`${adapter.adapterId}: command wrapper could not be read for metadata inspection: ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }
        const supportsResultFile = script.includes("RUHROH_RESULT_PATH") || script.includes("ruhroh_run_agent_result_v1");
        const metadataFields = [
            scriptReferencesResultField(script, "adapterVersion") ? "adapterVersion" : undefined,
            scriptReferencesResultField(script, "model") ? "model" : undefined,
            scriptReferencesResultField(script, "usage") ? "usage" : undefined,
            scriptReferencesResultField(script, "artifacts") ? "artifacts" : undefined,
        ].filter((field) => field !== undefined);
        const requiredFields = ["adapterVersion", "model", "artifacts"];
        const missingRequiredFields = requiredFields.filter((field) => !metadataFields.includes(field));
        const optionalFields = ["usage"];
        const missingOptionalFields = optionalFields.filter((field) => !metadataFields.includes(field));
        if (!supportsResultFile) {
            warnings.push(`${adapter.adapterId}: wrapper does not reference RUHROH_RESULT_PATH; only final-line completion metadata may be captured`);
            continue;
        }
        if (missingRequiredFields.length > 0) {
            warnings.push(`${adapter.adapterId}: wrapper writes RUHROH_RESULT_PATH but is missing comparison metadata: ${missingRequiredFields.join(", ")}; include adapterVersion, model, and artifacts before repeated live-agent comparisons`);
            continue;
        }
        okDetails.push(`${adapter.adapterId}: ready for repeated comparisons with ${requiredFields.join(", ")}${missingOptionalFields.length === 0 ? ", usage" : "; optional missing: usage"}`);
    }
    return warnings.length === 0
        ? { name: "adapter-metadata", status: "ok", details: okDetails.join("; ") || "adapter result metadata is inspectable" }
        : { name: "adapter-metadata", status: "warning", details: uniquePreserveOrder(warnings).join("; ") };
}
function scriptReferencesResultField(script, field) {
    const escaped = field.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return script.includes(`"${field}"`)
        || script.includes(`'${field}'`)
        || new RegExp(`\\b${escaped}\\s*:`, "u").test(script)
        || new RegExp(`\\b${escaped}\\s*,`, "u").test(script);
}
function evalDoctorCheck(cwd, env) {
    if (env.RUHROH_EVAL_RESULT_FIXTURE !== undefined && env.RUHROH_EVAL_RESULT_FIXTURE.trim().length > 0) {
        return { name: "eval", status: "ok", details: "RUHROH_EVAL_RESULT_FIXTURE is configured" };
    }
    if (env.RUHROH_EVAL_RESULT_FIXTURE_PATH !== undefined && env.RUHROH_EVAL_RESULT_FIXTURE_PATH.trim().length > 0) {
        const fixturePath = path.isAbsolute(env.RUHROH_EVAL_RESULT_FIXTURE_PATH)
            ? env.RUHROH_EVAL_RESULT_FIXTURE_PATH
            : path.resolve(cwd, env.RUHROH_EVAL_RESULT_FIXTURE_PATH);
        return existsSync(fixturePath)
            ? { name: "eval", status: "ok", details: `eval fixture file: ${fixturePath}` }
            : { name: "eval", status: "failed", details: `eval fixture file not found: ${fixturePath}` };
    }
    if (env.RUHROH_EVAL_COMMAND === undefined || env.RUHROH_EVAL_COMMAND.trim().length === 0) {
        return { name: "eval", status: "warning", details: "RUHROH_EVAL_COMMAND or eval fixture not configured; live runs need one" };
    }
    const commandPath = firstAdapterCommandPath(env.RUHROH_EVAL_COMMAND, cwd);
    if (commandPath !== undefined && !existsSync(commandPath)) {
        return { name: "eval", status: "failed", details: `eval command not found: ${commandPath}` };
    }
    return { name: "eval", status: "ok", details: "RUHROH_EVAL_COMMAND is configured" };
}
function commandSafetyDoctorCheck(options, cwd, env) {
    const warnings = [];
    try {
        const adapters = options.adapters.length > 0 || options.adapter !== undefined
            ? resolveAdapterSelections(options, cwd, env)
            : [];
        for (const adapter of adapters) {
            const command = adapter.env.RUHROH_RUN_AGENT_COMMAND;
            if (command === undefined || command.trim().length === 0) {
                continue;
            }
            warnings.push(...commandSafetyWarnings({
                label: `adapter ${adapter.adapterId}`,
                command,
                shellEnvKey: "RUHROH_RUN_AGENT_COMMAND_SHELL",
                shellEnabled: commandShellFlagEnabled(adapter.env.RUHROH_RUN_AGENT_COMMAND_SHELL),
            }));
        }
    }
    catch {
        return {
            name: "command-safety",
            status: "warning",
            details: "adapter command safety could not be inspected because adapter resolution failed",
        };
    }
    if (env.RUHROH_EVAL_COMMAND !== undefined && env.RUHROH_EVAL_COMMAND.trim().length > 0) {
        warnings.push(...commandSafetyWarnings({
            label: "eval",
            command: env.RUHROH_EVAL_COMMAND,
            shellEnvKey: "RUHROH_EVAL_COMMAND_SHELL",
            shellEnabled: commandShellFlagEnabled(env.RUHROH_EVAL_COMMAND_SHELL),
        }));
    }
    return warnings.length === 0
        ? { name: "command-safety", status: "ok", details: "command-backed adapters and evaluators use default no-shell execution" }
        : { name: "command-safety", status: "warning", details: uniquePreserveOrder(warnings).join("; ") };
}
function commandSafetyWarnings(input) {
    if (input.shellEnabled) {
        return [`${input.label} enables shell execution via ${input.shellEnvKey}; only use trusted wrappers`];
    }
    const shellTokens = shellSyntaxTokens(input.command);
    return shellTokens.length === 0
        ? []
        : [`${input.label} command contains shell syntax (${shellTokens.join(", ")}) but shell execution is disabled; operators will be passed as literal argv`];
}
function commandShellFlagEnabled(value) {
    return ["1", "true", "yes", "on"].includes((value ?? "").trim().toLowerCase());
}
function shellSyntaxTokens(command) {
    const tokens = [];
    let quote;
    for (let index = 0; index < command.length; index += 1) {
        const char = command[index];
        if (char === "\\" && quote !== "'") {
            index += 1;
            continue;
        }
        if (char === "\"" || char === "'") {
            quote = quote === char ? undefined : quote === undefined ? char : quote;
            continue;
        }
        if (quote !== undefined) {
            continue;
        }
        const pair = command.slice(index, index + 2);
        if (pair === "&&" || pair === "||" || pair === "$(") {
            tokens.push(pair);
            index += 1;
            continue;
        }
        if (char === ";" || char === "|" || char === ">" || char === "<" || char === "`") {
            tokens.push(char);
        }
    }
    return uniquePreserveOrder(tokens);
}
function firstAdapterCommandPath(command, cwd) {
    const first = command.trim().split(/\s+/u)[0];
    if (first === undefined || first.length === 0 || !looksLikeAdapterCommand(first)) {
        return undefined;
    }
    return path.isAbsolute(first) ? first : path.resolve(cwd, first);
}
function readSpawnText(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Buffer.isBuffer(value)) {
        return value.toString("utf8");
    }
    return undefined;
}
function scenarioValidationMatchesSelection(result, options) {
    if (options.scenarioId !== undefined) {
        return result.scenario?.id === options.scenarioId || path.basename(result.source.scenarioDir) === options.scenarioId;
    }
    if (options.suiteId !== undefined) {
        const suites = discoverRuhrohSuites(options.suiteDir).map((source) => loadRuhrohSuite(source));
        const suite = suites.find((item) => item.id === options.suiteId);
        return suite?.scenarioIds.includes(result.scenario?.id ?? path.basename(result.source.scenarioDir)) ?? false;
    }
    if (options.tier !== undefined) {
        return result.scenario?.tier === options.tier || result.scenario === undefined;
    }
    return true;
}
function suiteValidationMatchesSelection(result, options) {
    if (options.suiteId !== undefined) {
        return result.suite?.id === options.suiteId || path.basename(result.source.suiteDir) === options.suiteId;
    }
    return options.listSuites || options.command === "validate";
}
function readRunResult(inputPath) {
    const resolved = path.resolve(inputPath);
    const resultPath = statSync(resolved).isDirectory() ? path.join(resolved, "ruhroh-loop-result.json") : resolved;
    const parsed = readJsonObject(resultPath);
    if (!isRuhrohLoopResult(parsed)) {
        throw new Error(`Expected ruhroh_loop_result_v1 JSON at ${resultPath}`);
    }
    return parsed;
}
function readRunResults(inputPath) {
    return readRunResultArtifacts(inputPath).map((artifact) => artifact.run);
}
function readRunResultArtifacts(inputPath) {
    const resolved = path.resolve(inputPath);
    if (!existsSync(resolved)) {
        throw new Error(`Path does not exist: ${resolved}`);
    }
    if (!statSync(resolved).isDirectory()) {
        return [readRunResultArtifact(resolved, true)];
    }
    return walkJsonFiles(resolved).filter((filePath) => !isPublishBundleSourcePath(filePath)).flatMap((filePath) => {
        try {
            const artifact = readRunResultArtifact(filePath, false);
            return artifact === undefined ? [] : [artifact];
        }
        catch {
            return [];
        }
    });
}
function readRunResultArtifact(filePath, requireResult) {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isRuhrohLoopResult(parsed)) {
        if (requireResult) {
            throw new Error(`Expected ruhroh_loop_result_v1 JSON at ${filePath}`);
        }
        return undefined;
    }
    return {
        path: filePath,
        sha256: sha256Text(raw),
        run: parsed,
    };
}
function sha256File(filePath) {
    return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
function sha256Text(value) {
    return createHash("sha256").update(value).digest("hex");
}
function benchmarkClaimResultArtifact(artifact) {
    const summary = summarizeRuhrohRun(artifact.run);
    const scenarioVersion = artifact.run.runManifest?.scenario.scenarioVersion;
    return {
        path: artifact.path,
        sha256: artifact.sha256,
        scenarioId: summary.scenarioId,
        adapter: summary.adapter,
        ...(summary.runId === undefined ? {} : { runId: summary.runId }),
        ...(summary.sample?.id === undefined ? {} : { sampleId: summary.sample.id }),
        ...(scenarioVersion === undefined ? {} : { scenarioVersion }),
        ...(summary.artifactInventory.length === 0 ? {} : { artifactInventory: summary.artifactInventory }),
    };
}
function readJsonObject(filePath) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isRecord(parsed)) {
        throw new Error(`Expected JSON object in ${filePath}`);
    }
    return parsed;
}
function readRuhrohPackageIdentity() {
    try {
        const pkg = readJsonObject(path.join(resolveRuhrohPackageRoot(), "package.json"));
        const name = typeof pkg.name === "string" && pkg.name.trim().length > 0
            ? pkg.name
            : "ruhroh";
        const version = typeof pkg.version === "string" && pkg.version.trim().length > 0
            ? pkg.version
            : undefined;
        return {
            name,
            ...(version === undefined ? {} : { version }),
        };
    }
    catch {
        return { name: "ruhroh" };
    }
}
function isRuhrohLoopResult(value) {
    if (!isRecord(value)) {
        return false;
    }
    return value.version === "ruhroh_loop_result_v1"
        && typeof value.scenarioId === "string"
        && typeof value.status === "string"
        && typeof value.score === "number";
}
function walkJsonFiles(root) {
    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkJsonFiles(fullPath));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(".json")) {
            files.push(fullPath);
        }
    }
    return files.sort();
}
function isPublishBundleSourcePath(filePath) {
    const parts = path.resolve(filePath).split(path.sep);
    const sourceIndex = parts.lastIndexOf("sources");
    if (sourceIndex <= 0) {
        return false;
    }
    const bundleRoot = parts.slice(0, sourceIndex).join(path.sep) || path.sep;
    return existsSync(path.join(bundleRoot, "manifest.json")) && existsSync(path.join(bundleRoot, "publish-check.json"));
}
function formatRunReport(summary, reviewQueue = []) {
    const lines = [
        `Ruhroh report: ${summary.scenarioId}`,
        ...(summary.runId === undefined ? [] : [`runId: ${summary.runId}`]),
        `adapter: ${summary.adapter}`,
        `status: ${summary.status} eval=${summary.evalStatus} score=${summary.score}`,
        `failureBucket: ${summary.failureBucket}`,
        `iterations: ${summary.iterationsUsed}`,
        `duration: ${summary.durationMs}ms`,
        `summary: ${summary.finalSummary}`,
    ];
    if (summary.runManifest !== undefined) {
        lines.push("", "Run manifest:", `  scenarioVersion: ${summary.runManifest.scenario.scenarioVersion ?? "unknown"}`, `  dataset: ${summary.runManifest.benchmark.dataset}`, `  startedAt: ${summary.runManifest.timing.startedAt}`, `  maxIterations: ${summary.runManifest.loop.maxIterations}`, `  sample: ${formatSample(summary.runManifest.sample)}`, `  runAgent: ${summary.runManifest.runAgent.adapterId}${summary.runManifest.runAgent.adapterVersion === undefined ? "" : `@${summary.runManifest.runAgent.adapterVersion}`}`);
        const agentModel = formatManifestModel(summary.runManifest.runAgent.model);
        if (agentModel !== undefined) {
            lines.push(`  agentModel: ${agentModel}`);
        }
        const evalModel = formatManifestModel(summary.runManifest.evaluator?.model);
        if (evalModel !== undefined) {
            lines.push(`  evalModel: ${evalModel}`);
        }
    }
    if (Object.keys(summary.subscores).length > 0) {
        lines.push("", "Subscores:");
        for (const [dimension, score] of Object.entries(summary.subscores)) {
            lines.push(`  ${dimension}: ${formatNumber(score ?? 0)}`);
        }
    }
    if (summary.evalJudge !== undefined || summary.evalJudgeAgreement !== undefined || summary.evalJudgeVotes.length > 0) {
        lines.push("", "Evaluator judges:");
        if (summary.evalJudge !== undefined) {
            lines.push(`  primary: ${formatEvalJudge(summary.evalJudge)}`);
        }
        if (summary.evalJudgeAgreement !== undefined) {
            lines.push(`  agreement: votes=${summary.evalJudgeAgreement.votes} unanimous=${summary.evalJudgeAgreement.unanimous ? "yes" : "no"} majority=${summary.evalJudgeAgreement.majorityStatus ?? "none"} counts=${formatStatusCounts(summary.evalJudgeAgreement.statusCounts)}`);
            if (summary.evalJudgeAgreement.dissentingJudges.length > 0) {
                lines.push(`  dissenting: ${summary.evalJudgeAgreement.dissentingJudges.join(", ")}`);
            }
        }
        for (const vote of summary.evalJudgeVotes) {
            lines.push(`  vote: ${formatEvalJudge(vote.judge)} status=${vote.status} confidence=${vote.confidence}${vote.weight === undefined ? "" : ` weight=${formatNumber(vote.weight)}`} rationale=${vote.rationale}`);
        }
    }
    if (summary.implementationTimeline.length > 0) {
        lines.push("", "Implementation timeline:");
        for (const step of summary.implementationTimeline) {
            lines.push(`  ${step.iteration}: ${step.status}${step.completionState === undefined ? "" : ` completion=${step.completionState}`}${step.stopReason === undefined ? "" : ` stop=${step.stopReason}`}`);
            const refs = [
                step.runId === undefined ? "" : `runId=${step.runId}`,
                step.transcriptPath === undefined ? "" : `transcript=${step.transcriptPath}`,
                step.eventLogPath === undefined ? "" : `eventLog=${step.eventLogPath}`,
            ].filter(Boolean);
            if (refs.length > 0) {
                lines.push(`    ${refs.join(" ")}`);
            }
            if (step.notes !== undefined) {
                lines.push(`    notes: ${step.notes.replace(/\s+/gu, " ")}`);
            }
        }
    }
    if (summary.criteriaResults.length > 0) {
        lines.push("", "Criteria:");
        for (const criterion of summary.criteriaResults) {
            lines.push(`  ${criterion.id}: ${criterion.status} score=${formatNumber(criterion.score)} - ${criterion.description}`);
            if (criterion.notes !== undefined && criterion.notes.trim().length > 0) {
                lines.push(`    ${criterion.notes}`);
            }
        }
    }
    if (summary.evidenceRefs.length > 0) {
        lines.push("", "Evidence:");
        for (const evidence of summary.evidenceRefs) {
            lines.push(`  ${evidence.kind}: ${evidence.ref} - ${evidence.summary}`);
        }
    }
    if (summary.unmetCriteria.length > 0) {
        lines.push("", "Unmet criteria:");
        for (const item of summary.unmetCriteria) {
            lines.push(`  - ${item}`);
        }
    }
    if (summary.evalQualityWarnings.length > 0) {
        lines.push("", "Eval quality warnings:");
        for (const warning of summary.evalQualityWarnings) {
            lines.push(`  - ${warning}`);
        }
    }
    if (summary.artifactCompletenessWarnings.length > 0) {
        lines.push("", "Artifact completeness warnings:");
        for (const warning of summary.artifactCompletenessWarnings) {
            lines.push(`  - ${warning}`);
        }
    }
    if (reviewQueue.length > 0) {
        lines.push("", "Review queue:");
        for (const item of reviewQueue) {
            lines.push(`  ${item.priority}: ${item.scenarioId}/${item.adapter}${item.runId === undefined ? "" : ` runId=${item.runId}`} score=${item.score} eval=${item.evalStatus}`);
            for (const reason of item.reasons) {
                lines.push(`    reason: ${reason}`);
            }
            for (const transcriptPath of item.transcriptPaths) {
                lines.push(`    transcript: ${transcriptPath}`);
            }
            for (const eventLogPath of item.eventLogPaths) {
                lines.push(`    eventLog: ${eventLogPath}`);
            }
        }
    }
    if (summary.commandsRun.length > 0) {
        lines.push("", "Commands run:");
        for (const command of summary.commandsRun) {
            lines.push(`  ${command.command} -> ${command.exitCode}: ${command.summary}`);
        }
    }
    if (summary.artifactInventory.length > 0) {
        lines.push("", "Artifact inventory:");
        for (const artifact of summary.artifactInventory) {
            const status = artifact.available ? "available" : `missing:${artifact.error ?? "unknown"}`;
            const size = artifact.sizeBytes === undefined ? "" : ` size=${artifact.sizeBytes}`;
            const sha = artifact.sha256 === undefined ? "" : ` sha256=${artifact.sha256}`;
            lines.push(`  ${artifact.name}: ${status}${size}${sha} path=${artifact.path}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function formatReviewQueueReport(report, cwd) {
    const source = path.relative(cwd, report.source.resultsPath) || report.source.resultsPath;
    const lines = [
        `Ruhroh review queue: ${source}`,
        `results: ${report.source.resultCount}`,
        `items: ${report.itemCount} required=${report.requiredCount} recommended=${report.recommendedCount}`,
    ];
    if (report.reviewQueue.length === 0) {
        lines.push("", "No review items. Required human review is clear for these result artifacts.");
        return `${lines.join("\n")}\n`;
    }
    lines.push("", "Review items:");
    for (const item of report.reviewQueue) {
        lines.push(`  ${item.priority}: ${item.scenarioId}/${item.adapter}${item.runId === undefined ? "" : ` runId=${item.runId}`} score=${item.score} eval=${item.evalStatus}`);
        for (const reason of item.reasons) {
            lines.push(`    reason: ${reason}`);
        }
        for (const transcriptPath of item.transcriptPaths) {
            lines.push(`    transcript: ${transcriptPath}`);
        }
        for (const eventLogPath of item.eventLogPaths) {
            lines.push(`    eventLog: ${eventLogPath}`);
        }
    }
    lines.push("", "Next steps:", "  inspect the listed transcripts, event logs, eval output, and final workspace artifacts", "  record the adjudication decision and rationale with the benchmark pack or claim review", "  rerun ruhroh publish-check before publishing the claim");
    return `${lines.join("\n")}\n`;
}
function buildExampleCatalog(packageRoot) {
    const examplesRoot = path.join(packageRoot, "examples");
    const item = (kind, id, relativePath, description, credentialFree, command) => {
        const itemPath = path.join(examplesRoot, relativePath);
        const docsPath = path.join(itemPath, "README.md");
        return {
            id,
            kind,
            path: itemPath,
            description,
            credentialFree,
            ...(command === undefined ? {} : { command }),
            ...(existsSync(docsPath) ? { docs: docsPath } : {}),
        };
    };
    return {
        version: "ruhroh_examples_v1",
        packageRoot,
        scenarios: [
            item("scenario", "simple-newsletter", path.join("scenarios", "simple-newsletter"), "Small local app task used for fixture and adapter smoke runs.", true),
            item("scenario", "grocery-budget-planner", path.join("scenarios", "grocery-budget-planner"), "Budget-planning app task with a realistic user workflow.", true),
        ],
        adapters: [
            item("adapter", "fixture-newsletter", path.join("adapters", "fixture-newsletter"), "Credential-free adapter that writes a small newsletter page for local smoke tests.", true, "examples/adapters/fixture-newsletter/run.sh"),
            item("adapter", "codex-cli", path.join("adapters", "codex-cli"), "Command-backed wrapper for Codex CLI via custom-shell.", false, "examples/adapters/codex-cli/run.sh"),
            item("adapter", "claude-code", path.join("adapters", "claude-code"), "Command-backed wrapper for Claude Code print mode via custom-shell.", false, "examples/adapters/claude-code/run.sh"),
            item("adapter", "gemini-cli", path.join("adapters", "gemini-cli"), "Command-backed wrapper for Gemini CLI via custom-shell.", false, "examples/adapters/gemini-cli/run.sh"),
            item("adapter", "aider", path.join("adapters", "aider"), "Command-backed wrapper for Aider via custom-shell.", false, "examples/adapters/aider/run.sh"),
        ],
        evaluators: [
            item("evaluator", "fixture-newsletter", path.join("evaluators", "fixture-newsletter"), "Credential-free evaluator for the newsletter fixture workflow.", true, "examples/evaluators/fixture-newsletter/run.sh"),
        ],
        evaluatorTemplates: [
            {
                template: "review",
                description: "Evidence-first evaluator skeleton that returns review until scenario-specific judgment is implemented.",
                recommendedFor: "New benchmark packs and human-adjudicated outcomes.",
                command: "pnpm exec ruhroh new-evaluator local-review --template review",
                nextCommand: "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>",
            },
            {
                template: "deterministic",
                description: "Local file, command, text, or app checks with explicit pass/fail/review output.",
                recommendedFor: "Tasks with objective workspace evidence and stable local checks.",
                command: "pnpm exec ruhroh new-evaluator local-deterministic --template deterministic",
                nextCommand: "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>",
            },
            {
                template: "model",
                description: "External judge-command wrapper that normalizes model judgment into Ruhroh eval JSON.",
                recommendedFor: "Subjective outcomes that need rubric-guided review and judge metadata.",
                command: "pnpm exec ruhroh new-evaluator local-model --template model",
                nextCommand: "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>",
            },
            {
                template: "hybrid",
                description: "Deterministic gates plus optional model or human adjudication for ambiguous evidence.",
                recommendedFor: "Publishable benchmarks that combine objective checks with governed review.",
                command: "pnpm exec ruhroh new-evaluator local-hybrid --template hybrid",
                nextCommand: "pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario <scenario-id>",
            },
        ],
    };
}
function formatExampleCatalog(catalog, cwd) {
    const lines = [
        "Ruhroh examples",
        `package: ${path.relative(cwd, catalog.packageRoot) || catalog.packageRoot}`,
        "",
        "Scenarios:",
        ...catalog.scenarios.map((item) => formatExampleCatalogItem(item, cwd)),
        "",
        "Adapters:",
        ...catalog.adapters.map((item) => formatExampleCatalogItem(item, cwd)),
        "",
        "Evaluators:",
        ...catalog.evaluators.map((item) => formatExampleCatalogItem(item, cwd)),
        "",
        "Evaluator templates:",
        ...catalog.evaluatorTemplates.map(formatEvaluatorTemplateCatalogItem),
        "",
        "Credential-free fixture loop:",
        "  export RUHROH_RUN_AGENT_COMMAND=\"$PWD/examples/adapters/fixture-newsletter/run.sh\"",
        "  export RUHROH_EVAL_COMMAND=\"$PWD/examples/evaluators/fixture-newsletter/run.sh\"",
        "  pnpm exec ruhroh doctor --scenario-dir examples/scenarios --adapter custom-shell",
        "  pnpm exec ruhroh run --scenario-dir examples/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run",
        "",
        "Live agent wrapper pattern:",
        "  export RUHROH_RUN_AGENT_COMMAND=\"$PWD/examples/adapters/codex-cli/run.sh\"",
        "  export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line",
        "  pnpm exec ruhroh doctor --scenario-dir examples/scenarios --adapter custom-shell",
    ];
    return `${lines.join("\n")}\n`;
}
function formatEvaluatorTemplateCatalogItem(item) {
    return `  ${item.template}: ${item.description}\n    recommended for: ${item.recommendedFor}\n    scaffold: ${item.command}\n    calibrate: ${item.nextCommand}`;
}
function formatExampleCatalogItem(item, cwd) {
    const itemPath = path.relative(cwd, item.path) || item.path;
    const tags = item.credentialFree ? "credential-free" : "requires local agent credentials";
    return `  ${item.id}: ${item.description} (${tags})\n    path: ${itemPath}${item.command === undefined ? "" : `\n    command: ${item.command}`}`;
}
function formatRunReportHtml(summary, reviewQueue = [], htmlPath) {
    const title = `Ruhroh report: ${summary.scenarioId}`;
    const manifestRows = summary.runManifest === undefined ? [] : [
        ["Scenario version", summary.runManifest.scenario.scenarioVersion ?? "unknown"],
        ["Dataset", summary.runManifest.benchmark.dataset],
        ["Started", summary.runManifest.timing.startedAt],
        ["Duration", `${summary.runManifest.timing.durationMs}ms`],
        ["Max iterations", String(summary.runManifest.loop.maxIterations)],
        ["Sample", formatSample(summary.runManifest.sample)],
        ["Run agent", `${summary.runManifest.runAgent.adapterId}${summary.runManifest.runAgent.adapterVersion === undefined ? "" : `@${summary.runManifest.runAgent.adapterVersion}`}`],
        ["Agent model", formatManifestModel(summary.runManifest.runAgent.model) ?? ""],
        ["Eval model", formatManifestModel(summary.runManifest.evaluator?.model) ?? ""],
    ].filter((row) => (row[1] ?? "").length > 0);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; --border: #d8dee4; --muted: #57606a; --bg: #f6f8fa; --bad: #b42318; --ok: #1f7a3f; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #fff; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      h2 { font-size: 18px; margin: 28px 0 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: var(--bg); }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      pre { white-space: pre-wrap; background: var(--bg); border: 1px solid var(--border); padding: 12px; overflow-wrap: anywhere; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .metric { border: 1px solid var(--border); padding: 12px; background: var(--bg); }
      .metric strong { display: block; font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted">${escapeHtml(summary.finalSummary)}</p>
      </header>
      <section class="grid" aria-label="Run overview">
        ${metricHtml("Run id", summary.runId ?? "unknown")}
        ${metricHtml("Adapter", summary.adapter)}
        ${metricHtml("Status", `${summary.status} / ${summary.evalStatus}`, summary.score === 1 ? "pass" : "fail")}
        ${metricHtml("Score", formatNumber(summary.score), summary.score === 1 ? "pass" : "fail")}
        ${metricHtml("Failure bucket", summary.failureBucket)}
        ${metricHtml("Iterations", String(summary.iterationsUsed))}
        ${metricHtml("Duration", `${summary.durationMs}ms`)}
      </section>
      ${manifestRows.length === 0 ? "" : sectionHtml("Run Manifest", tableHtml(["Field", "Value"], manifestRows))}
      ${Object.keys(summary.subscores).length === 0 ? "" : sectionHtml("Subscores", tableHtml(["Dimension", "Score"], Object.entries(summary.subscores).map(([key, value]) => [key, formatNumber(value ?? 0)])))}
      ${summary.evalJudge === undefined && summary.evalJudgeAgreement === undefined && summary.evalJudgeVotes.length === 0 ? "" : sectionHtml("Evaluator Judges", [
        summary.evalJudge === undefined ? "" : tableHtml(["Field", "Value"], [["Primary judge", formatEvalJudge(summary.evalJudge)]]),
        summary.evalJudgeAgreement === undefined ? "" : tableHtml(["Votes", "Unanimous", "Majority", "Counts", "Dissenting judges"], [[
                String(summary.evalJudgeAgreement.votes),
                summary.evalJudgeAgreement.unanimous ? "yes" : "no",
                summary.evalJudgeAgreement.majorityStatus ?? "",
                formatStatusCounts(summary.evalJudgeAgreement.statusCounts),
                summary.evalJudgeAgreement.dissentingJudges.join("; "),
            ]]),
        summary.evalJudgeVotes.length === 0 ? "" : tableHtml(["Judge", "Status", "Confidence", "Weight", "Rationale", "Evidence"], summary.evalJudgeVotes.map((vote) => [
            formatEvalJudge(vote.judge),
            vote.status,
            vote.confidence,
            vote.weight === undefined ? "" : formatNumber(vote.weight),
            vote.rationale,
            vote.evidenceRefs.map((evidence) => `${evidence.kind}:${evidence.ref}`).join("; "),
        ])),
    ].join(""))}
      ${summary.implementationTimeline.length === 0 ? "" : sectionHtml("Implementation Timeline", tableHtml(["Iteration", "Status", "Completion", "Stop", "Run id", "Transcript", "Event log", "Notes"], summary.implementationTimeline.map((step) => [
        String(step.iteration),
        step.status,
        step.completionState ?? "",
        step.stopReason ?? "",
        step.runId ?? "",
        localPathCell(step.transcriptPath, htmlPath),
        localPathCell(step.eventLogPath, htmlPath),
        step.notes ?? "",
    ])))}
      ${summary.criteriaResults.length === 0 ? "" : sectionHtml("Criteria", tableHtml(["Id", "Status", "Score", "Description", "Notes"], summary.criteriaResults.map((criterion) => [
        criterion.id,
        criterion.status,
        formatNumber(criterion.score),
        criterion.description,
        criterion.notes ?? "",
    ])))}
      ${summary.evidenceRefs.length === 0 ? "" : sectionHtml("Evidence", tableHtml(["Kind", "Ref", "Summary"], summary.evidenceRefs.map((evidence) => [evidence.kind, evidence.ref, evidence.summary])))}
      ${summary.unmetCriteria.length === 0 ? "" : sectionHtml("Unmet Criteria", listHtml(summary.unmetCriteria))}
      ${summary.evalQualityWarnings.length === 0 ? "" : sectionHtml("Eval Quality Warnings", listHtml(summary.evalQualityWarnings))}
      ${summary.artifactCompletenessWarnings.length === 0 ? "" : sectionHtml("Artifact Completeness Warnings", listHtml(summary.artifactCompletenessWarnings))}
      ${reviewQueue.length === 0 ? "" : sectionHtml("Review Queue", reviewQueueTableHtml(reviewQueue, htmlPath))}
      ${summary.commandsRun.length === 0 ? "" : sectionHtml("Commands Run", tableHtml(["Command", "Exit", "Summary"], summary.commandsRun.map((command) => [command.command, String(command.exitCode), command.summary])))}
      ${summary.artifactInventory.length === 0 ? "" : sectionHtml("Artifact Inventory", tableHtml(["Name", "Status", "Size", "SHA-256", "Path"], summary.artifactInventory.map((artifact) => [
        artifact.name,
        artifact.available ? "available" : artifact.error ?? "missing",
        artifact.sizeBytes === undefined ? "" : String(artifact.sizeBytes),
        artifact.sha256 ?? "",
        localPathCell(artifact.path, htmlPath),
    ])))}
    </main>
  </body>
</html>
`;
}
function formatReviewQueueHtml(report, htmlPath) {
    const title = "Ruhroh review queue";
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; --border: #d8dee4; --muted: #57606a; --bg: #f6f8fa; --bad: #b42318; --ok: #1f7a3f; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #fff; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      h2 { font-size: 18px; margin: 28px 0 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: var(--bg); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .metric { border: 1px solid var(--border); padding: 12px; background: var(--bg); }
      .metric strong { display: block; font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted">${localPathLinkHtml(report.source.resultsPath, htmlPath)}</p>
      </header>
      <section class="grid" aria-label="Review queue overview">
        ${metricHtml("Results", String(report.source.resultCount))}
        ${metricHtml("Review items", String(report.itemCount), report.itemCount === 0 ? "pass" : "fail")}
        ${metricHtml("Required", String(report.requiredCount), report.requiredCount === 0 ? "pass" : "fail")}
        ${metricHtml("Recommended", String(report.recommendedCount))}
      </section>
      ${report.reviewQueue.length === 0
        ? sectionHtml("Review Queue", "<p>No review items. Required human review is clear for these result artifacts.</p>")
        : sectionHtml("Review Queue", reviewQueueTableHtml(report.reviewQueue, htmlPath))}
      ${sectionHtml("Adjudication Checklist", listHtml([
        "Inspect each listed transcript, event log, eval output, and final workspace artifact.",
        "Record the decision, rationale, reviewer identity, and any accepted limitations with the benchmark pack or claim review.",
        "Rerun ruhroh publish-check before publishing the claim.",
    ]))}
    </main>
  </body>
</html>
`;
}
function formatEvalQualityReportHtml(report, htmlPath) {
    const title = "Ruhroh eval-quality";
    const evidenceRefTotal = report.runs.reduce((total, run) => total + run.evidenceRefCount, 0);
    const criteriaResultTotal = report.runs.reduce((total, run) => total + run.criteriaResultCount, 0);
    const commandTotal = report.runs.reduce((total, run) => total + run.commandCount, 0);
    const judgeVoteTotal = report.runs.reduce((total, run) => total + run.judgeVoteCount, 0);
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; --border: #d8dee4; --muted: #57606a; --bg: #f6f8fa; --bad: #b42318; --ok: #1f7a3f; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #fff; }
      main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      h2 { font-size: 18px; margin: 28px 0 12px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: var(--bg); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .metric { border: 1px solid var(--border); padding: 12px; background: var(--bg); }
      .metric strong { display: block; font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(title)}</h1>
        <p class="muted">${localPathLinkHtml(report.source.resultsPath, htmlPath)}</p>
      </header>
      <section class="grid" aria-label="Eval quality overview">
        ${metricHtml("Gate", report.ok ? "ok" : "needs attention", report.ok ? "pass" : "fail")}
        ${metricHtml("Results", String(report.source.resultCount))}
        ${metricHtml("Warnings", String(report.warningCount), report.warningCount === 0 ? "pass" : "fail")}
        ${metricHtml("Human review required", String(report.humanReviewRequiredCount), report.humanReviewRequiredCount === 0 ? "pass" : "fail")}
        ${metricHtml("Evidence refs", String(evidenceRefTotal))}
        ${metricHtml("Criteria results", String(criteriaResultTotal))}
        ${metricHtml("Commands", String(commandTotal))}
        ${metricHtml("Judge votes", String(judgeVoteTotal))}
      </section>
      ${Object.keys(report.warningCounts).length === 0
        ? sectionHtml("Warning Counts", "<p>No evaluator evidence warnings were found.</p>")
        : sectionHtml("Warning Counts", tableHtml(["Warning", "Count"], Object.entries(report.warningCounts).map(([warning, count]) => [warning, String(count)])))}
      ${report.nextActions.length === 0 ? "" : sectionHtml("Next Actions", listHtml(report.nextActions))}
      ${sectionHtml("Evaluator Runs", evalQualityRunTableHtml(report.runs, htmlPath))}
    </main>
  </body>
</html>
`;
}
function evalQualityRunTableHtml(runs, htmlPath) {
    return tableHtml([
        "Scenario",
        "Adapter",
        "Run id",
        "Eval",
        "Score",
        "Evidence refs",
        "Criteria results",
        "Commands",
        "Judge",
        "Judge votes",
        "Agreement",
        "Review",
        "Warnings",
        "Result",
    ], runs.map((run) => [
        run.scenarioId,
        run.adapter,
        run.runId ?? "",
        run.evalStatus,
        formatNumber(run.score),
        String(run.evidenceRefCount),
        String(run.criteriaResultCount),
        String(run.commandCount),
        run.judge ?? "",
        String(run.judgeVoteCount),
        formatEvalQualityAgreement(run),
        run.humanReviewRequired ? "required" : "",
        run.evalQualityWarnings.join("; "),
        localPathCell(run.resultPath, htmlPath),
    ]));
}
function formatEvalQualityAgreement(run) {
    if (run.judgeAgreement === undefined) {
        return "";
    }
    const status = run.judgeAgreement.majorityStatus === undefined ? "" : ` majority=${run.judgeAgreement.majorityStatus}`;
    return `${run.judgeAgreement.unanimous ? "unanimous" : "split"}${status}`;
}
function sectionHtml(title, body) {
    return `<section><h2>${escapeHtml(title)}</h2>${body}</section>`;
}
function metricHtml(label, value, className = "") {
    return `<div class="metric"><strong>${escapeHtml(label)}</strong><span${className.length === 0 ? "" : ` class="${className}"`}>${escapeHtml(value)}</span></div>`;
}
function tableHtml(headers, rows) {
    return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${typeof cell === "string" ? escapeHtml(cell) : cell.html}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function listHtml(items) {
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}
function reviewQueueTableHtml(items, htmlPath) {
    return tableHtml([
        "Priority",
        "Scenario",
        "Adapter",
        "Run id",
        "Score",
        "Eval",
        "Failure",
        "Reasons",
        "Transcripts",
        "Event logs",
    ], items.map((item) => [
        item.priority,
        item.scenarioId,
        item.adapter,
        item.runId ?? "",
        formatNumber(item.score),
        item.evalStatus,
        item.failureBucket,
        item.reasons.join("; "),
        localPathListCell(item.transcriptPaths, htmlPath),
        localPathListCell(item.eventLogPaths, htmlPath),
    ]));
}
function localPathListCell(paths, htmlPath) {
    const links = paths.map((item) => localPathLinkHtml(item, htmlPath));
    return { html: links.length === 0 ? "" : links.join("<br>") };
}
function localPathCell(targetPath, htmlPath) {
    return { html: targetPath === undefined || targetPath.length === 0 ? "" : localPathLinkHtml(targetPath, htmlPath) };
}
function localPathLinkHtml(targetPath, htmlPath) {
    const displayHref = localPathDisplay(targetPath, htmlPath);
    const href = displayHref.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `<a href="${escapeHtml(href)}">${escapeHtml(displayHref)}</a>`;
}
function localPathDisplay(targetPath, htmlPath) {
    if (htmlPath === undefined) {
        return targetPath;
    }
    const hrefPath = path.isAbsolute(targetPath)
        ? path.relative(path.dirname(htmlPath), targetPath)
        : targetPath;
    const normalizedHref = hrefPath.split(path.sep).join("/");
    return normalizedHref.startsWith(".") ? normalizedHref : `./${normalizedHref}`;
}
function artifactInventoryCell(artifacts, htmlPath) {
    if (artifacts === undefined || artifacts.length === 0) {
        return "";
    }
    return {
        html: artifacts.map((artifact) => {
            const status = artifact.available ? "available" : artifact.error ?? "missing";
            const digest = artifact.sha256 === undefined ? "" : ` ${artifact.sha256}`;
            return `${escapeHtml(`${artifact.name}: ${status}`)} ${localPathLinkHtml(artifact.path, htmlPath)}${escapeHtml(digest)}`;
        }).join("<br>"),
    };
}
function escapeHtml(value) {
    return value
        .replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;")
        .replace(/"/gu, "&quot;")
        .replace(/'/gu, "&#39;");
}
function formatCompareReport(groups, compareSuite, suiteAdapterSummaries = [], pairwiseComparisons = [], reviewQueue = [], claimReadiness, runPlan, runPlanWarnings = []) {
    const lines = ["Ruhroh compare"];
    if (runPlan !== undefined) {
        lines.push(`runPlan: ${runPlan.samples.length} planned sample${runPlan.samples.length === 1 ? "" : "s"}`);
        for (const warning of runPlanWarnings) {
            lines.push(`run plan warning: ${warning}`);
        }
    }
    if (compareSuite !== undefined) {
        lines.push(`suite: ${compareSuite.suite.id}@${compareSuite.suite.suiteVersion}`, `suiteMinRuns: ${compareSuite.suite.methodology.minRuns}`);
        for (const warning of compareSuite.warnings) {
            lines.push(`suite warning: ${warning}`);
        }
        if (suiteAdapterSummaries.length > 0) {
            lines.push("", "Suite adapter summary:");
            for (const summary of suiteAdapterSummaries) {
                lines.push(`  ${summary.adapter}: scenarios=${summary.coveredScenarios}/${summary.expectedScenarios} missing=${formatList(summary.missingScenarioIds)} scenarioRuns=${formatScenarioRuns(summary.scenarioRuns)} runs=${summary.runs} passRate=${formatPercent(summary.runWeightedPassRate)} 95% CI ${formatPercent(summary.runWeightedPassRateCi95.lower)}-${formatPercent(summary.runWeightedPassRateCi95.upper)} meanScenarioPassRate=${formatPercent(summary.meanScenarioPassRate)} minRuns=${summary.minRunsSatisfied ? "satisfied" : "not_satisfied"}`);
                for (const warning of summary.warnings) {
                    lines.push(`    warning: ${warning}`);
                }
            }
        }
    }
    lines.push("", "Comparison matrix:");
    for (const line of formatCompareMatrixLines(groups)) {
        lines.push(`  ${line}`);
    }
    if (pairwiseComparisons.length > 0) {
        lines.push("", "Pairwise adapter comparisons:");
        for (const comparison of pairwiseComparisons) {
            lines.push(`  ${comparison.scenarioId}: ${comparison.contenderAdapter} vs ${comparison.baselineAdapter} delta=${formatSignedPercent(comparison.passRateDelta)} 95% CI ${formatSignedConfidenceInterval(comparison.passRateDeltaCi95)} fisherP=${formatPValue(comparison.significance.pValue)} significant=${comparison.significance.significant} conclusion=${comparison.conclusion}`, `    ${comparison.contenderAdapter}: ${formatPercent(comparison.contenderPassRate)} (${comparison.contenderPasses}/${comparison.contenderRuns}); ${comparison.baselineAdapter}: ${formatPercent(comparison.baselinePassRate)} (${comparison.baselinePasses}/${comparison.baselineRuns})`);
            for (const warning of comparison.warnings) {
                lines.push(`    warning: ${warning}`);
            }
        }
    }
    if (claimReadiness !== undefined) {
        lines.push("", "Claim readiness:", `  scope: ${claimReadiness.scope}`, `  publishable: ${claimReadiness.publishable ? "yes" : "no"}`);
        for (const blocker of claimReadiness.blockers) {
            lines.push(`  blocker: ${blocker}`);
        }
        for (const advisory of claimReadiness.advisories) {
            lines.push(`  advisory: ${advisory}`);
        }
    }
    if (reviewQueue.length > 0) {
        lines.push("", "Review queue:");
        for (const item of reviewQueue) {
            lines.push(`  ${item.priority}: ${item.scenarioId}/${item.adapter}${item.runId === undefined ? "" : ` runId=${item.runId}`} score=${formatNumber(item.score)} eval=${item.evalStatus} failure=${item.failureBucket}`);
            lines.push(`    reasons: ${item.reasons.join("; ")}`);
            if (item.transcriptPaths.length > 0) {
                lines.push(`    transcripts: ${item.transcriptPaths.join("; ")}`);
            }
            if (item.eventLogPaths.length > 0) {
                lines.push(`    eventLogs: ${item.eventLogPaths.join("; ")}`);
            }
        }
    }
    for (const group of groups) {
        lines.push("", `${group.scenarioId} / ${group.adapter}`, `  runs: ${group.runs}`, `  passRate: ${formatPercent(group.passRate)} (${group.passes}/${group.runs}) 95% CI ${formatPercent(group.passRateCi95.lower)}-${formatPercent(group.passRateCi95.upper)}`, `  pass@k: ${formatPassAtK(group.passAtK)}`, `  meanScore: ${formatNumber(group.meanScore)} bootstrap 95% CI ${formatNumber(group.meanScoreCi95.lower)}-${formatNumber(group.meanScoreCi95.upper)}`, `  cohort: ${formatCohort(group.cohort)}`, `  medianDuration: ${group.medianDurationMs}ms`, `  iterations: ${formatCounts(group.iterationDistribution)}`, `  failureBuckets: ${formatCounts(group.failureBuckets)}`, `  reviewRequired: ${group.reviewRequired}`);
        if (Object.keys(group.meanSubscores).length > 0) {
            lines.push(`  meanSubscores: ${Object.entries(group.meanSubscores).map(([key, value]) => `${key}=${formatNumber(value ?? 0)}`).join(", ")}`);
        }
        if (Object.keys(group.evalQualityWarnings).length > 0) {
            lines.push(`  evalQualityWarnings: ${formatCounts(group.evalQualityWarnings)}`);
        }
        if (Object.keys(group.artifactCompletenessWarnings).length > 0) {
            lines.push(`  artifactCompletenessWarnings: ${formatCounts(group.artifactCompletenessWarnings)}`);
        }
        if (group.usage.runsWithUsage > 0) {
            lines.push(`  usage: ${formatUsage(group.usage)}`);
        }
        for (const warning of group.statisticalWarnings) {
            lines.push(`  warning: ${warning}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function formatCompareReportHtml(groups, compareSuite, suiteAdapterSummaries = [], pairwiseComparisons = [], reviewQueue = [], claimReadiness, runPlan, runPlanWarnings = [], resultArtifacts = [], htmlPath) {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Ruhroh compare</title>
    <style>
      :root { color-scheme: light; --border: #d8dee4; --muted: #57606a; --bg: #f6f8fa; --bad: #b42318; --ok: #1f7a3f; }
      body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #fff; }
      main { max-width: 1280px; margin: 0 auto; padding: 32px 20px 48px; }
      header { border-bottom: 1px solid var(--border); margin-bottom: 24px; padding-bottom: 16px; }
      h1 { font-size: 28px; margin: 0 0 8px; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { border: 1px solid var(--border); padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: var(--bg); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
      .metric { border: 1px solid var(--border); padding: 12px; background: var(--bg); }
      .metric strong { display: block; font-size: 13px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
      .evidence-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin: 12px 0; }
      .evidence-card { border: 1px solid var(--border); border-radius: 6px; padding: 12px; background: #fff; }
      .evidence-card h3 { font-size: 16px; margin: 0 0 6px; }
      .evidence-card ul { margin: 10px 0 0; padding-left: 18px; }
      .evidence-card li { margin: 4px 0; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Ruhroh compare</h1>
        <p class="muted">${escapeHtml(`${groups.length} scenario/adapter group${groups.length === 1 ? "" : "s"}`)}</p>
        ${runPlan === undefined ? "" : `<p class="muted">${escapeHtml(`run plan ${runPlan.samples.length} planned sample${runPlan.samples.length === 1 ? "" : "s"}`)}</p>`}
        ${compareSuite === undefined ? "" : `<p class="muted">${escapeHtml(`suite ${compareSuite.suite.id}@${compareSuite.suite.suiteVersion}; minRuns=${compareSuite.suite.methodology.minRuns}`)}</p>`}
        ${compareSuite === undefined || compareSuite.warnings.length === 0 ? "" : sectionHtml("Suite Warnings", listHtml(compareSuite.warnings))}
        ${runPlanWarnings.length === 0 ? "" : sectionHtml("Run Plan Warnings", listHtml(runPlanWarnings))}
      </header>
      ${formatPublicationEvidenceOverviewHtml(groups, compareSuite, reviewQueue, claimReadiness, runPlan, runPlanWarnings, resultArtifacts)}
      ${claimReadiness === undefined ? "" : sectionHtml("Claim Readiness", tableHtml([
        "Scope",
        "Publishable",
        "Blockers",
        "Advisories",
    ], [[
            claimReadiness.scope,
            claimReadiness.publishable ? "yes" : "no",
            claimReadiness.blockers.join("; "),
            claimReadiness.advisories.join("; "),
        ]]))}
      ${sectionHtml("Comparison Matrix", compareMatrixHtml(groups))}
      ${compareFailureTriageHtml(groups)}
      ${compareCostEfficiencyHtml(groups)}
      ${suiteAdapterSummaries.length === 0 ? "" : sectionHtml("Suite Adapter Summary", tableHtml([
        "Adapter",
        "Scenarios",
        "Missing scenarios",
        "Scenario runs",
        "Runs",
        "Pass rate",
        "95% CI",
        "Mean scenario pass rate",
        "Min runs",
        "Warnings",
    ], suiteAdapterSummaries.map((summary) => [
        summary.adapter,
        `${summary.coveredScenarios}/${summary.expectedScenarios}`,
        formatList(summary.missingScenarioIds),
        formatScenarioRuns(summary.scenarioRuns),
        String(summary.runs),
        `${formatPercent(summary.runWeightedPassRate)} (${summary.passes}/${summary.runs})`,
        `${formatPercent(summary.runWeightedPassRateCi95.lower)}-${formatPercent(summary.runWeightedPassRateCi95.upper)}`,
        formatPercent(summary.meanScenarioPassRate),
        summary.minRunsSatisfied ? "satisfied" : "not satisfied",
        summary.warnings.join("; "),
    ])))}
      ${pairwiseComparisons.length === 0 ? "" : sectionHtml("Pairwise Adapter Comparisons", tableHtml([
        "Scenario",
        "Contender",
        "Baseline",
        "Delta",
        "95% CI",
        "Fisher p",
        "Significant",
        "Conclusion",
        "Contender pass rate",
        "Baseline pass rate",
        "Warnings",
    ], pairwiseComparisons.map((comparison) => [
        comparison.scenarioId,
        comparison.contenderAdapter,
        comparison.baselineAdapter,
        formatSignedPercent(comparison.passRateDelta),
        formatSignedConfidenceInterval(comparison.passRateDeltaCi95),
        formatPValue(comparison.significance.pValue),
        comparison.significance.significant ? "yes" : "no",
        comparison.conclusion,
        `${formatPercent(comparison.contenderPassRate)} (${comparison.contenderPasses}/${comparison.contenderRuns})`,
        `${formatPercent(comparison.baselinePassRate)} (${comparison.baselinePasses}/${comparison.baselineRuns})`,
        comparison.warnings.join("; "),
    ])))}
      ${reviewQueue.length === 0 ? "" : sectionHtml("Review Queue", reviewQueueTableHtml(reviewQueue, htmlPath))}
      ${compareEvidenceBrowserHtml(resultArtifacts, htmlPath)}
      ${resultArtifacts.length === 0 ? "" : sectionHtml("Result Artifacts", tableHtml([
        "Scenario",
        "Adapter",
        "Run id",
        "Sample id",
        "Scenario version",
        "Result JSON",
        "SHA-256",
        "Named artifacts",
    ], resultArtifacts.map((artifact) => [
        artifact.scenarioId,
        artifact.adapter,
        artifact.runId ?? "",
        artifact.sampleId ?? "",
        artifact.scenarioVersion ?? "",
        localPathCell(artifact.path, htmlPath),
        artifact.sha256,
        artifactInventoryCell(artifact.artifactInventory, htmlPath),
    ])))}
      ${tableHtml([
        "Scenario",
        "Adapter",
        "Runs",
        "Pass rate",
        "95% CI",
        "pass@k",
        "Mean score",
        "Mean score CI",
        "Cohort",
        "Median duration",
        "Iterations",
        "Failures",
        "Review",
        "Eval warnings",
        "Artifact warnings",
        "Usage",
        "Warnings",
    ], groups.map((group) => [
        group.scenarioId,
        group.adapter,
        String(group.runs),
        `${formatPercent(group.passRate)} (${group.passes}/${group.runs})`,
        `${formatPercent(group.passRateCi95.lower)}-${formatPercent(group.passRateCi95.upper)}`,
        formatPassAtK(group.passAtK),
        formatNumber(group.meanScore),
        `${formatNumber(group.meanScoreCi95.lower)}-${formatNumber(group.meanScoreCi95.upper)}`,
        formatCohort(group.cohort),
        `${group.medianDurationMs}ms`,
        formatCounts(group.iterationDistribution),
        formatCounts(group.failureBuckets),
        String(group.reviewRequired),
        formatCounts(group.evalQualityWarnings),
        formatCounts(group.artifactCompletenessWarnings),
        group.usage.runsWithUsage === 0 ? "none" : formatUsage(group.usage),
        group.statisticalWarnings.join("; "),
    ]))}
    </main>
  </body>
</html>
`;
}
function compareEvidenceBrowserHtml(resultArtifacts, htmlPath) {
    if (resultArtifacts.length === 0) {
        return "";
    }
    const cards = resultArtifacts.map((artifact) => {
        const title = [artifact.scenarioId, artifact.adapter, artifact.runId].filter((item) => item !== undefined && item.length > 0).join(" / ");
        const sample = artifact.sampleId === undefined ? "" : `<p class="muted">${escapeHtml(artifact.sampleId)}</p>`;
        return `<article class="evidence-card">
      <h3>${escapeHtml(title)}</h3>
      ${sample}
      <ul>${compareEvidenceLinksHtml(artifact, htmlPath)}</ul>
    </article>`;
    }).join("");
    return sectionHtml("Evidence Browser", [
        `<p class="muted">Open the preserved evidence for each run without digging through the full artifact table.</p>`,
        `<div class="evidence-grid">${cards}</div>`,
    ].join(""));
}
function compareEvidenceLinksHtml(artifact, htmlPath) {
    const inventory = artifact.artifactInventory ?? [];
    const byName = new Map(inventory.map((item) => [item.name, item]));
    const links = [
        `<li><strong>result</strong>: ${localPathLinkHtml(artifact.path, htmlPath)}</li>`,
    ];
    for (const item of [
        { name: "runManifest", label: "manifest" },
        { name: "evalResult", label: "evaluation" },
        { name: "evalInput", label: "eval input" },
        { name: "journey", label: "journey" },
        { name: "implementationRuns", label: "turns" },
        { name: "transcript", label: "transcript" },
        { name: "events", label: "events" },
        { name: "workspaceSummary", label: "workspace summary" },
        { name: "workspaceTarball", label: "workspace archive" },
    ]) {
        const evidence = byName.get(item.name);
        if (evidence === undefined) {
            continue;
        }
        links.push(`<li><strong>${escapeHtml(item.label)}</strong>: ${evidence.available ? localPathLinkHtml(evidence.path, htmlPath) : `<span class="fail">${escapeHtml(evidence.error ?? "missing")}</span>`}</li>`);
    }
    return links.join("");
}
function formatPublicationEvidenceOverviewHtml(groups, compareSuite, reviewQueue, claimReadiness, runPlan, runPlanWarnings, resultArtifacts) {
    const requiredReview = reviewQueue.filter((item) => item.priority === "required").length;
    const recommendedReview = reviewQueue.filter((item) => item.priority === "recommended").length;
    const namedArtifacts = resultArtifacts.flatMap((artifact) => artifact.artifactInventory ?? []);
    const missingArtifacts = namedArtifacts.filter((artifact) => !artifact.available).length;
    const totalRuns = groups.reduce((total, group) => total + group.runs, 0);
    const totalPasses = groups.reduce((total, group) => total + group.passes, 0);
    const publishable = claimReadiness?.publishable === true;
    const evidenceSummary = [
        `${resultArtifacts.length} hashed result JSON source${resultArtifacts.length === 1 ? "" : "s"}`,
        `${namedArtifacts.length} named artifact${namedArtifacts.length === 1 ? "" : "s"}`,
        `${missingArtifacts} missing artifact${missingArtifacts === 1 ? "" : "s"}`,
        runPlan === undefined ? "no run plan" : `${runPlan.samples.length} planned sample${runPlan.samples.length === 1 ? "" : "s"}`,
        compareSuite === undefined ? "ad hoc comparison" : `suite ${compareSuite.suite.id}@${compareSuite.suite.suiteVersion}`,
    ].join("; ");
    return sectionHtml("Publication and Evidence Overview", [
        `<div class="grid" aria-label="Publication and evidence overview">`,
        metricHtml("Publishable", claimReadiness === undefined ? "unknown" : publishable ? "yes" : "no", claimReadiness === undefined ? "" : publishable ? "pass" : "fail"),
        metricHtml("Scope", claimReadiness?.scope ?? "unknown"),
        metricHtml("Runs", `${totalPasses}/${totalRuns} passing`),
        metricHtml("Result sources", String(resultArtifacts.length), resultArtifacts.length > 0 ? "pass" : "fail"),
        metricHtml("Named artifacts", `${namedArtifacts.length} tracked${missingArtifacts > 0 ? `, ${missingArtifacts} missing` : ""}`, missingArtifacts === 0 ? "pass" : "fail"),
        metricHtml("Run plan", runPlan === undefined ? "missing" : runPlanWarnings.length === 0 ? "clean" : `${runPlanWarnings.length} warning${runPlanWarnings.length === 1 ? "" : "s"}`, runPlan !== undefined && runPlanWarnings.length === 0 ? "pass" : "fail"),
        metricHtml("Review queue", `${requiredReview} required, ${recommendedReview} recommended`, requiredReview === 0 ? "pass" : "fail"),
        metricHtml("Readiness blockers", String(claimReadiness?.blockers.length ?? 0), claimReadiness === undefined || claimReadiness.blockers.length === 0 ? "pass" : "fail"),
        `</div>`,
        `<p class="muted">${escapeHtml(evidenceSummary)}</p>`,
    ].join(""));
}
function formatCompareMatrixLines(groups) {
    const adapters = compareMatrixAdapters(groups);
    const byScenarioAdapter = compareMatrixGroupMap(groups);
    return compareMatrixScenarios(groups).map((scenarioId) => [
        scenarioId,
        ...adapters.map((adapter) => `${adapter}: ${formatCompareMatrixCell(byScenarioAdapter.get(`${scenarioId}\u0000${adapter}`))}`),
    ].join(" | "));
}
function compareMatrixHtml(groups) {
    const adapters = compareMatrixAdapters(groups);
    const byScenarioAdapter = compareMatrixGroupMap(groups);
    return tableHtml([
        "Scenario",
        ...adapters,
    ], compareMatrixScenarios(groups).map((scenarioId) => [
        scenarioId,
        ...adapters.map((adapter) => formatCompareMatrixCell(byScenarioAdapter.get(`${scenarioId}\u0000${adapter}`))),
    ]));
}
function compareFailureTriageHtml(groups) {
    const rows = groups
        .map((group) => {
        const nonPassingRuns = group.runs - group.passes;
        const evalWarningCount = sumCountMap(group.evalQualityWarnings);
        const artifactWarningCount = sumCountMap(group.artifactCompletenessWarnings);
        return {
            group,
            nonPassingRuns,
            evalWarningCount,
            artifactWarningCount,
            failureBuckets: filterCountMap(group.failureBuckets, (bucket) => bucket !== "none"),
        };
    })
        .filter((row) => row.nonPassingRuns > 0
        || row.group.reviewRequired > 0
        || row.evalWarningCount > 0
        || row.artifactWarningCount > 0
        || row.group.statisticalWarnings.length > 0);
    if (rows.length === 0) {
        return "";
    }
    return sectionHtml("Failure Triage", tableHtml([
        "Scenario",
        "Adapter",
        "Non-passing runs",
        "Failure buckets",
        "Review required",
        "Eval warnings",
        "Artifact warnings",
        "Statistical warnings",
        "Next action",
    ], rows.map((row) => [
        row.group.scenarioId,
        row.group.adapter,
        `${row.nonPassingRuns}/${row.group.runs}`,
        formatCounts(row.failureBuckets),
        String(row.group.reviewRequired),
        formatCounts(row.group.evalQualityWarnings),
        formatCounts(row.group.artifactCompletenessWarnings),
        row.group.statisticalWarnings.join("; "),
        compareFailureNextAction(row.group, row.nonPassingRuns, row.evalWarningCount, row.artifactWarningCount),
    ])));
}
function compareCostEfficiencyHtml(groups) {
    const groupsWithUsage = groups.filter((group) => group.usage.runsWithUsage > 0);
    if (groupsWithUsage.length === 0) {
        return "";
    }
    return sectionHtml("Cost and Efficiency", tableHtml([
        "Scenario",
        "Adapter",
        "Usage coverage",
        "Cost coverage",
        "Total cost",
        "Mean cost",
        "Cost per pass",
        "Token coverage",
        "Total tokens",
        "Tokens per pass",
    ], groupsWithUsage.map((group) => [
        group.scenarioId,
        group.adapter,
        `${group.usage.runsWithUsage}/${group.runs} runs`,
        `${group.usage.runsWithCost}/${group.runs} runs`,
        group.usage.totalCostUsd === undefined ? "" : formatMoney(group.usage.totalCostUsd),
        group.usage.meanCostUsd === undefined ? "" : formatMoney(group.usage.meanCostUsd),
        group.usage.costPerPass === undefined ? "" : formatMoney(group.usage.costPerPass),
        `${group.usage.runsWithTokens}/${group.runs} runs`,
        group.usage.totalTokens === undefined ? "" : formatNumber(group.usage.totalTokens),
        group.usage.tokensPerPass === undefined ? "" : formatNumber(group.usage.tokensPerPass),
    ])));
}
function compareFailureNextAction(group, nonPassingRuns, evalWarningCount, artifactWarningCount) {
    if (artifactWarningCount > 0) {
        return "Restore missing or incomplete artifacts before publication.";
    }
    if (evalWarningCount > 0) {
        return "Fix evaluator evidence quality before citing the score.";
    }
    if (group.reviewRequired > 0) {
        return "Adjudicate required review items.";
    }
    if (nonPassingRuns > 0) {
        return "Inspect failing run artifacts and failure buckets.";
    }
    return "Review statistical warnings before comparison.";
}
function filterCountMap(counts, predicate) {
    return Object.fromEntries(Object.entries(counts).filter(([key, value]) => predicate(key) && value > 0));
}
function sumCountMap(counts) {
    return Object.values(counts).reduce((total, count) => total + count, 0);
}
function compareMatrixScenarios(groups) {
    return [...new Set(groups.map((group) => group.scenarioId))].sort((left, right) => left.localeCompare(right));
}
function compareMatrixAdapters(groups) {
    return [...new Set(groups.map((group) => group.adapter))].sort((left, right) => left.localeCompare(right));
}
function compareMatrixGroupMap(groups) {
    return new Map(groups.map((group) => [`${group.scenarioId}\u0000${group.adapter}`, group]));
}
function formatCompareMatrixCell(group) {
    if (group === undefined) {
        return "no runs";
    }
    const warningCount = compareGroupWarningCount(group);
    return [
        `${formatPercent(group.passRate)} (${group.passes}/${group.runs})`,
        `CI ${formatPercent(group.passRateCi95.lower)}-${formatPercent(group.passRateCi95.upper)}`,
        `review ${group.reviewRequired}`,
        `warnings ${warningCount}`,
    ].join("; ");
}
function compareGroupWarningCount(group) {
    return Object.values(group.evalQualityWarnings).reduce((total, count) => total + count, 0)
        + Object.values(group.artifactCompletenessWarnings).reduce((total, count) => total + count, 0)
        + group.statisticalWarnings.length;
}
function formatDoctorReport(checks) {
    const lines = ["Ruhroh doctor"];
    for (const check of checks) {
        lines.push(`${check.status.toUpperCase()}\t${check.name}\t${check.details}`);
    }
    return `${lines.join("\n")}\n`;
}
function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "");
}
function formatPercent(value) {
    return `${Math.round(value * 1000) / 10}%`;
}
function formatSignedPercent(value) {
    const formatted = formatPercent(value);
    return value > 0 ? `+${formatted}` : formatted;
}
function formatSignedConfidenceInterval(interval) {
    return `${formatSignedPercent(interval.lower)} to ${formatSignedPercent(interval.upper)}`;
}
function formatPValue(value) {
    return value < 0.001 ? "<0.001" : formatNumber(value);
}
function formatCounts(counts) {
    const entries = Object.entries(counts);
    if (entries.length === 0) {
        return "none";
    }
    return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}
function formatPassAtK(passAtK) {
    const entries = Object.entries(passAtK);
    if (entries.length === 0) {
        return "none";
    }
    return entries.map(([key, value]) => `${key}=${formatPercent(value)}`).join(", ");
}
function formatSample(sample) {
    if (sample === undefined) {
        return "unknown";
    }
    const parts = [
        sample.id,
        sample.index === undefined || sample.count === undefined ? undefined : `${sample.index}/${sample.count}`,
        sample.seed === undefined ? undefined : `seed=${sample.seed}`,
    ].filter((part) => part !== undefined && part.length > 0);
    return parts.length === 0 ? "unknown" : parts.join(" ");
}
function formatUsage(usage) {
    const parts = [`runsWithUsage=${usage.runsWithUsage}`];
    parts.push(`runsWithCost=${usage.runsWithCost}`);
    parts.push(`runsWithTokens=${usage.runsWithTokens}`);
    if (usage.totalCostUsd !== undefined) {
        parts.push(`totalCostUsd=${formatMoney(usage.totalCostUsd)}`);
    }
    if (usage.meanCostUsd !== undefined) {
        parts.push(`meanCostUsd=${formatMoney(usage.meanCostUsd)}`);
    }
    if (usage.costPerPass !== undefined) {
        parts.push(`costPerPass=${formatMoney(usage.costPerPass)}`);
    }
    if (usage.totalTokens !== undefined) {
        parts.push(`totalTokens=${formatNumber(usage.totalTokens)}`);
    }
    if (usage.meanTotalTokens !== undefined) {
        parts.push(`meanTotalTokens=${formatNumber(usage.meanTotalTokens)}`);
    }
    if (usage.tokensPerPass !== undefined) {
        parts.push(`tokensPerPass=${formatNumber(usage.tokensPerPass)}`);
    }
    return parts.join(", ");
}
function formatCohort(cohort) {
    return [
        `sample=${formatList(cohort.sampleIds)}`,
        `sampleSeed=${formatList(cohort.sampleSeeds)}`,
        `scenarioVersion=${formatList(cohort.scenarioVersions)}`,
        `adapterVersion=${formatList(cohort.adapterVersions)}`,
        `agentModel=${formatList(cohort.agentModels)}`,
        `agentPrompt=${formatList(cohort.agentPromptVersions)}`,
        `evalModel=${formatList(cohort.evaluatorModels)}`,
        `evalPrompt=${formatList(cohort.evaluatorPromptVersions)}`,
        `judge=${formatList(cohort.judgeIdentities)}`,
        `env=${formatList(cohort.environmentFingerprints)}`,
    ].join(", ");
}
function formatList(values) {
    return values.length === 0 ? "unknown" : values.join("|");
}
function formatMoney(value) {
    return value === 0 ? "$0" : `$${value.toFixed(4).replace(/0+$/u, "").replace(/\.$/u, "")}`;
}
function formatManifestModel(model) {
    if (model === undefined || Object.keys(model).length === 0) {
        return undefined;
    }
    const provider = typeof model.provider === "string" ? model.provider : undefined;
    const name = typeof model.model === "string" ? model.model : undefined;
    const version = typeof model.version === "string" ? model.version : undefined;
    const label = [provider, name].filter(Boolean).join("/");
    if (label.length === 0) {
        return version;
    }
    return version === undefined ? label : `${label}@${version}`;
}
function formatEvalJudge(judge) {
    const model = judge.model === undefined ? "" : `/${judge.model}`;
    const version = judge.version === undefined ? "" : `@${judge.version}`;
    return `${judge.kind}${model}${version}`;
}
function formatStatusCounts(counts) {
    return Object.entries(counts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => `${status}=${count}`)
        .join(", ") || "none";
}
function formatScenarioRuns(scenarioRuns) {
    return Object.entries(scenarioRuns)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([scenarioId, runs]) => `${scenarioId}=${runs}`)
        .join(", ") || "none";
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function helpText() {
    return `Usage: ruhroh [run|generate|list|list-suites|plan|validate|inspect-pack|validate-artifacts|validate-claim|validate-summary|validate-bundle|claim-index|report|compare|review|eval-quality|calibrate-evaluator|publish-check|explain|examples|first-run|workflow|doctor|init|new-scenario|new-suite|new-adapter|new-evaluator] [options]

Common commands:
  ruhroh init [dir]
  ruhroh first-run
  ruhroh workflow
  ruhroh new-scenario my-task --scenario-dir ruhroh/scenarios
  ruhroh new-suite local-smoke --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario my-task
  ruhroh new-adapter local-agent
  ruhroh new-adapter codex-local --template codex-cli
  ruhroh new-evaluator local-evaluator
  ruhroh new-evaluator local-evaluator --template deterministic
  ruhroh examples
  ruhroh list
  ruhroh list-suites
  ruhroh list --json
  ruhroh list-suites --json
  ruhroh doctor --scenario-dir ./scenarios --adapter ./adapters/my-agent
  ruhroh validate --scenario-dir ./scenarios --json
  ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --json
  ruhroh generate --suite ruhroh-smoke
  ruhroh plan --suite ruhroh-smoke --adapter custom-shell --runs 5
  ruhroh plan --suite ruhroh-smoke --adapter custom-shell --runs 10 --shard 1/4
  ruhroh run --scenario simple-newsletter --adapter custom-shell --dry-run
  ruhroh report ./ruhroh-loop-result.json
  ruhroh report ./run-artifacts --html ruhroh-report.html
  ruhroh validate-artifacts ./run-artifacts --json
  ruhroh compare ./results --html ruhroh-compare.html
  ruhroh review ./results --json
  ruhroh eval-quality ./results --html ruhroh-eval-quality.html --json
  ruhroh calibrate-evaluator --scenario simple-newsletter
  ruhroh publish-check ./results --suite ruhroh-smoke --run-plan .generated/ruhroh/ruhroh-run-plan.json --rerun-ledger ruhroh-rerun-ledger.json --verify-sources
  ruhroh publish-check ./results --suite ruhroh-smoke --run-plan .generated/ruhroh/ruhroh-run-plan.json --bundle ruhroh-publication
  ruhroh validate-bundle ruhroh-publication --json
  ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json
  ruhroh explain run_plan_mismatch
  ruhroh validate-claim ./benchmark-claim.json --require-publishable --verify-sources --json
  ruhroh validate-summary ./benchmark-summary.json --json

Options:
  --list                    Legacy alias for list.
  --list-suites             Legacy alias for list-suites.
  --scenario <id>           Select one scenario.
                            For new-suite, add a suite scenario. May be repeated.
  --suite <id>              Select scenarios from a benchmark suite.
  --tier <tier>             Select scenarios in tier: smoke, nightly, release. Default: smoke.
  --scenario-dir <path>     Scenario root. Default: bundled package scenarios.
  --suite-dir <path>        Suite root. Default: bundled package suites.
  --generated-dir <path>    Generated output root. Default: .generated/ruhroh.
  --iterations <n>          Override implementation iterations.
  --runs <n>                Repeat each selected scenario n times. Default: 1.
  --shard <i>/<n>           Run only shard i of n from the planned sample matrix. Sample ids still use the full --runs count.
  --adapter <id-or-command> Select run-agent adapter by id or command path. May be repeated. Required for run/dry-run/plan.
                            For init, accepts a starter adapter template: generic, codex-cli, claude-code, gemini-cli, aider, or fixture.
  --template <name>         Scaffold template. For init/new-adapter: generic, codex-cli, claude-code, gemini-cli, aider, or fixture. Default: generic.
                            For new-evaluator: review, deterministic, model, or hybrid. Default: review.
  --run-plan <path>         Compare results against a ruhroh-run-plan.json coverage manifest.
  --rerun-ledger <path>     Account for infrastructure exclusions against a run plan with a ruhroh_rerun_ledger_v1 JSON file.
  --benchmark-claim <path>  Write the compact benchmarkClaim JSON export from compare.
  --benchmark-summary <path> Write a row-oriented benchmark summary JSON export from compare.
  --bundle <dir>            Write a publication bundle from publish-check: manifest, claim, summary, compare HTML, review/eval-quality packets, and calibration evidence when present.
  --generate-only           Generate Harbor task directories without running Harbor.
  --harbor-bin <path>       Harbor binary. Default: harbor.
  --dry-run                 Preview Harbor commands without writing task directories, a run plan, Harbor process, or agent calls.
  --allow-dry-run           For first-run, exit 0 when the fixture dry-run path is ready even if Harbor is missing.
  --html <path>             Write a static HTML report for ruhroh inspect-pack, workflow, report, compare, review, eval-quality, or publish-check.
  --summary-md <path>       Write a Markdown publish-check summary, suitable for GitHub Actions step summaries.
  --require-publishable    Return exit code 2 when compare, validate-claim, or claim-index readiness is not publishable.
                            publish-check always applies the publishability gate.
  --require-calibrated      For inspect-pack, fail when scenario calibration coverage has warnings.
  --require-risk-reviewed   For inspect-pack, fail when contamination or reward-hacking risk review has warnings.
  --verify-sources          Re-hash benchmark claim source files during validate-claim or publish-check.
  --json                    Emit machine-readable JSON for validate, inspect-pack, validate-artifacts, validate-claim, validate-summary, validate-bundle, claim-index, plan, report, compare, review, eval-quality, calibrate-evaluator, publish-check, explain, examples, first-run, workflow, doctor, init, new-scenario, new-suite, new-adapter, new-evaluator, list, or list-suites.
`;
}
async function main() {
    const code = await runRuhrohCli(process.argv.slice(2), {
        spawn: spawnSync,
        env: process.env,
        cwd: process.cwd(),
        stdout: process.stdout,
        stderr: process.stderr,
    });
    process.exitCode = code;
}
if (isDirectCliInvocation()) {
    main().catch((error) => {
        process.stderr.write(`ruhroh failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
        process.exitCode = 1;
    });
}
function isDirectCliInvocation() {
    if (process.argv[1] === undefined) {
        return false;
    }
    const modulePath = fileURLToPath(import.meta.url);
    try {
        return realpathSync(process.argv[1]) === realpathSync(modulePath);
    }
    catch {
        return path.resolve(process.argv[1]) === modulePath;
    }
}
//# sourceMappingURL=cli.js.map