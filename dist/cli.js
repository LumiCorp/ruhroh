#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUHROH_ARTIFACTS, RUHROH_HARBOR_AGENT_IMPORT_PATH, buildRuhrohHarborCommands } from "./harbor.js";
import { discoverRuhrohScenarios, generateHarborDataset, loadRuhrohScenario, validateRuhrohScenarioSource, } from "./generate.js";
import { aggregateRuhrohRuns, summarizeRuhrohRun, } from "./results.js";
class HelpRequested extends Error {
}
export function parseRuhrohCliArgs(argv, cwd = process.cwd()) {
    const options = {
        command: "run",
        list: false,
        dryRun: false,
        generateOnly: false,
        json: false,
        harborBin: "harbor",
        scenarioDir: path.join(resolveRuhrohPackageRoot(), "scenarios"),
        generatedDir: path.resolve(cwd, ".generated", "ruhroh"),
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined || arg === "--") {
            continue;
        }
        if (index === 0 && (arg === "run" || arg === "generate" || arg === "validate" || arg === "report" || arg === "compare")) {
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
        if (arg === "--dry-run") {
            options.dryRun = true;
            continue;
        }
        if (arg === "--json") {
            options.json = true;
            continue;
        }
        if (arg === "--generate-only") {
            options.generateOnly = true;
            continue;
        }
        if (arg === "--scenario") {
            options.scenarioId = assertSafeScenarioId(readValue(argv, index, arg));
            options.tier = undefined;
            index += 1;
            continue;
        }
        if (arg === "--tier") {
            options.tier = parseTier(readValue(argv, index, arg));
            options.scenarioId = undefined;
            index += 1;
            continue;
        }
        if (arg === "--scenario-dir") {
            options.scenarioDir = path.resolve(cwd, readValue(argv, index, arg));
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
        if (arg === "--adapter") {
            options.adapter = readValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (arg === "--harbor-bin") {
            options.harborBin = readValue(argv, index, arg);
            index += 1;
            continue;
        }
        if (!arg.startsWith("-") && (options.command === "report" || options.command === "compare")) {
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
    if (options.command === "validate") {
        return runValidateCommand(options, deps);
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
    let adapter;
    try {
        adapter = resolveAdapterSelection(options, deps.cwd, deps.env);
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
    const commands = buildCommands(selected.map((item) => item.scenario), options, datasetPath, adapter);
    deps.stdout.write(`[ruhroh] selected=${commands.map((command) => command.scenarioId).join(",")}\n`);
    for (const command of commands) {
        deps.stdout.write(`[ruhroh] harbor: ${formatCommand(options.harborBin, command.args)}\n`);
    }
    if (options.dryRun) {
        deps.stdout.write("[ruhroh] dry run complete. No Harbor tasks were started.\n");
        return 0;
    }
    let failed = false;
    const harborEnv = buildHarborSpawnEnv(adapter.env);
    for (const command of commands) {
        const result = deps.spawn(options.harborBin, command.args, {
            cwd: deps.cwd,
            env: harborEnv,
            stdio: "inherit",
        });
        if (result.status !== 0 || result.error !== undefined) {
            deps.stderr.write(`[ruhroh] Harbor command failed for ${command.scenarioId}.\n${formatSpawnFailure(result)}`);
            failed = true;
        }
    }
    return failed ? 1 : 0;
}
function runValidateCommand(options, deps) {
    const sources = discoverRuhrohScenarios(options.scenarioDir);
    if (sources.length === 0) {
        deps.stderr.write(`ruhroh failed: No Ruhroh scenarios found in ${options.scenarioDir}\n`);
        return 1;
    }
    const results = sources
        .map((source) => validateRuhrohScenarioSource(source))
        .filter((result) => scenarioValidationMatchesSelection(result, options));
    if (results.length === 0) {
        deps.stderr.write(`ruhroh failed: No Ruhroh scenarios matched the requested selection.\n`);
        return 1;
    }
    if (options.json) {
        deps.stdout.write(`${JSON.stringify({ version: "ruhroh_validation_report_v1", results }, null, 2)}\n`);
    }
    else {
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
    return results.some((result) => result.errors.length > 0) ? 1 : 0;
}
function runReportCommand(options, deps) {
    if (options.inputPath === undefined) {
        deps.stderr.write("ruhroh failed: report requires a result JSON file or run directory.\n");
        return 1;
    }
    try {
        const run = readRunResult(options.inputPath);
        const summary = summarizeRuhrohRun(run);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_report_v1", summary }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatRunReport(summary));
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
        const runs = readRunResults(options.inputPath);
        if (runs.length === 0) {
            throw new Error(`No ruhroh_loop_result_v1 JSON files found in ${options.inputPath}`);
        }
        const groups = aggregateRuhrohRuns(runs);
        if (options.json) {
            deps.stdout.write(`${JSON.stringify({ version: "ruhroh_compare_v1", groups }, null, 2)}\n`);
        }
        else {
            deps.stdout.write(formatCompareReport(groups));
        }
        return 0;
    }
    catch (error) {
        deps.stderr.write(`ruhroh failed: ${error instanceof Error ? error.message : String(error)}\n`);
        return 1;
    }
}
function selectScenarios(loaded, options) {
    if (options.scenarioId !== undefined) {
        const scenario = loaded.find((item) => item.scenario.id === options.scenarioId);
        if (scenario === undefined) {
            throw new Error(`Unknown Ruhroh scenario: ${options.scenarioId}`);
        }
        return [scenario];
    }
    return loaded.filter((item) => item.scenario.tier === (options.tier ?? "smoke"));
}
function buildCommands(scenarios, options, datasetPath, adapter) {
    return buildRuhrohHarborCommands({
        scenarios,
        adapter: adapter.adapterId,
        datasetPath,
        iterations: options.iterations,
        env: adapter.env,
        agentImportPath: RUHROH_HARBOR_AGENT_IMPORT_PATH,
        artifacts: RUHROH_ARTIFACTS,
    });
}
function resolveAdapterSelection(options, cwd, env) {
    const adapter = options.adapter?.trim();
    if (adapter === undefined || adapter.length === 0) {
        throw new Error("--adapter is required for ruhroh run and dry-run commands");
    }
    if (looksLikeAdapterCommand(adapter)) {
        const command = adapter.includes(" ")
            ? adapter
            : path.resolve(cwd, adapter);
        const adapterId = adapterIdFromCommand(command);
        return {
            adapterId,
            env: {
                ...env,
                RUHROH_RUN_AGENT_COMMAND: command,
            },
        };
    }
    return { adapterId: adapter, env };
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
function scenarioValidationMatchesSelection(result, options) {
    if (options.scenarioId !== undefined) {
        return result.scenario?.id === options.scenarioId || path.basename(result.source.scenarioDir) === options.scenarioId;
    }
    if (options.tier !== undefined) {
        return result.scenario?.tier === options.tier || result.scenario === undefined;
    }
    return true;
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
    const resolved = path.resolve(inputPath);
    if (!existsSync(resolved)) {
        throw new Error(`Path does not exist: ${resolved}`);
    }
    if (!statSync(resolved).isDirectory()) {
        return [readRunResult(resolved)];
    }
    return walkJsonFiles(resolved).flatMap((filePath) => {
        try {
            const parsed = readJsonObject(filePath);
            return isRuhrohLoopResult(parsed) ? [parsed] : [];
        }
        catch {
            return [];
        }
    });
}
function readJsonObject(filePath) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isRecord(parsed)) {
        throw new Error(`Expected JSON object in ${filePath}`);
    }
    return parsed;
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
function formatRunReport(summary) {
    const lines = [
        `Ruhroh report: ${summary.scenarioId}`,
        `adapter: ${summary.adapter}`,
        `status: ${summary.status} eval=${summary.evalStatus} score=${summary.score}`,
        `failureBucket: ${summary.failureBucket}`,
        `iterations: ${summary.iterationsUsed}`,
        `duration: ${summary.durationMs}ms`,
        `summary: ${summary.finalSummary}`,
    ];
    if (Object.keys(summary.subscores).length > 0) {
        lines.push("", "Subscores:");
        for (const [dimension, score] of Object.entries(summary.subscores)) {
            lines.push(`  ${dimension}: ${formatNumber(score ?? 0)}`);
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
    if (summary.unmetCriteria.length > 0) {
        lines.push("", "Unmet criteria:");
        for (const item of summary.unmetCriteria) {
            lines.push(`  - ${item}`);
        }
    }
    if (summary.commandsRun.length > 0) {
        lines.push("", "Commands run:");
        for (const command of summary.commandsRun) {
            lines.push(`  ${command.command} -> ${command.exitCode}: ${command.summary}`);
        }
    }
    if (Object.keys(summary.artifactPaths).length > 0) {
        lines.push("", "Artifacts:");
        for (const [name, artifactPath] of Object.entries(summary.artifactPaths)) {
            if (artifactPath.trim().length > 0) {
                lines.push(`  ${name}: ${artifactPath}`);
            }
        }
    }
    return `${lines.join("\n")}\n`;
}
function formatCompareReport(groups) {
    const lines = ["Ruhroh compare"];
    for (const group of groups) {
        lines.push("", `${group.scenarioId} / ${group.adapter}`, `  runs: ${group.runs}`, `  passRate: ${formatPercent(group.passRate)} (${group.passes}/${group.runs})`, `  meanScore: ${formatNumber(group.meanScore)}`, `  medianDuration: ${group.medianDurationMs}ms`, `  iterations: ${formatCounts(group.iterationDistribution)}`, `  failureBuckets: ${formatCounts(group.failureBuckets)}`);
        if (Object.keys(group.meanSubscores).length > 0) {
            lines.push(`  meanSubscores: ${Object.entries(group.meanSubscores).map(([key, value]) => `${key}=${formatNumber(value ?? 0)}`).join(", ")}`);
        }
    }
    return `${lines.join("\n")}\n`;
}
function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "");
}
function formatPercent(value) {
    return `${Math.round(value * 1000) / 10}%`;
}
function formatCounts(counts) {
    const entries = Object.entries(counts);
    if (entries.length === 0) {
        return "none";
    }
    return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function helpText() {
    return `Usage: ruhroh [run|generate|validate|report|compare] [options]\n\nCommon commands:\n  ruhroh --list\n  ruhroh validate --scenario-dir ./scenarios --json\n  ruhroh --scenario simple-newsletter --generate-only\n  ruhroh --scenario simple-newsletter --dry-run\n  ruhroh report ./ruhroh-loop-result.json\n  ruhroh compare ./results --json\n\nOptions:\n  --list                    List JSON scenarios.\n  --scenario <id>           Select one scenario.\n  --tier <tier>             Select scenarios in tier: smoke, nightly, release. Default: smoke.\n  --scenario-dir <path>     Scenario root. Default: bundled package scenarios.\n  --generated-dir <path>    Generated output root. Default: .generated/ruhroh.\n  --iterations <n>          Override implementation iterations.\n  --adapter <id-or-command> Select run-agent adapter by id or command path. Required for run/dry-run.\n  --generate-only           Generate Harbor task directories without running Harbor.\n  --harbor-bin <path>       Harbor binary. Default: harbor.\n  --dry-run                 Print Harbor commands without writing tasks or running Harbor.\n  --json                    Emit machine-readable JSON for validate, report, or compare.\n`;
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