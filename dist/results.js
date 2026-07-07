const STANDARD_SUBSCORE_DIMENSIONS = [
    "functionality",
    "workflow",
    "buildRun",
    "persistence",
    "constraintCompliance",
    "evidenceQuality",
];
export function scoreForEvalStatus(status) {
    return status === "passed" ? 1 : 0;
}
export function normalizeRuhrohEvalResult(input) {
    const raw = isRecord(input) ? input : {};
    const status = parseEvalStatus(raw.status);
    const result = {
        version: "ruhroh_eval_result_v1",
        status,
        goalMet: typeof raw.goalMet === "boolean" ? raw.goalMet : status === "passed",
        confidence: parseEvalConfidence(raw.confidence),
        reasons: readStringArray(raw.reasons),
        unmetCriteria: readStringArray(raw.unmetCriteria),
        evidenceRefs: readEvidenceRefs(raw.evidenceRefs),
        commandsRun: readCommandRecords(raw.commandsRun),
        artifacts: readStringRecord(raw.artifacts),
        finalSummary: typeof raw.finalSummary === "string" && raw.finalSummary.trim().length > 0
            ? raw.finalSummary
            : fallbackFinalSummary(status),
    };
    if (typeof raw.repairBrief === "string") {
        result.repairBrief = raw.repairBrief;
    }
    const criteriaResults = readCriteriaResults(raw.criteriaResults);
    if (criteriaResults.length > 0) {
        result.criteriaResults = criteriaResults;
    }
    const subscores = readSubscores(raw.subscores);
    if (Object.keys(subscores).length > 0) {
        result.subscores = subscores;
    }
    const judge = readJudge(raw.judge);
    if (judge !== undefined) {
        result.judge = judge;
    }
    return result;
}
export function summarizeRuhrohRun(run) {
    const evalResult = normalizeRuhrohEvalResult(run.evalResult);
    return {
        scenarioId: run.scenarioId,
        adapter: run.runAgentAdapterId || run.adapter,
        status: run.status,
        evalStatus: evalResult.status,
        failureBucket: run.failureBucket || run.failure_kind,
        score: run.score,
        iterationsUsed: run.implementationIterationsUsed || run.iterationsUsed,
        durationMs: run.duration_ms,
        finalSummary: evalResult.finalSummary,
        unmetCriteria: evalResult.unmetCriteria,
        criteriaResults: evalResult.criteriaResults ?? [],
        subscores: evalResult.subscores ?? {},
        commandsRun: evalResult.commandsRun,
        artifactPaths: run.artifactPaths ?? evalResult.artifacts,
    };
}
export function aggregateRuhrohRuns(runs) {
    const groups = new Map();
    for (const run of runs) {
        const summary = summarizeRuhrohRun(run);
        const key = `${summary.scenarioId}\u0000${summary.adapter}`;
        groups.set(key, [...(groups.get(key) ?? []), summary]);
    }
    return [...groups.values()].map((summaries) => {
        const first = summaries[0];
        if (first === undefined) {
            throw new Error("Ruhroh aggregate group unexpectedly empty");
        }
        const durations = summaries.map((summary) => summary.durationMs).sort((left, right) => left - right);
        const passes = summaries.filter((summary) => summary.score === 1).length;
        return {
            scenarioId: first.scenarioId,
            adapter: first.adapter,
            runs: summaries.length,
            passes,
            passRate: passes / summaries.length,
            meanScore: mean(summaries.map((summary) => summary.score)),
            meanSubscores: meanSubscores(summaries),
            medianDurationMs: median(durations),
            iterationDistribution: countBy(summaries.map((summary) => String(summary.iterationsUsed))),
            failureBuckets: countBy(summaries.map((summary) => summary.failureBucket || "unknown")),
        };
    }).sort((left, right) => left.scenarioId.localeCompare(right.scenarioId) || left.adapter.localeCompare(right.adapter));
}
export function mapEvalResultToVerdict(evalResult) {
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
export function mapRuntimeFailureToVerdict(implementationRuns, options = {}) {
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
export function deriveRuhrohVerdict(implementationRuns, evalResult, options = {}) {
    return mapRuntimeFailureToVerdict(implementationRuns, options) ?? mapEvalResultToVerdict(evalResult);
}
function parseEvalStatus(value) {
    if (value === "passed" || value === "failed" || value === "review" || value === "infra_failed") {
        return value;
    }
    return "infra_failed";
}
function parseEvalConfidence(value) {
    if (value === "low" || value === "medium" || value === "high") {
        return value;
    }
    return "medium";
}
function parseCriterionStatus(value) {
    if (value === "passed" || value === "failed" || value === "partial" || value === "not_applicable") {
        return value;
    }
    return "failed";
}
function readStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((item) => typeof item === "string");
}
function readStringRecord(value) {
    if (!isRecord(value)) {
        return {};
    }
    const output = {};
    for (const [key, recordValue] of Object.entries(value)) {
        if (typeof recordValue === "string") {
            output[key] = recordValue;
        }
    }
    return output;
}
function readEvidenceRefs(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item) => {
        if (!isRecord(item) || typeof item.kind !== "string" || typeof item.ref !== "string") {
            return [];
        }
        return [{
                kind: item.kind,
                ref: item.ref,
                summary: typeof item.summary === "string" ? item.summary : "",
            }];
    });
}
function readCommandRecords(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item) => {
        if (!isRecord(item) || typeof item.command !== "string") {
            return [];
        }
        return [{
                command: item.command,
                exitCode: typeof item.exitCode === "number" ? item.exitCode : 0,
                summary: typeof item.summary === "string" ? item.summary : "",
            }];
    });
}
function readCriteriaResults(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item, index) => {
        if (!isRecord(item)) {
            return [];
        }
        const id = typeof item.id === "string" && item.id.trim().length > 0 ? item.id : `criterion-${index + 1}`;
        const description = typeof item.description === "string" ? item.description : id;
        const criterion = {
            id,
            description,
            status: parseCriterionStatus(item.status),
            score: clampScore(item.score),
            evidenceRefs: readEvidenceRefs(item.evidenceRefs),
        };
        if (typeof item.weight === "number" && Number.isFinite(item.weight)) {
            criterion.weight = item.weight;
        }
        if (typeof item.notes === "string") {
            criterion.notes = item.notes;
        }
        return [criterion];
    });
}
function readSubscores(value) {
    if (!isRecord(value)) {
        return {};
    }
    const subscores = {};
    for (const [key, subscore] of Object.entries(value)) {
        if (typeof subscore === "number" && Number.isFinite(subscore)) {
            subscores[key] = clampScore(subscore);
        }
    }
    return subscores;
}
function readJudge(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const kind = value.kind;
    if (kind !== "fixture" && kind !== "command" && kind !== "model" && kind !== "hybrid") {
        return undefined;
    }
    return {
        kind,
        ...(typeof value.model === "string" ? { model: value.model } : {}),
        ...(typeof value.version === "string" ? { version: value.version } : {}),
    };
}
function clampScore(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}
function fallbackFinalSummary(status) {
    if (status === "passed") {
        return "Eval-agent reported that the goal was satisfied.";
    }
    if (status === "review") {
        return "Eval-agent requested human review.";
    }
    if (status === "infra_failed") {
        return "Eval-agent did not produce a usable judgment.";
    }
    return "Eval-agent reported that the goal was not satisfied.";
}
function mean(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
function median(sortedValues) {
    if (sortedValues.length === 0) {
        return 0;
    }
    const midpoint = Math.floor(sortedValues.length / 2);
    const right = sortedValues[midpoint] ?? 0;
    if (sortedValues.length % 2 === 1) {
        return right;
    }
    return ((sortedValues[midpoint - 1] ?? right) + right) / 2;
}
function countBy(values) {
    const counts = {};
    for (const value of values) {
        counts[value] = (counts[value] ?? 0) + 1;
    }
    return counts;
}
function meanSubscores(summaries) {
    const dimensions = new Set(STANDARD_SUBSCORE_DIMENSIONS);
    for (const summary of summaries) {
        for (const dimension of Object.keys(summary.subscores)) {
            dimensions.add(dimension);
        }
    }
    const output = {};
    for (const dimension of dimensions) {
        const values = summaries
            .map((summary) => summary.subscores[dimension])
            .filter((value) => typeof value === "number");
        if (values.length > 0) {
            output[dimension] = mean(values);
        }
    }
    return output;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=results.js.map