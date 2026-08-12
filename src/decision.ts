export interface RuhrohHashedSourceRefV1 {
  path: string;
  sha256: string;
  version?: string | undefined;
}

export const RUHROH_DEFAULT_REWORK_WINDOW_DAYS = 7;

export interface RuhrohWorkloadProfileV1 {
  version: "ruhroh_workload_profile_v1";
  profileId: string;
  taxonomy: { namespace: string; version: string };
  archetype: { id: string; label?: string | undefined };
  businessCapability?: { id: string; label?: string | undefined } | undefined;
  taskPurpose?: { id: string; label?: string | undefined } | undefined;
  unitOfWork: { id: string; label: string };
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

export type RuhrohDecisionRole =
  | "technical_owner"
  | "product_workload_owner"
  | "financial_owner"
  | "governance_owner"
  | "accountable_decision_owner";

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
  observationWindow: { startedAt: string; endedAt: string };
  interventionPolicy: {
    autonomy: "strict_zero_touch";
    passiveObservationCountsAsIntervention: false;
    reworkWindowDays: number;
  };
  stopRules: Array<{ id: string; condition: string; action: "continue" | "modify" | "stop" }>;
  owners: Record<RuhrohDecisionRole, string>;
  privacy: {
    classification: "public" | "internal" | "restricted";
    publicReportingGrain: "workload" | "project";
    redactionPolicyRef?: RuhrohHashedSourceRefV1 | undefined;
  };
}

export type RuhrohInterventionKind =
  | "approval"
  | "guidance"
  | "correction"
  | "execution"
  | "recovery"
  | "passive_oversight"
  | "rework";

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
  costPerAcceptedOutcome?: { amount: number; currency: string } | undefined;
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
  rework: { coverageComplete: boolean; events: number; minutes: number };
  unresolvedEvidence: string[];
  decision?: RuhrohSignedDecisionV1 | undefined;
}

export function validateRuhrohWorkloadProfile(profile: RuhrohWorkloadProfileV1): string[] {
  const errors: string[] = [];
  if (profile.version !== "ruhroh_workload_profile_v1") errors.push("workload profile version must be ruhroh_workload_profile_v1");
  for (const [field, value] of [
    ["profileId", profile.profileId],
    ["taxonomy.namespace", profile.taxonomy.namespace],
    ["taxonomy.version", profile.taxonomy.version],
    ["archetype.id", profile.archetype.id],
    ["unitOfWork.id", profile.unitOfWork.id],
    ["unitOfWork.label", profile.unitOfWork.label],
  ] as const) {
    if (!nonEmpty(value)) errors.push(`${field} is required`);
  }
  if (!profile.taxonomy.namespace.includes(":")) errors.push("taxonomy.namespace must be namespaced, for example example.com:workloads");
  return errors;
}

export function validateRuhrohControlSurface(surface: RuhrohControlSurfaceV1): string[] {
  const errors: string[] = [];
  if (surface.version !== "ruhroh_control_surface_v1") errors.push("control surface version must be ruhroh_control_surface_v1");
  if (surface.kind === "custom" && !nonEmpty(surface.customKind)) errors.push("customKind is required for a custom control surface");
  if (surface.kind !== "custom" && surface.customKind !== undefined) errors.push("customKind is only allowed for a custom control surface");
  return errors;
}

export function validateRuhrohWorkloadBinding(binding: RuhrohWorkloadBindingV1): string[] {
  const errors: string[] = [];
  if (binding.version !== "ruhroh_workload_binding_v1") errors.push("workload binding version must be ruhroh_workload_binding_v1");
  for (const [field, value] of [["experimentId", binding.experimentId], ["workloadId", binding.workloadId], ["projectId", binding.projectId]] as const) {
    if (!nonEmpty(value)) errors.push(`${field} is required`);
  }
  if (binding.hierarchyRef !== undefined) errors.push(...validateHashedRef(binding.hierarchyRef, "hierarchyRef"));
  return errors;
}

