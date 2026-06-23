---
id: ruhroh-scenario-format
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/scenarios.ts
  - src/generate.ts
---

# Scenario Format

Ruhroh supports JSON scenario directories:

```text
ruhroh/scenarios/<id>/
  scenario.json
  instruction.md
  assets/
```

`scenario.json` uses `version: "ruhroh_scenario_v2"` and points at the
Harbor-visible task prompt with `userPromptPath`.

Required fields:

- `id`, `title`, `tier`, `kind`
- `userPromptPath`
- `run.timeoutSeconds` and optional `run.mode`
- `requires.continuity`, `requires.tools`, `requires.network`
- `loop.defaultMaxIterations`, `loop.stopPolicy`
- `evaluation.mode`, `evaluation.scenarioContext`, `evaluation.goalRubric`,
  `evaluation.evidenceGuidance`

Assets are copied into the generated Harbor task under `assets/`. Scenario
prompts and assets are untrusted input; run them only inside benchmark
workspaces.

Generate tasks with:

```bash
pnpm ruhroh --scenario-dir examples/scenarios --scenario simple-newsletter --generate-only
```

Adapter selection is runtime configuration, for example:

```bash
pnpm ruhroh --scenario-dir examples/scenarios --scenario simple-newsletter --adapter ./adapters/my-agent
```
