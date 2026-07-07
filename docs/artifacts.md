---
id: ruhroh-artifacts
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/results.ts
  - python/ruhroh/loop_controller.py
---

# Artifacts

Ruhroh preserves the implementation journey and final judgment as Harbor
artifacts.

Core artifacts:

- `ruhroh-loop-result.json`: final Harbor-facing verdict.
- `ruhroh-loop-iterations.jsonl`: one implementation-run record per run-agent
  turn.
- `ruhroh-loop-journey.json`: full implementation journey summary.
- `ruhroh-loop-eval-input.json`: stable evaluator input with scenario context,
  rubric, guidance, workspace paths, and journey path.
- `ruhroh-loop-eval.json`: terminal eval-agent judgment.
- `ruhroh-workspace.tar.gz`: final implementation workspace snapshot.
- `ruhroh-loop-events.tar.gz`: per-iteration adapter event logs when available.
- `ruhroh-loop-transcripts.tar.gz`: per-iteration run-agent transcripts.

Adapter-specific artifacts may include bridge logs, prompts, transcripts, or
result files. They should be referenced from structured result metadata instead
of inferred by filename heuristics.

Generate a human-readable report from a result file or run directory:

```bash
pnpm exec ruhroh report ./ruhroh-loop-result.json
pnpm exec ruhroh report ./run-artifacts --json
```

The report includes scenario id, adapter, Harbor-facing score, eval status,
failure bucket, iteration count, duration, subscore table, unmet criteria,
commands run, and artifact paths.

Compare repeated runs by pointing at a directory containing result artifacts:

```bash
pnpm exec ruhroh compare ./results
pnpm exec ruhroh compare ./results --json
```

Comparison groups runs by scenario and adapter, then reports pass rate, mean
score, mean subscores, median duration, iteration distribution, and failure
bucket counts.
