---
id: ruhroh-report-gallery
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-09
depends_on:
  - docs/artifacts.md
  - docs/publish-claims.md
  - scripts/generate-docs-samples.mjs
---

<script setup lang="ts">
import { withBase } from "vitepress";
</script>

# Report Gallery

Ruhroh reports let a reader move from an aggregate number to the runs,
reviewer decisions, transcripts, workspaces, and blockers behind it. Start with
the sample result, then follow the question you want answered.

These reports make the inspect and compare stages of **loop engineering**
visible, so the next improvement can be based on evidence from the last run.

<section class="rr-proof" aria-labelledby="gallery-proof">
  <div class="rr-proof-intro">
    <p class="rr-eyebrow">Featured proof</p>
    <h2 id="gallery-proof">One task, two runs, one incomplete conclusion</h2>
    <p>The same example connector attempts the newsletter task twice. One run delivers three stories and passes. The other delivers one story and fails with a goal mismatch.</p>
  </div>
  <div class="rr-proof-results" aria-label="Sample run outcomes">
    <div><span class="rr-status rr-status-pass">Passed</span><strong>Run 1</strong><p>The requested newsletter outcome was delivered.</p></div>
    <div><span class="rr-status rr-status-fail">Goal mismatch</span><strong>Run 2</strong><p>The page exists, but required content is missing.</p></div>
    <div><span class="rr-status rr-status-blocked">Blocked</span><strong>50% pass rate</strong><p>Only 2 of 5 runs exist, a reviewer warning remains, and one run merits review.</p></div>
  </div>
  <p class="rr-proof-links"><a :href="withBase('/samples/ruhroh-compare.html')">Open the comparison</a><a :href="withBase('/samples/ruhroh-review.html')">Inspect the review queue</a><a :href="withBase('/samples/ruhroh-claims.html')">See the claim status</a></p>
</section>

## Follow A Question

| What you need to know | Open this report | What it shows |
| --- | --- | --- |
| Did one run deliver the outcome? | [Single-run report](/samples/ruhroh-report) | Verdict, reviewer result, implementation timeline, commands, criteria, and saved evidence. |
| Did the reviewer support the score? | [Evaluation evidence report](/samples/ruhroh-eval-quality) | Missing evidence, criteria coverage, commands, confidence, and judge details. |
| What needs a person to inspect? | [Review queue](/samples/ruhroh-review) | Required and recommended review items with reasons and evidence links. |
| What changes across repeated runs? | [Compare report](/samples/ruhroh-compare) | Pass rates, uncertainty, failure modes, usage, cohort warnings, review state, and source runs. |
| Can the conclusion be cited? | [Claim index](/samples/ruhroh-claims) | Publishability, blockers, suite identity, run counts, evidence coverage, and packet links. |

## Understand The Whole Loop

The [workflow guide](/samples/ruhroh-workflow) shows how a project moves from
the credential-free fixture through task authoring, reviewer calibration, run
planning, comparison, and publication readiness. Each stage stays open until
the evidence required for that stage exists.

Use it when you need the next action. Use the reports above when you need to
understand a particular result or blocker.

## Inspect A Portable Packet

`publish-check --bundle` packages the claim, summary, reports, manifest, and
hashed source evidence so another person can inspect the result without the
original working directory.

| Packet view | Purpose |
| --- | --- |
| [Comparison](/samples/ruhroh-publication/ruhroh-compare) | Review the aggregate result, cohorts, warnings, and source-run links. |
| [Evaluation evidence](/samples/ruhroh-publication/ruhroh-eval-quality) | Check whether reviewer judgments contain enough support. |
| [Review queue](/samples/ruhroh-publication/ruhroh-review) | Resolve the human-review items that remain in the packet. |
| [Manifest](/samples/ruhroh-publication/manifest.json) | Verify the packet inventory and versioned contract. |

The packet remains blocked for the same reasons as the source comparison. A
portable packet makes the evidence durable; it does not make weak evidence
publishable.

## How To Read Surprising Results

1. Start with the compare matrix and identify the task-agent group that looks
   surprising.
2. Open its saved result and check the final outcome, failure bucket, and unmet
   criteria.
3. Inspect the journey, transcript, commands, and workspace evidence.
4. Check evaluator-quality warnings and the human-review queue.
5. Decide whether the issue belongs to the agent, prompt, connector, task,
   reviewer, or execution environment before changing the next run.

See [Evidence Files](./artifacts.md) for the underlying artifacts and
[Publish Claims](./publish-claims.md) for publication requirements.

<details>
<summary>Maintainer: regenerate the gallery</summary>

After a report contract changes:

```bash
pnpm build
pnpm run docs:samples
pnpm run docs:samples:check
```

</details>
