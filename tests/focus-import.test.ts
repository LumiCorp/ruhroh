import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Compression, WriterPropertiesBuilder, readParquet, writeParquet } from "parquet-wasm";

import {
  focusChargeCategoryToKind,
  importRuhrohFocusBundle,
  parseRuhrohFocusCsv,
  readRuhrohFocusParquet,
  type RuhrohFocusCatalogV1,
  type RuhrohFocusConformanceReportV1,
  type RuhrohFocusDatasetInputV1,
  type RuhrohFocusMappingPackV1,
  type RuhrohFocusSpecLockV1,
} from "../src/focus.js";

const SHA = "a".repeat(64);
const REF = { path: "evidence/ref.json", sha256: SHA };
const DATASETS = ["BillingPeriod", "ContractCommitment", "CostAndUsage", "InvoiceDetail"] as const;

test("Parquet Decimal128 and Decimal256 values are recovered without Number conversion", async () => {
  const records = await readRuhrohFocusParquet(readFileSync("tests/fixtures/focus/exact-decimals.parquet"));
  assert.equal(records[0]?.BilledCost, "9007199254740993.123456789012345678");
  assert.equal(records[0]?.ExtendedDecimal, "123456789012345678901234567890.1234567890123456789");
});

test("CSV and Parquet produce identical canonical row objects and hashes", async () => {
  const parquet = await readRuhrohFocusParquet(readFileSync("tests/fixtures/focus/exact-decimals.parquet"));
  const csv = parseRuhrohFocusCsv([
    "BilledCost,ExtendedDecimal,BillingCurrency,ChargeCategory,ChargePeriodStart,SkuId",
    "9007199254740993.123456789012345678,123456789012345678901234567890.1234567890123456789,USD,Usage,2026-01-02T00:00:00Z,sku-a",
  ].join("\n"));
  assert.deepEqual(csv, parquet);
  assert.equal(canonicalHash(csv[0]), canonicalHash(parquet[0]));
});

test("exact Parquet decimals survive supported compression codecs", async () => {
  for (const compression of [Compression.UNCOMPRESSED, Compression.SNAPPY, Compression.GZIP, Compression.BROTLI, Compression.ZSTD, Compression.LZ4_RAW]) {
    const source = readParquet(readFileSync("tests/fixtures/focus/exact-decimals.parquet"));
    const properties = new WriterPropertiesBuilder().setCompression(compression).build();
    const records = await readRuhrohFocusParquet(writeParquet(source, properties));
    assert.equal(records[0]?.BilledCost, "9007199254740993.123456789012345678");
    assert.equal(records[0]?.ExtendedDecimal, "123456789012345678901234567890.1234567890123456789");
  }
});

test("FOCUS charge categories map conservatively", () => {
  assert.equal(focusChargeCategoryToKind("Usage"), "charge");
  assert.equal(focusChargeCategoryToKind("Purchase"), "charge");
  assert.equal(focusChargeCategoryToKind("Credit"), "credit");
  assert.equal(focusChargeCategoryToKind("Tax"), "tax");
  assert.equal(focusChargeCategoryToKind("Adjustment"), "adjustment");
  assert.throws(() => focusChargeCategoryToKind("Refund"));
});

