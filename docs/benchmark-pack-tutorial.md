---
id: ruhroh-benchmark-pack-tutorial
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/getting-started.md
  - docs/write-a-scenario.md
  - docs/write-an-evaluator.md
  - docs/benchmark-suites.md
  - docs/publish-claims.md
---

# Benchmark Pack Tutorial

This tutorial is the shortest complete path from a local Ruhroh starter to an
audit-ready benchmark pack. It shows the intended progression:

```text
fixture proof -> scenario -> evaluator -> suite -> run plan -> five runs -> claim packet
```

Use the fixture pieces first. They prove Ruhroh is wired correctly before you
spend model time on live agents.

## 1. Prove The Local Loop

Scaffold the starter and run the read-only readiness checks:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

Wire the credential-free fixture adapter and evaluator:

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
export RUHROH_RUN_AGENT_COMPLETION_PROTOCOL=json-final-line
```

Check the starter pack:

```bash
pnpm exec ruhroh doctor \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --adapter custom-shell

pnpm exec ruhroh validate \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke
```

Preview the run without writing tasks, a run plan, or artifacts:

```bash
pnpm exec ruhroh run \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell \
  --dry-run
```

When Harbor is installed, remove `--dry-run` to create a real preserved result:

```bash
pnpm exec ruhroh run \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell
```

Rerun `workflow` after the real loop so the guide can see the preserved
`ruhroh-loop-result.json` and advance to authoring.

## 2. Author A Scenario

Create a new task that reads like a real user request:

```bash
pnpm exec ruhroh new-scenario csv-cleanup --scenario-dir ruhroh/scenarios
```

Edit `ruhroh/scenarios/csv-cleanup/instruction.md` so it describes the outcome,
context, constraints, and acceptance criteria. Keep implementation details out
unless they are truly part of the user request.

Then edit `scenario.json`:

- set `metadata.scenarioVersion`;
- fill in provenance, difficulty, contamination notes, and maintainers;
- refine `evaluation.scenarioContext`, `goalRubric`, and `evidenceGuidance`;
- add pass, fail, and review calibration anchors when the task is moving toward
  a shared pack.

Validate before writing an evaluator:

```bash
pnpm exec ruhroh validate \
  --scenario-dir ruhroh/scenarios \
  --scenario csv-cleanup
```

## 3. Write And Calibrate The Evaluator

Scaffold an evaluator:

```bash
pnpm exec ruhroh new-evaluator csv-cleanup-evaluator --template deterministic
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/csv-cleanup-evaluator/run.sh"
```

The generated evaluator is intentionally conservative. Edit `run.sh` so it
inspects the final workspace and writes evidence-rich `ruhroh_eval_result_v1`
JSON. Good evaluators cite files, commands, transcripts, screenshots, or
workspace artifacts that prove the delivered outcome.

Run calibration before collecting repeated samples:

```bash
pnpm exec ruhroh calibrate-evaluator \
  --scenario-dir ruhroh/scenarios \
  --scenario csv-cleanup
```

Keep the generated calibration report:

```text
.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json
```

`workflow`, `publish-check`, and reviewers use that report to distinguish an
evaluator that was merely configured from one whose pass/fail/review behavior
was tested against scenario anchors.

## 4. Freeze A Suite

Create a version-locked suite with at least five runs for a smoke claim:

```bash
pnpm exec ruhroh new-suite csv-smoke \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario csv-cleanup \
  --runs 5
```

Review `ruhroh/suites/csv-smoke/suite.json` and replace placeholder governance
text with pack-specific methodology:

- why five runs are enough for this smoke claim;
- retry and infrastructure-exclusion policy;
- contamination and reward-hacking review;
- human-review expectations;
- deprecation policy.

Run pack preflight:

```bash
pnpm exec ruhroh inspect-pack \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --require-calibrated \
  --require-risk-reviewed \
  --html ruhroh-pack-inspection.html \
  --json > ruhroh-pack-inspection.json
```

Fix blockers before live collection. The strict command above turns placeholder
contamination or reward-hacking review into blockers so a public pack cannot be
accepted on metadata placeholders alone.

## 5. Select An Adapter

Use the fixture adapter for local mechanics, or scaffold a live wrapper:

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh new-adapter codex-local --template codex-cli
pnpm exec ruhroh doctor \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite csv-smoke \
  --adapter ./ruhroh/adapters/codex-local/run.sh
```

Before repeated live runs, `doctor` should report adapter metadata as ready for
comparison: `adapterVersion`, model identity, and artifact paths should be
available from the wrapper result file.

## 6. Plan And Collect Five Runs

Create the run plan first:

```bash
pnpm exec ruhroh plan \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite csv-smoke \
  --adapter ./ruhroh/adapters/codex-local/run.sh \
  --runs 5 \
  --json
```

Preserve `.generated/ruhroh/ruhroh-run-plan.json`. It is the intended
scenario, adapter, sample, and seed matrix for the claim.

Collect the planned cohort:

```bash
pnpm exec ruhroh run \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite csv-smoke \
  --adapter ./ruhroh/adapters/codex-local/run.sh \
  --runs 5
```

For expensive runs, split the same planned cohort across workers with
`--shard <index>/<total>`, then merge the preserved artifact directories before
comparison.

## 7. Inspect Evidence Before Publishing

Inspect individual runs and aggregate results:

```bash
pnpm exec ruhroh validate-artifacts ./path/to/results --json
pnpm exec ruhroh report ./path/to/results --html ruhroh-report.html
pnpm exec ruhroh review ./path/to/results --html ruhroh-review.html
pnpm exec ruhroh eval-quality ./path/to/results --html ruhroh-eval-quality.html
pnpm exec ruhroh compare ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite csv-smoke \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --html ruhroh-compare.html
```

Do not cite the score yet. These commands are for inspection: missing artifacts,
review items, evaluator-quality warnings, mixed scenario versions, or run-plan
mismatches should be fixed first.

## 8. Publish-Check The Claim

Create the publication packet:

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite csv-smoke \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --bundle ruhroh-publication/csv-smoke \
  --verify-sources
```

Exit codes:

- `0`: the claim is structurally valid and publishable;
- `1`: inputs are malformed or unreadable;
- `2`: evidence is readable, but methodology or readiness blockers remain.

Validate the packet after moving or archiving it:

```bash
pnpm exec ruhroh validate-bundle ruhroh-publication/csv-smoke --json
pnpm exec ruhroh claim-index ruhroh-publication \
  --html ruhroh-claims.html \
  --json > claim-index.json
```

The bundle is the evidence artifact to share with reviewers. It contains the
claim, summary, compare report, review queue, eval-quality report, manifest,
README, copied source evidence, hashes, run plan, and calibration report when
present.

## What Good Looks Like

Before sharing a score, you should be able to answer yes to each question:

- Did the scenario describe a real outcome rather than a source-text proxy?
- Did the evaluator pass calibration anchors?
- Did the suite freeze scenario versions and methodology?
- Did every planned sample either produce artifacts or appear in an accepted
  rerun ledger?
- Did `compare --run-plan` report no cohort mismatch?
- Did `publish-check --verify-sources` pass without blockers?
- Can a reviewer open the publication bundle and inspect the sources behind the
  score without the original workspace?

If not, keep the result private or experimental until the missing evidence is
fixed.
