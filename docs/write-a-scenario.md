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
- `userPromptPath`;
- runtime requirements such as continuity, tools, and network;
- loop defaults such as max iterations;
- evaluation context, rubric, and evidence guidance.

Keep adapter choice out of new `ruhroh_scenario_v2` scenarios. Select adapters
at runtime with `--adapter`.

Use the rubric to describe outcome quality. The generated Harbor verifier stays
generic; it should not become a scenario-specific file or source-code checker.

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
