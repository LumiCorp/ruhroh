import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { validateRuhrohOutcomeFrontier } from "./economics.js";
import {
  validateRuhrohBenchmarkClaim,
  validateRuhrohBenchmarkSummary,
  validateRuhrohCompareV2,
  type RuhrohBenchmarkClaimExportV2,
  type RuhrohCompareV2,
} from "./results.js";

export interface RuhrohPublishCheckSource {
  resultsPath: string;
  suiteId?: string | undefined;
  runPlanPath?: string | undefined;
  rerunLedgerPath?: string | undefined;
  benchmarkClaimPath?: string | undefined;
  benchmarkSummaryPath?: string | undefined;
  htmlPath?: string | undefined;
  summaryMarkdownPath?: string | undefined;
  bundlePath?: string | undefined;
  evaluatorCalibrationReportPath?: string | undefined;
}

export interface RuhrohPublishCheckRemediation {
  code: string;
  category: "suite" | "run_plan" | "artifacts" | "review" | "statistics" | "source_verification" | "claim" | "comparison";
  severity: "blocker" | "advisory";
  blocker: string;
  action: string;
  docs: string;
}

export interface RuhrohPublishCheckReport {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json";
  version: "ruhroh_publish_check_v1";
  source: RuhrohPublishCheckSource;
  publishable: boolean;
  blockerCount: number;
  blockers: string[];
  remediation: RuhrohPublishCheckRemediation[];
  advisoryCount: number;
  advisories: string[];
  compare: Record<string, unknown>;
  sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}

export type RuhrohPublishCheckReportV1 = RuhrohPublishCheckReport;

export interface RuhrohPublishCheckReportV2 {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-check-v2.schema.json";
  version: "ruhroh_publish_check_v2";
  source: RuhrohPublishCheckSource;
  publishable: boolean;
  blockerCount: number;
  blockers: string[];
  remediation: RuhrohPublishCheckRemediation[];
  advisoryCount: number;
  advisories: string[];
  compare: RuhrohCompareV2;
  sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}

export interface BuildRuhrohPublishCheckReportInput {
  source: RuhrohPublishCheckSource;
  compare: Record<string, unknown>;
  sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}

export interface BuildRuhrohPublishCheckReportV2Input {
  source: RuhrohPublishCheckSource;
  compare: RuhrohCompareV2;
  sourceVerification?: RuhrohClaimSourceVerificationReport | undefined;
}

export interface RuhrohPublicationContractValidationResult {
  version:
    | "ruhroh_publish_check_validation_v1"
    | "ruhroh_publish_check_validation_v2"
    | "ruhroh_publish_bundle_manifest_validation_v1"
    | "ruhroh_publish_bundle_manifest_validation_v2"
    | "ruhroh_claim_index_validation_v1"
    | "ruhroh_claim_index_validation_v2";
  errors: string[];
  warnings: string[];
}

export interface RuhrohClaimSourceVerificationCheck {
  name: string;
  status: "ok" | "warning" | "failed";
  details: string;
  path?: string | undefined;
  expectedSha256?: string | undefined;
  actualSha256?: string | undefined;
}

export interface RuhrohClaimSourceVerificationReport {
  version: "ruhroh_claim_source_verification_v1";
  checked: boolean;
  checks: RuhrohClaimSourceVerificationCheck[];
  errors: string[];
  warnings: string[];
}

export interface RuhrohPublishBundleValidationCheck {
  name: string;
  status: "ok" | "warning" | "failed";
  details: string;
  path?: string | undefined;
}

export interface RuhrohPublishBundleValidationReport {
  version: "ruhroh_publish_bundle_validation_report_v1";
  source: {
    bundlePath: string;
  };
  valid: boolean;
  publishable: boolean;
  checks: RuhrohPublishBundleValidationCheck[];
  errors: string[];
  warnings: string[];
}

export interface RuhrohPublishBundleFile {
  role: string;
  path: string;
  description: string;
}

export interface RuhrohPublishBundleSource {
  resultsPath: string;
  bundlePath: string;
  suiteId?: string | undefined;
  runPlanPath?: string | undefined;
  rerunLedgerPath?: string | undefined;
  evaluatorCalibrationReportPath?: string | undefined;
}

export interface RuhrohPublishBundleManifestV1 {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json";
  version: "ruhroh_publish_bundle_v1";
  createdAt: string;
  source: RuhrohPublishBundleSource;
  publishable: boolean;
  blockerCount: number;
  advisoryCount: number;
  files: RuhrohPublishBundleFile[];
}

export interface RuhrohPublishBundleContractsV2 {
  publishCheck: "ruhroh_publish_check_v2";
  compare: "ruhroh_compare_v2";
  benchmarkClaim: "ruhroh_benchmark_claim_v2";
  benchmarkSummary: "ruhroh_benchmark_summary_v2";
  outcomeFrontier: "ruhroh_outcome_frontier_v1";
}

export interface RuhrohPublishBundleManifestV2 {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v2.schema.json";
  version: "ruhroh_publish_bundle_v2";
  createdAt: string;
  source: RuhrohPublishBundleSource;
  publishable: boolean;
  blockerCount: number;
  advisoryCount: number;
  contracts: RuhrohPublishBundleContractsV2;
  files: RuhrohPublishBundleFile[];
}

export interface BuildRuhrohPublishBundleManifestV2Input {
  createdAt?: string | undefined;
  source: RuhrohPublishBundleSource;
  publishCheck: RuhrohPublishCheckReportV2;
  files: readonly RuhrohPublishBundleFile[];
}

export interface RuhrohClaimIndexTargetV2 {
  benchmarkTargetId: string;
  identityStatus: "declared" | "legacy_execution_adapter_fallback";
  executionAdapterIds: string[];
  runs: number;
  acceptedOutcomes: number;
  qualityFloorStatus: "passed" | "failed" | "indeterminate";
  paretoStatus: "pareto" | "dominated" | "ineligible" | "indeterminate";
  robustStatus: "pareto" | "dominated" | "ineligible" | "indeterminate";
}

export interface RuhrohClaimIndexEntryV2 {
  claimPath: string;
  bundlePath?: string | undefined;
  valid: boolean;
  publishable: boolean;
  scope: "suite" | "ad_hoc_compare";
  createdAt: string;
  suite?: {
    id: string;
    title?: string | undefined;
    suiteVersion?: string | undefined;
  } | undefined;
  targets: RuhrohClaimIndexTargetV2[];
  summary: RuhrohBenchmarkClaimExportV2["summary"];
  frontier: {
    status: RuhrohBenchmarkClaimExportV2["outcomeFrontier"]["status"];
    objectives: string[];
    paretoFrontierTargetIds: string[];
    robustFrontierTargetIds: string[];
  };
  evidence: RuhrohBenchmarkClaimExportV2["evidence"];
  sourcePaths: {
    resultsPath?: string | undefined;
    runPlanPath?: string | undefined;
    rerunLedgerPath?: string | undefined;
    suitePath?: string | undefined;
  };
  blockers: string[];
  advisories: string[];
  validationErrors: string[];
  validationWarnings: string[];
}

export interface RuhrohClaimIndexReportV2 {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/claim-index-v2.schema.json";
  version: "ruhroh_claim_index_v2";
  generatedAt: string;
  source: {
    inputPath: string;
    htmlPath?: string | undefined;
  };
  registryReady: boolean;
  registryBlockers: string[];
  claimCount: number;
  publishableCount: number;
  blockedCount: number;
  invalidCount: number;
  suiteCount: number;
  targetCount: number;
  totalRuns: number;
  totalAcceptedOutcomes: number;
  claims: RuhrohClaimIndexEntryV2[];
}

export interface BuildRuhrohClaimIndexEntryV2Input {
  claimPath: string;
  bundlePath?: string | undefined;
  claim: RuhrohBenchmarkClaimExportV2;
}

export interface BuildRuhrohClaimIndexV2Input {
  generatedAt?: string | undefined;
  source: RuhrohClaimIndexReportV2["source"];
  claims: readonly RuhrohClaimIndexEntryV2[];
}

export type RuhrohPublishCheckV2 = RuhrohPublishCheckReportV2;
export type RuhrohPublicationBundleV2 = RuhrohPublishBundleManifestV2;
export type RuhrohPublicationIndexV2 = RuhrohClaimIndexReportV2;

export type RuhrohPublicationArtifactRoleV2 =
  | "publish-check"
  | "bundle-manifest"
  | "claim-index"
  | "compare"
  | "benchmark-claim"
  | "benchmark-summary"
  | "outcome-frontier"
  | "economic-trace"
  | "intervention-ledger"
  | "cost-reconciliation"
  | "decision-packet";

export interface RuhrohPublicationArtifactReferenceV2 {
  role: RuhrohPublicationArtifactRoleV2;
  path: string;
  sha256: string;
  contractVersion:
    | "ruhroh_publish_check_v2"
    | "ruhroh_publish_bundle_v2"
    | "ruhroh_claim_index_v2"
    | "ruhroh_compare_v2"
    | "ruhroh_benchmark_claim_v2"
    | "ruhroh_benchmark_summary_v2"
    | "ruhroh_outcome_frontier_v1"
    | "ruhroh_economic_trace_span_v1"
    | "ruhroh_intervention_ledger_v1"
    | "ruhroh_cost_reconciliation_v1"
    | "ruhroh_decision_packet_v1";
}

export interface RuhrohPublicationV2 {
  $schema: "https://lumicorp.github.io/ruhroh/schemas/publication-v2.schema.json";
  version: "ruhroh_publication_v2";
  createdAt: string;
  publishable: boolean;
  artifacts: RuhrohPublicationArtifactReferenceV2[];
}

export interface BuildRuhrohPublicationV2Input {
  createdAt?: string | undefined;
  publishable: boolean;
  artifacts: readonly RuhrohPublicationArtifactReferenceV2[];
}

export interface RuhrohPublicationV2ValidationResult {
  version: "ruhroh_publication_validation_v2";
  errors: string[];
  warnings: string[];
}

const REQUIRED_PUBLISH_BUNDLE_ROLES = [
  "manifest",
  "publish-check",
  "compare-html",
  "benchmark-claim",
  "benchmark-summary",
  "review-json",
  "review-html",
  "eval-quality",
  "eval-quality-html",
  "readme",
] as const;

const REQUIRED_PUBLISH_BUNDLE_ROLES_V2 = [
  ...REQUIRED_PUBLISH_BUNDLE_ROLES,
  "publication",
  "compare",
  "outcome-frontier",
] as const;

