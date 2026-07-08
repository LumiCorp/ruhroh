import { type RuhrohContinuityLevel, type RuhrohRunAgentAdapterCapabilities } from "./adapters.js";
export type RuhrohScenarioTier = "smoke" | "nightly" | "release";
export type RuhrohScenarioKind = "real_user" | "contract_stress";
export type RuhrohLoopStopPolicy = "goal_satisfied_or_max";
export type RuhrohDriverMode = "build" | "plan" | "chat";
export type RuhrohEvaluationMode = "agentic_goal_review";
export type RuhrohScenarioVersion = "ruhroh_scenario_v1" | "ruhroh_scenario_v2";
export type RuhrohScenarioDifficulty = "intro" | "standard" | "hard" | "expert";
export type RuhrohScenarioCalibrationExpectedStatus = "passed" | "failed" | "review";
export type RuhrohScenarioVisibility = "public" | "private" | "held_out";
export type RuhrohScenarioLifecycleStatus = "active" | "deprecated" | "retired";
export interface RuhrohScenarioMetadata {
    scenarioVersion: string;
    provenance?: string | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    difficulty?: RuhrohScenarioDifficulty | undefined;
    tags?: string[] | undefined;
    visibility?: RuhrohScenarioVisibility | undefined;
    expectedRuntimeSeconds?: number | undefined;
    networkRationale?: string | undefined;
    contaminationNotes?: string | undefined;
    privateEvalRationale?: string | undefined;
    maintainers?: string[] | undefined;
    changelog?: string[] | undefined;
    lifecycle?: RuhrohScenarioLifecycle | undefined;
}
export interface RuhrohScenarioLifecycle {
    status: RuhrohScenarioLifecycleStatus;
    reason?: string | undefined;
    replacementId?: string | undefined;
    sunsetAt?: string | undefined;
}
export interface RuhrohScenario {
    version: RuhrohScenarioVersion;
    id: string;
    title: string;
    tier: RuhrohScenarioTier;
    kind: RuhrohScenarioKind;
    metadata?: RuhrohScenarioMetadata | undefined;
    userPrompt: string;
    assets?: string[] | undefined;
    driver?: {
        adapter: string;
        profileId?: string | undefined;
        mode?: RuhrohDriverMode | undefined;
        timeoutSeconds: number;
        env?: Record<string, string> | undefined;
        command?: string | undefined;
        completionProtocol?: string | undefined;
    };
    run: {
        mode?: RuhrohDriverMode | undefined;
        timeoutSeconds: number;
    };
    requires: {
        continuity: RuhrohContinuityLevel;
        tools: string[];
        network: boolean;
    };
    loop: {
        defaultMaxIterations: number;
        stopPolicy: RuhrohLoopStopPolicy;
    };
    evaluation: {
        mode: RuhrohEvaluationMode;
        scenarioContext: string[];
        goalRubric: string[];
        evidenceGuidance: string[];
        calibrationCases?: RuhrohScenarioEvaluationCalibrationCase[] | undefined;
        privateAssets?: string[] | undefined;
    };
}
export interface RuhrohScenarioEvaluationCalibrationCase {
    id: string;
    inputSummary: string;
    expectedStatus: RuhrohScenarioCalibrationExpectedStatus;
    rationale: string;
}
export interface RuhrohScenarioEvaluationCalibrationSummary {
    total: number;
    byExpectedStatus: Record<RuhrohScenarioCalibrationExpectedStatus, number>;
    coveredStatuses: RuhrohScenarioCalibrationExpectedStatus[];
    missingStatuses: RuhrohScenarioCalibrationExpectedStatus[];
    warnings: string[];
}
export interface ValidateRuhrohScenarioOptions {
    adapters?: Record<string, RuhrohRunAgentAdapterCapabilities> | undefined;
}
export type RuhrohScenarioEvaluationLintSeverity = "warning";
export type RuhrohScenarioEvaluationLintCategory = "calibration" | "rubric" | "evidence";
export interface RuhrohScenarioEvaluationLintDiagnostic {
    code: string;
    severity: RuhrohScenarioEvaluationLintSeverity;
    category: RuhrohScenarioEvaluationLintCategory;
    field: string;
    message: string;
}
export interface RuhrohScenarioSource {
    scenarioDir: string;
    scenarioPath: string;
    instructionPath?: string | undefined;
    assetsDir?: string | undefined;
}
export declare function validateRuhrohScenario(scenario: RuhrohScenario, options?: ValidateRuhrohScenarioOptions): string[];
export declare function lintRuhrohScenarioEvaluation(scenario: RuhrohScenario): string[];
export declare function summarizeRuhrohScenarioCalibration(scenario: RuhrohScenario): RuhrohScenarioEvaluationCalibrationSummary;
export declare function lintRuhrohScenarioEvaluationDetailed(scenario: RuhrohScenario): RuhrohScenarioEvaluationLintDiagnostic[];
export declare function getRuhrohScenarioById<TScenario extends {
    id: string;
}>(scenarios: TScenario[], id: string): TScenario | undefined;
export declare function getRuhrohScenariosByTier<TScenario extends {
    tier: RuhrohScenarioTier;
}>(scenarios: TScenario[], tier: RuhrohScenarioTier): TScenario[];
//# sourceMappingURL=scenarios.d.ts.map