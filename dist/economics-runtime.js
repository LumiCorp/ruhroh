import { createHash } from "node:crypto";
export const RUHROH_ECONOMIC_RESOURCE_NAMES = [
    "wallTimeMs",
    "implementationIterations",
    "modelCalls",
    "failedModelCalls",
    "retryAttempts",
    "toolCalls",
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
    "reasoningTokens",
    "totalTokens",
    "cost",
    "childAgents",
    "agentDepth",
];
const USAGE_FIELDS = [
    "modelCalls",
    "failedModelCalls",
    "retryAttempts",
    "toolCalls",
    "inputTokens",
    "outputTokens",
    "cachedInputTokens",
    "reasoningTokens",
    "totalTokens",
    "childAgents",
    "maxAgentDepth",
];
const TRACE_KINDS = new Set([
    "agent_turn",
    "inference",
    "tool",
    "retrieval",
    "embedding",
    "route_decision",
    "retry",
    "fallback",
    "child_agent",
]);
const TRACE_STATUSES = new Set([
    "ok",
    "error",
    "timeout",
    "cancelled",
    "unknown",
]);
const TRACE_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/u;
const TRACE_EVENT_TYPE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
const SENSITIVE_TRACE_KEYS = new Set([
    "prompt",
    "prompts",
    "message",
    "messages",
    "content",
    "arguments",
    "toolarguments",
    "toolresult",
    "result",
    "output",
    "raw",
    "principalid",
    "userid",
    "requestid",
]);
export const RUHROH_RUNTIME_RESOURCE_CAPABILITIES = {
    wallTimeMs: { observable: true, enforcement: "preemptive", source: "runtime" },
    implementationIterations: { observable: true, enforcement: "preemptive", source: "runtime" },
};
export function validateEconomicsObservation(value) {
    const errors = [];
    if (!isRecord(value)) {
        return ["observation must be an object"];
    }
    const allowedObservationFields = new Set(["version", "observationId", "seriesId", "sequence", "scope", "aggregation", "accounting", "coverage", "source", "usage", "cost"]);
    for (const key of Object.keys(value)) {
        if (!allowedObservationFields.has(key))
            errors.push(`observation contains unsupported field ${key}`);
    }
    if (value.version !== "ruhroh_economics_observation_v1") {
        errors.push("version must be ruhroh_economics_observation_v1");
    }
    for (const field of ["observationId", "seriesId"]) {
        if (!nonEmptyString(value[field])) {
            errors.push(`${field} must be a non-empty string`);
        }
    }
    if (!Number.isInteger(value.sequence) || Number(value.sequence) < 1) {
        errors.push("sequence must be a positive integer");
    }
    if (!new Set(["model_call", "turn", "session", "run"]).has(String(value.scope))) {
        errors.push("scope must be model_call, turn, session, or run");
    }
    if (value.aggregation !== "delta" && value.aggregation !== "cumulative") {
        errors.push("aggregation must be delta or cumulative");
    }
    if (value.accounting !== "exclusive" && value.accounting !== "inclusive_checkpoint") {
        errors.push("accounting must be exclusive or inclusive_checkpoint");
    }
    if (!isRecord(value.coverage) || !new Set(["complete", "partial", "unknown"]).has(String(value.coverage.status))) {
        errors.push("coverage.status must be complete, partial, or unknown");
    }
    else {
        if (Object.keys(value.coverage).some((key) => key !== "status" && key !== "missingReasons"))
            errors.push("coverage contains unsupported fields");
        if (value.coverage.missingReasons !== undefined && (!Array.isArray(value.coverage.missingReasons) || value.coverage.missingReasons.some((reason) => !nonEmptyString(reason)))) {
            errors.push("coverage.missingReasons must contain non-empty strings");
        }
    }
    if (!isRecord(value.source) || !nonEmptyString(value.source.name) || !nonEmptyString(value.source.kind) || !nonEmptyString(value.source.quality)) {
        errors.push("source must include non-empty kind, name, and quality");
    }
    else {
        if (Object.keys(value.source).some((key) => !new Set(["kind", "name", "quality", "observedAt", "priceBasisId"]).has(key)))
            errors.push("source contains unsupported fields");
        if (!new Set(["provider_api", "gateway", "sdk", "adapter", "runtime", "invoice", "environment", "legacy"]).has(String(value.source.kind))) {
            errors.push("source.kind is invalid");
        }
        if (!new Set(["billed", "metered", "reported", "estimated", "manual", "legacy"]).has(String(value.source.quality))) {
            errors.push("source.quality is invalid");
        }
    }
    if (value.usage !== undefined) {
        if (!isRecord(value.usage)) {
            errors.push("usage must be an object");
        }
        else {
            for (const key of Object.keys(value.usage)) {
                if (!USAGE_FIELDS.includes(key))
                    errors.push(`usage contains unsupported field ${key}`);
            }
            if (Object.keys(value.usage).length === 0) {
                errors.push("usage must include at least one supported metric");
            }
            for (const field of USAGE_FIELDS) {
                const raw = value.usage[field];
                if (raw !== undefined && !nonNegativeFiniteNumber(raw)) {
                    errors.push(`usage.${field} must be a non-negative finite number`);
                }
            }
        }
    }
    if (value.cost !== undefined) {
        if (!isRecord(value.cost)) {
            errors.push("cost must be an object");
        }
        else {
            if (Object.keys(value.cost).some((key) => key !== "amount" && key !== "currency" && key !== "kind"))
                errors.push("cost contains unsupported fields");
            if (!nonNegativeFiniteNumber(value.cost.amount)) {
                errors.push("cost.amount must be a non-negative finite number");
            }
            if (!/^[A-Z]{3}$/u.test(String(value.cost.currency ?? ""))) {
                errors.push("cost.currency must be a three-letter uppercase currency code");
            }
            if (!new Set(["billed", "metered", "estimated", "manual"]).has(String(value.cost.kind))) {
                errors.push("cost.kind must be billed, metered, estimated, or manual");
            }
        }
    }
    if (value.usage === undefined && value.cost === undefined) {
        errors.push("observation must include usage or cost");
    }
    return errors;
}
export function validateRunAgentResultV2(value) {
    if (!isRecord(value)) {
        return ["run-agent result must be an object"];
    }
    const errors = [];
    if (value.version !== "ruhroh_run_agent_result_v2") {
        errors.push("version must be ruhroh_run_agent_result_v2");
    }
    if (!new Set(["goal_satisfied", "continue", "cannot_satisfy", "policy_blocked", "out_of_scope", "runtime_failure", "infra_failure", "cancelled"]).has(String(value.status))) {
        errors.push("status is not supported by run-agent result v2");
    }
    for (const field of ["runId", "threadId", "adapterVersion"]) {
        if (value[field] !== undefined && !nonEmptyString(value[field])) {
            errors.push(`${field} must be a non-empty string`);
        }
    }
    if (value.economicsObservations !== undefined) {
        if (!Array.isArray(value.economicsObservations)) {
            errors.push("economicsObservations must be an array");
        }
        else {
            const valid = [];
            for (const [index, observation] of value.economicsObservations.entries()) {
                const itemErrors = validateEconomicsObservation(observation);
                errors.push(...itemErrors.map((error) => `economicsObservations[${index}]: ${error}`));
                if (itemErrors.length === 0)
                    valid.push(observation);
            }
            errors.push(...normalizeEconomicsObservations(valid).errors.map((error) => `economicsObservations: ${error}`));
        }
    }
    if (value.economicTraceSpans !== undefined) {
        if (!Array.isArray(value.economicTraceSpans)) {
            errors.push("economicTraceSpans must be an array");
        }
        else {
            const valid = [];
            for (const [index, span] of value.economicTraceSpans.entries()) {
                const itemErrors = validateEconomicTraceSpan(span);
                errors.push(...itemErrors.map((error) => `economicTraceSpans[${index}]: ${error}`));
                if (itemErrors.length === 0)
                    valid.push(span);
            }
            errors.push(...validateEconomicTrace(valid).map((error) => `economicTraceSpans: ${error}`));
        }
    }
    if (value.adapterManifest !== undefined) {
        errors.push(...validateAdapterManifest(value.adapterManifest).map((error) => `adapterManifest: ${error}`));
    }
    if (value.resourceBudgetOutcome !== undefined) {
        errors.push(...validateResourceBudgetOutcome(value.resourceBudgetOutcome).map((error) => `resourceBudgetOutcome: ${error}`));
    }
    if (value.artifacts !== undefined && (!isRecord(value.artifacts) || Object.values(value.artifacts).some((item) => !nonEmptyString(item)))) {
        errors.push("artifacts must contain non-empty string paths");
    }
    return unique(errors);
}
export function normalizeEconomicsObservations(observations) {
    const errors = [];
    const warnings = [];
    const seenObservationIds = new Set();
    const valid = [];
    for (const [index, observation] of observations.entries()) {
        const observationErrors = validateEconomicsObservation(observation);
        const observationId = isRecord(observation) && typeof observation.observationId === "string"
            ? observation.observationId
            : undefined;
        if (observationId !== undefined && seenObservationIds.has(observationId)) {
            observationErrors.push(`duplicate observationId ${observation.observationId}`);
        }
        if (observationId !== undefined)
            seenObservationIds.add(observationId);
        errors.push(...observationErrors.map((error) => `observations[${index}]: ${error}`));
        if (observationErrors.length === 0) {
            valid.push(cloneJson(observation));
        }
    }
    validateSeriesContracts(valid, errors);
    const usageTotals = {};
    for (const field of USAGE_FIELDS) {
        const normalized = field === "maxAgentDepth"
            ? normalizeMaximumMetric(valid, field, errors)
            : normalizeMetric(valid, field, errors);
        if (normalized !== undefined) {
            usageTotals[field] = normalized;
        }
    }
    const costs = normalizeCosts(valid, errors);
    const coverage = {};
    for (const field of USAGE_FIELDS) {
        const resource = field === "maxAgentDepth" ? "agentDepth" : field;
        coverage[resource] = summarizeMetricCoverage(valid.filter((observation) => observation.usage?.[field] !== undefined), errors.length > 0);
    }
    coverage.wallTimeMs = { status: "unavailable", observationCount: 0, completeObservationCount: 0 };
    coverage.implementationIterations = { status: "unavailable", observationCount: 0, completeObservationCount: 0 };
    coverage.cost = summarizeMetricCoverage(valid.filter((observation) => observation.cost !== undefined), errors.length > 0);
    if (valid.some((observation) => observation.accounting === "inclusive_checkpoint")) {
        warnings.push("inclusive checkpoint observations were retained for reconciliation and excluded from additive totals");
    }
    if (errors.length > 0) {
        warnings.push("one or more economics observations were invalid; totals are not claim-ready");
    }
    return {
        envelope: {
            version: "ruhroh_economics_envelope_v1",
            scope: "run",
            observations: valid,
            totals: { usage: usageTotals, costs },
            coverage,
            legacy: false,
            warnings,
        },
        errors,
    };
}
export function legacyUsageToEconomicsEnvelope(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const usage = {};
    for (const field of ["inputTokens", "outputTokens", "totalTokens"]) {
        if (nonNegativeFiniteNumber(value[field])) {
            usage[field] = Number(value[field]);
        }
    }
    const cost = nonNegativeFiniteNumber(value.costUsd)
        ? { amount: Number(value.costUsd), currency: "USD", kind: "manual" }
        : undefined;
    if (Object.keys(usage).length === 0 && cost === undefined) {
        return undefined;
    }
    const observation = {
        version: "ruhroh_economics_observation_v1",
        observationId: "legacy-usage-snapshot",
        seriesId: "legacy-usage-snapshot",
        sequence: 1,
        scope: "run",
        aggregation: "cumulative",
        accounting: "exclusive",
        coverage: { status: "unknown", missingReasons: ["legacy usage has no delta/cumulative or completeness contract"] },
        source: { kind: "legacy", name: "ruhroh_run_agent_result_v1", quality: "legacy" },
        ...(Object.keys(usage).length === 0 ? {} : { usage }),
        ...(cost === undefined ? {} : { cost }),
    };
    const normalized = normalizeEconomicsObservations([observation]).envelope;
    return {
        ...normalized,
        legacy: true,
        warnings: [
            ...normalized.warnings,
            "legacy usage is observed with unknown completeness and is not eligible for unit economics",
        ],
    };
}
export function validateEconomicTraceSpan(value) {
    const errors = tracePrivacyErrors(value);
    if (!isRecord(value)) {
        return unique(["trace span must be an object", ...errors]);
    }
    const allowedTopLevel = new Set([
        "version",
        "traceId",
        "spanId",
        "parentSpanId",
        "links",
        "kind",
        "status",
        "startedAt",
        "endedAt",
        "durationMs",
        "iteration",
        "agent",
        "inference",
        "resourceObservationRefs",
        "evidenceRefs",
        "eventTypes",
    ]);
    for (const key of Object.keys(value)) {
        if (!allowedTopLevel.has(key)) {
            errors.push(`unsupported trace field ${key}`);
        }
    }
    if (value.version !== "ruhroh_economic_trace_span_v1") {
        errors.push("version must be ruhroh_economic_trace_span_v1");
    }
    if (!TRACE_ID_PATTERN.test(String(value.traceId ?? "")) || !TRACE_ID_PATTERN.test(String(value.spanId ?? ""))) {
        errors.push("traceId and spanId must be safe opaque identifiers between 8 and 128 characters");
    }
    if (value.parentSpanId !== undefined && !TRACE_ID_PATTERN.test(String(value.parentSpanId)))
        errors.push("parentSpanId must be a safe opaque identifier");
    if (value.links !== undefined && (!Array.isArray(value.links) || value.links.some((link) => !TRACE_ID_PATTERN.test(String(link))) || new Set(value.links).size !== value.links.length))
        errors.push("links must contain unique safe opaque identifiers");
    if (!TRACE_KINDS.has(value.kind)) {
        errors.push("kind is not a supported economic trace span kind");
    }
    if (!TRACE_STATUSES.has(value.status)) {
        errors.push("status is not a supported economic trace span status");
    }
    if (!nonEmptyString(value.startedAt)) {
        errors.push("startedAt must be a non-empty timestamp");
    }
    if (value.durationMs !== undefined && !nonNegativeFiniteNumber(value.durationMs)) {
        errors.push("durationMs must be a non-negative finite number");
    }
    if (value.iteration !== undefined && (!Number.isInteger(value.iteration) || Number(value.iteration) < 1)) {
        errors.push("iteration must be a positive integer");
    }
    if (value.evidenceRefs !== undefined) {
        if (!Array.isArray(value.evidenceRefs)) {
            errors.push("evidenceRefs must be an array");
        }
        else {
            for (const [index, ref] of value.evidenceRefs.entries()) {
                if (!isRecord(ref) || Object.keys(ref).some((key) => key !== "artifact" && key !== "sha256") || !nonEmptyString(ref.artifact) || !/^[a-f0-9]{64}$/u.test(String(ref.sha256 ?? ""))) {
                    errors.push(`evidenceRefs[${index}] must include artifact and lowercase SHA-256`);
                }
            }
        }
    }
    if (value.eventTypes !== undefined && (!Array.isArray(value.eventTypes) || value.eventTypes.some((eventType) => !TRACE_EVENT_TYPE_PATTERN.test(String(eventType))) || new Set(value.eventTypes).size !== value.eventTypes.length)) {
        errors.push("eventTypes must contain unique bounded event-name metadata");
    }
    if (value.resourceObservationRefs !== undefined && (!Array.isArray(value.resourceObservationRefs) || value.resourceObservationRefs.some((ref) => !nonEmptyString(ref)) || new Set(value.resourceObservationRefs).size !== value.resourceObservationRefs.length)) {
        errors.push("resourceObservationRefs must contain unique non-empty observation identifiers");
    }
    if (value.agent !== undefined) {
        if (!isRecord(value.agent)) {
            errors.push("agent must be an object");
        }
        else {
            const allowed = new Set(["adapterId", "agentIdHash", "parentAgentIdHash", "depth"]);
            for (const key of Object.keys(value.agent)) {
                if (!allowed.has(key))
                    errors.push(`agent contains unsupported field ${key}`);
            }
            for (const key of ["agentIdHash", "parentAgentIdHash"]) {
                if (value.agent[key] !== undefined && !/^[a-f0-9]{64}$/u.test(String(value.agent[key]))) {
                    errors.push(`agent.${key} must be a lowercase SHA-256`);
                }
            }
            if (value.agent.depth !== undefined && (!Number.isInteger(value.agent.depth) || Number(value.agent.depth) < 0))
                errors.push("agent.depth must be a non-negative integer");
            if (value.agent.adapterId !== undefined && !nonEmptyString(value.agent.adapterId))
                errors.push("agent.adapterId must be a non-empty string");
        }
    }
    if (value.inference !== undefined) {
        if (!isRecord(value.inference)) {
            errors.push("inference must be an object");
        }
        else {
            const allowed = new Set(["provider", "model", "modelVersion", "routeHash", "requestIdHash"]);
            for (const key of Object.keys(value.inference)) {
                if (!allowed.has(key))
                    errors.push(`inference contains unsupported field ${key}`);
            }
            for (const key of ["routeHash", "requestIdHash"]) {
                if (value.inference[key] !== undefined && !/^[a-f0-9]{64}$/u.test(String(value.inference[key]))) {
                    errors.push(`inference.${key} must be a lowercase SHA-256`);
                }
            }
            for (const key of ["provider", "model", "modelVersion"]) {
                if (value.inference[key] !== undefined && !nonEmptyString(value.inference[key]))
                    errors.push(`inference.${key} must be a non-empty string`);
            }
        }
    }
    return unique(errors);
}
export function validateEconomicTrace(spans) {
    const errors = [];
    const byId = new Map();
    for (const [index, span] of spans.entries()) {
        errors.push(...validateEconomicTraceSpan(span).map((error) => `spans[${index}]: ${error}`));
        if (byId.has(span.spanId)) {
            errors.push(`spans[${index}]: duplicate spanId ${span.spanId}`);
        }
        byId.set(span.spanId, span);
    }
    for (const span of spans) {
        if (span.parentSpanId !== undefined && !byId.has(span.parentSpanId)) {
            errors.push(`span ${span.spanId}: missing parentSpanId ${span.parentSpanId}`);
        }
        else if (span.parentSpanId !== undefined && byId.get(span.parentSpanId)?.traceId !== span.traceId) {
            errors.push(`span ${span.spanId}: parent belongs to a different trace`);
        }
        for (const link of span.links ?? []) {
            if (!byId.has(link)) {
                errors.push(`span ${span.spanId}: missing link ${link}`);
            }
        }
        const visited = new Set();
        let cursor = span;
        while (cursor?.parentSpanId !== undefined) {
            if (visited.has(cursor.parentSpanId) || cursor.parentSpanId === span.spanId) {
                errors.push(`span ${span.spanId}: parent cycle detected`);
                break;
            }
            visited.add(cursor.parentSpanId);
            cursor = byId.get(cursor.parentSpanId);
        }
    }
    return unique(errors);
}
export function finalizeEconomicTraceJsonl(input) {
    const text = typeof input === "string" ? input : input.toString("utf8");
    if (text.length === 0) {
        return {
            spans: [],
            jsonl: "",
            sha256: createHash("sha256").update("").digest("hex"),
            byteLength: 0,
            truncatedFinalRecord: false,
            errors: [],
        };
    }
    const hasFinalNewline = text.endsWith("\n");
    const lines = text.split("\n");
    if (hasFinalNewline)
        lines.pop();
    const spans = [];
    const errors = [];
    let truncatedFinalRecord = false;
    for (const [index, rawLine] of lines.entries()) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (line.trim().length === 0) {
            errors.push(`line ${index + 1}: blank JSONL records are not allowed`);
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch {
            if (index === lines.length - 1 && !hasFinalNewline) {
                truncatedFinalRecord = true;
                break;
            }
            errors.push(`line ${index + 1}: malformed JSON record`);
            continue;
        }
        const spanErrors = validateEconomicTraceSpan(parsed);
        errors.push(...spanErrors.map((error) => `line ${index + 1}: ${error}`));
        if (spanErrors.length === 0)
            spans.push(cloneJson(parsed));
    }
    errors.push(...validateEconomicTrace(spans));
    const jsonl = spans.map((span) => `${canonicalJson(span)}\n`).join("");
    const byteLength = Buffer.byteLength(jsonl);
    return {
        spans,
        jsonl,
        ...(errors.length === 0 ? { sha256: createHash("sha256").update(jsonl).digest("hex") } : {}),
        byteLength,
        truncatedFinalRecord,
        errors: unique(errors),
    };
}
export function validateAdapterManifest(value) {
    const errors = [];
    if (!isRecord(value)) {
        return ["adapter manifest must be an object"];
    }
    if (value.version !== "ruhroh_adapter_manifest_v1") {
        errors.push("version must be ruhroh_adapter_manifest_v1");
    }
    for (const key of Object.keys(value)) {
        if (!new Set(["version", "adapterId", "adapterVersion", "resultProtocol", "traceProtocol", "resources"]).has(key)) {
            errors.push(`adapter manifest contains unsupported field ${key}`);
        }
    }
    if (!nonEmptyString(value.adapterId) || !nonEmptyString(value.adapterVersion)) {
        errors.push("adapterId and adapterVersion must be non-empty strings");
    }
    if (value.resultProtocol !== "ruhroh_run_agent_result_v1" && value.resultProtocol !== "ruhroh_run_agent_result_v2") {
        errors.push("resultProtocol must be ruhroh_run_agent_result_v1 or ruhroh_run_agent_result_v2");
    }
    if (value.traceProtocol !== undefined && value.traceProtocol !== "ruhroh_economic_trace_span_v1") {
        errors.push("traceProtocol must be ruhroh_economic_trace_span_v1");
    }
    if (!isRecord(value.resources)) {
        errors.push("resources must be an object");
    }
    else {
        for (const [resource, capability] of Object.entries(value.resources)) {
            if (!isEconomicResource(resource)) {
                errors.push(`resources contains unsupported resource ${resource}`);
                continue;
            }
            if (!isRecord(capability) || typeof capability.observable !== "boolean") {
                errors.push(`resources.${resource} must include observable`);
                continue;
            }
            if (Object.keys(capability).some((key) => key !== "observable" && key !== "enforcement" && key !== "source")) {
                errors.push(`resources.${resource} contains unsupported fields`);
            }
            if (!new Set(["preemptive", "boundary", "unsupported"]).has(String(capability.enforcement))) {
                errors.push(`resources.${resource}.enforcement is invalid`);
            }
            if (capability.source !== "runtime" && capability.source !== "connector") {
                errors.push(`resources.${resource}.source is invalid`);
            }
            if (capability.observable === false && capability.enforcement !== "unsupported") {
                errors.push(`resources.${resource} cannot declare enforcement when it is not observable`);
            }
        }
    }
    return errors;
}
export function validateResourceBudgets(value) {
    const errors = [];
    if (!isRecord(value)) {
        return ["resource budgets must be an object"];
    }
    for (const key of Object.keys(value)) {
        if (!new Set(["version", "scope", "onUnobservable", "limits"]).has(key))
            errors.push(`resource budgets contain unsupported field ${key}`);
    }
    if (value.version !== "ruhroh_resource_budgets_v1" || value.scope !== "implementation" || value.onUnobservable !== "fail") {
        errors.push("resource budgets require v1, implementation scope, and fail-closed unobservable policy");
    }
    if (!Array.isArray(value.limits) || value.limits.length === 0) {
        errors.push("limits must be a non-empty array");
        return errors;
    }
    const seen = new Set();
    for (const [index, rawLimit] of value.limits.entries()) {
        if (!isRecord(rawLimit) || !isEconomicResource(rawLimit.resource)) {
            errors.push(`limits[${index}].resource is invalid`);
            continue;
        }
        for (const key of Object.keys(rawLimit)) {
            if (!new Set(["resource", "max", "currency", "requiredEnforcement"]).has(key))
                errors.push(`limits[${index}] contains unsupported field ${key}`);
        }
        const key = rawLimit.resource === "cost" ? `cost:${String(rawLimit.currency ?? "")}` : rawLimit.resource;
        if (seen.has(key)) {
            errors.push(`limits[${index}] duplicates ${key}`);
        }
        seen.add(key);
        if (!nonNegativeFiniteNumber(rawLimit.max)) {
            errors.push(`limits[${index}].max must be a non-negative finite number`);
        }
        if (rawLimit.requiredEnforcement !== "preemptive" && rawLimit.requiredEnforcement !== "boundary") {
            errors.push(`limits[${index}].requiredEnforcement must be preemptive or boundary`);
        }
        if (rawLimit.resource === "cost" && !/^[A-Z]{3}$/u.test(String(rawLimit.currency ?? ""))) {
            errors.push(`limits[${index}].currency is required for cost and must be uppercase ISO-style code`);
        }
    }
    return errors;
}
export function validateResourceBudgetOutcome(value) {
    if (!isRecord(value))
        return ["resource budget outcome must be an object"];
    const errors = [];
    if (value.version !== "ruhroh_resource_budget_outcome_v1" || value.scope !== "implementation") {
        errors.push("resource budget outcome requires v1 and implementation scope");
    }
    if (!new Set(["within", "exhausted", "overrun", "unobservable"]).has(String(value.status))) {
        errors.push("resource budget outcome status is invalid");
    }
    if (!Array.isArray(value.limits)) {
        errors.push("resource budget outcome limits must be an array");
        return errors;
    }
    for (const [index, limit] of value.limits.entries()) {
        if (!isRecord(limit) || !isEconomicResource(limit.resource)) {
            errors.push(`limits[${index}].resource is invalid`);
            continue;
        }
        if (!nonNegativeFiniteNumber(limit.limit))
            errors.push(`limits[${index}].limit must be non-negative`);
        if (limit.observed !== undefined && !nonNegativeFiniteNumber(limit.observed))
            errors.push(`limits[${index}].observed must be non-negative`);
        if (limit.enforcement !== "preemptive" && limit.enforcement !== "boundary")
            errors.push(`limits[${index}].enforcement is invalid`);
        if (!new Set(["complete", "partial", "unknown", "unavailable"]).has(String(limit.coverage)))
            errors.push(`limits[${index}].coverage is invalid`);
        if (!new Set(["within", "exhausted", "overrun", "unobservable"]).has(String(limit.status)))
            errors.push(`limits[${index}].status is invalid`);
    }
    if (value.termination !== undefined) {
        errors.push(...validateProcessTermination(value.termination).map((error) => `termination: ${error}`));
    }
    return errors;
}
export function validateProcessTermination(value) {
    if (!isRecord(value))
        return ["process termination must be an object"];
    const errors = [];
    const allowed = new Set([
        "version",
        "scope",
        "reason",
        "timeoutMs",
        "timeoutObservedAtMs",
        "gracePeriodMs",
        "signalsSent",
        "terminatedBy",
        "terminationDurationMs",
        "terminatedAtMs",
        "limitMs",
        "overrunMs",
    ]);
    for (const key of Object.keys(value)) {
        if (!allowed.has(key))
            errors.push(`process termination contains unsupported field ${key}`);
    }
    if (value.version !== "ruhroh_process_termination_v1")
        errors.push("version must be ruhroh_process_termination_v1");
    if (value.scope !== "process_group" && value.scope !== "process")
        errors.push("scope must be process_group or process");
    if (value.reason !== "wall_time_limit" && value.reason !== "iteration_timeout")
        errors.push("reason must be wall_time_limit or iteration_timeout");
    for (const field of ["timeoutMs", "timeoutObservedAtMs", "terminationDurationMs", "terminatedAtMs", "limitMs", "overrunMs"]) {
        if (value[field] !== undefined && !nonNegativeFiniteNumber(value[field]))
            errors.push(`${field} must be a non-negative finite number`);
    }
    if (value.gracePeriodMs !== 5000)
        errors.push("gracePeriodMs must be 5000");
    if (!Array.isArray(value.signalsSent) || value.signalsSent.some((signal) => signal !== "SIGTERM" && signal !== "SIGKILL")) {
        errors.push("signalsSent must contain only SIGTERM and SIGKILL");
    }
    else if (value.signalsSent.join(",") !== [...new Set(value.signalsSent)].join(",")) {
        errors.push("signalsSent must not contain duplicates");
    }
    else if (value.signalsSent.includes("SIGKILL") && value.signalsSent[0] !== "SIGTERM") {
        errors.push("SIGKILL must be preceded by SIGTERM");
    }
    if (!new Set(["already_exited", "SIGTERM", "SIGKILL", "not_found"]).has(String(value.terminatedBy))) {
        errors.push("terminatedBy is invalid");
    }
    if (nonNegativeFiniteNumber(value.timeoutObservedAtMs) && nonNegativeFiniteNumber(value.terminatedAtMs) && value.terminatedAtMs < value.timeoutObservedAtMs) {
        errors.push("terminatedAtMs must be at or after timeoutObservedAtMs");
    }
    if (value.reason === "wall_time_limit") {
        if (!nonNegativeFiniteNumber(value.limitMs) || !nonNegativeFiniteNumber(value.overrunMs)) {
            errors.push("wall_time_limit termination requires limitMs and overrunMs");
        }
        else if (nonNegativeFiniteNumber(value.terminatedAtMs) && Math.abs(value.overrunMs - Math.max(0, value.terminatedAtMs - value.limitMs)) > 1) {
            errors.push("overrunMs must equal terminatedAtMs minus limitMs, bounded at zero");
        }
    }
    else if (value.limitMs !== undefined || value.overrunMs !== undefined) {
        errors.push("iteration_timeout termination cannot include limitMs or overrunMs");
    }
    return unique(errors);
}
export function budgetCapabilityErrors(manifest, budgets) {
    const errors = validateResourceBudgets(budgets);
    if (manifest !== undefined) {
        errors.push(...validateAdapterManifest(manifest));
    }
    for (const limit of budgets.limits) {
        const capability = RUHROH_RUNTIME_RESOURCE_CAPABILITIES[limit.resource] ?? manifest?.resources[limit.resource];
        if (capability === undefined || !capability.observable || capability.enforcement === "unsupported") {
            errors.push(`${limit.resource} is not observable by the runtime or adapter`);
            continue;
        }
        if (!enforcementSatisfies(capability.enforcement, limit.requiredEnforcement)) {
            errors.push(`${limit.resource} requires ${limit.requiredEnforcement} enforcement but only ${capability.enforcement} is available`);
        }
    }
    return unique(errors);
}
export function evaluateResourceBudgets(budgets, observed, capabilities = {}, completed = false) {
    const outcomes = budgets.limits.map((limit) => {
        const coverage = observed.coverage[limit.resource] ?? "unavailable";
        const value = limit.resource === "cost"
            ? observed.costs[limit.currency ?? ""]
            : observed.values[limit.resource];
        const capability = RUHROH_RUNTIME_RESOURCE_CAPABILITIES[limit.resource] ?? capabilities[limit.resource];
        const enforcement = capability?.enforcement === "preemptive" ? "preemptive" : "boundary";
        let status = "within";
        if (coverage !== "complete" || value === undefined) {
            status = "unobservable";
        }
        else if (value > limit.max) {
            status = "overrun";
        }
        else if (value === limit.max && !completed) {
            status = "exhausted";
        }
        return {
            resource: limit.resource,
            limit: limit.max,
            ...(limit.currency === undefined ? {} : { currency: limit.currency }),
            ...(value === undefined ? {} : { observed: value }),
            enforcement,
            coverage,
            status,
        };
    });
    const status = outcomes.some((outcome) => outcome.status === "unobservable")
        ? "unobservable"
        : outcomes.some((outcome) => outcome.status === "overrun")
            ? "overrun"
            : outcomes.some((outcome) => outcome.status === "exhausted")
                ? "exhausted"
                : "within";
    return { version: "ruhroh_resource_budget_outcome_v1", scope: "implementation", status, limits: outcomes };
}
export function runAdapterConformance(input) {
    const checks = [];
    const addCheck = (name, errors) => {
        checks.push({
            name,
            status: errors.length === 0 ? "passed" : "failed",
            details: errors.length === 0 ? "ok" : errors.join("; "),
        });
    };
    addCheck("manifest", validateAdapterManifest(input.manifest));
    if (input.observations !== undefined) {
        addCheck("economics", normalizeEconomicsObservations(input.observations).errors);
        addCheck("capabilities", observationCapabilityErrors(input.manifest, input.observations));
    }
    if (input.spans !== undefined) {
        addCheck("trace", [
            ...(input.spans.length > 0 && input.manifest.traceProtocol !== "ruhroh_economic_trace_span_v1"
                ? ["trace spans require traceProtocol ruhroh_economic_trace_span_v1"]
                : []),
            ...validateEconomicTrace(input.spans),
        ]);
    }
    return {
        version: "ruhroh_adapter_conformance_v1",
        adapterId: input.manifest.adapterId,
        adapterVersion: input.manifest.adapterVersion,
        manifestSha256: sha256CanonicalJson(input.manifest),
        passed: checks.every((check) => check.status === "passed"),
        checks,
    };
}
export function sha256CanonicalJson(value) {
    return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
function normalizeMetric(observations, field, errors) {
    const additive = observations.filter((observation) => observation.accounting === "exclusive" && observation.usage?.[field] !== undefined);
    if (additive.length === 0) {
        return undefined;
    }
    let total = 0;
    const cumulative = new Map();
    for (const observation of additive) {
        if (observation.aggregation === "delta") {
            total += Number(observation.usage?.[field] ?? 0);
        }
        else {
            cumulative.set(observation.seriesId, [...(cumulative.get(observation.seriesId) ?? []), observation]);
        }
    }
    for (const [seriesId, series] of cumulative) {
        const sorted = [...series].sort((left, right) => left.sequence - right.sequence);
        let previous = -1;
        for (const observation of sorted) {
            const value = Number(observation.usage?.[field] ?? 0);
            if (value < previous) {
                errors.push(`cumulative series ${seriesId} decreased for ${String(field)} at sequence ${observation.sequence}`);
            }
            previous = value;
        }
        total += Math.max(0, previous);
    }
    return total;
}
function normalizeMaximumMetric(observations, field, errors) {
    const relevant = observations.filter((observation) => observation.accounting === "exclusive" && observation.usage?.[field] !== undefined);
    if (relevant.length === 0)
        return undefined;
    const cumulative = new Map();
    for (const observation of relevant) {
        if (observation.aggregation === "cumulative") {
            cumulative.set(observation.seriesId, [...(cumulative.get(observation.seriesId) ?? []), observation]);
        }
    }
    for (const [seriesId, series] of cumulative) {
        let previous = -1;
        for (const observation of [...series].sort((left, right) => left.sequence - right.sequence)) {
            const value = Number(observation.usage?.[field] ?? 0);
            if (value < previous)
                errors.push(`cumulative series ${seriesId} decreased for ${field} at sequence ${observation.sequence}`);
            previous = value;
        }
    }
    return Math.max(...relevant.map((observation) => Number(observation.usage?.[field] ?? 0)));
}
function validateSeriesContracts(observations, errors) {
    const series = new Map();
    for (const observation of observations) {
        series.set(observation.seriesId, [...(series.get(observation.seriesId) ?? []), observation]);
    }
    for (const [seriesId, items] of series) {
        if (new Set(items.map((item) => item.aggregation)).size > 1) {
            errors.push(`series ${seriesId} mixes delta and cumulative aggregation`);
        }
        const cumulativeSequences = items
            .filter((item) => item.aggregation === "cumulative")
            .map((item) => item.sequence);
        if (new Set(cumulativeSequences).size !== cumulativeSequences.length) {
            errors.push(`cumulative series ${seriesId} repeats a sequence number`);
        }
    }
}
function observationCapabilityErrors(manifest, observations) {
    const observed = new Set();
    for (const observation of observations) {
        for (const field of USAGE_FIELDS) {
            if (observation.usage?.[field] !== undefined) {
                observed.add(field === "maxAgentDepth" ? "agentDepth" : field);
            }
        }
        if (observation.cost !== undefined)
            observed.add("cost");
    }
    return [...observed]
        .filter((resource) => manifest.resources[resource]?.observable !== true)
        .map((resource) => `${resource} was observed but is not declared observable by the adapter manifest`);
}
function normalizeCosts(observations, errors) {
    const totals = new Map();
    const additive = observations.filter((observation) => observation.accounting === "exclusive" && observation.cost !== undefined);
    const cumulative = new Map();
    for (const observation of additive) {
        const cost = observation.cost;
        if (cost === undefined) {
            continue;
        }
        const state = totals.get(cost.currency) ?? { amount: 0, kinds: new Set() };
        state.kinds.add(cost.kind);
        totals.set(cost.currency, state);
        if (observation.aggregation === "delta") {
            state.amount += cost.amount;
        }
        else {
            cumulative.set(`${observation.seriesId}\0${cost.currency}`, [...(cumulative.get(`${observation.seriesId}\0${cost.currency}`) ?? []), observation]);
        }
    }
    for (const [seriesKey, series] of cumulative) {
        const sorted = [...series].sort((left, right) => left.sequence - right.sequence);
        let previous = -1;
        for (const observation of sorted) {
            const value = observation.cost?.amount ?? 0;
            if (value < previous) {
                errors.push(`cumulative series ${seriesKey.replace("\0", "/")} decreased for cost at sequence ${observation.sequence}`);
            }
            previous = value;
        }
        const currency = sorted.at(-1)?.cost?.currency;
        if (currency !== undefined) {
            const state = totals.get(currency) ?? { amount: 0, kinds: new Set() };
            state.amount += Math.max(0, previous);
            totals.set(currency, state);
        }
    }
    return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, state]) => ({
        amount: state.amount,
        currency,
        kind: strongestCostKind(state.kinds),
    }));
}
function strongestCostKind(kinds) {
    for (const kind of ["billed", "metered", "estimated", "manual"]) {
        if (kinds.has(kind)) {
            return kind;
        }
    }
    return "manual";
}
function summarizeMetricCoverage(observations, invalid) {
    if (observations.length === 0) {
        return { status: "unavailable", observationCount: 0, completeObservationCount: 0 };
    }
    const completeObservationCount = observations.filter((observation) => observation.coverage.status === "complete").length;
    const status = invalid || observations.some((observation) => observation.coverage.status === "partial")
        ? "partial"
        : observations.some((observation) => observation.coverage.status === "unknown")
            ? "unknown"
            : "complete";
    return { status, observationCount: observations.length, completeObservationCount };
}
function tracePrivacyErrors(value, path = "span") {
    if (Array.isArray(value)) {
        return value.flatMap((item, index) => tracePrivacyErrors(item, `${path}[${index}]`));
    }
    if (!isRecord(value)) {
        return [];
    }
    const errors = [];
    for (const [key, item] of Object.entries(value)) {
        if (SENSITIVE_TRACE_KEYS.has(key.toLowerCase())) {
            errors.push(`${path}.${key} is forbidden by trace privacy policy`);
        }
        errors.push(...tracePrivacyErrors(item, `${path}.${key}`));
    }
    return errors;
}
function enforcementSatisfies(actual, required) {
    return actual === "preemptive" || actual === required;
}
function isEconomicResource(value) {
    return typeof value === "string" && RUHROH_ECONOMIC_RESOURCE_NAMES.includes(value);
}
function nonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function nonNegativeFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function unique(values) {
    return [...new Set(values)];
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function canonicalJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
    }
    if (isRecord(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
//# sourceMappingURL=economics-runtime.js.map