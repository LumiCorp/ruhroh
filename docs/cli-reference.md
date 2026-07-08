---
id: ruhroh-cli-reference
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
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
next command to run. Its `nextCommands` list is staged: before `init` it only
shows scaffold setup and a re-check; after scaffold setup it shows the missing
exports; once the fixture is ready it shows `doctor`, `validate`, dry-run, and
the full fixture run. JSON output is versioned as
`ruhroh_first_run_check_v1` and includes a top-level `nextAction` object for
setup scripts. It also reports `dryRunReady` separately from `fullRunReady`:
when the local fixture files and env are valid but Harbor is missing, Ruhroh can
still point you at the credential-free dry-run while making the full-run blocker
explicit. Add `--allow-dry-run` when a setup script should exit `0` after
proving the local fixture scaffold, adapter command, and evaluator command are
ready for dry-run preview; the report still returns `ready: false` until the
full Harbor-backed fixture run is available.

## `ruhroh workflow [results]`

Show the guided path from first local success to audit-ready publication.

```bash
pnpm exec ruhroh workflow
pnpm exec ruhroh workflow ./results --json
pnpm exec ruhroh workflow ./results --html ruhroh-workflow.html
```

`workflow` is read-only. It inspects the local fixture scaffold, scenario and
suite authoring roots, evaluator wiring and calibration anchors, strict
benchmark-pack preflight, run-plan presence, discovered
`ruhroh-loop-result.json` artifacts, and publication claim or bundle outputs.
It prints the current stage plus the concrete commands for the next step: first
fixture loop, scenario/suite authoring, evaluator quality, calibrated and
risk-reviewed pack preflight, planned repeated runs, artifact-backed
comparison, and `publish-check`.
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

The generated `run.sh` reads the eval-agent environment, writes
`ruhroh_eval_result_v1` JSON to `RUHROH_EVAL_OUTPUT_PATH`, and returns
`status: "review"` until you replace the placeholder checks with
scenario-specific outcome verification. This keeps fresh evaluator scaffolds
from creating fake passing benchmark runs. The generated README shows the
matching `RUHROH_EVAL_COMMAND`, `doctor`, and validation checks.
Templates are `review`, `deterministic`, `model`, and `hybrid`; see the
[Evaluator Cookbook](./evaluator-cookbook.md).

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

`inspect-pack` is the authoring and registry preflight for a local benchmark
pack. It returns `ruhroh_benchmark_pack_inspection_v1` JSON with scenario and
suite catalogs, validation blockers, advisory warnings, evaluator lint details,
calibration coverage, difficulty distribution, contamination/reward-hacking
risk-review status, expected runtime totals/ranges, suite collection estimates
based on `minRuns`, and deterministic content fingerprints for scenario
manifests, prompt files, declared public assets, and private evaluator assets.
The text output summarizes calibration warnings, risk-review warnings,
difficulty mix, expected runtime, and how many scenario manifests, prompts,
public asset entries, and private asset entries were fingerprinted; `--json` includes the
per-scenario hash details, and `--html <path>` writes a static reviewer report
with readiness metrics, scenario and suite rows, calibration state, difficulty
mix, expected runtime, risk-review status, and content fingerprint links.
Exit code `0` means the pack has no validation blockers. Exit code `1` means at
least one scenario or suite blocker must be fixed before using the pack for
registry ingestion or later publication.
Warnings do not fail the command by default, but calibration and risk-review
warnings should be resolved before collecting publishable runs. Add
`--require-calibrated` in CI or registry preflight when every scenario must have
calibration coverage with no missing expected-status anchors. Add
`--require-risk-reviewed` when missing or placeholder contamination and
reward-hacking review text should fail the pack gate. Those warnings then become
readiness blockers and exit code `1`. The bundled scenarios are expected to pass
both strict gates.

## Doctor

```bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke --adapter ./adapters/my-agent.sh --json
```

`doctor` checks package layout, required installed package assets, Python
runtime importability, scenario validation, suite manifest/version-lock
validation when a suite tree is provided, Harbor executable availability,
adapter command wiring, evaluator configuration, and command-backed adapter/eval
safety. The `adapter-metadata` check inspects readable command wrappers for the
`RUHROH_RESULT_PATH` result-file contract and warns when only final-line
completion metadata is likely to be captured. Passing adapters should write
`ruhroh_run_agent_result_v1` with adapter version, model identity, usage when
available, and transcript or prompt artifacts so comparison reports can explain
what actually ran. The `command-safety` check warns when shell execution is explicitly
enabled or when a no-shell command string contains shell operators that will be
passed literally. The package-asset check verifies the CLI, Python runtime,
schemas, bundled scenarios, benchmark suites, fixture adapter/evaluator, and
core docs are present in the installed package.
When you point `doctor` at local scenarios without a local `--suite-dir`, it
warns that local suite validation was skipped instead of validating bundled
suite manifests against your local scenario tree.

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
- `--adapter <id-or-command>` selects a run-agent adapter. Repeat the option to
  run the same scenario selection across multiple adapters.
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

