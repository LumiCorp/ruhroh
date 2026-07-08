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

Ruhroh reports are designed to answer two beginner questions: what did the
agent do, and why should anyone trust the score? A reader should be able to
move from a summary result to the saved runs, review notes, transcripts, and
blockers behind it.

## Start Here

| Report | What it shows |
| --- | --- |
| [Workflow guide](/samples/ruhroh-workflow) | The step-by-step path from the built-in local example to a result that is ready to share. |
| [Single-run report](/samples/ruhroh-report) | One agent attempt with the verdict, review result, timeline, commands, saved evidence, and follow-up review signals. |
| [Evaluation evidence report](/samples/ruhroh-eval-quality) | Whether the reviewer supplied enough evidence, criteria, commands, and judge details to trust the result. |
| [Review queue](/samples/ruhroh-review) | The runs a human should inspect before trusting the overall score or publishing a benchmark result. |

## Compare And Claim Evidence

| Report | What it shows |
| --- | --- |
| [Compare report](/samples/ruhroh-compare) | Side-by-side agent results, expected-vs-actual run coverage, review items, missing evidence, low-sample warnings, and blockers. |
| [Claim index](/samples/ruhroh-claims) | A catalog of benchmark results, whether each is ready to cite, what blocks it, and where reviewers can inspect the evidence. |

## Publication Packet

| Report | What it shows |
| --- | --- |
| [Publication packet compare](/samples/ruhroh-publication/ruhroh-compare) | A portable compare report reviewers can inspect without the original run directory. |
| [Publication packet evaluation evidence](/samples/ruhroh-publication/ruhroh-eval-quality) | The portable evidence-quality report for the result reviewer. |
| [Publication packet review queue](/samples/ruhroh-publication/ruhroh-review) | The portable list of human review items for publication review. |

## How To Read The Samples

Start with the workflow guide, then open the single-run, evaluation-evidence,
and review reports to see how one agent attempt becomes auditable. The compare
report rolls those attempts into an overall result, but this sample is
intentionally small and not ready to publish: two synthetic runs are enough to
demonstrate the workflow, not enough to support a real benchmark claim.

The publication packet reports show how reviewers can inspect the status,
evidence map, verification summary, and next actions without opening the
original run directory. The packet still includes hashed source evidence under
`sources/`, but the gallery leads with the HTML reports instead of raw contract
files.

Regenerate these files after report contract changes:

```bash
pnpm build
pnpm run docs:samples
```

CI runs the stricter freshness check:

```bash
pnpm run docs:samples:check
```
