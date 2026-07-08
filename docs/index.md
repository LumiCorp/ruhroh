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
      text: Write a Scenario
      link: /write-a-scenario
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
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --list
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --generate-only
```

Ruhroh is for benchmark authors who want tasks that behave more like real user
requests: goals, constraints, assets, iteration evidence, and outcome judgment.
It remains Harbor-compatible, but the user-facing contract is the benchmark
pack and its evidence, not a Harbor task folder alone.
