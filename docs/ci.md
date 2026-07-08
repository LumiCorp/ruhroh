---
id: ruhroh-ci
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - ../.github/workflows/ruhroh-smoke.yml
  - ../examples/ci/ruhroh-pack-registry.yml
  - ../examples/ci/ruhroh-claim-publication.yml
  - ../examples/ci/ruhroh-sharded-collection.yml
  - package.json
---

# CI Usage

Default CI should exercise deterministic Ruhroh surfaces:

- package build;
- package unit tests;
- install-from-tarball package smoke via `pnpm run smoke:package`;
- generated docs sample freshness via `pnpm run docs:samples:check`;
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

`pnpm run docs:samples:check` rebuilds the checked-in report gallery artifacts
under `docs/public/samples/` from the current `dist/cli.js`. It first fails
with a direct `pnpm build` reminder when the built CLI is missing, then checks
that docs links into `/ruhroh/samples/` resolve to generated artifacts, then
fails if tracked samples changed or new untracked sample files appeared. The
failure message points at missing links, stale files, or untracked generated
files. This keeps the workflow guide, report HTML, publish-check JSON,
publication bundle, and claim index aligned with the current CLI contracts
instead of letting the visible audit examples drift.

Manual workflows may run live adapters when credentials are available. Upload
the generated Harbor job directory, Ruhroh summary JSON, transcripts, and
workspace archive as artifacts.

The repo-local `Ruhroh Smoke` workflow keeps live agent execution off by
default. On manual dispatch, set `live_gemini=true` and provide a
`GEMINI_API_KEY` secret to run the Gemini CLI custom-shell smoke.
Treat Codex CLI and Claude Code wrapper runs the same way: run dry-run and
shell-syntax checks by default, then enable live adapter jobs only in isolated
benchmark environments with explicit credentials and uploaded artifacts.

For benchmark-pack contribution or registry jobs, run
`inspect-pack --require-calibrated --require-risk-reviewed` before any live
collection. Use
[Benchmark Pack Registry](./benchmark-pack-registry.md) and
[examples/ci/ruhroh-pack-registry.yml](../examples/ci/ruhroh-pack-registry.yml)
as the CI shape: validate scenarios and suites, require calibration coverage
and contamination/reward-hacking review, emit an inspection JSON artifact, and
fail before collection if the pack cannot support defensible results.
The template also writes a compact benchmark-pack inspection card to
`GITHUB_STEP_SUMMARY`, uploads `ruhroh-pack-inspection-summary.md`, and updates a
single pull-request comment with the same status, blocker, warning,
calibration, and risk-review counts. Keep `pull-requests: write` permission on
that workflow if you want the PR comment; remove only the comment step when a
read-only workflow is required.

For repeated live-agent cohorts that are too expensive for one worker, use
[Distributed Runs](./distributed-runs.md) and
[examples/ci/ruhroh-sharded-collection.yml](../examples/ci/ruhroh-sharded-collection.yml)
as the CI shape: write one canonical run plan, split collection with
`--shard <i>/<n>`, upload every shard's result artifacts, merge them into one
result root, and run the same publication gate below.

## Claim Publication Gate

For engineering teams comparing agents in CI, keep live collection separate from
publication checks:

1. collect repeated runs in an isolated benchmark environment;
2. preserve the matching `.generated/ruhroh/ruhroh-run-plan.json`;
3. upload or check out the result artifacts;
4. run the publication gate against those artifacts.

Use [examples/ci/ruhroh-claim-publication.yml](../examples/ci/ruhroh-claim-publication.yml)
as a starting point. It runs:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios --suite-dir ruhroh/suites --suite "$SUITE_ID" --json
pnpm exec ruhroh validate-artifacts "$RESULTS_PATH" --json
pnpm exec ruhroh publish-check "$RESULTS_PATH" --suite-dir ruhroh/suites --suite "$SUITE_ID" --run-plan "$RUN_PLAN_PATH" --bundle "ruhroh-publication/$SUITE_ID" --summary-md "$GITHUB_STEP_SUMMARY" --verify-sources --json
pnpm exec ruhroh validate-bundle "ruhroh-publication/$SUITE_ID" --json
pnpm exec ruhroh claim-index ruhroh-publication --require-publishable --html ruhroh-claims.html --json
```

`--summary-md "$GITHUB_STEP_SUMMARY"` writes a compact Markdown status card for
the workflow run: publishable/blocked status, evidence paths, blockers,
remediation codes, advisories, and source-verification status. Keep the JSON and
bundle artifacts as the durable record; use the step summary for fast PR review.

That final `claim-index --require-publishable` step is the registry ingestion
gate: it exits `0` only when every discovered claim is structurally valid and
publishable, `1` for malformed input or invalid claims, and `2` when the
evidence is structurally valid but at least one claim still has blockers.

Upload the whole `ruhroh-publication/` directory, not just the HTML table. The
bundle contains source evidence under `sources/`, so reviewers can rerun
`validate-claim --verify-sources` after downloading or moving the artifact.
