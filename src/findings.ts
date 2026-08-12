export const RUHROH_FINDING_DETECTORS = [
  "context_amplification",
  "retry_loop_amplification",
  "unnecessary_reasoning",
  "cache_misuse",
  "rework",
  "unpinned_model_alias",
] as const;

export type RuhrohFindingDetectorId = typeof RUHROH_FINDING_DETECTORS[number];
export type RuhrohFindingStatus = "confirmed" | "candidate" | "not_observable";

export interface RuhrohFindingEvidenceRefV1 {
  artifact: string;
  sha256: string;
  pointer?: string | undefined;
}

export interface RuhrohFindingMeasurementsV1 {
  turnInputTokens?: number[] | undefined;
  repeatedInputTokens?: number | undefined;
  equivalentRetryCount?: number | undefined;
  retryCount?: number | undefined;
  reasoningTokens?: number | undefined;
  lowerReasoningTokens?: number | undefined;
  cacheEligibleInputTokens?: number | undefined;
  cachedInputTokens?: number | undefined;
  revertedOrReplacedChanges?: number | undefined;
  observedModelFingerprints?: string[] | undefined;
  [key: string]: number | number[] | string[] | undefined;
}

export interface RuhrohFindingAssessmentInput {
  detectorId: RuhrohFindingDetectorId;
  detectorVersion?: string | undefined;
  scope: {
    benchmarkTargetId: string;
    scenarioId?: string | undefined;
    runIds: string[];
  };
  measurements: RuhrohFindingMeasurementsV1;
  evidenceRefs: RuhrohFindingEvidenceRefV1[];
  counterEvidence?: string[] | undefined;
  confounders?: string[] | undefined;
  controlledCountercase?: {
    present: boolean;
    equalQuality: boolean;
    relevantCoverageComplete: boolean;
    evidenceRefs: RuhrohFindingEvidenceRefV1[];
  } | undefined;
}

export interface RuhrohFindingV1 {
  version: "ruhroh_finding_v1";
  id: string;
  detectorId: RuhrohFindingDetectorId;
  detectorVersion: string;
  status: RuhrohFindingStatus;
  scope: RuhrohFindingAssessmentInput["scope"];
  signature: string;
  measurements: RuhrohFindingMeasurementsV1;
  evidenceRefs: RuhrohFindingEvidenceRefV1[];
  counterEvidence: string[];
  confounders: string[];
  confidence: "none" | "low" | "medium" | "high";
  suggestedExperiment: string;
  confirmationChecks: {
    signatureObserved: boolean;
    controlledCountercase: boolean;
    equalQuality: boolean;
    relevantCoverageComplete: boolean;
  };
}

export interface RuhrohFindingsV1 {
  version: "ruhroh_findings_v1";
  createdAt: string;
  findings: RuhrohFindingV1[];
  counts: Record<RuhrohFindingStatus, number>;
}

interface DetectorAssessment {
  observable: boolean;
  signatureObserved: boolean;
  signature: string;
  suggestedExperiment: string;
}

export function assessRuhrohFinding(input: RuhrohFindingAssessmentInput): RuhrohFindingV1 {
  const detector = assessDetector(input.detectorId, input.measurements);
  const controlledCountercase = input.controlledCountercase?.present === true;
  const equalQuality = input.controlledCountercase?.equalQuality === true;
  const relevantCoverageComplete = input.controlledCountercase?.relevantCoverageComplete === true;
  const confirmed = detector.signatureObserved && controlledCountercase && equalQuality && relevantCoverageComplete;
  const status: RuhrohFindingStatus = !detector.observable
    ? "not_observable"
    : confirmed
      ? "confirmed"
      : "candidate";
  const evidenceRefs = uniqueEvidenceRefs([
    ...input.evidenceRefs,
    ...(input.controlledCountercase?.evidenceRefs ?? []),
  ]);
  return {
    version: "ruhroh_finding_v1",
    id: `${input.detectorId}:${input.scope.benchmarkTargetId}:${input.scope.scenarioId ?? "suite"}`,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion ?? "1.0.0",
    status,
    scope: {
      ...input.scope,
      runIds: [...input.scope.runIds].sort(),
    },
    signature: detector.signature,
    measurements: cloneJson(input.measurements),
    evidenceRefs,
    counterEvidence: [...(input.counterEvidence ?? [])],
    confounders: [...(input.confounders ?? [])],
    confidence: status === "confirmed"
      ? "high"
      : status === "not_observable"
        ? "none"
        : detector.signatureObserved
          ? "medium"
          : "low",
    suggestedExperiment: detector.suggestedExperiment,
    confirmationChecks: {
      signatureObserved: detector.signatureObserved,
      controlledCountercase,
      equalQuality,
      relevantCoverageComplete,
    },
  };
}

export function buildRuhrohFindings(
  inputs: readonly RuhrohFindingAssessmentInput[],
  createdAt = new Date().toISOString(),
): RuhrohFindingsV1 {
  const findings = inputs.map(assessRuhrohFinding);
  return {
    version: "ruhroh_findings_v1",
    createdAt,
    findings,
    counts: {
      confirmed: findings.filter((finding) => finding.status === "confirmed").length,
      candidate: findings.filter((finding) => finding.status === "candidate").length,
      not_observable: findings.filter((finding) => finding.status === "not_observable").length,
    },
  };
}

