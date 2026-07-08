import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { RUHROH_ARTIFACTS, RUHROH_HARBOR_AGENT_IMPORT_PATH } from "./harbor.js";
import { lintRuhrohScenarioEvaluationDetailed, summarizeRuhrohScenarioCalibration, validateRuhrohScenario, } from "./scenarios.js";
export function discoverRuhrohScenarios(scenarioRoot) {
    const root = path.resolve(scenarioRoot);
    if (!existsSync(root)) {
        return [];
    }
    const directScenarioPath = path.join(root, "scenario.json");
    if (existsSync(directScenarioPath)) {
        return [scenarioSourceFromDir(root)];
    }
    return readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => scenarioSourceFromDir(path.join(root, entry.name)))
        .filter((source) => existsSync(source.scenarioPath))
        .sort((left, right) => left.scenarioDir.localeCompare(right.scenarioDir));
}
export function loadRuhrohScenario(input) {
    const source = typeof input === "string" ? scenarioSourceFromDir(path.resolve(input)) : input;
    const raw = readJsonRecord(source.scenarioPath);
    const userPrompt = readUserPrompt(raw, source);
    const scenario = {
        ...raw,
        version: raw.version,
        userPrompt,
        run: readRunDefaults(raw),
    };
    const errors = validateRuhrohScenario(scenario);
    if (errors.length > 0) {
        throw new Error(`Invalid Ruhroh scenario ${source.scenarioPath}: ${errors.join("; ")}`);
    }
    return { scenario, source };
}
export function validateRuhrohScenarioSource(input) {
    const source = typeof input === "string" ? scenarioSourceFromDir(path.resolve(input)) : input;
    const errors = [];
    const warnings = [];
    const warningDetails = [];
    if (!existsSync(source.scenarioPath)) {
        return { source, errors: [`missing scenario.json at ${source.scenarioPath}`], warnings, warningDetails };
    }
    let raw;
    try {
        raw = readJsonRecord(source.scenarioPath);
    }
    catch (error) {
        return {
            source,
            errors: [`invalid scenario.json: ${error instanceof Error ? error.message : String(error)}`],
            warnings,
            warningDetails,
        };
    }
    let userPrompt = "";
    try {
        userPrompt = readUserPrompt(raw, source);
    }
    catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
    }
    const scenario = {
        ...raw,
        version: raw.version,
        userPrompt,
        run: readRunDefaults(raw),
    };
    const calibration = summarizeRuhrohScenarioCalibration(scenario);
    try {
        errors.push(...validateRuhrohScenario(scenario));
    }
    catch (error) {
        errors.push(`scenario shape is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
    warningDetails.push(...lintRuhrohScenarioEvaluationDetailed(scenario));
    warnings.push(...warningDetails.map((diagnostic) => diagnostic.message));
    warnings.push(...scenarioGovernanceWarnings(scenario));
    errors.push(...validateDeclaredAssets(raw.assets, source));
    errors.push(...validateDeclaredAssetPaths(readEvaluationPrivateAssets(raw.evaluation), source, "evaluation.privateAssets"));
    errors.push(...validatePrivateAssetExposure(raw.assets, readEvaluationPrivateAssets(raw.evaluation), source));
    if (scenario.requires?.network === true) {
        warnings.push("requires.network=true will generate Harbor tasks with public network access");
    }
    return {
        source,
        ...(errors.length === 0 ? { scenario } : {}),
        errors,
        warnings,
        warningDetails,
        calibration,
    };
}
function scenarioGovernanceWarnings(scenario) {
    const warnings = [];
    const scenarioVersion = scenario.metadata?.scenarioVersion;
    const changelog = scenario.metadata?.changelog;
    if (typeof scenarioVersion === "string"
        && scenarioVersion.trim().length > 0
        && Array.isArray(changelog)
        && changelog.length > 0
        && !changelog.some((entry) => typeof entry === "string" && entry.includes(scenarioVersion))) {
        warnings.push(`metadata.changelog should mention current scenarioVersion ${scenarioVersion}`);
    }
    return warnings;
}
export function generateHarborDataset(input) {
    const tasks = input.scenarios.map((loaded) => generateHarborTask({
        scenario: loaded.scenario,
        scenarioDir: loaded.source.scenarioDir,
        outputRoot: input.outputRoot,
        agentImportPath: input.agentImportPath,
        artifacts: input.artifacts,
    }));
    return {
        datasetPath: path.join(path.resolve(input.outputRoot), "harbor"),
        tasks,
    };
}
export function generateHarborTask(input) {
    const outputRoot = path.resolve(input.outputRoot);
    const taskDir = path.join(outputRoot, "harbor", "tasks", input.scenario.id);
    const filesWritten = [];
    const writeText = (relativePath, content, mode) => {
        const filePath = path.join(taskDir, relativePath);
        mkdirSync(path.dirname(filePath), { recursive: true });
        writeFileSync(filePath, content, { encoding: "utf8", mode });
        filesWritten.push(filePath);
    };
    mkdirSync(taskDir, { recursive: true });
    mkdirSync(path.join(taskDir, "assets"), { recursive: true });
    writeText("instruction.md", `${input.scenario.userPrompt.trim()}\n`);
    writeText("task.toml", renderTaskToml(input));
    writeText("tests/test.sh", renderGenericVerifier(), 0o755);
    writeText("environment/Dockerfile", renderDockerfile());
    writeText("solution/solve.sh", renderSolveScript(), 0o755);
    filesWritten.push(...copyPublicAssets(input.scenario, input.scenarioDir, taskDir));
    filesWritten.push(...copyPrivateEvaluationAssets(input.scenario, input.scenarioDir, taskDir));
    return { scenarioId: input.scenario.id, taskDir, filesWritten: [...new Set(filesWritten)].sort() };
}
function scenarioSourceFromDir(scenarioDir) {
    const instructionPath = path.join(scenarioDir, "instruction.md");
    const assetsDir = path.join(scenarioDir, "assets");
    return {
        scenarioDir,
        scenarioPath: path.join(scenarioDir, "scenario.json"),
        ...(existsSync(instructionPath) ? { instructionPath } : {}),
        ...(existsSync(assetsDir) ? { assetsDir } : {}),
    };
}
function readUserPrompt(raw, source) {
    if (typeof raw.userPrompt === "string") {
        return raw.userPrompt;
    }
    const promptPath = typeof raw.userPromptPath === "string"
        ? path.resolve(source.scenarioDir, raw.userPromptPath)
        : source.instructionPath;
    if (promptPath === undefined || !existsSync(promptPath)) {
        throw new Error(`Ruhroh scenario ${source.scenarioPath} is missing userPrompt or userPromptPath`);
    }
    return readFileSync(promptPath, "utf8").trim();
}
function readRunDefaults(raw) {
    if (isRecord(raw.run)) {
        return {
            ...(typeof raw.run.mode === "string" ? { mode: raw.run.mode } : {}),
            timeoutSeconds: typeof raw.run.timeoutSeconds === "number" ? raw.run.timeoutSeconds : 600,
        };
    }
    const legacyDriver = isRecord(raw.driver) ? raw.driver : {};
    return {
        ...(typeof legacyDriver.mode === "string" ? { mode: legacyDriver.mode } : {}),
        timeoutSeconds: typeof legacyDriver.timeoutSeconds === "number" ? legacyDriver.timeoutSeconds : 600,
    };
}
function readJsonRecord(filePath) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Expected JSON object in ${filePath}`);
    }
    return parsed;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry) => typeof entry === "string");
}
function renderTaskToml(input) {
    const artifacts = input.artifacts ?? RUHROH_ARTIFACTS;
    const networkMode = input.scenario.requires.network ? "public" : "no-network";
    return [
        'schema_version = "1.3"',
        "artifacts = [",
        ...artifacts.map((artifact) => `  ${tomlString(artifact)},`),
        "]",
        "",
        "[task]",
        `name = ${tomlString(`ruhroh/${input.scenario.id}`)}`,
        `description = ${tomlString(`Ruhroh scenario: ${input.scenario.title}`)}`,
        'authors = [{ name = "Ruhroh" }]',
        `keywords = ${tomlStringArray(["ruhroh", input.scenario.tier, input.scenario.kind])}`,
        "",
        "[metadata]",
        `scenario_id = ${tomlString(input.scenario.id)}`,
        ...(input.scenario.metadata?.scenarioVersion === undefined
            ? []
            : [`scenario_version = ${tomlString(input.scenario.metadata.scenarioVersion)}`]),
        ...(input.scenario.metadata?.difficulty === undefined
            ? []
            : [`difficulty = ${tomlString(input.scenario.metadata.difficulty)}`]),
        ...(input.scenario.metadata?.createdAt === undefined
            ? []
            : [`created_at = ${tomlString(input.scenario.metadata.createdAt)}`]),
        ...(input.scenario.metadata?.updatedAt === undefined
            ? []
            : [`updated_at = ${tomlString(input.scenario.metadata.updatedAt)}`]),
        ...(input.scenario.metadata?.provenance === undefined
            ? []
            : [`provenance = ${tomlString(input.scenario.metadata.provenance)}`]),
        ...(input.scenario.metadata?.expectedRuntimeSeconds === undefined
            ? []
            : [`expected_runtime_sec = ${input.scenario.metadata.expectedRuntimeSeconds.toFixed(1)}`]),
        ...(input.scenario.metadata?.visibility === undefined
            ? []
            : [`visibility = ${tomlString(input.scenario.metadata.visibility)}`]),
        ...(input.scenario.metadata?.lifecycle?.status === undefined
            ? []
            : [`lifecycle_status = ${tomlString(input.scenario.metadata.lifecycle.status)}`]),
        ...(input.scenario.metadata?.lifecycle?.replacementId === undefined
            ? []
            : [`lifecycle_replacement_id = ${tomlString(input.scenario.metadata.lifecycle.replacementId)}`]),
        ...(input.scenario.metadata?.tags === undefined
            ? []
            : [`tags = ${tomlStringArray(input.scenario.metadata.tags)}`]),
        ...(input.scenario.run.mode === undefined
            ? []
            : [`run_mode = ${tomlString(input.scenario.run.mode)}`]),
        `agent_import_path = ${tomlString(input.agentImportPath ?? RUHROH_HARBOR_AGENT_IMPORT_PATH)}`,
        "",
        "[verifier]",
        "timeout_sec = 600.0",
        "",
        "[verifier.env]",
        "",
        "[agent]",
        `timeout_sec = ${input.scenario.run.timeoutSeconds.toFixed(1)}`,
        "",
        "[environment]",
        `network_mode = ${tomlString(networkMode)}`,
        "build_timeout_sec = 600.0",
        'os = "linux"',
        "mcp_servers = []",
        "",
        "[environment.env]",
        "",
        "[solution.env]",
        "",
    ].join("\n");
}
function validateDeclaredAssets(value, source) {
    return validateDeclaredAssetPaths(value, source, "assets");
}
function readEvaluationPrivateAssets(value) {
    return isRecord(value) ? value.privateAssets : undefined;
}
function validateDeclaredAssetPaths(value, source, field) {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        return [`${field} must be an array of relative paths`];
    }
    const errors = [];
    for (const asset of value) {
        if (typeof asset !== "string" || asset.trim().length === 0) {
            errors.push(`${field} entries must be non-empty relative paths`);
            continue;
        }
        if (path.isAbsolute(asset) || asset.split(/[\\/]+/u).includes("..")) {
            errors.push(`${field} path must stay inside the scenario directory: ${asset}`);
            continue;
        }
        const assetPath = path.resolve(source.scenarioDir, asset);
        if (!existsSync(assetPath)) {
            errors.push(field === "assets" ? `declared asset does not exist: ${asset}` : `declared ${field} asset does not exist: ${asset}`);
        }
    }
    return errors;
}
function validatePrivateAssetExposure(publicValue, privateValue, source) {
    const publicAssets = readStringArray(publicValue).filter(isSafeRelativePath);
    const privateAssets = readStringArray(privateValue).filter(isSafeRelativePath);
    const errors = [];
    for (const publicAsset of publicAssets) {
        const publicPath = path.resolve(source.scenarioDir, publicAsset);
        for (const privateAsset of privateAssets) {
            const privatePath = path.resolve(source.scenarioDir, privateAsset);
            if (pathsOverlap(publicPath, privatePath)) {
                errors.push(`evaluation.privateAssets must not overlap public assets: ${privateAsset} is exposed by assets entry ${publicAsset}`);
            }
        }
    }
    return errors;
}
function isSafeRelativePath(value) {
    return value.trim().length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]+/u).includes("..");
}
function pathsOverlap(left, right) {
    return pathContainsOrEquals(left, right) || pathContainsOrEquals(right, left);
}
function pathContainsOrEquals(parent, child) {
    const relativePath = path.relative(parent, child);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}
