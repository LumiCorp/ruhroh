export type RuhrohProviderDriftClassification =
  | "identity_drift"
  | "quality_regression"
  | "latency_regression"
  | "price_change"
  | "consumption_change"
  | "inconclusive"
  | "confounded"
  | "no_drift";

export interface RuhrohProviderBaselineControlsV1 {
  suiteId: string;
  suiteVersion: string;
  scenarioVersions: Record<string, string>;
  benchmarkTargetId: string;
  harnessId: string;
  harnessVersion?: string | undefined;
  providerPath: string;
  promptHash: string;
  evaluatorSignature: string;
  judgeIdentity: string;
  environmentPolicyHash: string;
}

export interface RuhrohProviderDriftMarginsV1 {
  qualityPassRateDelta: number;
  latencyRatio: number;
  consumptionRatio: number;
  priceRatio: number;
}

export interface RuhrohProviderMetricSnapshotV1 {
  passRate: number;
  passRateCi95: { lower: number; upper: number };
  p95ImplementationWallTimeMs?: number | undefined;
  p95ImplementationWallTimeRatioCi95?: { lower: number; upper: number } | undefined;
  tokensPerAcceptedOutcome?: number | undefined;
  tokenRatioCi95?: { lower: number; upper: number } | undefined;
  pricePerMillionTokens?: number | undefined;
  priceRatioCi95?: { lower: number; upper: number } | undefined;
  observedModelFingerprint?: string | undefined;
  sampleCount: number;
  metricTestPValues?: Partial<Record<RuhrohProviderMetricTestId, number>> | undefined;
}

export type RuhrohProviderMetricTestId = "quality" | "latency" | "consumption" | "price";

export interface RuhrohProviderMetricTestResultV1 {
  metric: RuhrohProviderMetricTestId;
  rawPValue: number;
  holmAdjustedPValue: number;
  significant: boolean;
}

export interface RuhrohProviderBaselineV1 {
  version: "ruhroh_provider_baseline_v1";
  baselineId: string;
  createdAt: string;
  controls: RuhrohProviderBaselineControlsV1;
  margins: RuhrohProviderDriftMarginsV1;
  metrics: RuhrohProviderMetricSnapshotV1;
  source: { path: string; sha256: string };
}

export interface RuhrohProviderDriftReportV1 {
  version: "ruhroh_provider_drift_report_v1";
  baselineId: string;
  classification: RuhrohProviderDriftClassification;
  classifications: RuhrohProviderDriftClassification[];
  confounders: string[];
  evidence: string[];
  margins: RuhrohProviderDriftMarginsV1;
  multipleTesting: {
    method: "holm";
    familySize: number;
    alpha: 0.05;
    results: RuhrohProviderMetricTestResultV1[];
  };
}

export function compareRuhrohProviderBaseline(input: {
  baseline: RuhrohProviderBaselineV1;
  currentControls: RuhrohProviderBaselineControlsV1;
  currentMetrics: RuhrohProviderMetricSnapshotV1;
}): RuhrohProviderDriftReportV1 {
  const confounders = compareControls(input.baseline.controls, input.currentControls);
  if (confounders.length > 0) {
    return report(input.baseline, ["confounded"], confounders, ["Provider attribution is blocked because the configured cohorts differ."], []);
  }
  const classifications: RuhrohProviderDriftClassification[] = [];
  const evidence: string[] = [];
  const baseline = input.baseline.metrics;
  const current = input.currentMetrics;
  const margins = input.baseline.margins;
  const metricTests = holmAdjustRuhrohProviderTests(current.metricTestPValues ?? {});
  const significant = new Map(metricTests.map((test) => [test.metric, test.significant]));

  if (baseline.observedModelFingerprint !== undefined
    && current.observedModelFingerprint !== undefined
    && baseline.observedModelFingerprint !== current.observedModelFingerprint) {
    classifications.push("identity_drift");
    evidence.push(`observed model fingerprint changed from ${baseline.observedModelFingerprint} to ${current.observedModelFingerprint}`);
  }

  const qualityDeltaUpper = current.passRateCi95.upper - baseline.passRateCi95.lower;
  if (qualityDeltaUpper < -margins.qualityPassRateDelta && significant.get("quality") === true) {
    classifications.push("quality_regression");
    evidence.push(`quality delta upper bound ${qualityDeltaUpper.toFixed(6)} is below the practical margin ${(-margins.qualityPassRateDelta).toFixed(6)}`);
  }

  if (current.p95ImplementationWallTimeRatioCi95 !== undefined
    && current.p95ImplementationWallTimeRatioCi95.lower > margins.latencyRatio
    && significant.get("latency") === true) {
    classifications.push("latency_regression");
    evidence.push(`latency ratio lower bound ${current.p95ImplementationWallTimeRatioCi95.lower.toFixed(6)} exceeds ${margins.latencyRatio}`);
  }
  if (current.tokenRatioCi95 !== undefined && current.tokenRatioCi95.lower > margins.consumptionRatio && significant.get("consumption") === true) {
    classifications.push("consumption_change");
    evidence.push(`token ratio lower bound ${current.tokenRatioCi95.lower.toFixed(6)} exceeds ${margins.consumptionRatio}`);
  }
  if (current.priceRatioCi95 !== undefined && significant.get("price") === true && (
    current.priceRatioCi95.lower > margins.priceRatio
    || current.priceRatioCi95.upper < 1 / margins.priceRatio
  )) {
    classifications.push("price_change");
    evidence.push(`price ratio interval [${current.priceRatioCi95.lower.toFixed(6)}, ${current.priceRatioCi95.upper.toFixed(6)}] exceeds the reciprocal practical margin`);
  }

  const observableTests = [
    true,
    current.p95ImplementationWallTimeRatioCi95 !== undefined,
    current.tokenRatioCi95 !== undefined,
    current.priceRatioCi95 !== undefined,
  ].filter(Boolean).length;
  const practicalCrossings: Array<[RuhrohProviderMetricTestId, boolean]> = [
    ["quality", qualityDeltaUpper < -margins.qualityPassRateDelta],
    ["latency", current.p95ImplementationWallTimeRatioCi95 !== undefined && current.p95ImplementationWallTimeRatioCi95.lower > margins.latencyRatio],
    ["consumption", current.tokenRatioCi95 !== undefined && current.tokenRatioCi95.lower > margins.consumptionRatio],
    ["price", current.priceRatioCi95 !== undefined && (current.priceRatioCi95.lower > margins.priceRatio || current.priceRatioCi95.upper < 1 / margins.priceRatio)],
  ];
  for (const [metric, crossed] of practicalCrossings) {
    if (crossed && significant.get(metric) !== true) {
      evidence.push(`${metric} crossed its practical margin but lacks Holm-adjusted significance`);
    }
  }
  if (classifications.length === 0) {
    const completeIdentity = baseline.observedModelFingerprint !== undefined && current.observedModelFingerprint !== undefined;
    const sufficient = baseline.sampleCount > 0 && current.sampleCount > 0 && observableTests >= 2;
    classifications.push(completeIdentity && sufficient ? "no_drift" : "inconclusive");
    evidence.push(completeIdentity && sufficient
      ? "No predeclared practical margin was crossed."
      : "The available identity or metric evidence is insufficient for a no-drift conclusion.");
  }
  return report(input.baseline, classifications, [], evidence, metricTests);
}

