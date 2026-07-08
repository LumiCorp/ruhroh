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
- install-from-tarball package smoke via `pnpm run smoke:package`;
- bundled suite validation for every published suite manifest;
- scenario discovery and task generation fixtures;
- dry-run Harbor command construction;
- custom-shell wrapper protocol tests.

Default CI should not require external model credentials or live public-agent
runs.

`pnpm run smoke:package` packs the current repository, installs the `.tgz` into
a fresh temporary project, runs the installed `ruhroh` bin, imports the public
API, resolves exported schemas, scaffolds `ruhroh init`, validates the starter
suite, and dry-runs the fixture adapter. This is the release-readiness gate for
"a developer can install the package and start benchmarking" regressions.

Manual workflows may run live adapters when credentials are available. Upload
the generated Harbor job directory, Ruhroh summary JSON, transcripts, and
workspace archive as artifacts.

The repo-local `Ruhroh Smoke` workflow keeps live agent execution off by
default. On manual dispatch, set `live_gemini=true` and provide a
`GEMINI_API_KEY` secret to run the Gemini CLI custom-shell smoke.
Treat Codex CLI and Claude Code wrapper runs the same way: run dry-run and
shell-syntax checks by default, then enable live adapter jobs only in isolated
benchmark environments with explicit credentials and uploaded artifacts.
