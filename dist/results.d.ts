import type { RuhrohEvidenceRef, RunAgentArtifactManifest } from "./adapters.js";
export type RuhrohEvalStatus = "passed" | "failed" | "review" | "infra_failed";
export type RuhrohEvalConfidence = "low" | "medium" | "high";
export type RuhrohEvalCriterionStatus = "passed" | "failed" | "partial" | "not_applicable";
export type RuhrohEvalJudgeKind = "fixture" | "command" | "model" | "hybrid";
export interface RuhrohEvalCriterionResult {
    id: string;
    description: string;
    status: RuhrohEvalCriterionStatus;
    score: number;
    weight?: number | undefined;
    evidenceRefs: RuhrohEvidenceRef[];
    notes?: string | undefined;
}
export interface RuhrohEvalSubscores {
    functionality?: number | undefined;
    workflow?: number | undefined;
    buildRun?: number | undefined;
    persistence?: number | undefined;
    constraintCompliance?: number | undefined;
    evidenceQuality?: number | undefined;
    [dimension: string]: number | undefined;
}
export interface RuhrohEvalJudge {
    kind: RuhrohEvalJudgeKind;
    model?: string | undefined;
    version?: string | undefined;
}
export interface RuhrohEvalJudgeVote {
    judge: RuhrohEvalJudge;
    status: RuhrohEvalStatus;
    confidence: RuhrohEvalConfidence;
    rationale: string;
    evidenceRefs: RuhrohEvidenceRef[];
    weight?: number | undefined;
}
export interface RuhrohEvalJudgeAgreement {
    votes: number;
    unanimous: boolean;
    statusCounts: Record<RuhrohEvalStatus, number>;
    majorityStatus?: RuhrohEvalStatus | undefined;
    dissentingJudges: string[];
}
export interface RuhrohEvalCommandRecord {
    command: string;
    exitCode: number;
    summary: string;
}
export interface RuhrohEvalResult {
    version: "ruhroh_eval_result_v1";
    status: RuhrohEvalStatus;
    goalMet: boolean;
    confidence: RuhrohEvalConfidence;
    reasons: string[];
    unmetCriteria: string[];
    evidenceRefs: RuhrohEvidenceRef[];
    commandsRun: RuhrohEvalCommandRecord[];
    artifacts: Record<string, string>;
    finalSummary: string;
    repairBrief?: string | undefined;
    criteriaResults?: RuhrohEvalCriterionResult[] | undefined;
    subscores?: RuhrohEvalSubscores | undefined;
    judge?: RuhrohEvalJudge | undefined;
    judgeVotes?: RuhrohEvalJudgeVote[] | undefined;
    judgeAgreement?: RuhrohEvalJudgeAgreement | undefined;
}
export interface RuhrohRunManifest {
    version: "ruhroh_run_manifest_v1";
    runId: string;
    scenario: {
        id: string;
        scenarioVersion?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    };
    benchmark: {
        dataset: string;
        adapter: string;
        harborAgent?: string | undefined;
    };
    timing: {
        startedAt: string;
        endedAt?: string | undefined;
        durationMs: number;
    };
    loop: {
        maxIterations: number;
        implementationIterationsUsed: number;
        stoppedReason: string;
    };
    sample?: RuhrohRunSample | undefined;
    runAgent: {
        adapterId: string;
        adapterVersion?: string | undefined;
        continuityLevel: string;
        sessionHandle: string;
        runIds: string[];
        model?: Record<string, unknown> | undefined;
        usage?: Record<string, unknown> | undefined;
        command?: Record<string, unknown> | undefined;
    };
    evaluator?: {
        command?: Record<string, unknown> | undefined;
        fixtureConfigured?: boolean | undefined;
        inputSummary?: Record<string, unknown> | undefined;
        judge?: RuhrohEvalJudge | undefined;
        model?: Record<string, unknown> | undefined;
    } | undefined;
    environment?: RuhrohRunEnvironment | undefined;
    env?: Record<string, unknown> | undefined;
    usage?: Record<string, unknown> | undefined;
    artifactPaths?: Record<string, string> | undefined;
    failureDetails?: Record<string, unknown> | undefined;
}
export interface RuhrohRunEnvironment {
    fingerprint?: {
        method?: string | undefined;
        sha256?: string | undefined;
        components?: Record<string, unknown> | undefined;
    } | undefined;
    [key: string]: unknown;
}
export interface RuhrohRunSample {
    id?: string | undefined;
    index?: number | undefined;
    count?: number | undefined;
    seed?: string | undefined;
}
export interface RuhrohLoopResult {
    version: "ruhroh_loop_result_v1";
    runId?: string | undefined;
    adapter: string;
    dataset: string;
    scenarioId: string;
    task_id: string;
    status: "completed" | "failed";
    failure_kind: string;
    failureBucket: string;
    score: number;
    iterationsUsed: number;
    implementationIterationsUsed: number;
    implementationStoppedReason: string;
    stoppedReason: string;
    duration_ms: number;
    runAgent: RunAgentArtifactManifest;
    runAgentAdapterId: string;
    continuityLevel: string;
    sessionHandle: string;
    runIds: string[];
    implementationRuns: Array<Record<string, unknown>>;
    runManifest?: RuhrohRunManifest | undefined;
    evalResult?: RuhrohEvalResult | undefined;
    artifactPaths?: Record<string, string> | undefined;
    failure_details?: Record<string, unknown> | undefined;
}
export interface RuhrohVerdict {
    status: "completed" | "failed";
    failure_kind: string;
    score: number;
}
export interface RuhrohRunSummary {
    scenarioId: string;
    runId?: string | undefined;
    adapter: string;
    status: RuhrohLoopResult["status"];
    evalStatus: RuhrohEvalStatus;
    failureBucket: string;
    score: number;
    iterationsUsed: number;
    durationMs: number;
    finalSummary: string;
    implementationTimeline: RuhrohImplementationStepSummary[];
    unmetCriteria: string[];
    criteriaResults: RuhrohEvalCriterionResult[];
    evidenceRefs: RuhrohEvidenceRef[];
    subscores: RuhrohEvalSubscores;
    commandsRun: RuhrohEvalCommandRecord[];
    evalJudge?: RuhrohEvalJudge | undefined;
    evalJudgeVotes: RuhrohEvalJudgeVote[];
    evalJudgeAgreement?: RuhrohEvalJudgeAgreement | undefined;
    artifactPaths: Record<string, string>;
    artifactInventory: RuhrohRunArtifactInventoryItem[];
    artifactCompletenessWarnings: string[];
    usage?: RuhrohRunUsage | undefined;
    sample?: RuhrohRunSample | undefined;
    evalQualityWarnings: string[];
    humanReviewRequired: boolean;
    runManifest?: RuhrohRunManifest | undefined;
}
export interface RuhrohRunArtifactInventoryItem {
    name: string;
    path: string;
    available: boolean;
    sizeBytes?: number | undefined;
    sha256?: string | undefined;
    error?: "missing" | "not_file" | "unreadable" | undefined;
}
export interface RuhrohRunUsage {
    costUsd?: number | undefined;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    totalTokens?: number | undefined;
}
export interface RuhrohReviewQueueItem {
    scenarioId: string;
    adapter: string;
    runId?: string | undefined;
    status: RuhrohLoopResult["status"];
    evalStatus: RuhrohEvalStatus;
    score: number;
    failureBucket: string;
    priority: "required" | "recommended";
    reasons: string[];
    evalQualityWarnings: string[];
    artifactCompletenessWarnings: string[];
    unmetCriteria: string[];
    finalSummary: string;
    artifactPaths: Record<string, string>;
    transcriptPaths: string[];
    eventLogPaths: string[];
}
export interface RuhrohBenchmarkClaimReadiness {
    scope: "suite" | "ad_hoc_compare";
    publishable: boolean;
    blockers: string[];
    advisories: string[];
}
export interface RuhrohBenchmarkClaimSuiteSummary {
    id: string;
    title: string;
    suiteVersion: string;
    scenarioIds: string[];
    scenarioVersions: Record<string, string>;
    minRuns: number;
    retryPolicy: string;
}
export interface RuhrohBenchmarkClaimAdapterSummary {
    adapter: string;
    scenarioCount: number;
    runs: number;
    passes: number;
    runWeightedPassRate: number;
    runWeightedPassRateCi95: RuhrohConfidenceInterval;
    meanScenarioPassRate: number;
    usage: RuhrohAggregateUsage;
    minRunsSatisfied?: boolean | undefined;
    warnings: string[];
}
export interface RuhrohBenchmarkClaimSuiteCoverage {
    expectedScenarios: number;
    coveredScenarios: number;
    missingScenarioIds: string[];
    minRunsSatisfied: boolean;
    adapters: RuhrohBenchmarkClaimSuiteCoverageAdapter[];
}
export interface RuhrohBenchmarkClaimSuiteCoverageAdapter {
    adapter: string;
    expectedScenarios: number;
    coveredScenarios: number;
    missingScenarioIds: string[];
    scenarioRuns: Record<string, number>;
    minRunsSatisfied: boolean;
    warnings: string[];
}
export interface RuhrohBenchmarkClaimScenarioResult {
    scenarioId: string;
    adapter: string;
    runs: number;
    passes: number;
    passRate: number;
    passRateCi95: RuhrohConfidenceInterval;
    passAtK: Record<string, number>;
    meanScore: number;
    meanScoreCi95: RuhrohConfidenceInterval;
    usage: RuhrohAggregateUsage;
    reviewRequired: number;
    statisticalWarnings: string[];
}
export interface RuhrohBenchmarkClaimToolSummary {
    name: string;
    version?: string | undefined;
}
export interface RuhrohBenchmarkClaimSource {
    resultsPath?: string | undefined;
    suitePath?: string | undefined;
    suiteSha256?: string | undefined;
    runPlanPath?: string | undefined;
    runPlanSha256?: string | undefined;
    htmlPath?: string | undefined;
    benchmarkClaimPath?: string | undefined;
    benchmarkSummaryPath?: string | undefined;
    resultArtifacts?: RuhrohBenchmarkClaimResultArtifact[] | undefined;
}
export interface RuhrohBenchmarkClaimResultArtifact {
    path: string;
    sha256: string;
    scenarioId: string;
    adapter: string;
    runId?: string | undefined;
    sampleId?: string | undefined;
    scenarioVersion?: string | undefined;
    artifactInventory?: RuhrohBenchmarkClaimReferencedArtifact[] | undefined;
}
export interface RuhrohBenchmarkClaimReferencedArtifact {
    name: string;
    path: string;
    available: boolean;
    sizeBytes?: number | undefined;
    sha256?: string | undefined;
    error?: "missing" | "not_file" | "unreadable" | undefined;
}
export interface RuhrohBenchmarkClaimExport {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/benchmark-claim-v1.schema.json";
    version: "ruhroh_benchmark_claim_v1";
    createdAt: string;
    tool: RuhrohBenchmarkClaimToolSummary;
    source?: RuhrohBenchmarkClaimSource | undefined;
    scope: RuhrohBenchmarkClaimReadiness["scope"];
    publishable: boolean;
    suite?: RuhrohBenchmarkClaimSuiteSummary | undefined;
    methodology: {
        confidenceLevel: 0.95;
        statisticalMethods: Array<"wilson_pass_rate_ci" | "normal_approximation_pass_rate_delta_ci" | "fisher_exact_two_sided" | "pass_at_k" | "bootstrap_mean_score_ci">;
        minRuns?: number | undefined;
        retryPolicy?: string | undefined;
    };
    summary: {
        scenarioCount: number;
        adapterCount: number;
        totalRuns: number;
        totalPasses: number;
        runWeightedPassRate: number;
        runWeightedPassRateCi95: RuhrohConfidenceInterval;
        reviewRequired: number;
        reviewRecommended: number;
        pairwiseComparisonCount: number;
    };
    adapterSummaries: RuhrohBenchmarkClaimAdapterSummary[];
    suiteCoverage?: RuhrohBenchmarkClaimSuiteCoverage | undefined;
    scenarioResults: RuhrohBenchmarkClaimScenarioResult[];
    pairwiseComparisons: RuhrohPairwiseAdapterComparison[];
    readiness: RuhrohBenchmarkClaimReadiness;
    evidence: {
        runPlanPresent: boolean;
        runPlanWarnings: string[];
        artifactValidationErrors: number;
        artifactValidationWarnings: number;
        artifactCompletenessWarnings: number;
        reviewQueueItems: number;
        requiredReviewItems: number;
        recommendedReviewItems: number;
    };
}
export interface RuhrohBenchmarkSummaryExport {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/benchmark-summary-v1.schema.json";
    version: "ruhroh_benchmark_summary_v1";
    createdAt: string;
    claimVersion: RuhrohBenchmarkClaimExport["version"];
    tool: RuhrohBenchmarkClaimToolSummary;
    source?: RuhrohBenchmarkClaimSource | undefined;
    scope: RuhrohBenchmarkClaimReadiness["scope"];
    publishable: boolean;
    suite?: RuhrohBenchmarkClaimSuiteSummary | undefined;
    summary: RuhrohBenchmarkClaimExport["summary"];
    readiness: RuhrohBenchmarkClaimReadiness;
    evidence: RuhrohBenchmarkClaimExport["evidence"];
    rows: RuhrohBenchmarkSummaryRow[];
}
export interface RuhrohBenchmarkSummaryRow {
    suiteId?: string | undefined;
    suiteVersion?: string | undefined;
    scope: RuhrohBenchmarkClaimReadiness["scope"];
    publishable: boolean;
    scenarioId: string;
    adapter: string;
    runs: number;
    passes: number;
    passRate: number;
    passRateCi95: RuhrohConfidenceInterval;
    passAtK: Record<string, number>;
    meanScore: number;
    meanScoreCi95: RuhrohConfidenceInterval;
    usage: RuhrohAggregateUsage;
    reviewRequired: number;
    statisticalWarnings: string[];
}
export interface RuhrohBenchmarkClaimValidationResult {
    version: "ruhroh_benchmark_claim_validation_v1";
    errors: string[];
    warnings: string[];
}
export interface RuhrohBenchmarkSummaryValidationResult {
    version: "ruhroh_benchmark_summary_validation_v1";
    errors: string[];
    warnings: string[];
}
export interface SummarizeRuhrohClaimReadinessOptions {
    suiteId?: string | undefined;
    suiteWarnings?: readonly string[] | undefined;
    suiteAdapterSummaries?: readonly RuhrohSuiteAdapterSummary[] | undefined;
    pairwiseComparisons?: readonly RuhrohPairwiseAdapterComparison[] | undefined;
    runPlanWarnings?: readonly string[] | undefined;
    artifactValidationErrors?: number | undefined;
    artifactValidationWarnings?: number | undefined;
    reviewQueue?: readonly RuhrohReviewQueueItem[] | undefined;
}
export interface SummarizeRuhrohBenchmarkClaimOptions {
    createdAt?: string | undefined;
    tool?: RuhrohBenchmarkClaimToolSummary | undefined;
    source?: RuhrohBenchmarkClaimSource | undefined;
    suite?: RuhrohBenchmarkClaimSuiteSummary | undefined;
    suiteAdapterSummaries?: readonly RuhrohSuiteAdapterSummary[] | undefined;
    pairwiseComparisons?: readonly RuhrohPairwiseAdapterComparison[] | undefined;
    reviewQueue?: readonly RuhrohReviewQueueItem[] | undefined;
    claimReadiness: RuhrohBenchmarkClaimReadiness;
    runPlanPresent?: boolean | undefined;
    runPlanWarnings?: readonly string[] | undefined;
    artifactValidationErrors?: number | undefined;
    artifactValidationWarnings?: number | undefined;
}
export interface RuhrohImplementationStepSummary {
    iteration: number;
    adapterId?: string | undefined;
    status: string;
    failureKind?: string | undefined;
    completionState?: string | undefined;
    stopReason?: string | undefined;
    runId?: string | undefined;
    transcriptPath?: string | undefined;
    eventLogPath?: string | undefined;
    artifactPaths: Record<string, string>;
    notes?: string | undefined;
}
export interface RuhrohConfidenceInterval {
    method: "wilson" | "normal_approximation" | "bootstrap_percentile";
    confidenceLevel: 0.95;
    lower: number;
    upper: number;
}
export interface RuhrohPairwiseSignificance {
    method: "fisher_exact_two_sided";
    alpha: 0.05;
    pValue: number;
    significant: boolean;
}
export interface RuhrohAggregateRunGroup {
    scenarioId: string;
    adapter: string;
    cohort: RuhrohAggregateCohort;
    runs: number;
    passes: number;
    passRate: number;
    passRateCi95: RuhrohConfidenceInterval;
    passAtK: Record<string, number>;
    meanScore: number;
    meanScoreCi95: RuhrohConfidenceInterval;
    meanSubscores: RuhrohEvalSubscores;
    medianDurationMs: number;
    iterationDistribution: Record<string, number>;
    failureBuckets: Record<string, number>;
    reviewRequired: number;
    evalQualityWarnings: Record<string, number>;
    artifactCompletenessWarnings: Record<string, number>;
    usage: RuhrohAggregateUsage;
    statisticalWarnings: string[];
}
export interface RuhrohPairwiseAdapterComparison {
    scenarioId: string;
    baselineAdapter: string;
    contenderAdapter: string;
    baselineRuns: number;
    contenderRuns: number;
    baselinePasses: number;
    contenderPasses: number;
    baselinePassRate: number;
    contenderPassRate: number;
    passRateDelta: number;
    passRateDeltaCi95: RuhrohConfidenceInterval;
    significance: RuhrohPairwiseSignificance;
    conclusion: "baseline_higher" | "contender_higher" | "inconclusive";
    warnings: string[];
}
export interface AggregateRuhrohRunsOptions {
    minRuns?: number | undefined;
    expectedScenarioVersions?: Readonly<Record<string, string>> | undefined;
}
export interface RuhrohSuiteAdapterSummary {
    adapter: string;
    expectedScenarios: number;
    coveredScenarios: number;
    missingScenarioIds: string[];
    runs: number;
    passes: number;
    runWeightedPassRate: number;
    runWeightedPassRateCi95: RuhrohConfidenceInterval;
    meanScenarioPassRate: number;
    scenarioRuns: Record<string, number>;
    minRunsSatisfied: boolean;
    warnings: string[];
}
export interface SummarizeRuhrohSuiteAdaptersOptions {
    scenarioIds: readonly string[];
    minRuns: number;
}
export interface RuhrohAggregateCohort {
    sampleIds: string[];
    sampleSeeds: string[];
    scenarioVersions: string[];
    adapterVersions: string[];
    agentModels: string[];
    agentPromptVersions: string[];
    evaluatorModels: string[];
    evaluatorPromptVersions: string[];
    evaluatorInputSignatures: string[];
    judgeIdentities: string[];
    environmentFingerprints: string[];
    comparabilityWarnings: string[];
}
export interface RuhrohAggregateUsage {
    runsWithUsage: number;
    runsWithCost: number;
    runsWithTokens: number;
    totalCostUsd?: number | undefined;
    meanCostUsd?: number | undefined;
    costPerPass?: number | undefined;
    totalTokens?: number | undefined;
    meanTotalTokens?: number | undefined;
    tokensPerPass?: number | undefined;
}
export declare function scoreForEvalStatus(status: RuhrohEvalStatus): number;
export declare function normalizeRuhrohEvalResult(input: unknown): RuhrohEvalResult;
export declare function assessRuhrohEvalQuality(evalResult: RuhrohEvalResult): string[];
export declare function assessRuhrohArtifactCompleteness(run: RuhrohLoopResult): string[];
export declare function inventoryRuhrohArtifacts(artifactPaths: Record<string, string>): RuhrohRunArtifactInventoryItem[];
export declare function summarizeRuhrohRun(run: RuhrohLoopResult): RuhrohRunSummary;
export declare function readImplementationTimeline(runs: Array<Record<string, unknown>>): RuhrohImplementationStepSummary[];
export declare function aggregateRuhrohRuns(runs: RuhrohLoopResult[], options?: AggregateRuhrohRunsOptions): RuhrohAggregateRunGroup[];
export declare function summarizeRuhrohPairwiseAdapterComparisons(groups: RuhrohAggregateRunGroup[], options?: {
    minRuns?: number | undefined;
}): RuhrohPairwiseAdapterComparison[];
export declare function summarizeRuhrohSuiteAdapters(groups: RuhrohAggregateRunGroup[], options: SummarizeRuhrohSuiteAdaptersOptions): RuhrohSuiteAdapterSummary[];
export declare function summarizeRuhrohReviewQueue(summaries: RuhrohRunSummary[]): RuhrohReviewQueueItem[];
export declare function summarizeRuhrohBenchmarkClaimReadiness(groups: RuhrohAggregateRunGroup[], options?: SummarizeRuhrohClaimReadinessOptions): RuhrohBenchmarkClaimReadiness;
export declare function summarizeRuhrohBenchmarkClaim(groups: RuhrohAggregateRunGroup[], options: SummarizeRuhrohBenchmarkClaimOptions): RuhrohBenchmarkClaimExport;
export declare function summarizeRuhrohBenchmarkSummary(claim: RuhrohBenchmarkClaimExport): RuhrohBenchmarkSummaryExport;
export declare function validateRuhrohBenchmarkClaim(input: unknown): RuhrohBenchmarkClaimValidationResult;
export declare function validateRuhrohBenchmarkSummary(input: unknown): RuhrohBenchmarkSummaryValidationResult;
export declare function readRunUsage(value: unknown): RuhrohRunUsage | undefined;
export declare function mapEvalResultToVerdict(evalResult: Pick<RuhrohEvalResult, "status">): RuhrohVerdict;
export declare function mapRuntimeFailureToVerdict(implementationRuns: Array<{
    status?: string | undefined;
    failureKind?: string | undefined;
}>, options?: {
    ignoredFailureKinds?: string[] | undefined;
}): RuhrohVerdict | undefined;
export declare function deriveRuhrohVerdict(implementationRuns: Array<{
    status?: string | undefined;
    failureKind?: string | undefined;
}>, evalResult: Pick<RuhrohEvalResult, "status">, options?: {
    ignoredFailureKinds?: string[] | undefined;
}): RuhrohVerdict;
//# sourceMappingURL=results.d.ts.map