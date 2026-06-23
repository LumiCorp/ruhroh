---
layout: home

hero:
  name: Ruhroh
  text: Real-user tasks for coding-agent evaluation.
  tagline: Generate Harbor-compatible benchmark tasks from realistic user scenarios, run agents through adapters, and judge delivered outcomes.
  image:
    src: /ruhroh/ruhroh-logo.png
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
  - title: Harbor-compatible
    details: Generate repeatable local Harbor task directories from portable JSON scenarios.
---

## First commands

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --list
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --generate-only
```

Ruhroh is for benchmark authors who want tasks that behave more like real user
requests: goals, constraints, assets, iteration evidence, and outcome judgment.
