import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { buildRuhrohFocusCatalogFromModel } from "../dist/focus.js";

const modelPath = "assets/focus/1.4/model-1.4.json";
const outputPath = "examples/focus/catalog-1.4.json";
const sha256 = "3dd2c0c6fcc2c3d1792060fcbebba4ae074cd4dade8cde72958bd37a9a8b183f";
const model = JSON.parse(readFileSync(modelPath, "utf8"));
const catalog = buildRuhrohFocusCatalogFromModel({ catalogId: "focus-1.4-ratified", model, modelRef: { path: modelPath, sha256 } });
const catalogBytes = `${JSON.stringify(catalog, null, 2)}\n`;
writeFileSync(outputPath, catalogBytes);

const costColumns = catalog.datasets.find((dataset) => dataset.dataset === "CostAndUsage").columns;
const mapped = {
  BilledCost: ["amountDecimal", "decimal_string"],
  BillingCurrency: ["currency", "currency_code"],
  ChargeCategory: ["kind", "charge_category_to_kind"],
  ChargePeriodStart: ["occurredAt", "timestamp"],
  SkuId: ["sku", "string"],
};
const mappingPack = {
  version: "ruhroh_focus_mapping_pack_v1",
  mappingPackId: "focus-1.4-cost-and-usage-v1",
  focusVersion: "1.4",
  dataset: "CostAndUsage",
  specLockRef: { path: "examples/focus/spec-lock-1.4.json", sha256: createHash("sha256").update(readFileSync("examples/focus/spec-lock-1.4.json")).digest("hex") },
  catalogRef: { path: outputPath, sha256: createHash("sha256").update(catalogBytes).digest("hex") },
  mappings: costColumns.map((column) => mapped[column.columnId] ? {
    sourceColumn: column.columnId, disposition: "mapped", destinationField: mapped[column.columnId][0], transform: mapped[column.columnId][1],
    requirementIds: column.ruleIds, fixtureIds: [`focus-1.4-${column.columnId.toLowerCase()}`], economicallyMaterial: ["BilledCost", "BillingCurrency", "ChargeCategory"].includes(column.columnId),
  } : {
    sourceColumn: column.columnId, disposition: "preserved_only", requirementIds: column.ruleIds,
    fixtureIds: [`focus-1.4-preserve-${column.columnId.toLowerCase()}`], economicallyMaterial: ["EffectiveCost", "ContractedCost", "ListCost", "PricingCurrencyEffectiveCost"].includes(column.columnId),
    reason: "Preserved as FOCUS-native restricted evidence; not projected into the neutral billed-cost row.",
  }),
  unsupportedConcepts: ["foreign_exchange_conversion", "automatic_refund_inference", "automatic_commitment_inference", "automatic_capacity_charge_inference", "focus_export", "focus_certification"],
};
writeFileSync("examples/focus/mapping-pack-1.4.json", `${JSON.stringify(mappingPack, null, 2)}\n`);
