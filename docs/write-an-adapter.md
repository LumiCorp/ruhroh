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

Start from a local scaffold when creating a wrapper:

```bash
pnpm exec ruhroh new-adapter local-agent
$EDITOR ruhroh/adapters/local-agent/run.sh
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter ./ruhroh/adapters/local-agent/run.sh --dry-run
```

The scaffold writes prompt/transcript files and a
`ruhroh_run_agent_result_v1` result file, but exits with `runtime_failure` until
you replace the placeholder block with a real agent invocation. This makes the
generated adapter safe to commit before it is ready for live benchmark runs.

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
- `RUHROH_SAMPLE_ID`
- `RUHROH_SAMPLE_SEED`
- `RUHROH_RUN_INDEX`
- `RUHROH_RUN_COUNT`

The wrapper must exit `0` for a successful turn. If the goal is complete, emit a
final JSON line:

```json
{"status":"goal_satisfied"}
```

If the wrapper does not emit completion, Ruhroh may continue until the iteration
cap. For richer results, write a `ruhroh_run_agent_result_v1` JSON result file
to `RUHROH_RESULT_PATH`.

Use that result file to self-report adapter metadata for credible comparisons:

```json
{
  "version": "ruhroh_run_agent_result_v1",
  "status": "goal_satisfied",
  "adapterVersion": "1.4.0",
  "model": {
    "provider": "example",
    "model": "agent-model",
    "version": "2026-07-07",
    "promptVersion": "adapter-prompt-v3"
  },
  "usage": {
    "costUsd": 0.42,
    "totalTokens": 2000
  }
}
```

Ruhroh writes these fields into `ruhroh-run-manifest.json`; result-file metadata
takes precedence over environment fallback values such as
`RUHROH_AGENT_MODEL`.

Keep wrappers conservative:

- operate only inside `RUHROH_WORKSPACE`;
- store prompts, logs, and transcripts under the run root or workspace;
- avoid printing secrets;
- keep live credentials out of default CI.
- rely on the default no-shell command execution where possible; set
  `RUHROH_RUN_AGENT_COMMAND_SHELL=1` only for trusted wrappers that need shell
  expansion.

Reference wrappers live under `examples/adapters/`:

- `fixture-newsletter`: credential-free smoke adapter for local verification.
- `codex-cli`: custom-shell wrapper for `codex exec`.
- `claude-code`: custom-shell wrapper for `claude --print`.
- `gemini-cli`: custom-shell wrapper for Gemini CLI.
