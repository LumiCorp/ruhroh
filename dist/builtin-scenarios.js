import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverRuhrohScenarios, loadRuhrohScenario } from "./generate.js";
import { discoverRuhrohSuites, loadRuhrohSuite, } from "./suites.js";
import { getRuhrohScenarioById, getRuhrohScenariosByTier, } from "./scenarios.js";
export function resolveRuhrohPackageRootFromModule(importMetaUrl = import.meta.url) {
    const moduleDir = path.dirname(fileURLToPath(importMetaUrl));
    const basename = path.basename(moduleDir);
    return basename === "dist" || basename === "src" ? path.dirname(moduleDir) : moduleDir;
}
export function resolveRuhrohBuiltinScenarioDir(packageRoot = resolveRuhrohPackageRootFromModule()) {
    return path.join(packageRoot, "scenarios");
}
export function resolveRuhrohBuiltinSuiteDir(packageRoot = resolveRuhrohPackageRootFromModule()) {
    return path.join(packageRoot, "suites");
}
export function loadBuiltinRuhrohScenarios(scenarioDir = resolveRuhrohBuiltinScenarioDir()) {
    return discoverRuhrohScenarios(scenarioDir).map((source) => loadRuhrohScenario(source));
}
export function loadBuiltinRuhrohSuites(suiteDir = resolveRuhrohBuiltinSuiteDir()) {
    return discoverRuhrohSuites(suiteDir).map((source) => loadRuhrohSuite(source));
}
export function getBuiltinRuhrohScenarioById(id, scenarioDir = resolveRuhrohBuiltinScenarioDir()) {
    return getRuhrohScenarioById(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), id);
}
export function getBuiltinRuhrohSuiteById(id, suiteDir = resolveRuhrohBuiltinSuiteDir()) {
    return loadBuiltinRuhrohSuites(suiteDir).find((suite) => suite.id === id);
}
export function getBuiltinRuhrohScenariosByTier(tier, scenarioDir = resolveRuhrohBuiltinScenarioDir()) {
    return getRuhrohScenariosByTier(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), tier);
}
export function getBuiltinRuhrohSuitesByScenarioId(scenarioId, suiteDir = resolveRuhrohBuiltinSuiteDir()) {
    return loadBuiltinRuhrohSuites(suiteDir).filter((suite) => suite.scenarioIds.includes(scenarioId));
}
//# sourceMappingURL=builtin-scenarios.js.map