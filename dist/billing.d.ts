import type { RuhrohHashedSourceRefV1 } from "./decision.js";
export type RuhrohBillingFactKind = "charge" | "credit" | "refund" | "commitment" | "tax" | "prepaid" | "capacity";
export type RuhrohBillingMatchClass = "exact" | "bounded" | "allocated" | "ambiguous" | "unmatched";
export interface RuhrohBillingSourceManifestV1 {
    version: "ruhroh_billing_source_manifest_v1";
    sourceId: string;
    format: "csv" | "ndjson" | "records";
    externalSchemaVersion: string;
    billingPeriod: {
        startedAt: string;
        endedAt: string;
    };
    currencies: string[];
    rowCount: number;
    sourceRef: RuhrohHashedSourceRefV1;
    privacyClassification: "internal" | "restricted";
}
export interface RuhrohBillingMappingProfileV1 {
    version: "ruhroh_billing_mapping_profile_v1";
    profileId: string;
    provider: string;
    externalSchemaVersion: string;
    fields: {
        sourceRowId: string;
        amount: string;
        currency: string;
        kind: string;
        occurredAt?: string | undefined;
        providerRequestId?: string | undefined;
        principalRef?: string | undefined;
        workloadId?: string | undefined;
        model?: string | undefined;
        sku?: string | undefined;
    };
    kindValues: Partial<Record<RuhrohBillingFactKind, string[]>>;
    matching: {
        boundedWindowSeconds: number;
        boundedFields: Array<"principalRef" | "workloadId" | "model" | "sku">;
    };
    allocations: Array<{
        sourceRowId: string;
        targets: Array<{
            workloadId: string;
            weight: number;
        }>;
    }>;
    tolerance: number;
}
export interface RuhrohNormalizedBillingRowV1 {
    version: "ruhroh_normalized_billing_row_v1";
    sourceRowId: string;
    sourceRowSha256: string;
    amount: number;
    currency: string;
    kind: RuhrohBillingFactKind;
    occurredAt?: string | undefined;
    providerRequestId?: string | undefined;
    principalRef?: string | undefined;
    workloadId?: string | undefined;
    model?: string | undefined;
    sku?: string | undefined;
}
export interface RuhrohTechnicalEconomicFactV1 {
    version: "ruhroh_technical_economic_fact_v1";
    factId: string;
    runId: string;
    benchmarkTargetId: string;
    workloadId: string;
    occurredAt: string;
    providerRequestIdHash?: string | undefined;
    principalRef?: string | undefined;
    model?: string | undefined;
    sku?: string | undefined;
    evidenceRef: RuhrohHashedSourceRefV1;
}
export interface RuhrohBillingJoinV1 {
    sourceRowSha256: string;
    matchClass: RuhrohBillingMatchClass;
    currency: string;
    kind: RuhrohBillingFactKind;
    sourceAmount: number;
    assignedAmount: number;
    allocationWeight: number;
    technicalFactIds: string[];
    workloadIds: string[];
    reason: string;
}
export interface RuhrohReconciliationCurrencySummaryV1 {
    currency: string;
    sourceTotal: number;
    assignedTotal: number;
    difference: number;
    byMatchClass: Record<RuhrohBillingMatchClass, number>;
    byFactKind: Record<RuhrohBillingFactKind, number>;
}
export interface RuhrohCostReconciliationV1 {
    version: "ruhroh_cost_reconciliation_v1";
    reconciliationId: string;
    createdAt: string;
    benchmarkClaimRef: RuhrohHashedSourceRefV1;
    billingSourceRef: RuhrohHashedSourceRefV1;
    mappingProfileRef: RuhrohHashedSourceRefV1;
    source: {
        sourceId: string;
        billingPeriod: RuhrohBillingSourceManifestV1["billingPeriod"];
        rowCount: number;
    };
    joins: RuhrohBillingJoinV1[];
    currencies: RuhrohReconciliationCurrencySummaryV1[];
    coverage: {
        exactRows: number;
        boundedRows: number;
        allocatedRows: number;
        ambiguousRows: number;
        unmatchedRows: number;
    };
    ready: boolean;
    blockers: string[];
    unsupportedConcepts: string[];
}
export interface RuhrohBillingParseResult {
    rows: RuhrohNormalizedBillingRowV1[];
    errors: string[];
}
export declare function parseRuhrohBillingCsv(text: string, profile: RuhrohBillingMappingProfileV1): RuhrohBillingParseResult;
export declare function parseRuhrohBillingNdjson(text: string, profile: RuhrohBillingMappingProfileV1): RuhrohBillingParseResult;
export declare function normalizeRuhrohBillingRecords(records: Iterable<Record<string, unknown>>, profile: RuhrohBillingMappingProfileV1): RuhrohBillingParseResult;
export declare function buildRuhrohCostReconciliation(input: {
    reconciliationId: string;
    createdAt?: string | undefined;
    benchmarkClaimRef: RuhrohHashedSourceRefV1;
    billingSource: RuhrohBillingSourceManifestV1;
    billingSourceRef: RuhrohHashedSourceRefV1;
    mappingProfile: RuhrohBillingMappingProfileV1;
    mappingProfileRef: RuhrohHashedSourceRefV1;
    billingRows: readonly RuhrohNormalizedBillingRowV1[];
    technicalFacts: readonly RuhrohTechnicalEconomicFactV1[];
}): RuhrohCostReconciliationV1;
export declare function validateRuhrohBillingSourceManifest(manifest: RuhrohBillingSourceManifestV1): string[];
export declare function validateRuhrohBillingMappingProfile(profile: RuhrohBillingMappingProfileV1): string[];
export declare function validateRuhrohNormalizedBillingRow(row: RuhrohNormalizedBillingRowV1): string[];
export declare function validateRuhrohTechnicalEconomicFact(fact: RuhrohTechnicalEconomicFactV1): string[];
export declare function validateRuhrohCostReconciliation(reconciliation: RuhrohCostReconciliationV1): string[];
//# sourceMappingURL=billing.d.ts.map