import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  discoverRuhrohScenarios,
  type ValidateRuhrohScenarioSourceResult,
  validateRuhrohScenarioSource,
} from "./generate.js";
import type {
  RuhrohScenarioEvaluationCalibrationSummary,
  RuhrohScenarioEvaluationLintDiagnostic,
  RuhrohScenarioDifficulty,
  RuhrohScenarioKind,
  RuhrohScenarioTier,
} from "./scenarios.js";
import {
  discoverRuhrohSuites,
  type ValidateRuhrohSuiteSourceResult,
  validateRuhrohSuiteSource,
} from "./suites.js";

export interface InspectRuhrohBenchmarkPackInput {
  scenarioDir: string;
  suiteDir?: string | undefined;
  requireFullCalibration?: boolean | undefined;
  requireRiskReviewed?: boolean | undefined;
}

export interface RuhrohBenchmarkPackInspection {
  version: "ruhroh_benchmark_pack_inspection_v1";
  source: {
    scenarioDir: string;
    suiteDir?: string | undefined;
  };
  requirements: {
    requireFullCalibration: boolean;
    requireRiskReviewed: boolean;
  };
  ready: boolean;
  blockers: string[];
  warnings: string[];
  summary: {
    scenarioCount: number;
    validScenarioCount: number;
    invalidScenarioCount: number;
    suiteCount: number;
    validSuiteCount: number;
    invalidSuiteCount: number;
    calibrationWarningCount: number;
    riskReviewWarningCount: number;
    difficultyCounts: RuhrohBenchmarkPackDifficultyCounts;
    runtimeEstimate: RuhrohBenchmarkPackRuntimeEstimate;
  };
  scenarios: RuhrohBenchmarkPackScenarioInspection[];
  suites: RuhrohBenchmarkPackSuiteInspection[];
}

export interface RuhrohBenchmarkPackScenarioInspection {
  id?: string | undefined;
  title?: string | undefined;
  tier?: RuhrohScenarioTier | undefined;
  kind?: RuhrohScenarioKind | undefined;
  sourcePath: string;
  content: RuhrohBenchmarkPackScenarioContentInspection;
  scenarioVersion?: string | undefined;
  visibility?: string | undefined;
  difficulty?: string | undefined;
  expectedRuntimeSeconds?: number | undefined;
  tags: string[];
  lifecycleStatus?: string | undefined;
  valid: boolean;
  errors: string[];
  warnings: string[];
  warningDetails: RuhrohScenarioEvaluationLintDiagnostic[];
  riskReview: RuhrohBenchmarkPackScenarioRiskReview;
  calibration?: RuhrohScenarioEvaluationCalibrationSummary | undefined;
}

export interface RuhrohBenchmarkPackScenarioContentInspection {
  scenarioPath: string;
  scenarioSha256?: string | undefined;
  promptPath?: string | undefined;
  promptSha256?: string | undefined;
  assetFingerprints: RuhrohBenchmarkPackContentFingerprint[];
  privateAssetFingerprints: RuhrohBenchmarkPackContentFingerprint[];
}

export interface RuhrohBenchmarkPackContentFingerprint {
  path: string;
  sourcePath: string;
  status: "ok" | "missing" | "unsupported";
  kind?: "file" | "directory" | undefined;
  fileCount?: number | undefined;
  sizeBytes?: number | undefined;
  sha256?: string | undefined;
  error?: string | undefined;
}

export interface RuhrohBenchmarkPackScenarioRiskReview {
  contaminationNotes?: string | undefined;
  status: "documented" | "needs_review";
  warnings: string[];
}

export interface RuhrohBenchmarkPackSuiteInspection {
  id?: string | undefined;
  title?: string | undefined;
  suiteVersion?: string | undefined;
  sourcePath: string;
  scenarioIds: string[];
  minRuns?: number | undefined;
  owner?: string | undefined;
  valid: boolean;
  errors: string[];
  warnings: string[];
  riskReview: RuhrohBenchmarkPackSuiteRiskReview;
  difficultyCounts: RuhrohBenchmarkPackDifficultyCounts;
  runtimeEstimate: RuhrohBenchmarkPackRuntimeEstimate;
  estimatedCollectionSeconds?: number | undefined;
}

