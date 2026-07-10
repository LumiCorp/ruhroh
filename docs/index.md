---
layout: home

hero:
  name: Ruhroh
  text: See what coding agents actually deliver.
  tagline: Run realistic software tasks, inspect the finished work and the agent journey, compare repeated outcomes, and improve what happens next.
  image:
    light: /ruhroh-logo.png
    dark: /ruhroh-logo-dark.png
    alt: Ruhroh logo
  actions:
    - theme: brand
      text: Run The Example
      link: /getting-started
    - theme: alt
      text: Inspect The Evidence
      link: /report-gallery
    - theme: alt
      text: npm
      link: https://www.npmjs.com/package/@kestrel-agents/ruhroh
---

<script setup lang="ts">
import { withBase } from "vitepress";
</script>

<section class="rr-section rr-section-lead" aria-labelledby="loop-engineering">
  <p class="rr-eyebrow">Loop engineering</p>
  <h2 id="loop-engineering">Build better coding-agent loops from evidence</h2>
  <p>Ruhroh makes agent improvement repeatable. Give agents realistic work, preserve what happened, judge the finished outcome, compare like with like, and use the findings to decide what to change next.</p>
</section>

<ol class="rr-loop" aria-label="The Ruhroh engineering loop">
  <li>
    <span class="rr-step-number">1</span>
    <div><strong>Run</strong><p>Execute the same realistic task across agents, prompts, or configurations.</p></div>
  </li>
  <li>
    <span class="rr-step-number">2</span>
    <div><strong>Inspect</strong><p>Review the finished workspace, journey, transcripts, and evaluator evidence.</p></div>
  </li>
  <li>
    <span class="rr-step-number">3</span>
    <div><strong>Compare</strong><p>Check repeated outcomes, failure patterns, uncertainty, and cohort consistency.</p></div>
  </li>
  <li>
    <span class="rr-step-number">4</span>
    <div><strong>Improve</strong><p>Change the agent, prompt, connector, task, or reviewer and run the next cohort.</p></div>
  </li>
</ol>

<section class="rr-proof" aria-labelledby="proof-heading">
  <div class="rr-proof-intro">
    <p class="rr-eyebrow">What Ruhroh reveals</p>
    <h2 id="proof-heading">A 50% pass rate that should not be published</h2>
    <p>The checked-in sample runs one newsletter task twice. The number is easy to calculate. The evidence explains why it is not yet a conclusion.</p>
  </div>
  <div class="rr-proof-results" aria-label="Sample run outcomes">
    <div>
      <span class="rr-status rr-status-pass">Passed</span>
      <strong>Run 1</strong>
      <p>Delivered the required newsletter with three stories.</p>
    </div>
    <div>
      <span class="rr-status rr-status-fail">Goal mismatch</span>
      <strong>Run 2</strong>
      <p>Created a page, but included only one story.</p>
    </div>
    <div>
      <span class="rr-status rr-status-blocked">Blocked</span>
      <strong>Claim status</strong>
      <p>Only 2 of 5 required runs exist, an evaluator warning remains, and one run needs review.</p>
    </div>
  </div>
  <p class="rr-proof-links"><a :href="withBase('/samples/ruhroh-compare.html')">Open the comparison</a><a :href="withBase('/samples/ruhroh-review.html')">Inspect the review queue</a><a :href="withBase('/samples/ruhroh-claims.html')">See the blockers</a></p>
</section>

## Questions Ruhroh Helps You Answer

<div class="rr-problem-grid">
  <article><h3>Did the agent deliver?</h3><p>Judge the finished software outcome against user-facing success criteria.</p><a :href="withBase('/samples/ruhroh-report.html')">Inspect one run</a></article>
  <article><h3>Why did it fail?</h3><p>Follow the implementation journey, commands, transcripts, reviewer evidence, and final workspace.</p><a :href="withBase('/artifacts')">Follow the evidence</a></article>
  <article><h3>Is the comparison fair?</h3><p>Lock task versions, plan samples, preserve cohort metadata, and surface mismatches.</p><a :href="withBase('/benchmark-methodology')">Review the methodology</a></article>
  <article><h3>Can the reviewer be trusted?</h3><p>Calibrate known outcomes and flag missing evidence, weak judgment, or disagreement.</p><a :href="withBase('/write-an-evaluator')">Build a reviewer</a></article>
  <article><h3>What should improve next?</h3><p>Compare failure modes, duration, iterations, cost, and tokens across repeated runs.</p><a :href="withBase('/samples/ruhroh-compare.html')">Explore the compare report</a></article>
  <article><h3>Can others verify the result?</h3><p>Package the claim, reports, hashes, review queue, and source evidence together.</p><a :href="withBase('/publish-claims')">Publish or block a claim</a></article>
</div>

## Run The Credential-Free Example

```bash
pnpm add -D @kestrel-agents/ruhroh
pnpm exec ruhroh init
export RUHROH_RUN_AGENT_COMMAND="$PWD/ruhroh/adapters/fixture-newsletter/run.sh"
export RUHROH_EVAL_COMMAND="$PWD/ruhroh/evaluators/fixture-newsletter/run.sh"
pnpm exec ruhroh first-run
```

`first-run` checks the local task, suite, agent command, reviewer command, and
Harbor installation, then prints the exact next command. It does not modify the
project or mistake a dry-run preview for completed evidence.

## Choose Your Path

<div class="rr-path-grid">
  <a :href="withBase('/add-to-existing-project')"><strong>Improve an agent</strong><span>Add Ruhroh to a real project, connect an agent, and inspect where its loop breaks down.</span></a>
  <a :href="withBase('/benchmark-pack-tutorial')"><strong>Build an evaluation</strong><span>Author a task and reviewer, freeze a suite, and collect comparable runs.</span></a>
  <a :href="withBase('/publish-claims')"><strong>Publish evidence</strong><span>Validate the result, resolve review items, and create a portable evidence packet.</span></a>
</div>

For the product model, read [Core Concepts](./concepts.md). For generated output,
open the [Report Gallery](./report-gallery.md). For every command and option, use
the [CLI Reference](./cli-reference.md).
