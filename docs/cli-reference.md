---
id: ruhroh-cli-reference
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-09
depends_on:
  - src/cli.ts
---

# CLI Reference

The Ruhroh CLI is intentionally small. It discovers scenarios and suites,
generates Harbor tasks, checks local readiness, runs adapters through Harbor,
and summarizes preserved artifacts.

Use the commands as a staged loop, not as a flat checklist:

| Stage | Primary commands | Proof you should have before moving on |
| --- | --- | --- |
| Understand the evidence model | `workflow --html`, `report-gallery` samples | You can point to the artifacts and blockers behind a sample claim. |
| Prove local plumbing | `init`, `first-run`, `doctor`, `validate`, `run --dry-run`, `run` | A real fixture `ruhroh-loop-result.json` exists and `workflow` advances past the first stage. |
| Author a benchmark pack | `new-scenario`, `new-suite`, `new-evaluator`, `calibrate-evaluator`, `inspect-pack` | Scenarios validate, the suite locks versions, evaluator calibration passes, and pack preflight is clean. |
| Wire an agent | `examples`, `new-adapter`, `doctor` | The adapter writes completion status, model/version metadata, and reviewable artifacts. |
| Collect comparable runs | `plan`, `run --runs`, `validate-artifacts` | Run artifacts match the planned scenario, adapter, sample, and seed matrix. |
| Review and compare | `report`, `eval-quality`, `review`, `compare` | Evidence, review queues, confidence intervals, and cohort warnings are inspectable. |
| Publish or block the claim | `publish-check`, `validate-bundle`, `claim-index`, `explain` | A bundle is source-verifiable, publishable, or blocked with actionable remediation codes. |

`workflow` is the guided view over that lifecycle. Use this reference when you
need command-level details for a specific stage.

## `ruhroh init [dir]`

Scaffold a local benchmark starter under `[dir]/ruhroh` or `./ruhroh` when no
directory is supplied.

```bash
pnpm exec ruhroh init
pnpm exec ruhroh init --adapter codex-cli
pnpm exec ruhroh init benchmarks --json
```

The starter includes:

- `ruhroh/scenarios/simple-newsletter`;
- `ruhroh/adapters/fixture-newsletter/run.sh`;
- `ruhroh/evaluators/fixture-newsletter/run.sh`;
- a local README with smoke commands.

Add `--adapter codex-cli`, `--adapter claude-code`, `--adapter gemini-cli`,
`--adapter aider`, or `--template <name>` to copy a maintained live-agent
wrapper into the starter alongside the credential-free fixture path.
`--template generic` creates a fail-fast `local-agent` wrapper for a custom
command.

When `[dir]` is supplied, the printed next commands and JSON `nextCommands`
begin with `cd <dir>` so the relative scaffold paths resolve from the benchmark
starter. JSON output separates the credential-free fixture commands from
`selectedAdapter` checks for a live-agent wrapper.

`init` is safe to rerun when files are unchanged. It refuses to overwrite local
edits.

## `ruhroh new-scenario <id>`

Scaffold a validation-ready v2 scenario draft under `ruhroh/scenarios/<id>` by
default, or under a custom `--scenario-dir`.

```bash
pnpm exec ruhroh new-scenario csv-cleanup
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir benchmarks/scenarios --tier nightly --json
```

The generated draft includes `scenario.json` with private visibility,
governance metadata, rubric guidance, and a calibration case, plus an
`instruction.md` prompt stub. It is safe to rerun when files are unchanged and
refuses to overwrite local edits.
Text and JSON output include `nextCommands` for editing the prompt/manifest,
validating the scenario, and creating the first local suite that locks the
scenario version.

## `ruhroh new-suite <id>`

Scaffold a governed, version-locked suite draft under `ruhroh/suites/<id>` by
default, or under a custom `--suite-dir`.

```bash
pnpm exec ruhroh new-suite local-data \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario csv-cleanup \
  --scenario shift-review \
  --runs 10
```

