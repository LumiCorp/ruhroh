---
id: ruhroh-getting-started
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-23
depends_on:
  - README.md
  - package.json
  - src/cli.ts
---

# Getting Started

If you want to understand Ruhroh before touching your repo, start with the
sample reports:

- [Workflow guide](/samples/ruhroh-workflow): the path from the built-in local
  example to a result that is ready to share.
- [Compare report](/samples/ruhroh-compare): side-by-side outcomes with
  evidence links, review state, and blockers.
- [Publication packet compare](/samples/ruhroh-publication/ruhroh-compare):
  the portable review packet produced by `publish-check --bundle`.
- [Claim index](/samples/ruhroh-claims): the catalog view over benchmark
  results.

The sample is intentionally too small to publish. It still validates
structurally, preserves evidence, and shows exactly why the claim remains
blocked.

Install Ruhroh in a project where you want to generate and run repeatable agent
tasks:

```bash
pnpm dlx @kestrel-agents/ruhroh demo
```

`demo` is the live first-run experience. It uses OpenRouter, prompts for an API
key when `OPENROUTER_API_KEY` is not already set, installs pinned Aider tooling
under `.ruhroh/tools/`, runs the bundled bookmark-manager task, evaluates the
delivered app, and writes `ruhroh-report.html` plus local run evidence under
`.ruhroh/runs/`.

The intended unscoped command is `pnpm dlx ruhroh demo`. Until that npm package
name is available for this project, use the scoped package command above.

Use `init` when you are ready to add Ruhroh to a project or want the
no-credentials fixture path:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

`init` creates a local `ruhroh/` directory with a small example task, a matching
example benchmark suite, a no-credentials agent command, a no-credentials
reviewer command, schemas, and a starter README. It is safe to rerun when files
are unchanged and refuses to overwrite local edits.

Check whether the local fixture loop is ready:

```bash
pnpm exec ruhroh first-run
pnpm exec ruhroh first-run --json
pnpm exec ruhroh first-run --allow-dry-run --json
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

`first-run` is a read-only setup check. It looks for the generated example
files, validates the example task and benchmark suite, checks the exported agent and
reviewer commands, checks whether Harbor is available, and then prints the
exact next commands. The command list is staged so a missing scaffold only asks
you to run `init` and re-check; once files exist it asks for the example
exports; once those are set it shows validation, dry-run, and full-run commands.
Use `--allow-dry-run` in setup automation when Harbor is not installed yet but
you still want a zero exit code after the local fixture files and exported
commands are ready for dry-run preview. It does not mark the first local loop as
complete; `workflow` still waits for a preserved `ruhroh-loop-result.json`.
`workflow` is the broader read-only guide. It inspects the current project and
shows the next step from the first local example, to authoring your own tasks,
reviewer quality, run planning, comparison, and publication readiness. JSON
output is versioned for setup scripts and docs automation; `--html` writes the
same staged guide as a shareable report. The first example stage stays open
until Ruhroh finds a saved `ruhroh-loop-result.json`; setup readiness alone is
not treated as a completed local run. The reviewer-quality stage also stays
open until a passing
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
exists, so repeated run planning starts from a reviewer that has been checked
against known examples.

List the bundled scenarios:

```bash
pnpm exec ruhroh list
pnpm exec ruhroh list-suites
```

Validate scenarios before generating tasks:

```bash
pnpm exec ruhroh validate
```

Bundled scenarios and suites are the default. Add `--scenario-dir` or
`--suite-dir` only when you want Ruhroh to read project-local content.

The core lifecycle is:

```text
task -> benchmark suite -> agent run -> saved evidence -> compare -> publish check
```

See [Core Concepts](./concepts.md) for the Ruhroh terms before authoring your
own benchmark pack.

Check local readiness before a live run:

```bash
pnpm exec ruhroh doctor \
  --adapter ./path/to/agent-wrapper.sh
```

`doctor` checks the task files, the bundled Python helper, Harbor availability,
and the selected agent connector. Add `--json` when wiring this into CI or
setup scripts.

To exercise the full loop without live model credentials, use the example agent
command and reviewer command created by `init`:

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

Add `--suite-dir ruhroh/suites --suite <id>` when your project includes a local
benchmark suite. `doctor` then validates suite membership and scenario-version
locks before you spend time collecting runs.
The dry-run is only a command preview. When Harbor is installed, remove
`--dry-run` to produce a real saved result, then rerun `ruhroh workflow` so the
guide can advance from first-loop proof to benchmark authoring and run planning.

See [Local Fixture Run](./local-fixture-run.md) for the complete smoke path.
For a public-project walkthrough that installs Ruhroh into an existing repo,
wires a command wrapper, and swaps in a local reviewer, see
[Add Ruhroh to an Existing Project](./add-to-existing-project.md).
For a focused end-to-end authoring path from task to five-run publication
packet, use [Publish a Benchmark Result](./benchmark-pack-tutorial.md).

Create your first local task draft:

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario csv-cleanup
```

