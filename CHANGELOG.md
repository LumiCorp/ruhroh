# Changelog

## 0.6.0-beta.0

- Added `ruhroh validate`, `ruhroh report`, and `ruhroh compare`.
- Added scenario-source validation for prompts, declared assets, rubric shape, and network policy.
- Made generated Harbor tasks respect `requires.network`.
- Added enriched eval-result fields for per-criterion evidence, subscores, and judge metadata while preserving binary Harbor reward compatibility.
- Added run summary and repeated-run aggregation helpers.
- Wrote and preserved `ruhroh-loop-eval-input.json` for stable evaluator inputs.
- Added a maintained native-session `kestrel-cli` adapter with Kestrel job
  contract, replay-evidence, waiting, cancellation, and failure mapping.
- Updated docs for the author-run-evaluate-review workflow.

## 0.5.0-beta.2

- Fixed hosted logo and badge image URLs for the npm README.
- Fixed VitePress logo paths so GitHub Pages does not apply the project base twice.
- Kept package APIs and runtime behavior unchanged from `0.5.0-beta.1`.

## 0.5.0-beta.1

- Reworked the README as a consumer-focused introduction.
- Added getting-started, scenario-authoring, and adapter-authoring guides.
- Added lightweight public contribution, security, and issue-routing docs.
- Added a VitePress documentation site for GitHub Pages.
- Kept package APIs and runtime behavior unchanged from `0.5.0-beta.0`.

## 0.5.0-beta.0

- First public beta of Ruhroh.
- Published JSON scenario discovery, validation, and Harbor task generation.
- Published package-owned Python Harbor runtime support for command adapters.
- Shipped bundled scenarios, public examples, logo assets, docs, and smoke CI.
- Kept generated verifiers app-agnostic and live agent runs optional/manual.