export function validateRuhrohFindings(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["findings must be an object"];
  }
  const errors: string[] = [];
  if (value.version !== "ruhroh_findings_v1") {
    errors.push("version must be ruhroh_findings_v1");
  }
  if (!Array.isArray(value.findings)) {
    errors.push("findings must be an array");
    return errors;
  }
  for (const [index, raw] of value.findings.entries()) {
    if (!isRecord(raw)) {
      errors.push(`findings[${index}] must be an object`);
      continue;
    }
    if (!RUHROH_FINDING_DETECTORS.includes(raw.detectorId as RuhrohFindingDetectorId)) {
      errors.push(`findings[${index}].detectorId is unsupported`);
    }
    if (!["confirmed", "candidate", "not_observable"].includes(String(raw.status))) {
      errors.push(`findings[${index}].status is invalid`);
    }
    if (raw.status === "confirmed") {
      const checks = isRecord(raw.confirmationChecks) ? raw.confirmationChecks : {};
      for (const field of ["signatureObserved", "controlledCountercase", "equalQuality", "relevantCoverageComplete"] as const) {
        if (checks[field] !== true) {
          errors.push(`findings[${index}] cannot be confirmed without ${field}`);
        }
      }
    }
  }
  return errors;
}

function assessDetector(
  detectorId: RuhrohFindingDetectorId,
  measurements: RuhrohFindingMeasurementsV1,
): DetectorAssessment {
  switch (detectorId) {
    case "context_amplification": {
      const turns = measurements.turnInputTokens;
      if (!Array.isArray(turns) || turns.length < 2 || turns.some((value) => !nonNegativeNumber(value))) {
        return unobservable("turn-level input-token observations are required", "Repeat the same task with turn-level token telemetry and a compacted-context countercase.");
      }
      const rising = turns.slice(1).every((value, index) => value >= (turns[index] ?? 0));
      return observed(
        rising && (measurements.repeatedInputTokens ?? 0) > 0,
        `turn input tokens ${rising ? "rose monotonically" : "did not rise monotonically"}; repeated input tokens=${measurements.repeatedInputTokens ?? 0}`,
        "Run a controlled compacted-context condition with identical target, task, tools, and outcome floor.",
      );
    }
    case "retry_loop_amplification": {
      if (!nonNegativeNumber(measurements.retryCount) || !nonNegativeNumber(measurements.equivalentRetryCount)) {
        return unobservable("retry and equivalent-retry counts are required", "Instrument retry/fallback spans and compare against a bounded-retry policy.");
      }
      return observed(
        measurements.equivalentRetryCount > 0,
        `equivalent retries=${measurements.equivalentRetryCount} of total retries=${measurements.retryCount}`,
        "Compare the same workload with a predeclared equivalent-retry breaker while preserving the quality floor.",
      );
    }
    case "unnecessary_reasoning": {
      if (!nonNegativeNumber(measurements.reasoningTokens) || !nonNegativeNumber(measurements.lowerReasoningTokens)) {
        return unobservable("reasoning-token observations for both conditions are required", "Run a lower-reasoning controlled condition and require equal outcome quality.");
      }
      return observed(
        measurements.lowerReasoningTokens < measurements.reasoningTokens,
        `reasoning tokens baseline=${measurements.reasoningTokens}, countercase=${measurements.lowerReasoningTokens}`,
        "Repeat both reasoning conditions across the same frozen sample plan and confirm equal quality with complete coverage.",
      );
    }
    case "cache_misuse": {
      if (!nonNegativeNumber(measurements.cacheEligibleInputTokens) || !nonNegativeNumber(measurements.cachedInputTokens)) {
        return unobservable("cache-eligible and cached-input token observations are required", "Verify provider cache eligibility and compare an exact-prefix condition against the current request shape.");
      }
      return observed(
        measurements.cacheEligibleInputTokens > 0 && measurements.cachedInputTokens === 0,
        `cache-eligible tokens=${measurements.cacheEligibleInputTokens}, cached tokens=${measurements.cachedInputTokens}`,
        "Run a provider-verified exact-prefix countercase and measure accepted-outcome tokens and cost.",
      );
    }
    case "rework": {
      if (!nonNegativeNumber(measurements.revertedOrReplacedChanges)) {
        return unobservable("reverted-or-replaced change evidence is required", "Link change events to later revert/replace events and compare a planning or verification countercase.");
      }
      return observed(
        measurements.revertedOrReplacedChanges > 0,
        `reverted or replaced changes=${measurements.revertedOrReplacedChanges}`,
        "Compare against a controlled validation-before-edit condition with the same quality and task set.",
      );
    }
    case "unpinned_model_alias": {
      const fingerprints = measurements.observedModelFingerprints;
      if (!Array.isArray(fingerprints) || fingerprints.length === 0) {
        return unobservable("observed model fingerprints are required", "Capture provider-reported model fingerprints across repeated samples behind the alias.");
      }
      const distinct = new Set(fingerprints.filter((value) => value.trim().length > 0));
      return observed(
        distinct.size > 1,
        `observed distinct model fingerprints=${distinct.size}`,
        "Compare a pinned model/version target against the alias with otherwise identical configuration.",
      );
    }
  }
}

function observed(signatureObserved: boolean, signature: string, suggestedExperiment: string): DetectorAssessment {
  return { observable: true, signatureObserved, signature, suggestedExperiment };
}

function unobservable(signature: string, suggestedExperiment: string): DetectorAssessment {
  return { observable: false, signatureObserved: false, signature, suggestedExperiment };
}

function uniqueEvidenceRefs(refs: readonly RuhrohFindingEvidenceRefV1[]): RuhrohFindingEvidenceRefV1[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.artifact}\0${ref.sha256}\0${ref.pointer ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
