---
layout: home

hero:
  name: Ruhroh
  text: Realistic user-task benchmarks for coding agents.
  tagline: Run agents through adapters, preserve their implementation journeys, and compare delivered outcomes with auditable evidence.
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
    details: Evaluate finished workspaces and full implementation journeys instead of brittle source-text heuristics.
  - title: Agent-agnostic
    details: Bring your own run-agent adapter. Ruhroh owns scenarios, generation, runtime contracts, and artifacts.
  - title: Publishable claims
    details: Compare repeated runs with suites, run plans, artifact validation, confidence intervals, pass@k, and readiness gates.
---

## First commands

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
pnpm exec ruhroh first-run
pnpm exec ruhroh workflow
```

Ruhroh is for benchmark authors who want tasks that behave more like real user
requests: goals, constraints, assets, iteration evidence, and outcome judgment.
It remains Harbor-compatible, but the user-facing contract is the benchmark
pack and its evidence, not a Harbor task folder alone.

## See the evidence model

Open the [sample workflow guide](/ruhroh/samples/ruhroh-workflow.html) before running
anything. It shows a complete local fixture path, evaluator calibration, run
plan, comparison inputs, publication bundle, and claim index in one staged
artifact. Then inspect the [compare report](/ruhroh/samples/ruhroh-compare.html),
[publication bundle manifest](/ruhroh/samples/ruhroh-publication/manifest.json), and
[claim index](/ruhroh/samples/ruhroh-claims.html). The sample is structurally valid but
not publishable, so the first impression is the core product behavior: every
score is backed by evidence, and weak claims stay blocked.

## First proof loop

Start with the credential-free fixture path. It proves the scenario, suite,
adapter, evaluator, artifact, and report contracts before you spend time wiring
a live coding agent.

```bash
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke --adapter custom-shell
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite ruhroh-smoke
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

When Harbor is available, remove `--dry-run` to execute the fixture-backed
loop. After a real run, `ruhroh report`, `ruhroh review`, `ruhroh
eval-quality`, `ruhroh compare`, and `ruhroh publish-check` turn the preserved
artifacts into an inspectable claim workflow.

## Next steps

- [Getting Started](./getting-started.md): install, scaffold, and follow the
  full local workflow.
- [Benchmark Pack Tutorial](./benchmark-pack-tutorial.md): author a scenario,
  evaluator, suite, five-run plan, and publication packet.
- [Core Concepts](./concepts.md): learn the scenario, suite, adapter,
  evaluator, run-plan, artifact, and claim model.
- [Report Gallery](./report-gallery.md): inspect the generated HTML and JSON
  artifacts behind a claim.
- [Write an Evaluator](./write-an-evaluator.md): make outcome judgment
  evidence-backed before collecting publishable runs.
