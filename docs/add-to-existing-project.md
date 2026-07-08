---
id: ruhroh-add-to-existing-project
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/getting-started.md
  - docs/write-an-adapter.md
  - docs/eval-agent.md
---

# Add Ruhroh to an Existing Project

This guide starts from a public project and wires Ruhroh in as a local
benchmark harness. The example project is
[Aider](https://github.com/Aider-AI/aider), an open-source coding-agent CLI.
Aider is useful for a follow-along because it is public, scriptable, and its
[scripting docs](https://aider.chat/docs/scripting.html) describe one-shot
command-line runs with `--message-file`.

Ruhroh does not benchmark the source repo in place. It uses the repo as the
place where you keep benchmark scenarios, suites, adapters, evaluators, and
reports. Each run creates an isolated generated workspace for the selected
scenario.

## Clone a Public Agent Project

```bash
git clone https://github.com/Aider-AI/aider.git ruhroh-aider-example
cd ruhroh-aider-example
```

If the project does not already use Node, add a minimal private package file so
`pnpm` has somewhere to install Ruhroh:

```bash
test -f package.json || printf '{\n  "private": true,\n  "devDependencies": {}\n}\n' > package.json
```

Install Ruhroh and scaffold a local benchmark starter:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

`init` creates `ruhroh/` with:

- `scenarios/simple-newsletter/`: a small public smoke scenario.
- `suites/ruhroh-smoke/`: a suite that locks the smoke scenario.
- `adapters/fixture-newsletter/run.sh`: a credential-free fixture run-agent.
- `evaluators/fixture-newsletter/run.sh`: a deterministic fixture evaluator.
- `schemas/`: JSON Schemas for scenario, suite, run, and report artifacts.

## Prove the Eval Loop First

Before wiring a live coding agent, run the fixture adapter and evaluator. This
checks the Ruhroh install, local scenario path, evaluator command, run-plan
generation, and Harbor command shape without model credentials.

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"

pnpm exec ruhroh doctor \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --adapter custom-shell

pnpm exec ruhroh validate \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke

pnpm exec ruhroh \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell \
  --dry-run
```

When Harbor is installed, remove `--dry-run` to execute the fixture-backed
task end to end.

## Add an Agent Adapter

Ruhroh runs shell-based agents through the `custom-shell` adapter. The wrapper
receives `RUHROH_MESSAGE`, writes or runs inside `RUHROH_WORKSPACE`, and emits a
completion signal when the goal appears satisfied. The evaluator remains the
source of truth for pass or fail.

Start from Ruhroh's maintained Aider wrapper template:

```bash
pnpm exec ruhroh new-adapter aider-cli --template aider
$EDITOR ruhroh/adapters/aider-cli/README.md
```

The template writes prompts and transcripts under `.ruhroh/`, calls Aider with
`--message-file`, emits `ruhroh_run_agent_result_v1`, and records
`adapterVersion`, model identity, and artifact paths for repeated comparisons.
Review the generated README before editing the wrapper so local model/provider
choices are captured intentionally.

The wrapper assumes Aider is already installed and authenticated. Follow Aider's
[installation docs](https://aider.chat/docs/install.html) and model-provider
docs for the current setup commands, then verify:

```bash
aider --help
export AIDER_MODEL=o3-mini
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/aider-cli/run.sh"
export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"

pnpm exec ruhroh doctor \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --adapter custom-shell
```

Run a dry-run first:

```bash
pnpm exec ruhroh \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell \
  --dry-run
```

Then run the live benchmark sample:

```bash
pnpm exec ruhroh \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell
```

## Wire the Evaluator

The fixture evaluator proves that the evaluator command is wired correctly. For
real benchmark scenarios, replace it with an evaluator that checks the final
workspace outcome.

Evaluators receive path-oriented environment variables:

- `RUHROH_EVAL_INPUT_PATH`: JSON input with task, rubric, and artifact paths.
- `RUHROH_EVAL_OUTPUT_PATH`: where the evaluator must write its result JSON.
- `RUHROH_EVAL_WORKSPACE_PATH`: copied final workspace to inspect.
- `RUHROH_EVAL_ORIGINAL_WORKSPACE_PATH`: original generated workspace.
- `RUHROH_EVAL_JOURNEY_PATH`: run journey and iteration artifacts.
- `RUHROH_EVAL_CALIBRATION_CASES_JSON`: scenario calibration anchors.

Start from the scaffold:

```bash
pnpm exec ruhroh new-evaluator simple-newsletter
$EDITOR ruhroh/evaluators/simple-newsletter/run.sh
```

The scaffold writes valid `ruhroh_eval_result_v1` JSON with `status: "review"`
until you add scenario-specific checks. A minimal command evaluator can replace
the generated placeholder with logic like this:

```bash
cat > ruhroh/evaluators/simple-newsletter/run.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail

workspace="${RUHROH_EVAL_WORKSPACE_PATH:?}"
output="${RUHROH_EVAL_OUTPUT_PATH:?}"

if [[ -f "$workspace/index.html" ]] && grep -qi "newsletter" "$workspace/index.html"; then
  status="passed"
  goal_met=true
  score=1
  reason="The final workspace contains an index.html newsletter page."
else
  status="failed"
  goal_met=false
  score=0
  reason="The evaluator did not find an index.html newsletter page."
fi

cat > "$output" <<JSON
{
  "version": "ruhroh_eval_result_v1",
  "status": "$status",
  "goalMet": $goal_met,
  "confidence": "medium",
  "reasons": ["$reason"],
  "unmetCriteria": [],
  "evidenceRefs": [
    {
      "kind": "file",
      "ref": "index.html",
      "summary": "$reason"
    }
  ],
  "commandsRun": [],
  "artifacts": {
    "workspacePath": "$workspace"
  },
  "finalSummary": "$reason",
  "criteriaResults": [
    {
      "id": "newsletter-page",
      "description": "A newsletter page exists in the delivered workspace.",
      "status": "$status",
      "score": $score,
      "evidenceRefs": [
        {
          "kind": "file",
          "ref": "index.html",
          "summary": "$reason"
        }
      ]
    }
  ],
  "judge": {
    "kind": "command",
    "model": "simple-newsletter-evaluator",
    "version": "0.1.0"
  }
}
JSON
SH
chmod +x ruhroh/evaluators/simple-newsletter/run.sh
```

Use it by changing `RUHROH_EVAL_COMMAND`:

```bash
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/simple-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter custom-shell
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

For publishable evals, make the evaluator stricter than this toy example:

- run the project or relevant tests inside the copied eval workspace;
- inspect behavior, not just source text;
- return `review` when evidence is ambiguous;
- include `criteriaResults`, `evidenceRefs`, `commandsRun`, and judge metadata;
- keep private expected outputs in scenario private assets, not in the public
  prompt.

## Add Your Own Scenario

Once the adapter and evaluator are wired, add project-specific tasks:

```bash
pnpm exec ruhroh new-scenario cli-help-regression --scenario-dir ruhroh/scenarios
$EDITOR ruhroh/scenarios/cli-help-regression/instruction.md
$EDITOR ruhroh/scenarios/cli-help-regression/scenario.json
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --scenario cli-help-regression
```

Then lock the scenario into a suite:

```bash
pnpm exec ruhroh new-suite aider-smoke \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario cli-help-regression \
  --runs 5

pnpm exec ruhroh validate \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite aider-smoke
```

Run repeated samples when you are ready to compare agent versions or model
settings:

```bash
pnpm exec ruhroh \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite aider-smoke \
  --adapter custom-shell \
  --runs 5
```

## Review Results

After runs complete, keep the generated artifacts with the benchmark report:

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh compare ./path/to/results --suite aider-smoke --json
pnpm exec ruhroh compare ./path/to/results --suite aider-smoke --html ruhroh-report.html
```

Use `compare --run-plan .generated/ruhroh/ruhroh-run-plan.json` when you have
the generated run plan. It checks that result artifacts match the intended
scenario, adapter, sample, and seed matrix.

## What to Commit

For a project that keeps Ruhroh benchmarks in-tree, commit:

- `package.json` and lockfile changes for `@kestrel-agents/ruhroh`;
- `ruhroh/scenarios/**`;
- `ruhroh/suites/**`;
- `ruhroh/adapters/**`;
- `ruhroh/evaluators/**`;
- `ruhroh/schemas/**` if your team wants local editor and CI schemas.

Do not commit `.generated/`, raw run artifacts with secrets, or local model
credentials.
