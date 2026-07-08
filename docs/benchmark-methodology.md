---
id: ruhroh-benchmark-methodology
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-07
depends_on:
  - src/results.ts
  - src/scenarios.ts
  - src/suites.ts
---

# Benchmark Methodology

Ruhroh benchmarks measure whether a coding agent delivered the requested user
outcome in a final workspace. They are not code-completion tests and they should
not pass or fail on static filename checks unless the user task made that file
contract explicit.

## Run Units

The standard comparison unit is one scenario, one adapter, and one run-agent
configuration. Ruhroh groups reports by scenario id and adapter id. If the model,
prompt, adapter version, scenario version, or evaluator changes, treat the new
runs as a new comparison set even when the scenario id is unchanged.

Each run should preserve:

- the generated Harbor task;
- `ruhroh-loop-result.json`;
- `ruhroh-run-manifest.json`;
- implementation iterations, journey, transcripts, and event logs;
- eval input and eval output;
- final workspace summary and archive.

## Sample Size

Single runs are useful for debugging, not for claims. Published comparisons
should use the suite's `methodology.minRuns`, with at least five runs for smoke
checks and ten or more runs for broader benchmark conclusions.

Use `ruhroh --suite <id> --adapter <adapter> --runs <n>` to collect repeated
samples with a consistent scenario and adapter selection. Ruhroh forwards
`RUHROH_SAMPLE_ID`, `RUHROH_SAMPLE_SEED`, `RUHROH_RUN_INDEX`, and
`RUHROH_RUN_COUNT` to each sample and stores those values in the run manifest so
archived artifacts can be traced back to the sampling plan. `RUHROH_RUN_SEED`
is also set to the sample seed by default for adapter compatibility.

Repeat `--adapter` to collect the same sample plan for multiple agents in one
matrix. `ruhroh compare` still groups by scenario id and adapter id, so each
agent's repeated samples remain separate in aggregate reporting.

Use `--shard <index>/<total>` when a repeated suite is too expensive for one
worker. Shards are selected from the deterministic scenario/adapter/sample
matrix after the full plan is built. A sample produced by `--runs 20 --shard
3/4` still carries a `RUHROH_SAMPLE_ID` ending in `-of-20` and a
`RUHROH_RUN_COUNT` of `20`; the shard only decides which samples this worker
executes. Keep the same scenario, suite, adapter, and `--runs` flags for every
worker, preserve all result artifacts, and compare the merged result root
against the intended run plan with `compare --run-plan`.

`ruhroh compare` reports pass rate, Wilson 95% confidence intervals, pass@k,
mean score with a deterministic bootstrap percentile 95% interval, failure
buckets, cohort metadata, eval-quality warnings, optional cost/token summaries,
and a `claimReadiness` summary. When a scenario has
multiple adapter groups, compare also reports pairwise pass-rate deltas with an
approximate normal 95% confidence interval plus a Fisher exact two-sided
significance check. Treat a pairwise conclusion as directional unless the
interval excludes zero, the Fisher test is significant at alpha 0.05, and the
suite minimum run count is satisfied for both adapters. When fewer than five
runs are present, Ruhroh prints a low-sample warning. When a scenario/adapter
group is missing or mixing
scenario versions, adapter versions, agent models, prompt versions, evaluator
models, evaluator input signatures, judge identities, or environment
fingerprints, Ruhroh prints comparability warnings; treat those groups as
debugging evidence, not publishable benchmark claims.
Runtime manifests compute environment fingerprints from stable OS, Python, and
container components. Sample indexes and local workspace paths remain useful
metadata, but they are not part of the digest used for cohort comparability.

## Retry Policy

Do not retry ordinary agent failures inside a sample. A failed implementation,
goal mismatch, low-quality answer, or abandoned run is part of the measured
agent behavior.

Retry only when saved evidence shows an infrastructure failure outside the agent's
control, such as a Harbor crash, missing package runner, broken reviewer
command, or unavailable external dependency that the benchmark suite allowed. Preserve the
failed evidence set and record the exclusion reason outside the result directory
when publishing numbers.

## Task Governance

