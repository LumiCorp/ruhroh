# Claude Code Adapter Example

This example runs Claude Code through Ruhroh's `custom-shell` adapter. Ruhroh
core stays agent-agnostic; the wrapper translates the generic Ruhroh environment
into a non-interactive `claude --print` invocation and emits the custom-shell
completion line.

## Install

Install Claude Code from Anthropic's official source and verify the local
binary:

```bash
claude --help
```

If your binary is not named `claude`, set:

```bash
export CLAUDE_CODE_BIN=/path/to/claude
```

## Required Env Vars

- Claude Code authentication/configuration required by your installation.
- `RUHROH_RUN_AGENT_COMMAND=examples/adapters/claude-code/run.sh`
- `RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line`
- Optional: `CLAUDE_MODEL` or `RUHROH_AGENT_MODEL` to pass `--model <model>` to
  Claude Code.
- Optional: `RUHROH_AGENT_PROVIDER`, `RUHROH_AGENT_MODEL_CANONICAL_ID`,
  `RUHROH_AGENT_PROTOCOL`, `RUHROH_AGENT_MODEL_VERSION`, and
  `RUHROH_AGENT_PROMPT_VERSION` to record the benchmark target metadata
  reported by the wrapper.
- Optional: `CLAUDE_PERMISSION_MODE`,
  `CLAUDE_OUTPUT_FORMAT`, `CLAUDE_CODE_EXTRA_ARGS`, and
  `CLAUDE_CODE_ADAPTER_VERSION`.

By default the wrapper runs Claude Code in print mode with
`--permission-mode acceptEdits` and adds the Ruhroh workspace as an allowed
directory. Use a benchmark container or other external sandbox for live runs.

## Run

Dry-run without credentials:

```bash
node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell --dry-run
```

Live run when Claude Code is installed and authenticated:

```bash
RUHROH_RUN_AGENT_COMMAND=examples/adapters/claude-code/run.sh \
RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line \
  node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell
```

## Continuity

Expected continuity level: `workspace_only`.

Claude receives the full Ruhroh continuation message each turn and runs inside
the same generated benchmark workspace. The wrapper stores prompts and
transcripts under `.ruhroh/` inside that workspace.

## Known Limitations

- This is a custom-shell wrapper, not a native Claude Code session adapter.
- It uses the locally installed `claude --print` interface; check
  `claude --help` after upgrading Claude Code.
- Default CI should use dry-run and protocol tests only; live Claude runs
  require local authentication.
- The wrapper emits `goal_satisfied` when Claude exits successfully. Terminal
  eval-agent review remains the actual benchmark judge.
