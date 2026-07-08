---
id: ruhroh-eval-agent
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/results.ts
---

# Eval-Agent

The eval-agent is terminal-only in V1. It runs after the implementation loop,
not after every run-agent turn.

Inputs include:

- original task;
- scenario context and rubric;
- implementation run ids;
- transcripts, event logs, and bridge logs when available;
- copied final workspace;
- implementation stop reason.

The runtime writes these inputs to `ruhroh-loop-eval-input.json` and also
exports path-oriented environment variables for command-backed evaluators:

- `RUHROH_EVAL_INPUT_PATH`
- `RUHROH_EVAL_OUTPUT_PATH`
- `RUHROH_EVAL_WORKSPACE_PATH`
- `RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH`
- `RUHROH_EVAL_JOURNEY_PATH`
- `RUHROH_EVAL_CALIBRATION_CASES_JSON`
- `RUHROH_EVAL_PRIVATE_ASSETS_JSON`

The eval-agent may inspect files, run commands, start the app, and gather
evidence. It must not mutate the original implementation workspace.
When a scenario declares `evaluation.privateAssets`, the eval input also
contains `privateAssets`, an array of evaluator-only paths. Use those files for
held-out expected outputs or private review fixtures; do not expose them in the
public task prompt.
When a scenario declares `evaluation.calibrationCases`, the eval input also
contains `calibrationCases`, an array of expected judgment anchors with
`id`, `inputSummary`, `expectedStatus`, and `rationale`. Use these anchors to
keep model-backed and human-assisted evaluators consistent about what should
pass, fail, or require review for that scenario.

Evaluator launch scripts may set `RUHROH_EVAL_PROVIDER`,
`RUHROH_EVAL_MODEL`, `RUHROH_EVAL_MODEL_VERSION`, and
`RUHROH_EVAL_PROMPT_VERSION`. Ruhroh copies those values into
`ruhroh-run-manifest.json` so model-backed judgments can be traced across runs.
`RUHROH_EVAL_COMMAND` is executed without a shell by default. Use quoted command
arguments when needed, and set `RUHROH_EVAL_COMMAND_SHELL=1` only for trusted
evaluator commands that require shell operators or expansion.
`ruhroh doctor` reports a `command-safety` warning for eval shell opt-ins and
for no-shell eval command strings that contain shell operators.

Expected output is `ruhroh_eval_result_v1` with status `passed`, `failed`,
`review`, or `infra_failed`. Only `passed` maps to a passing Harbor reward.

Minimal legacy-compatible output:

```json
{
  "version": "ruhroh_eval_result_v1",
  "status": "passed",
  "goalMet": true,
  "confidence": "high",
  "reasons": ["The delivered app satisfies the requested workflow."],
  "unmetCriteria": [],
  "evidenceRefs": [],
  "commandsRun": [],
  "artifacts": {},
  "finalSummary": "The final workspace satisfies the user goal."
}
```

Evaluators may add structured evidence and subscores without changing Harbor
reward compatibility:

```json
{
  "version": "ruhroh_eval_result_v1",
  "status": "failed",
  "goalMet": false,
  "confidence": "high",
  "reasons": ["The import workflow works, but export is missing."],
  "unmetCriteria": ["The user cannot download the merged CSV."],
  "evidenceRefs": [
    { "kind": "command", "ref": "npm test", "summary": "One export test failed." }
  ],
  "commandsRun": [
    { "command": "npm test", "exitCode": 1, "summary": "Export test failed." }
  ],
  "artifacts": { "workspacePath": "/installed-agent/ruhroh-loop/eval-workspace" },
  "finalSummary": "Partial implementation; not a passing delivery.",
  "criteriaResults": [
    {
      "id": "export",
      "description": "User can download the merged CSV.",
      "status": "failed",
      "score": 0,
      "evidenceRefs": [
        { "kind": "command", "ref": "npm test", "summary": "Export test failed." }
      ]
    }
  ],
  "subscores": {
    "functionality": 0.5,
    "workflow": 0.75,
    "buildRun": 1,
    "persistence": 0,
    "constraintCompliance": 1,
    "evidenceQuality": 1
  },
  "judge": { "kind": "hybrid", "model": "example-eval-model", "version": "2026-07-07" },
  "judgeVotes": [
    {
      "judge": { "kind": "model", "model": "example-eval-model-a", "version": "2026-07-07" },
      "status": "failed",
      "confidence": "high",
      "rationale": "The app has no export workflow.",
      "evidenceRefs": [
        { "kind": "command", "ref": "npm test", "summary": "Export test failed." }
      ]
    },
    {
      "judge": { "kind": "command", "version": "fixture-v1" },
      "status": "failed",
      "confidence": "high",
      "rationale": "The fixture check did not find exported data.",
      "evidenceRefs": [
        { "kind": "file", "ref": "exports/", "summary": "No exported CSV exists." }
      ]
    }
  ]
}
```

When `judgeVotes` are present, Ruhroh computes `judgeAgreement` during
normalization. Agreement records vote count, per-status counts, whether the
votes are unanimous, the majority status when one exists, and dissenting judge
labels. The top-level `status` is still the only field that maps to Harbor
reward, but disagreement is treated as an audit finding.

## Quality Checks

`ruhroh report` and `ruhroh compare` flag weak evaluator output. These warnings
do not change the binary Harbor reward, but they should be treated as audit
findings before publishing benchmark conclusions.

Ruhroh warns when an eval result:

- has no top-level `evidenceRefs`;
- has no `criteriaResults`;
- has criteria without evidence references;
- reports low confidence or `review`;
- omits judge metadata;
- uses a model-backed judge without model metadata;
- includes fewer than two `judgeVotes`;
- includes disagreeing `judgeVotes`;
- has a top-level status that differs from the judge-vote majority;
- includes judge votes without evidence references;
- includes non-zero command evidence;
- has a terse final summary.

Good evaluators should include enough evidence for another reviewer to
understand why the final workspace passed, failed, or needs review.

Scenario authors should run `ruhroh validate` before publishing a pack. The
validator lints `evaluation.scenarioContext`, `evaluation.calibrationCases`,
`evaluation.goalRubric`, and `evaluation.evidenceGuidance` for weak or generic
rubrics so evaluator quality issues are caught before runs are collected.
In JSON output, evaluator lint findings are also emitted as structured
`warningDetails` with stable codes, categories, field paths, severity, and
messages. Use those details for CI gates and pack review checklists.
After runs are collected, `ruhroh report` and `ruhroh compare` emit a
`reviewQueue` for explicit `review` judgments, evaluator infrastructure
failures, non-passing runs, and eval-quality audit warnings.

Ruhroh normalizes legacy and enriched eval results before deriving the final
verdict. The binary mapping remains unchanged: only top-level
`status: "passed"` yields score `1`; `failed`, `review`, and `infra_failed`
yield score `0`.

Ruhroh core never treats source keywords, required generic filenames, or generic
routes as app success proxies.
