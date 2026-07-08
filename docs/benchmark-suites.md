---
id: ruhroh-benchmark-suites
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - src/suites.ts
  - suites/
---

# Benchmark Suites

Ruhroh benchmark suites are frozen benchmark manifests. They group realistic tasks
under a named methodology and governance record so results can be reported
against something more stable than an ad hoc filter.

List bundled suites:

```bash
pnpm exec ruhroh list-suites
pnpm exec ruhroh list-suites --json
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
pnpm exec ruhroh generate --suite ruhroh-smoke
```

Run or dry-run a benchmark suite with an agent connector:

```bash
pnpm exec ruhroh run --suite ruhroh-productivity --adapter ./path/to/agent-wrapper.sh --dry-run
```

Validate benchmark-suite membership and referenced tasks:

```bash
pnpm exec ruhroh validate --suite ruhroh-data-apps
pnpm exec ruhroh validate --suite ruhroh-data-apps --json
```

Check local benchmark-suite readiness alongside agent/reviewer wiring:

```bash
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke --adapter ./adapters/my-agent.sh
```

Create a local benchmark suite from authored tasks:

```bash
pnpm exec ruhroh new-suite local-data \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario csv-cleanup \
  --scenario shift-review \
  --runs 10
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-data
```

`new-suite` reads each selected task, freezes its
`metadata.scenarioVersion` in the benchmark-suite manifest, and writes methodology plus
governance defaults for repeatable comparisons. Review the description,
acceptance criteria, contamination review, reward-hacking review, review
checklist, and deprecation policy before publishing the benchmark suite.

## Built-In Benchmark Suites

- `ruhroh-smoke`: one small local-app task for install validation and
  connector bring-up.
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
- `scenarioVersions`, mapping every task id to the task metadata version frozen
  by this benchmark-suite version;
- methodology fields: `minRuns`, `aggregationUnit`, `reportPolicy`,
  `confidenceLevel`, and `retryPolicy`;
- governance fields: owner, changelog, acceptance criteria, contamination
  review, reward-hacking review, review checklist, and deprecation policy.

The package ships a structural JSON Schema at
`node_modules/@kestrel-agents/ruhroh/schemas/suite-v1.schema.json`; `ruhroh init`
also copies it to `ruhroh/schemas/suite-v1.schema.json`. Use it for editor
completion or CI shape checks before running `ruhroh validate`, which adds task
existence, task-version lock, and governance validation.

Published benchmark-suite changes should bump `suiteVersion` whenever task membership,
locked task versions, assets, prompts, or acceptance criteria change.
`ruhroh validate --suite <id>` checks the benchmark-suite locks against the current
task metadata when both trees are available. Validation requires non-empty
contamination review, reward-hacking review, review checklist, and deprecation
policy fields so a benchmark pack cannot be published without recording its
adversarial-review and lifecycle controls.

## Benchmark Suite Versioning

Treat `suiteVersion` as the benchmark methodology version. It is the
version a claim cites when it says "these runs were collected against this
benchmark suite."

Bump `suiteVersion` when you:

- add, remove, reorder, or replace tasks;
- move a suite lock to a new `metadata.scenarioVersion`;
- change `methodology.minRuns`, retry policy, aggregation unit, or report
  policy;
- change acceptance criteria, contamination review, reward-hacking review,
  review checklist, or deprecation policy in a way that affects publication
  readiness;
- change private reviewer files or calibration expectations for tasks in
  the benchmark suite.

You do not need a suite bump for typo fixes, owner/contact updates, or
non-semantic wording changes that do not affect task locks, methodology,
or governance decisions. Still add a changelog note when the suite is public so
reviewers can distinguish harmless metadata maintenance from benchmark drift.

Before publishing results for a changed benchmark suite:

1. Update `suiteVersion` and the suite changelog.
2. Re-run `ruhroh validate --scenario-dir <dir> --suite-dir <dir> --suite <id>`.
3. Re-run `ruhroh inspect-pack --require-calibrated --require-risk-reviewed`.
4. Generate a new run plan for the changed suite version.
5. Collect a fresh cohort; do not mix results from old and new benchmark-suite versions in
   one published claim.
6. Run `ruhroh publish-check --suite <id> --run-plan <plan> --bundle <dir>
   --verify-sources` and archive the bundle.

Old claims remain inspectable if their publication packet keeps the old benchmark-suite
manifest, task version locks, run plan, source hashes, and saved results. They
should not be silently reinterpreted as results for the newer benchmark suite.

## Methodology

Ruhroh compares runs by task and agent connector. A benchmark suite should define the minimum
sample size needed before its pass-rate summary is treated as more than
directional. Bundled suites use at least five runs for smoke checks and ten runs
for broader comparisons.

The standard report policy is:

- pass rate by task and agent connector;
- Wilson 95% confidence interval;
- pass@k for repeated runs;
- mean score with deterministic bootstrap percentile 95% confidence interval,
  plus mean subscores;
- optional cost and token summaries from run manifests;
- failure buckets and saved evidence links.

Use `ruhroh compare ./results --suite <suite-id>` for benchmark-suite claims. The
suite option filters the result set to benchmark-suite members, reports benchmark-suite metadata,
warns when member tasks are missing, applies `methodology.minRuns`, and
checks aggregate task-version cohorts against the suite's `scenarioVersions`
locks.
See [Task Versioning](./scenario-evolution.md) before moving a benchmark suite to a
new task version.

Task-set compares include an agent-level rollup in `suiteAdapterSummaries`. Use
that rollup for high-level claims, but keep the per-task groups in the
report so differences can be debugged. The rollup reports run-weighted pass
rate, Wilson CI, mean task pass rate, missing tasks, per-task run counts, and
whether every task reached the benchmark suite's minimum run count.

Suite compares also include `claimReadiness`. Treat
`claimReadiness.publishable: false` as a stop sign for public claims; its
blockers explain missing scenario coverage, unsatisfied min-run requirements,
statistical warnings, or required human review.

Do not retry ordinary agent failures inside a sample. Retry only when the run
manifest and artifacts show an external infrastructure failure.

For the full reporting and reviewer-governance rules, see
[Benchmark Methodology](/benchmark-methodology).
