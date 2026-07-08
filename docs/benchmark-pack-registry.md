---
id: ruhroh-benchmark-pack-registry
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - src/pack.ts
  - src/cli.ts
  - docs/claim-registry.md
  - examples/ci/ruhroh-pack-registry.yml
---

# Benchmark Pack Registry

A benchmark pack registry is the upstream catalog of scenarios and suites that
are allowed to produce credible Ruhroh claims. It is different from a claim
registry: pack registry checks happen before live agent runs; claim registry
checks happen after result artifacts exist.

Use the pack registry gate when reviewing a new local pack, accepting a
third-party contribution, or deciding whether a suite is ready for repeated
collection.

## Registry Unit

A registry-ready pack contains:

- `ruhroh/scenarios/<id>/scenario.json`;
- `instruction.md` and declared public assets for each scenario;
- evaluator context, rubric, evidence guidance, and calibration cases;
- optional private evaluator assets referenced from scenario metadata;
- `ruhroh/suites/<id>/suite.json` with scenario version locks;
- methodology and governance fields for sample size, retry policy,
  contamination review, reward-hacking review, human review, and deprecation.

The pack does not need result artifacts yet. Result artifacts are checked later
with `publish-check` and `claim-index`.

## Preflight Gate

Run the same gate locally and in CI:

```bash
pnpm exec ruhroh validate \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --json

pnpm exec ruhroh inspect-pack \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --require-calibrated \
  --require-risk-reviewed \
  --html ruhroh-pack-inspection.html \
  --json > ruhroh-pack-inspection.json
```

`inspect-pack --require-calibrated --require-risk-reviewed` exits nonzero when
the pack has validation blockers, calibration readiness gaps, or missing
contamination/reward-hacking review. A passing inspection means the pack is
coherent enough to collect runs; it does not mean any benchmark claim is
publishable.

The inspection JSON is versioned as `ruhroh_benchmark_pack_inspection_v1` and
includes:

- scenario and suite catalogs;
- validation blockers and warnings;
- evaluator lint details;
- calibration expected-status coverage;
- scenario manifest, prompt, public asset, and private evaluator asset
  fingerprints.

Validation treats declared `assets` as the agent-visible allowlist and
`evaluation.privateAssets` as evaluator-only material. A pack is invalid when a
private evaluator asset overlaps a public asset declaration, for example when
`assets: ["assets"]` would copy a held-out file under `assets/private/`.

Keep the inspection JSON and HTML report with the registry review. The JSON is
the stable machine contract; the HTML report is the fast human review surface
for readiness, suite locks, calibration state, and content fingerprints.

## Review Checklist

Before accepting a pack:

1. Confirm every scenario prompt is a realistic user outcome, not a hidden file
   or source-text proxy.
2. Confirm scenarios are adapter-neutral and do not assume one agent runtime.
3. Confirm the suite freezes scenario versions with `scenarioVersions`.
4. Confirm methodology states minimum run counts and retry policy.
5. Confirm calibration anchors cover pass, fail, and review outcomes unless the
   pack documents why one status is not applicable.
6. Confirm the `inspect-pack` difficulty mix matches the intended benchmark
   audience and is not accidentally all smoke or all expert work.
7. Confirm the `inspect-pack` expected runtime estimate is realistic for the
   planned `minRuns` count and reviewer budget.
8. Confirm evaluator evidence guidance tells reviewers which artifacts,
   commands, screenshots, transcripts, or generated files matter.
9. Confirm private evaluator assets are not inside any public asset declaration;
   use narrower public asset paths or move held-out material outside the public
   asset tree.
10. Confirm contamination and reward-hacking notes are specific enough for
   public review; `inspect-pack --require-risk-reviewed` fails missing or
   placeholder review text.
11. Confirm `inspect-pack --require-calibrated --require-risk-reviewed --html ruhroh-pack-inspection.html --json`
   passes and both inspection artifacts are uploaded.

If any item fails, keep the pack private or experimental until it is fixed.

## From Pack To Claim

After a pack passes registry preflight:

1. create one run plan with `ruhroh plan`;
2. collect repeated runs with the selected adapters;
3. preserve every run artifact directory;
4. run `publish-check` with the suite and run plan;
5. archive the publication bundle;
6. add the bundle to a claim registry with `claim-index --require-publishable`.

Use [Distributed Runs](./distributed-runs.md) when the collection needs several
workers, and [Claim Registry](./claim-registry.md) when publishing the resulting
claims.

## CI Template

Use [examples/ci/ruhroh-pack-registry.yml](../examples/ci/ruhroh-pack-registry.yml)
as a starting point. It runs validation, strict pack inspection, and uploads
`ruhroh-pack-inspection.json` plus `ruhroh-pack-inspection.html` for review.
Pair it with branch protection on benchmark-pack pull requests so new scenarios
cannot enter the shared corpus without version locks and calibration coverage.
