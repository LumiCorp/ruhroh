import { type RuhrohFocusConformanceProfileV1, type RuhrohFocusConformanceReportV1, type RuhrohFocusDatasetIdV1, type RuhrohFocusHashedRefV1, type RuhrohFocusRuleResultV1, type RuhrohFocusSpecLockV1 } from "./focus-contracts.js";
export interface RuhrohFocusValidatorRunnerV1 {
    executable: string;
    prefixArguments: string[];
    timeoutMs: number;
    versionProbe: {
        executable: string;
        arguments: string[];
        expectedOutput: string;
    };
}
export declare function runRuhrohFocusValidation(input: {
    reportId: string;
    createdAt?: string | undefined;
    dataset: RuhrohFocusDatasetIdV1;
    dataFilePath: string;
    inputRef: RuhrohFocusHashedRefV1;
    modelFilePath: string;
    ruleSetPath: string;
    specLock: RuhrohFocusSpecLockV1;
    specLockRef: RuhrohFocusHashedRefV1;
    conformanceProfile: RuhrohFocusConformanceProfileV1;
    conformanceProfileRef: RuhrohFocusHashedRefV1;
    runner?: RuhrohFocusValidatorRunnerV1 | undefined;
}): RuhrohFocusConformanceReportV1;
export declare function parseRuhrohFocusJUnit(xml: string): {
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    rules: RuhrohFocusRuleResultV1[];
};
//# sourceMappingURL=focus-conformance.d.ts.map