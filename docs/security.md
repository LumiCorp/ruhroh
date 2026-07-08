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

- Treat task prompts and assets as untrusted input.
- Agents mutate only benchmark workspaces.
- Reviewer inspection should happen against a copied workspace or constrained
  output area.
- Secrets must be passed through explicit environment allowlists.
- Dry-run output must print placeholders such as `${OPENAI_API_KEY}`, never
  secret values.
- Command-backed agent and reviewer commands execute without a shell by default.
  Only set `RUHROH_RUN_AGENT_COMMAND_SHELL=1` or `RUHROH_EVAL_COMMAND_SHELL=1`
  for trusted wrappers that require shell operators.
- `ruhroh doctor` includes a `command-safety` check that warns when shell
  execution is enabled or when a no-shell command string contains operators such
  as `;`, `&&`, pipes, or redirects that will be treated as literal arguments.
- Generated Harbor verifiers do not perform app-goal checks.
- Public agent examples must not require live credentials in default CI.
- Publication packets, claim indexes, report galleries, and issue attachments
  should be treated as disclosure material. Review transcripts, event logs,
  workspace archives, screenshots, reviewer outputs, and copied `sources/`
  files before making them public.
- Keep private reviewer files separate from public task `assets` entries.
  `ruhroh validate` rejects obvious overlap, and `inspect-pack` records public
  asset and private reviewer file fingerprints for registry review.
- Prefer redacted or synthetic sample evidence for public documentation.
  `docs/public/samples` is generated from fixture data and should not be
  replaced with live-agent traces, customer data, or private workspace archives.
- When sharing a publication packet, include enough evidence for independent
  review while removing credentials, personal data, proprietary source files,
  private prompts, and unrelated workspace material.

When using public coding agents, install them from official sources and review
their command execution permissions before running on untrusted tasks.
