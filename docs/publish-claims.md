---
id: ruhroh-publish-claims
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/benchmark-methodology.md
  - docs/artifacts.md
  - docs/result-json-reference.md
  - src/cli.ts
---

# Publish Claims

Use `publish-check` when you want one answer: is this benchmark result ready to
cite, share, or ingest into a report?

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --rerun-ledger ruhroh-rerun-ledger.json \
  --benchmark-claim benchmark-claim.json \
  --benchmark-summary benchmark-summary.json \
  --html ruhroh-compare.html \
  --bundle ruhroh-publication \
  --summary-md "$GITHUB_STEP_SUMMARY" \
  --verify-sources

pnpm exec ruhroh validate-bundle ruhroh-publication --json
pnpm exec ruhroh claim-index ruhroh-publication --html ruhroh-claims.html --json > claim-index.json
```

`publish-check` runs the compare pipeline, writes any requested report exports,
packages a publication bundle when `--bundle` is present, writes an optional
Markdown status report with `--summary-md`, applies the publishability gate, and
optionally re-hashes referenced source files. Bundle exports copy the hashed
claim sources into `sources/` and rewrite bundled claim paths to those relative
locations, so the evidence packet can be moved without breaking source
verification. It exits with:

- `0` when the claim is publishable;
- `1` when inputs are invalid or the compare pipeline cannot run;
- `2` when the result is valid but blocked from publication.

Text output includes blockers plus `next actions`. JSON output includes the same
blockers and a `remediation` array with stable fields:

```json
{
  "code": "run_plan_mismatch",
  "category": "run_plan",
  "severity": "blocker",
  "blocker": "run plan warning: planned sample has no result artifact",
  "action": "Compare against the run plan generated for this run, or collect the missing planned samples before publishing.",
  "docs": "publish-claims#what-it-checks"
}
```

Use `remediation[].code` in CI or publication tooling instead of parsing
blocker prose. To inspect a code locally, run:

```bash
pnpm exec ruhroh explain run_plan_mismatch
pnpm exec ruhroh explain run_plan_mismatch --json
```

Run `pnpm exec ruhroh explain` with no code to list the full remediation
catalog.

The JSON output includes a `$schema` value of
`https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json` and is
versioned as `ruhroh_publish_check_v1`. The npm package ships
`schemas/publish-check-v1.schema.json`, and `ruhroh init` copies it into local
starters, so CI and registry tooling can validate the report shape before
inspecting remediation codes or the embedded compare output.

In GitHub Actions, pass `--summary-md "$GITHUB_STEP_SUMMARY"` so the workflow
summary shows the publishable/blocked status, evidence paths, blockers,
remediation actions, advisories, and source-verification state. The Markdown
summary is for review speed; keep the JSON and bundle outputs as the durable
claim record.

## What It Checks

- the result directory contains Ruhroh loop results;
- run artifacts are internally consistent;
- suite membership and scenario-version locks match the selected suite;
- the generated run plan matches the observed samples;
- any infrastructure exclusions are recorded in the optional rerun ledger;
- each scenario/adapter group satisfies minimum run counts;
- evaluator output includes enough evidence for audit;
- a preserved evaluator calibration report is included and hashed when
  `.generated/ruhroh/evaluator-calibration/ruhroh-evaluator-calibration-report.json`
  exists;
- claim, summary, and source hashes are consistent when `--verify-sources` is
  enabled.

## Output Files

`--benchmark-claim` writes a compact, versioned `benchmarkClaim` JSON object for
archival or downstream publication.

`--benchmark-summary` writes row-oriented summary JSON for reports or
leaderboard ingestion.

`--html` writes a static compare report for human review.

`--bundle <dir>` writes a self-contained publication packet:

- `manifest.json`: versioned inventory for the packet, with schema
  `https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json`;
- `publish-check.json`: verdict, blockers, remediation, compare output, and
  source verification;
- `benchmark-claim.json`: compact claim export;
- `benchmark-summary.json`: row-oriented summary export;
- `sources/`: hashed source evidence referenced by the claim, including suite
  manifests, run plans, rerun ledgers when supplied, result JSON files, and
  available run-artifact inventory files. When a preserved evaluator calibration
  report exists, the bundle also copies it to
  `sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json`;
- `ruhroh-compare.html`: static aggregate report;
- `ruhroh-review.json` and `ruhroh-review.html`: adjudication queue;
- `ruhroh-eval-quality.json` and `ruhroh-eval-quality.html`: evaluator evidence
  quality report and static audit packet;
- `README.md`: human-readable status, reviewer order, blockers, and next
  actions.

`validate-bundle <dir>` checks the packet after it has been archived, copied, or
handed to a publication pipeline. It verifies the manifest inventory, required
files, JSON contract versions, benchmark claim and summary structure,
cross-references between `publish-check.json`, `benchmark-claim.json`, and
`benchmark-summary.json`, and the bundle-local source hashes referenced by the
claim. When the optional evaluator calibration report role is present, it also
checks that the report version is `ruhroh_eval_calibration_report_v1`. It exits
`0` for a valid publishable packet, `1` for a malformed packet, and `2` for a
structurally valid packet whose embedded publish-check verdict is still blocked.

`claim-index <path>` turns one claim, one bundle, or a directory of publication
outputs into a local catalog. Use it after `validate-bundle` when you want a
human-readable claim table or a machine-readable ingestion record:

```bash
pnpm exec ruhroh claim-index ruhroh-publication --json
pnpm exec ruhroh claim-index ./published-claims --html ruhroh-claims.html
```

JSON output is versioned as `ruhroh_claim_index_v1` and includes each claim's
path, bundle path when present, validation status, publishability, suite and
version, adapters, run counts, pass rate, evidence coverage, blockers, and
source paths. The package ships its structural schema at
`node_modules/@kestrel-agents/ruhroh/schemas/claim-index-v1.schema.json`, and
`ruhroh init` copies the same schema to
`ruhroh/schemas/claim-index-v1.schema.json` for local registry checks. HTML
output is a static claim index for internal reports, release notes, or a
lightweight benchmark-claim registry.

Add `--require-publishable` when `claim-index` is the ingestion gate for a
claim registry. It exits `0` only when every discovered claim is structurally
valid and publishable, `1` when any claim is malformed, and `2` when all claims
are valid but at least one is blocked from publication. See
[Claim Registry](./claim-registry.md) for the directory layout and ingestion
policy.

## Common Blockers

- no suite was selected;
- a suite scenario is missing from the results;
- fewer than the suite minimum runs exist for a scenario/adapter group;
- run-plan samples do not match the result set;
- artifact validation failed;
- evaluator output lacks evidence references, criteria results, or judge
  metadata;
- pairwise comparison evidence is statistically inconclusive.

Fix blockers by collecting the missing runs, selecting the suite used for the
benchmark, passing the matching run plan, repairing artifact preservation, or
strengthening the evaluator.

## Rerun And Exclusion Ledger

Use a rerun ledger only when a planned sample could not produce a usable result
because of infrastructure outside the agent or evaluator, such as a runner
crash or artifact-upload failure. Do not use it for agent failures, evaluator
disagreement, operator cherry-picking, or invalid benchmark methodology.

```json
{
  "version": "ruhroh_rerun_ledger_v1",
  "entries": [
    {
      "sampleId": "simple-newsletter/agent-a/2-of-5",
      "decision": "exclude",
      "reasonKind": "infrastructure",
      "reason": "Runner was interrupted before artifacts were uploaded.",
      "decidedBy": "benchmark-owner",
      "decidedAt": "2026-07-08T12:00:00.000Z"
    }
  ]
}
```

Pass the ledger with the same run plan used for comparison:

```bash
pnpm exec ruhroh compare ./path/to/results \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --rerun-ledger ruhroh-rerun-ledger.json \
  --json
```

Only `decision: "exclude"` with `reasonKind: "infrastructure"` accounts for a
missing planned sample. Other decisions stay visible as run-plan warnings and
therefore block publishability until the missing sample is collected or the
benchmark owner revises the methodology. Claims record `rerunLedgerPath` and
`rerunLedgerSha256` so `validate-claim --verify-sources` can detect drift.

Common remediation codes include:

- `suite_required`
- `suite_scenario_missing`
- `minimum_runs_not_met`
- `run_plan_mismatch`
- `artifact_evidence_incomplete`
- `human_review_required`
- `evaluator_evidence_weak`
- `comparison_inconclusive`
- `source_verification_failed`

Use `ruhroh explain <code>` for the stable action, category, severity, docs
anchor, and example blocker behind each code.
