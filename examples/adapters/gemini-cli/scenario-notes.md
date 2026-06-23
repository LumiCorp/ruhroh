# Scenario Notes

Start with `simple-newsletter` because it is dependency-free and small enough
for a first public-agent smoke.

The richer `grocery-budget-planner` scenario is also dependency-free but should
be used after the smoke path proves that:

- Gemini CLI can write files in the Ruhroh workspace;
- transcripts are captured under `.ruhroh/`;
- the final JSON completion line is present;
- the terminal eval-agent has enough evidence to inspect the final workspace.

Do not add scenario-specific app checks to Ruhroh core for this adapter. The
generated Harbor verifier remains structured-result-only.
