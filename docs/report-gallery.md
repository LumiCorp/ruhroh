---
id: ruhroh-report-gallery
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/artifacts.md
  - docs/publish-claims.md
  - scripts/generate-docs-samples.mjs
---

# Report Gallery

Ruhroh reports are designed for audit, not just presentation. A reader should be
able to move from an aggregate score to the runs, manifests, evaluator evidence,
journeys, transcripts, and claim-readiness blockers behind it.

Open the generated samples:

- [Workflow guide](/ruhroh/samples/ruhroh-workflow.html)
- [Single-run report](/ruhroh/samples/ruhroh-report.html)
- [Eval-quality report](/ruhroh/samples/ruhroh-eval-quality.html)
- [Eval-quality JSON](/ruhroh/samples/ruhroh-eval-quality.json)
- [Review queue](/ruhroh/samples/ruhroh-review.html)
- [Review queue JSON](/ruhroh/samples/ruhroh-review.json)
- [Compare report](/ruhroh/samples/ruhroh-compare.html)
- [Run plan JSON](/ruhroh/samples/ruhroh-run-plan.json)
- [Benchmark claim JSON](/ruhroh/samples/benchmark-claim.json)
- [Benchmark summary JSON](/ruhroh/samples/benchmark-summary.json)
- [Publish-check JSON](/ruhroh/samples/publish-check.json)
- [Publication bundle manifest](/ruhroh/samples/ruhroh-publication/manifest.json)
- `samples/ruhroh-publication/README.md`: bundle-local reviewer map
- [Publication bundle validation JSON](/ruhroh/samples/publish-bundle-validation.json)
- [Claim index](/ruhroh/samples/ruhroh-claims.html)
- [Claim index JSON](/ruhroh/samples/claim-index.json)

The workflow guide is the lightweight orientation artifact: it shows the current
stage, next action, checks, commands, and doc pointers from first local fixture
run through publication readiness. The eval-quality report is the focused
evaluator-evidence gate: it shows warning counts, next actions, per-run
evidence counts, judge metadata, and result links before a claim is trusted.
The sample compare is intentionally small
and not publishable. It demonstrates how Ruhroh leads with a publication and
evidence overview before the detailed tables: publishable status, scope,
run-plan state, review queue, result sources, and named artifact coverage. The
same report then gives each run an evidence browser with direct links to the
result JSON, manifest, evaluator input/output, implementation journey,
transcript, events, workspace summary, and workspace archive. Below that, it
links the scenario-by-adapter matrix, failure triage, cost and efficiency when
usage metadata exists, low sample counts, evaluator-quality warnings, review
items, artifact hashes, claim readiness, and remediation codes before a
benchmark claim is cited. The run plan shows the intended scenario, adapter,
sample, and seed matrix that the compare report checks before any claim can be
published.

The publication bundle is structurally valid and source verification is clean;
the bundle README gives a reviewer the local packet map, status, source
verification summary, and remediation list without requiring the original
workspace. The bundle includes its hashed source evidence under `sources/` so
the claim can be validated after relocation. The claim index shows how one or
more bundles become a registry-ready catalog with claim status, blockers, suite
version, adapters, evidence counts, source paths, and direct links into each
bundle's reviewer packet. The sample remains blocked because two synthetic runs
are not enough for a real suite claim.

Regenerate these files after report contract changes:

```bash
pnpm build
pnpm run docs:samples
```

CI runs the stricter freshness check:

```bash
pnpm run docs:samples:check
```
