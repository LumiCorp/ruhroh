import {
  adapterSatisfiesRequirements,
  type RuhrohContinuityLevel,
  type RuhrohRunAgentAdapterCapabilities,
} from "./adapters.js";

export type RuhrohScenarioTier = "smoke" | "nightly" | "release";
export type RuhrohScenarioKind = "real_user" | "contract_stress";
export type RuhrohLoopStopPolicy = "goal_satisfied_or_max";
export type RuhrohDriverMode = "build" | "plan" | "chat";
export type RuhrohEvaluationMode = "agentic_goal_review";
export type RuhrohScenarioVersion = "ruhroh_scenario_v1" | "ruhroh_scenario_v2";
export type RuhrohScenarioDifficulty = "intro" | "standard" | "hard" | "expert";
export type RuhrohScenarioCalibrationExpectedStatus = "passed" | "failed" | "review";
export type RuhrohScenarioVisibility = "public" | "private" | "held_out";
export type RuhrohScenarioLifecycleStatus = "active" | "deprecated" | "retired";

export interface RuhrohScenarioMetadata {
  scenarioVersion: string;
  provenance?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  difficulty?: RuhrohScenarioDifficulty | undefined;
  tags?: string[] | undefined;
  visibility?: RuhrohScenarioVisibility | undefined;
  expectedRuntimeSeconds?: number | undefined;
  networkRationale?: string | undefined;
  contaminationNotes?: string | undefined;
  privateEvalRationale?: string | undefined;
  maintainers?: string[] | undefined;
  changelog?: string[] | undefined;
  lifecycle?: RuhrohScenarioLifecycle | undefined;
}

export interface RuhrohScenarioLifecycle {
  status: RuhrohScenarioLifecycleStatus;
  reason?: string | undefined;
  replacementId?: string | undefined;
  sunsetAt?: string | undefined;
}

export interface RuhrohScenario {
  version: RuhrohScenarioVersion;
  id: string;
  title: string;
  tier: RuhrohScenarioTier;
  kind: RuhrohScenarioKind;
  metadata?: RuhrohScenarioMetadata | undefined;
  userPrompt: string;
  assets?: string[] | undefined;
  driver?: {
    adapter: string;
    profileId?: string | undefined;
    mode?: RuhrohDriverMode | undefined;
    timeoutSeconds: number;
    env?: Record<string, string> | undefined;
    command?: string | undefined;
    completionProtocol?: string | undefined;
  };
  run: {
    mode?: RuhrohDriverMode | undefined;
    timeoutSeconds: number;
  };
  requires: {
    continuity: RuhrohContinuityLevel;
    tools: string[];
    network: boolean;
  };
  loop: {
    defaultMaxIterations: number;
    stopPolicy: RuhrohLoopStopPolicy;
  };
  evaluation: {
    mode: RuhrohEvaluationMode;
    scenarioContext: string[];
    goalRubric: string[];
    evidenceGuidance: string[];
    calibrationCases?: RuhrohScenarioEvaluationCalibrationCase[] | undefined;
    privateAssets?: string[] | undefined;
  };
}

export interface RuhrohScenarioEvaluationCalibrationCase {
  id: string;
  inputSummary: string;
  expectedStatus: RuhrohScenarioCalibrationExpectedStatus;
  rationale: string;
}

export interface ValidateRuhrohScenarioOptions {
  adapters?: Record<string, RuhrohRunAgentAdapterCapabilities> | undefined;
}

export type RuhrohScenarioEvaluationLintSeverity = "warning";
export type RuhrohScenarioEvaluationLintCategory = "calibration" | "rubric" | "evidence";

export interface RuhrohScenarioEvaluationLintDiagnostic {
  code: string;
  severity: RuhrohScenarioEvaluationLintSeverity;
  category: RuhrohScenarioEvaluationLintCategory;
  field: string;
  message: string;
}

