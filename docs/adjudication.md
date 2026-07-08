---
id: ruhroh-adjudication
domain: benchmarks
status: active
owner: ruhroh-maintainers
last_verified_at: 2026-07-08
depends_on:
  - src/results.ts
  - src/cli.ts
  - docs/eval-agent.md
---

# Human Review

Ruhroh treats reviewer judgment as part of the benchmark evidence, not an
invisible score oracle. Runs that fail, request review, have weak reviewer
evidence, miss saved evidence files, or contain disagreeing judge votes enter a
review queue.

Inspect the queue directly:

```bash
pnpm exec ruhroh review ./path/to/results
pnpm exec ruhroh review ./path/to/results --json
pnpm exec ruhroh review ./path/to/results --html ruhroh-review.html
```

`review` accepts a single `ruhroh-loop-result.json`, one saved-run directory, or
a recursive result root. JSON output is versioned as
`ruhroh_review_queue_v1` and includes:

- `requiredCount` for items that must be reviewed before publication;
- `recommendedCount` for audit-quality issues that should be checked;
- `reviewQueue` entries with task, agent connector, run id, score, review
  status, reasons, unmet criteria, transcript paths, event-log paths, and
  evidence pointers.

Required review covers explicit `status: "review"`, review infrastructure
failures, and reviewer warnings that call for human review such as disagreeing
`judgeVotes`. Recommended review covers non-passing runs, unmet criteria,
missing evidence, weak reviewer output, or incomplete evidence files.

For each item:

1. Open the listed transcripts, event logs, review output, and final project
   evidence files.
2. Check the task rules and calibration examples before changing a judgment.
3. Record the human review decision, reviewer identity, rationale, and accepted
   limitations with the benchmark pack or publication review.
4. Update the reviewer, rerun the task, or document why the original
   judgment stands.
5. Rerun `ruhroh publish-check` before publishing the claim.

`ruhroh report`, `ruhroh compare`, and `ruhroh publish-check` all include the
same queue. Use `ruhroh review` when the immediate job is triage: deciding what
must be inspected before a score can be defended.
