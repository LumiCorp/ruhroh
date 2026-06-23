import { type RuhrohContinuityLevel, type RuhrohRunAgentAdapterCapabilities } from "./adapters.js";
export type RuhrohScenarioTier = "smoke" | "nightly" | "release";
export type RuhrohScenarioKind = "real_user" | "contract_stress";
export type RuhrohLoopStopPolicy = "goal_satisfied_or_max";
export type RuhrohDriverMode = "build" | "plan" | "chat";
export type RuhrohEvaluationMode = "agentic_goal_review";
export type RuhrohScenarioVersion = "ruhroh_scenario_v1" | "ruhroh_scenario_v2";
export interface RuhrohScenario {
    version: RuhrohScenarioVersion;
    id: string;
    title: string;
    tier: RuhrohScenarioTier;
    kind: RuhrohScenarioKind;
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
    };
}
export interface ValidateRuhrohScenarioOptions {
    adapters?: Record<string, RuhrohRunAgentAdapterCapabilities> | undefined;
}
export interface RuhrohScenarioSource {
    scenarioDir: string;
    scenarioPath: string;
    instructionPath?: string | undefined;
    assetsDir?: string | undefined;
}
export declare function validateRuhrohScenario(scenario: RuhrohScenario, options?: ValidateRuhrohScenarioOptions): string[];
export declare function getRuhrohScenarioById<TScenario extends {
    id: string;
}>(scenarios: TScenario[], id: string): TScenario | undefined;
export declare function getRuhrohScenariosByTier<TScenario extends {
    tier: RuhrohScenarioTier;
}>(scenarios: TScenario[], tier: RuhrohScenarioTier): TScenario[];
//# sourceMappingURL=scenarios.d.ts.map