import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverRuhrohScenarios, loadRuhrohScenario, type LoadedRuhrohScenario } from "./generate.js";
import {
  getRuhrohScenarioById,
  getRuhrohScenariosByTier,
  type RuhrohScenario,
  type RuhrohScenarioTier,
} from "./scenarios.js";

export function resolveRuhrohPackageRootFromModule(importMetaUrl: string = import.meta.url): string {
  const moduleDir = path.dirname(fileURLToPath(importMetaUrl));
  const basename = path.basename(moduleDir);
  return basename === "dist" || basename === "src" ? path.dirname(moduleDir) : moduleDir;
}

export function resolveRuhrohBuiltinScenarioDir(packageRoot: string = resolveRuhrohPackageRootFromModule()): string {
  return path.join(packageRoot, "scenarios");
}

export function loadBuiltinRuhrohScenarios(
  scenarioDir: string = resolveRuhrohBuiltinScenarioDir(),
): LoadedRuhrohScenario[] {
  return discoverRuhrohScenarios(scenarioDir).map((source) => loadRuhrohScenario(source));
}

export function getBuiltinRuhrohScenarioById(
  id: string,
  scenarioDir: string = resolveRuhrohBuiltinScenarioDir(),
): RuhrohScenario | undefined {
  return getRuhrohScenarioById(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), id);
}

export function getBuiltinRuhrohScenariosByTier(
  tier: RuhrohScenarioTier,
  scenarioDir: string = resolveRuhrohBuiltinScenarioDir(),
): RuhrohScenario[] {
  return getRuhrohScenariosByTier(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), tier);
}
