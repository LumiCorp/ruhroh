---
id: ruhroh-artifacts
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-09
depends_on:
  - src/results.ts
  - python/ruhroh/loop_controller.py
---

# Evidence Files

Ruhroh evidence shows what the agent tried, what it delivered, how the reviewer
judged it, and which files support the score. New JSON evidence includes a root
`$schema` URL pointing to the matching contract under `schemas/`.

## Start With A Question

| Question | First view | Then inspect |
| --- | --- | --- |
| Did one run deliver the outcome? | `ruhroh report <run>` | Result, unmet criteria, workspace, and reviewer evidence. |
| Why did it fail? | Single-run HTML report | Journey, implementation turns, transcript, events, and commands. |
| Did the reviewer support the score? | `ruhroh eval-quality <run>` | Criteria results, evidence references, judge metadata, and warnings. |
| What needs human judgment? | `ruhroh review <results>` | Required and recommended queue items with source links. |
| How do repeated runs differ? | `ruhroh compare <results>` | Cohorts, pass rates, uncertainty, failure modes, usage, and source runs. |
| Is the aggregate ready to share? | `ruhroh publish-check <results>` | Coverage, validation, reviewer quality, blockers, and advisories. |

## Reviewer Path

Start with the verdict, then walk backward through the evidence:

1. Open `ruhroh-loop-result.json` or run `ruhroh report` for the score,
   reviewer status, failure bucket, unmet criteria, and review queue.
2. Open `ruhroh-run-manifest.json` to confirm the task and adapter versions,
   sample, model, reviewer, environment, command hashes, and usage metadata.
3. Read `ruhroh-loop-journey.json`, `ruhroh-loop-iterations.jsonl`, transcripts,
   and events to understand what the agent attempted before it stopped.
4. Compare `ruhroh-loop-eval-input.json` with `ruhroh-loop-eval.json` to verify
   that the evaluator used the task rules and cited concrete evidence.
5. Inspect `ruhroh-workspace-summary.json` and, when needed,
   `ruhroh-workspace.tar.gz` to check the delivered state directly.

Saved evidence makes a result inspectable. It does not make the result
publishable. Run `validate-artifacts`, `eval-quality`, `review`, `compare`, and
`publish-check` before making a benchmark claim.

## Core Evidence

| File | What it proves |
| --- | --- |
| `ruhroh-loop-result.json` | Final Harbor-facing verdict and embedded run/review summary. |
| `ruhroh-run-manifest.json` | Task, sample, agent, reviewer, environment, command, timing, and optional usage metadata. |
| `ruhroh-loop-iterations.jsonl` | One implementation record for each run-agent turn. |
| `ruhroh-loop-journey.json` | The complete implementation journey summary. |
| `ruhroh-loop-eval-input.json` | Stable task context, rubric, guidance, calibration cases, private reviewer paths, project paths, and journey path supplied to the evaluator. |
| `ruhroh-loop-eval.json` | Reviewer judgment, criteria, evidence, commands, rationale, and judge metadata. |
| `ruhroh-workspace-summary.json` | Final project inventory, project markers, file and byte counts, and a bounded hash sample. |
| `ruhroh-workspace.tar.gz` | Final implementation workspace snapshot. |
| `ruhroh-loop-events.tar.gz` | Per-turn connector event logs when available. |
| `ruhroh-loop-transcripts.tar.gz` | Per-turn agent transcripts. |

Agent connectors may add logs, prompts, transcripts, or result files. Reference
them from structured result metadata instead of inferring them from filenames.

## Run Plan

Before an actual `ruhroh run`, the CLI writes
`.generated/ruhroh/ruhroh-run-plan.json`. The plan records:

- selected tasks and resolved adapter ids;
- sample ids and seeds;
- forwarded environment key names;
- generated dataset path;
- redacted Harbor commands.

It does not store secret values or raw command-backed connector paths. Use the
plan to verify that the completed results match the intended evaluation matrix.

## Inspect One Or More Runs

```bash
pnpm exec ruhroh report ./run-artifacts --html ruhroh-report.html
pnpm exec ruhroh validate-artifacts ./run-artifacts --json
pnpm exec ruhroh eval-quality ./run-artifacts --html ruhroh-eval-quality.html --json
pnpm exec ruhroh review ./results --html ruhroh-review.html
```

### `report`

The run report includes task and run identity, adapter, score, review state,
failure bucket, duration, iterations, selected metadata, implementation
timeline, subscores, judge agreement, unmet criteria, warnings, commands,
evidence inventory, and review queue.

