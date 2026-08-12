export interface RuhrohHashedSourceRefV1 {
    path: string;
    sha256: string;
    version?: string | undefined;
}
export declare const RUHROH_DEFAULT_REWORK_WINDOW_DAYS = 7;
export interface RuhrohWorkloadProfileV1 {
    version: "ruhroh_workload_profile_v1";
    profileId: string;
    taxonomy: {
        namespace: string;
        version: string;
    };
    archetype: {
        id: string;
        label?: string | undefined;
    };
    businessCapability?: {
        id: string;
        label?: string | undefined;
    } | undefined;
    taskPurpose?: {
        id: string;
        label?: string | undefined;
    } | undefined;
    unitOfWork: {
        id: string;
        label: string;
    };
    denominatorCardRef?: string | undefined;
}
export interface RuhrohControlSurfaceV1 {
    version: "ruhroh_control_surface_v1";
    kind: "direct_api" | "desktop" | "cloud_brokered" | "agent_tooling" | "pass_through_saas" | "custom";
    customKind?: string | undefined;
    observabilityCeiling: {
        usageGrain: "call" | "run" | "aggregate" | "none";
        billingGrain: "request" | "principal" | "workload" | "account" | "none";
        identityGrain: "principal" | "workload" | "project" | "none";
        traceAccess: "full" | "partial" | "opaque";
        enforcement: "hard" | "cooperative" | "none";
    };
}
export interface RuhrohWorkloadBindingV1 {
    version: "ruhroh_workload_binding_v1";
    experimentId: string;
    workloadId: string;
    projectId: string;
    workflowInstanceId?: string | undefined;
    hierarchyRef?: RuhrohHashedSourceRefV1 | undefined;
}
export type RuhrohDecisionRole = "technical_owner" | "product_workload_owner" | "financial_owner" | "governance_owner" | "accountable_decision_owner";
export interface RuhrohDecisionContextV1 {
    version: "ruhroh_decision_context_v1";
    contextId: string;
    authoredAt: string;
    workloadBinding: RuhrohWorkloadBindingV1;
    benchmarkClaimRef: RuhrohHashedSourceRefV1;
    qualityEnvelope: {
        minimumPassRateWilsonLower: number;
        maximumP95ImplementationWallTimeMs?: number | undefined;
    };
    value: {
        mode: "displaced_work" | "net_new_value_or_risk";
        indicatorId: string;
        unit: string;
        baseline?: number | undefined;
        hypothesis: string;
    };
    observationWindow: {
        startedAt: string;
        endedAt: string;
    };
    interventionPolicy: {
        autonomy: "strict_zero_touch";
        passiveObservationCountsAsIntervention: false;
        reworkWindowDays: number;
    };
    stopRules: Array<{
        id: string;
        condition: string;
        action: "continue" | "modify" | "stop";
    }>;
    owners: Record<RuhrohDecisionRole, string>;
    privacy: {
        classification: "public" | "internal" | "restricted";
        publicReportingGrain: "workload" | "project";
        redactionPolicyRef?: RuhrohHashedSourceRefV1 | undefined;
    };
}
export type RuhrohInterventionKind = "approval" | "guidance" | "correction" | "execution" | "recovery" | "passive_oversight" | "rework";
export interface RuhrohInterventionEventV1 {
    version: "ruhroh_intervention_event_v1";
    eventId: string;
    kind: RuhrohInterventionKind;
    actorRole: string;
    startedAt: string;
    endedAt?: string | undefined;
    durationMinutes: number;
    workflowInstanceId: string;
    runId?: string | undefined;
    reason: string;
    evidenceRefs: RuhrohHashedSourceRefV1[];
}
export interface RuhrohInterventionLedgerV1 {
    version: "ruhroh_intervention_ledger_v1";
    ledgerId: string;
    workloadBinding: RuhrohWorkloadBindingV1;
    coverage: {
        startedAt: string;
        endedAt: string;
        complete: boolean;
        missingReasons: string[];
    };
    verification: "measured" | "independently_verified";
    events: RuhrohInterventionEventV1[];
}
export type RuhrohDecisionTierConclusion = "supported" | "not_supported" | "inconclusive" | "not_assessed";
export type RuhrohDecisionEvidenceLevel = "declared" | "measured" | "independently_verified";
export interface RuhrohDecisionTierV1 {
    conclusion: RuhrohDecisionTierConclusion;
    evidenceLevel: RuhrohDecisionEvidenceLevel;
    reasons: string[];
    evidenceRefs: RuhrohHashedSourceRefV1[];
}
export interface RuhrohSignedDecisionV1 {
    action: "continue" | "modify" | "stop";
    signerRole: "accountable_decision_owner";
    signedAt: string;
    signatureRef: RuhrohHashedSourceRefV1;
    rationale: string;
}
export interface RuhrohDecisionUnitEconomicsV1 {
    status: "supported" | "not_supported" | "inconclusive" | "not_assessed";
    coverage: "complete" | "partial" | "unknown" | "unavailable";
    costPerAcceptedOutcome?: {
        amount: number;
        currency: string;
    } | undefined;
    tokensPerAcceptedOutcome?: number | undefined;
    reasons: string[];
}
export interface RuhrohDecisionContainmentEvidenceV1 {
    budgetStatus: "within" | "exhausted" | "overrun" | "unobservable" | "not_assessed";
    reasons: string[];
}
export interface RuhrohDecisionTraceFindingsV1 {
    confirmed: number;
    candidate: number;
    notObservable: number;
}
export interface RuhrohDecisionPacketV1 {
    version: "ruhroh_decision_packet_v1";
    packetId: string;
    createdAt: string;
    contextRef: RuhrohHashedSourceRefV1;
    workloadBinding: RuhrohWorkloadBindingV1;
    sourceRefs: {
        benchmarkClaim: RuhrohHashedSourceRefV1;
        interventionLedger?: RuhrohHashedSourceRefV1 | undefined;
        costReconciliation?: RuhrohHashedSourceRefV1 | undefined;
        economicsEnvelope?: RuhrohHashedSourceRefV1 | undefined;
        budgetOutcome?: RuhrohHashedSourceRefV1 | undefined;
        findings?: RuhrohHashedSourceRefV1 | undefined;
    };
    tiers: {
        technicalOutcome: RuhrohDecisionTierV1;
        autonomousDeflection: RuhrohDecisionTierV1;
        businessValue: RuhrohDecisionTierV1;
    };
    humanWork: {
        coverageComplete: boolean;
        observationWindowComplete: boolean;
        disqualifyingInterventions: number;
        passiveOversightEvents: number;
        attributableReworkEvents: number;
        attributableReworkMinutes: number;
        reworkWindowDays: number;
    };
    technicalEvidence: {
        unitEconomics: RuhrohDecisionUnitEconomicsV1;
        containment: RuhrohDecisionContainmentEvidenceV1;
        traceFindings: RuhrohDecisionTraceFindingsV1;
    };
    readiness: "draft" | "review_required" | "decision_ready";
    unresolvedEvidence: string[];
    decision?: RuhrohSignedDecisionV1 | undefined;
}
export interface RuhrohProductEngineeringDecisionViewV1 {
    version: "ruhroh_product_engineering_decision_view_v1";
    packetId: string;
    readiness: RuhrohDecisionPacketV1["readiness"];
    workloadBinding: RuhrohWorkloadBindingV1;
    qualityEligibility: RuhrohDecisionTierV1;
    autonomy: RuhrohDecisionTierV1;
    businessValue: RuhrohDecisionTierV1;
    unitEconomics: RuhrohDecisionUnitEconomicsV1;
    containment: {
        budgetStatus: RuhrohDecisionContainmentEvidenceV1["budgetStatus"];
        interventionCount: number;
    };
    traceFindings: RuhrohDecisionTraceFindingsV1;
    rework: {
        coverageComplete: boolean;
        events: number;
        minutes: number;
    };
    unresolvedEvidence: string[];
    decision?: RuhrohSignedDecisionV1 | undefined;
}
export declare function validateRuhrohWorkloadProfile(profile: RuhrohWorkloadProfileV1): string[];
export declare function validateRuhrohControlSurface(surface: RuhrohControlSurfaceV1): string[];
export declare function validateRuhrohWorkloadBinding(binding: RuhrohWorkloadBindingV1): string[];
export declare function validateRuhrohDecisionContext(context: RuhrohDecisionContextV1): string[];
export declare function validateRuhrohInterventionLedger(ledger: RuhrohInterventionLedgerV1): string[];
export declare function buildRuhrohDecisionPacket(input: {
    packetId: string;
    createdAt?: string | undefined;
    context: RuhrohDecisionContextV1;
    contextRef: RuhrohHashedSourceRefV1;
    technicalOutcome: RuhrohDecisionTierV1;
    interventionLedger?: RuhrohInterventionLedgerV1 | undefined;
    interventionLedgerRef?: RuhrohHashedSourceRefV1 | undefined;
    costReconciliationRef?: RuhrohHashedSourceRefV1 | undefined;
    economicsEnvelopeRef?: RuhrohHashedSourceRefV1 | undefined;
    budgetOutcomeRef?: RuhrohHashedSourceRefV1 | undefined;
    findingsRef?: RuhrohHashedSourceRefV1 | undefined;
    unitEconomics?: RuhrohDecisionUnitEconomicsV1 | undefined;
    containmentEvidence?: RuhrohDecisionContainmentEvidenceV1 | undefined;
    traceFindings?: RuhrohDecisionTraceFindingsV1 | undefined;
    businessValueEvidence?: {
        indicatorId: string;
        conclusion: Exclude<RuhrohDecisionTierConclusion, "not_assessed">;
        evidenceLevel: Exclude<RuhrohDecisionEvidenceLevel, "declared">;
        observedValue: number;
        evidenceRefs: RuhrohHashedSourceRefV1[];
        reasons: string[];
    } | undefined;
    decision?: RuhrohSignedDecisionV1 | undefined;
}): RuhrohDecisionPacketV1;
export declare function projectRuhrohProductEngineeringDecision(packet: RuhrohDecisionPacketV1): RuhrohProductEngineeringDecisionViewV1;
export declare function validateRuhrohDecisionPacket(packet: RuhrohDecisionPacketV1): string[];
//# sourceMappingURL=decision.d.ts.map