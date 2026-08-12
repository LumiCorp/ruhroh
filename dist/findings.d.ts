export declare const RUHROH_FINDING_DETECTORS: readonly ["context_amplification", "retry_loop_amplification", "unnecessary_reasoning", "cache_misuse", "rework", "unpinned_model_alias"];
export type RuhrohFindingDetectorId = typeof RUHROH_FINDING_DETECTORS[number];
export type RuhrohFindingStatus = "confirmed" | "candidate" | "not_observable";
export interface RuhrohFindingEvidenceRefV1 {
    artifact: string;
    sha256: string;
    pointer?: string | undefined;
}
export interface RuhrohFindingMeasurementsV1 {
    turnInputTokens?: number[] | undefined;
    repeatedInputTokens?: number | undefined;
    equivalentRetryCount?: number | undefined;
    retryCount?: number | undefined;
    reasoningTokens?: number | undefined;
    lowerReasoningTokens?: number | undefined;
    cacheEligibleInputTokens?: number | undefined;
    cachedInputTokens?: number | undefined;
    revertedOrReplacedChanges?: number | undefined;
    observedModelFingerprints?: string[] | undefined;
    [key: string]: number | number[] | string[] | undefined;
}
export interface RuhrohFindingAssessmentInput {
    detectorId: RuhrohFindingDetectorId;
    detectorVersion?: string | undefined;
    scope: {
        benchmarkTargetId: string;
        scenarioId?: string | undefined;
        runIds: string[];
    };
    measurements: RuhrohFindingMeasurementsV1;
    evidenceRefs: RuhrohFindingEvidenceRefV1[];
    counterEvidence?: string[] | undefined;
    confounders?: string[] | undefined;
    controlledCountercase?: {
        present: boolean;
        equalQuality: boolean;
        relevantCoverageComplete: boolean;
        evidenceRefs: RuhrohFindingEvidenceRefV1[];
    } | undefined;
}
export interface RuhrohFindingV1 {
    version: "ruhroh_finding_v1";
    id: string;
    detectorId: RuhrohFindingDetectorId;
    detectorVersion: string;
    status: RuhrohFindingStatus;
    scope: RuhrohFindingAssessmentInput["scope"];
    signature: string;
    measurements: RuhrohFindingMeasurementsV1;
    evidenceRefs: RuhrohFindingEvidenceRefV1[];
    counterEvidence: string[];
    confounders: string[];
    confidence: "none" | "low" | "medium" | "high";
    suggestedExperiment: string;
    confirmationChecks: {
        signatureObserved: boolean;
        controlledCountercase: boolean;
        equalQuality: boolean;
        relevantCoverageComplete: boolean;
    };
}
export interface RuhrohFindingsV1 {
    version: "ruhroh_findings_v1";
    createdAt: string;
    findings: RuhrohFindingV1[];
    counts: Record<RuhrohFindingStatus, number>;
}
export declare function assessRuhrohFinding(input: RuhrohFindingAssessmentInput): RuhrohFindingV1;
export declare function buildRuhrohFindings(inputs: readonly RuhrohFindingAssessmentInput[], createdAt?: string): RuhrohFindingsV1;
export declare function validateRuhrohFindings(value: unknown): string[];
//# sourceMappingURL=findings.d.ts.map