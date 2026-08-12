export declare const RUHROH_ECONOMIC_RESOURCE_NAMES: readonly ["wallTimeMs", "implementationIterations", "modelCalls", "failedModelCalls", "retryAttempts", "toolCalls", "inputTokens", "outputTokens", "cachedInputTokens", "reasoningTokens", "totalTokens", "cost", "childAgents", "agentDepth"];
export type RuhrohEconomicResource = typeof RUHROH_ECONOMIC_RESOURCE_NAMES[number];
export type RuhrohEconomicsCoverageStatus = "complete" | "partial" | "unknown";
export type RuhrohEconomicsAggregation = "delta" | "cumulative";
export type RuhrohEconomicsAccounting = "exclusive" | "inclusive_checkpoint";
export type RuhrohBudgetEnforcement = "preemptive" | "boundary" | "unsupported";
export interface RuhrohEconomicsCoverageV1 {
    status: RuhrohEconomicsCoverageStatus;
    missingReasons?: string[] | undefined;
}
export interface RuhrohEconomicsSourceV1 {
    kind: "provider_api" | "gateway" | "sdk" | "adapter" | "runtime" | "invoice" | "environment" | "legacy";
    name: string;
    quality: "billed" | "metered" | "reported" | "estimated" | "manual" | "legacy";
    observedAt?: string | undefined;
    priceBasisId?: string | undefined;
}
export interface RuhrohEconomicUsageV1 {
    modelCalls?: number | undefined;
    failedModelCalls?: number | undefined;
    retryAttempts?: number | undefined;
    toolCalls?: number | undefined;
    inputTokens?: number | undefined;
    outputTokens?: number | undefined;
    cachedInputTokens?: number | undefined;
    reasoningTokens?: number | undefined;
    totalTokens?: number | undefined;
    childAgents?: number | undefined;
    maxAgentDepth?: number | undefined;
}
export interface RuhrohEconomicCostV1 {
    amount: number;
    currency: string;
    kind: "billed" | "metered" | "estimated" | "manual";
}
export interface RuhrohEconomicsObservationV1 {
    version: "ruhroh_economics_observation_v1";
    observationId: string;
    seriesId: string;
    sequence: number;
    scope: "model_call" | "turn" | "session" | "run";
    aggregation: RuhrohEconomicsAggregation;
    accounting: RuhrohEconomicsAccounting;
    coverage: RuhrohEconomicsCoverageV1;
    source: RuhrohEconomicsSourceV1;
    usage?: RuhrohEconomicUsageV1 | undefined;
    cost?: RuhrohEconomicCostV1 | undefined;
}
export interface RuhrohEconomicMetricCoverageV1 {
    status: "complete" | "partial" | "unknown" | "unavailable";
    observationCount: number;
    completeObservationCount: number;
}
export interface RuhrohEconomicsEnvelopeV1 {
    version: "ruhroh_economics_envelope_v1";
    scope: "run";
    observations: RuhrohEconomicsObservationV1[];
    totals: {
        usage: RuhrohEconomicUsageV1;
        costs: RuhrohEconomicCostV1[];
    };
    runtime?: {
        wallTimeMs: number;
        implementationIterations: number;
    } | undefined;
    coverage: Partial<Record<RuhrohEconomicResource, RuhrohEconomicMetricCoverageV1>>;
    traceRef?: {
        artifact: string;
        sha256: string;
        spanCount: number;
        coverage: RuhrohEconomicsCoverageStatus;
    } | undefined;
    legacy: boolean;
    warnings: string[];
}
export interface RuhrohEconomicsNormalizationResult {
    envelope: RuhrohEconomicsEnvelopeV1;
    errors: string[];
}
export interface RuhrohEconomicTraceEvidenceRefV1 {
    artifact: string;
    sha256: string;
}
export interface RuhrohEconomicTraceSpanV1 {
    version: "ruhroh_economic_trace_span_v1";
    traceId: string;
    spanId: string;
    parentSpanId?: string | undefined;
    links?: string[] | undefined;
    kind: "agent_turn" | "inference" | "tool" | "retrieval" | "embedding" | "route_decision" | "retry" | "fallback" | "child_agent";
    status: "ok" | "error" | "timeout" | "cancelled" | "unknown";
    startedAt: string;
    endedAt?: string | undefined;
    durationMs?: number | undefined;
    iteration?: number | undefined;
    agent?: {
        adapterId?: string | undefined;
        agentIdHash?: string | undefined;
        parentAgentIdHash?: string | undefined;
        depth?: number | undefined;
    } | undefined;
    inference?: {
        provider?: string | undefined;
        model?: string | undefined;
        modelVersion?: string | undefined;
        routeHash?: string | undefined;
        requestIdHash?: string | undefined;
    } | undefined;
    resourceObservationRefs?: string[] | undefined;
    evidenceRefs?: RuhrohEconomicTraceEvidenceRefV1[] | undefined;
    eventTypes?: string[] | undefined;
}
export interface RuhrohResourceCapabilityV1 {
    observable: boolean;
    enforcement: RuhrohBudgetEnforcement;
    source: "runtime" | "connector";
}
export interface RuhrohAdapterManifestV1 {
    version: "ruhroh_adapter_manifest_v1";
    adapterId: string;
    adapterVersion: string;
    resultProtocol: "ruhroh_run_agent_result_v1" | "ruhroh_run_agent_result_v2";
    traceProtocol?: "ruhroh_economic_trace_span_v1" | undefined;
    resources: Partial<Record<RuhrohEconomicResource, RuhrohResourceCapabilityV1>>;
}
export interface RuhrohResourceBudgetLimitV1 {
    resource: RuhrohEconomicResource;
    max: number;
    currency?: string | undefined;
    requiredEnforcement: Exclude<RuhrohBudgetEnforcement, "unsupported">;
}
export interface RuhrohResourceBudgetsV1 {
    version: "ruhroh_resource_budgets_v1";
    scope: "implementation";
    onUnobservable: "fail";
    limits: RuhrohResourceBudgetLimitV1[];
}
export interface RuhrohObservedResources {
    values: Partial<Record<Exclude<RuhrohEconomicResource, "cost">, number>>;
    costs: Record<string, number>;
    coverage: Partial<Record<RuhrohEconomicResource, "complete" | "partial" | "unknown" | "unavailable">>;
}
export interface RuhrohResourceBudgetLimitOutcomeV1 {
    resource: RuhrohEconomicResource;
    limit: number;
    currency?: string | undefined;
    observed?: number | undefined;
    enforcement: Exclude<RuhrohBudgetEnforcement, "unsupported">;
    coverage: "complete" | "partial" | "unknown" | "unavailable";
    status: "within" | "exhausted" | "overrun" | "unobservable";
}
export interface RuhrohProcessTerminationV1 {
    version: "ruhroh_process_termination_v1";
    scope: "process_group" | "process";
    reason: "wall_time_limit" | "iteration_timeout";
    timeoutMs: number;
    timeoutObservedAtMs: number;
    gracePeriodMs: 5000;
    signalsSent: Array<"SIGTERM" | "SIGKILL">;
    terminatedBy: "already_exited" | "SIGTERM" | "SIGKILL" | "not_found";
    terminationDurationMs: number;
    terminatedAtMs: number;
    limitMs?: number | undefined;
    overrunMs?: number | undefined;
}
export interface RuhrohResourceBudgetOutcomeV1 {
    version: "ruhroh_resource_budget_outcome_v1";
    scope: "implementation";
    status: "within" | "exhausted" | "overrun" | "unobservable";
    limits: RuhrohResourceBudgetLimitOutcomeV1[];
    termination?: RuhrohProcessTerminationV1 | undefined;
}
export interface RuhrohAdapterConformanceV1 {
    version: "ruhroh_adapter_conformance_v1";
    adapterId: string;
    adapterVersion: string;
    manifestSha256: string;
    passed: boolean;
    checks: Array<{
        name: string;
        status: "passed" | "failed";
        details: string;
    }>;
}
export interface RuhrohRunAgentResultV2 {
    version: "ruhroh_run_agent_result_v2";
    status: "goal_satisfied" | "continue" | "cannot_satisfy" | "policy_blocked" | "out_of_scope" | "runtime_failure" | "infra_failure" | "cancelled";
    runId?: string | undefined;
    threadId?: string | undefined;
    adapterVersion?: string | undefined;
    model?: Record<string, unknown> | undefined;
    economicsObservations?: RuhrohEconomicsObservationV1[] | undefined;
    economicTraceSpans?: RuhrohEconomicTraceSpanV1[] | undefined;
    adapterManifest?: RuhrohAdapterManifestV1 | undefined;
    resourceBudgetOutcome?: RuhrohResourceBudgetOutcomeV1 | undefined;
    artifacts?: Record<string, string> | undefined;
    [key: string]: unknown;
}
export interface RuhrohFinalizedEconomicTraceJsonl {
    spans: RuhrohEconomicTraceSpanV1[];
    jsonl: string;
    sha256?: string | undefined;
    byteLength: number;
    truncatedFinalRecord: boolean;
    errors: string[];
}
export declare const RUHROH_RUNTIME_RESOURCE_CAPABILITIES: Readonly<Partial<Record<RuhrohEconomicResource, RuhrohResourceCapabilityV1>>>;
export declare function validateEconomicsObservation(value: unknown): string[];
export declare function validateRunAgentResultV2(value: unknown): string[];
export declare function normalizeEconomicsObservations(observations: readonly RuhrohEconomicsObservationV1[]): RuhrohEconomicsNormalizationResult;
export declare function legacyUsageToEconomicsEnvelope(value: unknown): RuhrohEconomicsEnvelopeV1 | undefined;
export declare function validateEconomicTraceSpan(value: unknown): string[];
export declare function validateEconomicTrace(spans: readonly RuhrohEconomicTraceSpanV1[]): string[];
export declare function finalizeEconomicTraceJsonl(input: string | Buffer): RuhrohFinalizedEconomicTraceJsonl;
export declare function validateAdapterManifest(value: unknown): string[];
export declare function validateResourceBudgets(value: unknown): string[];
export declare function validateResourceBudgetOutcome(value: unknown): string[];
export declare function validateProcessTermination(value: unknown): string[];
export declare function budgetCapabilityErrors(manifest: RuhrohAdapterManifestV1 | undefined, budgets: RuhrohResourceBudgetsV1): string[];
export declare function evaluateResourceBudgets(budgets: RuhrohResourceBudgetsV1, observed: RuhrohObservedResources, capabilities?: Partial<Record<RuhrohEconomicResource, RuhrohResourceCapabilityV1>>, completed?: boolean): RuhrohResourceBudgetOutcomeV1;
export declare function runAdapterConformance(input: {
    manifest: RuhrohAdapterManifestV1;
    observations?: readonly RuhrohEconomicsObservationV1[] | undefined;
    spans?: readonly RuhrohEconomicTraceSpanV1[] | undefined;
}): RuhrohAdapterConformanceV1;
export declare function sha256CanonicalJson(value: unknown): string;
//# sourceMappingURL=economics-runtime.d.ts.map