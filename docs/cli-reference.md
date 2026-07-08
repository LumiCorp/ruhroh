---
id: ruhroh-cli-reference
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-07
depends_on:
  - src/cli.ts
---

# CLI Reference

The Ruhroh CLI is intentionally small. It discovers scenarios and suites,
generates Harbor tasks, checks local readiness, runs adapters through Harbor,
and summarizes preserved artifacts.

## `ruhroh init [dir]`

Scaffold a local benchmark starter under `[dir]/ruhroh` or `./ruhroh` when no
directory is supplied.

```bash
pnpm exec ruhroh init
pnpm exec ruhroh init benchmarks --json
```

The starter includes:

- `ruhroh/scenarios/simple-newsletter`;
- `ruhroh/adapters/fixture-newsletter/run.sh`;
- `ruhroh/evaluators/fixture-newsletter/run.sh`;
- a local README with smoke commands.

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

## `ruhroh new-adapter <id>`

Scaffold an edit-me custom-shell adapter under `ruhroh/adapters/<id>`.

```bash
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh new-adapter local-agent --json
```

The generated `run.sh` writes prompts and transcripts under the workspace,
writes a `ruhroh_run_agent_result_v1` result file, and exits with
`runtime_failure` until you replace the placeholder block with a real agent
invocation. This keeps fresh scaffolds from producing fake passing benchmark
runs. The generated README shows the matching `doctor` and `--dry-run` checks.

## Discovery

```bash
pnpm exec ruhroh --list
pnpm exec ruhroh --list-suites
pnpm exec ruhroh --list-suites --json
```

Use `--scenario-dir` and `--suite-dir` to point at local authoring trees instead
of bundled package content.

## Validation

```bash
pnpm exec ruhroh validate
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --suite ruhroh-smoke --json
```

Validation reports hard errors and warnings. Warnings include network-enabled
scenarios, weak suite sample sizes, and rubric/evidence lint findings.
JSON validation output preserves readable `warnings` and adds
`warningDetails` for evaluator lint findings. Each detail includes a stable
`code`, `category`, `field`, `severity`, and `message` so benchmark packs can
gate or audit rubric quality in CI without parsing prose.

## Doctor

```bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke --adapter ./adapters/my-agent.sh --json
```

`doctor` checks package layout, required installed package assets, Python
runtime importability, scenario validation, suite manifest/version-lock
validation when a suite tree is provided, Harbor executable availability,
adapter command wiring, evaluator configuration, and command-backed adapter/eval
safety. The `command-safety` check warns when shell execution is explicitly
enabled or when a no-shell command string contains shell operators that will be
passed literally. The package-asset check verifies the CLI, Python runtime,
schemas, bundled scenarios, benchmark suites, fixture adapter/evaluator, and
core docs are present in the installed package.
When you point `doctor` at local scenarios without a local `--suite-dir`, it
warns that local suite validation was skipped instead of validating bundled
suite manifests against your local scenario tree.

## Generate And Run

```bash
pnpm exec ruhroh --scenario simple-newsletter --generate-only
pnpm exec ruhroh --suite ruhroh-productivity --adapter ./adapters/my-agent.sh --dry-run
pnpm exec ruhroh --scenario simple-newsletter --adapter ./adapters/my-agent.sh
pnpm exec ruhroh --suite ruhroh-smoke --adapter ./adapters/my-agent.sh --runs 5
pnpm exec ruhroh --suite ruhroh-smoke --adapter ./adapters/codex.sh --adapter ./adapters/claude.sh --runs 5
```

Options:

- `--scenario <id>` selects one scenario.
- `--suite <id>` selects ordered suite membership.
- `--tier <smoke|nightly|release>` selects a scenario tier.
- `--iterations <n>` overrides implementation loop iterations.
- `--runs <n>` repeats each selected scenario. Every sample receives
  `RUHROH_SAMPLE_ID`, `RUHROH_SAMPLE_SEED`, `RUHROH_RUN_INDEX`, and
  `RUHROH_RUN_COUNT`, and those values are preserved in the run manifest.
- `--adapter <id-or-command>` selects a run-agent adapter. Repeat the option to
  run the same scenario selection across multiple adapters.
- `--generated-dir <path>` changes the generated Harbor task root.
- `--harbor-bin <path>` changes the Harbor executable.

For actual runs, Ruhroh writes `.generated/ruhroh/ruhroh-run-plan.json` before
starting Harbor. The plan records the scenario/adapter/sample matrix and
redacted Harbor commands so later result directories can be audited against the
intended benchmark run.

## Report And Compare

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
pnpm exec ruhroh validate-artifacts ./path/to/run-artifacts --json
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --run-plan .generated/ruhroh/ruhroh-run-plan.json --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --require-publishable --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --benchmark-claim benchmark-claim.json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-productivity --benchmark-summary benchmark-summary.json
pnpm exec ruhroh validate-summary benchmark-summary.json --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

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
need audit. `compare` groups
repeated runs by scenario and adapter, then reports pass rate, Wilson 95%
confidence intervals, pass@k, failure buckets, cohort metadata, comparability
warnings, eval-quality warnings, optional cost/token summaries, and a
cross-run `reviewQueue`. When a scenario has results for multiple adapters,
compare output includes `pairwiseComparisons` with adapter pass-rate deltas,
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
available run-artifact inventory files. Add `--require-publishable` to make
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
