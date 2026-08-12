export const RUHROH_REFERENCE_SCALE_LEVELS = [1, 2, 4, 8, 16] as const;

export type RuhrohScaleCandidate = "T(1)" | "T(log_n)" | "T(n)" | "T(n_k)" | "T(n_k_a)";

export interface RuhrohScaleExperimentLevelV1 {
  id: string;
  n: number;
  scenarioId: string;
  scenarioVersion: string;
  fixtureSha256: string;
  requestIds: string[];
}

export interface RuhrohScaleExperimentV1 {
  version: "ruhroh_scale_experiment_v1";
  id: string;
  suite: { id: string; suiteVersion: string };
  variable: {
    symbol: "n";
    name: "ordered_change_requests";
    unit: "change_request";
  };
  levels: RuhrohScaleExperimentLevelV1[];
  hypothesis: { expectedClass: RuhrohScaleCandidate; rationale: string };
  controls: {
    targetIds: string[];
    frozenBaselineSha256: string;
    promptTemplateSha256: string;
    evaluatorSignature: string;
    fixedRequestOrderSha256: string;
    sessionPolicy: "fresh_per_sample";
    levelPolicy: "prefix_nested";
  };
  qualityFloor: {
    perChangeCompletionRate: number;
    zeroCriticalRegressions: true;
  };
  resourceMetric: "totalTokens";
  bootstrapSamples: 1000;
}

export interface RuhrohScaleChangeResultV1 {
  requestId: string;
  status: "passed" | "failed" | "critical_regression";
}

export interface RuhrohScaleObservationV1 {
  version: "ruhroh_scale_observation_v1";
  experimentId: string;
  targetId: string;
  levelId: string;
  n: number;
  sampleId: string;
  changeResults: RuhrohScaleChangeResultV1[];
  totalTokens?: number | undefined;
  modelCalls?: number | undefined;
  retryAttempts?: number | undefined;
  childAgentMaxDepth?: number | undefined;
  childAgentMaxFanout?: number | undefined;
  resourceBudgetStatus?: "within" | "exhausted" | "overrun" | "unobservable" | undefined;
}

export interface RuhrohScaleLevelAnalysisV1 {
  levelId: string;
  n: number;
  samples: number;
  completedChanges: number;
  requestedChanges: number;
  perChangeCompletionRate: number;
  criticalRegressions: number;
  fullBatchSuccessRate: number;
  qualityEligible: boolean;
  completeTokenCoverage: boolean;
  totalTokens?: number | undefined;
  p50TotalTokens?: number | undefined;
  p95TotalTokens?: number | undefined;
  totalModelCalls?: number | undefined;
  p50ModelCalls?: number | undefined;
  p95ModelCalls?: number | undefined;
  totalRetryAttempts?: number | undefined;
  p50RetryAttempts?: number | undefined;
  p95RetryAttempts?: number | undefined;
  p50ChildAgentDepth?: number | undefined;
  p95ChildAgentDepth?: number | undefined;
  p50ChildAgentFanout?: number | undefined;
  p95ChildAgentFanout?: number | undefined;
  budgetStatusCounts: Record<string, number>;
}

export interface RuhrohScaleFitV1 {
  candidate: RuhrohScaleCandidate;
  coefficient: number;
  normalizedRmse: number;
  leaveOneScaleOutError: number;
  bootstrapBestFitStability: number;
  observable: boolean;
}

export interface RuhrohScaleTargetAnalysisV1 {
  targetId: string;
  levels: RuhrohScaleLevelAnalysisV1[];
  classificationStatus: "eligible" | "quality_ineligible" | "incomplete_coverage" | "insufficient_scales";
  bestFitCandidate?: RuhrohScaleCandidate | undefined;
  runnerUpCandidate?: RuhrohScaleCandidate | undefined;
  fits: RuhrohScaleFitV1[];
  caveat: string;
}

