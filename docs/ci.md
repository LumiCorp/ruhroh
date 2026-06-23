---
id: ruhroh-ci
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - ../.github/workflows/ruhroh-smoke.yml
  - package.json
---

# CI Usage

Default CI should exercise deterministic Ruhroh surfaces:

- package build;
- package unit tests;
- scenario discovery and task generation fixtures;
- dry-run Harbor command construction;
- custom-shell wrapper protocol tests.

Default CI should not require external model credentials or live public-agent
runs.

Manual workflows may run live adapters when credentials are available. Upload
the generated Harbor job directory, Ruhroh summary JSON, transcripts, and
workspace archive as artifacts.

The repo-local `Ruhroh Smoke` workflow keeps live agent execution off by
default. On manual dispatch, set `live_gemini=true` and provide a
`GEMINI_API_KEY` secret to run the Gemini CLI custom-shell smoke.
