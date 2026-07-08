import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export type RuhrohSuiteVersion = "ruhroh_suite_v1";
export type RuhrohSuiteAggregationUnit = "scenario_adapter";
export type RuhrohSuiteReportPolicy = "pass_rate_ci_pass_at_k";

export interface RuhrohBenchmarkSuite {
  version: RuhrohSuiteVersion;
  id: string;
  title: string;
  suiteVersion: string;
  description: string;
  scenarioIds: string[];
  scenarioVersions: Record<string, string>;
  methodology: {
    minRuns: number;
    aggregationUnit: RuhrohSuiteAggregationUnit;
    reportPolicy: RuhrohSuiteReportPolicy;
    confidenceLevel: 0.95;
    retryPolicy: string;
  };
  governance: {
    owner: string;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    changelog: string[];
    acceptanceCriteria: string[];
    contaminationReview: string;
    rewardHackingReview: string;
    reviewChecklist: string[];
    deprecationPolicy: string;
  };
}

export interface RuhrohSuiteSource {
  suiteDir: string;
  suitePath: string;
}

export interface ValidateRuhrohSuiteSourceResult {
  source: RuhrohSuiteSource;
  suite?: RuhrohBenchmarkSuite | undefined;
  errors: string[];
  warnings: string[];
}

export function discoverRuhrohSuites(suiteRoot: string): RuhrohSuiteSource[] {
  const root = path.resolve(suiteRoot);
  if (!existsSync(root)) {
    return [];
  }
  const directSuitePath = path.join(root, "suite.json");
  if (existsSync(directSuitePath)) {
    return [suiteSourceFromDir(root)];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => suiteSourceFromDir(path.join(root, entry.name)))
    .filter((source) => existsSync(source.suitePath))
    .sort((left, right) => left.suiteDir.localeCompare(right.suiteDir));
}

export function loadRuhrohSuite(input: string | RuhrohSuiteSource): RuhrohBenchmarkSuite {
  const source = typeof input === "string" ? suiteSourceFromDir(path.resolve(input)) : input;
  const suite = readJsonRecord(source.suitePath) as unknown as RuhrohBenchmarkSuite;
  const errors = validateRuhrohSuite(suite);
  if (errors.length > 0) {
    throw new Error(`Invalid Ruhroh suite ${source.suitePath}: ${errors.join("; ")}`);
  }
  return suite;
}

export function validateRuhrohSuite(
  suite: RuhrohBenchmarkSuite,
  options: {
    availableScenarioIds?: readonly string[] | undefined;
    availableScenarioVersions?: Readonly<Record<string, string>> | undefined;
  } = {},
): string[] {
  const errors: string[] = [];
  if (suite.version !== "ruhroh_suite_v1") {
    errors.push("version must be ruhroh_suite_v1");
  }
  if (typeof suite.id !== "string" || suite.id.trim().length === 0) {
    errors.push("id is required");
  } else if (!/^[a-zA-Z0-9._-]+$/u.test(suite.id)) {
    errors.push(`id contains unsafe characters: ${suite.id}`);
  }
  if (typeof suite.title !== "string" || suite.title.trim().length === 0) {
    errors.push("title is required");
  }
  if (typeof suite.suiteVersion !== "string" || suite.suiteVersion.trim().length === 0) {
    errors.push("suiteVersion is required");
  }
  if (typeof suite.description !== "string" || suite.description.trim().length === 0) {
    errors.push("description is required");
  }
  if (!Array.isArray(suite.scenarioIds) || suite.scenarioIds.length === 0) {
    errors.push("scenarioIds must include at least one scenario id");
  } else {
    const seen = new Set<string>();
    for (const scenarioId of suite.scenarioIds) {
      if (typeof scenarioId !== "string" || scenarioId.trim().length === 0) {
        errors.push("scenarioIds entries must be non-empty strings");
        continue;
      }
      if (!/^[a-zA-Z0-9._-]+$/u.test(scenarioId)) {
        errors.push(`scenarioIds contains unsafe scenario id: ${scenarioId}`);
      }
      if (seen.has(scenarioId)) {
        errors.push(`scenarioIds contains duplicate scenario id: ${scenarioId}`);
      }
      seen.add(scenarioId);
    }
  }
  const available = options.availableScenarioIds === undefined ? undefined : new Set(options.availableScenarioIds);
  if (available !== undefined) {
    for (const scenarioId of suite.scenarioIds ?? []) {
      if (typeof scenarioId === "string" && !available.has(scenarioId)) {
        errors.push(`scenarioIds references unknown scenario: ${scenarioId}`);
      }
    }
  }
  errors.push(...validateScenarioVersionLocks(suite, options.availableScenarioVersions));
  errors.push(...validateMethodology(suite.methodology));
  errors.push(...validateGovernance(suite.governance));
  return errors;
}

