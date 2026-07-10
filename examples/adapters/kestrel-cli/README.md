# Kestrel CLI Adapter

This maintained adapter runs Kestrel through its public `job_input_v1` and
`job_output_v1` contracts. Ruhroh keeps one `RUHROH_SESSION_HANDLE` for the
entire loop, and the wrapper uses it as the Kestrel session ID on every turn.

## Install

Install a Kestrel CLI release and finish its normal provider setup:

```bash
kestrel --help
```

Set `KESTREL_CLI_BIN` when the executable is not named `kestrel`.

## Contract Mapping

- Ruhroh `build`, `plan`, and `chat` modes map directly to Kestrel interaction
  modes. Build defaults to `actSubmode: full_auto`.
- Kestrel `COMPLETED` maps to `goal_satisfied`.
- Kestrel `WAITING` maps to `continue`, preserving the same session on the next
  Ruhroh iteration.
- Kestrel `CANCELLED` or `job.cancelled` maps to the terminal `cancelled`
  failure classification without discarding replay evidence.
- `job.failed`, a malformed output, or a nonzero CLI exit maps to
  `runtime_failure`.
- Kestrel run ID, thread ID, replay pointer, finalized payload, job input, job
  output, event log, and transcript are retained as Ruhroh evidence.

## Optional Controls

- `KESTREL_PROFILE_ID`: select an installed Kestrel profile.
- `KESTREL_STORE_DRIVER`: `auto` (default), `postgres`, or `sqlite`.
- `KESTREL_APPROVAL_POLICY_PACK_ID`: defaults to `dev` for isolated benchmark
  workspaces.
- `KESTREL_ACT_SUBMODE`: defaults to `full_auto` for build scenarios.
- `KESTREL_CLI_ADAPTER_VERSION`: wrapper version recorded in run manifests.
- Ruhroh benchmark target model fields are copied into the adapter result.

## Validate

The adapter is discoverable without a sibling checkout:

```bash
pnpm exec ruhroh doctor \
  --scenario-dir ruhroh/scenarios \
  --adapter kestrel-cli \
  --json

pnpm exec ruhroh run \
  --scenario-dir ruhroh/scenarios \
  --scenario <scenario-id> \
  --adapter kestrel-cli \
  --dry-run
```

Live execution requires Kestrel provider credentials and the normal Ruhroh
evaluator configuration. Keep benchmark workspaces isolated because build-mode
agents can execute tools allowed by the selected Kestrel profile.

## Continuity

Expected continuity level: `native_session`.

Ruhroh creates one session handle per sample. Kestrel persists that session and
continues it across loop iterations while each individual turn receives a new
run ID and replay pointer.
