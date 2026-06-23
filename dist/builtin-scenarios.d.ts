import { type LoadedRuhrohScenario } from "./generate.js";
import { type RuhrohScenario, type RuhrohScenarioTier } from "./scenarios.js";
export declare function resolveRuhrohPackageRootFromModule(importMetaUrl?: string): string;
export declare function resolveRuhrohBuiltinScenarioDir(packageRoot?: string): string;
export declare function loadBuiltinRuhrohScenarios(scenarioDir?: string): LoadedRuhrohScenario[];
export declare function getBuiltinRuhrohScenarioById(id: string, scenarioDir?: string): RuhrohScenario | undefined;
export declare function getBuiltinRuhrohScenariosByTier(tier: RuhrohScenarioTier, scenarioDir?: string): RuhrohScenario[];
//# sourceMappingURL=builtin-scenarios.d.ts.map