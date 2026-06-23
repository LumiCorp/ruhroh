# Contributing

Ruhroh is maintainer-led, but focused contributions are welcome.

Good contribution areas:

- bug reports with exact commands and output;
- docs improvements that make usage clearer;
- small, realistic scenarios;
- command-backed adapter examples;
- narrowly scoped fixes to package CLI, scenario generation, or runtime behavior.

Please keep scenarios and adapters agent-agnostic unless the contribution is
explicitly an example adapter. Generated verifier logic should stay generic and
should not grow scenario-specific file, route, command, or source-text checks.

Before opening a pull request:

```bash
pnpm install
pnpm test
pnpm build
pnpm docs:build
```

For package-surface changes, also run a clean install smoke from a packed
tarball and verify `ruhroh --list`, `--dry-run`, and `--generate-only`.

Live model or public-agent runs should remain optional and credentialed. Do not
put live credentials, transcripts containing secrets, or private workspace data
in issues or pull requests.
