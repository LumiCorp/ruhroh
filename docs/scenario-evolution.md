---
id: ruhroh-scenario-evolution
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/scenario-format.md
  - docs/benchmark-suites.md
  - src/scenarios.ts
  - src/suites.ts
---

# Task Versioning

Task versions are part of Ruhroh's evidence model. A benchmark claim is only
defensible when readers can tell which prompt, assets, rubric, calibration
cases, private reviewer files, and governance notes were used.

Use `metadata.scenarioVersion` for the task content version. This is
separate from `version: "ruhroh_scenario_v2"`, which is the schema version.
For JSON artifact compatibility and schema migration policy, see
[Contract Evolution](./contract-evolution.md).

## When To Bump

Patch version:

- typo fixes that do not change the task, rubric, evidence requirements, or
  expected judgment;
- clarifying metadata such as maintainers, tags, or provenance;
- non-semantic formatting changes.

Minor version:

- prompt wording changes that could affect agent behavior;
- asset changes that alter inputs or examples;
- rubric, evidence guidance, calibration case, or private evaluator changes;
- expected runtime or tool/network requirement changes.

Major version:

- a materially different user task;
- changed pass/fail boundary that makes old results misleading;
- replacing public reviewer expectations with held-out/private expectations;
- changes that make old saved results unsuitable for comparison.

Retire or deprecate instead of bumping when the scenario is flawed, leaked,
obsolete, or no longer representative. Use `metadata.lifecycle` with a reason,
replacement id, and sunset date when available.

## Changelog Rule

Every version bump should add a `metadata.changelog` entry that names the new
version:

```json
{
  "metadata": {
    "scenarioVersion": "1.2.0",
    "changelog": [
      "1.2.0: Added a failed calibration case and clarified export behavior.",
      "1.1.0: Tightened evidence guidance for local run verification."
    ]
  }
}
```

`ruhroh validate` warns when a task changelog exists but does not mention
the current `metadata.scenarioVersion`.

## Benchmark Suite Locks

Benchmark suites freeze task membership with `scenarioVersions`. When a task version
changes, create or update the benchmark suite intentionally:

```bash
pnpm exec ruhroh new-suite local-smoke \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario my-task
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke
```

`ruhroh validate` reports an error when a benchmark-suite lock no longer matches the
task's `metadata.scenarioVersion`. `ruhroh compare --suite <id>` reports when
collected results mix versions or omit the benchmark-suite-locked version.

## Publication Checklist

Before publishing a claim after task changes:

1. Update `metadata.scenarioVersion`.
2. Add a matching `metadata.changelog` entry.
3. Re-run `ruhroh validate`.
4. Update suite `scenarioVersions` only when the benchmark should move to
   the new task.
5. Re-run the planned samples; do not mix old and new task versions in the
   same claim.
6. Use `ruhroh publish-check` with the run plan and suite before citing the
   result.

Old claims can stay archived if their `benchmarkClaim` includes the old task
set, task version locks, run plan, source hashes, and result evidence hashes.