HTML output is self-contained. Dynamic reviewer content is escaped, and path
cells link to evidence relative to the report. JSON output includes
`summary.artifactInventory`, where each named path records availability, size,
and SHA-256 when readable. Missing, directory-valued, and unreadable paths stay
visible with explicit errors.

### `validate-artifacts`

This CI-friendly check accepts one result file, one run directory, or a
recursive result root. It validates result, manifest, reviewer, workspace,
implementation-turn, journey, and evaluator-input artifacts. Missing or
malformed evidence is an error; older readable files without `$schema` produce
warnings.

### `eval-quality` And `review`

`eval-quality` checks evidence references, criteria results, commands, summary
detail, confidence, and judge metadata. Its HTML report includes warning counts,
next actions, per-run evidence counts, judge details, and result links.

`review` extracts `ruhroh_review_queue_v1` JSON or a static HTML packet. Queue
entries contain priority, task, adapter, run id, score, reviewer status, failure
bucket, reasons, unmet criteria, and evidence, transcript, and event paths.

`priority: "required"` covers explicit review judgments and reviewer
infrastructure failure. `priority: "recommended"` covers non-passing runs and
reviewer-quality findings.

## Journey And Reproducibility

The implementation timeline comes from `ruhroh-loop-iterations.jsonl`. Each
entry records turn status, completion state, stop reason, run id, transcript and
event paths, and a short note when available.

The manifest records secret key names, never values. Command-backed agent and
reviewer commands are represented by SHA-256 hashes so runs can be compared
without publishing local command strings or credentials.

Connectors may self-report `adapterVersion`, `model`, and `usage` through
`RUHROH_RESULT_PATH`. Ruhroh prefers that metadata for cohort and efficiency
reporting, with environment metadata as a fallback. The manifest's
`environment.fingerprint` hashes stable OS, Python, and container components.

## Compare Repeated Runs

```bash
pnpm exec ruhroh compare ./results --json
pnpm exec ruhroh compare ./results \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --html ruhroh-compare.html
```

Compare groups results by task and adapter, then leads with a task-by-agent
matrix. Each cell shows pass rate, run count, confidence interval, review count,
and warning count.

### Aggregate Detail

| Area | Included fields |
| --- | --- |
| Outcomes | Pass rate, Wilson 95% interval, pass@k, mean score and bootstrap interval, and mean subscores. |
| Execution | Median duration, iteration distribution, and failure buckets. |
| Review | Required-review count, evaluator-quality warnings, and cross-run review queue. |
| Usage | Available cost and token totals, means, and per-pass efficiency. |
| Comparability | Cohort metadata, low-sample warnings, and mixed-version or environment warnings. |

When multiple adapters have results for the same task, compare adds pairwise
pass-rate deltas with approximate 95% intervals. It warns when an interval
includes zero or either group has too few runs.

### Evidence And Readiness

Compare JSON and HTML include `claimReadiness`, which states whether the
aggregate is publishable and lists blockers and advisories. Evaluator-quality
warnings, evidence-validation errors, and missing core artifact paths block
publication. Validation warnings remain visible as advisories.

Every result should point to its manifest, implementation turns, journey,
evaluator input and output, workspace summary and archive, event archive, and
transcript archive. That inventory lets readers trace an aggregate score back
through the full run.

Compare JSON also includes `benchmarkClaim`, a compact export containing
methodology, adapter rollups, per-task results, pairwise deltas, readiness,
run-plan evidence, validation counts, review counts, and the inventory of each
included result. Write it separately with:

```bash
pnpm exec ruhroh compare ./results \
  --benchmark-claim benchmark-claim.json
```

When `--run-plan` is supplied, `runPlanWarnings` identify missing planned
samples, results without sample ids, and samples outside the plan. Those
warnings block publication.

### Usage And HTML Output

Usage comes from `runManifest.usage`: `costUsd`, `inputTokens`, `outputTokens`,
and `totalTokens`. Reports aggregate only available values and include
`runsWithUsage`; missing usage never becomes zero or changes pass/fail.

The HTML comparison includes the evidence overview, task-agent matrix,
needs-attention table, optional cost/efficiency view, and a saved-result table
with links to each run's evidence inventory.

See the [Report Gallery](./report-gallery.md) for checked-in reports and the
[Result JSON Reference](./result-json-reference.md) for field-level contracts.
