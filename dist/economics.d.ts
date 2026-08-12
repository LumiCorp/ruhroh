import type { RuhrohConfidenceInterval, RuhrohMetricCoverage, RuhrohRunSummary } from "./results.js";
import type { RuhrohBenchmarkSuite, RuhrohEfficiencyObjective, RuhrohSuiteEfficiencyContract } from "./suites.js";
export type RuhrohFrontierStatus = "available" | "quality_only" | "unavailable";
export type RuhrohQualityFloorStatus = "passed" | "failed" | "indeterminate";
export type RuhrohObjectiveStatus = "available" | "partial" | "unavailable" | "indeterminate";
export type RuhrohDominanceStatus = "pareto" | "dominated" | "ineligible" | "indeterminate";
export interface RuhrohFrontierScenarioQuality {
    scenarioId: string;
    runs: number;
    acceptedOutcomes: number;
    passRate: number;
    passRateCi95: RuhrohConfidenceInterval;
    floorStatus: RuhrohQualityFloorStatus;
    reasonCodes: string[];
}
export interface RuhrohFrontierObjectiveEstimate {
    objective: RuhrohEfficiencyObjective;
    status: RuhrohObjectiveStatus;
    unit: "usd_per_accepted_outcome" | "tokens_per_accepted_outcome" | "milliseconds";
    acceptedOutcomes: number;
    coverage: RuhrohMetricCoverage;
    planWeightCoverage: RuhrohMetricCoverage;
    value?: number | undefined;
    totalConsumption?: number | undefined;
    weightedAcceptedOutcomes?: number | undefined;
    ci95?: RuhrohConfidenceInterval | undefined;
    validBootstrapSamples: number;
    reasonCodes: string[];
}
export interface RuhrohOutcomeFrontierTarget {
    benchmarkTargetId: string;
    executionAdapterIds: string[];
    identity: Record<string, unknown>;
    runs: number;
    acceptedOutcomes: number;
    quality: {
        floorStatus: RuhrohQualityFloorStatus;
        scenarioResults: RuhrohFrontierScenarioQuality[];
    };
    objectives: RuhrohFrontierObjectiveEstimate[];
    paretoStatus: RuhrohDominanceStatus;
    paretoDominatedByTargetIds: string[];
    robustStatus: RuhrohDominanceStatus;
    robustDominatedByTargetIds: string[];
    reasonCodes: string[];
}
export interface RuhrohOutcomeFrontier {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/outcome-frontier-v1.schema.json";
    version: "ruhroh_outcome_frontier_v1";
    status: RuhrohFrontierStatus;
    reasonCodes: string[];
    methodology?: {
        suiteId: string;
        suiteVersion: string;
        acceptedOutcome: RuhrohSuiteEfficiencyContract["denominator"];
        aggregation: RuhrohSuiteEfficiencyContract["aggregation"];
        suitableWorkloads: string[];
        requiredEvidence: string[];
        hiddenWork: string[];
        gamingRisks: string[];
        qualityFloor: RuhrohSuiteEfficiencyContract["qualityFloor"];
        objectives: RuhrohEfficiencyObjective[];
        bootstrap: RuhrohSuiteEfficiencyContract["bootstrap"];
        dominance: "pareto_minimize_with_robust_ci_v1";
    } | undefined;
    coverage: {
        targetCount: number;
        qualityEligibleTargetCount: number;
        comparableTargetCount: number;
        paretoFrontierTargetCount: number;
        robustFrontierTargetCount: number;
    };
    targets: RuhrohOutcomeFrontierTarget[];
    paretoFrontierTargetIds: string[];
    robustFrontierTargetIds: string[];
}
export interface BuildRuhrohOutcomeFrontierInput {
    summaries: readonly RuhrohRunSummary[];
    suite?: RuhrohBenchmarkSuite | undefined;
}
export interface RuhrohOutcomeFrontierValidationResult {
    version: "ruhroh_outcome_frontier_validation_v1";
    errors: string[];
    warnings: string[];
}
export declare function buildRuhrohOutcomeFrontier(input: BuildRuhrohOutcomeFrontierInput): RuhrohOutcomeFrontier;
export declare function validateRuhrohOutcomeFrontier(input: unknown): RuhrohOutcomeFrontierValidationResult;
//# sourceMappingURL=economics.d.ts.map