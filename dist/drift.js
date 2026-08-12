export function compareRuhrohProviderBaseline(input) {
    const confounders = compareControls(input.baseline.controls, input.currentControls);
    if (confounders.length > 0) {
        return report(input.baseline, ["confounded"], confounders, ["Provider attribution is blocked because the configured cohorts differ."], []);
    }
    const classifications = [];
    const evidence = [];
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
    if (current.priceRatioCi95 !== undefined && significant.get("price") === true && (current.priceRatioCi95.lower > margins.priceRatio
        || current.priceRatioCi95.upper < 1 / margins.priceRatio)) {
        classifications.push("price_change");
        evidence.push(`price ratio interval [${current.priceRatioCi95.lower.toFixed(6)}, ${current.priceRatioCi95.upper.toFixed(6)}] exceeds the reciprocal practical margin`);
    }
    const observableTests = [
        true,
        current.p95ImplementationWallTimeRatioCi95 !== undefined,
        current.tokenRatioCi95 !== undefined,
        current.priceRatioCi95 !== undefined,
    ].filter(Boolean).length;
    const practicalCrossings = [
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
export function holmAdjustRuhrohProviderTests(pValues, alpha = 0.05) {
    const entries = Object.entries(pValues)
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
export function validateRuhrohProviderBaseline(value) {
    if (!isRecord(value)) {
        return ["provider baseline must be an object"];
    }
    const errors = [];
    if (value.version !== "ruhroh_provider_baseline_v1") {
        errors.push("version must be ruhroh_provider_baseline_v1");
    }
    if (!isRecord(value.margins)) {
        errors.push("margins are required");
    }
    else {
        for (const field of ["qualityPassRateDelta", "latencyRatio", "consumptionRatio", "priceRatio"]) {
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
function report(baseline, classifications, confounders, evidence, testResults) {
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
function compareControls(baseline, current) {
    const fields = [
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
function canonicalRecord(value) {
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))));
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=drift.js.map