## Report And Compare

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
pnpm exec ruhroh validate-artifacts ./path/to/run-artifacts --json
pnpm exec ruhroh eval-quality ./path/to/results --html ruhroh-eval-quality.html --json
pnpm exec ruhroh review ./path/to/results --json
pnpm exec ruhroh review ./path/to/results --html ruhroh-review.html
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --run-plan .generated/ruhroh/ruhroh-run-plan.json --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --require-publishable --json
pnpm exec ruhroh publish-check ./path/to/results --suite ruhroh-productivity --run-plan .generated/ruhroh/ruhroh-run-plan.json --rerun-ledger ruhroh-rerun-ledger.json --verify-sources
pnpm exec ruhroh publish-check ./path/to/results --suite ruhroh-productivity --run-plan .generated/ruhroh/ruhroh-run-plan.json --bundle ruhroh-publication --summary-md "$GITHUB_STEP_SUMMARY"
pnpm exec ruhroh validate-bundle ruhroh-publication --json
pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json
pnpm exec ruhroh explain run_plan_mismatch
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --benchmark-claim benchmark-claim.json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --benchmark-summary benchmark-summary.json
pnpm exec ruhroh validate-summary benchmark-summary.json --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

`publish-check` is the one-command publication workflow. It runs the compare
pipeline, writes any requested `--html`, `--benchmark-claim`, and
`--benchmark-summary` outputs, writes a Markdown CI/status report with
`--summary-md <path>`, writes a self-contained publication packet with
`--bundle <dir>`, applies the publishability gate, and optionally re-hashes
referenced source files with `--verify-sources`. Bundles include a `sources/`
payload with the hashed suite, run-plan, rerun-ledger, result, and run-artifact
evidence referenced by the bundled claim; bundled source paths are relative to
the bundle so the packet can be copied or archived. It exits `0` when a claim is
publishable, `1` when inputs are invalid, and `2` when the result is valid but
blocked from publication. Use `ruhroh explain <code>` on any
`remediation[].code` to get the stable action, category, docs anchor, and an
example blocker.

`validate-bundle <dir>` checks a `publish-check --bundle` packet as a unit. It
verifies the manifest, required files, JSON contract versions, claim and summary
validation, and cross-references between the embedded publish-check report and
the standalone claim/summary files. It also re-hashes the bundle-local
`sources/` evidence referenced by `benchmark-claim.json`. It exits `0` when the
packet is valid and publishable, `1` when the packet is malformed, and `2` when
the packet is structurally valid but blocked by the embedded publishability
verdict.

`claim-index <path>` scans one benchmark claim, one publication bundle, or a
directory of exported `benchmark-claim.json` files and emits a local claim
catalog. JSON output is versioned as `ruhroh_claim_index_v1`, includes a root
`$schema` URL, and can be validated with
`schemas/claim-index-v1.schema.json`; `--html` writes a static table with claim
status, suite/version, adapters, run counts, pass rate, evidence coverage,
bundle links, and blockers. Use this as the last local step before handing
claims to a report, dashboard, or external registry. Add `--require-publishable`
to use the index as a registry-readiness gate: exit code `0` means every
discovered claim is valid and publishable, `1` means malformed input or invalid
claims, and `2` means structurally valid claims are still blocked from
publication.