const PUBLISH_CHECK_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json";
const PUBLISH_BUNDLE_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json";
const PUBLISH_CHECK_V2_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-check-v2.schema.json";
const PUBLISH_BUNDLE_V2_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v2.schema.json";
const CLAIM_INDEX_V2_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/claim-index-v2.schema.json";
const PUBLICATION_V2_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publication-v2.schema.json";

export function buildRuhrohPublishCheckReport(input: BuildRuhrohPublishCheckReportInput): RuhrohPublishCheckReport {
  const benchmarkClaim = isRecord(input.compare.benchmarkClaim) ? input.compare.benchmarkClaim : undefined;
  if (benchmarkClaim === undefined) {
    throw new Error("publish-check compare output must include benchmarkClaim");
  }
  const readiness = isRecord(input.compare.claimReadiness) ? input.compare.claimReadiness : {};
  const sourceVerificationErrors = input.sourceVerification?.errors.map((error) => `source verification: ${error}`) ?? [];
  const sourceVerificationWarnings = input.sourceVerification?.warnings.map((warning) => `source verification: ${warning}`) ?? [];
  const publishabilityGate = benchmarkClaimPublishabilityGate(benchmarkClaim);
  const blockers = uniquePreserveOrder([
    ...publishabilityGate.blockers,
    ...sourceVerificationErrors,
  ]);
  const advisories = uniquePreserveOrder([
    ...stringArrayField(readiness, "advisories"),
    ...sourceVerificationWarnings,
  ]);
  return {
    $schema: PUBLISH_CHECK_SCHEMA_URL,
    version: "ruhroh_publish_check_v1",
    source: input.source,
    publishable: publishabilityGate.publishable && sourceVerificationErrors.length === 0,
    blockerCount: blockers.length,
    blockers,
    remediation: blockers.map(ruhrohPublishCheckRemediationForBlocker),
    advisoryCount: advisories.length,
    advisories,
    compare: input.compare,
    ...(input.sourceVerification === undefined ? {} : { sourceVerification: input.sourceVerification }),
  };
}

export function buildRuhrohPublishCheckReportV2(input: BuildRuhrohPublishCheckReportV2Input): RuhrohPublishCheckReportV2 {
  const compareValidation = validateRuhrohCompareV2(input.compare);
  if (compareValidation.errors.length > 0) {
    throw new Error(`cannot build v2 publish check from invalid compare output: ${compareValidation.errors.join("; ")}`);
  }
  const sourceVerificationErrors = input.sourceVerification?.errors.map((error) => `source verification: ${error}`) ?? [];
  const sourceVerificationWarnings = input.sourceVerification?.warnings.map((warning) => `source verification: ${warning}`) ?? [];
  const publishabilityGate = benchmarkClaimPublishabilityGate(input.compare.benchmarkClaim);
  const blockers = uniquePreserveOrder([
    ...publishabilityGate.blockers,
    ...sourceVerificationErrors,
  ]);
  const advisories = uniquePreserveOrder([
    ...input.compare.benchmarkClaim.readiness.publication.advisories,
    ...sourceVerificationWarnings,
  ]);
  return {
    $schema: PUBLISH_CHECK_V2_SCHEMA_URL,
    version: "ruhroh_publish_check_v2",
    source: { ...input.source },
    publishable: publishabilityGate.publishable && sourceVerificationErrors.length === 0,
    blockerCount: blockers.length,
    blockers,
    remediation: blockers.map(ruhrohPublishCheckRemediationForBlocker),
    advisoryCount: advisories.length,
    advisories,
    compare: input.compare,
    ...(input.sourceVerification === undefined ? {} : { sourceVerification: input.sourceVerification }),
  };
}

export const buildRuhrohPublishCheckV2 = buildRuhrohPublishCheckReportV2;

export function validateRuhrohPublishCheckReport(input: unknown): RuhrohPublicationContractValidationResult {
  if (isRecord(input) && input.version === "ruhroh_publish_check_v2") {
    return validateRuhrohPublishCheckReportV2(input);
  }
  return validateRuhrohPublishCheckReportV1(input);
}

export function validateRuhrohPublishCheckReportV1(input: unknown): RuhrohPublicationContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_publish_check_validation_v1", errors: ["publish check must be an object"], warnings };
  }
  if (input.version !== "ruhroh_publish_check_v1") errors.push("version must be ruhroh_publish_check_v1");
  if (input.$schema !== undefined && input.$schema !== PUBLISH_CHECK_SCHEMA_URL) warnings.push("$schema does not match the v1 publish-check schema URL");
  validatePublishCheckCommon(input, errors);
  const compare = isRecord(input.compare) ? input.compare : undefined;
  if (compare === undefined) {
    errors.push("compare must be an object");
  } else if (compare.version !== "ruhroh_compare_v1") {
    errors.push("compare.version must be ruhroh_compare_v1");
  }
  return {
    version: "ruhroh_publish_check_validation_v1",
    errors: uniquePreserveOrder(errors),
    warnings: uniquePreserveOrder(warnings),
  };
}

export function validateRuhrohPublishCheckReportV2(input: unknown): RuhrohPublicationContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_publish_check_validation_v2", errors: ["publish check must be an object"], warnings };
  }
  if (input.version !== "ruhroh_publish_check_v2") errors.push("version must be ruhroh_publish_check_v2");
  if (input.$schema !== undefined && input.$schema !== PUBLISH_CHECK_V2_SCHEMA_URL) warnings.push("$schema does not match the v2 publish-check schema URL");
  validatePublishCheckCommon(input, errors);
  const compare = isRecord(input.compare) ? input.compare : undefined;
  if (compare === undefined) {
    errors.push("compare must be an object");
  } else {
    const validation = validateRuhrohCompareV2(compare);
    errors.push(...validation.errors.map((error) => `compare: ${error}`));
    warnings.push(...validation.warnings.map((warning) => `compare: ${warning}`));
    const expectedPublishable = benchmarkClaimPublishabilityGate(
      isRecord(compare.benchmarkClaim) ? compare.benchmarkClaim : {},
    ).publishable && !publishCheckHasSourceVerificationErrors(input);
    if (input.publishable !== expectedPublishable) {
      errors.push("publishable must match the embedded v2 benchmark claim and source verification gate");
    }
  }
  return {
    version: "ruhroh_publish_check_validation_v2",
    errors: uniquePreserveOrder(errors),
    warnings: uniquePreserveOrder(warnings),
  };
}

export const validateRuhrohPublishCheckV2 = validateRuhrohPublishCheckReportV2;

export function ruhrohPublishCheckRemediationCatalog(): RuhrohPublishCheckRemediation[] {
  return [
    ruhrohPublishCheckRemediationForBlocker("source verification: source file hash mismatch"),
    ruhrohPublishCheckRemediationForBlocker("no suite selected; use compare --suite for publishable benchmark claims"),
    ruhrohPublishCheckRemediationForBlocker("missing suite scenario: example-scenario"),
    ruhrohPublishCheckRemediationForBlocker("example-adapter: suite minimum runs or scenario coverage not satisfied"),
    ruhrohPublishCheckRemediationForBlocker("run plan warning: planned sample has no result artifact"),
    ruhrohPublishCheckRemediationForBlocker("artifact validation failed: 1 error(s)"),
    ruhrohPublishCheckRemediationForBlocker("review item: example run requires human review"),
    ruhrohPublishCheckRemediationForBlocker("eval-quality warnings present: missing evidenceRefs"),
    ruhrohPublishCheckRemediationForBlocker("pairwise comparison inconclusive: Fisher exact test is not significant"),
    ruhrohPublishCheckRemediationForBlocker("claim is not marked publishable"),
    ruhrohPublishCheckRemediationForBlocker("unclassified readiness blocker"),
  ];
}

export function ruhrohPublishCheckRemediationForBlocker(blocker: string): RuhrohPublishCheckRemediation {
  const normalized = blocker.toLowerCase();
  if (normalized.includes("source verification")) {
    return {
      code: "source_verification_failed",
      category: "source_verification",
      severity: "blocker",
      blocker,
      action: "Re-run publish-check with current artifacts, or restore the claim's referenced files so every recorded hash matches.",
      docs: "publish-claims#what-it-checks",
    };
  }
  if (normalized.includes("no suite selected")) {
    return {
      code: "suite_required",
      category: "suite",
      severity: "blocker",
      blocker,
      action: "Select the benchmark suite with --suite-dir and --suite before publishing a benchmark claim.",
      docs: "benchmark-suites",
    };
  }
  if (normalized.includes("missing suite scenario")) {
    return {
      code: "suite_scenario_missing",
      category: "suite",
      severity: "blocker",
      blocker,
      action: "Collect runs for the missing suite scenario or publish against a suite version whose membership matches the result set.",
      docs: "benchmark-suites#compare-a-suite",
    };
  }
  if (normalized.includes("minimum runs") || normalized.includes("fewer than")) {
    return {
      code: "minimum_runs_not_met",
      category: "statistics",
      severity: "blocker",
      blocker,
      action: "Collect enough repeated samples for each scenario/adapter group to satisfy the suite methodology.",
      docs: "benchmark-methodology#sample-size",
    };
  }
  if (normalized.includes("run plan warning")) {
    return {
      code: "run_plan_mismatch",
      category: "run_plan",
      severity: "blocker",
      blocker,
      action: "Compare against the run plan generated for this run, or collect the missing planned samples before publishing.",
      docs: "publish-claims#what-it-checks",
    };
  }
  if (normalized.includes("artifact validation failed") || normalized.includes("artifact-completeness")) {
    return {
      code: "artifact_evidence_incomplete",
      category: "artifacts",
      severity: "blocker",
      blocker,
      action: "Run validate-artifacts on the result root and repair missing or inconsistent run evidence before publishing.",
      docs: "artifacts#validate-artifacts",
    };
  }
  if (normalized.includes("review item")) {
    return {
      code: "human_review_required",
      category: "review",
      severity: "blocker",
      blocker,
      action: "Open the review queue, resolve evaluator review items, and re-run compare before citing the result.",
      docs: "eval-agent#quality-checks",
    };
  }
  if (normalized.includes("evidence") || normalized.includes("judge") || normalized.includes("criteria")) {
    return {
      code: "evaluator_evidence_weak",
      category: "review",
      severity: "blocker",
      blocker,
      action: "Strengthen the evaluator output with concrete evidenceRefs, criteriaResults, commandsRun, and judge metadata.",
      docs: "write-an-evaluator#quality-bar",
    };
  }
  if (normalized.includes("fisher") || normalized.includes("delta") || normalized.includes("significant") || normalized.includes("inconclusive")) {
    return {
      code: "comparison_inconclusive",
      category: "comparison",
      severity: "blocker",
      blocker,
      action: "Collect more paired samples or present the comparison as inconclusive instead of a publishable superiority claim.",
      docs: "benchmark-methodology#statistics",
    };
  }
  if (normalized.includes("claim is not marked publishable")) {
    return {
      code: "claim_not_publishable",
      category: "claim",
      severity: "blocker",
      blocker,
      action: "Resolve all readiness blockers, then regenerate the claim with compare or publish-check.",
      docs: "publish-claims",
    };
  }
  return {
    code: "claim_readiness_blocker",
    category: "claim",
    severity: "blocker",
    blocker,
    action: "Inspect the blocker, fix the underlying evidence or methodology gap, and re-run publish-check.",
    docs: "publish-claims#common-blockers",
  };
}