The scaffold is private by default and includes review rules, evidence
guidance, and known pass/fail/review examples so validation works before you
start hardening the task for a repeatable benchmark.

Group local tasks into a version-locked benchmark suite:

```bash
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites
```

`new-suite` reads the task metadata, freezes task version locks, and adds
prompts for review checklists and benchmark-maintenance notes that later
compare reports use. `inspect-pack` gives a readiness view before any agent runs
are collected. It also surfaces the difficulty mix plus placeholder risk-review
notes while you are still authoring the pack. Add `--require-calibrated` when
known pass/fail/review examples are required for a public or team-shared pack.

Scaffold a local command wrapper when you are ready to wire a live agent:

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh init --adapter codex-cli
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh new-adapter codex-local --template codex-cli
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
```

`examples` lists the packaged no-credentials example plus Codex CLI, Claude
Code, Gemini CLI, and Aider command wrappers. It also lists reviewer templates
and the follow-up `calibrate-evaluator` command, so agent wiring and outcome
review are discoverable from the same catalog. `init --adapter <template>`
copies one maintained wrapper into a fresh starter; `new-adapter` does the same
for an existing project. It can either create the safe generic fail-fast
skeleton or copy a maintained wrapper with `--template codex-cli`, `--template
claude-code`, `--template gemini-cli`, `--template aider`, or `--template
fixture`. The generic wrapper fails fast until edited, but already writes the
prompt, transcript, and result-file metadata shape Ruhroh expects from real
wrappers.
When you pass a target directory to `init`, the printed next commands start
with `cd <target>` and JSON output includes the same staged `nextCommands`, so
copying the commands keeps every relative scaffold path anchored correctly.

Scaffold a local reviewer when you are ready to replace the built-in example
judgment:

```bash
pnpm exec ruhroh new-evaluator local-evaluator
pnpm exec ruhroh new-evaluator deterministic-evaluator --template deterministic
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/local-evaluator/run.sh"
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario simple-newsletter
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
```

The generated evaluator returns `review` until edited, but already writes the
evidence-rich `ruhroh_eval_result_v1` shape that reports and publication gates
expect. `calibrate-evaluator` runs the reviewer against known task examples and
fails until returned statuses match the expected pass/fail/review judgments. It
also writes
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
so `workflow`, CI, and reviewers can verify that the reviewer check was
actually run.
`workflow` will not advance to repeated run planning until this report exists
and passes.
Use reviewer templates for deterministic, model-backed, or hybrid judgment
patterns. See [Write a Reviewer](./write-an-evaluator.md) and
[Reviewer Recipes](./evaluator-cookbook.md).

Use these commands for three different readiness checks:

| Command | Writes task directories | Writes a run plan | Starts Harbor or an agent |
| --- | --- | --- | --- |
| `generate` | yes | no | no |
| `run --dry-run` | no | no | no |
| `run` | yes | yes | yes |

Generate Harbor task directories without running an agent:

```bash
pnpm exec ruhroh generate --scenario simple-newsletter
```

Generate a whole benchmark pack by suite id:

```bash
pnpm exec ruhroh generate --suite ruhroh-smoke
```

The generated task appears under:

```text
.generated/ruhroh/harbor/tasks/simple-newsletter/
```

Preview the Harbor command shape without writing task directories, a run plan,
or calling Harbor:

```bash
pnpm exec ruhroh run --scenario simple-newsletter --adapter custom-shell --dry-run
```

That dry-run should print a `harbor run` command and placeholder secret values
such as `${OPENAI_API_KEY}`. It should not write `.generated/ruhroh/harbor`
tasks, write `.generated/ruhroh/ruhroh-run-plan.json`, start Harbor, or call a
live model.

Use `--runs <n>` when you want repeated samples for comparison:

```bash
pnpm exec ruhroh plan --suite ruhroh-smoke --adapter ./path/to/agent-wrapper.sh --runs 5
pnpm exec ruhroh run --suite ruhroh-smoke --adapter ./path/to/agent-wrapper.sh --runs 5
```

Each sample receives a stable `RUHROH_SAMPLE_ID` and `RUHROH_SAMPLE_SEED` plus
`RUHROH_RUN_INDEX` and `RUHROH_RUN_COUNT`; the run manifest preserves all four
fields for later audit. `ruhroh plan` writes the planned sample matrix to
`.generated/ruhroh/ruhroh-run-plan.json` before any agent work starts.

Repeat `--adapter` to run the same selected scenario or suite across multiple
agents:

```bash
pnpm exec ruhroh plan --suite ruhroh-smoke \
  --adapter ./adapters/codex.sh \
  --adapter ./adapters/claude.sh \
  --runs 5

