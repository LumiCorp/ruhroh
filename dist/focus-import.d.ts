import { type RuhrohBillingFactKindV2, type RuhrohNormalizedBillingRowV2 } from "./billing-v2.js";
import { type RuhrohFocusAttributionProfileV1, type RuhrohFocusCatalogV1, type RuhrohFocusConformanceReportV1, type RuhrohFocusDatasetBundleV1, type RuhrohFocusDatasetIdV1, type RuhrohFocusHashedRefV1, type RuhrohFocusImportReportV1, type RuhrohFocusMappingPackV1, type RuhrohFocusSpecLockV1 } from "./focus-contracts.js";
export type RuhrohFocusDatasetInputV1 = {
    dataset: RuhrohFocusDatasetIdV1;
    format: "csv";
    text: string;
    sourceRef: RuhrohFocusHashedRefV1;
} | {
    dataset: RuhrohFocusDatasetIdV1;
    format: "parquet";
    bytes: Uint8Array;
    sourceRef: RuhrohFocusHashedRefV1;
} | {
    dataset: RuhrohFocusDatasetIdV1;
    format: "records";
    records: Array<Record<string, unknown>>;
    sourceRef: RuhrohFocusHashedRefV1;
};
export interface RuhrohFocusPreservedDatasetV1 {
    dataset: RuhrohFocusDatasetIdV1;
    sourceRef: RuhrohFocusHashedRefV1;
    format: "csv" | "parquet" | "records";
    rows: Array<{
        sourceRowId: string;
        sourceRowSha256: string;
        ordinal: number;
        record: Record<string, unknown>;
    }>;
}
export interface RuhrohFocusImportResultV1 {
    bundle: RuhrohFocusDatasetBundleV1;
    report: RuhrohFocusImportReportV1;
    normalizedRows: RuhrohNormalizedBillingRowV2[];
    preservedDatasets: RuhrohFocusPreservedDatasetV1[];
}
export declare function importRuhrohFocusBundle(input: {
    bundleId: string;
    reportId: string;
    createdAt?: string | undefined;
    specLock: RuhrohFocusSpecLockV1;
    specLockRef: RuhrohFocusHashedRefV1;
    catalog: RuhrohFocusCatalogV1;
    catalogRef: RuhrohFocusHashedRefV1;
    mappingPack: RuhrohFocusMappingPackV1;
    mappingPackRef: RuhrohFocusHashedRefV1;
    bundleRef: RuhrohFocusHashedRefV1;
    conformanceReports: RuhrohFocusConformanceReportV1[];
    conformanceReportRefs: RuhrohFocusHashedRefV1[];
    datasets: RuhrohFocusDatasetInputV1[];
    attributionProfile?: RuhrohFocusAttributionProfileV1 | undefined;
    normalizedRowsRef?: RuhrohFocusHashedRefV1 | undefined;
}): RuhrohFocusImportResultV1;
export declare function readRuhrohFocusParquet(bytes: Uint8Array): Array<Record<string, unknown>>;
export declare function parseRuhrohFocusCsv(text: string): Array<Record<string, unknown>>;
export declare function focusChargeCategoryToKind(category: string): RuhrohBillingFactKindV2;
//# sourceMappingURL=focus-import.d.ts.map