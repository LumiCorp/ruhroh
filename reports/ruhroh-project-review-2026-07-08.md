# Ruhroh Documentation and Product Review

Date: 2026-07-08

Scope: complete local Ruhroh repository and documentation in `/Users/gregasher/Projects/ruhroh`, plus current public documentation for adjacent benchmark and evaluation frameworks.

Verification snapshot:

- `CI=true pnpm test` passed with 59 tests.
- `CI=true pnpm build` passed.
- `CI=true pnpm docs:build` passed after rerunning serially. A parallel first attempt failed during dependency recreation because concurrent pnpm installs fought over `node_modules`; the clean serial docs build succeeded.

## Executive Assessment

Ruhroh is a focused, credible beta-stage framework for evaluating coding agents on delivered software outcomes rather than static source-text or filename proxies. The product thesis is strong: turn realistic user requests into repeatable coding-agent benchmarks, preserve the full implementation journey, and judge the final workspace through a terminal evaluator while keeping Harbor compatibility as an execution substrate rather than the product boundary. This is documented directly in `README.md` lines 10-34 and `docs/architecture.md` lines 14-18.

The project is technically more mature than a typical early beta. It has schemas, scenario and suite validation, a CLI, fixture smoke paths, package smoke tests, result normalization, run manifests, run plans, artifact validation, HTML reports, repeated-run aggregation, statistical intervals, claim-readiness gates, benchmark claim exports, and package-owned Python runtime support. The main gap is product and documentation shape: many strong mechanisms are present, but they are exposed too early and too flatly, so first-time users meet an entire benchmark-publication system before they have completed one understandable loop.

The best long-term positioning is not "another eval harness" and not "a Terminal-Bench clone." Ruhroh should present itself as the audit-first benchmark framework for real coding-agent delivery: realistic user tasks, adapter-neutral execution, preserved implementation journeys, evaluator-governed outcome judgment, and publishable claims that can be traced back to artifacts.

## What Ruhroh Is

Documented facts:

- Ruhroh turns realistic user requests into repeatable coding-agent benchmarks and judges final delivered workspaces through a terminal evaluator (`README.md` lines 10-14).
- Ruhroh is not a native agent runner or giant general-purpose eval platform; users bring the run-agent adapter while Ruhroh owns the scenario format, benchmark suites, generator, CLI, result contracts, artifact preservation, and package-owned Python Harbor runtime (`README.md` lines 31-34).
- Harbor is the execution substrate, not the benchmark boundary (`docs/architecture.md` lines 14-18).
- Kestrel is one consumer/reference adapter, not the benchmark itself (`docs/architecture.md` line 37).

Informed inference:

- Ruhroh's primary audience is benchmark authors, coding-agent developers, and engineering teams comparing agents, prompts, wrappers, or model configurations on realistic implementation tasks.
- A secondary audience is open source benchmark contributors who want to publish governed scenario packs with auditable methodology.
- Casual model users are not the current primary audience; the docs assume comfort with pnpm, shell wrappers, environment variables, Harbor, JSON artifacts, and CI.

## Design Philosophy

Ruhroh's design philosophy is coherent:

- Outcome over implementation proxy. Scenario-specific success belongs in the evaluator rubric, not generated verifier logic (`README.md` lines 240-256).
- Adapter neutrality. New v2 scenarios keep adapter selection out of the scenario and defer it to runtime (`docs/scenario-format.md` lines 167-169).
- Artifact-first auditability. Core artifacts include result JSON, run manifest, iterations, journey, eval input/output, workspace summary/archive, transcripts, and events (`docs/artifacts.md` lines 27-50).
- Publishable evidence, not just scores. Compare output includes readiness blockers, run-plan warnings, artifact validation, review queues, claim exports, and summary rows (`docs/benchmark-methodology.md` lines 146-206).
- Security and containment. Prompts/assets are untrusted; command-backed adapters/evaluators run without a shell by default; dry-runs redact secrets (`docs/security.md` lines 12-28).

This philosophy is a real differentiator. The risk is that the user-facing docs sometimes communicate the mechanism before the principle.

## Core Abstractions

Scenario:

