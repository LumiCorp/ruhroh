---
id: ruhroh-evaluator-cookbook
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/write-an-evaluator.md
  - docs/eval-agent.md
  - src/cli.ts
---

# Reviewer Recipes

Reviewer commands are the trust boundary for Ruhroh scores. Start from the
template that matches the evidence you can defend:

```bash
pnpm exec ruhroh new-evaluator deterministic-eval --template deterministic
pnpm exec ruhroh new-evaluator model-eval --template model
pnpm exec ruhroh new-evaluator hybrid-eval --template hybrid
```

All templates write valid `ruhroh_eval_result_v1` JSON and avoid false passes
before you configure task-specific checks.

## Deterministic

Use `--template deterministic` when the scenario can be checked with files,
commands, local HTTP requests, or browser probes.

Good uses:

- static pages that must contain visible sections;
- apps that must expose a route or write an export file;
- CLI tools that must transform an input fixture into an expected output;
- persistence checks that can run against a local store.

Edit `required_files`, `required_text`, and any command probes in `run.sh`.
Deterministic checks should cite concrete evidence and should fail if the final
workspace is only prose, a starter template, or a hard-coded happy path.

## Model

Use `--template model` when outcome quality requires judgment that cannot be
captured by simple checks. Set:

```bash
export RUHROH_EVAL_MODEL_COMMAND="./judge-command"
export RUHROH_EVAL_MODEL="my-eval-model"
export RUHROH_EVAL_MODEL_VERSION="2026-07-08"
```

The judge command receives JSON on stdin and should return JSON with:

- `status`: `passed`, `failed`, or `review`;
- `reasons`;
- optional `unmetCriteria`, `criteriaResults`, `subscores`, and
  `finalSummary`.

Use calibration cases to keep model-backed judgments consistent. Return
`review` when evidence is ambiguous or the judge output is not structured.
Before collecting benchmark runs, run:

```bash
pnpm exec ruhroh calibrate-evaluator --scenario my-task --json
```

The command invokes `RUHROH_EVAL_COMMAND` once per calibration case and checks
the evaluator's returned status against the anchor's `expectedStatus`.

## Hybrid

Use `--template hybrid` for higher-stakes scenarios. The pattern is:

1. Run deterministic gates first.
2. Ask a model or human-assisted judge to adjudicate behavior that remains
   subjective.
3. Emit `judgeVotes` so Ruhroh can compute judge agreement.
4. Send disagreement to `ruhroh review` before publication.

Hybrid evaluators are the safest default for public benchmark packs when a
simple deterministic check would miss meaningful user-outcome quality.

## Publication Bar

Before using any reviewer for a claim:

1. Run `ruhroh validate --json` and inspect the scenario `calibration` summary.
2. Run `ruhroh calibrate-evaluator --scenario <id>` and fix any mismatched
   anchors.
3. Run one fixture or local sample and inspect `ruhroh report`.
4. Use `ruhroh review` to resolve weak evidence or judge disagreement.
5. Use `ruhroh publish-check` before citing the result.

Ruhroh treats weak evidence, missing judge metadata, disagreement, and required
human review as publication risks because the benchmark score is only as
credible as the reviewer that produced it.
