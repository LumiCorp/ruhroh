# Claude Code Scenario Notes

Use this adapter first on smoke-tier scenarios.

Good first checks:

- Claude Code can edit files inside `RUHROH_WORKSPACE`.
- The generated `.ruhroh/claude-transcript-<n>.log` contains enough detail to
  audit the implementation turn.
- `ruhroh-run-manifest.json` records the adapter/model metadata you expect.

For publishable comparisons, set `CLAUDE_MODEL` and
`CLAUDE_CODE_ADAPTER_VERSION` explicitly so compare reports can detect mixed
cohorts.
