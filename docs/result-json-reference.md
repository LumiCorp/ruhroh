---
id: ruhroh-result-json-reference
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-07
depends_on:
  - src/results.ts
  - src/cli.ts
  - python/ruhroh/loop_controller.py
---

# Result JSON Reference

Ruhroh result JSON is the contract between a benchmark run, later review, and
aggregate comparison. Treat these files as append-only evidence: preserve them
with the workspace snapshot and transcripts, and compare through the CLI instead
of inferring outcomes from filenames.

## Versioned Objects

| Object | Where It Appears | Purpose |
| --- | --- | --- |
| `ruhroh_loop_result_v1` | `ruhroh-loop-result.json` | Harbor-facing final result plus embedded run/eval metadata. |
| `ruhroh_run_manifest_v1` | `ruhroh-run-manifest.json`, `runManifest` | Reproducibility metadata for one run. |
| `ruhroh_eval_input_v1` | `ruhroh-loop-eval-input.json` | Stable context file for command-backed evaluators. |
| `ruhroh_eval_result_v1` | `ruhroh-loop-eval.json`, `evalResult` | Terminal evaluator judgment. |
| `ruhroh_compare_v1` | `ruhroh compare --json` | Aggregated scenario/adapter comparison. |
| `ruhroh_benchmark_claim_v1` | `benchmarkClaim` in `ruhroh compare --json` | Compact archive/export record for a benchmark claim. |
| `ruhroh_benchmark_summary_v1` | `benchmarkSummary` in `ruhroh compare --json` | Row-oriented summary derived from a benchmark claim for reports or leaderboards. |
| `ruhroh_run_plan_v1` | `.generated/ruhroh/ruhroh-run-plan.json` | Intended scenario/adapter/sample matrix. |

Unknown optional fields should be ignored by consumers. Missing required fields
should be treated as invalid input for publishing benchmark claims.
Newly emitted artifacts include a root `$schema` URL for the matching shipped
JSON Schema so archived files can be validated without guessing their contract.

## Loop Result

`ruhroh-loop-result.json` is the canonical run artifact read by `ruhroh report`
and `ruhroh compare`.

Required top-level fields:

- `version`: `ruhroh_loop_result_v1`.
- `adapter`: benchmark runtime adapter label, usually `ruhroh-harbor`.
- `dataset`: dataset or benchmark package label.
- `scenarioId` and `task_id`: scenario identity.
- `status`: `completed` or `failed`.
- `failure_kind` and `failureBucket`: normalized failure classification.
- `score`: numeric reward, normally `1` for pass and `0` for fail/review.
- `iterationsUsed`, `implementationIterationsUsed`,
  `implementationStoppedReason`, `stoppedReason`, and `duration_ms`.
- `runAgent`, `runAgentAdapterId`, `continuityLevel`, `sessionHandle`, and
  `runIds`.
- `implementationRuns`: implementation-turn records used to reconstruct the
  timeline.

Optional fields:

- `runId`: stable run identity when available.
- `runManifest`: embedded `ruhroh_run_manifest_v1`.
- `evalResult`: embedded `ruhroh_eval_result_v1`.
- `artifactPaths`: paths to preserved result files, transcripts, events,
  workspace summaries/snapshots, and adapter artifacts.
- `failure_details`: runtime failure detail when the loop failed before a clean
  evaluator judgment.

`artifactPaths.workspaceSummary` points to `ruhroh-workspace-summary.json`, a
compact final workspace inventory with top-level entries, project markers,
counts, truncation state, and sampled file hashes. The package ships a
structural schema for loop results at
`node_modules/@kestrel-agents/ruhroh/schemas/loop-result-v1.schema.json` and a
workspace-summary schema at
`node_modules/@kestrel-agents/ruhroh/schemas/workspace-summary-v1.schema.json`;
`ruhroh init` also copies both schemas under `ruhroh/schemas/` for CI checks on
preserved run artifacts.

Consumers should prefer `runManifest.sample.id` over directory names when
matching results to a run plan.

## Eval Result

`ruhroh_eval_result_v1` is produced by the evaluator command or fixture and then
normalized by Ruhroh.

The package ships a structural JSON Schema for this artifact at
`node_modules/@kestrel-agents/ruhroh/schemas/eval-result-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/eval-result-v1.schema.json` so
evaluator fixtures and external judge adapters can be checked before
publication.

Required fields:

- `version`: `ruhroh_eval_result_v1`.
- `status`: `passed`, `failed`, `review`, or `infra_failed`.
- `goalMet`: boolean outcome judgment.
- `confidence`: `low`, `medium`, or `high`.
- `reasons`: human-readable reasons for the judgment.
- `unmetCriteria`: failed or incomplete rubric criteria.
- `evidenceRefs`: top-level evidence references.
- `commandsRun`: command evidence with `command`, `exitCode`, and `summary`.
- `artifacts`: evaluator artifact paths keyed by stable names.
- `finalSummary`: concise audit summary.

