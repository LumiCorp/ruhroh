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

# Artifacts

Ruhroh preserves the implementation journey and final judgment as Harbor
artifacts.

New JSON artifacts include a root `$schema` URL that points at the matching
schema shipped under `schemas/`, so artifact archives remain self-describing.

## Reviewer Path

Start with the result, then walk backward through the evidence. A useful review
usually follows this order:

1. Open `ruhroh-loop-result.json` or run `ruhroh report` to see the final
   Harbor-facing verdict, evaluator status, unmet criteria, failure bucket, and
   review queue.
2. Open `ruhroh-run-manifest.json` to confirm the scenario version, sample,
   adapter identity, evaluator identity, environment fingerprint, command
   hashes, usage metadata, and forwarded environment key names for the run.
3. Read `ruhroh-loop-journey.json`, `ruhroh-loop-iterations.jsonl`,
   transcripts, and event logs to understand what the agent actually attempted
   before it stopped.
4. Compare `ruhroh-loop-eval-input.json` with `ruhroh-loop-eval.json` to verify
   that the evaluator judged the final workspace against the scenario rubric and
   preserved concrete evidence for its decision.
5. Inspect `ruhroh-workspace-summary.json` and, when needed,
   `ruhroh-workspace.tar.gz` to check the delivered workspace state rather than
   relying on the score alone.

Artifacts prove inspectability, not automatic publishability. Before making a
benchmark claim, run `validate-artifacts`, `eval-quality`, `review`, `compare`,
and then `publish-check` so missing evidence, weak evaluator support, run-plan
gaps, and claim-readiness blockers are visible as operational gates.

Before an actual `ruhroh run` execution starts, the CLI writes
`.generated/ruhroh/ruhroh-run-plan.json`. This local plan records the selected
scenarios, resolved adapter ids, sample ids/seeds, forwarded environment key
names, generated dataset path, and redacted Harbor commands. It does not store
secret values or raw command-backed adapter paths. Use it to connect a result
set back to the intended benchmark matrix.

Core artifacts:

- `ruhroh-loop-result.json`: final Harbor-facing verdict.
- `ruhroh-run-manifest.json`: reproducibility metadata for the run, including
  scenario version, sample id/seed, adapter/evaluator metadata, timing,
  a deterministic environment fingerprint digest, forwarded env key names, and
  optional usage fields.
- `ruhroh-loop-iterations.jsonl`: one implementation-run record per run-agent
  turn.
- `ruhroh-loop-journey.json`: full implementation journey summary.
- `ruhroh-loop-eval-input.json`: stable evaluator input with scenario context,
  rubric, guidance, optional calibration cases, optional private evaluator asset
  paths, workspace paths, and journey path.
- `ruhroh-loop-eval.json`: terminal eval-agent judgment.
- `ruhroh-workspace-summary.json`: compact final workspace inventory with
  top-level entries, detected project markers, file counts, byte counts, and a
  bounded sample of file hashes.
- `ruhroh-workspace.tar.gz`: final implementation workspace snapshot.
- `ruhroh-loop-events.tar.gz`: per-iteration adapter event logs when available.
- `ruhroh-loop-transcripts.tar.gz`: per-iteration run-agent transcripts.

Adapter-specific artifacts may include bridge logs, prompts, transcripts, or
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

`validate-artifacts` is the CI-friendly pre-publication gate for one preserved
run or a recursive result root. It checks loop results, run manifests, eval
results, workspace summaries, implementation-iteration logs, journey files, and
eval input files, then reports missing/malformed artifacts as errors and older
missing `$schema` fields as warnings.

The report includes scenario id, run id, adapter, Harbor-facing score, eval
status, failure bucket, iteration count, duration, selected manifest fields,
implementation timeline, subscore table, evaluator judge agreement, unmet
criteria, eval-quality warnings, artifact-completeness warnings, commands run,
artifact inventory, and a review queue.
See the [result JSON reference](./result-json-reference.md) for the field-level
contracts emitted by `report --json`, `compare --json`, run manifests,
evaluator results, and run plans.

`--html` writes a self-contained static report for sharing or archiving a run
review. Dynamic content from evaluator output is escaped. Artifact, transcript,
and event-log path cells link to the local files relative to the HTML report
path so a reviewer can open preserved evidence without copying paths by hand.
`eval-quality --html` writes the evaluator evidence gate as a separate static
report with warning counts, next actions, per-run evidence counts, judge
metadata, and result artifact links.

Report output includes `summary.artifactInventory`, a sorted inventory of named
run artifacts from `artifactPaths`. Each entry records the path, availability,
size, and SHA-256 digest when the referenced file is readable. Missing,
directory-valued, or unreadable paths stay visible with an explicit error so
reviewers can distinguish incomplete evidence from a passing score.