Published tasks should include `metadata.scenarioVersion`, creation/update
dates, difficulty, tags, visibility, expected runtime, maintainers, changelog,
provenance, lifecycle status, and contamination notes. Ruhroh validation
enforces those fields for `public` and `held_out` tasks; network-enabled
public or held-out tasks must also explain the network rationale. Use
`visibility: "held_out"` for tasks or packs that should not be treated as
public training/debug material. Held-out tasks must either declare
`evaluation.privateAssets` or provide `metadata.privateEvalRationale` so the
private reviewer path is explicit in the manifest. Bump
`scenarioVersion` when prompts, assets, rubrics, calibration cases, or expected
outcomes change in a way that could affect results. Mark tasks
`deprecated` or `retired` instead of silently removing or replacing them.
`inspect-pack` reports `riskReview` warnings when scenario contamination notes
or suite contamination/reward-hacking reviews are missing or left as
placeholders, so public packs can catch leakage-review gaps before run
collection starts.

Benchmark suites freeze task membership under a `suiteVersion`. Bump `suiteVersion`
when membership, locked task versions, acceptance criteria, or methodology
changes. A suite manifest should include `scenarioVersions` for every member so
validation can catch accidental prompt, asset, or rubric drift before comparing
new runs against older numbers. Published suite manifests must also document a
contamination review, reward-hacking review, review checklist, and deprecation
policy, making adversarial review and scenario lifecycle handling explicit parts
of the benchmark contract.

## Reviewer Governance

The reviewer should judge the final delivered state, using transcripts and
events as supporting evidence. A strong rubric has multiple concrete criteria,
explicit context, and clear instructions for evidence collection.

Published scenarios should include `evaluation.calibrationCases`: short
pass/fail/review anchors with a rationale for the expected judgment. Calibration
cases do not score the live run directly; they give model-backed and
human-assisted reviewers task-specific examples before judging the actual
workspace. `ruhroh validate` reports a `calibration` summary for each scenario,
including expected-status counts and missing pass/fail/review anchors, so pack
maintainers can see whether the reviewer has enough judgment coverage before
collecting runs.

Use `evaluation.privateAssets` for held-out expected outputs, reviewer-only
fixtures, or reviewer checklists that should not be included in the public
prompt. Ruhroh copies those files under `private-eval-assets/` in generated
tasks and lists the reviewer-only paths in `ruhroh-loop-eval-input.json`.
Run manifests record reviewer input counts and hashes of private asset paths,
not private asset contents, so result reviewers can detect reviewer setup drift
without exposing held-out materials.

`ruhroh validate` warns when scenario rubrics look too generic or underspecified.
JSON validation output includes structured reviewer lint `warningDetails` with
stable codes, categories, and field paths, plus the per-scenario `calibration`
summary. Use those diagnostics as benchmark pack governance inputs instead of
scraping warning prose. Run `ruhroh calibrate-evaluator` and preserve a passing
calibration report before repeated run planning; `ruhroh workflow` treats that
report as a required reviewer-quality gate. `ruhroh report` and
`ruhroh compare` warn when reviewer output lacks evidence, criteria results,
judge metadata, or enough summary detail. These warnings do not change the
binary Harbor score, but they should block public benchmark claims until
reviewed. Both commands expose a
`reviewQueue` in JSON and HTML so maintainers
can inspect non-passing runs, explicit `review` judgments, reviewer
infrastructure failures, and weak reviewer evidence with transcript and
event-log pointers. Use `ruhroh review ./results --json` or `--html` to extract
that queue as a standalone human-review packet. Reviewers should record the
decision, reviewer identity, rationale, and accepted limitations before rerunning
`ruhroh publish-check`.

Model-backed reviewers should record provider, model, model version, and prompt
version in the run manifest. For higher-stakes benchmark packs, include
`judgeVotes` from multiple model, command, or human-assisted judges so Ruhroh can
record `judgeAgreement` and flag disagreement before publication. Use `review`
when the reviewer cannot confidently decide from available evidence.

## Reporting Claims

Before publishing a comparison, inspect `ruhroh compare --json` and require
`claimReadiness.publishable === true`. In CI, run
`ruhroh compare --suite <id> --run-plan .generated/ruhroh/ruhroh-run-plan.json --require-publishable --json`
so the command still writes the report but exits 2 when the comparison is not
ready to publish. Blockers include missing suite coverage, ad hoc compares
without a suite, unsatisfied suite minimum runs, statistical/comparability
warnings, pairwise adapter comparison warnings, suite coverage warnings,
run-plan coverage warnings, artifact validation failures, eval-quality warnings,
and required human review. Advisories preserve the specific eval-quality
diagnostics, artifact validation warnings, and recommended review queue items for
audit.

