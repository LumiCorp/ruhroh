import type { RuhrohScenarioEvaluationCalibrationSummary, RuhrohScenarioEvaluationLintDiagnostic, RuhrohScenarioDifficulty, RuhrohScenarioKind, RuhrohScenarioTier } from "./scenarios.js";
export interface InspectRuhrohBenchmarkPackInput {
    scenarioDir: string;
    suiteDir?: string | undefined;
    requireFullCalibration?: boolean | undefined;
    requireRiskReviewed?: boolean | undefined;
}
export interface RuhrohBenchmarkPackInspection {
    version: "ruhroh_benchmark_pack_inspection_v1";
    source: {
        scenarioDir: string;
        suiteDir?: string | undefined;
    };
    requirements: {
        requireFullCalibration: boolean;
        requireRiskReviewed: boolean;
    };
    ready: boolean;
    blockers: string[];
    warnings: string[];
    summary: {
        scenarioCount: number;
        validScenarioCount: number;
        invalidScenarioCount: number;
        suiteCount: number;
        validSuiteCount: number;
        invalidSuiteCount: number;
        calibrationWarningCount: number;
        riskReviewWarningCount: number;
        difficultyCounts: RuhrohBenchmarkPackDifficultyCounts;
        runtimeEstimate: RuhrohBenchmarkPackRuntimeEstimate;
    };
    scenarios: RuhrohBenchmarkPackScenarioInspection[];
    suites: RuhrohBenchmarkPackSuiteInspection[];
}
export interface RuhrohBenchmarkPackScenarioInspection {
    id?: string | undefined;
    title?: string | undefined;
    tier?: RuhrohScenarioTier | undefined;
    kind?: RuhrohScenarioKind | undefined;
    sourcePath: string;
    content: RuhrohBenchmarkPackScenarioContentInspection;
    scenarioVersion?: string | undefined;
    visibility?: string | undefined;
    difficulty?: string | undefined;
    expectedRuntimeSeconds?: number | undefined;
    tags: string[];
    lifecycleStatus?: string | undefined;
    valid: boolean;
    errors: string[];
    warnings: string[];
    warningDetails: RuhrohScenarioEvaluationLintDiagnostic[];
    riskReview: RuhrohBenchmarkPackScenarioRiskReview;
    calibration?: RuhrohScenarioEvaluationCalibrationSummary | undefined;
}
export interface RuhrohBenchmarkPackScenarioContentInspection {
    scenarioPath: string;
    scenarioSha256?: string | undefined;
    promptPath?: string | undefined;
    promptSha256?: string | undefined;
    assetFingerprints: RuhrohBenchmarkPackContentFingerprint[];
    privateAssetFingerprints: RuhrohBenchmarkPackContentFingerprint[];
}
export interface RuhrohBenchmarkPackContentFingerprint {
    path: string;
    sourcePath: string;
    status: "ok" | "missing" | "unsupported";
    kind?: "file" | "directory" | undefined;
    fileCount?: number | undefined;
    sizeBytes?: number | undefined;
    sha256?: string | undefined;
    error?: string | undefined;
}
export interface RuhrohBenchmarkPackScenarioRiskReview {
    contaminationNotes?: string | undefined;
    status: "documented" | "needs_review";
    warnings: string[];
}
export interface RuhrohBenchmarkPackSuiteInspection {
    id?: string | undefined;
    title?: string | undefined;
    suiteVersion?: string | undefined;
    sourcePath: string;
    scenarioIds: string[];
    minRuns?: number | undefined;
    owner?: string | undefined;
    valid: boolean;
    errors: string[];
    warnings: string[];
    riskReview: RuhrohBenchmarkPackSuiteRiskReview;
    difficultyCounts: RuhrohBenchmarkPackDifficultyCounts;
    runtimeEstimate: RuhrohBenchmarkPackRuntimeEstimate;
    estimatedCollectionSeconds?: number | undefined;
}
export interface RuhrohBenchmarkPackSuiteRiskReview {
    contaminationReview?: string | undefined;
    rewardHackingReview?: string | undefined;
    status: "documented" | "needs_review";
    warnings: string[];
}
export type RuhrohBenchmarkPackDifficultyLabel = RuhrohScenarioDifficulty | "unknown";
export type RuhrohBenchmarkPackDifficultyCounts = Record<RuhrohBenchmarkPackDifficultyLabel, number>;
export interface RuhrohBenchmarkPackRuntimeEstimate {
    knownScenarioCount: number;
    unknownScenarioCount: number;
    totalExpectedRuntimeSeconds: number;
    minExpectedRuntimeSeconds?: number | undefined;
    maxExpectedRuntimeSeconds?: number | undefined;
}
export declare function inspectRuhrohBenchmarkPack(input: InspectRuhrohBenchmarkPackInput): RuhrohBenchmarkPackInspection;
//# sourceMappingURL=pack.d.ts.map