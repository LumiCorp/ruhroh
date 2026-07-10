---
id: ruhroh-getting-started
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-09
depends_on:
  - README.md
  - package.json
---

<script setup lang="ts">
import { withBase } from "vitepress";
</script>

# Getting Started

Ruhroh helps you improve coding-agent loops by making each run inspectable and
each comparison defensible. The fastest way to understand it is to run the
credential-free example, inspect the saved evidence, and then replace one piece
of the loop with your own task, agent, or reviewer.

That `Run -> Inspect -> Compare -> Improve` cycle is **loop engineering**.

<ol class="rr-loop rr-loop-compact" aria-label="The Ruhroh engineering loop">
  <li><span class="rr-step-number">1</span><div><strong>Run</strong><p>Execute a realistic software task.</p></div></li>
  <li><span class="rr-step-number">2</span><div><strong>Inspect</strong><p>Review the outcome and its evidence.</p></div></li>
  <li><span class="rr-step-number">3</span><div><strong>Compare</strong><p>Repeat under controlled conditions.</p></div></li>
  <li><span class="rr-step-number">4</span><div><strong>Improve</strong><p>Change the loop and run again.</p></div></li>
</ol>

## What The Sample Demonstrates

The public sample contains two runs of the same newsletter task. One delivers
the required three stories and passes. The other creates a page with only one
story and fails with `goal_mismatch`.

The resulting 50% pass rate is visible, but it is not publishable: the suite
requires five runs, an evaluator-quality warning remains, and one run is
recommended for review. Open the [compare report](/samples/ruhroh-compare),
[review queue](/samples/ruhroh-review), or [claim index](/samples/ruhroh-claims)
to see the result, evidence, and blockers as a reader would.

## 1. Install And Scaffold

Install Ruhroh in the project where you want to evaluate coding-agent work:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
```

`init` creates a local `ruhroh/` directory containing:

- a realistic example task and version-locked suite;
- a no-credentials fixture agent command;
- a no-credentials fixture reviewer command;
- the public schemas and a starter README.

It is safe to rerun when files are unchanged and refuses to overwrite local
edits.

## 2. Connect The Fixture Loop

Point Ruhroh at the generated example agent and reviewer:

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh first-run
```

`first-run` is read-only. It checks the scaffold, task, suite, exported
commands, and Harbor installation, then prints the exact next action. A missing
requirement remains visible as a blocker instead of failing later during an
expensive run.

When Harbor is unavailable, this command can still verify that the local files
and commands are ready for a dry-run preview:

```bash
pnpm exec ruhroh first-run --allow-dry-run --json
```

A dry run previews the Harbor command. It does not execute an agent, produce a
real `ruhroh-loop-result.json`, or count as a completed loop. See
[Local Fixture Run](./local-fixture-run.md) for the full readiness matrix and
[Troubleshooting](./troubleshooting.md) when a check remains blocked.

## 3. Run The Example

When `first-run` reports that the full loop is ready, execute the fixture:

```bash
pnpm exec ruhroh run \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell
```

Ruhroh generates the Harbor task, starts the selected agent command, runs the
reviewer against the finished workspace, and preserves the run evidence. It
also writes a run plan so later reports can compare the completed result with
the intended task, adapter, sample, and seed.

## 4. Inspect What Happened

Ask `workflow` what evidence exists and what the next useful step is:

```bash
pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

For a saved run directory, the inspection commands answer different questions:

| Question | Command |
| --- | --- |
| Did this run deliver the outcome? | `ruhroh report <run>` |
| Did the reviewer support its judgment? | `ruhroh eval-quality <run>` |
| Does a person need to inspect anything? | `ruhroh review <results>` |
| What changes across repeated runs? | `ruhroh compare <results>` |
| Is the aggregate ready to share? | `ruhroh publish-check <results>` |

See [Evidence Files](./artifacts.md) for the reviewer path and the
[Report Gallery](./report-gallery.md) for generated examples of each view.

## 5. Replace One Piece

The fixture proves the plumbing. The next useful step depends on what you want
to improve:

<div class="rr-path-grid">
  <a :href="withBase('/add-to-existing-project')"><strong>Evaluate your agent</strong><span>Use an existing project, connect a live coding-agent command, and preserve its run metadata.</span></a>
  <a :href="withBase('/write-a-scenario')"><strong>Evaluate your work</strong><span>Write a realistic task with outcome rules and evidence requirements.</span></a>
  <a :href="withBase('/write-an-evaluator')"><strong>Evaluate your reviewer</strong><span>Replace the fixture judgment and calibrate it against known pass, fail, and review cases.</span></a>
</div>

Change one part first. Keeping the task, reviewer, and execution conditions
stable makes it easier to understand whether a new agent or prompt actually
improved the result.

## 6. Collect A Comparable Cohort

Once your task, agent connector, and reviewer are ready, freeze the task set in
a suite and create the intended run matrix before collection:

```bash
pnpm exec ruhroh plan \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite <suite-id> \
  --adapter ./ruhroh/adapters/<agent>/run.sh \
  --runs 5
```

Use the same selection with `ruhroh run`, then compare the completed result root
against `.generated/ruhroh/ruhroh-run-plan.json`. Ruhroh will surface missing
samples, mixed versions, weak reviewer evidence, low sample counts, and other
conditions that make the comparison difficult to defend.

Follow [Publish a Benchmark Result](./benchmark-pack-tutorial.md) for the full
task-to-publication workflow. Use the [CLI Reference](./cli-reference.md) for
all flags, JSON contracts, and exit codes.

## Choose The Next Guide

| Goal | Guide |
| --- | --- |
| Add Ruhroh to a real codebase | [Add to Existing Project](./add-to-existing-project.md) |
| Author a task and reviewer | [Publish a Benchmark Result](./benchmark-pack-tutorial.md) |
| Understand Ruhroh terminology | [Core Concepts](./concepts.md) |
| Diagnose one or more runs | [Evidence Files](./artifacts.md) |
| Understand statistical and governance rules | [Benchmark Methodology](./benchmark-methodology.md) |
| Create a portable result | [Publish Claims](./publish-claims.md) |
