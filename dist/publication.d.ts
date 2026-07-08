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
export interface BuildRuhrohPublishCheckReportInput {
    source: RuhrohPublishCheckSource;
    compare: Record<string, unknown>;
    sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
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
export declare function buildRuhrohPublishCheckReport(input: BuildRuhrohPublishCheckReportInput): RuhrohPublishCheckReport;
export declare function ruhrohPublishCheckRemediationCatalog(): RuhrohPublishCheckRemediation[];
export declare function ruhrohPublishCheckRemediationForBlocker(blocker: string): RuhrohPublishCheckRemediation;
export declare function verifyRuhrohBenchmarkClaimSources(claim: Record<string, unknown>, claimPath: string): RuhrohClaimSourceVerificationReport;
export declare function validateRuhrohPublishBundle(inputPath: string): RuhrohPublishBundleValidationReport;
//# sourceMappingURL=publication.d.ts.map