export interface RuhrohScaleAnalysisV1 {
  version: "ruhroh_scale_analysis_v1";
  experimentId: string;
  createdAt: string;
  methodology: {
    finiteEmpiricalCandidateOnly: true;
    qualityRule: "per_change_completion_floor_and_zero_critical_regressions";
    bootstrapSamples: 1000;
    crossValidation: "leave_one_scale_out";
  };
  targets: RuhrohScaleTargetAnalysisV1[];
  errors: string[];
}

export function validateRuhrohScaleExperiment(experiment: RuhrohScaleExperimentV1): string[] {
  const errors: string[] = [];
  if (experiment.version !== "ruhroh_scale_experiment_v1") {
    errors.push("version must be ruhroh_scale_experiment_v1");
  }
  if (experiment.variable.symbol !== "n" || experiment.variable.name !== "ordered_change_requests" || experiment.variable.unit !== "change_request") {
    errors.push("the reference experiment variable must be n ordered_change_requests measured in change_request units");
  }
  if (experiment.controls.sessionPolicy !== "fresh_per_sample" || experiment.controls.levelPolicy !== "prefix_nested") {
    errors.push("the reference experiment requires fresh sessions and prefix-nested levels");
  }
  if (experiment.bootstrapSamples !== 1000) {
    errors.push("bootstrapSamples must be 1000");
  }
  if (experiment.qualityFloor.perChangeCompletionRate < 0 || experiment.qualityFloor.perChangeCompletionRate > 1) {
    errors.push("qualityFloor.perChangeCompletionRate must be between 0 and 1");
  }
  const levels = [...experiment.levels].sort((left, right) => left.n - right.n);
  if (levels.length !== RUHROH_REFERENCE_SCALE_LEVELS.length
    || levels.some((level, index) => level.n !== RUHROH_REFERENCE_SCALE_LEVELS[index])) {
    errors.push("levels must use n=1,2,4,8,16");
  }
  const requestOrder = levels.at(-1)?.requestIds ?? [];
  for (const level of levels) {
    if (level.requestIds.length !== level.n) {
      errors.push(`level ${level.id} must contain exactly n requestIds`);
    }
    if (level.requestIds.some((requestId, index) => requestId !== requestOrder[index])) {
      errors.push(`level ${level.id} is not a prefix of the fixed request order`);
    }
    if (!sha256(level.fixtureSha256)) {
      errors.push(`level ${level.id} fixtureSha256 must be lowercase SHA-256`);
    }
  }
  for (const [field, value] of Object.entries({
    frozenBaselineSha256: experiment.controls.frozenBaselineSha256,
    promptTemplateSha256: experiment.controls.promptTemplateSha256,
    fixedRequestOrderSha256: experiment.controls.fixedRequestOrderSha256,
  })) {
    if (!sha256(value)) {
      errors.push(`controls.${field} must be lowercase SHA-256`);
    }
  }
  return errors;
}

