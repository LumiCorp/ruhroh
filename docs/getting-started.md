---
id: ruhroh-getting-started
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-23
depends_on:
  - README.md
  - package.json
---

# Getting Started

Install Ruhroh in a project where you want to generate and run repeatable agent
tasks:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

`init` creates a local `ruhroh/` directory with a v2 smoke scenario, matching
`ruhroh-smoke` suite, fixture adapter, fixture evaluator, schemas, and starter
README. It is safe to rerun when files are unchanged and refuses to overwrite
local edits.

List the bundled scenarios:

```bash
pnpm exec ruhroh --list
pnpm exec ruhroh --list-suites
```

Validate scenarios before generating tasks:

```bash
pnpm exec ruhroh validate
```

Bundled scenarios and suites are the default. Add `--scenario-dir` or
`--suite-dir` only when you want Ruhroh to read project-local content.

Check local runtime readiness before a live run:

```bash
pnpm exec ruhroh doctor \
  --adapter ./path/to/agent-wrapper.sh
```

`doctor` checks scenario validity, the bundled Python runtime import path,
Harbor availability, and the selected adapter. Add `--json` when wiring this
into CI or setup scripts.

To exercise the full loop without live model credentials, use the fixture
adapter and evaluator created by `init`:

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
```

Add `--suite-dir ruhroh/suites --suite <id>` when your project includes a local
benchmark suite. `doctor` then validates suite membership and scenario-version
locks before you spend time collecting runs.

See [Local Fixture Run](./local-fixture-run.md) for the complete smoke path.
For a public-project walkthrough that installs Ruhroh into an existing repo,
wires a command adapter, and swaps in a local evaluator, see
[Add Ruhroh to an Existing Project](./add-to-existing-project.md).

Create your first local scenario draft:

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario csv-cleanup
```

The scaffold is private by default and includes governance metadata, a rubric,
evidence guidance, and a calibration case so validation works before you start
hardening the task for a suite.

Group local scenarios into a version-locked benchmark suite:

```bash
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
```

`new-suite` reads the scenario metadata, freezes the scenario version locks, and
adds governance prompts for contamination review, reward-hacking review, review
checklists, and deprecation policy that later compare reports use for suite
claims.

Scaffold a local command adapter when you are ready to wire a live agent:

```bash
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
```

The generated adapter fails fast until edited, but already writes the prompt,
transcript, and result-file metadata shape Ruhroh expects from real wrappers.

Generate a Harbor task without running an agent:

```bash
pnpm exec ruhroh --scenario simple-newsletter --generate-only
```

Generate a whole benchmark pack by suite id:

```bash
pnpm exec ruhroh --suite ruhroh-smoke --generate-only
```

The generated task appears under:

```text
.generated/ruhroh/harbor/tasks/simple-newsletter/
```

Preview the Harbor command:

```bash
pnpm exec ruhroh --scenario simple-newsletter --adapter custom-shell --dry-run
```

That dry run should print a `harbor run` command and placeholder secret values
such as `${OPENAI_API_KEY}`. It should not start Harbor or call a live model.

Use `--runs <n>` when you want repeated samples for comparison:

```bash
pnpm exec ruhroh --suite ruhroh-smoke --adapter ./path/to/agent-wrapper.sh --runs 5
```

Each sample receives a stable `RUHROH_SAMPLE_ID` and `RUHROH_SAMPLE_SEED` plus
`RUHROH_RUN_INDEX` and `RUHROH_RUN_COUNT`; the run manifest preserves all four
fields for later audit.

Repeat `--adapter` to run the same selected scenario or suite across multiple
agents:

```bash
pnpm exec ruhroh --suite ruhroh-smoke \
  --adapter ./adapters/codex.sh \
  --adapter ./adapters/claude.sh \
  --runs 5
```

To run a live agent, provide a command-backed adapter:

```bash
pnpm exec ruhroh \
  --scenario simple-newsletter \
  --adapter ./path/to/agent-wrapper.sh
```

Use the artifacts from the Harbor run to review what happened: the final result,
iteration records, transcripts, event logs, eval judgment, and workspace
snapshot.

Turn a run artifact into a reviewable report:

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
```

Compare repeated runs across agents or prompts:

```bash
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --suite-dir ruhroh/suites --suite ruhroh-smoke --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

Compare reports include pass rate, a Wilson 95% confidence interval, pass@k
estimates for repeated runs, mean-score bootstrap intervals, and a low-sample
warning until at least five runs exist for a scenario/adapter group. They also
include cohort metadata and warn when an aggregate group is missing or mixing
scenario versions, agent model
identity, prompt versions, evaluator identity, or environment fingerprints.
Use `compare --suite <id>` when publishing suite numbers so Ruhroh applies the
suite's minimum run count and locked scenario versions.

The recommended workflow is:

1. Author or choose a realistic scenario or suite.
2. Run `ruhroh init` for a local starter when beginning a new benchmark repo.
3. Run `ruhroh validate`.
4. Run `ruhroh doctor` for the local machine and selected adapter.
5. Generate Harbor tasks.
6. Run one or more adapters.
7. Review `ruhroh report` for each run.
8. Use `ruhroh compare` for repeated-run analysis.
