---
id: ruhroh-result-json-reference
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
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
| `ruhroh_loop_result_v1` | `ruhroh-loop-result.json` | Harbor-facing final result plus embedded run/review metadata. |
| `ruhroh_run_manifest_v1` | `ruhroh-run-manifest.json`, `runManifest` | Reproducibility metadata for one run. |
| `ruhroh_eval_input_v1` | `ruhroh-loop-eval-input.json` | Stable context file for command-backed reviewers. |
| `ruhroh_eval_result_v1` | `ruhroh-loop-eval.json`, `evalResult` | Reviewer judgment. |
| `ruhroh_compare_v1` | `ruhroh compare --json` | Aggregated task/agent comparison. |
| `ruhroh_publish_check_v1` | `ruhroh publish-check --json`, `publish-check.json` in publication packets | Publication verdict, remediation, compare output, and optional source verification. |
| `ruhroh_publish_bundle_v1` | `manifest.json` in `publish-check --bundle` output | Packet inventory for every file in an audit-ready publication packet. |
| `ruhroh_benchmark_claim_v1` | `benchmarkClaim` in `ruhroh compare --json` | Compact archive/export record for a benchmark claim. |
| `ruhroh_benchmark_summary_v1` | `benchmarkSummary` in `ruhroh compare --json` | Row-oriented summary derived from a benchmark claim for reports or leaderboards. |
| `ruhroh_run_results_report_v1` | `buildRuhrohRunResultsReport()` | Programmatic preserved-result report with saved evidence, summaries, aggregates, review queue, publication readiness, claim, and summary. |
| `ruhroh_claim_source_verification_v1` | `verifyRuhrohBenchmarkClaimSources()` | Read-only source hash verification for archived benchmark claims. |
| `ruhroh_publish_bundle_validation_report_v1` | `validateRuhrohPublishBundle()` | Read-only structural, cross-reference, and packet-local source validation for publication packets. |
| `ruhroh_run_plan_v1` | `.generated/ruhroh/ruhroh-run-plan.json` | Intended task/agent/sample matrix. |
| `ruhroh_rerun_ledger_v1` | user-authored `--rerun-ledger` file | Sample-level rerun/exclusion decisions checked against a run plan. |
| `ruhroh_scenario_list_v1` | `ruhroh list --json` | Machine-readable task catalog for docs, registries, and authoring tools. |
| `ruhroh_suite_list_v1` | `ruhroh list-suites --json` | Machine-readable benchmark-suite catalog. |
| `ruhroh_benchmark_pack_inspection_v1` | `ruhroh inspect-pack --json` | Authoring and registry preflight across tasks, benchmark suites, validation, and calibration. |

Unknown optional fields should be ignored by consumers. Missing required fields
should be treated as invalid input for publishing benchmark claims.
Newly emitted evidence files include a root `$schema` URL for the matching shipped
JSON Schema so archived files can be validated without guessing their contract.
For compatibility rules, migration guidance, and consumer expectations across
these versioned objects, see [Contract Evolution](./contract-evolution.md).

## Loop Result

`ruhroh-loop-result.json` is the canonical run evidence file read by `ruhroh report`
and `ruhroh compare`.

Required top-level fields:

- `version`: `ruhroh_loop_result_v1`.
- `adapter`: benchmark runner label, usually `ruhroh-harbor`.
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
- `failure_details`: run failure detail when the loop failed before a clean
  reviewer judgment.

`artifactPaths.workspaceSummary` points to `ruhroh-workspace-summary.json`, a
compact final workspace inventory with top-level entries, project markers,
counts, truncation state, and sampled file hashes. The package ships a
structural schema for loop results at
`node_modules/@kestrel-agents/ruhroh/schemas/loop-result-v1.schema.json` and a
workspace-summary schema at
`node_modules/@kestrel-agents/ruhroh/schemas/workspace-summary-v1.schema.json`;
`ruhroh init` also copies both schemas under `ruhroh/schemas/` for CI checks on
preserved run evidence.

Consumers should prefer `runManifest.sample.id` over directory names when
matching results to a run plan.

## Discovery Lists

