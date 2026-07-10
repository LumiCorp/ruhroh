---
id: ruhroh-benchmark-methodology
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-09
depends_on:
  - src/results.ts
  - src/scenarios.ts
  - src/suites.ts
---

# Benchmark Methodology

Ruhroh measures whether a coding agent delivered the requested user outcome in
a final workspace. A benchmark should reproduce a meaningful engineering loop,
not reward a filename or source string unless the user request explicitly made
that detail part of the outcome.

## Methodology At A Glance

| Decision | Rule | Ruhroh evidence |
| --- | --- | --- |
| What is compared? | One scenario, adapter, and run-agent configuration per cohort. | Suite, run plan, and run manifest metadata. |
| How often is it run? | Use the suite's `methodology.minRuns`; fewer than five runs remain directional. | Sample ids, seeds, run indexes, coverage, and low-sample warnings. |
| What counts as failure? | Ordinary implementation and goal failures remain in the sample. | Final result, failure bucket, journey, and reviewer evidence. |
| When is a retry allowed? | Only for infrastructure failure outside the measured agent behavior. | Preserved failed evidence and a versioned rerun ledger. |
| What makes a claim publishable? | Complete suite coverage, comparable cohorts, intact evidence, adequate reviewer quality, and no required review. | `claimReadiness`, review queue, validation results, and source hashes. |

## Run Units

**Rule:** Group results by scenario id and adapter id, then keep the model,
prompt, adapter version, scenario version, evaluator, judge identity, and
environment consistent within the cohort.

**Why it matters:** A changed prompt or reviewer can alter the result even when
the scenario id stays the same. Mixing those runs hides what actually improved.

**Evidence to preserve:**

- the generated Harbor task;
- `ruhroh-loop-result.json` and `ruhroh-run-manifest.json`;
- implementation turns, journey, transcripts, and event logs;
- evaluator input and output;
- final workspace summary and archive.

Compare reports surface cohort differences rather than silently combining
them. Runtime manifests compute `environment.fingerprint` from stable OS,
Python, and container components. Sample indexes and local workspace paths stay
available as metadata but do not affect that fingerprint.

### Benchmark Targets

For public comparison matrices, define benchmark targets instead of treating an
adapter id as the whole experimental condition. Each target records the adapter
command, harness identity, requested model, provider path, and native-stack
status. Its target id becomes the comparison id in sample ids and aggregate
reports, and the run manifest adds the actual model when the wrapper reports it.

Use targets to distinguish three comparison streams:

- `harness-controlled`: one requested model and provider path across harnesses;
- `model-controlled`: one harness and provider path across requested models;
- `native-stack`: each harness with its intended or recommended model path.

The package includes validated templates under `examples/benchmark-targets/`.
Record protocol differences in `providerPath.protocol`. When harnesses require
different model strings for the same underlying model, use
`requestedModel.canonicalId` for the shared identity and keep the literal
argument in `requestedModel.model`.

## Sample Size

**Rule:** Use single runs to debug the loop. Use repeated runs to support a
comparison or claim.

| Use | Minimum guidance |
| --- | --- |
| Debugging one task, agent, or reviewer | One run can reveal a failure path, but should not support a ranking. |
| Smoke comparison | At least five runs per scenario-adapter group. |
| Broader benchmark conclusion | Use the suite requirement, commonly ten or more runs. |

Collect repeated samples with a stable scenario and adapter selection:

```bash
pnpm exec ruhroh run --suite <id> --adapter <adapter> --runs <n>
```

Each sample receives `RUHROH_SAMPLE_ID`, `RUHROH_SAMPLE_SEED`,
`RUHROH_RUN_INDEX`, and `RUHROH_RUN_COUNT`. Ruhroh preserves those values in
the run manifest. `RUHROH_RUN_SEED` also defaults to the sample seed for adapter
compatibility.

Repeat `--adapter` to collect the same plan for multiple agents. Each adapter
remains a separate aggregate group.

For explicit harness, model, and provider metadata, use a target config:

```bash
pnpm exec ruhroh validate-targets <target-config.json> --json
pnpm exec ruhroh run --suite <id> \
  --target-config <target-config.json> \
  --runs <n>
```

Each target requires `targetId` and `requestedModel.model`; it may also define
`adapterCommand`, `adapterId`, `harness`, `providerPath`, `recommendedStack`,
and string environment overrides. Repeat `--target <id>` to filter rows. Do not
combine `--target-config` with `--adapter`.

