# Ruhroh Publication Bundle

Status: blocked
Generated: 2026-07-08T12:00:00.000Z
Results: sources/results
Suite: ruhroh-sample
Run plan: sources/ruhroh-run-plan.json
Reviewer calibration report: sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json

## Review Order

- Open ruhroh-compare.html for the aggregate outcome, intervals, blockers, and evidence browser.
- Open ruhroh-eval-quality.html to inspect reviewer evidence warnings before citing the claim.
- Open ruhroh-review.html for the human review queue and required review items.
- Inspect sources/ for the hashed run plan, reviewer check report, result JSON, transcripts, review outputs, and saved evidence inventory.

## Files

- manifest.json: Inventory for this publication packet.
- publish-check.json: Publishability verdict, blockers, remediation, compare output, and optional source verification.
- ruhroh-compare.html: Static aggregate report for human inspection.
- benchmark-claim.json: Compact benchmark claim JSON for archival and downstream publication.
- benchmark-summary.json: Row-oriented benchmark summary JSON for reports or leaderboard ingestion.
- ruhroh-review.json: Human review queue derived from the claim's saved results.
- ruhroh-review.html: Static human review queue for audit before citation.
- ruhroh-eval-quality.json: Reviewer evidence quality report for the claim's saved results.
- ruhroh-eval-quality.html: Static reviewer evidence report for audit before citation.
- README.md: Human-readable bundle summary.
- sources/suite/suite.json: Suite manifest hashed by this claim.
- sources/ruhroh-run-plan.json: Run plan hashed by this claim.
- sources/evaluator-calibration/complete-newsletter-pass/ruhroh-eval-calibration-input.json: Reviewer calibration input for complete-newsletter-pass.
- sources/evaluator-calibration/complete-newsletter-pass/ruhroh-loop-eval.json: Reviewer calibration output for complete-newsletter-pass.
- sources/evaluator-calibration/missing-page-failure/ruhroh-eval-calibration-input.json: Reviewer calibration input for missing-page-failure.
- sources/evaluator-calibration/missing-page-failure/ruhroh-loop-eval.json: Reviewer calibration output for missing-page-failure.
- sources/evaluator-calibration/partial-signup-review/ruhroh-eval-calibration-input.json: Reviewer calibration input for partial-signup-review.
- sources/evaluator-calibration/partial-signup-review/ruhroh-loop-eval.json: Reviewer calibration output for partial-signup-review.
- sources/evaluator-calibration/ruhroh-evaluator-calibration-report.json: Reviewer calibration report hashed by this claim.
- sources/results/run-1/ruhroh-loop-result.json: Result artifact 1 hashed by this claim.
- sources/results/run-1/ruhroh-loop-eval-input.json: Run artifact evalInput for result 1.
- sources/results/run-1/ruhroh-loop-eval.json: Run artifact evalResult for result 1.
- sources/results/run-1/events.jsonl: Run artifact events for result 1.
- sources/results/run-1/ruhroh-loop-events.tar.gz: Run artifact eventsTarball for result 1.
- sources/results/run-1/ruhroh-loop-iterations.jsonl: Run artifact implementationRuns for result 1.
- sources/results/run-1/ruhroh-loop-journey.json: Run artifact journey for result 1.
- sources/results/run-1/ruhroh-run-manifest.json: Run artifact runManifest for result 1.
- sources/results/run-1/transcript.log: Run artifact transcript for result 1.
- sources/results/run-1/ruhroh-loop-transcripts.tar.gz: Run artifact transcriptsTarball for result 1.
- sources/results/run-1/ruhroh-workspace-summary.json: Run artifact workspaceSummary for result 1.
- sources/results/run-1/ruhroh-workspace.tar.gz: Run artifact workspaceTarball for result 1.
- sources/results/run-2/ruhroh-loop-result.json: Result artifact 2 hashed by this claim.
- sources/results/run-2/ruhroh-loop-eval-input.json: Run artifact evalInput for result 2.
- sources/results/run-2/ruhroh-loop-eval.json: Run artifact evalResult for result 2.
- sources/results/run-2/events.jsonl: Run artifact events for result 2.
- sources/results/run-2/ruhroh-loop-events.tar.gz: Run artifact eventsTarball for result 2.
- sources/results/run-2/ruhroh-loop-iterations.jsonl: Run artifact implementationRuns for result 2.
- sources/results/run-2/ruhroh-loop-journey.json: Run artifact journey for result 2.
- sources/results/run-2/ruhroh-run-manifest.json: Run artifact runManifest for result 2.
- sources/results/run-2/transcript.log: Run artifact transcript for result 2.
- sources/results/run-2/ruhroh-loop-transcripts.tar.gz: Run artifact transcriptsTarball for result 2.
- sources/results/run-2/ruhroh-workspace-summary.json: Run artifact workspaceSummary for result 2.
- sources/results/run-2/ruhroh-workspace.tar.gz: Run artifact workspaceTarball for result 2.

## Blockers

- agent-a: suite minimum runs or scenario coverage not satisfied
- simple-newsletter/agent-a: fewer than 5 runs; treat pass rate and pass@k as directional
- simple-newsletter/agent-a: eval-quality warnings present
- claim is not marked publishable
- suite minimum runs or scenario coverage not satisfied
- agent-a: simple-newsletter has 2/5 required runs
- agent-a: scenario-level warnings present

## Next Actions

- minimum_runs_not_met: Collect enough repeated samples for each scenario/adapter group to satisfy the suite methodology.
- minimum_runs_not_met: Collect enough repeated samples for each scenario/adapter group to satisfy the suite methodology.
- claim_readiness_blocker: Inspect the blocker, fix the underlying evidence or methodology gap, and re-run publish-check.
- claim_not_publishable: Resolve all readiness blockers, then regenerate the claim with compare or publish-check.
- minimum_runs_not_met: Collect enough repeated samples for each scenario/adapter group to satisfy the suite methodology.
- claim_readiness_blocker: Inspect the blocker, fix the underlying evidence or methodology gap, and re-run publish-check.
- claim_readiness_blocker: Inspect the blocker, fix the underlying evidence or methodology gap, and re-run publish-check.

## Advisories

- agent-a: simple-newsletter has 2/5 required runs
- agent-a: scenario-level warnings present
- simple-newsletter/agent-a: eval command evidence includes non-zero exit codes (1)
- simple-newsletter/agent-a/sample-newsletter-agent-a-2: review recommended
