# ADR 004: Provider-neutral billing now; FOCUS adapter later

Status: accepted

## Context

Billed economics is not the same as runtime telemetry. Provider exports can include charges, credits, refunds, commitments, taxes, prepaid balances, and capacity fees with different join keys and currencies. FOCUS terminology and conformance behavior must not be approximated from secondary material.

## Decision

Ruhroh ships a provider-neutral billing source manifest, mapping profile, normalized rows, technical facts, and cost reconciliation. Inputs can be CSV, NDJSON, or iterable records. Reconciliation preserves exact, bounded, allocated, ambiguous, and unmatched joins. Allocation weights total one. Currency categories and billing fact kinds remain separate; there is no implicit foreign-exchange conversion.

Restricted and raw billing inputs cannot enter public bundles. Public artifacts contain reconciliation results, hashes, bounded workload identifiers, and disclosure-safe evidence references.

No FOCUS-named fields, mappings, fixtures, or exports ship in this version. A separately versioned import/reconciliation adapter requires verified final FOCUS 1.5 semantics and official conformance assets. FOCUS export remains deferred until demonstrated demand.

## Consequences

- The initial billing bridge is usable without claiming external-standard conformance.
- Provider-specific field names stay inside mapping profiles.
- Ambiguous and unmatched cost remains visible and blocks readiness instead of disappearing.
- A future FOCUS adapter can evolve independently without renaming the neutral core contracts.