Stream validation checks the intended control variable. Run-plan validation
then compares each result manifest with its planned target. Harness, model,
provider-path, native-stack, or actual-model drift becomes a warning that blocks
publication. Pairwise comparisons also expose hidden differences in variables
that the selected stream was supposed to control.

### Distributed Collection

Use `--shard <index>/<total>` to split a deterministic
scenario-adapter-sample matrix across workers. A run created with `--runs 20
--shard 3/4` still has a sample id ending in `-of-20` and a run count of `20`.
The shard chooses which samples the worker executes; it does not redefine the
cohort.

Every worker must use the same scenario, suite, adapter, and `--runs` flags.
Preserve each result root and compare the merged artifacts with the original
run plan.

### What Compare Reports

`ruhroh compare` reports:

- pass rate and Wilson 95% confidence interval;
- pass@k and a deterministic bootstrap percentile interval for mean score;
- failure buckets, subscores, duration, and iteration distribution;
- cohort metadata and comparability warnings;
- evaluator-quality and human-review signals;
- cost and token summaries when connectors provide usage;
- `claimReadiness` blockers and advisories.

For multiple adapter groups on the same scenario, Ruhroh also reports pairwise
pass-rate deltas, an approximate normal 95% interval, and a two-sided Fisher
exact check. Treat the conclusion as directional unless the interval excludes
zero, Fisher's test is significant at alpha `0.05`, and both groups satisfy the
suite minimum.

Fewer than five runs produces a low-sample warning. Mixed scenario versions,
adapter versions, agent models, prompt versions, evaluator models, evaluator
input signatures, judge identities, or environment fingerprints produce
comparability warnings. Those groups are debugging evidence, not publishable
benchmark claims.

## Retry And Exclusion Policy

**Do not retry:** failed implementations, goal mismatches, low-quality answers,
or runs the agent abandoned. These are measured outcomes.

**Retry only:** infrastructure failures outside the agent's control, such as a
Harbor crash, missing package runner, broken reviewer command, or unavailable
external dependency that the suite allowed.

Preserve the failed evidence. For a published cohort, record an allowed
exclusion in a `ruhroh_rerun_ledger_v1` file and pass it with the original run
plan:

```bash
pnpm exec ruhroh compare <results> \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --rerun-ledger ruhroh-rerun-ledger.json
```

Only sample-level `decision: "exclude"` entries with
`reasonKind: "infrastructure"` explain a missing planned sample. Operator
errors, invalid artifacts, unknown sample ids, and other exclusions remain
warnings and block publication. Claims preserve the ledger path and SHA-256 so
`validate-claim --verify-sources` can recheck it. The schema ships at
`schemas/rerun-ledger-v1.schema.json`.

## Task Governance

**Rule:** Version any task change that could alter the result, and make the
review risks visible before collection.

Public and held-out tasks must include the governance metadata enforced by
`ruhroh validate`:

| Area | Required information |
| --- | --- |
| Identity | `metadata.scenarioVersion`, creation and update dates, maintainers, and changelog. |
| Evaluation context | Difficulty, tags, expected runtime, provenance, and lifecycle status. |
| Exposure | Visibility and contamination notes; network-enabled tasks also need a network rationale. |
| Held-out review | `evaluation.privateAssets` or `metadata.privateEvalRationale`. |

Bump `scenarioVersion` when prompts, assets, rubrics, calibration cases, or
expected outcomes change materially. Deprecate or retire tasks instead of
silently replacing them.

Suites freeze membership and task versions under `suiteVersion`. Bump it when
membership, locked versions, acceptance criteria, or methodology changes. A
published suite must document contamination review, reward-hacking review, a
review checklist, and its deprecation policy.

`inspect-pack` reports risk-review warnings for missing or placeholder task and
suite reviews. Resolve those gaps before collecting public runs.

## Reviewer Governance

**Rule:** Judge the final delivered state. Use the journey and transcript as
supporting evidence, not as a substitute for inspecting the outcome.

A strong rubric has concrete criteria, explicit task context, and clear
evidence instructions. Use `review` when the evaluator cannot confidently
decide from the available evidence.

### Calibration

Published scenarios should include `evaluation.calibrationCases` with known
pass, fail, and review examples plus rationales. These examples test evaluator
behavior; they do not score the live run.

`ruhroh validate` reports expected-status coverage and missing anchors. Run
`ruhroh calibrate-evaluator` and preserve a passing report before repeated
collection. `ruhroh workflow` treats that report as a required quality gate.

