from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import os
import platform
import signal
import shlex
import shutil
import subprocess
import sys
import tarfile
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable


RESULT_MARKER_PREFIX = "RUHROH_RESULT_JSON_BASE64:"
DEFAULT_DATASET = "ruhroh@local"
DEFAULT_ADAPTER = "ruhroh-harbor"
DEFAULT_MAX_ITERATIONS = 3
SKIP_WORKSPACE_TAR_NAMES = {"node_modules", ".next", "dist", "build", ".git"}
WORKSPACE_SUMMARY_MAX_FILES = 200
WORKSPACE_SUMMARY_HASH_MAX_BYTES = 1024 * 1024
COMPLETION_TERMINAL_FAILURE_REASONS = {"cannot_satisfy", "policy_blocked", "out_of_scope", "runtime_failure", "infra_failure", "cancelled"}
SCHEMA_BASE_URL = "https://lumicorp.github.io/ruhroh/schemas"
EVAL_RESULT_SCHEMA_URL = f"{SCHEMA_BASE_URL}/eval-result-v1.schema.json"
LOOP_RESULT_SCHEMA_URL = f"{SCHEMA_BASE_URL}/loop-result-v1.schema.json"
RUN_MANIFEST_SCHEMA_URL = f"{SCHEMA_BASE_URL}/run-manifest-v1.schema.json"
WORKSPACE_SUMMARY_SCHEMA_URL = f"{SCHEMA_BASE_URL}/workspace-summary-v1.schema.json"
ECONOMIC_TRACE_PATH_NAME = "ruhroh-economic-trace.jsonl"
ECONOMIC_RESOURCE_NAMES = {
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
}
ECONOMIC_USAGE_FIELDS = (
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
)
TRACE_KINDS = {
    "agent_turn",
    "inference",
    "tool",
    "retrieval",
    "embedding",
    "route_decision",
    "retry",
    "fallback",
    "child_agent",
}
TRACE_STATUSES = {"ok", "error", "timeout", "cancelled", "unknown"}
TRACE_ALLOWED_FIELDS = {
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
}
TRACE_SENSITIVE_KEYS = {
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
}
RUNTIME_RESOURCE_CAPABILITIES = {
    "wallTimeMs": {"observable": True, "enforcement": "preemptive", "source": "runtime"},
    "implementationIterations": {"observable": True, "enforcement": "preemptive", "source": "runtime"},
}
PROCESS_TERMINATION_GRACE_SECONDS = 5


