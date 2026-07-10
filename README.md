<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-logo-dark.png">
    <img src="https://lumicorp.github.io/ruhroh/ruhroh-logo.png" alt="Ruhroh logo" width="220">
  </picture>
</p>

# <picture><source media="(prefers-color-scheme: dark)" srcset="https://lumicorp.github.io/ruhroh/ruhroh-badge-dark.png"><img src="https://lumicorp.github.io/ruhroh/ruhroh-badge.png" alt="" width="28" align="absmiddle"></picture> Ruhroh

Ruhroh shows what coding agents actually deliver.

It runs agents on realistic software tasks, preserves what happened, reviews the
finished work, and makes repeated runs comparable. Teams can use that evidence
to improve an agent, prompt, connector, reviewer, or benchmark without relying
on a convincing demo or a single pass rate.

This is **loop engineering**: run, inspect, compare, improve, then run again.

## What Ruhroh Helps You Learn

- **Did the agent deliver the requested outcome?** Review the finished project
  against user-facing success criteria instead of source-text proxies.
- **Why did a run succeed or fail?** Follow the implementation journey,
  transcripts, commands, reviewer evidence, and final workspace.
- **Can two agents be compared fairly?** Lock task versions, plan the intended
  samples, preserve cohort metadata, and surface mismatches before ranking.
- **Can the reviewer be trusted?** Calibrate it against known pass, fail, and
  review cases, then flag weak evidence or judge disagreement.
- **Which configuration should improve next?** Compare outcomes, failure modes,
  duration, iterations, cost, and token usage across repeated runs.
- **Can another person verify the conclusion?** Package reports and source
  evidence together, then block claims that are incomplete or too weak.

Ruhroh is agent-neutral. Connect Codex, Claude Code, Gemini CLI, Aider, or
another coding agent through a command wrapper. Ruhroh supplies the task model,
repeat-run workflow, evidence trail, reviewer checks, and reports.

## See What Ruhroh Reveals

The checked-in sample runs the same newsletter task twice through the same
example connector:

| Run | Delivered outcome | Result |
| --- | --- | --- |
| 1 | A newsletter page with the required three stories | Passed |
| 2 | A page with only one story | Failed: `goal_mismatch` |

The aggregate pass rate is 50%, but Ruhroh does not treat that number as a
publishable conclusion. The suite requires five runs, one evaluator-quality
warning is present, and the failed run is recommended for review. The result is
structurally valid and fully inspectable, but the claim stays blocked.

