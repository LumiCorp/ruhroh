---
layout: home

hero:
  name: Ruhroh
  text: Did the coding agent actually build the thing?
  tagline: Run agents on realistic software tasks, check the finished project, and keep the logs, files, and reports behind every score.
  image:
    light: /ruhroh-logo.png
    dark: /ruhroh-logo-dark.png
    alt: Ruhroh logo
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View Sample Evidence
      link: /report-gallery
    - theme: alt
      text: npm
      link: https://www.npmjs.com/package/@kestrel-agents/ruhroh

features:
  - title: Real tasks
    details: Write tasks that read like user requests, not tiny filename or route checks.
  - title: Real evidence
    details: Keep what the agent tried, what it changed, how it was checked, and where the final files are.
  - title: Defensible scores
    details: Compare repeated runs and see when a result is strong enough to cite.
---

## First commands

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow
```

Ruhroh is for teams and benchmark authors who need a clearer answer than “the
agent passed.” It helps you ask three questions:

- Did the agent finish the requested software task?
- How do we know?
- Can someone else inspect or rerun the result?

## How Ruhroh works

1. Write a realistic task.
2. Run one or more coding agents.
3. Check the finished project.
4. Compare results and keep the evidence.

The deeper machinery is still there when you need it: adapters, Harbor
execution, versioned suites, evaluator calibration, source hashes, and
publication bundles. You do not need to understand all of that to start. The
first useful loop is a local sample run with a report you can inspect.

## See what a result looks like

Open the [sample workflow guide](/ruhroh/samples/ruhroh-workflow.html) before
running anything. It shows the path from a first local run to a result that is
safe to cite. Then inspect the [compare report](/ruhroh/samples/ruhroh-compare.html),
[publication bundle manifest](/ruhroh/samples/ruhroh-publication/manifest.json),
and [claim index](/ruhroh/samples/ruhroh-claims.html).

The sample is intentionally too small to publish. That is the point: every score
should have evidence behind it, and weak scores should be blocked before anyone
cites them.

## First local run

Start with the credential-free fixture path. It proves that Ruhroh can run a
sample task, check the finished project, and write a report before you spend
time wiring a live coding agent.

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

When Harbor is available, remove `--dry-run` to execute the fixture-backed
loop. After a real run, `ruhroh report`, `ruhroh review`, `ruhroh
eval-quality`, `ruhroh compare`, and `ruhroh publish-check` turn the saved
files into an inspectable benchmark result.

## Next steps

- [Getting Started](./getting-started.md): install, scaffold, and follow the
  full local workflow.
- [Benchmark Pack Tutorial](./benchmark-pack-tutorial.md): write a task,
  checker, suite, five-run plan, and result packet.
- [Core Concepts](./concepts.md): learn the names Ruhroh uses for tasks,
  agents, checkers, saved files, and published results.
- [Report Gallery](./report-gallery.md): inspect the generated HTML and JSON
  files behind a benchmark result.
- [Write an Evaluator](./write-an-evaluator.md): write a checker that explains
  why the finished project passed, failed, or needs review.
