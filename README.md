<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-logo-dark.png">
    <img src="https://lumicorp.github.io/ruhroh/ruhroh-logo.png" alt="Ruhroh logo" width="220">
  </picture>
</p>

# <picture><source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-badge-dark.png"><img src="https://lumicorp.github.io/ruhroh/ruhroh-badge.png" alt="" width="28" align="absmiddle"></picture> Ruhroh

Ruhroh turns realistic user requests into repeatable tests for coding agents.
It asks an agent to do a task, saves what happened, reviews the finished work,
and produces reports that explain whether the result is trustworthy.

Ruhroh exists because most agent benchmarks are either too static or too easy to
overfit. Real users do not ask for a required filename or a magic route; they ask
for an outcome, watch the agent iterate, and care whether the finished project
actually works. Ruhroh packages that loop into repeatable checks while keeping
the task independent of any one agent product.

Use Ruhroh when you want to:

- turn product-like user requests into repeatable agent tasks;
- compare agents or prompts on delivered outcomes, not source-text heuristics;
- preserve transcripts, intermediate attempts, finished projects, and review
  results;
- publish benchmark results with enough evidence for another person to audit.

Ruhroh is not a new coding agent. You connect the agent you want to test.
Ruhroh supplies the task format, repeat-run workflow, reports, and evidence
checks.

## See The Audit Loop First

Before installing anything, inspect the sample reports:

