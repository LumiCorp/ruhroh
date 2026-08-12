import { type RuhrohFocusCatalogV1, type RuhrohFocusHashedRefV1, type RuhrohFocusMappingPackV1, type RuhrohFocusUpdateReviewV1 } from "./focus-contracts.js";
export declare function buildRuhrohFocusCatalogFromModel(input: {
    catalogId: string;
    model: unknown;
    modelRef: RuhrohFocusHashedRefV1;
}): RuhrohFocusCatalogV1;
export declare function compareRuhrohFocusCatalogs(from: RuhrohFocusCatalogV1, to: RuhrohFocusCatalogV1): RuhrohFocusUpdateReviewV1["changes"];
export declare function buildRuhrohFocusUpdateReview(input: {
    reviewId: string;
    createdAt?: string | undefined;
    fromSpecLockRef: RuhrohFocusHashedRefV1;
    toSpecLockRef: RuhrohFocusHashedRefV1;
    candidateReleaseStatus: "ratified" | "preview";
    fromCatalog: RuhrohFocusCatalogV1;
    toCatalog: RuhrohFocusCatalogV1;
    mappingPack?: RuhrohFocusMappingPackV1 | undefined;
    validatorChanged?: boolean | undefined;
    editorialChanges?: Array<{
        id: string;
        sourcePath: string;
        summary: string;
    }> | undefined;
    generatedRefs?: RuhrohFocusHashedRefV1[] | undefined;
    verification?: RuhrohFocusUpdateReviewV1["verification"] | undefined;
}): RuhrohFocusUpdateReviewV1;
export declare function canonicalRuhrohFocusCatalogJson(catalog: RuhrohFocusCatalogV1): string;
export declare function hashRuhrohFocusCatalog(catalog: RuhrohFocusCatalogV1): string;
//# sourceMappingURL=focus-update.d.ts.map