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

Inspect the sample evidence packet, then run the credential-free fixture path.
Do not start by authoring a public benchmark claim. The first milestone is a
local `ruhroh-loop-result.json` proving that scenario validation, adapter
wiring, evaluator output, artifact preservation, and reports work on your
machine. After that, use `ruhroh workflow` to move through authoring,
evaluator calibration, repeated runs, comparison, and publication readiness.

## Do I Need Harbor?

Harbor is the execution substrate for full runs. You can still install Ruhroh,
validate scenarios, scaffold benchmark packs, and generate Harbor task
directories before Harbor is available.

## Is Ruhroh An Agent Runner?

No. Ruhroh is the benchmark framework. You bring the coding agent through an
adapter, and Ruhroh owns scenarios, suites, artifacts, reports, and claim
readiness.

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

## Where Do Artifacts Go?

Harbor run outputs preserve Ruhroh result JSON, manifests, journey files, eval
input/output, transcripts, event logs, workspace summaries, and workspace
archives when available. Use `report`, `validate-artifacts`, `compare`, and
`publish-check` to inspect them.

## What Can I Publish?

Publish suite-scoped claims that pass `publish-check`. Ad hoc compares are
useful for local analysis, but public claims should include suite metadata,
run-plan coverage, source hashes, artifact validation, evaluator evidence, and
readiness status.
