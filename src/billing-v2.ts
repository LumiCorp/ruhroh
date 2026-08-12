import { createHash } from "node:crypto";

import type { RuhrohBillingMatchClass, RuhrohTechnicalEconomicFactV1 } from "./billing.js";
import { validateRuhrohTechnicalEconomicFact } from "./billing.js";
import type { RuhrohHashedSourceRefV1 } from "./decision.js";

export type RuhrohBillingFactKindV2 =
  | "charge"
  | "credit"
  | "refund"
  | "commitment"
  | "tax"
  | "prepaid"
  | "capacity"
  | "adjustment";

export interface RuhrohBillingSourceManifestV2 {
  version: "ruhroh_billing_source_manifest_v2";
  sourceId: string;
  format: "csv" | "parquet" | "records" | "normalized_rows";
  externalSchemaVersion: string;
  billingPeriod: { startedAt: string; endedAt: string };
  currencies: string[];
  rowCount: number;
  sourceRef: RuhrohHashedSourceRefV1;
  privacyClassification: "internal" | "restricted";
}

export interface RuhrohBillingMappingProfileV2 {
  version: "ruhroh_billing_mapping_profile_v2";
  profileId: string;
  provider: string;
  externalSchemaVersion: string;
  fields: {
    sourceRowId: string;
    amountDecimal: string;
    currency: string;
    kind: string;
    occurredAt?: string | undefined;
    providerRequestId?: string | undefined;
    principalRef?: string | undefined;
    workloadId?: string | undefined;
    model?: string | undefined;
    sku?: string | undefined;
  };
  kindValues: Partial<Record<RuhrohBillingFactKindV2, string[]>>;
  matching: {
    boundedWindowSeconds: number;
    boundedFields: Array<"principalRef" | "workloadId" | "model" | "sku">;
  };
  allocations: Array<{
    sourceRowId: string;
    targets: Array<{ workloadId: string; assignedAmountDecimal: string; weightDecimal?: string | undefined }>;
  }>;
}

export interface RuhrohNormalizedBillingRowV2 {
  version: "ruhroh_normalized_billing_row_v2";
  sourceRowId: string;
  sourceRowSha256: string;
  amountDecimal: string;
  currency: string;
  kind: RuhrohBillingFactKindV2;
  occurredAt?: string | undefined;
  providerRequestId?: string | undefined;
  principalRef?: string | undefined;
  workloadId?: string | undefined;
  model?: string | undefined;
  sku?: string | undefined;
}

export interface RuhrohBillingJoinV2 {
  sourceRowId: string;
  sourceRowSha256: string;
  matchClass: RuhrohBillingMatchClass;
  currency: string;
  kind: RuhrohBillingFactKindV2;
  sourceAmountDecimal: string;
  assignedAmountDecimal: string;
  weightDecimal?: string | undefined;
  technicalFactIds: string[];
  workloadIds: string[];
  reason: string;
}

export interface RuhrohReconciliationCurrencySummaryV2 {
  currency: string;
  sourceTotalDecimal: string;
  assignedTotalDecimal: string;
  differenceDecimal: string;
  byMatchClass: Record<RuhrohBillingMatchClass, string>;
  byFactKind: Record<RuhrohBillingFactKindV2, string>;
}

export interface RuhrohCostReconciliationV2 {
  version: "ruhroh_cost_reconciliation_v2";
  reconciliationId: string;
  createdAt: string;
  benchmarkClaimRef: RuhrohHashedSourceRefV1;
  billingSourceRef: RuhrohHashedSourceRefV1;
  mappingProfileRef: RuhrohHashedSourceRefV1;
  source: {
    sourceId: string;
    billingPeriod: RuhrohBillingSourceManifestV2["billingPeriod"];
    rowCount: number;
  };
  joins: RuhrohBillingJoinV2[];
  currencies: RuhrohReconciliationCurrencySummaryV2[];
  coverage: {
    exactRows: number;
    boundedRows: number;
    allocatedRows: number;
    ambiguousRows: number;
    unmatchedRows: number;
  };
  ready: boolean;
  blockers: string[];
  unsupportedConcepts: string[];
}

interface ExactDecimal {
  coefficient: bigint;
  scale: number;
}

