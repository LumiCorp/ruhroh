export function scoreForEvalStatus(status) {
    return status === "passed" ? 1 : 0;
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
//# sourceMappingURL=results.js.map