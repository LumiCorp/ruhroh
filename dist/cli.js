#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RUHROH_ARTIFACTS, RUHROH_HARBOR_AGENT_IMPORT_PATH, buildRuhrohHarborCommands } from "./harbor.js";
import { discoverRuhrohScenarios, generateHarborDataset, loadRuhrohScenario } from "./generate.js";
class HelpRequested extends Error {
}
export function parseRuhrohCliArgs(argv, cwd = process.cwd()) {
    const options = {
        command: "run",
        list: false,
        dryRun: false,
        generateOnly: false,
        harborBin: "harbor",
        scenarioDir: path.join(resolveRuhrohPackageRoot(), "scenarios"),
        generatedDir: path.resolve(cwd, ".generated", "ruhroh"),
        tier: "smoke",
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined || arg === "--") {
            continue;
        }
        if (index === 0 && (arg === "run" || arg === "generate")) {
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
function helpText() {
    return `Usage: ruhroh [run|generate] [options]\n\nCommon commands:\n  ruhroh --list\n  ruhroh --scenario simple-newsletter --generate-only\n  ruhroh --scenario simple-newsletter --dry-run\n  ruhroh generate --tier smoke\n\nOptions:\n  --list                    List JSON scenarios.\n  --scenario <id>           Select one scenario.\n  --tier <tier>             Select scenarios in tier: smoke, nightly, release. Default: smoke.\n  --scenario-dir <path>     Scenario root. Default: bundled package scenarios.\n  --generated-dir <path>    Generated output root. Default: .generated/ruhroh.\n  --iterations <n>          Override implementation iterations.\n  --adapter <id-or-command> Select run-agent adapter by id or command path. Required for run/dry-run.\n  --generate-only           Generate Harbor task directories without running Harbor.\n  --harbor-bin <path>       Harbor binary. Default: harbor.\n  --dry-run                 Print Harbor commands without writing tasks or running Harbor.\n`;
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