export function canonicalizeRuhrohDecimal(value: string): string {
  return formatDecimal(parseDecimal(value));
}

export function addRuhrohDecimals(left: string, right: string): string {
  return formatDecimal(addDecimal(parseDecimal(left), parseDecimal(right)));
}

export function subtractRuhrohDecimals(left: string, right: string): string {
  const parsed = parseDecimal(right);
  return formatDecimal(addDecimal(parseDecimal(left), { coefficient: -parsed.coefficient, scale: parsed.scale }));
}

export function compareRuhrohDecimals(left: string, right: string): -1 | 0 | 1 {
  const difference = parseDecimal(subtractRuhrohDecimals(left, right)).coefficient;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function normalizeRuhrohBillingRecordsV2(
  records: Iterable<Record<string, unknown>>,
  profile: RuhrohBillingMappingProfileV2,
): { rows: RuhrohNormalizedBillingRowV2[]; errors: string[] } {
  const errors = validateRuhrohBillingMappingProfileV2(profile);
  const rows: RuhrohNormalizedBillingRowV2[] = [];
  for (const [index, record] of [...records].entries()) {
    const sourceRowId = stringValue(record[profile.fields.sourceRowId]);
    const rawAmount = record[profile.fields.amountDecimal];
    const currency = stringValue(record[profile.fields.currency]);
    const rawKind = stringValue(record[profile.fields.kind]);
    const kind = rawKind === undefined ? undefined : resolveKind(rawKind, profile.kindValues);
    let amountDecimal: string | undefined;
    if (typeof rawAmount !== "string") errors.push(`records[${index}] amount must be a decimal string`);
    else {
      try { amountDecimal = canonicalizeRuhrohDecimal(rawAmount); }
      catch (error) { errors.push(`records[${index}] has invalid amount: ${message(error)}`); }
    }
    if (sourceRowId === undefined) errors.push(`records[${index}] is missing sourceRowId`);
    if (currency === undefined || !/^[A-Z]{3}$/u.test(currency)) errors.push(`records[${index}] has invalid currency`);
    if (kind === undefined) errors.push(`records[${index}] has unmapped billing fact kind`);
    if (sourceRowId === undefined || amountDecimal === undefined || currency === undefined || kind === undefined) continue;
    const optional = (field: keyof RuhrohBillingMappingProfileV2["fields"]): string | undefined => {
      const sourceField = profile.fields[field];
      return sourceField === undefined ? undefined : stringValue(record[sourceField]);
    };
    rows.push({
      version: "ruhroh_normalized_billing_row_v2",
      sourceRowId,
      sourceRowSha256: sha256Canonical(record),
      amountDecimal,
      currency,
      kind,
      ...optionalProperties(optional),
    });
  }
  const ids = new Set<string>();
  for (const row of rows) {
    if (ids.has(row.sourceRowId)) errors.push(`duplicate sourceRowId ${row.sourceRowId}`);
    ids.add(row.sourceRowId);
  }
  return { rows, errors: unique(errors) };
}

export function buildRuhrohCostReconciliationV2(input: {
  reconciliationId: string;
  createdAt?: string | undefined;
  benchmarkClaimRef: RuhrohHashedSourceRefV1;
  billingSource: RuhrohBillingSourceManifestV2;
  billingSourceRef: RuhrohHashedSourceRefV1;
  mappingProfile: RuhrohBillingMappingProfileV2;
  mappingProfileRef: RuhrohHashedSourceRefV1;
  billingRows: readonly RuhrohNormalizedBillingRowV2[];
  technicalFacts: readonly RuhrohTechnicalEconomicFactV1[];
}): RuhrohCostReconciliationV2 {
  const blockers = [
    ...validateRuhrohBillingSourceManifestV2(input.billingSource),
    ...validateRuhrohBillingMappingProfileV2(input.mappingProfile),
    ...validateRef(input.benchmarkClaimRef, "benchmarkClaimRef"),
    ...validateRef(input.billingSourceRef, "billingSourceRef"),
    ...validateRef(input.mappingProfileRef, "mappingProfileRef"),
    ...input.billingRows.flatMap((row, index) => validateRuhrohNormalizedBillingRowV2(row).map((error) => `billingRows[${index}]: ${error}`)),
    ...input.technicalFacts.flatMap((fact, index) => validateRuhrohTechnicalEconomicFact(fact).map((error) => `technicalFacts[${index}]: ${error}`)),
  ];
  if (input.billingSource.rowCount !== input.billingRows.length) blockers.push("billing source rowCount does not match normalized rows");
  const observedCurrencies = unique(input.billingRows.map((row) => row.currency)).sort();
  if (JSON.stringify([...input.billingSource.currencies].sort()) !== JSON.stringify(observedCurrencies)) blockers.push("declared currencies do not match normalized rows");

  const allocationByRow = new Map(input.mappingProfile.allocations.map((allocation) => [allocation.sourceRowId, allocation]));
  const joins = input.billingRows.flatMap((row) => reconcileRow(row, input.technicalFacts, allocationByRow.get(row.sourceRowId), input.mappingProfile, blockers));
  const currencies = observedCurrencies.map((currency) => currencySummary(currency, input.billingRows, joins, blockers));
  const rowClasses = new Map<string, RuhrohBillingMatchClass>();
  for (const join of joins) rowClasses.set(join.sourceRowId, join.matchClass);
  const count = (matchClass: RuhrohBillingMatchClass): number => [...rowClasses.values()].filter((value) => value === matchClass).length;
  if (count("ambiguous") + count("unmatched") > 0) blockers.push(`${count("ambiguous") + count("unmatched")} billing row(s) remain ambiguous or unmatched`);
  const coverage = {
    exactRows: count("exact"), boundedRows: count("bounded"), allocatedRows: count("allocated"),
    ambiguousRows: count("ambiguous"), unmatchedRows: count("unmatched"),
  };
  return {
    version: "ruhroh_cost_reconciliation_v2",
    reconciliationId: input.reconciliationId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    benchmarkClaimRef: input.benchmarkClaimRef,
    billingSourceRef: input.billingSourceRef,
    mappingProfileRef: input.mappingProfileRef,
    source: { sourceId: input.billingSource.sourceId, billingPeriod: input.billingSource.billingPeriod, rowCount: input.billingSource.rowCount },
    joins,
    currencies,
    coverage,
    ready: unique(blockers).length === 0,
    blockers: unique(blockers),
    unsupportedConcepts: ["foreign_exchange_conversion", "cross_currency_blended_total", "implicit_billing_fact_inference", "raw_billing_publication"],
  };
}

export function validateRuhrohBillingSourceManifestV2(value: RuhrohBillingSourceManifestV2): string[] {
  const errors: string[] = [];
  if (value.version !== "ruhroh_billing_source_manifest_v2") errors.push("version must be ruhroh_billing_source_manifest_v2");
  if (!nonEmpty(value.sourceId) || !nonEmpty(value.externalSchemaVersion)) errors.push("sourceId and externalSchemaVersion are required");
  if (!["csv", "parquet", "records", "normalized_rows"].includes(value.format)) errors.push("format is unsupported");
  if (!(Date.parse(value.billingPeriod.startedAt) < Date.parse(value.billingPeriod.endedAt))) errors.push("billingPeriod must have an end after its start");
  if (!Number.isInteger(value.rowCount) || value.rowCount < 0) errors.push("rowCount must be a non-negative integer");
  if (new Set(value.currencies).size !== value.currencies.length || value.currencies.some((currency) => !/^[A-Z]{3}$/u.test(currency))) errors.push("currencies must be unique uppercase three-letter codes");
  if (!["internal", "restricted"].includes(value.privacyClassification)) errors.push("raw billing sources cannot be public");
  errors.push(...validateRef(value.sourceRef, "sourceRef"));
  return unique(errors);
}

export function validateRuhrohBillingMappingProfileV2(value: RuhrohBillingMappingProfileV2): string[] {
  const errors: string[] = [];
  if (value.version !== "ruhroh_billing_mapping_profile_v2") errors.push("version must be ruhroh_billing_mapping_profile_v2");
  if (!nonEmpty(value.profileId) || !nonEmpty(value.provider) || !nonEmpty(value.externalSchemaVersion)) errors.push("profile identity is incomplete");
  for (const field of ["sourceRowId", "amountDecimal", "currency", "kind"] as const) if (!nonEmpty(value.fields[field])) errors.push(`fields.${field} is required`);
  if (!Number.isFinite(value.matching.boundedWindowSeconds) || value.matching.boundedWindowSeconds < 0) errors.push("boundedWindowSeconds must be non-negative");
  const allocationIds = new Set<string>();
  for (const allocation of value.allocations) {
    if (!nonEmpty(allocation.sourceRowId) || allocationIds.has(allocation.sourceRowId)) errors.push(`allocation ${allocation.sourceRowId} is invalid or duplicated`);
    allocationIds.add(allocation.sourceRowId);
    if (allocation.targets.length === 0 || new Set(allocation.targets.map((target) => target.workloadId)).size !== allocation.targets.length) errors.push(`allocation ${allocation.sourceRowId} requires unique targets`);
    for (const target of allocation.targets) {
      if (!nonEmpty(target.workloadId)) errors.push(`allocation ${allocation.sourceRowId} target workloadId is required`);
      try { canonicalizeRuhrohDecimal(target.assignedAmountDecimal); }
      catch (error) { errors.push(`allocation ${allocation.sourceRowId} has invalid assigned amount: ${message(error)}`); }
      if (target.weightDecimal !== undefined) {
        try { canonicalizeRuhrohDecimal(target.weightDecimal); } catch (error) { errors.push(`allocation ${allocation.sourceRowId} has invalid explanatory weight: ${message(error)}`); }
      }
    }
  }
  const owners = new Map<string, RuhrohBillingFactKindV2>();
  for (const kind of FACT_KINDS_V2) for (const raw of value.kindValues[kind] ?? []) {
    const prior = owners.get(raw);
    if (!nonEmpty(raw) || (prior !== undefined && prior !== kind)) errors.push(`kind value ${raw} is invalid or mapped more than once`);
    owners.set(raw, kind);
  }
  return unique(errors);
}

export function validateRuhrohNormalizedBillingRowV2(value: RuhrohNormalizedBillingRowV2): string[] {
  const errors: string[] = [];
  if (value.version !== "ruhroh_normalized_billing_row_v2") errors.push("version must be ruhroh_normalized_billing_row_v2");
  if (!nonEmpty(value.sourceRowId) || !sha256(value.sourceRowSha256)) errors.push("source row identity is invalid");
  try { if (canonicalizeRuhrohDecimal(value.amountDecimal) !== value.amountDecimal) errors.push("amountDecimal must be canonical"); } catch (error) { errors.push(`amountDecimal is invalid: ${message(error)}`); }
  if (!/^[A-Z]{3}$/u.test(value.currency)) errors.push("currency must be an uppercase three-letter code");
  if (!FACT_KINDS_V2.includes(value.kind)) errors.push("kind is unsupported");
  if (value.occurredAt !== undefined && !Number.isFinite(Date.parse(value.occurredAt))) errors.push("occurredAt must be a timestamp");
  return unique(errors);
}

export function validateRuhrohCostReconciliationV2(value: RuhrohCostReconciliationV2): string[] {
  const errors: string[] = [];
  if (value.version !== "ruhroh_cost_reconciliation_v2") errors.push("version must be ruhroh_cost_reconciliation_v2");
  if (!nonEmpty(value.reconciliationId) || !Number.isFinite(Date.parse(value.createdAt))) errors.push("reconciliation identity is invalid");
  errors.push(...validateRef(value.benchmarkClaimRef, "benchmarkClaimRef"), ...validateRef(value.billingSourceRef, "billingSourceRef"), ...validateRef(value.mappingProfileRef, "mappingProfileRef"));
  for (const summary of value.currencies) {
    try {
      if (subtractRuhrohDecimals(summary.assignedTotalDecimal, summary.sourceTotalDecimal) !== summary.differenceDecimal) errors.push(`${summary.currency} difference is inconsistent`);
      if (summary.differenceDecimal !== "0") errors.push(`${summary.currency} assigned total does not equal source total`);
    } catch (error) { errors.push(`${summary.currency} totals are invalid: ${message(error)}`); }
  }
  const shouldBeReady = errors.length === 0 && value.blockers.length === 0 && value.coverage.ambiguousRows === 0 && value.coverage.unmatchedRows === 0;
  if (value.ready !== shouldBeReady) errors.push(`ready must be ${shouldBeReady}`);
  return unique(errors);
}

function reconcileRow(
  row: RuhrohNormalizedBillingRowV2,
  facts: readonly RuhrohTechnicalEconomicFactV1[],
  allocation: RuhrohBillingMappingProfileV2["allocations"][number] | undefined,
  profile: RuhrohBillingMappingProfileV2,
  blockers: string[],
): RuhrohBillingJoinV2[] {
  if (allocation !== undefined) {
    const assigned = sumDecimals(allocation.targets.map((target) => target.assignedAmountDecimal));
    if (assigned !== row.amountDecimal) blockers.push(`allocation ${row.sourceRowId} assigned amount ${assigned} does not equal source ${row.amountDecimal}`);
    return allocation.targets.map((target) => ({
      sourceRowId: row.sourceRowId, sourceRowSha256: row.sourceRowSha256, matchClass: "allocated", currency: row.currency, kind: row.kind,
      sourceAmountDecimal: row.amountDecimal, assignedAmountDecimal: canonicalizeRuhrohDecimal(target.assignedAmountDecimal),
      ...(target.weightDecimal === undefined ? {} : { weightDecimal: canonicalizeRuhrohDecimal(target.weightDecimal) }),
      technicalFactIds: facts.filter((fact) => fact.workloadId === target.workloadId).map((fact) => fact.factId).sort(), workloadIds: [target.workloadId], reason: "predeclared exact allocation",
    }));
  }
  const exact = row.providerRequestId === undefined ? [] : facts.filter((fact) => fact.providerRequestIdHash === sha256Text(row.providerRequestId ?? ""));
  if (exact.length === 1) return [joined(row, "exact", exact, "unique provider request identifier hash")];
  if (exact.length > 1) return [joined(row, "ambiguous", exact, "provider request identifier matched multiple facts")];
  const bounded = facts.filter((fact) => boundedMatch(row, fact, profile));
  if (bounded.length === 1) return [joined(row, "bounded", bounded, "unique bounded identity and time-window match")];
  if (bounded.length > 1) return [joined(row, "ambiguous", bounded, "bounded match returned multiple facts")];
  return [joined(row, "unmatched", [], "no exact, bounded, or allocation match")];
}

function joined(row: RuhrohNormalizedBillingRowV2, matchClass: RuhrohBillingMatchClass, facts: readonly RuhrohTechnicalEconomicFactV1[], reason: string): RuhrohBillingJoinV2 {
  return {
    sourceRowId: row.sourceRowId, sourceRowSha256: row.sourceRowSha256, matchClass, currency: row.currency, kind: row.kind,
    sourceAmountDecimal: row.amountDecimal, assignedAmountDecimal: row.amountDecimal,
    technicalFactIds: facts.map((fact) => fact.factId).sort(), workloadIds: unique(facts.map((fact) => fact.workloadId)).sort(), reason,
  };
}

function boundedMatch(row: RuhrohNormalizedBillingRowV2, fact: RuhrohTechnicalEconomicFactV1, profile: RuhrohBillingMappingProfileV2): boolean {
  if (row.occurredAt === undefined) return false;
  const delta = Math.abs(Date.parse(row.occurredAt) - Date.parse(fact.occurredAt));
  if (!Number.isFinite(delta) || delta > profile.matching.boundedWindowSeconds * 1000) return false;
  return profile.matching.boundedFields.length > 0 && profile.matching.boundedFields.every((field) => row[field] !== undefined && row[field] === fact[field]);
}

function currencySummary(currency: string, rows: readonly RuhrohNormalizedBillingRowV2[], joins: readonly RuhrohBillingJoinV2[], blockers: string[]): RuhrohReconciliationCurrencySummaryV2 {
  const sourceRows = rows.filter((row) => row.currency === currency);
  const currencyJoins = joins.filter((join) => join.currency === currency);
  const sourceTotalDecimal = sumDecimals(sourceRows.map((row) => row.amountDecimal));
  const assignedTotalDecimal = sumDecimals(currencyJoins.map((join) => join.assignedAmountDecimal));
  const differenceDecimal = subtractRuhrohDecimals(assignedTotalDecimal, sourceTotalDecimal);
  if (differenceDecimal !== "0") blockers.push(`${currency} reconciliation differs from source by ${differenceDecimal}`);
  return {
    currency, sourceTotalDecimal, assignedTotalDecimal, differenceDecimal,
    byMatchClass: Object.fromEntries(MATCH_CLASSES.map((matchClass) => [matchClass, sumDecimals(currencyJoins.filter((join) => join.matchClass === matchClass).map((join) => join.assignedAmountDecimal))])) as Record<RuhrohBillingMatchClass, string>,
    byFactKind: Object.fromEntries(FACT_KINDS_V2.map((kind) => [kind, sumDecimals(sourceRows.filter((row) => row.kind === kind).map((row) => row.amountDecimal))])) as Record<RuhrohBillingFactKindV2, string>,
  };
}

function parseDecimal(value: string): ExactDecimal {
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/u.exec(value.trim());
  if (match === null) throw new Error("expected a finite base-10 decimal string");
  const sign = match[1] === "-" ? -1n : 1n;
  const integer = match[2] ?? "0";
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100_000) throw new Error("decimal exponent is out of range");
  let coefficient = sign * BigInt(`${integer}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) { coefficient *= 10n ** BigInt(-scale); scale = 0; }
  return normalizeDecimal({ coefficient, scale });
}

function normalizeDecimal(value: ExactDecimal): ExactDecimal {
  if (value.coefficient === 0n) return { coefficient: 0n, scale: 0 };
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) { coefficient /= 10n; scale -= 1; }
  return { coefficient, scale };
}

function formatDecimal(value: ExactDecimal): string {
  const normalized = normalizeDecimal(value);
  if (normalized.coefficient === 0n) return "0";
  const negative = normalized.coefficient < 0n;
  const digits = (negative ? -normalized.coefficient : normalized.coefficient).toString();
  if (normalized.scale === 0) return `${negative ? "-" : ""}${digits}`;
  const padded = digits.padStart(normalized.scale + 1, "0");
  return `${negative ? "-" : ""}${padded.slice(0, -normalized.scale)}.${padded.slice(-normalized.scale)}`;
}

function addDecimal(left: ExactDecimal, right: ExactDecimal): ExactDecimal {
  const scale = Math.max(left.scale, right.scale);
  return normalizeDecimal({ coefficient: left.coefficient * 10n ** BigInt(scale - left.scale) + right.coefficient * 10n ** BigInt(scale - right.scale), scale });
}

function sumDecimals(values: readonly string[]): string { return values.reduce(addRuhrohDecimals, "0"); }
function resolveKind(raw: string, values: RuhrohBillingMappingProfileV2["kindValues"]): RuhrohBillingFactKindV2 | undefined { return FACT_KINDS_V2.find((kind) => (values[kind] ?? []).includes(raw)); }
function optionalProperties(optional: (field: keyof RuhrohBillingMappingProfileV2["fields"]) => string | undefined): Partial<RuhrohNormalizedBillingRowV2> {
  const result: Partial<RuhrohNormalizedBillingRowV2> = {};
  for (const field of ["occurredAt", "providerRequestId", "principalRef", "workloadId", "model", "sku"] as const) {
    const value = optional(field);
    if (value !== undefined) result[field] = value;
  }
  return result;
}
const FACT_KINDS_V2: RuhrohBillingFactKindV2[] = ["charge", "credit", "refund", "commitment", "tax", "prepaid", "capacity", "adjustment"];
const MATCH_CLASSES: RuhrohBillingMatchClass[] = ["exact", "bounded", "allocated", "ambiguous", "unmatched"];
function sha256Canonical(value: unknown): string { return sha256Text(canonicalJson(value)); }
function sha256Text(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  return JSON.stringify(value) ?? "null";
}
function stringValue(value: unknown): string | undefined { const result = typeof value === "string" ? value.trim() : ""; return result.length === 0 ? undefined : result; }
function validateRef(value: RuhrohHashedSourceRefV1, label: string): string[] { return [...(!nonEmpty(value?.path) ? [`${label}.path is required`] : []), ...(!sha256(value?.sha256) ? [`${label}.sha256 must be lowercase SHA-256`] : [])]; }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function sha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
