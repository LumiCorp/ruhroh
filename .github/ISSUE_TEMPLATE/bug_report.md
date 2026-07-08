---
name: Bug report
about: Report a reproducible Ruhroh package, CLI, generation, or runtime problem.
title: "[bug] "
labels: bug
---

## What happened?

## Expected behavior

## Reproduction path

```bash
# exact commands
```

## Readiness output

Paste the relevant redacted output:

```bash
pnpm exec ruhroh first-run --json
pnpm exec ruhroh workflow --json
pnpm exec ruhroh doctor --scenario-dir <path> --suite-dir <path> --adapter <adapter> --json
```

If the issue is about results, reports, or publication readiness, also include:

```bash
pnpm exec ruhroh validate-artifacts <run-artifact-dir> --json
pnpm exec ruhroh publish-check <results> --suite-dir <path> --suite <id> --run-plan <plan> --verify-sources --json
```

## Environment

- Ruhroh version:
- Node version:
- pnpm/npm version:
- OS:
- Harbor version or install status:
- Agent adapter:

## Artifacts

Attach or link the smallest redacted evidence packet that reproduces the
problem: generated task paths, `ruhroh-loop-result.json`, run manifest, eval
input/output, workflow HTML, compare HTML, or publication bundle. Do not include
secrets, credentials, or private workspace data.
