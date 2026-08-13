import type { RuhrohBillingMatchClass, RuhrohTechnicalEconomicFactV1 } from "./billing.js";
import type { RuhrohHashedSourceRefV1 } from "./decision.js";
export type RuhrohBillingFactKindV2 = "charge" | "credit" | "refund" | "commitment" | "tax" | "prepaid" | "capacity" | "adjustment";
export interface RuhrohBillingSourceManifestV2 {
    version: "ruhroh_billing_source_manifest_v2";
    sourceId: string;
    format: "csv" | "parquet" | "records" | "normalized_rows";
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
export interface RuhrohBillingMappingProfileV2 {
    version: "ruhroh_billing_mapping_profile_v2";
    profileId: string;
    provider: string;
    externalSchemaVersion: string;
    fields: {
        sourceRowId: string;
        amountDecimal: string;
        currency: string;
        kind: string;
        occurredAt?: string | undefined;
        providerRequestId?: string | undefined;
        principalRef?: string | undefined;
        workloadId?: string | undefined;
        model?: string | undefined;
        sku?: string | undefined;
    };
    kindValues: Partial<Record<RuhrohBillingFactKindV2, string[]>>;
    matching: {
        boundedWindowSeconds: number;
        boundedFields: Array<"principalRef" | "workloadId" | "model" | "sku">;
    };
    allocations: Array<{
        sourceRowId: string;
        targets: Array<{
            workloadId: string;
            assignedAmountDecimal: string;
            weightDecimal?: string | undefined;
        }>;
    }>;
}
export interface RuhrohNormalizedBillingRowV2 {
    version: "ruhroh_normalized_billing_row_v2";
    sourceRowId: string;
    sourceRowSha256: string;
    amountDecimal: string;
    currency: string;
    kind: RuhrohBillingFactKindV2;
    occurredAt?: string | undefined;
    providerRequestId?: string | undefined;
    principalRef?: string | undefined;
    workloadId?: string | undefined;
    model?: string | undefined;
    sku?: string | undefined;
}
export interface RuhrohBillingJoinV2 {
    sourceRowId: string;
    sourceRowSha256: string;
    matchClass: RuhrohBillingMatchClass;
    currency: string;
    kind: RuhrohBillingFactKindV2;
    sourceAmountDecimal: string;
    assignedAmountDecimal: string;
    weightDecimal?: string | undefined;
    technicalFactIds: string[];
    workloadIds: string[];
    reason: string;
}
export interface RuhrohReconciliationCurrencySummaryV2 {
    currency: string;
    sourceTotalDecimal: string;
    assignedTotalDecimal: string;
    differenceDecimal: string;
    byMatchClass: Record<RuhrohBillingMatchClass, string>;
    byFactKind: Record<RuhrohBillingFactKindV2, string>;
}
export interface RuhrohCostReconciliationV2 {
    version: "ruhroh_cost_reconciliation_v2";
    reconciliationId: string;
    createdAt: string;
    benchmarkClaimRef: RuhrohHashedSourceRefV1;
    billingSourceRef: RuhrohHashedSourceRefV1;
    mappingProfileRef: RuhrohHashedSourceRefV1;
    source: {
        sourceId: string;
        billingPeriod: RuhrohBillingSourceManifestV2["billingPeriod"];
        rowCount: number;
    };
    joins: RuhrohBillingJoinV2[];
    currencies: RuhrohReconciliationCurrencySummaryV2[];
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
export declare function canonicalizeRuhrohDecimal(value: string): string;
export declare function addRuhrohDecimals(left: string, right: string): string;
export declare function subtractRuhrohDecimals(left: string, right: string): string;
export declare function compareRuhrohDecimals(left: string, right: string): -1 | 0 | 1;
export declare function normalizeRuhrohBillingRecordsV2(records: Iterable<Record<string, unknown>>, profile: RuhrohBillingMappingProfileV2): {
    rows: RuhrohNormalizedBillingRowV2[];
    errors: string[];
};
export declare function buildRuhrohCostReconciliationV2(input: {
    reconciliationId: string;
    createdAt?: string | undefined;
    benchmarkClaimRef: RuhrohHashedSourceRefV1;
    billingSource: RuhrohBillingSourceManifestV2;
    billingSourceRef: RuhrohHashedSourceRefV1;
    mappingProfile: RuhrohBillingMappingProfileV2;
    mappingProfileRef: RuhrohHashedSourceRefV1;
    billingRows: readonly RuhrohNormalizedBillingRowV2[];
    technicalFacts: readonly RuhrohTechnicalEconomicFactV1[];
}): RuhrohCostReconciliationV2;
export declare function validateRuhrohBillingSourceManifestV2(value: RuhrohBillingSourceManifestV2): string[];
export declare function validateRuhrohBillingMappingProfileV2(value: RuhrohBillingMappingProfileV2): string[];
export declare function validateRuhrohNormalizedBillingRowV2(value: RuhrohNormalizedBillingRowV2): string[];
export declare function validateRuhrohCostReconciliationV2(value: RuhrohCostReconciliationV2): string[];
//# sourceMappingURL=billing-v2.d.ts.map