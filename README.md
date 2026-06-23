# Ruhroh

Ruhroh is the **Real-User Harness for Repair-Oriented Harbor**.

Ruhroh runs real-user task scenarios against coding agents through adapters,
preserves the full implementation journey, and runs a terminal evaluator over
the final delivered workspace.

Ruhroh is agent-agnostic. Kestrel is one reference run-agent adapter, not the
benchmark itself. Harbor is the execution substrate.

## Install

```bash
pnpm add -D @kestrel-agents/ruhroh
```

## Quickstart

Create scenarios under `ruhroh/scenarios/<id>/`, or use the bundled scenarios
under `node_modules/@kestrel-agents/ruhroh/scenarios`, then run:

```bash
pnpm ruhroh --list
pnpm ruhroh --scenario simple-newsletter --generate-only
pnpm ruhroh --scenario simple-newsletter --adapter ./path/to/agent-adapter --dry-run
```

In this repo, the same package CLI is available with:

```bash
pnpm ruhroh --scenario-dir examples/scenarios --list
pnpm ruhroh --scenario-dir examples/scenarios --scenario simple-newsletter --generate-only
```

This package currently contains the portable TypeScript surfaces:

- scenario schema and validation;
- run-agent adapter interfaces and capability compatibility helpers;
- eval and final result types;
- verdict mapping helpers;
- env forwarding and redaction helpers;
- Harbor command construction helpers;
- JSON scenario discovery and Harbor task generation helpers.

## Scenario Generation

Ruhroh can load JSON scenarios from:

```text
ruhroh/scenarios/<id>/
  scenario.json
  instruction.md
  assets/
```

and generate local Harbor task directories under:

```text
.generated/ruhroh/harbor/tasks/<scenario-id>/
```

The generated Harbor verifier is app-agnostic. It only validates that the
structured Ruhroh result exists and maps to a passing score/reward; it does not
perform required-file, route, command, or source-text checks.

The public API exports:

- `discoverRuhrohScenarios()`
- `loadRuhrohScenario()`
- `generateHarborTask()`
- `generateHarborDataset()`

The package CLI exposes this through:

```bash
pnpm ruhroh --scenario-dir ruhroh/scenarios --generate-only
pnpm ruhroh --scenario-dir ruhroh/scenarios --dry-run
```

This package ships the reusable scenario source under `scenarios/` and the
package-owned Python Harbor runtime under `python/ruhroh`. Run-agents are wired
into this runtime as command adapters through
`RUHROH_RUN_AGENT_COMMAND`; terminal evaluation can be supplied through
`RUHROH_EVAL_COMMAND` or fixture eval variables.

Kestrel is a consumer adapter, not a Ruhroh package dependency. The Harbor
harness is package-owned for generated Ruhroh tasks.

## Docs

- Architecture: `docs/ruhroh/architecture.md`
- Scenario format: `docs/ruhroh/scenario-format.md`
- Adapter protocol: `docs/ruhroh/adapter-protocol.md`
- Custom-shell adapter: `docs/ruhroh/custom-shell.md`
- Harbor: `docs/ruhroh/harbor.md`
- Eval-agent: `docs/ruhroh/eval-agent.md`
- Artifacts: `docs/ruhroh/artifacts.md`
- CI: `docs/ruhroh/ci.md`
- Security: `docs/ruhroh/security.md`
- Limitations: `docs/ruhroh/limitations.md`
- Public repo layout: `docs/ruhroh/public-repo-layout.md`

## Security

Scenario prompts and assets are untrusted input. Run-agents should mutate only
benchmark workspaces. Eval-agent inspection should happen against a copied
workspace. Secrets must pass through allowlisted environment variables, and
dry-run output must never print secret values. Generated Harbor verifiers do
not perform app-goal checks.
