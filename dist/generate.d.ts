import { type RuhrohScenario, type RuhrohScenarioSource } from "./scenarios.js";
export interface LoadedRuhrohScenario {
    scenario: RuhrohScenario;
    source: RuhrohScenarioSource;
}
export interface GenerateHarborTaskInput {
    scenario: RuhrohScenario;
    scenarioDir: string;
    outputRoot: string;
    agentImportPath?: string | undefined;
    artifacts?: readonly string[] | undefined;
}
export interface GenerateHarborTaskResult {
    scenarioId: string;
    taskDir: string;
    filesWritten: string[];
}
export interface GenerateHarborDatasetInput {
    scenarios: LoadedRuhrohScenario[];
    outputRoot: string;
    agentImportPath?: string | undefined;
    artifacts?: readonly string[] | undefined;
}
export interface GenerateHarborDatasetResult {
    datasetPath: string;
    tasks: GenerateHarborTaskResult[];
}
export declare function discoverRuhrohScenarios(scenarioRoot: string): RuhrohScenarioSource[];
export declare function loadRuhrohScenario(input: string | RuhrohScenarioSource): LoadedRuhrohScenario;
export declare function generateHarborDataset(input: GenerateHarborDatasetInput): GenerateHarborDatasetResult;
export declare function generateHarborTask(input: GenerateHarborTaskInput): GenerateHarborTaskResult;
//# sourceMappingURL=generate.d.ts.map