`ruhroh list --json` emits `ruhroh_scenario_list_v1` so tools can inspect a
benchmark pack before generating or running tasks. The object includes:

- `version`: `ruhroh_scenario_list_v1`.
- `source.scenarioDir`: directory Ruhroh searched for scenario manifests.
- `scenarios`: compact scenario records with `id`, `title`, `tier`, `kind`,
  `sourcePath`, `scenarioVersion`, `visibility`, `difficulty`, `tags`, and
  `lifecycleStatus`.

`ruhroh list-suites --json` emits `ruhroh_suite_list_v1`. Its `suites` array
contains the suite manifests Ruhroh loaded from `--suite-dir`, including
version locks, methodology, governance, and ordered scenario membership. Use
these discovery contracts for registry ingestion, documentation generation, and
preflight tooling instead of parsing the text list output.

`ruhroh inspect-pack --json` emits `ruhroh_benchmark_pack_inspection_v1`. It is
the higher-level local benchmark-pack preflight for authoring tools and registry
importers. The object includes:

- `source.scenarioDir` and optional `source.suiteDir`;
- `ready`: `true` when no scenario or suite validation blockers are present;
- `requirements.requireFullCalibration`: whether calibration warnings were
  promoted into blockers;
- `requirements.requireRiskReviewed`: whether contamination and reward-hacking
  risk-review warnings were promoted into blockers;
- `blockers` and `warnings`: stable human-readable summaries for CI or registry
  preflight;
- `summary`: scenario, suite, invalid-count, calibration-warning, and
  risk-review-warning counts, plus `difficultyCounts` across all discovered
  scenarios;
- `scenarios`: compact scenario records with validation errors, warnings,
  evaluator lint diagnostics, calibration coverage, risk-review status, and
  content fingerprints;
- `suites`: compact suite records with version, membership, min run count,
  owner, validation errors, suite-level `difficultyCounts`, risk-review status,
  and warnings.

Each scenario record includes a `content` object for contamination and leakage
review before runs are collected:

- `scenarioPath` and `scenarioSha256`: the manifest file and its SHA-256 hash;
- `promptPath` and `promptSha256` when the prompt is file-backed;
- `assetFingerprints`: hashes for declared public `assets`;
- `privateAssetFingerprints`: hashes for declared `evaluation.privateAssets`.

Asset fingerprints include the declared relative `path`, resolved `sourcePath`,
`status`, `kind`, `fileCount`, `sizeBytes`, and `sha256` when available.
Directory hashes are deterministic over sorted relative file paths, file sizes,
and file hashes, so registry tools can detect prompt or asset drift without
copying the whole benchmark pack into a run artifact.
Scenario and suite records also include a `riskReview` object. It preserves the
scenario contamination notes or suite contamination/reward-hacking reviews,
marks the review as `documented` or `needs_review`, and reports placeholder or
missing review text before runs are collected.

`inspect-pack` does not inspect run artifacts and does not replace
`publish-check`. Use it before collecting runs to verify that a benchmark pack
is coherent; use `--require-calibrated` when the preflight should also fail on
missing pass/fail/review calibration anchors; use `--require-risk-reviewed`
when missing or placeholder contamination and reward-hacking review should fail
registry ingestion; use `publish-check` before citing a score.

## Reviewer Result

`ruhroh_eval_result_v1` is produced by the reviewer command or fixture and then
normalized by Ruhroh.

The package ships a structural JSON Schema for this artifact at
`node_modules/@kestrel-agents/ruhroh/schemas/eval-result-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/eval-result-v1.schema.json` so
reviewer fixtures and external judge commands can be checked before
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
- `artifacts`: reviewer evidence paths keyed by stable names.
- `finalSummary`: concise audit summary.

Optional fields:

- `repairBrief`: what should change before a rerun.
- `criteriaResults`: per-criterion `id`, `description`, `status`, `score`,
  optional `weight`, `evidenceRefs`, and optional `notes`.
- `subscores`: named dimensions such as `functionality`, `workflow`,
  `buildRun`, `persistence`, `constraintCompliance`, and `evidenceQuality`.
- `judge`: reviewer identity with `kind`, optional `model`, and optional
  `version`.
