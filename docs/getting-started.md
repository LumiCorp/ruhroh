---
id: ruhroh-getting-started
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-23
depends_on:
  - README.md
  - package.json
---

# Getting Started

If you want to understand Ruhroh before touching your repo, start with the
generated sample packet:

- [Workflow guide](/samples/ruhroh-workflow.html): the staged path from fixture
  readiness to claim publication.
- [Compare report](/samples/ruhroh-compare.html): aggregate outcomes with
  source artifacts, review state, and readiness blockers.
- [Publication bundle manifest](/samples/ruhroh-publication/manifest.json): the
  relocatable evidence packet produced by `publish-check --bundle`.
- [Claim index](/samples/ruhroh-claims.html): the registry view over bundle
  claims.

The sample is intentionally too small to publish. It still validates
structurally, preserves evidence, and shows exactly why the claim remains
blocked.

Install Ruhroh in a project where you want to generate and run repeatable agent
tasks:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

`init` creates a local `ruhroh/` directory with a v2 smoke scenario, matching
`ruhroh-smoke` suite, fixture adapter, fixture evaluator, schemas, and starter
README. It is safe to rerun when files are unchanged and refuses to overwrite
local edits.

Check whether the local fixture loop is ready:

```bash
pnpm exec ruhroh first-run
pnpm exec ruhroh first-run --json
pnpm exec ruhroh first-run --allow-dry-run --json
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

`first-run` is a read-only onboarding gate. It checks for the scaffolded
fixture files, scenario and suite validation, exported adapter/evaluator
commands, and Harbor availability, then prints the exact next commands for the
credential-free smoke path. The command list is staged so a missing scaffold
only asks you to run `init` and re-check; once files exist it asks for the
fixture exports; once those are set it shows validation, dry-run, and full-run
commands.
Use `--allow-dry-run` in setup automation when Harbor is not installed yet but
you still want a zero exit code after the local fixture files and exported
commands are ready for dry-run preview. It does not mark the first local loop as
complete; `workflow` still waits for a preserved `ruhroh-loop-result.json`.
`workflow` is the broader read-only guide. It inspects the current project and
shows the next stage from first fixture loop, to benchmark authoring, evaluator
quality, run planning, comparison, and publication readiness. JSON output is
versioned for setup scripts and docs automation; `--html` writes the same staged
guide as a shareable artifact. The first fixture stage stays open until Ruhroh
finds a preserved `ruhroh-loop-result.json`; setup readiness alone is not
treated as a completed local loop. The evaluator-quality stage also stays open
until a passing
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
exists, so repeated run planning starts from a calibrated scoring boundary.

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
scenario -> suite -> adapter run -> artifacts -> compare -> publish check
```

See [Core Concepts](./concepts.md) for the terms before authoring your own
benchmark pack.

Check local runtime readiness before a live run:

```bash
pnpm exec ruhroh doctor \
  --adapter ./path/to/agent-wrapper.sh
```

`doctor` checks scenario validity, the bundled Python runtime import path,
Harbor availability, and the selected adapter. Add `--json` when wiring this
into CI or setup scripts.

To exercise the full loop without live model credentials, use the fixture
adapter and evaluator created by `init`:

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
`--dry-run` to produce a real result artifact, then rerun `ruhroh workflow` so
the guide can advance from first-loop proof to benchmark authoring and run
planning.

See [Local Fixture Run](./local-fixture-run.md) for the complete smoke path.
For a public-project walkthrough that installs Ruhroh into an existing repo,
wires a command adapter, and swaps in a local evaluator, see
[Add Ruhroh to an Existing Project](./add-to-existing-project.md).
For a focused end-to-end authoring path from scenario to five-run claim packet,
use the [Benchmark Pack Tutorial](./benchmark-pack-tutorial.md).

Create your first local scenario draft:

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario csv-cleanup
```

The scaffold is private by default and includes governance metadata, a rubric,
evidence guidance, and pass/fail/review calibration anchors so validation works
before you start hardening the task for a suite.

Group local scenarios into a version-locked benchmark suite:

```bash
pnpm exec ruhroh new-suite local-data --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --scenario csv-cleanup --runs 10
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites
```

`new-suite` reads the scenario metadata, freezes the scenario version locks, and
adds governance prompts for contamination review, reward-hacking review, review
checklists, and deprecation policy that later compare reports use for suite
claims. `inspect-pack` gives the pack-level readiness view for authoring tools,
registry preflight, and CI before any agent runs are collected. It also surfaces
the difficulty mix plus placeholder contamination or reward-hacking review notes
as `riskReview` warnings while you are still authoring the pack. Add
`--require-calibrated` when calibration coverage is part of the gate for a
public or team-shared pack.

Scaffold a local command adapter when you are ready to wire a live agent:

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh init --adapter codex-cli
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh new-adapter codex-local --template codex-cli
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
```

