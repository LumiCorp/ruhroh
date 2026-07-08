<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-logo-dark.png">
    <img src="https://lumicorp.github.io/ruhroh/ruhroh-logo.png" alt="Ruhroh logo" width="220">
  </picture>
</p>

# <picture><source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-badge-dark.png"><img src="https://lumicorp.github.io/ruhroh/ruhroh-badge.png" alt="" width="28" align="absmiddle"></picture> Ruhroh

Ruhroh is a benchmark framework for answering one practical question:

**Did the coding agent actually deliver the requested software?**

Many coding-agent benchmarks can tell you that an agent passed. They do not
always show whether the finished project works, what the agent tried, or whether
the score has enough evidence behind it to trust. Ruhroh runs agents on
realistic software tasks, checks the finished project, compares repeated runs,
and keeps the logs, files, reports, and metadata needed to inspect every score.

Use Ruhroh when you want to:

- test agents on tasks that look like real user requests;
- compare agents or prompts by what they deliver, not by shallow source-text
  checks;
- keep the logs, outputs, files, and reports behind each result;
- publish benchmark results that another person can inspect, rerun, and
  challenge.

Ruhroh is not another coding agent. You bring the agent you want to test.
Ruhroh gives you the task format, local scaffolding, result files, reports, and
review checks for turning agent runs into defensible benchmark results.

## How Ruhroh Works

1. Write a realistic task.
2. Run one or more coding agents on it.
3. Check the finished project.
4. Compare the results and keep the evidence.

Under the hood, Ruhroh still supports Harbor-compatible execution, agent
adapters, versioned suites, evaluator calibration, source hashes, and
publication bundles. Those pieces matter when you are ready to automate or cite
scores. The first job is simpler: prove that the agent built the thing and that
the proof is easy to inspect.

## See What a Result Looks Like

Before installing anything, inspect a generated sample result:

- [Workflow guide](https://lumicorp.github.io/ruhroh/samples/ruhroh-workflow.html):
  the path from first local run to a result that is safe to cite.
- [Compare report](https://lumicorp.github.io/ruhroh/samples/ruhroh-compare.html):
  scores, failures, review notes, and links to the files behind each run.
- [Publication bundle](https://lumicorp.github.io/ruhroh/samples/ruhroh-publication/manifest.json):
  a portable result packet with copied source files and hashes.
- [Claim index](https://lumicorp.github.io/ruhroh/samples/ruhroh-claims.html):
  a simple registry view for published benchmark results.

The sample has only two synthetic runs, so Ruhroh marks it as not safe to cite.
That is intentional: weak scores should be easy to spot, and the evidence behind
every score should stay easy to inspect.

## Install

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

## Quickstart

Start with the credential-free fixture run before wiring a live coding agent.
The first goal is small: prove that Ruhroh can run a sample task, check the
finished project, and write a report on your machine.

```bash
pnpm exec ruhroh init
pnpm exec ruhroh first-run
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

`first-run` checks what is ready and tells you the next command to run. The
first call usually asks you to export the sample agent and checker commands.
After that, it shows validation, dry-run, and full-run commands. A dry run only
previews the Harbor command, so it does not count as a completed benchmark run.
When Harbor is installed, run the full fixture command to produce a real
`ruhroh-loop-result.json`:

```bash
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

`workflow` keeps showing the next step as you move from a first local run, to
writing your own tasks, to repeated comparisons, to results that are safe to
cite. `--html` writes the same guide as a shareable report. By default, Ruhroh
reads bundled examples; use `--scenario-dir` and `--suite-dir` when you are
working in a project-local `ruhroh/` tree.

See the [local fixture run guide](https://lumicorp.github.io/ruhroh/local-fixture-run)
for the full smoke path, or
[Add Ruhroh to an Existing Project](https://lumicorp.github.io/ruhroh/add-to-existing-project)
for a repo integration walkthrough.

## Author A Benchmark Pack

Once the fixture path works, create the three pieces that define a benchmark:
the task, the group of tasks you want to compare, and the checker that decides
whether the finished project satisfies the request.

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh new-evaluator deterministic-evaluator --template deterministic
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/deterministic-evaluator/run.sh"
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario csv-cleanup
```

Scenario prompts should read like realistic user requests. Suites freeze task
versions and collection rules. Evaluators are checkers: they inspect the
finished project and cite the evidence they used. New evaluator scaffolds return
`review` until you replace the placeholder checks. Add `--require-calibrated`
to `inspect-pack` when the pack should fail CI unless every task has complete
pass/fail/review calibration coverage. `inspect-pack --json` also emits
fingerprints for the task prompt, public files, and private checker files so
reviewers can see what changed. See
[Write a Scenario](https://lumicorp.github.io/ruhroh/write-a-scenario),
[Benchmark Suites](https://lumicorp.github.io/ruhroh/benchmark-suites), and
[Write an Evaluator](https://lumicorp.github.io/ruhroh/write-an-evaluator).
When you want a pack reviewed before collecting results, run the
[Benchmark Pack Registry](https://lumicorp.github.io/ruhroh/benchmark-pack-registry)
gate so task versions, suite locks, checker readiness, and content fingerprints
are visible in one inspection file.

## Wire An Agent

Ruhroh can test different agents because each agent is connected through a small
adapter script. Use the maintained wrapper templates as starting points, then
run `doctor` before collecting samples.

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
`new-adapter` adds one later. The `examples` catalog also shows checker
templates (`review`, `deterministic`, `model`, and `hybrid`) because credible
scores depend on the review step as much as the agent wiring. The generic
template fails fast until edited; live CLI templates still need the matching CLI
installed and authenticated.

## Compare Repeated Runs

Use a run plan when collecting repeated samples. It records what you meant to
run: which tasks, which agents, how many attempts, and which sample ids.

```bash
pnpm exec ruhroh plan --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 10
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 10
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data --adapter ./ruhroh/adapters/codex-local/run.sh --runs 20 --shard 1/4
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

After a run, inspect one preserved result directory with `ruhroh report`,
`ruhroh validate-artifacts`, `ruhroh eval-quality --html`, and `ruhroh review`.
`compare` then turns repeated runs into pass rates, score summaries, cost/token
metadata when available, review warnings, and blockers that would make a score
unsafe to cite. `compare --html` adds a shareable matrix, failure triage,
cost/efficiency view, and links to the files behind each result.
Use `--shard <index>/<total>` to split expensive repeated cohorts across
workers while keeping sample ids tied to the full requested `--runs` count.

## Publish A Claim

Use `publish-check` when you want the one answer that matters before citing a
score: is this benchmark result safe to publish, and can someone else inspect
the evidence?

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

The bundle contains the score, summary, compare report, review queue,
eval-quality report, manifest, README, and copied `sources/` evidence used by
the result. A valid bundle can still return exit code `2` when the files are
sound but the score is not yet safe to cite, for example because the sample
count is too low or human review is still required. See
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
