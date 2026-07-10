# Aider Adapter Example

This example runs Aider through Ruhroh's `custom-shell` adapter. Ruhroh core
stays agent-agnostic; the wrapper translates the generic Ruhroh environment
into a non-interactive `aider --message-file` invocation and emits the
custom-shell completion line.

## Install

Install Aider and verify the local binary:

```bash
aider --help
```

If your binary is not named `aider`, set:

```bash
export AIDER_BIN=/path/to/aider
```

## Required Env Vars

- Aider model/provider authentication required by your installation.
- `RUHROH_RUN_AGENT_COMMAND=examples/adapters/aider/run.sh`
- `RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line`
- Optional: `AIDER_MODEL` or `RUHROH_AGENT_MODEL` to pass `--model <model>` to
  Aider.
- Optional: `RUHROH_AGENT_PROVIDER`, `RUHROH_AGENT_MODEL_CANONICAL_ID`,
  `RUHROH_AGENT_PROTOCOL`, `RUHROH_AGENT_MODEL_VERSION`, and
  `RUHROH_AGENT_PROMPT_VERSION` to record the benchmark target metadata
  reported by the wrapper.
- Optional: `AIDER_BIN`, `AIDER_EXTRA_ARGS`, and `AIDER_ADAPTER_VERSION`.

By default the wrapper runs:

```text
aider --yes-always --no-auto-commits --no-git --message-file <prompt>
```

Use a benchmark container or other external sandbox for live runs. Do not pass
Aider options that can mutate files outside the benchmark workspace.

## Run

Dry-run without credentials:

```bash
node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell --dry-run
```

Live run when Aider is installed and authenticated:

```bash
RUHROH_RUN_AGENT_COMMAND=examples/adapters/aider/run.sh \
RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line \
  node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell
```

## Continuity

Expected continuity level: `workspace_only`.

Aider receives the full Ruhroh continuation message each turn and runs inside
the same generated benchmark workspace. The wrapper stores prompts and
transcripts under `.ruhroh/` inside that workspace.

## Known Limitations

- This is a custom-shell wrapper, not a native Aider session adapter.
- It uses the locally installed `aider` interface; check `aider --help` after
  upgrading Aider.
- Default CI should use dry-run and protocol tests only; live Aider runs require
  local model/provider configuration.
- The wrapper emits `goal_satisfied` when Aider exits successfully. Terminal
  eval-agent review remains the actual benchmark judge.