`examples` lists the packaged fixture plus Codex CLI, Claude Code, Gemini CLI,
and Aider custom-shell wrappers. It also lists evaluator templates and the
follow-up `calibrate-evaluator` command, so adapter wiring and outcome-judgment
authoring are discoverable from the same catalog. `init --adapter <template>`
copies one maintained wrapper into a fresh starter; `new-adapter` does the same
for an existing project. It can either create the safe generic fail-fast
skeleton or copy a maintained wrapper with `--template codex-cli`, `--template
claude-code`, `--template gemini-cli`, `--template aider`, or `--template
fixture`. The generic adapter fails fast until edited, but already writes the
prompt, transcript, and result-file metadata shape Ruhroh expects from real
wrappers.
When you pass a target directory to `init`, the printed next commands start
with `cd <target>` and JSON output includes the same staged `nextCommands`, so
copying the commands keeps every relative scaffold path anchored correctly.

Scaffold a local evaluator when you are ready to replace the fixture judgment:

```bash
pnpm exec ruhroh new-evaluator local-evaluator
pnpm exec ruhroh new-evaluator deterministic-evaluator --template deterministic
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/local-evaluator/run.sh"
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario simple-newsletter
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
```

The generated evaluator returns `review` until edited, but already writes the
evidence-rich `ruhroh_eval_result_v1` shape that reports and publication gates
expect. `calibrate-evaluator` runs the evaluator against scenario calibration
anchors and fails until returned statuses match the expected pass/fail/review
judgments. It also writes
`.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
so `workflow`, CI, and reviewers can verify that calibration was actually run.
`workflow` will not advance to repeated run planning until this report exists
and passes.
Use evaluator templates for deterministic, model-backed, or hybrid
judgment patterns. See [Write an Evaluator](./write-an-evaluator.md) and
[Evaluator Cookbook](./evaluator-cookbook.md).

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

Turn a run artifact into a reviewable report:

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh report ./path/to/run-artifacts --json
pnpm exec ruhroh report ./path/to/run-artifacts --html ruhroh-report.html
```

Triage runs that need human adjudication:

```bash
pnpm exec ruhroh eval-quality ./path/to/results --html ruhroh-eval-quality.html --json
pnpm exec ruhroh review ./path/to/results
pnpm exec ruhroh review ./path/to/results --html ruhroh-review.html
```

`eval-quality` is the evaluator evidence gate: it returns exit code `2` when
valid runs have missing evidence, missing criteria results, weak judge metadata,
low confidence, or human-review requirements. `--html` writes the same gate as
a static reviewer packet with warning counts, next actions, per-run evidence
counts, judge metadata, and result links. The review queue then points at
transcripts, event logs, unmet criteria, evaluator warnings, and non-passing
runs that need inspection before a score can be defended. See
[Adjudication](./adjudication.md).

Compare repeated runs across agents or prompts:

```bash
pnpm exec ruhroh compare ./path/to/results
pnpm exec ruhroh compare ./path/to/results --json
pnpm exec ruhroh compare ./path/to/results --suite-dir ruhroh/suites --suite ruhroh-smoke --json
pnpm exec ruhroh compare ./path/to/results --html ruhroh-compare.html
```

Compare reports include pass rate, a Wilson 95% confidence interval, pass@k
estimates for repeated runs, mean-score bootstrap intervals, and a low-sample
warning until at least five runs exist for a scenario/adapter group. They also
include cohort metadata and warn when an aggregate group is missing or mixing
scenario versions, agent model
identity, prompt versions, evaluator identity, or environment fingerprints.
Use `compare --suite <id>` when publishing suite numbers so Ruhroh applies the
suite's minimum run count and locked scenario versions.

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
bundle keeps the claim, summary, reports, manifest, and copied `sources/`
evidence together; `validate-bundle` checks the packet after it has been moved
or archived, and `claim-index` turns it into a local registry page. See
[Publish Claims](./publish-claims.md) for the checklist.

Rerun `pnpm exec ruhroh workflow` after writing the bundle or claim index. The
publish stage does not only check that files exist; it validates the bundle and
reads `claim-index.json` so blocked or invalid publication packets remain visible
before anyone cites the claim.

The recommended workflow is:

1. Inspect the sample workflow, compare report, publication bundle, and claim
   index so the evidence model is visible before setup.
2. Run `ruhroh init`, `ruhroh first-run`, and the credential-free fixture path
   until a real `ruhroh-loop-result.json` exists.
3. Use `ruhroh workflow` to confirm the first local loop is complete and see
   the next stage.
4. Author or choose realistic scenarios, suites, adapters, and evaluators.
5. Run `ruhroh validate`, `ruhroh doctor`, `ruhroh calibrate-evaluator`, and
   strict `ruhroh inspect-pack` before collecting live-agent samples.
6. Generate a run plan with `ruhroh plan`, then run one or more adapters with
   explicit sample counts.
7. Review `ruhroh report`, `ruhroh eval-quality`, and `ruhroh review` before
   trusting aggregate scores.
8. Use `ruhroh compare` for repeated-run analysis across scenarios and agents.
9. Use `ruhroh publish-check --bundle --verify-sources` to decide whether the
   result is publishable and preserve a relocatable evidence packet.
10. Validate the bundle and build a claim index before citing or sharing a
   benchmark claim.
