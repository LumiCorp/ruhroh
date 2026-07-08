<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-logo-dark.png">
    <img src="https://lumicorp.github.io/ruhroh/ruhroh-logo.png" alt="Ruhroh logo" width="220">
  </picture>
</p>

# <picture><source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-badge-dark.png"><img src="https://lumicorp.github.io/ruhroh/ruhroh-badge.png" alt="" width="28" align="absmiddle"></picture> Ruhroh

Ruhroh turns realistic user requests into repeatable coding-agent benchmarks.
It preserves the full implementation journey, runs agents through clean
adapters, and judges the final delivered workspace through a terminal evaluator.
Harbor compatibility is the execution substrate; the product promise is
outcome-based evaluation for real coding agents.

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
- publish benchmark packs with methodology, artifact evidence, and readiness
  checks reviewers can audit.

Ruhroh is not a native agent runner or a giant general-purpose eval platform.
You bring the run-agent adapter. Ruhroh owns the scenario format, benchmark
suites, generator, CLI, result contracts, artifact preservation, and a
package-owned Python Harbor runtime for command-backed adapters.

## Install

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

## Quickstart: Inspect and Generate Tasks

Ruhroh ships bundled scenarios so you can inspect the package before wiring a
live agent:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --list
pnpm exec ruhroh --list-suites
pnpm exec ruhroh validate --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios
pnpm exec ruhroh doctor --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --adapter ./path/to/agent-wrapper.sh
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --generate-only
```

For a credential-free full-loop smoke path, use the fixture adapter and
evaluator in `examples/`; see the
[local fixture run guide](https://lumicorp.github.io/ruhroh/local-fixture-run).
For a project-local starter with the same fixture pieces plus a local
`ruhroh-smoke` suite, run `pnpm exec ruhroh init`.

Create a validation-ready local scenario draft with governance metadata and
rubric scaffolding:

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario csv-cleanup
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
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

After a run, inspect and aggregate artifacts:

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
pnpm exec ruhroh validate-artifacts ./path/to/run-artifacts --json
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --run-plan .generated/ruhroh/ruhroh-run-plan.json --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-smoke --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-smoke --require-publishable --json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-smoke --benchmark-claim benchmark-claim.json
pnpm exec ruhroh compare ./path/to/results --suite ruhroh-smoke --benchmark-summary benchmark-summary.json
pnpm exec ruhroh validate-summary benchmark-summary.json --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

`validate-artifacts` checks one preserved run directory or a result root before
publication: loop results, run manifests, eval results, workspace summaries,
implementation iteration logs, journey files, eval inputs, schema URLs, and
run-id consistency.

`compare` includes pass rate, Wilson 95% confidence intervals, pass@k estimates,
cohort metadata, low-sample warnings, and comparability warnings when a group is
missing or mixing scenario versions, model identities, prompt versions,
evaluator identity, or environment fingerprints. Compare reports also include
`claimReadiness`, which states whether the aggregate is ready to publish and
lists blockers or advisories. JSON compare output includes `benchmarkClaim`, a
compact versioned export object for archiving or feeding downstream reports with
suite methodology, adapter rollups, scenario results, pairwise deltas, readiness,
and run-plan/artifact-validation/review evidence. Add `--require-publishable` in
CI to return exit code 2 when those blockers make the comparison unpublishable.
`--benchmark-summary <path>` writes a row-oriented JSON summary from the same
claim for lightweight reports or leaderboard ingestion.
Use `ruhroh validate-summary benchmark-summary.json --json` to check that
standalone summary rows still match their top-level counts and readiness fields.
Use
`ruhroh validate-claim benchmark-claim.json --require-publishable --verify-sources --json`
to validate a standalone claim, gate readiness, and re-hash the referenced run
artifacts before publishing it.
Use `compare --run-plan <path>` when you have the generated run plan; it checks
that every planned sample produced exactly the result set being compared.
Use `compare --suite <id>` for suite claims; it filters to suite scenarios,
includes suite metadata, applies the suite minimum run count, and warns when
suite scenarios are missing from the result set.

Use `--runs <n>` to collect repeated samples for each selected scenario:

```bash
pnpm exec ruhroh --suite ruhroh-smoke --adapter ./path/to/agent-wrapper.sh --runs 5
```

Repeat `--adapter` to run the same selected scenarios across multiple agents:

```bash
pnpm exec ruhroh --suite ruhroh-smoke \
  --adapter ./adapters/codex.sh \
  --adapter ./adapters/claude.sh \
  --runs 5
