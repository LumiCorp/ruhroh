---
id: ruhroh-limitations
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - README.md
  - python/ruhroh/harbor_agent.py
---

# Limitations

- The package-owned Python Harbor runner supports command-backed agent
  connectors selected on the run command. First-class provider packages for
  Kestrel and model review are still future work.
- The Kestrel connector is a consumer integration, not the public benchmark
  boundary; consumers wire agent commands through `RUHROH_RUN_AGENT_COMMAND`.
- Model-backed review is supplied by consumers through `RUHROH_EVAL_COMMAND`.
  Fixture review remains available for deterministic package smoke tests.
- Public agent wrappers using `custom-shell` have `workspace_only` continuity
  unless the wrapper implements stronger session preservation.
- Live public-agent runs require credentials and are intentionally excluded from
  default CI.