export function analyzeRuhrohScaleExperiment(input: {
  experiment: RuhrohScaleExperimentV1;
  observations: readonly RuhrohScaleObservationV1[];
  createdAt?: string | undefined;
}): RuhrohScaleAnalysisV1 {
  const errors = validateRuhrohScaleExperiment(input.experiment);
  const levelById = new Map(input.experiment.levels.map((level) => [level.id, level]));
  const targetIds = [...new Set([...input.experiment.controls.targetIds, ...input.observations.map((item) => item.targetId)])].sort();
  for (const [index, observation] of input.observations.entries()) {
    const level = levelById.get(observation.levelId);
    if (observation.version !== "ruhroh_scale_observation_v1" || observation.experimentId !== input.experiment.id) {
      errors.push(`observations[${index}] has the wrong contract or experiment id`);
    }
    if (level === undefined || level.n !== observation.n) {
      errors.push(`observations[${index}] does not match its declared level`);
      continue;
    }
    if (observation.changeResults.length !== level.n) {
      errors.push(`observations[${index}] must report one result per requested change`);
    }
    if (observation.changeResults.some((result, resultIndex) => result.requestId !== level.requestIds[resultIndex])) {
      errors.push(`observations[${index}] change results do not follow the fixed request order`);
    }
    for (const [field, value] of Object.entries({
      totalTokens: observation.totalTokens,
      modelCalls: observation.modelCalls,
      retryAttempts: observation.retryAttempts,
      childAgentMaxDepth: observation.childAgentMaxDepth,
      childAgentMaxFanout: observation.childAgentMaxFanout,
    })) {
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        errors.push(`observations[${index}].${field} must be non-negative when reported`);
      }
    }
  }
  return {
    version: "ruhroh_scale_analysis_v1",
    experimentId: input.experiment.id,
    createdAt: input.createdAt ?? new Date().toISOString(),
    methodology: {
      finiteEmpiricalCandidateOnly: true,
      qualityRule: "per_change_completion_floor_and_zero_critical_regressions",
      bootstrapSamples: 1000,
      crossValidation: "leave_one_scale_out",
    },
    targets: targetIds.map((targetId) => analyzeTarget(input.experiment, targetId, input.observations.filter((item) => item.targetId === targetId))),
    errors,
  };
}

function analyzeTarget(
  experiment: RuhrohScaleExperimentV1,
  targetId: string,
  observations: readonly RuhrohScaleObservationV1[],
): RuhrohScaleTargetAnalysisV1 {
  const levels = [...experiment.levels].sort((left, right) => left.n - right.n).map((level) => {
    const samples = observations.filter((observation) => observation.levelId === level.id);
    const completedChanges = samples.flatMap((sample) => sample.changeResults).filter((result) => result.status === "passed").length;
    const requestedChanges = samples.reduce((total, sample) => total + sample.changeResults.length, 0);
    const criticalRegressions = samples.flatMap((sample) => sample.changeResults).filter((result) => result.status === "critical_regression").length;
    const fullBatchSuccesses = samples.filter((sample) => sample.changeResults.length === level.n && sample.changeResults.every((result) => result.status === "passed")).length;
    const tokens = samples.flatMap((sample) => sample.totalTokens === undefined ? [] : [sample.totalTokens]);
    const modelCalls = samples.flatMap((sample) => sample.modelCalls === undefined ? [] : [sample.modelCalls]);
    const retries = samples.flatMap((sample) => sample.retryAttempts === undefined ? [] : [sample.retryAttempts]);
    const depths = samples.flatMap((sample) => sample.childAgentMaxDepth === undefined ? [] : [sample.childAgentMaxDepth]);
    const fanouts = samples.flatMap((sample) => sample.childAgentMaxFanout === undefined ? [] : [sample.childAgentMaxFanout]);
    const completionRate = requestedChanges === 0 ? 0 : completedChanges / requestedChanges;
    return {
      levelId: level.id,
      n: level.n,
      samples: samples.length,
      completedChanges,
      requestedChanges,
      perChangeCompletionRate: completionRate,
      criticalRegressions,
      fullBatchSuccessRate: samples.length === 0 ? 0 : fullBatchSuccesses / samples.length,
      qualityEligible: samples.length > 0 && completionRate >= experiment.qualityFloor.perChangeCompletionRate && criticalRegressions === 0,
      completeTokenCoverage: samples.length > 0 && tokens.length === samples.length,
      ...distributionSummary(tokens, "Tokens"),
      ...distributionSummary(modelCalls, "ModelCalls"),
      ...distributionSummary(retries, "RetryAttempts"),
      ...percentileSummary(depths, "ChildAgentDepth"),
      ...percentileSummary(fanouts, "ChildAgentFanout"),
      budgetStatusCounts: countStrings(samples.map((sample) => sample.resourceBudgetStatus ?? "unreported")),
    } satisfies RuhrohScaleLevelAnalysisV1;
  });
  const presentLevels = levels.filter((level) => level.samples > 0);
  const classificationStatus = presentLevels.length !== experiment.levels.length
    ? "insufficient_scales"
    : levels.some((level) => !level.qualityEligible)
      ? "quality_ineligible"
      : levels.some((level) => !level.completeTokenCoverage)
        ? "incomplete_coverage"
        : "eligible";
  if (classificationStatus !== "eligible") {
    return {
      targetId,
      levels,
      classificationStatus,
      fits: [],
      caveat: "No growth candidate is emitted until every scale preserves the declared quality floor and has complete token coverage.",
    };
  }
  const rawFits = fitCandidates(levels);
  const bootstrapCounts = bootstrapBestCandidates(experiment, targetId, observations);
  const fits = rawFits.map((fit) => ({
    ...fit,
    bootstrapBestFitStability: (bootstrapCounts.get(fit.candidate) ?? 0) / experiment.bootstrapSamples,
  })).sort(compareFits);
  return {
    targetId,
    levels,
    classificationStatus,
    bestFitCandidate: fits[0]?.candidate,
    runnerUpCandidate: fits[1]?.candidate,
    fits,
    caveat: "This is a finite empirical best-fit candidate, not a formal complexity proof; budget exhaustion is containment evidence, not T(infinity).",
  };
}

