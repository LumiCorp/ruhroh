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

export interface RuhrohScenario {
  version: RuhrohScenarioVersion;
  id: string;
  title: string;
  tier: RuhrohScenarioTier;
  kind: RuhrohScenarioKind;
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
  };
}

export interface ValidateRuhrohScenarioOptions {
  adapters?: Record<string, RuhrohRunAgentAdapterCapabilities> | undefined;
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
  return errors;
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
