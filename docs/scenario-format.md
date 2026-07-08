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

# Task File Format

Ruhroh stores each benchmark task in a JSON-backed directory:

```text
ruhroh/scenarios/<id>/
  scenario.json
  instruction.md
  assets/
```

`scenario.json` uses `version: "ruhroh_scenario_v2"` and points at the
Harbor-visible task prompt with `userPromptPath`.

The package ships a JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/scenario-v2.schema.json`.
Projects created with `ruhroh init` also copy it to
`ruhroh/schemas/scenario-v2.schema.json`. Use the schema for editor completion
and structural CI checks; `ruhroh validate` remains the authoritative check for
prompt files, declared assets, agent-connector compatibility, reviewer lint,
and publication rules.

Core fields:

- `id`, `title`, `tier`, `kind`
- optional `metadata` for benchmark governance
- `userPromptPath`
- `run.timeoutSeconds` and optional `run.mode`
- `requires.continuity`, `requires.tools`, `requires.network`
- `loop.defaultMaxIterations`, `loop.stopPolicy`
- `evaluation.mode`, `evaluation.scenarioContext`, `evaluation.goalRubric`,
  `evaluation.evidenceGuidance`, optional `evaluation.calibrationCases`, and
  optional `evaluation.privateAssets`

Declared assets are copied into the generated task at their declared
relative paths. Task prompts and assets are untrusted input; run them only
inside benchmark workspaces.

Private reviewer files are copied separately under `private-eval-assets/` in
the generated task and are forwarded to the reviewer command as paths in
`RUHROH_EVAL_PRIVATE_ASSETS_JSON` and `ruhroh-loop-eval-input.json`. Use them
for held-out expected outputs, reviewer checklists, or fixtures that should not
be part of the public prompt or copied into the agent workspace.

Calibration cases are reviewer-only judgment anchors. They are forwarded in
`RUHROH_EVAL_CALIBRATION_CASES_JSON` and written to
`ruhroh-loop-eval-input.json` so a model-backed or human-assisted reviewer can
compare the live run against known pass/fail/review examples for the task.

`metadata` is optional for compatibility, but published benchmark packs should
include it. Ruhroh preserves selected metadata in generated task metadata so
results can be tied back to a task version and provenance.

Generate tasks with:

```bash
pnpm exec ruhroh generate --scenario simple-newsletter
```

Agent connector selection happens when you run the task, for example:

```bash
pnpm exec ruhroh run --scenario simple-newsletter --adapter ./adapters/my-agent
```

Validate tasks before generating runnable task directories:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --json
```

Validation checks the task JSON shape, prompt path, declared assets,
agent-neutral requirements, loop settings, review rubric, and
network policy. A scenario with `requires.network: true` is valid, but validation
prints a warning because generated tasks will allow public network access.

Validation also lints reviewer context. Warnings are emitted for generic
rubrics such as "satisfies the user goal", too few outcome criteria, weak
evidence guidance, and source-text or filename proxy checks. Warnings do not
block task generation, but published benchmark packs should resolve or justify
them before reporting results.

`ruhroh validate --json` includes the same warnings as strings plus structured
`warningDetails` for reviewer lint findings. Each detail has a stable `code`,
`category`, `field`, `severity`, and `message`. Pack maintainers can use these
codes to fail CI for generic rubrics while still allowing local authoring
iterations to proceed.

## Complete Example

```json
{
  "version": "ruhroh_scenario_v2",
  "id": "simple-newsletter",
  "title": "Simple Newsletter",
  "tier": "smoke",
  "kind": "real_user",
  "metadata": {
    "scenarioVersion": "1.0.0",
    "createdAt": "2026-06-23",
    "updatedAt": "2026-07-07",
    "difficulty": "intro",
    "tags": ["local-app", "static-ui", "smoke"],
    "visibility": "public",
    "expectedRuntimeSeconds": 420,
    "contaminationNotes": "Small original smoke task with no canonical public solution.",
    "maintainers": ["ruhroh-maintainers"],
    "changelog": ["1.0.0: Initial published scenario."],
    "lifecycle": { "status": "active" }
  },
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
    "scenarioContext": [
      "A user needs a small local app.",
      "The user did not prescribe a framework or file layout."
    ],
    "goalRubric": [
      "The final workspace provides a locally viewable newsletter page.",
      "The page presents at least three visible story items with titles and summaries.",
      "The delivered result is an actual runnable or openable page, not prose-only output."
    ],
    "evidenceGuidance": [
      "Inspect the final workspace and run or open the app when practical.",
      "Judge the delivered user-visible behavior rather than source filenames."
    ],
    "calibrationCases": [
      {
        "id": "prose-only-failure",
        "inputSummary": "The agent only wrote a README describing the newsletter it would build.",
        "expectedStatus": "failed",
        "rationale": "The user asked for a delivered local page, not implementation notes."
      }
    ],
    "privateAssets": []
  }
}
```