function distributionSummary(
  values: readonly number[],
  suffix: "Tokens" | "ModelCalls" | "RetryAttempts",
): Record<string, number> {
  return values.length === 0 ? {} : {
    [`total${suffix}`]: values.reduce((total, value) => total + value, 0),
    [`p50${suffix === "Tokens" ? "TotalTokens" : suffix}`]: percentile(values, 0.5),
    [`p95${suffix === "Tokens" ? "TotalTokens" : suffix}`]: percentile(values, 0.95),
  };
}

function percentileSummary(
  values: readonly number[],
  suffix: "ChildAgentDepth" | "ChildAgentFanout",
): Record<string, number> {
  return values.length === 0 ? {} : {
    [`p50${suffix}`]: percentile(values, 0.5),
    [`p95${suffix}`]: percentile(values, 0.95),
  };
}

function fitCandidates(levels: readonly RuhrohScaleLevelAnalysisV1[]): Array<Omit<RuhrohScaleFitV1, "bootstrapBestFitStability">> {
  const candidates: RuhrohScaleCandidate[] = ["T(1)", "T(log_n)", "T(n)", "T(n_k)", "T(n_k_a)"];
  return candidates.map((candidate): Omit<RuhrohScaleFitV1, "bootstrapBestFitStability"> => {
    const points = levels.flatMap((level) => {
      const basis = candidateBasis(candidate, level);
      return level.p50TotalTokens === undefined || basis === undefined ? [] : [{ basis, value: level.p50TotalTokens }];
    });
    if (points.length !== levels.length) {
      return {
        candidate,
        coefficient: 0,
        normalizedRmse: Number.POSITIVE_INFINITY,
        leaveOneScaleOutError: Number.POSITIVE_INFINITY,
        observable: false,
      };
    }
    const coefficient = fitCoefficient(points);
    const mean = points.reduce((total, point) => total + point.value, 0) / points.length;
    const normalizedRmse = Math.sqrt(points.reduce((total, point) => total + (point.value - coefficient * point.basis) ** 2, 0) / points.length) / Math.max(mean, 1);
    const leaveOneScaleOutError = points.reduce((total, heldOut, index) => {
      const training = points.filter((_, candidateIndex) => candidateIndex !== index);
      const heldCoefficient = fitCoefficient(training);
      return total + Math.abs(heldOut.value - heldCoefficient * heldOut.basis) / Math.max(heldOut.value, 1);
    }, 0) / points.length;
    return { candidate, coefficient, normalizedRmse, leaveOneScaleOutError, observable: true };
  });
}

