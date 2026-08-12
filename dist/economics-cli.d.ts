import { buildRuhrohCostReconciliation, type RuhrohNormalizedBillingRowV1 } from "./billing.js";
export declare const RUHROH_ECONOMICS_COMMANDS: readonly ["validate", "conformance", "scale-analyze", "findings", "provider-drift", "decision-packet", "billing-reconcile"];
export type RuhrohEconomicsCommand = typeof RUHROH_ECONOMICS_COMMANDS[number];
export interface RuhrohEconomicsCommandEnvelopeV1 {
    version: "ruhroh_economics_command_v1";
    command: RuhrohEconomicsCommand;
    input: unknown;
}
export interface RuhrohEconomicsCommandResultV1 {
    version: "ruhroh_economics_command_result_v1";
    command: RuhrohEconomicsCommand | "unknown";
    ok: boolean;
    errors: string[];
    warnings: string[];
    contractVersion?: string | undefined;
    output?: unknown;
}
export interface RuhrohEconomicsContractValidationV1 {
    version: "ruhroh_economics_contract_validation_v1";
    contractVersion?: string | undefined;
    supported: boolean;
    errors: string[];
    warnings: string[];
}
export interface RuhrohBillingReconciliationCommandInputV1 extends Omit<Parameters<typeof buildRuhrohCostReconciliation>[0], "billingRows"> {
    billing: {
        format: "csv" | "ndjson";
        text: string;
    } | {
        format: "records";
        records: Record<string, unknown>[];
    } | {
        format: "normalized_rows";
        rows: RuhrohNormalizedBillingRowV1[];
    };
}
/**
 * Pure command dispatcher used by the executable CLI and embedders. The caller
 * owns file I/O; this function accepts and returns JSON-compatible values.
 */
export declare function runRuhrohEconomicsCommand(envelope: unknown): RuhrohEconomicsCommandResultV1;
/** Validate any public economics-stack contract by its explicit version. */
export declare function validateRuhrohEconomicsContract(value: unknown): RuhrohEconomicsContractValidationV1;
//# sourceMappingURL=economics-cli.d.ts.map