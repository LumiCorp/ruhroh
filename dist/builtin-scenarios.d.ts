import { type LoadedRuhrohScenario } from "./generate.js";
import { type RuhrohBenchmarkSuite } from "./suites.js";
import { type RuhrohScenario, type RuhrohScenarioTier } from "./scenarios.js";
export declare function resolveRuhrohPackageRootFromModule(importMetaUrl?: string): string;
export declare function resolveRuhrohBuiltinScenarioDir(packageRoot?: string): string;
export declare function resolveRuhrohBuiltinSuiteDir(packageRoot?: string): string;
export declare function loadBuiltinRuhrohScenarios(scenarioDir?: string): LoadedRuhrohScenario[];
export declare function loadBuiltinRuhrohSuites(suiteDir?: string): RuhrohBenchmarkSuite[];
export declare function getBuiltinRuhrohScenarioById(id: string, scenarioDir?: string): RuhrohScenario | undefined;
export declare function getBuiltinRuhrohSuiteById(id: string, suiteDir?: string): RuhrohBenchmarkSuite | undefined;
export declare function getBuiltinRuhrohScenariosByTier(tier: RuhrohScenarioTier, scenarioDir?: string): RuhrohScenario[];
export declare function getBuiltinRuhrohSuitesByScenarioId(scenarioId: string, suiteDir?: string): RuhrohBenchmarkSuite[];
//# sourceMappingURL=builtin-scenarios.d.ts.map