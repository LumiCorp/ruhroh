import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
const BENCHMARK_CLAIM_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/benchmark-claim-v1.schema.json";
const BENCHMARK_SUMMARY_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/benchmark-summary-v1.schema.json";
const STANDARD_SUBSCORE_DIMENSIONS = [
    "functionality",
    "workflow",
    "buildRun",
    "persistence",
    "constraintCompliance",
    "evidenceQuality",
];
const REQUIRED_RESULT_ARTIFACT_PATHS = [
    "runManifest",
    "implementationRuns",
    "journey",
    "evalResult",
    "evalInput",
    "workspaceSummary",
    "workspaceTarball",
    "eventsTarball",
    "transcriptsTarball",
];
export function scoreForEvalStatus(status) {
    return status === "passed" ? 1 : 0;
}
export function discoverRuhrohRunResultPaths(inputPath) {
    const resolved = path.resolve(inputPath);
    if (!existsSync(resolved)) {
        throw new Error(`Path does not exist: ${resolved}`);
    }
    if (!statSync(resolved).isDirectory()) {
        return [resolved];
    }
    return walkRunResultFiles(resolved);
}
export function loadRuhrohRunResultArtifacts(inputPath) {
    return discoverRuhrohRunResultPaths(inputPath).map((resultPath) => readRuhrohRunResultArtifact(resultPath));
}
export function loadRuhrohRunResults(inputPath) {
    return loadRuhrohRunResultArtifacts(inputPath).map((artifact) => artifact.run);
}
export function buildRuhrohRunResultsReport(input) {
    const resultsPath = path.resolve(input.resultsPath);
    const artifacts = loadRuhrohRunResultArtifacts(resultsPath);
    const runs = artifacts.map((artifact) => artifact.run);
    const summaries = runs.map((run) => summarizeRuhrohRun(run));
    const groups = aggregateRuhrohRuns(runs, input.aggregate);
    const reviewQueue = summarizeRuhrohReviewQueue(summaries);
    const claimReadiness = summarizeRuhrohBenchmarkClaimReadiness(groups, {
        suiteId: input.suite?.id,
        suiteAdapterSummaries: input.suiteAdapterSummaries,
        pairwiseComparisons: input.pairwiseComparisons,
        runPlanWarnings: input.runPlanWarnings,
        artifactValidationErrors: input.artifactValidationErrors,
        artifactValidationWarnings: input.artifactValidationWarnings,
        reviewQueue,
    });
    const benchmarkClaim = summarizeRuhrohBenchmarkClaim(groups, {
        createdAt: input.createdAt,
        tool: input.tool,
        source: {
            ...input.source,
            resultsPath,
            resultArtifacts: artifacts.map((artifact) => benchmarkClaimResultArtifact(artifact)),
        },
        suite: input.suite,
        suiteAdapterSummaries: input.suiteAdapterSummaries,
        pairwiseComparisons: input.pairwiseComparisons,
        reviewQueue,
        claimReadiness,
        runPlanPresent: input.runPlanPresent,
        runPlanWarnings: input.runPlanWarnings,
        artifactValidationErrors: input.artifactValidationErrors,
        artifactValidationWarnings: input.artifactValidationWarnings,
    });
    return {
        version: "ruhroh_run_results_report_v1",
        source: {
            resultsPath,
            resultCount: artifacts.length,
        },
        artifacts,
        summaries,
        groups,
        reviewQueue,
        claimReadiness,
        benchmarkClaim,
        benchmarkSummary: summarizeRuhrohBenchmarkSummary(benchmarkClaim),
    };
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
    const judgeVotes = readJudgeVotes(raw.judgeVotes);
    if (judgeVotes.length > 0) {
        result.judgeVotes = judgeVotes;
        result.judgeAgreement = summarizeJudgeAgreement(judgeVotes);
    }
    return result;
}
export function assessRuhrohEvalQuality(evalResult) {
    const warnings = [];
    if (evalResult.status === "review") {
        warnings.push("eval requested human review");
    }
    if (evalResult.confidence === "low") {
        warnings.push("eval confidence is low");
    }
    if (evalResult.evidenceRefs.length === 0) {
        warnings.push("eval result has no top-level evidenceRefs");
    }
    if ((evalResult.criteriaResults ?? []).length === 0) {
        warnings.push("eval result has no criteriaResults");
    }
    for (const criterion of evalResult.criteriaResults ?? []) {
        if (criterion.evidenceRefs.length === 0 && criterion.status !== "not_applicable") {
            warnings.push(`criterion ${criterion.id} has no evidenceRefs`);
        }
    }
    if (evalResult.commandsRun.some((command) => command.exitCode !== 0)) {
        warnings.push("eval command evidence includes non-zero exit codes");
    }
    if (evalResult.judge === undefined) {
        warnings.push("eval result has no judge metadata");
    }
    else if ((evalResult.judge.kind === "model" || evalResult.judge.kind === "hybrid") && evalResult.judge.model === undefined) {
        warnings.push("model-backed eval judge is missing model metadata");
    }
    if (evalResult.judgeVotes !== undefined) {
        if (evalResult.judgeVotes.length < 2) {
            warnings.push("eval judgeVotes has fewer than 2 votes");
        }
        if (evalResult.judgeAgreement !== undefined && !evalResult.judgeAgreement.unanimous) {
            warnings.push("eval judgeVotes disagree; human review recommended");
        }
        if (evalResult.judgeAgreement?.majorityStatus !== undefined && evalResult.judgeAgreement.majorityStatus !== evalResult.status) {
            warnings.push(`eval status ${evalResult.status} differs from judge vote majority ${evalResult.judgeAgreement.majorityStatus}`);
        }
        for (const vote of evalResult.judgeVotes) {
            const label = formatJudgeVoteLabel(vote.judge);
            if (vote.evidenceRefs.length === 0) {
                warnings.push(`judge vote ${label} has no evidenceRefs`);
            }
            if ((vote.judge.kind === "model" || vote.judge.kind === "hybrid") && vote.judge.model === undefined) {
                warnings.push(`judge vote ${label} is missing model metadata`);
            }
        }
    }
    if (evalResult.finalSummary.trim().length < 20) {
        warnings.push("eval finalSummary is too terse for audit");
    }
    return [...new Set(warnings)];
}
export function assessRuhrohArtifactCompleteness(run) {
    const artifactPaths = run.artifactPaths ?? {};
    const warnings = REQUIRED_RESULT_ARTIFACT_PATHS.flatMap((key) => {
        const value = artifactPaths[key];
        return typeof value === "string" && value.trim().length > 0
            ? []
            : [`missing artifact path: ${key}`];
    });
    return [...new Set(warnings)];
}
export function inventoryRuhrohArtifacts(artifactPaths) {
    return Object.entries(artifactPaths)
        .filter(([, artifactPath]) => artifactPath.trim().length > 0)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, artifactPath]) => {
        if (!existsSync(artifactPath)) {
            return { name, path: artifactPath, available: false, error: "missing" };
        }
        try {
            const stat = statSync(artifactPath);
            if (!stat.isFile()) {
                return { name, path: artifactPath, available: false, error: "not_file" };
            }
            return {
                name,
                path: artifactPath,
                available: true,
                sizeBytes: stat.size,
                sha256: createHash("sha256").update(readFileSync(artifactPath)).digest("hex"),
            };
        }
        catch {
            return { name, path: artifactPath, available: false, error: "unreadable" };
        }
    });
}
export function summarizeRuhrohRun(run) {
    const evalResult = normalizeRuhrohEvalResult(run.evalResult);
    const evalQualityWarnings = assessRuhrohEvalQuality(evalResult);
    const artifactCompletenessWarnings = assessRuhrohArtifactCompleteness(run);
    const usage = readRunUsage(run.runManifest?.usage);
    const sample = run.runManifest?.sample;
    const artifactPaths = run.artifactPaths ?? evalResult.artifacts;
    return {
        scenarioId: run.scenarioId,
        ...((run.runId ?? run.runManifest?.runId) === undefined ? {} : { runId: run.runId ?? run.runManifest?.runId }),
        adapter: run.runAgentAdapterId || run.adapter,
        status: run.status,
        evalStatus: evalResult.status,
        failureBucket: run.failureBucket || run.failure_kind,
        score: run.score,
        iterationsUsed: run.implementationIterationsUsed || run.iterationsUsed,
        durationMs: run.duration_ms,
        finalSummary: evalResult.finalSummary,
        implementationTimeline: readImplementationTimeline(run.implementationRuns),
        unmetCriteria: evalResult.unmetCriteria,
        criteriaResults: evalResult.criteriaResults ?? [],
        evidenceRefs: evalResult.evidenceRefs,
        subscores: evalResult.subscores ?? {},
        commandsRun: evalResult.commandsRun,
        ...(evalResult.judge === undefined ? {} : { evalJudge: evalResult.judge }),
        evalJudgeVotes: evalResult.judgeVotes ?? [],
        ...(evalResult.judgeAgreement === undefined ? {} : { evalJudgeAgreement: evalResult.judgeAgreement }),
        artifactPaths,
        artifactInventory: inventoryRuhrohArtifacts(artifactPaths),
        artifactCompletenessWarnings,
        ...(usage === undefined ? {} : { usage }),
        ...(sample === undefined ? {} : { sample }),
        evalQualityWarnings,
        humanReviewRequired: evalResult.status === "review" || evalQualityWarnings.some((warning) => warning.includes("human review")),
        ...(run.runManifest === undefined ? {} : { runManifest: run.runManifest }),
    };
}
export function readImplementationTimeline(runs) {
    return runs.flatMap((run, index) => {
        const iteration = readPositiveInteger(run.iteration) ?? index + 1;
        const completionStatus = isRecord(run.completionStatus) ? run.completionStatus : {};
        const artifactPaths = readStringRecord(run.artifactPaths);
        return [{
                iteration,
                ...(typeof run.adapterId === "string" ? { adapterId: run.adapterId } : {}),
                status: typeof run.status === "string" ? run.status : "unknown",
                ...(typeof run.failureKind === "string" ? { failureKind: run.failureKind } : {}),
                ...(typeof completionStatus.state === "string" ? { completionState: completionStatus.state } : {}),
                ...(typeof run.stopReason === "string"
                    ? { stopReason: run.stopReason }
                    : typeof completionStatus.reason === "string" ? { stopReason: completionStatus.reason } : {}),
                ...(typeof run.runId === "string" ? { runId: run.runId } : {}),
                ...(typeof run.transcriptPath === "string" ? { transcriptPath: run.transcriptPath } : {}),
                ...(typeof run.eventLogPath === "string" ? { eventLogPath: run.eventLogPath } : {}),
                artifactPaths,
                ...(typeof run.notes === "string" && run.notes.trim().length > 0 ? { notes: truncateTimelineNotes(run.notes) } : {}),
            }];
    });
}
export function aggregateRuhrohRuns(runs, options = {}) {
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
        const scores = summaries.map((summary) => summary.score);
        const passes = summaries.filter((summary) => summary.score === 1).length;
        const cohort = aggregateCohort(summaries);
        return {
            scenarioId: first.scenarioId,
            adapter: first.adapter,
            cohort,
            runs: summaries.length,
            passes,
            passRate: passes / summaries.length,
            passRateCi95: wilsonConfidenceInterval(passes, summaries.length),
            passAtK: passAtKValues(passes, summaries.length),
            meanScore: mean(scores),
            meanScoreCi95: bootstrapMeanConfidenceInterval(scores, `${first.scenarioId}/${first.adapter}`),
            meanSubscores: meanSubscores(summaries),
            medianDurationMs: median(durations),
            iterationDistribution: countBy(summaries.map((summary) => String(summary.iterationsUsed))),
            failureBuckets: countBy(summaries.map((summary) => summary.failureBucket || "unknown")),
            reviewRequired: summaries.filter((summary) => summary.humanReviewRequired).length,
            evalQualityWarnings: countBy(summaries.flatMap((summary) => summary.evalQualityWarnings)),
            artifactCompletenessWarnings: countBy(summaries.flatMap((summary) => summary.artifactCompletenessWarnings)),
            usage: aggregateUsage(summaries, passes),
            statisticalWarnings: [
                ...statisticalWarnings(summaries.length, options.minRuns),
                ...cohort.comparabilityWarnings,
                ...suiteScenarioVersionWarnings(first.scenarioId, cohort, options.expectedScenarioVersions),
            ],
        };
    }).sort((left, right) => left.scenarioId.localeCompare(right.scenarioId) || left.adapter.localeCompare(right.adapter));
}
export function summarizeRuhrohPairwiseAdapterComparisons(groups, options = {}) {
    const minRuns = options.minRuns ?? 5;
    const byScenario = new Map();
    for (const group of groups) {
        byScenario.set(group.scenarioId, [...(byScenario.get(group.scenarioId) ?? []), group]);
    }
    return [...byScenario.entries()].flatMap(([scenarioId, scenarioGroups]) => {
        const sortedGroups = [...scenarioGroups].sort((left, right) => left.adapter.localeCompare(right.adapter));
        const comparisons = [];
        for (let baselineIndex = 0; baselineIndex < sortedGroups.length; baselineIndex += 1) {
            for (let contenderIndex = baselineIndex + 1; contenderIndex < sortedGroups.length; contenderIndex += 1) {
                const baseline = sortedGroups[baselineIndex];
                const contender = sortedGroups[contenderIndex];
                if (baseline === undefined || contender === undefined) {
                    continue;
                }
                const delta = contender.passRate - baseline.passRate;
                const interval = passRateDeltaConfidenceInterval({
                    baselinePassRate: baseline.passRate,
                    baselineRuns: baseline.runs,
                    contenderPassRate: contender.passRate,
                    contenderRuns: contender.runs,
                    delta,
                });
                const significance = pairwiseSignificance({
                    baselinePasses: baseline.passes,
                    baselineRuns: baseline.runs,
                    contenderPasses: contender.passes,
                    contenderRuns: contender.runs,
                });
                comparisons.push({
                    scenarioId,
                    baselineAdapter: baseline.adapter,
                    contenderAdapter: contender.adapter,
                    baselineRuns: baseline.runs,
                    contenderRuns: contender.runs,
                    baselinePasses: baseline.passes,
                    contenderPasses: contender.passes,
                    baselinePassRate: baseline.passRate,
                    contenderPassRate: contender.passRate,
                    passRateDelta: delta,
                    passRateDeltaCi95: interval,
                    significance,
                    conclusion: pairwiseConclusion(interval),
                    warnings: pairwiseWarnings(baseline, contender, interval, significance, minRuns),
                });
            }
        }
        return comparisons;
    }).sort((left, right) => left.scenarioId.localeCompare(right.scenarioId)
        || left.baselineAdapter.localeCompare(right.baselineAdapter)
        || left.contenderAdapter.localeCompare(right.contenderAdapter));
}
export function summarizeRuhrohSuiteAdapters(groups, options) {
    const adapters = uniqueSorted(groups.map((group) => group.adapter));
    return adapters.map((adapter) => {
        const adapterGroups = groups.filter((group) => group.adapter === adapter);
        const byScenario = new Map(adapterGroups.map((group) => [group.scenarioId, group]));
        const missingScenarioIds = options.scenarioIds.filter((scenarioId) => !byScenario.has(scenarioId));
        const runs = adapterGroups.reduce((total, group) => total + group.runs, 0);
        const passes = adapterGroups.reduce((total, group) => total + group.passes, 0);
        const scenarioRuns = Object.fromEntries(options.scenarioIds.flatMap((scenarioId) => {
            const group = byScenario.get(scenarioId);
            return group === undefined ? [] : [[scenarioId, group.runs]];
        }));
        const lowRunScenarios = options.scenarioIds.flatMap((scenarioId) => {
            const group = byScenario.get(scenarioId);
            return group !== undefined && group.runs < options.minRuns ? [`${scenarioId} has ${group.runs}/${options.minRuns} required runs`] : [];
        });
        const warnings = [
            ...missingScenarioIds.map((scenarioId) => `missing suite scenario: ${scenarioId}`),
            ...lowRunScenarios,
            ...(adapterGroups.some((group) => group.statisticalWarnings.length > 0) ? ["scenario-level warnings present"] : []),
        ];
        return {
            adapter,
            expectedScenarios: options.scenarioIds.length,
            coveredScenarios: adapterGroups.length,
            missingScenarioIds,
            runs,
            passes,
            runWeightedPassRate: runs === 0 ? 0 : passes / runs,
            runWeightedPassRateCi95: wilsonConfidenceInterval(passes, runs),
            meanScenarioPassRate: adapterGroups.length === 0 ? 0 : mean(adapterGroups.map((group) => group.passRate)),
            scenarioRuns,
            minRunsSatisfied: missingScenarioIds.length === 0 && lowRunScenarios.length === 0,
            warnings,
        };
    }).sort((left, right) => Number(right.minRunsSatisfied) - Number(left.minRunsSatisfied)
        || right.meanScenarioPassRate - left.meanScenarioPassRate
        || right.runWeightedPassRate - left.runWeightedPassRate
        || left.adapter.localeCompare(right.adapter));
}
export function summarizeRuhrohReviewQueue(summaries) {
    return summaries.flatMap((summary) => {
        const reasons = reviewReasons(summary);
        if (reasons.length === 0) {
            return [];
        }
        const item = {
            scenarioId: summary.scenarioId,
            adapter: summary.adapter,
            ...(summary.runId === undefined ? {} : { runId: summary.runId }),
            status: summary.status,
            evalStatus: summary.evalStatus,
            score: summary.score,
            failureBucket: summary.failureBucket,
            priority: summary.humanReviewRequired || summary.evalStatus === "review" || summary.evalStatus === "infra_failed" ? "required" : "recommended",
            reasons,
            evalQualityWarnings: summary.evalQualityWarnings,
            artifactCompletenessWarnings: summary.artifactCompletenessWarnings,
            unmetCriteria: summary.unmetCriteria,
            finalSummary: summary.finalSummary,
            artifactPaths: summary.artifactPaths,
            transcriptPaths: uniqueSorted(summary.implementationTimeline.flatMap((step) => step.transcriptPath === undefined ? [] : [step.transcriptPath])),
            eventLogPaths: uniqueSorted(summary.implementationTimeline.flatMap((step) => step.eventLogPath === undefined ? [] : [step.eventLogPath])),
        };
        return [item];
    }).sort((left, right) => reviewPriorityRank(right.priority) - reviewPriorityRank(left.priority)
        || left.scenarioId.localeCompare(right.scenarioId)
        || left.adapter.localeCompare(right.adapter)
        || (left.runId ?? "").localeCompare(right.runId ?? ""));
}
export function summarizeRuhrohBenchmarkClaimReadiness(groups, options = {}) {
    const blockers = [];
    const advisories = [];
    if (groups.length === 0) {
        blockers.push("no aggregate result groups available");
    }
    if (options.suiteId === undefined) {
        blockers.push("no suite selected; use compare --suite for publishable benchmark claims");
    }
    for (const warning of options.suiteWarnings ?? []) {
        blockers.push(`suite warning: ${warning}`);
    }
    for (const warning of options.runPlanWarnings ?? []) {
        blockers.push(`run plan warning: ${warning}`);
    }
    if ((options.artifactValidationErrors ?? 0) > 0) {
        blockers.push(`artifact validation failed: ${options.artifactValidationErrors} error(s)`);
    }
    if ((options.artifactValidationWarnings ?? 0) > 0) {
        advisories.push(`artifact validation warnings present: ${options.artifactValidationWarnings}`);
    }
    for (const summary of options.suiteAdapterSummaries ?? []) {
        if (!summary.minRunsSatisfied) {
            blockers.push(`${summary.adapter}: suite minimum runs or scenario coverage not satisfied`);
        }
        for (const missingScenarioId of summary.missingScenarioIds) {
            blockers.push(`${summary.adapter}: missing suite scenario ${missingScenarioId}`);
        }
        for (const warning of summary.warnings) {
            advisories.push(`${summary.adapter}: ${warning}`);
        }
    }
    for (const group of groups) {
        for (const warning of group.statisticalWarnings) {
            blockers.push(`${group.scenarioId}/${group.adapter}: ${warning}`);
        }
        const evalQualityWarningEntries = Object.entries(group.evalQualityWarnings)
            .filter(([, count]) => count > 0);
        if (evalQualityWarningEntries.length > 0) {
            blockers.push(`${group.scenarioId}/${group.adapter}: eval-quality warnings present`);
            for (const [warning, count] of evalQualityWarningEntries) {
                advisories.push(`${group.scenarioId}/${group.adapter}: ${warning} (${count})`);
            }
        }
        if (group.reviewRequired > 0) {
            blockers.push(`${group.scenarioId}/${group.adapter}: ${group.reviewRequired} run(s) require human review`);
        }
        const artifactWarningEntries = Object.entries(group.artifactCompletenessWarnings)
            .filter(([, count]) => count > 0);
        if (artifactWarningEntries.length > 0) {
            blockers.push(`${group.scenarioId}/${group.adapter}: artifact-completeness warnings present`);
            for (const [warning, count] of artifactWarningEntries) {
                advisories.push(`${group.scenarioId}/${group.adapter}: ${warning} (${count})`);
            }
        }
    }
    for (const comparison of options.pairwiseComparisons ?? []) {
        for (const warning of comparison.warnings) {
            blockers.push(`${comparison.scenarioId}/${comparison.contenderAdapter} vs ${comparison.baselineAdapter}: ${warning}`);
        }
    }
    for (const item of options.reviewQueue ?? []) {
        const label = `${item.scenarioId}/${item.adapter}${item.runId === undefined ? "" : `/${item.runId}`}`;
        if (item.priority === "required") {
            blockers.push(`${label}: review required`);
        }
        else {
            advisories.push(`${label}: review recommended`);
        }
    }
    const uniqueBlockers = uniquePreserveOrder(blockers);
    return {
        scope: options.suiteId === undefined ? "ad_hoc_compare" : "suite",
        publishable: uniqueBlockers.length === 0,
        blockers: uniqueBlockers,
        advisories: uniquePreserveOrder(advisories),
    };
}
export function summarizeRuhrohBenchmarkClaim(groups, options) {
    const totalRuns = groups.reduce((total, group) => total + group.runs, 0);
    const totalPasses = groups.reduce((total, group) => total + group.passes, 0);
    const reviewQueue = options.reviewQueue ?? [];
    const pairwiseComparisons = [...(options.pairwiseComparisons ?? [])];
    return {
        $schema: BENCHMARK_CLAIM_SCHEMA_URL,
        version: "ruhroh_benchmark_claim_v1",
        createdAt: options.createdAt ?? new Date().toISOString(),
        tool: options.tool ?? { name: "ruhroh" },
        ...(options.source === undefined ? {} : { source: compactBenchmarkClaimSource(options.source) }),
        scope: options.claimReadiness.scope,
        publishable: options.claimReadiness.publishable,
        ...(options.suite === undefined ? {} : { suite: options.suite }),
        methodology: {
            confidenceLevel: 0.95,
            statisticalMethods: [
                "wilson_pass_rate_ci",
                "normal_approximation_pass_rate_delta_ci",
                "fisher_exact_two_sided",
                "pass_at_k",
                "bootstrap_mean_score_ci",
            ],
            ...(options.suite?.minRuns === undefined ? {} : { minRuns: options.suite.minRuns }),
            ...(options.suite?.retryPolicy === undefined ? {} : { retryPolicy: options.suite.retryPolicy }),
        },
        summary: {
            scenarioCount: uniqueSorted(groups.map((group) => group.scenarioId)).length,
            adapterCount: uniqueSorted(groups.map((group) => group.adapter)).length,
            totalRuns,
            totalPasses,
            runWeightedPassRate: totalRuns === 0 ? 0 : totalPasses / totalRuns,
            runWeightedPassRateCi95: wilsonConfidenceInterval(totalPasses, totalRuns),
            reviewRequired: reviewQueue.filter((item) => item.priority === "required").length,
            reviewRecommended: reviewQueue.filter((item) => item.priority === "recommended").length,
            pairwiseComparisonCount: pairwiseComparisons.length,
        },
        adapterSummaries: benchmarkClaimAdapterSummaries(groups, options.suiteAdapterSummaries),
        ...(options.suiteAdapterSummaries === undefined ? {} : { suiteCoverage: benchmarkClaimSuiteCoverage(options.suiteAdapterSummaries) }),
        scenarioResults: groups.map((group) => ({
            scenarioId: group.scenarioId,
            adapter: group.adapter,
            runs: group.runs,
            passes: group.passes,
            passRate: group.passRate,
            passRateCi95: group.passRateCi95,
            passAtK: group.passAtK,
            meanScore: group.meanScore,
            meanScoreCi95: group.meanScoreCi95,
            usage: copyAggregateUsage(group.usage),
            reviewRequired: group.reviewRequired,
            statisticalWarnings: group.statisticalWarnings,
        })),
        pairwiseComparisons,
        readiness: options.claimReadiness,
        evidence: {
            runPlanPresent: options.runPlanPresent ?? false,
            runPlanWarnings: [...(options.runPlanWarnings ?? [])],
            artifactValidationErrors: options.artifactValidationErrors ?? 0,
            artifactValidationWarnings: options.artifactValidationWarnings ?? 0,
            artifactCompletenessWarnings: artifactCompletenessWarningCount(groups),
            reviewQueueItems: reviewQueue.length,
            requiredReviewItems: reviewQueue.filter((item) => item.priority === "required").length,
            recommendedReviewItems: reviewQueue.filter((item) => item.priority === "recommended").length,
        },
    };
}
export function summarizeRuhrohBenchmarkSummary(claim) {
    const suiteId = claim.suite?.id;
    const suiteVersion = claim.suite?.suiteVersion;
    return {
        $schema: BENCHMARK_SUMMARY_SCHEMA_URL,
        version: "ruhroh_benchmark_summary_v1",
        createdAt: claim.createdAt,
        claimVersion: claim.version,
        tool: { ...claim.tool },
        ...(claim.source === undefined ? {} : { source: compactBenchmarkClaimSource(claim.source) }),
        scope: claim.scope,
        publishable: claim.publishable,
        ...(claim.suite === undefined ? {} : { suite: { ...claim.suite, scenarioIds: [...claim.suite.scenarioIds], scenarioVersions: { ...claim.suite.scenarioVersions } } }),
        summary: { ...claim.summary, runWeightedPassRateCi95: { ...claim.summary.runWeightedPassRateCi95 } },
        readiness: {
            scope: claim.readiness.scope,
            publishable: claim.readiness.publishable,
            blockers: [...claim.readiness.blockers],
            advisories: [...claim.readiness.advisories],
        },
        evidence: {
            ...claim.evidence,
            runPlanWarnings: [...claim.evidence.runPlanWarnings],
        },
        rows: claim.scenarioResults.map((result) => ({
            ...(suiteId === undefined ? {} : { suiteId }),
            ...(suiteVersion === undefined ? {} : { suiteVersion }),
            scope: claim.scope,
            publishable: claim.publishable,
            scenarioId: result.scenarioId,
            adapter: result.adapter,
            runs: result.runs,
            passes: result.passes,
            passRate: result.passRate,
            passRateCi95: { ...result.passRateCi95 },
            passAtK: { ...result.passAtK },
            meanScore: result.meanScore,
            meanScoreCi95: { ...result.meanScoreCi95 },
            usage: copyAggregateUsage(result.usage),
            reviewRequired: result.reviewRequired,
            statisticalWarnings: [...result.statisticalWarnings],
        })),
    };
}
export function validateRuhrohBenchmarkClaim(input) {
    const errors = [];
    const warnings = [];
    if (!isRecord(input)) {
        return {
            version: "ruhroh_benchmark_claim_validation_v1",
            errors: ["claim must be an object"],
            warnings,
        };
    }
    if (input.version !== "ruhroh_benchmark_claim_v1") {
        errors.push("version must be ruhroh_benchmark_claim_v1");
    }
    requireNonEmptyString(input, "createdAt", errors);
    const tool = requireRecordField(input, "tool", errors);
    if (tool !== undefined) {
        requireNonEmptyString(tool, "name", errors, "tool.name");
    }
    const scope = input.scope;
    if (scope !== "suite" && scope !== "ad_hoc_compare") {
        errors.push("scope must be suite or ad_hoc_compare");
    }
    if (typeof input.publishable !== "boolean") {
        errors.push("publishable must be boolean");
    }
    const suite = optionalRecordField(input, "suite", errors);
    if (scope === "suite" && suite === undefined) {
        errors.push("suite claims must include suite");
    }
    if (scope === "ad_hoc_compare" && suite !== undefined) {
        warnings.push("ad_hoc_compare claim includes suite metadata");
    }
    if (suite !== undefined) {
        validateClaimSuiteSummary(suite, errors);
    }
    const methodology = requireRecordField(input, "methodology", errors);
    if (methodology !== undefined) {
        if (methodology.confidenceLevel !== 0.95) {
            errors.push("methodology.confidenceLevel must be 0.95");
        }
        const methods = requireStringArrayField(methodology, "statisticalMethods", errors, "methodology.statisticalMethods");
        for (const method of ["wilson_pass_rate_ci", "normal_approximation_pass_rate_delta_ci", "fisher_exact_two_sided", "pass_at_k", "bootstrap_mean_score_ci"]) {
            if (!methods.includes(method)) {
                errors.push(`methodology.statisticalMethods must include ${method}`);
            }
        }
        validateOptionalPositiveNumber(methodology, "minRuns", errors, "methodology.minRuns");
        requireOptionalNonEmptyString(methodology, "retryPolicy", errors, "methodology.retryPolicy");
    }
    const summary = requireRecordField(input, "summary", errors);
    if (summary !== undefined) {
        for (const field of ["scenarioCount", "adapterCount", "totalRuns", "totalPasses", "reviewRequired", "reviewRecommended", "pairwiseComparisonCount"]) {
            validateNonNegativeNumber(summary, field, errors, `summary.${field}`);
        }
        validateRateNumber(summary, "runWeightedPassRate", errors, "summary.runWeightedPassRate");
        validateConfidenceInterval(optionalRecordField(summary, "runWeightedPassRateCi95", errors, "summary.runWeightedPassRateCi95"), errors, "summary.runWeightedPassRateCi95");
    }
    const adapterSummaries = requireRecordArrayField(input, "adapterSummaries", errors);
    for (const [index, adapterSummary] of adapterSummaries.entries()) {
        validateClaimAdapterSummary(adapterSummary, errors, `adapterSummaries[${index}]`);
    }
    const suiteCoverage = optionalRecordField(input, "suiteCoverage", errors);
    if (scope === "suite" && suiteCoverage === undefined) {
        errors.push("suite claims must include suiteCoverage");
    }
    if (suiteCoverage !== undefined) {
        validateClaimSuiteCoverage(suiteCoverage, suite, errors);
    }
    const scenarioResults = requireRecordArrayField(input, "scenarioResults", errors);
    for (const [index, scenarioResult] of scenarioResults.entries()) {
        validateClaimScenarioResult(scenarioResult, errors, `scenarioResults[${index}]`);
    }
    if (scenarioResults.length === 0) {
        errors.push("scenarioResults must include at least one result");
    }
    const pairwiseComparisons = input.pairwiseComparisons;
    if (!Array.isArray(pairwiseComparisons)) {
        errors.push("pairwiseComparisons must be an array");
    }
    const readiness = requireRecordField(input, "readiness", errors);
    if (readiness !== undefined) {
        validateClaimReadiness(readiness, input, errors);
    }
    const evidence = requireRecordField(input, "evidence", errors);
    if (evidence !== undefined) {
        validateClaimEvidence(evidence, errors);
    }
    return {
        version: "ruhroh_benchmark_claim_validation_v1",
        errors: uniquePreserveOrder(errors),
        warnings: uniquePreserveOrder(warnings),
    };
}
export function validateRuhrohBenchmarkSummary(input) {
    const errors = [];
    const warnings = [];
    if (!isRecord(input)) {
        return {
            version: "ruhroh_benchmark_summary_validation_v1",
            errors: ["summary must be an object"],
            warnings,
        };
    }
    if (input.$schema !== undefined && input.$schema !== BENCHMARK_SUMMARY_SCHEMA_URL) {
        warnings.push("summary $schema does not match Ruhroh benchmark summary schema URL");
    }
    if (input.version !== "ruhroh_benchmark_summary_v1") {
        errors.push("version must be ruhroh_benchmark_summary_v1");
    }
    if (input.claimVersion !== "ruhroh_benchmark_claim_v1") {
        errors.push("claimVersion must be ruhroh_benchmark_claim_v1");
    }
    requireNonEmptyString(input, "createdAt", errors);
    const tool = requireRecordField(input, "tool", errors);
    if (tool !== undefined) {
        requireNonEmptyString(tool, "name", errors, "tool.name");
    }
    const scope = input.scope;
    if (scope !== "suite" && scope !== "ad_hoc_compare") {
        errors.push("scope must be suite or ad_hoc_compare");
    }
    if (typeof input.publishable !== "boolean") {
        errors.push("publishable must be boolean");
    }
    const suite = optionalRecordField(input, "suite", errors);
    if (scope === "suite" && suite === undefined) {
        errors.push("suite summaries must include suite");
    }
    if (scope === "ad_hoc_compare" && suite !== undefined) {
        warnings.push("ad_hoc_compare summary includes suite metadata");
    }
    if (suite !== undefined) {
        validateClaimSuiteSummary(suite, errors);
    }
    const summary = requireRecordField(input, "summary", errors);
    if (summary !== undefined) {
        for (const field of ["scenarioCount", "adapterCount", "totalRuns", "totalPasses", "reviewRequired", "reviewRecommended", "pairwiseComparisonCount"]) {
            validateNonNegativeNumber(summary, field, errors, `summary.${field}`);
        }
        validateRateNumber(summary, "runWeightedPassRate", errors, "summary.runWeightedPassRate");
        validateConfidenceInterval(optionalRecordField(summary, "runWeightedPassRateCi95", errors, "summary.runWeightedPassRateCi95"), errors, "summary.runWeightedPassRateCi95");
    }
    const readiness = requireRecordField(input, "readiness", errors);
    if (readiness !== undefined) {
        validateClaimReadiness(readiness, input, errors);
    }
    const evidence = requireRecordField(input, "evidence", errors);
    if (evidence !== undefined) {
        validateClaimEvidence(evidence, errors);
    }
    const rows = requireRecordArrayField(input, "rows", errors);
    if (rows.length === 0) {
        errors.push("rows must include at least one summary row");
    }
    for (const [index, row] of rows.entries()) {
        validateBenchmarkSummaryRow(row, input, suite, errors, `rows[${index}]`);
    }
    validateBenchmarkSummaryTotals(summary, rows, errors);
    return {
        version: "ruhroh_benchmark_summary_validation_v1",
        errors: uniquePreserveOrder(errors),
        warnings: uniquePreserveOrder(warnings),
    };
}
function benchmarkClaimSuiteCoverage(suiteAdapterSummaries) {
    const expectedScenarios = Math.max(0, ...suiteAdapterSummaries.map((summary) => summary.expectedScenarios));
    const missingScenarioIds = uniqueSorted(suiteAdapterSummaries.flatMap((summary) => summary.missingScenarioIds));
    return {
        expectedScenarios,
        coveredScenarios: Math.max(0, expectedScenarios - missingScenarioIds.length),
        missingScenarioIds,
        minRunsSatisfied: suiteAdapterSummaries.length > 0 && suiteAdapterSummaries.every((summary) => summary.minRunsSatisfied),
        adapters: suiteAdapterSummaries.map((summary) => ({
            adapter: summary.adapter,
            expectedScenarios: summary.expectedScenarios,
            coveredScenarios: summary.coveredScenarios,
            missingScenarioIds: [...summary.missingScenarioIds],
            scenarioRuns: { ...summary.scenarioRuns },
            minRunsSatisfied: summary.minRunsSatisfied,
            warnings: [...summary.warnings],
        })),
    };
}
function validateClaimSuiteSummary(suite, errors) {
    requireNonEmptyString(suite, "id", errors, "suite.id");
    requireNonEmptyString(suite, "title", errors, "suite.title");
    requireNonEmptyString(suite, "suiteVersion", errors, "suite.suiteVersion");
    requireStringArrayField(suite, "scenarioIds", errors, "suite.scenarioIds");
    const scenarioVersions = requireRecordField(suite, "scenarioVersions", errors, "suite.scenarioVersions");
    if (scenarioVersions !== undefined) {
        for (const [scenarioId, scenarioVersion] of Object.entries(scenarioVersions)) {
            if (typeof scenarioVersion !== "string" || scenarioVersion.trim().length === 0) {
                errors.push(`suite.scenarioVersions.${scenarioId} must be non-empty string`);
            }
        }
    }
    validatePositiveNumber(suite, "minRuns", errors, "suite.minRuns");
    requireNonEmptyString(suite, "retryPolicy", errors, "suite.retryPolicy");
}
function validateBenchmarkSummaryRow(row, summary, suite, errors, pathLabel) {
    requireNonEmptyString(row, "scenarioId", errors, `${pathLabel}.scenarioId`);
    requireNonEmptyString(row, "adapter", errors, `${pathLabel}.adapter`);
    for (const field of ["runs", "passes", "reviewRequired"]) {
        validateNonNegativeNumber(row, field, errors, `${pathLabel}.${field}`);
    }
    validateRateNumber(row, "passRate", errors, `${pathLabel}.passRate`);
    validateConfidenceInterval(optionalRecordField(row, "passRateCi95", errors, `${pathLabel}.passRateCi95`), errors, `${pathLabel}.passRateCi95`);
    const passAtK = requireRecordField(row, "passAtK", errors, `${pathLabel}.passAtK`);
    if (passAtK !== undefined) {
        for (const [key, value] of Object.entries(passAtK)) {
            if (!/^pass@\d+$/u.test(key)) {
                errors.push(`${pathLabel}.passAtK contains unsupported key: ${key}`);
            }
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
                errors.push(`${pathLabel}.passAtK.${key} must be a rate between 0 and 1`);
            }
        }
    }
    validateRateNumber(row, "meanScore", errors, `${pathLabel}.meanScore`);
    validateConfidenceInterval(optionalRecordField(row, "meanScoreCi95", errors, `${pathLabel}.meanScoreCi95`), errors, `${pathLabel}.meanScoreCi95`);
    validateAggregateUsage(requireRecordField(row, "usage", errors, `${pathLabel}.usage`), errors, `${pathLabel}.usage`);
    requireStringArrayField(row, "statisticalWarnings", errors, `${pathLabel}.statisticalWarnings`);
    if (row.scope !== summary.scope) {
        errors.push(`${pathLabel}.scope must match summary scope`);
    }
    if (row.publishable !== summary.publishable) {
        errors.push(`${pathLabel}.publishable must match summary publishable`);
    }
    if (typeof row.runs === "number" && typeof row.passes === "number" && row.passes > row.runs) {
        errors.push(`${pathLabel}.passes must be <= ${pathLabel}.runs`);
    }
    if (typeof row.runs === "number" && typeof row.passes === "number" && typeof row.passRate === "number" && row.runs > 0) {
        const expectedPassRate = row.passes / row.runs;
        if (Math.abs(row.passRate - expectedPassRate) > 0.000001) {
            errors.push(`${pathLabel}.passRate must equal passes / runs`);
        }
    }
    if (suite !== undefined) {
        if (row.suiteId !== suite.id) {
            errors.push(`${pathLabel}.suiteId must match suite.id`);
        }
        if (row.suiteVersion !== suite.suiteVersion) {
            errors.push(`${pathLabel}.suiteVersion must match suite.suiteVersion`);
        }
    }
    else {
        if (row.suiteId !== undefined) {
            errors.push(`${pathLabel}.suiteId is only allowed for suite summaries`);
        }
        if (row.suiteVersion !== undefined) {
            errors.push(`${pathLabel}.suiteVersion is only allowed for suite summaries`);
        }
    }
}
function validateBenchmarkSummaryTotals(summary, rows, errors) {
    if (summary === undefined || rows.length === 0) {
        return;
    }
    const scenarioCount = new Set(rows.flatMap((row) => typeof row.scenarioId === "string" ? [row.scenarioId] : [])).size;
    const adapterCount = new Set(rows.flatMap((row) => typeof row.adapter === "string" ? [row.adapter] : [])).size;
    const totalRuns = sumNumericField(rows, "runs");
    const totalPasses = sumNumericField(rows, "passes");
    const reviewRequired = sumNumericField(rows, "reviewRequired");
    assertNumericSummaryTotal(summary, "scenarioCount", scenarioCount, errors);
    assertNumericSummaryTotal(summary, "adapterCount", adapterCount, errors);
    assertNumericSummaryTotal(summary, "totalRuns", totalRuns, errors);
    assertNumericSummaryTotal(summary, "totalPasses", totalPasses, errors);
    assertNumericSummaryTotal(summary, "reviewRequired", reviewRequired, errors);
    if (typeof summary.runWeightedPassRate === "number" && totalRuns > 0) {
        const expectedPassRate = totalPasses / totalRuns;
        if (Math.abs(summary.runWeightedPassRate - expectedPassRate) > 0.000001) {
            errors.push("summary.runWeightedPassRate must equal totalPasses / totalRuns");
        }
    }
}
function sumNumericField(rows, field) {
    return rows.reduce((total, row) => total + (typeof row[field] === "number" && Number.isFinite(row[field]) ? row[field] : 0), 0);
}
function assertNumericSummaryTotal(summary, field, expected, errors) {
    if (typeof summary[field] === "number" && Number.isFinite(summary[field]) && summary[field] !== expected) {
        errors.push(`summary.${field} must match rows (${expected})`);
    }
}
function validateClaimAdapterSummary(adapterSummary, errors, pathLabel) {
    requireNonEmptyString(adapterSummary, "adapter", errors, `${pathLabel}.adapter`);
    for (const field of ["scenarioCount", "runs", "passes"]) {
        validateNonNegativeNumber(adapterSummary, field, errors, `${pathLabel}.${field}`);
    }
    validateRateNumber(adapterSummary, "runWeightedPassRate", errors, `${pathLabel}.runWeightedPassRate`);
    validateConfidenceInterval(optionalRecordField(adapterSummary, "runWeightedPassRateCi95", errors, `${pathLabel}.runWeightedPassRateCi95`), errors, `${pathLabel}.runWeightedPassRateCi95`);
    validateRateNumber(adapterSummary, "meanScenarioPassRate", errors, `${pathLabel}.meanScenarioPassRate`);
    validateAggregateUsage(requireRecordField(adapterSummary, "usage", errors, `${pathLabel}.usage`), errors, `${pathLabel}.usage`);
    if (adapterSummary.minRunsSatisfied !== undefined && typeof adapterSummary.minRunsSatisfied !== "boolean") {
        errors.push(`${pathLabel}.minRunsSatisfied must be boolean`);
    }
    requireStringArrayField(adapterSummary, "warnings", errors, `${pathLabel}.warnings`);
}
function validateClaimSuiteCoverage(suiteCoverage, suite, errors) {
    validateNonNegativeNumber(suiteCoverage, "expectedScenarios", errors, "suiteCoverage.expectedScenarios");
    validateNonNegativeNumber(suiteCoverage, "coveredScenarios", errors, "suiteCoverage.coveredScenarios");
    const missingScenarioIds = requireStringArrayField(suiteCoverage, "missingScenarioIds", errors, "suiteCoverage.missingScenarioIds");
    if (typeof suiteCoverage.minRunsSatisfied !== "boolean") {
        errors.push("suiteCoverage.minRunsSatisfied must be boolean");
    }
    const adapters = requireRecordArrayField(suiteCoverage, "adapters", errors, "suiteCoverage.adapters");
    if (suite !== undefined && Array.isArray(suite.scenarioIds) && typeof suiteCoverage.expectedScenarios === "number" && suiteCoverage.expectedScenarios !== suite.scenarioIds.length) {
        errors.push("suiteCoverage.expectedScenarios must match suite.scenarioIds length");
    }
    const suiteScenarioIds = Array.isArray(suite?.scenarioIds)
        ? new Set(suite.scenarioIds.filter((scenarioId) => typeof scenarioId === "string"))
        : undefined;
    if (suiteScenarioIds !== undefined) {
        for (const missingScenarioId of missingScenarioIds) {
            if (!suiteScenarioIds.has(missingScenarioId)) {
                errors.push(`suiteCoverage.missingScenarioIds contains non-suite scenario: ${missingScenarioId}`);
            }
        }
    }
    for (const [index, adapter] of adapters.entries()) {
        const pathLabel = `suiteCoverage.adapters[${index}]`;
        requireNonEmptyString(adapter, "adapter", errors, `${pathLabel}.adapter`);
        validateNonNegativeNumber(adapter, "expectedScenarios", errors, `${pathLabel}.expectedScenarios`);
        validateNonNegativeNumber(adapter, "coveredScenarios", errors, `${pathLabel}.coveredScenarios`);
        requireStringArrayField(adapter, "missingScenarioIds", errors, `${pathLabel}.missingScenarioIds`);
        const scenarioRuns = requireRecordField(adapter, "scenarioRuns", errors, `${pathLabel}.scenarioRuns`);
        if (scenarioRuns !== undefined) {
            for (const [scenarioId, runs] of Object.entries(scenarioRuns)) {
                if (typeof runs !== "number" || !Number.isFinite(runs) || runs < 0) {
                    errors.push(`${pathLabel}.scenarioRuns.${scenarioId} must be non-negative number`);
                }
            }
        }
        if (typeof adapter.minRunsSatisfied !== "boolean") {
            errors.push(`${pathLabel}.minRunsSatisfied must be boolean`);
        }
        requireStringArrayField(adapter, "warnings", errors, `${pathLabel}.warnings`);
    }
}
function validateClaimScenarioResult(scenarioResult, errors, pathLabel) {
    requireNonEmptyString(scenarioResult, "scenarioId", errors, `${pathLabel}.scenarioId`);
    requireNonEmptyString(scenarioResult, "adapter", errors, `${pathLabel}.adapter`);
    for (const field of ["runs", "passes", "reviewRequired"]) {
        validateNonNegativeNumber(scenarioResult, field, errors, `${pathLabel}.${field}`);
    }
    validateRateNumber(scenarioResult, "passRate", errors, `${pathLabel}.passRate`);
    validateConfidenceInterval(optionalRecordField(scenarioResult, "passRateCi95", errors, `${pathLabel}.passRateCi95`), errors, `${pathLabel}.passRateCi95`);
    const passAtK = requireRecordField(scenarioResult, "passAtK", errors, `${pathLabel}.passAtK`);
    if (passAtK !== undefined) {
        for (const [key, value] of Object.entries(passAtK)) {
            if (!/^pass@\d+$/u.test(key)) {
                errors.push(`${pathLabel}.passAtK contains unsupported key: ${key}`);
            }
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
                errors.push(`${pathLabel}.passAtK.${key} must be a rate between 0 and 1`);
            }
        }
    }
    validateRateNumber(scenarioResult, "meanScore", errors, `${pathLabel}.meanScore`);
    validateConfidenceInterval(optionalRecordField(scenarioResult, "meanScoreCi95", errors, `${pathLabel}.meanScoreCi95`), errors, `${pathLabel}.meanScoreCi95`);
    validateAggregateUsage(requireRecordField(scenarioResult, "usage", errors, `${pathLabel}.usage`), errors, `${pathLabel}.usage`);
    requireStringArrayField(scenarioResult, "statisticalWarnings", errors, `${pathLabel}.statisticalWarnings`);
}
function validateAggregateUsage(usage, errors, pathLabel) {
    if (usage === undefined) {
        return;
    }
    for (const field of ["runsWithUsage", "runsWithCost", "runsWithTokens"]) {
        validateNonNegativeNumber(usage, field, errors, `${pathLabel}.${field}`);
    }
    for (const field of ["totalCostUsd", "meanCostUsd", "costPerPass", "totalTokens", "meanTotalTokens", "tokensPerPass"]) {
        validateOptionalNonNegativeNumber(usage, field, errors, `${pathLabel}.${field}`);
    }
    if (typeof usage.runsWithCost === "number" && typeof usage.runsWithUsage === "number" && usage.runsWithCost > usage.runsWithUsage) {
        errors.push(`${pathLabel}.runsWithCost must be <= ${pathLabel}.runsWithUsage`);
    }
    if (typeof usage.runsWithTokens === "number" && typeof usage.runsWithUsage === "number" && usage.runsWithTokens > usage.runsWithUsage) {
        errors.push(`${pathLabel}.runsWithTokens must be <= ${pathLabel}.runsWithUsage`);
    }
}
function validateClaimReadiness(readiness, claim, errors) {
    if (readiness.scope !== "suite" && readiness.scope !== "ad_hoc_compare") {
        errors.push("readiness.scope must be suite or ad_hoc_compare");
    }
    if (readiness.scope !== claim.scope) {
        errors.push("readiness.scope must match claim scope");
    }
    if (typeof readiness.publishable !== "boolean") {
        errors.push("readiness.publishable must be boolean");
    }
    if (readiness.publishable !== claim.publishable) {
        errors.push("readiness.publishable must match publishable");
    }
    const blockers = requireStringArrayField(readiness, "blockers", errors, "readiness.blockers");
    requireStringArrayField(readiness, "advisories", errors, "readiness.advisories");
    if (readiness.publishable === true && blockers.length > 0) {
        errors.push("readiness.publishable cannot be true when blockers are present");
    }
}
function validateClaimEvidence(evidence, errors) {
    if (typeof evidence.runPlanPresent !== "boolean") {
        errors.push("evidence.runPlanPresent must be boolean");
    }
    requireStringArrayField(evidence, "runPlanWarnings", errors, "evidence.runPlanWarnings");
    for (const field of ["artifactValidationErrors", "artifactValidationWarnings", "artifactCompletenessWarnings", "reviewQueueItems", "requiredReviewItems", "recommendedReviewItems"]) {
        validateNonNegativeNumber(evidence, field, errors, `evidence.${field}`);
    }
}
function validateConfidenceInterval(interval, errors, pathLabel) {
    if (interval === undefined) {
        errors.push(`${pathLabel} is required`);
        return;
    }
    if (interval.method !== "wilson" && interval.method !== "normal_approximation" && interval.method !== "bootstrap_percentile") {
        errors.push(`${pathLabel}.method must be wilson, normal_approximation, or bootstrap_percentile`);
    }
    if (interval.confidenceLevel !== 0.95) {
        errors.push(`${pathLabel}.confidenceLevel must be 0.95`);
    }
    validateRateNumber(interval, "lower", errors, `${pathLabel}.lower`);
    validateRateNumber(interval, "upper", errors, `${pathLabel}.upper`);
    if (typeof interval.lower === "number" && typeof interval.upper === "number" && interval.lower > interval.upper) {
        errors.push(`${pathLabel}.lower must be <= ${pathLabel}.upper`);
    }
}
function requireRecordField(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (!isRecord(value)) {
        errors.push(`${pathLabel} must be an object`);
        return undefined;
    }
    return value;
}
function optionalRecordField(record, field, errors, pathLabel = field) {
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
function requireRecordArrayField(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (!Array.isArray(value)) {
        errors.push(`${pathLabel} must be an array`);
        return [];
    }
    return value.flatMap((item, index) => {
        if (!isRecord(item)) {
            errors.push(`${pathLabel}[${index}] must be an object`);
            return [];
        }
        return [item];
    });
}
function requireNonEmptyString(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`${pathLabel} must be non-empty string`);
        return undefined;
    }
    return value;
}
function requireOptionalNonEmptyString(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`${pathLabel} must be non-empty string`);
        return undefined;
    }
    return value;
}
function requireStringArrayField(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (!Array.isArray(value)) {
        errors.push(`${pathLabel} must be an array of strings`);
        return [];
    }
    return value.flatMap((item, index) => {
        if (typeof item !== "string") {
            errors.push(`${pathLabel}[${index}] must be string`);
            return [];
        }
        return [item];
    });
}
function validatePositiveNumber(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        errors.push(`${pathLabel} must be positive number`);
    }
}
function validateOptionalPositiveNumber(record, field, errors, pathLabel = field) {
    if (record[field] !== undefined) {
        validatePositiveNumber(record, field, errors, pathLabel);
    }
}
function validateNonNegativeNumber(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        errors.push(`${pathLabel} must be non-negative number`);
    }
}
function validateOptionalNonNegativeNumber(record, field, errors, pathLabel = field) {
    if (record[field] !== undefined) {
        validateNonNegativeNumber(record, field, errors, pathLabel);
    }
}
function validateRateNumber(record, field, errors, pathLabel = field) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        errors.push(`${pathLabel} must be a rate between 0 and 1`);
    }
}
function artifactCompletenessWarningCount(groups) {
    return groups.reduce((total, group) => total + Object.values(group.artifactCompletenessWarnings).reduce((subtotal, count) => subtotal + count, 0), 0);
}
function compactBenchmarkClaimSource(source) {
    return {
        ...(source.resultsPath === undefined ? {} : { resultsPath: source.resultsPath }),
        ...(source.suitePath === undefined ? {} : { suitePath: source.suitePath }),
        ...(source.suiteSha256 === undefined ? {} : { suiteSha256: source.suiteSha256 }),
        ...(source.runPlanPath === undefined ? {} : { runPlanPath: source.runPlanPath }),
        ...(source.runPlanSha256 === undefined ? {} : { runPlanSha256: source.runPlanSha256 }),
        ...(source.rerunLedgerPath === undefined ? {} : { rerunLedgerPath: source.rerunLedgerPath }),
        ...(source.rerunLedgerSha256 === undefined ? {} : { rerunLedgerSha256: source.rerunLedgerSha256 }),
        ...(source.htmlPath === undefined ? {} : { htmlPath: source.htmlPath }),
        ...(source.benchmarkClaimPath === undefined ? {} : { benchmarkClaimPath: source.benchmarkClaimPath }),
        ...(source.benchmarkSummaryPath === undefined ? {} : { benchmarkSummaryPath: source.benchmarkSummaryPath }),
        ...(source.resultArtifacts === undefined ? {} : { resultArtifacts: source.resultArtifacts.map((artifact) => ({ ...artifact })) }),
    };
}
function benchmarkClaimAdapterSummaries(groups, suiteAdapterSummaries) {
    if (suiteAdapterSummaries !== undefined) {
        return suiteAdapterSummaries.map((summary) => ({
            adapter: summary.adapter,
            scenarioCount: summary.coveredScenarios,
            runs: summary.runs,
            passes: summary.passes,
            runWeightedPassRate: summary.runWeightedPassRate,
            runWeightedPassRateCi95: summary.runWeightedPassRateCi95,
            meanScenarioPassRate: summary.meanScenarioPassRate,
            usage: aggregateGroupUsage(groups.filter((group) => group.adapter === summary.adapter), summary.passes),
            minRunsSatisfied: summary.minRunsSatisfied,
            warnings: summary.warnings,
        }));
    }
    return uniqueSorted(groups.map((group) => group.adapter)).map((adapter) => {
        const adapterGroups = groups.filter((group) => group.adapter === adapter);
        const runs = adapterGroups.reduce((total, group) => total + group.runs, 0);
        const passes = adapterGroups.reduce((total, group) => total + group.passes, 0);
        return {
            adapter,
            scenarioCount: adapterGroups.length,
            runs,
            passes,
            runWeightedPassRate: runs === 0 ? 0 : passes / runs,
            runWeightedPassRateCi95: wilsonConfidenceInterval(passes, runs),
            meanScenarioPassRate: adapterGroups.length === 0 ? 0 : mean(adapterGroups.map((group) => group.passRate)),
            usage: aggregateGroupUsage(adapterGroups, passes),
            warnings: uniquePreserveOrder(adapterGroups.flatMap((group) => group.statisticalWarnings.map((warning) => `${group.scenarioId}: ${warning}`))),
        };
    });
}
function copyAggregateUsage(usage) {
    return {
        runsWithUsage: usage.runsWithUsage,
        runsWithCost: usage.runsWithCost,
        runsWithTokens: usage.runsWithTokens,
        ...(usage.totalCostUsd === undefined ? {} : { totalCostUsd: usage.totalCostUsd }),
        ...(usage.meanCostUsd === undefined ? {} : { meanCostUsd: usage.meanCostUsd }),
        ...(usage.costPerPass === undefined ? {} : { costPerPass: usage.costPerPass }),
        ...(usage.totalTokens === undefined ? {} : { totalTokens: usage.totalTokens }),
        ...(usage.meanTotalTokens === undefined ? {} : { meanTotalTokens: usage.meanTotalTokens }),
        ...(usage.tokensPerPass === undefined ? {} : { tokensPerPass: usage.tokensPerPass }),
    };
}
function aggregateGroupUsage(groups, passes) {
    const runsWithUsage = groups.reduce((total, group) => total + group.usage.runsWithUsage, 0);
    const runsWithCost = groups.reduce((total, group) => total + group.usage.runsWithCost, 0);
    const runsWithTokens = groups.reduce((total, group) => total + group.usage.runsWithTokens, 0);
    const totalCostUsd = sumOptional(groups.map((group) => group.usage.totalCostUsd));
    const totalTokens = sumOptional(groups.map((group) => group.usage.totalTokens));
    return {
        runsWithUsage,
        runsWithCost,
        runsWithTokens,
        ...(totalCostUsd === undefined ? {} : {
            totalCostUsd,
            meanCostUsd: runsWithCost === 0 ? 0 : totalCostUsd / runsWithCost,
            ...(passes > 0 ? { costPerPass: totalCostUsd / passes } : {}),
        }),
        ...(totalTokens === undefined ? {} : {
            totalTokens,
            meanTotalTokens: runsWithTokens === 0 ? 0 : totalTokens / runsWithTokens,
            ...(passes > 0 ? { tokensPerPass: totalTokens / passes } : {}),
        }),
    };
}
export function readRunUsage(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const usage = {};
    for (const [sourceKey, targetKey] of [
        ["costUsd", "costUsd"],
        ["inputTokens", "inputTokens"],
        ["outputTokens", "outputTokens"],
        ["totalTokens", "totalTokens"],
    ]) {
        const parsed = readNonNegativeNumber(value[sourceKey]);
        if (parsed !== undefined) {
            usage[targetKey] = parsed;
        }
    }
    return Object.keys(usage).length === 0 ? undefined : usage;
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
function readPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}
function truncateTimelineNotes(value) {
    const trimmed = value.trim();
    return trimmed.length <= 240 ? trimmed : `${trimmed.slice(0, 237)}...`;
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
function readJudgeVotes(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item) => {
        if (!isRecord(item)) {
            return [];
        }
        const judge = readJudge(item.judge);
        if (judge === undefined) {
            return [];
        }
        const vote = {
            judge,
            status: parseEvalStatus(item.status),
            confidence: parseEvalConfidence(item.confidence),
            rationale: typeof item.rationale === "string" ? item.rationale : "",
            evidenceRefs: readEvidenceRefs(item.evidenceRefs),
        };
        if (typeof item.weight === "number" && Number.isFinite(item.weight) && item.weight > 0) {
            vote.weight = item.weight;
        }
        return [vote];
    });
}
function summarizeJudgeAgreement(votes) {
    const statusCounts = {
        passed: 0,
        failed: 0,
        review: 0,
        infra_failed: 0,
    };
    for (const vote of votes) {
        statusCounts[vote.status] += 1;
    }
    const nonZeroCounts = Object.entries(statusCounts)
        .filter((entry) => entry[1] > 0);
    const sortedCounts = [...nonZeroCounts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
    const top = sortedCounts[0];
    const runnerUp = sortedCounts[1];
    const majorityStatus = top !== undefined && (runnerUp === undefined || top[1] > runnerUp[1]) ? top[0] : undefined;
    const unanimous = nonZeroCounts.length <= 1;
    return {
        votes: votes.length,
        unanimous,
        statusCounts,
        ...(majorityStatus === undefined ? {} : { majorityStatus }),
        dissentingJudges: majorityStatus === undefined
            ? votes.map((vote) => formatJudgeVoteLabel(vote.judge))
            : votes.filter((vote) => vote.status !== majorityStatus).map((vote) => formatJudgeVoteLabel(vote.judge)),
    };
}
function formatJudgeVoteLabel(judge) {
    const model = judge.model === undefined ? "" : `/${judge.model}`;
    const version = judge.version === undefined ? "" : `@${judge.version}`;
    return `${judge.kind}${model}${version}`;
}
function clampScore(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return Math.min(1, Math.max(0, value));
}
function clampDelta(value) {
    return Math.min(1, Math.max(-1, value));
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
function reviewReasons(summary) {
    const reasons = [
        ...(summary.evalStatus === "review" ? ["eval requested human review"] : []),
        ...(summary.evalStatus === "infra_failed" ? ["eval infrastructure failed"] : []),
        ...(summary.score === 0 ? [`non-passing run: ${summary.failureBucket}`] : []),
        ...summary.evalQualityWarnings,
        ...summary.artifactCompletenessWarnings,
        ...summary.unmetCriteria.map((criterion) => `unmet criterion: ${criterion}`),
    ];
    return [...new Set(reasons)];
}
function reviewPriorityRank(priority) {
    return priority === "required" ? 1 : 0;
}
function uniquePreserveOrder(values) {
    const seen = new Set();
    return values.filter((value) => {
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
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
function aggregateUsage(summaries, passes) {
    const usage = summaries
        .map((summary) => summary.usage)
        .filter((item) => item !== undefined);
    const costs = usage
        .map((item) => item.costUsd)
        .filter((value) => typeof value === "number");
    const tokens = usage
        .map((item) => item.totalTokens)
        .filter((value) => typeof value === "number");
    const totalCostUsd = costs.length === 0 ? undefined : sum(costs);
    const totalTokens = tokens.length === 0 ? undefined : sum(tokens);
    return {
        runsWithUsage: usage.length,
        runsWithCost: costs.length,
        runsWithTokens: tokens.length,
        ...(totalCostUsd === undefined ? {} : {
            totalCostUsd,
            meanCostUsd: totalCostUsd / costs.length,
            ...(passes > 0 ? { costPerPass: totalCostUsd / passes } : {}),
        }),
        ...(totalTokens === undefined ? {} : {
            totalTokens,
            meanTotalTokens: totalTokens / tokens.length,
            ...(passes > 0 ? { tokensPerPass: totalTokens / passes } : {}),
        }),
    };
}
function aggregateCohort(summaries) {
    const cohort = {
        sampleIds: uniqueSorted(summaries.map((summary) => summary.sample?.id ?? "unknown")),
        sampleSeeds: uniqueSorted(summaries.map((summary) => summary.sample?.seed ?? "unknown")),
        scenarioVersions: uniqueSorted(summaries.map((summary) => summary.runManifest?.scenario.scenarioVersion ?? "unknown")),
        adapterVersions: uniqueSorted(summaries.map((summary) => summary.runManifest?.runAgent.adapterVersion ?? "unknown")),
        agentModels: uniqueSorted(summaries.map((summary) => formatManifestIdentity(summary.runManifest?.runAgent.model))),
        agentPromptVersions: uniqueSorted(summaries.map((summary) => readStringField(summary.runManifest?.runAgent.model, "promptVersion") ?? "unknown")),
        evaluatorModels: uniqueSorted(summaries.map((summary) => formatManifestIdentity(summary.runManifest?.evaluator?.model))),
        evaluatorPromptVersions: uniqueSorted(summaries.map((summary) => readStringField(summary.runManifest?.evaluator?.model, "promptVersion") ?? "unknown")),
        evaluatorInputSignatures: uniqueSorted(summaries.map((summary) => formatEvaluatorInputSignature(summary.runManifest?.evaluator?.inputSummary))),
        judgeIdentities: uniqueSorted(summaries.map((summary) => formatJudgeIdentity(summary.runManifest?.evaluator?.judge))),
        environmentFingerprints: uniqueSorted(summaries.map((summary) => formatEnvironmentFingerprint(summary.runManifest?.environment))),
        comparabilityWarnings: [],
    };
    cohort.comparabilityWarnings = comparabilityWarnings(cohort);
    return cohort;
}
function comparabilityWarnings(cohort) {
    const checks = [
        ["scenarioVersions", "mixed scenario versions in aggregate group", "missing scenario version metadata in aggregate group"],
        ["adapterVersions", "mixed adapter versions in aggregate group", "missing adapter version metadata in aggregate group"],
        ["agentModels", "mixed agent models in aggregate group", "missing agent model metadata in aggregate group"],
        ["agentPromptVersions", "mixed agent prompt versions in aggregate group", "missing agent prompt version metadata in aggregate group"],
        ["evaluatorModels", "mixed evaluator models in aggregate group", "missing evaluator model metadata in aggregate group"],
        ["evaluatorPromptVersions", "mixed evaluator prompt versions in aggregate group", "missing evaluator prompt version metadata in aggregate group"],
        ["evaluatorInputSignatures", "mixed evaluator input setup in aggregate group", "missing evaluator input summary metadata in aggregate group"],
        ["judgeIdentities", "mixed eval judge identities in aggregate group", "missing eval judge metadata in aggregate group"],
        ["environmentFingerprints", "mixed environment fingerprints in aggregate group", "missing environment fingerprint metadata in aggregate group"],
    ];
    return checks.flatMap(([key, mixedWarning, missingWarning]) => [
        ...(cohort[key].length > 1 ? [mixedWarning] : []),
        ...(cohort[key].includes("unknown") ? [missingWarning] : []),
    ]);
}
function uniqueSorted(values) {
    return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}
function formatManifestIdentity(model) {
    if (model === undefined || Object.keys(model).length === 0) {
        return "unknown";
    }
    const provider = readStringField(model, "provider");
    const name = readStringField(model, "model");
    const version = readStringField(model, "version");
    const label = [provider, name].filter((value) => value !== undefined).join("/");
    if (label.length === 0) {
        return version ?? "unknown";
    }
    return version === undefined ? label : `${label}@${version}`;
}
function formatJudgeIdentity(judge) {
    if (judge === undefined) {
        return "unknown";
    }
    const model = judge.model === undefined ? "" : `/${judge.model}`;
    const version = judge.version === undefined ? "" : `@${judge.version}`;
    return `${judge.kind}${model}${version}`;
}
function formatEvaluatorInputSignature(inputSummary) {
    if (inputSummary === undefined || Object.keys(inputSummary).length === 0) {
        return "unknown";
    }
    const pathHashes = Array.isArray(inputSummary.privateAssetPathHashes)
        ? inputSummary.privateAssetPathHashes.filter((item) => typeof item === "string").sort()
        : [];
    return [
        `context=${readNumberField(inputSummary, "scenarioContextCount") ?? "unknown"}`,
        `rubric=${readNumberField(inputSummary, "goalRubricCount") ?? "unknown"}`,
        `evidence=${readNumberField(inputSummary, "evidenceGuidanceCount") ?? "unknown"}`,
        `calibration=${readNumberField(inputSummary, "calibrationCaseCount") ?? "unknown"}`,
        `privateAssets=${readNumberField(inputSummary, "privateAssetCount") ?? "unknown"}`,
        `privateAssetPathHashes=${pathHashes.length === 0 ? "none" : pathHashes.join("|")}`,
    ].join(";");
}
function formatEnvironmentFingerprint(environment) {
    if (environment === undefined) {
        return "unknown";
    }
    const fingerprint = environment.fingerprint;
    if (isRecord(fingerprint)) {
        const method = readStringField(fingerprint, "method") ?? "sha256";
        const sha256 = readStringField(fingerprint, "sha256");
        if (sha256 !== undefined) {
            return `${method}:${sha256}`;
        }
    }
    const parts = [
        readStringField(environment, "platform"),
        readStringField(environment, "pythonVersion"),
        readStringField(environment, "containerImage"),
    ].filter((value) => value !== undefined && value.trim().length > 0);
    return parts.length === 0 ? "unknown" : parts.join(" | ");
}
function walkRunResultFiles(root) {
    const entries = readdirSync(root, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkRunResultFiles(entryPath));
            continue;
        }
        if (entry.isFile() && entry.name === "ruhroh-loop-result.json") {
            files.push(entryPath);
        }
    }
    return files.sort((left, right) => left.localeCompare(right));
}
function readRuhrohRunResultArtifact(resultPath) {
    const resolved = path.resolve(resultPath);
    const raw = readFileSync(resolved, "utf8");
    const parsed = JSON.parse(raw);
    if (!isRuhrohLoopResult(parsed)) {
        throw new Error(`Expected ruhroh_loop_result_v1 JSON at ${resolved}`);
    }
    return {
        path: resolved,
        sha256: sha256Text(raw),
        run: parsed,
    };
}
function benchmarkClaimResultArtifact(artifact) {
    const summary = summarizeRuhrohRun(artifact.run);
    const scenarioVersion = artifact.run.runManifest?.scenario.scenarioVersion;
    return {
        path: artifact.path,
        sha256: artifact.sha256,
        scenarioId: summary.scenarioId,
        adapter: summary.adapter,
        ...(summary.runId === undefined ? {} : { runId: summary.runId }),
        ...(summary.sample?.id === undefined ? {} : { sampleId: summary.sample.id }),
        ...(scenarioVersion === undefined ? {} : { scenarioVersion }),
        ...(summary.artifactInventory.length === 0 ? {} : { artifactInventory: summary.artifactInventory }),
    };
}
function isRuhrohLoopResult(value) {
    return isRecord(value)
        && value.version === "ruhroh_loop_result_v1"
        && typeof value.adapter === "string"
        && typeof value.dataset === "string"
        && typeof value.scenarioId === "string"
        && typeof value.task_id === "string"
        && (value.status === "completed" || value.status === "failed")
        && typeof value.failure_kind === "string"
        && typeof value.failureBucket === "string"
        && typeof value.score === "number"
        && typeof value.iterationsUsed === "number"
        && typeof value.implementationIterationsUsed === "number"
        && typeof value.implementationStoppedReason === "string"
        && typeof value.stoppedReason === "string"
        && typeof value.duration_ms === "number"
        && isRecord(value.runAgent)
        && typeof value.runAgentAdapterId === "string"
        && typeof value.continuityLevel === "string"
        && typeof value.sessionHandle === "string"
        && Array.isArray(value.runIds)
        && Array.isArray(value.implementationRuns);
}
function sha256Text(value) {
    return createHash("sha256").update(value).digest("hex");
}
function readStringField(value, key) {
    const field = value?.[key];
    return typeof field === "string" && field.trim().length > 0 ? field : undefined;
}
function readNumberField(value, key) {
    const field = value?.[key];
    return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}
function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}
function sumOptional(values) {
    const present = values.filter((value) => typeof value === "number");
    return present.length === 0 ? undefined : sum(present);
}
function readNonNegativeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
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
        lower: clampScore((center - margin) / denominator),
        upper: clampScore((center + margin) / denominator),
    };
}
function passRateDeltaConfidenceInterval(input) {
    if (input.baselineRuns <= 0 || input.contenderRuns <= 0) {
        return { method: "normal_approximation", confidenceLevel: 0.95, lower: 0, upper: 0 };
    }
    const z = 1.959963984540054;
    const baselineVariance = input.baselinePassRate * (1 - input.baselinePassRate) / input.baselineRuns;
    const contenderVariance = input.contenderPassRate * (1 - input.contenderPassRate) / input.contenderRuns;
    const margin = z * Math.sqrt(baselineVariance + contenderVariance);
    return {
        method: "normal_approximation",
        confidenceLevel: 0.95,
        lower: clampDelta(input.delta - margin),
        upper: clampDelta(input.delta + margin),
    };
}
function bootstrapMeanConfidenceInterval(values, seed, resamples = 1000) {
    if (values.length === 0) {
        return { method: "bootstrap_percentile", confidenceLevel: 0.95, lower: 0, upper: 0 };
    }
    if (values.length === 1) {
        const value = clampScore(values[0] ?? 0);
        return { method: "bootstrap_percentile", confidenceLevel: 0.95, lower: value, upper: value };
    }
    const bootstrapMeans = [];
    for (let resampleIndex = 0; resampleIndex < resamples; resampleIndex += 1) {
        let total = 0;
        for (let drawIndex = 0; drawIndex < values.length; drawIndex += 1) {
            const selectedIndex = Math.floor(seededUnitInterval(`${seed}:${values.length}`, resampleIndex, drawIndex) * values.length);
            total += values[Math.min(selectedIndex, values.length - 1)] ?? 0;
        }
        bootstrapMeans.push(total / values.length);
    }
    bootstrapMeans.sort((left, right) => left - right);
    return {
        method: "bootstrap_percentile",
        confidenceLevel: 0.95,
        lower: clampScore(percentileSorted(bootstrapMeans, 0.025)),
        upper: clampScore(percentileSorted(bootstrapMeans, 0.975)),
    };
}
function seededUnitInterval(seed, resampleIndex, drawIndex) {
    const hash = createHash("sha256")
        .update(seed)
        .update(":")
        .update(String(resampleIndex))
        .update(":")
        .update(String(drawIndex))
        .digest();
    return hash.readUInt32BE(0) / 0x100000000;
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
function pairwiseConclusion(interval) {
    if (interval.lower > 0) {
        return "contender_higher";
    }
    if (interval.upper < 0) {
        return "baseline_higher";
    }
    return "inconclusive";
}
function pairwiseSignificance(input) {
    const pValue = fisherExactTwoSidedPValue({
        baselinePasses: input.baselinePasses,
        baselineFailures: input.baselineRuns - input.baselinePasses,
        contenderPasses: input.contenderPasses,
        contenderFailures: input.contenderRuns - input.contenderPasses,
    });
    return {
        method: "fisher_exact_two_sided",
        alpha: 0.05,
        pValue,
        significant: pValue < 0.05,
    };
}
function pairwiseWarnings(baseline, contender, interval, significance, minRuns) {
    return uniquePreserveOrder([
        ...(baseline.runs < minRuns ? [`${baseline.adapter} has ${baseline.runs}/${minRuns} runs`] : []),
        ...(contender.runs < minRuns ? [`${contender.adapter} has ${contender.runs}/${minRuns} runs`] : []),
        ...(interval.lower <= 0 && interval.upper >= 0 ? ["delta 95% CI includes 0; treat adapter difference as inconclusive"] : []),
        ...(!significance.significant ? ["Fisher exact test is not significant at alpha=0.05"] : []),
        ...baseline.cohort.comparabilityWarnings.map((warning) => `${baseline.adapter}: ${warning}`),
        ...contender.cohort.comparabilityWarnings.map((warning) => `${contender.adapter}: ${warning}`),
    ]);
}
function fisherExactTwoSidedPValue(input) {
    const rowTotal = input.baselinePasses + input.baselineFailures;
    const totalPasses = input.baselinePasses + input.contenderPasses;
    const totalFailures = input.baselineFailures + input.contenderFailures;
    const total = rowTotal + input.contenderPasses + input.contenderFailures;
    if (total <= 0) {
        return 1;
    }
    const minPasses = Math.max(0, rowTotal - totalFailures);
    const maxPasses = Math.min(rowTotal, totalPasses);
    const observedProbability = hypergeometricProbability(input.baselinePasses, rowTotal, totalPasses, total);
    let pValue = 0;
    for (let baselinePasses = minPasses; baselinePasses <= maxPasses; baselinePasses += 1) {
        const probability = hypergeometricProbability(baselinePasses, rowTotal, totalPasses, total);
        if (probability <= observedProbability + Number.EPSILON) {
            pValue += probability;
        }
    }
    return clampScore(pValue);
}
function hypergeometricProbability(successes, draws, populationSuccesses, population) {
    if (successes < 0 || successes > draws || successes > populationSuccesses || draws - successes > population - populationSuccesses) {
        return 0;
    }
    return Math.exp(logCombination(populationSuccesses, successes)
        + logCombination(population - populationSuccesses, draws - successes)
        - logCombination(population, draws));
}
function logCombination(total, choose) {
    if (choose < 0 || choose > total) {
        return Number.NEGATIVE_INFINITY;
    }
    return logFactorial(total) - logFactorial(choose) - logFactorial(total - choose);
}
function logFactorial(value) {
    let result = 0;
    for (let index = 2; index <= value; index += 1) {
        result += Math.log(index);
    }
    return result;
}
function passAtKValues(successes, total) {
    const values = {};
    for (let k = 1; k <= Math.min(5, total); k += 1) {
        values[`pass@${k}`] = estimatePassAtK(total, successes, k);
    }
    return values;
}
function estimatePassAtK(total, successes, k) {
    if (total <= 0 || successes <= 0) {
        return 0;
    }
    if (total - successes < k) {
        return 1;
    }
    let probabilityAllFail = 1;
    for (let index = total - successes + 1; index <= total; index += 1) {
        probabilityAllFail *= 1 - k / index;
    }
    return clampScore(1 - probabilityAllFail);
}
function statisticalWarnings(runs, minRuns = 5) {
    if (runs >= minRuns) {
        return [];
    }
    if (minRuns !== 5) {
        return [`fewer than ${minRuns} runs; suite methodology requires ${minRuns} for publishable comparison`];
    }
    return ["fewer than 5 runs; treat pass rate and pass@k as directional"];
}
function suiteScenarioVersionWarnings(scenarioId, cohort, expectedScenarioVersions) {
    const expected = expectedScenarioVersions?.[scenarioId];
    if (expected === undefined) {
        return [];
    }
    if (cohort.scenarioVersions.length === 1 && cohort.scenarioVersions[0] === expected) {
        return [];
    }
    if (!cohort.scenarioVersions.includes(expected)) {
        return [`scenario ${scenarioId} does not include suite-locked scenarioVersion ${expected}`];
    }
    return [`scenario ${scenarioId} mixes suite-locked scenarioVersion ${expected} with other scenario versions`];
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