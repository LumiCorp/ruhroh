---
id: ruhroh-benchmark-suites
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-07
depends_on:
  - src/suites.ts
  - suites/
---

# Benchmark Suites

Ruhroh suites are frozen benchmark-pack manifests. They group realistic
scenarios under a named methodology and governance record so results can be
reported against something more stable than an ad hoc tier filter.

List bundled suites:

```bash
pnpm exec ruhroh --list-suites
pnpm exec ruhroh --list-suites --json
```

Programmatic consumers can load the bundled pack manifests from the public API:

```ts
import {
  getBuiltinRuhrohSuiteById,
  getBuiltinRuhrohSuitesByScenarioId,
  loadBuiltinRuhrohSuites,
  resolveRuhrohBuiltinSuiteDir,
} from "@kestrel-agents/ruhroh";

const suiteDir = resolveRuhrohBuiltinSuiteDir();
const suites = loadBuiltinRuhrohSuites(suiteDir);
const smoke = getBuiltinRuhrohSuiteById("ruhroh-smoke", suiteDir);
const suitesCoveringNewsletter = getBuiltinRuhrohSuitesByScenarioId(
  "simple-newsletter",
  suiteDir,
);
```

Generate a suite:

```bash
pnpm exec ruhroh --suite ruhroh-smoke --generate-only
```

Run or dry-run a suite with an adapter:

```bash
pnpm exec ruhroh --suite ruhroh-productivity --adapter ./path/to/agent-wrapper.sh --dry-run
```

Validate suite membership and referenced scenarios:

```bash
pnpm exec ruhroh validate --suite ruhroh-data-apps
pnpm exec ruhroh validate --suite ruhroh-data-apps --json
```

Check local suite readiness alongside adapter/evaluator wiring:

```bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke --adapter ./adapters/my-agent.sh
```

Create a local suite from authored scenarios:

```bash
pnpm exec ruhroh new-suite local-data \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario csv-cleanup \
  --scenario shift-review \
  --runs 10
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
```

`new-suite` reads each selected scenario, freezes its
`metadata.scenarioVersion` in the suite manifest, and writes methodology plus
governance defaults for repeatable comparisons. Review the description,
acceptance criteria, contamination review, reward-hacking review, review
checklist, and deprecation policy before publishing the suite.

## Bundled Suites

- `ruhroh-smoke`: one small local-app scenario for install validation and
  adapter bring-up.
- `ruhroh-productivity`: stateful productivity app workflows such as budget
  planning, sprint planning, and task boards.
- `ruhroh-data-apps`: local app tasks that involve structured data assets,
  reconciliation, scheduling, review state, and export behavior.
- `ruhroh-maintenance`: larger stateful app tasks that stress continuation,
  repair, and post-failure diagnosis.

## Manifest Contract

Suite manifests live at:

```text
suites/<suite-id>/suite.json
```

They use `version: "ruhroh_suite_v1"` and include:

- `id`, `title`, `suiteVersion`, and `description`;
- ordered `scenarioIds`;
- `scenarioVersions`, mapping every suite scenario id to the scenario metadata
  version frozen by this suite version;
- methodology fields: `minRuns`, `aggregationUnit`, `reportPolicy`,
  `confidenceLevel`, and `retryPolicy`;
- governance fields: owner, changelog, acceptance criteria, contamination
  review, reward-hacking review, review checklist, and deprecation policy.

The package ships a structural JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/suite-v1.schema.json`; `ruhroh init`
also copies it to `ruhroh/schemas/suite-v1.schema.json`. Use it for editor
completion or CI shape checks before running `ruhroh validate`, which adds
scenario existence, scenario-version lock, and governance validation.

Published suite changes should bump `suiteVersion` whenever scenario membership,
locked scenario versions, assets, prompts, or acceptance criteria change.
`ruhroh validate --suite <id>` checks the suite locks against the current
scenario metadata when both trees are available. Validation requires non-empty
contamination review, reward-hacking review, review checklist, and deprecation
policy fields so a benchmark pack cannot be published without recording its
adversarial-review and lifecycle controls.

## Methodology

Ruhroh compares runs by scenario and adapter. A suite should define the minimum
sample size needed before its pass-rate summary is treated as more than
directional. Bundled suites use at least five runs for smoke checks and ten runs
for broader comparisons.

The standard report policy is:

- pass rate by scenario and adapter;
- Wilson 95% confidence interval;
- pass@k for repeated runs;
- mean score with deterministic bootstrap percentile 95% confidence interval,
  plus mean subscores;
- optional cost and token summaries from run manifests;
- failure buckets and preserved artifact links.

Use `ruhroh compare ./results --suite <suite-id>` for suite-level claims. The
suite option filters the result set to suite scenarios, reports suite metadata,
warns when member scenarios are missing, applies `methodology.minRuns`, and
checks aggregate scenario-version cohorts against the suite's `scenarioVersions`
locks.

Suite compares include an adapter-level rollup in `suiteAdapterSummaries`. Use
that rollup for high-level suite claims, but keep the per-scenario groups in the
report so differences can be debugged. The rollup reports run-weighted pass
rate, Wilson CI, mean scenario pass rate, missing scenarios, per-scenario run
counts, and whether every scenario reached the suite's minimum run count.

Suite compares also include `claimReadiness`. Treat
`claimReadiness.publishable: false` as a stop sign for public claims; its
blockers explain missing scenario coverage, unsatisfied min-run requirements,
statistical warnings, or required human review.

Do not retry ordinary agent failures inside a sample. Retry only when the run
manifest and artifacts show an external infrastructure failure.

For the full reporting and evaluator-governance rules, see
[Benchmark Methodology](/benchmark-methodology).
