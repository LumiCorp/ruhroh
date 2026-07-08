---
id: ruhroh-troubleshooting
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - docs/getting-started.md
  - docs/cli-reference.md
  - docs/custom-shell.md
---

# Troubleshooting

Start with `doctor`:

```bash
pnpm exec ruhroh doctor \
  --scenario-dir ruhroh/scenarios \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --adapter custom-shell
```

Add `--json` for CI or setup scripts.

## `first-run` Is Blocked

`first-run` is a setup gate, not a benchmark run. Use it to find the next
missing piece in the credential-free fixture path:

```bash
pnpm exec ruhroh first-run
pnpm exec ruhroh first-run --json
```

If JSON output has `dryRunReady: true` but `ready: false`, the local scaffold,
fixture adapter, and fixture evaluator are ready for command preview, but the
full Harbor-backed loop is still blocked. This is a useful setup milestone, not
a completed run. Use the dry-run preview while installing Harbor:

```bash
pnpm exec ruhroh first-run --allow-dry-run --json
pnpm exec ruhroh run --scenario-dir ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

The first loop is complete only after a real run preserves a
`ruhroh-loop-result.json` artifact.

## `workflow` Stays On The First Fixture Stage

`workflow` advances from the first stage only when it can find preserved run
results. By default it checks `results/`, `ruhroh/results/`, and
`.generated/ruhroh/`; pass a path explicitly when your Harbor outputs live
elsewhere:

```bash
pnpm exec ruhroh workflow ./path/to/results --html ruhroh-workflow.html
pnpm exec ruhroh validate-artifacts ./path/to/results
```

If no result is found, rerun the fixture without `--dry-run`. If a result is
found but validation fails, fix artifact preservation before using `compare` or
`publish-check`; a claim cannot be independently inspected without the result,
manifest, evaluator output, journey, and workspace evidence.

## Harbor Is Missing

`doctor` reports Harbor availability separately. You can still validate
scenarios, scaffold adapters, and generate task directories without starting a
run:

```bash
pnpm exec ruhroh validate --scenario-dir ruhroh/scenarios
pnpm exec ruhroh generate --scenario simple-newsletter
```

Use `--dry-run` to inspect the Harbor command before installing or invoking
Harbor. Dry-run output is a preview only: it does not write Harbor task
directories, write a run plan, start Harbor, or call an agent. Use
`ruhroh generate` when you want to materialize the generated task files without
starting Harbor. `--generate-only` remains available as a legacy alias.

## Adapter Completion Is Not Detected

For `custom-shell`, the adapter must either print the configured final JSON
line or write the result file indicated by `RUHROH_RESULT_PATH`. Confirm the
wrapper exits non-zero for runtime failures and does not claim success before
the workspace outcome is complete.

```bash
pnpm exec ruhroh new-adapter local-agent
pnpm exec ruhroh doctor --scenario-dir ruhroh/scenarios --adapter ./ruhroh/adapters/local-agent/run.sh
```

## Adapter Metadata Is Too Thin

`doctor` reports an `adapter-metadata` warning when a command wrapper cannot be
inspected, does not write `RUHROH_RESULT_PATH`, or omits comparison metadata.
Before repeated live-agent runs, update the wrapper result file to include
`adapterVersion`, `model`, and artifact paths such as a transcript. Add `usage`
when cost or token data is available.

If the wrapper is not a readable file path, move the command into a script and
pass that script to `--adapter`; that gives Ruhroh and reviewers a stable
adapter surface to inspect.

## Evaluator JSON Is Malformed

The eval command must emit or write `ruhroh_eval_result_v1`. Validate the
preserved run artifacts after a failed run:

```bash
pnpm exec ruhroh validate-artifacts ./path/to/run-artifacts --json
```

Look for the eval result path, schema URL, status, evidence refs, and criteria
results.

## Claim Is Not Publishable

Run the publication workflow:

```bash
pnpm exec ruhroh publish-check ./path/to/results \
  --suite-dir ruhroh/suites \
  --suite ruhroh-smoke \
  --run-plan .generated/ruhroh/ruhroh-run-plan.json \
  --verify-sources
```

Exit code `2` means the result was readable but blocked. The blocker list tells
you whether to collect more runs, select the right suite, fix run-plan coverage,
repair artifact preservation, or improve evaluator evidence.

## Artifacts Are Missing

Check the individual run directory first:

```bash
pnpm exec ruhroh report ./path/to/ruhroh-loop-result.json
pnpm exec ruhroh validate-artifacts ./path/to/run-artifacts
```

Missing journey, manifest, eval input, workspace summary, or eval result files
reduce auditability and can block publication.

## Shell Command Quoting Looks Wrong

Command-backed adapters and evaluators run without a shell by default. If a
command string contains pipes, redirects, variable expansion, or other shell
operators, either wrap it in a script file or explicitly opt into shell
execution only for trusted local commands.
