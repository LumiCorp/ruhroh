---
id: ruhroh-adapter-protocol
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/adapters.ts
  - python/ruhroh/loop_controller.py
---

# Adapter Protocol

Run-agent adapters own agent-specific behavior. Ruhroh core owns orchestration
and result mapping.

The TypeScript adapter contract is exported from `@kestrel-agents/ruhroh`:

- `prepare()`
- `startSession()`
- `runTurn()`
- `detectCompletion()`
- `collectArtifacts()`
- `cleanup()`

Adapters report their continuity level:

- `native_session`
- `workspace_plus_transcript`
- `workspace_only`

For shell-based public agents, use the generic command adapter protocol. The
current command adapter passes:

- `RUHROH_MESSAGE`
- `RUHROH_ITERATION`
- `RUHROH_WORKSPACE`
- `RUHROH_GOAL_PATH`
- `RUHROH_WORKSPACE_PATH`
- `RUHROH_RESULT_PATH`
- `RUHROH_SESSION_HANDLE`
- `RUHROH_SCENARIO_ID`
- `RUHROH_RUN_ROOT`
- `RUHROH_ADAPTER_ID`

Wrappers should emit a final JSON line:

```json
{"status":"goal_satisfied"}
```

Wrappers may also write `RUHROH_RESULT_PATH` with
`version: "ruhroh_run_agent_result_v1"`. The adapter reads that file when
present and maps `goal_satisfied`, `continue`, `cannot_satisfy`,
`policy_blocked`, `runtime_failure`, and `infra_failure` into the generic
completion contract.

The result file may include adapter-specific metadata:

```json
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "runId": "agent-run-123",
  "adapterVersion": "1.4.0",
  "model": {
    "provider": "example",
    "model": "agent-model",
    "version": "2026-07-07",
    "promptVersion": "adapter-prompt-v3"
  },
  "usage": {
    "costUsd": 0.42,
    "inputTokens": 1200,
    "outputTokens": 800,
    "totalTokens": 2000
  },
  "artifacts": {
    "transcript": "/path/to/transcript.log"
  }
}
```

Ruhroh copies `adapterVersion`, `model`, and `usage` from the latest command
result into `ruhroh-run-manifest.json`. These values take precedence over env
fallbacks for the same run.

For reproducible reports, wrappers or launch scripts may set:

- `RUHROH_RUN_AGENT_ADAPTER_VERSION`
- `RUHROH_AGENT_PROVIDER`
- `RUHROH_AGENT_MODEL`
- `RUHROH_AGENT_MODEL_VERSION`
- `RUHROH_AGENT_PROMPT_VERSION`
- `RUHROH_RUN_SEED`
- `RUHROH_RETRY_POLICY`
- `RUHROH_COST_USD`
- `RUHROH_INPUT_TOKENS`
- `RUHROH_OUTPUT_TOKENS`
- `RUHROH_TOTAL_TOKENS`

Ruhroh writes these into `ruhroh-run-manifest.json` when present. Secret values
are not copied into the manifest.
