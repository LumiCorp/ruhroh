---
id: ruhroh-concepts
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-09
depends_on:
  - README.md
  - docs/architecture.md
  - docs/artifacts.md
---

# Core Concepts

Ruhroh helps teams engineer better coding-agent loops. It turns realistic
software work into repeated, inspectable runs so improvements can be based on
delivered outcomes instead of anecdotes. Ruhroh calls this practice **loop
engineering**.

## The Engineering Loop

<ol class="rr-loop rr-loop-compact" aria-label="The Ruhroh engineering loop">
  <li><span class="rr-step-number">1</span><div><strong>Run</strong><p>Give an agent a realistic task with explicit success rules.</p></div></li>
  <li><span class="rr-step-number">2</span><div><strong>Inspect</strong><p>Review its journey, final workspace, and evaluator evidence.</p></div></li>
  <li><span class="rr-step-number">3</span><div><strong>Compare</strong><p>Aggregate repeated runs while checking that the cohorts match.</p></div></li>
  <li><span class="rr-step-number">4</span><div><strong>Improve</strong><p>Change one part of the loop and collect the next comparable cohort.</p></div></li>
</ol>

The thing being improved might be the coding agent, system prompt, connector,
model, task, reviewer, or execution environment. Ruhroh preserves enough
context to make those differences visible instead of collapsing every run into
one unexplained score.

## The Pieces

| Ruhroh term | Plain meaning | First command |
| --- | --- | --- |
| `scenario` | One realistic user request, its files, and the rules for deciding whether the outcome was delivered. | `ruhroh new-scenario` |
| `suite` | A version-locked group of tasks and the methodology for repeating them. | `ruhroh new-suite` |
| `adapter` | The connector that lets Ruhroh call the coding agent under evaluation. | `ruhroh new-adapter` |
| `evaluator` | The reviewer command that inspects the finished project and returns pass, fail, or review. | `ruhroh new-evaluator` |
| `calibration` | Known pass, fail, and review examples used to test whether the reviewer behaves sensibly. | `ruhroh calibrate-evaluator` |
| `run plan` | The intended matrix of tasks, agents, samples, and seeds. | `ruhroh plan` |
| `artifacts` | The saved result, journey, transcripts, reviewer evidence, metadata, and workspace snapshot. | `ruhroh report` |
| `claim` | An aggregate result plus the evidence another person needs to inspect it. | `ruhroh publish-check` |

## Delivery

A task prompt should read like a real user request. Its review rules should name
the behavior that matters and the evidence the evaluator must inspect. Passing
because a filename or source string exists is appropriate only when the user
request made that contract explicit.

The evaluator runs after the coding agent stops. It inspects a copy of the
finished project, reads the task rules and journey, and returns `passed`,
`failed`, or `review`. Only `passed` maps to score `1`.

## Inspectability

Every run should make the final judgment traceable. Ruhroh can preserve the run
manifest, implementation turns, journey, reviewer input and output, workspace
summary and archive, event logs, and transcripts.

Use `report` to understand one run, `eval-quality` to check the reviewer,
`review` to find human-review items, and `compare` to understand a repeated
cohort. See [Evidence Files](./artifacts.md) for the review path.

## Comparability

Repeated runs become useful only when they describe the same evaluation
conditions. Suites lock task versions. Run plans record intended samples and
seeds. Run manifests preserve agent, model, prompt, reviewer, and environment
metadata. Compare reports surface missing samples, mixed cohorts, low sample
counts, and statistical uncertainty.

## Publication Readiness

A result is not ready simply because some runs passed. `publish-check` requires
the expected suite coverage, enough runs, intact evidence, run-plan agreement,
reviewer-quality checks, and comparable cohorts. It returns a publishable claim
or a concrete list of blockers without hiding the underlying runs.
