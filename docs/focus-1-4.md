# FOCUS 1.4 Import

Ruhroh provides an import-only adapter for the ratified FOCUS 1.4 specification. It preserves FOCUS evidence, maps billed `CostAndUsage` facts into the provider-neutral exact billing v2 plane, and keeps technical outcome evidence authoritative in Ruhroh. It does not export FOCUS datasets or claim FOCUS certification.

Permitted language is: **validated against pinned FOCUS 1.4 rules**. Passing the official validator is required for import readiness, but it does not replace Ruhroh's accounting, relationship, attribution, privacy, or reconciliation gates.

## Pinned foundation

The packaged `examples/focus/spec-lock-1.4.json` records the immutable FOCUS `v1.4` tag and commit, official release digests, the compiled `model-1.4.json` hash, and FOCUS Validator `2.2.1`. The generated catalog, mapping pack, and conformance profile in `examples/focus/` are derived from that identity.

Ordinary validation and import are offline. Ruhroh never installs or downloads a validator. Callers can provide any executable/argument vector whose version probe returns exactly `2.2.1`. One opt-in runner is:

```json
{
  "executable": "uvx",
  "prefixArguments": ["--from", "focus-validator==2.2.1", "focus-validator"],
  "versionProbe": {
    "executable": "uvx",
    "arguments": ["--from", "focus-validator==2.2.1", "python", "-c", "import importlib.metadata; print(importlib.metadata.version('focus-validator'))"],
    "expectedOutput": "2.2.1"
  },
  "timeoutMs": 120000
}
```

`uvx` may download the pinned tool, so use this recipe only as an explicit preparation step. Once cached, Ruhroh invokes the validator with the packaged rule-set directory and download blocking enabled. `modelFilePath` identifies the exact file to hash; `ruleSetPath` identifies its containing offline directory for the official validator. A missing runner, wrong version, timeout, malformed output, unexpected skipped rule, or model mismatch produces an inspectable `failed` or `unavailable` report and blocks readiness.

## Dataset behavior

| FOCUS 1.4 dataset | Ruhroh behavior |
|---|---|
| `CostAndUsage` | Produces restricted exact-decimal billing v2 rows from billed cost, billing currency, charge period, charge category, SKU, invoice, and commitment link fields. |
| `InvoiceDetail` | Preserved as restricted invoice evidence; linked by `InvoiceId` and `InvoiceDetailId`. Payment-currency values stay separate. |
| `BillingPeriod` | Preserved as restricted period evidence; linked by invoice issuer and exact period boundaries. |
| `ContractCommitment` | Preserved as restricted contract evidence; linked through official contract and commitment identifiers, including `ContractApplied`. |

CSV, iterable records, and Parquet enter the same canonical pipeline. Parquet decimals are decoded from Arrow fixed-point words as signed unscaled integers plus scale; they are never converted through floating point. Duplicate source records remain distinct because row identity includes the source-file hash and one-based ordinal as well as the canonical row hash.

FOCUS 1.4 does not supply Ruhroh workload IDs, model identity, or a universal provider request ID. Provider custom columns and tags may only be interpreted through a separate restricted attribution profile. No provider convention is embedded in the standard mapping pack.

## Exact accounting

Billing v2 accepts monetary values only as strings. It canonicalizes scientific notation to plain decimal notation, removes insignificant zeros, and normalizes negative zero to `0`. `Usage` and `Purchase` map to `charge`; `Tax`, `Credit`, and `Adjustment` map to their corresponding fact kinds. Refund, prepaid, commitment, and capacity classifications require explicit evidence and are never inferred from signs or descriptions.

Split allocations declare an exact `assignedAmountDecimal` for each target. Optional weights explain the assignment but do not determine it. Assigned amounts must equal the source amount exactly in the same currency.

## Commands

The flat economics dispatcher accepts one JSON file and always returns `ruhroh_economics_command_result_v1`:

```bash
ruhroh economics focus-validate ./focus-validation-input.json --json
ruhroh economics focus-import ./focus-import-input.json --json
ruhroh economics billing-reconcile-v2 ./billing-reconciliation-v2-input.json --json
ruhroh economics focus-check-update ./focus-update-input.json --json
ruhroh economics focus-propose-update ./focus-update-input.json --json
```

For JSON transport, CSV is a string, records are arrays of objects, and Parquet bytes use base64. The programmatic `importRuhrohFocusBundle` API accepts Parquet as `Uint8Array` directly. Domain failures stay in the structured artifact rather than disappearing behind an opaque process error.

## Privacy and readiness

Raw datasets, normalized rows, attribution profiles, validator XML, provider identifiers, custom values, and relationship keys are restricted. Public artifacts may include only hashes, relative references, counts, rule IDs, sanitized messages, aggregate native-currency amounts, coverage, and blockers.

Import readiness requires the exact spec/model/validator identities, successful official validation of every supplied dataset, reviewed skips only, complete row and amount accounting, complete referenced relationships, and no precision loss. Reconciliation readiness additionally requires technical attribution and zero ambiguous or unmatched billed value.

## Updating to FOCUS 1.5

`focus-check-update` is read-only. `focus-propose-update` generates candidate locks, catalogs, mapping-impact and fixture plans, and a hash-linked semantic review packet. The weekly/manual GitHub workflow reads only the official specification and validator repositories and opens a draft `asher/focus-update-<short-sha>` PR when their immutable identities change.

Working drafts are diff-only previews. They cannot act as runtime profiles. Promotion requires an official immutable release, final semantic review, compatible validator, resolved mandatory mappings, AI billing fixtures, and human approval. The automation never merges, publishes, weakens gates, changes neutral billing contracts, or promotes a draft.