Archive the `benchmarkClaim` object with any public result. Use
`ruhroh compare <results-dir> --benchmark-claim benchmark-claim.json` to write
it as a standalone artifact, or read the same object from `compare --json`. It
is the compact export record for downstream reports or leaderboards: it includes
the Ruhroh package identity, suite identity and methodology, adapter rollups,
suite coverage, per-scenario results, pairwise deltas, readiness
blockers/advisories, run-plan coverage, review-queue counts, and source paths
for the result directory, suite manifest, run-plan manifest, HTML report, and
standalone claim artifact when available. It also records artifact-validation
error/warning counts and SHA-256 digests for
the suite manifest, run-plan manifest, and every included
`ruhroh-loop-result.json`, so a published claim can be traced back to the exact
benchmark definition and run artifacts that were aggregated. Keep the raw
`groups`, `reviewQueue`, and preserved run artifacts alongside it so claims
remain auditable.
Use `--benchmark-summary benchmark-summary.json` when a reporting pipeline wants
the same claim reduced to stable scenario/adapter rows. The summary keeps
readiness and evidence fields at the top level, but each row is intentionally
small enough for public benchmark tables.
Run `ruhroh validate-summary benchmark-summary.json --json` before ingesting
those rows into a report or leaderboard; it checks the summary contract and
verifies that row totals, suite metadata, and readiness fields match the
top-level artifact.
Run `ruhroh validate-claim benchmark-claim.json --json` before publication to
check the versioned claim contract and internal consistency. In publication
pipelines, run
`ruhroh validate-claim benchmark-claim.json --require-publishable --verify-sources --json`
so an archived claim with remaining readiness blockers exits `2` even when its
JSON shape is valid, and a claim whose referenced source evidence has drifted
exits `1` with source-verification errors.
Comparisons also count artifact-completeness warnings when result JSON omits
core path entries for the run manifest, implementation turn log, journey,
eval input/output, workspace tarball, event tarball, or transcript tarball.
Treat those warnings as blockers for public claims because the score can no
longer be audited back through the full implementation journey.

Use `ruhroh compare --run-plan .generated/ruhroh/ruhroh-run-plan.json` when the
original execution plan is available. The run plan lets Ruhroh prove that every
planned scenario/adapter/sample produced a result and that no extra sample was
accidentally included in the comparison. It also checks that result sample
metadata still matches the planned scenario id, adapter id, seed, run index, and
run count, which catches adapter-selection or artifact-labeling mistakes before
they become benchmark claims. Generated run plans also include scenario
source-file hashes and, for suite-selected runs, the suite manifest version and
hash. Suite comparisons warn when the run plan was generated from a different
suite manifest than the one being used for publication, so reviewers can catch
benchmark-pack drift before reading individual run artifacts.

If infrastructure prevents a planned sample from producing artifacts, record it
in a `ruhroh_rerun_ledger_v1` file and pass `--rerun-ledger <path>` with the
same `--run-plan`. Ruhroh accepts only sample-level `decision: "exclude"`
entries with `reasonKind: "infrastructure"` as explanations for missing planned
samples. Operator errors, invalid artifacts, unknown sample ids, and other
exclusions remain warnings and block publishability. Benchmark claims include
the ledger path and SHA-256 so the exclusion record can be re-verified with
`validate-claim --verify-sources`. The ledger contract is shipped as
`schemas/rerun-ledger-v1.schema.json`.

A credible Ruhroh result should name:

- package version and suite id/version;
- scenario ids and scenario versions;
- adapter ids and adapter versions;
- model/provider metadata when available;
- evaluator identity and judge metadata;
- run count, pass rate, Wilson CI, pass@k, and pairwise adapter deltas when
  comparing multiple adapters;
- retry/exclusion policy;
- cost/token coverage if usage metadata is present. Claim and summary exports
  preserve `runsWithUsage`, `runsWithCost`, `runsWithTokens`, total cost/token
  counts, means, and cost/token per pass so downstream reports can compare
  efficiency without treating missing usage as zero.

For suite-level summaries, report both the adapter rollup and the per-scenario
groups. The rollup includes run-weighted pass rate and mean scenario pass rate;
the latter keeps scenarios closer to equal weight when run counts differ.

Avoid ranking agents from tiny samples or mixed scenario versions. Treat missing
usage metadata as missing data, not zero cost.