- A realistic user task under `ruhroh/scenarios/<id>/` with `scenario.json`, `instruction.md`, optional assets, runtime requirements, loop settings, evaluator context, rubric, evidence guidance, calibration cases, and optional private evaluator assets (`docs/scenario-format.md` lines 12-46).
- Scenario metadata carries versioning, provenance, visibility, difficulty, lifecycle, maintainers, contamination notes, and related governance fields (`docs/scenario-format.md` lines 167-204).

Suite:

- A frozen benchmark-pack manifest with ordered scenario membership, scenario version locks, methodology, and governance (`docs/benchmark-suites.md` lines 98-131).
- Suite comparison applies coverage, minimum run count, scenario version locks, and claim readiness (`docs/benchmark-suites.md` lines 131-165).

Adapter:

- The bridge between Ruhroh's loop and a coding agent.
- Public shell-based path: `custom-shell` with `RUHROH_RUN_AGENT_COMMAND`, environment variables, final JSON line, and optional `RUHROH_RESULT_PATH` result file (`docs/custom-shell.md` lines 14-67).
- Advanced TypeScript contract: `prepare`, `startSession`, `runTurn`, `detectCompletion`, `collectArtifacts`, `cleanup` (`docs/adapter-protocol.md` lines 17-25).

Eval-agent:

- Terminal-only in V1 and runs after the implementation loop, not every turn (`docs/eval-agent.md` lines 11-14).
- It inspects a copied final workspace plus scenario context, rubric, transcripts/events, journey, and stop reason (`docs/eval-agent.md` lines 16-37).
- It emits `ruhroh_eval_result_v1`; only `passed` maps to score 1 (`docs/eval-agent.md` lines 58-60, 181-184).

Artifact and claim model:

- Run artifacts preserve execution, evaluation, workspace, and reproducibility metadata (`docs/artifacts.md` lines 27-50).
- Compare groups by scenario and adapter and adds statistical, cohort, review, artifact, and claim-readiness fields (`docs/artifacts.md` lines 121-155).
- `benchmarkClaim` and `benchmarkSummary` provide downstream publication and leaderboard ingestion contracts (`docs/result-json-reference.md` lines 261-379).

## Documentation Review

Strengths:

- The README product thesis is clear and concise (`README.md` lines 10-34).
- The docs cover real user flows: getting started, fixture run, add-to-existing-project, scenario authoring, adapter authoring, suites, methodology, CLI, artifacts, CI, security, limitations, and repo layout.
- The methodology document is unusually rigorous for an early open source project. It covers sample size, retry policy, scenario governance, evaluator governance, claim readiness, run plans, source re-hashing, and usage/cost reporting (`docs/benchmark-methodology.md` lines 36-222).
- The docs are mechanically valid: VitePress build passed.

Weaknesses:

- Onboarding is overloaded. The README quickstart moves from listing and validation into authoring, suite creation, adapter scaffolding, reporting, artifact validation, compare, run-plan checks, claim exports, summary exports, and source verification before the user sees one simple completed loop (`README.md` lines 43-167).
- Getting Started is better but still introduces fixture setup, authoring, suite governance, adapter scaffolding, generation, dry-run, repeated runs, multi-adapter runs, live agent runs, report, compare, and workflow summary on one page (`docs/getting-started.md` lines 54-198).
- The docs site navigation has overlap: Result JSON appears under both Runtime and Reference, while troubleshooting and FAQ are not represented in the VitePress sidebar (`docs/.vitepress/config.ts`).
- The project name expansion in VitePress config, "Real-User Harness for Repair-Oriented Harbor," is less clear than the README's actual product promise. It may over-anchor the brand to Harbor and repair rather than broader real-user outcome benchmarking (`docs/.vitepress/config.ts` description).
- Troubleshooting is scattered across `doctor`, `security`, `limitations`, and examples. There is no dedicated troubleshooting page for Harbor missing, adapter completion not detected, evaluator JSON malformed, claim not publishable, artifacts missing, or shell command quoting.
- FAQ is absent. Common questions are predictable: "Do I need Harbor?", "Is Ruhroh an agent?", "How is this different from Terminal-Bench?", "Can I use model judges?", "How many runs are enough?", "Where do artifacts go?", "What can I publish?"

Recommended documentation structure:

1. Start
   - What Ruhroh is
   - 5-minute fixture run
   - Core concepts
   - Troubleshooting first run
