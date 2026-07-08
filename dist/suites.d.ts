export type RuhrohSuiteVersion = "ruhroh_suite_v1";
export type RuhrohSuiteAggregationUnit = "scenario_adapter";
export type RuhrohSuiteReportPolicy = "pass_rate_ci_pass_at_k";
export interface RuhrohBenchmarkSuite {
    version: RuhrohSuiteVersion;
    id: string;
    title: string;
    suiteVersion: string;
    description: string;
    scenarioIds: string[];
    scenarioVersions: Record<string, string>;
    methodology: {
        minRuns: number;
        aggregationUnit: RuhrohSuiteAggregationUnit;
        reportPolicy: RuhrohSuiteReportPolicy;
        confidenceLevel: 0.95;
        retryPolicy: string;
    };
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
//# sourceMappingURL=suites.d.ts.map