function copyPublicAssets(scenario, scenarioDir, taskDir) {
    return (scenario.assets ?? []).flatMap((asset) => {
        const sourcePath = path.resolve(scenarioDir, asset);
        const targetPath = path.join(taskDir, asset);
        mkdirSync(path.dirname(targetPath), { recursive: true });
        cpSync(sourcePath, targetPath, { recursive: true, force: true });
        return statSync(targetPath).isDirectory() ? listFiles(targetPath) : [targetPath];
    });
}
function copyPrivateEvaluationAssets(scenario, scenarioDir, taskDir) {
    return (scenario.evaluation.privateAssets ?? []).flatMap((asset) => {
        const sourcePath = path.resolve(scenarioDir, asset);
        const targetPath = path.join(taskDir, "private-eval-assets", asset);
        mkdirSync(path.dirname(targetPath), { recursive: true });
        cpSync(sourcePath, targetPath, { recursive: true, force: true });
        return statSync(targetPath).isDirectory() ? listFiles(targetPath) : [targetPath];
    });
}
function renderGenericVerifier() {
    return `#!/bin/bash
set -euo pipefail

mkdir -p /logs/verifier

if python3 - <<'PY'
import json
from pathlib import Path

path = Path("/installed-agent/ruhroh-loop-result.json")
if not path.exists():
    raise SystemExit("missing Ruhroh result artifact")

result = json.loads(path.read_text(encoding="utf-8"))
if result.get("status") != "completed":
    raise SystemExit(f"Ruhroh did not complete: {result.get('status')} {result.get('failure_kind')}")
if result.get("failure_kind") not in (None, "none"):
    raise SystemExit(f"Ruhroh reported failure_kind={result.get('failure_kind')}")
if result.get("score") != 1:
    raise SystemExit(f"Ruhroh score was not 1: {result.get('score')}")
if result.get("implementationIterationsUsed", 0) < 1:
    raise SystemExit("Ruhroh did not record implementation iterations")
if not isinstance(result.get("implementationRuns"), list):
    raise SystemExit("Ruhroh result is missing implementationRuns")
eval_result = result.get("evalResult")
if not isinstance(eval_result, dict) or eval_result.get("version") != "ruhroh_eval_result_v1":
    raise SystemExit("Ruhroh result is missing evalResult")
if eval_result.get("status") != "passed":
    raise SystemExit(f"Ruhroh eval-agent did not pass: {eval_result.get('status')}")
PY
then
  echo 1 > /logs/verifier/reward.txt
else
  echo 0 > /logs/verifier/reward.txt
  exit 1
fi
`;
}
function renderDockerfile() {
    return `FROM ubuntu:24.04

RUN apt-get update \\
  && apt-get install -y --no-install-recommends bash ca-certificates python3 \\
  && rm -rf /var/lib/apt/lists/*
`;
}
function renderSolveScript() {
    return `#!/bin/bash
set -euo pipefail

echo "Ruhroh benchmark tasks are solved by the installed agent."
`;
}
function tomlString(value) {
    return JSON.stringify(value);
}
function tomlStringArray(values) {
    return `[${values.map(tomlString).join(", ")}]`;
}
function listFiles(root) {
    const files = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...listFiles(fullPath));
            continue;
        }
        if (entry.isFile()) {
            files.push(fullPath);
        }
    }
    return files.sort();
}
//# sourceMappingURL=generate.js.map