2. Use
   - Run a bundled scenario
   - Run a suite
   - Compare agents
   - Read reports
   - Publish a claim
3. Author
   - Write a scenario
   - Write an evaluator
   - Write an adapter
   - Build a suite
   - Governance checklist
4. Reference
   - CLI reference
   - Scenario schema
   - Suite schema
   - Adapter protocol
   - Eval result contract
   - Result and claim JSON
5. Operations
   - CI
   - Security
   - Artifact storage
   - Limitations
   - FAQ

## API and UX Review

CLI strengths:

- The command surface is comprehensive: `run`, `generate`, `validate`, `validate-artifacts`, `validate-claim`, `validate-summary`, `report`, `compare`, `doctor`, `init`, `new-scenario`, `new-suite`, and `new-adapter` (`node dist/cli.js --help`).
- `doctor` is a strong DX primitive. It checks package layout, Python runtime importability, scenario/suite validation, Harbor availability, adapter wiring, evaluator configuration, and command safety (`docs/cli-reference.md` lines 114-132).
- `init`, `new-scenario`, `new-suite`, and `new-adapter` are good scaffolding affordances (`docs/cli-reference.md` lines 17-86).

CLI weaknesses:

- There are too many adjacent publication commands. `compare --benchmark-claim`, `validate-claim`, `validate-summary`, `validate-artifacts`, `--run-plan`, `--require-publishable`, and `--verify-sources` are powerful but not discoverable as one workflow.
- `--dry-run` currently says it prints Harbor commands "without writing tasks or running Harbor" in CLI help, while docs elsewhere present generate-only and dry-run as adjacent. New users may not understand whether dry-run depends on generated tasks or writes none.
- The default command mode (`ruhroh --scenario ...`) is convenient but may obscure `run` vs `generate`. The help lists `run|generate|...`, but docs often use flag-only invocations.
- `--adapter <id-or-command>` is pragmatic but semantically overloaded. It can be a named adapter, a path, or command-like value that gets wired through `RUHROH_RUN_AGENT_COMMAND`.

Public TypeScript API strengths:

- The package exports scenario discovery/loading/validation, suite discovery/loading/validation, built-in suite helpers, eval normalization, run summaries, review queues, aggregation, benchmark claim summarization, and Harbor generation (`README.md` lines 288-312).
- The API lines up with the documented architecture rather than only exposing CLI internals.

API risks:

- The exported TypeScript adapter lifecycle looks first-class, but public docs steer users to `custom-shell`. This creates uncertainty about which contract is stable for external authors.
- Function names are explicit but verbose: `validateRuhrohScenarioSource`, `lintRuhrohScenarioEvaluationDetailed`, `summarizeRuhrohBenchmarkClaimReadiness`. That is acceptable for internal clarity, but a higher-level `createScenarioPack`, `loadResults`, or `publishCheck` API would improve ergonomics.

Backward-compatible improvements:

- Add `ruhroh publish-check <results-dir>` as a wrapper for artifact validation, suite compare, run-plan coverage, claim readiness, and optional source verification.
- Add `ruhroh explain <blocker-code>` or structured remediation hints in JSON output.
- Add `ruhroh examples` or `ruhroh init --adapter codex-cli|claude-code|gemini-cli|aider|fixture`.
- Add aliases while keeping old commands: `ruhroh list`, `ruhroh list-suites`, `ruhroh run`, and `ruhroh generate`.
- Add a stable `@kestrel-agents/ruhroh/high-level` API or documented recipes for common programmatic tasks.

## Architecture Review

Documented architecture:

1. Discover and validate scenarios.
2. Generate Harbor task directories.
3. Run Harbor.
4. Package controller asks selected adapter to work.
5. Adapter iterates until completion or iteration cap.
6. Ruhroh writes eval input and eval-agent reviews once.
7. Ruhroh normalizes eval result and derives binary verdict.
8. Generic Harbor verifier maps result to reward.
9. Users inspect with `report` or aggregate with `compare` (`docs/architecture.md` lines 39-56).

Architecture strengths:

- Strong separation between scenario authoring, agent execution, evaluation, verifier reward mapping, and reporting.
- The app-agnostic verifier is a principled choice that prevents benchmark logic from devolving into hard-coded route/file/source checks.
- The run manifest and run plan provide a serious reproducibility backbone.
- The package-owned Python Harbor runtime lowers integration friction for command-backed adapters.
- The security model explicitly handles untrusted prompts/assets and shell execution risk.

