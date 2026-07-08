---
name: Adapter request
about: Request or discuss a run-agent adapter example.
title: "[adapter] "
labels: adapter
---

## Agent or tool

## Expected invocation

```bash
# command or wrapper shape
```

## Required credentials

## Continuity expectations

For example: `workspace_only`, transcript preservation, or native sessions.

## Result metadata

Describe how the wrapper can preserve:

- adapter id and version;
- model/provider/prompt identity;
- transcript and event paths;
- final JSON line or `RUHROH_RESULT_PATH` output;
- completion status and failure reason.

## Validation path

Expected local checks:

```bash
pnpm exec ruhroh examples
pnpm exec ruhroh doctor --scenario-dir examples/scenarios --adapter custom-shell --json
pnpm exec ruhroh run --scenario-dir examples/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

## Notes

Live credentials should stay out of default CI.
