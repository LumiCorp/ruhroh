---
id: ruhroh-write-an-evaluator
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/eval-agent.md
  - schemas/eval-result-v1.schema.json
  - src/cli.ts
---

# Write an Evaluator

Evaluators are Ruhroh's trust boundary. They decide whether the final workspace
actually delivers the user outcome, and their evidence becomes part of the
benchmark claim.

Start with a scaffold:

```bash
pnpm exec ruhroh new-evaluator local-evaluator
pnpm exec ruhroh new-evaluator deterministic-evaluator --template deterministic
$EDITOR ruhroh/evaluators/local-evaluator/run.sh
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/local-evaluator/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario simple-newsletter
```

The generated evaluator writes valid `ruhroh_eval_result_v1` JSON, but returns
`status: "review"` until you replace the placeholder checks. That keeps fresh
scaffolds from producing fake passing benchmark runs.
Use `--template deterministic`, `--template model`, or `--template hybrid` when
you already know the evaluator shape. See the
[Evaluator Cookbook](./evaluator-cookbook.md).

## Inputs

Command-backed evaluators receive:

- `RUHROH_EVAL_INPUT_PATH`: stable JSON input with task, rubric, artifacts, and
  evaluator context;
- `RUHROH_EVAL_OUTPUT_PATH`: required output file for `ruhroh_eval_result_v1`;
- `RUHROH_EVAL_WORKSPACE_PATH`: copied final workspace to inspect;
- `RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH`: original generated workspace;
- `RUHROH_EVAL_JOURNEY_PATH`: implementation journey data;
- `RUHROH_EVAL_CALIBRATION_CASES_JSON`: expected judgment anchors;
- `RUHROH_EVAL_PRIVATE_ASSETS_JSON`: evaluator-only private files.

The evaluator may inspect files, run commands, start a local app, or call a
model judge. It should not mutate the original implementation workspace.

## Output

Write `ruhroh_eval_result_v1` to `RUHROH_EVAL_OUTPUT_PATH`. Publishable results
should include:

- top-level `evidenceRefs`;
- `criteriaResults` with evidence for each major outcome criterion;
- `commandsRun` for tests, smoke checks, browser probes, or app commands;
- `judge` metadata with stable kind/model/version fields;
- a specific `finalSummary` that a reviewer can audit later.

Return `review` when evidence is ambiguous. Only `passed` maps to score `1`.

## Quality Bar

Good evaluators verify delivered behavior, not source text shortcuts. Prefer
checks that would catch a prose-only answer, a hard-coded happy path, missing
workflow behavior, and incomplete persistence or export flows.

Use calibration cases from the scenario to keep deterministic, model-backed,
and human-assisted evaluators aligned. `ruhroh validate --json` includes a
`calibration` summary with expected-status counts and missing anchors, which is
the quick check that an evaluator has pass/fail/review examples to learn from.
`ruhroh calibrate-evaluator` then runs the configured evaluator against those
anchors and fails when the returned `status` does not match `expectedStatus`.
Inspect `.generated/ruhroh/evaluator-calibration/<scenario>/<case>/` when a
case fails; it contains the synthetic workspace, eval input, and evaluator
output for that anchor. The command also writes
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`;
`ruhroh workflow` uses that report to distinguish "calibration cases exist"
from "the evaluator has actually been calibrated."
Use private evaluator assets for held-out expected outputs without leaking them
into the public prompt.

After the evaluator passes calibration and you collect runs, `ruhroh report`,
`ruhroh compare`, and
`ruhroh publish-check` surface weak evaluator evidence as review items or
claim-readiness blockers.