Optional fields:

- `repairBrief`: what should change before a rerun.
- `criteriaResults`: per-criterion `id`, `description`, `status`, `score`,
  optional `weight`, `evidenceRefs`, and optional `notes`.
- `subscores`: named dimensions such as `functionality`, `workflow`,
  `buildRun`, `persistence`, `constraintCompliance`, and `evidenceQuality`.
- `judge`: evaluator identity with `kind`, optional `model`, and optional
  `version`.
- `judgeVotes`: optional multi-judge votes. Each vote includes `judge`,
  `status`, `confidence`, `rationale`, `evidenceRefs`, and optional `weight`.
- `judgeAgreement`: normalized summary derived from `judgeVotes`, including
  vote count, unanimity, status counts, optional majority status, and dissenting
  judge labels.

For publishable comparisons, evaluators should include evidence, criteria
results, command evidence, judge metadata, and, for model-backed or high-stakes
judgments, multi-judge votes. Ruhroh reports weaker evaluator outputs and
judge disagreement as eval-quality warnings.

## Eval Input

`ruhroh-loop-eval-input.json` is the stable input file for command-backed
evaluators. It includes:

- `version`: `ruhroh_eval_input_v1`.
- `scenarioId`.
- `workspacePath` and `originalWorkspacePath`.
- `journeyPath` and `evalOutputPath`.
- `scenarioContext`, `goalRubric`, and `evidenceGuidance`.
- `calibrationCases`: expected judgment anchors with `id`, `inputSummary`,
  `expectedStatus`, and `rationale`.
- `privateAssets`: evaluator-only asset paths.

Evaluators should read this file instead of reconstructing context from the
generated Harbor directory.

## Run Manifest

`ruhroh_run_manifest_v1` records how one result was produced. It is designed for
comparison and reproducibility without publishing secrets.

The package ships a structural JSON Schema for this artifact at
`node_modules/@kestrel-agents/ruhroh/schemas/run-manifest-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/run-manifest-v1.schema.json` so
CI can validate preserved run provenance before publishing comparisons.

Required fields:

- `version`: `ruhroh_run_manifest_v1`.
- `runId`.
- `scenario`: `id`, optional `scenarioVersion`, optional `runMode`, and
  optional scenario metadata.
- `benchmark`: dataset/runtime labels and optional Harbor agent identity.
- `timing`: `startedAt`, optional `endedAt`, and `durationMs`.
- `loop`: `maxIterations`, `implementationIterationsUsed`, and
  `stoppedReason`.
- `runAgent`: adapter id, continuity level, session handle, run ids, and
  optional adapter/model/usage/command metadata.

Optional fields used by aggregate reports:

- `sample`: `id`, `index`, `count`, and `seed`.
- `evaluator`: evaluator command hash, fixture flag, input-summary counts,
  private asset path hashes, judge metadata, and model metadata.
- `environment`: OS/runtime details, sample indexes, and optional
  `fingerprint` with `method`, `sha256`, and canonical `components`.
- `env`: forwarded env key names and secret key names that were present.
- `usage`: `costUsd`, `inputTokens`, `outputTokens`, and `totalTokens`.
- `artifactPaths`: manifest-level artifact index.
- `failureDetails`.

Secret values are not stored. Command-backed adapter and evaluator commands are
represented by hashes so runs can be compared without exposing local paths or
credentials. Command manifests also include `shellEnabled` so reviewers can
distinguish default no-shell execution from explicit shell opt-in.
When present, `environment.fingerprint.sha256` is the preferred cohort identity
for comparison; older manifests fall back to platform/Python/container strings.

## Report JSON

`ruhroh report <path> --json` emits a single-run review object:

- `version`: `ruhroh_report_v1`.
- `summary`: normalized run summary derived from `ruhroh-loop-result.json`.
- `reviewQueue`: zero or one review item for that run.
- `htmlPath`: present when `--html` is also supplied.

`summary` includes outcome fields, selected manifest metadata, implementation
timeline, criteria results, evidence refs, commands run, evaluator judge
metadata, judge votes, judge agreement, artifact paths, `artifactInventory`,
artifact-completeness warnings, usage, sample data, and eval-quality warnings.
`artifactInventory` is sorted by artifact name and records path, availability,
size, SHA-256 digest, and missing/not-file/unreadable errors for each non-empty
entry in `artifactPaths`.

## Compare JSON

`ruhroh compare <results-dir> --json` emits aggregate comparison data:

- `version`: `ruhroh_compare_v1`.
- `groups`: one scenario/adapter aggregate per group.
- `pairwiseComparisons`: adapter-vs-adapter pass-rate comparisons for scenarios
  that have multiple adapter groups.
- `benchmarkClaim`: compact `ruhroh_benchmark_claim_v1` export object.
- `reviewQueue`: cross-run review items.
- `claimReadiness`: publishability summary.
- `suite`, `suiteWarnings`, and `suiteAdapterSummaries` when `--suite` is used.
- `runPlan` and `runPlanWarnings` when `--run-plan` is used.
- `htmlPath` when `--html` is also supplied.
- `benchmarkClaimPath` when `--benchmark-claim` is also supplied.

Each group includes:

- `scenarioId` and `adapter`.
- `cohort`: sample ids/seeds, scenario versions, adapter versions, agent and
  evaluator model identities, evaluator input signatures, judge identities,
  environment fingerprints, and comparability warnings.
- `runs`, `passes`, `passRate`, `passRateCi95`, and `passAtK`.
- `meanScore`, `meanScoreCi95` using deterministic bootstrap percentile
  resampling, `meanSubscores`, `medianDurationMs`, `iterationDistribution`, and
  `failureBuckets`.
- `reviewRequired`, `evalQualityWarnings`, `artifactCompletenessWarnings`,
  `usage`, and
  `statisticalWarnings`.

`usage` is present on aggregate groups, benchmark-claim adapter summaries,
benchmark-claim scenario results, and benchmark-summary rows. It includes
coverage counters (`runsWithUsage`, `runsWithCost`, `runsWithTokens`) plus
optional `totalCostUsd`, `meanCostUsd`, `costPerPass`, `totalTokens`,
`meanTotalTokens`, and `tokensPerPass` when run manifests reported those
fields. Missing usage remains missing data, not zero cost.

Each `pairwiseComparisons` item includes:

- `scenarioId`.
- `baselineAdapter` and `contenderAdapter`, ordered by adapter id for stable
  output.
- `baselineRuns`, `contenderRuns`, `baselinePasses`, `contenderPasses`,
  `baselinePassRate`, and `contenderPassRate`.
- `passRateDelta`: contender pass rate minus baseline pass rate.
- `passRateDeltaCi95`: approximate normal 95% confidence interval for the
  delta, with `method: "normal_approximation"`.
- `significance`: Fisher exact two-sided test metadata with `pValue`,
  `alpha: 0.05`, and `significant`.
- `conclusion`: `contender_higher`, `baseline_higher`, or `inconclusive`.
- `warnings`: low-sample, zero-including interval, non-significant Fisher test,
  and cohort comparability warnings that should block overclaiming.

`claimReadiness.publishable` is the machine-readable gate for benchmark claims.
Use `--require-publishable` in CI to make `compare` exit `2` after writing the
report when blockers remain. Pairwise adapter comparison warnings are included
in readiness blockers so non-significant or otherwise weak adapter deltas cannot
quietly accompany a publishable claim.

## Benchmark Claim JSON

`benchmarkClaim` is designed for archiving, publishing, or feeding a downstream
leaderboard without losing the methodology context around the numbers. Use
`ruhroh compare <results-dir> --benchmark-claim benchmark-claim.json` to write
the same object as a standalone JSON artifact. It does not replace the raw
`groups`, `reviewQueue`, or run artifacts.

The package ships a structural JSON Schema for this export at
`node_modules/@kestrel-agents/ruhroh/schemas/benchmark-claim-v1.schema.json`;
`ruhroh init` also copies it to
`ruhroh/schemas/benchmark-claim-v1.schema.json`. Use the schema for ingestion
and publication pipeline shape checks. Use
`ruhroh validate-claim benchmark-claim.json --json` for Ruhroh's built-in
structural and consistency checks. Add `--require-publishable` to return exit
code 2 when a structurally valid archived claim is not publishable, using the
claim's own `readiness.blockers` as the gate. Add `--verify-sources` to
re-hash referenced suite manifests, run plans, result JSON files, and available
run-artifact inventory files so archived claims cannot silently drift from the
evidence they cite.

Required fields:

- `version`: `ruhroh_benchmark_claim_v1`.
- `createdAt`: export timestamp.
- `tool`: Ruhroh package identity that produced the claim, including `name` and
  package `version` when available.
- `source`: artifact provenance for the exported claim, including
  `resultsPath`, and optionally `suitePath`, `suiteSha256`, `runPlanPath`,
  `runPlanSha256`, `htmlPath`, and `benchmarkClaimPath` when those CLI flags
  were used. `resultArtifacts` records each included `ruhroh-loop-result.json`
  with path, SHA-256 digest, scenario id, adapter id, and available
  run/sample/version metadata. Each result artifact can also include
  `artifactInventory`, a sorted list of named run artifacts from `artifactPaths`
  with path, availability, size, and SHA-256 digest when the referenced file is
  readable.
