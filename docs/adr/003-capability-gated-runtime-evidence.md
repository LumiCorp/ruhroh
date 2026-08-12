# ADR 003: Capability-gated runtime evidence and budgets

Status: accepted

## Context

Connectors expose different telemetry and interruption controls. Treating connector selection as proof of capability would allow unsupported budgets to incur provider spend and would turn missing telemetry into false containment claims.

## Decision

Each connector publishes an adapter manifest that declares observability, trace support, and enforcement capability per resource. Required budgets are checked against the effective capabilities before execution.

Wall time and implementation iterations are preemptive. Other resources are boundary-enforced unless executable conformance proves stronger interruption. Limits are inclusive. Completion wins only when received at or below the limit on the same observation boundary. Telemetry loss for a required budget produces `resource_budget_unobservable`.

Kestrel is the first reference connector, but it receives no capability merely from being selected. A sanitized fixture, executable conformance, and a live two-turn acceptance run must pass before its economics path is described as available. Transcript scraping is not usage telemetry.

Public traces permit numeric metadata, opaque local identifiers, hashes, relative evidence references, timing, route/model identity, and relationships. Prompts, tool payloads, principals, and raw provider request IDs are prohibited.

## Consequences

- Unsupported required limits fail before provider spend.
- A truncated final trace record becomes partial coverage rather than repaired evidence.
- Connector capabilities are reviewable and hashable inputs to the run.
- Economics suites remain experimental until the live gate passes.
