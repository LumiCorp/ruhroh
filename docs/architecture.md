---
id: ruhroh-architecture
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/index.ts
  - python/ruhroh/loop_controller.py
---

# Ruhroh Architecture

Ruhroh is a focused way to test coding agents on realistic user tasks. It gives
an agent a task, saves the full attempt, reviews the finished project, and
writes reports another person can inspect. Harbor is the lower-level runner for
full executions; the benchmark boundary is the Ruhroh task, evidence, and
review result.

## Components

- Ruhroh core: finds task files, validates benchmark suites, prepares Harbor tasks,
  names evidence files, types results, and maps review results to scores.
- Package Harbor helper: the installable Python controller used for portable
  command-wrapper benchmarks.
- Agent connector: the bridge that starts or continues the coding agent in a
  benchmark project.
- Harbor: the lower-level runner that installs the benchmark agent, runs the
  generated task, collects evidence files, and reads verifier reward output.
- Eval agent: the reviewer command that inspects a copied final project and the
  saved journey after implementation is complete.
- Reporting layer: TypeScript helpers and CLI commands that normalize review
  output, summarize saved runs, validate evidence packets, aggregate repeated
  runs, and export publishability evidence.

Kestrel is one reference agent connector. It is not the benchmark itself.

## Lifecycle

1. Discover and validate JSON task definitions.
2. Generate Harbor task directories under `.generated/ruhroh/harbor/tasks`.
3. Run Harbor against the selected task.
4. The installed Ruhroh controller asks the selected agent connector to work.
5. The connector continues until it reports `goal_satisfied` or the iteration
   cap is reached.
6. Ruhroh writes `ruhroh-loop-eval-input.json` and the reviewer checks the full
   journey once.
7. Ruhroh normalizes the eval result and derives the binary Harbor verdict.
8. The generic Harbor verifier maps the structured Ruhroh result to reward.
9. Users inspect a single run with `ruhroh report` or aggregate repeated runs
   with `ruhroh compare`.

Ruhroh core does not perform brittle app-specific checks. Task-specific
judgment belongs in the review rules and evidence; Harbor compatibility stays
binary through `score` and the generic verifier.
