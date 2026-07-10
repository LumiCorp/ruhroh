# Benchmark Target Examples

These files show the three public benchmark streams Ruhroh is designed to
separate:

- `harness-controlled.openrouter-gpt55.json` compares harnesses while requesting
  the same model through one provider family.
- `model-controlled.aider-openrouter.json` holds the harness constant and varies
  the requested model.
- `recommended-stacks.json` lets each harness use its own native or recommended
  model path.

Use `native-stack` for new configs. The older `recommended-stack` stream name
is still accepted for compatibility with existing benchmark target files.
Prefer declaring `stream` once at the top level. Per-target stream values are
allowed only when they all agree, and `ruhroh validate-targets` validates that
effective stream before collection.

Treat these as configuration templates. Before publishing numbers, pin the real
harness versions, verify each harness can reach the requested provider path, run
`ruhroh validate-targets`, collect with `ruhroh plan` or `ruhroh run`, then
compare with the saved run plan so actual execution metadata is checked against
the intended target rows.

`requestedModel.model` is the literal model string passed to the harness.
`requestedModel.canonicalId` is the shared model identity used when a stream
needs to prove it is controlling for the same underlying model across different
harness-specific strings.
