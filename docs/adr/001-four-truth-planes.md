# ADR 001: Four hash-linked truth planes

Status: accepted

## Context

Technical outcomes, runtime consumption, human intervention, billed cost, and business decisions come from different systems with different owners and evidence quality. Copying all facts into one report would make provenance ambiguous and allow a later projection to overwrite its source.

## Decision

Ruhroh uses four authoritative truth planes:

1. Benchmark claim v2, economics envelope, and causal trace own technical outcome and implementation consumption.
2. The intervention ledger owns human intervention, passive oversight, and attributable rework.
3. The cost-reconciliation artifact owns billed economics and billing-to-technical joins.
4. The decision context and decision packet own hypotheses, observation windows, ownership, readiness, and signed decisions.

Downstream artifacts reference sources using a relative path and the SHA-256 hash of finalized bytes. Raw facts stay in their authoritative artifact. Publication checks re-hash referenced sources.

## Consequences

- Reviewers can distinguish measured facts from projections and decisions.
- An artifact can be replaced only by changing its hash, making evidence drift visible.
- Bundles require explicit inventories and must keep restricted source material out of public outputs.
- Consumers need to resolve references when they want the full evidence graph.
