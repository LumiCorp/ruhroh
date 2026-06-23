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
- `ruhroh-loop-eval.json`: terminal eval-agent judgment.
- `ruhroh-workspace.tar.gz`: final implementation workspace snapshot.
- `ruhroh-loop-events.tar.gz`: per-iteration adapter event logs when available.
- `ruhroh-loop-transcripts.tar.gz`: per-iteration run-agent transcripts.

Adapter-specific artifacts may include bridge logs, prompts, transcripts, or
result files. They should be referenced from structured result metadata instead
of inferred by filename heuristics.
