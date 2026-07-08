# Aider Scenario Notes

Use this wrapper for scenarios where Aider can work entirely inside the
generated benchmark workspace. Keep task prompts outcome-focused and let the
eval-agent judge the final workspace rather than relying on Aider's exit status
as the benchmark verdict.

Before collecting repeated samples:

- run `ruhroh doctor --adapter examples/adapters/aider/run.sh`;
- confirm the `adapter-metadata` check is ready for repeated comparisons;
- record the model/provider configuration through `AIDER_MODEL` or the wrapper
  result file;
- keep transcripts from every run with the preserved Ruhroh artifacts.