- `scope`: `suite` or `ad_hoc_compare`.
- `publishable`: mirrors `readiness.publishable`.
- `methodology`: confidence level, statistical methods, and suite min-run/retry
  policy when available. Statistical methods include Wilson pass-rate intervals,
  pass@k, pairwise pass-rate deltas/significance, and bootstrap mean-score
  intervals.
- `summary`: scenario count, adapter count, total runs/passes, run-weighted
  pass rate with Wilson CI, review counts, and pairwise comparison count.
- `adapterSummaries`: adapter-level run/pass rollups, mean scenario pass rate,
  and usage totals/rates. Suite claims also include `minRunsSatisfied`.
- `scenarioResults`: scenario/adapter run/pass, score, statistical, review, and
  usage summaries.
- `suiteCoverage`: suite-scoped coverage summary when `compare --suite` is
  used. It records expected/covered scenario counts, scenario ids missing from
  at least one adapter, overall minimum-run satisfaction, and per-adapter
  coverage, run counts by scenario, and coverage warnings.
- `scenarioResults`: compact scenario/adapter results with pass rate, Wilson CI,
  pass@k, mean score, bootstrap mean-score CI, review count, and statistical
  warnings.
- `pairwiseComparisons`: same pairwise adapter delta objects exposed at the
  compare top level.
- `readiness`: blockers and advisories used by the publishability gate.
- `evidence`: run-plan presence, run-plan warnings, artifact-validation error
  and warning counts, and review queue counts. It also includes
  `artifactCompletenessWarnings`, the total number of missing core artifact path
  diagnostics across included runs.

Suite-scoped claims also include `suite` with id, title, suiteVersion, scenario
membership/version locks, minimum runs, and retry policy.

## Benchmark Summary JSON

`benchmarkSummary` is a row-oriented artifact derived from `benchmarkClaim`.
Use `ruhroh compare <results-dir> --benchmark-summary benchmark-summary.json` to
write it as a standalone JSON file. It preserves claim-level `scope`,
`publishable`, `readiness`, and `evidence`, then flattens each scenario/adapter
result into `rows` with suite id/version when available, run/pass counts, pass
rate with Wilson CI, pass@k, mean score with bootstrap CI, usage totals/rates,
review count, and statistical warnings.

The package ships a structural JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/benchmark-summary-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/benchmark-summary-v1.schema.json`.
Use `ruhroh validate-summary benchmark-summary.json --json` for Ruhroh's
built-in row and top-level consistency checks before ingesting the summary into
external reports or lightweight leaderboards.

## Run Plan

Actual `ruhroh run` executions write `.generated/ruhroh/ruhroh-run-plan.json`
before Harbor starts. Dry runs do not write the plan.

The package ships a structural JSON Schema for this artifact at
`node_modules/@kestrel-agents/ruhroh/schemas/run-plan-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/run-plan-v1.schema.json` for CI
checks on preserved sample matrices.

Required fields:

- `version`: `ruhroh_run_plan_v1`.
- `createdAt`.
- `selection`: scenario dir, suite dir, selected scenario/suite/tier, run count,
  and adapter ids.
- `suite`: when generated from `--suite`, the selected suite id, title,
  `suiteVersion`, scenario locks, and suite manifest source hash.
- `generated`: generated Ruhroh root and Harbor dataset path.
- `scenarios`: selected scenario ids, titles, tiers, scenario versions, and
  optional `source` fingerprints. Source fingerprints include `scenarioPath`,
  `scenarioSha256`, and optional `instructionPath`/`instructionSha256`.
- `samples`: planned scenario/adapter/sample rows.

Each sample includes `label`, `scenarioId`, `adapter`, `sampleId`,
`sampleSeed`, `runIndex`, `runCount`, `forwardedEnvKeys`, and a redacted
`harborCommand`.

Pass the plan back to `compare --run-plan <path>` to detect missing planned
samples, results without sample ids, extra result samples outside the intended
matrix, and result samples whose scenario id, adapter id, seed, run index, or
run count contradicts the planned row. When a suite comparison uses a run plan,
Ruhroh also verifies that the plan's suite id, `suiteVersion`, and suite
manifest hash match the suite selected for comparison. Those warnings are
claim-readiness blockers.

## Compatibility Rules

- Use the `version` field to branch parsers.
- Treat additive optional fields as compatible.
- Do not parse prose warnings as the primary contract when structured fields
  exist.
- Do not use local directory names as benchmark identity when `scenarioId`,
  `adapter`, `runId`, or `sample.id` is available.
- Preserve raw artifacts alongside reports so later methodology changes can
  recompute summaries from source evidence.