Architecture risks:

- Evaluator quality is the central trust boundary. If evaluators are weak, the whole product can produce auditable but misleading scores.
- The architecture relies on Harbor for execution, but the docs also need Ruhroh to feel useful as its own product. Harbor terms appear before new users understand Ruhroh's own loop.
- Shell adapters are highly flexible but easy to misuse. The system needs more structured adapter templates, checks, and metadata validation.
- Result contracts are rich and likely to grow. Without a migration/versioning guide, downstream consumers may struggle as fields evolve.
- The V1 eval-agent runs once after implementation. That keeps the loop simple, but it limits process-level feedback, incremental evaluator checks, and agent repair workflows.

## Benchmark Design Review

Ruhroh already supports many benchmark rigor requirements:

- Reproducibility: run manifests, sample ids/seeds, environment fingerprints, command hashes, scenario/suite versions, source hashes.
- Repeatability: `--runs`, repeated adapters, suite manifests, run plans.
- Statistical context: Wilson intervals, pass@k, bootstrap mean-score intervals, Fisher exact checks for pairwise comparisons.
- Fair comparisons: comparability warnings for mixed scenario versions, adapter versions, models, prompts, evaluator identities, judge identities, and environment fingerprints.
- Versioning: scenario version, suite version, schema versions, claim versions.
- Artifact collection: full run artifacts and workspace archive.
- Evaluator independence: eval-agent runs over copied workspace and generic verifier only maps structured score.
- Publication readiness: claim blockers/advisories, artifact validation, run-plan coverage, source re-hashing.

Missing or underdeveloped benchmark capabilities:

- No documented benchmark registry or pack distribution model beyond bundled suites and local directories.
- No public leaderboard or claim ingestion policy.
- No contamination tooling beyond metadata fields and governance text.
- No task difficulty calibration workflow beyond metadata difficulty and expected runtime.
- No evaluator calibration report that measures evaluator consistency on calibration cases.
- No documented adjudication workflow for model-judge disagreement or human review.
- No built-in rerun/exclusion ledger for allowed infrastructure retries.
- No documented support for parallel execution, distributed execution, or cloud runners.
- No visual analytics beyond static HTML report/compare output.
- No benchmark evolution guide showing when to bump scenario vs suite versions with examples.

## Developer Experience Review

Good DX:

- `init` creates a complete local starter with scenario, suite, fixture adapter, evaluator, schemas, and README (`docs/getting-started.md` lines 22-25).
- The fixture adapter/evaluator path allows credential-free full-loop testing (`docs/local-fixture-run.md`).
- `doctor` catches many environment and wiring issues before expensive live runs.
- Examples exist for Codex CLI, Claude Code, Gemini CLI, and a fixture adapter (`examples/adapters`).
- JSON schemas are shipped and exported for editor/CI checks.
- Tests cover core public behavior and passed locally.

DX gaps:

- First successful run path still assumes Harbor availability for full execution; the docs need a clearer "without Harbor", "with Harbor dry-run", and "full Harbor run" distinction.
- There is no single command that says "your benchmark claim is publishable" and explains everything blocking it.
- Evaluator authoring is harder than scenario authoring. There is no `new-evaluator` command, despite evaluators being as important as adapters.
- The docs include an Aider walkthrough that uses heredoc file creation, but the project has `new-adapter`; the example could be converted to scaffold-first editing to reinforce product primitives.
- No troubleshooting matrix maps symptoms to commands and fixes.
- No generated sample HTML report is included in docs for visual inspection.

## Feature Inventory

