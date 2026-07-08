---
id: ruhroh-distributed-runs
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - src/cli.ts
  - schemas/run-plan-v1.schema.json
  - examples/ci/ruhroh-sharded-collection.yml
---

# Distributed Runs

Ruhroh does not need to own your cloud runner to make distributed benchmark
collection auditable. Keep orchestration in CI or your batch system, and keep
Ruhroh responsible for the planned sample matrix, shard selection, preserved
artifacts, and publication gate.

Use this pattern when a repeated suite should run across several workers:

1. validate the benchmark pack;
2. create one canonical run plan without `--shard`;
3. run workers with the same scenario, suite, adapter, and `--runs` flags plus
   one distinct `--shard <index>/<total>` value;
4. upload every worker's Ruhroh result artifacts;
5. merge the artifacts into one result root;
6. run `validate-artifacts`, `compare --run-plan`, and `publish-check` against
   the merged root.

## Canonical Plan

Create the run plan before workers start:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite "$SUITE_ID" --json
pnpm exec ruhroh plan --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite "$SUITE_ID" --adapter "$ADAPTER" --runs "$RUNS" --json
```

Preserve `.generated/ruhroh/ruhroh-run-plan.json` as a CI artifact. This is the
claim's intended scenario/adapter/sample matrix. It should be the run plan you
later pass to `compare --run-plan` and `publish-check --run-plan`.

## Shard Collection

Each worker uses the same collection flags, then adds its shard:

```bash
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite "$SUITE_ID" --adapter "$ADAPTER" --runs "$RUNS" --shard "$SHARD_INDEX/$SHARD_TOTAL"
```

Shard workers produce disjoint planned samples. `RUHROH_RUN_COUNT` and sample
ids still reflect the full `--runs` cohort, so merged artifacts can be checked
against the canonical plan.

Copy the worker's preserved run artifact directories into a stable shard folder
before uploading them. The exact copy command depends on your Harbor runner and
artifact storage, but the uploaded tree should contain the complete directories
that include `ruhroh-loop-result.json`, `ruhroh-run-manifest.json`,
`ruhroh-loop-eval.json`, transcripts, event logs, and workspace archives.

## Merge And Gate

After downloading shard artifacts, merge them into one root and run:

```bash
pnpm exec ruhroh validate-artifacts results/ruhroh --json
pnpm exec ruhroh compare results/ruhroh --suite-dir ruhroh/suites --suite "$SUITE_ID" --run-plan .generated/ruhroh/ruhroh-run-plan.json --json
pnpm exec ruhroh publish-check results/ruhroh --suite-dir ruhroh/suites --suite "$SUITE_ID" --run-plan .generated/ruhroh/ruhroh-run-plan.json --bundle "ruhroh-publication/$SUITE_ID" --summary-md "$GITHUB_STEP_SUMMARY" --verify-sources --json
```

If a worker failed before uploading artifacts, the run-plan check reports the
missing planned samples. Do not silently shrink `--runs` after the fact; either
rerun the missing samples or record accepted infrastructure exclusions with a
rerun ledger and pass it to `compare --rerun-ledger` and
`publish-check --rerun-ledger`.

Use [examples/ci/ruhroh-sharded-collection.yml](../examples/ci/ruhroh-sharded-collection.yml)
as a GitHub Actions starting point. It keeps planning, sharded collection,
artifact merge, and publication readiness visible as separate jobs.
