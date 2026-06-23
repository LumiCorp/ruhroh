<p align="center">
  <img src="assets/ruhroh-logo.png" alt="Ruhroh logo" width="220">
</p>

# <img src="assets/ruhroh-badge.png" alt="" width="28" align="absmiddle"> Ruhroh

Ruhroh is the **Real-User Harness for Repair-Oriented Harbor**.

It runs realistic software tasks against coding agents, preserves the full
implementation journey, and judges the final delivered workspace through a
terminal evaluator.

Ruhroh exists because most agent benchmarks are either too static or too easy to
overfit. Real users do not ask for a required filename or a magic route; they ask
for an outcome, watch the agent iterate, and care whether the finished workspace
actually works. Ruhroh packages that loop into repeatable Harbor tasks while
keeping the benchmark itself agent-agnostic.

Use Ruhroh when you want to:

- turn product-like user requests into repeatable agent tasks;
- compare agents or prompts on delivered outcomes, not source-text heuristics;
- preserve transcripts, intermediate attempts, final workspaces, and eval
  judgments for review;
- generate Harbor-compatible task directories from portable JSON scenarios.

Ruhroh is not a native agent runner. You bring the run-agent adapter. The public
package ships the scenario format, generator, CLI, result contracts, and a
package-owned Python Harbor runtime for command-backed adapters.

## Install

```bash
pnpm add -D @kestrel-agents/ruhroh
```

## Quickstart: Inspect and Generate Tasks

Ruhroh ships bundled scenarios so you can inspect the package before wiring a
live agent:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --list
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --generate-only
```

In this repository, build first and use the local CLI output:

```bash
pnpm build
node dist/cli.js --scenario-dir examples/scenarios --list
node dist/cli.js --scenario-dir examples/scenarios --scenario simple-newsletter --generate-only
```

Generated Harbor task directories are written under:

```text
.generated/ruhroh/harbor/tasks/<scenario-id>/
```

Use `--dry-run` to see the Harbor command without starting a benchmark:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

## Run an Agent

Ruhroh selects agents at runtime. For shell-based agents, pass a command path as
the adapter:

```bash
pnpm exec ruhroh \
  --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter ./path/to/agent-wrapper.sh
```

When the adapter value looks like a command or path, the CLI wires it through
`RUHROH_RUN_AGENT_COMMAND` for the package runtime. The command receives the
workspace, goal, iteration metadata, and result path. When the goal is satisfied,
it should exit successfully and emit the completion signal described in
[`docs/custom-shell.md`](docs/custom-shell.md).

Use `custom-shell` directly when you want to provide the command through the
environment:

```bash
export RUHROH_RUN_AGENT_COMMAND=./path/to/agent-wrapper.sh
export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell
```

Live agent runs require whatever credentials that agent needs. Default CI and
package smoke tests should stay credential-free and use `--dry-run` or fixture
evals.

## Write Scenarios

Create scenarios under `ruhroh/scenarios/<id>/`:

```text
ruhroh/scenarios/<id>/
  scenario.json
  instruction.md
  assets/
```

The scenario JSON names the user prompt, runtime requirements, loop settings,
and evaluation rubric. Scenario prompts should read like real user requests:
describe the desired outcome, relevant context, and success criteria. Avoid
encoding implementation shortcuts such as "create exactly this file" unless that
is genuinely part of the user request.

Good scenarios usually include:

- a concrete user goal;
- constraints the agent must respect;
- assets or seed data needed by the task;
- a rubric that tells the evaluator how to judge the final workspace;
- evidence guidance for transcripts, logs, commands, screenshots, or generated
  files.

See the [scenario format guide](https://lumicorp.github.io/ruhroh/scenario-format)
for the full schema.

## How Judging Works

Ruhroh intentionally keeps generated Harbor verifiers app-agnostic. The verifier
checks the structured Ruhroh result and reward mapping; it does not inspect
source text, required filenames, routes, or hard-coded commands.

The evaluation boundary is:

1. the run-agent iterates in a benchmark workspace;
2. Ruhroh preserves iteration records, transcripts, event logs, and the final
   workspace snapshot;
3. a terminal evaluator reviews the final delivered workspace and journey
   evidence;
4. the generic Harbor verifier maps the structured result to reward.

This separation is the point: scenario-specific judgment belongs in the eval
rubric and evaluator, not in brittle generator logic.

Core artifacts include:

- `ruhroh-loop-result.json`
- `ruhroh-loop-iterations.jsonl`
- `ruhroh-loop-journey.json`
- `ruhroh-loop-eval.json`
- `ruhroh-workspace.tar.gz`

See the [artifacts guide](https://lumicorp.github.io/ruhroh/artifacts) for the
complete artifact list.

## Use It Well

- Start with smoke-tier scenarios that are small but realistic.
- Keep scenarios agent-agnostic; select adapters at runtime.
- Prefer outcome rubrics over file-name or source-text checks.
- Treat prompts and assets as untrusted input, and run agents only in benchmark
  workspaces.
- Keep live model credentials out of default CI.
- Review preserved artifacts when a score looks surprising; the journey often
  explains whether the failure is an agent issue, adapter issue, or evaluator
  issue.

## Public API

The public API exports:

- `discoverRuhrohScenarios()`
- `loadRuhrohScenario()`
- `generateHarborTask()`
- `generateHarborDataset()`

It also exports TypeScript contracts for scenarios, adapters, results, verdict
mapping, env forwarding/redaction, and Harbor command construction.

Kestrel is one consumer adapter, not a Ruhroh package dependency. Harbor is the
execution substrate.

## Docs

- Getting started: <https://lumicorp.github.io/ruhroh/getting-started>
- Write a scenario: <https://lumicorp.github.io/ruhroh/write-a-scenario>
- Write an adapter: <https://lumicorp.github.io/ruhroh/write-an-adapter>
- Architecture: <https://lumicorp.github.io/ruhroh/architecture>
- Scenario format: <https://lumicorp.github.io/ruhroh/scenario-format>
- Adapter protocol: <https://lumicorp.github.io/ruhroh/adapter-protocol>
- Custom-shell adapter: <https://lumicorp.github.io/ruhroh/custom-shell>
- Harbor: <https://lumicorp.github.io/ruhroh/harbor>
- Eval-agent: <https://lumicorp.github.io/ruhroh/eval-agent>
- Artifacts: <https://lumicorp.github.io/ruhroh/artifacts>
- CI: <https://lumicorp.github.io/ruhroh/ci>
- Security: <https://lumicorp.github.io/ruhroh/security>
- Limitations: <https://lumicorp.github.io/ruhroh/limitations>
- Public repo layout: <https://lumicorp.github.io/ruhroh/public-repo-layout>

## Security

Scenario prompts and assets are untrusted input. Run-agents should mutate only
benchmark workspaces. Eval-agent inspection should happen against a copied
workspace. Secrets must pass through allowlisted environment variables, and
dry-run output must never print secret values. Generated Harbor verifiers do
not perform app-goal checks.