export interface RuhrohBenchmarkPackSuiteRiskReview {
  contaminationReview?: string | undefined;
  rewardHackingReview?: string | undefined;
  status: "documented" | "needs_review";
  warnings: string[];
}

export type RuhrohBenchmarkPackDifficultyLabel = RuhrohScenarioDifficulty | "unknown";

export type RuhrohBenchmarkPackDifficultyCounts = Record<RuhrohBenchmarkPackDifficultyLabel, number>;

export interface RuhrohBenchmarkPackRuntimeEstimate {
  knownScenarioCount: number;
  unknownScenarioCount: number;
  totalExpectedRuntimeSeconds: number;
  minExpectedRuntimeSeconds?: number | undefined;
  maxExpectedRuntimeSeconds?: number | undefined;
}

export function inspectRuhrohBenchmarkPack(input: InspectRuhrohBenchmarkPackInput): RuhrohBenchmarkPackInspection {
  const scenarioDir = path.resolve(input.scenarioDir);
  const suiteDir = input.suiteDir === undefined ? undefined : path.resolve(input.suiteDir);
  const requireFullCalibration = input.requireFullCalibration === true;
  const requireRiskReviewed = input.requireRiskReviewed === true;
  const scenarioResults = discoverRuhrohScenarios(scenarioDir).map((source) => validateRuhrohScenarioSource(source));
  const availableScenarioIds = scenarioResults.flatMap((result) => result.scenario === undefined ? [] : [result.scenario.id]);
  const availableScenarioVersions = Object.fromEntries(scenarioResults.flatMap((result) => {
    if (result.scenario === undefined) {
      return [];
    }
    return [[result.scenario.id, result.scenario.metadata?.scenarioVersion ?? "0.1.0"]];
  }));
  const suiteResults = suiteDir === undefined
    ? []
    : discoverRuhrohSuites(suiteDir).map((source) => validateRuhrohSuiteSource(source, {
      availableScenarioIds,
      availableScenarioVersions,
    }));
  const scenarios = scenarioResults.map(formatScenarioInspection);
  const scenarioDifficultyById = new Map(scenarios.flatMap((scenario) => scenario.id === undefined ? [] : [[scenario.id, difficultyLabel(scenario.difficulty)]]));
  const scenarioRuntimeById = new Map(scenarios.flatMap((scenario) => scenario.id === undefined || scenario.expectedRuntimeSeconds === undefined ? [] : [[scenario.id, scenario.expectedRuntimeSeconds]]));
  const suites = suiteResults.map((result) => formatSuiteInspection(result, scenarioDifficultyById, scenarioRuntimeById));
  const blockers = [
    ...(scenarios.length === 0 ? [`no scenarios found in ${scenarioDir}`] : []),
    ...scenarios.flatMap((scenario) => scenario.errors.map((error) => `${scenario.id ?? scenario.sourcePath}: ${error}`)),
    ...suites.flatMap((suite) => suite.errors.map((error) => `${suite.id ?? suite.sourcePath}: ${error}`)),
    ...(requireFullCalibration ? scenarios.flatMap(calibrationBlockersForScenario) : []),
    ...(requireRiskReviewed ? riskReviewBlockers(scenarios, suites) : []),
  ];
  const warnings = [
    ...scenarios.flatMap((scenario) => scenario.warnings.map((warning) => `${scenario.id ?? scenario.sourcePath}: ${warning}`)),
    ...scenarios.flatMap((scenario) => scenario.riskReview.warnings.map((warning) => `${scenario.id ?? scenario.sourcePath}: ${warning}`)),
    ...suites.flatMap((suite) => suite.warnings.map((warning) => `${suite.id ?? suite.sourcePath}: ${warning}`)),
    ...suites.flatMap((suite) => suite.riskReview.warnings.map((warning) => `${suite.id ?? suite.sourcePath}: ${warning}`)),
  ];
  return {
    version: "ruhroh_benchmark_pack_inspection_v1",
    source: {
      scenarioDir,
      ...(suiteDir === undefined ? {} : { suiteDir }),
    },
    requirements: {
      requireFullCalibration,
      requireRiskReviewed,
    },
    ready: blockers.length === 0,
    blockers,
    warnings,
    summary: {
      scenarioCount: scenarios.length,
      validScenarioCount: scenarios.filter((scenario) => scenario.valid).length,
      invalidScenarioCount: scenarios.filter((scenario) => !scenario.valid).length,
      suiteCount: suites.length,
      validSuiteCount: suites.filter((suite) => suite.valid).length,
      invalidSuiteCount: suites.filter((suite) => !suite.valid).length,
      calibrationWarningCount: scenarios.reduce((sum, scenario) => sum + (scenario.calibration?.warnings.length ?? 0), 0),
      riskReviewWarningCount: scenarios.reduce((sum, scenario) => sum + scenario.riskReview.warnings.length, 0)
        + suites.reduce((sum, suite) => sum + suite.riskReview.warnings.length, 0),
      difficultyCounts: difficultyCounts(scenarios.map((scenario) => difficultyLabel(scenario.difficulty))),
      runtimeEstimate: runtimeEstimate(scenarios.map((scenario) => scenario.expectedRuntimeSeconds)),
    },
    scenarios,
    suites,
  };
}

