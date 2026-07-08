---
id: ruhroh-write-a-scenario
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-23
depends_on:
  - docs/scenario-format.md
  - src/scenarios.ts
---

# Write a Scenario

A Ruhroh scenario is a realistic user task plus the metadata needed to run and
judge it repeatedly.

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

The scaffold creates private scenario metadata, an instruction stub, rubric
guidance, evidence guidance, and a calibration case. Edit those fields before
publishing the scenario or adding it to a benchmark suite.

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

The scenario JSON should define:

- the scenario id, title, tier, and kind;
- benchmark metadata such as scenario version, difficulty, tags, visibility,
  changelog, lifecycle status, provenance, contamination notes, maintainers, and
  expected runtime;
- `userPromptPath`;
- runtime requirements such as continuity, tools, and network;
- loop defaults such as max iterations;
- evaluation context, rubric, evidence guidance, calibration cases, and optional
  private evaluator assets.

Keep adapter choice out of new `ruhroh_scenario_v2` scenarios. Select adapters
at runtime with `--adapter`.

Use `metadata.scenarioVersion` to version the scenario itself. This is separate
from the Ruhroh schema `version` and lets published packs evolve without losing
comparability.
Use `metadata.changelog` and `metadata.lifecycle` to make scenario changes and
deprecations explicit. Use `metadata.visibility` to distinguish public scenarios
from private or held-out scenarios before publishing packs or reports.

Use the rubric to describe outcome quality. The generated Harbor verifier stays
generic; it should not become a scenario-specific file or source-code checker.

Add `evaluation.calibrationCases` with at least one pass, fail, or review anchor
that explains the expected judgment. These anchors help keep model-backed and
human-assisted evaluators consistent without adding brittle implementation
checks to the Harbor verifier.

If the evaluator needs held-out expected outputs or private review fixtures,
declare them in `evaluation.privateAssets`. Keep these files out of the public
prompt and public `assets/`; Ruhroh forwards them to the eval-agent through the
eval input.

Validate the scenario before generating the task:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario my-task
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario my-task --json
```

Then generate the task:

```bash
pnpm exec ruhroh --scenario-dir ruhroh/scenarios --scenario my-task --generate-only
```

Set `requires.network` deliberately. `false` produces Harbor
`network_mode = "none"`; `true` produces `network_mode = "public"` and should be
reserved for scenarios whose user goal genuinely needs external network access.
