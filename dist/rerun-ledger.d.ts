export type RuhrohRerunLedgerDecision = "exclude" | "rerun";
export type RuhrohRerunLedgerReasonKind = "infrastructure" | "invalid_artifact" | "operator_error" | "other";
export interface RuhrohRerunLedger {
    version: "ruhroh_rerun_ledger_v1";
    entries: RuhrohRerunLedgerEntry[];
}
export interface RuhrohRerunLedgerEntry {
    sampleId: string;
    decision: RuhrohRerunLedgerDecision;
    reasonKind: RuhrohRerunLedgerReasonKind;
    reason: string;
    decidedBy: string;
    decidedAt: string;
}
export interface RuhrohRerunLedgerValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    ledger?: RuhrohRerunLedger | undefined;
}
export declare function validateRuhrohRerunLedger(value: unknown, sourceLabel?: string): RuhrohRerunLedgerValidationResult;
export declare function loadRuhrohRerunLedger(filePath: string): RuhrohRerunLedger;
//# sourceMappingURL=rerun-ledger.d.ts.map