---
name: Scenario request
about: Propose a new realistic Ruhroh scenario or benchmark-pack addition.
title: "[scenario] "
labels: scenario
---

## User goal

Describe the task as a real user would ask for it.

## Why this scenario matters

## Assets or seed data

## Evaluation rubric

What should the evaluator consider a successful final workspace?

## Calibration anchors

List at least one expected `passed`, `failed`, and `review` case, or explain
why a status does not apply.

## Benchmark pack fit

- Proposed suite:
- Scenario version:
- Difficulty:
- Expected runtime:
- Minimum run count:

## Registry evidence

Before a pack can be accepted, it should pass:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --json
pnpm exec ruhroh inspect-pack --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --require-calibrated --require-risk-reviewed --json
```

Attach the inspection JSON or HTML when available.

## Notes

Avoid required filenames, routes, or source-text checks unless they are genuinely
part of the user request. Include contamination and reward-hacking review notes
for public or shared benchmark packs.
