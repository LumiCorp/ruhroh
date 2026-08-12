export type RuhrohSuiteVersion = "ruhroh_suite_v1" | "ruhroh_suite_v2";
export type RuhrohSuiteAggregationUnit = "scenario_adapter" | "scenario_benchmark_target";
export type RuhrohSuiteReportPolicy = "pass_rate_ci_pass_at_k" | "pass_rate_ci_pass_at_k_outcome_frontier";
export type RuhrohEfficiencyObjective = "cost_per_accepted_outcome" | "tokens_per_accepted_outcome" | "p95_implementation_wall_time_ms";
export interface RuhrohSuiteEfficiencyContract {
    denominator: {
        id: "accepted_scenario_outcome";
        predicate: "score_1_and_eval_passed";
        failedWork: "included_in_resource_numerator";
    };
    aggregation: {
        weighting: "run_plan";
        failedWork: "included_in_resource_numerator";
    };
    suitableWorkloads: string[];
    requiredEvidence: string[];
    hiddenWork: string[];
    gamingRisks: string[];
    qualityFloor: {
        metric: "pass_rate";
        rule: "wilson_lower_bound_gte";
        threshold: number;
        scope: "each_scenario";
    };
    objectives: RuhrohEfficiencyObjective[];
    bootstrap: {
        resamples: 1000;
        minValidResamples: 950;
        confidenceLevel: 0.95;
        stratification: "scenario";
    };
}
interface RuhrohBenchmarkSuiteBase {
    id: string;
    title: string;
    suiteVersion: string;
    description: string;
    scenarioIds: string[];
    scenarioVersions: Record<string, string>;
    governance: {
        owner: string;
        createdAt?: string | undefined;
        updatedAt?: string | undefined;
        changelog: string[];
        acceptanceCriteria: string[];
        contaminationReview: string;
        rewardHackingReview: string;
        reviewChecklist: string[];
        deprecationPolicy: string;
    };
}
export interface RuhrohBenchmarkSuiteV1 extends RuhrohBenchmarkSuiteBase {
    version: "ruhroh_suite_v1";
    methodology: {
        minRuns: number;
        aggregationUnit: "scenario_adapter";
        reportPolicy: "pass_rate_ci_pass_at_k";
        confidenceLevel: 0.95;
        retryPolicy: string;
    };
}
export interface RuhrohBenchmarkSuiteV2 extends RuhrohBenchmarkSuiteBase {
    version: "ruhroh_suite_v2";
    methodology: {
        minRuns: number;
        aggregationUnit: "scenario_benchmark_target";
        reportPolicy: "pass_rate_ci_pass_at_k_outcome_frontier";
        confidenceLevel: 0.95;
        retryPolicy: string;
        efficiency: RuhrohSuiteEfficiencyContract;
    };
}
export type RuhrohBenchmarkSuite = RuhrohBenchmarkSuiteV1 | RuhrohBenchmarkSuiteV2;
export interface RuhrohSuiteSource {
    suiteDir: string;
    suitePath: string;
}
export interface ValidateRuhrohSuiteSourceResult {
    source: RuhrohSuiteSource;
    suite?: RuhrohBenchmarkSuite | undefined;
    errors: string[];
    warnings: string[];
}
export declare function discoverRuhrohSuites(suiteRoot: string): RuhrohSuiteSource[];
export declare function loadRuhrohSuite(input: string | RuhrohSuiteSource): RuhrohBenchmarkSuite;
export declare function validateRuhrohSuite(suite: RuhrohBenchmarkSuite, options?: {
    availableScenarioIds?: readonly string[] | undefined;
    availableScenarioVersions?: Readonly<Record<string, string>> | undefined;
}): string[];
export declare function validateRuhrohSuiteSource(input: string | RuhrohSuiteSource, options?: {
    availableScenarioIds?: readonly string[] | undefined;
    availableScenarioVersions?: Readonly<Record<string, string>> | undefined;
}): ValidateRuhrohSuiteSourceResult;
export declare function ruhrohWilsonLowerBound(successes: number, total: number): number;
export {};
//# sourceMappingURL=suites.d.ts.map