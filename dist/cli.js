#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUHROH_ARTIFACTS, RUHROH_HARBOR_AGENT_IMPORT_PATH, buildRuhrohHarborCommand } from "./harbor.js";
import { discoverRuhrohScenarios, generateHarborDataset, loadRuhrohScenario, validateRuhrohScenarioSource, } from "./generate.js";
import { aggregateRuhrohRuns, summarizeRuhrohBenchmarkClaim, summarizeRuhrohBenchmarkSummary, summarizeRuhrohBenchmarkClaimReadiness, summarizeRuhrohPairwiseAdapterComparisons, summarizeRuhrohReviewQueue, summarizeRuhrohRun, summarizeRuhrohSuiteAdapters, validateRuhrohBenchmarkClaim, validateRuhrohBenchmarkSummary, } from "./results.js";
import { discoverRuhrohSuites, loadRuhrohSuite, validateRuhrohSuiteSource, } from "./suites.js";
import { RUHROH_AGENT_ENV_KEYS } from "./env.js";
const RUN_PLAN_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/run-plan-v1.schema.json";
const LOOP_RESULT_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/loop-result-v1.schema.json";
const RUN_MANIFEST_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/run-manifest-v1.schema.json";
const EVAL_RESULT_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/eval-result-v1.schema.json";
const WORKSPACE_SUMMARY_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/workspace-summary-v1.schema.json";
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
        requirePublishable: false,
        verifySources: false,
        harborBin: "harbor",
        scenarioDir: path.join(resolveRuhrohPackageRoot(), "scenarios"),
        scenarioDirExplicit: false,
        suiteDir: path.join(resolveRuhrohPackageRoot(), "suites"),
        suiteDirExplicit: false,
        generatedDir: path.resolve(cwd, ".generated", "ruhroh"),
        runs: 1,
        adapters: [],
        suiteScenarioIds: [],
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined || arg === "--") {
            continue;
        }
        if (index === 0
            && (arg === "run" || arg === "generate" || arg === "validate" || arg === "validate-artifacts" || arg === "validate-claim" || arg === "validate-summary" || arg === "report" || arg === "compare" || arg === "doctor" || arg === "init" || arg === "new-scenario" || arg === "new-suite" || arg === "new-adapter")) {
            options.command = arg;
            if (arg === "generate") {
                options.generateOnly = true;
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
        if (arg === "--require-publishable") {
            options.requirePublishable = true;
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
        if (arg === "--run-plan") {
            options.runPlanPath = path.resolve(cwd, readValue(argv, index, arg));
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
        if (!arg.startsWith("-") && (options.command === "report" || options.command === "compare" || options.command === "init" || options.command === "validate-artifacts" || options.command === "validate-claim" || options.command === "validate-summary")) {
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
    if (options.command === "doctor") {
        return runDoctorCommand(options, deps);
    }
    if (options.command === "validate") {
        return runValidateCommand(options, deps);
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
        for (const { scenario } of loaded) {
            deps.stdout.write(`${scenario.id}\t${scenario.tier}\t${scenario.title}\n`);
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
    const commands = buildCommands(selected.map((item) => item.scenario), options, datasetPath, adapters);
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
        deps.stdout.write(`[ruhroh] harbor: ${formatCommand(options.harborBin, command.args)}\n`);
    }
    if (options.dryRun) {
        deps.stdout.write("[ruhroh] dry run complete. No Harbor tasks were started.\n");
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
        const sourceVerification = options.verifySources ? verifyBenchmarkClaimSources(claim, options.inputPath) : undefined;
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
function verifyBenchmarkClaimSources(claim, claimPath) {
    const checks = [];
    const source = isRecord(claim.source) ? claim.source : undefined;
    if (source === undefined) {
        return {
            version: "ruhroh_claim_source_verification_v1",
            checked: false,
            checks,
            errors: ["claim source is missing"],
            warnings: [],
        };
    }
    verifyOptionalHashedSourceFile(checks, "suite", source.suitePath, source.suiteSha256, "source.suitePath", "source.suiteSha256");
    verifyOptionalHashedSourceFile(checks, "runPlan", source.runPlanPath, source.runPlanSha256, "source.runPlanPath", "source.runPlanSha256");
    const resultArtifacts = source.resultArtifacts;
    if (!Array.isArray(resultArtifacts) || resultArtifacts.length === 0) {
        checks.push({
            name: "resultArtifacts",
            status: "warning",
            details: "source.resultArtifacts is empty or missing",
        });
    }
    else {
        for (const [index, artifact] of resultArtifacts.entries()) {
            if (!isRecord(artifact)) {
                checks.push({
                    name: `resultArtifacts[${index}]`,
                    status: "failed",
                    details: `source.resultArtifacts[${index}] must be an object`,
                });
                continue;
            }
            verifyRequiredHashedSourceFile(checks, `resultArtifacts[${index}]`, artifact.path, artifact.sha256, `source.resultArtifacts[${index}].path`, `source.resultArtifacts[${index}].sha256`);
            const inventory = artifact.artifactInventory;
            if (inventory !== undefined) {
                if (!Array.isArray(inventory)) {
                    checks.push({
                        name: `resultArtifacts[${index}].artifactInventory`,
                        status: "failed",
                        details: `source.resultArtifacts[${index}].artifactInventory must be an array`,
                    });
                }
                else {
                    for (const [inventoryIndex, inventoryItem] of inventory.entries()) {
                        verifyBenchmarkClaimInventoryItem(checks, inventoryItem, index, inventoryIndex);
                    }
                }
            }
        }
    }
    if (typeof source.benchmarkClaimPath === "string" && path.resolve(source.benchmarkClaimPath) !== path.resolve(claimPath)) {
        checks.push({
            name: "benchmarkClaimPath",
            status: "warning",
            path: source.benchmarkClaimPath,
            details: "source.benchmarkClaimPath does not match the validated claim path",
        });
    }
    return {
        version: "ruhroh_claim_source_verification_v1",
        checked: true,
        checks,
        errors: checks.filter((check) => check.status === "failed").map(formatClaimSourceVerificationCheck),
        warnings: checks.filter((check) => check.status === "warning").map(formatClaimSourceVerificationCheck),
    };
}
function verifyBenchmarkClaimInventoryItem(checks, inventoryItem, artifactIndex, inventoryIndex) {
    const name = `resultArtifacts[${artifactIndex}].artifactInventory[${inventoryIndex}]`;
    if (!isRecord(inventoryItem)) {
        checks.push({
            name,
            status: "failed",
            details: `source.${name} must be an object`,
        });
        return;
    }
    if (inventoryItem.available !== true) {
        return;
    }
    verifyRequiredHashedSourceFile(checks, name, inventoryItem.path, inventoryItem.sha256, `source.${name}.path`, `source.${name}.sha256`);
    if (typeof inventoryItem.sizeBytes === "number" && typeof inventoryItem.path === "string" && existsSync(inventoryItem.path)) {
        try {
            const actualSize = statSync(inventoryItem.path).size;
            if (actualSize !== inventoryItem.sizeBytes) {
                checks.push({
                    name,
                    status: "failed",
                    path: inventoryItem.path,
                    details: `${name} size mismatch: expected ${inventoryItem.sizeBytes}, found ${actualSize}`,
                });
            }
        }
        catch (error) {
            checks.push({
                name,
                status: "failed",
                path: inventoryItem.path,
                details: `${name} size check failed: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }
}
function verifyOptionalHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel) {
    if (filePath === undefined && expectedSha256 === undefined) {
        return;
    }
    verifyRequiredHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel);
}
function verifyRequiredHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel) {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
        checks.push({
            name,
            status: "failed",
            details: `${pathLabel} must be a non-empty string`,
        });
        return;
    }
    if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha256)) {
        checks.push({
            name,
            status: "failed",
            path: filePath,
            details: `${hashLabel} must be a lowercase SHA-256 digest`,
        });
        return;
    }
    if (!existsSync(filePath)) {
        checks.push({
            name,
            status: "failed",
            path: filePath,
            expectedSha256,
            details: `${pathLabel} does not exist`,
        });
        return;
    }
    try {
        const actualSha256 = sha256File(filePath);
        checks.push({
            name,
            status: actualSha256 === expectedSha256 ? "ok" : "failed",
            path: filePath,
            expectedSha256,
            actualSha256,
            details: actualSha256 === expectedSha256
                ? `${pathLabel} hash matches`
                : `${pathLabel} hash mismatch`,
        });
    }
    catch (error) {
        checks.push({
            name,
            status: "failed",
            path: filePath,
            expectedSha256,
            details: `${pathLabel} could not be hashed: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}
function formatClaimSourceVerificationCheck(check) {
    const pathLabel = check.path === undefined ? "" : ` (${check.path})`;
    const hashLabel = check.expectedSha256 === undefined
        ? ""
        : ` expected=${check.expectedSha256}${check.actualSha256 === undefined ? "" : ` actual=${check.actualSha256}`}`;
    return `${check.name}: ${check.details}${pathLabel}${hashLabel}`;
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
        const files = scaffoldRuhrohProject(rootDir);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_init_v1", rootDir, files }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh starter initialized at ${path.relative(deps.cwd, rootDir) || "."}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            deps.stdout.write("  export RUHROH_RUN_AGENT_COMMAND=\"$PWD/ruhroh/adapters/fixture-newsletter/run.sh\"\n");
            deps.stdout.write("  export RUHROH_EVAL_COMMAND=\"$PWD/ruhroh/evaluators/fixture-newsletter/run.sh\"\n");
            deps.stdout.write("  pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell\n");
            deps.stdout.write("  pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke\n");
            deps.stdout.write("  pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run\n");
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
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_scenario_v1", scenarioDir: path.join(scenarioRoot, options.scenarioId), files }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh scenario scaffolded at ${path.relative(deps.cwd, path.join(scenarioRoot, options.scenarioId)) || "."}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            deps.stdout.write(`  pnpm exec ruhroh validate --scenario-dir ${path.relative(deps.cwd, scenarioRoot) || "."} --scenario ${options.scenarioId}\n`);
            deps.stdout.write(`  pnpm exec ruhroh --scenario-dir ${path.relative(deps.cwd, scenarioRoot) || "."} --scenario ${options.scenarioId} --generate-only\n`);
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
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
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_suite_v1", suiteDir: path.join(suiteRoot, options.suiteId), files }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh suite scaffolded at ${path.relative(deps.cwd, path.join(suiteRoot, options.suiteId)) || "."}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            deps.stdout.write(`  pnpm exec ruhroh validate --scenario-dir ${path.relative(deps.cwd, options.scenarioDir) || "."} --suite-dir ${path.relative(deps.cwd, suiteRoot) || "."} --suite ${options.suiteId}\n`);
            deps.stdout.write(`  pnpm exec ruhroh --scenario-dir ${path.relative(deps.cwd, options.scenarioDir) || "."} --suite-dir ${path.relative(deps.cwd, suiteRoot) || "."} --suite ${options.suiteId} --generate-only\n`);
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
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
        });
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_new_adapter_v1", adapterDir: path.join(adapterRoot, options.adapter), files }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(`Ruhroh adapter scaffolded at ${path.relative(deps.cwd, path.join(adapterRoot, options.adapter)) || "."}\n`);
            for (const file of files) {
                deps.stdout.write(`  ${file.status}: ${path.relative(deps.cwd, file.path)}\n`);
            }
            deps.stdout.write("\nNext commands:\n");
            deps.stdout.write(`  $EDITOR ${path.relative(deps.cwd, path.join(adapterRoot, options.adapter, "run.sh"))}\n`);
            deps.stdout.write(`  pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/${options.adapter}/run.sh\n`);
            deps.stdout.write(`  pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario <scenario-id> --adapter ./ruhroh/adapters/${options.adapter}/run.sh --dry-run\n`);
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
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
function runCompareCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: compare requires a directory containing Ruhroh result artifacts.\n");
        return 1;
    }
    try {
        const compareSuite = options.suiteId === undefined ? undefined : resolveCompareSuite(options);
        const compareRunPlan = options.runPlanPath === undefined ? undefined : loadRunPlanManifest(options.runPlanPath);
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
        const runPlanWarnings = compareRunPlan === undefined
            ? []
            : [
                ...runPlanCoverageWarnings(compareRunPlan, runSummaries, compareSuite?.suite.scenarioIds),
                ...runPlanSuiteWarnings(compareRunPlan, compareSuite),
            ];
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
function runPlanCoverageWarnings(runPlan, summaries, scenarioFilter) {
    const scenarioIds = scenarioFilter === undefined ? undefined : new Set(scenarioFilter);
    const expectedSamples = scenarioIds === undefined
        ? runPlan.samples
        : runPlan.samples.filter((sample) => scenarioIds.has(sample.scenarioId));
    const plannedSamplesById = new Map(expectedSamples.map((sample) => [sample.sampleId, sample]));
    const plannedSampleIds = new Set(plannedSamplesById.keys());
    const presentSampleIds = new Set(summaries.flatMap((summary) => summary.sample?.id === undefined ? [] : [summary.sample.id]));
    const warnings = expectedSamples.flatMap((sample) => presentSampleIds.has(sample.sampleId)
        ? []
        : [`run plan sample has no result artifact: ${sample.sampleId} (${sample.scenarioId}/${sample.adapter})`]);
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
    return uniquePreserveOrder(warnings);
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
function scaffoldRuhrohProject(rootDir) {
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
        filePath: path.join(projectRoot, "schemas", "eval-result-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "eval-result-v1.schema.json"), "utf8"),
    }));
    files.push(writeScaffoldFile({
        filePath: path.join(projectRoot, "schemas", "loop-result-v1.schema.json"),
        content: readFileSync(path.join(packageRoot, "schemas", "loop-result-v1.schema.json"), "utf8"),
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
                calibrationCases: [{
                        id: "incomplete-prose-only",
                        inputSummary: "The agent describes a possible implementation but does not modify the workspace into a usable result.",
                        expectedStatus: "failed",
                        rationale: "Ruhroh scenarios evaluate delivered outcomes, not prose-only plans.",
                    }],
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
            content: adapterRunScript(input.id),
            mode: 0o755,
        }),
        writeScaffoldFile({
            filePath: path.join(adapterDir, "README.md"),
            content: adapterReadme(input.id),
        }),
    ];
}
function adapterRunScript(adapterId) {
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
function adapterReadme(adapterId) {
    return `# ${titleFromScenarioId(adapterId)} Adapter

This directory contains a local Ruhroh custom-shell adapter scaffold.

- \`run.sh\` receives the Ruhroh command-adapter environment.
- The wrapper writes each prompt and transcript under \`$RUHROH_WORKSPACE/.ruhroh/\`.
- The wrapper writes \`ruhroh_run_agent_result_v1\` metadata to \`$RUHROH_RESULT_PATH\`.
- The default script fails fast until you replace the placeholder block with a
  real agent invocation.

Typical check:

\`\`\`bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/${adapterId}/run.sh
pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario <scenario-id> --adapter ./ruhroh/adapters/${adapterId}/run.sh --dry-run
\`\`\`

Before publishing comparisons, make sure the wrapper reports stable
\`adapterVersion\`, \`model.provider\`, \`model.model\`, and
\`model.promptVersion\` values. Ruhroh copies those fields into
\`ruhroh-run-manifest.json\` for cohort comparison and claim readiness.
`;
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
manifests, run manifests, exported benchmark claims, and workspace summary
artifacts. Use them from your editor, CI, or publication pipeline as structural
checks; \`ruhroh validate\` and \`claimReadiness\` remain the authoritative
benchmark-governance gates.

## Smoke Check

\`\`\`bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"

pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
\`\`\`

When Harbor is installed, remove \`--dry-run\` to execute the fixture-backed run.
Replace the fixture adapter with your own command wrapper when benchmarking a
real coding agent. Use \`--suite-dir ruhroh/suites --suite ruhroh-smoke\` when
collecting repeated samples for a publishable suite comparison.
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
        "python/ruhroh/harbor_agent.py",
        "python/ruhroh/loop_controller.py",
        "scenarios/simple-newsletter/scenario.json",
        "suites/ruhroh-smoke/suite.json",
        "schemas/scenario-v2.schema.json",
        "schemas/suite-v1.schema.json",
        "schemas/benchmark-claim-v1.schema.json",
        "schemas/benchmark-summary-v1.schema.json",
        "schemas/eval-result-v1.schema.json",
        "schemas/loop-result-v1.schema.json",
        "schemas/run-manifest-v1.schema.json",
        "schemas/run-plan-v1.schema.json",
        "schemas/workspace-summary-v1.schema.json",
        "examples/adapters/fixture-newsletter/run.sh",
        "examples/evaluators/fixture-newsletter/run.sh",
        "docs/getting-started.md",
        "docs/benchmark-methodology.md",
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
        details: "installed package includes CLI, Python runtime, schemas, bundled scenarios, suites, fixture adapter/evaluator, and docs",
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
function buildCommands(scenarios, options, datasetPath, adapters) {
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
                const env = {
                    ...adapter.env,
                    ...sampleEnv,
                    RUHROH_RUN_SEED: adapter.env.RUHROH_RUN_SEED ?? sampleEnv.RUHROH_SAMPLE_SEED,
                };
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
                args: command.args,
                display: formatCommand(input.harborBin, command.args),
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
function formatCommandLabel(input) {
    const scenarioLabel = input.runCount === 1
        ? input.scenarioId
        : `${input.scenarioId}#${input.runIndex}/${input.runCount}`;
    return input.includeAdapter ? `${input.adapterLabel}:${scenarioLabel}` : scenarioLabel;
}
function resolveAdapterSelections(options, cwd, env) {
    const adapters = options.adapters.length > 0 ? options.adapters : options.adapter === undefined ? [] : [options.adapter];
    if (adapters.length === 0) {
        throw new Error("--adapter is required for ruhroh run and dry-run commands");
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
function parsePositiveInteger(value, arg) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`${arg} must be a positive integer`);
    }
    return parsed;
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
    return walkJsonFiles(resolved).flatMap((filePath) => {
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
    if (htmlPath === undefined) {
        return escapeHtml(targetPath);
    }
    const hrefPath = path.isAbsolute(targetPath)
        ? path.relative(path.dirname(htmlPath), targetPath)
        : targetPath;
    const normalizedHref = hrefPath.split(path.sep).join("/");
    const displayHref = normalizedHref.startsWith(".") ? normalizedHref : `./${normalizedHref}`;
    const href = displayHref.split("/").map((part) => encodeURIComponent(part)).join("/");
    return `<a href="${escapeHtml(href)}">${escapeHtml(targetPath)}</a>`;
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
      .pass { color: var(--ok); font-weight: 700; }
      .fail { color: var(--bad); font-weight: 700; }
      .muted { color: var(--muted); }
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
    return `Usage: ruhroh [run|generate|validate|validate-artifacts|validate-claim|validate-summary|report|compare|doctor|init|new-scenario|new-suite|new-adapter] [options]

Common commands:
  ruhroh init [dir]
  ruhroh new-scenario my-task --scenario-dir ruhroh/scenarios
  ruhroh new-suite local-smoke --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario my-task
  ruhroh new-adapter local-agent
  ruhroh --list
  ruhroh --list-suites
  ruhroh doctor --scenario-dir ./scenarios --adapter ./adapters/my-agent
  ruhroh validate --scenario-dir ./scenarios --json
  ruhroh --suite ruhroh-smoke --generate-only
  ruhroh --scenario simple-newsletter --dry-run
  ruhroh report ./ruhroh-loop-result.json
  ruhroh report ./run-artifacts --html ruhroh-report.html
  ruhroh validate-artifacts ./run-artifacts --json
  ruhroh compare ./results --html ruhroh-compare.html
  ruhroh validate-claim ./benchmark-claim.json --require-publishable --verify-sources --json
  ruhroh validate-summary ./benchmark-summary.json --json

Options:
  --list                    List JSON scenarios.
  --list-suites             List benchmark suite manifests.
  --scenario <id>           Select one scenario.
                            For new-suite, add a suite scenario. May be repeated.
  --suite <id>              Select scenarios from a benchmark suite.
  --tier <tier>             Select scenarios in tier: smoke, nightly, release. Default: smoke.
  --scenario-dir <path>     Scenario root. Default: bundled package scenarios.
  --suite-dir <path>        Suite root. Default: bundled package suites.
  --generated-dir <path>    Generated output root. Default: .generated/ruhroh.
  --iterations <n>          Override implementation iterations.
  --runs <n>                Repeat each selected scenario n times. Default: 1.
  --adapter <id-or-command> Select run-agent adapter by id or command path. May be repeated. Required for run/dry-run.
  --run-plan <path>         Compare results against a ruhroh-run-plan.json coverage manifest.
  --benchmark-claim <path>  Write the compact benchmarkClaim JSON export from compare.
  --benchmark-summary <path> Write a row-oriented benchmark summary JSON export from compare.
  --generate-only           Generate Harbor task directories without running Harbor.
  --harbor-bin <path>       Harbor binary. Default: harbor.
  --dry-run                 Print Harbor commands without writing tasks or running Harbor.
  --html <path>             Write a static HTML report for ruhroh report or compare.
  --require-publishable    Return exit code 2 when compare or validate-claim readiness is not publishable.
  --verify-sources          Re-hash benchmark claim source files during validate-claim.
  --json                    Emit machine-readable JSON for validate, validate-artifacts, validate-claim, validate-summary, report, compare, doctor, init, new-scenario, new-suite, new-adapter, or list-suites.
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