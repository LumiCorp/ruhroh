export type RuhrohFocusReleaseStatus = "ratified" | "preview";
export type RuhrohFocusDatasetIdV1 = "CostAndUsage" | "BillingPeriod" | "InvoiceDetail" | "ContractCommitment";
export type RuhrohFocusValidationStatus = "passed" | "failed" | "unavailable";
export type RuhrohFocusReadiness = "draft" | "review_required" | "ready";
export interface RuhrohFocusHashedRefV1 {
    path: string;
    sha256: string;
}
export interface RuhrohFocusSpecLockV1 {
    version: "ruhroh_focus_spec_lock_v1";
    profileId: string;
    focusVersion: string;
    releaseStatus: RuhrohFocusReleaseStatus;
    specification: {
        repository: string;
        ref: string;
        commitSha: string;
        releaseAssets: Array<RuhrohFocusHashedRefV1 & {
            name: string;
            upstreamDigest: string;
        }>;
        model: RuhrohFocusHashedRefV1;
    };
    validator: {
        repository: string;
        version: string;
        commitSha: string;
    };
    datasets: RuhrohFocusDatasetIdV1[];
    retrievedAt: string;
}
export interface RuhrohFocusCatalogColumnV1 {
    columnId: string;
    dataType: string;
    requirement: "mandatory" | "conditional" | "optional";
    applicabilityCriteria: string[];
    ruleIds: string[];
}
export interface RuhrohFocusCatalogV1 {
    version: "ruhroh_focus_catalog_v1";
    catalogId: string;
    focusVersion: string;
    modelRef: RuhrohFocusHashedRefV1;
    /** Catalogs may describe future datasets. Runtime import remains limited to RuhrohFocusDatasetIdV1. */
    datasets: Array<{
        dataset: string;
        columns: RuhrohFocusCatalogColumnV1[];
        ruleIds: string[];
    }>;
}
export type RuhrohFocusMappingDisposition = "mapped" | "preserved_only" | "unsupported";
export type RuhrohFocusNeutralBillingFieldV2 = "amountDecimal" | "currency" | "kind" | "occurredAt" | "sku";
export interface RuhrohFocusMappingEntryV1 {
    sourceColumn: string;
    disposition: RuhrohFocusMappingDisposition;
    destinationField?: RuhrohFocusNeutralBillingFieldV2 | undefined;
    transform?: "decimal_string" | "currency_code" | "charge_category_to_kind" | "timestamp" | "string" | undefined;
    requirementIds: string[];
    fixtureIds: string[];
    economicallyMaterial: boolean;
    reason?: string | undefined;
}
export interface RuhrohFocusMappingPackV1 {
    version: "ruhroh_focus_mapping_pack_v1";
    mappingPackId: string;
    focusVersion: "1.4";
    dataset: "CostAndUsage";
    specLockRef: RuhrohFocusHashedRefV1;
    catalogRef: RuhrohFocusHashedRefV1;
    mappings: RuhrohFocusMappingEntryV1[];
    unsupportedConcepts: string[];
}
export interface RuhrohFocusConformanceProfileV1 {
    version: "ruhroh_focus_conformance_profile_v1";
    profileId: string;
    focusVersion: "1.4";
    modelSha256: string;
    applicabilityCriteria: string[];
    allowedSkips: Array<{
        ruleId: string;
        reason: string;
        reviewRef: RuhrohFocusHashedRefV1;
    }>;
}
export interface RuhrohFocusRuleResultV1 {
    ruleId: string;
    status: "passed" | "failed" | "skipped" | "error";
    count: number;
    message?: string | undefined;
}
export interface RuhrohFocusConformanceReportV1 {
    version: "ruhroh_focus_conformance_report_v1";
    reportId: string;
    createdAt: string;
    focusVersion: string;
    releaseStatus: RuhrohFocusReleaseStatus;
    dataset: RuhrohFocusDatasetIdV1;
    inputRef: RuhrohFocusHashedRefV1;
    specLockRef: RuhrohFocusHashedRefV1;
    conformanceProfileRef: RuhrohFocusHashedRefV1;
    validator: {
        repository: string;
        version: string;
        commitSha: string;
        executable: string;
    };
    status: RuhrohFocusValidationStatus;
    requirements: {
        evaluated: number;
        passed: number;
        failed: number;
        skipped: number;
        errors: number;
    };
    rules: RuhrohFocusRuleResultV1[];
    blockers: string[];
}
export interface RuhrohFocusDatasetBundleV1 {
    version: "ruhroh_focus_dataset_bundle_v1";
    bundleId: string;
    focusVersion: "1.4";
    createdAt: string;
    datasets: Array<{
        dataset: RuhrohFocusDatasetIdV1;
        format: "csv" | "parquet" | "records";
        sourceRef: RuhrohFocusHashedRefV1;
        rowCount: number;
    }>;
    relationships: Array<{
        relationship: "cost_to_invoice_detail" | "cost_to_billing_period" | "cost_to_contract_commitment";
        referenced: number;
        matched: number;
        missing: number;
        ambiguous: number;
    }>;
    privacyClassification: "restricted";
    blockers: string[];
}
export interface RuhrohFocusAttributionProfileV1 {
    version: "ruhroh_focus_attribution_profile_v1";
    profileId: string;
    provider: string;
    focusVersion: "1.4";
    sourceSelectors: Array<{
        sourceColumn: string;
        destination: "providerRequestId" | "workloadId" | "principalRef" | "model";
        transform: "identity" | "sha256" | "tag_value";
    }>;
    privacyClassification: "restricted";
}
export interface RuhrohFocusImportReportV1 {
    version: "ruhroh_focus_import_report_v1";
    reportId: string;
    createdAt: string;
    focusVersion: string;
    releaseStatus: RuhrohFocusReleaseStatus;
    bundleRef: RuhrohFocusHashedRefV1;
    specLockRef: RuhrohFocusHashedRefV1;
    mappingPackRef: RuhrohFocusHashedRefV1;
    conformanceReportRefs: RuhrohFocusHashedRefV1[];
    datasets: Array<{
        dataset: RuhrohFocusDatasetIdV1;
        sourceRows: number;
        acceptedRows: number;
        rejectedRows: number;
        unknownColumns: string[];
    }>;
    currencies: Array<{
        currency: string;
        sourceAmountDecimal: string;
        normalizedAmountDecimal: string;
        differenceDecimal: string;
    }>;
    normalizedRowsRef?: RuhrohFocusHashedRefV1 | undefined;
    relationshipCoverage: RuhrohFocusDatasetBundleV1["relationships"];
    readiness: RuhrohFocusReadiness;
    blockers: string[];
}
export type RuhrohFocusChangeClassification = "editorial" | "additive_optional" | "additive_conditional" | "additive_mandatory" | "type_scale_unit_currency_nullability_applicability" | "rename_deprecation_removal" | "normative" | "dataset" | "validator";
export interface RuhrohFocusUpdateReviewV1 {
    version: "ruhroh_focus_update_review_v1";
    reviewId: string;
    createdAt: string;
    fromSpecLockRef: RuhrohFocusHashedRefV1;
    toSpecLockRef: RuhrohFocusHashedRefV1;
    candidateReleaseStatus: RuhrohFocusReleaseStatus;
    changes: Array<{
        id: string;
        classification: RuhrohFocusChangeClassification;
        sourcePath: string;
        summary: string;
        impactedMappings: string[];
        requiresHumanReview: boolean;
    }>;
    generatedRefs: RuhrohFocusHashedRefV1[];
    unresolvedDecisions: string[];
    verification: Array<{
        name: string;
        status: "passed" | "failed" | "not_run";
        evidence?: RuhrohFocusHashedRefV1 | undefined;
    }>;
    recommendation: "no_change" | "review_required" | "reject";
}
export declare function validateRuhrohFocusSpecLock(value: unknown): string[];
export declare function validateRuhrohFocusCatalog(value: unknown): string[];
export declare function validateRuhrohFocusMappingPack(value: unknown): string[];
export declare function validateRuhrohFocusConformanceProfile(value: unknown): string[];
export declare function validateRuhrohFocusConformanceReport(value: unknown): string[];
export declare function validateRuhrohFocusDatasetBundle(value: unknown): string[];
export declare function validateRuhrohFocusAttributionProfile(value: unknown): string[];
export declare function validateRuhrohFocusImportReport(value: unknown): string[];
export declare function validateRuhrohFocusUpdateReview(value: unknown): string[];
export declare const RUHROH_FOCUS_1_4_DATASETS: readonly RuhrohFocusDatasetIdV1[];
export declare function validateRuhrohFocusRef(value: unknown, label?: string): string[];
export declare function isRuhrohFocusDatasetId(value: unknown): value is RuhrohFocusDatasetIdV1;
//# sourceMappingURL=focus-contracts.d.ts.map