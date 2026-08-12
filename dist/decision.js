export const RUHROH_DEFAULT_REWORK_WINDOW_DAYS = 7;
export function validateRuhrohWorkloadProfile(profile) {
    const errors = [];
    if (profile.version !== "ruhroh_workload_profile_v1")
        errors.push("workload profile version must be ruhroh_workload_profile_v1");
    for (const [field, value] of [
        ["profileId", profile.profileId],
        ["taxonomy.namespace", profile.taxonomy.namespace],
        ["taxonomy.version", profile.taxonomy.version],
        ["archetype.id", profile.archetype.id],
        ["unitOfWork.id", profile.unitOfWork.id],
        ["unitOfWork.label", profile.unitOfWork.label],
    ]) {
        if (!nonEmpty(value))
            errors.push(`${field} is required`);
    }
    if (!profile.taxonomy.namespace.includes(":"))
        errors.push("taxonomy.namespace must be namespaced, for example example.com:workloads");
    return errors;
}
export function validateRuhrohControlSurface(surface) {
    const errors = [];
    if (surface.version !== "ruhroh_control_surface_v1")
        errors.push("control surface version must be ruhroh_control_surface_v1");
    if (surface.kind === "custom" && !nonEmpty(surface.customKind))
        errors.push("customKind is required for a custom control surface");
    if (surface.kind !== "custom" && surface.customKind !== undefined)
        errors.push("customKind is only allowed for a custom control surface");
    return errors;
}
export function validateRuhrohWorkloadBinding(binding) {
    const errors = [];
    if (binding.version !== "ruhroh_workload_binding_v1")
        errors.push("workload binding version must be ruhroh_workload_binding_v1");
    for (const [field, value] of [["experimentId", binding.experimentId], ["workloadId", binding.workloadId], ["projectId", binding.projectId]]) {
        if (!nonEmpty(value))
            errors.push(`${field} is required`);
    }
    if (binding.hierarchyRef !== undefined)
        errors.push(...validateHashedRef(binding.hierarchyRef, "hierarchyRef"));
    return errors;
}
export function validateRuhrohDecisionContext(context) {
    const errors = [];
    if (context.version !== "ruhroh_decision_context_v1")
        errors.push("version must be ruhroh_decision_context_v1");
    errors.push(...validateRuhrohWorkloadBinding(context.workloadBinding));
    if (context.interventionPolicy.autonomy !== "strict_zero_touch"
        || context.interventionPolicy.passiveObservationCountsAsIntervention !== false) {
        errors.push("the v1 autonomy policy must be strict zero-touch with passive observation reported separately");
    }
    if (!Number.isInteger(context.interventionPolicy.reworkWindowDays) || context.interventionPolicy.reworkWindowDays <= 0) {
        errors.push("interventionPolicy.reworkWindowDays must be a positive integer");
    }
    if (context.qualityEnvelope.minimumPassRateWilsonLower < 0 || context.qualityEnvelope.minimumPassRateWilsonLower > 1) {
        errors.push("qualityEnvelope.minimumPassRateWilsonLower must be between zero and one");
    }
    if (!nonEmpty(context.value.indicatorId))
        errors.push("value.indicatorId is required");
    if (!nonEmpty(context.value.unit))
        errors.push("value.unit is required");
    if (!nonEmpty(context.value.hypothesis))
        errors.push("value.hypothesis is required");
    if (context.value.mode === "displaced_work" && (typeof context.value.baseline !== "number" || !Number.isFinite(context.value.baseline))) {
        errors.push("value.baseline is required for displaced_work; use net_new_value_or_risk for a net-new hypothesis");
    }
    if (context.value.baseline !== undefined && !Number.isFinite(context.value.baseline)) {
        errors.push("value.baseline must be finite when present");
    }
    if (!(Date.parse(context.observationWindow.startedAt) < Date.parse(context.observationWindow.endedAt))) {
        errors.push("observationWindow must have an end after its start");
    }
    if (context.stopRules.length === 0)
        errors.push("stopRules must include at least one predeclared rule");
    for (const role of DECISION_ROLES) {
        if (!nonEmpty(context.owners[role]))
            errors.push(`owners.${role} is required`);
    }
    errors.push(...validateHashedRef(context.benchmarkClaimRef, "benchmarkClaimRef"));
    return errors;
}
export function validateRuhrohInterventionLedger(ledger) {
    const errors = [];
    if (ledger.version !== "ruhroh_intervention_ledger_v1")
        errors.push("version must be ruhroh_intervention_ledger_v1");
    if (!(Date.parse(ledger.coverage.startedAt) < Date.parse(ledger.coverage.endedAt))) {
        errors.push("coverage must have an end after its start");
    }
    if (ledger.coverage.complete && ledger.coverage.missingReasons.length > 0) {
        errors.push("complete ledger coverage cannot include missingReasons");
    }
    const ids = new Set();
    for (const [index, event] of ledger.events.entries()) {
        if (ids.has(event.eventId))
            errors.push(`events[${index}] duplicates eventId ${event.eventId}`);
        ids.add(event.eventId);
        if (!Number.isFinite(event.durationMinutes) || event.durationMinutes < 0)
            errors.push(`events[${index}].durationMinutes must be non-negative`);
        if (event.workflowInstanceId !== ledger.workloadBinding.workflowInstanceId) {
            errors.push(`events[${index}].workflowInstanceId does not match the workload binding`);
        }
        for (const [refIndex, ref] of event.evidenceRefs.entries()) {
            errors.push(...validateHashedRef(ref, `events[${index}].evidenceRefs[${refIndex}]`));
        }
    }
    return errors;
}
export function buildRuhrohDecisionPacket(input) {
    const contextErrors = [
        ...validateRuhrohDecisionContext(input.context),
        ...validateHashedRef(input.contextRef, "contextRef"),
        ...validateDecisionTier(input.technicalOutcome, "technicalOutcome", { supportedRequiresMeasuredEvidence: true }),
    ];
    const ledgerErrors = input.interventionLedger === undefined ? [] : validateRuhrohInterventionLedger(input.interventionLedger);
    const now = Date.parse(input.createdAt ?? new Date().toISOString());
    const observationEnd = Date.parse(input.context.observationWindow.endedAt);
    const reworkEnd = observationEnd + input.context.interventionPolicy.reworkWindowDays * 86_400_000;
    const observationWindowComplete = Number.isFinite(now) && now >= reworkEnd;
    const ledgerCoversWindow = input.interventionLedger !== undefined
        && input.interventionLedger.coverage.complete
        && Date.parse(input.interventionLedger.coverage.startedAt) <= Date.parse(input.context.observationWindow.startedAt)
        && Date.parse(input.interventionLedger.coverage.endedAt) >= reworkEnd;
    const events = input.interventionLedger?.events ?? [];
    const attributable = events.filter((event) => {
        const timestamp = Date.parse(event.startedAt);
        return timestamp >= Date.parse(input.context.observationWindow.startedAt) && timestamp <= reworkEnd;
    });
    const disqualifying = attributable.filter((event) => event.kind !== "passive_oversight");
    const rework = attributable.filter((event) => event.kind === "rework");
    const autonomy = autonomousTier(input.technicalOutcome, input.interventionLedger, input.interventionLedgerRef, observationWindowComplete, ledgerCoversWindow, disqualifying);
    const businessEvidenceErrors = validateBusinessValueEvidence(input.context, input.businessValueEvidence, now);
    const businessValue = businessValueTier(input.context, input.businessValueEvidence, now, businessEvidenceErrors);
    const unresolvedEvidence = [
        ...contextErrors,
        ...ledgerErrors,
        ...businessEvidenceErrors,
        ...(input.interventionLedger === undefined ? ["intervention ledger is missing"] : []),
        ...(input.interventionLedger !== undefined && input.interventionLedgerRef === undefined ? ["intervention ledger source hash is missing"] : []),
        ...(!observationWindowComplete ? ["the attributable rework window is still open"] : []),
        ...(!ledgerCoversWindow ? ["human-work coverage does not span the full observation and rework window"] : []),
        ...(input.businessValueEvidence === undefined ? ["business-value evidence has not been supplied"] : []),
        ...(input.unitEconomics === undefined ? ["unit-economics evidence has not been supplied"] : []),
        ...(input.containmentEvidence === undefined ? ["resource-containment evidence has not been supplied"] : []),
        ...(input.traceFindings === undefined ? ["trace findings have not been supplied"] : []),
    ];
    const readiness = contextErrors.length > 0 || ledgerErrors.length > 0
        ? "draft"
        : unresolvedEvidence.length === 0 && input.decision !== undefined
            ? "decision_ready"
            : "review_required";
    return {
        version: "ruhroh_decision_packet_v1",
        packetId: input.packetId,
        createdAt: input.createdAt ?? new Date().toISOString(),
        contextRef: input.contextRef,
        workloadBinding: input.context.workloadBinding,
        sourceRefs: {
            benchmarkClaim: input.context.benchmarkClaimRef,
            ...(input.interventionLedgerRef === undefined ? {} : { interventionLedger: input.interventionLedgerRef }),
            ...(input.costReconciliationRef === undefined ? {} : { costReconciliation: input.costReconciliationRef }),
            ...(input.economicsEnvelopeRef === undefined ? {} : { economicsEnvelope: input.economicsEnvelopeRef }),
            ...(input.budgetOutcomeRef === undefined ? {} : { budgetOutcome: input.budgetOutcomeRef }),
            ...(input.findingsRef === undefined ? {} : { findings: input.findingsRef }),
        },
        tiers: { technicalOutcome: input.technicalOutcome, autonomousDeflection: autonomy, businessValue },
        humanWork: {
            coverageComplete: ledgerCoversWindow,
            observationWindowComplete,
            disqualifyingInterventions: disqualifying.length,
            passiveOversightEvents: attributable.filter((event) => event.kind === "passive_oversight").length,
            attributableReworkEvents: rework.length,
            attributableReworkMinutes: rework.reduce((total, event) => total + event.durationMinutes, 0),
            reworkWindowDays: input.context.interventionPolicy.reworkWindowDays,
        },
        technicalEvidence: {
            unitEconomics: input.unitEconomics ?? {
                status: "not_assessed",
                coverage: "unknown",
                reasons: ["unit-economics evidence was not supplied"],
            },
            containment: input.containmentEvidence ?? {
                budgetStatus: "not_assessed",
                reasons: ["resource-containment evidence was not supplied"],
            },
            traceFindings: input.traceFindings ?? { confirmed: 0, candidate: 0, notObservable: 0 },
        },
        readiness,
        unresolvedEvidence: unique(unresolvedEvidence),
        ...(input.decision === undefined ? {} : { decision: input.decision }),
    };
}
export function projectRuhrohProductEngineeringDecision(packet) {
    return {
        version: "ruhroh_product_engineering_decision_view_v1",
        packetId: packet.packetId,
        readiness: packet.readiness,
        workloadBinding: packet.workloadBinding,
        qualityEligibility: packet.tiers.technicalOutcome,
        autonomy: packet.tiers.autonomousDeflection,
        businessValue: packet.tiers.businessValue,
        unitEconomics: packet.technicalEvidence.unitEconomics,
        containment: {
            budgetStatus: packet.technicalEvidence.containment.budgetStatus,
            interventionCount: packet.humanWork.disqualifyingInterventions,
        },
        traceFindings: packet.technicalEvidence.traceFindings,
        rework: {
            coverageComplete: packet.humanWork.coverageComplete && packet.humanWork.observationWindowComplete,
            events: packet.humanWork.attributableReworkEvents,
            minutes: packet.humanWork.attributableReworkMinutes,
        },
        unresolvedEvidence: [...packet.unresolvedEvidence],
        ...(packet.decision === undefined ? {} : { decision: packet.decision }),
    };
}
export function validateRuhrohDecisionPacket(packet) {
    const errors = [];
    if (packet.version !== "ruhroh_decision_packet_v1")
        errors.push("version must be ruhroh_decision_packet_v1");
    errors.push(...validateHashedRef(packet.contextRef, "contextRef"));
    errors.push(...validateHashedRef(packet.sourceRefs.benchmarkClaim, "sourceRefs.benchmarkClaim"));
    for (const [field, ref] of Object.entries(packet.sourceRefs)) {
        if (field !== "benchmarkClaim" && ref !== undefined)
            errors.push(...validateHashedRef(ref, `sourceRefs.${field}`));
    }
    errors.push(...validateDecisionTier(packet.tiers.technicalOutcome, "tiers.technicalOutcome", { supportedRequiresMeasuredEvidence: true }));
    errors.push(...validateDecisionTier(packet.tiers.autonomousDeflection, "tiers.autonomousDeflection"));
    errors.push(...validateDecisionTier(packet.tiers.businessValue, "tiers.businessValue", { supportedRequiresMeasuredEvidence: true }));
    if (packet.readiness === "decision_ready") {
        if (packet.unresolvedEvidence.length > 0)
            errors.push("decision_ready packets cannot have unresolved evidence");
        if (packet.decision === undefined)
            errors.push("decision_ready packets require a human-signed decision");
        if (packet.technicalEvidence.unitEconomics.status === "not_assessed")
            errors.push("decision_ready packets require assessed unit economics");
        if (packet.technicalEvidence.containment.budgetStatus === "not_assessed")
            errors.push("decision_ready packets require assessed resource containment");
    }
    const economics = packet.technicalEvidence.unitEconomics;
    if (economics.coverage !== "complete" && (economics.costPerAcceptedOutcome !== undefined || economics.tokensPerAcceptedOutcome !== undefined)) {
        errors.push("precise unit-economics ratios require complete coverage");
    }
    if (economics.costPerAcceptedOutcome !== undefined && (!Number.isFinite(economics.costPerAcceptedOutcome.amount) || economics.costPerAcceptedOutcome.amount < 0 || !nonEmpty(economics.costPerAcceptedOutcome.currency))) {
        errors.push("costPerAcceptedOutcome requires a non-negative amount and native currency");
    }
    if (economics.tokensPerAcceptedOutcome !== undefined && (!Number.isFinite(economics.tokensPerAcceptedOutcome) || economics.tokensPerAcceptedOutcome < 0)) {
        errors.push("tokensPerAcceptedOutcome must be non-negative");
    }
    for (const [field, value] of Object.entries(packet.technicalEvidence.traceFindings)) {
        if (!Number.isInteger(value) || value < 0)
            errors.push(`technicalEvidence.traceFindings.${field} must be a non-negative integer`);
    }
    if (packet.tiers.autonomousDeflection.conclusion === "supported" && (packet.tiers.technicalOutcome.conclusion !== "supported"
        || !packet.humanWork.coverageComplete
        || packet.humanWork.disqualifyingInterventions > 0)) {
        errors.push("autonomous deflection cannot be supported without technical success, complete coverage, and zero disqualifying intervention");
    }
    if (packet.decision !== undefined) {
        if (packet.decision.signerRole !== "accountable_decision_owner")
            errors.push("decision.signerRole must be accountable_decision_owner");
        if (!Number.isFinite(Date.parse(packet.decision.signedAt)))
            errors.push("decision.signedAt must be a timestamp");
        if (!nonEmpty(packet.decision.rationale))
            errors.push("decision.rationale is required");
        errors.push(...validateHashedRef(packet.decision.signatureRef, "decision.signatureRef"));
    }
    return errors;
}
function autonomousTier(technical, ledger, ledgerRef, windowComplete, coverageComplete, disqualifying) {
    const evidenceRefs = ledgerRef === undefined ? [] : [ledgerRef];
    if (technical.conclusion !== "supported") {
        return { conclusion: "not_supported", evidenceLevel: technical.evidenceLevel, reasons: ["technical outcome was not supported"], evidenceRefs };
    }
    if (ledger === undefined || !windowComplete || !coverageComplete) {
        return { conclusion: "inconclusive", evidenceLevel: ledger?.verification ?? "declared", reasons: ["complete intervention and seven-day rework coverage is required"], evidenceRefs };
    }
    if (disqualifying.length > 0) {
        return {
            conclusion: "not_supported",
            evidenceLevel: ledger.verification,
            reasons: [`strict zero-touch autonomy was disqualified by ${disqualifying.length} intervention or rework event(s)`],
            evidenceRefs,
        };
    }
    return { conclusion: "supported", evidenceLevel: ledger.verification, reasons: ["technical success had complete human-work coverage with zero intervention or rework"], evidenceRefs };
}
function businessValueTier(context, evidence, now, evidenceErrors) {
    if (evidence === undefined) {
        return now < Date.parse(context.observationWindow.endedAt)
            ? { conclusion: "not_assessed", evidenceLevel: "declared", reasons: ["the business-value observation window is still open"], evidenceRefs: [] }
            : { conclusion: "inconclusive", evidenceLevel: "declared", reasons: ["no measured business-value evidence was supplied"], evidenceRefs: [] };
    }
    if (evidenceErrors.length > 0) {
        return { conclusion: "inconclusive", evidenceLevel: evidence.evidenceLevel, reasons: [...evidenceErrors], evidenceRefs: evidence.evidenceRefs };
    }
    return { conclusion: evidence.conclusion, evidenceLevel: evidence.evidenceLevel, reasons: [...evidence.reasons], evidenceRefs: [...evidence.evidenceRefs] };
}
function validateBusinessValueEvidence(context, evidence, now) {
    if (evidence === undefined)
        return [];
    const errors = [];
    if (evidence.indicatorId !== context.value.indicatorId) {
        errors.push("the observed indicator does not match the predeclared indicator");
    }
    if (!Number.isFinite(evidence.observedValue))
        errors.push("business-value observedValue must be finite");
    if (now < Date.parse(context.observationWindow.endedAt))
        errors.push("the business-value observation window is still open");
    if (evidence.evidenceRefs.length === 0)
        errors.push("business-value evidence requires at least one external evidence reference");
    for (const [index, ref] of evidence.evidenceRefs.entries()) {
        errors.push(...validateHashedRef(ref, `businessValueEvidence.evidenceRefs[${index}]`));
    }
    if (evidence.reasons.length === 0 || evidence.reasons.some((reason) => !nonEmpty(reason))) {
        errors.push("business-value evidence requires at least one non-empty reason");
    }
    return unique(errors);
}
function validateDecisionTier(tier, field, options = {}) {
    const errors = [];
    if (!["supported", "not_supported", "inconclusive", "not_assessed"].includes(tier.conclusion)) {
        errors.push(`${field}.conclusion is invalid`);
    }
    if (!["declared", "measured", "independently_verified"].includes(tier.evidenceLevel)) {
        errors.push(`${field}.evidenceLevel is invalid`);
    }
    if (tier.reasons.length === 0 || tier.reasons.some((reason) => !nonEmpty(reason))) {
        errors.push(`${field}.reasons must include at least one non-empty reason`);
    }
    for (const [index, ref] of tier.evidenceRefs.entries()) {
        errors.push(...validateHashedRef(ref, `${field}.evidenceRefs[${index}]`));
    }
    if (tier.conclusion === "supported" && tier.evidenceRefs.length === 0) {
        errors.push(`${field} cannot be supported without evidence references`);
    }
    if (tier.conclusion === "supported" && options.supportedRequiresMeasuredEvidence === true && tier.evidenceLevel === "declared") {
        errors.push(`${field} cannot be supported by declared evidence alone`);
    }
    return errors;
}
const DECISION_ROLES = [
    "technical_owner",
    "product_workload_owner",
    "financial_owner",
    "governance_owner",
    "accountable_decision_owner",
];
function validateHashedRef(ref, field) {
    const errors = [];
    if (!nonEmpty(ref.path))
        errors.push(`${field}.path is required`);
    if (!/^[a-f0-9]{64}$/u.test(ref.sha256))
        errors.push(`${field}.sha256 must be lowercase SHA-256`);
    return errors;
}
function unique(values) {
    return [...new Set(values)];
}
function nonEmpty(value) {
    return typeof value === "string" && value.trim().length > 0;
}
//# sourceMappingURL=decision.js.map