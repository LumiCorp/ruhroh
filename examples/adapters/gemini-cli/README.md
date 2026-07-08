# Gemini CLI Adapter Example

This example runs Gemini CLI through Ruhroh's `custom-shell` adapter. Ruhroh
core stays agent-agnostic; the wrapper translates the generic Ruhroh environment
into a Gemini CLI invocation and emits the custom-shell completion line.

## Install

Install Gemini CLI from the official Google source and verify the binary name.
Some ecosystems have had confusing or malicious lookalike packages, so use the
official repository/docs:

- https://github.com/google-gemini/gemini-cli
- https://www.geminicli.com/

Quick install:

```bash
npm install -g @google/gemini-cli
```

Expected local command:

```bash
gemini --help
```

If your binary is not named `gemini`, set:

```bash
export GEMINI_CLI_BIN=/path/to/gemini
```

## Required Env Vars

- Gemini CLI credentials/configuration required by your Gemini installation.
- `RUHROH_RUN_AGENT_COMMAND=examples/adapters/gemini-cli/run.sh`
- `RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line`
- Optional: `GEMINI_MODEL` and `GEMINI_CLI_ADAPTER_VERSION` for run-manifest
  metadata.

## Run

Dry-run without credentials:

```bash
node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell --dry-run
```

Live run when Gemini CLI is installed and authenticated:

```bash
RUHROH_RUN_AGENT_COMMAND=examples/adapters/gemini-cli/run.sh \
RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line \
  node dist/cli.js --scenario simple-newsletter --scenario-dir examples/scenarios --adapter custom-shell
```

## Continuity

Expected continuity level: `workspace_only`.

Gemini receives the full Ruhroh continuation message each turn and runs in the
same generated benchmark workspace. The wrapper stores prompts and transcripts
under `.ruhroh/` inside that workspace.

## Known Limitations

- This is a custom-shell wrapper, not a native Gemini session adapter.
- It assumes Gemini CLI supports `-p <prompt>` in the installed version.
- The default CI path should use dry-run and protocol tests only; live Gemini
  runs require local credentials.
- The wrapper emits `goal_satisfied` when Gemini exits successfully. Terminal
  eval-agent review remains the actual benchmark judge.
