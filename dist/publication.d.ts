import { type RuhrohBenchmarkClaimExportV2, type RuhrohCompareV2 } from "./results.js";
export interface RuhrohPublishCheckSource {
    resultsPath: string;
    suiteId?: string | undefined;
    runPlanPath?: string | undefined;
    rerunLedgerPath?: string | undefined;
    benchmarkClaimPath?: string | undefined;
    benchmarkSummaryPath?: string | undefined;
    htmlPath?: string | undefined;
    summaryMarkdownPath?: string | undefined;
    bundlePath?: string | undefined;
    evaluatorCalibrationReportPath?: string | undefined;
}
export interface RuhrohPublishCheckRemediation {
    code: string;
    category: "suite" | "run_plan" | "artifacts" | "review" | "statistics" | "source_verification" | "claim" | "comparison";
    severity: "blocker" | "advisory";
    blocker: string;
    action: string;
    docs: string;
}
export interface RuhrohPublishCheckReport {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json";
    version: "ruhroh_publish_check_v1";
    source: RuhrohPublishCheckSource;
    publishable: boolean;
    blockerCount: number;
    blockers: string[];
    remediation: RuhrohPublishCheckRemediation[];
    advisoryCount: number;
    advisories: string[];
    compare: Record<string, unknown>;
    sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}
export type RuhrohPublishCheckReportV1 = RuhrohPublishCheckReport;
export interface RuhrohPublishCheckReportV2 {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-check-v2.schema.json";
    version: "ruhroh_publish_check_v2";
    source: RuhrohPublishCheckSource;
    publishable: boolean;
    blockerCount: number;
    blockers: string[];
    remediation: RuhrohPublishCheckRemediation[];
    advisoryCount: number;
    advisories: string[];
    compare: RuhrohCompareV2;
    sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}
export interface BuildRuhrohPublishCheckReportInput {
    source: RuhrohPublishCheckSource;
    compare: Record<string, unknown>;
    sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}
export interface BuildRuhrohPublishCheckReportV2Input {
    source: RuhrohPublishCheckSource;
    compare: RuhrohCompareV2;
    sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}
