# Codex CLI Scenario Notes

Use this adapter first on smoke-tier scenarios.

Good first checks:

- Codex CLI can edit files inside `RUHROH_WORKSPACE`.
- The generated `.ruhroh/codex-transcript-<n>.log` contains enough detail to
  audit the implementation turn.
- `ruhroh-run-manifest.json` records the adapter/model metadata you expect.

For publishable comparisons, set `CODEX_MODEL` and
`CODEX_CLI_ADAPTER_VERSION` explicitly so compare reports can detect mixed
cohorts.
