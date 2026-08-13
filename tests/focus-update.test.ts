import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildRuhrohFocusCatalogFromModel, buildRuhrohFocusUpdateReview, compareRuhrohFocusCatalogs, hashRuhrohFocusCatalog } from "../src/focus.js";

const REF = { path: "assets/focus/1.4/model-1.4.json", sha256: "3dd2c0c6fcc2c3d1792060fcbebba4ae074cd4dade8cde72958bd37a9a8b183f" };

test("compiled FOCUS 1.4 model produces a deterministic four-dataset catalog", () => {
  const model = JSON.parse(readFileSync(REF.path, "utf8")) as unknown;
  const first = buildRuhrohFocusCatalogFromModel({ catalogId: "focus-1.4", model, modelRef: REF });
  const second = buildRuhrohFocusCatalogFromModel({ catalogId: "focus-1.4", model, modelRef: REF });
  assert.deepEqual(first, second);
  assert.equal(first.datasets.length, 4);
  assert.equal(first.datasets.find((dataset) => dataset.dataset === "CostAndUsage")?.columns.find((column) => column.columnId === "BilledCost")?.dataType, "Decimal");
  assert.equal(first.datasets.find((dataset) => dataset.dataset === "CostAndUsage")?.columns.find((column) => column.columnId === "BilledCost")?.requirement, "mandatory");
  assert.equal(hashRuhrohFocusCatalog(first), hashRuhrohFocusCatalog(second));
});

test("semantic updater classifies mandatory additions and prevents preview promotion", () => {
  const model = JSON.parse(readFileSync(REF.path, "utf8")) as unknown;
  const from = buildRuhrohFocusCatalogFromModel({ catalogId: "from", model, modelRef: REF });
  const to = structuredClone(from);
  to.catalogId = "preview";
  to.datasets[0]?.columns.push({ columnId: "FutureRequired", dataType: "Decimal", requirement: "mandatory", applicabilityCriteria: [], ruleIds: ["FUTURE-C-001-M"] });
  const changes = compareRuhrohFocusCatalogs(from, to);
  assert.equal(changes.find((change) => change.id.includes("FutureRequired"))?.classification, "additive_mandatory");
  const review = buildRuhrohFocusUpdateReview({ reviewId: "review", createdAt: "2026-08-12T20:00:00Z", fromSpecLockRef: REF, toSpecLockRef: REF, candidateReleaseStatus: "preview", fromCatalog: from, toCatalog: to });
  assert.equal(review.recommendation, "review_required");
  assert.match(review.unresolvedDecisions[0] ?? "", /diff-only/u);
});

test("future catalogs may describe new datasets without making them runtime inputs", () => {
  const model = JSON.parse(readFileSync(REF.path, "utf8")) as Record<string, Record<string, unknown>>;
  model.Details = { ...model.Details, FOCUSVersion: "1.5-preview" };
  model.ModelRules = {
    ...model.ModelRules,
    "SkuPrice-SkuPriceId-Presence-M": { Function: "Presence", DatasetId: "SkuPrice", EntityType: "Column", EntityId: "SkuPriceId" },
    "SkuPrice-SkuPriceId-Type": { Function: "Type", DatasetId: "SkuPrice", EntityType: "Column", EntityId: "SkuPriceId", ValidationCriteria: { MustSatisfy: "must be of type String." } },
  };
  const catalog = buildRuhrohFocusCatalogFromModel({ catalogId: "preview", model, modelRef: REF });
  assert.equal(catalog.focusVersion, "1.5-preview");
  assert.equal(catalog.datasets.some((dataset) => dataset.dataset === "SkuPrice"), true);
});

test("semantic comparison classifies the complete review matrix", () => {
  const model = JSON.parse(readFileSync(REF.path, "utf8")) as unknown;
  const from = buildRuhrohFocusCatalogFromModel({ catalogId: "from", model, modelRef: REF });
  const to = structuredClone(from);
  const dataset = to.datasets[0];
  assert.ok(dataset);
  const removed = dataset.columns.shift();
  assert.ok(removed);
  const changed = dataset.columns[0];
  assert.ok(changed);
  changed.dataType = `${changed.dataType}-changed`;
  dataset.columns.push(
    { columnId: "FutureOptional", dataType: "String", requirement: "optional", applicabilityCriteria: [], ruleIds: [] },
    { columnId: "FutureConditional", dataType: "String", requirement: "conditional", applicabilityCriteria: [], ruleIds: [] },
  );
  to.datasets.push({ dataset: "FutureDataset", columns: [], ruleIds: [] });
  const classifications = new Set(compareRuhrohFocusCatalogs(from, to).map((item) => item.classification));
  assert.deepEqual([...classifications].sort(), ["additive_conditional", "additive_optional", "dataset", "rename_deprecation_removal", "type_scale_unit_currency_nullability_applicability"].sort());
  const review = buildRuhrohFocusUpdateReview({
    reviewId: "matrix", createdAt: "2026-08-12T20:00:00Z", fromSpecLockRef: REF, toSpecLockRef: REF,
    candidateReleaseStatus: "ratified", fromCatalog: from, toCatalog: from, validatorChanged: true,
    editorialChanges: [{ id: "editorial:one", sourcePath: "specification/intro", summary: "Editorial wording changed" }],
  });
  assert.deepEqual(new Set(review.changes.map((item) => item.classification)), new Set(["editorial", "validator"]));
  assert.equal(review.changes.find((item) => item.classification === "editorial")?.requiresHumanReview, false);
});