export interface RuhrohPublicationContractValidationResult {
    version: "ruhroh_publish_check_validation_v1" | "ruhroh_publish_check_validation_v2" | "ruhroh_publish_bundle_manifest_validation_v1" | "ruhroh_publish_bundle_manifest_validation_v2" | "ruhroh_claim_index_validation_v1" | "ruhroh_claim_index_validation_v2";
    errors: string[];
    warnings: string[];
}
export interface RuhrohClaimSourceVerificationCheck {
    name: string;
    status: "ok" | "warning" | "failed";
    details: string;
    path?: string | undefined;
    expectedSha256?: string | undefined;
    actualSha256?: string | undefined;
}
export interface RuhrohClaimSourceVerificationReport {
    version: "ruhroh_claim_source_verification_v1";
    checked: boolean;
    checks: RuhrohClaimSourceVerificationCheck[];
    errors: string[];
    warnings: string[];
}
export interface RuhrohPublishBundleValidationCheck {
    name: string;
    status: "ok" | "warning" | "failed";
    details: string;
    path?: string | undefined;
}
export interface RuhrohPublishBundleValidationReport {
    version: "ruhroh_publish_bundle_validation_report_v1";
    source: {
        bundlePath: string;
    };
    valid: boolean;
    publishable: boolean;
    checks: RuhrohPublishBundleValidationCheck[];
    errors: string[];
    warnings: string[];
}
export interface RuhrohPublishBundleFile {
    role: string;
    path: string;
    description: string;
}
export interface RuhrohPublishBundleSource {
    resultsPath: string;
    bundlePath: string;
    suiteId?: string | undefined;
    runPlanPath?: string | undefined;
    rerunLedgerPath?: string | undefined;
    evaluatorCalibrationReportPath?: string | undefined;
}
export interface RuhrohPublishBundleManifestV1 {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json";
    version: "ruhroh_publish_bundle_v1";
    createdAt: string;
    source: RuhrohPublishBundleSource;
    publishable: boolean;
    blockerCount: number;
    advisoryCount: number;
    files: RuhrohPublishBundleFile[];
}
export interface RuhrohPublishBundleContractsV2 {
    publishCheck: "ruhroh_publish_check_v2";
    compare: "ruhroh_compare_v2";
    benchmarkClaim: "ruhroh_benchmark_claim_v2";
    benchmarkSummary: "ruhroh_benchmark_summary_v2";
    outcomeFrontier: "ruhroh_outcome_frontier_v1";
}
export interface RuhrohPublishBundleManifestV2 {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v2.schema.json";
    version: "ruhroh_publish_bundle_v2";
    createdAt: string;
    source: RuhrohPublishBundleSource;
    publishable: boolean;
    blockerCount: number;
    advisoryCount: number;
    contracts: RuhrohPublishBundleContractsV2;
    files: RuhrohPublishBundleFile[];
}
export interface BuildRuhrohPublishBundleManifestV2Input {
    createdAt?: string | undefined;
    source: RuhrohPublishBundleSource;
    publishCheck: RuhrohPublishCheckReportV2;
    files: readonly RuhrohPublishBundleFile[];
}
export interface RuhrohClaimIndexTargetV2 {
    benchmarkTargetId: string;
    identityStatus: "declared" | "legacy_execution_adapter_fallback";
    executionAdapterIds: string[];
    runs: number;
    acceptedOutcomes: number;
    qualityFloorStatus: "passed" | "failed" | "indeterminate";
    paretoStatus: "pareto" | "dominated" | "ineligible" | "indeterminate";
    robustStatus: "pareto" | "dominated" | "ineligible" | "indeterminate";
}
export interface RuhrohClaimIndexEntryV2 {
    claimPath: string;
    bundlePath?: string | undefined;
    valid: boolean;
    publishable: boolean;
    scope: "suite" | "ad_hoc_compare";
    createdAt: string;
    suite?: {
        id: string;
        title?: string | undefined;
        suiteVersion?: string | undefined;
    } | undefined;
    targets: RuhrohClaimIndexTargetV2[];
    summary: RuhrohBenchmarkClaimExportV2["summary"];
    frontier: {
        status: RuhrohBenchmarkClaimExportV2["outcomeFrontier"]["status"];
        objectives: string[];
        paretoFrontierTargetIds: string[];
        robustFrontierTargetIds: string[];
    };
    evidence: RuhrohBenchmarkClaimExportV2["evidence"];
    sourcePaths: {
        resultsPath?: string | undefined;
        runPlanPath?: string | undefined;
        rerunLedgerPath?: string | undefined;
        suitePath?: string | undefined;
    };
    blockers: string[];
    advisories: string[];
    validationErrors: string[];
    validationWarnings: string[];
}
export interface RuhrohClaimIndexReportV2 {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/claim-index-v2.schema.json";
    version: "ruhroh_claim_index_v2";
    generatedAt: string;
    source: {
        inputPath: string;
        htmlPath?: string | undefined;
    };
    registryReady: boolean;
    registryBlockers: string[];
    claimCount: number;
    publishableCount: number;
    blockedCount: number;
    invalidCount: number;
    suiteCount: number;
    targetCount: number;
    totalRuns: number;
    totalAcceptedOutcomes: number;
    claims: RuhrohClaimIndexEntryV2[];
}
export interface BuildRuhrohClaimIndexEntryV2Input {
    claimPath: string;
    bundlePath?: string | undefined;
    claim: RuhrohBenchmarkClaimExportV2;
}
export interface BuildRuhrohClaimIndexV2Input {
    generatedAt?: string | undefined;
    source: RuhrohClaimIndexReportV2["source"];
    claims: readonly RuhrohClaimIndexEntryV2[];
}
export type RuhrohPublishCheckV2 = RuhrohPublishCheckReportV2;
export type RuhrohPublicationBundleV2 = RuhrohPublishBundleManifestV2;
export type RuhrohPublicationIndexV2 = RuhrohClaimIndexReportV2;
export type RuhrohPublicationArtifactRoleV2 = "publish-check" | "bundle-manifest" | "claim-index" | "compare" | "benchmark-claim" | "benchmark-summary" | "outcome-frontier" | "economic-trace" | "intervention-ledger" | "cost-reconciliation" | "decision-packet";
export interface RuhrohPublicationArtifactReferenceV2 {
    role: RuhrohPublicationArtifactRoleV2;
    path: string;
    sha256: string;
    contractVersion: "ruhroh_publish_check_v2" | "ruhroh_publish_bundle_v2" | "ruhroh_claim_index_v2" | "ruhroh_compare_v2" | "ruhroh_benchmark_claim_v2" | "ruhroh_benchmark_summary_v2" | "ruhroh_outcome_frontier_v1" | "ruhroh_economic_trace_span_v1" | "ruhroh_intervention_ledger_v1" | "ruhroh_cost_reconciliation_v1" | "ruhroh_decision_packet_v1";
}
export interface RuhrohPublicationV2 {
    $schema: "https://lumicorp.github.io/ruhroh/schemas/publication-v2.schema.json";
    version: "ruhroh_publication_v2";
    createdAt: string;
    publishable: boolean;
    artifacts: RuhrohPublicationArtifactReferenceV2[];
}
export interface BuildRuhrohPublicationV2Input {
    createdAt?: string | undefined;
    publishable: boolean;
    artifacts: readonly RuhrohPublicationArtifactReferenceV2[];
}
export interface RuhrohPublicationV2ValidationResult {
    version: "ruhroh_publication_validation_v2";
    errors: string[];
    warnings: string[];
}
export declare function buildRuhrohPublishCheckReport(input: BuildRuhrohPublishCheckReportInput): RuhrohPublishCheckReport;
export declare function buildRuhrohPublishCheckReportV2(input: BuildRuhrohPublishCheckReportV2Input): RuhrohPublishCheckReportV2;
export declare const buildRuhrohPublishCheckV2: typeof buildRuhrohPublishCheckReportV2;
export declare function validateRuhrohPublishCheckReport(input: unknown): RuhrohPublicationContractValidationResult;
export declare function validateRuhrohPublishCheckReportV1(input: unknown): RuhrohPublicationContractValidationResult;
export declare function validateRuhrohPublishCheckReportV2(input: unknown): RuhrohPublicationContractValidationResult;
export declare const validateRuhrohPublishCheckV2: typeof validateRuhrohPublishCheckReportV2;
export declare function ruhrohPublishCheckRemediationCatalog(): RuhrohPublishCheckRemediation[];
export declare function ruhrohPublishCheckRemediationForBlocker(blocker: string): RuhrohPublishCheckRemediation;
export declare function buildRuhrohPublicationV2(input: BuildRuhrohPublicationV2Input): RuhrohPublicationV2;
export declare function validateRuhrohPublicationV2(input: unknown): RuhrohPublicationV2ValidationResult;
export declare function buildRuhrohPublishBundleManifestV2(input: BuildRuhrohPublishBundleManifestV2Input): RuhrohPublishBundleManifestV2;
export declare const buildRuhrohPublicationBundleV2: typeof buildRuhrohPublishBundleManifestV2;
export declare function validateRuhrohPublishBundleManifest(input: unknown): RuhrohPublicationContractValidationResult;
export declare function validateRuhrohPublishBundleManifestV1(input: unknown): RuhrohPublicationContractValidationResult;
export declare function validateRuhrohPublishBundleManifestV2(input: unknown): RuhrohPublicationContractValidationResult;
export declare const validateRuhrohPublicationBundleV2: typeof validateRuhrohPublishBundleManifestV2;
export declare function buildRuhrohClaimIndexEntryV2(input: BuildRuhrohClaimIndexEntryV2Input): RuhrohClaimIndexEntryV2;
export declare function buildRuhrohClaimIndexV2(input: BuildRuhrohClaimIndexV2Input): RuhrohClaimIndexReportV2;
export declare const buildRuhrohPublicationIndexV2: typeof buildRuhrohClaimIndexV2;
export declare function validateRuhrohClaimIndex(input: unknown): RuhrohPublicationContractValidationResult;
export declare function validateRuhrohClaimIndexV1(input: unknown): RuhrohPublicationContractValidationResult;
export declare function validateRuhrohClaimIndexV2(input: unknown): RuhrohPublicationContractValidationResult;
export declare const validateRuhrohPublicationIndexV2: typeof validateRuhrohClaimIndexV2;
export declare function verifyRuhrohBenchmarkClaimSources(claim: Record<string, unknown>, claimPath: string): RuhrohClaimSourceVerificationReport;
export declare function validateRuhrohPublishBundle(inputPath: string): RuhrohPublishBundleValidationReport;
//# sourceMappingURL=publication.d.ts.map