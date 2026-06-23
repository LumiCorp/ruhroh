---
id: ruhroh-public-repo-layout
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - package.json
  - docs/.vitepress/config.ts
  - examples/scenarios/simple-newsletter/scenario.json
  - examples/adapters/gemini-cli/README.md
---

# Public Repo Layout

Repository shape:

```text
ruhroh/
  assets/
  python/
    ruhroh/
  examples/
    scenarios/
      simple-newsletter/
      grocery-budget-planner/
    adapters/
      gemini-cli/
  docs/
    index.md
    getting-started.md
    write-a-scenario.md
    write-an-adapter.md
    architecture.md
    scenario-format.md
    adapter-protocol.md
    custom-shell.md
    harbor.md
    eval-agent.md
    artifacts.md
    ci.md
    security.md
    limitations.md
    public-repo-layout.md
    .vitepress/
      config.ts
  .github/workflows/
    ruhroh-smoke.yml
    docs-pages.yml
  .github/ISSUE_TEMPLATE/
    bug_report.md
    scenario_request.md
    adapter_request.md
  CHANGELOG.md
  CONTRIBUTING.md
  SECURITY.md
  README.md
  package.json
```

Ownership:

- root package contains portable TypeScript APIs and the package CLI.
- `python` contains the package-owned Harbor runtime.
- `scenarios` contains bundled benchmark scenarios.
- `examples/scenarios` contains small public-friendly scenarios.
- `examples/adapters/gemini-cli` demonstrates a real public-agent wrapper.
- `docs` contains Markdown docs and the VitePress GitHub Pages site.
- `.github/ISSUE_TEMPLATE` routes public bug, scenario, and adapter requests.

Downstream projects install `@kestrel-agents/ruhroh`, supply adapter commands,
and keep project-specific run-agent code outside this repository.
