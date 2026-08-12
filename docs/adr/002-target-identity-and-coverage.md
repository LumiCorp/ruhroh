# ADR 002: Benchmark-target identity and coverage-gated ratios

Status: accepted

## Context

One execution connector can run several model-controlled targets. Grouping by connector collapses those systems into one cohort. Separately, partial token or cost telemetry can look precise when divided by successful outcomes even though unobserved work is missing.

## Decision

Ruhroh aggregates comparisons by `scenarioId + benchmarkTargetId`. `executionAdapterId` records how the run was executed and is only an identity fallback for archived evidence that predates planned target identity.

A malformed or missing planned target remains inspectable but blocks v2 publication. Model, route, or connector changes within a target remain cohort metadata and block comparability.

An accepted outcome is exactly an evaluator pass with score 1. All non-infrastructure-excluded work, including failures, retries, rework, and failed calls, remains in the resource numerator.

Token and cost coverage are independent. Partial totals are lower bounds. A per-accepted-outcome ratio is absent unless every included run has complete coverage for that metric and the denominator is nonzero. Publishable cost must be billed or metered in one native currency.

## Consequences

- Three targets using one connector remain three comparison groups.
- Historical v1 usage remains unknown and cannot be upgraded.
- Quality-only and partial-economics reports continue to work without fabricating ratios.
- Comparability failures remain visible rather than silently splitting or merging cohorts.