export interface RuhrohScenarioSource {
  scenarioDir: string;
  scenarioPath: string;
  instructionPath?: string | undefined;
  assetsDir?: string | undefined;
}

export function validateRuhrohScenario(
  scenario: RuhrohScenario,
  options: ValidateRuhrohScenarioOptions = {},
): string[] {
  const errors: string[] = [];
  if (scenario.version !== "ruhroh_scenario_v1" && scenario.version !== "ruhroh_scenario_v2") {
    errors.push("version must be ruhroh_scenario_v1 or ruhroh_scenario_v2");
  }
  if (scenario.id.trim().length === 0) {
    errors.push("id is required");
  }
  if (!/^[a-zA-Z0-9._-]+$/u.test(scenario.id)) {
    errors.push(`id contains unsafe characters: ${scenario.id}`);
  }
  if (scenario.title.trim().length === 0) {
    errors.push("title is required");
  }
  if (scenario.metadata !== undefined) {
    errors.push(...validateScenarioMetadata(scenario.metadata));
  }
  errors.push(...validatePublishedScenarioMetadata(scenario));
  if (scenario.userPrompt.trim().length === 0) {
    errors.push("userPrompt is required");
  }
  if (scenario.version === "ruhroh_scenario_v2" && scenario.driver !== undefined) {
    errors.push("driver is not allowed in ruhroh_scenario_v2; choose adapters at runtime");
  }
  if (scenario.version !== "ruhroh_scenario_v2") {
    if (scenario.driver === undefined || scenario.driver.adapter.trim().length === 0) {
      errors.push("driver.adapter is required for legacy scenarios");
    }
    if ((scenario.driver?.timeoutSeconds ?? 0) <= 0) {
      errors.push("driver.timeoutSeconds must be positive for legacy scenarios");
    }
  }
  if (scenario.run.timeoutSeconds <= 0) {
    errors.push("run.timeoutSeconds must be positive");
  }
  if (!["native_session", "workspace_plus_transcript", "workspace_only"].includes(scenario.requires.continuity)) {
    errors.push("requires.continuity must be native_session, workspace_plus_transcript, or workspace_only");
  }
  if (scenario.requires.tools.some((tool) => tool.trim().length === 0)) {
    errors.push("requires.tools entries must be non-empty");
  }
  const capabilities = scenario.driver?.adapter === undefined ? undefined : options.adapters?.[scenario.driver.adapter];
  if (capabilities !== undefined) {
    errors.push(...adapterSatisfiesRequirements(capabilities, scenario.requires));
  }
  if (scenario.loop.defaultMaxIterations <= 0) {
    errors.push("loop.defaultMaxIterations must be positive");
  }
  if (scenario.loop.stopPolicy !== "goal_satisfied_or_max") {
    errors.push("loop.stopPolicy must be goal_satisfied_or_max");
  }
  if (scenario.evaluation.mode !== "agentic_goal_review") {
    errors.push("evaluation.mode must be agentic_goal_review");
  }
  if (scenario.evaluation.goalRubric.length === 0) {
    errors.push("evaluation.goalRubric must include at least one criterion");
  }
  if (scenario.evaluation.scenarioContext.some((item) => item.trim().length === 0)) {
    errors.push("evaluation.scenarioContext entries must be non-empty");
  }
  if (scenario.evaluation.evidenceGuidance.some((item) => item.trim().length === 0)) {
    errors.push("evaluation.evidenceGuidance entries must be non-empty");
  }
  if (scenario.evaluation.calibrationCases !== undefined) {
    errors.push(...validateCalibrationCases(scenario.evaluation.calibrationCases));
  }
  if (scenario.evaluation.privateAssets !== undefined) {
    errors.push(...validateNonEmptyStringArray(scenario.evaluation.privateAssets, "evaluation.privateAssets"));
  }
  return errors;
}

export function lintRuhrohScenarioEvaluation(scenario: RuhrohScenario): string[] {
  return lintRuhrohScenarioEvaluationDetailed(scenario).map((diagnostic) => diagnostic.message);
}