const PUBLISH_BUNDLE_CONTRACTS_V2: RuhrohPublishBundleContractsV2 = {
  publishCheck: "ruhroh_publish_check_v2",
  compare: "ruhroh_compare_v2",
  benchmarkClaim: "ruhroh_benchmark_claim_v2",
  benchmarkSummary: "ruhroh_benchmark_summary_v2",
  outcomeFrontier: "ruhroh_outcome_frontier_v1",
};

const PUBLICATION_ARTIFACT_CONTRACTS_V2: Record<RuhrohPublicationArtifactRoleV2, RuhrohPublicationArtifactReferenceV2["contractVersion"]> = {
  "publish-check": "ruhroh_publish_check_v2",
  "bundle-manifest": "ruhroh_publish_bundle_v2",
  "claim-index": "ruhroh_claim_index_v2",
  compare: "ruhroh_compare_v2",
  "benchmark-claim": "ruhroh_benchmark_claim_v2",
  "benchmark-summary": "ruhroh_benchmark_summary_v2",
  "outcome-frontier": "ruhroh_outcome_frontier_v1",
  "economic-trace": "ruhroh_economic_trace_span_v1",
  "intervention-ledger": "ruhroh_intervention_ledger_v1",
  "cost-reconciliation": "ruhroh_cost_reconciliation_v1",
  "decision-packet": "ruhroh_decision_packet_v1",
};

const REQUIRED_PUBLICATION_ARTIFACT_ROLES_V2: readonly RuhrohPublicationArtifactRoleV2[] = [
  "publish-check",
  "bundle-manifest",
  "compare",
  "benchmark-claim",
  "benchmark-summary",
  "outcome-frontier",
];

export function buildRuhrohPublicationV2(input: BuildRuhrohPublicationV2Input): RuhrohPublicationV2 {
  const publication: RuhrohPublicationV2 = {
    $schema: PUBLICATION_V2_SCHEMA_URL,
    version: "ruhroh_publication_v2",
    createdAt: input.createdAt ?? new Date().toISOString(),
    publishable: input.publishable,
    artifacts: input.artifacts.map((artifact) => ({ ...artifact })),
  };
  const validation = validateRuhrohPublicationV2(publication);
  if (validation.errors.length > 0) {
    throw new Error(`cannot build invalid v2 publication: ${validation.errors.join("; ")}`);
  }
  return publication;
}

export function validateRuhrohPublicationV2(input: unknown): RuhrohPublicationV2ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_publication_validation_v2", errors: ["publication must be an object"], warnings };
  }
  if (input.version !== "ruhroh_publication_v2") errors.push("version must be ruhroh_publication_v2");
  if (input.$schema !== undefined && input.$schema !== PUBLICATION_V2_SCHEMA_URL) warnings.push("$schema does not match the v2 publication schema URL");
  requirePublicationString(input.createdAt, "createdAt", errors);
  if (typeof input.publishable !== "boolean") errors.push("publishable must be boolean");
  const artifacts = Array.isArray(input.artifacts) ? input.artifacts : [];
  if (!Array.isArray(input.artifacts)) errors.push("artifacts must be an array");
  const roles: string[] = [];
  for (const [index, rawArtifact] of artifacts.entries()) {
    if (!isRecord(rawArtifact)) {
      errors.push(`artifacts[${index}] must be an object`);
      continue;
    }
    const role = stringField(rawArtifact, "role");
    if (role === undefined || !(role in PUBLICATION_ARTIFACT_CONTRACTS_V2)) {
      errors.push(`artifacts[${index}].role is invalid`);
      continue;
    }
    roles.push(role);
    requirePublicationString(rawArtifact.path, `artifacts[${index}].path`, errors);
    if (typeof rawArtifact.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(rawArtifact.sha256)) {
      errors.push(`artifacts[${index}].sha256 must be a lowercase SHA-256 digest`);
    }
    const expectedContract = PUBLICATION_ARTIFACT_CONTRACTS_V2[role as RuhrohPublicationArtifactRoleV2];
    if (rawArtifact.contractVersion !== expectedContract) {
      errors.push(`artifacts[${index}].contractVersion must be ${expectedContract} for role ${role}`);
    }
  }
  for (const role of REQUIRED_PUBLICATION_ARTIFACT_ROLES_V2) {
    if (!roles.includes(role)) errors.push(`artifacts must include role ${role}`);
  }
  const singletonRoles = roles.filter((role) => role !== "economic-trace");
  if (new Set(singletonRoles).size !== singletonRoles.length) errors.push("publication artifact roles other than economic-trace must be unique");
  return {
    version: "ruhroh_publication_validation_v2",
    errors: uniquePreserveOrder(errors),
    warnings: uniquePreserveOrder(warnings),
  };
}

export function buildRuhrohPublishBundleManifestV2(input: BuildRuhrohPublishBundleManifestV2Input): RuhrohPublishBundleManifestV2 {
  const manifest: RuhrohPublishBundleManifestV2 = {
    $schema: PUBLISH_BUNDLE_V2_SCHEMA_URL,
    version: "ruhroh_publish_bundle_v2",
    createdAt: input.createdAt ?? new Date().toISOString(),
    source: { ...input.source },
    publishable: input.publishCheck.publishable,
    blockerCount: input.publishCheck.blockerCount,
    advisoryCount: input.publishCheck.advisoryCount,
    contracts: { ...PUBLISH_BUNDLE_CONTRACTS_V2 },
    files: input.files.map((file) => ({ ...file })),
  };
  const validation = validateRuhrohPublishBundleManifestV2(manifest);
  if (validation.errors.length > 0) {
    throw new Error(`cannot build invalid v2 publication bundle manifest: ${validation.errors.join("; ")}`);
  }
  return manifest;
}

export const buildRuhrohPublicationBundleV2 = buildRuhrohPublishBundleManifestV2;

export function validateRuhrohPublishBundleManifest(input: unknown): RuhrohPublicationContractValidationResult {
  if (isRecord(input) && input.version === "ruhroh_publish_bundle_v2") {
    return validateRuhrohPublishBundleManifestV2(input);
  }
  return validateRuhrohPublishBundleManifestV1(input);
}

export function validateRuhrohPublishBundleManifestV1(input: unknown): RuhrohPublicationContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_publish_bundle_manifest_validation_v1", errors: ["bundle manifest must be an object"], warnings };
  }
  if (input.version !== "ruhroh_publish_bundle_v1") errors.push("version must be ruhroh_publish_bundle_v1");
  if (input.$schema !== undefined && input.$schema !== PUBLISH_BUNDLE_SCHEMA_URL) warnings.push("$schema does not match the v1 publish-bundle schema URL");
  validatePublishBundleManifestCommon(input, errors);
  return {
    version: "ruhroh_publish_bundle_manifest_validation_v1",
    errors: uniquePreserveOrder(errors),
    warnings: uniquePreserveOrder(warnings),
  };
}

export function validateRuhrohPublishBundleManifestV2(input: unknown): RuhrohPublicationContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_publish_bundle_manifest_validation_v2", errors: ["bundle manifest must be an object"], warnings };
  }
  if (input.version !== "ruhroh_publish_bundle_v2") errors.push("version must be ruhroh_publish_bundle_v2");
  if (input.$schema !== undefined && input.$schema !== PUBLISH_BUNDLE_V2_SCHEMA_URL) warnings.push("$schema does not match the v2 publish-bundle schema URL");
  validatePublishBundleManifestCommon(input, errors);
  const contracts = isRecord(input.contracts) ? input.contracts : undefined;
  if (contracts === undefined) {
    errors.push("contracts must be an object");
  } else {
    for (const [field, expected] of Object.entries(PUBLISH_BUNDLE_CONTRACTS_V2)) {
      if (contracts[field] !== expected) errors.push(`contracts.${field} must be ${expected}`);
    }
  }
  const roles = recordArrayField(input, "files").flatMap((file) => stringField(file, "role") ?? []);
  for (const role of REQUIRED_PUBLISH_BUNDLE_ROLES_V2) {
    if (!roles.includes(role)) errors.push(`files must include role ${role}`);
  }
  return {
    version: "ruhroh_publish_bundle_manifest_validation_v2",
    errors: uniquePreserveOrder(errors),
    warnings: uniquePreserveOrder(warnings),
  };
}

export const validateRuhrohPublicationBundleV2 = validateRuhrohPublishBundleManifestV2;

export function buildRuhrohClaimIndexEntryV2(input: BuildRuhrohClaimIndexEntryV2Input): RuhrohClaimIndexEntryV2 {
  const validation = validateRuhrohBenchmarkClaim(input.claim);
  const gate = validation.errors.length === 0
    ? benchmarkClaimPublishabilityGate(input.claim)
    : { publishable: false, blockers: validation.errors };
  const source = input.claim.source;
  const publicationReadiness = input.claim.readiness.publication;
  return {
    claimPath: input.claimPath,
    ...(input.bundlePath === undefined ? {} : { bundlePath: input.bundlePath }),
    valid: validation.errors.length === 0,
    publishable: validation.errors.length === 0 && gate.publishable,
    scope: input.claim.scope,
    createdAt: input.claim.createdAt,
    ...(input.claim.suite === undefined ? {} : {
      suite: {
        id: input.claim.suite.id,
        title: input.claim.suite.title,
        suiteVersion: input.claim.suite.suiteVersion,
      },
    }),
    targets: input.claim.targetSummaries.map((target) => ({
      benchmarkTargetId: target.benchmarkTargetId,
      identityStatus: target.identityStatus,
      executionAdapterIds: [...target.executionAdapterIds],
      runs: target.runs,
      acceptedOutcomes: target.acceptedOutcomes,
      qualityFloorStatus: target.qualityFloorStatus,
      paretoStatus: target.paretoStatus,
      robustStatus: target.robustStatus,
    })),
    summary: clonePublicationValue(input.claim.summary),
    frontier: {
      status: input.claim.outcomeFrontier.status,
      objectives: [...(input.claim.outcomeFrontier.methodology?.objectives ?? [])],
      paretoFrontierTargetIds: [...input.claim.outcomeFrontier.paretoFrontierTargetIds],
      robustFrontierTargetIds: [...input.claim.outcomeFrontier.robustFrontierTargetIds],
    },
    evidence: clonePublicationValue(input.claim.evidence),
    sourcePaths: {
      ...(source?.resultsPath === undefined ? {} : { resultsPath: source.resultsPath }),
      ...(source?.runPlanPath === undefined ? {} : { runPlanPath: source.runPlanPath }),
      ...(source?.rerunLedgerPath === undefined ? {} : { rerunLedgerPath: source.rerunLedgerPath }),
      ...(source?.suitePath === undefined ? {} : { suitePath: source.suitePath }),
    },
    blockers: [...gate.blockers],
    advisories: [...publicationReadiness.advisories],
    validationErrors: [...validation.errors],
    validationWarnings: [...validation.warnings],
  };
}

