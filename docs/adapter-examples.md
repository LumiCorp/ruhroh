---
id: ruhroh-adapter-examples
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - examples/adapters/codex-cli/README.md
  - examples/adapters/claude-code/README.md
  - examples/adapters/gemini-cli/README.md
  - examples/adapters/aider/README.md
  - examples/adapters/fixture-newsletter/run.sh
---

# Agent Connector Examples

Use `ruhroh examples` to see the packaged tasks, agent connectors, and
reviewer commands:

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh examples --json
```

Ruhroh has two ways to call an agent:

- `custom-shell` is the supported public path for most users. It runs a command
  wrapper with Ruhroh environment variables and reads the wrapper's completion
  line or `RUHROH_RESULT_PATH` result file.
- The TypeScript connector lifecycle is the advanced extension point for native
  integrations. Use it only when a command wrapper cannot preserve the agent
  behavior or metadata you need.

Credential-free examples:

- `examples/adapters/fixture-newsletter/run.sh`
- `examples/evaluators/fixture-newsletter/run.sh`
- `examples/scenarios/simple-newsletter`

Live-agent connector examples:

- `examples/adapters/codex-cli/run.sh`
- `examples/adapters/claude-code/run.sh`
- `examples/adapters/gemini-cli/run.sh`
- `examples/adapters/aider/run.sh`

Each live wrapper uses `custom-shell`. Set the wrapper command, then run
`doctor` before spending time on a live benchmark:

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/examples/adapters/codex-cli/run.sh"
export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line
pnpm exec ruhroh doctor --scenario-dir examples/scenarios --adapter custom-shell
pnpm exec ruhroh run --scenario-dir examples/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

For a project-local wrapper, start from the scaffold:

```bash
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh new-adapter codex-local --template codex-cli
$EDITOR ruhroh/adapters/local-agent/run.sh
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
```

Use `--template generic` for a safe fail-fast skeleton, or choose `codex-cli`,
`claude-code`, `gemini-cli`, `aider`, or `fixture` to copy one of the
maintained example wrappers into your project. The generic scaffold is
intentionally not a passing benchmark connector. It writes the expected result
shape and fails fast until the placeholder command is replaced with a real
agent invocation.