| Category | Feature | Status | Evidence | Notes |
| --- | --- | --- | --- | --- |
| Project identity | Outcome-based coding-agent benchmark thesis | Mature | `README.md` lines 10-34 | Strong, clear differentiator |
| Scenario model | v2 scenario JSON, prompt path, assets, requirements, loop, evaluation | Mature | `docs/scenario-format.md` | Strong schema and docs |
| Scenario governance | provenance, visibility, contamination notes, lifecycle | Mature | `docs/scenario-format.md` lines 167-204 | Good for published packs |
| Calibration cases | evaluator-only pass/fail/review anchors | Incomplete | `docs/eval-agent.md` lines 42-46 | Present, but no calibration reporting |
| Private evaluator assets | held-out evaluator material | Mature but under-explained | `docs/benchmark-methodology.md` lines 120-126 | Needs examples |
| Suite model | version-locked suite manifests | Mature | `docs/benchmark-suites.md` | Strong benchmark-pack contract |
| Suite governance | contamination/reward-hacking/review/deprecation fields | Mature | `docs/benchmark-suites.md` lines 98-131 | Good open source posture |
| CLI scaffolding | `init`, `new-scenario`, `new-suite`, `new-adapter` | Mature | CLI help, `docs/cli-reference.md` | Missing `new-evaluator` |
| CLI validation | scenario/suite/evaluator lint warnings | Mature | `docs/cli-reference.md` lines 99-112 | Good structured warnings |
| CLI doctor | readiness and command safety checks | Mature | `docs/cli-reference.md` lines 114-132 | High-value DX feature |
| Harbor generation | generated Harbor task dirs and generic verifier | Mature | `docs/harbor.md` | Clear boundary |
| Shell adapter | `custom-shell` command adapter | Mature but confusing | `docs/custom-shell.md` | Recommended path should be clearer |
| TypeScript adapter | lifecycle interface | Future extension point | `docs/adapter-protocol.md` lines 17-25 | Needs stability label |
| Eval-agent | terminal evaluator after loop | Mature V1 | `docs/eval-agent.md` | Powerful but cookbook needed |
| Eval quality checks | warnings for weak evidence/judge metadata | Mature | `docs/eval-agent.md` lines 146-179 | Good publication guard |
| Multi-judge support | `judgeVotes` and `judgeAgreement` | Incomplete | `docs/eval-agent.md` lines 140-144 | Needs adjudication workflow |
| Artifacts | result, manifest, journey, eval, workspace archive | Mature | `docs/artifacts.md` lines 27-50 | Strong differentiator |
| Artifact validation | `validate-artifacts` | Mature | `docs/artifacts.md` lines 61-65 | Good CI gate |
| Single-run report | text/json/html report | Mature | `docs/artifacts.md` lines 52-79 | Needs screenshots/gallery |
| Aggregate compare | pass rate, CI, pass@k, cost/tokens | Mature | `docs/artifacts.md` lines 121-161 | Strong for beta |
| Claim readiness | publishability blockers/advisories | Mature | `docs/benchmark-methodology.md` lines 146-158 | Needs workflow wrapper |
| Claim export | `benchmarkClaim` | Mature | `docs/result-json-reference.md` lines 261-326 | Good downstream contract |
| Summary export | row-oriented benchmark summary | Mature | `docs/result-json-reference.md` lines 327-343 | Leaderboard-ready shape |
| Security | untrusted prompt/asset and no-shell model | Mature | `docs/security.md` | Concise and useful |
| CI | deterministic package smoke posture | Mature | `docs/ci.md` | Clear credential-free policy |
| Troubleshooting | symptom-to-fix docs | Missing | VitePress nav and docs tree | High-priority docs gap |
| FAQ | product/usage questions | Missing | docs tree | Needed for OSS adoption |
| Visualization | static HTML only | Incomplete | `docs/artifacts.md` | Needs richer examples/analytics |
| Registry/leaderboard | benchmark pack discovery and publication | Future extension point | `benchmarkClaim` docs | Natural next step |
| Distributed/cloud runs | parallel/cloud execution | Missing | docs tree | Strategic, not immediate |

## Competitive Analysis

SWE-bench:

- SWE-bench has a mature public leaderboard with filters, model/agent comparisons, resolved-by-repository/language matrices, cost scatter plots, cost/step distributions, and JSON/PNG/copy-link export affordances. Its official site states that entries report percent resolved across Full, Verified, Lite, Multilingual, and Multimodal subsets.
- Ruhroh is weaker as a canonical public corpus and leaderboard today.
- Ruhroh is stronger for user-outcome app delivery tasks where fixed patch tests are insufficient or too brittle.
- Opportunity: use `benchmarkClaim` and `benchmarkSummary` as the basis for a lightweight public claim explorer.

Terminal-Bench:

