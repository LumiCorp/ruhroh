---
artifact: research-and-idea-portfolio
id: tokeneconomics-foundation-ruhroh-opportunities
status: awaiting-selection
snapshot_date: 2026-08-12
retrieved_at: 2026-08-12T17:36:44.838Z
source_commit: 7b62a0a6364de5183a9dc814349d1d6a000ca381
selected: []
---

# Tokenomics Foundation → Ruhroh research scratchpad

This is the working, reviewable extraction of the Tokenomics Foundation surfaces named for this research at `tokeneconomics.com`: the complete Insights and Docs post types, the Projects index and every linked project record/paper, plus a supplemental review of substantive general pages discovered through the public Page API. It is a source snapshot, not an endorsement of every published claim and not an implementation plan.

## Executive answer

The Foundation's strongest idea is not “track more tokens.” It is that AI efficiency is **useful outcome produced inside an explicit quality, latency, and cost envelope**. The decisive unit is the workload or completed outcome; raw token counts are necessary telemetry, not proof of value.

Ruhroh already has unusually strong foundations for that model: goal-based scenarios, repeated samples, evaluator evidence, pass/fail and score distributions, model and environment cohort metadata, artifact validation, human review, and cost/token summaries. That puts it closer to an experimental system for AI unit economics than to a billing dashboard.

The current implementation is not yet trustworthy enough to make that claim. Two correctness issues should be treated as prerequisites:

1. Benchmark target identity survives in the manifest but is ignored as the aggregation key. Distinct model-controlled targets using the same underlying adapter can collapse into one aggregate group, defeating the comparison the target config promised.
2. Cost-per-pass and tokens-per-pass are calculated even when only some runs reported usage. Those derived figures are lower bounds, but the report does not label or suppress them and claim readiness does not block on partial usage coverage.

After those foundations are corrected, the most promising product directions are:

- a provenance-rich, cumulative economic trace for each run;
- quality-constrained cost/latency/token frontiers;
- controlled Big-T scale experiments and runaway-work containment;
- a FOCUS reconciliation bridge that joins normalized billing to Ruhroh's technical evidence;
- persona- and value-oriented decision views, introduced only as the Foundation's unfinished frameworks become concrete.

## Research question and decision boundary

**Question:** Which concepts, methods, metrics, specifications, and product capabilities expressed across the Tokenomics Foundation site could strengthen Ruhroh's evaluation and reporting implementation?

**Decision:** what Ruhroh should investigate, adopt, adapt, or explicitly leave out.

This pass includes:

- a coverage-checked inventory of the public Insights and Docs post types and the complete project surface linked from the Projects index;
- an inventory of all generic Page API records, with substantive supplemental pages selected and navigational/organizational pages explicitly excluded;
- a source-linked extraction of every record;
- a distinction between published specifications, draft proposals, anecdotes, and our inference;
- a comparison with the current Ruhroh checkout;
- an opportunity matrix and a portfolio of five candidate product directions.

This pass does not include:

- audio transcription of podcast episodes; the complete published show notes were reviewed;
- implementation changes, schemas, tickets, or a selected roadmap;
- treating roadmap announcements or “coming soon” cards as finished standards;
- adopting vendor-reported savings percentages as Ruhroh thresholds.
- treating every generic site page as part of the named Insights/Projects/Docs corpus; all such pages are nevertheless recorded in the discovery manifest.

## Evidence labels

- **Observed — Foundation:** stated or demonstrated by a first-party Tokenomics Foundation or linked FinOps Foundation source.
- **Observed — Ruhroh:** verified in this checkout's source, schemas, tests, examples, or documentation.
- **Inferred:** our proposed relationship or product application; not a Foundation claim.
- **Assumed:** plausible but not yet supported enough to become a requirement.
- **Claim:** a published percentage, outcome, or causal assertion whose underlying data was not available here.

## Coverage and method

Coverage was established from the live listing pages, WordPress APIs, and XML sitemaps rather than by following only visible navigation. Discovery records were retrieved at `2026-08-12T17:36:44.838Z`; destination responses were hashed at `2026-08-12T17:37:32.327Z`.

| Corpus | Public records | Reviewed | Coverage notes |
| --- | ---: | ---: | --- |
| Insights/assets | 17 | 17 | Eight prose articles or press releases, eight Tokenomics Brief show-note records, and one third-party podcast card. |
| Documentation | 7 | 7 | Six content pages plus one empty Big-T hierarchy node. |
| Projects | 5 cards | 5 | Three linked projects; Personas/Ops Model and AI Unit Economics are only “Coming soon.” |
| Linked project papers | 2 | 2 | Big-T Notation Paper and Five-Layer Tokenomics Stack Paper. |
| Generic WordPress pages | 21 | 21 inventoried | Seven supplemental candidates were inspected: five substantive pages were included, two empty/stale duplicate shells were excluded, ten navigation/membership/event/organization pages were excluded, and four are project/index records already counted above. |

The machine-readable [discovery manifest](./2026-08-12-tokeneconomics-foundation-discovery.json) records all 46 API records with post type, ID, slug, publication and modification timestamps, inclusion status/reason, source and live-destination URLs, HTTP status, final URL, byte count, and SHA-256 hashes of both WordPress content and retrieved destination bytes. External destinations are linked and hashed, not archived.

Completeness evidence:

