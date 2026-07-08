---
id: ruhroh-faq
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - README.md
  - docs/architecture.md
---

# FAQ

## What Should I Do First?

Inspect the sample reports, then run the no-credentials example. Do not start
by authoring a public benchmark claim. The first milestone is a local
`ruhroh-loop-result.json` proving that task validation, agent wiring, reviewer
output, evidence preservation, and reports work on your machine. After that,
use `ruhroh workflow` to move through authoring, reviewer checks, repeated
runs, comparison, and publication readiness.

## Do I Need Harbor?

Harbor is the lower-level runner for full runs. You can still install Ruhroh,
validate tasks, scaffold benchmark packs, and generate Harbor task directories
before Harbor is available.

## Is Ruhroh An Agent Runner?

No. Ruhroh is not the agent. You bring the coding agent through a connector,
and Ruhroh owns task definitions, repeat-run sets, saved evidence, reports, and
the ready-to-publish check.

## How Is This Different From Terminal-Bench?

Ruhroh is Harbor-compatible, but its product boundary is realistic coding-agent
delivery: user-like software tasks, preserved implementation journeys,
workspace outcome evaluation, and audit-ready benchmark claims.

## Can I Use Model Judges?

Yes, but model-judge output should include judge metadata, criteria-level
results, evidence references, confidence, and enough summary detail for review.
Multi-judge disagreement should be treated as a review signal.

## How Many Runs Are Enough?

Suites define `methodology.minRuns`. Ruhroh warns below five runs because pass
rates and pass@k estimates are only directional with very small samples.

## Where Do Evidence Files Go?

Harbor run outputs preserve Ruhroh result JSON, run metadata, journey files,
reviewer input/output, transcripts, event logs, project summaries, and project
archives when available. Use `report`, `validate-artifacts`, `compare`, and
`publish-check` to inspect them.

## What Can I Publish?

Publish benchmark-suite-scoped claims that pass `publish-check`. Ad hoc compares are
useful for local analysis, but public claims should include benchmark-suite metadata,
planned-run coverage, source hashes, evidence validation, reviewer evidence,
and ready-to-publish status.
