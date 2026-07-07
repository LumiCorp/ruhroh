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

The eval-agent may inspect files, run commands, start the app, and gather
evidence. It must not mutate the original implementation workspace.

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
  "judge": { "kind": "hybrid", "model": "example-eval-model", "version": "2026-07-07" }
}
```

Ruhroh normalizes legacy and enriched eval results before deriving the final
verdict. The binary mapping remains unchanged: only top-level
`status: "passed"` yields score `1`; `failed`, `review`, and `infra_failed`
yield score `0`.

Ruhroh core never treats source keywords, required generic filenames, or generic
routes as app success proxies.