`new-suite` reads the selected scenarios from `--scenario-dir`, locks their
`metadata.scenarioVersion` values into `scenarioVersions`, and writes standard
methodology and governance defaults. It refuses unknown or duplicate scenarios
and refuses to overwrite local edits. `--runs` sets the suite `minRuns`, with a
floor of 5 so a new suite does not start below the weak-confidence warning
threshold.
Text and JSON output include `nextCommands` for suite validation, pack
inspection, strict calibration/risk-review preflight, and a first run-plan
command with an adapter placeholder.

## `ruhroh new-adapter <id>`

Scaffold an edit-me custom-shell adapter under `ruhroh/adapters/<id>`.

```bash
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh new-adapter codex-local --template codex-cli
pnpm exec ruhroh new-adapter local-agent --json
```

The generic generated `run.sh` writes prompts and transcripts under the
workspace, writes a `ruhroh_run_agent_result_v1` result file, and exits with
`runtime_failure` until you replace the placeholder block with a real agent
invocation. This keeps fresh generic scaffolds from producing fake passing
benchmark runs. The generated README shows the matching `doctor` and
`--dry-run` checks.
Templates are `generic`, `codex-cli`, `claude-code`, `gemini-cli`, `aider`, and
`fixture`. The named live-agent templates copy the maintained example wrappers
and document the CLI-specific env vars they expect.
JSON output is versioned as `ruhroh_new_adapter_v1` and includes `nextCommands`
with the edit step, `doctor`, `doctor --json` adapter-metadata check, and
dry-run preview command for the generated wrapper.

## `ruhroh examples`

