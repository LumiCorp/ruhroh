---
id: ruhroh-architecture
domain: benchmarks
status: active
owner: kestrel-quality
last_verified_at: 2026-06-22
depends_on:
  - src/index.ts
  - python/ruhroh/loop_controller.py
---

# Ruhroh Architecture

Ruhroh is the Real-User Harness for Repair-Oriented Harbor. It runs real-user
task scenarios against coding agents through adapters, preserves the full
implementation journey, and runs a terminal evaluator over the final delivered
workspace.

## Components

- Ruhroh core: scenario discovery, scenario validation, Harbor task generation,
  Harbor command construction, artifact naming, result typing, and verdict
  mapping.
- Package Harbor runtime: the installable Python controller used for portable
  custom-shell benchmarks.
- Run-agent adapter: the agent-specific bridge that starts or continues a
  coding agent in a benchmark workspace.
- Harbor: the execution substrate that installs the benchmark agent, runs the
  generated task, collects artifacts, and reads verifier reward output.
- Eval-agent: the terminal evaluator that inspects a copied final workspace and
  journey evidence after implementation is complete.

Kestrel is one reference run-agent adapter. It is not the benchmark itself.

## Lifecycle

1. Discover JSON scenarios.
2. Generate Harbor task directories under `.generated/ruhroh/harbor/tasks`.
3. Run Harbor against the selected task.
4. The installed Ruhroh controller asks the selected run-agent adapter to work.
5. The adapter continues until it reports `goal_satisfied` or the iteration cap
   is reached.
6. The eval-agent reviews the full journey once.
7. The generic Harbor verifier maps the structured Ruhroh result to reward.

Ruhroh core does not perform brittle app-specific checks.
