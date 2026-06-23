---
id: ruhroh-security
domain: security
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/env.ts
  - src/generate.ts
---

# Security Model

Ruhroh handles untrusted benchmark material and untrusted agent output.

Rules:

- Treat scenario prompts and assets as untrusted input.
- Run-agents mutate only benchmark workspaces.
- Eval-agent inspection should happen against a copied workspace or constrained
  output area.
- Secrets must be passed through explicit environment allowlists.
- Dry-run output must print placeholders such as `${OPENAI_API_KEY}`, never
  secret values.
- Generated Harbor verifiers do not perform app-goal checks.
- Public agent examples must not require live credentials in default CI.

When using public coding agents, install them from official sources and review
their command execution permissions before running on untrusted scenarios.