- Terminal-Bench is Harbor-native and focuses on terminal mastery with task galleries, benchmark versions, and a leaderboard. Its site frames Terminal-Bench as benchmarks for AI agents in terminal environments.
- Ruhroh should not compete on terminal task breadth. It should compete on realistic coding-agent delivery, evaluator evidence, and implementation journey preservation.
- Opportunity: present Ruhroh as complementary: Harbor-compatible, but for product-like coding tasks and outcome review.

Inspect AI:

- Inspect has clearer conceptual primitives: Task, Dataset, Solver, Scorer, Tools, Agents, Analysis, Extensions. It also has Inspect View, VS Code support, model providers, tool support, sandboxing, and over 200 pre-built evaluations.
- Ruhroh is much narrower, which is good if marketed correctly.
- Opportunity: borrow documentation structure and visual tooling posture; do not copy Inspect's generality.

OpenAI Evals:

- OpenAI Evals positions itself as a framework and registry, with custom/private evals and templates.
- Ruhroh has stronger coding-agent artifact and workspace focus, but lacks a registry/community contribution pipeline at similar clarity.
- Opportunity: add a "benchmark pack registry" path and contribution checklist.

Promptfoo:

- Promptfoo's docs emphasize developer-friendly evaluation, declarative test cases, matrix views, caching, concurrency, live reloading, provider breadth, CLI/library/CI use, and sharing.
- Ruhroh is less turnkey and less visual.
- Opportunity: add matrix-oriented comparison views and a simpler local iteration loop.

DeepEval:

- DeepEval emphasizes pytest-native evals, 50+ metrics, traces, CI, transparent judge reasoning, multi-modal and conversational evals, and integration with observability/dataset/prompt tooling.
- Ruhroh lacks metric breadth and test-runner familiarity.
- Ruhroh's advantage is full coding-agent workspace delivery and preserved implementation journey.
- Opportunity: expose `ruhroh compare` and `ruhroh report` in a test-native workflow for engineering teams.

LiveCodeBench and HumanEval:

- LiveCodeBench emphasizes contamination-resistant continuous collection and broader code capabilities such as self-repair, code execution, and test output prediction.
- HumanEval-style tasks are narrower function-generation checks.
- Ruhroh should not compete on algorithmic code tasks. It can lead on local app/workflow delivery, but needs stronger contamination and rotating-suite tooling.

GAIA:

- GAIA is useful as a philosophical comparison: real-world questions requiring reasoning, tool use, web browsing, and multi-modality, with a gap between human ease and model difficulty.
- Ruhroh's analogous opportunity is "simple to understand as a user request, hard for agents to deliver robustly."

## Product Vision

Current inferred vision:

Ruhroh wants to make realistic coding-agent evaluation repeatable, inspectable, and publishable. It is a framework for turning user-like implementation requests into benchmark packs where agents can be compared on delivered workspaces and reviewers can audit the entire journey.

Recommended narrative:

"Ruhroh is an audit-first benchmark framework for real coding agents. Write realistic user tasks, run any agent through a clean adapter, preserve the full implementation journey, evaluate the final workspace with structured evidence, and publish claims that can be traced back to versioned scenarios, run plans, manifests, transcripts, and workspace artifacts."

Missing product pillars:

- Guided first success: fixture to report in under five minutes.
- Guided publication: one command and one checklist to decide if a result is publishable.
- Evaluator quality: recipes, calibration reports, multi-judge adjudication, and human review.
- Ecosystem: adapter templates, scenario packs, benchmark registry, leaderboard ingestion.
- Visual analysis: timeline, artifact browser, failure triage, compare matrix, cost/performance views.

Scope to avoid:

- Do not become a general LLM eval platform.
- Do not compete with Inspect on arbitrary tasks/tools/scorers.
- Do not compete with Promptfoo on prompt-matrix testing.
- Do not compete with Terminal-Bench on terminal benchmark breadth.
- Do not bury the unique implementation-journey/evidence model under Harbor terminology.

## Improvement Backlog

### Quick Wins