- [Open the compare report](https://lumicorp.github.io/ruhroh/samples/ruhroh-compare)
- [Inspect the review queue](https://lumicorp.github.io/ruhroh/samples/ruhroh-review)
- [See why the claim is blocked](https://lumicorp.github.io/ruhroh/samples/ruhroh-claims)
- [Browse every sample report](https://lumicorp.github.io/ruhroh/report-gallery)

## Try The Loop

Start with the live demo:

```bash
pnpm dlx @kestrel-agents/ruhroh demo
```

Target public command after the unscoped npm package name is available:
`pnpm dlx ruhroh demo`.

`ruhroh demo` is the live first-run path. It uses OpenRouter, prompts for an API
key when `OPENROUTER_API_KEY` is not already set, installs pinned Aider tooling
under `.ruhroh/tools/`, runs a bundled bookmark-manager task, evaluates the
delivered app, and writes `ruhroh-report.html` plus a complete local evidence
package under `.ruhroh/runs/`.

Use the built-in no-credentials fixture path when you want to inspect the local
scaffold or wire Ruhroh into an existing project without a live model call:

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"

pnpm exec ruhroh first-run
```

`first-run` is read-only. It checks the scaffold, task, benchmark suite, agent
command, reviewer command, and Harbor installation, then prints the exact next
command. If Harbor is not installed, it still explains how to preview the run
without treating that preview as completed evidence.

When the fixture loop is ready, run it and inspect the resulting workflow:

```bash
pnpm exec ruhroh run \
  --scenario-dir ruhroh/scenarios \
  --scenario simple-newsletter \
  --adapter custom-shell

pnpm exec ruhroh workflow --html ruhroh-workflow.html
```

The [Getting Started guide](https://lumicorp.github.io/ruhroh/getting-started)
walks through the complete local path.

## The Engineering Loop

1. **Run:** give one or more coding agents the same realistic task and preserve
   the intended task, agent, sample, and seed matrix.
2. **Inspect:** review the delivered workspace, implementation journey,
   transcripts, evaluator decision, and evidence behind the score.
3. **Compare:** aggregate repeated runs while checking sample coverage, task and
   model versions, reviewer quality, environment drift, and uncertainty.
4. **Improve:** use failure patterns and review findings to change the agent,
   prompt, connector, task, or reviewer, then collect a new comparable cohort.

Ruhroh keeps generated Harbor verifiers app-agnostic. Task-specific judgment
belongs in the reviewer command, where it can inspect the finished project and
cite evidence. Only a reviewer `passed` result maps to score `1`; ambiguous
work should return `review` rather than manufacturing confidence.

## Where Ruhroh Fits

Ruhroh wraps the coding agents and project environments a team already uses. A
scenario describes the user outcome and review rules. An adapter invokes the
agent. An evaluator inspects the finished workspace. A suite freezes the tasks
and methodology for repeated collection. Reports connect the aggregate result
back to the individual journeys and evidence.

That separation lets teams improve one part of the loop without rebuilding the
rest. The same task and reviewer can compare two agents, or the same agent can
be rerun after a prompt, model, connector, or tool change.

## Choose A Path

- **Improve a coding agent:** follow
  [Add Ruhroh to an Existing Project](https://lumicorp.github.io/ruhroh/add-to-existing-project)
  and [Connect an Agent](https://lumicorp.github.io/ruhroh/write-an-adapter).
- **Build a repeatable evaluation:** use
  [Write a Task](https://lumicorp.github.io/ruhroh/write-a-scenario),
  [Write a Reviewer](https://lumicorp.github.io/ruhroh/write-an-evaluator), and
  [Benchmark Suites](https://lumicorp.github.io/ruhroh/benchmark-suites).
- **Produce an inspectable result:** follow
  [Publish a Benchmark Result](https://lumicorp.github.io/ruhroh/benchmark-pack-tutorial)
  and [Publish Claims](https://lumicorp.github.io/ruhroh/publish-claims).

## What A Run Preserves

A completed run can include the result, run manifest, implementation turns,
journey summary, reviewer input and output, workspace summary and archive,
event logs, and transcripts. `report`, `eval-quality`, `review`, `compare`, and
`publish-check` turn those files into progressively broader views of the same
evidence.

See [Evidence Files](https://lumicorp.github.io/ruhroh/artifacts) for the review
path and [CLI Reference](https://lumicorp.github.io/ruhroh/cli-reference) for
every command, option, output contract, and exit code.

## Programmatic API

The TypeScript API exposes scenario and suite discovery, benchmark-pack
inspection, task generation, result loading and aggregation, reviewer-result
normalization, claim validation, source verification, and publication-bundle
checks. See the [Programmatic API](https://lumicorp.github.io/ruhroh/programmatic-api)
and [Result JSON Reference](https://lumicorp.github.io/ruhroh/result-json-reference)
for the complete contracts.

## Local Development

```bash
pnpm build
pnpm test
pnpm run docs:build
```

## Security

Treat task prompts and assets as untrusted input. Agents should mutate only
benchmark workspaces, reviewers should inspect copied workspaces, and secrets
should pass only through allowlisted environment variables. Command-backed
agent and reviewer commands run without a shell by default.

See the full [Security Model](https://lumicorp.github.io/ruhroh/security).
