# Codex CLI Adapter Example

This example runs Codex CLI through Ruhroh's `custom-shell` adapter. Ruhroh
core stays agent-agnostic; the wrapper translates the generic Ruhroh environment
into a `codex exec` invocation and emits the custom-shell completion line.

## Install

Install Codex CLI from the official OpenAI distribution and verify the local
binary:

```bash
codex --help
codex exec --help
```

If your binary is not named `codex`, set:

```bash
export CODEX_CLI_BIN=/path/to/codex
```

## Required Env Vars

- Codex CLI authentication/configuration required by your installation.
- `RUHROH_RUN_AGENT_COMMAND=examples/adapters/codex-cli/run.sh`
- `RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line`
- Optional: `CODEX_MODEL`, `CODEX_PROFILE`, `CODEX_SANDBOX`,
  `CODEX_APPROVAL_POLICY`, `CODEX_CLI_EXTRA_ARGS`, and
  `CODEX_CLI_ADAPTER_VERSION`.

By default the wrapper runs:

```text
codex exec --skip-git-repo-check --sandbox workspace-write --ask-for-approval never
```

Use a benchmark container or other external sandbox for live runs. Do not use
dangerous Codex flags unless the whole benchmark job is already isolated.

## Run

Dry-run without credentials:

```bash
node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell --dry-run
```

Live run when Codex CLI is installed and authenticated:

```bash
RUHROH_RUN_AGENT_COMMAND=examples/adapters/codex-cli/run.sh \
RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line \
  node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell
```

## Continuity

Expected continuity level: `workspace_only`.

Codex receives the full Ruhroh continuation message each turn and runs inside
the same generated benchmark workspace. The wrapper stores prompts,
transcripts, and the final Codex message under `.ruhroh/` inside that
workspace.

## Known Limitations

- This is a custom-shell wrapper, not a native Codex session adapter.
- It uses the locally installed `codex exec` interface; check `codex exec
  --help` after upgrading Codex CLI.
- Default CI should use dry-run and protocol tests only; live Codex runs require
  local authentication.
- The wrapper emits `goal_satisfied` when Codex exits successfully. Terminal
  eval-agent review remains the actual benchmark judge.
