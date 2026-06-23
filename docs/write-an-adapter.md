---
id: ruhroh-write-an-adapter
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-23
depends_on:
  - docs/custom-shell.md
  - python/ruhroh/loop_controller.py
---

# Write an Adapter

Ruhroh is agent-agnostic. A run-agent adapter is the bridge between Ruhroh's
iteration loop and the coding agent you want to evaluate.

For public usage, the simplest adapter is a shell command:

```bash
pnpm exec ruhroh \
  --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter ./adapters/my-agent.sh
```

When `--adapter` looks like a path or command, Ruhroh sets
`RUHROH_RUN_AGENT_COMMAND` for the package runtime.

Minimal wrapper:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$RUHROH_WORKSPACE"

printf '%s\n' "$RUHROH_MESSAGE" > .ruhroh-current-goal.md

# Replace this with your agent invocation.
# The agent should edit files inside $RUHROH_WORKSPACE.
my-agent --prompt-file .ruhroh-current-goal.md

printf '{"status":"goal_satisfied"}\n'
```

The command receives environment variables including:

- `RUHROH_MESSAGE`
- `RUHROH_ITERATION`
- `RUHROH_WORKSPACE`
- `RUHROH_GOAL_PATH`
- `RUHROH_RESULT_PATH`
- `RUHROH_SCENARIO_ID`
- `RUHROH_RUN_ROOT`

The wrapper must exit `0` for a successful turn. If the goal is complete, emit a
final JSON line:

```json
{"status":"goal_satisfied"}
```

If the wrapper does not emit completion, Ruhroh may continue until the iteration
cap. For richer results, write a `ruhroh_run_agent_result_v1` JSON result file
to `RUHROH_RESULT_PATH`.

Keep wrappers conservative:

- operate only inside `RUHROH_WORKSPACE`;
- store prompts, logs, and transcripts under the run root or workspace;
- avoid printing secrets;
- keep live credentials out of default CI.