`report` summarizes one run. `validate-artifacts` checks a run artifact
directory, `ruhroh-loop-result.json`, or recursive result root for core JSON
artifacts, expected version fields, matching `$schema` URLs, required
implementation/evaluator files, and basic cross-artifact consistency such as
run id agreement. It exits non-zero when any required artifact is missing or
malformed, and reports warnings for older otherwise-readable artifacts that do
not yet include `$schema`.
`--html` writes a self-contained static artifact
viewer with run metadata, implementation timeline, evaluator judge agreement,
criteria, evidence, commands, artifact paths, and a `reviewQueue` for runs that
need audit. `eval-quality` checks evaluator evidence across one result file,
one run directory, or a recursive result root and emits
`ruhroh_eval_quality_v1` JSON. `--html` writes a static evaluator-quality
report with warning counts, next actions, per-run evidence counts, judge
metadata, and result links. It exits `0` when evaluator judgments are
audit-ready, `1` for invalid input, and `2` when valid runs have evaluator
warnings or human-review requirements. `review` extracts the adjudication queue
from one result file, one run directory, or a recursive result root and emits
`ruhroh_review_queue_v1` JSON or a static HTML adjudication packet. Use it when
the immediate task is to inspect required and recommended human-review items
before publishing. `compare` groups
repeated runs by scenario and adapter, then puts a scenario-by-adapter matrix in
text and HTML reports before the detailed metrics. The matrix cells show pass
rate, run count, confidence interval, review count, and warning count for quick
agent comparison. Detailed compare output reports pass rate, Wilson 95%
confidence intervals, pass@k, failure buckets, cohort metadata, comparability
warnings, eval-quality warnings, optional cost/token summaries, and a cross-run
`reviewQueue`. When a scenario has results for multiple adapters, compare
output includes `pairwiseComparisons` with adapter pass-rate deltas,
approximate 95% confidence intervals for those deltas, conclusions, and
warnings when the interval still includes zero. JSON compare output includes a
versioned `benchmarkClaim` object that packages the suite, methodology,
adapter summaries, scenario results, pairwise comparisons, readiness state, and
run-plan/review evidence into a compact archive/export record. Add
`--benchmark-claim <path>` to write that same object as a standalone JSON
artifact for publication pipelines. Add `--benchmark-summary <path>` to write a
row-oriented `ruhroh_benchmark_summary_v1` artifact derived from the same claim
for downstream reports or lightweight leaderboards. Validate the export shapes
with `schemas/benchmark-claim-v1.schema.json` and
`schemas/benchmark-summary-v1.schema.json`, and run
`ruhroh validate-claim benchmark-claim.json --json` for Ruhroh's structural and
consistency checks. Run `ruhroh validate-summary benchmark-summary.json --json`
to check standalone summary rows against top-level counts and readiness fields.
Add `--verify-sources` to `validate-claim` when checking archived claims; it
re-hashes referenced suite manifests, run plans, result JSON files, and
available run-artifact inventory files. Claims produced by `publish-check`
also hash the preserved evaluator calibration report when
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
exists. Add `--require-publishable` to make
validation of an archived claim return exit code 2 when readiness blockers
remain; compare output also includes
`claimReadiness`, a
publishability summary with `scope`, `publishable`, `blockers`, and
`advisories`; use it before turning aggregate numbers into benchmark claims.
Eval-quality warnings, such as missing evidence, missing criteria results, or
missing judge metadata, are blockers for publishable claims until reviewed or
fixed.
Add `--require-publishable` to make `compare` return exit code 2 after writing
the report when `claimReadiness.publishable` is false.
`compare --run-plan <path>` checks the result set against the intended sample
matrix and reports `runPlanWarnings` for missing planned samples, results
without sample ids, or sample ids that were not in the plan. Those warnings are
claim-readiness blockers.
Add `--rerun-ledger <path>` with `--run-plan` to account for planned samples
excluded because of infrastructure failures. The ledger must be versioned
`ruhroh_rerun_ledger_v1`; entries with `decision: "exclude"` and
`reasonKind: "infrastructure"` suppress the missing-sample warning for that
planned sample and are preserved in compare JSON as `rerunLedger`. Ledger
entries for operator errors, invalid artifacts, or unknown sample ids remain
warnings so exclusions cannot silently alter the benchmark cohort. The npm
package ships `schemas/rerun-ledger-v1.schema.json` for CI-side validation.
`compare --suite <id>` filters to suite scenarios, includes suite metadata in
JSON output, applies the suite `methodology.minRuns`, and warns when suite
scenarios are missing from the result set. Suite compares also include
`suiteAdapterSummaries`, which roll scenario groups up by adapter with covered
scenario count, missing scenarios, total runs, pass rate with Wilson CI, mean
scenario pass rate, and min-run satisfaction. `compare --html` writes a static
aggregate report with the same statistical, readiness, and review fields.

For machine-readable consumers, use the
[result JSON reference](./result-json-reference.md) as the field-level contract
for `report --json`, `compare --json`, `ruhroh-loop-result.json`, run
manifests, evaluator results, and run plans.