function riskReviewBlockers(
  scenarios: RuhrohBenchmarkPackScenarioInspection[],
  suites: RuhrohBenchmarkPackSuiteInspection[],
): string[] {
  return [
    ...scenarios.flatMap((scenario) => scenario.riskReview.warnings.map((warning) => (
      `${scenario.id ?? scenario.sourcePath}: risk review requirement failed: ${warning}`
    ))),
    ...suites.flatMap((suite) => suite.riskReview.warnings.map((warning) => (
      `${suite.id ?? suite.sourcePath}: risk review requirement failed: ${warning}`
    ))),
  ];
}

function calibrationBlockersForScenario(scenario: RuhrohBenchmarkPackScenarioInspection): string[] {
  const calibration = scenario.calibration;
  if (calibration === undefined || calibration.warnings.length === 0) {
    return [];
  }
  const missing = calibration.missingStatuses.length === 0
    ? ""
    : `; add ${calibration.missingStatuses.join(", ")} anchor(s)`;
  return calibration.warnings
    .map((warning) => `${scenario.id ?? scenario.sourcePath}: calibration requirement failed: ${warning}${missing}`);
}

function formatScenarioInspection(result: ValidateRuhrohScenarioSourceResult): RuhrohBenchmarkPackScenarioInspection {
  const scenario = result.scenario;
  return {
    ...(scenario === undefined ? {} : {
      id: scenario.id,
      title: scenario.title,
      tier: scenario.tier,
      kind: scenario.kind,
      scenarioVersion: scenario.metadata?.scenarioVersion,
      visibility: scenario.metadata?.visibility,
      difficulty: scenario.metadata?.difficulty,
      expectedRuntimeSeconds: scenario.metadata?.expectedRuntimeSeconds,
      lifecycleStatus: scenario.metadata?.lifecycle?.status,
    }),
    tags: scenario?.metadata?.tags ?? [],
    sourcePath: result.source.scenarioPath,
    content: inspectScenarioContent(result),
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
    warningDetails: result.warningDetails,
    riskReview: scenarioRiskReview(scenario),
    ...(result.calibration === undefined ? {} : { calibration: result.calibration }),
  };
}

function scenarioRiskReview(scenario: ValidateRuhrohScenarioSourceResult["scenario"]): RuhrohBenchmarkPackScenarioRiskReview {
  const contaminationNotes = scenario?.metadata?.contaminationNotes;
  const warnings = riskReviewWarnings("metadata.contaminationNotes", contaminationNotes, {
    missing: "document whether the prompt, assets, and expected outcome have public solution leakage or canonical-answer risk",
    weak: "replace placeholder contamination notes with the specific source, originality, or rotation review",
  });
  return {
    ...(contaminationNotes === undefined ? {} : { contaminationNotes }),
    status: warnings.length === 0 ? "documented" : "needs_review",
    warnings,
  };
}