- [Robots file](https://www.tokeneconomics.com/robots.txt)
- [Asset sitemap](https://www.tokeneconomics.com/sitemap-post-type-asset.xml)
- [Asset API](https://www.tokeneconomics.com/wp-json/wp/v2/asset?per_page=100)
- [Documentation sitemap](https://www.tokeneconomics.com/sitemap-post-type-te_doc.xml)
- [Documentation API](https://www.tokeneconomics.com/wp-json/wp/v2/te_doc?per_page=100)
- [Page sitemap](https://www.tokeneconomics.com/sitemap-post-type-page.xml)
- [Project page API](https://www.tokeneconomics.com/wp-json/wp/v2/pages?per_page=100)

Source trust order used in synthesis:

1. current repository code, schemas, tests, and a read-only reproduction for Ruhroh behavior;
2. substantive Foundation docs and project papers for expressed concepts;
3. Foundation or FinOps Foundation articles for operating guidance;
4. show notes, keynote summaries, enterprise anecdotes, and uncited percentages as claims to test;
5. third-party destinations only as corpus/access observations, never as Foundation requirements.

### Maturity key

| Maturity | Meaning in this review |
| --- | --- |
| Published model | A substantive explainer or paper is public, though it may still be informal. |
| Draft proposal | The source explicitly describes itself as draft, in progress, or subject to a near-term decision. |
| Conceptual guidance | A useful operating principle without a normative data or process contract. |
| Case or claim | Practitioner example, keynote report, or percentage without reproducible evidence here. |
| Announced only | A title and short intent exist, but no framework can yet be extracted. |

### Claim–evidence matrix

| Claim used in this review | Supporting evidence | Treatment |
| --- | --- | --- |
| Efficiency means useful outcomes under quality/cost constraints, not minimum tokens | Atomic Unit, Tokenomics and FinOps, MetLife, Big-T paper | Repeated conceptual guidance; suitable product principle, not a formula |
| Billing normalization and application trace are complementary | FOCUS 1.5 project page and Five-Layer paper | Draft architecture boundary; recheck final standard before implementation |
| Big-T requires multiple scales and separates class from coefficient | Big-T paper | Published informal method; candidate controlled experiment |
| Personas/Ops and AI Unit Economics are finished capabilities | Projects cards plus TSC synthesis | Rejected; both remain unpublished, although the TSC page reports internal drafts in flight |
| Ruhroh target identity collapses and partial usage yields unsafe ratios | Current source path plus tracked-dist reproduction | Confirmed implementation findings |

## What the corpus says consistently

Across the articles, show notes, docs, and project papers, the recurring model is:

1. **Instrument before optimizing.** Attribute consumption to a call, workload, application, team, and eventual outcome.
2. **Hold quality constant.** Lower token or dollar cost is not efficiency if outcomes deteriorate.
3. **Optimize at the workload seam.** Model selection, route, prompt, context, cache, tools, retries, and deterministic preprocessing dominate application economics.
4. **Separate the visible meter from full cost.** Tokens are only one part of inference, retrieval, storage, observability, evaluation, labor, governance, and product delivery.
5. **Measure agent amplification.** Retries, accumulated context, tool schemas/results, failed calls, model fan-out, and agent depth can multiply consumption.
6. **Use ranges and repeated evaluation.** Provider prices, capacity mix, aliases, quantization, and serving behavior change.
7. **Join normalized billing to technical traces.** FOCUS can normalize provider economics, but application traces must explain sessions, retries, tools, quality, and outcomes.
8. **Keep humans and deterministic systems in the control plane.** Accountability, judgment, stop decisions, and suitable non-AI alternatives remain part of the system.

## Project capability map

| Project | Public maturity on 2026-08-12 | What is actually available | What is not yet available |
| --- | --- | --- | --- |
| Big-T Notation | Published informal paper | Growth classes, variables, workflow, levers, reference pipeline, assessment areas, caveats | Formal complexity theory, an executable classifier, linked worksheet/calculator, normative thresholds |
| Five-Layer Tokenomics Stack | Published draft paper | Layer boundaries, responsibilities, metrics, cross-cutting telemetry/governance | A machine-readable schema, complete value/pricing layer, universal access to infrastructure metrics |
| FOCUS 1.5 for AI cost | Draft/in-flight snapshot | Completed, expected, considered, and deferred field areas; explicit billing/trace boundary | Final 1.5 standard, guaranteed field names or decisions, app-level session/harness telemetry |
| Personas and Operating Model | Unpublished/in flight | Coming-soon card, early roles page, and TSC synthesis reporting an internal draft at roughly 90% | Public framework, RACI, cadence, artifacts, decision rights, escalation model |
| AI Unit Economics Measurement Framework | Unpublished/in flight | Coming-soon card, conceptual ingredients, and TSC synthesis reporting Business Measurement/Unit Economics at roughly 75% | Public formula, formal unit, allocation rules, value schema, reference calculations |

### Big-T Notation

Sources: [project page](https://www.tokeneconomics.com/projects/big-t-notation/) and [paper](https://www.tokeneconomics.com/docs/projects/big-t/big-t-notation-paper/).

Big-T is an informal “Big-O for tokens.” It classifies how token consumption grows with workload shape; it does not predict an exact bill.

Variables:

- `n`: request count or input size;
- `k`: multiplicative work such as reasoning depth, model calls, turns, retries, tool-chain steps, or replayed context;
- `a`: agent-tree depth or other agentic multiplication.

| Class | Foundation interpretation | Ruhroh-relevant diagnostic |
| --- | --- | --- |
| `T(1)` | No per-request model invocation, usually cache or precomputation | Did deterministic or cached output eliminate inference for repeat work? |
| `T(log n)` | Deterministic filtering/retrieval keeps model context from scaling with the whole corpus | Does retrieved context grow sublinearly as the corpus grows? |
| `T(n)` | One bounded call scales linearly with request count or input size | Is the workload a stable one-call baseline? |
| `T(n·k)` | Repeated reasoning, calls, retries, or context multiply the baseline | What call/retry/context coefficient is doing the multiplying? |
| `T(n·k·a)` | Nested agents or sub-agents add another multiplicative dimension | Does delegation add bounded value or uncontrolled fan-out? |
| `T(∞)` | Work can continue without a circuit breaker | Which resource budget or stop condition is missing? |

Critical distinctions:

- Architecture determines the growth class; compression, routing, caching, and model choice often reduce coefficients inside a class.
- A comparison is honest only above a stated quality floor.
- One run cannot establish a growth class. Controlled observations at multiple `n` values are required.
- Constants can differ by orders of magnitude even when two workloads share a class.
- A higher class can be economically justified when incremental value supports it.
- Efficient agents can still overwhelm downstream APIs; system-of-record pressure sits outside the token boundary.

Foundation workflow:

1. Instrument consumption.
2. Classify the architecture behind the highest-spend workload.
3. Ask whether the class is justified by value.
4. Change the class with deterministic preprocessing, cache, tools, or code where possible.
5. Optimize coefficients through routing, serialization, context, and model selection.
6. Govern and reassess at scale.

The paper's reference flow is deterministic preprocessing → cache check → router → prompt architecture → minimal necessary inference → direct response or sandboxed code, with telemetry, attribution, budgets, and circuit breakers crossing the flow.

The paper cites dramatic reductions for composable tools, code execution, retrieval, compact formats, and a research synthesis. Those figures are motivating claims, not reproducible acceptance thresholds. Ruhroh should test the patterns locally under equal outcomes.

### Five-Layer Tokenomics Stack

Sources: [project page](https://www.tokeneconomics.com/projects/the-five-layer-tokenomics-stack/) and [paper](https://www.tokeneconomics.com/projects/the-five-layer-tokenomics-stack/the-five-layer-tokenomics-stack-paper/).

The Stack answers **where** cost and efficiency decisions occur; Big-T answers **how consumption scales**. The cross-cutting concerns are governance/security, identity/access, observability, and cost.

| Layer | Decision surface | Representative metrics from the paper | Relevance to Ruhroh |
| --- | --- | --- | --- |
| L1 Silicon | Accelerator choice and physical efficiency | dollars, watts, and tokens per accelerator; token throughput | Usually outside Ruhroh's direct view for hosted APIs. Preserve optional provenance, do not pretend to measure it. |
| L2 Infrastructure & Capacity | Fleet utilization, reservations, capacity mode | utilization, idle hours, reserved/on-demand mix | A billing import or FOCUS bridge can carry it; a run trace usually cannot. |
| L3 Inference Serving | Engine, batching, KV/prefix/semantic cache, prefill/decode, tool and agent iteration | GPU utilization, request/token throughput, TTFT, inter-token latency, cache reuse, batch size, p50/p95 | Direct opportunity: request traces, latency distributions, cache behavior, calls, retries, and steps. |
| L4 Model Management | Model identity, version, capability, price, latency, quality, precision/quantization/adapters | cost per task/outcome, quality per dollar, VRAM and throughput by precision, held-out regression | Direct opportunity: strengthen model fingerprinting and quality-cost comparison. |
| L5 Routing & Governance | Gateway policy, complexity routing, fallback/retry, budgets, quotas, caps, breakers | cost by route/feature/team/customer, model mix, cache share, cheaper-model share, budget burn, fan-out, retries, iterations | Direct opportunity: report decisions and enforce bounded-resource experiments. |

The Stack says telemetry should combine gateway/proxy data, traces, and billing/FinOps data while preserving usage type—input, output, cached, reasoning, audio, image—at comparable granularity.

Limits stated or implied by the paper:

- It begins at the model-serving boundary; product value and pricing remain separate.
- API consumers often cannot observe L1/L2 directly.
- Measurement shows where cost occurs; it does not decide whether the result was valuable.
- A local reduction may shift rather than remove cost.
- The draft will evolve.

### FOCUS 1.5 and AI cost

Source: [What 1.5 does for AI cost—and what it does not](https://www.tokeneconomics.com/projects/what-1-5-does-for-ai-cost-and-what-it-does-not/).

This page is a **July 28 status snapshot**, not a final specification. It says a key decision was due August 13, 2026 and development would close October 8; the Projects card labels the release “Dec 2026.” On this review date, all in-flight names must therefore be versioned and rechecked before implementation.

The page's capability boundary is valuable:

- FOCUS normalizes provider billing and economic facts.
- Application traces explain sessions, events, prompts, retries, tools, harness behavior, and outcomes.
- A robust system joins both instead of forcing one to replace the other.

Status extracted from the page:

| Status | Expressed capability |
| --- | --- |
| Complete in the cited work | `SkuPriceDetails`; `ModelDeveloper`, `ModelFamily`, `ModelId`, `ModelVersion`; direct and reseller examples; input/output as distinct SKUs through `SkuMeter`; removal of cloud-specific language from `ServiceCategory` |
| In flight / expected | AI examples including capacity drawdown; `PrincipalId` for user/service/agent attribution; SKU Price dataset; prepaid token/credit handling; explanatory narrative |
| Under consideration | Cache-freshness distinctions, reasoning, warm-cache standing charges, modality, context tiers, priority/batch tiers, regional/global service, capacity, AI service categories, privacy-aware identity detail |
| Out or deferred | Max-token configuration, tool/harness telemetry, session/event IDs, and a first-class token-type field |

Ruhroh implication: build a later versioned mapping from billing rows to `benchmarkTarget`, model, usage, and workload identifiers. Do not rename technical trace fields to speculative FOCUS concepts, and do not equate token charge with total AI cost.

### Personas and Operating Model

Sources: [Projects index](https://www.tokeneconomics.com/projects/), [Key Players and Roles](https://www.tokeneconomics.com/docs/overview/key-players/), and [TSC synthesis](https://www.tokeneconomics.com/top-challenges-and-opportunities-from-the-tsc/).

The formal project is not public. Its project card says “Coming soon,” while the later TSC synthesis reports an internal draft at roughly 90%. The roles page provides an early precursor:

- token sourcing/procurement;
- inference/serving engineering;
- model routing;
- AI cost analysis and forecasting;
- governance/policy;
- value, monetization, and pricing;
- executive sponsorship.

These are functions, not proven job titles or a finished operating model. No RACI, decision cadence, gate, escalation path, or artifact contract is public. Ruhroh may use the roles as provisional audiences, but should not invent Foundation-defined personas.

### AI Unit Economics Measurement Framework

Sources: [Projects index](https://www.tokeneconomics.com/projects/) and [TSC synthesis](https://www.tokeneconomics.com/top-challenges-and-opportunities-from-the-tsc/).

The public project is only a coming-soon card describing cost, value, and efficiency per unit output. The later TSC synthesis reports the internal Business Measurement/Unit Economics work at roughly 75%, but publishes no framework artifact. Other pages supply ingredients—cost per token, cost per call, useful output per token, product versus internal AI, value hypotheses, baselines, and monetization postures—but there is no public formula, denominator, allocation contract, or schema.

The honest near-term Ruhroh opportunity is to expose experimental ingredients without branding them as the Foundation framework:

- accepted outcome or passed scenario as a provisional technical unit;
- cost, tokens, latency, calls, retries, and human review per accepted outcome;
- declared quality floor and business-value hypothesis kept distinct;
- complete provenance and coverage for every denominator.

## Documentation extraction

### Overview: production → consumption → value

Sources: [overview](https://www.tokeneconomics.com/docs/overview/), [production, consumption, value](https://www.tokeneconomics.com/docs/overview/production-consumption-value/), and [What Is Tokenomics?](https://www.tokeneconomics.com/docs/overview/what-is-tokenomics/).

The Foundation defines Tokenomics as lifecycle management of AI production, consumption, and monetization, organized around whether AI creates value:

| Stage | Question | Main concerns |
| --- | --- | --- |
| Production | How is the token made? | Energy/capital conversion, capacity sourcing, token-factory effectiveness, cost per delivered token |
| Consumption | How is AI used? | Allocation, forecasting, model choice, routing, prompts, quantization, caching, agent loops |
| Value | What did AI return? | Outcomes, monetization, margin, useful output per token |

The pages emphasize that upstream capacity decisions set a cost floor, workload design determines consumption efficiency, and the two jointly constrain downstream margin.

The August “What Is Tokenomics?” page is explicitly **Unratified Draft v0.2**. It proposes:

- intelligence and interactivity as axes of token value;
- `cost per token = infrastructure cost ÷ tokens produced` as a production measure;
- `users × requests per user × tokens per request` as a naive demand baseline, adjusted for reasoning, multi-call agents, cache hits, seasonality, and growth;
- useful output per token rather than minimum token use;
- backward planning from desired outcome to intelligence/interactivity and then infrastructure/cost;
- four value postures: selling model access, AI-native products, AI added to products, and internal productivity.

The broader cost boundary includes orchestration, agents, memory, retrieval, vector stores, evaluation, governance, people, and data. Routing and cache behavior interact; switching to a cheaper model can destroy cache economics. Falling unit prices may also increase total consumption.

Open questions stated by the docs include cross-provider price normalization, experiment and failure cost, allocation, value metrics, and the eventual institutional relationship between FinOps and Tokenomics.

### Docs Projects index

The [Docs Projects page](https://www.tokeneconomics.com/docs/projects/) lists Big-T plus the two coming-soon projects. It omits both the live FOCUS 1.5 page and the Five-Layer Stack. The [Big-T parent](https://www.tokeneconomics.com/docs/projects/big-t/) is an HTTP-200 navigation node with no substantive content; the paper beneath it holds the actual specification.

This fragmented information architecture is itself a warning: use a snapshot date and source URL on every adopted concept rather than assuming the docs index is canonical.

## Insights inventory and extraction

The live [Insights listing](https://www.tokeneconomics.com/insights/) and asset API expose 17 records. The eight Foundation prose pieces were read in full. For the eight Tokenomics Brief records, this review covers the complete published show notes, not episode transcripts. The remaining “AI Value Paradox” card currently points to third-party Kategos content and is not treated as a Foundation requirement.

### 1. Tokenomics and FinOps: How do they fit together?

Source: [August 4 insight](https://www.tokeneconomics.com/insights/tokenomics-and-finops-how-do-they-fit-together/).

FinOps supplies organizational depth—billing, allocation, forecasting, ownership, and cadence. Tokenomics supplies technical-economic breadth—models, caching, evaluation, cost-per-outcome viability, packaging, pricing, and labor. The current position is that neither discipline contains the other; run both projections and investigate the gap. A rising bill with falling tokens per resolved outcome, for example, may indicate a market-price change rather than waste.

**Use for Ruhroh:** retain technical outcome evidence and export it into a finance view; do not turn Ruhroh into a generic cost-allocation product.

**Limit:** conceptual model, not a measurement specification. It supersedes the June Atomic Unit article's simpler “FinOps applied to AI” framing.

### 2. Linux Foundation launches the Tokenomics Foundation

Source: [August launch announcement](https://www.tokeneconomics.com/insights/linux-foundation-launches-tokenomics-foundation/).

The roadmap includes definitions for token value/density across input, output, reasoning, and cache; a full-cost reference model; cost to serve per call; value beginning with work completed without human involvement relative to a baseline; Big-T; FOCUS telemetry; TCO/COGS/business/labor frameworks; and education.

**Use for Ruhroh:** track these as standards-watch items and prefer versioned extension points.

**Limit:** roadmap commitments, not finished standards. The card says August 3 while the release dateline says August 4.

### 3. Freed, Not Replaced

Source: [July 14 insight](https://www.tokeneconomics.com/insights/how-ai-is-changing-finops-practitioners-role/).

Routing, caching, retry, and model selection now happen continuously inside applications, faster than ordinary reporting. Practitioners should shift from gathering and producing data to interpreting, advising, interrogating AI output, changing behavior, and connecting every dollar to a decision, team, outcome, and value. The article describes agents/MCP joining three FOCUS billing tables to 30 business-context tables and urges a sensible task-specific harness instead of reflexively choosing the newest model.

**Use for Ruhroh:** make the report a decision packet with evidence, not another dashboard; preserve human-review and accountability surfaces.

**Limit:** adapted keynote argument with one anonymous example, not comparative research.

### 4. Enterprise Tokenomics in practice at MetLife

Source: [July 6 insight](https://www.tokeneconomics.com/insights/enterprise-tokenomics-in-practice-at-metlife/).

The explicitly illustrative sequence is visibility → optimization → value realization. Visibility spans internal platforms, SaaS, APIs, and technical/nontechnical use. Optimization combines routing with design-time cost/performance/accuracy evaluation. Efficiency cases use an existing baseline; net-new cases need an explicit value hypothesis, time-boxed pilot, predefined criteria, leading indicators, and a stop decision. Platform guardrails include spend caps, persona/workload model access, workload classification, and deterministic alternatives.

**Use for Ruhroh:** introduce an experiment-economics envelope—baseline or hypothesis, quality criteria, deadline, and continue/modify/stop evidence—without claiming it is a Foundation standard.

**Limit:** one-enterprise editorial synthesis with no raw data; the page says it is not prescribed Foundation practice.

### 5. FinOps X keynote: Introducing Tokenomics

Sources: [FinOps recap](https://www.finops.org/insights/finops-x-2026-day-1-keynote/) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/finops-x-keynote-introducing-tokenomics-the-tokenomics-foundation/).

The recap highlights enterprise AI metrics/governance, cost of business outcomes, granular Bedrock attribution, a unified cost/data layer, and FOCUS support across SAP, Accenture, AWS, Microsoft, and others.

**Use for Ruhroh:** confirm demand for normalized, attributable technical evidence.

**Limit:** conference recap and product announcements; little reproducible implementation detail.

### 6. Intent to launch the Tokenomics Foundation

Source: [June 3 press release](https://www.tokeneconomics.com/insights/launch-tokenomics-foundation/).

The proposed mission includes neutral cross-provider benchmarks, open terminology, and FOCUS expansion. Input, output, cache, and adjacent costs are presented as harder to understand than familiar compute/storage bills.

**Use for Ruhroh:** neutrality and explicit provenance should remain product principles.

**Limit:** forward-looking press release, not an operating framework.

### 7. Managing AI value in SaaS model-token costs

Source: [June 3 article](https://www.tokeneconomics.com/insights/ai-value-saas-token-costs/).

Acquisition paths include direct APIs, hyperscaler marketplaces, self-hosted models, embedded SaaS AI, and developer tools. Recommended practices include per-team/application keys, a multiprovider gateway, cost per query/workflow/transaction, 30–60 days of observation before budgets, and alerts for runaway loops, context growth, silent model changes, and uncontrolled tests. Its maturity sequence is visibility → allocation/optimization → governance and CI/CD cost estimation.

Published claims include output priced 3–5× input, model tiers differing 50–100×, batch discounts near 50%, prefix-cache reductions of 80–90%, and adjacent infrastructure at 40–60% of feature spend.

**Use for Ruhroh:** turn each lever and anomaly into a controlled local hypothesis under a quality floor.

**Limit:** provider- and workload-dependent ranges, not constants or Ruhroh acceptance thresholds.

### 8. The Atomic Unit of AI Value

Sources: [FinOps article](https://www.finops.org/insights/token-economics-the-atomic-unit-of-ai-value/) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/token-economics-the-atomic-unit-of-ai-value/).

Five request-level consumption drivers are system instructions, context/memory, model, output length, and retry/orchestration. “Goodput” combines quality, time to first token, and generation speed. The full-cost stack includes inference, storage, power/facilities, network, SaaS, engineering/MLOps/governance, data, shadow AI, and training.

The factory analogy uses throughput, yield, defect rate, idle rate, and unit cost. Suggested measures include cost per inference, token efficiency, token yield after retry/abandonment/low-quality loss, and value or revenue per megawatt, paired with business results. Levers include model cascading, code-based tools, context compression, structured formats, RAG routing, semantic cache, tiering, and prompt optimization.

**Use for Ruhroh:** cost of failure/retry and accepted-output yield fit Ruhroh's evidence model especially well.

**Limit:** evidence mixes papers, first-party vendor benchmarks, analyst material, and industry commentary; figures are not uniformly comparable. Its FinOps relationship has since changed.

### 9. Quantization, Capacity and Moving Unit

Sources: [Spotify episode](https://open.spotify.com/episode/7GI5S55a74fO9nRQppeKRz) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/quantization-capacity-and-moving-unit/).

An unchanged model name and endpoint do not guarantee unchanged serving. Use forecast ranges, application-level observability, and continuous engineering/FinOps collaboration.

**Use for Ruhroh:** persist a serving fingerprint and rerun golden scenarios for quality, latency, or cost drift behind the same alias.

**Limit:** an 8–15% accuracy-shift claim is based on anonymous practitioner reports and is not universal evidence.

### 10. Blended Token Cost

Sources: [Spotify episode](https://open.spotify.com/episode/6Xb6IFyCZlSsDXx6fzZPkb) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/blended-token-cost-the-bill-beneath-the-bill/).

The same model can have multiple effective rates when provisioned capacity overflows to pay-as-you-go or varies by region. The proposed metric blends those rates, and allocation follows the call/workload rather than the individual user. A gateway is the join between routing and cost math.

**Use for Ruhroh:** preserve route, region, capacity mode, and billing-source provenance where connectors can report them.

**Limit:** anecdotes without a published formula or allocation validation.

### 11. The AI Value Paradox

Sources: [current Apple Podcasts destination](https://podcasts.apple.com/gb/podcast/the-ai-value-paradox/id1868880542) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/the-ai-value-paradox/).

The current live card points to a Kategos podcast about the gap between possessing AI tools and realizing ROI.

**Use for Ruhroh:** none as a Foundation requirement without clarification.

**Limit:** third-party content whose destination appears to have evolved since the card was created.

### 12. The Token Economy and New FinOps Jobs

Sources: [Spotify episode](https://open.spotify.com/episode/6DTZjmwp1b9o7d80vwro90) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/the-token-economy-and-new-finops-jobs/).

The notes emphasize input/output asymmetry in agentic coding, wide model-price spreads, scarce capacity, and platform roles for GPU governance, utilization, quotas, and chargeback.

**Use for Ruhroh:** input/output ratio and workload ownership are worthwhile dimensions; capacity governance is usually external.

**Limit:** illustrative arithmetic and macro claims, not a reusable benchmark.

### 13. Squishy Human Meatballs

Sources: [Spotify episode](https://open.spotify.com/episode/7IKxQyGqzqdnEBxNPkhekG) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/squishy-human-meatballs-the-human-side-of-finops/).

Economically important work often happens upstream: challenge a GPU request, test whether LoRA/QLoRA is suitable, shape defaults, and reframe the decision. Faster systems can accelerate the wrong behavior.

**Use for Ruhroh:** surface the decision and alternatives around an experiment, not just its score.

**Limit:** conference-rehearsal synthesis; claims about uniquely human work are rhetorical, not demonstrated.

### 14. FUD and FOMO and how FinOps agents are driving both

Sources: [Spotify episode](https://open.spotify.com/episode/6RbSuhpruWqdl0hH2VmO49) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/fud-and-fomo-and-how-finops-agents-are-driving-both/).

Two systems reportedly converged on deterministic scaffolding around probabilistic models. The notes report more than 5,000 annual hours of manual work targeted, 97% cloud-usage attribution, and an 85% reduction in stakeholder coordination.

**Use for Ruhroh:** require explicit evidence for deterministic checks, escalation, and human review.

**Limit:** self-reported conference metrics without denominators or reproducible protocols.

### 15. Inside the Costs of Running Agents

Sources: [Spotify episode](https://open.spotify.com/episode/6ghGcHZQVBbfb11IPkrI5Y) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/inside-the-costs-of-running-agents/).

The case separates LLM, vector-database, and ordinary cloud cost; uses an accuracy/cost/latency triangle; and divides the system into infrastructure/data, models, and agents. It recommends starting small, using OpenTelemetry, distinguishing training from inference, and answering the CFO in outcomes.

**Use for Ruhroh:** let adjacent costs and trace links remain optional components of a run's economic envelope.

**Limit:** design heuristic and rehearsal summary, not a strict law.

### 16. Four Talks, One Pattern

Sources: [Spotify episode](https://open.spotify.com/episode/5hf7WjH9l99Hn2Nk4nlghH) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/four-talks-one-pattern/).

Annual budgets are snapshots governing a stream, so forecasts should remain live. Other observations include retrieval memory sometimes costing as much as inference, failed requests carrying cost, persona-aligned units, and FOCUS as a normalized data base. Cost per token, agent, and use case share a shape at different attribution levels.

**Use for Ruhroh:** represent forecast/drift and failed-work cost from the same run facts, but keep denominators explicit.

**Limit:** talk synthesis without comparable definitions.

### 17. The Token Factory and the New Job of FinOps

Sources: [Spotify episode](https://open.spotify.com/episode/3EHaJfPGVtEyTscQ58Fg6y) and [Tokeneconomics record](https://www.tokeneconomics.com/insights/the-token-factory-and-the-new-job-of-finops/).

The described enterprise journey moves from making AI work to making it efficient, organized around Spend Visibility, Economics, and Value. It recommends starting with a manually assembled dashboard, taking evidence to an accountable executive, optimizing in application design, and watching token-to-spend drift. Falling unit cost can still drive higher total spend through demand growth.

**Use for Ruhroh:** focus its first economics surface on trustworthy evidence and drift, not a broad dashboard suite.

**Limit:** enterprise anecdote; the notes mention ten metrics but do not enumerate all ten.

## Supplemental substantive Page API records

The generic WordPress Page API exposed several research-like pages that are not in the Insights, Docs, or Projects listings. They were outside the named corpus boundary but close enough to the research question to inspect. Five add material context; two are empty or stale duplicate shells.

### Top Challenges and Opportunities from the TSC

Source: [TSC synthesis](https://www.tokeneconomics.com/top-challenges-and-opportunities-from-the-tsc/).

This is the richest supplemental source. It synthesizes ten anonymous pre-kickoff TSC calls into a proposed four-week working-group backlog. The strongest recurring positions are that Tokenomics is not token counting, no agreed value unit exists, tokens are non-fungible across type/provider, FOCUS-shaped vocabulary is desirable, real cost extends below tokens, runtime telemetry matters more than billing alone, traditional tagging is inadequate, and agent spend is a governance risk.

New Ruhroh-relevant capabilities:

- **Causal telemetry graph:** join model calls to retrieval/embedding work, vector or warehouse queries, tool invocations, agent identity, parent agent, and downstream cost across agent-to-agent boundaries.
- **Token provenance:** record tokenizer and serving-stack identity where known; qualify cross-provider comparisons when unknown.
- **Denominator cards:** every outcome/value unit should state suitable workloads, required evidence, gaming failure modes, and what the metric hides. Completion should use independent evaluator or human evidence, not agent self-certification.
- **Anti-pattern catalog:** version detectable signatures and counter-cases for context bloat, unnecessary reasoning, looping, hard-coded model pinning, cache misuse, and rework.
- **Premium versus waste:** distinguish deliberate availability or quality premiums from avoidable inefficiency.
- **Goodhart protection:** metrics and leaderboards need explicit gaming analysis; raw token leaderboards have already produced perverse incentives in an anecdotal case.

The page also reports unpublished internal progress: Personas/Ops at roughly 90%, an Optimization Playbook at 50%, and Unit Economics/Business Measurement at 75%. Those percentages describe draft progress, not public capability or ratification.

**Limit:** proposed backlog based on anonymous conversations; underlying transcripts are vault-only and nothing on the page is ratified.

### What Members Asked Us to Build

Source: [July internal synthesis](https://www.tokeneconomics.com/what-members-asked-us-to-build/).

This page synthesizes fourteen anonymous onboarding/pre-board conversations. It adds moderate demand evidence for:

- a self-service workload benchmark framework where teams run and publish their own results rather than a central body publishing universal model scores;
- workload archetype, business capability, and task-purpose metadata so averages do not mix unlike work;
- normalized telemetry and task classifiers across code assistants and agents, with a possible later conformance/attestation path;
- “deflection” as fully autonomous completion, including the harder residual human work and rework that automation leaves behind.

**Ruhroh fit:** the self-service benchmark model closely matches Ruhroh. Workload-archetype metadata, connector conformance, and explicit intervention/rework evidence are stronger opportunities than adopting a universal ROI formula.

**Limit:** “Internal synthesis, July 2026.” Signal strength reflects demand among a small anonymous sample, not feasibility or consensus.

### AI Token Economics: a Wardley Map

Source: [interactive Wardley map](https://www.tokeneconomics.com/ai-token-economics-a-wardley-map-tokenomics-foundation/).

The map explores token grade/price indexes, metering, a benchmarking cooperative, the optimization landscape, interoperability/conformance, personas, and a value taxonomy.

**Ruhroh fit:** economic-trace conformance and self-service benchmark packs align well.

**Limit:** strategy instrument with asserted maturity positions, not a specification, research result, or roadmap commitment. The token-grade/index idea is watch-only because the newer TSC synthesis says tokens are non-fungible and no denominator is settled.

### What Tokenomics Is, and What It Isn't

Source: [draft working definition](https://www.tokeneconomics.com/what-tokenomics-is-and-what-it-isnt/).

This draft, synthesized from fifteen anonymous conversations for TSC debate, adds:

- five different control surfaces—direct API, desktop, cloud-brokered access, agent tooling, and pass-through SaaS—with different observability and governance limits;
- two value modes: displaced-work deflection versus net-new value/risk where no human-cost baseline exists;
- explicit human-intervention and rework evidence, because a technical pass does not prove autonomous completion;
- reconciliation across event, workflow, task, and organizational resolution;
- workload-specific entitlement and model assignment rather than uniform caps.

**Ruhroh fit:** record the acquisition/control surface and its observability ceiling; keep technical outcome, autonomous deflection, and business value as separate claims; roll up from a shared event/workload identity.

**Limit:** draft working definition containing acknowledged contradictions, not a Foundation standard.

### Empty and stale duplicate records

- [What Tokenomics Is and Isn't](https://www.tokeneconomics.com/what-tokenomics-is-and-isnt/) has an empty WordPress content record and appears to be an abandoned duplicate of the substantive page above.
- [Roadmap Inputs from Member Onboardings](https://www.tokeneconomics.com/roadmap-inputs-from-onboardings/) has empty API content and a live page that is an older, shorter duplicate of “What Members Asked Us to Build.”

Both are inventoried and hashed but excluded as independent evidence.

### Working Groups

Source: [Working Groups](https://www.tokeneconomics.com/about/tokenomics-working-groups/).

This is an operational charter. It confirms separate Production, Consumption, and Value groups; shared Definitions/Personas/Frameworks and terminology work; and FOCUS as a separate specification track. The Consumption group frames its goal as the whole bill of materials at cost per call rather than cost per token. The Value group names deflection, cost per event, and a CFO-defensible labor baseline.

**Limit:** on the August 12 snapshot, working-group meetings and the September roadmap were future activity, participation was membership-only, and no finished framework is published here. It supports “organized and in flight,” not “standard.”

## Source inconsistencies and access gaps

These are part of the evidence, not housekeeping details:

- Eleven sitemap/API `/insights/` records redirect ordinary visitors to `/wp-admin/`; the live Insights cards instead point to Spotify, Apple Podcasts, or the FinOps Foundation. Both record and live destination are retained above.
- “The AI Value Paradox” currently resolves to third-party Kategos content. It is excluded from Foundation-derived requirements.
- Podcast observations come from complete published descriptions/show notes, not audio transcripts. Any claim unique to the audio remains outside this review.
- The June Atomic Unit article describes Tokenomics as FinOps applied to AI; the August article explicitly says neither contains the other. This review uses the newer articulation while preserving the contradiction.
- The Docs Projects page omits live FOCUS and Five-Layer projects, while the Projects index includes them.
- The FOCUS 1.5 page is live but absent from the page sitemap reviewed here.
- The Big-T paper calls itself informal and several reduction claims lack claim-level references on the page.
- The Five-Layer paper is a draft, “What Is Tokenomics?” is unratified v0.2, and FOCUS 1.5 remains in flight.

## Ruhroh today

This repository snapshot is commit `7b62a0a6364de5183a9dc814349d1d6a000ca381`, which matched `origin/main` when the review began.

### Strong foundations already present

| Capability | Verified implementation | Why it matters for Tokenomics |
| --- | --- | --- |
| Outcome evaluation | Scenarios define goal rubrics and evidence guidance; results retain criteria, subscores, commands, evidence, judge identity/votes/agreement, and human-review signals (`schemas/scenario-v2.schema.json:64-88`, `src/results.ts:872-907`). | A credible quality floor can be based on task outcomes, not token minimization. |
| Repeated experiments | Run plans preserve sample IDs/seeds; aggregates include pass rate, Wilson intervals, pass@k, bootstrap score intervals, duration, iterations, and failure buckets (`src/results.ts:532-551`, `933-979`). | Cost and latency can be evaluated alongside stochastic quality. |
| Comparability evidence | Cohorts capture benchmark target, harness, provider path, model, prompt, evaluator, judge, and environment differences (`src/results.ts:616-634`). | Provider/model drift and controlled experiments already have a home. |
| Target configurations | Targets express requested model, harness, provider path, protocol, and stream (`schemas/benchmark-target-config-v1.schema.json`, `docs/benchmark-methodology.md:52-115`). | This is the intended seam for model, harness, route, and later economic comparisons. |
| Evidence provenance | Artifact inventories, hashes, transcripts, event logs, workspace evidence, and manifests support trace-back from a claim (`docs/artifacts.md:171-195`). | Economics claims can remain inspectable rather than becoming opaque dashboard numbers. |
| Iteration containment | Scenarios declare `defaultMaxIterations`, and the Python controller enforces the outer loop maximum (`schemas/scenario-v2.schema.json:55-62`, `python/ruhroh/loop_controller.py:109-148`). | This is a partial circuit breaker and a starting point for bounded-resource evaluation. |
| Basic usage | A run may contain `costUsd`, `inputTokens`, `outputTokens`, and `totalTokens`; aggregates expose coverage, totals, means, and per-pass values (`schemas/run-manifest-v1.schema.json:159-167`, `src/results.ts:636-646`). | The current shape is an early outcome-efficiency primitive. |
| Claim-readiness concept | Compare already distinguishes publishable evidence from debugging evidence and blocks on statistical, evaluation, artifact, review, and run-plan problems (`src/results.ts:1122-1200`). | Usage completeness and economics provenance can join an existing trust gate. |

### Current economics contract

The connector protocol accepts a free-form result object, but the normalized contract retains only four usage values. The adapter collector copies the **latest** turn's `usage` record (`python/ruhroh/loop_controller.py:316-341`), and `usage_manifest` normalizes only cost plus input/output/total tokens (`python/ruhroh/loop_controller.py:1317-1323`). Compare reads only those four keys (`src/results.ts:2212-2228`).

The contract does not define:

- whether a turn's usage is a delta or cumulative total;
- source type: provider invoice, gateway meter, SDK counter, estimator, or environment override;
- collection timestamp, currency, price version, route, region, or capacity mode;
- cached, reasoning, audio/image, retrieved-context, prompt/tool-schema, or tool-result tokens;
- model-call, retry, fallback, tool-call, agent fan-out/depth, or failed-call counts;
- TTFT, inter-token latency, cache behavior, or per-call duration;
- full-cost components, value unit, ownership, or billing reconciliation;
- completeness at field and run level.

Bundled Codex CLI and Aider wrappers report model/artifact metadata but do not emit usage (`examples/adapters/codex-cli/run.sh:95-111`, `examples/adapters/aider/run.sh:122-138`), and doctor treats usage as optional (`src/cli.ts:8606-8627`). Therefore schema expansion alone would not produce useful data; adapter conformance and provenance are prerequisites.

## Correctness prerequisites and contract risks discovered in this review

These are **Observed — Ruhroh** findings from the current control flow, not speculative feature gaps.

### P0-A: benchmark targets can collapse into one comparison group

The model-controlled example defines three target IDs for three requested models, all using underlying `adapterId: "aider"` (`examples/benchmark-targets/model-controlled.aider-openrouter.json:8-84`). Documentation promises that the target ID becomes the comparison ID in sample IDs and aggregate reports (`docs/benchmark-methodology.md:52-58`).

Resolution correctly keeps both identities:

- comparison `adapterId = target.targetId`;
- execution `runAgentAdapterId = target.adapterId ?? target.targetId` (`src/cli.ts:7937-7943`).

The run plan and sample IDs use the target identity (`src/cli.ts:7616-7621`, `7740-7747`), but Harbor execution receives the underlying adapter (`src/cli.ts:7627-7634`). Result summarization then chooses `run.runAgentAdapterId || run.adapter` (`src/results.ts:872-883`), and aggregation keys only on scenario plus that chosen adapter (`src/results.ts:933-942`).

**Effect:** all three requested models can become one mixed-model `aider` group, so model pairwise comparisons disappear. Mixed-target and mixed-model cohort warnings do survive and flow into claim-readiness blockers, so a publication-aware caller is warned; the aggregate grouping and missing pairwise output are still structurally wrong. This blocks trustworthy model-controlled quality/cost frontiers.

**Narrow corrective seam:** use `benchmarkTarget.targetId` as the comparison identity when present, preserve the connector adapter separately, and add an end-to-end regression asserting that the existing three-target fixture produces three aggregate groups and model-level pairwise rows.

### P0-B: per-pass economics remain visible under partial usage coverage

Group aggregation collects only reported costs and tokens, but divides their sums by **all** passes (`src/results.ts:2543-2568`). Cross-group rollups do the same (`src/results.ts:2189-2208`). With nonnegative usage, incomplete numerator coverage makes the reported cohort-wide cost/token per pass a lower bound, not the actual figure.

An existing test deliberately supplies usage for one of two runs and still expects `costPerPass` and `tokensPerPass` (`tests/ruhroh.test.ts:5918-5947`). Claim-readiness checks statistical, evaluation, artifact, review, and run-plan warnings but not usage coverage (`src/results.ts:1122-1200`).

**Effect:** reports can present precise-looking unit economics that are not supported by all included runs.

**Narrow corrective seam:** either suppress these ratios until relevant coverage is complete, mark them explicitly as observed lower bounds, or calculate a clearly named matched cohort containing both outcome and usage. Add usage completeness to claim readiness whenever an economics claim is present.

### Contract risk: multi-turn usage semantics are ambiguous

Each command turn may report a usage object (`python/ruhroh/loop_controller.py:412-428`), but artifact collection keeps only the latest nonempty one (`316-341`). That is correct only if every wrapper reports a cumulative run total. It loses earlier consumption if wrappers report deltas and can double-count if future code sums cumulative snapshots.

**Effect:** a multi-iteration agent can have a manifest total whose meaning depends on undocumented connector behavior. No bundled usage-emitting adapter was found that proves a current wrong total, so this is an observed contract ambiguity and latent defect, not a third confirmed correctness failure.

**Narrow corrective seam:** version the usage envelope with explicit `scope` and `aggregation` semantics, retain per-turn records, and make adapter conformance prove the final run total.

### Read-only reproduction

A no-write smoke against the tracked `dist/results.js` constructed two passing runs with distinct model-controlled target IDs, the same underlying `aider` adapter, and usage on only one run. Current aggregation returned:

```text
groupCount: 1
adapter: aider
benchmarkTargets: [target-a, target-b]
agentModels: [p/model-a, p/model-b]
runsWithCost: 1
passes: 2
totalCostUsd: 1
costPerPass: 0.5
totalTokens: 100
tokensPerPass: 50
```

That single reproduction demonstrates both confirmed defects: target/model conditions were mixed into one group, and incomplete consumption was divided across both passes.

## Five-Layer gap map

| Layer | Ruhroh coverage today | Gap | Smallest credible extension |
| --- | --- | --- | --- |
| L1 Silicon | Requested/actual model and generic environment evidence only | No hardware, watts, accelerator, precision, or energy data | Optional infrastructure provenance imported from a trusted meter; do not require it for hosted APIs |
| L2 Capacity | Provider path/gateway metadata can identify a route | No reservation/capacity mode, utilization, overflow, region, or blended rate | Billing/FOCUS reconciliation fields linked to the run, kept separate from technical trace |
| L3 Inference | Overall duration, iterations, transcript/event paths | Native events are opaque rather than normalized model/tool spans; no TTFT, inter-token, cache, calls, retries, batch, or throughput | Provider-neutral inference spans retaining raw native-event references |
| L4 Model | Strong requested/actual model, protocol, prompt, and controlled-stream primitives | Target grouping defect; no price/capability/precision profile or held-out drift gate | Fix identity first, then versioned model profile and golden regression keyed to actual version/fingerprint |
| L5 Routing/Governance | Planned provider path, outer iteration maximum, report warnings | No observed route decision, fallback, cache choice, model mix, resource budgets, fan-out, or burn | Route-decision spans and enforceable observable budgets with explicit exhaustion outcomes |

Cross-cutting gaps:

- **Identity:** benchmark ownership and maintainers exist, but execution identity, billing principal, team/project/customer, and decision owner are not standardized.
- **Observability:** audit evidence is strong; operational call-level telemetry is not normalized.
- **Cost:** self-reported four-field usage is useful but underspecified, incomplete, and not full cost.
- **Security/privacy:** secret names are protected, but richer trace and principal data would require redaction and access policy.

## Opportunity matrix

The stages below express dependency and evidence maturity, not a committed roadmap.

| Stage | Opportunity | Foundation basis | Ruhroh fit | Main proof required | Confidence |
| --- | --- | --- | --- | --- | --- |
| Foundation | Preserve target identity across execution and aggregation | Honest comparison requires stable workload/model identity | Direct repair to an existing contract | Three-target fixture remains three groups through compare | High |
| Foundation | Usage coverage and provenance gate | Instrument first; comparable telemetry; cost per outcome | Extends current manifest, report, and claim readiness | Multi-turn adapter conformance and no unlabeled ratio under missing usage | High |
| Near | Economic trace v2 and connector conformance | Five-Layer L3-L5; Atomic Unit drivers; TSC causal telemetry graph | Natural extension of run/turn evidence | Real connectors emit cumulative calls, token types, routes, cache, retries, timings, acquisition surface, tokenizer/serving provenance, and parent/child cost with source | High concept / medium feasibility |
| Near | Outcome-constrained efficiency frontier | Useful output per token; design-time cost/performance/accuracy evaluation; quality/availability premiums | Ruhroh already has outcome distributions and target experiments | Stable target grouping, complete cost coverage, declared quality floor/denominator, intervention/rework evidence, uncertainty-aware Pareto output | High |
| Near | Resource budgets and exhaustion evidence | Big-T `T(∞)` breakers; spend caps and runaway-loop alerts | Extends loop stop policy and artifact evidence | Enforce tokens/cost/calls/retries/depth at observable boundaries without false guarantees | High concept / medium enforcement |
| Near | Workload archetype and denominator contract | Member demand for self-service benchmarks; TSC says no agreed value unit | Extends scenario/suite metadata and evaluator evidence | A denominator card states suitable workloads, required data, gaming risks, hidden work, and human/evaluator acceptance | High concept / medium taxonomy risk |
| Explore | Big-T scale experiment | Published Big-T classes and multiple-`n` requirement | Scenario suites and repeated samples are a strong substrate | Declared `n` unit, multiple controlled scales, measured `k/a`, quality floor, uncertainty-aware fit | Medium-high |
| Explore | Versioned anti-pattern findings | TSC proposed context, reasoning, loop, pinning, cache, and rework detectors | Fits Ruhroh's evidence-backed finding/report model | Detectors show a causal signature and counter-case, not generic lint or a hard-coded savings claim | Medium |
| Explore | Provider/model drift monitor | Moving alias/quantization claims; repeated observation | Cohort fingerprints and held-out scenarios already exist | Demonstrate a meaningful change behind stable alias without confounding prompt/harness/provider | Medium |
| Explore | FOCUS reconciliation bridge | FOCUS economic normalization plus separate app trace | Benchmark target/model/usage can be the technical side of the join | Released field mapping reconciles real provider billing without data loss | Medium; standard still moving |
| Watch | Persona decision views | Roles page and forthcoming Personas/Ops Model | Same evidence can serve engineering, product, FinOps, governance, executive audiences | Actual user decisions improve; Foundation publishes enough operating detail | Medium-low until release |
| Watch | Full AI unit economics | Cost/value/efficiency per output roadmap | Pass/resolution is a useful technical denominator | Defensible value unit, allocation basis, adjacent cost, labor/rework, and ownership | Low-medium until framework release |

## What Ruhroh should not build from this research

- A generic FinOps billing dashboard. Ruhroh's defensible advantage is outcome-grounded technical evaluation.
- A Big-T label inferred from one run or from iteration count alone.
- A “cheapest model” ranking without a quality floor, uncertainty, and complete usage coverage.
- Foundation-branded Personas, Operating Model, or AI Unit Economics schemas before those projects publish substantive contracts.
- Hard-coded cache, quantization, price, or savings percentages from articles and show notes.
- A FOCUS 1.5 exporter based on fields that are only under consideration.
- A single “total AI cost” value that silently mixes invoices, estimates, infrastructure allocations, labor, and model counters.
- User-level attribution where workload, project, or pseudonymous principal is sufficient.

## Evidence pack

### Observed

- The named Insights/Docs/Projects surfaces and all generic Page API records were enumerated; the content is actively changing.
- Big-T and Five-Layer are the only substantively published project frameworks.
- FOCUS 1.5 work is explicitly in flight; Personas/Ops and AI Unit Economics remain unpublished, though a TSC synthesis reports substantial internal drafts.
- The corpus consistently requires quality/outcome context for efficiency claims.
- Ruhroh already joins outcome evaluation, repeated samples, provenance, evidence, model identity, and basic usage.
- Ruhroh currently standardizes only cost USD and input/output/total tokens.
- Current target aggregation can erase the experimental target identity.
- Current per-pass economic ratios can be emitted with incomplete usage coverage.
- Multi-turn usage has no explicit delta/cumulative contract; this is a latent risk rather than a reproduced wrong total.

### Inferred

- Ruhroh can become the technical evaluation plane that explains whether a workload change reduced cost while preserving outcomes; it need not own enterprise billing.
- A pass or accepted outcome is a useful first technical unit, provided the evaluator and denominator are explicit.
- Big-T is most valuable as a controlled scale-experiment design, not as a decorative label on a single trace.
- FOCUS is best treated as a reconciliation/export boundary after its field set stabilizes.
- Persona views should be projections of the same evidence, not separate truth stores.

### Assumed and still needing user evidence

- Teams making model, prompt, context, routing, cache, and agent-architecture decisions will act on a cost-quality frontier.
- Connectors or gateways can provide trustworthy call-level usage with sufficient coverage.
- Users can declare a quality floor before running an efficiency comparison.
- A useful subset of resource ceilings can be observed and enforced outside opaque agent runtimes.
- Billing owners will value a FOCUS export from an evaluation tool enough to justify maintenance.

### Contradictions and tensions

- Tokenomics' stated relationship to FinOps changed between June and August.
- Token minimization conflicts with the recurring requirement to preserve quality and value.
- Big-T emphasizes growth class while practical decisions often depend on large constants.
- FOCUS normalizes economic facts while many decisive application facts are explicitly out of scope.
- Rich identity improves attribution but increases privacy, access-control, and cardinality risk.
- Agent autonomy creates value but also makes reliable inner-call observation and enforcement harder.

### Unknowns

- Final FOCUS 1.5 AI fields and semantics after the August/October decisions.
- Formal contents of the Personas/Ops Model and AI Unit Economics projects.
- Whether current real Ruhroh adapters can expose cumulative usage, cache/reasoning detail, or invoice-grade cost.
- Which outcome denominator users consider decision-worthy beyond benchmark pass/fail.
- Whether target-grouping and partial-usage defects have affected any published external results.
- How much call/span instrumentation can be normalized without leaking prompts, tool data, identities, or secrets.

## Product point of view

**Falsifiable POV:** Ruhroh should become the evidence system that proves an AI workload change lowers observed resource use or cost without breaching a declared quality and latency envelope. It should not become a broad cost-management dashboard.

This direction is wrong or premature if:

1. real connectors cannot produce complete, trustworthy usage for repeated runs;
2. target-level quality/cost results do not change model, route, prompt, cache, or architecture decisions;
3. quality floors are too unstable to constrain optimization honestly;
4. Big-T classes cannot be distinguished under controlled scale because inner work is opaque or provider variance dominates;
5. FOCUS reconciliation does not match real billing well enough to support a useful handoff.

## Logline slate

These are candidate directions, not a ranked roadmap.

- **Truthful economics envelope:** every number says what it covers, where it came from, and whether it is complete.
- **Outcome-constrained frontier:** find configurations that reduce cost or latency while remaining inside an evidence-backed quality floor.
- **Agent amplification trace:** show how calls, retrieval, tools, retries, and parent/child agents causally multiplied a workload and its adjacent costs.
- **Big-T scale lab:** measure consumption across controlled input/request scales and distinguish class changes from coefficient changes.
- **Runaway-work containment:** turn budget, call, retry, iteration, and agent-depth limits into explicit, reviewable outcomes.
- **Provider drift sentinel:** detect changed quality, latency, or price behind an unchanged model alias.
- **FOCUS reconciliation bridge:** join normalized billing economics to Ruhroh's request, harness, loop, and outcome evidence.
- **Decision packets by role:** project one evidence set into engineering, product, FinOps, governance, and executive decisions.

## Idea portfolio

The following five ideas can coexist. No winner has been selected.

### Idea A — Truthful Economics Envelope

**Logline:** Make every run's economic facts cumulative, attributable, source-labeled, and coverage-aware before calculating unit economics.

**Customer and job:** evaluation engineers and benchmark publishers need to know that a cost or token number covers the same run and means the same thing across connectors.

**Product experience:** a run explains the usage source and scope, acquisition/control surface, per-turn/call composition, token categories, tokenizer and serving-stack provenance when known, price basis, timestamps, route/model identity, failed-work consumption, and completeness. A causal graph connects retrieval, tool, and parent/child agent work without losing raw evidence. Compare refuses or clearly qualifies ratios whose numerator coverage does not match the outcome cohort.

**Evidence and codebase fit:** strong. It directly addresses the current four-field manifest, latest-turn ambiguity, optional adapter emission, partial-coverage ratio issue, and existing claim-readiness machinery.

**Why strategically attractive:** every other economics capability depends on it. It deepens Ruhroh's existing strength—inspectable claims—without changing the product into FinOps software.

**Alternatives:** rely on provider dashboards or require users to pre-normalize usage. Both separate consumption from Ruhroh's outcome evidence and make missing coverage easier to miss.

**Main risks:** connectors expose incompatible counters; invoice cost arrives later; inner agents hide calls; richer traces carry sensitive data.

**Testable hypothesis:** once provenance and completeness are visible, repeated-run economic summaries either become publishable with complete coverage or are explicitly excluded/qualified; no precise per-pass number survives an unmatched cohort.

### Idea B — Outcome-Constrained Frontier

**Logline:** Compare models, harnesses, prompts, routes, and architectures on quality, latency, and cost, then expose the non-dominated choices above a declared quality floor.

**Customer and job:** AI platform and application engineers need to choose the least expensive configuration that remains good enough for the actual task.

**Product experience:** an experiment declares controlled variables, workload archetype, denominator card, and quality/latency envelope. Repeated target results show uncertainty for pass/score and coverage for economics. Human intervention and rework remain visible. The report highlights the Pareto set rather than a universal winner, explains why a cheaper row was rejected, and distinguishes a deliberate quality/availability premium from avoidable waste.

**Evidence and codebase fit:** strong after the target identity defect and usage contract are repaired. Ruhroh already has targets, controlled streams, repeated samples, confidence intervals, evaluator evidence, and cost/token fields.

**Why strategically attractive:** it operationalizes the corpus's clearest shared best practice—evaluate cost, performance, and accuracy at design time with quality held constant.

**Alternatives:** separate load/cost benchmark plus quality benchmark, or a weighted composite score. Separate tools lose cohort linkage; a composite hides trade-offs and embeds arbitrary weights.

**Main risks:** unstable evaluators, insufficient samples, incomplete usage, point-estimate ranking, threshold gaming, and comparisons that vary more than one condition.

**Testable hypothesis:** for at least one real suite, the frontier changes a deployment choice relative to choosing either the cheapest model or the highest raw score alone.

### Idea C — Agent Complexity and Containment Lab

**Logline:** Reveal and bound the call, retry, context, tool, and delegation multipliers that push agents toward `T(n·k·a)` or unbounded work.

**Customer and job:** agent-framework and platform engineers need to distinguish useful reasoning from runaway amplification and prove an architectural change at scale.

**Product experience:** a scale experiment names `n`, runs multiple values with repeated samples, records `k` and `a` components, keeps a quality floor, and reports both empirical growth and practical coefficients. Resource budgets stop observable excess with a first-class exhaustion reason and preserved partial evidence. Versioned, evidence-linked findings flag context bloat, unnecessary reasoning, loops, brittle model pinning, cache misuse, and rework only when a detectable signature and counter-case exist.

**Evidence and codebase fit:** medium-high. Run plans, scenarios, samples, iteration controls, event artifacts, and failure taxonomy exist; normalized calls, depth, retries, context, and resource-budget semantics do not.

**Why strategically attractive:** it turns Big-T from thought leadership into a reproducible evaluation method suited to Ruhroh's loop-engineering identity.

**Alternatives:** static architecture review, tracing-only dashboards, or a single maximum-iteration flag. These do not measure quality-preserving scale behavior or the source of amplification.

**Main risks:** ambiguity in `n`, noisy curve fitting, opaque inner agents, delayed billing, cooperative rather than hard enforcement, and overemphasis on asymptotic labels over real constants.

**Testable hypothesis:** controlled scale packs can reliably distinguish at least one architectural class or amplification change and predict a resource-budget breach better than single-run iteration count.

### Idea D — FOCUS Reconciliation Bridge

**Logline:** Export released FOCUS economic facts while preserving Ruhroh-native trace, harness, session, loop, and outcome evidence as the technical explanation.

**Customer and job:** AI platform and FinOps teams need to reconcile provider billing with the application experiment or workload that produced it.

**Product experience:** a versioned mapping connects target/model and input/output usage to provider SKU and price data, principal/workload attribution, and billing period. It explicitly labels unsupported or deferred FOCUS concepts and keeps technical spans separate. Reconciliation reports explain unmatched costs rather than silently forcing a join.

**Evidence and codebase fit:** medium. Model and benchmark-target metadata provide anchors, but released FOCUS semantics, SKU price data, billing provenance, and route/capacity information are dependencies.

**Why strategically attractive:** it lets Ruhroh remain the outcome-evidence plane while integrating with an emerging common financial language.

**Alternatives:** vendor-specific billing adapters or CSV export. They may ship faster but fragment semantics and cannot cleanly express the billing/trace boundary.

**Main risks:** moving standard, provider mapping ambiguity, invoice lag, reseller chains, privacy, and maintenance burden disproportionate to user demand.

**Testable hypothesis:** a real provider billing period can be reconciled to a Ruhroh workload cohort within a declared tolerance while every unmatched amount and identity remains visible.

### Idea E — Value and Ownership Decision Packet

**Logline:** Turn the same run evidence into a bounded continue/modify/stop decision for engineering, product, finance, governance, and executive owners.

**Customer and job:** accountable decision makers need to understand whether a workload is effective, affordable, attributable, and worth continuing—not merely whether an evaluator passed it.

**Product experience:** an experiment declares an efficiency baseline or net-new value/risk hypothesis, accountable owners, intended outcome, leading indicators, pilot deadline, and stop rule. It keeps three claims separate: technical pass, autonomous deflection with intervention/rework evidence, and business value. Role-specific projections reconcile event → workflow → task → organizational rollup without duplicating source facts.

**Evidence and codebase fit:** medium-low today. Suites and scenarios already carry owner/maintainer/governance metadata, and reports carry human-review evidence, but business value, decision ownership, and the Foundation's formal personas/unit framework are not defined.

**Why strategically attractive:** it closes the corpus's production → consumption → value loop and could differentiate Ruhroh from benchmark-only tools.

**Alternatives:** export raw results into existing BI/FinOps tools. That may be sufficient unless users need the evidence-linked decision history inside Ruhroh.

**Main risks:** inventing premature personas, confusing benchmark ownership with spend/value ownership, subjective denominators, privacy, high-cardinality attribution, and scope expansion into general portfolio governance.

**Testable hypothesis:** a time-boxed pilot using a declared decision packet reaches a traceable continue/modify/stop decision faster and with fewer unresolved evidence questions than the existing report alone.

## Suggested evaluation sequence

This is a dependency order, not selection of an idea:

1. Repair target comparison identity and make partial-coverage ratios safe.
2. Validate one real connector's cumulative usage and provenance end to end.
3. Trial the Truthful Economics Envelope on an existing repeated suite.
4. Use those same facts to prototype one outcome-constrained frontier.
5. Run one controlled Big-T experiment with multiple `n` values and a declared quality floor.
6. Recheck the final FOCUS 1.5 specification after its decision/release milestones before designing an exporter.
7. Wait for substantive Personas/Ops and AI Unit Economics publications—or validate user demand independently—before standardizing those concepts.

## Review checkpoint

The portfolio is intentionally `awaiting-selection`. A useful next decision is which question Ruhroh should prove first:

- Can we trust the economics already shown in reports?
- Can the report choose a cheaper configuration without losing outcomes?
- Can Ruhroh detect and contain agentic amplification across scale?
- Can its technical evidence reconcile to real provider billing?
- Can it support a real continue/modify/stop investment decision?

## Source register

Core corpus entry points:

- [Insights index](https://www.tokeneconomics.com/insights/)
- [Projects index](https://www.tokeneconomics.com/projects/)
- [Documentation overview](https://www.tokeneconomics.com/docs/overview/)
- [What Is Tokenomics?](https://www.tokeneconomics.com/docs/overview/what-is-tokenomics/)
- [Production, Consumption, Value](https://www.tokeneconomics.com/docs/overview/production-consumption-value/)
- [Key Players and Roles](https://www.tokeneconomics.com/docs/overview/key-players/)
- [Documentation projects](https://www.tokeneconomics.com/docs/projects/)
- [Big-T Notation Paper](https://www.tokeneconomics.com/docs/projects/big-t/big-t-notation-paper/)
- [Five-Layer Tokenomics Stack Paper](https://www.tokeneconomics.com/projects/the-five-layer-tokenomics-stack/the-five-layer-tokenomics-stack-paper/)
- [FOCUS 1.5 project status](https://www.tokeneconomics.com/projects/what-1-5-does-for-ai-cost-and-what-it-does-not/)
- [Machine-readable discovery manifest](./2026-08-12-tokeneconomics-foundation-discovery.json)

Supplemental substantive pages:

- [Top Challenges and Opportunities from the TSC](https://www.tokeneconomics.com/top-challenges-and-opportunities-from-the-tsc/)
- [What Members Asked Us to Build](https://www.tokeneconomics.com/what-members-asked-us-to-build/)
- [AI Token Economics: a Wardley Map](https://www.tokeneconomics.com/ai-token-economics-a-wardley-map-tokenomics-foundation/)
- [What Tokenomics Is, and What It Isn't](https://www.tokeneconomics.com/what-tokenomics-is-and-what-it-isnt/)
- [Working Groups](https://www.tokeneconomics.com/about/tokenomics-working-groups/)

All 17 Insight records are linked in their numbered entries above. Discovery sources and corpus counts are linked under Coverage and method.