List packaged scenarios, command-backed adapters, evaluator examples, and
scaffoldable evaluator templates.

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh examples --json
```

Use this when choosing between the credential-free fixture adapter, live
custom-shell wrappers for Codex CLI, Claude Code, Gemini CLI, or Aider, and the
review, deterministic, model, or hybrid evaluator templates. JSON output is
versioned as `ruhroh_examples_v1` and includes paths, descriptions, credential
requirements, wrapper commands, evaluator scaffold commands, and calibration
next steps.

## `ruhroh first-run`

Check whether the local credential-free fixture loop is ready.

```bash
pnpm exec ruhroh init
pnpm exec ruhroh first-run
pnpm exec ruhroh first-run --json
pnpm exec ruhroh first-run --allow-dry-run --json
```

`first-run` is read-only. It checks the local fixture scaffold, validates the
selected scenario and suite, verifies the fixture adapter/evaluator commands,
checks the required environment variables, probes Harbor, and prints the exact
next command to run.

Its `nextCommands` list is staged. Before `init`, it shows scaffold setup and a
re-check. After scaffolding, it shows missing exports. Once the fixture is
ready, it shows `doctor`, `validate`, dry-run, and full-run commands.

JSON output is `ruhroh_first_run_check_v1` and includes a top-level
`nextAction`. It reports `dryRunReady` separately from `fullRunReady`, so a
missing Harbor installation does not hide that the files and commands are ready
for preview.

Add `--allow-dry-run` when setup automation should exit `0` after proving the
scaffold, adapter, and evaluator are ready for dry-run preview. The report still
returns `ready: false` until the full Harbor-backed run is available.

## `ruhroh workflow [results]`

Show the guided path from first local success to audit-ready publication.

```bash
pnpm exec ruhroh workflow
pnpm exec ruhroh workflow ./results --json
pnpm exec ruhroh workflow ./results --html ruhroh-workflow.html
```

`workflow` is read-only. It inspects the local fixture scaffold, scenario and
suite authoring roots, reviewer wiring and calibration anchors, strict
benchmark-pack preflight, run-plan presence, discovered
`ruhroh-loop-result.json` saved results, and publication claim or packet outputs.
It prints the current stage plus the concrete commands for the next step: first
local example, task/benchmark-suite authoring, reviewer quality, calibrated and
risk-reviewed pack preflight, planned repeated runs, evidence-backed comparison,
and `publish-check`.
The text and JSON output include a top-level `nextAction` so users and setup
scripts can act without scanning every stage.

When `[results]` is supplied, Ruhroh uses that path while looking for run result
artifacts. Without it, the guide checks `results/`, `ruhroh/results/`, and
`.generated/ruhroh/`. JSON output is versioned as
`ruhroh_workflow_guide_v1`. `--html <path>` writes the same staged guide as a
static reviewer artifact with the current stage, next action, checks, commands,
and documentation pointers.

## `ruhroh explain [code]`

Explain publish-check remediation codes without re-reading result artifacts.

```bash
pnpm exec ruhroh explain
pnpm exec ruhroh explain run_plan_mismatch
pnpm exec ruhroh explain run_plan_mismatch --json
```

Use this after `publish-check` reports a blocker. Text output shows the
category, severity, action, docs anchor, and an example blocker for each code.
JSON output is versioned as `ruhroh_explain_v1` for CI and publication tooling.

## `ruhroh new-evaluator <id>`

Scaffold an edit-me command-backed evaluator under
`ruhroh/evaluators/<id>`.

```bash
pnpm exec ruhroh new-evaluator local-evaluator
pnpm exec ruhroh new-evaluator local-evaluator --template deterministic
pnpm exec ruhroh new-evaluator local-evaluator --json
```

The generated `run.sh` reads the reviewer-command environment, writes
`ruhroh_eval_result_v1` JSON to `RUHROH_EVAL_OUTPUT_PATH`, and returns
`status: "review"` until you replace the placeholder checks with
task-specific outcome verification. This keeps fresh reviewer scaffolds
from creating fake passing benchmark runs. The generated README shows the
matching `RUHROH_EVAL_COMMAND`, `doctor`, and validation checks.
Templates are `review`, `deterministic`, `model`, and `hybrid`; see the
[Reviewer Recipes](./evaluator-cookbook.md).

## `ruhroh calibrate-evaluator`

Run the configured evaluator against selected scenario calibration anchors.

```bash
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/local-evaluator/run.sh"
pnpm exec ruhroh calibrate-evaluator --scenario local-task
pnpm exec ruhroh calibrate-evaluator --suite local-smoke --json
```

`calibrate-evaluator` uses the same scenario selection flags as `run` and
`generate`. For each `evaluation.calibrationCases[]` anchor, Ruhroh writes a
synthetic calibration workspace and eval input under
`.generated/ruhroh/evaluator-calibration`, invokes `RUHROH_EVAL_COMMAND`, reads
the evaluator's `ruhroh_eval_result_v1`, and checks the returned `status`
against `expectedStatus`. JSON output is versioned as
`ruhroh_eval_calibration_report_v1`. Ruhroh also writes the same report to
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
so workflow guides, CI jobs, and reviewers can verify that calibration was
actually run. The package ships its structural schema at
`schemas/eval-calibration-report-v1.schema.json`.

Exit code `0` means every calibration case matched. Exit code `1` means the
command could not run, for example because `RUHROH_EVAL_COMMAND` is missing.
Exit code `2` means the evaluator ran but failed the calibration gate because a
status mismatched, output was missing, the evaluator exited nonzero, or the
selected scenarios had no calibration cases.

## Discovery

```bash
pnpm exec ruhroh list
pnpm exec ruhroh list --json
pnpm exec ruhroh list-suites
pnpm exec ruhroh list-suites --json
```

Use `--scenario-dir` and `--suite-dir` to point at local authoring trees instead
of bundled package content. `--list` and `--list-suites` remain supported as
legacy aliases, but new docs and scripts should prefer the named commands.

## Validation

```bash
pnpm exec ruhroh validate
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --suite ruhroh-smoke --json
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --json
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --html ruhroh-pack-inspection.html
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --require-calibrated --json
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --require-calibrated --require-risk-reviewed --json
```

Validation reports hard errors and warnings. Warnings include network-enabled
scenarios, weak suite sample sizes, and rubric/evidence lint findings.
JSON validation output preserves readable `warnings` and adds
`warningDetails` for evaluator lint findings. Each scenario result also includes
a `calibration` summary with expected-status counts, covered statuses, missing
statuses, and advisory calibration warnings. Each lint detail includes a stable
`code`, `category`, `field`, `severity`, and `message` so benchmark packs can
gate or audit evaluator quality in CI without parsing prose.
Validation also warns when `metadata.changelog` does not mention the current
`metadata.scenarioVersion`, which helps keep suite locks and published claims
auditable across scenario changes.

### `inspect-pack`

`inspect-pack` is the authoring and registry preflight for a local benchmark
pack. Its `ruhroh_benchmark_pack_inspection_v1` output covers:

| Area | Included checks |
| --- | --- |
| Readiness | Scenario and suite blockers, warnings, evaluator lint, and calibration coverage. |
| Composition | Difficulty distribution, expected runtime, and suite collection estimates from `minRuns`. |
| Risk review | Contamination and reward-hacking review status. |
| Fingerprints | Scenario manifests, prompts, public assets, and private evaluator assets. |

Text output summarizes the pack. `--json` includes per-scenario fingerprints.
`--html <path>` writes a static reviewer report with scenario and suite rows,
calibration, runtime, risk-review, and content links.

Exit code `0` means no validation blocker exists. Exit code `1` means the pack
must be fixed before registry ingestion or publication. Warnings do not fail by
default.

Add `--require-calibrated` when every task must cover the expected calibration
statuses. Add `--require-risk-reviewed` when missing or placeholder risk-review
text should fail the gate. The bundled scenarios pass both strict checks.

## Doctor

```bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke --adapter ./adapters/my-agent.sh --json
```

`doctor` checks:

- package layout, installed assets, and Python runtime importability;
- scenario validation and optional suite version locks;
- Harbor availability;
- adapter and evaluator command wiring;
- command-backed adapter and evaluator safety.

The `adapter-metadata` check inspects readable wrappers for the
`RUHROH_RESULT_PATH` contract. It warns when only final-line completion
metadata is likely to be captured. Passing adapters should write
`ruhroh_run_agent_result_v1` with adapter version, model identity, optional
usage, and prompt or transcript artifacts.

The `command-safety` check warns when shell execution is enabled or a no-shell
command contains operators that will be passed literally. The package check
verifies the CLI, Python runtime, schemas, bundled scenarios and suites,
fixture adapter and evaluator, and core docs.

When local scenarios are provided without `--suite-dir`, `doctor` warns that
local suite validation was skipped. It does not compare a project-local task
tree with bundled suite manifests.

## Generate And Run

```bash
pnpm exec ruhroh generate --scenario simple-newsletter
pnpm exec ruhroh plan --suite ruhroh-smoke --adapter ./adapters/my-agent.sh --runs 5
pnpm exec ruhroh run --suite ruhroh-productivity --adapter ./adapters/my-agent.sh --dry-run
pnpm exec ruhroh run --scenario simple-newsletter --adapter ./adapters/my-agent.sh
pnpm exec ruhroh run --suite ruhroh-smoke --adapter ./adapters/my-agent.sh --runs 5
pnpm exec ruhroh run --suite ruhroh-smoke --adapter ./adapters/codex.sh --adapter ./adapters/claude.sh --runs 5
pnpm exec ruhroh run --suite ruhroh-smoke --adapter ./adapters/my-agent.sh --runs 20 --shard 1/4
```

Options:

- `--scenario <id>` selects one scenario.
- `--suite <id>` selects ordered suite membership.
- `--tier <smoke|nightly|release>` selects a scenario tier.
- `--iterations <n>` overrides implementation loop iterations.
- `--runs <n>` repeats each selected scenario. Every sample receives
  `RUHROH_SAMPLE_ID`, `RUHROH_SAMPLE_SEED`, `RUHROH_RUN_INDEX`, and
  `RUHROH_RUN_COUNT`, and those values are preserved in the run manifest.
- `--shard <index>/<total>` runs only one shard of the deterministic
  scenario/adapter/sample matrix. Sample ids and `RUHROH_RUN_COUNT` still use
  the full `--runs` value, so workers running `1/4`, `2/4`, `3/4`, and `4/4`
  produce disjoint artifacts that compare against one intended run plan.
- `--adapter <id-or-command>` selects an agent connector. Repeat the option to
  run the same task selection across multiple agents.
- `--generated-dir <path>` changes the generated Harbor task root and run-plan
  output location.
- `--harbor-bin <path>` changes the Harbor executable.

`ruhroh plan` generates task directories and writes
`.generated/ruhroh/ruhroh-run-plan.json` without starting Harbor. JSON output is
versioned as `ruhroh_plan_report_v1` and includes the plan path, dataset path,
selected scenarios, adapters, sample count, and a compact run-plan summary.
Actual runs write the same plan before starting Harbor. Use `compare --run-plan`
after collection to verify the result set against the intended
scenario/adapter/sample matrix.
For distributed collection, run `ruhroh plan ... --shard <index>/<total>` or
`ruhroh run ... --shard <index>/<total>` on each worker with the same scenario,
suite, adapter, and `--runs` flags. Preserve each worker's result artifacts,
then compare the merged result root with the original run plan.

## Inspect And Publish Results

| Question | Command |
| --- | --- |
| What happened in one run? | `report` |
| Are the saved files complete and consistent? | `validate-artifacts` |
| Did the evaluator support its judgment? | `eval-quality` |
| Which runs need a person? | `review` |
| What changes across repeated runs? | `compare` |
| Is the aggregate ready to share? | `publish-check` |

### `ruhroh report`

```bash
pnpm exec ruhroh report ./path/to/run-artifacts
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
```

`report` summarizes one result file or run directory. HTML output is a static
evidence viewer containing run metadata, timeline, judge agreement, criteria,
commands, evidence paths, and review signals.

### `ruhroh validate-artifacts`

```bash
pnpm exec ruhroh validate-artifacts ./path/to/run-artifacts --json
```

The command accepts one run or a recursive result root. It checks expected JSON
versions and `$schema` URLs, required implementation and evaluator files, and
cross-artifact consistency such as run id agreement. Missing or malformed
evidence exits nonzero. Older readable evidence without `$schema` produces a
warning.

### `ruhroh eval-quality`

```bash
pnpm exec ruhroh eval-quality ./path/to/results \
  --html ruhroh-eval-quality.html \
  --json
