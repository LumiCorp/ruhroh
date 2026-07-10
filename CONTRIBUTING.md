# Contributing

Ruhroh is maintainer-led, but focused contributions are welcome.

Good contribution areas:

- bug reports with exact commands, readiness output, and redacted artifacts;
- docs improvements that make usage clearer;
- small, realistic scenarios with calibration anchors;
- command-backed adapter examples that preserve result metadata;
- evaluator examples or calibration improvements;
- benchmark-pack, claim-registry, and publication workflow improvements;
- narrowly scoped fixes to package CLI, scenario generation, or runtime behavior.

Please keep scenarios and adapters agent-agnostic unless the contribution is
explicitly an example adapter. Generated verifier logic should stay generic and
should not grow scenario-specific file, route, command, or source-text checks.

## Before Filing An Issue

Use the issue templates so maintainers get enough evidence to reproduce or
review the report:

- bugs should include redacted `first-run`, `workflow`, or `doctor` output;
- scenario and benchmark-pack proposals should include rubric, calibration, and
  `inspect-pack` readiness context;
- adapter requests should explain invocation, credentials, continuity, metadata,
  transcripts, and dry-run behavior;
- claim-publication issues should include the `publish-check`, `validate-bundle`,
  `claim-index`, and publication bundle evidence.

Do not include live credentials, transcripts containing secrets, or private
workspace data in issues or pull requests.

## Local Verification

Before opening a pull request:

```bash
pnpm install
CI=true pnpm build
CI=true pnpm test
CI=true pnpm docs:build
CI=true pnpm run docs:samples:check
```

Use the pull request template to mark which evidence applies to the change.
Documentation-only changes do not need live agent runs, but benchmark-pack,
adapter, evaluator, report, or publication changes should include the matching
command output or artifact paths in the review notes.

For package-surface changes, also run a clean install smoke from a packed
tarball:

```bash
CI=true pnpm run smoke:package
```

For benchmark-pack changes, include strict registry evidence:

```bash
pnpm exec ruhroh validate --scenario-dir scenarios --suite-dir suites --json
pnpm exec ruhroh inspect-pack --scenario-dir scenarios --suite-dir suites --require-calibrated --require-risk-reviewed --json
pnpm exec ruhroh calibrate-evaluator --scenario-dir scenarios --scenario <id> --json
```

For result, report, or publication changes, include the relevant artifact gate:

```bash
pnpm exec ruhroh publish-check <results> --suite-dir suites --suite <id> --run-plan <plan> --verify-sources --json
pnpm exec ruhroh validate-bundle ruhroh-publication --json
pnpm exec ruhroh claim-index ruhroh-publication --require-publishable --json
```

`docs:samples:check` rebuilds the checked-in report gallery under
`docs/public/samples`. If it fails, regenerate the samples with
`pnpm build && pnpm run docs:samples` and include the resulting sample changes.
Before adding or changing links to generated report HTML, read
[Report Sample Routing](docs/development/report-sample-routing.md). Those links
must preserve the deployment base and bypass VitePress client-side routing;
file-existence checks alone do not catch the click-time 404 regression.

Live model or public-agent runs should remain optional and credentialed. Default
CI should stay credential-free and should rely on the fixture adapter/evaluator
path unless a workflow is manually dispatched with secrets.