## Field Rules

`version` should be `ruhroh_scenario_v2` for new tasks. Legacy
`ruhroh_scenario_v1` tasks may still load, but v2 tasks must not include
`driver`; agent connector selection belongs on the run command.

`id` must use only letters, numbers, `.`, `_`, and `-`. It becomes the generated
task directory name.

`metadata.scenarioVersion` is required when `metadata` is present. Use it as the
scenario's semantic version, separate from the Ruhroh schema `version`.
`metadata.difficulty` must be `intro`, `standard`, `hard`, or `expert`.
`metadata.visibility` must be `public`, `private`, or `held_out` when present.
`metadata.createdAt` and `metadata.updatedAt` should be ISO dates or date-times.
`metadata.tags`, `metadata.expectedRuntimeSeconds`, `metadata.provenance`,
`metadata.networkRationale`, `metadata.contaminationNotes`, and
`metadata.maintainers` are intended to make published packs auditable and easier
to compare across releases.
For `metadata.visibility: "public"` or `"held_out"`, validation requires
provenance, creation/update dates, difficulty, tags, expected runtime,
contamination notes, maintainers, changelog, and lifecycle status. Public or
held-out scenarios that require network access must also include
`metadata.networkRationale`.
Held-out scenarios must also either declare `evaluation.privateAssets` or set
`metadata.privateEvalRationale` to explain where the private evaluator material
or private review process lives.
`metadata.changelog` records task-level changes, separate from benchmark-suite
changelogs. `metadata.lifecycle.status` may be `active`, `deprecated`, or
`retired`; deprecated or retired tasks may also name a safe
`replacementId`, `reason`, and `sunsetAt`.
For version bump rules and examples, see
[Scenario Evolution](./scenario-evolution.md).

`userPromptPath` points to the real-user prompt. The loaded task stores the
prompt content as `userPrompt`.

`run.mode` may be `build`, `plan`, or `chat`. Ruhroh records it as
`run_mode` in generated task metadata and forwards it into run manifests
as `scenario.runMode`, so reports can distinguish delivery-style tasks from
planning or chat-style scenarios.

`assets` is an optional array of relative paths that must stay inside the
task directory. Treat it as an allowlist: the generator copies only the
declared files or directories into the generated task. Prefer declarations such as
`assets/prompt-assets/my-fixture` instead of broad paths such as `assets` when
the task directory also contains reviewer-only material.

`evaluation.privateAssets` is an optional array of relative paths that must stay
inside the scenario directory. These files are copied under
`private-eval-assets/` and listed in the review input as `privateAssets`. They are
for reviewer-only evidence and held-out checks, not for user prompt material or
agent-visible workspace assets. Validation fails if a private reviewer file
overlaps a declared public asset path, because that would expose held-out
judgment material to the agent being tested.

`evaluation.calibrationCases` is an optional array of expected review anchors.
Each entry must include:

- `id`: stable case id.
- `inputSummary`: short description of the hypothetical or fixture delivery.
- `expectedStatus`: `passed`, `failed`, or `review`.
- `rationale`: why that status is correct.

`requires.network` controls generated Harbor networking:

- `false` generates `network_mode = "no-network"`.
- `true` generates `network_mode = "public"`.

`evaluation.scenarioContext`, `evaluation.goalRubric`, and
`evaluation.evidenceGuidance` are written into
`ruhroh-loop-eval-input.json` so external reviewers can judge from a stable file
contract. When present, `evaluation.calibrationCases` is forwarded in the same
eval input as structured objects, and `evaluation.privateAssets` is forwarded as
path strings.

Use rubric criteria that describe observable outcomes: workflows completed,
state persisted, assets used correctly, exports produced, constraints obeyed,
and build/run behavior verified. Avoid one-line umbrella criteria that merely
say the app satisfies the prompt.