export function validateRuhrohDecisionContext(context: RuhrohDecisionContextV1): string[] {
  const errors: string[] = [];
  if (context.version !== "ruhroh_decision_context_v1") errors.push("version must be ruhroh_decision_context_v1");
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
  if (!nonEmpty(context.value.indicatorId)) errors.push("value.indicatorId is required");
  if (!nonEmpty(context.value.unit)) errors.push("value.unit is required");
  if (!nonEmpty(context.value.hypothesis)) errors.push("value.hypothesis is required");
  if (context.value.mode === "displaced_work" && (typeof context.value.baseline !== "number" || !Number.isFinite(context.value.baseline))) {
    errors.push("value.baseline is required for displaced_work; use net_new_value_or_risk for a net-new hypothesis");
  }
  if (context.value.baseline !== undefined && !Number.isFinite(context.value.baseline)) {
    errors.push("value.baseline must be finite when present");
  }
  if (!(Date.parse(context.observationWindow.startedAt) < Date.parse(context.observationWindow.endedAt))) {
    errors.push("observationWindow must have an end after its start");
  }
  if (context.stopRules.length === 0) errors.push("stopRules must include at least one predeclared rule");
  for (const role of DECISION_ROLES) {
    if (!nonEmpty(context.owners[role])) errors.push(`owners.${role} is required`);
  }
  errors.push(...validateHashedRef(context.benchmarkClaimRef, "benchmarkClaimRef"));
  return errors;
}

export function validateRuhrohInterventionLedger(ledger: RuhrohInterventionLedgerV1): string[] {
  const errors: string[] = [];
  if (ledger.version !== "ruhroh_intervention_ledger_v1") errors.push("version must be ruhroh_intervention_ledger_v1");
  if (!(Date.parse(ledger.coverage.startedAt) < Date.parse(ledger.coverage.endedAt))) {
    errors.push("coverage must have an end after its start");
  }
  if (ledger.coverage.complete && ledger.coverage.missingReasons.length > 0) {
    errors.push("complete ledger coverage cannot include missingReasons");
  }
  const ids = new Set<string>();
  for (const [index, event] of ledger.events.entries()) {
    if (ids.has(event.eventId)) errors.push(`events[${index}] duplicates eventId ${event.eventId}`);
    ids.add(event.eventId);
    if (!Number.isFinite(event.durationMinutes) || event.durationMinutes < 0) errors.push(`events[${index}].durationMinutes must be non-negative`);
    if (event.workflowInstanceId !== ledger.workloadBinding.workflowInstanceId) {
      errors.push(`events[${index}].workflowInstanceId does not match the workload binding`);
    }
    for (const [refIndex, ref] of event.evidenceRefs.entries()) {
      errors.push(...validateHashedRef(ref, `events[${index}].evidenceRefs[${refIndex}]`));
    }
  }
  return errors;
}

