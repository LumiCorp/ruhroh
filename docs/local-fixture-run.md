---
id: ruhroh-local-fixture-run
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
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
pnpm exec ruhroh first-run
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh first-run
pnpm exec ruhroh first-run --allow-dry-run --json
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

The first `first-run` call tells you what is still missing. After the exports,
it should only remain blocked if Harbor is not available for the full run.
When you are validating setup on a machine without Harbor, add
`--allow-dry-run` so the command exits `0` once the fixture scaffold and command
exports are ready for dry-run preview.
The dry-run command is a command preview only: it does not write Harbor task
directories, write a run plan, start Harbor, or call an agent.
`ruhroh workflow` uses preserved `ruhroh-loop-result.json` files as the proof
that the first local loop actually completed, so the workflow guide stays on
the first fixture stage until a real run artifact exists.

With Harbor installed, run the same fixture without `--dry-run`:

```bash
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell
pnpm exec ruhroh workflow .generated/ruhroh --html ruhroh-workflow.html
pnpm exec ruhroh validate-artifacts .generated/ruhroh
pnpm exec ruhroh compare .generated/ruhroh
```

Use the result path printed by Harbor or discovered by `workflow` when you want
the single-run report:

```bash
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
```

At that point you have completed the first proof loop: the fixture adapter
delivered a workspace, the evaluator judged the copied final workspace, and
Ruhroh preserved the manifest, journey, transcripts, eval input/output, result
JSON, workspace summary, and workspace archive for inspection.

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
node dist/cli.js workflow ./path/to/results --html ruhroh-workflow.html
node dist/cli.js compare ./path/to/results
```

The fixture adapter writes `index.html` with three newsletter stories and emits
the `goal_satisfied` completion signal. The fixture evaluator checks the copied
eval workspace and emits a normal `ruhroh_eval_result_v1` with evidence,
criteria results, subscores, and a fixture judge record.

These examples are intentionally narrow. They prove the benchmark plumbing, not
agent quality.
