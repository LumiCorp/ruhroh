---
id: ruhroh-local-fixture-run
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-07
depends_on:
  - examples/adapters/fixture-newsletter/run.sh
  - examples/evaluators/fixture-newsletter/run.sh
  - docs/custom-shell.md
---

# Local Fixture Run

Use the fixture adapter and evaluator to exercise the full Ruhroh loop without
model credentials. This is a deterministic smoke path for checking installation,
adapter wiring, evaluator wiring, artifacts, reports, and comparison output.

From an installed package, scaffold local fixture files first:

```bash
pnpm exec ruhroh init
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

From this repository without running `init`:

```bash
pnpm build
export RUHROH_RUN_AGENT_COMMAND="$PWD/examples/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/examples/evaluators/fixture-newsletter/run.sh"
node dist/cli.js doctor --scenario-dir scenarios --adapter custom-shell
node dist/cli.js --scenario-dir scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

With Harbor installed, remove `--dry-run` to run the full task:

```bash
node dist/cli.js --scenario-dir scenarios --scenario simple-newsletter --adapter custom-shell
```

After the run, inspect artifacts:

```bash
node dist/cli.js report ./path/to/ruhroh-loop-result.json
node dist/cli.js compare ./path/to/results
```

The fixture adapter writes `index.html` with three newsletter stories and emits
the `goal_satisfied` completion signal. The fixture evaluator checks the copied
eval workspace and emits a normal `ruhroh_eval_result_v1` with evidence,
criteria results, subscores, and a fixture judge record.

These examples are intentionally narrow. They prove the benchmark plumbing, not
agent quality.