### Private Reviewer Evidence

Use `evaluation.privateAssets` for held-out expected outputs, fixtures, or
checklists that should not enter the public prompt. Ruhroh copies them under
`private-eval-assets/` and lists their paths in
`ruhroh-loop-eval-input.json`.

Run manifests preserve reviewer-input counts and hashes of private asset paths,
not private contents. Reviewers can detect setup drift without exposing the
held-out material.

### Quality And Disagreement

Validation JSON includes stable evaluator-lint codes, categories, fields, and
severity. Reports warn when reviewer output lacks evidence, criteria results,
judge metadata, or enough summary detail. These warnings do not change the
binary Harbor score, but they block public claims until resolved.

Use `ruhroh review <results> --json` or `--html` to inspect non-passing runs,
explicit review judgments, reviewer infrastructure failures, and weak evidence.
Record the human decision, reviewer identity, rationale, and accepted
limitations before rerunning `publish-check`.

Model-backed reviewers should preserve provider, model, model version, and
prompt version. Higher-stakes evaluations can include `judgeVotes` from
multiple model, command, or human-assisted judges. Ruhroh calculates
`judgeAgreement` and flags disagreement for review.

## Reporting Claims

**Rule:** Publish only when `claimReadiness.publishable === true`.

Run the publication gate against a version-locked suite and the original plan:

```bash
pnpm exec ruhroh compare <results> \
  --suite <id> \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --require-publishable \
  --json
```

The report is still written when the gate returns exit code `2`.

| Blocker category | Examples |
| --- | --- |
| Scope | Ad hoc comparison, missing suite scenarios, or unsatisfied minimum runs. |
| Comparability | Mixed cohorts, pairwise uncertainty, or suite-version drift. |
| Plan coverage | Missing planned samples, unplanned results, or mismatched sample metadata. |
| Evidence | Artifact validation errors, incomplete artifact paths, or source drift. |
| Review quality | Evaluator warnings, required human review, or unresolved disagreement. |

Advisories preserve evaluator diagnostics, artifact-validation warnings, and
recommended review items without hiding the underlying runs.

### Claim Artifacts

| Artifact | Purpose |
| --- | --- |
| `benchmarkClaim` | Versioned archive record containing tool and suite identity, adapter rollups, coverage, per-scenario results, pairwise deltas, readiness, review counts, source paths, and hashes. |
| `benchmark-summary.json` | Stable scenario-adapter rows for reports or leaderboards, with readiness and evidence fields retained at the top level. |
| Raw compare JSON | Detailed groups, review queue, run-plan checks, and diagnostics behind the compact claim. |
| Preserved run artifacts | The implementation journey, reviewer input and output, manifest, transcripts, workspace summary, and workspace archive behind each score. |

Each result referenced by a benchmark claim carries a SHA-256 digest and, when
available, its `benchmarkTarget` snapshot. Keep the raw groups, review queue,
and source artifacts beside the compact exports so the executed stack and the
full implementation journey remain auditable.

Write and validate standalone exports with:

```bash
pnpm exec ruhroh compare <results> --benchmark-claim benchmark-claim.json
pnpm exec ruhroh compare <results> --benchmark-summary benchmark-summary.json
pnpm exec ruhroh validate-claim benchmark-claim.json --json
pnpm exec ruhroh validate-summary benchmark-summary.json --json
```

Publication pipelines should add `--require-publishable --verify-sources` to
claim validation. Exit code `2` means the claim is structurally valid but still
blocked. Exit code `1` means the claim is invalid or referenced evidence has
changed.

When `--run-plan` is present, Ruhroh verifies that every planned
scenario-adapter-sample produced one matching result and that no extra sample
entered the aggregate. The plan also preserves scenario source hashes and the
suite manifest version and hash, allowing publication review to catch
benchmark-pack drift.

### What A Credible Result Names

- Ruhroh package version and suite id/version;
- scenario ids and versions;
- adapter ids and versions;
- model and provider metadata when available;
- evaluator identity and judge metadata;
- run count, pass rate, Wilson interval, pass@k, and pairwise deltas when used;
- retry and exclusion policy;
- cost and token coverage when available.

Claim and summary exports preserve usage coverage, totals, means, and
cost/tokens per pass. Missing usage remains missing data; it is never treated as
zero. Suite-level reporting should include both adapter rollups and
per-scenario groups. Avoid ranking agents from tiny samples or mixed task
versions.