function suiteRiskReview(suite: ValidateRuhrohSuiteSourceResult["suite"]): RuhrohBenchmarkPackSuiteRiskReview {
  const contaminationReview = suite?.governance.contaminationReview;
  const rewardHackingReview = suite?.governance.rewardHackingReview;
  const warnings = [
    ...riskReviewWarnings("governance.contaminationReview", contaminationReview, {
      missing: "document suite-level prompt, asset, and source-leakage review before registry submission",
      weak: "replace placeholder contamination review with concrete pack-specific evidence",
    }),
    ...riskReviewWarnings("governance.rewardHackingReview", rewardHackingReview, {
      missing: "document expected reward-hacking shortcuts and evaluator defenses before publication",
      weak: "replace placeholder reward-hacking review with concrete shortcut and evaluator-defense notes",
    }),
  ];
  return {
    ...(contaminationReview === undefined ? {} : { contaminationReview }),
    ...(rewardHackingReview === undefined ? {} : { rewardHackingReview }),
    status: warnings.length === 0 ? "documented" : "needs_review",
    warnings,
  };
}

function riskReviewWarnings(field: string, value: string | undefined, messages: { missing: string; weak: string }): string[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [`${field}: ${messages.missing}`];
  }
  const normalized = value.trim().toLowerCase();
  if (/^(?:todo|tbd|none|n\/a|na|unknown|fix later|review later)$/u.test(normalized)) {
    return [`${field}: ${messages.weak}`];
  }
  if (normalized.length < 20) {
    return [`${field}: ${messages.weak}`];
  }
  return [];
}

function inspectScenarioContent(result: ValidateRuhrohScenarioSourceResult): RuhrohBenchmarkPackScenarioContentInspection {
  const rawScenario = readRawScenarioJson(result.source.scenarioPath);
  const promptPath = resolvePromptPath(result, rawScenario);
  const assets = result.scenario?.assets ?? readStringArray(rawScenario?.assets);
  const privateAssets = result.scenario?.evaluation.privateAssets ?? readStringArray(readRecord(rawScenario?.evaluation)?.privateAssets);
  return {
    scenarioPath: result.source.scenarioPath,
    ...(existsSync(result.source.scenarioPath) ? { scenarioSha256: sha256File(result.source.scenarioPath) } : {}),
    ...(promptPath === undefined ? {} : {
      promptPath,
      ...(existsSync(promptPath) ? { promptSha256: sha256File(promptPath) } : {}),
    }),
    assetFingerprints: assets.map((asset) => fingerprintDeclaredContentPath(result.source.scenarioDir, asset)),
    privateAssetFingerprints: privateAssets.map((asset) => fingerprintDeclaredContentPath(result.source.scenarioDir, asset)),
  };
}

function resolvePromptPath(
  result: ValidateRuhrohScenarioSourceResult,
  rawScenario: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof rawScenario?.userPromptPath === "string") {
    return path.resolve(result.source.scenarioDir, rawScenario.userPromptPath);
  }
  return result.source.instructionPath;
}

