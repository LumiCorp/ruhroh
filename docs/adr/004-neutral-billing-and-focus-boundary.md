# ADR 004: Provider-neutral billing core with an isolated FOCUS adapter

Status: accepted

## Context

Billed economics is not the same as runtime telemetry. Provider exports can include charges, credits, refunds, commitments, taxes, prepaid balances, and capacity fees with different join keys and currencies. FOCUS terminology and conformance behavior must not be approximated from secondary material.

## Decision

Ruhroh retains the v1 provider-neutral billing contracts and adds an exact-decimal v2 source manifest, mapping profile, normalized row, and reconciliation. V2 monetary values are canonical decimal strings and never pass through a JavaScript `number`. Split allocations declare exact assigned amounts; optional weights are explanatory. Reconciliation preserves exact, bounded, allocated, ambiguous, and unmatched joins per native currency, with no implicit foreign-exchange conversion.

Restricted and raw billing inputs cannot enter public bundles. Public artifacts contain reconciliation results, hashes, bounded workload identifiers, and disclosure-safe evidence references.

FOCUS remains a separately versioned import adapter over the neutral core. Ruhroh imports CSV and Parquet for all four ratified FOCUS 1.4 datasets, pins the official specification commit and compiled-model hash, and requires the official validator version 2.2.1 for ready evidence. A FOCUS working draft may be inspected only through a commit-pinned semantic review; it cannot become a supported runtime input or be promoted automatically.

FOCUS-specific names stop at the adapter boundary and translate into neutral billing rows before reconciliation. The adapter is import-only. Export, certification claims, automatic ambiguous mappings, implicit currency conversion, and working-draft promotion remain deferred. Agents may generate a semantic diff and draft review packet, but normative, type, unit, currency, applicability, dataset, validator, and mapping changes require human approval.

## Consequences

- The billing bridge remains usable without FOCUS and without claiming external-standard conformance.
- Provider-specific field names stay inside mapping profiles.
- Ambiguous and unmatched cost remains visible and blocks readiness instead of disappearing.
- FOCUS mapping packs can evolve independently without renaming neutral core contracts.
- Ratified and preview support status remains explicit and hash-pinned.
