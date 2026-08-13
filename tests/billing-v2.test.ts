import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  addRuhrohDecimals,
  buildRuhrohCostReconciliationV2,
  canonicalizeRuhrohDecimal,
  normalizeRuhrohBillingRecordsV2,
  subtractRuhrohDecimals,
  validateRuhrohCostReconciliationV2,
  type RuhrohBillingMappingProfileV2,
  type RuhrohBillingSourceManifestV2,
} from "../src/billing-v2.js";

const REF = { path: "evidence/source.json", sha256: "a".repeat(64) };

const PROFILE: RuhrohBillingMappingProfileV2 = {
  version: "ruhroh_billing_mapping_profile_v2",
  profileId: "exact-v2",
  provider: "provider-neutral",
  externalSchemaVersion: "test",
  fields: { sourceRowId: "id", amountDecimal: "amount", currency: "currency", kind: "kind", occurredAt: "at", workloadId: "workload", sku: "sku" },
  kindValues: { charge: ["Usage", "Purchase"], credit: ["Credit"], tax: ["Tax"], adjustment: ["Adjustment"] },
  matching: { boundedWindowSeconds: 60, boundedFields: ["workloadId", "sku"] },
  allocations: [],
};

test("decimal strings remain exact beyond JavaScript number precision", () => {
  assert.equal(canonicalizeRuhrohDecimal("+0009007199254740993.1200e2"), "900719925474099312");
  assert.equal(canonicalizeRuhrohDecimal("-0.000e20"), "0");
  assert.equal(addRuhrohDecimals("999999999999999999999999999999999999", "0.000000000000000001"), "999999999999999999999999999999999999.000000000000000001");
  assert.equal(subtractRuhrohDecimals("0.1", "0.10"), "0");
  assert.throws(() => canonicalizeRuhrohDecimal("Infinity"));
});

test("v2 normalization rejects numeric money and preserves adjustment semantics", () => {
  const normalized = normalizeRuhrohBillingRecordsV2([
    { id: "row-1", amount: "1.2300", currency: "USD", kind: "Adjustment" },
    { id: "row-2", amount: 4.56, currency: "USD", kind: "Usage" },
  ], PROFILE);
  assert.equal(normalized.rows.length, 1);
  assert.equal(normalized.rows[0]?.amountDecimal, "1.23");
  assert.equal(normalized.rows[0]?.kind, "adjustment");
  assert.match(normalized.errors.join("\n"), /decimal string/u);
});

test("v2 reconciliation accounts exactly per currency", () => {
  const source: RuhrohBillingSourceManifestV2 = {
    version: "ruhroh_billing_source_manifest_v2", sourceId: "billing", format: "records", externalSchemaVersion: "test",
    billingPeriod: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-02-01T00:00:00Z" }, currencies: ["USD"], rowCount: 2,
    sourceRef: REF, privacyClassification: "restricted",
  };
  const profile: RuhrohBillingMappingProfileV2 = {
    ...PROFILE,
    allocations: [{ sourceRowId: "row-2", targets: [
      { workloadId: "work-a", assignedAmountDecimal: "-0.1", weightDecimal: "0.333333333333333333" },
      { workloadId: "work-b", assignedAmountDecimal: "-0.2", weightDecimal: "0.666666666666666667" },
    ] }],
  };
  const parsed = normalizeRuhrohBillingRecordsV2([
    { id: "row-1", amount: "9007199254740993.01", currency: "USD", kind: "Usage", at: "2026-01-02T00:00:00Z", workload: "work-a", sku: "sku-a" },
    { id: "row-2", amount: "-0.3", currency: "USD", kind: "Credit" },
  ], profile);
  assert.deepEqual(parsed.errors, []);
  const output = buildRuhrohCostReconciliationV2({
    reconciliationId: "recon-v2", createdAt: "2026-02-02T00:00:00Z", benchmarkClaimRef: REF, billingSource: source,
    billingSourceRef: REF, mappingProfile: profile, mappingProfileRef: REF, billingRows: parsed.rows,
    technicalFacts: [{
      version: "ruhroh_technical_economic_fact_v1", factId: "fact-a", runId: "run-a", benchmarkTargetId: "target-a", workloadId: "work-a",
      occurredAt: "2026-01-02T00:00:01Z", sku: "sku-a", evidenceRef: REF,
    }],
  });
  assert.equal(output.currencies[0]?.sourceTotalDecimal, "9007199254740992.71");
  assert.equal(output.currencies[0]?.differenceDecimal, "0");
  assert.equal(output.coverage.boundedRows, 1);
  assert.equal(output.coverage.allocatedRows, 1);
  assert.deepEqual(output.blockers, []);
  assert.deepEqual(validateRuhrohCostReconciliationV2(output), []);
});