export function holmAdjustRuhrohProviderTests(
  pValues: Partial<Record<RuhrohProviderMetricTestId, number>>,
  alpha = 0.05,
): RuhrohProviderMetricTestResultV1[] {
  const entries = (Object.entries(pValues) as Array<[RuhrohProviderMetricTestId, number]>)
    .filter(([, value]) => Number.isFinite(value) && value >= 0 && value <= 1)
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
  let priorAdjusted = 0;
  const adjusted = entries.map(([metric, rawPValue], index) => {
    const holmAdjustedPValue = Math.min(1, Math.max(priorAdjusted, rawPValue * (entries.length - index)));
    priorAdjusted = holmAdjustedPValue;
    return { metric, rawPValue, holmAdjustedPValue, significant: holmAdjustedPValue <= alpha };
  });
  return adjusted.sort((left, right) => left.metric.localeCompare(right.metric));
}

export function validateRuhrohProviderBaseline(value: unknown): string[] {
  if (!isRecord(value)) {
    return ["provider baseline must be an object"];
  }
  const errors: string[] = [];
  if (value.version !== "ruhroh_provider_baseline_v1") {
    errors.push("version must be ruhroh_provider_baseline_v1");
  }
  if (!isRecord(value.margins)) {
    errors.push("margins are required");
  } else {
    for (const field of ["qualityPassRateDelta", "latencyRatio", "consumptionRatio", "priceRatio"] as const) {
      const raw = value.margins[field];
      if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
        errors.push(`margins.${field} must be a positive finite number`);
      }
    }
  }
  if (!isRecord(value.controls) || !isRecord(value.metrics) || !isRecord(value.source)) {
    errors.push("controls, metrics, and source are required");
  }
  return errors;
}

function report(
  baseline: RuhrohProviderBaselineV1,
  classifications: RuhrohProviderDriftClassification[],
  confounders: string[],
  evidence: string[],
  testResults: RuhrohProviderMetricTestResultV1[],
): RuhrohProviderDriftReportV1 {
  return {
    version: "ruhroh_provider_drift_report_v1",
    baselineId: baseline.baselineId,
    classification: classifications[0] ?? "inconclusive",
    classifications,
    confounders,
    evidence,
    margins: baseline.margins,
    multipleTesting: { method: "holm", familySize: testResults.length, alpha: 0.05, results: testResults },
  };
}

function compareControls(
  baseline: RuhrohProviderBaselineControlsV1,
  current: RuhrohProviderBaselineControlsV1,
): string[] {
  const fields: Array<keyof Omit<RuhrohProviderBaselineControlsV1, "scenarioVersions">> = [
    "suiteId",
    "suiteVersion",
    "benchmarkTargetId",
    "harnessId",
    "harnessVersion",
    "providerPath",
    "promptHash",
    "evaluatorSignature",
    "judgeIdentity",
    "environmentPolicyHash",
  ];
  const confounders = fields.flatMap((field) => baseline[field] === current[field]
    ? []
    : [`${field} changed`]);
  if (canonicalRecord(baseline.scenarioVersions) !== canonicalRecord(current.scenarioVersions)) {
    confounders.push("scenarioVersions changed");
  }
  return confounders;
}

function canonicalRecord(value: Record<string, string>): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
