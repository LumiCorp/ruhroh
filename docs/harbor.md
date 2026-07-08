---
id: ruhroh-harbor
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-22
depends_on:
  - src/harbor.ts
  - src/generate.ts
---

# Harbor Usage

Ruhroh generates local Harbor task directories:

```text
.generated/ruhroh/harbor/tasks/<scenario-id>/
  task.toml
  instruction.md
  tests/test.sh
  environment/Dockerfile
  solution/solve.sh
  assets/
```

Generated `task.toml` includes schema version, artifacts, task metadata,
scenario id, verifier timeout, agent timeout, and environment config.
Only paths declared in `scenario.json` `assets` are copied as public task
assets. `evaluation.privateAssets` are copied separately under
`private-eval-assets/` for the eval-agent and are rejected by validation if they
overlap public asset declarations.

`requires.network` controls the generated Harbor environment:

- `false` writes `network_mode = "no-network"`.
- `true` writes `network_mode = "public"`.

Generated `tests/test.sh` is generic. It reads the final Ruhroh result JSON,
checks structured completion and score/reward mapping, and does not inspect app
files, routes, build commands, or source text.

Dry-run command:

```bash
pnpm exec ruhroh run --scenario simple-newsletter --adapter custom-shell --dry-run
```

Generate without running Harbor:

```bash
pnpm exec ruhroh generate --scenario simple-newsletter
```
