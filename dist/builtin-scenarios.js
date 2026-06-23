import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoverRuhrohScenarios, loadRuhrohScenario } from "./generate.js";
import { getRuhrohScenarioById, getRuhrohScenariosByTier, } from "./scenarios.js";
export function resolveRuhrohPackageRootFromModule(importMetaUrl = import.meta.url) {
    const moduleDir = path.dirname(fileURLToPath(importMetaUrl));
    const basename = path.basename(moduleDir);
    return basename === "dist" || basename === "src" ? path.dirname(moduleDir) : moduleDir;
}
export function resolveRuhrohBuiltinScenarioDir(packageRoot = resolveRuhrohPackageRootFromModule()) {
    return path.join(packageRoot, "scenarios");
}
export function loadBuiltinRuhrohScenarios(scenarioDir = resolveRuhrohBuiltinScenarioDir()) {
    return discoverRuhrohScenarios(scenarioDir).map((source) => loadRuhrohScenario(source));
}
export function getBuiltinRuhrohScenarioById(id, scenarioDir = resolveRuhrohBuiltinScenarioDir()) {
    return getRuhrohScenarioById(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), id);
}
export function getBuiltinRuhrohScenariosByTier(tier, scenarioDir = resolveRuhrohBuiltinScenarioDir()) {
    return getRuhrohScenariosByTier(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), tier);
}
//# sourceMappingURL=builtin-scenarios.js.map