pnpm exec ruhroh run --suite ruhroh-smoke \
  --adapter ./adapters/codex.sh \
  --adapter ./adapters/claude.sh \
  --runs 5
```

To run a live agent, provide a command-backed adapter:

```bash
pnpm exec ruhroh \
  --scenario simple-newsletter \
  --adapter ./path/to/agent-wrapper.sh
```

Use the artifacts from the Harbor run to review what happened: the final result,
iteration records, transcripts, event logs, eval judgment, and workspace
snapshot.

Turn a saved run into a reviewable report:

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
```

Triage runs that need human review:

```bash
pnpm exec ruhroh eval-quality ./path/to/results --html ruhroh-eval-quality.html --json
pnpm exec ruhroh review ./path/to/results
pnpm exec ruhroh review ./path/to/results --html ruhroh-review.html
```

`eval-quality` checks whether the reviewer supplied enough evidence. It returns
exit code `2` when valid runs have missing evidence, missing criteria results,
weak judge metadata, low confidence, or human-review requirements. `--html`
writes the same check as a static report with warning counts, next actions,
per-run evidence counts, judge metadata, and result links. The review queue then
points at transcripts, event logs, unmet criteria, reviewer warnings, and
non-passing runs that need inspection before a score can be defended. See
[Human Review](./adjudication.md).

Compare repeated runs across agents or prompts:

```bash
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --suite-dir ruhroh/suites --suite ruhroh-smoke --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

Compare reports include pass rate, a Wilson 95% confidence interval, pass@k
estimates for repeated runs, mean-score bootstrap intervals, and a low-sample
warning until at least five runs exist for a task/agent group. They also
include run metadata and warn when a result group is missing or mixing task
versions, agent models, prompt versions, reviewer identities, or environment
fingerprints. Use `compare --suite <id>` when publishing benchmark-suite numbers so
Ruhroh applies the suite's minimum run count and locked task versions.

When you are ready to decide whether a result can be published, use the
publication workflow:

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --rerun-ledger ruhroh-rerun-ledger.json \
  --benchmark-claim benchmark-claim.json \
  --benchmark-summary benchmark-summary.json \
  --html ruhroh-compare.html \
  --bundle ruhroh-publication \
  --verify-sources

pnpm exec ruhroh validate-bundle ruhroh-publication --json
pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json
```

`publish-check` returns exit code `0` for publishable claims, `1` for invalid
inputs, and `2` for valid results that still have publication blockers. The
publication packet keeps the claim, summary, reports, inventory, and copied
`sources/` evidence together; `validate-bundle` checks the packet after it has
been moved or archived, and `claim-index` turns it into a local catalog page.
See
[Publish Claims](./publish-claims.md) for the checklist.

Rerun `pnpm exec ruhroh workflow` after writing the publication packet or claim
index. The publish stage does not only check that files exist; it validates the
packet and reads `claim-index.json` so blocked or invalid results remain visible
before anyone cites the claim.

The recommended workflow is:

1. Inspect the sample workflow, compare report, publication packet, and claim
   index so the evidence model is visible before setup.
2. Run `ruhroh init`, `ruhroh first-run`, and the no-credentials example
   until a real `ruhroh-loop-result.json` exists.
3. Use `ruhroh workflow` to confirm the first local loop is complete and see
   the next stage.
4. Author or choose realistic tasks, benchmark suites, agent connectors, and reviewers.
5. Run `ruhroh validate`, `ruhroh doctor`, `ruhroh calibrate-evaluator`, and
   strict `ruhroh inspect-pack` before collecting live-agent samples.
6. Generate a run plan with `ruhroh plan`, then run one or more adapters with
   explicit sample counts.
7. Review `ruhroh report`, `ruhroh eval-quality`, and `ruhroh review` before
   trusting aggregate scores.
8. Use `ruhroh compare` for repeated-run analysis across tasks and agents.
9. Use `ruhroh publish-check --bundle --verify-sources` to decide whether the
   result is publishable and preserve a portable evidence packet.
10. Validate the bundle and build a claim index before citing or sharing a
   benchmark claim.
