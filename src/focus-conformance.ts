import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  type RuhrohFocusConformanceProfileV1,
  type RuhrohFocusConformanceReportV1,
  type RuhrohFocusDatasetIdV1,
  type RuhrohFocusHashedRefV1,
  type RuhrohFocusRuleResultV1,
  type RuhrohFocusSpecLockV1,
} from "./focus-contracts.js";

export interface RuhrohFocusValidatorRunnerV1 {
  executable: string;
  prefixArguments: string[];
  timeoutMs: number;
  versionProbe: { executable: string; arguments: string[]; expectedOutput: string };
}

export function runRuhrohFocusValidation(input: {
  reportId: string;
  createdAt?: string | undefined;
  dataset: RuhrohFocusDatasetIdV1;
  dataFilePath: string;
  inputRef: RuhrohFocusHashedRefV1;
  modelFilePath: string;
  ruleSetPath: string;
  specLock: RuhrohFocusSpecLockV1;
  specLockRef: RuhrohFocusHashedRefV1;
  conformanceProfile: RuhrohFocusConformanceProfileV1;
  conformanceProfileRef: RuhrohFocusHashedRefV1;
  runner?: RuhrohFocusValidatorRunnerV1 | undefined;
}): RuhrohFocusConformanceReportV1 {
  const base = {
    version: "ruhroh_focus_conformance_report_v1" as const,
    reportId: input.reportId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    focusVersion: input.specLock.focusVersion,
    releaseStatus: input.specLock.releaseStatus,
    dataset: input.dataset,
    inputRef: input.inputRef,
    specLockRef: input.specLockRef,
    conformanceProfileRef: input.conformanceProfileRef,
    validator: {
      repository: input.specLock.validator.repository,
      version: input.specLock.validator.version,
      commitSha: input.specLock.validator.commitSha,
      executable: input.runner?.executable ?? "unavailable",
    },
  };
  const unavailable = (blockers: string[]): RuhrohFocusConformanceReportV1 => ({
    ...base, status: "unavailable", requirements: { evaluated: 0, passed: 0, failed: 0, skipped: 0, errors: 0 }, rules: [], blockers,
  });
  if (input.runner === undefined) return unavailable(["FOCUS validator runner is not configured"]);
  if (!existsSync(input.dataFilePath)) return unavailable(["FOCUS data file does not exist"]);
  if (!existsSync(input.modelFilePath)) return unavailable(["pinned FOCUS model file does not exist"]);
  if (!existsSync(input.ruleSetPath)) return unavailable(["packaged FOCUS rule-set directory does not exist"]);
  const modelDigest = createHash("sha256").update(readFileSync(input.modelFilePath)).digest("hex");
  if (modelDigest !== input.specLock.specification.model.sha256 || modelDigest !== input.conformanceProfile.modelSha256) return unavailable(["pinned FOCUS model hash does not match lock and conformance profile"]);
  const inputDigest = createHash("sha256").update(readFileSync(input.dataFilePath)).digest("hex");
  if (inputDigest !== input.inputRef.sha256) return unavailable(["FOCUS data file hash does not match inputRef"]);
  if (input.runner.timeoutMs < 1 || input.runner.timeoutMs > 3_600_000) return unavailable(["validator timeout must be between 1 ms and one hour"]);

  const probe = spawnSync(input.runner.versionProbe.executable, input.runner.versionProbe.arguments, { encoding: "utf8", timeout: input.runner.timeoutMs, shell: false });
  if (probe.error !== undefined || probe.status !== 0) return unavailable([`validator version probe failed: ${sanitize(probe.error?.message ?? probe.stderr ?? "unknown error")}`]);
  if (probe.stdout.trim() !== input.runner.versionProbe.expectedOutput || probe.stdout.trim() !== input.specLock.validator.version) return unavailable([`validator version probe returned ${sanitize(probe.stdout.trim()) || "empty output"}; expected ${input.specLock.validator.version}`]);

  const temporaryDirectory = mkdtempSync(join(tmpdir(), "ruhroh-focus-validator-"));
  const outputPath = join(temporaryDirectory, "result.xml");
  try {
    const applicability = input.conformanceProfile.applicabilityCriteria.length === 0 ? [] : ["--applicability-criteria", input.conformanceProfile.applicabilityCriteria.join(",")];
    const args = [
      ...input.runner.prefixArguments,
      "--data-file", input.dataFilePath,
      "--validate-version", "1.4",
      "--focus-dataset", input.dataset,
      "--rule-set-path", input.ruleSetPath,
      "--block-download",
      "--output-type", "unittest",
      "--output-destination", outputPath,
      ...applicability,
    ];
    const result = spawnSync(input.runner.executable, args, { encoding: "utf8", timeout: input.runner.timeoutMs, shell: false });
    if (result.error !== undefined || !existsSync(outputPath)) return unavailable([`validator execution failed: ${sanitize(result.error?.message ?? result.stderr ?? `exit ${result.status}`)}`]);
    let parsed: ReturnType<typeof parseRuhrohFocusJUnit>;
    try { parsed = parseRuhrohFocusJUnit(readFileSync(outputPath, "utf8")); }
    catch (error) { return unavailable([`validator output is malformed: ${sanitize(message(error))}`]); }
    const allowedSkips = new Set(input.conformanceProfile.allowedSkips.map((skip) => skip.ruleId));
    const unexpectedSkips = parsed.rules.filter((rule) => rule.status === "skipped" && !allowedSkips.has(rule.ruleId)).map((rule) => rule.ruleId);
    const blockers = [
      ...(parsed.failed > 0 ? [`${parsed.failed} FOCUS rule(s) failed`] : []),
      ...(parsed.errors > 0 ? [`${parsed.errors} FOCUS rule(s) errored`] : []),
      ...(unexpectedSkips.length > 0 ? [`unexpected skipped FOCUS rules: ${unexpectedSkips.join(", ")}`] : []),
    ];
    return {
      ...base,
      status: blockers.length === 0 ? "passed" : "failed",
      requirements: { evaluated: parsed.passed + parsed.failed, passed: parsed.passed, failed: parsed.failed, skipped: parsed.skipped, errors: parsed.errors },
      rules: parsed.rules,
      blockers,
    };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

export function parseRuhrohFocusJUnit(xml: string): { passed: number; failed: number; skipped: number; errors: number; rules: RuhrohFocusRuleResultV1[] } {
  const root = /<testsuites\b([^>]*)>/u.exec(xml);
  if (root === null || !xml.includes("</testsuites>")) throw new Error("missing testsuites root");
  const totals = attributes(root[1] ?? "");
  for (const name of ["tests", "failures", "errors", "skipped"]) if (!/^\d+$/u.test(totals[name] ?? "")) throw new Error(`testsuites.${name} is missing`);
  const rules: RuhrohFocusRuleResultV1[] = [];
  const cases = xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gu);
  for (const item of cases) {
    const attrs = attributes(item[1] ?? "");
    const name = decodeXml(attrs.name ?? "");
    const ruleId = name.split(" :: ")[0]?.trim() ?? "";
    if (!/^[A-Za-z0-9_.:-]+$/u.test(ruleId)) throw new Error("testcase has an invalid rule ID");
    const body = item[2] ?? "";
    const child = /<(failure|skipped|error)\b([^>]*)/u.exec(body);
    const status: RuhrohFocusRuleResultV1["status"] = child?.[1] === "failure" ? "failed" : child?.[1] === "error" ? "error" : child?.[1] === "skipped" ? "skipped" : "passed";
    const messageValue = child === null ? undefined : child[1] === "failure" ? "validator reported a rule failure" : child[1] === "error" ? "validator reported a rule error" : "validator skipped the rule";
    rules.push({ ruleId, status, count: 1, ...(messageValue === undefined ? {} : { message: messageValue }) });
  }
  const tests = Number(totals.tests), failed = Number(totals.failures), errors = Number(totals.errors), skipped = Number(totals.skipped);
  if (rules.length !== tests) throw new Error("testcase count does not match testsuites.tests");
  return { passed: tests - failed - errors - skipped, failed, errors, skipped, rules: rules.sort((a, b) => a.ruleId.localeCompare(b.ruleId)) };
}

function attributes(value: string): Record<string, string> { return Object.fromEntries([...value.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/gu)].map((match) => [match[1] ?? "", match[2] ?? ""])); }
function decodeXml(value: string): string { return value.replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&"); }
function sanitize(value: string): string { return value.replace(/[\r\n\t]+/gu, " ").replace(/(?:https?:\/\/|\/Users\/|[A-Za-z]:\\)[^ ]+/gu, "[redacted]").slice(0, 240).trim(); }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