```

The `ruhroh_eval_quality_v1` report checks reviewer evidence, criteria,
commands, summary detail, and judge metadata. Exit `0` is audit-ready, `1` is
invalid input, and `2` means valid runs still have reviewer warnings or human
review requirements.

### `ruhroh review`

```bash
pnpm exec ruhroh review ./path/to/results --json
pnpm exec ruhroh review ./path/to/results --html ruhroh-review.html
```

`review` extracts required and recommended human-review items as
`ruhroh_review_queue_v1` JSON or a static HTML packet.

### `ruhroh compare`

```bash
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
pnpm exec ruhroh compare ./path/to/results \
  --suite ruhroh-productivity \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --require-publishable \
  --json
```

Compare groups repeated runs by scenario and adapter. Text and HTML lead with a
scenario-adapter matrix containing pass rate, run count, confidence interval,
review count, and warning count.

Detailed output includes Wilson intervals, pass@k, failure buckets, cohort
metadata, comparability warnings, evaluator warnings, optional cost/token
summaries, and a cross-run review queue. Multiple adapters add pairwise
pass-rate deltas with approximate 95% intervals and warnings when the interval
includes zero.

`compare --suite <id>` applies suite membership and `methodology.minRuns`.
`suiteAdapterSummaries` report coverage, missing scenarios, total runs, Wilson
intervals, mean scenario pass rate, and minimum-run satisfaction.

`compare --run-plan <path>` checks the aggregate against the intended sample
matrix. Missing samples, results without sample ids, and results outside the
plan become `runPlanWarnings` and block publication.

Add `--rerun-ledger <path>` for allowed infrastructure exclusions. The
`ruhroh_rerun_ledger_v1` contract accepts only known planned samples with
`decision: "exclude"` and `reasonKind: "infrastructure"`; other exclusions
remain warnings.

#### Claim Exports

```bash
pnpm exec ruhroh compare ./path/to/results \
  --suite ruhroh-productivity \
  --benchmark-claim benchmark-claim.json \
  --benchmark-summary benchmark-summary.json
