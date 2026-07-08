---
id: ruhroh-artifacts
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/results.ts
  - python/ruhroh/loop_controller.py
---

# Evidence Files

Evidence files show what the agent tried, what it delivered, how the reviewer
judged it, and which files support the score.

New JSON evidence files include a root `$schema` URL that points at the
matching schema shipped under `schemas/`, so archives remain self-describing.

## Reviewer Path

Start with the result, then walk backward through the evidence. A useful review
usually follows this order:

1. Open `ruhroh-loop-result.json` or run `ruhroh report` to see the final
   Harbor-facing verdict, reviewer status, unmet criteria, failure bucket, and
   review queue.
2. Open `ruhroh-run-manifest.json` to confirm the task version, sample,
   agent connector, reviewer identity, environment fingerprint, command
   hashes, usage metadata, and forwarded environment key names for the run.
3. Read `ruhroh-loop-journey.json`, `ruhroh-loop-iterations.jsonl`,
   transcripts, and event logs to understand what the agent actually attempted
   before it stopped.
4. Compare `ruhroh-loop-eval-input.json` with `ruhroh-loop-eval.json` to verify
   that the reviewer judged the final project against the task rules and saved
   concrete evidence for the decision.
5. Inspect `ruhroh-workspace-summary.json` and, when needed,
   `ruhroh-workspace.tar.gz` to check the delivered workspace state rather than
   relying on the score alone.

Saved evidence proves inspectability, not automatic publishability. Before
making a benchmark claim, run `validate-artifacts`, `eval-quality`, `review`,
`compare`, and then `publish-check` so missing evidence, weak reviewer support,
run-plan gaps, and publication blockers are visible.

Before an actual `ruhroh run` execution starts, the CLI writes
`.generated/ruhroh/ruhroh-run-plan.json`. This local plan records the selected
tasks, resolved agent connector ids, sample ids/seeds, forwarded environment key
names, generated dataset path, and redacted Harbor commands. It does not store
secret values or raw command-backed connector paths. Use it to connect a result
set back to the intended benchmark matrix.

Core evidence files:

- `ruhroh-loop-result.json`: final Harbor-facing verdict.
- `ruhroh-run-manifest.json`: reproducibility metadata for the run, including
  task version, sample id/seed, agent/reviewer metadata, timing,
  a deterministic environment fingerprint digest, forwarded env key names, and
  optional usage fields.
- `ruhroh-loop-iterations.jsonl`: one implementation-run record per run-agent
  turn.
- `ruhroh-loop-journey.json`: full implementation journey summary.
- `ruhroh-loop-eval-input.json`: stable reviewer input with task context,
  rubric, guidance, optional calibration cases, optional private reviewer asset
  paths, project paths, and journey path.
- `ruhroh-loop-eval.json`: reviewer judgment.
- `ruhroh-workspace-summary.json`: compact final project inventory with
  top-level entries, detected project markers, file counts, byte counts, and a
  bounded sample of file hashes.
- `ruhroh-workspace.tar.gz`: final implementation project snapshot.
- `ruhroh-loop-events.tar.gz`: per-iteration connector event logs when available.
- `ruhroh-loop-transcripts.tar.gz`: per-iteration agent transcripts.

Agent-specific evidence may include connector logs, prompts, transcripts, or
result files. They should be referenced from structured result metadata instead
of inferred by filename heuristics.

Generate a human-readable report from a result file or run directory:

```bash
pnpm exec ruhroh report ./ruhroh-loop-result.json
pnpm exec ruhroh report ./run-artifacts --json
pnpm exec ruhroh report ./run-artifacts --html ruhroh-report.html
pnpm exec ruhroh validate-artifacts ./run-artifacts --json
pnpm exec ruhroh review ./results --html ruhroh-review.html
```

`validate-artifacts` is the CI-friendly pre-publication check for one saved run
or a recursive result root. It checks loop results, run metadata, review
results, project summaries, implementation-iteration logs, journey files, and
review input files, then reports missing or malformed evidence as errors and
older missing `$schema` fields as warnings.

The report includes task id, run id, agent connector, Harbor-facing score,
review status, failure bucket, iteration count, duration, selected run metadata,
implementation timeline, subscore table, reviewer judge agreement, unmet
criteria, reviewer-evidence warnings, missing-evidence warnings, commands run,
evidence inventory, and a review queue.
See the [result JSON reference](./result-json-reference.md) for the field-level
contracts emitted by `report --json`, `compare --json`, run manifests,
reviewer results, and run plans.

`--html` writes a self-contained static report for sharing or archiving a run
review. Dynamic content from reviewer output is escaped. Evidence, transcript,
and event-log path cells link to the local files relative to the HTML report
path so a reviewer can open saved evidence without copying paths by hand.
`eval-quality --html` writes the reviewer evidence check as a separate static
report with warning counts, next actions, per-run evidence counts, judge
metadata, and result links.

Report output includes `summary.artifactInventory`, a sorted inventory of named
evidence files from `artifactPaths`. Each entry records the path, availability,
size, and SHA-256 digest when the referenced file is readable. Missing,
directory-valued, or unreadable paths stay visible with an explicit error so
reviewers can distinguish incomplete evidence from a passing score.