- `judgeVotes`: optional multi-judge votes. Each vote includes `judge`,
  `status`, `confidence`, `rationale`, `evidenceRefs`, and optional `weight`.
- `judgeAgreement`: normalized summary derived from `judgeVotes`, including
  vote count, unanimity, status counts, optional majority status, and dissenting
  judge labels.

For publishable comparisons, reviewers should include evidence, criteria
results, command evidence, judge metadata, and, for model-backed or high-stakes
judgments, multi-judge votes. Ruhroh reports weaker reviewer outputs and
judge disagreement as reviewer-quality warnings.

## Reviewer Calibration Report

`ruhroh_eval_calibration_report_v1` is produced by
`ruhroh calibrate-evaluator`. It records whether the configured reviewer
matched each task calibration anchor before live benchmark scores are
trusted. The command prints the report when `--json` is used and also writes it
to `.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`.

The package ships a structural JSON Schema for this artifact at
`node_modules/@kestrel-agents/ruhroh/schemas/eval-calibration-report-v1.schema.json`;
`ruhroh init` also copies it to
`ruhroh/schemas/eval-calibration-report-v1.schema.json` so CI and workflow
checks can validate preserved calibration evidence.

Required fields:

- `$schema`: `https://lumicorp.github.io/ruhroh/schemas/eval-calibration-report-v1.schema.json`.
- `version`: `ruhroh_eval_calibration_report_v1`.
- `source`: task directory, generated calibration directory, reviewer
  command, and report path.
- `ok`: true only when at least one calibration case ran, every returned status
  matched the expected status, and no infrastructure failures occurred.
- `scenarioCount`, `caseCount`, `matchedCount`, `mismatchCount`, and
  `infraFailedCount`: reviewer calibration rollups.
- `warnings` and `nextActions`: operator-facing follow-up guidance.
- `results`: one row per calibration case with scenario id, case id, expected
  and actual status, match boolean, paths to the synthetic input/output and
  workspace, process exit code when available, and captured stdout/stderr.

## Reviewer Input

`ruhroh-loop-eval-input.json` is the stable input file for command-backed
reviewers. It includes:

- `version`: `ruhroh_eval_input_v1`.
- `scenarioId`.
- `workspacePath` and `originalWorkspacePath`.
- `journeyPath` and `evalOutputPath`.
- `scenarioContext`, `goalRubric`, and `evidenceGuidance`.
- `calibrationCases`: expected judgment anchors with `id`, `inputSummary`,
  `expectedStatus`, and `rationale`.
- `privateAssets`: reviewer-only file paths.

Reviewers should read this file instead of reconstructing context from the
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
- `benchmark`: dataset/runner labels and optional Harbor agent identity.
- `timing`: `startedAt`, optional `endedAt`, and `durationMs`.
- `loop`: `maxIterations`, `implementationIterationsUsed`, and
  `stoppedReason`.
- `runAgent`: connector id, continuity level, session handle, run ids, and
  optional connector/model/usage/command metadata.

Optional fields used by aggregate reports:

- `sample`: `id`, `index`, `count`, and `seed`.
- `evaluator`: reviewer command hash, fixture flag, input-summary counts,
  private asset path hashes, judge metadata, and model metadata.
- `environment`: OS/runner details, sample indexes, and optional
  `fingerprint` with `method`, `sha256`, and canonical `components`.
- `env`: forwarded env key names and secret key names that were present.
- `usage`: `costUsd`, `inputTokens`, `outputTokens`, and `totalTokens`.
- `benchmarkTarget`: the planned benchmark target plus runtime execution
  metadata. `requestedModel` is the intended model path from the target/env
  configuration. `actualModel`, when present, is taken from the adapter-reported
  run-agent manifest and overrides any value supplied in the planned target.
- `artifactPaths`: manifest-level artifact index.
- `failureDetails`.

Secret values are not stored. Command-backed agent and reviewer commands are
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
missing-evidence warnings, usage, sample data, and reviewer-quality warnings.
`artifactInventory` is sorted by artifact name and records path, availability,
size, SHA-256 digest, and missing/not-file/unreadable errors for each non-empty
entry in `artifactPaths`.

## Reviewer Evidence JSON

