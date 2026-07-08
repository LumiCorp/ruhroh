import path from "node:path";
import { fileURLToPath } from "node:url";

import { discoverRuhrohScenarios, loadRuhrohScenario, type LoadedRuhrohScenario } from "./generate.js";
import {
  discoverRuhrohSuites,
  loadRuhrohSuite,
  type RuhrohBenchmarkSuite,
} from "./suites.js";
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

export function resolveRuhrohBuiltinSuiteDir(packageRoot: string = resolveRuhrohPackageRootFromModule()): string {
  return path.join(packageRoot, "suites");
}

export function loadBuiltinRuhrohScenarios(
  scenarioDir: string = resolveRuhrohBuiltinScenarioDir(),
): LoadedRuhrohScenario[] {
  return discoverRuhrohScenarios(scenarioDir).map((source) => loadRuhrohScenario(source));
}

export function loadBuiltinRuhrohSuites(
  suiteDir: string = resolveRuhrohBuiltinSuiteDir(),
): RuhrohBenchmarkSuite[] {
  return discoverRuhrohSuites(suiteDir).map((source) => loadRuhrohSuite(source));
}

export function getBuiltinRuhrohScenarioById(
  id: string,
  scenarioDir: string = resolveRuhrohBuiltinScenarioDir(),
): RuhrohScenario | undefined {
  return getRuhrohScenarioById(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), id);
}

export function getBuiltinRuhrohSuiteById(
  id: string,
  suiteDir: string = resolveRuhrohBuiltinSuiteDir(),
): RuhrohBenchmarkSuite | undefined {
  return loadBuiltinRuhrohSuites(suiteDir).find((suite) => suite.id === id);
}

export function getBuiltinRuhrohScenariosByTier(
  tier: RuhrohScenarioTier,
  scenarioDir: string = resolveRuhrohBuiltinScenarioDir(),
): RuhrohScenario[] {
  return getRuhrohScenariosByTier(loadBuiltinRuhrohScenarios(scenarioDir).map((loaded) => loaded.scenario), tier);
}

export function getBuiltinRuhrohSuitesByScenarioId(
  scenarioId: string,
  suiteDir: string = resolveRuhrohBuiltinSuiteDir(),
): RuhrohBenchmarkSuite[] {
  return loadBuiltinRuhrohSuites(suiteDir).filter((suite) => suite.scenarioIds.includes(scenarioId));
}
