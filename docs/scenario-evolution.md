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

# Scenario Evolution

Scenario versions are part of Ruhroh's evidence model. A benchmark claim is only
defensible when readers can tell which prompt, assets, rubric, calibration
cases, private evaluator material, and governance notes were used.

Use `metadata.scenarioVersion` for the scenario content version. This is
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
- replacing public evaluator expectations with held-out/private expectations;
- changes that make old run artifacts unsuitable for comparison.

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

`ruhroh validate` warns when a scenario changelog exists but does not mention
the current `metadata.scenarioVersion`.

## Suite Locks

Suites freeze scenario membership with `scenarioVersions`. When a scenario
version changes, create or update the suite intentionally:

```bash
pnpm exec ruhroh new-suite local-smoke \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --scenario my-task
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite local-smoke
```

`ruhroh validate` reports an error when a suite lock no longer matches the
scenario's `metadata.scenarioVersion`. `ruhroh compare --suite <id>` reports
when collected run artifacts mix versions or omit the suite-locked version.

## Publication Checklist

Before publishing a claim after scenario changes:

1. Update `metadata.scenarioVersion`.
2. Add a matching `metadata.changelog` entry.
3. Re-run `ruhroh validate`.
4. Update suite `scenarioVersions` only when the benchmark pack should move to
   the new scenario.
5. Re-run the planned samples; do not mix old and new scenario versions in the
   same claim.
6. Use `ruhroh publish-check` with the run plan and suite before citing the
   result.

Old claims can stay archived if their `benchmarkClaim` includes the old suite,
scenario version locks, run plan, source hashes, and result artifact hashes.
