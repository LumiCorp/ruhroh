---
layout: home

hero:
  name: Ruhroh
  text: Evidence-backed benchmarks for coding agents.
  tagline: Ask an agent to do real work, save what happened, and compare the finished result with evidence another person can inspect.
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
  - title: Outcome-focused
    details: Judge the finished project and the steps the agent took, not just whether a file contains expected text.
  - title: Bring your own agent
    details: Connect Codex, Claude Code, Aider, or another coding agent through a small command wrapper.
  - title: Evidence first
    details: Reports show the score, the saved evidence, review items, and why a result is or is not ready to publish.
---

## First commands

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow
```

Ruhroh is for teams who want coding-agent benchmarks that behave more like real user
requests: goals, constraints, files, agent attempts, and a review of the
finished work. The important output is not a raw task folder; it is a report
that explains what happened and why the score can or cannot be trusted.

## See The Reports First

Open the [sample workflow guide](/samples/ruhroh-workflow) before running
anything. It shows the path from the built-in no-credentials example to a
reviewable benchmark result. Then inspect the
[compare report](/samples/ruhroh-compare),
[publication packet compare](/samples/ruhroh-publication/ruhroh-compare),
and [claim index](/samples/ruhroh-claims). The sample is valid but not ready to
publish, so the first impression is the core product behavior: every score is
backed by evidence, and weak claims stay blocked.

## First Local Check

Start with the built-in no-credentials example. It proves that Ruhroh can load a
task, call an agent command, review the finished project, save evidence, and
write reports before you spend time connecting a live coding agent.

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

When Harbor is available, remove `--dry-run` to execute the built-in example.
After a real run, `ruhroh report`, `ruhroh review`, `ruhroh eval-quality`,
`ruhroh compare`, and `ruhroh publish-check` turn the saved evidence into a
reviewable benchmark result.

## Next steps

- [Getting Started](./getting-started.md): install, scaffold, and follow the
  full local workflow.
- [Publish a Benchmark Result](./benchmark-pack-tutorial.md): author a task, a
  review script, a repeat-run set, and a publication packet.
- [Core Concepts](./concepts.md): learn the Ruhroh terms in plain language.
- [Report Gallery](./report-gallery.md): inspect the generated HTML reports
  behind a benchmark result.
- [Write a Reviewer](./write-an-evaluator.md): make the result review
  evidence-backed before collecting publishable runs.
