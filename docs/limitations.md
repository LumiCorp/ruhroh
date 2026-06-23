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

- The package-owned Python Harbor runtime supports command-backed adapters
  selected at runtime. First-class provider packages for Kestrel and model eval
  are still future work.
- The Kestrel adapter is a consumer integration, not the public benchmark
  boundary; consumers wire adapters through `RUHROH_RUN_AGENT_COMMAND`.
- Model-backed eval is supplied by consumers through `RUHROH_EVAL_COMMAND`.
  Fixture eval remains available for deterministic package smoke tests.
- Public agent wrappers using `custom-shell` have `workspace_only` continuity
  unless the wrapper implements stronger session preservation.
- Live public-agent runs require credentials and are intentionally excluded from
  default CI.
