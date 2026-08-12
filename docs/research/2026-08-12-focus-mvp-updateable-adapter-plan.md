# FOCUS 1.4 implementation record

**Status:** Implemented for review  
**Date:** 2026-08-12  
**Boundary:** Import-only FOCUS 1.4 adapter over Ruhroh exact billing v2

This record supersedes the earlier CostAndUsage-only prototype plan. The review implementation now includes native CSV and Parquet ingestion for all four FOCUS 1.4 datasets, exact-decimal neutral billing v2, pinned offline official validation, restricted relationship evidence, technical attribution gates, and semantic update review automation.

The durable product and operator documentation is [FOCUS 1.4 Import](../focus-1-4.md). The architectural boundary is recorded in [ADR 004](../adr/004-neutral-billing-and-focus-boundary.md).

## Settled decisions

- Preserve all v1 billing readers and artifacts without automatic upgrade.
- Use canonical decimal strings and integer-significand arithmetic in billing v2.
- Import `CostAndUsage`, `InvoiceDetail`, `BillingPeriod`, and `ContractCommitment` from CSV or Parquet.
- Map only explicitly supported FOCUS charge categories and never infer refund, prepaid, commitment, or capacity semantics.
- Require an explicit, exact-version official-validator runner; ordinary imports do not install or download tools.
- Keep source datasets, normalized rows, relationship keys, attribution profiles, and raw validator output restricted.
- Treat FOCUS catalogs as able to describe future datasets while limiting runtime dataset IDs to the four ratified 1.4 datasets.
- Make working drafts semantic-diff inputs only. Automation may open a draft review PR but cannot promote, merge, publish, or alter neutral contracts.
- Use “validated against pinned FOCUS 1.4 rules,” never “FOCUS certified.”

## Review gates

The PR must pass TypeScript build, all Node and Python tests, exact CSV/Parquet parity tests, package export smoke, generated-catalog determinism, documentation sample freshness, public disclosure tests, VitePress build, and `git diff --check`. Package tarball and installed-size impact must be recorded in the PR description.

## Package-size measurement

Measured from `origin/main` and this branch with `pnpm pack`, followed by a clean production install of each tarball:

| Measurement | `origin/main` | FOCUS branch | Change |
|---|---:|---:|---:|
| Packed tarball | 5,118,908 bytes | 5,260,029 bytes | +141,121 bytes |
| Unpacked Ruhroh package | 8,200 KiB | 10,324 KiB | +2,124 KiB |
| Installed production `node_modules` | 8,204 KiB | 45,444 KiB | +37,240 KiB |

Within the installed result, `apache-arrow@21.1.0` occupies 7,828 KiB and `parquet-wasm@0.7.2` occupies 21,040 KiB. The remaining increase includes their transitive production dependencies and the packaged FOCUS model/catalog evidence.

## Validator compatibility observation

The real `focus-validator==2.2.1` executable accepts Ruhroh's offline arguments when `--rule-set-path` points to the packaged directory. Its CLI currently advertises only `CostAndUsage` for `--focus-dataset`; a local 1.4 CostAndUsage run then stopped inside the official validator with an `Active-edge cycle detected` error while loading the pinned official model, before producing JUnit. Ruhroh correctly records either condition as `validation_status: unavailable`, so no ready four-dataset import or conformance claim can result. These upstream compatibility blockers must be resolved or covered by a newly pinned official validator before general availability; they are not bypassed by Ruhroh's independent importer tests.