`ruhroh eval-quality <results-dir> --json` emits a reviewer evidence check:

- `version`: `ruhroh_eval_quality_v1`.
- `source`: input path and result count.
- `ok`, `warningCount`, `warningCounts`, and `humanReviewRequiredCount`.
- `runs`: per-run evaluator evidence counts, criteria counts, command counts,
  judge metadata, judge-vote counts, agreement summary, warnings, and result
  path.
- `nextActions`: remediation hints for strengthening reviewer evidence.
- `htmlPath`: present when `--html` is also supplied.

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
- `rerunLedger` when `--rerun-ledger` is used with a run plan.
- `htmlPath` when `--html` is also supplied.
- `benchmarkClaimPath` when `--benchmark-claim` is also supplied.

Each group includes:

- `scenarioId` and `adapter`.
- `cohort`: sample ids/seeds, scenario versions, adapter versions, benchmark
  streams/targets, harness identities, provider paths, adapter-reported agent
  model identities, canonical agent model identities, evaluator model
  identities, evaluator input signatures, judge identities, environment
  fingerprints, and comparability warnings.
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
- `comparisonVariables`: structured baseline/contender metadata for the
  benchmark stream, harness, provider path, canonical agent model, agent prompt
  version, and environment fingerprint. Each variable records baseline values,
  contender values, whether the variable changed, and whether both sides were
  known; `varied`, `controlled`, and `unknown` provide compact labels for public
  report rendering.
- `warnings`: low-sample, zero-including interval, non-significant Fisher test,
  cohort comparability warnings, and stream-aware target-control diagnostics
  such as hidden provider-path drift in a harness-controlled comparison. These
  warnings should block overclaiming. Missing benchmark target, stream, harness,
  or provider-path metadata is also reported as a comparability warning, even
  when every run in the cohort is missing the same field.

`claimReadiness.publishable` is the machine-readable gate for benchmark claims.
Use `--require-publishable` in CI to make `compare` exit `2` after writing the
report when blockers remain. Pairwise adapter comparison warnings are included
in readiness blockers so non-significant or otherwise weak adapter deltas cannot
quietly accompany a publishable claim.

## Publish Check

`ruhroh_publish_check_v1` is the durable output of the publication gate. It
wraps the compare report, publishable verdict, blocker/advisory counts,
remediation actions, source paths, and optional source-verification report.

The package ships a structural JSON Schema for this export at
`node_modules/@kestrel-agents/ruhroh/schemas/publish-check-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/publish-check-v1.schema.json`.
Use the schema for CI and registry shape checks. Use `publish-check` itself for
semantic validation, artifact checks, source verification, bundle creation, and
the final publishability gate.

Required fields:

- `$schema`: `https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json`.
- `version`: `ruhroh_publish_check_v1`.
- `source`: input and output paths used by the command, including `resultsPath`
  and optional suite, run-plan, rerun-ledger, claim, summary, HTML, bundle, and
  evaluator-calibration report paths.
- `publishable`: final verdict.
- `blockerCount` and `blockers`: blocking reasons.
- `remediation`: stable remediation objects with `code`, `category`, `message`,
  `action`, and optional `blocker`/`docs`.
- `advisoryCount` and `advisories`: non-blocking warnings.
- `compare`: embedded `ruhroh_compare_v1` output.
- `sourceVerification`: optional `ruhroh_claim_source_verification_v1` report
  when `--verify-sources` was used.

## Publication Packet Manifest

`ruhroh_publish_bundle_v1` is the inventory file written to `manifest.json`
when `publish-check --bundle <dir>` creates a publication packet. It records the
source result directory, packet-relative file paths, publishability counts, and
the role of each included evidence file so reviewers and registries can inspect a
packet without inferring layout conventions from filenames.

The package ships a structural JSON Schema for this manifest at
`node_modules/@kestrel-agents/ruhroh/schemas/publish-bundle-v1.schema.json`;
`ruhroh init` also copies it to
`ruhroh/schemas/publish-bundle-v1.schema.json`. Use the schema for CI and
registry shape checks. Use `validate-bundle` for cross-file checks, source hash
verification, and publishability validation.

