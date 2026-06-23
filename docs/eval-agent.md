---
id: ruhroh-eval-agent
domain: benchmarks
status: active
owner: kestrel-quality
last_verified_at: 2026-06-22
depends_on:
  - src/results.ts
---

# Eval-Agent

The eval-agent is terminal-only in V1. It runs after the implementation loop,
not after every run-agent turn.

Inputs include:

- original task;
- scenario context and rubric;
- implementation run ids;
- transcripts, event logs, and bridge logs when available;
- copied final workspace;
- implementation stop reason.

The eval-agent may inspect files, run commands, start the app, and gather
evidence. It must not mutate the original implementation workspace.

Expected output is `ruhroh_eval_result_v1` with status `passed`, `failed`,
`review`, or `infra_failed`. Only `passed` maps to a passing Harbor reward.

Ruhroh core never treats source keywords, required generic filenames, or generic
routes as app success proxies.