export function buildRuhrohDecisionPacket(input: {
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
}): RuhrohDecisionPacketV1 {
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

export function projectRuhrohProductEngineeringDecision(
  packet: RuhrohDecisionPacketV1,
): RuhrohProductEngineeringDecisionViewV1 {
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

export function validateRuhrohDecisionPacket(packet: RuhrohDecisionPacketV1): string[] {
  const errors: string[] = [];
  if (packet.version !== "ruhroh_decision_packet_v1") errors.push("version must be ruhroh_decision_packet_v1");
  errors.push(...validateHashedRef(packet.contextRef, "contextRef"));
  errors.push(...validateHashedRef(packet.sourceRefs.benchmarkClaim, "sourceRefs.benchmarkClaim"));
  for (const [field, ref] of Object.entries(packet.sourceRefs)) {
    if (field !== "benchmarkClaim" && ref !== undefined) errors.push(...validateHashedRef(ref, `sourceRefs.${field}`));
  }
  errors.push(...validateDecisionTier(packet.tiers.technicalOutcome, "tiers.technicalOutcome", { supportedRequiresMeasuredEvidence: true }));
  errors.push(...validateDecisionTier(packet.tiers.autonomousDeflection, "tiers.autonomousDeflection"));
  errors.push(...validateDecisionTier(packet.tiers.businessValue, "tiers.businessValue", { supportedRequiresMeasuredEvidence: true }));
  if (packet.readiness === "decision_ready") {
    if (packet.unresolvedEvidence.length > 0) errors.push("decision_ready packets cannot have unresolved evidence");
    if (packet.decision === undefined) errors.push("decision_ready packets require a human-signed decision");
    if (packet.technicalEvidence.unitEconomics.status === "not_assessed") errors.push("decision_ready packets require assessed unit economics");
    if (packet.technicalEvidence.containment.budgetStatus === "not_assessed") errors.push("decision_ready packets require assessed resource containment");
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
    if (!Number.isInteger(value) || value < 0) errors.push(`technicalEvidence.traceFindings.${field} must be a non-negative integer`);
  }
  if (packet.tiers.autonomousDeflection.conclusion === "supported" && (
    packet.tiers.technicalOutcome.conclusion !== "supported"
    || !packet.humanWork.coverageComplete
    || packet.humanWork.disqualifyingInterventions > 0
  )) {
    errors.push("autonomous deflection cannot be supported without technical success, complete coverage, and zero disqualifying intervention");
  }
  if (packet.decision !== undefined) {
    if (packet.decision.signerRole !== "accountable_decision_owner") errors.push("decision.signerRole must be accountable_decision_owner");
    if (!Number.isFinite(Date.parse(packet.decision.signedAt))) errors.push("decision.signedAt must be a timestamp");
    if (!nonEmpty(packet.decision.rationale)) errors.push("decision.rationale is required");
    errors.push(...validateHashedRef(packet.decision.signatureRef, "decision.signatureRef"));
  }
  return errors;
}

function autonomousTier(
  technical: RuhrohDecisionTierV1,
  ledger: RuhrohInterventionLedgerV1 | undefined,
  ledgerRef: RuhrohHashedSourceRefV1 | undefined,
  windowComplete: boolean,
  coverageComplete: boolean,
  disqualifying: readonly RuhrohInterventionEventV1[],
): RuhrohDecisionTierV1 {
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

function businessValueTier(
  context: RuhrohDecisionContextV1,
  evidence: Parameters<typeof buildRuhrohDecisionPacket>[0]["businessValueEvidence"],
  now: number,
  evidenceErrors: readonly string[],
): RuhrohDecisionTierV1 {
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

function validateBusinessValueEvidence(
  context: RuhrohDecisionContextV1,
  evidence: Parameters<typeof buildRuhrohDecisionPacket>[0]["businessValueEvidence"],
  now: number,
): string[] {
  if (evidence === undefined) return [];
  const errors: string[] = [];
  if (evidence.indicatorId !== context.value.indicatorId) {
    errors.push("the observed indicator does not match the predeclared indicator");
  }
  if (!Number.isFinite(evidence.observedValue)) errors.push("business-value observedValue must be finite");
  if (now < Date.parse(context.observationWindow.endedAt)) errors.push("the business-value observation window is still open");
  if (evidence.evidenceRefs.length === 0) errors.push("business-value evidence requires at least one external evidence reference");
  for (const [index, ref] of evidence.evidenceRefs.entries()) {
    errors.push(...validateHashedRef(ref, `businessValueEvidence.evidenceRefs[${index}]`));
  }
  if (evidence.reasons.length === 0 || evidence.reasons.some((reason) => !nonEmpty(reason))) {
    errors.push("business-value evidence requires at least one non-empty reason");
  }
  return unique(errors);
}

function validateDecisionTier(
  tier: RuhrohDecisionTierV1,
  field: string,
  options: { supportedRequiresMeasuredEvidence?: boolean | undefined } = {},
): string[] {
  const errors: string[] = [];
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

const DECISION_ROLES: RuhrohDecisionRole[] = [
  "technical_owner",
  "product_workload_owner",
  "financial_owner",
  "governance_owner",
  "accountable_decision_owner",
];

function validateHashedRef(ref: RuhrohHashedSourceRefV1, field: string): string[] {
  const errors: string[] = [];
  if (!nonEmpty(ref.path)) errors.push(`${field}.path is required`);
  if (!/^[a-f0-9]{64}$/u.test(ref.sha256)) errors.push(`${field}.sha256 must be lowercase SHA-256`);
  return errors;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
