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
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --generate-only
```

Adapter selection is runtime configuration, for example:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --adapter ./adapters/my-agent
```

Validate scenarios before generating Harbor tasks:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --json
```

Validation checks the scenario JSON shape, prompt path, declared assets,
adapter-independent runtime requirements, loop settings, evaluation rubric, and
network policy. A scenario with `requires.network: true` is valid, but validation
prints a warning because generated Harbor tasks will allow public network
access.

## Complete Example

```json
{
  "version": "ruhroh_scenario_v2",
  "id": "simple-newsletter",
  "title": "Simple Newsletter",
  "tier": "smoke",
  "kind": "real_user",
  "userPromptPath": "instruction.md",
  "assets": [],
  "run": {
    "mode": "build",
    "timeoutSeconds": 600
  },
  "requires": {
    "continuity": "workspace_only",
    "tools": ["filesystem", "shell"],
    "network": false
  },
  "loop": {
    "defaultMaxIterations": 3,
    "stopPolicy": "goal_satisfied_or_max"
  },
  "evaluation": {
    "mode": "agentic_goal_review",
    "scenarioContext": ["A user needs a small local app."],
    "goalRubric": ["The final workspace satisfies the user prompt."],
    "evidenceGuidance": ["Inspect the final workspace and run relevant commands."]
  }
}
```

## Field Rules

`version` should be `ruhroh_scenario_v2` for new scenarios. Legacy
`ruhroh_scenario_v1` scenarios may still load, but v2 scenarios must not include
`driver`; adapter selection belongs at runtime.

`id` must use only letters, numbers, `.`, `_`, and `-`. It becomes the Harbor
task directory name.

`userPromptPath` points to the real-user prompt. The loaded scenario stores the
prompt content as `userPrompt`.

`assets` is an optional array of relative paths that must stay inside the
scenario directory. The generator copies the scenario `assets/` directory into
the Harbor task.

`requires.network` controls generated Harbor networking:

- `false` generates `network_mode = "none"`.
- `true` generates `network_mode = "public"`.

`evaluation.scenarioContext`, `evaluation.goalRubric`, and
`evaluation.evidenceGuidance` are forwarded to the runtime and written into
`ruhroh-loop-eval-input.json` so external evaluators can judge from a stable file
contract.