pnpm exec ruhroh validate-claim benchmark-claim.json --json
pnpm exec ruhroh validate-summary benchmark-summary.json --json
```

Compare JSON includes a versioned `benchmarkClaim` containing suite identity,
methodology, adapter summaries, scenario results, pairwise comparisons,
readiness, and run-plan/review evidence. `--benchmark-claim` writes it as a
standalone archive record. `--benchmark-summary` writes the row-oriented
`ruhroh_benchmark_summary_v1` form for downstream tables.

`validate-claim --verify-sources` re-hashes suite manifests, run plans, result
JSON, available run-artifact inventory, and the preserved evaluator calibration
report when present. `--require-publishable` returns exit `2` when the shape is
valid but `claimReadiness` still has blockers. Source drift or invalid input
returns exit `1`.

### `ruhroh publish-check`

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite ruhroh-productivity \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --rerun-ledger ruhroh-rerun-ledger.json \
  --verify-sources
pnpm exec ruhroh publish-check ./path/to/results \
  --suite ruhroh-productivity \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --bundle ruhroh-publication \
  --summary-md "$GITHUB_STEP_SUMMARY"
```

This is the one-command publication workflow. It runs comparison, applies the
publishability gate, re-hashes sources when requested, and can write:

| Option | Output |
| --- | --- |
| `--html <path>` | Static compare report. |
| `--benchmark-claim <path>` | Standalone versioned claim. |
| `--benchmark-summary <path>` | Row-oriented benchmark summary. |
| `--summary-md <path>` | Markdown CI or status report. |
| `--bundle <dir>` | Portable packet with reports, manifest, claim, summary, and `sources/` evidence. |