Required fields:

- `$schema`: `https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json`.
- `version`: `ruhroh_publish_bundle_v1`.
- `createdAt`: bundle creation timestamp.
- `source`: bundle-local source paths, including `resultsPath`, `bundlePath`,
  and optional suite, run-plan, rerun-ledger, and evaluator-calibration report
  paths.
- `publishable`, `blockerCount`, and `advisoryCount`: the bundled
  publish-check verdict summary.
- `files`: bundle inventory entries with `role`, bundle-relative `path`, and a
  human-readable `description`.

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
evidence they cite. Relative source paths are resolved from the claim file's
directory; standalone claims usually record the source paths that were available
at export time, while `publish-check --bundle` rewrites claim sources to
bundle-relative `sources/` paths.

Required fields:

- `version`: `ruhroh_benchmark_claim_v1`.
- `createdAt`: export timestamp.
- `tool`: Ruhroh package identity that produced the claim, including `name` and
  package `version` when available.
- `source`: artifact provenance for the exported claim, including
  `resultsPath`, and optionally `suitePath`, `suiteSha256`, `runPlanPath`,
  `runPlanSha256`, `rerunLedgerPath`, `rerunLedgerSha256`,
  `evaluatorCalibrationReportPath`, `evaluatorCalibrationReportSha256`,
  `htmlPath`, and `benchmarkClaimPath` when those inputs or CLI flags were
  available. `publish-check` adds the evaluator calibration fields when it finds
  `.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`.
  `resultArtifacts`
  records each included `ruhroh-loop-result.json`
  with path, SHA-256 digest, scenario id, adapter id, and available
  run/sample/version metadata. When the run manifest includes
  `benchmarkTarget`, the result artifact also includes that target snapshot so
  readers can inspect the exact harness, requested model, actual model, provider
  path, and stream for that run without opening the manifest first. When present,
  the target snapshot must include `targetId`, `stream`, `requestedModel.model`,
  and `actualModel.model`; weaker snapshots fail claim validation. Paths can be
  absolute, working-directory relative, or bundle-relative when the claim was
  produced inside a publication bundle. Each result artifact can also include
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
  usage summaries. Each row includes `cohort` metadata with sample ids/seeds,
  scenario and adapter versions, benchmark target ids, harness identities,
  provider paths, adapter-reported agent models, canonical agent model
  identities, agent/evaluator prompt identities, evaluator model identities,
  judge identities, environment fingerprints, and comparability warnings.
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
review count, statistical warnings, and the same cohort stack metadata carried
by the benchmark claim.

The package ships a structural JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/benchmark-summary-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/benchmark-summary-v1.schema.json`.
Use `ruhroh validate-summary benchmark-summary.json --json` for Ruhroh's
built-in row and top-level consistency checks before ingesting the summary into
external reports or lightweight leaderboards.

## Claim Index JSON

`claim-index <path> --json` emits a registry-oriented catalog over one
benchmark claim, one publication packet, or a directory of packets. It is the
machine-readable companion to the static claim index HTML and is intended for
local registries, dashboards, and publication pipelines that need to ingest
multiple archived claims without losing claim-level blockers.

The package ships a structural JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/claim-index-v1.schema.json`;
`ruhroh init` also copies it to `ruhroh/schemas/claim-index-v1.schema.json`.
Use the schema as the external ingestion contract, then use
`ruhroh claim-index <path> --require-publishable --json` as the readiness gate.

Required fields:

- `$schema`: `https://lumicorp.github.io/ruhroh/schemas/claim-index-v1.schema.json`.
- `version`: `ruhroh_claim_index_v1`.
- `generatedAt`: index creation timestamp.
- `source`: input path and optional HTML output path.
- `registryReady`: true only when at least one claim was found, no claims are
  malformed, and every valid claim is publishable.
- `registryBlockers`: one blocker per invalid or blocked claim.
- `claimCount`, `publishableCount`, `blockedCount`, `invalidCount`,
  `suiteCount`, `adapterCount`, and `totalRuns`: top-level registry rollups.
- `claims`: per-claim entries with claim path, optional bundle path, validation
  status, publishability, suite/version, adapters, run summary, evidence counts,
  source paths, blockers, advisories, and validation diagnostics.