- [Workflow guide](https://lumicorp.github.io/ruhroh/samples/ruhroh-workflow):
  the path from first local test to a result that is ready to share.
- [Compare report](https://lumicorp.github.io/ruhroh/samples/ruhroh-compare):
  side-by-side agent results, evidence links, review items, and blockers.
- [Publication packet](https://lumicorp.github.io/ruhroh/samples/ruhroh-publication/ruhroh-compare):
  a portable review packet with the evidence needed to check a result later.
- [Claim index](https://lumicorp.github.io/ruhroh/samples/ruhroh-claims):
  a catalog of benchmark results and whether each one is ready to cite.

The sample is intentionally blocked for publication because it has only two
synthetic runs. That is the point: Ruhroh should make unsupported claims obvious
while keeping the underlying evidence easy to inspect.

## Install

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

## Quickstart

Start with the built-in no-credentials example before wiring a live coding
agent. The first milestone is not a published benchmark result; it is proving
that Ruhroh can create a task, run an agent command, review the finished work,
save evidence, and write reports on your machine.

```bash
pnpm exec ruhroh init
pnpm exec ruhroh first-run
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

`first-run` is the read-only onboarding gate. The first call shows what is
missing; after the exports it prints the next stage-specific commands for
`doctor`, `validate`, dry-run, and the full fixture run. The dry-run command is
only a Harbor command preview, so it never counts as a completed loop. When
Harbor is not installed yet, `pnpm exec ruhroh first-run --allow-dry-run --json`
can still exit `0` once the scaffold and exported commands are ready for dry-run
preview. When Harbor is installed, run the full fixture command to preserve a
real `ruhroh-loop-result.json`:

```bash
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

`workflow` keeps showing the next step as your project moves from the built-in
example, to authoring your own tasks, to repeated runs, to a result that is
ready to share. `--html` writes that guide as a shareable report. By default,
Ruhroh reads the example tasks and benchmark suites bundled with the package; use
`--scenario-dir` and `--suite-dir` when you are working in a project-local
`ruhroh/` tree.

See the [local fixture run guide](https://lumicorp.github.io/ruhroh/local-fixture-run)
for the full smoke path, or
[Add Ruhroh to an Existing Project](https://lumicorp.github.io/ruhroh/add-to-existing-project)
for a repo integration walkthrough.

## Author A Benchmark Pack

Once the built-in example works, create the three pieces that define a
benchmark pack: task definitions (`scenarios`), a repeatable benchmark suite (`suite`),
and a reviewer command (`evaluator`) you can defend.

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh new-evaluator deterministic-evaluator --template deterministic
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/deterministic-evaluator/run.sh"
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario csv-cleanup
```

Task prompts should read like realistic user requests. Benchmark suites freeze which
tasks belong in the benchmark and how many runs are needed. Reviewers inspect
the finished project and must cite evidence; fresh reviewer scaffolds return
`review` until you replace the placeholder checks. Add `--require-calibrated`
to `inspect-pack` when CI should fail unless every task has known pass, fail,
and review examples for checking reviewer behavior. `inspect-pack --json` also
emits task, prompt, public file, and private reviewer-file fingerprints for
preflight checks. See
[Write a Task](https://lumicorp.github.io/ruhroh/write-a-scenario),
[Benchmark Suites](https://lumicorp.github.io/ruhroh/benchmark-suites), and
[Write a Reviewer](https://lumicorp.github.io/ruhroh/write-an-evaluator).
When you want a pack to be shared or reviewed before result collection, run the
[shared benchmark suite review](https://lumicorp.github.io/ruhroh/benchmark-pack-registry)
gate so task versions, benchmark-suite locks, reviewer checks, and content
fingerprints are visible in one report.

## Connect An Agent

Ruhroh is agent-neutral. Use the maintained command-wrapper templates as
starting points, then run `doctor` before collecting samples.

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh init --adapter codex-cli
pnpm exec ruhroh new-adapter codex-local --template codex-cli
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/codex-local/run.sh
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario csv-cleanup --adapter ./ruhroh/adapters/codex-local/run.sh --dry-run
```

Connector templates include `generic`, `codex-cli`, `claude-code`, `gemini-cli`,
`aider`, and `fixture`. `init --adapter <template>` puts one selected wrapper
directly in the starter alongside the no-credentials example; `new-adapter`
adds one later. The `examples` catalog also shows reviewer templates (`review`,
`deterministic`, `model`, and `hybrid`) with scaffold and calibration commands,
because credible scores depend on outcome judgment as much as agent wiring. The
generic template fails fast until edited; live CLI templates still need the
matching CLI installed and authenticated.

## Compare Repeated Runs

Use a run plan when collecting repeated samples. The plan records which tasks,
agents, samples, and seeds you intended to run, so later reports can spot
missing or mismatched results.

```bash
pnpm exec ruhroh plan --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 10
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 10
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 20 --shard 1/4
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

After a run, inspect one saved result directory with `ruhroh report`,
`ruhroh validate-artifacts`, `ruhroh eval-quality --html`, and `ruhroh review`.
`compare` then aggregates repeated runs into pass rates, confidence intervals,
pass@k, cost/token metadata when available, reviewer warnings, human-review
queues, and blockers. `compare --html` adds a shareable matrix, failure review,
cost/efficiency view, and evidence links so reviewers can move from aggregate
scores to saved evidence.
Use `--shard <index>/<total>` to split expensive repeated cohorts across
workers while keeping sample ids tied to the full requested `--runs` count.

## Publish A Claim

Use `publish-check` when you want the one answer that matters before citing a
score: is this benchmark result ready to publish, and can the evidence be
independently inspected?

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite local-data \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --bundle ruhroh-publication \
  --verify-sources
pnpm exec ruhroh validate-bundle ruhroh-publication --json
pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html
```

The publication packet contains the claim, summary, compare report, review
queue, reviewer-evidence report, inventory, README, and copied `sources/`
evidence referenced by the claim. A valid packet can still return exit code `2`
when the evidence is structurally sound but not yet publishable, for example
because the sample count is too low or human review is still required. See
[Publish Claims](https://lumicorp.github.io/ruhroh/publish-claims) and the
[Report Gallery](https://lumicorp.github.io/ruhroh/report-gallery).

## Local Development

```bash
pnpm build
node dist/cli.js list --scenario-dir examples/scenarios
node dist/cli.js generate --scenario-dir examples/scenarios --scenario simple-newsletter
```

Generated Harbor task directories are written under
`.generated/ruhroh/harbor/tasks/<scenario-id>/`.

## Core Model

The recurring nouns are deliberately few:

- `scenario`: the user-like task, assets, runtime requirements, and evaluator
  rubric;
- `suite`: a version-locked set of scenarios and methodology for repeated
  comparison;
- `adapter`: the bridge from Ruhroh to the coding agent you want to test;
- `evaluator`: the terminal reviewer that inspects the final workspace and
  evidence;
- `run plan`: the intended scenario, adapter, sample, and seed matrix;
- `claim`: the aggregate result plus source evidence that can be reviewed,
  validated, and published.

See [Core Concepts](https://lumicorp.github.io/ruhroh/concepts) for the
lifecycle and [Scenario Format](https://lumicorp.github.io/ruhroh/scenario-format)
for the full schema set shipped with the package.

## How Judging Works

Ruhroh intentionally keeps generated Harbor verifiers app-agnostic. The verifier
checks the structured Ruhroh result and reward mapping; it does not inspect
source text, required filenames, routes, or hard-coded commands.

The evaluation boundary is:

1. the connected coding agent works in a benchmark project;
2. Ruhroh preserves iteration records, transcripts, event logs, and the final
   project snapshot;
3. a reviewer command checks the finished project and the agent journey;
4. the generic Harbor verifier maps the structured result to reward.

This separation is the point: task-specific judgment belongs in the review
rules and reviewer command, not in brittle generator logic. Reviewers can also
emit `judgeVotes` when multiple model, command, or human-assisted judges review
the same project; Ruhroh computes `judgeAgreement` and flags disagreement for
review before benchmark claims.

Core evidence files include:

- `ruhroh-loop-result.json`
- `ruhroh-run-manifest.json`
- `ruhroh-loop-iterations.jsonl`
- `ruhroh-loop-journey.json`
- `ruhroh-loop-eval-input.json`
- `ruhroh-loop-eval.json`
- `ruhroh-workspace.tar.gz`

See the [evidence files guide](https://lumicorp.github.io/ruhroh/artifacts) for the
complete evidence-file list and the
[result JSON reference](https://lumicorp.github.io/ruhroh/result-json-reference)
for machine-readable report, compare, manifest, eval, and run-plan fields.

## Use It Well

- Start with smoke-tier tasks that are small but realistic.
- Keep tasks agent-agnostic; select agent connectors at run time.
- Prefer outcome rubrics over file-name or source-text checks.
- Treat prompts and assets as untrusted input, and run agents only in benchmark
  workspaces.
- Keep live model credentials out of default CI.
- Review saved evidence when a score looks surprising; the journey often
  explains whether the failure is an agent issue, connector issue, or reviewer
  issue.

## Public API

The high-level API entry points are:

- `inspectRuhrohBenchmarkPack()`
- `buildRuhrohRunResultsReport()`
- `buildRuhrohPublishCheckReport()`
- `validateRuhrohPublishBundle()`
- `verifyRuhrohBenchmarkClaimSources()`
- `validateRuhrohRerunLedger()`
- `loadRuhrohRerunLedger()`

Use it for registry preflight, docs generation, and CI integrations that need a
structured task/benchmark-suite catalog, saved-result report, or read-only publication
evidence check without parsing terminal output. These APIs do not replace
`publish-check`, which remains the workflow that creates publication packets
from actual run evidence and claims.

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
- `inspectRuhrohBenchmarkPack()`
- `discoverRuhrohRunResultPaths()`
- `loadRuhrohRunResultArtifacts()`
- `loadRuhrohRunResults()`
- `buildRuhrohRunResultsReport()`
- `buildRuhrohPublishCheckReport()`
- `validateRuhrohPublishBundle()`
- `verifyRuhrohBenchmarkClaimSources()`
- `validateRuhrohRerunLedger()`
- `loadRuhrohRerunLedger()`
- `normalizeRuhrohEvalResult()`
- `summarizeRuhrohRun()`
- `summarizeRuhrohReviewQueue()`
- `aggregateRuhrohRuns()`
- `summarizeRuhrohBenchmarkClaim()`
- `generateHarborTask()`
- `generateHarborDataset()`

It also exports TypeScript contracts for tasks, agent connectors, results,
verdict mapping, env forwarding/redaction, and Harbor command construction.

Kestrel is one consumer connector, not a Ruhroh package dependency. Harbor is
the lower-level runner Ruhroh uses for full benchmark runs.

## Docs

- Getting started: <https://lumicorp.github.io/ruhroh/getting-started>
- Core concepts: <https://lumicorp.github.io/ruhroh/concepts>
- Local fixture run: <https://lumicorp.github.io/ruhroh/local-fixture-run>
- Publish a benchmark result: <https://lumicorp.github.io/ruhroh/benchmark-pack-tutorial>
- Troubleshooting: <https://lumicorp.github.io/ruhroh/troubleshooting>
- FAQ: <https://lumicorp.github.io/ruhroh/faq>
- Write a task: <https://lumicorp.github.io/ruhroh/write-a-scenario>
- Connect an agent: <https://lumicorp.github.io/ruhroh/write-an-adapter>
- Write a reviewer: <https://lumicorp.github.io/ruhroh/write-an-evaluator>
- Reviewer recipes: <https://lumicorp.github.io/ruhroh/evaluator-cookbook>
- Architecture: <https://lumicorp.github.io/ruhroh/architecture>
- Task file format: <https://lumicorp.github.io/ruhroh/scenario-format>
- Task versioning: <https://lumicorp.github.io/ruhroh/scenario-evolution>
- Benchmark suites: <https://lumicorp.github.io/ruhroh/benchmark-suites>
- Benchmark methodology: <https://lumicorp.github.io/ruhroh/benchmark-methodology>
- Review a shared benchmark suite: <https://lumicorp.github.io/ruhroh/benchmark-pack-registry>
- Publish claims: <https://lumicorp.github.io/ruhroh/publish-claims>
- Claim registry: <https://lumicorp.github.io/ruhroh/claim-registry>
- Report gallery: <https://lumicorp.github.io/ruhroh/report-gallery>
- CLI reference: <https://lumicorp.github.io/ruhroh/cli-reference>
- Programmatic API: <https://lumicorp.github.io/ruhroh/programmatic-api>
- Result JSON reference: <https://lumicorp.github.io/ruhroh/result-json-reference>
- Contract evolution: <https://lumicorp.github.io/ruhroh/contract-evolution>
- Agent command protocol: <https://lumicorp.github.io/ruhroh/adapter-protocol>
- Run a shell agent: <https://lumicorp.github.io/ruhroh/custom-shell>
- Harbor: <https://lumicorp.github.io/ruhroh/harbor>
- Reviewer command: <https://lumicorp.github.io/ruhroh/eval-agent>
- Evidence files: <https://lumicorp.github.io/ruhroh/artifacts>
- CI: <https://lumicorp.github.io/ruhroh/ci>
- Security: <https://lumicorp.github.io/ruhroh/security>
- Limitations: <https://lumicorp.github.io/ruhroh/limitations>
- Public repo layout: <https://lumicorp.github.io/ruhroh/public-repo-layout>

## Security

Task prompts and assets are untrusted input. Agents should mutate only
benchmark workspaces. Reviewer inspection should happen against a copied
workspace. Secrets must pass through allowlisted environment variables, and
dry-run output must never print secret values. Generated Harbor verifiers do
not perform app-goal checks. Command-backed agent and reviewer commands run without
a shell by default; use the `*_COMMAND_SHELL=1` opt-in only for trusted wrappers
that require shell expansion.