export function validateRuhrohSuiteSource(
  input: string | RuhrohSuiteSource,
  options: {
    availableScenarioIds?: readonly string[] | undefined;
    availableScenarioVersions?: Readonly<Record<string, string>> | undefined;
  } = {},
): ValidateRuhrohSuiteSourceResult {
  const source = typeof input === "string" ? suiteSourceFromDir(path.resolve(input)) : input;
  const warnings: string[] = [];
  if (!existsSync(source.suitePath)) {
    return { source, errors: [`missing suite.json at ${source.suitePath}`], warnings };
  }
  let suite: RuhrohBenchmarkSuite;
  try {
    suite = readJsonRecord(source.suitePath) as unknown as RuhrohBenchmarkSuite;
  } catch (error) {
    return {
      source,
      errors: [`invalid suite.json: ${error instanceof Error ? error.message : String(error)}`],
      warnings,
    };
  }
  const errors = validateRuhrohSuite(suite, options);
  if (suite.methodology?.minRuns !== undefined && suite.methodology.minRuns < 5) {
    warnings.push("methodology.minRuns below 5 gives weak pass-rate confidence intervals");
  }
  return {
    source,
    ...(errors.length === 0 ? { suite } : {}),
    errors,
    warnings,
  };
}

function validateMethodology(methodology: RuhrohBenchmarkSuite["methodology"]): string[] {
  const errors: string[] = [];
  if (!isRecord(methodology)) {
    return ["methodology is required"];
  }
  if (typeof methodology.minRuns !== "number" || !Number.isFinite(methodology.minRuns) || methodology.minRuns <= 0) {
    errors.push("methodology.minRuns must be positive");
  }
  if (methodology.aggregationUnit !== "scenario_adapter") {
    errors.push("methodology.aggregationUnit must be scenario_adapter");
  }
  if (methodology.reportPolicy !== "pass_rate_ci_pass_at_k") {
    errors.push("methodology.reportPolicy must be pass_rate_ci_pass_at_k");
  }
  if (methodology.confidenceLevel !== 0.95) {
    errors.push("methodology.confidenceLevel must be 0.95");
  }
  if (typeof methodology.retryPolicy !== "string" || methodology.retryPolicy.trim().length === 0) {
    errors.push("methodology.retryPolicy is required");
  }
  return errors;
}

function validateScenarioVersionLocks(
  suite: RuhrohBenchmarkSuite,
  availableScenarioVersions?: Readonly<Record<string, string>> | undefined,
): string[] {
  const errors: string[] = [];
  if (!isRecord(suite.scenarioVersions)) {
    return ["scenarioVersions is required"];
  }
  const scenarioIds = Array.isArray(suite.scenarioIds)
    ? suite.scenarioIds.filter((scenarioId): scenarioId is string => typeof scenarioId === "string" && scenarioId.trim().length > 0)
    : [];
  const expectedIds = new Set(scenarioIds);
  const lockedIds = Object.keys(suite.scenarioVersions);
  for (const scenarioId of scenarioIds) {
    const version = suite.scenarioVersions[scenarioId];
    if (typeof version !== "string" || version.trim().length === 0) {
      errors.push(`scenarioVersions.${scenarioId} is required`);
    }
    const availableVersion = availableScenarioVersions?.[scenarioId];
    if (typeof version === "string" && availableVersion !== undefined && version !== availableVersion) {
      errors.push(`scenarioVersions.${scenarioId}=${version} does not match scenario metadata version ${availableVersion}`);
    }
  }
  for (const lockedId of lockedIds) {
    if (!expectedIds.has(lockedId)) {
      errors.push(`scenarioVersions contains entry for non-member scenario: ${lockedId}`);
    }
  }
  return errors;
}

function validateGovernance(governance: RuhrohBenchmarkSuite["governance"]): string[] {
  const errors: string[] = [];
  if (!isRecord(governance)) {
    return ["governance is required"];
  }
  if (typeof governance.owner !== "string" || governance.owner.trim().length === 0) {
    errors.push("governance.owner is required");
  }
  if (governance.createdAt !== undefined && !isDateLike(governance.createdAt)) {
    errors.push("governance.createdAt must be an ISO date or date-time string");
  }
  if (governance.updatedAt !== undefined && !isDateLike(governance.updatedAt)) {
    errors.push("governance.updatedAt must be an ISO date or date-time string");
  }
  errors.push(...validateNonEmptyStringArray(governance.changelog, "governance.changelog"));
  errors.push(...validateNonEmptyStringArray(governance.acceptanceCriteria, "governance.acceptanceCriteria"));
  if (typeof governance.contaminationReview !== "string" || governance.contaminationReview.trim().length === 0) {
    errors.push("governance.contaminationReview is required");
  }
  if (typeof governance.rewardHackingReview !== "string" || governance.rewardHackingReview.trim().length === 0) {
    errors.push("governance.rewardHackingReview is required");
  }
  errors.push(...validateNonEmptyStringArray(governance.reviewChecklist, "governance.reviewChecklist"));
  if (typeof governance.deprecationPolicy !== "string" || governance.deprecationPolicy.trim().length === 0) {
    errors.push("governance.deprecationPolicy is required");
  }
  return errors;
}

function suiteSourceFromDir(suiteDir: string): RuhrohSuiteSource {
  return {
    suiteDir,
    suitePath: path.join(suiteDir, "suite.json"),
  };
}

function readJsonRecord(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }
  return parsed;
}

function validateNonEmptyStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [`${field} must include at least one entry`];
  }
  return value.some((item) => typeof item !== "string" || item.trim().length === 0)
    ? [`${field} entries must be non-empty strings`]
    : [];
}

function isDateLike(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})?)?$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