function bootstrapBestCandidates(
  experiment: RuhrohScaleExperimentV1,
  targetId: string,
  observations: readonly RuhrohScaleObservationV1[],
): Map<RuhrohScaleCandidate, number> {
  const counts = new Map<RuhrohScaleCandidate, number>();
  const random = seededRandom(`${experiment.id}\0${targetId}`);
  for (let iteration = 0; iteration < experiment.bootstrapSamples; iteration += 1) {
    const levels = experiment.levels.map((level) => {
      const samples = observations.filter((observation) => observation.levelId === level.id && observation.totalTokens !== undefined);
      const resampled = Array.from({ length: samples.length }, () => samples[Math.floor(random() * samples.length)]).filter((item): item is RuhrohScaleObservationV1 => item !== undefined);
      const tokens = resampled.flatMap((sample) => sample.totalTokens === undefined ? [] : [sample.totalTokens]);
      return {
        levelId: level.id,
        n: level.n,
        samples: resampled.length,
        completedChanges: 0,
        requestedChanges: 0,
        perChangeCompletionRate: 1,
        criticalRegressions: 0,
        fullBatchSuccessRate: 1,
        qualityEligible: true,
        completeTokenCoverage: tokens.length === resampled.length,
        ...(tokens.length === 0 ? {} : { p50TotalTokens: percentile(tokens, 0.5) }),
        ...medianOptional(resampled.map((sample) => sample.modelCalls), "p50ModelCalls"),
        ...medianOptional(resampled.map((sample) => sample.childAgentMaxFanout), "p50ChildAgentFanout"),
        budgetStatusCounts: {},
      } satisfies RuhrohScaleLevelAnalysisV1;
    });
    const best = fitCandidates(levels).filter((fit) => fit.observable).sort(compareFits)[0]?.candidate;
    if (best !== undefined) {
      counts.set(best, (counts.get(best) ?? 0) + 1);
    }
  }
  return counts;
}

function candidateBasis(candidate: RuhrohScaleCandidate, level: RuhrohScaleLevelAnalysisV1): number | undefined {
  switch (candidate) {
    case "T(1)": return 1;
    case "T(log_n)": return 1 + Math.log2(level.n);
    case "T(n)": return level.n;
    case "T(n_k)": return level.p50ModelCalls === undefined ? undefined : level.n * level.p50ModelCalls;
    case "T(n_k_a)": return level.p50ModelCalls === undefined || level.p50ChildAgentFanout === undefined
      ? undefined
      : level.n * level.p50ModelCalls * Math.max(1, level.p50ChildAgentFanout);
  }
}

function fitCoefficient(points: readonly { basis: number; value: number }[]): number {
  const numerator = points.reduce((total, point) => total + point.basis * point.value, 0);
  const denominator = points.reduce((total, point) => total + point.basis ** 2, 0);
  return denominator === 0 ? 0 : numerator / denominator;
}

function compareFits(
  left: Pick<RuhrohScaleFitV1, "leaveOneScaleOutError" | "normalizedRmse" | "candidate">,
  right: Pick<RuhrohScaleFitV1, "leaveOneScaleOutError" | "normalizedRmse" | "candidate">,
): number {
  const complexityOrder: readonly RuhrohScaleCandidate[] = ["T(1)", "T(log_n)", "T(n)", "T(n_k)", "T(n_k_a)"];
  return left.leaveOneScaleOutError - right.leaveOneScaleOutError
    || left.normalizedRmse - right.normalizedRmse
    || complexityOrder.indexOf(left.candidate) - complexityOrder.indexOf(right.candidate);
}

function percentile(values: readonly number[], probability: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

function medianOptional<K extends string>(values: readonly (number | undefined)[], key: K): Partial<Record<K, number>> {
  return values.length > 0 && values.every((value): value is number => value !== undefined)
    ? { [key]: percentile(values, 0.5) } as Partial<Record<K, number>>
    : {};
}

function countStrings(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.charCodeAt(0);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function sha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}
