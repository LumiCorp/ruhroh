---
id: ruhroh-write-an-adapter
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/custom-shell.md
  - python/ruhroh/loop_controller.py
---

# Connect an Agent

Ruhroh is agent-agnostic. An agent connector is the command or integration that
lets Ruhroh ask a coding agent to work on a task.

For public usage, start with a command wrapper. It is the supported path for
most benchmark authors because it works with existing CLIs, is easy to inspect,
and preserves the metadata Ruhroh needs for comparison reports.

```bash
pnpm exec ruhroh \
  --scenario simple-newsletter \
  --adapter ./adapters/my-agent.sh
```

List the packaged connector examples before writing your own wrapper:

```bash
pnpm exec ruhroh examples
```

The credential-free fixture proves the loop without live model credentials.
The Codex CLI, Claude Code, Gemini CLI, and Aider examples show the supported
`custom-shell` pattern for real public-agent wrappers. See
[Agent Connector Examples](./adapter-examples.md).

Choose the connector style by integration need:

| Need | Use | Why |
| --- | --- | --- |
| Evaluate a CLI agent or local wrapper | `custom-shell` or `--adapter ./wrapper.sh` | Fastest path; Ruhroh passes environment variables and reads the completion line or result file. |
| Start from a maintained public-agent example | `new-adapter --template codex-cli`, `claude-code`, `gemini-cli`, or `aider` | Copies a wrapper that already writes prompt, transcript, model, usage, and result metadata where the agent exposes it. |
| Prove the loop without credentials | `new-adapter --template fixture` or the `fixture-newsletter` example | Deterministic smoke path for setup and CI. |
| Build a native integration that cannot be represented as a process wrapper | TypeScript connector protocol | Advanced extension point; use only when a command wrapper cannot preserve session behavior or metadata. |

If you are unsure, choose a script-backed command wrapper. A checked-in wrapper
is easier for reviewers to inspect, easier for `doctor` to analyze, and easier
to reproduce in a publication packet than an inline shell command. Use the
TypeScript connector lifecycle only when the wrapper model loses essential agent
state, session transport, or evidence-collection behavior that affects the
benchmark claim.

Start from a local scaffold when creating a wrapper:

```bash
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh new-adapter codex-local --template codex-cli
$EDITOR ruhroh/adapters/local-agent/run.sh
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter ./ruhroh/adapters/local-agent/run.sh --dry-run
```

Use `--template generic` for a safe fail-fast skeleton, or start from a
maintained wrapper with `--template codex-cli`, `--template claude-code`,
`--template gemini-cli`, `--template aider`, or `--template fixture`. The
generic scaffold writes
prompt/transcript files and a `ruhroh_run_agent_result_v1` result file, but
exits with `runtime_failure` until you replace the placeholder block with a
real agent invocation. Live CLI templates still need the matching agent CLI
installed and authenticated before they can run. Each scaffolded connector README
includes a "Comparison Readiness" checklist; do not collect repeated live-agent
samples until its `adapter-metadata` doctor gate is `ok`.

When `--adapter` looks like a path or command, Ruhroh sets
`RUHROH_RUN_AGENT_COMMAND` for the package runtime. Prefer passing a readable
script path such as `./ruhroh/adapters/local-agent/run.sh` over a long inline
command string. Readable paths let `doctor` check adapter metadata and give
reviewers a stable wrapper surface to inspect alongside the saved evidence.

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

Use that result file to self-report connector metadata for credible comparisons:

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

## Connector Readiness Checklist

Before collecting repeated live-agent samples, make `ruhroh doctor` report the
connector metadata check as ready for repeated comparisons. A wrapper should write
`RUHROH_RESULT_PATH` and include:

- `adapterVersion`, so later reports can distinguish wrapper changes;
- `model.provider`, `model.model`, and, when available, `model.version`;
- `model.promptVersion`, when prompts or system instructions can change;
- `artifacts.transcript` or an equivalent transcript/log path;
- any prompt, last-message, event, or tool-call evidence that helps audit the
  implementation journey.

Usage fields are optional, but add `usage.costUsd`, `usage.inputTokens`,
`usage.outputTokens`, or `usage.totalTokens` when the agent exposes them.
Without usage, Ruhroh can still compare outcome quality, but cost and
tokens-per-pass views will show partial coverage.

`ruhroh doctor` includes an `adapter-metadata` check for readable command
wrappers. It warns when a wrapper does not reference `RUHROH_RESULT_PATH` or
when the result file is missing connector version, model identity, or evidence.
Treat that warning as a preflight signal before collecting repeated live-agent
runs.

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
- `aider`: custom-shell wrapper for Aider non-interactive mode.
