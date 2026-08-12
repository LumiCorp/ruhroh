import { buildRuhrohCostReconciliation, normalizeRuhrohBillingRecords, parseRuhrohBillingCsv, parseRuhrohBillingNdjson, validateRuhrohBillingMappingProfile, validateRuhrohBillingSourceManifest, validateRuhrohCostReconciliation, validateRuhrohNormalizedBillingRow, validateRuhrohTechnicalEconomicFact, } from "./billing.js";
import { validateRuhrohEvidenceArtifactReference } from "./artifacts.js";
import { buildRuhrohDecisionPacket, validateRuhrohControlSurface, validateRuhrohDecisionContext, validateRuhrohDecisionPacket, validateRuhrohInterventionLedger, validateRuhrohWorkloadBinding, validateRuhrohWorkloadProfile, } from "./decision.js";
import { compareRuhrohProviderBaseline, validateRuhrohProviderBaseline, } from "./drift.js";
import { normalizeEconomicsObservations, runAdapterConformance, validateAdapterManifest, validateEconomicTraceSpan, validateEconomicsObservation, validateResourceBudgetOutcome, validateResourceBudgets, validateRunAgentResultV2, } from "./economics-runtime.js";
import { validateRuhrohOutcomeFrontier } from "./economics.js";
import { buildRuhrohFindings, validateRuhrohFindings, } from "./findings.js";
import { validateRuhrohClaimIndex, validateRuhrohPublicationV2, validateRuhrohPublishBundleManifest, validateRuhrohPublishCheckReport, } from "./publication.js";
import { validateRuhrohBenchmarkClaim, validateRuhrohBenchmarkSummary, validateRuhrohCompareV2, } from "./results.js";
import { analyzeRuhrohScaleExperiment, validateRuhrohScaleExperiment, } from "./scale.js";
import { validateRuhrohSuite } from "./suites.js";
export const RUHROH_ECONOMICS_COMMANDS = [
    "validate",
    "conformance",
    "scale-analyze",
    "findings",
    "provider-drift",
    "decision-packet",
    "billing-reconcile",
];
/**
 * Pure command dispatcher used by the executable CLI and embedders. The caller
 * owns file I/O; this function accepts and returns JSON-compatible values.
 */