test("all four datasets preserve duplicates and link official identities", async () => {
  const records = {
    BillingPeriod: [{ InvoiceIssuerName: "issuer", BillingPeriodStart: "2026-01-01T00:00:00Z", BillingPeriodEnd: "2026-02-01T00:00:00Z" }],
    ContractCommitment: [{ ContractId: "contract", ContractCommitmentId: "commitment" }],
    InvoiceDetail: [{ InvoiceId: "invoice", InvoiceDetailId: "detail" }],
    CostAndUsage: [
      { BilledCost: "9007199254740993.01", BillingCurrency: "USD", ChargeCategory: "Usage", ChargePeriodStart: "2026-01-02T00:00:00Z", SkuId: "sku", InvoiceId: "invoice", InvoiceDetailId: "detail", InvoiceIssuerName: "issuer", BillingPeriodStart: "2026-01-01T00:00:00Z", BillingPeriodEnd: "2026-02-01T00:00:00Z", ContractApplied: JSON.stringify([{ ContractId: "contract", ContractCommitmentId: "commitment" }]) },
      { BilledCost: "9007199254740993.01", BillingCurrency: "USD", ChargeCategory: "Usage", ChargePeriodStart: "2026-01-02T00:00:00Z", SkuId: "sku", InvoiceId: "invoice", InvoiceDetailId: "detail", InvoiceIssuerName: "issuer", BillingPeriodStart: "2026-01-01T00:00:00Z", BillingPeriodEnd: "2026-02-01T00:00:00Z", ContractApplied: JSON.stringify([{ ContractId: "contract", ContractCommitmentId: "commitment" }]) },
    ],
  };
  const sources = DATASETS.map((dataset) => ({ dataset, format: "records" as const, records: records[dataset], sourceRef: { path: `restricted/${dataset}.json`, sha256: canonicalHash(records[dataset]) } })) as RuhrohFocusDatasetInputV1[];
  const specLock: RuhrohFocusSpecLockV1 = {
    version: "ruhroh_focus_spec_lock_v1", profileId: "focus-1.4", focusVersion: "1.4", releaseStatus: "ratified",
    specification: { repository: "https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec", ref: "v1.4", commitSha: "f1eeb30a78f7c141ef1237d589355296a2761c1c", releaseAssets: [{ name: "model-1.4.json", path: "assets/focus/1.4/model-1.4.json", sha256: SHA, upstreamDigest: SHA }], model: REF },
    validator: { repository: "https://github.com/finopsfoundation/focus_validator", version: "2.2.1", commitSha: "21ea623a29cdd366380388e88f6659d5cfbe55eb" },
    datasets: [...DATASETS], retrievedAt: "2026-08-12T20:00:00Z",
  };
  const catalog: RuhrohFocusCatalogV1 = {
    version: "ruhroh_focus_catalog_v1", catalogId: "focus-1.4", focusVersion: "1.4", modelRef: REF,
    datasets: DATASETS.map((dataset) => ({ dataset, ruleIds: [], columns: [...new Set(records[dataset].flatMap((row) => Object.keys(row)))].map((columnId) => ({ columnId, dataType: "String", requirement: "mandatory" as const, applicabilityCriteria: [], ruleIds: [] })) })),
  };
  const mappingPack: RuhrohFocusMappingPackV1 = {
    version: "ruhroh_focus_mapping_pack_v1", mappingPackId: "focus-1.4-cost", focusVersion: "1.4", dataset: "CostAndUsage", specLockRef: REF, catalogRef: REF,
    mappings: [...new Set(records.CostAndUsage.flatMap((row) => Object.keys(row)))].map((sourceColumn) => sourceColumn === "BilledCost"
      ? { sourceColumn, disposition: "mapped" as const, destinationField: "amountDecimal" as const, transform: "decimal_string" as const, requirementIds: ["CU-BilledCost-C-000-M"], fixtureIds: ["exact"], economicallyMaterial: true }
      : { sourceColumn, disposition: "preserved_only" as const, requirementIds: [], fixtureIds: ["preserved"], economicallyMaterial: false, reason: "supporting evidence" }), unsupportedConcepts: [],
  };
  const conformanceReports = DATASETS.map((dataset): RuhrohFocusConformanceReportV1 => ({
    version: "ruhroh_focus_conformance_report_v1", reportId: `report-${dataset}`, createdAt: "2026-08-12T20:00:00Z", focusVersion: "1.4", releaseStatus: "ratified", dataset,
    inputRef: sources.find((source) => source.dataset === dataset)?.sourceRef ?? REF, specLockRef: REF, conformanceProfileRef: REF,
    validator: { repository: specLock.validator.repository, version: "2.2.1", commitSha: specLock.validator.commitSha, executable: "focus-validator" },
    status: "passed", requirements: { evaluated: 1, passed: 1, failed: 0, skipped: 0, errors: 0 }, rules: [{ ruleId: `${dataset}-test`, status: "passed", count: 1 }], blockers: [],
  }));
  const result = await importRuhrohFocusBundle({ bundleId: "bundle", reportId: "import", createdAt: "2026-08-12T20:00:00Z", specLock, specLockRef: REF, catalog, catalogRef: REF, mappingPack, mappingPackRef: REF, bundleRef: REF, conformanceReports, conformanceReportRefs: DATASETS.map(() => REF), datasets: sources, normalizedRowsRef: REF });
  assert.equal(result.normalizedRows.length, 2);
  assert.notEqual(result.normalizedRows[0]?.sourceRowId, result.normalizedRows[1]?.sourceRowId);
  assert.equal(result.normalizedRows[0]?.sourceRowSha256, result.normalizedRows[1]?.sourceRowSha256);
  assert.equal(result.report.currencies[0]?.sourceAmountDecimal, "18014398509481986.02");
  assert.ok(result.bundle.relationships.every((relationship) => relationship.missing === 0 && relationship.ambiguous === 0));
  assert.equal(result.report.readiness, "ready");
});

function canonicalHash(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (typeof value === "object" && value !== null) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`; return JSON.stringify(value) ?? "null"; }
