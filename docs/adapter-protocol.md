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