export function runRuhrohEconomicsCommand(envelope) {
    if (!isRecord(envelope)) {
        return commandFailure("unknown", ["command envelope must be an object"]);
    }
    const command = isEconomicsCommand(envelope.command) ? envelope.command : "unknown";
    const envelopeErrors = [
        ...(envelope.version === "ruhroh_economics_command_v1"
            ? []
            : ["command envelope version must be ruhroh_economics_command_v1"]),
        ...(command === "unknown" ? ["command is unsupported"] : []),
        ...("input" in envelope ? [] : ["command envelope input is required"]),
    ];
    if (envelopeErrors.length > 0 || command === "unknown") {
        return commandFailure(command, envelopeErrors);
    }
    try {
        switch (command) {
            case "validate":
                return validationCommand(envelope.input);
            case "conformance":
                return conformanceCommand(envelope.input);
            case "scale-analyze":
                return scaleCommand(envelope.input);
            case "findings":
                return findingsCommand(envelope.input);
            case "provider-drift":
                return providerDriftCommand(envelope.input);
            case "decision-packet":
                return decisionPacketCommand(envelope.input);
            case "billing-reconcile":
                return billingReconciliationCommand(envelope.input);
        }
    }
    catch (error) {
        return commandFailure(command, [
            `command could not process its input: ${error instanceof Error ? error.message : String(error)}`,
        ]);
    }
}
/** Validate any public economics-stack contract by its explicit version. */
export function validateRuhrohEconomicsContract(value) {
    if (!isRecord(value) || typeof value.version !== "string" || value.version.trim().length === 0) {
        return {
            version: "ruhroh_economics_contract_validation_v1",
            supported: false,
            errors: ["contract must be an object with a non-empty version"],
            warnings: [],
        };
    }
    const contractVersion = value.version;
    try {
        const validation = validateKnownContract(contractVersion, value);
        if (validation === undefined) {
            return {
                version: "ruhroh_economics_contract_validation_v1",
                contractVersion,
                supported: false,
                errors: [`unsupported contract version: ${contractVersion}`],
                warnings: [],
            };
        }
        return {
            version: "ruhroh_economics_contract_validation_v1",
            contractVersion,
            supported: true,
            errors: unique(validation.errors),
            warnings: unique(validation.warnings),
        };
    }
    catch (error) {
        return {
            version: "ruhroh_economics_contract_validation_v1",
            contractVersion,
            supported: true,
            errors: [`contract could not be validated: ${error instanceof Error ? error.message : String(error)}`],
            warnings: [],
        };
    }
}
function validationCommand(input) {
    const validation = validateRuhrohEconomicsContract(input);
    return {
        version: "ruhroh_economics_command_result_v1",
        command: "validate",
        ok: validation.supported && validation.errors.length === 0,
        errors: validation.errors,
        warnings: validation.warnings,
        ...(validation.contractVersion === undefined ? {} : { contractVersion: validation.contractVersion }),
        output: validation,
    };
}
function conformanceCommand(input) {
    if (!isRecord(input) || !isRecord(input.manifest)) {
        return commandFailure("conformance", ["input.manifest must be an adapter manifest"]);
    }
    const errors = validateAdapterManifest(input.manifest);
    const observations = optionalRecordArray(input, "observations", errors);
    const spans = optionalRecordArray(input, "spans", errors);
    for (const [index, observation] of observations.entries()) {
        errors.push(...validateEconomicsObservation(observation).map((error) => `observations[${index}]: ${error}`));
    }
    for (const [index, span] of spans.entries()) {
        errors.push(...validateEconomicTraceSpan(span).map((error) => `spans[${index}]: ${error}`));
    }
    if (errors.length > 0)
        return commandFailure("conformance", unique(errors));
    const report = runAdapterConformance({
        manifest: input.manifest,
        ...(input.observations === undefined ? {} : { observations: observations }),
        ...(input.spans === undefined ? {} : { spans: spans }),
    });
    return commandResult("conformance", report.passed, report, report.checks
        .filter((check) => check.status === "failed")
        .map((check) => `${check.name}: ${check.details}`));
}
function scaleCommand(input) {
    if (!isRecord(input) || !isRecord(input.experiment) || !Array.isArray(input.observations)) {
        return commandFailure("scale-analyze", ["input requires experiment and observations"]);
    }
    const experiment = input.experiment;
    const experimentErrors = validateRuhrohScaleExperiment(experiment);
    if (experimentErrors.length > 0)
        return commandFailure("scale-analyze", experimentErrors);
    const analysis = analyzeRuhrohScaleExperiment({
        experiment,
        observations: input.observations,
        ...(typeof input.createdAt === "string" ? { createdAt: input.createdAt } : {}),
    });
    return commandResult("scale-analyze", analysis.errors.length === 0, analysis, analysis.errors);
}
function findingsCommand(input) {
    if (!isRecord(input) || !Array.isArray(input.assessments)) {
        return commandFailure("findings", ["input.assessments must be an array"]);
    }
    const output = buildRuhrohFindings(input.assessments, typeof input.createdAt === "string" ? input.createdAt : undefined);
    const errors = validateRuhrohFindings(output);
    return commandResult("findings", errors.length === 0, output, errors);
}
function providerDriftCommand(input) {
    if (!isRecord(input) || !isRecord(input.baseline) || !isRecord(input.currentControls) || !isRecord(input.currentMetrics)) {
        return commandFailure("provider-drift", ["input requires baseline, currentControls, and currentMetrics"]);
    }
    const errors = validateRuhrohProviderBaseline(input.baseline);
    if (errors.length > 0)
        return commandFailure("provider-drift", errors);
    const output = compareRuhrohProviderBaseline({
        baseline: input.baseline,
        currentControls: input.currentControls,
        currentMetrics: input.currentMetrics,
    });
    return commandResult("provider-drift", true, output);
}
function decisionPacketCommand(input) {
    if (!isRecord(input) || !isRecord(input.context)) {
        return commandFailure("decision-packet", ["input.context must be a decision context"]);
    }
    const contextErrors = validateRuhrohDecisionContext(input.context);
    const ledgerErrors = input.interventionLedger === undefined
        ? []
        : isRecord(input.interventionLedger)
            ? validateRuhrohInterventionLedger(input.interventionLedger)
            : ["input.interventionLedger must be an intervention ledger"];
    if (contextErrors.length > 0 || ledgerErrors.length > 0) {
        return commandFailure("decision-packet", [...contextErrors, ...ledgerErrors]);
    }
    const output = buildRuhrohDecisionPacket(input);
    const errors = validateRuhrohDecisionPacket(output);
    return commandResult("decision-packet", errors.length === 0, output, errors);
}
function billingReconciliationCommand(input) {
    if (!isRecord(input) || !isRecord(input.billingSource) || !isRecord(input.mappingProfile) || !isRecord(input.billing)) {
        return commandFailure("billing-reconcile", ["input requires billingSource, mappingProfile, and billing"]);
    }
    const source = input.billingSource;
    const profile = input.mappingProfile;
    const inputErrors = [
        ...validateRuhrohBillingSourceManifest(source),
        ...validateRuhrohBillingMappingProfile(profile),
        ...(Array.isArray(input.technicalFacts) ? [] : ["input.technicalFacts must be an array"]),
    ];
    if (inputErrors.length > 0)
        return commandFailure("billing-reconcile", inputErrors);
    const billing = input.billing;
    let rows = [];
    let parseErrors = [];
    if (billing.format === "csv" || billing.format === "ndjson") {
        if (typeof billing.text !== "string")
            return commandFailure("billing-reconcile", ["billing.text must be a string"]);
        const parsed = billing.format === "csv"
            ? parseRuhrohBillingCsv(billing.text, profile)
            : parseRuhrohBillingNdjson(billing.text, profile);
        rows = parsed.rows;
        parseErrors = parsed.errors;
    }
    else if (billing.format === "records") {
        if (!Array.isArray(billing.records) || billing.records.some((record) => !isRecord(record))) {
            return commandFailure("billing-reconcile", ["billing.records must be an array of objects"]);
        }
        const parsed = normalizeRuhrohBillingRecords(billing.records, profile);
        rows = parsed.rows;
        parseErrors = parsed.errors;
    }
    else if (billing.format === "normalized_rows") {
        if (!Array.isArray(billing.rows) || billing.rows.some((row) => !isRecord(row))) {
            return commandFailure("billing-reconcile", ["billing.rows must be an array of normalized billing rows"]);
        }
        rows = billing.rows;
    }
    else {
        return commandFailure("billing-reconcile", ["billing.format must be csv, ndjson, records, or normalized_rows"]);
    }
    if (parseErrors.length > 0) {
        return commandResult("billing-reconcile", false, { normalizedRows: rows }, parseErrors);
    }
    const buildInput = {
        ...input,
        billingSource: source,
        mappingProfile: profile,
        billingRows: rows,
        technicalFacts: input.technicalFacts,
    };
    const output = buildRuhrohCostReconciliation(buildInput);
    const errors = validateRuhrohCostReconciliation(output);
    return commandResult("billing-reconcile", errors.length === 0, output, errors);
}
function validateKnownContract(contractVersion, value) {
    const plain = (errors) => ({ errors, warnings: [] });
    switch (contractVersion) {
        case "ruhroh_run_agent_result_v2":
            return plain(validateRunAgentResultV2(value));
        case "ruhroh_economics_observation_v1":
            return plain(validateEconomicsObservation(value));
        case "ruhroh_adapter_manifest_v1":
            return plain(validateAdapterManifest(value));
        case "ruhroh_resource_budgets_v1":
            return plain(validateResourceBudgets(value));
        case "ruhroh_resource_budget_outcome_v1":
            return plain(validateResourceBudgetOutcome(value));
        case "ruhroh_economic_trace_span_v1":
            return plain(validateEconomicTraceSpan(value));
        case "ruhroh_economics_envelope_v1":
            return plain(validateEconomicsEnvelope(value));
        case "ruhroh_adapter_conformance_v1":
            return plain(validateAdapterConformance(value));
        case "ruhroh_evidence_artifact_reference_v1":
            return plain(validateRuhrohEvidenceArtifactReference(value));
        case "ruhroh_suite_v1":
        case "ruhroh_suite_v2":
            return plain(validateRuhrohSuite(value));
        case "ruhroh_compare_v2": {
            const result = validateRuhrohCompareV2(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_benchmark_claim_v1":
        case "ruhroh_benchmark_claim_v2": {
            const result = validateRuhrohBenchmarkClaim(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_benchmark_summary_v1":
        case "ruhroh_benchmark_summary_v2": {
            const result = validateRuhrohBenchmarkSummary(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_outcome_frontier_v1": {
            const result = validateRuhrohOutcomeFrontier(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_scale_experiment_v1":
            return plain(validateRuhrohScaleExperiment(value));
        case "ruhroh_scale_analysis_v1":
            return plain(validateScaleAnalysis(value));
        case "ruhroh_findings_v1":
            return plain(validateRuhrohFindings(value));
        case "ruhroh_provider_baseline_v1":
            return plain(validateRuhrohProviderBaseline(value));
        case "ruhroh_provider_drift_report_v1":
            return plain(validateProviderDriftReport(value));
        case "ruhroh_workload_profile_v1":
            return plain(validateRuhrohWorkloadProfile(value));
        case "ruhroh_control_surface_v1":
            return plain(validateRuhrohControlSurface(value));
        case "ruhroh_workload_binding_v1":
            return plain(validateRuhrohWorkloadBinding(value));
        case "ruhroh_decision_context_v1":
            return plain(validateRuhrohDecisionContext(value));
        case "ruhroh_intervention_ledger_v1":
            return plain(validateRuhrohInterventionLedger(value));
        case "ruhroh_decision_packet_v1":
            return plain(validateRuhrohDecisionPacket(value));
        case "ruhroh_product_engineering_decision_view_v1":
            return plain(validateProductEngineeringView(value));
        case "ruhroh_billing_source_manifest_v1":
            return plain(validateRuhrohBillingSourceManifest(value));
        case "ruhroh_billing_mapping_profile_v1":
            return plain(validateRuhrohBillingMappingProfile(value));
        case "ruhroh_normalized_billing_row_v1":
            return plain(validateRuhrohNormalizedBillingRow(value));
        case "ruhroh_technical_economic_fact_v1":
            return plain(validateRuhrohTechnicalEconomicFact(value));
        case "ruhroh_cost_reconciliation_v1":
            return plain(validateRuhrohCostReconciliation(value));
        case "ruhroh_publish_check_v1":
        case "ruhroh_publish_check_v2": {
            const result = validateRuhrohPublishCheckReport(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_publish_bundle_v1":
        case "ruhroh_publish_bundle_v2": {
            const result = validateRuhrohPublishBundleManifest(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_claim_index_v1":
        case "ruhroh_claim_index_v2": {
            const result = validateRuhrohClaimIndex(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        case "ruhroh_publication_v2": {
            const result = validateRuhrohPublicationV2(value);
            return { errors: result.errors, warnings: result.warnings };
        }
        default:
            return undefined;
    }
}
function validateEconomicsEnvelope(value) {
    const errors = [];
    if (value.scope !== "run")
        errors.push("scope must be run");
    if (!Array.isArray(value.observations)) {
        errors.push("observations must be an array");
    }
    else {
        const observations = [];
        for (const [index, observation] of value.observations.entries()) {
            const itemErrors = validateEconomicsObservation(observation);
            errors.push(...itemErrors.map((error) => `observations[${index}]: ${error}`));
            if (itemErrors.length === 0)
                observations.push(observation);
        }
        errors.push(...normalizeEconomicsObservations(observations).errors.map((error) => `observations: ${error}`));
    }
    if (!isRecord(value.totals))
        errors.push("totals must be an object");
    if (!isRecord(value.coverage))
        errors.push("coverage must be an object");
    if (typeof value.legacy !== "boolean")
        errors.push("legacy must be boolean");
    if (!Array.isArray(value.warnings) || value.warnings.some((warning) => typeof warning !== "string")) {
        errors.push("warnings must be an array of strings");
    }
    return errors;
}
function validateAdapterConformance(value) {
    const errors = [];
    if (typeof value.adapterId !== "string" || typeof value.adapterVersion !== "string")
        errors.push("adapterId and adapterVersion are required");
    if (!sha256(value.manifestSha256))
        errors.push("manifestSha256 must be lowercase SHA-256");
    if (typeof value.passed !== "boolean")
        errors.push("passed must be boolean");
    if (!Array.isArray(value.checks))
        errors.push("checks must be an array");
    return errors;
}
function validateScaleAnalysis(value) {
    const errors = [];
    if (typeof value.experimentId !== "string")
        errors.push("experimentId is required");
    if (!Array.isArray(value.targets))
        errors.push("targets must be an array");
    if (!Array.isArray(value.errors) || value.errors.some((error) => typeof error !== "string"))
        errors.push("errors must be an array of strings");
    return errors;
}
function validateProviderDriftReport(value) {
    const errors = [];
    if (typeof value.baselineId !== "string")
        errors.push("baselineId is required");
    if (!Array.isArray(value.classifications) || value.classifications.length === 0)
        errors.push("classifications must be non-empty");
    if (!isRecord(value.margins))
        errors.push("margins are required");
    if (!isRecord(value.multipleTesting) || value.multipleTesting.method !== "holm")
        errors.push("multipleTesting.method must be holm");
    return errors;
}
function validateProductEngineeringView(value) {
    const errors = [];
    if (typeof value.packetId !== "string")
        errors.push("packetId is required");
    if (!isRecord(value.workloadBinding))
        errors.push("workloadBinding is required");
    if (!isRecord(value.qualityEligibility) || !isRecord(value.containment))
        errors.push("qualityEligibility and containment are required");
    if (!Array.isArray(value.unresolvedEvidence))
        errors.push("unresolvedEvidence must be an array");
    return errors;
}
function optionalRecordArray(parent, field, errors) {
    const raw = parent[field];
    if (raw === undefined)
        return [];
    if (!Array.isArray(raw) || raw.some((item) => !isRecord(item))) {
        errors.push(`${field} must be an array of objects`);
        return [];
    }
    return raw;
}
function commandResult(command, ok, output, errors = [], warnings = []) {
    return {
        version: "ruhroh_economics_command_result_v1",
        command,
        ok,
        errors: unique(errors),
        warnings: unique(warnings),
        output,
    };
}
function commandFailure(command, errors) {
    return {
        version: "ruhroh_economics_command_result_v1",
        command,
        ok: false,
        errors: unique(errors),
        warnings: [],
    };
}
function isEconomicsCommand(value) {
    return typeof value === "string" && RUHROH_ECONOMICS_COMMANDS.includes(value);
}
function sha256(value) {
    return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unique(values) {
    return [...new Set(values)];
}
//# sourceMappingURL=economics-cli.js.map