test("v2 reconciliation preserves exact, ambiguous, unmatched, multi-currency, and zero-row evidence", () => {
  const requestHash = createHash("sha256").update("request-a").digest("hex");
  const uniqueRequestHash = createHash("sha256").update("request-b").digest("hex");
  const rows = [
    { version: "ruhroh_normalized_billing_row_v2" as const, sourceRowId: "exact", sourceRowSha256: "b".repeat(64), amountDecimal: "1", currency: "USD", kind: "charge" as const, providerRequestId: "request-b" },
    { version: "ruhroh_normalized_billing_row_v2" as const, sourceRowId: "ambiguous", sourceRowSha256: "c".repeat(64), amountDecimal: "2", currency: "EUR", kind: "tax" as const, providerRequestId: "request-a" },
    { version: "ruhroh_normalized_billing_row_v2" as const, sourceRowId: "unmatched", sourceRowSha256: "d".repeat(64), amountDecimal: "-0.5", currency: "EUR", kind: "credit" as const },
  ];
  const fact = (factId: string, providerRequestIdHash = requestHash) => ({ version: "ruhroh_technical_economic_fact_v1" as const, factId, runId: factId, benchmarkTargetId: "target", workloadId: factId, occurredAt: "2026-01-02T00:00:00Z", providerRequestIdHash, evidenceRef: REF });
  const output = buildRuhrohCostReconciliationV2({
    reconciliationId: "classes", createdAt: "2026-02-02T00:00:00Z", benchmarkClaimRef: REF,
    billingSource: { version: "ruhroh_billing_source_manifest_v2", sourceId: "billing", format: "normalized_rows", externalSchemaVersion: "test", billingPeriod: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-02-01T00:00:00Z" }, currencies: ["EUR", "USD"], rowCount: 3, sourceRef: REF, privacyClassification: "restricted" },
    billingSourceRef: REF, mappingProfile: PROFILE, mappingProfileRef: REF, billingRows: rows, technicalFacts: [fact("fact-a"), fact("fact-b"), fact("fact-c", uniqueRequestHash)],
  });
  assert.equal(output.coverage.exactRows, 1);
  assert.equal(output.coverage.ambiguousRows, 1);
  assert.equal(output.coverage.unmatchedRows, 1);
  assert.equal(output.currencies.find((item) => item.currency === "EUR")?.sourceTotalDecimal, "1.5");
  assert.equal(output.ready, false);

  const empty = buildRuhrohCostReconciliationV2({
    reconciliationId: "empty", createdAt: "2026-02-02T00:00:00Z", benchmarkClaimRef: REF,
    billingSource: { version: "ruhroh_billing_source_manifest_v2", sourceId: "empty", format: "normalized_rows", externalSchemaVersion: "test", billingPeriod: { startedAt: "2026-01-01T00:00:00Z", endedAt: "2026-02-01T00:00:00Z" }, currencies: [], rowCount: 0, sourceRef: REF, privacyClassification: "restricted" },
    billingSourceRef: REF, mappingProfile: PROFILE, mappingProfileRef: REF, billingRows: [], technicalFacts: [],
  });
  assert.deepEqual(empty.currencies, []);
  assert.equal(empty.ready, true);
});