export function buildRuhrohClaimIndexV2(input: BuildRuhrohClaimIndexV2Input): RuhrohClaimIndexReportV2 {
  const claims = input.claims.map(cloneClaimIndexEntryV2);
  const invalidCount = claims.filter((claim) => !claim.valid).length;
  const blockedCount = claims.filter((claim) => claim.valid && !claim.publishable).length;
  const registryBlockers = claims.flatMap((claim) => {
    const label = claim.bundlePath ?? claim.claimPath;
    if (!claim.valid) return [`invalid claim ${label}: ${claim.validationErrors[0] ?? "claim validation failed"}`];
    if (!claim.publishable) return [`blocked claim ${label}: ${claim.blockers[0] ?? "claim is not publishable"}`];
    return [];
  });
  const report: RuhrohClaimIndexReportV2 = {
    $schema: CLAIM_INDEX_V2_SCHEMA_URL,
    version: "ruhroh_claim_index_v2",
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    source: { ...input.source },
    registryReady: claims.length > 0 && invalidCount === 0 && blockedCount === 0,
    registryBlockers,
    claimCount: claims.length,
    publishableCount: claims.filter((claim) => claim.publishable).length,
    blockedCount,
    invalidCount,
    suiteCount: new Set(claims.flatMap((claim) => claim.suite === undefined ? [] : [claim.suite.id])).size,
    targetCount: new Set(claims.flatMap((claim) => claim.targets.map((target) => target.benchmarkTargetId))).size,
    totalRuns: claims.reduce((total, claim) => total + claim.summary.totalRuns, 0),
    totalAcceptedOutcomes: claims.reduce((total, claim) => total + claim.summary.totalAcceptedOutcomes, 0),
    claims,
  };
  const validation = validateRuhrohClaimIndexV2(report);
  if (validation.errors.length > 0) {
    throw new Error(`cannot build invalid v2 claim index: ${validation.errors.join("; ")}`);
  }
  return report;
}

export const buildRuhrohPublicationIndexV2 = buildRuhrohClaimIndexV2;

export function validateRuhrohClaimIndex(input: unknown): RuhrohPublicationContractValidationResult {
  if (isRecord(input) && input.version === "ruhroh_claim_index_v2") return validateRuhrohClaimIndexV2(input);
  return validateRuhrohClaimIndexV1(input);
}

export function validateRuhrohClaimIndexV1(input: unknown): RuhrohPublicationContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_claim_index_validation_v1", errors: ["claim index must be an object"], warnings };
  }
  if (input.version !== "ruhroh_claim_index_v1") errors.push("version must be ruhroh_claim_index_v1");
  validateClaimIndexCounts(input, false, errors);
  return {
    version: "ruhroh_claim_index_validation_v1",
    errors: uniquePreserveOrder(errors),
    warnings,
  };
}

export function validateRuhrohClaimIndexV2(input: unknown): RuhrohPublicationContractValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(input)) {
    return { version: "ruhroh_claim_index_validation_v2", errors: ["claim index must be an object"], warnings };
  }
  if (input.version !== "ruhroh_claim_index_v2") errors.push("version must be ruhroh_claim_index_v2");
  if (input.$schema !== undefined && input.$schema !== CLAIM_INDEX_V2_SCHEMA_URL) warnings.push("$schema does not match the v2 claim-index schema URL");
  validateClaimIndexCounts(input, true, errors);
  const claims = recordArrayField(input, "claims");
  const claimPaths = claims.flatMap((claim) => stringField(claim, "claimPath") ?? []);
  if (claimPaths.length !== claims.length) errors.push("every claim must include claimPath");
  if (new Set(claimPaths).size !== claimPaths.length) errors.push("claim paths must be unique");
  for (const [index, claim] of claims.entries()) validateClaimIndexEntryV2(claim, index, errors);
  const actualInvalid = claims.filter((claim) => claim.valid === false).length;
  const actualBlocked = claims.filter((claim) => claim.valid === true && claim.publishable === false).length;
  const actualPublishable = claims.filter((claim) => claim.publishable === true).length;
  const actualRuns = claims.reduce((total, claim) => total + numberField(claimSummary(claim), "totalRuns"), 0);
  const actualAccepted = claims.reduce((total, claim) => total + numberField(claimSummary(claim), "totalAcceptedOutcomes"), 0);
  if (input.invalidCount !== actualInvalid) errors.push("invalidCount must match claims");
  if (input.blockedCount !== actualBlocked) errors.push("blockedCount must match claims");
  if (input.publishableCount !== actualPublishable) errors.push("publishableCount must match claims");
  if (input.totalRuns !== actualRuns) errors.push("totalRuns must match claims");
  if (input.totalAcceptedOutcomes !== actualAccepted) errors.push("totalAcceptedOutcomes must match claims");
  if (input.registryReady !== (claims.length > 0 && actualInvalid === 0 && actualBlocked === 0)) {
    errors.push("registryReady must match claim validity and publishability");
  }
  return {
    version: "ruhroh_claim_index_validation_v2",
    errors: uniquePreserveOrder(errors),
    warnings: uniquePreserveOrder(warnings),
  };
}

export const validateRuhrohPublicationIndexV2 = validateRuhrohClaimIndexV2;

export function verifyRuhrohBenchmarkClaimSources(
  claim: Record<string, unknown>,
  claimPath: string,
): RuhrohClaimSourceVerificationReport {
  const checks: RuhrohClaimSourceVerificationCheck[] = [];
  const sourceBaseDir = path.dirname(path.resolve(claimPath));
  const source = isRecord(claim.source) ? claim.source : undefined;
  if (source === undefined) {
    return {
      version: "ruhroh_claim_source_verification_v1",
      checked: false,
      checks,
      errors: ["claim source is missing"],
      warnings: [],
    };
  }

  verifyOptionalHashedSourceFile(checks, "suite", source.suitePath, source.suiteSha256, "source.suitePath", "source.suiteSha256", sourceBaseDir);
  verifyOptionalHashedSourceFile(checks, "runPlan", source.runPlanPath, source.runPlanSha256, "source.runPlanPath", "source.runPlanSha256", sourceBaseDir);
  verifyOptionalHashedSourceFile(checks, "rerunLedger", source.rerunLedgerPath, source.rerunLedgerSha256, "source.rerunLedgerPath", "source.rerunLedgerSha256", sourceBaseDir);
  verifyOptionalHashedSourceFile(checks, "evaluatorCalibrationReport", source.evaluatorCalibrationReportPath, source.evaluatorCalibrationReportSha256, "source.evaluatorCalibrationReportPath", "source.evaluatorCalibrationReportSha256", sourceBaseDir);

  const resultArtifacts = source.resultArtifacts;
  if (!Array.isArray(resultArtifacts) || resultArtifacts.length === 0) {
    checks.push({
      name: "resultArtifacts",
      status: "warning",
      details: "source.resultArtifacts is empty or missing",
    });
  } else {
    for (const [index, artifact] of resultArtifacts.entries()) {
      if (!isRecord(artifact)) {
        checks.push({
          name: `resultArtifacts[${index}]`,
          status: "failed",
          details: `source.resultArtifacts[${index}] must be an object`,
        });
        continue;
      }
      verifyRequiredHashedSourceFile(
        checks,
        `resultArtifacts[${index}]`,
        artifact.path,
        artifact.sha256,
        `source.resultArtifacts[${index}].path`,
        `source.resultArtifacts[${index}].sha256`,
        sourceBaseDir,
      );
      const inventory = artifact.artifactInventory;
      if (inventory !== undefined) {
        if (!Array.isArray(inventory)) {
          checks.push({
            name: `resultArtifacts[${index}].artifactInventory`,
            status: "failed",
            details: `source.resultArtifacts[${index}].artifactInventory must be an array`,
          });
        } else {
          for (const [inventoryIndex, inventoryItem] of inventory.entries()) {
            verifyBenchmarkClaimInventoryItem(checks, inventoryItem, index, inventoryIndex, sourceBaseDir);
          }
        }
      }
    }
  }

  if (typeof source.benchmarkClaimPath === "string" && resolveSourcePath(source.benchmarkClaimPath, sourceBaseDir) !== path.resolve(claimPath)) {
    checks.push({
      name: "benchmarkClaimPath",
      status: "warning",
      path: source.benchmarkClaimPath,
      details: "source.benchmarkClaimPath does not match the validated claim path",
    });
  }

  return {
    version: "ruhroh_claim_source_verification_v1",
    checked: true,
    checks,
    errors: checks.filter((check) => check.status === "failed").map(formatClaimSourceVerificationCheck),
    warnings: checks.filter((check) => check.status === "warning").map(formatClaimSourceVerificationCheck),
  };
}