The report JSON includes `reviewQueue`, an array of runs that should be checked
before making benchmark claims. Queue entries include `priority`, scenario,
adapter, run id, score, eval status, failure bucket, reasons, unmet criteria,
artifact paths, transcript paths, and event-log paths. `priority: "required"`
is used for explicit evaluator review or evaluator infrastructure failure;
`priority: "recommended"` is used for non-passing runs and eval-quality audit
findings. Use `ruhroh review` when you want only that queue, either as
`ruhroh_review_queue_v1` JSON for CI or as a static HTML adjudication packet for
reviewers.

The implementation timeline is derived from `ruhroh-loop-iterations.jsonl` data
embedded in the final result. Each entry includes the run-agent turn status,
completion state, stop reason, run id, transcript path, event-log path, and a
short notes excerpt when available.

`ruhroh-run-manifest.json` intentionally records secret key names only, not
secret values. Command-backed adapter and evaluator commands are represented by
SHA-256 hashes so repeated runs can be compared without publishing local command
strings or credentials.
Command-backed adapters may self-report `adapterVersion`, `model`, and `usage`
in `RUHROH_RESULT_PATH`; Ruhroh stores those fields in the manifest and uses
them for aggregate cohort and cost/token reporting. Environment metadata remains
a fallback when the adapter result omits those fields. Runtime manifests include
`environment.fingerprint`, a SHA-256 digest over stable OS/Python/container
components, and comparison cohorts prefer that digest when checking environment
comparability across runs.

Compare repeated runs by pointing at a directory containing result artifacts:

```bash
pnpm exec ruhroh compare ./results
pnpm exec ruhroh compare ./results --json
pnpm exec ruhroh compare ./results --run-plan .generated/ruhroh/ruhroh-run-plan.json --json
pnpm exec ruhroh compare ./results --html ruhroh-compare.html
```

Comparison groups runs by scenario and adapter, then reports a compact
scenario-by-adapter matrix before the detailed metrics. Each matrix cell shows
pass rate, run count, confidence interval, review count, and warning count so
readers can scan where each agent delivered before drilling into evidence.
Detailed compare output includes pass rate, Wilson 95% confidence interval,
pass@k estimates, mean score with deterministic bootstrap percentile 95%
confidence interval, mean subscores, median duration, iteration distribution,
failure bucket counts, review-required count, eval-quality warning counts,
optional usage totals, and low-sample warnings.
When multiple adapters have runs for the same scenario, compare reports
pairwise adapter pass-rate deltas with approximate 95% confidence intervals and
warnings when the interval includes zero or either side has too few runs.
Compare JSON and HTML also include `claimReadiness`, which summarizes whether
the aggregate is publishable and lists blockers or advisories, plus a cross-run
`reviewQueue` with direct pointers to the run artifacts that need human audit.
Eval-quality warnings are publishability blockers; their specific messages are
also preserved as advisories so reviewers can see what to fix.
Artifact-validation errors from `validate-artifacts` are publishability blockers
in compare output, and artifact-validation warnings are preserved as advisories.
Artifact-completeness warnings are also publishability blockers. A result set
should preserve path entries for the run manifest, implementation turn log,
journey, eval input/output, workspace summary, workspace tarball, event tarball,
and transcript tarball so reviewers can trace a score back to the full
implementation journey.
Compare JSON also includes `benchmarkClaim`, a compact versioned export record
for archiving or downstream leaderboard/report ingestion. Use
`compare --benchmark-claim benchmark-claim.json` to write the same claim as its
own artifact. Preserve it with the raw compare JSON and source artifacts; it
summarizes methodology, adapter rollups, per-scenario results, pairwise deltas,
readiness, run-plan evidence, artifact-validation counts, and review counts. For each included
`ruhroh-loop-result.json`, the claim also inventories named files from
`artifactPaths`, recording whether each file is available plus its size and
SHA-256 digest when readable. This lets a published claim point back to the
preserved implementation journey, evaluator input/output, manifest,
transcripts, workspace summary, and workspace archive instead of only the final
score JSON.
When `--run-plan` is supplied, compare output also includes `runPlan` and
`runPlanWarnings`. Missing planned samples, samples without result artifacts,
and result samples outside the plan block publishable claims.

Usage fields come from `runManifest.usage` when adapters provide them:
`costUsd`, `inputTokens`, `outputTokens`, and `totalTokens`. Compare reports
aggregate available usage into total and mean cost/tokens plus cost-per-pass and
tokens-per-pass when at least one run passes. Missing usage is allowed and is
reported through `runsWithUsage`; usage never changes the pass/fail score.

Use `compare --html` when publishing or archiving aggregate benchmark results.
The generated page includes the same pass-rate, confidence interval, pass@k,
warning, failure-bucket, suite coverage, claim-readiness, review queue, and
usage fields as the text report. It leads with a publication/evidence overview,
then shows a scenario-by-adapter comparison matrix, a failure-triage table for
non-passing or warning-heavy groups, and a cost/efficiency table when usage
metadata is present. It also includes a result-artifacts table with links to
each included `ruhroh-loop-result.json` and its named artifact inventory, so
aggregate numbers can be traced back to the preserved journey and manifest
files from the report.

See the [Report Gallery](./report-gallery.md) for checked-in sample HTML and
JSON outputs generated by Ruhroh's own CLI.
