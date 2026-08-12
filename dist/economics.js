import { createHash } from "node:crypto";
const OUTCOME_FRONTIER_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/outcome-frontier-v1.schema.json";
const BOOTSTRAP_RESAMPLES = 1000;
const MIN_VALID_BOOTSTRAP_RESAMPLES = 950;
export function buildRuhrohOutcomeFrontier(input) {
    if (input.suite === undefined) {
        return {
            $schema: OUTCOME_FRONTIER_SCHEMA_URL,
            version: "ruhroh_outcome_frontier_v1",
            status: "unavailable",
            reasonCodes: ["suite_not_declared"],
            coverage: emptyCoverage(0),
            targets: [],
            paretoFrontierTargetIds: [],
            robustFrontierTargetIds: [],
        };
    }
    if (input.suite.version !== "ruhroh_suite_v2") {
        return {
            $schema: OUTCOME_FRONTIER_SCHEMA_URL,
            version: "ruhroh_outcome_frontier_v1",
            status: "quality_only",
            reasonCodes: ["suite_has_no_efficiency_contract"],
            coverage: emptyCoverage(0),
            targets: [],
            paretoFrontierTargetIds: [],
            robustFrontierTargetIds: [],
        };
    }
    const suite = input.suite;
    const targetMap = new Map();
    const missingTargetRuns = input.summaries.filter((summary) => summary.benchmarkTargetId === undefined);
    for (const summary of input.summaries) {
        if (summary.benchmarkTargetId === undefined) {
            continue;
        }
        targetMap.set(summary.benchmarkTargetId, [...(targetMap.get(summary.benchmarkTargetId) ?? []), summary]);
    }
    const targets = [...targetMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([benchmarkTargetId, summaries]) => buildFrontierTarget(benchmarkTargetId, summaries, suite));
    const qualityEligibleTargets = targets.filter((target) => target.quality.floorStatus === "passed" && target.reasonCodes.length === 0);
    const comparableTargets = qualityEligibleTargets.filter((target) => target.objectives.length === suite.methodology.efficiency.objectives.length
        && target.objectives.every((objective) => objective.status === "available" && objective.value !== undefined && objective.ci95 !== undefined));
    applyDominance(targets, comparableTargets, suite.methodology.efficiency.objectives);
    const paretoFrontierTargetIds = comparableTargets
        .filter((target) => target.paretoStatus === "pareto")
        .map((target) => target.benchmarkTargetId)
        .sort();
    const robustFrontierTargetIds = comparableTargets
        .filter((target) => target.robustStatus === "pareto")
        .map((target) => target.benchmarkTargetId)
        .sort();
    const reasonCodes = uniqueSorted([
        ...(missingTargetRuns.length === 0 ? [] : ["runs_missing_benchmark_target_id"]),
        ...(targets.length < 2 ? ["fewer_than_two_benchmark_targets"] : []),
        ...(qualityEligibleTargets.length < 2 ? ["fewer_than_two_targets_meet_quality_floor"] : []),
        ...(comparableTargets.length < 2 ? ["fewer_than_two_targets_have_complete_objectives"] : []),
    ]);
    const status = reasonCodes.length === 0 ? "available" : "unavailable";
    return {
        $schema: OUTCOME_FRONTIER_SCHEMA_URL,
        version: "ruhroh_outcome_frontier_v1",
        status,
        reasonCodes,
        methodology: {
            suiteId: suite.id,
            suiteVersion: suite.suiteVersion,
            acceptedOutcome: { ...suite.methodology.efficiency.denominator },
            aggregation: { ...suite.methodology.efficiency.aggregation },
            suitableWorkloads: [...suite.methodology.efficiency.suitableWorkloads],
            requiredEvidence: [...suite.methodology.efficiency.requiredEvidence],
            hiddenWork: [...suite.methodology.efficiency.hiddenWork],
            gamingRisks: [...suite.methodology.efficiency.gamingRisks],
            qualityFloor: { ...suite.methodology.efficiency.qualityFloor },
            objectives: [...suite.methodology.efficiency.objectives],
            bootstrap: { ...suite.methodology.efficiency.bootstrap },
            dominance: "pareto_minimize_with_robust_ci_v1",
        },
        coverage: {
            targetCount: targets.length,
            qualityEligibleTargetCount: qualityEligibleTargets.length,
            comparableTargetCount: comparableTargets.length,
            paretoFrontierTargetCount: paretoFrontierTargetIds.length,
            robustFrontierTargetCount: robustFrontierTargetIds.length,
        },
        targets,
        paretoFrontierTargetIds,
        robustFrontierTargetIds,
    };
}
function buildFrontierTarget(benchmarkTargetId, summaries, suite) {
    const targetIdentityRecords = summaries.flatMap((summary) => {
        const identity = summary.runManifest?.benchmarkTarget;
        return identity === undefined ? [] : [identity];
    });
    const identitySignatures = uniqueSorted(targetIdentityRecords.map(stableJsonStringify));
    const identity = cloneRecord(targetIdentityRecords[0] ?? { targetId: benchmarkTargetId });
    const scenarioResults = suite.scenarioIds.map((scenarioId) => buildScenarioQuality(scenarioId, summaries.filter((summary) => summary.scenarioId === scenarioId), suite));
    const floorStatus = scenarioResults.some((result) => result.floorStatus === "indeterminate")
        ? "indeterminate"
        : scenarioResults.some((result) => result.floorStatus === "failed") ? "failed" : "passed";
    const acceptedOutcomes = summaries.filter((summary) => summary.acceptedOutcome).length;
    const reasonCodes = uniqueSorted([
        ...(identitySignatures.length > 1 ? ["conflicting_benchmark_target_identity"] : []),
        ...(targetIdentityRecords.length !== summaries.length ? ["missing_benchmark_target_identity"] : []),
        ...(summaries.some((summary) => summary.acceptedOutcomeInvariantWarnings.length > 0) ? ["accepted_outcome_invariant_mismatch"] : []),
        ...(floorStatus === "failed" ? ["quality_floor_failed"] : []),
        ...(floorStatus === "indeterminate" ? ["quality_floor_indeterminate"] : []),
    ]);
    const objectives = suite.methodology.efficiency.objectives.map((objective) => buildObjectiveEstimate(objective, benchmarkTargetId, summaries, suite.scenarioIds));
    return {
        benchmarkTargetId,
        executionAdapterIds: uniqueSorted(summaries.map((summary) => summary.executionAdapterId)),
        identity,
        runs: summaries.length,
        acceptedOutcomes,
        quality: { floorStatus, scenarioResults },
        objectives,
        paretoStatus: floorStatus === "passed" && reasonCodes.length === 0 ? "indeterminate" : "ineligible",
        paretoDominatedByTargetIds: [],
        robustStatus: floorStatus === "passed" && reasonCodes.length === 0 ? "indeterminate" : "ineligible",
        robustDominatedByTargetIds: [],
        reasonCodes,
    };
}
function buildScenarioQuality(scenarioId, summaries, suite) {
    const runs = summaries.length;
    const acceptedOutcomes = summaries.filter((summary) => summary.acceptedOutcome).length;
    const weightsComplete = summaries.every((summary) => isPositiveFiniteNumber(summary.sample?.weight));
    const totalWeight = weightsComplete
        ? summaries.reduce((total, summary) => total + (summary.sample?.weight ?? 0), 0)
        : 0;
    const weightedAcceptedOutcomes = weightsComplete
        ? summaries.reduce((total, summary) => total + (summary.acceptedOutcome ? (summary.sample?.weight ?? 0) : 0), 0)
        : 0;
    const effectiveRuns = weightsComplete && totalWeight > 0
        ? totalWeight ** 2 / summaries.reduce((total, summary) => total + (summary.sample?.weight ?? 0) ** 2, 0)
        : runs;
    const passRate = weightsComplete && totalWeight > 0 ? weightedAcceptedOutcomes / totalWeight : runs === 0 ? 0 : acceptedOutcomes / runs;
    const passRateCi95 = wilsonConfidenceInterval(passRate * effectiveRuns, effectiveRuns);
    const reasonCodes = uniqueSorted([
        ...(runs === 0 ? ["scenario_missing"] : []),
        ...(runs > 0 && runs < suite.methodology.minRuns ? ["minimum_runs_not_met"] : []),
        ...(runs > 0 && !weightsComplete ? ["run_plan_weight_coverage_incomplete"] : []),
        ...(summaries.some((summary) => summary.acceptedOutcomeInvariantWarnings.length > 0) ? ["accepted_outcome_invariant_mismatch"] : []),
    ]);
    const floorStatus = reasonCodes.length > 0
        ? "indeterminate"
        : passRateCi95.lower >= suite.methodology.efficiency.qualityFloor.threshold ? "passed" : "failed";
    return {
        scenarioId,
        runs,
        acceptedOutcomes,
        passRate,
        passRateCi95,
        floorStatus,
        reasonCodes,
    };
}
function buildObjectiveEstimate(objective, benchmarkTargetId, summaries, scenarioIds) {
    const acceptedOutcomes = summaries.filter((summary) => summary.acceptedOutcome).length;
    const observedValues = objectiveValues(objective, summaries);
    const coverage = coverageForObjective(objective, summaries, observedValues.length);
    const planWeightCoverage = coverageForPlanWeights(summaries);
    const weightedAcceptedOutcomes = planWeightCoverage.status === "complete"
        ? summaries.reduce((total, summary) => total + (summary.acceptedOutcome ? (summary.sample?.weight ?? 0) : 0), 0)
        : undefined;
    const unit = objectiveUnit(objective);
    const totalConsumption = objective === "p95_implementation_wall_time_ms" || coverage.status !== "complete" || planWeightCoverage.status !== "complete"
        ? undefined
        : summaries.reduce((total, summary) => total + objectiveValue(objective, summary) * (summary.sample?.weight ?? 0), 0);
    const value = coverage.status === "complete" && planWeightCoverage.status === "complete"
        ? objectivePointEstimate(objective, summaries)
        : undefined;
    const bootstrapValues = value === undefined || coverage.status !== "complete"
        ? []
        : bootstrapObjectiveValues(objective, benchmarkTargetId, summaries, scenarioIds);
    const ci95 = bootstrapValues.length >= MIN_VALID_BOOTSTRAP_RESAMPLES
        ? bootstrapConfidenceInterval(bootstrapValues)
        : undefined;
    const reasonCodes = uniqueSorted([
        ...(coverage.status === "unknown" ? ["metric_coverage_unknown"] : []),
        ...(coverage.status === "unavailable" ? ["metric_unavailable"] : []),
        ...(coverage.status === "partial" ? ["metric_coverage_partial"] : []),
        ...(planWeightCoverage.status === "unknown" ? ["run_plan_weight_coverage_unknown"] : []),
        ...(planWeightCoverage.status === "partial" ? ["run_plan_weight_coverage_partial"] : []),
        ...(summaries.some((summary) => summary.sample?.weight === undefined && summary.sample?.planWeight !== undefined)
            ? ["legacy_plan_weight_alias_is_not_authoritative"]
            : []),
        ...(objective !== "p95_implementation_wall_time_ms" && acceptedOutcomes === 0 ? ["zero_accepted_outcomes"] : []),
        ...(value !== undefined && bootstrapValues.length < MIN_VALID_BOOTSTRAP_RESAMPLES ? ["fewer_than_950_valid_bootstrap_samples"] : []),
    ]);
    const status = coverage.status === "partial"
        ? "partial"
        : coverage.status === "unknown" || coverage.status === "unavailable" ? "unavailable"
            : planWeightCoverage.status !== "complete" ? "indeterminate"
                : value === undefined ? "unavailable"
                    : ci95 === undefined ? "indeterminate" : "available";
    return {
        objective,
        status,
        unit,
        acceptedOutcomes,
        coverage,
        planWeightCoverage,
        ...(value === undefined ? {} : { value }),
        ...(totalConsumption === undefined ? {} : { totalConsumption }),
        ...(weightedAcceptedOutcomes === undefined ? {} : { weightedAcceptedOutcomes }),
        ...(ci95 === undefined ? {} : { ci95 }),
        validBootstrapSamples: bootstrapValues.length,
        reasonCodes,
    };
}
function bootstrapObjectiveValues(objective, benchmarkTargetId, summaries, scenarioIds) {
    const strata = scenarioIds.map((scenarioId) => summaries.filter((summary) => summary.scenarioId === scenarioId));
    if (strata.some((stratum) => stratum.length === 0)) {
        return [];
    }
    const values = [];
    for (let sampleIndex = 0; sampleIndex < BOOTSTRAP_RESAMPLES; sampleIndex += 1) {
        const sample = [];
        for (const [stratumIndex, stratum] of strata.entries()) {
            for (let drawIndex = 0; drawIndex < stratum.length; drawIndex += 1) {
                const selectedIndex = Math.floor(seededUnitInterval(`${benchmarkTargetId}:${objective}:${stratumIndex}`, sampleIndex, drawIndex) * stratum.length);
                const selected = stratum[Math.min(selectedIndex, stratum.length - 1)];
                if (selected !== undefined) {
                    sample.push(selected);
                }
            }
        }
        const observedValues = objectiveValues(objective, sample);
        if (observedValues.length !== sample.length) {
            continue;
        }
        const estimate = objectivePointEstimate(objective, sample);
        if (estimate !== undefined && Number.isFinite(estimate)) {
            values.push(estimate);
        }
    }
    return values;
}
function applyDominance(targets, comparableTargets, objectives) {
    const comparableIds = new Set(comparableTargets.map((target) => target.benchmarkTargetId));
    for (const target of targets) {
        if (!comparableIds.has(target.benchmarkTargetId)) {
            if (target.quality.floorStatus === "passed" && target.reasonCodes.length === 0) {
                target.paretoStatus = "indeterminate";
                target.robustStatus = "indeterminate";
            }
            continue;
        }
        const pointDominators = comparableTargets.filter((candidate) => candidate.benchmarkTargetId !== target.benchmarkTargetId && pointDominates(candidate, target, objectives));
        const robustDominators = comparableTargets.filter((candidate) => candidate.benchmarkTargetId !== target.benchmarkTargetId && robustlyDominates(candidate, target, objectives));
        target.paretoDominatedByTargetIds = pointDominators.map((candidate) => candidate.benchmarkTargetId).sort();
        target.robustDominatedByTargetIds = robustDominators.map((candidate) => candidate.benchmarkTargetId).sort();
        target.paretoStatus = pointDominators.length === 0 ? "pareto" : "dominated";
        target.robustStatus = robustDominators.length === 0 ? "pareto" : "dominated";
    }
}
function pointDominates(candidate, target, objectives) {
    let strict = false;
    for (const objective of objectives) {
        const candidateValue = findObjective(candidate, objective)?.value;
        const targetValue = findObjective(target, objective)?.value;
        if (candidateValue === undefined || targetValue === undefined || candidateValue > targetValue) {
            return false;
        }
        if (candidateValue < targetValue) {
            strict = true;
        }
    }
    return strict;
}
function robustlyDominates(candidate, target, objectives) {
    let strict = false;
    for (const objective of objectives) {
        const candidateInterval = findObjective(candidate, objective)?.ci95;
        const targetInterval = findObjective(target, objective)?.ci95;
        if (candidateInterval === undefined || targetInterval === undefined || candidateInterval.upper > targetInterval.lower) {
            return false;
        }
        if (candidateInterval.upper < targetInterval.lower) {
            strict = true;
        }
    }
    return strict;
}
function findObjective(target, objective) {
    return target.objectives.find((estimate) => estimate.objective === objective);
}
function objectiveValues(objective, summaries) {
    if (objective === "cost_per_accepted_outcome") {
        return summaries.flatMap((summary) => summary.usage?.costUsd === undefined ? [] : [summary.usage.costUsd]);
    }
    if (objective === "tokens_per_accepted_outcome") {
        return summaries.flatMap((summary) => summary.usage?.totalTokens === undefined ? [] : [summary.usage.totalTokens]);
    }
    return summaries.flatMap((summary) => summary.implementationWallTimeMs === undefined ? [] : [summary.implementationWallTimeMs]);
}
function objectiveValue(objective, summary) {
    if (objective === "cost_per_accepted_outcome") {
        return summary.usage?.costUsd ?? 0;
    }
    if (objective === "tokens_per_accepted_outcome") {
        return summary.usage?.totalTokens ?? 0;
    }
    return summary.implementationWallTimeMs ?? 0;
}
function objectivePointEstimate(objective, summaries) {
    if (summaries.length === 0 || summaries.some((summary) => !isPositiveFiniteNumber(summary.sample?.weight))) {
        return undefined;
    }
    if (objective === "p95_implementation_wall_time_ms") {
        return weightedPercentile(summaries.map((summary) => ({ value: summary.implementationWallTimeMs ?? 0, weight: summary.sample?.weight ?? 0 })), 0.95);
    }
    const weightedAcceptedOutcomes = summaries.reduce((total, summary) => total + (summary.acceptedOutcome ? (summary.sample?.weight ?? 0) : 0), 0);
    if (weightedAcceptedOutcomes === 0) {
        return undefined;
    }
    return summaries.reduce((total, summary) => total + objectiveValue(objective, summary) * (summary.sample?.weight ?? 0), 0) / weightedAcceptedOutcomes;
}
function objectiveUnit(objective) {
    if (objective === "cost_per_accepted_outcome") {
        return "usd_per_accepted_outcome";
    }
    if (objective === "tokens_per_accepted_outcome") {
        return "tokens_per_accepted_outcome";
    }
    return "milliseconds";
}
function coverageForObjective(objective, summaries, observedRuns) {
    const totalRuns = summaries.length;
    const completeRuns = objective === "p95_implementation_wall_time_ms"
        ? summaries.filter((summary) => summary.implementationWallTimeMs !== undefined).length
        : summaries.filter((summary) => {
            const coverage = objective === "cost_per_accepted_outcome"
                ? summary.usageCoverage.cost
                : summary.usageCoverage.totalTokens;
            const value = objective === "cost_per_accepted_outcome"
                ? summary.usage?.costUsd
                : summary.usage?.totalTokens;
            return coverage === "complete" && value !== undefined;
        }).length;
    const statuses = objective === "p95_implementation_wall_time_ms"
        ? summaries.map((summary) => summary.implementationWallTimeMs === undefined ? "unavailable" : "complete")
        : summaries.map((summary) => objective === "cost_per_accepted_outcome"
            ? summary.usageCoverage.cost
            : summary.usageCoverage.totalTokens);
    const allUnavailable = statuses.length > 0 && statuses.every((status) => status === "unavailable");
    const allUnknown = statuses.length > 0 && statuses.every((status) => status === "unknown");
    const hasExplicitPartialCoverage = objective !== "p95_implementation_wall_time_ms" && summaries.some((summary) => {
        const coverage = objective === "cost_per_accepted_outcome"
            ? summary.usageCoverage.cost
            : summary.usageCoverage.totalTokens;
        return coverage === "partial";
    });
    return {
        status: completeRuns === totalRuns && totalRuns > 0
            ? "complete"
            : allUnavailable ? "unavailable"
                : allUnknown ? "unknown"
                    : completeRuns > 0 || hasExplicitPartialCoverage || statuses.length > 0 ? "partial" : "unknown",
        observedRuns,
        completeRuns,
        totalRuns,
    };
}
function coverageForPlanWeights(summaries) {
    const observedRuns = summaries.filter((summary) => isPositiveFiniteNumber(summary.sample?.weight)).length;
    return {
        status: observedRuns === 0 ? "unknown" : observedRuns === summaries.length ? "complete" : "partial",
        observedRuns,
        completeRuns: observedRuns,
        totalRuns: summaries.length,
    };
}
function isPositiveFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function weightedPercentile(values, percentile) {
    const sorted = [...values].sort((left, right) => left.value - right.value);
    const totalWeight = sorted.reduce((total, item) => total + item.weight, 0);
    if (totalWeight <= 0) {
        return 0;
    }
    const threshold = Math.max(0, Math.min(1, percentile)) * totalWeight;
    let cumulative = 0;
    for (const item of sorted) {
        cumulative += item.weight;
        if (cumulative >= threshold) {
            return item.value;
        }
    }
    return sorted.at(-1)?.value ?? 0;
}
function bootstrapConfidenceInterval(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return {
        method: "bootstrap_percentile",
        confidenceLevel: 0.95,
        lower: percentileSorted(sorted, 0.025),
        upper: percentileSorted(sorted, 0.975),
    };
}
function wilsonConfidenceInterval(successes, total) {
    if (total === 0) {
        return { method: "wilson", confidenceLevel: 0.95, lower: 0, upper: 0 };
    }
    const z = 1.959963984540054;
    const proportion = successes / total;
    const zSquared = z ** 2;
    const denominator = 1 + zSquared / total;
    const center = proportion + zSquared / (2 * total);
    const margin = z * Math.sqrt((proportion * (1 - proportion) + zSquared / (4 * total)) / total);
    return {
        method: "wilson",
        confidenceLevel: 0.95,
        lower: Math.max(0, Math.min(1, (center - margin) / denominator)),
        upper: Math.max(0, Math.min(1, (center + margin) / denominator)),
    };
}
function seededUnitInterval(seed, sampleIndex, drawIndex) {
    const digest = createHash("sha256").update(`${seed}:${sampleIndex}:${drawIndex}`).digest();
    return digest.readUInt32BE(0) / 0x1_0000_0000;
}
function percentileSorted(values, percentile) {
    if (values.length === 0) {
        return 0;
    }
    const position = (values.length - 1) * percentile;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lower = values[lowerIndex] ?? 0;
    const upper = values[upperIndex] ?? lower;
    return lower + (upper - lower) * (position - lowerIndex);
}
function emptyCoverage(targetCount) {
    return {
        targetCount,
        qualityEligibleTargetCount: 0,
        comparableTargetCount: 0,
        paretoFrontierTargetCount: 0,
        robustFrontierTargetCount: 0,
    };
}
function cloneRecord(record) {
    return JSON.parse(JSON.stringify(record));
}
function stableJsonStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableJsonStringify).join(",")}]`;
    }
    if (isRecord(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validateRuhrohOutcomeFrontier(input) {
    const errors = [];
    const warnings = [];
    if (!isRecord(input)) {
        return { version: "ruhroh_outcome_frontier_validation_v1", errors: ["frontier must be an object"], warnings };
    }
    if (input.version !== "ruhroh_outcome_frontier_v1") {
        errors.push("version must be ruhroh_outcome_frontier_v1");
    }
    if (input.status !== "available" && input.status !== "quality_only" && input.status !== "unavailable") {
        errors.push("status must be available, quality_only, or unavailable");
    }
    const reasonCodes = requireStringArray(input, "reasonCodes", errors, "reasonCodes");
    const methodology = optionalRecord(input, "methodology", errors, "methodology");
    const methodologyMayBeAbsent = input.status === "quality_only"
        || (input.status === "unavailable" && reasonCodes.includes("suite_not_declared"));
    if (!methodologyMayBeAbsent && methodology === undefined) {
        errors.push("methodology is required unless the suite is undeclared or quality-only");
    }
    if (methodology !== undefined) {
        requireNonEmptyString(methodology, "suiteId", errors, "methodology.suiteId");
        requireNonEmptyString(methodology, "suiteVersion", errors, "methodology.suiteVersion");
        const aggregation = requireRecord(methodology, "aggregation", errors, "methodology.aggregation");
        if (aggregation !== undefined) {
            if (aggregation.weighting !== "run_plan") {
                errors.push("methodology.aggregation.weighting must be run_plan");
            }
            if (aggregation.failedWork !== "included_in_resource_numerator") {
                errors.push("methodology.aggregation.failedWork must be included_in_resource_numerator");
            }
        }
        for (const field of ["suitableWorkloads", "requiredEvidence", "hiddenWork", "gamingRisks"]) {
            const values = requireStringArray(methodology, field, errors, `methodology.${field}`);
            if (values.length === 0) {
                errors.push(`methodology.${field} must include at least one entry`);
            }
        }
        const bootstrap = requireRecord(methodology, "bootstrap", errors, "methodology.bootstrap");
        if (bootstrap !== undefined) {
            if (bootstrap.resamples !== BOOTSTRAP_RESAMPLES) {
                errors.push("methodology.bootstrap.resamples must be 1000");
            }
            if (bootstrap.minValidResamples !== MIN_VALID_BOOTSTRAP_RESAMPLES) {
                errors.push("methodology.bootstrap.minValidResamples must be 950");
            }
        }
        const objectives = requireStringArray(methodology, "objectives", errors, "methodology.objectives");
        if (new Set(objectives).size !== objectives.length) {
            errors.push("methodology.objectives must be unique");
        }
    }
    const targets = requireRecordArray(input, "targets", errors, "targets");
    const coverage = requireRecord(input, "coverage", errors, "coverage");
    if (coverage !== undefined) {
        for (const field of ["targetCount", "qualityEligibleTargetCount", "comparableTargetCount", "paretoFrontierTargetCount", "robustFrontierTargetCount"]) {
            requireNonNegativeNumber(coverage, field, errors, `coverage.${field}`);
        }
        if (typeof coverage.targetCount === "number" && coverage.targetCount !== targets.length) {
            errors.push("coverage.targetCount must match targets length");
        }
    }
    const targetIds = new Set();
    const selectedObjectives = methodology === undefined
        ? undefined
        : requireStringArray(methodology, "objectives", errors, "methodology.objectives");
    for (const [index, target] of targets.entries()) {
        validateFrontierTarget(target, errors, `targets[${index}]`);
        if (selectedObjectives !== undefined) {
            const targetObjectives = (Array.isArray(target.objectives)
                ? target.objectives.filter((objective) => isRecord(objective))
                : [])
                .flatMap((objective) => typeof objective.objective === "string" ? [objective.objective] : [])
                .sort();
            if (JSON.stringify(targetObjectives) !== JSON.stringify([...selectedObjectives].sort())) {
                errors.push(`targets[${index}].objectives must exactly match methodology.objectives`);
            }
        }
        if (typeof target.benchmarkTargetId === "string") {
            if (targetIds.has(target.benchmarkTargetId)) {
                errors.push(`targets contains duplicate benchmarkTargetId: ${target.benchmarkTargetId}`);
            }
            targetIds.add(target.benchmarkTargetId);
        }
    }
    const paretoIds = requireStringArray(input, "paretoFrontierTargetIds", errors, "paretoFrontierTargetIds");
    const robustIds = requireStringArray(input, "robustFrontierTargetIds", errors, "robustFrontierTargetIds");
    for (const id of [...paretoIds, ...robustIds]) {
        if (!targetIds.has(id)) {
            errors.push(`frontier target id does not reference a target: ${id}`);
        }
    }
    for (const [index, target] of targets.entries()) {
        for (const field of ["paretoDominatedByTargetIds", "robustDominatedByTargetIds"]) {
            const ids = Array.isArray(target[field]) ? target[field] : [];
            for (const id of ids) {
                if (typeof id === "string" && !targetIds.has(id)) {
                    errors.push(`targets[${index}].${field} contains unknown target: ${id}`);
                }
                if (id === target.benchmarkTargetId) {
                    errors.push(`targets[${index}].${field} cannot contain its own target id`);
                }
            }
        }
    }
    if (input.status === "available" && targets.length < 2) {
        errors.push("available frontier requires at least two targets");
    }
    if (input.status === "available" && reasonCodes.length > 0) {
        errors.push("available frontier cannot include top-level reasonCodes");
    }
    const expectedParetoIds = targets.flatMap((target) => target.paretoStatus === "pareto" ? [String(target.benchmarkTargetId)] : []).sort();
    const expectedRobustIds = targets.flatMap((target) => target.robustStatus === "pareto" ? [String(target.benchmarkTargetId)] : []).sort();
    if (JSON.stringify([...paretoIds].sort()) !== JSON.stringify(expectedParetoIds)) {
        errors.push("paretoFrontierTargetIds must match pareto target statuses");
    }
    if (JSON.stringify([...robustIds].sort()) !== JSON.stringify(expectedRobustIds)) {
        errors.push("robustFrontierTargetIds must match pareto target statuses");
    }
    if (coverage !== undefined) {
        const qualityEligibleCount = targets.filter((target) => isRecord(target.quality) && target.quality.floorStatus === "passed" && Array.isArray(target.reasonCodes) && target.reasonCodes.length === 0).length;
        const comparableCount = targets.filter((target) => target.paretoStatus === "pareto" || target.paretoStatus === "dominated").length;
        if (coverage.qualityEligibleTargetCount !== qualityEligibleCount) {
            errors.push("coverage.qualityEligibleTargetCount must match eligible targets");
        }
        if (coverage.comparableTargetCount !== comparableCount) {
            errors.push("coverage.comparableTargetCount must match comparable targets");
        }
        if (coverage.paretoFrontierTargetCount !== paretoIds.length) {
            errors.push("coverage.paretoFrontierTargetCount must match paretoFrontierTargetIds length");
        }
        if (coverage.robustFrontierTargetCount !== robustIds.length) {
            errors.push("coverage.robustFrontierTargetCount must match robustFrontierTargetIds length");
        }
    }
    return {
        version: "ruhroh_outcome_frontier_validation_v1",
        errors: uniqueSorted(errors),
        warnings: uniqueSorted(warnings),
    };
}
function validateFrontierTarget(target, errors, pathLabel) {
    requireNonEmptyString(target, "benchmarkTargetId", errors, `${pathLabel}.benchmarkTargetId`);
    requireStringArray(target, "executionAdapterIds", errors, `${pathLabel}.executionAdapterIds`);
    requireNonNegativeNumber(target, "runs", errors, `${pathLabel}.runs`);
    requireNonNegativeNumber(target, "acceptedOutcomes", errors, `${pathLabel}.acceptedOutcomes`);
    const objectives = requireRecordArray(target, "objectives", errors, `${pathLabel}.objectives`);
    const objectiveNames = new Set();
    for (const [index, objective] of objectives.entries()) {
        const objectivePath = `${pathLabel}.objectives[${index}]`;
        const name = requireNonEmptyString(objective, "objective", errors, `${objectivePath}.objective`);
        if (name !== undefined && objectiveNames.has(name)) {
            errors.push(`${pathLabel}.objectives contains duplicate objective: ${name}`);
        }
        if (name !== undefined) {
            objectiveNames.add(name);
        }
        if (objective.status !== "available" && objective.status !== "partial" && objective.status !== "unavailable" && objective.status !== "indeterminate") {
            errors.push(`${objectivePath}.status is invalid`);
        }
        const coverage = requireRecord(objective, "coverage", errors, `${objectivePath}.coverage`);
        if (coverage !== undefined) {
            validateCoverage(coverage, errors, `${objectivePath}.coverage`);
            if (coverage.status !== "complete" && objective.value !== undefined) {
                errors.push(`${objectivePath}.value requires complete coverage`);
            }
        }
        const planWeightCoverage = requireRecord(objective, "planWeightCoverage", errors, `${objectivePath}.planWeightCoverage`);
        if (planWeightCoverage !== undefined) {
            validateCoverage(planWeightCoverage, errors, `${objectivePath}.planWeightCoverage`);
            if (planWeightCoverage.status !== "complete" && objective.value !== undefined) {
                errors.push(`${objectivePath}.value requires complete run-plan weight coverage`);
            }
        }
        requireNonNegativeNumber(objective, "validBootstrapSamples", errors, `${objectivePath}.validBootstrapSamples`);
        if (objective.status === "available") {
            requireNonNegativeNumber(objective, "value", errors, `${objectivePath}.value`);
            if (typeof objective.validBootstrapSamples !== "number" || objective.validBootstrapSamples < MIN_VALID_BOOTSTRAP_RESAMPLES || objective.validBootstrapSamples > BOOTSTRAP_RESAMPLES) {
                errors.push(`${objectivePath}.available objective must have between 950 and 1000 validBootstrapSamples`);
            }
        }
        const interval = optionalRecord(objective, "ci95", errors, `${objectivePath}.ci95`);
        if (objective.status === "available" && interval === undefined) {
            errors.push(`${objectivePath}.ci95 is required when status is available`);
        }
        if (interval !== undefined) {
            requireNonNegativeNumber(interval, "lower", errors, `${objectivePath}.ci95.lower`);
            requireNonNegativeNumber(interval, "upper", errors, `${objectivePath}.ci95.upper`);
            if (typeof interval.lower === "number" && typeof interval.upper === "number" && interval.lower > interval.upper) {
                errors.push(`${objectivePath}.ci95.lower must be <= upper`);
            }
        }
    }
    if (target.paretoStatus !== "pareto" && target.paretoStatus !== "dominated" && target.paretoStatus !== "ineligible" && target.paretoStatus !== "indeterminate") {
        errors.push(`${pathLabel}.paretoStatus is invalid`);
    }
    if (target.robustStatus !== "pareto" && target.robustStatus !== "dominated" && target.robustStatus !== "ineligible" && target.robustStatus !== "indeterminate") {
        errors.push(`${pathLabel}.robustStatus is invalid`);
    }
    requireStringArray(target, "paretoDominatedByTargetIds", errors, `${pathLabel}.paretoDominatedByTargetIds`);
    requireStringArray(target, "robustDominatedByTargetIds", errors, `${pathLabel}.robustDominatedByTargetIds`);
    requireStringArray(target, "reasonCodes", errors, `${pathLabel}.reasonCodes`);
}
function validateCoverage(coverage, errors, pathLabel) {
    if (coverage.status !== "complete" && coverage.status !== "partial" && coverage.status !== "unknown" && coverage.status !== "unavailable") {
        errors.push(`${pathLabel}.status must be complete, partial, unknown, or unavailable`);
    }
    for (const field of ["observedRuns", "completeRuns", "totalRuns"]) {
        requireNonNegativeNumber(coverage, field, errors, `${pathLabel}.${field}`);
    }
}
function requireRecord(record, field, errors, pathLabel) {
    const value = record[field];
    if (!isRecord(value)) {
        errors.push(`${pathLabel} must be an object`);
        return undefined;
    }
    return value;
}
function optionalRecord(record, field, errors, pathLabel) {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (!isRecord(value)) {
        errors.push(`${pathLabel} must be an object`);
        return undefined;
    }
    return value;
}
function requireRecordArray(record, field, errors, pathLabel) {
    const value = record[field];
    if (!Array.isArray(value)) {
        errors.push(`${pathLabel} must be an array`);
        return [];
    }
    return value.flatMap((item, index) => isRecord(item) ? [item] : (errors.push(`${pathLabel}[${index}] must be an object`), []));
}
function requireStringArray(record, field, errors, pathLabel) {
    const value = record[field];
    if (!Array.isArray(value)) {
        errors.push(`${pathLabel} must be an array of strings`);
        return [];
    }
    return value.flatMap((item, index) => typeof item === "string" ? [item] : (errors.push(`${pathLabel}[${index}] must be string`), []));
}
function requireNonEmptyString(record, field, errors, pathLabel) {
    const value = record[field];
    if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`${pathLabel} must be non-empty string`);
        return undefined;
    }
    return value;
}
function requireNonNegativeNumber(record, field, errors, pathLabel) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        errors.push(`${pathLabel} must be non-negative number`);
    }
}
//# sourceMappingURL=economics.js.map