| Priority | Recommendation | Rationale | Expected impact | Difficulty | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P0 | Split README quickstart into "try fixture", "run adapter", and "publish results" | Current quickstart introduces too many surfaces at once | Higher activation and lower confusion | Low | Docs only |
| P0 | Add a one-page concept glossary and lifecycle diagram | Terms like scenario, suite, adapter, eval-agent, run plan, claim appear quickly | Better mental model | Low | Docs only |
| P0 | Add Troubleshooting page | Missing despite many predictable setup failures | Better OSS support and fewer issues | Low | `doctor` output examples |
| P0 | Add FAQ | Explains Harbor, adapters, model judges, run counts, artifacts, publication | Better adoption | Low | Docs only |
| P1 | Label TypeScript adapter contract as advanced | Public path is command-backed `custom-shell`; TS lifecycle may confuse users | Clearer extension model | Low | Docs only |
| P1 | Add example report screenshots or checked-in sample HTML artifacts | Reporting is a major differentiator but invisible in docs | Better product comprehension | Low/Medium | Generate fixture reports |
| P1 | Add "claim readiness checklist" doc | Methodology is strong but spread across pages | Clear publication workflow | Low | Existing compare/claim docs |
| P1 | Align VitePress description with README thesis | Current acronym expansion is less clear | Stronger brand/product signal | Low | Docs config |

### Medium Improvements

| Priority | Recommendation | Rationale | Expected impact | Difficulty | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P0 | Add `ruhroh publish-check` | Wrap artifact validation, suite compare, run-plan checks, claim readiness, source verification | Major DX simplification | Medium | Existing CLI functions |
| P0 | Add `ruhroh new-evaluator` | Evaluator quality is central but not scaffolded | Better benchmark quality | Medium | Eval result templates |
| P0 | Build evaluator cookbook | Need deterministic, browser, model, hybrid, and human-review examples | Better trust and fewer weak evals | Medium | Example scenarios |
| P1 | Add adapter template variants | Codex, Claude Code, Gemini, Aider, generic command | Faster integration | Medium | Existing examples |
| P1 | Add remediation codes for claim blockers | Users need next actions, not only blocker strings | Better CI/product UX | Medium | Structured readiness model |
| P1 | Add sample benchmark pack tutorial | Show author scenario -> evaluator -> suite -> 5 runs -> claim | Demonstrates full product | Medium | Fixture/evaluator examples |
| P1 | Add scenario evolution guide | Versioning rules need examples | Better long-term comparability | Medium | Existing schema/governance |
| P2 | Add package smoke docs for contributors | `smoke:package` is mentioned but not fully operationalized | Maintainer quality | Medium | Existing script |

### Strategic Investments

| Priority | Recommendation | Rationale | Expected impact | Difficulty | Dependencies |
| --- | --- | --- | --- | --- | --- |
| P0 | Build benchmark pack registry and claim ingestion | Ruhroh needs ecosystem/discovery beyond local packs | High product leverage | High | Claim/summary contracts |
| P0 | Build richer compare viewer | Static HTML should show timeline, matrix, failure buckets, cost/per-pass, artifacts | Makes evidence model tangible | High | Existing HTML report |
| P1 | Add evaluator calibration harness | Calibration cases should be actively tested against evaluators | Improves benchmark validity | High | Eval-agent contracts |
| P1 | Add contamination and leakage tooling | Metadata is not enough for public benchmark credibility | Stronger leadership vs modern coding benchmarks | High | Scenario registry/history |
| P1 | Add distributed/parallel execution plan | Repeated multi-agent suites will become expensive | Better scale | High | Harbor/runtime constraints |
| P1 | Add GitHub Actions templates and PR comment reports | Natural adoption path for engineering teams | Better DX and visibility | Medium/High | Publish-check/report JSON |
| P2 | Add IDE/schema authoring extension or docs bundle | Scenario/evaluator authoring is structured and LLM-assistable | Better author productivity | High | Schemas and examples |

## Top 10 Improvements

1. Add `ruhroh publish-check`.
2. Rewrite onboarding around one successful fixture loop before publication details.
3. Add Troubleshooting and FAQ pages.
4. Add `new-evaluator` and evaluator cookbook.
5. Add lifecycle diagram and glossary.
6. Add report/compare visual gallery with sample artifacts.
7. Clarify recommended adapter path vs advanced TypeScript adapter contract.
8. Add claim-readiness remediation codes and next-action hints.
9. Build a benchmark pack registry and claim ingestion model.
10. Add evaluator calibration and contamination tooling.

## Top 5 Architectural Risks

