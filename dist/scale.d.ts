export declare const RUHROH_REFERENCE_SCALE_LEVELS: readonly [1, 2, 4, 8, 16];
export type RuhrohScaleCandidate = "T(1)" | "T(log_n)" | "T(n)" | "T(n_k)" | "T(n_k_a)";
export interface RuhrohScaleExperimentLevelV1 {
    id: string;
    n: number;
    scenarioId: string;
    scenarioVersion: string;
    fixtureSha256: string;
    requestIds: string[];
}
export interface RuhrohScaleExperimentV1 {
    version: "ruhroh_scale_experiment_v1";
    id: string;
    suite: {
        id: string;
        suiteVersion: string;
    };
    variable: {
        symbol: "n";
        name: "ordered_change_requests";
        unit: "change_request";
    };
    levels: RuhrohScaleExperimentLevelV1[];
    hypothesis: {
        expectedClass: RuhrohScaleCandidate;
        rationale: string;
    };
    controls: {
        targetIds: string[];
        frozenBaselineSha256: string;
        promptTemplateSha256: string;
        evaluatorSignature: string;
        fixedRequestOrderSha256: string;
        sessionPolicy: "fresh_per_sample";
        levelPolicy: "prefix_nested";
    };
    qualityFloor: {
        perChangeCompletionRate: number;
        zeroCriticalRegressions: true;
    };
    resourceMetric: "totalTokens";
    bootstrapSamples: 1000;
}
export interface RuhrohScaleChangeResultV1 {
    requestId: string;
    status: "passed" | "failed" | "critical_regression";
}
export interface RuhrohScaleObservationV1 {
    version: "ruhroh_scale_observation_v1";
    experimentId: string;
    targetId: string;
    levelId: string;
    n: number;
    sampleId: string;
    changeResults: RuhrohScaleChangeResultV1[];
    totalTokens?: number | undefined;
    modelCalls?: number | undefined;
    retryAttempts?: number | undefined;
    childAgentMaxDepth?: number | undefined;
    childAgentMaxFanout?: number | undefined;
    resourceBudgetStatus?: "within" | "exhausted" | "overrun" | "unobservable" | undefined;
}
export interface RuhrohScaleLevelAnalysisV1 {
    levelId: string;
    n: number;
    samples: number;
    completedChanges: number;
    requestedChanges: number;
    perChangeCompletionRate: number;
    criticalRegressions: number;
    fullBatchSuccessRate: number;
    qualityEligible: boolean;
    completeTokenCoverage: boolean;
    totalTokens?: number | undefined;
    p50TotalTokens?: number | undefined;
    p95TotalTokens?: number | undefined;
    totalModelCalls?: number | undefined;
    p50ModelCalls?: number | undefined;
    p95ModelCalls?: number | undefined;
    totalRetryAttempts?: number | undefined;
    p50RetryAttempts?: number | undefined;
    p95RetryAttempts?: number | undefined;
    p50ChildAgentDepth?: number | undefined;
    p95ChildAgentDepth?: number | undefined;
    p50ChildAgentFanout?: number | undefined;
    p95ChildAgentFanout?: number | undefined;
    budgetStatusCounts: Record<string, number>;
}
export interface RuhrohScaleFitV1 {
    candidate: RuhrohScaleCandidate;
    coefficient: number;
    normalizedRmse: number;
    leaveOneScaleOutError: number;
    bootstrapBestFitStability: number;
    observable: boolean;
}
export interface RuhrohScaleTargetAnalysisV1 {
    targetId: string;
    levels: RuhrohScaleLevelAnalysisV1[];
    classificationStatus: "eligible" | "quality_ineligible" | "incomplete_coverage" | "insufficient_scales";
    bestFitCandidate?: RuhrohScaleCandidate | undefined;
    runnerUpCandidate?: RuhrohScaleCandidate | undefined;
    fits: RuhrohScaleFitV1[];
    caveat: string;
}
export interface RuhrohScaleAnalysisV1 {
    version: "ruhroh_scale_analysis_v1";
    experimentId: string;
    createdAt: string;
    methodology: {
        finiteEmpiricalCandidateOnly: true;
        qualityRule: "per_change_completion_floor_and_zero_critical_regressions";
        bootstrapSamples: 1000;
        crossValidation: "leave_one_scale_out";
    };
    targets: RuhrohScaleTargetAnalysisV1[];
    errors: string[];
}
export declare function validateRuhrohScaleExperiment(experiment: RuhrohScaleExperimentV1): string[];
export declare function analyzeRuhrohScaleExperiment(input: {
    experiment: RuhrohScaleExperimentV1;
    observations: readonly RuhrohScaleObservationV1[];
    createdAt?: string | undefined;
}): RuhrohScaleAnalysisV1;
//# sourceMappingURL=scale.d.ts.map