The report JSON includes `reviewQueue`, an array of runs that should be checked
before making benchmark claims. Queue entries include `priority`, task,
agent connector, run id, score, review status, failure bucket, reasons, unmet
criteria, evidence paths, transcript paths, and event-log paths.
`priority: "required"` is used for explicit reviewer review or reviewer
infrastructure failure; `priority: "recommended"` is used for non-passing runs
and reviewer-quality audit
findings. Use `ruhroh review` when you want only that queue, either as
`ruhroh_review_queue_v1` JSON for CI or as a static HTML human-review packet.

The implementation timeline is derived from `ruhroh-loop-iterations.jsonl` data
embedded in the final result. Each entry includes the run-agent turn status,
completion state, stop reason, run id, transcript path, event-log path, and a
short notes excerpt when available.

`ruhroh-run-manifest.json` intentionally records secret key names only, not
secret values. Command-backed agent and reviewer commands are represented by
SHA-256 hashes so repeated runs can be compared without publishing local command
strings or credentials.
Command-backed agents may self-report `adapterVersion`, `model`, and `usage`
in `RUHROH_RESULT_PATH`; Ruhroh stores those fields in the manifest and uses
them for aggregate cohort and cost/token reporting. Environment metadata remains
a fallback when the connector result omits those fields. Run manifests include
`environment.fingerprint`, a SHA-256 digest over stable OS/Python/container
components, and comparison cohorts prefer that digest when checking environment
comparability across runs.

Compare repeated runs by pointing at a directory containing saved results:

```bash
pnpm exec ruhroh compare ./results
pnpm exec ruhroh compare ./results --json
pnpm exec ruhroh compare ./results --run-plan .generated/ruhroh/ruhroh-run-plan.json --json
pnpm exec ruhroh compare ./results --html ruhroh-compare.html
```

Comparison groups runs by task and agent connector, then reports a compact
task-by-agent matrix before the detailed metrics. Each matrix cell shows
pass rate, run count, confidence interval, review count, and warning count so
readers can scan where each agent delivered before drilling into evidence.
Detailed compare output includes pass rate, Wilson 95% confidence interval,
pass@k estimates, mean score with deterministic bootstrap percentile 95%
confidence interval, mean subscores, median duration, iteration distribution,
failure bucket counts, review-required count, reviewer-quality warning counts,
optional usage totals, and low-sample warnings.
When multiple connectors have runs for the same task, compare reports
pairwise agent pass-rate deltas with approximate 95% confidence intervals and
warnings when the interval includes zero or either side has too few runs.
Compare JSON and HTML also include `claimReadiness`, which summarizes whether
the aggregate is publishable and lists blockers or advisories, plus a cross-run
`reviewQueue` with direct pointers to the saved runs that need human review.
Reviewer-quality warnings are publishability blockers; their specific messages are
also preserved as advisories so reviewers can see what to fix.
Evidence-validation errors from `validate-artifacts` are publishability blockers
in compare output, and validation warnings are preserved as advisories.
Missing-evidence warnings are also publication blockers. A result set
should preserve path entries for the run manifest, implementation turn log,
journey, eval input/output, workspace summary, workspace tarball, event tarball,
and transcript tarball so reviewers can trace a score back to the full
implementation journey.
Compare JSON also includes `benchmarkClaim`, a compact versioned export record
for archiving or downstream leaderboard/report ingestion. Use
`compare --benchmark-claim benchmark-claim.json` to write the same claim as its
own evidence file. Preserve it with the raw compare JSON and source evidence; it
summarizes methodology, agent rollups, per-task results, pairwise deltas,
readiness, run-plan evidence, evidence-validation counts, and review counts. For each included
`ruhroh-loop-result.json`, the claim also inventories named files from
`artifactPaths`, recording whether each file is available plus its size and
SHA-256 digest when readable. This lets a published claim point back to the
preserved implementation journey, reviewer input/output, manifest,
transcripts, workspace summary, and workspace archive instead of only the final
score JSON.
When `--run-plan` is supplied, compare output also includes `runPlan` and
`runPlanWarnings`. Missing planned samples, samples without saved results,
and result samples outside the plan block publishable claims.

Usage fields come from `runManifest.usage` when connectors provide them:
`costUsd`, `inputTokens`, `outputTokens`, and `totalTokens`. Compare reports
aggregate available usage into total and mean cost/tokens plus cost-per-pass and
tokens-per-pass when at least one run passes. Missing usage is allowed and is
reported through `runsWithUsage`; usage never changes the pass/fail score.

Use `compare --html` when publishing or archiving aggregate benchmark results.
The generated page includes the same pass-rate, confidence interval, pass@k,
warning, failure-bucket, suite coverage, publication readiness, review queue,
and usage fields as the text report. It leads with a publication/evidence overview,
then shows a task-by-agent comparison matrix, a needs-attention table for
non-passing or warning-heavy groups, and a cost/efficiency table when usage
metadata is present. It also includes a saved-evidence table with links to
each included `ruhroh-loop-result.json` and its named evidence inventory, so
aggregate numbers can be traced back to the preserved journey and manifest
files from the report.

See the [Report Gallery](./report-gallery.md) for checked-in sample HTML
reports generated by Ruhroh's own CLI.
