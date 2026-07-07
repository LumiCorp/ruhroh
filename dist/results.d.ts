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
}
export interface RuhrohLoopResult {
    version: "ruhroh_loop_result_v1";
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
    adapter: string;
    status: RuhrohLoopResult["status"];
    evalStatus: RuhrohEvalStatus;
    failureBucket: string;
    score: number;
    iterationsUsed: number;
    durationMs: number;
    finalSummary: string;
    unmetCriteria: string[];
    criteriaResults: RuhrohEvalCriterionResult[];
    subscores: RuhrohEvalSubscores;
    commandsRun: RuhrohEvalCommandRecord[];
    artifactPaths: Record<string, string>;
}
export interface RuhrohAggregateRunGroup {
    scenarioId: string;
    adapter: string;
    runs: number;
    passes: number;
    passRate: number;
    meanScore: number;
    meanSubscores: RuhrohEvalSubscores;
    medianDurationMs: number;
    iterationDistribution: Record<string, number>;
    failureBuckets: Record<string, number>;
}
export declare function scoreForEvalStatus(status: RuhrohEvalStatus): number;
export declare function normalizeRuhrohEvalResult(input: unknown): RuhrohEvalResult;
export declare function summarizeRuhrohRun(run: RuhrohLoopResult): RuhrohRunSummary;
export declare function aggregateRuhrohRuns(runs: RuhrohLoopResult[]): RuhrohAggregateRunGroup[];
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