Bundled source paths are relative so the packet can be copied or archived.
Exit `0` means publishable, `1` means invalid input, and `2` means valid but
blocked. Use `ruhroh explain <code>` for a stable remediation action.

### `ruhroh validate-bundle`

```bash
pnpm exec ruhroh validate-bundle ruhroh-publication --json
```

This validates the packet inventory, required files, contract versions, claim
and summary consistency, embedded report cross-references, and hashes under
`sources/`. Exit `0` is valid and publishable, `1` is malformed, and `2` is
valid but blocked by its embedded verdict.

### `ruhroh claim-index`

```bash
pnpm exec ruhroh claim-index ruhroh-publication \
  --html ruhroh-claims.html \
  --json > claim-index.json
```

`claim-index` scans one claim, one packet, or a directory of claims and emits
`ruhroh_claim_index_v1`. HTML output shows status, suite, adapters, run counts,
pass rate, evidence coverage, packet links, and blockers. Add
`--require-publishable` to make it a registry gate with the same `0`, `1`, and
`2` exit meanings.

### `ruhroh explain`

```bash
pnpm exec ruhroh explain run_plan_mismatch
```

The command prints the category, severity, action, docs anchor, and example for
a stable `remediation[].code`.

For machine-readable fields, use the
[Result JSON Reference](./result-json-reference.md). For the evidence review
path, use [Evidence Files](./artifacts.md).