export function lintRuhrohScenarioEvaluationDetailed(scenario: RuhrohScenario): RuhrohScenarioEvaluationLintDiagnostic[] {
  const diagnostics: RuhrohScenarioEvaluationLintDiagnostic[] = [];
  const addDiagnostic = (
    code: string,
    category: RuhrohScenarioEvaluationLintCategory,
    field: string,
    message: string,
  ): void => {
    diagnostics.push({ code, severity: "warning", category, field, message });
  };
  const rawEvaluation = (scenario as Partial<RuhrohScenario>).evaluation;
  if (!isRecord(rawEvaluation)) {
    return diagnostics;
  }
  const scenarioContext = readStringArray(rawEvaluation.scenarioContext);
  const goalRubric = readStringArray(rawEvaluation.goalRubric);
  const evidenceGuidance = readStringArray(rawEvaluation.evidenceGuidance);
  const calibrationCases = readCalibrationCases(rawEvaluation.calibrationCases);

  if (scenarioContext.length < 2) {
    addDiagnostic(
      "evaluation_context_minimum",
      "calibration",
      "evaluation.scenarioContext",
      "evaluation.scenarioContext should include at least 2 context notes for evaluator calibration",
    );
  }
  if (calibrationCases.length === 0) {
    addDiagnostic(
      "evaluation_calibration_cases_minimum",
      "calibration",
      "evaluation.calibrationCases",
      "evaluation.calibrationCases should include at least 1 expected judgment anchor",
    );
  }
  if (goalRubric.length < 3) {
    addDiagnostic(
      "evaluation_goal_rubric_minimum",
      "rubric",
      "evaluation.goalRubric",
      "evaluation.goalRubric should include at least 3 concrete outcome criteria",
    );
  }
  if (evidenceGuidance.length < 2) {
    addDiagnostic(
      "evaluation_evidence_guidance_minimum",
      "evidence",
      "evaluation.evidenceGuidance",
      "evaluation.evidenceGuidance should include at least 2 evidence collection instructions",
    );
  }

  goalRubric.forEach((criterion, index) => {
    const normalized = criterion.trim().toLowerCase();
    if (normalized.length < 40) {
      addDiagnostic(
        "evaluation_goal_rubric_terse",
        "rubric",
        `evaluation.goalRubric[${index}]`,
        `evaluation.goalRubric[${index}] is terse; prefer a concrete, auditable outcome`,
      );
    }
    if (/\bsatisf(?:y|ies)\s+the\s+user\s+(?:goal|prompt|request)\b/u.test(normalized)) {
      addDiagnostic(
        "evaluation_goal_rubric_generic",
        "rubric",
        `evaluation.goalRubric[${index}]`,
        `evaluation.goalRubric[${index}] is generic; state the specific behavior the evaluator must verify`,
      );
    }
  });

  const behaviorProxyGuidance = evidenceGuidance.some((item) => {
    const normalized = item.toLowerCase();
    const antiProxy = /\bdo\s+not\s+require\b|\bover\s+source\b|\brather\s+than\s+source\b|\bprefer\s+evidence\b/u.test(normalized);
    return !antiProxy
      && (/\bsource\s+(?:text|code)\s+match(?:es)?\b/u.test(normalized) || /\bfilenames?\b/u.test(normalized));
  });
  if (behaviorProxyGuidance) {
    addDiagnostic(
      "evaluation_evidence_proxy_source",
      "evidence",
      "evaluation.evidenceGuidance",
      "evaluation.evidenceGuidance should prioritize delivered behavior over source-text or filename checks",
    );
  }

  return dedupeEvaluationLintDiagnostics(diagnostics);
}

