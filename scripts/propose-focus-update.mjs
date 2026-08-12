#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  buildRuhrohFocusCatalogFromModel,
  buildRuhrohFocusUpdateReview,
  canonicalRuhrohFocusCatalogJson,
} from "../dist/focus.js";

const args = parseArgs(process.argv.slice(2));
for (const key of ["model", "version", "commit", "ref", "status", "output-dir"]) {
  if (!args[key]) throw new Error(`--${key} is required`);
}
if (!/^[a-f0-9]{40}$/u.test(args.commit)) throw new Error("--commit must be an immutable 40-character SHA");
if (!['ratified', 'preview'].includes(args.status)) throw new Error("--status must be ratified or preview");
if (args.status === "ratified" && !args.ref.startsWith("v")) throw new Error("ratified candidates require a release tag");
if (args.status === "preview" && args.ref !== args.commit) throw new Error("preview candidates must use the immutable commit as their ref");

const currentLockPath = "examples/focus/spec-lock-1.4.json";
const currentCatalogPath = "examples/focus/catalog-1.4.json";
const mappingPackPath = "examples/focus/mapping-pack-1.4.json";
const currentLock = JSON.parse(readFileSync(currentLockPath, "utf8"));
const currentCatalog = JSON.parse(readFileSync(currentCatalogPath, "utf8"));
const mappingPack = JSON.parse(readFileSync(mappingPackPath, "utf8"));
const modelBytes = readFileSync(args.model);
const modelSha256 = sha256(modelBytes);
const outputDir = path.resolve(args["output-dir"]);
mkdirSync(outputDir, { recursive: true });

const candidateModelRef = { path: `upstream/model-${args.version}.json`, sha256: modelSha256 };
const candidateLock = {
  version: "ruhroh_focus_spec_lock_v1",
  profileId: `focus-${args.version}-${args.status}-candidate`,
  focusVersion: args.version,
  releaseStatus: args.status,
  specification: {
    repository: "https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec",
    ref: args.ref,
    commitSha: args.commit,
    releaseAssets: [{ name: `model-${args.version}.json`, ...candidateModelRef, upstreamDigest: modelSha256 }],
    model: candidateModelRef,
  },
  validator: {
    repository: "https://github.com/finopsfoundation/focus_validator",
    version: args["validator-version"] ?? currentLock.validator.version,
    commitSha: args["validator-commit"] ?? currentLock.validator.commitSha,
  },
  datasets: currentLock.datasets,
  retrievedAt: args["retrieved-at"] ?? new Date().toISOString(),
};
const lockBytes = `${JSON.stringify(candidateLock, null, 2)}\n`;
const catalog = buildRuhrohFocusCatalogFromModel({ catalogId: `focus-${args.version}-${args.commit.slice(0, 12)}`, model: JSON.parse(modelBytes), modelRef: candidateModelRef });
const catalogBytes = canonicalRuhrohFocusCatalogJson(catalog);
const review = buildRuhrohFocusUpdateReview({
  reviewId: `focus-${currentLock.focusVersion}-to-${args.version}-${args.commit.slice(0, 12)}`,
  createdAt: args["retrieved-at"],
  fromSpecLockRef: { path: currentLockPath, sha256: sha256(readFileSync(currentLockPath)) },
  toSpecLockRef: { path: "candidate-spec-lock.json", sha256: sha256(lockBytes) },
  candidateReleaseStatus: args.status,
  fromCatalog: currentCatalog,
  toCatalog: catalog,
  mappingPack,
  validatorChanged: candidateLock.validator.version !== currentLock.validator.version || candidateLock.validator.commitSha !== currentLock.validator.commitSha,
  generatedRefs: [
    { path: "candidate-catalog.json", sha256: sha256(catalogBytes) },
    { path: "mapping-impact.json", sha256: "0".repeat(64) },
    { path: "fixture-plan.json", sha256: "0".repeat(64) },
  ],
  verification: [{ name: "semantic extraction", status: "passed" }, { name: "official validator compatibility", status: "not_run" }],
});

const mappingImpact = {
  version: "ruhroh_focus_mapping_impact_v1",
  mappingPackId: mappingPack.mappingPackId,
  changes: review.changes.filter((item) => item.impactedMappings.length > 0),
  automaticChanges: [],
  note: "Neutral billing contracts and approved mappings are never changed automatically.",
};
const fixturePlan = {
  version: "ruhroh_focus_fixture_plan_v1",
  fixtures: review.changes.filter((item) => item.classification !== "editorial").map((item) => ({ changeId: item.id, status: "required", humanReview: true })),
};
const mappingBytes = `${JSON.stringify(mappingImpact, null, 2)}\n`;
const fixtureBytes = `${JSON.stringify(fixturePlan, null, 2)}\n`;
review.generatedRefs[1].sha256 = sha256(mappingBytes);
review.generatedRefs[2].sha256 = sha256(fixtureBytes);

writeFileSync(path.join(outputDir, "candidate-spec-lock.json"), lockBytes);
writeFileSync(path.join(outputDir, "candidate-catalog.json"), catalogBytes);
writeFileSync(path.join(outputDir, "mapping-impact.json"), mappingBytes);
writeFileSync(path.join(outputDir, "fixture-plan.json"), fixtureBytes);
writeFileSync(path.join(outputDir, "update-review.json"), `${JSON.stringify(review, null, 2)}\n`);
console.log(JSON.stringify({ outputDir, semanticChanges: review.changes.length, recommendation: review.recommendation }));

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    if (!key?.startsWith("--") || values[index + 1] === undefined) throw new Error(`invalid argument ${key ?? ""}`);
    result[key.slice(2)] = values[index + 1];
  }
  return result;
}