export function validateRuhrohPublishBundle(inputPath: string): RuhrohPublishBundleValidationReport {
  const bundlePath = path.resolve(inputPath);
  if (!existsSync(bundlePath)) {
    throw new Error(`Path does not exist: ${bundlePath}`);
  }
  if (!statSync(bundlePath).isDirectory()) {
    throw new Error(`Publication bundle path is not a directory: ${bundlePath}`);
  }

  const checks: RuhrohPublishBundleValidationCheck[] = [];
  const manifestPath = path.join(bundlePath, "manifest.json");
  checks.push(publishBundleFilePresenceCheck("manifest", manifestPath));
  const manifest = readPublishBundleJson(checks, "manifest", manifestPath);
  const rolePaths = manifest === undefined
    ? new Map<string, string>()
    : publishBundleRolePaths(manifest, bundlePath, checks);
  const bundleIsV2 = manifest?.version === "ruhroh_publish_bundle_v2";
  const requiredRoles = bundleIsV2 ? REQUIRED_PUBLISH_BUNDLE_ROLES_V2 : REQUIRED_PUBLISH_BUNDLE_ROLES;

  for (const role of requiredRoles) {
    if (!rolePaths.has(role)) {
      checks.push({
        name: `files.${role}`,
        status: "failed",
        details: `bundle manifest does not list required role ${role}`,
      });
    }
  }

  const publishCheck = readPublishBundleJsonRole(checks, rolePaths, "publish-check");
  const benchmarkClaim = readPublishBundleJsonRole(checks, rolePaths, "benchmark-claim");
  const benchmarkSummary = readPublishBundleJsonRole(checks, rolePaths, "benchmark-summary");
  const compare = isRecord(publishCheck?.compare) ? publishCheck.compare : undefined;
  const compareDocument = bundleIsV2 ? readPublishBundleJsonRole(checks, rolePaths, "compare") : undefined;
  const outcomeFrontier = bundleIsV2 ? readPublishBundleJsonRole(checks, rolePaths, "outcome-frontier") : undefined;
  const publication = bundleIsV2 ? readPublishBundleJsonRole(checks, rolePaths, "publication") : undefined;
  readPublishBundleJsonRole(checks, rolePaths, "review-json");
  readPublishBundleJsonRole(checks, rolePaths, "eval-quality");
  const evaluatorCalibrationReport = readPublishBundleJsonRole(checks, rolePaths, "evaluator-calibration-report");

  if (manifest !== undefined) {
    const manifestValidation = validateRuhrohPublishBundleManifest(manifest);
    checks.push(...manifestValidation.errors.map((error) => publishBundleValidationFailure("manifest.validation", manifestPath, error)));
    checks.push(...manifestValidation.warnings.map((warning) => publishBundleValidationWarning("manifest.validation", manifestPath, warning)));
    if (manifestValidation.errors.length === 0) {
      checks.push({ name: "manifest.validation", status: "ok", path: manifestPath, details: "bundle manifest validation passed" });
    }
    if (isRecord(manifest.source) && typeof manifest.source.bundlePath === "string" && resolveSourcePath(manifest.source.bundlePath, bundlePath) !== bundlePath) {
      checks.push({
        name: "manifest.source.bundlePath",
        status: "warning",
        path: manifestPath,
        details: `manifest source bundlePath points at ${manifest.source.bundlePath}; validated bundle is ${bundlePath}`,
      });
    }
  }
  if (publishCheck !== undefined) {
    const publishCheckPath = rolePaths.get("publish-check") ?? "";
    checks.push(publishBundleVersionCheck(
      "publish-check.version",
      publishCheckPath,
      publishCheck,
      bundleIsV2 ? "ruhroh_publish_check_v2" : "ruhroh_publish_check_v1",
    ));
    const publishCheckValidation = validateRuhrohPublishCheckReport(publishCheck);
    checks.push(...publishCheckValidation.errors.map((error) => publishBundleValidationFailure("publish-check.validation", publishCheckPath, error)));
    checks.push(...publishCheckValidation.warnings.map((warning) => publishBundleValidationWarning("publish-check.validation", publishCheckPath, warning)));
    if (compare !== undefined) {
      checks.push(publishBundleVersionCheck(
        "publish-check.compare.version",
        publishCheckPath,
        compare,
        bundleIsV2 ? "ruhroh_compare_v2" : "ruhroh_compare_v1",
      ));
    }
  }
  if (benchmarkClaim !== undefined) {
    const claimPath = rolePaths.get("benchmark-claim") ?? "";
    checks.push(publishBundleVersionCheck(
      "benchmark-claim.version",
      claimPath,
      benchmarkClaim,
      bundleIsV2 ? "ruhroh_benchmark_claim_v2" : "ruhroh_benchmark_claim_v1",
    ));
    const claimValidation = validateRuhrohBenchmarkClaim(benchmarkClaim);
    checks.push(...claimValidation.errors.map((error) => publishBundleValidationFailure("benchmark-claim.validation", claimPath, error)));
    checks.push(...claimValidation.warnings.map((warning) => publishBundleValidationWarning("benchmark-claim.validation", claimPath, warning)));
    if (claimValidation.errors.length === 0) {
      checks.push({
        name: "benchmark-claim.validation",
        status: "ok",
        path: claimPath,
        details: "benchmark claim validation passed",
      });
    }
    const claimSourceVerification = verifyRuhrohBenchmarkClaimSources(benchmarkClaim, claimPath);
    for (const check of claimSourceVerification.checks) {
      checks.push({
        name: `benchmark-claim.source.${check.name}`,
        status: check.status,
        ...(check.path === undefined ? {} : { path: check.path }),
        details: check.details,
      });
    }
  }
  if (benchmarkSummary !== undefined) {
    const summaryPath = rolePaths.get("benchmark-summary") ?? "";
    checks.push(publishBundleVersionCheck(
      "benchmark-summary.version",
      summaryPath,
      benchmarkSummary,
      bundleIsV2 ? "ruhroh_benchmark_summary_v2" : "ruhroh_benchmark_summary_v1",
    ));
    const summaryValidation = validateRuhrohBenchmarkSummary(benchmarkSummary);
    checks.push(...summaryValidation.errors.map((error) => publishBundleValidationFailure("benchmark-summary.validation", summaryPath, error)));
    checks.push(...summaryValidation.warnings.map((warning) => publishBundleValidationWarning("benchmark-summary.validation", summaryPath, warning)));
    if (summaryValidation.errors.length === 0) {
      checks.push({
        name: "benchmark-summary.validation",
        status: "ok",
        path: summaryPath,
        details: "benchmark summary validation passed",
      });
    }
  }
  if (evaluatorCalibrationReport !== undefined) {
    const calibrationReportPath = rolePaths.get("evaluator-calibration-report") ?? "";
    checks.push(publishBundleVersionCheck("evaluator-calibration-report.version", calibrationReportPath, evaluatorCalibrationReport, "ruhroh_eval_calibration_report_v1"));
    validateEvaluatorCalibrationReportEvidence(checks, evaluatorCalibrationReport, bundlePath, calibrationReportPath);
  }
  if (bundleIsV2 && compareDocument !== undefined) {
    const comparePath = rolePaths.get("compare") ?? "";
    const validation = validateRuhrohCompareV2(compareDocument);
    checks.push(...validation.errors.map((error) => publishBundleValidationFailure("compare.validation", comparePath, error)));
    checks.push(...validation.warnings.map((warning) => publishBundleValidationWarning("compare.validation", comparePath, warning)));
    if (compare !== undefined && stableJsonStringify(compareDocument) !== stableJsonStringify(compare)) {
      checks.push(publishBundleValidationFailure("compare.cross-reference", comparePath, "compare artifact must match publish-check.compare"));
    }
  }
  if (bundleIsV2 && outcomeFrontier !== undefined) {
    const frontierPath = rolePaths.get("outcome-frontier") ?? "";
    const validation = validateRuhrohOutcomeFrontier(outcomeFrontier);
    checks.push(...validation.errors.map((error) => publishBundleValidationFailure("outcome-frontier.validation", frontierPath, error)));
    checks.push(...validation.warnings.map((warning) => publishBundleValidationWarning("outcome-frontier.validation", frontierPath, warning)));
    if (compare !== undefined && stableJsonStringify(outcomeFrontier) !== stableJsonStringify(compare.outcomeFrontier)) {
      checks.push(publishBundleValidationFailure("outcome-frontier.cross-reference", frontierPath, "outcome-frontier artifact must match publish-check.compare.outcomeFrontier"));
    }
  }
  if (bundleIsV2 && publication !== undefined) {
    const publicationPath = rolePaths.get("publication") ?? "";
    const validation = validateRuhrohPublicationV2(publication);
    checks.push(...validation.errors.map((error) => publishBundleValidationFailure("publication.validation", publicationPath, error)));
    checks.push(...validation.warnings.map((warning) => publishBundleValidationWarning("publication.validation", publicationPath, warning)));
    if (publishCheck !== undefined && publication.publishable !== publishCheck.publishable) {
      checks.push(publishBundleValidationFailure("publication.publishable", publicationPath, "publication publishable must match publish-check publishable"));
    }
    validatePublicationArtifactReferences(checks, publication, bundlePath, publicationPath, rolePaths);
  }
  validatePublishBundleCrossReferences(checks, manifest, publishCheck, benchmarkClaim, benchmarkSummary, rolePaths);

  const errors = checks.filter((check) => check.status === "failed").map(formatPublishBundleValidationCheck);
  const warnings = checks.filter((check) => check.status === "warning").map(formatPublishBundleValidationCheck);
  return {
    version: "ruhroh_publish_bundle_validation_report_v1",
    source: { bundlePath },
    valid: errors.length === 0,
    publishable: errors.length === 0 && publishCheck?.publishable === true && benchmarkClaimPublishabilityGate(benchmarkClaim ?? {}).publishable,
    checks,
    errors,
    warnings,
  };
}

