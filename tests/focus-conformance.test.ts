import assert from "node:assert/strict";
import test from "node:test";

import { parseRuhrohFocusJUnit, runRuhrohFocusValidation, type RuhrohFocusConformanceProfileV1, type RuhrohFocusSpecLockV1 } from "../src/focus.js";

const MODEL_SHA = "3dd2c0c6fcc2c3d1792060fcbebba4ae074cd4dade8cde72958bd37a9a8b183f";
const INPUT_REF = { path: "tests/fixtures/focus/exact-decimals.parquet", sha256: "2bffd95f5129d4eae438127ebcdfe2eec878f53588b116200691f1033ffd257a" };
const REF = { path: "assets/focus/1.4/model-1.4.json", sha256: MODEL_SHA };
const LOCK: RuhrohFocusSpecLockV1 = {
  version: "ruhroh_focus_spec_lock_v1", profileId: "focus-1.4", focusVersion: "1.4", releaseStatus: "ratified",
  specification: { repository: "https://github.com/FinOps-Open-Cost-and-Usage-Spec/FOCUS_Spec", ref: "v1.4", commitSha: "f1eeb30a78f7c141ef1237d589355296a2761c1c", model: REF, releaseAssets: [{ name: "model-1.4.json", ...REF, upstreamDigest: MODEL_SHA }] },
  validator: { repository: "https://github.com/finopsfoundation/focus_validator", version: "2.2.1", commitSha: "21ea623a29cdd366380388e88f6659d5cfbe55eb" },
  datasets: ["BillingPeriod", "ContractCommitment", "CostAndUsage", "InvoiceDetail"], retrievedAt: "2026-08-12T20:00:00Z",
};
const PROFILE: RuhrohFocusConformanceProfileV1 = { version: "ruhroh_focus_conformance_profile_v1", profileId: "strict", focusVersion: "1.4", modelSha256: MODEL_SHA, applicabilityCriteria: [], allowedSkips: [{ ruleId: "CU-B-C-2-M", reason: "official validator cannot execute this dynamic rule", reviewRef: REF }] };

test("JUnit normalization emits only rule IDs, statuses, counts, and bounded messages", () => {
  const parsed = parseRuhrohFocusJUnit(`<?xml version="1.0"?><testsuites tests="3" failures="1" errors="0" skipped="1"><testsuite><testcase name="CU-A-C-1-M :: Type"/><testcase name="CU-B-C-2-M :: Dynamic"><skipped message="reviewed dynamic rule"/></testcase><testcase name="CU-C-C-3-M :: Type"><failure message="/Users/person/private.csv leaked"/></testcase></testsuite></testsuites>`);
  assert.equal(parsed.passed, 1);
  assert.equal(parsed.failed, 1);
  assert.equal(parsed.skipped, 1);
  assert.deepEqual(parsed.rules.map((rule) => rule.ruleId), ["CU-A-C-1-M", "CU-B-C-2-M", "CU-C-C-3-M"]);
  assert.doesNotMatch(JSON.stringify(parsed), /\/Users\/person/u);
});

test("missing runner and wrong version stay inspectable and unavailable", () => {
  const base = { reportId: "report", createdAt: "2026-08-12T20:00:00Z", dataset: "CostAndUsage" as const, dataFilePath: "tests/fixtures/focus/exact-decimals.parquet", inputRef: INPUT_REF, modelFilePath: "assets/focus/1.4/model-1.4.json", ruleSetPath: "assets/focus/1.4", specLock: LOCK, specLockRef: REF, conformanceProfile: PROFILE, conformanceProfileRef: REF };
  const missing = runRuhrohFocusValidation(base);
  assert.equal(missing.status, "unavailable");
  assert.match(missing.blockers.join("\n"), /not configured/u);
  const wrong = runRuhrohFocusValidation({ ...base, runner: { executable: "true", prefixArguments: [], timeoutMs: 1000, versionProbe: { executable: "node", arguments: ["-e", "process.stdout.write('2.2.0')"], expectedOutput: "2.2.1" } } });
  assert.equal(wrong.status, "unavailable");
  assert.match(wrong.blockers.join("\n"), /expected 2\.2\.1/u);
});

test("validator timeouts, malformed output, model mismatch, and skip policy remain blockers", () => {
  const base = { reportId: "report", createdAt: "2026-08-12T20:00:00Z", dataset: "CostAndUsage" as const, dataFilePath: "tests/fixtures/focus/exact-decimals.parquet", inputRef: INPUT_REF, modelFilePath: "assets/focus/1.4/model-1.4.json", ruleSetPath: "assets/focus/1.4", specLock: LOCK, specLockRef: REF, conformanceProfile: PROFILE, conformanceProfileRef: REF };
  const probe = { executable: "node", arguments: ["-e", "process.stdout.write('2.2.1')"], expectedOutput: "2.2.1" };
  const runner = (script: string, timeoutMs = 1000) => ({ executable: "node", prefixArguments: ["-e", script, "--"], timeoutMs, versionProbe: probe });
  const destinationScript = (xml: string) => `const fs=require('fs');const i=process.argv.indexOf('--output-destination');fs.writeFileSync(process.argv[i+1],${JSON.stringify(xml)})`;
  const mismatch = runRuhrohFocusValidation({ ...base, conformanceProfile: { ...PROFILE, modelSha256: "f".repeat(64) }, runner: runner("") });
  assert.equal(mismatch.status, "unavailable");
  assert.match(mismatch.blockers.join("\n"), /model hash/u);
  const timeout = runRuhrohFocusValidation({ ...base, runner: runner("setTimeout(()=>{},1000)", 100) });
  assert.equal(timeout.status, "unavailable");
  assert.match(timeout.blockers.join("\n"), /execution failed/u);
  const malformed = runRuhrohFocusValidation({ ...base, runner: runner(destinationScript("not xml")) });
  assert.equal(malformed.status, "unavailable");
  assert.match(malformed.blockers.join("\n"), /malformed/u);
  const skippedXml = '<testsuites tests="1" failures="0" errors="0" skipped="1"><testsuite><testcase name="UNREVIEWED :: Dynamic"><skipped message="private value"/></testcase></testsuite></testsuites>';
  const unexpected = runRuhrohFocusValidation({ ...base, runner: runner(destinationScript(skippedXml)) });
  assert.equal(unexpected.status, "failed");
  assert.match(unexpected.blockers.join("\n"), /unexpected skipped/u);
  assert.doesNotMatch(JSON.stringify(unexpected), /private value/u);
  const allowed = runRuhrohFocusValidation({ ...base, conformanceProfile: { ...PROFILE, allowedSkips: [{ ruleId: "UNREVIEWED", reason: "reviewed", reviewRef: REF }] }, runner: runner(destinationScript(skippedXml)) });
  assert.equal(allowed.status, "passed");
});