```

Each sample receives `RUHROH_SAMPLE_ID`, `RUHROH_SAMPLE_SEED`,
`RUHROH_RUN_INDEX`, and `RUHROH_RUN_COUNT`. Ruhroh preserves those fields in the
run manifest so artifacts can be traced back to the exact sampling plan.
Actual runs also write `.generated/ruhroh/ruhroh-run-plan.json`, a redacted
matrix of selected scenarios, adapters, sample ids/seeds, and Harbor commands.

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

Example wrappers live under `examples/adapters/` for Codex CLI, Claude Code,
Gemini CLI, and the credential-free fixture adapter.

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
The npm package also ships JSON Schema files for editor and CI shape checks:
`schemas/scenario-v2.schema.json`, `schemas/suite-v1.schema.json`,
`schemas/loop-result-v1.schema.json`, `schemas/eval-result-v1.schema.json`,
`schemas/run-manifest-v1.schema.json`, `schemas/run-plan-v1.schema.json`,
`schemas/benchmark-claim-v1.schema.json`, and
`schemas/benchmark-summary-v1.schema.json`. It also ships
`schemas/workspace-summary-v1.schema.json` for validating the compact final
workspace inventory emitted with run artifacts. New generated artifacts include
a root `$schema` URL pointing at the matching shipped schema.

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
Evaluators can also emit `judgeVotes` when multiple model, command, or
human-assisted judges review the same workspace; Ruhroh computes
`judgeAgreement` and flags disagreement for review before benchmark claims.

Core artifacts include:

- `ruhroh-loop-result.json`
- `ruhroh-run-manifest.json`
- `ruhroh-loop-iterations.jsonl`
- `ruhroh-loop-journey.json`
- `ruhroh-loop-eval-input.json`
- `ruhroh-loop-eval.json`
- `ruhroh-workspace.tar.gz`

See the [artifacts guide](https://lumicorp.github.io/ruhroh/artifacts) for the
complete artifact list and the
[result JSON reference](https://lumicorp.github.io/ruhroh/result-json-reference)
for machine-readable report, compare, manifest, eval, and run-plan fields.

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
- `validateRuhrohScenarioSource()`
- `lintRuhrohScenarioEvaluationDetailed()`
- `discoverRuhrohSuites()`
- `loadRuhrohSuite()`
- `validateRuhrohSuiteSource()`
- `resolveRuhrohBuiltinSuiteDir()`
- `loadBuiltinRuhrohSuites()`
- `getBuiltinRuhrohSuiteById()`
- `getBuiltinRuhrohSuitesByScenarioId()`
- `normalizeRuhrohEvalResult()`
- `summarizeRuhrohRun()`
- `summarizeRuhrohReviewQueue()`
- `aggregateRuhrohRuns()`
- `summarizeRuhrohBenchmarkClaim()`
- `generateHarborTask()`
- `generateHarborDataset()`

It also exports TypeScript contracts for scenarios, adapters, results, verdict
mapping, env forwarding/redaction, and Harbor command construction.

Kestrel is one consumer adapter, not a Ruhroh package dependency. Harbor is the
execution substrate.

## Docs

- Getting started: <https://lumicorp.github.io/ruhroh/getting-started>
- Local fixture run: <https://lumicorp.github.io/ruhroh/local-fixture-run>
- Write a scenario: <https://lumicorp.github.io/ruhroh/write-a-scenario>
- Write an adapter: <https://lumicorp.github.io/ruhroh/write-an-adapter>
- Architecture: <https://lumicorp.github.io/ruhroh/architecture>
- Scenario format: <https://lumicorp.github.io/ruhroh/scenario-format>
- Benchmark suites: <https://lumicorp.github.io/ruhroh/benchmark-suites>
- Benchmark methodology: <https://lumicorp.github.io/ruhroh/benchmark-methodology>
- CLI reference: <https://lumicorp.github.io/ruhroh/cli-reference>
- Result JSON reference: <https://lumicorp.github.io/ruhroh/result-json-reference>
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
not perform app-goal checks. Command-backed adapters and evaluators run without
a shell by default; use the `*_COMMAND_SHELL=1` opt-in only for trusted wrappers
that require shell expansion.