function validateCalibrationCases(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return ["evaluation.calibrationCases must be an array"];
  }
  const errors: string[] = [];
  value.forEach((item, index) => {
    const field = `evaluation.calibrationCases[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${field} must be an object`);
      return;
    }
    if (typeof item.id !== "string" || item.id.trim().length === 0) {
      errors.push(`${field}.id is required`);
    }
    if (typeof item.inputSummary !== "string" || item.inputSummary.trim().length === 0) {
      errors.push(`${field}.inputSummary is required`);
    }
    if (item.expectedStatus !== "passed" && item.expectedStatus !== "failed" && item.expectedStatus !== "review") {
      errors.push(`${field}.expectedStatus must be passed, failed, or review`);
    }
    if (typeof item.rationale !== "string" || item.rationale.trim().length === 0) {
      errors.push(`${field}.rationale is required`);
    }
  });
  return errors;
}

function dedupeEvaluationLintDiagnostics(
  diagnostics: RuhrohScenarioEvaluationLintDiagnostic[],
): RuhrohScenarioEvaluationLintDiagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = `${diagnostic.code}\0${diagnostic.field}\0${diagnostic.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function validateScenarioMetadata(metadata: unknown): string[] {
  const errors: string[] = [];
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return ["metadata must be an object when present"];
  }
  const record = metadata as Partial<RuhrohScenarioMetadata>;
  if (typeof record.scenarioVersion !== "string" || record.scenarioVersion.trim().length === 0) {
    errors.push("metadata.scenarioVersion is required when metadata is present");
  }
  if (record.createdAt !== undefined && (typeof record.createdAt !== "string" || !isDateLike(record.createdAt))) {
    errors.push("metadata.createdAt must be an ISO date or date-time string");
  }
  if (record.updatedAt !== undefined && (typeof record.updatedAt !== "string" || !isDateLike(record.updatedAt))) {
    errors.push("metadata.updatedAt must be an ISO date or date-time string");
  }
  if (
    record.difficulty !== undefined
    && record.difficulty !== "intro"
    && record.difficulty !== "standard"
    && record.difficulty !== "hard"
    && record.difficulty !== "expert"
  ) {
    errors.push("metadata.difficulty must be intro, standard, hard, or expert");
  }
  if (record.tags !== undefined) {
    errors.push(...validateNonEmptyStringArray(record.tags, "metadata.tags"));
  }
  if (
    record.visibility !== undefined
    && record.visibility !== "public"
    && record.visibility !== "private"
    && record.visibility !== "held_out"
  ) {
    errors.push("metadata.visibility must be public, private, or held_out");
  }
  if (
    record.expectedRuntimeSeconds !== undefined
    && (typeof record.expectedRuntimeSeconds !== "number" || !Number.isFinite(record.expectedRuntimeSeconds) || record.expectedRuntimeSeconds <= 0)
  ) {
    errors.push("metadata.expectedRuntimeSeconds must be positive");
  }
  if (record.maintainers !== undefined) {
    errors.push(...validateNonEmptyStringArray(record.maintainers, "metadata.maintainers"));
  }
  if (record.privateEvalRationale !== undefined && (typeof record.privateEvalRationale !== "string" || record.privateEvalRationale.trim().length === 0)) {
    errors.push("metadata.privateEvalRationale must be non-empty when present");
  }
  if (record.changelog !== undefined) {
    if (!Array.isArray(record.changelog) || record.changelog.length === 0) {
      errors.push("metadata.changelog must include at least one entry when present");
    }
    errors.push(...validateNonEmptyStringArray(record.changelog, "metadata.changelog"));
  }
  if (record.lifecycle !== undefined) {
    errors.push(...validateScenarioLifecycle(record.lifecycle));
  }
  return errors;
}

function validatePublishedScenarioMetadata(scenario: RuhrohScenario): string[] {
  const metadata = scenario.metadata;
  if (metadata?.visibility !== "public" && metadata?.visibility !== "held_out") {
    return [];
  }
  const errors: string[] = [];
  for (const key of [
    "provenance",
    "createdAt",
    "updatedAt",
    "contaminationNotes",
  ] as const) {
    const value = metadata[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`metadata.${key} is required for public or held_out scenarios`);
    }
  }
  if (metadata.difficulty === undefined) {
    errors.push("metadata.difficulty is required for public or held_out scenarios");
  }
  if (!Array.isArray(metadata.tags) || metadata.tags.length === 0) {
    errors.push("metadata.tags must include at least one entry for public or held_out scenarios");
  }
  if (metadata.expectedRuntimeSeconds === undefined) {
    errors.push("metadata.expectedRuntimeSeconds is required for public or held_out scenarios");
  }
  if (!Array.isArray(metadata.maintainers) || metadata.maintainers.length === 0) {
    errors.push("metadata.maintainers must include at least one entry for public or held_out scenarios");
  }
  if (!Array.isArray(metadata.changelog) || metadata.changelog.length === 0) {
    errors.push("metadata.changelog must include at least one entry for public or held_out scenarios");
  }
  if (metadata.lifecycle === undefined) {
    errors.push("metadata.lifecycle.status is required for public or held_out scenarios");
  }
  if (scenario.requires?.network === true && (typeof metadata.networkRationale !== "string" || metadata.networkRationale.trim().length === 0)) {
    errors.push("metadata.networkRationale is required when public or held_out scenarios require network access");
  }
  if (
    metadata.visibility === "held_out"
    && (scenario.evaluation.privateAssets === undefined || scenario.evaluation.privateAssets.length === 0)
    && (typeof metadata.privateEvalRationale !== "string" || metadata.privateEvalRationale.trim().length === 0)
  ) {
    errors.push("metadata.privateEvalRationale is required for held_out scenarios without evaluation.privateAssets");
  }
  return errors;
}

function validateScenarioLifecycle(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["metadata.lifecycle must be an object"];
  }
  const errors: string[] = [];
  if (value.status !== "active" && value.status !== "deprecated" && value.status !== "retired") {
    errors.push("metadata.lifecycle.status must be active, deprecated, or retired");
  }
  if (value.reason !== undefined && (typeof value.reason !== "string" || value.reason.trim().length === 0)) {
    errors.push("metadata.lifecycle.reason must be non-empty when present");
  }
  if (value.replacementId !== undefined) {
    if (typeof value.replacementId !== "string" || value.replacementId.trim().length === 0) {
      errors.push("metadata.lifecycle.replacementId must be non-empty when present");
    } else if (!/^[a-zA-Z0-9._-]+$/u.test(value.replacementId)) {
      errors.push(`metadata.lifecycle.replacementId contains unsafe characters: ${value.replacementId}`);
    }
  }
  if (value.sunsetAt !== undefined && (typeof value.sunsetAt !== "string" || !isDateLike(value.sunsetAt))) {
    errors.push("metadata.lifecycle.sunsetAt must be an ISO date or date-time string");
  }
  return errors;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readCalibrationCases(value: unknown): RuhrohScenarioEvaluationCalibrationCase[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is RuhrohScenarioEvaluationCalibrationCase =>
    isRecord(item)
    && typeof item.id === "string"
    && item.id.trim().length > 0
    && typeof item.inputSummary === "string"
    && item.inputSummary.trim().length > 0
    && (item.expectedStatus === "passed" || item.expectedStatus === "failed" || item.expectedStatus === "review")
    && typeof item.rationale === "string"
    && item.rationale.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateNonEmptyStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return [`${field} must be an array of non-empty strings`];
  }
  return value.some((item) => typeof item !== "string" || item.trim().length === 0)
    ? [`${field} entries must be non-empty strings`]
    : [];
}

function isDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/u.test(value);
}

export function getRuhrohScenarioById<TScenario extends { id: string }>(
  scenarios: TScenario[],
  id: string,
): TScenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}

export function getRuhrohScenariosByTier<TScenario extends { tier: RuhrohScenarioTier }>(
  scenarios: TScenario[],
  tier: RuhrohScenarioTier,
): TScenario[] {
  return scenarios.filter((scenario) => scenario.tier === tier);
}
