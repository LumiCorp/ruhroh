---
id: ruhroh-write-a-scenario
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/scenario-format.md
  - src/scenarios.ts
---

# Write a Task

A Ruhroh task is a realistic user request plus the metadata needed to run and
review it repeatedly. The on-disk file is still named `scenario.json`; treat
that as the schema name, not the reader-facing concept.

Create a directory:

```text
ruhroh/scenarios/my-task/
  scenario.json
  instruction.md
  assets/
```

Or scaffold a validation-ready draft:

```bash
pnpm exec ruhroh new-scenario my-task --scenario-dir ruhroh/scenarios
```

The scaffold creates private task metadata, an instruction stub, rubric
guidance, evidence guidance, and pass/fail/review calibration anchors. Edit
those fields before publishing the task or adding it to a benchmark suite.

The prompt in `instruction.md` should read like a user request. It should state
the desired outcome, useful constraints, and any domain context the agent needs.

Good prompt:

```md
Build a small CSV reconciliation tool for the attached people exports. The user
needs to upload two CSVs, see unmatched records, and download a merged CSV.
Prioritize a clear workflow and explain any records that cannot be matched.
```

Poor prompt:

```md
Create `src/App.tsx`, add a route at `/reconcile`, and include the text
`Download merged CSV`.
```

The second prompt overfits implementation details. Use those details only when
they are genuinely part of the user's goal.

The task JSON should define:

- the task id, title, tier, and kind;
- benchmark metadata such as task version, difficulty, tags, visibility,
  changelog, lifecycle status, provenance, contamination notes, maintainers, and
  expected runtime;
- `userPromptPath`;
- run requirements such as continuity, tools, and network;
- loop defaults such as max iterations;
- evaluation context, rubric, evidence guidance, calibration cases, and optional
  private reviewer files.

Keep agent choice out of new `ruhroh_scenario_v2` tasks. Select agent
connectors when you run with `--adapter`.

Use `metadata.scenarioVersion` to version the task itself. This is separate
from the Ruhroh schema `version` and lets published packs evolve without losing
comparability.
Use `metadata.changelog` and `metadata.lifecycle` to make task changes and
deprecations explicit. Use `metadata.visibility` to distinguish public tasks
from private or held-out tasks before publishing packs or reports.
See [Task Versioning](./scenario-evolution.md) for version bump rules and
benchmark-suite lock implications.

Use the rubric to describe outcome quality. The generated Harbor verifier stays
generic; it should not become a task-specific file or source-code checker.

Add `evaluation.calibrationCases` with pass, fail, and review anchors that
explain the expected judgment. These anchors help keep model-backed and
human-assisted reviewers consistent without adding brittle implementation
checks to the Harbor verifier. `new-scenario` scaffolds one of each status so
authors can replace the examples with task-specific cases instead of inventing
the structure from scratch. `ruhroh validate` prints calibration coverage, and
`ruhroh validate --json` includes a `calibration` object that shows which
expected statuses are covered or missing.

If the reviewer needs held-out expected outputs or private review fixtures,
declare them in `evaluation.privateAssets`. Keep these files out of the public
prompt and public `assets/`; Ruhroh forwards them to the reviewer command
through the review input.

Use private reviewer files only for material the agent should not see:

- expected output files used to judge a transformation;
- reviewer checklists that would reveal the pass/fail boundary;
- model-judge rubrics or examples that would contaminate the task prompt;
- fixture data used only during reviewer calibration or human review.

Place those files under a clearly named private directory such as
`private-eval-assets/`, list them in `evaluation.privateAssets`, and keep public
inputs under `assets/`. Do not duplicate the same file in both places.
Validation fails when a private reviewer file overlaps a declared public
asset, because that would leak held-out material into the agent-visible task.

Private assets do not replace calibration cases. Calibration cases explain
which kinds of final workspaces should pass, fail, or require review. Private
assets are the reviewer-only evidence used to make those judgments harder to
overfit. Before collecting runs for a public or team-shared suite, use both
gates:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario my-task --json
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --require-calibrated --require-risk-reviewed --json
pnpm exec ruhroh calibrate-evaluator --scenario-dir ruhroh/scenarios --scenario my-task --json
```

`inspect-pack --json` fingerprints public prompts, public assets, and private
reviewer files separately so reviewers and registry tooling can detect drift
without exposing held-out content in the user prompt. If the scenario is
private or held out and cannot list concrete private assets, document the reason
with `metadata.privateEvalRationale` so reviewers know where the reviewer-only
boundary lives.

Validate the task before generating runnable files:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario my-task
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario my-task --json
```

Then generate the task:

```bash
pnpm exec ruhroh generate --scenario-dir ruhroh/scenarios --scenario my-task
```

Set `requires.network` deliberately. `false` produces Harbor
`network_mode = "no-network"`; `true` produces `network_mode = "public"` and should be
reserved for scenarios whose user goal genuinely needs external network access.