function verifyBenchmarkClaimInventoryItem(
  checks: RuhrohClaimSourceVerificationCheck[],
  inventoryItem: unknown,
  artifactIndex: number,
  inventoryIndex: number,
  sourceBaseDir: string,
): void {
  const name = `resultArtifacts[${artifactIndex}].artifactInventory[${inventoryIndex}]`;
  if (!isRecord(inventoryItem)) {
    checks.push({
      name,
      status: "failed",
      details: `source.${name} must be an object`,
    });
    return;
  }
  if (inventoryItem.available !== true) {
    return;
  }
  verifyRequiredHashedSourceFile(
    checks,
    name,
    inventoryItem.path,
    inventoryItem.sha256,
    `source.${name}.path`,
    `source.${name}.sha256`,
    sourceBaseDir,
  );
  const inventorySourcePath = typeof inventoryItem.path === "string" ? inventoryItem.path : undefined;
  const inventoryItemPath = inventorySourcePath === undefined ? undefined : resolveSourcePath(inventorySourcePath, sourceBaseDir);
  if (typeof inventoryItem.sizeBytes === "number" && inventoryItemPath !== undefined && existsSync(inventoryItemPath)) {
    try {
      const actualSize = statSync(inventoryItemPath).size;
      if (actualSize !== inventoryItem.sizeBytes) {
        checks.push({
          name,
          status: "failed",
          path: inventorySourcePath,
          details: `${name} size mismatch: expected ${inventoryItem.sizeBytes}, found ${actualSize}`,
        });
      }
    } catch (error) {
      checks.push({
        name,
        status: "failed",
        path: inventorySourcePath,
        details: `${name} size check failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

function verifyOptionalHashedSourceFile(
  checks: RuhrohClaimSourceVerificationCheck[],
  name: string,
  filePath: unknown,
  expectedSha256: unknown,
  pathLabel: string,
  hashLabel: string,
  baseDir?: string | undefined,
): void {
  if (filePath === undefined && expectedSha256 === undefined) {
    return;
  }
  verifyRequiredHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel, baseDir);
}

function verifyRequiredHashedSourceFile(
  checks: RuhrohClaimSourceVerificationCheck[],
  name: string,
  filePath: unknown,
  expectedSha256: unknown,
  pathLabel: string,
  hashLabel: string,
  baseDir?: string | undefined,
): void {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    checks.push({
      name,
      status: "failed",
      details: `${pathLabel} must be a non-empty string`,
    });
    return;
  }
  const resolvedFilePath = resolveSourcePath(filePath, baseDir);
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha256)) {
    checks.push({
      name,
      status: "failed",
      path: filePath,
      details: `${hashLabel} must be a lowercase SHA-256 digest`,
    });
    return;
  }
  if (!existsSync(resolvedFilePath)) {
    checks.push({
      name,
      status: "failed",
      path: filePath,
      expectedSha256,
      details: `${pathLabel} does not exist`,
    });
    return;
  }
  try {
    const actualSha256 = sha256File(resolvedFilePath);
    checks.push({
      name,
      status: actualSha256 === expectedSha256 ? "ok" : "failed",
      path: filePath,
      expectedSha256,
      actualSha256,
      details: actualSha256 === expectedSha256
        ? `${pathLabel} hash matches`
        : `${pathLabel} hash mismatch`,
    });
  } catch (error) {
    checks.push({
      name,
      status: "failed",
      path: filePath,
      expectedSha256,
      details: `${pathLabel} could not be hashed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function publishBundleRolePaths(
  manifest: Record<string, unknown>,
  bundlePath: string,
  checks: RuhrohPublishBundleValidationCheck[],
): Map<string, string> {
  const rolePaths = new Map<string, string>();
  const files = manifest.files;
  if (!Array.isArray(files)) {
    checks.push({
      name: "manifest.files",
      status: "failed",
      path: path.join(bundlePath, "manifest.json"),
      details: "manifest files must be an array",
    });
    return rolePaths;
  }
  for (const [index, file] of files.entries()) {
    if (!isRecord(file)) {
      checks.push({
        name: `manifest.files[${index}]`,
        status: "failed",
        path: path.join(bundlePath, "manifest.json"),
        details: "file entry must be an object",
      });
      continue;
    }
    const role = stringField(file, "role");
    const filePath = stringField(file, "path");
    if (role === undefined || filePath === undefined) {
      checks.push({
        name: `manifest.files[${index}]`,
        status: "failed",
        path: path.join(bundlePath, "manifest.json"),
        details: "file entry must include non-empty role and path strings",
      });
      continue;
    }
    if (rolePaths.has(role)) {
      checks.push({
        name: `manifest.files.${role}`,
        status: "failed",
        path: path.join(bundlePath, "manifest.json"),
        details: `duplicate file role ${role}`,
      });
      continue;
    }
    const resolvedFilePath = resolvePublishBundleFilePath(bundlePath, filePath);
    if (resolvedFilePath === undefined) {
      checks.push({
        name: `manifest.files.${role}`,
        status: "failed",
        path: path.join(bundlePath, "manifest.json"),
        details: `file path must be relative and stay inside the bundle: ${filePath}`,
      });
      continue;
    }
    rolePaths.set(role, resolvedFilePath);
    checks.push(publishBundleFilePresenceCheck(`files.${role}`, resolvedFilePath));
  }
  return rolePaths;
}

function resolvePublishBundleFilePath(bundlePath: string, filePath: string): string | undefined {
  if (path.isAbsolute(filePath)) {
    return undefined;
  }
  const resolved = path.resolve(bundlePath, filePath);
  const relative = path.relative(bundlePath, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return undefined;
  }
  return resolved;
}

function readPublishBundleJsonRole(
  checks: RuhrohPublishBundleValidationCheck[],
  rolePaths: Map<string, string>,
  role: string,
): Record<string, unknown> | undefined {
  const filePath = rolePaths.get(role);
  if (filePath === undefined || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return undefined;
  }
  return readPublishBundleJson(checks, role, filePath);
}

function readPublishBundleJson(
  checks: RuhrohPublishBundleValidationCheck[],
  name: string,
  filePath: string,
): Record<string, unknown> | undefined {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return undefined;
  }
  try {
    return readJsonObject(filePath);
  } catch (error) {
    checks.push({
      name: `${name}.json`,
      status: "failed",
      path: filePath,
      details: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}

function validatePublishBundleCrossReferences(
  checks: RuhrohPublishBundleValidationCheck[],
  manifest: Record<string, unknown> | undefined,
  publishCheck: Record<string, unknown> | undefined,
  benchmarkClaim: Record<string, unknown> | undefined,
  benchmarkSummary: Record<string, unknown> | undefined,
  rolePaths: Map<string, string>,
): void {
  const manifestPath = rolePaths.get("manifest") ?? "";
  const publishCheckPath = rolePaths.get("publish-check") ?? "";
  if (manifest !== undefined && publishCheck !== undefined) {
    if (manifest.publishable !== publishCheck.publishable) {
      checks.push(publishBundleValidationFailure("manifest.publishable", manifestPath, "manifest publishable must match publish-check publishable"));
    }
    if (manifest.blockerCount !== publishCheck.blockerCount) {
      checks.push(publishBundleValidationFailure("manifest.blockerCount", manifestPath, "manifest blockerCount must match publish-check blockerCount"));
    }
    if (manifest.advisoryCount !== publishCheck.advisoryCount) {
      checks.push(publishBundleValidationFailure("manifest.advisoryCount", manifestPath, "manifest advisoryCount must match publish-check advisoryCount"));
    }
  }
  const compare = isRecord(publishCheck?.compare) ? publishCheck.compare : undefined;
  if (publishCheck !== undefined && compare === undefined) {
    checks.push(publishBundleValidationFailure("publish-check.compare", publishCheckPath, "publish-check report must include compare output"));
  }
  if (compare !== undefined && benchmarkClaim !== undefined) {
    if (stableJsonStringify(compare.benchmarkClaim) !== stableJsonStringify(benchmarkClaim)) {
      checks.push(publishBundleValidationFailure("benchmark-claim.cross-reference", rolePaths.get("benchmark-claim") ?? "", "benchmark-claim.json must match publish-check.compare.benchmarkClaim"));
    } else {
      checks.push({
        name: "benchmark-claim.cross-reference",
        status: "ok",
        path: rolePaths.get("benchmark-claim"),
        details: "benchmark claim matches publish-check compare output",
      });
    }
  }
  if (compare !== undefined && benchmarkSummary !== undefined) {
    if (stableJsonStringify(compare.benchmarkSummary) !== stableJsonStringify(benchmarkSummary)) {
      checks.push(publishBundleValidationFailure("benchmark-summary.cross-reference", rolePaths.get("benchmark-summary") ?? "", "benchmark-summary.json must match publish-check.compare.benchmarkSummary"));
    } else {
      checks.push({
        name: "benchmark-summary.cross-reference",
        status: "ok",
        path: rolePaths.get("benchmark-summary"),
        details: "benchmark summary matches publish-check compare output",
      });
    }
  }
}

function validatePublicationArtifactReferences(
  checks: RuhrohPublishBundleValidationCheck[],
  publication: Record<string, unknown>,
  bundlePath: string,
  publicationPath: string,
  rolePaths: ReadonlyMap<string, string>,
): void {
  const artifactBaseDir = path.dirname(publicationPath);
  for (const [index, artifact] of recordArrayField(publication, "artifacts").entries()) {
    const name = `publication.artifacts[${index}]`;
    const artifactPath = stringField(artifact, "path");
    if (artifactPath === undefined) continue;
    const resolvedPath = path.resolve(artifactBaseDir, artifactPath);
    const relativeToBundle = path.relative(bundlePath, resolvedPath);
    if (relativeToBundle.startsWith("..") || path.isAbsolute(relativeToBundle)) {
      checks.push(publishBundleValidationFailure(name, publicationPath, `artifact path must stay inside the bundle: ${artifactPath}`));
      continue;
    }
    const artifactRole = stringField(artifact, "role");
    const manifestRole = artifactRole === "bundle-manifest" ? "manifest" : artifactRole;
    const manifestRolePath = manifestRole === undefined ? undefined : rolePaths.get(manifestRole);
    if (manifestRolePath !== undefined && path.resolve(manifestRolePath) !== resolvedPath) {
      checks.push(publishBundleValidationFailure(name, publicationPath, `${artifactRole ?? "artifact"} reference must match the bundle manifest role path`));
      continue;
    }
    const presence = publishBundleFilePresenceCheck(name, resolvedPath);
    checks.push(presence);
    if (presence.status !== "ok") continue;
    const expectedSha256 = stringField(artifact, "sha256");
    const actualSha256 = sha256File(resolvedPath);
    if (expectedSha256 !== actualSha256) {
      checks.push(publishBundleValidationFailure(`${name}.sha256`, resolvedPath, `SHA-256 mismatch: expected ${expectedSha256 ?? "missing"}, found ${actualSha256}`));
      continue;
    }
    checks.push({ name: `${name}.sha256`, status: "ok", path: resolvedPath, details: `sha256=${actualSha256}` });
    try {
      const expectedVersion = stringField(artifact, "contractVersion");
      const referencedVersions = expectedVersion === "ruhroh_economic_trace_span_v1"
        ? readEconomicTraceVersions(resolvedPath)
        : [readJsonObject(resolvedPath).version];
      if (referencedVersions.length === 0 || referencedVersions.some((version) => version !== expectedVersion)) {
        checks.push(publishBundleValidationFailure(
          `${name}.contractVersion`,
          resolvedPath,
          `referenced artifact records must use version ${expectedVersion ?? "declared"}`,
        ));
      }
    } catch (error) {
      checks.push(publishBundleValidationFailure(
        `${name}.contractVersion`,
        resolvedPath,
        error instanceof Error ? error.message : String(error),
      ));
    }
  }
}

function readEconomicTraceVersions(tracePath: string): unknown[] {
  const records = readFileSync(tracePath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
  return records.map((record) => isRecord(record) ? record.version : undefined);
}

function benchmarkClaimPublishabilityGate(input: unknown): { publishable: boolean; blockers: string[] } {
  const claim = isRecord(input) ? input : {};
  const rawReadiness = isRecord(claim.readiness) ? claim.readiness : {};
  const isV2 = claim.version === "ruhroh_benchmark_claim_v2";
  const readiness = isV2 && isRecord(rawReadiness.publication) ? rawReadiness.publication : rawReadiness;
  const evidence = isRecord(claim.evidence) ? claim.evidence : {};
  const suiteCoverage = isRecord(claim.suiteCoverage) ? claim.suiteCoverage : undefined;
  const blockers = [
    ...stringArrayField(readiness, "blockers"),
    ...(claim.scope === "suite" ? [] : ["no suite selected; use compare --suite for publishable benchmark claims"]),
    ...(claim.publishable === true && readiness.publishable === true ? [] : ["claim is not marked publishable"]),
    ...stringArrayField(evidence, "runPlanWarnings").map((warning) => `run plan warning: ${warning}`),
    ...(numberField(evidence, "artifactValidationErrors") > 0 ? [`artifact validation failed: ${numberField(evidence, "artifactValidationErrors")} error(s)`] : []),
    ...(numberField(evidence, "artifactCompletenessWarnings") > 0 ? ["artifact-completeness warnings present"] : []),
    ...(numberField(evidence, "requiredReviewItems") > 0 ? [`${numberField(evidence, "requiredReviewItems")} review item(s) required`] : []),
    ...suiteCoverageBlockers(suiteCoverage),
    ...(isV2 ? [] : recordArrayField(claim, "adapterSummaries").flatMap(adapterSummaryPublishabilityBlockers)),
    ...(isV2 ? [] : recordArrayField(claim, "scenarioResults").flatMap(scenarioResultPublishabilityBlockers)),
    ...(isV2 ? [] : recordArrayField(claim, "pairwiseComparisons").flatMap(pairwisePublishabilityBlockers)),
  ];
  const uniqueBlockers = uniquePreserveOrder(blockers);
  return {
    publishable: uniqueBlockers.length === 0,
    blockers: uniqueBlockers,
  };
}

function suiteCoverageBlockers(suiteCoverage: Record<string, unknown> | undefined): string[] {
  if (suiteCoverage === undefined) {
    return [];
  }
  return [
    ...(suiteCoverage.minRunsSatisfied === false ? ["suite minimum runs or scenario coverage not satisfied"] : []),
    ...stringArrayField(suiteCoverage, "missingScenarioIds").map((scenarioId) => `missing suite scenario ${scenarioId}`),
    ...recordArrayField(suiteCoverage, "adapters").flatMap((adapter) => [
      ...(adapter.minRunsSatisfied === false ? [`${stringField(adapter, "adapter") ?? "adapter"}: suite minimum runs or scenario coverage not satisfied`] : []),
      ...stringArrayField(adapter, "missingScenarioIds").map((scenarioId) => `${stringField(adapter, "adapter") ?? "adapter"}: missing suite scenario ${scenarioId}`),
      ...stringArrayField(adapter, "warnings").map((warning) => `${stringField(adapter, "adapter") ?? "adapter"}: ${warning}`),
    ]),
  ];
}

function adapterSummaryPublishabilityBlockers(adapterSummary: Record<string, unknown>): string[] {
  if (adapterSummary.minRunsSatisfied !== false) {
    return [];
  }
  return [`${stringField(adapterSummary, "adapter") ?? "adapter"}: suite minimum runs or scenario coverage not satisfied`];
}

function scenarioResultPublishabilityBlockers(scenarioResult: Record<string, unknown>): string[] {
  const label = `${stringField(scenarioResult, "scenarioId") ?? "scenario"}/${stringField(scenarioResult, "adapter") ?? "adapter"}`;
  return stringArrayField(scenarioResult, "statisticalWarnings").map((warning) => `${label}: ${warning}`);
}

function pairwisePublishabilityBlockers(comparison: Record<string, unknown>): string[] {
  const label = [
    stringField(comparison, "scenarioId") ?? "scenario",
    `${stringField(comparison, "contenderAdapter") ?? "contender"} vs ${stringField(comparison, "baselineAdapter") ?? "baseline"}`,
  ].join("/");
  return stringArrayField(comparison, "warnings").map((warning) => `${label}: ${warning}`);
}

function publishBundleFilePresenceCheck(name: string, filePath: string): RuhrohPublishBundleValidationCheck {
  if (!existsSync(filePath)) {
    return {
      name,
      status: "failed",
      path: filePath,
      details: "bundle file is missing",
    };
  }
  if (!statSync(filePath).isFile()) {
    return {
      name,
      status: "failed",
      path: filePath,
      details: "bundle path is not a file",
    };
  }
  return {
    name,
    status: "ok",
    path: filePath,
    details: "bundle file is present",
  };
}

function publishBundleDirectoryPresenceCheck(name: string, directoryPath: string): RuhrohPublishBundleValidationCheck {
  if (!existsSync(directoryPath)) {
    return {
      name,
      status: "failed",
      path: directoryPath,
      details: "bundle directory is missing",
    };
  }
  if (!statSync(directoryPath).isDirectory()) {
    return {
      name,
      status: "failed",
      path: directoryPath,
      details: "bundle path is not a directory",
    };
  }
  return {
    name,
    status: "ok",
    path: directoryPath,
    details: "bundle directory is present",
  };
}

function validateEvaluatorCalibrationReportEvidence(
  checks: RuhrohPublishBundleValidationCheck[],
  report: Record<string, unknown>,
  bundlePath: string,
  reportPath: string,
): void {
  const source = isRecord(report.source) ? report.source : undefined;
  const sourceReportPath = source === undefined ? undefined : stringField(source, "reportPath");
  if (sourceReportPath !== undefined) {
    const resolvedSourceReportPath = resolvePublishBundleFilePath(bundlePath, sourceReportPath);
    if (resolvedSourceReportPath === undefined) {
      checks.push(publishBundleValidationFailure(
        "evaluator-calibration-report.source.reportPath",
        reportPath,
        `reportPath must be relative and stay inside the bundle: ${sourceReportPath}`,
      ));
    } else if (reportPath.length > 0 && path.resolve(resolvedSourceReportPath) !== path.resolve(reportPath)) {
      checks.push(publishBundleValidationWarning(
        "evaluator-calibration-report.source.reportPath",
        reportPath,
        `reportPath points at ${sourceReportPath}; manifest role points at ${path.relative(bundlePath, reportPath) || reportPath}`,
      ));
    } else {
      checks.push({
        name: "evaluator-calibration-report.source.reportPath",
        status: "ok",
        path: resolvedSourceReportPath,
        details: "reportPath matches the bundle manifest role",
      });
    }
  }

  if (!Array.isArray(report.results)) {
    checks.push(publishBundleValidationFailure(
      "evaluator-calibration-report.results",
      reportPath,
      "results must be an array",
    ));
    return;
  }
  for (const [index, result] of report.results.entries()) {
    const name = `evaluator-calibration-report.results[${index}]`;
    if (!isRecord(result)) {
      checks.push(publishBundleValidationFailure(name, reportPath, "calibration result must be an object"));
      continue;
    }
    validateCalibrationResultFilePath(checks, name, "inputPath", result, bundlePath, reportPath);
    validateCalibrationResultFilePath(checks, name, "outputPath", result, bundlePath, reportPath);
    validateCalibrationResultWorkspacePath(checks, name, result, bundlePath, reportPath);
  }
}

function validateCalibrationResultFilePath(
  checks: RuhrohPublishBundleValidationCheck[],
  name: string,
  field: "inputPath" | "outputPath",
  result: Record<string, unknown>,
  bundlePath: string,
  reportPath: string,
): void {
  const itemPath = stringField(result, field);
  if (itemPath === undefined) {
    checks.push(publishBundleValidationFailure(`${name}.${field}`, reportPath, `${field} is required`));
    return;
  }
  const resolved = resolvePublishBundleFilePath(bundlePath, itemPath);
  if (resolved === undefined) {
    checks.push(publishBundleValidationFailure(`${name}.${field}`, reportPath, `${field} must be relative and stay inside the bundle: ${itemPath}`));
    return;
  }
  checks.push(publishBundleFilePresenceCheck(`${name}.${field}`, resolved));
}

function validateCalibrationResultWorkspacePath(
  checks: RuhrohPublishBundleValidationCheck[],
  name: string,
  result: Record<string, unknown>,
  bundlePath: string,
  reportPath: string,
): void {
  const itemPath = stringField(result, "workspacePath");
  if (itemPath === undefined) {
    checks.push(publishBundleValidationFailure(`${name}.workspacePath`, reportPath, "workspacePath is required"));
    return;
  }
  const resolved = resolvePublishBundleFilePath(bundlePath, itemPath);
  if (resolved === undefined) {
    checks.push(publishBundleValidationFailure(`${name}.workspacePath`, reportPath, `workspacePath must be relative and stay inside the bundle: ${itemPath}`));
    return;
  }
  checks.push(publishBundleDirectoryPresenceCheck(`${name}.workspacePath`, resolved));
}

function publishBundleVersionCheck(
  name: string,
  filePath: string,
  value: Record<string, unknown>,
  expectedVersion: string,
): RuhrohPublishBundleValidationCheck {
  if (value.version !== expectedVersion) {
    return publishBundleValidationFailure(name, filePath, `expected version ${expectedVersion}, found ${typeof value.version === "string" ? value.version : "missing"}`);
  }
  return {
    name,
    status: "ok",
    path: filePath,
    details: `version=${expectedVersion}`,
  };
}

function publishBundleValidationFailure(name: string, filePath: string, details: string): RuhrohPublishBundleValidationCheck {
  return {
    name,
    status: "failed",
    ...(filePath.length === 0 ? {} : { path: filePath }),
    details,
  };
}

function publishBundleValidationWarning(name: string, filePath: string, details: string): RuhrohPublishBundleValidationCheck {
  return {
    name,
    status: "warning",
    ...(filePath.length === 0 ? {} : { path: filePath }),
    details,
  };
}

function formatClaimSourceVerificationCheck(check: RuhrohClaimSourceVerificationCheck): string {
  const pathLabel = check.path === undefined ? "" : ` (${check.path})`;
  const hashLabel = check.expectedSha256 === undefined
    ? ""
    : ` expected=${check.expectedSha256}${check.actualSha256 === undefined ? "" : ` actual=${check.actualSha256}`}`;
  return `${check.name}: ${check.details}${pathLabel}${hashLabel}`;
}

function formatPublishBundleValidationCheck(check: RuhrohPublishBundleValidationCheck): string {
  const pathLabel = check.path === undefined ? "" : ` (${check.path})`;
  return `${check.name}: ${check.details}${pathLabel}`;
}

function readJsonObject(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error(`Expected JSON object in ${filePath}`);
  }
  return parsed;
}

function resolveSourcePath(filePath: string, baseDir: string | undefined): string {
  return path.resolve(baseDir ?? process.cwd(), filePath);
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function validatePublishCheckCommon(input: Record<string, unknown>, errors: string[]): void {
  const source = isRecord(input.source) ? input.source : undefined;
  if (source === undefined) {
    errors.push("source must be an object");
  } else {
    requirePublicationString(source.resultsPath, "source.resultsPath", errors);
  }
  if (typeof input.publishable !== "boolean") errors.push("publishable must be boolean");
  validatePublicationNonNegativeInteger(input.blockerCount, "blockerCount", errors);
  validatePublicationNonNegativeInteger(input.advisoryCount, "advisoryCount", errors);
  const blockers = validatePublicationStringArray(input.blockers, "blockers", errors);
  const advisories = validatePublicationStringArray(input.advisories, "advisories", errors);
  const remediation = Array.isArray(input.remediation) ? input.remediation : [];
  if (!Array.isArray(input.remediation)) errors.push("remediation must be an array");
  if (typeof input.blockerCount === "number" && input.blockerCount !== blockers.length) errors.push("blockerCount must match blockers.length");
  if (typeof input.advisoryCount === "number" && input.advisoryCount !== advisories.length) errors.push("advisoryCount must match advisories.length");
  if (remediation.length !== blockers.length) errors.push("remediation must include one entry per blocker");
  for (const [index, item] of remediation.entries()) {
    if (!isRecord(item)) {
      errors.push(`remediation[${index}] must be an object`);
      continue;
    }
    for (const field of ["code", "category", "severity", "blocker", "action", "docs"]) {
      requirePublicationString(item[field], `remediation[${index}].${field}`, errors);
    }
    if (item.severity !== "blocker" && item.severity !== "advisory") errors.push(`remediation[${index}].severity is invalid`);
  }
}

function publishCheckHasSourceVerificationErrors(input: Record<string, unknown>): boolean {
  const sourceVerification = isRecord(input.sourceVerification) ? input.sourceVerification : undefined;
  return sourceVerification !== undefined && stringArrayField(sourceVerification, "errors").length > 0;
}

function validatePublishBundleManifestCommon(input: Record<string, unknown>, errors: string[]): void {
  requirePublicationString(input.createdAt, "createdAt", errors);
  if (typeof input.publishable !== "boolean") errors.push("publishable must be boolean");
  validatePublicationNonNegativeInteger(input.blockerCount, "blockerCount", errors);
  validatePublicationNonNegativeInteger(input.advisoryCount, "advisoryCount", errors);
  const source = isRecord(input.source) ? input.source : undefined;
  if (source === undefined) {
    errors.push("source must be an object");
  } else {
    requirePublicationString(source.resultsPath, "source.resultsPath", errors);
    requirePublicationString(source.bundlePath, "source.bundlePath", errors);
  }
  if (!Array.isArray(input.files)) {
    errors.push("files must be an array");
    return;
  }
  const roles: string[] = [];
  for (const [index, file] of input.files.entries()) {
    if (!isRecord(file)) {
      errors.push(`files[${index}] must be an object`);
      continue;
    }
    const role = stringField(file, "role");
    if (role !== undefined) roles.push(role);
    requirePublicationString(file.role, `files[${index}].role`, errors);
    requirePublicationString(file.path, `files[${index}].path`, errors);
    requirePublicationString(file.description, `files[${index}].description`, errors);
  }
  if (new Set(roles).size !== roles.length) errors.push("files roles must be unique");
}

function cloneClaimIndexEntryV2(entry: RuhrohClaimIndexEntryV2): RuhrohClaimIndexEntryV2 {
  return clonePublicationValue(entry);
}

function clonePublicationValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateClaimIndexCounts(input: Record<string, unknown>, v2: boolean, errors: string[]): void {
  requirePublicationString(input.generatedAt, "generatedAt", errors);
  const source = isRecord(input.source) ? input.source : undefined;
  if (source === undefined) errors.push("source must be an object");
  else requirePublicationString(source.inputPath, "source.inputPath", errors);
  if (typeof input.registryReady !== "boolean") errors.push("registryReady must be boolean");
  validatePublicationStringArray(input.registryBlockers, "registryBlockers", errors);
  for (const field of [
    "claimCount",
    "publishableCount",
    "blockedCount",
    "invalidCount",
    "suiteCount",
    v2 ? "targetCount" : "adapterCount",
    "totalRuns",
    ...(v2 ? ["totalAcceptedOutcomes"] : []),
  ]) {
    validatePublicationNonNegativeInteger(input[field], field, errors);
  }
  if (!Array.isArray(input.claims)) {
    errors.push("claims must be an array");
  } else if (typeof input.claimCount === "number" && input.claimCount !== input.claims.length) {
    errors.push("claimCount must match claims.length");
  }
}

function validateClaimIndexEntryV2(claim: Record<string, unknown>, index: number, errors: string[]): void {
  const pathPrefix = `claims[${index}]`;
  requirePublicationString(claim.claimPath, `${pathPrefix}.claimPath`, errors);
  if (typeof claim.valid !== "boolean") errors.push(`${pathPrefix}.valid must be boolean`);
  if (typeof claim.publishable !== "boolean") errors.push(`${pathPrefix}.publishable must be boolean`);
  if (claim.publishable === true && claim.valid !== true) errors.push(`${pathPrefix}.publishable cannot be true when valid is false`);
  if (claim.scope !== "suite" && claim.scope !== "ad_hoc_compare") errors.push(`${pathPrefix}.scope is invalid`);
  requirePublicationString(claim.createdAt, `${pathPrefix}.createdAt`, errors);
  const targets = recordArrayField(claim, "targets");
  if (!Array.isArray(claim.targets)) errors.push(`${pathPrefix}.targets must be an array`);
  const targetIds: string[] = [];
  for (const [targetIndex, target] of targets.entries()) {
    const targetPath = `${pathPrefix}.targets[${targetIndex}]`;
    const targetId = stringField(target, "benchmarkTargetId");
    if (targetId !== undefined) targetIds.push(targetId);
    requirePublicationString(target.benchmarkTargetId, `${targetPath}.benchmarkTargetId`, errors);
    if (target.identityStatus !== "declared" && target.identityStatus !== "legacy_execution_adapter_fallback") errors.push(`${targetPath}.identityStatus is invalid`);
    const adapters = validatePublicationStringArray(target.executionAdapterIds, `${targetPath}.executionAdapterIds`, errors);
    if (adapters.length === 0) errors.push(`${targetPath}.executionAdapterIds must not be empty`);
    validatePublicationNonNegativeInteger(target.runs, `${targetPath}.runs`, errors);
    validatePublicationNonNegativeInteger(target.acceptedOutcomes, `${targetPath}.acceptedOutcomes`, errors);
    if (typeof target.runs === "number" && typeof target.acceptedOutcomes === "number" && target.acceptedOutcomes > target.runs) {
      errors.push(`${targetPath}.acceptedOutcomes cannot exceed runs`);
    }
    if (!new Set(["passed", "failed", "indeterminate"]).has(String(target.qualityFloorStatus))) errors.push(`${targetPath}.qualityFloorStatus is invalid`);
    if (!new Set(["pareto", "dominated", "ineligible", "indeterminate"]).has(String(target.paretoStatus))) errors.push(`${targetPath}.paretoStatus is invalid`);
    if (!new Set(["pareto", "dominated", "ineligible", "indeterminate"]).has(String(target.robustStatus))) errors.push(`${targetPath}.robustStatus is invalid`);
  }
  if (new Set(targetIds).size !== targetIds.length) errors.push(`${pathPrefix}.targets benchmarkTargetId values must be unique`);
  if (claim.publishable === true && targets.some((target) => target.identityStatus === "legacy_execution_adapter_fallback")) {
    errors.push(`${pathPrefix} cannot be publishable with legacy target identity fallback`);
  }
  const summary = claimSummary(claim);
  if (!isRecord(claim.summary)) errors.push(`${pathPrefix}.summary must be an object`);
  for (const field of ["scenarioCount", "targetCount", "totalRuns", "totalAcceptedOutcomes", "reviewRequired", "reviewRecommended", "pairwiseComparisonCount"]) {
    validatePublicationNonNegativeInteger(summary[field], `${pathPrefix}.summary.${field}`, errors);
  }
  if (typeof summary.targetCount === "number" && summary.targetCount !== targetIds.length) errors.push(`${pathPrefix}.summary.targetCount must match targets.length`);
  const frontier = isRecord(claim.frontier) ? claim.frontier : undefined;
  if (frontier === undefined) {
    errors.push(`${pathPrefix}.frontier must be an object`);
  } else {
    if (!new Set(["available", "unavailable", "quality_only"]).has(String(frontier.status))) errors.push(`${pathPrefix}.frontier.status is invalid`);
    validatePublicationStringArray(frontier.objectives, `${pathPrefix}.frontier.objectives`, errors);
    for (const field of ["paretoFrontierTargetIds", "robustFrontierTargetIds"]) {
      const ids = validatePublicationStringArray(frontier[field], `${pathPrefix}.frontier.${field}`, errors);
      for (const id of ids) if (!targetIds.includes(id)) errors.push(`${pathPrefix}.frontier.${field} contains unknown target ${id}`);
    }
  }
  validatePublicationStringArray(claim.blockers, `${pathPrefix}.blockers`, errors);
  validatePublicationStringArray(claim.advisories, `${pathPrefix}.advisories`, errors);
  validatePublicationStringArray(claim.validationErrors, `${pathPrefix}.validationErrors`, errors);
  validatePublicationStringArray(claim.validationWarnings, `${pathPrefix}.validationWarnings`, errors);
}

function claimSummary(claim: Record<string, unknown>): Record<string, unknown> {
  return isRecord(claim.summary) ? claim.summary : {};
}

function requirePublicationString(value: unknown, pathLabel: string, errors: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) errors.push(`${pathLabel} must be a non-empty string`);
}

function validatePublicationNonNegativeInteger(value: unknown, pathLabel: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) errors.push(`${pathLabel} must be a non-negative integer`);
}

function validatePublicationStringArray(value: unknown, pathLabel: string, errors: string[]): string[] {
  if (!Array.isArray(value)) {
    errors.push(`${pathLabel} must be an array`);
    return [];
  }
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (strings.length !== value.length) errors.push(`${pathLabel} must contain only non-empty strings`);
  return strings;
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function stringArrayField(record: Record<string, unknown>, field: string): string[] {
  const value = record[field];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function recordArrayField(record: Record<string, unknown>, field: string): Record<string, unknown>[] {
  const value = record[field];
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
}

function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
