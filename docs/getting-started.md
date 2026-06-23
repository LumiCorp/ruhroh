---
id: ruhroh-getting-started
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-06-23
depends_on:
  - README.md
  - package.json
---

# Getting Started

Install Ruhroh in a project where you want to generate and run repeatable agent
tasks:

```bash
pnpm add -D @kestrel-agents/ruhroh
```

List the bundled scenarios:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --list
```

Generate a Harbor task without running an agent:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --generate-only
```

The generated task appears under:

```text
.generated/ruhroh/harbor/tasks/simple-newsletter/
```

Preview the Harbor command:

```bash
pnpm exec ruhroh --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios --scenario simple-newsletter --adapter custom-shell --dry-run
```

That dry run should print a `harbor run` command and placeholder secret values
such as `${OPENAI_API_KEY}`. It should not start Harbor or call a live model.

To run a live agent, provide a command-backed adapter:

```bash
pnpm exec ruhroh \
  --scenario-dir node_modules/@kestrel-agents/ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter ./path/to/agent-wrapper.sh
```

Use the artifacts from the Harbor run to review what happened: the final result,
iteration records, transcripts, event logs, eval judgment, and workspace
snapshot.
