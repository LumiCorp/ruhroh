import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validateRuhrohFocusAttributionProfile,
  validateRuhrohFocusConformanceProfile,
  validateRuhrohFocusDatasetBundle,
  validateRuhrohFocusImportReport,
  validateRuhrohFocusMappingPack,
  validateRuhrohFocusSpecLock,
  validateRuhrohFocusUpdateReview,
  type RuhrohFocusUpdateReviewV1,
} from "../src/focus.js";

const HASH = "a".repeat(64);
const REF = { path: "evidence/source.json", sha256: HASH };

test("ratified FOCUS 1.4 spec lock pins release assets, model, and validator", () => {
  const lock = JSON.parse(readFileSync("examples/focus/spec-lock-1.4.json", "utf8"));
  assert.deepEqual(validateRuhrohFocusSpecLock(lock), []);
  assert.match(validateRuhrohFocusSpecLock({ ...lock, specification: { ...lock.specification, ref: "working_draft" } }).join("\n"), /release tag/u);
  assert.match(validateRuhrohFocusSpecLock({ ...lock, datasets: [...lock.datasets, "SkuPrice"] }).join("\n"), /exactly the four/u);
});

test("FOCUS mappings, conformance exceptions, and attribution remain explicit", () => {
  const mapping = { version: "ruhroh_focus_mapping_pack_v1", mappingPackId: "focus-1.4-cost", focusVersion: "1.4", dataset: "CostAndUsage", specLockRef: REF, catalogRef: REF, mappings: [{ sourceColumn: "BilledCost", disposition: "mapped", destinationField: "amountDecimal", transform: "decimal_string", requirementIds: ["CAU-BilledCost-C-000-M"], fixtureIds: ["exact"], economicallyMaterial: true }], unsupportedConcepts: [] };
  assert.deepEqual(validateRuhrohFocusMappingPack(mapping), []);
  assert.deepEqual(validateRuhrohFocusConformanceProfile({ version: "ruhroh_focus_conformance_profile_v1", profileId: "strict", focusVersion: "1.4", modelSha256: HASH, applicabilityCriteria: [], allowedSkips: [] }), []);
  assert.deepEqual(validateRuhrohFocusAttributionProfile({ version: "ruhroh_focus_attribution_profile_v1", profileId: "provider", provider: "provider", focusVersion: "1.4", sourceSelectors: [], privacyClassification: "restricted" }), []);
  assert.match(validateRuhrohFocusAttributionProfile({ version: "ruhroh_focus_attribution_profile_v1", profileId: "provider", provider: "provider", focusVersion: "1.4", sourceSelectors: [], privacyClassification: "public" }).join("\n"), /restricted/u);
});

test("FOCUS source bundles and ready reports enforce the privacy/readiness boundary", () => {
  assert.deepEqual(validateRuhrohFocusDatasetBundle({ version: "ruhroh_focus_dataset_bundle_v1", bundleId: "bundle", focusVersion: "1.4", createdAt: "2026-08-12T20:00:00Z", datasets: [], relationships: [], privacyClassification: "restricted", blockers: [] }), []);
  const report = { version: "ruhroh_focus_import_report_v1", reportId: "report", createdAt: "2026-08-12T20:00:00Z", focusVersion: "1.4", releaseStatus: "ratified", bundleRef: REF, specLockRef: REF, mappingPackRef: REF, conformanceReportRefs: [], datasets: [], currencies: [], relationshipCoverage: [], readiness: "ready", blockers: [] };
  assert.deepEqual(validateRuhrohFocusImportReport(report), []);
  assert.match(validateRuhrohFocusImportReport({ ...report, releaseStatus: "preview" }).join("\n"), /ratified/u);
});

test("semantic updates cannot bypass human review or promote previews", () => {
  const review: RuhrohFocusUpdateReviewV1 = { version: "ruhroh_focus_update_review_v1", reviewId: "review", createdAt: "2026-08-12T20:00:00Z", fromSpecLockRef: REF, toSpecLockRef: REF, candidateReleaseStatus: "preview", changes: [{ id: "change", classification: "normative", sourcePath: "model/rule", summary: "MUST changed", impactedMappings: [], requiresHumanReview: true }], generatedRefs: [], unresolvedDecisions: ["Review MUST change"], verification: [], recommendation: "review_required" };
  assert.deepEqual(validateRuhrohFocusUpdateReview(review), []);
  assert.match(validateRuhrohFocusUpdateReview({ ...review, changes: [{ ...review.changes[0], requiresHumanReview: false }] }).join("\n"), /human review/u);
});