class ResourceBudgetStop(RuntimeError):
    def __init__(self, reason: str, message: str, outcome: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.reason = reason
        self.outcome = outcome


def is_nonnegative_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value >= 0


def validate_economics_observation(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return ["observation must be an object"]
    errors: list[str] = []
    allowed_observation_fields = {"version", "observationId", "seriesId", "sequence", "scope", "aggregation", "accounting", "coverage", "source", "usage", "cost"}
    errors.extend(f"observation contains unsupported field {key}" for key in value if key not in allowed_observation_fields)
    if value.get("version") != "ruhroh_economics_observation_v1":
        errors.append("version must be ruhroh_economics_observation_v1")
    for field in ("observationId", "seriesId"):
        if not isinstance(value.get(field), str) or not value[field].strip():
            errors.append(f"{field} must be a non-empty string")
    sequence = value.get("sequence")
    if not isinstance(sequence, int) or isinstance(sequence, bool) or sequence < 1:
        errors.append("sequence must be a positive integer")
    if value.get("scope") not in {"model_call", "turn", "session", "run"}:
        errors.append("scope must be model_call, turn, session, or run")
    if value.get("aggregation") not in {"delta", "cumulative"}:
        errors.append("aggregation must be delta or cumulative")
    if value.get("accounting") not in {"exclusive", "inclusive_checkpoint"}:
        errors.append("accounting must be exclusive or inclusive_checkpoint")
    coverage = value.get("coverage")
    if not isinstance(coverage, dict) or coverage.get("status") not in {"complete", "partial", "unknown"}:
        errors.append("coverage.status must be complete, partial, or unknown")
    else:
        if any(key not in {"status", "missingReasons"} for key in coverage):
            errors.append("coverage contains unsupported fields")
        if "missingReasons" in coverage and (not isinstance(coverage["missingReasons"], list) or any(not isinstance(reason, str) or not reason.strip() for reason in coverage["missingReasons"])):
            errors.append("coverage.missingReasons must contain non-empty strings")
    source = value.get("source")
    if not isinstance(source, dict) or any(not isinstance(source.get(field), str) or not source[field].strip() for field in ("kind", "name", "quality")):
        errors.append("source must include non-empty kind, name, and quality")
    else:
        if any(key not in {"kind", "name", "quality", "observedAt", "priceBasisId"} for key in source):
            errors.append("source contains unsupported fields")
        if source.get("kind") not in {"provider_api", "gateway", "sdk", "adapter", "runtime", "invoice", "environment", "legacy"} or source.get("quality") not in {"billed", "metered", "reported", "estimated", "manual", "legacy"}:
            errors.append("source kind or quality is invalid")
    usage = value.get("usage")
    if usage is not None:
        if not isinstance(usage, dict):
            errors.append("usage must be an object")
        else:
            errors.extend(f"usage contains unsupported field {key}" for key in usage if key not in ECONOMIC_USAGE_FIELDS)
            if not usage:
                errors.append("usage must include at least one supported metric")
            for field in ECONOMIC_USAGE_FIELDS:
                if field in usage and not is_nonnegative_number(usage[field]):
                    errors.append(f"usage.{field} must be a non-negative finite number")
    cost = value.get("cost")
    if cost is not None:
        if not isinstance(cost, dict):
            errors.append("cost must be an object")
        else:
            if any(key not in {"amount", "currency", "kind"} for key in cost):
                errors.append("cost contains unsupported fields")
            if not is_nonnegative_number(cost.get("amount")):
                errors.append("cost.amount must be a non-negative finite number")
            currency = cost.get("currency")
            if not isinstance(currency, str) or len(currency) != 3 or not currency.isalpha() or currency.upper() != currency:
                errors.append("cost.currency must be a three-letter uppercase currency code")
            if cost.get("kind") not in {"billed", "metered", "estimated", "manual"}:
                errors.append("cost.kind must be billed, metered, estimated, or manual")
    if usage is None and cost is None:
        errors.append("observation must include usage or cost")
    return errors


def normalize_economics_observations(observations: list[dict[str, Any]]) -> tuple[dict[str, Any], list[str]]:
    errors: list[str] = []
    valid: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, observation in enumerate(observations):
        item_errors = validate_economics_observation(observation)
        observation_id = observation.get("observationId") if isinstance(observation, dict) else None
        if isinstance(observation_id, str) and observation_id in seen_ids:
            item_errors.append(f"duplicate observationId {observation_id}")
        if isinstance(observation_id, str):
            seen_ids.add(observation_id)
        errors.extend(f"observations[{index}]: {error}" for error in item_errors)
        if not item_errors:
            valid.append(json.loads(json.dumps(observation)))

    validate_economic_series_contracts(valid, errors)

    totals_usage: dict[str, float | int] = {}
    metric_observations: dict[str, list[dict[str, Any]]] = {}
    for field in ECONOMIC_USAGE_FIELDS:
        field_observations = [item for item in valid if isinstance(item.get("usage"), dict) and field in item["usage"]]
        metric_observations[field] = field_observations
        total = normalize_economic_maximum_metric(field_observations, field, errors) if field == "maxAgentDepth" else normalize_economic_metric(field_observations, field, errors)
        if total is not None:
            totals_usage[field] = total

    costs = normalize_economic_costs(valid, errors)
    cost_observations = [item for item in valid if isinstance(item.get("cost"), dict)]
    coverage: dict[str, dict[str, Any]] = {}
    for field, field_observations in metric_observations.items():
        resource = "agentDepth" if field == "maxAgentDepth" else field
        coverage[resource] = summarize_economic_coverage(field_observations, bool(errors))
    coverage["cost"] = summarize_economic_coverage(cost_observations, bool(errors))
    warnings: list[str] = []
    if any(item.get("accounting") == "inclusive_checkpoint" for item in valid):
        warnings.append("inclusive checkpoint observations were retained for reconciliation and excluded from additive totals")
    if errors:
        warnings.append("one or more economics observations were invalid; totals are not claim-ready")
    return ({
        "version": "ruhroh_economics_envelope_v1",
        "scope": "run",
        "observations": valid,
        "totals": {"usage": totals_usage, "costs": costs},
        "coverage": coverage,
        "legacy": False,
        "warnings": warnings,
    }, errors)


def validate_economic_series_contracts(observations: list[dict[str, Any]], errors: list[str]) -> None:
    series: dict[str, list[dict[str, Any]]] = {}
    for observation in observations:
        series.setdefault(observation["seriesId"], []).append(observation)
    for series_id, items in series.items():
        if len({item["aggregation"] for item in items}) > 1:
            errors.append(f"series {series_id} mixes delta and cumulative aggregation")
        sequences = [item["sequence"] for item in items if item["aggregation"] == "cumulative"]
        if len(set(sequences)) != len(sequences):
            errors.append(f"cumulative series {series_id} repeats a sequence number")


def normalize_economic_metric(observations: list[dict[str, Any]], field: str, errors: list[str]) -> float | int | None:
    additive = [item for item in observations if item.get("accounting") == "exclusive"]
    if not additive:
        return None
    total: float | int = 0
    cumulative: dict[str, list[dict[str, Any]]] = {}
    for item in additive:
        value = item["usage"][field]
        if item.get("aggregation") == "delta":
            total += value
        else:
            cumulative.setdefault(str(item.get("seriesId")), []).append(item)
    for series_id, series in cumulative.items():
        previous: float | int = -1
        for item in sorted(series, key=lambda candidate: candidate["sequence"]):
            value = item["usage"][field]
            if value < previous:
                errors.append(f"cumulative series {series_id} decreased for {field} at sequence {item['sequence']}")
            previous = value
        total += max(0, previous)
    return total


def normalize_economic_maximum_metric(observations: list[dict[str, Any]], field: str, errors: list[str]) -> float | int | None:
    relevant = [item for item in observations if item.get("accounting") == "exclusive"]
    if not relevant:
        return None
    cumulative: dict[str, list[dict[str, Any]]] = {}
    for item in relevant:
        if item.get("aggregation") == "cumulative":
            cumulative.setdefault(str(item.get("seriesId")), []).append(item)
    for series_id, series in cumulative.items():
        previous: float | int = -1
        for item in sorted(series, key=lambda candidate: candidate["sequence"]):
            value = item["usage"][field]
            if value < previous:
                errors.append(f"cumulative series {series_id} decreased for {field} at sequence {item['sequence']}")
            previous = value
    return max(item["usage"][field] for item in relevant)


def normalize_economic_costs(observations: list[dict[str, Any]], errors: list[str]) -> list[dict[str, Any]]:
    totals: dict[str, dict[str, Any]] = {}
    cumulative: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in observations:
        cost = item.get("cost")
        if item.get("accounting") != "exclusive" or not isinstance(cost, dict):
            continue
        currency = cost["currency"]
        state = totals.setdefault(currency, {"amount": 0, "kinds": set()})
        state["kinds"].add(cost["kind"])
        if item.get("aggregation") == "delta":
            state["amount"] += cost["amount"]
        else:
            cumulative.setdefault((str(item.get("seriesId")), currency), []).append(item)
    for (series_id, currency), series in cumulative.items():
        previous: float | int = -1
        for item in sorted(series, key=lambda candidate: candidate["sequence"]):
            value = item["cost"]["amount"]
            if value < previous:
                errors.append(f"cumulative series {series_id}/{currency} decreased for cost at sequence {item['sequence']}")
            previous = value
        totals[currency]["amount"] += max(0, previous)
    strength = ("billed", "metered", "estimated", "manual")
    return [
        {
            "amount": state["amount"],
            "currency": currency,
            "kind": next((kind for kind in strength if kind in state["kinds"]), "manual"),
        }
        for currency, state in sorted(totals.items())
    ]


def summarize_economic_coverage(observations: list[dict[str, Any]], invalid: bool) -> dict[str, Any]:
    if not observations:
        return {"status": "unavailable", "observationCount": 0, "completeObservationCount": 0}
    statuses = [item["coverage"]["status"] for item in observations]
    status = "partial" if invalid or "partial" in statuses else "unknown" if "unknown" in statuses else "complete"
    return {
        "status": status,
        "observationCount": len(observations),
        "completeObservationCount": statuses.count("complete"),
    }


def legacy_usage_observation(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    usage = {
        field: value[field]
        for field in ("inputTokens", "outputTokens", "totalTokens")
        if is_nonnegative_number(value.get(field))
    }
    cost = None
    if is_nonnegative_number(value.get("costUsd")):
        cost = {"amount": value["costUsd"], "currency": "USD", "kind": "manual"}
    if not usage and cost is None:
        return None
    return {
        "version": "ruhroh_economics_observation_v1",
        "observationId": "legacy-usage-snapshot",
        "seriesId": "legacy-usage-snapshot",
        "sequence": 1,
        "scope": "run",
        "aggregation": "cumulative",
        "accounting": "exclusive",
        "coverage": {"status": "unknown", "missingReasons": ["legacy usage has no delta/cumulative or completeness contract"]},
        "source": {"kind": "legacy", "name": "ruhroh_run_agent_result_v1", "quality": "legacy"},
        **({"usage": usage} if usage else {}),
        **({"cost": cost} if cost is not None else {}),
    }


def trace_privacy_errors(value: Any, path: str = "span") -> list[str]:
    if isinstance(value, list):
        return [error for index, item in enumerate(value) for error in trace_privacy_errors(item, f"{path}[{index}]")]
    if not isinstance(value, dict):
        return []
    errors: list[str] = []
    for key, item in value.items():
        if key.lower() in TRACE_SENSITIVE_KEYS:
            errors.append(f"{path}.{key} is forbidden by trace privacy policy")
        errors.extend(trace_privacy_errors(item, f"{path}.{key}"))
    return errors


def validate_economic_trace_span(value: Any) -> list[str]:
    errors = trace_privacy_errors(value)
    if not isinstance(value, dict):
        return list(dict.fromkeys(["trace span must be an object", *errors]))
    errors.extend(f"unsupported trace field {key}" for key in value if key not in TRACE_ALLOWED_FIELDS)
    if value.get("version") != "ruhroh_economic_trace_span_v1":
        errors.append("version must be ruhroh_economic_trace_span_v1")
    for field in ("traceId", "spanId"):
        identifier = value.get(field)
        if not isinstance(identifier, str) or not 8 <= len(identifier) <= 128 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-" for ch in identifier):
            errors.append("traceId and spanId must be safe opaque identifiers between 8 and 128 characters")
            break
    parent_span_id = value.get("parentSpanId")
    if parent_span_id is not None and (not isinstance(parent_span_id, str) or not 8 <= len(parent_span_id) <= 128 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-" for ch in parent_span_id)):
        errors.append("parentSpanId must be a safe opaque identifier")
    links = value.get("links")
    if links is not None and (not isinstance(links, list) or any(not isinstance(link, str) or not 8 <= len(link) <= 128 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-" for ch in link) for link in links) or len(set(links)) != len(links)):
        errors.append("links must contain unique safe opaque identifiers")
    if value.get("kind") not in TRACE_KINDS:
        errors.append("kind is not a supported economic trace span kind")
    if value.get("status") not in TRACE_STATUSES:
        errors.append("status is not a supported economic trace span status")
    if not isinstance(value.get("startedAt"), str) or not value["startedAt"].strip():
        errors.append("startedAt must be a non-empty timestamp")
    if "durationMs" in value and not is_nonnegative_number(value["durationMs"]):
        errors.append("durationMs must be a non-negative finite number")
    iteration = value.get("iteration")
    if iteration is not None and (not isinstance(iteration, int) or isinstance(iteration, bool) or iteration < 1):
        errors.append("iteration must be a positive integer")
    nested_fields = {
        "agent": {"adapterId", "agentIdHash", "parentAgentIdHash", "depth"},
        "inference": {"provider", "model", "modelVersion", "routeHash", "requestIdHash"},
    }
    for field, allowed in nested_fields.items():
        nested = value.get(field)
        if nested is not None and (not isinstance(nested, dict) or any(key not in allowed for key in nested)):
            errors.append(f"{field} contains unsupported fields")
    agent = value.get("agent")
    if isinstance(agent, dict):
        for key in ("agentIdHash", "parentAgentIdHash"):
            hashed = agent.get(key)
            if hashed is not None and (not isinstance(hashed, str) or len(hashed) != 64 or any(ch not in "0123456789abcdef" for ch in hashed)):
                errors.append(f"agent.{key} must be a lowercase SHA-256")
        if agent.get("adapterId") is not None and (not isinstance(agent["adapterId"], str) or not agent["adapterId"].strip()):
            errors.append("agent.adapterId must be a non-empty string")
        if agent.get("depth") is not None and (not isinstance(agent["depth"], int) or isinstance(agent["depth"], bool) or agent["depth"] < 0):
            errors.append("agent.depth must be a non-negative integer")
    inference = value.get("inference")
    if isinstance(inference, dict):
        for key in ("routeHash", "requestIdHash"):
            hashed = inference.get(key)
            if hashed is not None and (not isinstance(hashed, str) or len(hashed) != 64 or any(ch not in "0123456789abcdef" for ch in hashed)):
                errors.append(f"inference.{key} must be a lowercase SHA-256")
        for key in ("provider", "model", "modelVersion"):
            if inference.get(key) is not None and (not isinstance(inference[key], str) or not inference[key].strip()):
                errors.append(f"inference.{key} must be a non-empty string")
    evidence_refs = value.get("evidenceRefs")
    if evidence_refs is not None:
        if not isinstance(evidence_refs, list):
            errors.append("evidenceRefs must be an array")
        else:
            for index, ref in enumerate(evidence_refs):
                sha256 = ref.get("sha256") if isinstance(ref, dict) else None
                artifact = ref.get("artifact") if isinstance(ref, dict) else None
                if set(ref) != {"artifact", "sha256"} if isinstance(ref, dict) else True:
                    errors.append(f"evidenceRefs[{index}] must include only artifact and sha256")
                elif not isinstance(artifact, str) or not artifact.strip() or not isinstance(sha256, str) or len(sha256) != 64 or any(ch not in "0123456789abcdef" for ch in sha256):
                    errors.append(f"evidenceRefs[{index}] must include artifact and lowercase SHA-256")
    event_types = value.get("eventTypes")
    if event_types is not None and (
        not isinstance(event_types, list)
        or any(not isinstance(event_type, str) or not 1 <= len(event_type) <= 128 or any(ch not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-" for ch in event_type) for event_type in event_types)
        or len(set(event_types)) != len(event_types)
    ):
        errors.append("eventTypes must contain unique bounded event-name metadata")
    observation_refs = value.get("resourceObservationRefs")
    if observation_refs is not None and (
        not isinstance(observation_refs, list)
        or any(not isinstance(ref, str) or not ref.strip() for ref in observation_refs)
        or len(set(observation_refs)) != len(observation_refs)
    ):
        errors.append("resourceObservationRefs must contain unique non-empty observation identifiers")
    return list(dict.fromkeys(errors))


def validate_economic_trace(spans: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    by_id: dict[str, dict[str, Any]] = {}
    for index, span in enumerate(spans):
        errors.extend(f"spans[{index}]: {error}" for error in validate_economic_trace_span(span))
        span_id = span.get("spanId")
        if isinstance(span_id, str):
            if span_id in by_id:
                errors.append(f"spans[{index}]: duplicate spanId {span_id}")
            by_id[span_id] = span
    for span in spans:
        span_id = span.get("spanId")
        parent_id = span.get("parentSpanId")
        if isinstance(parent_id, str) and parent_id not in by_id:
            errors.append(f"span {span_id}: missing parentSpanId {parent_id}")
        elif isinstance(parent_id, str) and by_id[parent_id].get("traceId") != span.get("traceId"):
            errors.append(f"span {span_id}: parent belongs to a different trace")
        for link in span.get("links", []) if isinstance(span.get("links"), list) else []:
            if link not in by_id:
                errors.append(f"span {span_id}: missing link {link}")
        visited: set[str] = set()
        cursor = span
        while isinstance(cursor.get("parentSpanId"), str):
            cursor_parent = cursor["parentSpanId"]
            if cursor_parent in visited or cursor_parent == span_id:
                errors.append(f"span {span_id}: parent cycle detected")
                break
            visited.add(cursor_parent)
            cursor = by_id.get(cursor_parent, {})
    return list(dict.fromkeys(errors))


def finalize_economic_trace_jsonl(content: str | bytes) -> dict[str, Any]:
    text = content.decode("utf-8") if isinstance(content, bytes) else content
    if not text:
        return {
            "spans": [],
            "jsonl": "",
            "sha256": hashlib.sha256(b"").hexdigest(),
            "byteLength": 0,
            "truncatedFinalRecord": False,
            "errors": [],
        }
    has_final_newline = text.endswith("\n")
    lines = text.split("\n")
    if has_final_newline:
        lines.pop()
    spans: list[dict[str, Any]] = []
    errors: list[str] = []
    truncated_final_record = False
    for index, raw_line in enumerate(lines):
        line = raw_line[:-1] if raw_line.endswith("\r") else raw_line
        if not line.strip():
            errors.append(f"line {index + 1}: blank JSONL records are not allowed")
            continue
        try:
            parsed = json.loads(line)
        except json.JSONDecodeError:
            if index == len(lines) - 1 and not has_final_newline:
                truncated_final_record = True
                break
            errors.append(f"line {index + 1}: malformed JSON record")
            continue
        span_errors = validate_economic_trace_span(parsed)
        errors.extend(f"line {index + 1}: {error}" for error in span_errors)
        if not span_errors and isinstance(parsed, dict):
            spans.append(parsed)
    errors.extend(validate_economic_trace(spans))
    errors = list(dict.fromkeys(errors))
    jsonl = "".join(json.dumps(span, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n" for span in spans)
    encoded = jsonl.encode("utf-8")
    return {
        "spans": spans,
        "jsonl": jsonl,
        "byteLength": len(encoded),
        "truncatedFinalRecord": truncated_final_record,
        "errors": errors,
        **({"sha256": hashlib.sha256(encoded).hexdigest()} if not errors else {}),
    }


def validate_adapter_manifest(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return ["adapter manifest must be an object"]
    errors: list[str] = []
    allowed_fields = {"version", "adapterId", "adapterVersion", "resultProtocol", "traceProtocol", "resources"}
    errors.extend(f"adapter manifest contains unsupported field {key}" for key in value if key not in allowed_fields)
    if value.get("version") != "ruhroh_adapter_manifest_v1":
        errors.append("version must be ruhroh_adapter_manifest_v1")
    for field in ("adapterId", "adapterVersion"):
        if not isinstance(value.get(field), str) or not value[field].strip():
            errors.append(f"{field} must be a non-empty string")
    if value.get("resultProtocol") not in {"ruhroh_run_agent_result_v1", "ruhroh_run_agent_result_v2"}:
        errors.append("resultProtocol must be ruhroh_run_agent_result_v1 or ruhroh_run_agent_result_v2")
    if value.get("traceProtocol") is not None and value.get("traceProtocol") != "ruhroh_economic_trace_span_v1":
        errors.append("traceProtocol must be ruhroh_economic_trace_span_v1")
    resources = value.get("resources")
    if not isinstance(resources, dict):
        errors.append("resources must be an object")
    else:
        for resource, capability in resources.items():
            if resource not in ECONOMIC_RESOURCE_NAMES:
                errors.append(f"resources contains unsupported resource {resource}")
                continue
            if not isinstance(capability, dict) or not isinstance(capability.get("observable"), bool):
                errors.append(f"resources.{resource} must include observable")
                continue
            if capability.get("enforcement") not in {"preemptive", "boundary", "unsupported"}:
                errors.append(f"resources.{resource}.enforcement is invalid")
            if capability.get("source") not in {"runtime", "connector"}:
                errors.append(f"resources.{resource}.source is invalid")
            if capability.get("observable") is False and capability.get("enforcement") != "unsupported":
                errors.append(f"resources.{resource} cannot declare enforcement when it is not observable")
    return errors


def validate_resource_budgets(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return ["resource budgets must be an object"]
    errors: list[str] = []
    if value.get("version") != "ruhroh_resource_budgets_v1" or value.get("scope") != "implementation" or value.get("onUnobservable") != "fail":
        errors.append("resource budgets require v1, implementation scope, and fail-closed unobservable policy")
    limits = value.get("limits")
    if not isinstance(limits, list) or not limits:
        errors.append("limits must be a non-empty array")
        return errors
    seen: set[str] = set()
    for index, limit in enumerate(limits):
        if not isinstance(limit, dict) or limit.get("resource") not in ECONOMIC_RESOURCE_NAMES:
            errors.append(f"limits[{index}].resource is invalid")
            continue
        resource = str(limit["resource"])
        key = f"cost:{limit.get('currency', '')}" if resource == "cost" else resource
        if key in seen:
            errors.append(f"limits[{index}] duplicates {key}")
        seen.add(key)
        if not is_nonnegative_number(limit.get("max")):
            errors.append(f"limits[{index}].max must be a non-negative finite number")
        if limit.get("requiredEnforcement") not in {"preemptive", "boundary"}:
            errors.append(f"limits[{index}].requiredEnforcement must be preemptive or boundary")
        currency = limit.get("currency")
        if resource == "cost" and (not isinstance(currency, str) or len(currency) != 3 or not currency.isalpha() or currency.upper() != currency):
            errors.append(f"limits[{index}].currency is required for cost and must be uppercase ISO-style code")
    return errors


def enforcement_satisfies(actual: str, required: str) -> bool:
    return actual == "preemptive" or actual == required


def budget_capability_errors(manifest: dict[str, Any], budgets: dict[str, Any]) -> list[str]:
    errors = [*validate_resource_budgets(budgets), *validate_adapter_manifest(manifest)]
    resources = manifest.get("resources") if isinstance(manifest.get("resources"), dict) else {}
    for limit in budgets.get("limits", []) if isinstance(budgets.get("limits"), list) else []:
        if not isinstance(limit, dict):
            continue
        resource = limit.get("resource")
        capability = RUNTIME_RESOURCE_CAPABILITIES.get(resource) or resources.get(resource)
        if not isinstance(capability, dict) or not capability.get("observable") or capability.get("enforcement") == "unsupported":
            errors.append(f"{resource} is not observable by the runtime or adapter")
        elif not enforcement_satisfies(str(capability.get("enforcement")), str(limit.get("requiredEnforcement"))):
            errors.append(f"{resource} requires {limit.get('requiredEnforcement')} enforcement but only {capability.get('enforcement')} is available")
    return list(dict.fromkeys(errors))


def observation_capability_errors(manifest: dict[str, Any], observations: list[dict[str, Any]]) -> tuple[list[str], set[str]]:
    resources = manifest.get("resources") if isinstance(manifest.get("resources"), dict) else {}
    observed: set[str] = set()
    for observation in observations:
        usage = observation.get("usage") if isinstance(observation.get("usage"), dict) else {}
        for field in ECONOMIC_USAGE_FIELDS:
            if field in usage:
                observed.add("agentDepth" if field == "maxAgentDepth" else field)
        if isinstance(observation.get("cost"), dict):
            observed.add("cost")
    errors = [
        f"{resource} was observed but is not declared observable by the adapter manifest"
        for resource in sorted(observed)
        if not isinstance(resources.get(resource), dict) or resources[resource].get("observable") is not True
    ]
    return errors, observed


def evaluate_resource_budgets(
    budgets: dict[str, Any],
    observed: dict[str, Any],
    capabilities: dict[str, Any],
    completed: bool,
) -> dict[str, Any]:
    outcomes: list[dict[str, Any]] = []
    values = observed.get("values") if isinstance(observed.get("values"), dict) else {}
    costs = observed.get("costs") if isinstance(observed.get("costs"), dict) else {}
    coverage = observed.get("coverage") if isinstance(observed.get("coverage"), dict) else {}
    for limit in budgets.get("limits", []):
        resource = limit["resource"]
        currency = limit.get("currency")
        value = costs.get(currency) if resource == "cost" else values.get(resource)
        metric_coverage = coverage.get(resource, "unavailable")
        capability = RUNTIME_RESOURCE_CAPABILITIES.get(resource) or capabilities.get(resource) or {}
        enforcement = "preemptive" if capability.get("enforcement") == "preemptive" else "boundary"
        if metric_coverage != "complete" or value is None:
            status = "unobservable"
        elif value > limit["max"]:
            status = "overrun"
        elif value == limit["max"] and not completed:
            status = "exhausted"
        else:
            status = "within"
        outcomes.append(without_none_values({
            "resource": resource,
            "limit": limit["max"],
            "currency": currency,
            "observed": value,
            "enforcement": enforcement,
            "coverage": metric_coverage,
            "status": status,
        }))
    overall = "unobservable" if any(item["status"] == "unobservable" for item in outcomes) else (
        "overrun" if any(item["status"] == "overrun" for item in outcomes) else (
            "exhausted" if any(item["status"] == "exhausted" for item in outcomes) else "within"
        )
    )
    return {"version": "ruhroh_resource_budget_outcome_v1", "scope": "implementation", "status": overall, "limits": outcomes}


def read_resource_budgets() -> dict[str, Any] | None:
    raw = optional_env("RUHROH_RESOURCE_BUDGETS_JSON")
    path = optional_env("RUHROH_RESOURCE_BUDGETS_PATH")
    if raw is None and path is None:
        return None
    if raw is not None:
        parsed = read_json_string(raw)
    else:
        parsed = read_json_file(Path(str(path)))
    errors = validate_resource_budgets(parsed)
    if errors:
        raise ResourceBudgetStop("resource_budget_unobservable", "; ".join(errors))
    validate_expected_canonical_sha256(parsed, "RUHROH_EFFECTIVE_BUDGET_SHA256", "resource budgets")
    return parsed


def configured_adapter_manifest(default: dict[str, Any]) -> dict[str, Any]:
    raw = optional_env("RUHROH_ADAPTER_MANIFEST_JSON")
    path = optional_env("RUHROH_ADAPTER_MANIFEST_PATH")
    parsed = read_json_string(raw) if raw is not None else read_json_file(Path(str(path))) if path is not None else default
    manifest = parsed if isinstance(parsed, dict) else {}
    if raw is not None or path is not None:
        validate_expected_canonical_sha256(manifest, "RUHROH_ADAPTER_MANIFEST_SHA256", "adapter manifest")
    resources = manifest.get("resources")
    if isinstance(resources, dict):
        validate_expected_canonical_sha256(resources, "RUHROH_EFFECTIVE_CAPABILITIES_SHA256", "effective adapter capabilities")
    return manifest


def canonical_json_sha256(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def validate_expected_canonical_sha256(value: Any, env_key: str, label: str) -> None:
    expected = optional_env(env_key)
    if expected is None:
        return
    if len(expected) != 64 or any(ch not in "0123456789abcdef" for ch in expected):
        raise ResourceBudgetStop("resource_budget_unobservable", f"{env_key} must be a lowercase SHA-256")
    actual = canonical_json_sha256(value)
    if actual != expected:
        raise ResourceBudgetStop("resource_budget_unobservable", f"{label} fingerprint mismatch: expected {expected}, observed {actual}")


def observed_resources_from_envelope(envelope: dict[str, Any], wall_time_ms: int, iterations: int) -> dict[str, Any]:
    totals = envelope.get("totals") if isinstance(envelope.get("totals"), dict) else {}
    usage = totals.get("usage") if isinstance(totals.get("usage"), dict) else {}
    envelope_coverage = envelope.get("coverage") if isinstance(envelope.get("coverage"), dict) else {}
    values: dict[str, Any] = {"wallTimeMs": wall_time_ms, "implementationIterations": iterations}
    coverage: dict[str, str] = {"wallTimeMs": "complete", "implementationIterations": "complete"}
    for field, value in usage.items():
        resource = "agentDepth" if field == "maxAgentDepth" else field
        values[resource] = value
        metric_coverage = envelope_coverage.get(resource)
        coverage[resource] = metric_coverage.get("status", "unavailable") if isinstance(metric_coverage, dict) else "unavailable"
    costs: dict[str, float | int] = {}
    for cost in totals.get("costs", []) if isinstance(totals.get("costs"), list) else []:
        if isinstance(cost, dict) and isinstance(cost.get("currency"), str) and is_nonnegative_number(cost.get("amount")):
            costs[cost["currency"]] = cost["amount"]
    cost_coverage = envelope_coverage.get("cost")
    coverage["cost"] = cost_coverage.get("status", "unavailable") if isinstance(cost_coverage, dict) else "unavailable"
    return {"values": values, "costs": costs, "coverage": coverage}


class ResourceBudgetController:
    def __init__(self, budgets: dict[str, Any] | None, manifest: dict[str, Any]) -> None:
        self.budgets = budgets
        self.manifest = manifest
        self.started_at: float | None = None
        self.last_boundary_elapsed_ms = 0
        self.outcome: dict[str, Any] | None = None
        if budgets is not None:
            errors = budget_capability_errors(manifest, budgets)
            if errors:
                empty_envelope, _ = envelope_for_turns([], runtime_wall_ms=0, runtime_iterations=0)
                observed = observed_resources_from_envelope(empty_envelope, 0, 0)
                self.outcome = evaluate_resource_budgets(budgets, observed, {}, completed=False)
                raise ResourceBudgetStop("resource_budget_unobservable", "; ".join(errors), self.outcome)

    def begin_implementation(self, started_at: float) -> None:
        if self.started_at is None:
            self.started_at = started_at

    def elapsed_ms_at(self, observed_at: float | None = None) -> int:
        if self.started_at is None:
            return 0
        return max(0, round(((observed_at if observed_at is not None else time.monotonic()) - self.started_at) * 1000))

    def elapsed_ms(self) -> int:
        return self.elapsed_ms_at()

    def record_boundary(self, elapsed_ms: int | float) -> None:
        self.last_boundary_elapsed_ms = max(self.last_boundary_elapsed_ms, elapsed_ms)

    def objective_wall_time_ms(self) -> int | float:
        return self.last_boundary_elapsed_ms

    def wall_limit_ms(self) -> float | None:
        if self.budgets is None:
            return None
        for limit in self.budgets["limits"]:
            if limit["resource"] == "wallTimeMs":
                return float(limit["max"])
        return None

    def command_timeout(self, default_seconds: int) -> tuple[float, bool]:
        wall_limit = self.wall_limit_ms()
        if wall_limit is None:
            return float(default_seconds), False
        remaining_seconds = max(0.001, (wall_limit - self.elapsed_ms()) / 1000)
        return min(float(default_seconds), remaining_seconds), remaining_seconds <= default_seconds

    def before_turn(self, turns: list[dict[str, Any]]) -> None:
        if self.budgets is None:
            return
        envelope, _ = envelope_for_turns(turns, runtime_wall_ms=self.elapsed_ms(), runtime_iterations=len(turns))
        observed = observed_resources_from_envelope(envelope, self.elapsed_ms(), len(turns))
        resources = self.manifest.get("resources") if isinstance(self.manifest.get("resources"), dict) else {}
        runtime_budgets = {**self.budgets, "limits": [
            limit for limit in self.budgets["limits"] if limit["resource"] in RUNTIME_RESOURCE_CAPABILITIES
        ]}
        outcome = evaluate_resource_budgets(runtime_budgets, observed, resources, completed=False)
        self.outcome = outcome
        if outcome["status"] != "within":
            reason = "resource_budget_unobservable" if outcome["status"] == "unobservable" else "resource_budget_exhausted"
            raise ResourceBudgetStop(reason, f"resource budget is {outcome['status']} before the next turn", outcome)

    def after_turn(
        self,
        turns: list[dict[str, Any]],
        completed: bool,
        wall_time_ms: int | float | None = None,
    ) -> dict[str, Any] | None:
        if self.budgets is None:
            return None
        observed_wall_time_ms = self.elapsed_ms() if wall_time_ms is None else wall_time_ms
        self.record_boundary(observed_wall_time_ms)
        envelope, _ = envelope_for_turns(turns, runtime_wall_ms=observed_wall_time_ms, runtime_iterations=len(turns))
        observed = observed_resources_from_envelope(envelope, observed_wall_time_ms, len(turns))
        current_observations = turns[-1].get("economicsObservations", []) if turns else []
        current_protocol_errors = turns[-1].get("protocolErrors", []) if turns else []
        for limit in self.budgets["limits"]:
            resource = limit["resource"]
            if resource in RUNTIME_RESOURCE_CAPABILITIES:
                continue
            field = "maxAgentDepth" if resource == "agentDepth" else resource
            if current_protocol_errors:
                present = False
                if resource == "cost":
                    observed["costs"].pop(limit.get("currency"), None)
                else:
                    observed["values"].pop(resource, None)
            elif resource == "cost":
                present = any(
                    isinstance(item, dict)
                    and isinstance(item.get("cost"), dict)
                    and item["cost"].get("currency") == limit.get("currency")
                    for item in current_observations
                )
                if not present:
                    observed["costs"].pop(limit.get("currency"), None)
            else:
                present = any(
                    isinstance(item, dict)
                    and isinstance(item.get("usage"), dict)
                    and field in item["usage"]
                    for item in current_observations
                )
                if not present:
                    observed["values"].pop(resource, None)
            if not present:
                observed["coverage"][resource] = "unavailable"
        resources = self.manifest.get("resources") if isinstance(self.manifest.get("resources"), dict) else {}
        self.outcome = evaluate_resource_budgets(self.budgets, observed, resources, completed=completed)
        return self.outcome


def envelope_for_turns(
    turns: list[dict[str, Any]],
    *,
    runtime_wall_ms: int | None = None,
    runtime_iterations: int | None = None,
) -> tuple[dict[str, Any], list[str]]:
    observations = [
        observation
        for turn in turns
        for observation in turn.get("economicsObservations", [])
        if isinstance(observation, dict)
    ]
    legacy = False
    if not observations:
        legacy_observation = legacy_usage_observation(latest_turn_record(turns, "usage"))
        if legacy_observation is not None:
            observations.append(legacy_observation)
            legacy = True
    envelope, errors = normalize_economics_observations(observations)
    envelope["legacy"] = legacy
    if legacy:
        envelope["warnings"].append("legacy usage is observed with unknown completeness and is not eligible for unit economics")
    if runtime_wall_ms is not None:
        envelope["runtime"] = {
            "wallTimeMs": runtime_wall_ms,
            "implementationIterations": runtime_iterations or 0,
        }
        envelope["coverage"]["wallTimeMs"] = {"status": "complete", "observationCount": 1, "completeObservationCount": 1}
        envelope["coverage"]["implementationIterations"] = {"status": "complete", "observationCount": 1, "completeObservationCount": 1}
    return envelope, errors


def parse_run_agent_result(value: Any, adapter_id: str) -> dict[str, Any]:
    parsed = value if isinstance(value, dict) else {}
    version = parsed.get("version")
    protocol_errors: list[str] = []
    observations: list[dict[str, Any]] = []
    spans: list[dict[str, Any]] = []
    adapter_manifest: dict[str, Any] | None = None
    adapter_budget_outcome: dict[str, Any] | None = None
    usage: dict[str, Any] | None = None
    if version == "ruhroh_run_agent_result_v2":
        if parsed.get("status") not in {"goal_satisfied", "continue", "cannot_satisfy", "policy_blocked", "out_of_scope", "runtime_failure", "infra_failure", "cancelled"}:
            protocol_errors.append("status is not supported by run-agent result v2")
        for field in ("runId", "threadId", "adapterVersion"):
            if field in parsed and (not isinstance(parsed[field], str) or not parsed[field].strip()):
                protocol_errors.append(f"{field} must be a non-empty string")
        raw_observations = parsed.get("economicsObservations", [])
        if not isinstance(raw_observations, list):
            protocol_errors.append("economicsObservations must be an array")
        else:
            for index, observation in enumerate(raw_observations):
                errors = validate_economics_observation(observation)
                protocol_errors.extend(f"economicsObservations[{index}]: {error}" for error in errors)
                if not errors and isinstance(observation, dict):
                    observations.append(json.loads(json.dumps(observation)))
        raw_spans = parsed.get("economicTraceSpans", [])
        if not isinstance(raw_spans, list):
            protocol_errors.append("economicTraceSpans must be an array")
        else:
            for index, span in enumerate(raw_spans):
                errors = validate_economic_trace_span(span)
                protocol_errors.extend(f"economicTraceSpans[{index}]: {error}" for error in errors)
                if not errors and isinstance(span, dict):
                    spans.append(json.loads(json.dumps(span)))
        raw_manifest = parsed.get("adapterManifest")
        if raw_manifest is not None:
            errors = validate_adapter_manifest(raw_manifest)
            if isinstance(raw_manifest, dict) and raw_manifest.get("adapterId") != adapter_id:
                errors.append(f"adapterId must match executing adapter {adapter_id}")
            protocol_errors.extend(f"adapterManifest: {error}" for error in errors)
            if not errors and isinstance(raw_manifest, dict):
                adapter_manifest = json.loads(json.dumps(raw_manifest))
        raw_outcome = parsed.get("resourceBudgetOutcome")
        if raw_outcome is not None:
            outcome_errors = validate_resource_budget_outcome(raw_outcome)
            protocol_errors.extend(f"resourceBudgetOutcome: {error}" for error in outcome_errors)
            if not outcome_errors and isinstance(raw_outcome, dict):
                adapter_budget_outcome = json.loads(json.dumps(raw_outcome))
    else:
        if version not in (None, "ruhroh_run_agent_result_v1"):
            protocol_errors.append(f"unsupported run-agent result version {version}")
        if isinstance(parsed.get("usage"), dict):
            usage = json.loads(json.dumps(parsed["usage"]))
    return {
        "resultVersion": version if isinstance(version, str) else "ruhroh_run_agent_result_v1",
        "economicsObservations": observations,
        "economicTraceSpans": spans,
        "adapterManifest": adapter_manifest,
        "adapterResourceBudgetOutcome": adapter_budget_outcome,
        "usage": usage,
        "protocolErrors": protocol_errors,
    }


def validate_resource_budget_outcome(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return ["resource budget outcome must be an object"]
    errors: list[str] = []
    if value.get("version") != "ruhroh_resource_budget_outcome_v1" or value.get("scope") != "implementation":
        errors.append("resource budget outcome requires v1 and implementation scope")
    if value.get("status") not in {"within", "exhausted", "overrun", "unobservable"}:
        errors.append("resource budget outcome status is invalid")
    limits = value.get("limits")
    if not isinstance(limits, list):
        errors.append("resource budget outcome limits must be an array")
        return errors
    for index, limit in enumerate(limits):
        if not isinstance(limit, dict) or limit.get("resource") not in ECONOMIC_RESOURCE_NAMES:
            errors.append(f"limits[{index}].resource is invalid")
            continue
        if not is_nonnegative_number(limit.get("limit")):
            errors.append(f"limits[{index}].limit must be non-negative")
        if limit.get("observed") is not None and not is_nonnegative_number(limit.get("observed")):
            errors.append(f"limits[{index}].observed must be non-negative")
        if limit.get("enforcement") not in {"preemptive", "boundary"}:
            errors.append(f"limits[{index}].enforcement is invalid")
        if limit.get("coverage") not in {"complete", "partial", "unknown", "unavailable"}:
            errors.append(f"limits[{index}].coverage is invalid")
        if limit.get("status") not in {"within", "exhausted", "overrun", "unobservable"}:
            errors.append(f"limits[{index}].status is invalid")
    if value.get("termination") is not None:
        errors.extend(f"termination: {error}" for error in validate_process_termination(value["termination"]))
    return errors


def validate_process_termination(value: Any) -> list[str]:
    if not isinstance(value, dict):
        return ["process termination must be an object"]
    errors: list[str] = []
    allowed = {
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
    }
    errors.extend(f"process termination contains unsupported field {key}" for key in value if key not in allowed)
    if value.get("version") != "ruhroh_process_termination_v1":
        errors.append("version must be ruhroh_process_termination_v1")
    if value.get("scope") not in {"process_group", "process"}:
        errors.append("scope must be process_group or process")
    if value.get("reason") not in {"wall_time_limit", "iteration_timeout"}:
        errors.append("reason must be wall_time_limit or iteration_timeout")
    for field in ("timeoutMs", "timeoutObservedAtMs", "terminationDurationMs", "terminatedAtMs"):
        if not is_nonnegative_number(value.get(field)):
            errors.append(f"{field} must be a non-negative finite number")
    if value.get("gracePeriodMs") != PROCESS_TERMINATION_GRACE_SECONDS * 1000:
        errors.append(f"gracePeriodMs must be {PROCESS_TERMINATION_GRACE_SECONDS * 1000}")
    signals_sent = value.get("signalsSent")
    if not isinstance(signals_sent, list) or any(item not in {"SIGTERM", "SIGKILL"} for item in signals_sent):
        errors.append("signalsSent must contain only SIGTERM and SIGKILL")
    elif len(set(signals_sent)) != len(signals_sent):
        errors.append("signalsSent must not contain duplicates")
    elif "SIGKILL" in signals_sent and (not signals_sent or signals_sent[0] != "SIGTERM"):
        errors.append("SIGKILL must be preceded by SIGTERM")
    if value.get("terminatedBy") not in {"already_exited", "SIGTERM", "SIGKILL", "not_found"}:
        errors.append("terminatedBy is invalid")
    timeout_observed_at = value.get("timeoutObservedAtMs")
    terminated_at = value.get("terminatedAtMs")
    if is_nonnegative_number(timeout_observed_at) and is_nonnegative_number(terminated_at) and terminated_at < timeout_observed_at:
        errors.append("terminatedAtMs must be at or after timeoutObservedAtMs")
    if value.get("reason") == "wall_time_limit":
        limit = value.get("limitMs")
        overrun = value.get("overrunMs")
        if not is_nonnegative_number(limit) or not is_nonnegative_number(overrun):
            errors.append("wall_time_limit termination requires limitMs and overrunMs")
        elif is_nonnegative_number(terminated_at) and abs(overrun - max(0, terminated_at - limit)) > 1:
            errors.append("overrunMs must equal terminatedAtMs minus limitMs, bounded at zero")
    elif value.get("limitMs") is not None or value.get("overrunMs") is not None:
        errors.append("iteration_timeout termination cannot include limitMs or overrunMs")
    return list(dict.fromkeys(errors))


def economics_usage_projection(envelope: dict[str, Any]) -> dict[str, Any]:
    totals = envelope.get("totals") if isinstance(envelope.get("totals"), dict) else {}
    usage = totals.get("usage") if isinstance(totals.get("usage"), dict) else {}
    coverage = envelope.get("coverage") if isinstance(envelope.get("coverage"), dict) else {}
    projection: dict[str, Any] = {}
    for field in ("inputTokens", "outputTokens", "totalTokens"):
        metric = coverage.get(field)
        if field in usage and isinstance(metric, dict) and metric.get("status") == "complete":
            projection[field] = usage[field]
    cost_metric = coverage.get("cost")
    if isinstance(cost_metric, dict) and cost_metric.get("status") == "complete":
        usd = next((cost for cost in totals.get("costs", []) if isinstance(cost, dict) and cost.get("currency") == "USD"), None)
        if isinstance(usd, dict) and is_nonnegative_number(usd.get("amount")):
            projection["costUsd"] = usd["amount"]
    return projection


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--instruction-base64", required=True)
    parser.add_argument("--scenario-id", required=True)
    parser.add_argument("--max-iterations", type=int, default=read_max_iterations())
    args = parser.parse_args()

    load_run_env_file()
    load_repo_dotenv()
    instruction = base64.b64decode(args.instruction_base64).decode("utf-8")
    scenario_id = safe_id(args.scenario_id)
    result = run_ruhroh_trial(
        instruction=instruction,
        scenario_id=scenario_id,
        max_iterations=max(1, args.max_iterations),
        workspace_root=Path(resolve_workspace_root()),
        installed_dir=Path("/installed-agent"),
    )
    emit_result(result)
    return 0 if result.get("status") == "completed" else 1


def run_ruhroh_trial(
    instruction: str,
    scenario_id: str,
    max_iterations: int,
    workspace_root: Path,
    installed_dir: Path,
) -> dict[str, Any]:
    started_at = time.monotonic()
    started_at_wall = utc_now()
    ruhroh_run_id = f"{scenario_id}-{uuid.uuid4().hex[:12]}"
    installed_dir.mkdir(parents=True, exist_ok=True)
    workspace_root.mkdir(parents=True, exist_ok=True)
    run_root = installed_dir / "ruhroh-loop"
    run_root.mkdir(parents=True, exist_ok=True)
    runs_path = installed_dir / "ruhroh-loop-iterations.jsonl"
    manifest_path = installed_dir / "ruhroh-run-manifest.json"
    journey_path = installed_dir / "ruhroh-loop-journey.json"
    eval_result_path = installed_dir / "ruhroh-loop-eval.json"
    eval_input_path = installed_dir / "ruhroh-loop-eval-input.json"
    result_path = installed_dir / "ruhroh-loop-result.json"
    workspace_summary_path = installed_dir / "ruhroh-workspace-summary.json"
    workspace_tarball_path = installed_dir / "ruhroh-workspace.tar.gz"
    events_tarball_path = installed_dir / "ruhroh-loop-events.tar.gz"
    transcripts_tarball_path = installed_dir / "ruhroh-loop-transcripts.tar.gz"
    eval_workspace_root = run_root / "eval-workspace"

    implementation_runs: list[dict[str, Any]] = []
    implementation_stopped_reason = "max_iterations"
    adapter = build_run_agent_adapter(
        adapter_id=read_run_agent_adapter(),
        scenario_id=scenario_id,
        workspace_root=workspace_root,
        installed_dir=installed_dir,
        run_root=run_root,
    )
    session_handle = "unstarted"
    run_agent_manifest: dict[str, Any] = {
        "adapterId": adapter.id,
        "continuityLevel": adapter.continuity_level,
        "sessionHandle": session_handle,
        "runIds": [],
        "transcriptPaths": [],
        "eventLogPaths": [],
        "artifactPaths": {},
    }
    budget_controller: ResourceBudgetController | None = None
    try:
        budgets = read_resource_budgets()
        budget_controller = ResourceBudgetController(budgets, adapter.declared_manifest())
        adapter.budget_controller = budget_controller
        adapter.prepare()
        session = adapter.start_session()
        session_handle = session["sessionHandle"]

        for iteration in range(1, max_iterations + 1):
            try:
                budget_controller.before_turn(adapter.turns)
            except ResourceBudgetStop as budget_error:
                if not implementation_runs:
                    raise
                adapter.resource_budget_outcome = budget_error.outcome
                implementation_stopped_reason = budget_error.reason
                implementation_runs[-1]["status"] = "failed"
                implementation_runs[-1]["failureKind"] = budget_error.reason
                implementation_runs[-1]["completionStatus"] = {
                    "state": "terminal_failure",
                    "reason": budget_error.reason,
                    "evidenceRefs": completion_evidence_for_turn(adapter.turns[-1]),
                }
                implementation_runs[-1]["stopReason"] = budget_error.reason
                implementation_runs[-1]["resourceBudgetOutcome"] = budget_error.outcome
                write_jsonl(runs_path, implementation_runs)
                break
            message = build_iteration_message(instruction, iteration, adapter.completion_instruction())
            turn_result = adapter.run_turn(iteration=iteration, message=message)
            completion_status = adapter.detect_completion(turn_result)
            budget_outcome = budget_controller.after_turn(
                adapter.turns,
                completed=completion_status.get("state") == "done",
                wall_time_ms=(
                    turn_result["implementationBoundary"]["elapsedMs"]
                    if isinstance(turn_result.get("implementationBoundary"), dict)
                    and is_nonnegative_number(turn_result["implementationBoundary"].get("elapsedMs"))
                    else None
                ),
            )
            if budget_outcome is not None:
                if (
                    budget_outcome.get("status") != "within"
                    and isinstance(turn_result.get("termination"), dict)
                    and turn_result["termination"].get("reason") == "wall_time_limit"
                ):
                    budget_outcome["termination"] = turn_result["termination"]
                adapter.resource_budget_outcome = budget_outcome
                turn_result["resourceBudgetOutcome"] = budget_outcome
                if budget_outcome.get("status") != "within":
                    budget_reason = "resource_budget_unobservable" if budget_outcome.get("status") == "unobservable" else "resource_budget_exhausted"
                    completion_status = {
                        "state": "terminal_failure",
                        "reason": budget_reason,
                        "evidenceRefs": completion_evidence_for_turn(turn_result),
                    }
            implementation_run = build_implementation_run_record_from_turn(turn_result, completion_status)
            implementation_runs.append(implementation_run)
            append_jsonl(runs_path, implementation_run)

            if completion_status.get("state") == "done":
                implementation_stopped_reason = str(completion_status.get("reason") or "done")
                break
            if completion_status.get("state") == "terminal_failure":
                implementation_stopped_reason = str(completion_status.get("reason") or "terminal_failure")
                break

        adapter.runtime_wall_ms = budget_controller.objective_wall_time_ms()
        run_agent_manifest = adapter.collect_artifacts()
        journey = {
            "version": "ruhroh_implementation_journey_v1",
            "scenarioId": scenario_id,
            "userPrompt": instruction,
            "implementationStoppedReason": implementation_stopped_reason,
            "implementationIterationsUsed": len(implementation_runs),
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "workspacePath": str(workspace_root),
            "implementationRuns": implementation_runs,
        }
        journey.update(adapter.legacy_journey_fields())
        journey_path.parent.mkdir(parents=True, exist_ok=True)
        journey_path.write_text(json.dumps(journey, indent=2, sort_keys=True) + "\n", encoding="utf-8")

        copy_workspace_for_eval(workspace_root, eval_workspace_root)
        eval_result = run_eval_agent(
            scenario_id=scenario_id,
            eval_workspace_root=eval_workspace_root,
            original_workspace_root=workspace_root,
            journey_path=journey_path,
            eval_input_path=eval_input_path,
            eval_output_path=eval_result_path,
            installed_dir=installed_dir,
        )
        write_workspace_summary(workspace_root, workspace_summary_path)
        write_workspace_tarball(workspace_root, workspace_tarball_path)
        adapter_artifact_paths = run_agent_manifest.get("artifactPaths") if isinstance(run_agent_manifest.get("artifactPaths"), dict) else {}
        event_log_dir = Path(str(adapter_artifact_paths.get("eventLogDir") or run_root / "events"))
        transcript_dir = Path(str(adapter_artifact_paths.get("transcriptDir") or run_root / "transcripts"))
        write_directory_tarball(event_log_dir, events_tarball_path)
        write_directory_tarball(transcript_dir, transcripts_tarball_path)

        verdict = derive_final_verdict(implementation_runs, eval_result)
        duration_ms = round((time.monotonic() - started_at) * 1000)
        artifact_paths = {
            "result": str(result_path),
            "runManifest": str(manifest_path),
            "implementationRuns": str(runs_path),
            "journey": str(journey_path),
            "evalResult": str(eval_result_path),
            "evalInput": str(eval_input_path),
            "bridgeLog": str(adapter_artifact_paths.get("bridgeLogPath", "")),
            "workspaceSummary": str(workspace_summary_path),
            "workspaceTarball": str(workspace_tarball_path),
            "eventsTarball": str(events_tarball_path),
            "transcriptsTarball": str(transcripts_tarball_path),
            "evalWorkspace": str(eval_workspace_root),
            **({"economicTrace": str(adapter_artifact_paths["economicTrace"])} if isinstance(adapter_artifact_paths.get("economicTrace"), str) else {}),
        }
        run_manifest = build_run_manifest(
            ruhroh_run_id=ruhroh_run_id,
            scenario_id=scenario_id,
            started_at=started_at_wall,
            duration_ms=duration_ms,
            max_iterations=max_iterations,
            implementation_stopped_reason=implementation_stopped_reason,
            implementation_runs=implementation_runs,
            run_agent_manifest=run_agent_manifest,
            adapter=adapter,
            session_handle=session_handle,
            eval_result=eval_result,
            workspace_root=workspace_root,
            eval_workspace_root=eval_workspace_root,
            artifact_paths=artifact_paths,
        )
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(run_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        final_result = {
            "$schema": LOOP_RESULT_SCHEMA_URL,
            "version": "ruhroh_loop_result_v1",
            "runId": ruhroh_run_id,
            "adapter": result_adapter(),
            "dataset": result_dataset(),
            "scenarioId": scenario_id,
            "task_id": scenario_id,
            "status": verdict["status"],
            "failure_kind": verdict["failure_kind"],
            "failureBucket": verdict["failure_kind"],
            "score": verdict["score"],
            "iterationsUsed": len(implementation_runs),
            "implementationIterationsUsed": len(implementation_runs),
            "implementationStoppedReason": implementation_stopped_reason,
            "stoppedReason": implementation_stopped_reason,
            "duration_ms": duration_ms,
            "runManifest": run_manifest,
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "implementationRuns": implementation_runs,
            "evalResult": eval_result,
            "economics": run_agent_manifest.get("economics"),
            "resourceBudgetOutcome": run_agent_manifest.get("resourceBudgetOutcome"),
            "artifactPaths": artifact_paths,
        }
        final_result.update(adapter.legacy_result_fields(run_agent_manifest))
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(final_result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return final_result
    except Exception as error:
        duration_ms = round((time.monotonic() - started_at) * 1000)
        stopped_reason = error.reason if isinstance(error, ResourceBudgetStop) else "exception"
        failure_kind = error.reason if isinstance(error, ResourceBudgetStop) else "infra_failed"
        if isinstance(error, ResourceBudgetStop):
            adapter.runtime_wall_ms = budget_controller.objective_wall_time_ms() if budget_controller is not None else 0
            adapter.resource_budget_outcome = error.outcome
            try:
                run_agent_manifest = adapter.collect_artifacts()
            except Exception:
                pass
        try:
            write_workspace_summary(workspace_root, workspace_summary_path)
        except Exception:
            pass
        artifact_paths = {
            "result": str(result_path),
            "runManifest": str(manifest_path),
            "implementationRuns": str(runs_path),
            "journey": str(journey_path),
            "workspaceSummary": str(workspace_summary_path),
            **({"economicTrace": str(run_agent_manifest.get("artifactPaths", {}).get("economicTrace"))} if isinstance(run_agent_manifest.get("artifactPaths"), dict) and isinstance(run_agent_manifest["artifactPaths"].get("economicTrace"), str) else {}),
        }
        run_manifest = build_run_manifest(
            ruhroh_run_id=ruhroh_run_id,
            scenario_id=scenario_id,
            started_at=started_at_wall,
            duration_ms=duration_ms,
            max_iterations=max_iterations,
            implementation_stopped_reason=stopped_reason,
            implementation_runs=implementation_runs,
            run_agent_manifest=run_agent_manifest,
            adapter=adapter,
            session_handle=session_handle,
            eval_result=None,
            workspace_root=workspace_root,
            eval_workspace_root=eval_workspace_root,
            artifact_paths=artifact_paths,
            failure_details={"message": str(error), "type": type(error).__name__},
        )
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(run_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        final_result = {
            "$schema": LOOP_RESULT_SCHEMA_URL,
            "version": "ruhroh_loop_result_v1",
            "runId": ruhroh_run_id,
            "adapter": result_adapter(),
            "dataset": result_dataset(),
            "scenarioId": scenario_id,
            "task_id": scenario_id,
            "status": "failed",
            "failure_kind": failure_kind,
            "failureBucket": failure_kind,
            "score": 0,
            "iterationsUsed": len(implementation_runs),
            "implementationIterationsUsed": len(implementation_runs),
            "implementationStoppedReason": stopped_reason,
            "stoppedReason": stopped_reason,
            "duration_ms": duration_ms,
            "runManifest": run_manifest,
            "runAgent": run_agent_manifest,
            "runAgentAdapterId": adapter.id,
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "implementationRuns": implementation_runs,
            "economics": run_agent_manifest.get("economics"),
            "resourceBudgetOutcome": run_agent_manifest.get("resourceBudgetOutcome"),
            "failure_details": {"message": str(error), "type": type(error).__name__},
            "artifactPaths": artifact_paths,
        }
        final_result.update(adapter.legacy_result_fields(run_agent_manifest))
        result_path.parent.mkdir(parents=True, exist_ok=True)
        result_path.write_text(json.dumps(final_result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return final_result
    finally:
        adapter.cleanup()


class RunAgentAdapter:
    id = "base"
    continuity_level = "workspace_only"

    def __init__(self, scenario_id: str, workspace_root: Path, installed_dir: Path, run_root: Path) -> None:
        self.scenario_id = scenario_id
        self.workspace_root = workspace_root
        self.installed_dir = installed_dir
        self.run_root = run_root
        self.session_handle = f"{self.id}-{scenario_id}-{uuid.uuid4().hex[:8]}"
        self.turns: list[dict[str, Any]] = []
        self.runtime_wall_ms = 0
        self.resource_budget_outcome: dict[str, Any] | None = None
        self.budget_controller: ResourceBudgetController | None = None

    def prepare(self) -> dict[str, Any]:
        return {"artifactPaths": {}}

    def start_session(self) -> dict[str, Any]:
        return {"sessionHandle": self.session_handle, "artifactPaths": {}}

    def run_turn(self, *, iteration: int, message: str) -> dict[str, Any]:
        raise NotImplementedError

    def detect_completion(self, turn_result: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    def collect_artifacts(self) -> dict[str, Any]:
        adapter_version = latest_turn_string(self.turns, "adapterVersion")
        model = latest_turn_record(self.turns, "model")
        legacy_usage = latest_turn_record(self.turns, "usage")
        economics, economics_errors = envelope_for_turns(
            self.turns,
            runtime_wall_ms=self.runtime_wall_ms,
            runtime_iterations=len(self.turns),
        )
        protocol_errors = [
            str(error)
            for turn in self.turns
            for error in turn.get("protocolErrors", [])
            if isinstance(error, str)
        ]
        spans = [
            span
            for turn in self.turns
            for span in turn.get("economicTraceSpans", [])
            if isinstance(span, dict)
        ]
        serialized_trace = "".join(
            json.dumps(span, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"
            for span in spans
        )
        finalized_trace = finalize_economic_trace_jsonl(serialized_trace)
        trace_errors = finalized_trace["errors"]
        trace_protocol_errors = [error for error in protocol_errors if error.startswith("economicTraceSpans[")]
        trace_path = self.installed_dir / ECONOMIC_TRACE_PATH_NAME
        artifact_paths: dict[str, str] = {}
        if spans and not trace_errors and not trace_protocol_errors:
            trace_path.write_text(finalized_trace["jsonl"], encoding="utf-8")
            economics["traceRef"] = {
                "artifact": str(trace_path),
                "sha256": finalized_trace["sha256"],
                "spanCount": len(finalized_trace["spans"]),
                "coverage": "unknown",
            }
            artifact_paths["economicTrace"] = str(trace_path)
        observations = [
            observation
            for turn in self.turns
            for observation in turn.get("economicsObservations", [])
            if isinstance(observation, dict)
        ]
        declared_manifest = self.declared_manifest()
        emitted_manifest = latest_turn_record(self.turns, "adapterManifest")
        manifest = emitted_manifest or declared_manifest
        manifest_errors = validate_adapter_manifest(manifest)
        if emitted_manifest is not None and optional_env("RUHROH_ADAPTER_MANIFEST_JSON") is not None and canonical_json_sha256(emitted_manifest) != canonical_json_sha256(declared_manifest):
            manifest_errors.append("emitted adapter manifest does not match the preflight declaration")
        capability_errors, observed_resources = observation_capability_errors(manifest, observations)
        if capability_errors:
            economics["warnings"].append("observed resources exceeded the adapter capability declaration; affected totals are not claim-ready")
            for resource in observed_resources:
                metric = economics.get("coverage", {}).get(resource)
                if isinstance(metric, dict):
                    metric["status"] = "partial"
        all_errors = list(dict.fromkeys([*protocol_errors, *economics_errors, *trace_errors, *manifest_errors, *capability_errors]))
        usage = legacy_usage if legacy_usage is not None and economics.get("legacy") is True else economics_usage_projection(economics)
        return {
            "adapterId": self.id,
            **({"adapterVersion": adapter_version} if adapter_version is not None else {}),
            "continuityLevel": self.continuity_level,
            "sessionHandle": self.session_handle,
            "runIds": [
                str(turn["runId"])
                for turn in self.turns
                if isinstance(turn.get("runId"), str)
            ],
            "transcriptPaths": [
                str(turn["transcriptPath"])
                for turn in self.turns
                if isinstance(turn.get("transcriptPath"), str)
            ],
            "eventLogPaths": [
                str(turn["eventLogPath"])
                for turn in self.turns
                if isinstance(turn.get("eventLogPath"), str)
            ],
            **({"model": model} if model is not None else {}),
            **({"usage": usage} if usage else {}),
            "economics": economics,
            "adapterManifest": manifest,
            **({"resourceBudgetOutcome": self.resource_budget_outcome} if self.resource_budget_outcome is not None else {}),
            **({"economicsErrors": all_errors} if all_errors else {}),
            "artifactPaths": artifact_paths,
        }

    def default_manifest(self) -> dict[str, Any]:
        return {
            "version": "ruhroh_adapter_manifest_v1",
            "adapterId": self.id,
            "adapterVersion": optional_env("RUHROH_RUN_AGENT_ADAPTER_VERSION") or "unknown",
            "resultProtocol": "ruhroh_run_agent_result_v1",
            "resources": {},
        }

    def declared_manifest(self) -> dict[str, Any]:
        return configured_adapter_manifest(self.default_manifest())

    def cleanup(self) -> None:
        return None

    def completion_instruction(self) -> str:
        return "If the goal is complete, emit the adapter completion signal for goal_satisfied. If the goal is not complete, keep working in this same session."

    def legacy_journey_fields(self) -> dict[str, Any]:
        return {}

    def legacy_result_fields(self, manifest: dict[str, Any]) -> dict[str, Any]:
        del manifest
        return {}


class CommandRunAgentAdapter(RunAgentAdapter):
    continuity_level = "workspace_only"

    def __init__(
        self,
        scenario_id: str,
        workspace_root: Path,
        installed_dir: Path,
        run_root: Path,
        adapter_id: str,
        command_env_key: str = "RUHROH_RUN_AGENT_COMMAND",
        completion_protocol_env_key: str = "RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
    ) -> None:
        self.id = adapter_id
        self.command_env_key = command_env_key
        self.completion_protocol_env_key = completion_protocol_env_key
        super().__init__(scenario_id, workspace_root, installed_dir, run_root)

    def run_turn(self, *, iteration: int, message: str) -> dict[str, Any]:
        materialize_inline_command(self.command_env_key, self.installed_dir)
        command = os.environ.get(self.command_env_key)
        if command is None or command.strip() == "":
            raise RuntimeError(f"{self.command_env_key} is required for Ruhroh adapter {self.id}")
        transcript_path = self.run_root / "transcripts" / f"iteration-{iteration}.log"
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        goal_path = self.run_root / "custom-shell" / f"goal-{iteration}.md"
        result_path = self.run_root / "custom-shell" / f"result-{iteration}.json"
        goal_path.parent.mkdir(parents=True, exist_ok=True)
        goal_path.write_text(message, encoding="utf-8")
        env = {
            **os.environ,
            "RUHROH_MESSAGE": message,
            "RUHROH_ITERATION": str(iteration),
            "RUHROH_WORKSPACE": str(self.workspace_root),
            "RUHROH_GOAL_PATH": str(goal_path),
            "RUHROH_MESSAGE_PATH": str(goal_path),
            "RUHROH_WORKSPACE_PATH": str(self.workspace_root),
            "RUHROH_RESULT_PATH": str(result_path),
            "RUHROH_SESSION_HANDLE": self.session_handle,
            "RUHROH_SCENARIO_ID": self.scenario_id,
            "RUHROH_RUN_ROOT": str(self.run_root),
            "RUHROH_ADAPTER_ID": self.id,
            "RUHROH_RUN_AGENT_RESULT_PROTOCOL": "ruhroh_run_agent_result_v2",
            "RUHROH_ECONOMIC_TRACE_PATH": str(self.installed_dir / ECONOMIC_TRACE_PATH_NAME),
        }
        timeout = float(read_iteration_timeout_sec())
        resource_limited_timeout = False
        if self.budget_controller is not None:
            timeout, resource_limited_timeout = self.budget_controller.command_timeout(read_iteration_timeout_sec())
        timed_out = False
        termination: dict[str, Any] | None = None
        implementation_boundary: dict[str, Any]
        try:
            completed = run_command_capture(
                command_args(command, shell_env_key=f"{self.command_env_key}_SHELL"),
                cwd=str(self.workspace_root),
                env=env,
                timeout=timeout,
                shell=command_shell_enabled(f"{self.command_env_key}_SHELL"),
                stream_output=command_shell_enabled("RUHROH_STREAM_AGENT_OUTPUT"),
                on_process_started=self.budget_controller.begin_implementation if self.budget_controller is not None else None,
            )
            process_started_at = float(getattr(completed, "process_started_at_monotonic", time.monotonic()))
            process_completed_at = float(getattr(completed, "process_completed_at_monotonic", time.monotonic()))
            boundary_elapsed_ms = (
                self.budget_controller.elapsed_ms_at(process_completed_at)
                if self.budget_controller is not None
                else max(0, round((process_completed_at - process_started_at) * 1000))
            )
            implementation_boundary = {"kind": "terminal_result", "elapsedMs": boundary_elapsed_ms}
        except subprocess.TimeoutExpired as error:
            timed_out = True
            process_started_at = float(getattr(error, "process_started_at_monotonic", time.monotonic()))
            timeout_observed_at = float(getattr(error, "timeout_observed_at_monotonic", time.monotonic()))
            terminated_at = float(getattr(error, "terminated_at_monotonic", time.monotonic()))
            timeout_observed_at_ms = (
                self.budget_controller.elapsed_ms_at(timeout_observed_at)
                if self.budget_controller is not None
                else max(0, round((timeout_observed_at - process_started_at) * 1000))
            )
            terminated_at_ms = (
                self.budget_controller.elapsed_ms_at(terminated_at)
                if self.budget_controller is not None
                else max(0, round((terminated_at - process_started_at) * 1000))
            )
            wall_limit_ms = self.budget_controller.wall_limit_ms() if self.budget_controller is not None else None
            boundary_elapsed_ms = wall_limit_ms if resource_limited_timeout and wall_limit_ms is not None else timeout_observed_at_ms
            raw_termination = getattr(error, "termination_evidence", {})
            termination = {
                "version": "ruhroh_process_termination_v1",
                "scope": raw_termination.get("scope", "process_group" if os.name != "nt" else "process"),
                "reason": "wall_time_limit" if resource_limited_timeout else "iteration_timeout",
                "timeoutMs": max(0, round(timeout * 1000)),
                "timeoutObservedAtMs": timeout_observed_at_ms,
                "gracePeriodMs": raw_termination.get("gracePeriodMs", PROCESS_TERMINATION_GRACE_SECONDS * 1000),
                "signalsSent": raw_termination.get("signalsSent", []),
                "terminatedBy": raw_termination.get("terminatedBy", "not_found"),
                "terminationDurationMs": raw_termination.get("terminationDurationMs", max(0, terminated_at_ms - timeout_observed_at_ms)),
                "terminatedAtMs": terminated_at_ms,
                **({
                    "limitMs": wall_limit_ms,
                    "overrunMs": max(0, terminated_at_ms - wall_limit_ms),
                } if resource_limited_timeout and wall_limit_ms is not None else {}),
            }
            implementation_boundary = {
                "kind": "budget_stop" if resource_limited_timeout else "iteration_timeout",
                "elapsedMs": boundary_elapsed_ms,
            }
            completed = subprocess.CompletedProcess(
                error.cmd,
                124,
                stdout=str(error.output or ""),
                stderr=None,
            )
        transcript_path.parent.mkdir(parents=True, exist_ok=True)
        transcript_path.write_text(completed.stdout, encoding="utf-8")
        parsed_result = read_json_file(result_path)
        if not isinstance(parsed_result, dict):
            parsed_result = {}
        parsed_protocol = parse_run_agent_result(parsed_result, self.id)
        status = "completed" if completed.returncode == 0 else "failed"
        failure_kind = "none" if status == "completed" else "resource_budget_exhausted" if timed_out and resource_limited_timeout else "custom_shell_failed"
        turn = {
            "version": "ruhroh_run_agent_turn_v1",
            "adapterId": self.id,
            "continuityLevel": self.continuity_level,
            "iteration": iteration,
            "status": status,
            "failureKind": failure_kind,
            "sessionHandle": self.session_handle,
            "runId": parsed_result.get("runId") if isinstance(parsed_result.get("runId"), str) else f"{self.session_handle}-{iteration}",
            "adapterVersion": parsed_result.get("adapterVersion") if isinstance(parsed_result.get("adapterVersion"), str) else None,
            "model": parsed_result.get("model") if isinstance(parsed_result.get("model"), dict) else None,
            "resultVersion": parsed_protocol["resultVersion"],
            "usage": parsed_protocol["usage"],
            "economicsObservations": parsed_protocol["economicsObservations"],
            "economicTraceSpans": parsed_protocol["economicTraceSpans"],
            "adapterManifest": parsed_protocol["adapterManifest"],
            "adapterResourceBudgetOutcome": parsed_protocol["adapterResourceBudgetOutcome"],
            "protocolErrors": parsed_protocol["protocolErrors"],
            "threadId": parsed_result.get("threadId") if isinstance(parsed_result.get("threadId"), str) else None,
            "eventLogPath": parsed_result.get("eventLogPath") if isinstance(parsed_result.get("eventLogPath"), str) else None,
            "jobInputPath": parsed_result.get("jobInputPath") if isinstance(parsed_result.get("jobInputPath"), str) else None,
            "jobOutputPath": parsed_result.get("jobOutputPath") if isinstance(parsed_result.get("jobOutputPath"), str) else None,
            "finalizedPayload": parsed_result.get("finalizedPayload"),
            "returnCode": completed.returncode,
            "timedOut": timed_out,
            "implementationBoundary": implementation_boundary,
            **({"termination": termination} if termination is not None else {}),
            "transcriptPath": str(transcript_path),
            "artifactPaths": {
                "goal": str(goal_path),
                "transcript": str(transcript_path),
                "result": str(result_path),
                "message": str(goal_path),
                **(parsed_result.get("artifacts") if isinstance(parsed_result.get("artifacts"), dict) else {}),
            },
            "notes": completed.stdout[-2000:],
        }
        self.turns.append(turn)
        return turn

    def detect_completion(self, turn_result: dict[str, Any]) -> dict[str, Any]:
        evidence = completion_evidence_for_turn(turn_result)
        if turn_result.get("status") != "completed":
            reason = "resource_budget_exhausted" if turn_result.get("failureKind") == "resource_budget_exhausted" else "runtime_failure"
            return {"state": "terminal_failure", "reason": reason, "evidenceRefs": evidence}
        protocol = os.environ.get(self.completion_protocol_env_key, "json-final-line")
        artifact_paths = turn_result.get("artifactPaths")
        result_path = artifact_paths.get("result") if isinstance(artifact_paths, dict) else None
        if isinstance(result_path, str):
            parsed_result = read_json_file(Path(result_path))
            if isinstance(parsed_result, dict):
                status = parsed_result.get("status")
                if status == "goal_satisfied":
                    return {
                        "state": "done",
                        "reason": "goal_satisfied",
                        "confidence": "adapter_inferred",
                        "evidenceRefs": evidence,
                    }
                if status in COMPLETION_TERMINAL_FAILURE_REASONS:
                    return {"state": "terminal_failure", "reason": status, "evidenceRefs": evidence}
                if status == "continue":
                    return {"state": "not_done", "reason": "partial_progress", "evidenceRefs": evidence}
        notes = str(turn_result.get("notes") or "")
        if protocol == "json-final-line":
            for line in reversed(notes.splitlines()):
                try:
                    parsed = json.loads(line)
                except Exception:
                    continue
                if isinstance(parsed, dict) and parsed.get("status") == "goal_satisfied":
                    return {
                        "state": "done",
                        "reason": "goal_satisfied",
                        "confidence": "adapter_inferred",
                        "evidenceRefs": evidence,
                    }
        return {"state": "not_done", "reason": "missing_completion_signal", "evidenceRefs": evidence}

    def completion_instruction(self) -> str:
        return (
            "If the goal is complete, end your response with one JSON line: "
            "{\"status\":\"goal_satisfied\"}. If the goal is not complete, keep working in this same workspace."
        )


class CustomShellRunAgentAdapter(CommandRunAgentAdapter):
    def __init__(self, scenario_id: str, workspace_root: Path, installed_dir: Path, run_root: Path) -> None:
        super().__init__(
            scenario_id,
            workspace_root,
            installed_dir,
            run_root,
            adapter_id="custom-shell",
            command_env_key="RUHROH_RUN_AGENT_COMMAND",
            completion_protocol_env_key="RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
        )

    def completion_instruction(self) -> str:
        return CommandRunAgentAdapter.completion_instruction(self)


class KestrelCliRunAgentAdapter(CommandRunAgentAdapter):
    continuity_level = "native_session"

    def __init__(self, scenario_id: str, workspace_root: Path, installed_dir: Path, run_root: Path) -> None:
        super().__init__(
            scenario_id,
            workspace_root,
            installed_dir,
            run_root,
            adapter_id="kestrel-cli",
            command_env_key="RUHROH_RUN_AGENT_COMMAND",
            completion_protocol_env_key="RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
        )

    def default_manifest(self) -> dict[str, Any]:
        return {
            "version": "ruhroh_adapter_manifest_v1",
            "adapterId": self.id,
            "adapterVersion": optional_env("KESTREL_CLI_ADAPTER_VERSION") or "0.1.0",
            "resultProtocol": "ruhroh_run_agent_result_v2",
            "traceProtocol": "ruhroh_economic_trace_span_v1",
            "resources": {},
        }


def build_run_agent_adapter(
    *,
    adapter_id: str,
    scenario_id: str,
    workspace_root: Path,
    installed_dir: Path,
    run_root: Path,
) -> RunAgentAdapter:
    if adapter_id == "custom-shell":
        return CustomShellRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root)
    if adapter_id == "kestrel-cli":
        return KestrelCliRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root)
    return CommandRunAgentAdapter(scenario_id, workspace_root, installed_dir, run_root, adapter_id=adapter_id)


def read_run_agent_adapter() -> str:
    return os.environ.get("RUHROH_RUN_AGENT_ADAPTER") or "custom-shell"


def completion_evidence_for_turn(turn_result: dict[str, Any]) -> list[dict[str, str]]:
    refs: list[dict[str, str]] = []
    for kind, key in (("transcript", "transcriptPath"), ("event_log", "eventLogPath"), ("job_output", "jobOutputPath")):
        value = turn_result.get(key)
        if isinstance(value, str):
            refs.append({"kind": kind, "ref": value, "summary": f"{kind} for iteration {turn_result.get('iteration')}"})
    return refs


def build_implementation_run_record_from_turn(turn_result: dict[str, Any], completion_status: dict[str, Any]) -> dict[str, Any]:
    stop_reason = completion_status.get("reason") or "not_done"
    record = {
        "version": "ruhroh_implementation_run_v1",
        "iteration": turn_result.get("iteration"),
        "adapterId": turn_result.get("adapterId"),
        "continuityLevel": turn_result.get("continuityLevel"),
        "status": turn_result.get("status"),
        "failureKind": turn_result.get("failureKind"),
        "sessionHandle": turn_result.get("sessionHandle"),
        "completionStatus": completion_status,
        "stopReason": stop_reason,
        "returnCode": turn_result.get("returnCode"),
        "artifactPaths": turn_result.get("artifactPaths", {}),
        "notes": str(turn_result.get("notes") or "")[-2000:],
        "resultVersion": turn_result.get("resultVersion"),
        "economicsObservationIds": [
            observation["observationId"]
            for observation in turn_result.get("economicsObservations", [])
            if isinstance(observation, dict) and isinstance(observation.get("observationId"), str)
        ],
        "economicTraceSpanIds": [
            span["spanId"]
            for span in turn_result.get("economicTraceSpans", [])
            if isinstance(span, dict) and isinstance(span.get("spanId"), str)
        ],
        "protocolErrors": [
            error for error in turn_result.get("protocolErrors", []) if isinstance(error, str)
        ],
        "resourceBudgetOutcome": turn_result.get("resourceBudgetOutcome"),
        "implementationBoundary": turn_result.get("implementationBoundary"),
        "termination": turn_result.get("termination"),
    }
    for key in (
        "sessionId",
        "runId",
        "threadId",
        "finalizationStatus",
        "finalizedPayload",
        "jobInputPath",
        "jobOutputPath",
        "transcriptPath",
        "eventLogPath",
    ):
        value = turn_result.get(key)
        if value is not None:
            record[key] = value
    return record


def latest_turn_string(turns: list[dict[str, Any]], key: str) -> str | None:
    for turn in reversed(turns):
        value = turn.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def latest_turn_record(turns: list[dict[str, Any]], key: str) -> dict[str, Any] | None:
    for turn in reversed(turns):
        value = turn.get(key)
        if isinstance(value, dict) and value:
            return value
    return None


def build_iteration_message(
    instruction: str,
    iteration: int,
    completion_instruction: str = "If the goal is complete, emit the adapter completion signal for goal_satisfied. If the goal is not complete, keep working in this same session.",
    previous_eval: dict[str, Any] | None = None,
) -> str:
    del previous_eval
    if iteration == 1:
        return instruction
    return (
        "Continue the same app-development task in the existing workspace.\n\n"
        f"Original user goal:\n{instruction}\n\n"
        f"This is Ruhroh implementation continuation {iteration}. Do not restart or create a separate project. "
        "Inspect the current workspace, continue any unfinished work, and verify the final delivered state. "
        f"{completion_instruction}"
    )


def copy_workspace_for_eval(workspace_root: Path, eval_workspace_root: Path) -> None:
    if eval_workspace_root.exists():
        shutil.rmtree(eval_workspace_root)
    if not workspace_root.exists():
        eval_workspace_root.mkdir(parents=True, exist_ok=True)
        return
    shutil.copytree(
        workspace_root,
        eval_workspace_root,
        ignore=shutil.ignore_patterns(*SKIP_WORKSPACE_TAR_NAMES),
    )


def run_eval_agent(
    scenario_id: str,
    eval_workspace_root: Path,
    original_workspace_root: Path,
    journey_path: Path,
    eval_input_path: Path,
    eval_output_path: Path,
    installed_dir: Path | None = None,
) -> dict[str, Any]:
    installed_dir = installed_dir or eval_output_path.parent
    eval_input = build_eval_input(
        scenario_id=scenario_id,
        eval_workspace_root=eval_workspace_root,
        original_workspace_root=original_workspace_root,
        journey_path=journey_path,
        eval_output_path=eval_output_path,
    )
    eval_input_path.parent.mkdir(parents=True, exist_ok=True)
    eval_input_path.write_text(json.dumps(eval_input, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    fixture = read_eval_fixture()
    if fixture is not None:
        fixture = normalize_eval_result(fixture)
        fixture.setdefault("artifacts", {})
        if isinstance(fixture["artifacts"], dict):
            fixture["artifacts"].setdefault("workspacePath", str(eval_workspace_root))
            fixture["artifacts"].setdefault("originalWorkspacePath", str(original_workspace_root))
            fixture["artifacts"].setdefault("journeyPath", str(journey_path))
        eval_output_path.parent.mkdir(parents=True, exist_ok=True)
        eval_output_path.write_text(json.dumps(fixture, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return fixture
    materialize_inline_command("RUHROH_EVAL_COMMAND", installed_dir)
    command = os.environ.get("RUHROH_EVAL_COMMAND")
    if command is not None and command.strip() != "":
        env = {
            **os.environ,
            "RUHROH_EVAL_SCENARIO_ID": scenario_id,
            "RUHROH_EVAL_WORKSPACE_PATH": str(eval_workspace_root),
            "RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH": str(original_workspace_root),
            "RUHROH_EVAL_JOURNEY_PATH": str(journey_path),
            "RUHROH_EVAL_INPUT_PATH": str(eval_input_path),
            "RUHROH_EVAL_OUTPUT_PATH": str(eval_output_path),
        }
        completed = subprocess.run(
            command_args(command, shell_env_key="RUHROH_EVAL_COMMAND_SHELL"),
            cwd=str(eval_workspace_root),
            env=env,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=int(os.environ.get("RUHROH_EVAL_TIMEOUT_SEC", "300")),
            shell=command_shell_enabled("RUHROH_EVAL_COMMAND_SHELL"),
        )
        if completed.returncode != 0:
            return synthetic_eval_infra_failure(
                scenario_id=scenario_id,
                eval_workspace_root=eval_workspace_root,
                eval_output_path=eval_output_path,
                diagnostics=completed.stdout[-4000:],
            )
        parsed = read_json_file(eval_output_path)
        if isinstance(parsed, dict):
            parsed = normalize_eval_result(parsed)
            eval_output_path.parent.mkdir(parents=True, exist_ok=True)
            eval_output_path.write_text(json.dumps(parsed, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            return parsed
        for line in reversed(completed.stdout.splitlines()):
            try:
                parsed_line = json.loads(line)
            except Exception:
                continue
            if isinstance(parsed_line, dict):
                parsed_line = normalize_eval_result(parsed_line)
                eval_output_path.parent.mkdir(parents=True, exist_ok=True)
                eval_output_path.write_text(json.dumps(parsed_line, indent=2, sort_keys=True) + "\n", encoding="utf-8")
                return parsed_line
        return synthetic_eval_infra_failure(
            scenario_id=scenario_id,
            eval_workspace_root=eval_workspace_root,
            eval_output_path=eval_output_path,
            diagnostics="RUHROH_EVAL_COMMAND completed but did not write or print a JSON eval result.",
        )
    return synthetic_eval_infra_failure(
        scenario_id=scenario_id,
        eval_workspace_root=eval_workspace_root,
        eval_output_path=eval_output_path,
        diagnostics="Package-owned Ruhroh runtime requires RUHROH_EVAL_RESULT_FIXTURE, RUHROH_EVAL_RESULT_FIXTURE_PATH, or RUHROH_EVAL_COMMAND.",
    )


def build_eval_input(
    scenario_id: str,
    eval_workspace_root: Path,
    original_workspace_root: Path,
    journey_path: Path,
    eval_output_path: Path,
) -> dict[str, Any]:
    return {
        "version": "ruhroh_eval_input_v1",
        "scenarioId": scenario_id,
        "workspacePath": str(eval_workspace_root),
        "originalWorkspacePath": str(original_workspace_root),
        "journeyPath": str(journey_path),
        "evalOutputPath": str(eval_output_path),
        "scenarioContext": read_json_env_array("RUHROH_EVAL_SCENARIO_CONTEXT_JSON"),
        "goalRubric": read_json_env_array("RUHROH_EVAL_GOAL_RUBRIC_JSON"),
        "evidenceGuidance": read_json_env_array("RUHROH_EVAL_EVIDENCE_GUIDANCE_JSON"),
        "calibrationCases": read_json_env_object_array("RUHROH_EVAL_CALIBRATION_CASES_JSON"),
        "privateAssets": read_json_env_array("RUHROH_EVAL_PRIVATE_ASSETS_JSON"),
    }


def read_json_env_array(key: str) -> list[str]:
    raw = os.environ.get(key)
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def read_json_env_object_array(key: str) -> list[dict[str, Any]]:
    raw = os.environ.get(key)
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, dict)]


def normalize_eval_result(result: dict[str, Any]) -> dict[str, Any]:
    status = result.get("status")
    if status not in {"passed", "failed", "review", "infra_failed"}:
        status = "infra_failed"
    normalized = {
        "$schema": EVAL_RESULT_SCHEMA_URL,
        "version": "ruhroh_eval_result_v1",
        "status": status,
        "goalMet": bool(result.get("goalMet")) if isinstance(result.get("goalMet"), bool) else status == "passed",
        "confidence": result.get("confidence") if result.get("confidence") in {"low", "medium", "high"} else "medium",
        "reasons": string_list(result.get("reasons")),
        "unmetCriteria": string_list(result.get("unmetCriteria")),
        "evidenceRefs": evidence_refs(result.get("evidenceRefs")),
        "commandsRun": command_records(result.get("commandsRun")),
        "artifacts": string_record(result.get("artifacts")),
        "finalSummary": result.get("finalSummary") if isinstance(result.get("finalSummary"), str) else f"Eval-agent status: {status}.",
    }
    for key in ("repairBrief", "criteriaResults", "subscores", "judge", "judgeVotes", "judgeAgreement"):
        if key in result:
            normalized[key] = result[key]
    return normalized


def string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str)]


def string_record(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {str(key): item for key, item in value.items() if isinstance(key, str) and isinstance(item, str)}


def evidence_refs(value: Any) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    refs: list[dict[str, str]] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("kind"), str) and isinstance(item.get("ref"), str):
            refs.append({
                "kind": item["kind"],
                "ref": item["ref"],
                "summary": item.get("summary") if isinstance(item.get("summary"), str) else "",
            })
    return refs


def command_records(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    records: list[dict[str, Any]] = []
    for item in value:
        if isinstance(item, dict) and isinstance(item.get("command"), str):
            records.append({
                "command": item["command"],
                "exitCode": item.get("exitCode") if isinstance(item.get("exitCode"), int) else 0,
                "summary": item.get("summary") if isinstance(item.get("summary"), str) else "",
            })
    return records


def read_eval_fixture() -> dict[str, Any] | None:
    raw = os.environ.get("RUHROH_EVAL_RESULT_FIXTURE")
    if raw:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    path = os.environ.get("RUHROH_EVAL_RESULT_FIXTURE_PATH")
    if not path:
        return None
    parsed = read_json_file(Path(path))
    return parsed if isinstance(parsed, dict) else None


def synthetic_eval_infra_failure(
    scenario_id: str,
    eval_workspace_root: Path,
    eval_output_path: Path,
    diagnostics: str,
) -> dict[str, Any]:
    result = {
        "$schema": EVAL_RESULT_SCHEMA_URL,
        "version": "ruhroh_eval_result_v1",
        "status": "infra_failed",
        "goalMet": False,
        "confidence": "high",
        "reasons": ["Eval-agent failed to produce a usable terminal judgment."],
        "unmetCriteria": ["Eval-agent failed."],
        "evidenceRefs": [{"kind": "environment", "ref": str(eval_output_path), "summary": diagnostics[-1000:]}],
        "commandsRun": [],
        "artifacts": {"workspacePath": str(eval_workspace_root), "evalOutputPath": str(eval_output_path)},
        "finalSummary": f"Eval-agent failed for {scenario_id}.",
    }
    eval_output_path.parent.mkdir(parents=True, exist_ok=True)
    eval_output_path.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return result


def derive_final_verdict(implementation_runs: list[dict[str, Any]], eval_result: dict[str, Any]) -> dict[str, Any]:
    runtime_failure = next(
        (
            run
            for run in implementation_runs
            if run.get("status") != "completed"
            or (
                isinstance(run.get("completionStatus"), dict)
                and run["completionStatus"].get("state") == "terminal_failure"
            )
        ),
        None,
    )
    if runtime_failure is not None:
        completion_status = runtime_failure.get("completionStatus")
        completion_reason = completion_status.get("reason") if isinstance(completion_status, dict) else None
        return {
            "status": "failed",
            "failure_kind": completion_reason or runtime_failure.get("failureKind") or "runtime_failure",
            "score": 0,
        }
    eval_status = eval_result.get("status")
    if eval_status == "passed":
        return {"status": "completed", "failure_kind": "none", "score": 1}
    if eval_status == "review":
        return {"status": "failed", "failure_kind": "review_required", "score": 0}
    if eval_status == "infra_failed":
        return {"status": "failed", "failure_kind": "infra_failed", "score": 0}
    return {"status": "failed", "failure_kind": "goal_mismatch", "score": 0}


def write_workspace_tarball(workspace_root: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_path, "w:gz") as tar:
        if not workspace_root.exists():
            return
        for path in workspace_root.rglob("*"):
            if any(part in SKIP_WORKSPACE_TAR_NAMES for part in path.relative_to(workspace_root).parts):
                continue
            tar.add(path, arcname=str(path.relative_to(workspace_root)))


def write_workspace_summary(workspace_root: Path, output_path: Path) -> None:
    summary = summarize_workspace(workspace_root)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def summarize_workspace(workspace_root: Path) -> dict[str, Any]:
    top_level_entries: list[dict[str, Any]] = []
    sample_files: list[dict[str, Any]] = []
    project_markers: list[str] = []
    total_files = 0
    total_directories = 0
    total_bytes = 0
    skipped_paths = 0
    unreadable_paths = 0
    marker_names = {
        "package.json",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
        "pyproject.toml",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
        "README.md",
        "index.html",
        "vite.config.ts",
        "next.config.js",
        "tsconfig.json",
    }
    if not workspace_root.exists():
        return {
            "$schema": WORKSPACE_SUMMARY_SCHEMA_URL,
            "version": "ruhroh_workspace_summary_v1",
            "generatedAt": utc_now(),
            "workspaceRoot": str(workspace_root),
            "exists": False,
            "totalFiles": 0,
            "totalDirectories": 0,
            "totalBytes": 0,
            "topLevelEntries": [],
            "projectMarkers": [],
            "sampleFiles": [],
            "truncated": False,
        }

    for child in sorted(workspace_root.iterdir(), key=lambda item: item.name):
        try:
            top_level_entries.append({
                "path": child.name,
                "type": "directory" if child.is_dir() else "file",
            })
        except OSError:
            unreadable_paths += 1

    for path in sorted(workspace_root.rglob("*"), key=lambda item: str(item.relative_to(workspace_root))):
        relative = path.relative_to(workspace_root)
        if any(part in SKIP_WORKSPACE_TAR_NAMES for part in relative.parts):
            skipped_paths += 1
            continue
        try:
            if path.is_dir():
                total_directories += 1
                continue
            if not path.is_file():
                continue
            stat = path.stat()
            total_files += 1
            total_bytes += stat.st_size
            relative_text = str(relative)
            if path.name in marker_names:
                project_markers.append(relative_text)
            if len(sample_files) < WORKSPACE_SUMMARY_MAX_FILES:
                file_summary: dict[str, Any] = {
                    "path": relative_text,
                    "sizeBytes": stat.st_size,
                }
                if stat.st_size <= WORKSPACE_SUMMARY_HASH_MAX_BYTES:
                    file_summary["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
                sample_files.append(file_summary)
        except OSError:
            unreadable_paths += 1

    return {
        "$schema": WORKSPACE_SUMMARY_SCHEMA_URL,
        "version": "ruhroh_workspace_summary_v1",
        "generatedAt": utc_now(),
        "workspaceRoot": str(workspace_root),
        "exists": True,
        "totalFiles": total_files,
        "totalDirectories": total_directories,
        "totalBytes": total_bytes,
        "topLevelEntries": top_level_entries[:100],
        "projectMarkers": sorted(project_markers),
        "sampleFiles": sample_files,
        "truncated": total_files > len(sample_files),
        "skippedPaths": skipped_paths,
        "unreadablePaths": unreadable_paths,
    }


def write_directory_tarball(directory: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(output_path, "w:gz") as tar:
        if not directory.exists():
            return
        for path in directory.rglob("*"):
            tar.add(path, arcname=str(path.relative_to(directory)))


def build_run_manifest(
    *,
    ruhroh_run_id: str,
    scenario_id: str,
    started_at: str,
    duration_ms: int,
    max_iterations: int,
    implementation_stopped_reason: str,
    implementation_runs: list[dict[str, Any]],
    run_agent_manifest: dict[str, Any],
    adapter: RunAgentAdapter,
    session_handle: str,
    eval_result: dict[str, Any] | None,
    workspace_root: Path,
    eval_workspace_root: Path,
    artifact_paths: dict[str, str],
    failure_details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    scenario_metadata = read_json_env_object("RUHROH_SCENARIO_METADATA_JSON")
    adapter_manifest_snapshot = declared_adapter_manifest_snapshot(run_agent_manifest)
    resource_budgets_snapshot = declared_resource_budgets_snapshot()
    manifest: dict[str, Any] = {
        "$schema": RUN_MANIFEST_SCHEMA_URL,
        "version": "ruhroh_run_manifest_v1",
        "runId": ruhroh_run_id,
        "scenario": {
            "id": scenario_id,
            **({"metadata": scenario_metadata} if scenario_metadata else {}),
            **({"scenarioVersion": scenario_metadata["scenarioVersion"]} if isinstance(scenario_metadata.get("scenarioVersion"), str) else {}),
            **({"runMode": optional_env("RUHROH_RUN_MODE")} if optional_env("RUHROH_RUN_MODE") else {}),
        },
        "benchmark": {
            "dataset": result_dataset(),
            "adapter": result_adapter(),
            "harborAgent": DEFAULT_ADAPTER,
        },
        "timing": {
            "startedAt": started_at,
            "endedAt": utc_now(),
            "durationMs": duration_ms,
        },
        "loop": {
            "maxIterations": max_iterations,
            "implementationIterationsUsed": len(implementation_runs),
            "stoppedReason": implementation_stopped_reason,
        },
        "sample": without_none_values({
            "id": optional_env("RUHROH_SAMPLE_ID"),
            "index": integer_env("RUHROH_RUN_INDEX"),
            "count": integer_env("RUHROH_RUN_COUNT"),
            "seed": optional_env("RUHROH_SAMPLE_SEED") or optional_env("RUHROH_RUN_SEED"),
            "weight": positive_number_env("RUHROH_SAMPLE_WEIGHT"),
        }),
        "workloadBinding": workload_binding_manifest(),
        "workloadProfile": workload_profile_manifest(),
        "adapterManifest": adapter_manifest_snapshot,
        "adapterManifestSha256": optional_sha256_env("RUHROH_ADAPTER_MANIFEST_SHA256") or (canonical_json_sha256(adapter_manifest_snapshot) if adapter_manifest_snapshot is not None else None),
        "resourceBudgets": resource_budgets_snapshot,
        "effectiveBudgetSha256": optional_sha256_env("RUHROH_EFFECTIVE_BUDGET_SHA256") or (canonical_json_sha256(resource_budgets_snapshot) if resource_budgets_snapshot is not None else None),
        "effectiveCapabilitiesSha256": optional_sha256_env("RUHROH_EFFECTIVE_CAPABILITIES_SHA256") or (
            canonical_json_sha256(adapter_manifest_snapshot.get("resources"))
            if isinstance(adapter_manifest_snapshot, dict) and isinstance(adapter_manifest_snapshot.get("resources"), dict)
            else None
        ),
        "runAgent": without_none_values({
            "adapterId": adapter.id,
            "adapterVersion": run_agent_manifest.get("adapterVersion") if isinstance(run_agent_manifest.get("adapterVersion"), str) else optional_env("RUHROH_RUN_AGENT_ADAPTER_VERSION"),
            "continuityLevel": adapter.continuity_level,
            "sessionHandle": session_handle,
            "runIds": run_agent_manifest.get("runIds", []),
            "model": run_agent_manifest.get("model") if isinstance(run_agent_manifest.get("model"), dict) else model_manifest(prefix="RUHROH_AGENT"),
            "usage": run_agent_manifest.get("usage") if isinstance(run_agent_manifest.get("usage"), dict) else None,
            "economics": run_agent_manifest.get("economics") if isinstance(run_agent_manifest.get("economics"), dict) else None,
            "adapterManifest": run_agent_manifest.get("adapterManifest") if isinstance(run_agent_manifest.get("adapterManifest"), dict) else None,
            "resourceBudgetOutcome": run_agent_manifest.get("resourceBudgetOutcome") if isinstance(run_agent_manifest.get("resourceBudgetOutcome"), dict) else None,
            "command": command_manifest("RUHROH_RUN_AGENT_COMMAND"),
        }),
        "evaluator": without_none_values({
            "command": command_manifest("RUHROH_EVAL_COMMAND"),
            "fixtureConfigured": bool(os.environ.get("RUHROH_EVAL_RESULT_FIXTURE") or os.environ.get("RUHROH_EVAL_RESULT_FIXTURE_PATH")),
            "inputSummary": evaluator_input_summary(),
            "judge": eval_result.get("judge") if isinstance(eval_result, dict) and isinstance(eval_result.get("judge"), dict) else None,
            "model": model_manifest(prefix="RUHROH_EVAL"),
        }),
        "environment": without_none_values({
            "fingerprint": environment_fingerprint(),
            "pythonVersion": platform.python_version(),
            "platform": platform.platform(),
            "system": platform.system(),
            "machine": platform.machine(),
            "containerImage": optional_env("RUHROH_CONTAINER_IMAGE"),
            "runIndex": integer_env("RUHROH_RUN_INDEX"),
            "runCount": integer_env("RUHROH_RUN_COUNT"),
            "workspaceRoot": str(workspace_root),
            "evalWorkspaceRoot": str(eval_workspace_root),
        }),
        "env": {
            "forwardedKeys": forwarded_env_keys(),
            "secretKeysPresent": secret_env_keys_present(),
            "runtime": runtime_env_manifest(),
        },
        "usage": usage_manifest(
            run_agent_manifest.get("usage") if isinstance(run_agent_manifest.get("usage"), dict) else None,
            allow_env_fallback=not (
                isinstance(run_agent_manifest.get("economics"), dict)
                and run_agent_manifest["economics"].get("legacy") is False
            ),
        ),
        "economics": run_agent_manifest.get("economics") if isinstance(run_agent_manifest.get("economics"), dict) else None,
        "resourceBudgetOutcome": run_agent_manifest.get("resourceBudgetOutcome") if isinstance(run_agent_manifest.get("resourceBudgetOutcome"), dict) else None,
        "artifactPaths": artifact_paths,
    }
    benchmark_target = benchmark_target_manifest(run_agent_manifest)
    if benchmark_target:
        manifest["benchmarkTarget"] = benchmark_target
    if failure_details is not None:
        manifest["failureDetails"] = failure_details
    return without_none_values(manifest)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def evaluator_input_summary() -> dict[str, Any]:
    private_assets = read_json_env_array("RUHROH_EVAL_PRIVATE_ASSETS_JSON")
    return {
        "scenarioContextCount": len(read_json_env_array("RUHROH_EVAL_SCENARIO_CONTEXT_JSON")),
        "goalRubricCount": len(read_json_env_array("RUHROH_EVAL_GOAL_RUBRIC_JSON")),
        "evidenceGuidanceCount": len(read_json_env_array("RUHROH_EVAL_EVIDENCE_GUIDANCE_JSON")),
        "calibrationCaseCount": len(read_json_env_object_array("RUHROH_EVAL_CALIBRATION_CASES_JSON")),
        "privateAssetCount": len(private_assets),
        "privateAssetPathHashes": [hash_text(asset) for asset in private_assets],
    }


def hash_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def optional_env(key: str) -> str | None:
    value = os.environ.get(key)
    return value if value not in (None, "") else None


def read_json_env_object(key: str) -> dict[str, Any]:
    raw = os.environ.get(key)
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def command_manifest(env_key: str) -> dict[str, Any]:
    command = os.environ.get(env_key)
    if command is None or command.strip() == "":
        return {"configured": False}
    manifest = {
        "configured": True,
        "envKey": env_key,
        "sha256": hashlib.sha256(command.encode("utf-8")).hexdigest(),
        "shellEnabled": command_shell_enabled(f"{env_key}_SHELL"),
    }
    inline_base64 = os.environ.get(f"{env_key}_INLINE_BASE64")
    if inline_base64:
        try:
            manifest["inlineSha256"] = hashlib.sha256(base64.b64decode(inline_base64)).hexdigest()
        except Exception:
            manifest["inlineSha256"] = "invalid-inline-base64"
    return manifest


def command_shell_enabled(env_key: str) -> bool:
    return str(os.environ.get(env_key, "")).strip().lower() in {"1", "true", "yes", "on"}


def run_command_capture(
    args: str | list[str],
    *,
    cwd: str,
    env: dict[str, str],
    timeout: float,
    shell: bool,
    stream_output: bool = False,
    on_process_started: Callable[[float], None] | None = None,
) -> subprocess.CompletedProcess[str]:
    process_started_at = time.monotonic()
    process = subprocess.Popen(
        args,
        cwd=cwd,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        shell=shell,
        bufsize=1,
        start_new_session=os.name != "nt",
    )
    if on_process_started is not None:
        on_process_started(process_started_at)
    if not stream_output:
        try:
            stdout, _ = process.communicate(timeout=timeout)
            completed = subprocess.CompletedProcess(args, process.returncode, stdout=stdout or "", stderr=None)
            setattr(completed, "process_started_at_monotonic", process_started_at)
            setattr(completed, "process_completed_at_monotonic", time.monotonic())
            return completed
        except subprocess.TimeoutExpired:
            timeout_observed_at = time.monotonic()
            termination = terminate_process_tree(process)
            terminated_at = time.monotonic()
            stdout, _ = process.communicate()
            error = subprocess.TimeoutExpired(args, timeout, output=stdout or "")
            setattr(error, "process_started_at_monotonic", process_started_at)
            setattr(error, "timeout_observed_at_monotonic", timeout_observed_at)
            setattr(error, "terminated_at_monotonic", terminated_at)
            setattr(error, "termination_evidence", termination)
            raise error

    chunks: list[str] = []

    def read_stdout() -> None:
        if process.stdout is None:
            return
        for chunk in iter(lambda: process.stdout.read(1), ""):
            chunks.append(chunk)
            sys.stdout.write(chunk)
            sys.stdout.flush()

    reader = threading.Thread(target=read_stdout, daemon=True)
    reader.start()
    try:
        return_code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timeout_observed_at = time.monotonic()
        termination = terminate_process_tree(process)
        terminated_at = time.monotonic()
        reader.join(timeout=1)
        error = subprocess.TimeoutExpired(args, timeout, output="".join(chunks))
        setattr(error, "process_started_at_monotonic", process_started_at)
        setattr(error, "timeout_observed_at_monotonic", timeout_observed_at)
        setattr(error, "terminated_at_monotonic", terminated_at)
        setattr(error, "termination_evidence", termination)
        raise error
    reader.join()
    completed = subprocess.CompletedProcess(args, return_code, stdout="".join(chunks), stderr=None)
    setattr(completed, "process_started_at_monotonic", process_started_at)
    setattr(completed, "process_completed_at_monotonic", time.monotonic())
    return completed


def terminate_process_tree(process: subprocess.Popen[str]) -> dict[str, Any]:
    termination_started_at = time.monotonic()
    scope = "process_group" if os.name != "nt" else "process"
    signals_sent: list[str] = []
    if process.poll() is not None:
        return {
            "scope": scope,
            "gracePeriodMs": PROCESS_TERMINATION_GRACE_SECONDS * 1000,
            "signalsSent": signals_sent,
            "terminatedBy": "already_exited",
            "terminationDurationMs": max(0, round((time.monotonic() - termination_started_at) * 1000)),
        }
    try:
        if os.name != "nt":
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        signals_sent.append("SIGTERM")
        process.wait(timeout=PROCESS_TERMINATION_GRACE_SECONDS)
        return {
            "scope": scope,
            "gracePeriodMs": PROCESS_TERMINATION_GRACE_SECONDS * 1000,
            "signalsSent": signals_sent,
            "terminatedBy": "SIGTERM",
            "terminationDurationMs": max(0, round((time.monotonic() - termination_started_at) * 1000)),
        }
    except ProcessLookupError:
        return {
            "scope": scope,
            "gracePeriodMs": PROCESS_TERMINATION_GRACE_SECONDS * 1000,
            "signalsSent": signals_sent,
            "terminatedBy": "not_found",
            "terminationDurationMs": max(0, round((time.monotonic() - termination_started_at) * 1000)),
        }
    except subprocess.TimeoutExpired:
        pass
    if process.poll() is not None:
        return {
            "scope": scope,
            "gracePeriodMs": PROCESS_TERMINATION_GRACE_SECONDS * 1000,
            "signalsSent": signals_sent,
            "terminatedBy": "SIGTERM",
            "terminationDurationMs": max(0, round((time.monotonic() - termination_started_at) * 1000)),
        }
    try:
        if os.name != "nt":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
        signals_sent.append("SIGKILL")
    except ProcessLookupError:
        return {
            "scope": scope,
            "gracePeriodMs": PROCESS_TERMINATION_GRACE_SECONDS * 1000,
            "signalsSent": signals_sent,
            "terminatedBy": "not_found",
            "terminationDurationMs": max(0, round((time.monotonic() - termination_started_at) * 1000)),
        }
    process.wait()
    return {
        "scope": scope,
        "gracePeriodMs": PROCESS_TERMINATION_GRACE_SECONDS * 1000,
        "signalsSent": signals_sent,
        "terminatedBy": "SIGKILL",
        "terminationDurationMs": max(0, round((time.monotonic() - termination_started_at) * 1000)),
    }


def materialize_inline_command(command_env_key: str, installed_dir: Path) -> None:
    inline_base64 = os.environ.get(f"{command_env_key}_INLINE_BASE64")
    if not inline_base64:
        return
    inline_name = os.environ.get(f"{command_env_key}_INLINE_NAME") or f"{command_env_key.lower()}.sh"
    safe_name = "".join(ch if ch.isalnum() or ch in {".", "_", "-"} else "-" for ch in inline_name).lstrip("-") or f"{command_env_key.lower()}.sh"
    command_dir = installed_dir / "local-commands"
    command_dir.mkdir(parents=True, exist_ok=True)
    command_path = command_dir / safe_name
    payload = base64.b64decode(inline_base64)
    if not command_path.exists() or command_path.read_bytes() != payload:
        command_path.write_bytes(payload)
        command_path.chmod(0o755)
    os.environ[command_env_key] = str(command_path)


def command_args(command: str, *, shell_env_key: str) -> str | list[str]:
    stripped = command.strip()
    if command_shell_enabled(shell_env_key):
        return stripped
    if Path(stripped).exists():
        return [stripped]
    try:
        args = shlex.split(stripped)
    except ValueError as error:
        raise RuntimeError(f"Invalid command syntax for no-shell execution: {error}") from error
    if len(args) == 0:
        raise RuntimeError("Command cannot be empty")
    return args


def model_manifest(*, prefix: str) -> dict[str, Any]:
    provider = optional_env(f"{prefix}_PROVIDER") or optional_env("RUHROH_MODEL_PROVIDER") or optional_env("KCHAT_MODEL_PROVIDER")
    model = optional_env(f"{prefix}_MODEL") or optional_env("RUHROH_MODEL") or optional_env("KCHAT_MODEL")
    return without_none_values({
        "provider": provider,
        "model": model,
        "canonicalId": optional_env(f"{prefix}_MODEL_CANONICAL_ID"),
        "protocol": optional_env(f"{prefix}_PROTOCOL"),
        "version": optional_env(f"{prefix}_MODEL_VERSION"),
        "promptVersion": optional_env(f"{prefix}_PROMPT_VERSION") or optional_env("RUHROH_PROMPT_VERSION"),
    })


def benchmark_target_manifest(run_agent_manifest: dict[str, Any]) -> dict[str, Any]:
    raw = optional_env("RUHROH_BENCHMARK_TARGET_JSON")
    target = read_json_string(raw) if raw else {}
    if not isinstance(target, dict):
        target = {}
    target_id = optional_env("RUHROH_BENCHMARK_TARGET_ID")
    harness = optional_env("RUHROH_AGENT_HARNESS")
    if target_id and not isinstance(target.get("targetId"), str):
        target["targetId"] = target_id
    if harness and not isinstance(target.get("harness"), dict):
        target["harness"] = {"name": harness}
    requested_model = model_manifest(prefix="RUHROH_AGENT")
    existing_requested_model = target.get("requestedModel")
    if not valid_model_manifest(existing_requested_model) and valid_model_manifest(requested_model):
        merged_requested_model = dict(existing_requested_model) if isinstance(existing_requested_model, dict) else {}
        merged_requested_model.update(requested_model)
        target["requestedModel"] = merged_requested_model
    actual_model = run_agent_manifest.get("model")
    if isinstance(actual_model, dict):
        target["actualModel"] = actual_model
    target = without_none_values(target)
    if not non_empty_string(target.get("targetId")) or not valid_model_manifest(target.get("requestedModel")):
        return {}
    return target


def workload_binding_manifest() -> dict[str, Any] | None:
    binding = read_json_env_object("RUHROH_WORKLOAD_BINDING_JSON")
    if binding.get("version") != "ruhroh_workload_binding_v1":
        return None
    required = ("experimentId", "workloadId", "projectId")
    if any(not non_empty_string(binding.get(field)) for field in required):
        return None
    return without_none_values({
        "version": "ruhroh_workload_binding_v1",
        "experimentId": binding["experimentId"],
        "workloadId": binding["workloadId"],
        "projectId": binding["projectId"],
        "workflowInstanceId": binding.get("workflowInstanceId") if non_empty_string(binding.get("workflowInstanceId")) else None,
    })


def workload_profile_manifest() -> dict[str, Any] | None:
    profile = read_json_env_object("RUHROH_WORKLOAD_PROFILE_JSON")
    if profile.get("version") != "ruhroh_workload_profile_v1" or not non_empty_string(profile.get("profileId")):
        return None
    taxonomy = profile.get("taxonomy")
    archetype = workload_classification(profile.get("archetype"), label_required=False)
    unit_of_work = workload_classification(profile.get("unitOfWork"), label_required=True)
    if (
        not isinstance(taxonomy, dict)
        or not non_empty_string(taxonomy.get("namespace"))
        or ":" not in taxonomy["namespace"]
        or not non_empty_string(taxonomy.get("version"))
        or archetype is None
        or unit_of_work is None
    ):
        return None
    business_capability = workload_classification(profile.get("businessCapability"), label_required=False, optional=True)
    task_purpose = workload_classification(profile.get("taskPurpose"), label_required=False, optional=True)
    if profile.get("businessCapability") is not None and business_capability is None:
        return None
    if profile.get("taskPurpose") is not None and task_purpose is None:
        return None
    denominator_ref = profile.get("denominatorCardRef")
    if denominator_ref is not None and not non_empty_string(denominator_ref):
        return None
    return without_none_values({
        "$schema": profile.get("$schema") if profile.get("$schema") == f"{SCHEMA_BASE_URL}/workload-profile-v1.schema.json" else None,
        "version": "ruhroh_workload_profile_v1",
        "profileId": profile["profileId"],
        "taxonomy": {"namespace": taxonomy["namespace"], "version": taxonomy["version"]},
        "archetype": archetype,
        "businessCapability": business_capability,
        "taskPurpose": task_purpose,
        "unitOfWork": unit_of_work,
        "denominatorCardRef": denominator_ref,
    })


def declared_adapter_manifest_snapshot(run_agent_manifest: dict[str, Any]) -> dict[str, Any] | None:
    configured = read_json_env_object("RUHROH_ADAPTER_MANIFEST_JSON")
    if configured:
        return configured if not validate_adapter_manifest(configured) else None
    actual = run_agent_manifest.get("adapterManifest")
    return actual if isinstance(actual, dict) and not validate_adapter_manifest(actual) else None


def declared_resource_budgets_snapshot() -> dict[str, Any] | None:
    configured = read_json_env_object("RUHROH_RESOURCE_BUDGETS_JSON")
    return configured if configured and not validate_resource_budgets(configured) else None


def optional_sha256_env(key: str) -> str | None:
    value = optional_env(key)
    if value is None or len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value):
        return None
    return value


def workload_classification(value: Any, *, label_required: bool, optional: bool = False) -> dict[str, str] | None:
    if value is None and optional:
        return None
    if not isinstance(value, dict) or not non_empty_string(value.get("id")):
        return None
    label = value.get("label")
    if label_required and not non_empty_string(label):
        return None
    if label is not None and not non_empty_string(label):
        return None
    return without_none_values({"id": value["id"], "label": label})


def valid_model_manifest(value: Any) -> bool:
    return isinstance(value, dict) and non_empty_string(value.get("model"))


def non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and value.strip() != ""


def read_json_string(raw: str | None) -> Any:
    if raw is None or raw.strip() == "":
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def usage_manifest(adapter_usage: dict[str, Any] | None = None, *, allow_env_fallback: bool = True) -> dict[str, Any]:
    return without_none_values({
        "costUsd": nonnegative_number_field(adapter_usage, "costUsd") if adapter_usage is not None and nonnegative_number_field(adapter_usage, "costUsd") is not None else numeric_env("RUHROH_COST_USD") if allow_env_fallback else None,
        "inputTokens": nonnegative_integer_field(adapter_usage, "inputTokens") if adapter_usage is not None and nonnegative_integer_field(adapter_usage, "inputTokens") is not None else integer_env("RUHROH_INPUT_TOKENS") if allow_env_fallback else None,
        "outputTokens": nonnegative_integer_field(adapter_usage, "outputTokens") if adapter_usage is not None and nonnegative_integer_field(adapter_usage, "outputTokens") is not None else integer_env("RUHROH_OUTPUT_TOKENS") if allow_env_fallback else None,
        "totalTokens": nonnegative_integer_field(adapter_usage, "totalTokens") if adapter_usage is not None and nonnegative_integer_field(adapter_usage, "totalTokens") is not None else integer_env("RUHROH_TOTAL_TOKENS") if allow_env_fallback else None,
    })


def runtime_env_manifest() -> dict[str, str]:
    output: dict[str, str] = {}
    for key in (
        "RUHROH_RUN_SEED",
        "RUHROH_RUN_INDEX",
        "RUHROH_RUN_COUNT",
        "RUHROH_RETRY_POLICY",
        "RUHROH_MAX_ITERATIONS",
        "RUHROH_ITERATION_TIMEOUT_SEC",
        "RUHROH_AGENT_TIMEOUT_SEC",
        "RUHROH_EVAL_TIMEOUT_SEC",
    ):
        value = os.environ.get(key)
        if value not in (None, ""):
            output[key] = value
    return output


def environment_fingerprint() -> dict[str, Any]:
    components = without_none_values({
        "pythonVersion": platform.python_version(),
        "platform": platform.platform(),
        "system": platform.system(),
        "machine": platform.machine(),
        "containerImage": optional_env("RUHROH_CONTAINER_IMAGE"),
    })
    canonical = json.dumps(components, sort_keys=True, separators=(",", ":"))
    return {
        "method": "sha256",
        "sha256": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        "components": components,
    }


def forwarded_env_keys() -> list[str]:
    prefixes = ("OPENAI_", "OPENROUTER_", "ANTHROPIC_", "TAVILY_", "KCHAT_", "RUHROH_")
    return sorted(key for key in os.environ if key.startswith(prefixes))


def secret_env_keys_present() -> list[str]:
    secret_markers = ("API_KEY", "ACCESS_TOKEN", "AUTH_TOKEN", "BEARER_TOKEN", "SECRET", "PASSWORD")
    return sorted(key for key in os.environ if any(marker in key for marker in secret_markers))


def numeric_env(key: str) -> float | None:
    value = os.environ.get(key)
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def positive_number_env(key: str) -> float | None:
    value = numeric_env(key)
    return value if value is not None and math.isfinite(value) and value > 0 else None


def nonnegative_number_field(record: dict[str, Any], key: str) -> float | int | None:
    value = record.get(key)
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def nonnegative_integer_field(record: dict[str, Any], key: str) -> int | None:
    value = record.get(key)
    if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
        return value
    return None


def integer_env(key: str) -> int | None:
    value = os.environ.get(key)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError:
        return None


def without_none_values(value: dict[str, Any]) -> dict[str, Any]:
    return {key: item for key, item in value.items() if item is not None}


def append_jsonl(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, sort_keys=True) + "\n")


def write_jsonl(path: Path, values: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(value, sort_keys=True) + "\n" for value in values), encoding="utf-8")


def read_json_file(path: Path) -> Any | None:
    try:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def emit_result(result: dict[str, Any]) -> None:
    encoded = base64.b64encode(json.dumps(result, sort_keys=True).encode("utf-8")).decode("ascii")
    print(f"{RESULT_MARKER_PREFIX}{encoded}", flush=True)


def resolve_workspace_root() -> str:
    configured = os.environ.get("RUHROH_WORKSPACE_ROOT") or os.environ.get("KESTREL_TBENCH_WORKSPACE_ROOT")
    if configured and Path(configured).is_dir():
        return configured
    if Path("/app").is_dir():
        return "/app"
    cwd = Path.cwd()
    if cwd.is_dir() and str(cwd) != "/":
        return str(cwd)
    return "/app"


def read_max_iterations() -> int:
    raw = os.environ.get("RUHROH_MAX_ITERATIONS")
    if raw is None:
        return DEFAULT_MAX_ITERATIONS
    try:
        return max(1, int(raw))
    except ValueError:
        return DEFAULT_MAX_ITERATIONS


def read_iteration_timeout_sec() -> int:
    raw = os.environ.get("RUHROH_ITERATION_TIMEOUT_SEC")
    if raw is None:
        return 1200
    try:
        return max(1, int(raw))
    except ValueError:
        return 1200


def load_repo_dotenv() -> None:
    for env_path in (Path.cwd() / ".env",):
        if not env_path.exists():
            continue
        for key, value in parse_dotenv(env_path.read_text(encoding="utf-8")).items():
            os.environ.setdefault(key, value)
        return


def load_run_env_file() -> None:
    env_path = os.environ.get("RUHROH_ENV_FILE")
    if not env_path:
        return
    path = Path(env_path)
    if not path.exists():
        return
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return
    if not isinstance(parsed, dict):
        return
    for key, value in parsed.items():
        if isinstance(key, str) and isinstance(value, str):
            os.environ[key] = value


def parse_dotenv(content: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in content.splitlines():
        parsed = parse_dotenv_line(line)
        if parsed is not None:
            key, value = parsed
            values[key] = value
    return values


def parse_dotenv_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None
    if stripped.startswith("export "):
        stripped = stripped[len("export "):].strip()
    if "=" not in stripped:
        return None
    key, value = stripped.split("=", 1)
    key = key.strip()
    if not key:
        return None
    if not key.replace("_", "").isalnum() or key[0].isdigit():
        return None
    return key, unquote_dotenv_value(value.strip())


def unquote_dotenv_value(value: str) -> str:
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1].replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    marker = value.find(" #")
    return (value[:marker] if marker >= 0 else value).strip()


def result_adapter() -> str:
    return os.environ.get("RUHROH_RESULT_ADAPTER") or DEFAULT_ADAPTER


def result_dataset() -> str:
    return os.environ.get("RUHROH_RESULT_DATASET") or DEFAULT_DATASET


def safe_id(value: str) -> str:
    stripped = value.strip().split("/")[-1]
    if not stripped.replace("-", "").replace("_", "").replace(".", "").isalnum():
        raise ValueError(f"Unsafe Ruhroh scenario id: {value}")
    return stripped


if __name__ == "__main__":
    sys.exit(main())