1. Evaluator trust risk: weak evaluator scripts can make rigorous-looking claims unreliable.
2. Adapter sprawl risk: `custom-shell` can integrate anything, but without templates and validation it can produce inconsistent metadata and artifacts.
3. Contract complexity risk: result, claim, manifest, summary, and run-plan schemas may become hard to evolve without migration guidance.
4. Product boundary risk: Harbor compatibility is valuable, but over-emphasis can obscure Ruhroh's unique outcome/journey/evidence model.
5. Corpus credibility risk: bundled scenarios are useful, but public leadership requires registry, contamination controls, held-out strategy, and task evolution process.

## Maturity Scores

| Dimension | Score | Rationale |
| --- | ---: | --- |
| Documentation quality | 7/10 | Deep and mostly coherent, but onboarding is overloaded and troubleshooting/FAQ are missing |
| Architecture | 7/10 | Strong separation of concerns; evaluator and adapter trust boundaries need hardening |
| Extensibility | 7/10 | Good command adapter path and exported TS contracts; ecosystem packaging is early |
| Benchmarking rigor | 8/10 | Strong statistics, manifests, run plans, governance, artifact validation, readiness gates |
| Developer experience | 6/10 | Powerful CLI and scaffolds; too many concepts/commands before first success |
| Product vision | 8/10 | Clear, valuable niche; needs sharper packaging and visual proof of value |
| Open source readiness | 6/10 | Good README/CONTRIBUTING/SECURITY; needs issue templates visibility, examples, troubleshooting, registry/community path |

Overall: 7/10. Ruhroh has a real product thesis and a surprisingly complete audit/reporting substrate. The highest leverage work is not adding more benchmark math; it is simplifying the user journey, making evaluator quality operational, and turning the claim/artifact machinery into an obvious workflow.

## Completion Checklist Against Requested Review

- Project goals, philosophy, abstractions, audience: covered above.
- Documentation review: covered with structure, strengths, gaps, and proposed IA.
- API and UX review: covered for CLI and TypeScript API.
- Architecture review: covered with facts and inferred risks.
- Benchmark design: covered across reproducibility, repeatability, statistics, governance, artifacts, and missing capabilities.
- Developer experience: covered across authoring, running, debugging, reporting, evaluator writing, CI, and local development.
- Feature inventory: included.
- Competitive analysis: included across SWE-bench, Terminal-Bench, Inspect, OpenAI Evals, Promptfoo, DeepEval, LiveCodeBench/HumanEval, and GAIA.
- Product vision: included.
- Improvement backlog: included with priorities, rationale, impact, difficulty, and dependencies.
- Hidden opportunities: included through registry, visualization, calibration, contamination, cloud/distributed, GitHub, IDE, and AI-assisted authoring directions.
- Top 10 improvements, top 5 risks, maturity scores: included.

## Sources

Local evidence:

- `README.md`
- `docs/index.md`
- `docs/getting-started.md`
- `docs/local-fixture-run.md`
- `docs/add-to-existing-project.md`
- `docs/write-a-scenario.md`
- `docs/scenario-format.md`
- `docs/benchmark-suites.md`
- `docs/benchmark-methodology.md`
- `docs/write-an-adapter.md`
- `docs/adapter-protocol.md`
- `docs/custom-shell.md`
- `docs/eval-agent.md`
- `docs/artifacts.md`
- `docs/result-json-reference.md`
- `docs/cli-reference.md`
- `docs/architecture.md`
- `docs/ci.md`
- `docs/security.md`
- `docs/limitations.md`
- `docs/public-repo-layout.md`
- `docs/.vitepress/config.ts`
- `package.json`
- `src/index.ts`
- `src/cli.ts`
- `src/scenarios.ts`
- `src/adapters.ts`
- `src/results.ts`
- `suites/*/suite.json`
- `scenarios/*/scenario.json`
- `schemas/*.json`
- `examples/**`

External comparison sources:

- SWE-bench: https://www.swebench.com/
- Terminal-Bench: https://www.tbench.ai/
- Inspect AI: https://inspect.aisi.org.uk/
- OpenAI Evals: https://github.com/openai/evals
- Promptfoo: https://www.promptfoo.dev/docs/intro/
- DeepEval: https://deepeval.com/
- LiveCodeBench: https://livecodebench.github.io/
- GAIA paper: https://arxiv.org/abs/2311.12983
