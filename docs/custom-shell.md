---
id: ruhroh-custom-shell
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - python/ruhroh/loop_controller.py
  - ../../examples/adapters/codex-cli/run.sh
  - ../../examples/adapters/claude-code/run.sh
  - ../../examples/adapters/gemini-cli/run.sh
  - ../../examples/adapters/aider/run.sh
---

# Custom-Shell Adapter

`custom-shell` is the public escape hatch for agents that can run from a shell
and write files in a workspace.

Configure it with the generic command adapter protocol:

```bash
export RUHROH_RUN_AGENT_COMMAND=examples/adapters/fixture-newsletter/run.sh
export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line
```

Ruhroh executes `RUHROH_RUN_AGENT_COMMAND` without a shell by default. Command
strings are split with shell-style quoting, then launched directly, so shell
operators such as `;`, `&&`, pipes, redirects, and command substitution are not
interpreted. If a wrapper truly needs shell expansion, set
`RUHROH_RUN_AGENT_COMMAND_SHELL=1` and treat the command as trusted code.
`ruhroh doctor` reports a `command-safety` warning for shell opt-ins and for
no-shell command strings that contain shell operators.

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
- `RUHROH_SAMPLE_ID`
- `RUHROH_SAMPLE_SEED`
- `RUHROH_RUN_INDEX`
- `RUHROH_RUN_COUNT`

The command must exit `0` for a successful turn. To tell Ruhroh the goal is
done, print a final JSON line:

```json
{"status":"goal_satisfied"}
```

If the final JSON line is absent, Ruhroh treats the turn as incomplete and may
continue until the iteration cap.

The example Codex CLI, Claude Code, Gemini, and Aider wrappers also write the
`ruhroh_run_agent_result_v1` result file at `RUHROH_RESULT_PATH`. That file can
include `adapterVersion`, `model`, `usage`, and `artifacts`; Ruhroh copies those
fields into the run manifest so compare reports can group runs by the actual
adapter/model identity.

For repeated comparisons, treat `adapterVersion`, model identity, and transcript
or artifact paths as required evidence. `usage` is optional but recommended
when the agent exposes cost or token data. Run `ruhroh doctor --adapter
custom-shell` before collecting live samples; the `adapter-metadata` check
reports whether the wrapper is ready for repeated comparisons or still too thin
for defensible cohort metadata.

For a credential-free smoke path, pair
`examples/adapters/fixture-newsletter/run.sh` with
`examples/evaluators/fixture-newsletter/run.sh`. The adapter writes a small
newsletter page; the evaluator checks the copied eval workspace and returns a
normal structured judgment.
