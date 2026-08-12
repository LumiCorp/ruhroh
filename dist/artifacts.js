/**
 * Canonical artifact roles for the economics evidence stack. Raw provider and
 * join-key material is deliberately marked restricted so publication tooling
 * can reject it without guessing from a file name.
 */
export const RUHROH_EVIDENCE_ARTIFACT_ROLES = {
    "run-agent-result": descriptor("ruhroh_run_agent_result_v2", "technical", "review_only", "ruhroh-run-agent-result.json"),
    "adapter-manifest": descriptor("ruhroh_adapter_manifest_v1", "technical", "allowed", "ruhroh-adapter-manifest.json"),
    "adapter-conformance": descriptor("ruhroh_adapter_conformance_v1", "technical", "allowed", "ruhroh-adapter-conformance.json"),
    "economics-observation": descriptor("ruhroh_economics_observation_v1", "technical", "review_only", "ruhroh-economics-observation.json"),
    "economics-envelope": descriptor("ruhroh_economics_envelope_v1", "technical", "allowed", "ruhroh-economics-envelope.json"),
    "economic-trace": descriptor("ruhroh_economic_trace_span_v1", "technical", "allowed", "ruhroh-economic-trace.jsonl"),
    "resource-budgets": descriptor("ruhroh_resource_budgets_v1", "technical", "allowed", "ruhroh-resource-budgets.json"),
    "resource-budget-outcome": descriptor("ruhroh_resource_budget_outcome_v1", "technical", "allowed", "ruhroh-resource-budget-outcome.json"),
    suite: descriptor("ruhroh_suite_v2", "technical", "allowed", "suite.json"),
    compare: descriptor("ruhroh_compare_v2", "technical", "allowed", "ruhroh-compare.json"),
    "benchmark-claim": descriptor("ruhroh_benchmark_claim_v2", "technical", "allowed", "benchmark-claim.json"),
    "benchmark-summary": descriptor("ruhroh_benchmark_summary_v2", "technical", "allowed", "benchmark-summary.json"),
    "outcome-frontier": descriptor("ruhroh_outcome_frontier_v1", "technical", "allowed", "outcome-frontier.json"),
    "scale-experiment": descriptor("ruhroh_scale_experiment_v1", "technical", "allowed", "scale-experiment.json"),
    "scale-analysis": descriptor("ruhroh_scale_analysis_v1", "technical", "allowed", "scale-analysis.json"),
    findings: descriptor("ruhroh_findings_v1", "technical", "allowed", "findings.json"),
    "provider-baseline": descriptor("ruhroh_provider_baseline_v1", "technical", "allowed", "provider-baseline.json"),
    "provider-drift": descriptor("ruhroh_provider_drift_report_v1", "technical", "allowed", "provider-drift-report.json"),
    "workload-profile": descriptor("ruhroh_workload_profile_v1", "decision", "allowed", "workload-profile.json"),
    "control-surface": descriptor("ruhroh_control_surface_v1", "decision", "allowed", "control-surface.json"),
    "workload-binding": descriptor("ruhroh_workload_binding_v1", "decision", "review_only", "workload-binding.json"),
    "intervention-ledger": descriptor("ruhroh_intervention_ledger_v1", "human_work", "review_only", "intervention-ledger.json"),
    "decision-context": descriptor("ruhroh_decision_context_v1", "decision", "review_only", "decision-context.json"),
    "decision-packet": descriptor("ruhroh_decision_packet_v1", "decision", "allowed", "decision-packet.json"),
    "product-engineering-decision-view": descriptor("ruhroh_product_engineering_decision_view_v1", "decision", "allowed", "product-engineering-decision-view.json"),
    "billing-source-manifest": descriptor("ruhroh_billing_source_manifest_v1", "billing", "restricted", "billing-source-manifest.json"),
    "billing-mapping-profile": descriptor("ruhroh_billing_mapping_profile_v1", "billing", "restricted", "billing-mapping-profile.json"),
    "normalized-billing-row": descriptor("ruhroh_normalized_billing_row_v1", "billing", "restricted", "normalized-billing-row.ndjson"),
    "technical-economic-fact": descriptor("ruhroh_technical_economic_fact_v1", "billing", "restricted", "technical-economic-fact.ndjson"),
    "cost-reconciliation": descriptor("ruhroh_cost_reconciliation_v1", "billing", "allowed", "cost-reconciliation.json"),
    "publish-check": descriptor("ruhroh_publish_check_v2", "publication", "allowed", "publish-check.json"),
    "bundle-manifest": descriptor("ruhroh_publish_bundle_v2", "publication", "allowed", "manifest.json"),
    "claim-index": descriptor("ruhroh_claim_index_v2", "publication", "allowed", "claim-index.json"),
    publication: descriptor("ruhroh_publication_v2", "publication", "allowed", "publication.json"),
};
export function evidenceArtifactRoleDescriptor(role) {
    return { ...RUHROH_EVIDENCE_ARTIFACT_ROLES[role] };
}
export function validateRuhrohEvidenceArtifactReference(value, options = {}) {
    if (!isRecord(value))
        return ["artifact reference must be an object"];
    const errors = [];
    if (value.version !== "ruhroh_evidence_artifact_reference_v1") {
        errors.push("version must be ruhroh_evidence_artifact_reference_v1");
    }
    const role = typeof value.role === "string" && value.role in RUHROH_EVIDENCE_ARTIFACT_ROLES
        ? value.role
        : undefined;
    if (role === undefined) {
        errors.push("role is not a registered Ruhroh evidence artifact role");
    }
    else {
        const expected = RUHROH_EVIDENCE_ARTIFACT_ROLES[role];
        if (value.contractVersion !== expected.contractVersion) {
            errors.push(`contractVersion must be ${expected.contractVersion} for role ${role}`);
        }
        if (value.classification === "public" && expected.publicPolicy !== "allowed") {
            errors.push(`role ${role} cannot be classified public (${expected.publicPolicy})`);
        }
        if (options.publicBundle === true && expected.publicPolicy !== "allowed") {
            errors.push(`role ${role} is ${expected.publicPolicy} and cannot enter a public bundle`);
        }
    }
    if (typeof value.path !== "string" || value.path.trim().length === 0) {
        errors.push("path must be a non-empty relative evidence reference");
    }
    else if (isUnsafeRelativePath(value.path)) {
        errors.push("path must be relative and cannot traverse outside the evidence root");
    }
    if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.sha256)) {
        errors.push("sha256 must be a lowercase SHA-256 digest");
    }
    if (value.classification !== "public" && value.classification !== "internal" && value.classification !== "restricted") {
        errors.push("classification must be public, internal, or restricted");
    }
    return unique(errors);
}
export function validateRuhrohPublicArtifactInventory(references) {
    const errors = references.flatMap((reference, index) => validateRuhrohEvidenceArtifactReference(reference, { publicBundle: true })
        .map((error) => `artifacts[${index}]: ${error}`));
    const roles = references.map((reference) => reference.role);
    if (new Set(roles).size !== roles.length)
        errors.push("public artifact roles must be unique");
    return unique(errors);
}
function descriptor(contractVersion, truthPlane, publicPolicy, defaultFileName) {
    return { contractVersion, truthPlane, publicPolicy, defaultFileName };
}
function isUnsafeRelativePath(value) {
    const normalized = value.replaceAll("\\", "/");
    return normalized.startsWith("/")
        || /^[A-Za-z]:\//u.test(normalized)
        || normalized.split("/").includes("..");
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unique(values) {
    return [...new Set(values)];
}
//# sourceMappingURL=artifacts.js.map