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

Ruhroh is a focused benchmark framework for realistic user-task evaluation of
coding agents. It runs scenarios through adapters, preserves the full
implementation journey, and runs a terminal evaluator over the final delivered
workspace. Harbor compatibility is the execution substrate, not the benchmark
boundary.

## Components

- Ruhroh core: scenario discovery, scenario and suite validation, Harbor task
  generation, Harbor command construction, artifact naming, result typing, and
  verdict mapping.
- Package Harbor runtime: the installable Python controller used for portable
  custom-shell benchmarks.
- Run-agent adapter: the agent-specific bridge that starts or continues a
  coding agent in a benchmark workspace.
- Harbor: the execution substrate that installs the benchmark agent, runs the
  generated task, collects artifacts, and reads verifier reward output.
- Eval-agent: the terminal evaluator that inspects a copied final workspace and
  journey evidence after implementation is complete.
- Reporting layer: TypeScript helpers and CLI commands that normalize eval
  output, summarize run artifacts, validate artifact bundles, aggregate
  repeated runs, and export publishability evidence.

Kestrel is one reference run-agent adapter. It is not the benchmark itself.

## Lifecycle

1. Discover and validate JSON scenarios.
2. Generate Harbor task directories under `.generated/ruhroh/harbor/tasks`.
3. Run Harbor against the selected task.
4. The installed Ruhroh controller asks the selected run-agent adapter to work.
5. The adapter continues until it reports `goal_satisfied` or the iteration cap
   is reached.
6. Ruhroh writes `ruhroh-loop-eval-input.json` and the eval-agent reviews the
   full journey once.
7. Ruhroh normalizes the eval result and derives the binary Harbor verdict.
8. The generic Harbor verifier maps the structured Ruhroh result to reward.
9. Users inspect a single run with `ruhroh report` or aggregate repeated runs
   with `ruhroh compare`.

Ruhroh core does not perform brittle app-specific checks. Scenario-specific
judgment belongs in the rubric and evaluator evidence; Harbor compatibility
stays binary through `score` and the generic verifier.