## Benchmark Target Config

Target configs define public benchmark matrix rows for `ruhroh plan` and
`ruhroh run --target-config`. They are the source artifact for separating the
Ruhroh adapter, agent harness, requested model, provider path, and
native-stack status before any execution starts. The legacy stream name
`recommended-stack` is still accepted for older target configs.

The package ships a structural JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/benchmark-target-config-v1.schema.json`;
`ruhroh init` also copies it to
`ruhroh/schemas/benchmark-target-config-v1.schema.json`. Use
`ruhroh validate-targets benchmark-targets.json --json` before collection to
catch malformed or duplicated target rows.
Use one top-level `stream` for a public matrix when possible. If targets carry
their own `stream` values and the config omits a top-level stream, all target
streams must agree and the effective stream is validated with the same
harness/model/provider/native-stack rules.

Required fields:

- `version`: `ruhroh_benchmark_target_config_v1`.
- `targets`: non-empty array of target rows.
- `targets[].targetId`: stable comparison id used in sample ids and aggregate
  rows.
- `targets[].requestedModel.model`: intended model name for the harness
  adapter to request.

Recommended fields for public claims are `harness.name`, `harness.version`,
`requestedModel.provider`, `requestedModel.protocol`,
`requestedModel.promptVersion`, and `providerPath`.

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
  optional `shard`, and adapter ids.
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
When a sample includes `benchmarkTarget`, that target snapshot must include
`targetId` and `requestedModel.model` so the preserved plan proves the intended
model identity before execution starts. `actualModel` is execution metadata and
belongs in the run manifest/result after the adapter reports what ran.

When `--shard <index>/<total>` is used, `selection.shard` records the executed
shard. The `samples` array includes only that shard's planned rows, while each
sample's `runCount` and `sampleId` still reflect the full requested `--runs`
count so sharded workers can be merged and compared against one cohort.

Pass the plan back to `compare --run-plan <path>` to detect missing planned
samples, results without sample ids, extra result samples outside the intended
matrix, and result samples whose scenario id, adapter id, seed, run index, or
run count contradicts the planned row. When a suite comparison uses a run plan,
Ruhroh also verifies that the plan's suite id, `suiteVersion`, and suite
manifest hash match the suite selected for comparison. Those warnings block
publication.

## Rerun Ledger

`ruhroh_rerun_ledger_v1` is the user-authored record for planned samples that
could not produce result artifacts. Validate it with the shipped schema at
`schemas/rerun-ledger-v1.schema.json` before using it in CI or a publication
bundle.

Required top-level fields:

- `version`: `ruhroh_rerun_ledger_v1`.
- `entries`: array of sample-level decisions.

Each entry must include:

- `sampleId`: the planned sample id from `ruhroh-run-plan.json`.
- `decision`: `exclude` or `rerun`.
- `reasonKind`: `infrastructure`, `invalid_artifact`, `operator_error`, or
  `other`.
- `reason`: human-readable explanation for the decision.
- `decidedBy`: reviewer, automation, or team identity.
- `decidedAt`: timestamp for the decision.

Only `decision: "exclude"` with `reasonKind: "infrastructure"` can suppress a
missing-sample run-plan warning. Other entries stay visible as warnings, so a
rerun ledger cannot silently shrink the benchmark cohort.

Pass the ledger to `compare --run-plan <path> --rerun-ledger <path>`. Compare
JSON includes `rerunLedger.entryCount`, `acceptedExclusionCount`,
`acceptedExclusions`, and ledger warnings. Benchmark claims record the ledger
path and SHA-256 digest so archived claims can be source-verified.

## Compatibility Rules

- Use the `version` field to branch parsers.
- Treat additive optional fields as compatible.
- Do not parse prose warnings as the primary contract when structured fields
  exist.
- Do not use local directory names as benchmark identity when `scenarioId`,
  `adapter`, `runId`, or `sample.id` is available.
- Preserve raw artifacts alongside reports so later methodology changes can
  recompute summaries from source evidence.

See [Contract Evolution](./contract-evolution.md) for the full producer,
consumer, and migration policy.
