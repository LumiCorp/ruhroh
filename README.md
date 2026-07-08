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

## See The Audit Loop First

Before installing anything, inspect the generated evidence packet:

- [Workflow guide](https://lumicorp.github.io/ruhroh/samples/ruhroh-workflow.html):
  the staged path from local fixture loop to publication readiness.
- [Compare report](https://lumicorp.github.io/ruhroh/samples/ruhroh-compare.html):
  scenario-by-adapter results, artifact links, review queues, and readiness
  blockers.
- [Publication bundle](https://lumicorp.github.io/ruhroh/samples/ruhroh-publication/manifest.json):
  a relocatable claim packet with copied source evidence and hashes.
- [Claim index](https://lumicorp.github.io/ruhroh/samples/ruhroh-claims.html):
  the registry view over one or more benchmark claims.

The sample is intentionally blocked for publication because it has only two
synthetic runs. That is the point: Ruhroh should make unsupported claims obvious
while keeping every source artifact inspectable.

## Install

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

## Quickstart

Start with the credential-free fixture loop before wiring a live coding agent.
The first milestone is not a published benchmark claim; it is proving that the
scenario, adapter, evaluator, artifact, and report path works locally.

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

`workflow` keeps showing the next stage as your project moves from fixture
smoke, to authoring, to repeated runs, to publication readiness, and `--html`
writes that staged guide as a shareable artifact. By default, Ruhroh reads
bundled scenarios and suites; use `--scenario-dir` and `--suite-dir` when you
are working in a project-local `ruhroh/` tree.

See the [local fixture run guide](https://lumicorp.github.io/ruhroh/local-fixture-run)
for the full smoke path, or
[Add Ruhroh to an Existing Project](https://lumicorp.github.io/ruhroh/add-to-existing-project)
for a repo integration walkthrough.

## Author A Benchmark Pack

Once the fixture path works, create the three pieces that define a benchmark
pack: scenarios, a version-locked suite, and an evaluator you can defend.

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh new-evaluator deterministic-evaluator --template deterministic
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/deterministic-evaluator/run.sh"
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario csv-cleanup
```

Scenario prompts should read like realistic user requests. Suites freeze
scenario versions and methodology. Evaluators inspect the final delivered
workspace and must cite evidence; fresh evaluator scaffolds return `review`
until you replace the placeholder checks. Add `--require-calibrated` to
`inspect-pack` when the pack should fail CI unless every scenario has complete
pass/fail/review calibration coverage. `inspect-pack --json` also emits
scenario, prompt, public asset, and private evaluator asset fingerprints for
registry preflight and contamination review. See
[Write a Scenario](https://lumicorp.github.io/ruhroh/write-a-scenario),
[Benchmark Suites](https://lumicorp.github.io/ruhroh/benchmark-suites), and
[Write an Evaluator](https://lumicorp.github.io/ruhroh/write-an-evaluator).
When you want a pack to be shared or reviewed before result collection, run the
[Benchmark Pack Registry](https://lumicorp.github.io/ruhroh/benchmark-pack-registry)
gate so scenario versions, suite locks, calibration coverage, evaluator
readiness, and content fingerprints are visible in one inspection artifact.

## Wire An Agent

Ruhroh is adapter-neutral. Use the maintained wrapper templates as starting
points, then run `doctor` before collecting samples.

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh init --adapter codex-cli
pnpm exec ruhroh new-adapter codex-local --template codex-cli
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/codex-local/run.sh
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario csv-cleanup --adapter ./ruhroh/adapters/codex-local/run.sh --dry-run
```

Adapter templates include `generic`, `codex-cli`, `claude-code`, `gemini-cli`,
`aider`, and `fixture`. `init --adapter <template>` puts one selected wrapper
directly in the starter alongside the credential-free fixture path;
`new-adapter` adds one later. The `examples` catalog also shows evaluator
templates (`review`, `deterministic`, `model`, and `hybrid`) with scaffold and
calibration commands, because credible scores depend on outcome judgment as
much as agent wiring. The generic template fails fast until edited; live CLI
templates still need the matching CLI installed and authenticated.

## Compare Repeated Runs

Use a run plan when collecting repeated samples. The plan is the reproducibility
contract that later proves which scenario, adapter, and sample matrix was
intended.

```bash
pnpm exec ruhroh plan --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 10
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 10
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 20 --shard 1/4
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

After a run, inspect one preserved artifact directory with `ruhroh report`,
`ruhroh validate-artifacts`, `ruhroh eval-quality --html`, and `ruhroh review`.
`compare` then aggregates repeated runs into pass rates, confidence intervals,
pass@k, cost/token metadata when available, evaluator warnings, human-review
queues, and claim-readiness blockers. `compare --html` adds a shareable matrix,
failure triage, cost/efficiency view, and artifact links so reviewers can move
from aggregate scores to preserved evidence.
Use `--shard <index>/<total>` to split expensive repeated cohorts across
workers while keeping sample ids tied to the full requested `--runs` count.

## Publish A Claim

Use `publish-check` when you want the one answer that matters before citing a
score: is this suite-scoped comparison publishable, and can the evidence be
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

The bundle contains the claim, summary, compare report, review queue,
eval-quality report, manifest, README, and copied `sources/` evidence referenced
by the claim. A valid bundle can still return exit code `2` when the evidence is
structurally sound but not yet publishable, for example because the sample count
is too low or human review is still required. See
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

The high-level API entry points are:

- `inspectRuhrohBenchmarkPack()`
- `buildRuhrohRunResultsReport()`
- `buildRuhrohPublishCheckReport()`
- `validateRuhrohPublishBundle()`
- `verifyRuhrohBenchmarkClaimSources()`
- `validateRuhrohRerunLedger()`
- `loadRuhrohRerunLedger()`

Use it for registry preflight, docs generation, and CI integrations that need a
structured scenario/suite catalog, preserved-result report, or read-only
publication evidence check without parsing terminal output. These APIs do not
replace `publish-check`, which remains the workflow that creates publication
bundles from actual run artifacts and claims.

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

It also exports TypeScript contracts for scenarios, adapters, results, verdict
mapping, env forwarding/redaction, and Harbor command construction.

Kestrel is one consumer adapter, not a Ruhroh package dependency. Harbor is the
execution substrate.

## Docs

- Getting started: <https://lumicorp.github.io/ruhroh/getting-started>
- Core concepts: <https://lumicorp.github.io/ruhroh/concepts>
- Local fixture run: <https://lumicorp.github.io/ruhroh/local-fixture-run>
- Benchmark pack tutorial: <https://lumicorp.github.io/ruhroh/benchmark-pack-tutorial>
- Troubleshooting: <https://lumicorp.github.io/ruhroh/troubleshooting>
- FAQ: <https://lumicorp.github.io/ruhroh/faq>
- Write a scenario: <https://lumicorp.github.io/ruhroh/write-a-scenario>
- Write an adapter: <https://lumicorp.github.io/ruhroh/write-an-adapter>
- Write an evaluator: <https://lumicorp.github.io/ruhroh/write-an-evaluator>
- Evaluator cookbook: <https://lumicorp.github.io/ruhroh/evaluator-cookbook>
- Architecture: <https://lumicorp.github.io/ruhroh/architecture>
- Scenario format: <https://lumicorp.github.io/ruhroh/scenario-format>
- Scenario evolution: <https://lumicorp.github.io/ruhroh/scenario-evolution>
- Benchmark suites: <https://lumicorp.github.io/ruhroh/benchmark-suites>
- Benchmark methodology: <https://lumicorp.github.io/ruhroh/benchmark-methodology>
- Benchmark pack registry: <https://lumicorp.github.io/ruhroh/benchmark-pack-registry>
- Publish claims: <https://lumicorp.github.io/ruhroh/publish-claims>
- Claim registry: <https://lumicorp.github.io/ruhroh/claim-registry>
- Report gallery: <https://lumicorp.github.io/ruhroh/report-gallery>
- CLI reference: <https://lumicorp.github.io/ruhroh/cli-reference>
- Programmatic API: <https://lumicorp.github.io/ruhroh/programmatic-api>
- Result JSON reference: <https://lumicorp.github.io/ruhroh/result-json-reference>
- Contract evolution: <https://lumicorp.github.io/ruhroh/contract-evolution>
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
