---
id: ruhroh-contract-evolution
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/result-json-reference.md
  - docs/scenario-evolution.md
  - schemas/
---

# Contract Evolution

Ruhroh claims are useful only when archived evidence stays readable after the
tooling changes. Treat every versioned JSON file as an evidence contract, not as
an implementation detail.

Use this page when building registry importers, dashboards, CI gates,
leaderboards, or long-lived publication archives.

## Contract Layers

Ruhroh has three kinds of versioned contract:

- scenario and suite authoring contracts, such as
  `ruhroh_scenario_v2` and `ruhroh_suite_v1`;
- run evidence contracts, such as `ruhroh_loop_result_v1`,
  `ruhroh_run_manifest_v1`, `ruhroh_eval_result_v1`,
  `ruhroh_run_plan_v1`, and `ruhroh_rerun_ledger_v1`;
- publication and registry contracts, such as
  `ruhroh_benchmark_claim_v1`, `ruhroh_benchmark_summary_v1`,
  `ruhroh_publish_check_v1`, `ruhroh_publish_bundle_v1`, and
  `ruhroh_claim_index_v1`.

Scenario content versions and suite versions are benchmark-methodology
versions. JSON `version` fields are data-contract versions. Keep those concerns
separate: changing a scenario prompt usually bumps `metadata.scenarioVersion`,
while changing a JSON shape may require a new contract version.

## Compatibility Rules

Compatible changes:

- adding optional fields;
- adding new warning, advisory, or remediation codes;
- adding new file roles to publication bundle manifests when existing required
  roles are preserved;
- adding new enum values only when old consumers can safely treat unknown
  values as review-required;
- adding HTML views or report sections derived from already-preserved JSON.

Breaking changes:

- removing, renaming, or changing the meaning of required fields;
- changing the binary score mapping for existing evaluator statuses;
- changing sample identity semantics in run plans or run manifests;
- changing source-hash meaning for claims, bundles, or registry records;
- making a previously optional field required for already-archived artifacts.

When a breaking change is needed, add a new version value instead of changing
the meaning of the old one. Keep validators for old versions when archived
claims still need to be inspected.

## Producer Rules

When Ruhroh emits artifacts:

1. Include a top-level `version` field on every machine-readable object.
2. Include a `$schema` URL when a structural schema is shipped.
3. Preserve source paths and SHA-256 hashes for artifacts that support external
   claims.
4. Keep old raw artifacts available so summaries can be recomputed when report
   logic improves.
5. Prefer additive optional fields over shape replacement.
6. Document any new required field in
   [Result JSON Reference](./result-json-reference.md).

If a generated sample artifact changes shape, regenerate the docs samples and
publication bundle so reviewers can inspect the current contract in the report
gallery.

## Consumer Rules

When reading Ruhroh artifacts:

1. Branch on `version` before parsing a file.
2. Validate with the shipped schema for that version when one exists.
3. Ignore unknown optional fields.
4. Treat unknown statuses, judge kinds, file roles, or remediation codes as
   review-required instead of silently passing them.
5. Use structured fields before prose fields. Do not parse human-readable
   warnings when structured arrays exist.
6. Use `scenarioId`, `adapter`, `runId`, `sample.id`, and run-plan samples
   instead of directory names for identity.
7. Re-hash source files with `validate-claim --verify-sources` or
   `publish-check --verify-sources` before trusting copied claims.

Consumers should reject malformed required fields, but they should not reject a
claim only because a newer Ruhroh version added optional fields.

## Migration Checklist

Before changing an emitted contract:

1. Identify the affected object and current `version` value.
2. Decide whether the change is additive or breaking using the rules above.
3. Update the JSON Schema and the TypeScript type together.
4. Add or update validation tests for the old and new shape.
5. Update `docs/result-json-reference.md` and any workflow docs that name the
   field.
6. Regenerate sample docs artifacts when report, claim, bundle, or registry
   outputs change.
7. Run `validate-claim --verify-sources`, `validate-bundle`, and
   `claim-index` against a sample publication bundle when publication contracts
   are affected.

Do not use a migration to make old weak claims look stronger. If a new
methodology gate changes publishability, preserve the old claim and publish a
new claim with a new run plan, refreshed artifacts, and a current
`publish-check` report.

## Archived Evidence

An archived Ruhroh publication should contain enough evidence to survive future
contract changes:

- the benchmark claim and benchmark summary;
- the publication bundle manifest and `publish-check.json`;
- the suite manifest and scenario version locks;
- the run plan and optional rerun ledger;
- every referenced run result and run artifact inventory;
- evaluator calibration, review, and eval-quality reports when present;
- copied source files plus hashes.

That packet lets later tooling validate the old claim as an old claim. It does
not imply the claim would satisfy newer methodology, sample-size, or evaluator
quality gates without rerunning `publish-check` under the newer toolchain.
