export type RuhrohProviderDriftClassification = "identity_drift" | "quality_regression" | "latency_regression" | "price_change" | "consumption_change" | "inconclusive" | "confounded" | "no_drift";
export interface RuhrohProviderBaselineControlsV1 {
    suiteId: string;
    suiteVersion: string;
    scenarioVersions: Record<string, string>;
    benchmarkTargetId: string;
    harnessId: string;
    harnessVersion?: string | undefined;
    providerPath: string;
    promptHash: string;
    evaluatorSignature: string;
    judgeIdentity: string;
    environmentPolicyHash: string;
}
export interface RuhrohProviderDriftMarginsV1 {
    qualityPassRateDelta: number;
    latencyRatio: number;
    consumptionRatio: number;
    priceRatio: number;
}
export interface RuhrohProviderMetricSnapshotV1 {
    passRate: number;
    passRateCi95: {
        lower: number;
        upper: number;
    };
    p95ImplementationWallTimeMs?: number | undefined;
    p95ImplementationWallTimeRatioCi95?: {
        lower: number;
        upper: number;
    } | undefined;
    tokensPerAcceptedOutcome?: number | undefined;
    tokenRatioCi95?: {
        lower: number;
        upper: number;
    } | undefined;
    pricePerMillionTokens?: number | undefined;
    priceRatioCi95?: {
        lower: number;
        upper: number;
    } | undefined;
    observedModelFingerprint?: string | undefined;
    sampleCount: number;
    metricTestPValues?: Partial<Record<RuhrohProviderMetricTestId, number>> | undefined;
}
export type RuhrohProviderMetricTestId = "quality" | "latency" | "consumption" | "price";
export interface RuhrohProviderMetricTestResultV1 {
    metric: RuhrohProviderMetricTestId;
    rawPValue: number;
    holmAdjustedPValue: number;
    significant: boolean;
}
export interface RuhrohProviderBaselineV1 {
    version: "ruhroh_provider_baseline_v1";
    baselineId: string;
    createdAt: string;
    controls: RuhrohProviderBaselineControlsV1;
    margins: RuhrohProviderDriftMarginsV1;
    metrics: RuhrohProviderMetricSnapshotV1;
    source: {
        path: string;
        sha256: string;
    };
}
export interface RuhrohProviderDriftReportV1 {
    version: "ruhroh_provider_drift_report_v1";
    baselineId: string;
    classification: RuhrohProviderDriftClassification;
    classifications: RuhrohProviderDriftClassification[];
    confounders: string[];
    evidence: string[];
    margins: RuhrohProviderDriftMarginsV1;
    multipleTesting: {
        method: "holm";
        familySize: number;
        alpha: 0.05;
        results: RuhrohProviderMetricTestResultV1[];
    };
}
export declare function compareRuhrohProviderBaseline(input: {
    baseline: RuhrohProviderBaselineV1;
    currentControls: RuhrohProviderBaselineControlsV1;
    currentMetrics: RuhrohProviderMetricSnapshotV1;
}): RuhrohProviderDriftReportV1;
export declare function holmAdjustRuhrohProviderTests(pValues: Partial<Record<RuhrohProviderMetricTestId, number>>, alpha?: number): RuhrohProviderMetricTestResultV1[];
export declare function validateRuhrohProviderBaseline(value: unknown): string[];
//# sourceMappingURL=drift.d.ts.map