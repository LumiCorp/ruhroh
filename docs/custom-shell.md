---
id: ruhroh-custom-shell
domain: benchmarks
status: active
owner: kestrel-quality
last_verified_at: 2026-06-22
depends_on:
  - python/ruhroh/loop_controller.py
  - ../../examples/adapters/gemini-cli/run.sh
---

# Custom-Shell Adapter

`custom-shell` is the public escape hatch for agents that can run from a shell
and write files in a workspace.

Configure it with the generic command adapter protocol:

```bash
export RUHROH_RUN_AGENT_COMMAND=examples/adapters/gemini-cli/run.sh
export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line
```

The current adapter invokes the command with:

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

The command must exit `0` for a successful turn. To tell Ruhroh the goal is
done, print a final JSON line:

```json
{"status":"goal_satisfied"}
```

If the final JSON line is absent, Ruhroh treats the turn as incomplete and may
continue until the iteration cap.

The example Gemini wrapper also writes the `ruhroh_run_agent_result_v1` result
file at `RUHROH_RESULT_PATH`.
