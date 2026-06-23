import type { RuhrohEvidenceRef, RunAgentArtifactManifest } from "./adapters.js";

export type RuhrohEvalStatus = "passed" | "failed" | "review" | "infra_failed";
export type RuhrohEvalConfidence = "low" | "medium" | "high";

export interface RuhrohEvalCommandRecord {
  command: string;
  exitCode: number;
  summary: string;
}

export interface RuhrohEvalResult {
  version: "ruhroh_eval_result_v1";
  status: RuhrohEvalStatus;
  goalMet: boolean;
  confidence: RuhrohEvalConfidence;
  reasons: string[];
  unmetCriteria: string[];
  evidenceRefs: RuhrohEvidenceRef[];
  commandsRun: RuhrohEvalCommandRecord[];
  artifacts: Record<string, string>;
  finalSummary: string;
  repairBrief?: string | undefined;
}

export interface RuhrohLoopResult {
  version: "ruhroh_loop_result_v1";
  adapter: string;
  dataset: string;
  scenarioId: string;
  task_id: string;
  status: "completed" | "failed";
  failure_kind: string;
  failureBucket: string;
  score: number;
  iterationsUsed: number;
  implementationIterationsUsed: number;
  implementationStoppedReason: string;
  stoppedReason: string;
  duration_ms: number;
  runAgent: RunAgentArtifactManifest;
  runAgentAdapterId: string;
  continuityLevel: string;
  sessionHandle: string;
  runIds: string[];
  implementationRuns: Array<Record<string, unknown>>;
  evalResult?: RuhrohEvalResult | undefined;
  artifactPaths?: Record<string, string> | undefined;
  failure_details?: Record<string, unknown> | undefined;
}

export interface RuhrohVerdict {
  status: "completed" | "failed";
  failure_kind: string;
  score: number;
}

export function scoreForEvalStatus(status: RuhrohEvalStatus): number {
  return status === "passed" ? 1 : 0;
}

export function mapEvalResultToVerdict(evalResult: Pick<RuhrohEvalResult, "status">): RuhrohVerdict {
  if (evalResult.status === "passed") {
    return { status: "completed", failure_kind: "none", score: 1 };
  }
  if (evalResult.status === "review") {
    return { status: "failed", failure_kind: "review_required", score: 0 };
  }
  if (evalResult.status === "infra_failed") {
    return { status: "failed", failure_kind: "infra_failed", score: 0 };
  }
  return { status: "failed", failure_kind: "goal_mismatch", score: 0 };
}

export function mapRuntimeFailureToVerdict(
  implementationRuns: Array<{ status?: string | undefined; failureKind?: string | undefined }>,
  options: { ignoredFailureKinds?: string[] | undefined } = {},
): RuhrohVerdict | undefined {
  const ignored = new Set(options.ignoredFailureKinds ?? []);
  const runtimeFailure = implementationRuns.find((run) => run.status !== "completed" && !ignored.has(run.failureKind ?? ""));
  if (runtimeFailure === undefined) {
    return undefined;
  }
  return {
    status: "failed",
    failure_kind: runtimeFailure.failureKind ?? "runtime_failure",
    score: 0,
  };
}

export function deriveRuhrohVerdict(
  implementationRuns: Array<{ status?: string | undefined; failureKind?: string | undefined }>,
  evalResult: Pick<RuhrohEvalResult, "status">,
  options: { ignoredFailureKinds?: string[] | undefined } = {},
): RuhrohVerdict {
  return mapRuntimeFailureToVerdict(implementationRuns, options) ?? mapEvalResultToVerdict(evalResult);
}
