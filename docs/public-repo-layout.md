---
id: ruhroh-public-repo-layout
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - package.json
  - docs/.vitepress/config.ts
  - examples/adapters/codex-cli/README.md
  - examples/adapters/claude-code/README.md
  - examples/adapters/aider/README.md
  - examples/scenarios/simple-newsletter/scenario.json
  - examples/adapters/gemini-cli/README.md
  - scripts/generate-docs-samples.mjs
---

# Public Repo Layout

Repository shape:

```text
ruhroh/
  assets/
  schemas/
    scenario-v2.schema.json
    suite-v1.schema.json
    loop-result-v1.schema.json
    benchmark-claim-v1.schema.json
    benchmark-target-config-v1.schema.json
    publish-check-v1.schema.json
  suites/
    ruhroh-smoke/
    ruhroh-productivity/
    ruhroh-data-apps/
    ruhroh-maintenance/
  python/
    ruhroh/
  examples/
    scenarios/
      simple-newsletter/
      grocery-budget-planner/
    adapters/
      aider/
      claude-code/
      codex-cli/
      gemini-cli/
      fixture-newsletter/
    ci/
      ruhroh-pack-registry.yml
      ruhroh-claim-publication.yml
      ruhroh-sharded-collection.yml
    evaluators/
      fixture-newsletter/
  docs/
    index.md                  # product overview
    getting-started.md         # first fixture loop and staged workflow
    concepts.md                # lifecycle and glossary
    local-fixture-run.md       # credential-free smoke path
    benchmark-pack-tutorial.md # task to publication packet
    report-gallery.md          # generated evidence samples
    write-*.md                 # task, agent, reviewer guides
    *registry.md               # pack and claim registry flows
    *reference.md              # CLI, result JSON, API references
    troubleshooting.md
    faq.md
    public/
      samples/                 # checked-in generated reports and packets
    .vitepress/
      config.ts
  scripts/
    generate-docs-samples.mjs
    check-docs-samples.mjs
    package-smoke.mjs
  src/
    cli.ts
    generate.ts
    pack.ts
    publication.ts
    results.ts
  .github/workflows/
    ruhroh-smoke.yml
    docs-pages.yml
  .github/ISSUE_TEMPLATE/
    bug_report.md
    scenario_request.md
    adapter_request.md
    claim_publication.md
  .github/pull_request_template.md
  CHANGELOG.md
  CONTRIBUTING.md
  SECURITY.md
  README.md
  package.json
```

Ownership:

- root package contains portable TypeScript APIs and the package CLI.
- `schemas` contains the public JSON contracts copied by `ruhroh init` and
  exported by the package.
- `python` contains the package-owned Harbor runtime.
- `scenarios` contains bundled benchmark scenarios.
- `suites` contains published benchmark-pack manifests.
- `examples/scenarios` contains small public-friendly scenarios.
- `examples/adapters/codex-cli`, `examples/adapters/claude-code`,
  `examples/adapters/gemini-cli`, and `examples/adapters/aider` demonstrate
  real public-agent wrappers.
- `examples/adapters/fixture-newsletter` and
  `examples/evaluators/fixture-newsletter` provide a credential-free full-loop
  smoke path.
- `examples/ci` contains starter GitHub Actions workflows for pack registry
  inspection, sharded run collection, and claim publication.
- `docs` contains Markdown docs, the VitePress GitHub Pages site, and the
  checked-in `docs/public/samples` evidence gallery generated from synthetic
  result artifacts.
- `scripts/generate-docs-samples.mjs` builds the report gallery, publication
  bundle, claim index, and source evidence packet used by the docs site.
- `.github/ISSUE_TEMPLATE` routes public bug reports, scenario and pack
  proposals, adapter requests, and publication-claim reviews.
- `.github/pull_request_template.md` asks contributors to attach the relevant
  validation, calibration, pack-inspection, or publication evidence before
  review.

Downstream projects install `@kestrel-agents/ruhroh`, supply adapter commands,
and keep project-specific run-agent code outside this repository.
