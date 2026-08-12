export type RuhrohEvidenceTruthPlane = "technical" | "human_work" | "billing" | "decision" | "publication";
export type RuhrohEvidenceArtifactPublicPolicy = "allowed" | "review_only" | "restricted";
export interface RuhrohEvidenceArtifactRoleDescriptor {
    contractVersion: string;
    truthPlane: RuhrohEvidenceTruthPlane;
    publicPolicy: RuhrohEvidenceArtifactPublicPolicy;
    defaultFileName: string;
}
/**
 * Canonical artifact roles for the economics evidence stack. Raw provider and
 * join-key material is deliberately marked restricted so publication tooling
 * can reject it without guessing from a file name.
 */
export declare const RUHROH_EVIDENCE_ARTIFACT_ROLES: {
    readonly "run-agent-result": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "adapter-manifest": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "adapter-conformance": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "economics-observation": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "economics-envelope": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "economic-trace": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "resource-budgets": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "resource-budget-outcome": RuhrohEvidenceArtifactRoleDescriptor;
    readonly suite: RuhrohEvidenceArtifactRoleDescriptor;
    readonly compare: RuhrohEvidenceArtifactRoleDescriptor;
    readonly "benchmark-claim": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "benchmark-summary": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "outcome-frontier": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "scale-experiment": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "scale-analysis": RuhrohEvidenceArtifactRoleDescriptor;
    readonly findings: RuhrohEvidenceArtifactRoleDescriptor;
    readonly "provider-baseline": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "provider-drift": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "workload-profile": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "control-surface": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "workload-binding": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "intervention-ledger": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "decision-context": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "decision-packet": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "product-engineering-decision-view": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "billing-source-manifest": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "billing-mapping-profile": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "normalized-billing-row": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "technical-economic-fact": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "cost-reconciliation": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "billing-source-manifest-v2": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "billing-mapping-profile-v2": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "normalized-billing-row-v2": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "cost-reconciliation-v2": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-spec-lock": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-catalog": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-mapping-pack": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-conformance-profile": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-conformance-report": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-validator-output": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-source-dataset": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-dataset-bundle": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-attribution-profile": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-import-report": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "focus-update-review": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "publish-check": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "bundle-manifest": RuhrohEvidenceArtifactRoleDescriptor;
    readonly "claim-index": RuhrohEvidenceArtifactRoleDescriptor;
    readonly publication: RuhrohEvidenceArtifactRoleDescriptor;
};
export type RuhrohEvidenceArtifactRole = keyof typeof RUHROH_EVIDENCE_ARTIFACT_ROLES;
export interface RuhrohEvidenceArtifactReferenceV1 {
    version: "ruhroh_evidence_artifact_reference_v1";
    role: RuhrohEvidenceArtifactRole;
    contractVersion: string;
    path: string;
    sha256: string;
    classification: "public" | "internal" | "restricted";
}
export declare function evidenceArtifactRoleDescriptor(role: RuhrohEvidenceArtifactRole): RuhrohEvidenceArtifactRoleDescriptor;
export declare function validateRuhrohEvidenceArtifactReference(value: unknown, options?: {
    publicBundle?: boolean | undefined;
}): string[];
export declare function validateRuhrohPublicArtifactInventory(references: readonly RuhrohEvidenceArtifactReferenceV1[]): string[];
//# sourceMappingURL=artifacts.d.ts.map