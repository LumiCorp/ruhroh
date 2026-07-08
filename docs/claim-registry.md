---
id: ruhroh-claim-registry
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/publish-claims.md
  - docs/result-json-reference.md
  - src/cli.ts
---

# Claim Registry

A Ruhroh claim registry is a directory of reviewed publication outputs, usually
one `publish-check --bundle` directory per benchmark claim. It is intentionally
file-based: teams can keep it in a repo, attach it to a release, publish it as a
static site, or feed it into a leaderboard importer without losing the evidence
contract behind each score.

The minimum registry-ready unit is a validated publication packet:

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite local-data \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --bundle published-claims/local-data/codex-2026-07-08 \
  --verify-sources

pnpm exec ruhroh validate-bundle published-claims/local-data/codex-2026-07-08 --json
```

Each bundle contains `benchmark-claim.json`, `benchmark-summary.json`,
`publish-check.json`, HTML review artifacts, and copied `sources/` evidence.
The bundled claim uses relative `sources/` paths, so the bundle can be archived
or moved and still pass `validate-claim --verify-sources`.

## Registry Gate

After adding one or more bundles, build the registry index:

```bash
pnpm exec ruhroh claim-index published-claims --json
pnpm exec ruhroh claim-index published-claims --html ruhroh-claims.html
```

JSON output is versioned as `ruhroh_claim_index_v1` and includes a root
`$schema` URL for
`https://lumicorp.github.io/ruhroh/schemas/claim-index-v1.schema.json`. The npm
package ships that schema at
`node_modules/@kestrel-agents/ruhroh/schemas/claim-index-v1.schema.json`, and
`ruhroh init` copies it into `ruhroh/schemas/` for registry importer tests.

Use `--require-publishable` when the index is an ingestion gate:

```bash
pnpm exec ruhroh claim-index published-claims \
  --require-publishable \
  --json
```

`ruhroh workflow` uses the same readiness signal when `claim-index.json` is
present. A stale index with `registryReady: false` keeps the publish stage in
needs-action status even if the bundle files are already on disk.

Exit codes:

- `0`: every discovered claim is structurally valid and publishable;
- `1`: the input path is invalid, no claims were found, or at least one claim is
  malformed;
- `2`: all discovered claims are structurally valid, but at least one is blocked
  from publication.

The index JSON also includes:

- `registryReady`: `true` only when every discovered claim is valid and
  publishable;
- `registryBlockers`: one stable summary per invalid or blocked claim;
- counts for claims, publishable claims, blocked claims, invalid claims, suites,
  adapters, and total runs;
- one row per claim with suite/version, adapters, run counts, pass rate,
  evidence coverage, source paths, blockers, advisories, and validation output.

The HTML output is a static claim table for release notes, internal reports, or
a lightweight public claim explorer. When a claim comes from a publication
bundle, the table links directly to the reviewer packet: bundle README, compare
report, eval-quality report, review queue, manifest, and copied `sources/`
evidence. Treat the HTML as a view over the JSON index and bundle files, not as
the authoritative artifact.

## Ingestion Policy

For a registry entry to be credible:

- the claim must be suite-scoped, not an ad hoc comparison;
- `publish-check` must have no blockers;
- the matching run plan must be present and source-verified;
- reviewer-quality warnings and required review items must be resolved or
  explicitly captured as blockers;
- every packet should keep its copied `sources/` evidence with the claim;
- task and benchmark-suite version changes should create a new claim, not overwrite an
  older one.

Use [Task Versioning](./scenario-evolution.md) when task content changes,
and [Publish Claims](./publish-claims.md) for the source-verification workflow.
