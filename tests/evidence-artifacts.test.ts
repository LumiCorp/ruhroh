import assert from "node:assert/strict";
import test from "node:test";

import {
  RUHROH_EVIDENCE_ARTIFACT_ROLES,
  evidenceArtifactRoleDescriptor,
  validateRuhrohEvidenceArtifactReference,
  validateRuhrohPublicArtifactInventory,
  type RuhrohEvidenceArtifactReferenceV1,
} from "../src/artifacts.js";

const HASH = "a".repeat(64);

test("economics artifact roles bind contracts to truth planes and public policy", () => {
  assert.equal(evidenceArtifactRoleDescriptor("economics-envelope").truthPlane, "technical");
  assert.equal(evidenceArtifactRoleDescriptor("intervention-ledger").truthPlane, "human_work");
  assert.equal(evidenceArtifactRoleDescriptor("cost-reconciliation").truthPlane, "billing");
  assert.equal(evidenceArtifactRoleDescriptor("decision-packet").truthPlane, "decision");
  assert.equal(RUHROH_EVIDENCE_ARTIFACT_ROLES["billing-source-manifest"].publicPolicy, "restricted");
  assert.equal(RUHROH_EVIDENCE_ARTIFACT_ROLES["focus-dataset-bundle"].publicPolicy, "restricted");
  assert.equal(RUHROH_EVIDENCE_ARTIFACT_ROLES["focus-attribution-profile"].publicPolicy, "restricted");
  assert.equal(RUHROH_EVIDENCE_ARTIFACT_ROLES["focus-validator-output"].publicPolicy, "restricted");
  assert.equal(RUHROH_EVIDENCE_ARTIFACT_ROLES["focus-source-dataset"].publicPolicy, "restricted");
  assert.equal(RUHROH_EVIDENCE_ARTIFACT_ROLES["cost-reconciliation-v2"].publicPolicy, "allowed");
  assert.equal(evidenceArtifactRoleDescriptor("focus-spec-lock").truthPlane, "billing");
});

test("public artifact inventories reject raw billing and review-only evidence", () => {
  const safe: RuhrohEvidenceArtifactReferenceV1 = {
    version: "ruhroh_evidence_artifact_reference_v1",
    role: "cost-reconciliation",
    contractVersion: "ruhroh_cost_reconciliation_v1",
    path: "evidence/cost-reconciliation.json",
    sha256: HASH,
    classification: "public",
  };
  assert.deepEqual(validateRuhrohEvidenceArtifactReference(safe), []);
  assert.deepEqual(validateRuhrohPublicArtifactInventory([safe]), []);

  const restricted: RuhrohEvidenceArtifactReferenceV1 = {
    ...safe,
    role: "normalized-billing-row",
    contractVersion: "ruhroh_normalized_billing_row_v1",
    path: "restricted/normalized-billing-row.ndjson",
    classification: "restricted",
  };
  assert.match(validateRuhrohPublicArtifactInventory([restricted]).join("\n"), /cannot enter a public bundle/u);
  assert.match(validateRuhrohEvidenceArtifactReference({ ...safe, path: "../outside.json" }).join("\n"), /cannot traverse/u);
  assert.match(validateRuhrohEvidenceArtifactReference({ ...safe, contractVersion: "wrong" }).join("\n"), /contractVersion/u);
});
