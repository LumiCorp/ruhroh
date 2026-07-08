---
id: ruhroh-programmatic-api
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - src/pack.ts
  - src/results.ts
  - src/index.ts
  - docs/result-json-reference.md
  - docs/contract-evolution.md
---

# Programmatic API

Use the CLI for normal authoring and publication workflows. Use the
programmatic API when you are building a docs generator, registry importer,
internal dashboard, or CI integration that needs structured Ruhroh state without
parsing terminal output.

If your integration stores Ruhroh artifacts long term, follow
[Contract Evolution](./contract-evolution.md): branch on `version`, validate
with shipped schemas when possible, and ignore additive optional fields.

## Inspect A Benchmark Pack

The same inspection is available from the CLI:

```bash
pnpm exec ruhroh inspect-pack \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --require-calibrated \
  --require-risk-reviewed \
  --json
```

`inspectRuhrohBenchmarkPack()` is the high-level entry point for local scenario
and suite catalogs:

```ts
import { inspectRuhrohBenchmarkPack } from "@kestrel-agents/ruhroh";

const inspection = inspectRuhrohBenchmarkPack({
  scenarioDir: "ruhroh/scenarios",
  suiteDir: "ruhroh/suites",
  requireFullCalibration: true,
  requireRiskReviewed: true,
});

if (!inspection.ready) {
  console.error(inspection.blockers.join("\n"));
  process.exitCode = 1;
}
```

The returned object is versioned as `ruhroh_benchmark_pack_inspection_v1` and
includes:

- absolute `scenarioDir` and optional `suiteDir` source paths;
- `ready`, `blockers`, and `warnings` for authoring-time validation;
- `requirements.requireFullCalibration`, which records whether calibration
  warnings were promoted to blockers;
- `requirements.requireRiskReviewed`, which records whether
  contamination/reward-hacking review warnings were promoted to blockers;
- scenario counts, suite counts, invalid counts, calibration warning count,
  difficulty distribution, and expected runtime totals/ranges;
- compact scenario rows with version, visibility, difficulty, expected runtime,
  tags, lifecycle,
  validation warnings, evaluator lint diagnostics, calibration coverage, and
  content fingerprints for the scenario manifest, prompt file, public assets,
  and private evaluator assets;
- compact suite rows with version, scenario membership, minimum runs, owner,
  suite-level difficulty distribution, expected runtime estimate, minimum-run
  collection estimate, and suite validation warnings.

Use each scenario row's `content` object for registry preflight, contamination
review, and prompt/asset drift detection. Public and private asset fingerprints
cover both files and directories; directory hashes are deterministic over sorted
relative file paths, file sizes, and file hashes.

This is an authoring and registry-preflight API. It does not replace
`publish-check`, which remains the publication gate for actual run artifacts and
benchmark claims.

Leave `requireFullCalibration` and `requireRiskReviewed` off while drafting a
new pack. Turn them on for CI or registry ingestion when evaluator calibration
coverage and contamination/reward-hacking review are part of the benchmark
acceptance bar.

## Analyze Run Results

Use `buildRuhrohRunResultsReport()` when a dashboard, docs job, or registry
importer needs the same preserved-result view that `report`, `review`,
`compare`, and claim exports build on:

```ts
import { buildRuhrohRunResultsReport } from "@kestrel-agents/ruhroh";

const report = buildRuhrohRunResultsReport({
  resultsPath: "results/ruhroh",
  aggregate: { minRuns: 5 },
  tool: { name: "@kestrel-agents/ruhroh", version: "0.6.0-beta.0" },
});

for (const group of report.groups) {
  console.log(group.scenarioId, group.adapter, group.passRate);
}

if (!report.claimReadiness.publishable) {
  console.error(report.claimReadiness.blockers.join("\n"));
}
```

The returned object is versioned as `ruhroh_run_results_report_v1` and includes
discovered result artifacts, per-run summaries, aggregate scenario/adapter
groups, the review queue, claim readiness, a `benchmarkClaim`, and a
row-oriented `benchmarkSummary`. Without suite context, claim readiness remains
`ad_hoc_compare` and not publishable; pass a suite summary and suite adapter
coverage when building a suite-scoped dashboard. The CLI `publish-check` still
owns source verification, artifact validation, bundle creation, and the final
publication gate.

Use the lower-level helpers when you only need raw files:

```ts
import {
  discoverRuhrohRunResultPaths,
  loadRuhrohRunResultArtifacts,
  loadRuhrohRunResults,
} from "@kestrel-agents/ruhroh";

const paths = discoverRuhrohRunResultPaths("results/ruhroh");
const artifacts = loadRuhrohRunResultArtifacts("results/ruhroh");
const runs = loadRuhrohRunResults("results/ruhroh");
```

## Build A Publish Check Verdict

Use `buildRuhrohPublishCheckReport()` when your integration already has compare
output and needs the same versioned publication verdict and remediation codes
that the CLI emits, without writing files or invoking a subprocess:

```ts
import {
  buildRuhrohPublishCheckReport,
  verifyRuhrohBenchmarkClaimSources,
} from "@kestrel-agents/ruhroh";

const sourceVerification = verifyRuhrohBenchmarkClaimSources(
  compare.benchmarkClaim,
  "benchmark-claim.json",
);
const publishCheck = buildRuhrohPublishCheckReport({
  source: {
    resultsPath: "results/ruhroh",
    runPlanPath: ".generated/ruhroh/ruhroh-run-plan.json",
    benchmarkClaimPath: "benchmark-claim.json",
  },
  compare,
  sourceVerification,
});

if (!publishCheck.publishable) {
  console.error(publishCheck.remediation.map((item) => item.action).join("\n"));
}
```

The returned object is versioned as `ruhroh_publish_check_v1` and includes the
same `blockers`, `advisories`, `remediation`, embedded compare output, and
optional source-verification report used by `ruhroh publish-check --json`.
This API is intentionally side-effect-free. Use the CLI when you need to write
claim files, summaries, HTML, Markdown, or a relocatable publication bundle.

## Verify Published Evidence

Use `validateRuhrohPublishBundle()` when a registry importer, dashboard, or
release job receives an already-created `publish-check --bundle` directory and
needs to verify it without invoking the CLI:

```ts
import { validateRuhrohPublishBundle } from "@kestrel-agents/ruhroh";

const validation = validateRuhrohPublishBundle("ruhroh-publication");

if (!validation.valid) {
  throw new Error(validation.errors.join("\n"));
}

if (!validation.publishable) {
  console.warn("Bundle is structurally valid but still blocked from publication");
}
```

The returned object is versioned as
`ruhroh_publish_bundle_validation_report_v1`. It checks the bundle manifest,
required file roles, JSON contract versions, benchmark claim and summary
structure, source hashes referenced by `benchmark-claim.json`, cross-references
between the embedded `publish-check.json` and standalone claim/summary files,
and the optional evaluator calibration report role when present.

Use `verifyRuhrohBenchmarkClaimSources()` when you already loaded one archived
claim object and want only source hash verification:

```ts
import { readFileSync } from "node:fs";
import {
  verifyRuhrohBenchmarkClaimSources,
  validateRuhrohBenchmarkClaim,
} from "@kestrel-agents/ruhroh";

const claim = JSON.parse(readFileSync("benchmark-claim.json", "utf8"));
const shape = validateRuhrohBenchmarkClaim(claim);
const sources = verifyRuhrohBenchmarkClaimSources(claim, "benchmark-claim.json");

if (shape.errors.length > 0 || sources.errors.length > 0) {
  process.exitCode = 1;
}
```

Source verification resolves relative paths from the claim file location. Claims
inside publication bundles therefore verify against bundle-local `sources/`
paths, including evaluator calibration reports copied by `publish-check`.

## Validate Rerun Ledgers

Use `validateRuhrohRerunLedger()` or `loadRuhrohRerunLedger()` when CI,
dashboards, or registry importers need to check an infrastructure exclusion
ledger before passing it to `compare --rerun-ledger` or `publish-check
--rerun-ledger`:

```ts
import { loadRuhrohRerunLedger } from "@kestrel-agents/ruhroh";

const ledger = loadRuhrohRerunLedger("ruhroh-rerun-ledger.json");

for (const entry of ledger.entries) {
  console.log(entry.sampleId, entry.decision, entry.reasonKind);
}
```

The loader returns a `ruhroh_rerun_ledger_v1` object and throws with the same
validation messages used by the CLI. The validator returns `{ valid, errors,
warnings, ledger }` for integrations that need to report all malformed entries
without throwing. The JSON Schema is shipped at
`schemas/rerun-ledger-v1.schema.json`.

## Common Recipes

List bundled suites for a docs page:

```ts
import {
  loadBuiltinRuhrohSuites,
  resolveRuhrohBuiltinSuiteDir,
} from "@kestrel-agents/ruhroh";

const suites = loadBuiltinRuhrohSuites(resolveRuhrohBuiltinSuiteDir());
```

Validate one scenario tree before generating tasks:

```ts
import {
  discoverRuhrohScenarios,
  validateRuhrohScenarioSource,
} from "@kestrel-agents/ruhroh";

const results = discoverRuhrohScenarios("ruhroh/scenarios")
  .map((source) => validateRuhrohScenarioSource(source));

const errors = results.flatMap((result) => result.errors);
```

Summarize preserved run results after a benchmark run:

```ts
import { buildRuhrohRunResultsReport } from "@kestrel-agents/ruhroh";

const report = buildRuhrohRunResultsReport({
  resultsPath: "results/ruhroh",
  aggregate: { minRuns: 5 },
});

console.log(report.benchmarkSummary.rows);
```

For publication bundles, prefer the CLI workflow:

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite local-data \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --bundle ruhroh-publication \
  --verify-sources
```

The publication workflow performs artifact validation, claim readiness checks,
source verification, review queue generation, evaluator-quality checks, and
bundle-local source copying.