function fingerprintDeclaredContentPath(scenarioDir: string, declaredPath: string): RuhrohBenchmarkPackContentFingerprint {
  const sourcePath = path.resolve(scenarioDir, declaredPath);
  try {
    if (!existsSync(sourcePath)) {
      return {
        path: declaredPath,
        sourcePath,
        status: "missing",
        error: "declared path does not exist",
      };
    }
    const stats = statSync(sourcePath);
    if (stats.isFile()) {
      return {
        path: declaredPath,
        sourcePath,
        status: "ok",
        kind: "file",
        fileCount: 1,
        sizeBytes: stats.size,
        sha256: sha256File(sourcePath),
      };
    }
    if (stats.isDirectory()) {
      return fingerprintDirectory(sourcePath, declaredPath);
    }
    return {
      path: declaredPath,
      sourcePath,
      status: "unsupported",
      error: "declared path is neither a file nor a directory",
    };
  } catch (error) {
    return {
      path: declaredPath,
      sourcePath,
      status: "unsupported",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function fingerprintDirectory(sourcePath: string, declaredPath: string): RuhrohBenchmarkPackContentFingerprint {
  const files = listDirectoryFiles(sourcePath);
  const hash = createHash("sha256");
  let sizeBytes = 0;
  hash.update("ruhroh_directory_fingerprint_v1\n");
  for (const relativePath of files) {
    const filePath = path.join(sourcePath, relativePath);
    const fileStats = statSync(filePath);
    const fileHash = sha256File(filePath);
    sizeBytes += fileStats.size;
    hash.update(`${toPosixPath(relativePath)}\0${fileStats.size}\0${fileHash}\n`);
  }
  return {
    path: declaredPath,
    sourcePath,
    status: "ok",
    kind: "directory",
    fileCount: files.length,
    sizeBytes,
    sha256: hash.digest("hex"),
  };
}

function listDirectoryFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listDirectoryFiles(entryPath).map((relativePath) => path.join(entry.name, relativePath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entry.name);
    }
  }
  return files.sort((left, right) => toPosixPath(left).localeCompare(toPosixPath(right)));
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function readRawScenarioJson(scenarioPath: string): Record<string, unknown> | undefined {
  try {
    return readRecord(JSON.parse(readFileSync(scenarioPath, "utf8")));
  } catch {
    return undefined;
  }
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

function formatSuiteInspection(
  result: ValidateRuhrohSuiteSourceResult,
  scenarioDifficultyById: ReadonlyMap<string, RuhrohBenchmarkPackDifficultyLabel>,
  scenarioRuntimeById: ReadonlyMap<string, number>,
): RuhrohBenchmarkPackSuiteInspection {
  const suite = result.suite;
  const suiteDifficulties = (suite?.scenarioIds ?? []).map((scenarioId) => scenarioDifficultyById.get(scenarioId) ?? "unknown");
  const suiteRuntimes = (suite?.scenarioIds ?? []).map((scenarioId) => scenarioRuntimeById.get(scenarioId));
  const estimate = runtimeEstimate(suiteRuntimes);
  return {
    ...(suite === undefined ? {} : {
      id: suite.id,
      title: suite.title,
      suiteVersion: suite.suiteVersion,
      scenarioIds: suite.scenarioIds,
      minRuns: suite.methodology.minRuns,
      owner: suite.governance.owner,
    }),
    sourcePath: result.source.suitePath,
    scenarioIds: suite?.scenarioIds ?? [],
    valid: result.errors.length === 0,
    errors: result.errors,
    warnings: result.warnings,
    riskReview: suiteRiskReview(suite),
    difficultyCounts: difficultyCounts(suiteDifficulties),
    runtimeEstimate: estimate,
    ...(suite?.methodology.minRuns === undefined
      ? {}
      : { estimatedCollectionSeconds: estimate.totalExpectedRuntimeSeconds * suite.methodology.minRuns }),
  };
}

function difficultyLabel(value: string | undefined): RuhrohBenchmarkPackDifficultyLabel {
  return value === "intro" || value === "standard" || value === "hard" || value === "expert" ? value : "unknown";
}

function difficultyCounts(values: readonly RuhrohBenchmarkPackDifficultyLabel[]): RuhrohBenchmarkPackDifficultyCounts {
  const counts: RuhrohBenchmarkPackDifficultyCounts = {
    intro: 0,
    standard: 0,
    hard: 0,
    expert: 0,
    unknown: 0,
  };
  for (const value of values) {
    counts[value] += 1;
  }
  return counts;
}

function runtimeEstimate(values: readonly (number | undefined)[]): RuhrohBenchmarkPackRuntimeEstimate {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
  const total = known.reduce((sum, value) => sum + value, 0);
  return {
    knownScenarioCount: known.length,
    unknownScenarioCount: values.length - known.length,
    totalExpectedRuntimeSeconds: total,
    ...(known.length === 0 ? {} : {
      minExpectedRuntimeSeconds: Math.min(...known),
      maxExpectedRuntimeSeconds: Math.max(...known),
    }),
  };
}
