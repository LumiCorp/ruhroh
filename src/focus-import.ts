import { createHash } from "node:crypto";

import { tableFromIPC, type DataType, type Decimal, type Table } from "apache-arrow";
import { readParquet } from "parquet-wasm";

import { addRuhrohDecimals, canonicalizeRuhrohDecimal, subtractRuhrohDecimals, type RuhrohBillingFactKindV2, type RuhrohNormalizedBillingRowV2 } from "./billing-v2.js";
import {
  RUHROH_FOCUS_1_4_DATASETS,
  type RuhrohFocusAttributionProfileV1,
  type RuhrohFocusCatalogV1,
  type RuhrohFocusConformanceReportV1,
  type RuhrohFocusDatasetBundleV1,
  type RuhrohFocusDatasetIdV1,
  type RuhrohFocusHashedRefV1,
  type RuhrohFocusImportReportV1,
  type RuhrohFocusMappingPackV1,
  type RuhrohFocusSpecLockV1,
} from "./focus-contracts.js";

export type RuhrohFocusDatasetInputV1 =
  | { dataset: RuhrohFocusDatasetIdV1; format: "csv"; text: string; sourceRef: RuhrohFocusHashedRefV1 }
  | { dataset: RuhrohFocusDatasetIdV1; format: "parquet"; bytes: Uint8Array; sourceRef: RuhrohFocusHashedRefV1 }
  | { dataset: RuhrohFocusDatasetIdV1; format: "records"; records: Array<Record<string, unknown>>; sourceRef: RuhrohFocusHashedRefV1 };

export interface RuhrohFocusPreservedDatasetV1 {
  dataset: RuhrohFocusDatasetIdV1;
  sourceRef: RuhrohFocusHashedRefV1;
  format: "csv" | "parquet" | "records";
  rows: Array<{ sourceRowId: string; sourceRowSha256: string; ordinal: number; record: Record<string, unknown> }>;
}

export interface RuhrohFocusImportResultV1 {
  bundle: RuhrohFocusDatasetBundleV1;
  report: RuhrohFocusImportReportV1;
  normalizedRows: RuhrohNormalizedBillingRowV2[];
  preservedDatasets: RuhrohFocusPreservedDatasetV1[];
}

export function importRuhrohFocusBundle(input: {
  bundleId: string;
  reportId: string;
  createdAt?: string | undefined;
  specLock: RuhrohFocusSpecLockV1;
  specLockRef: RuhrohFocusHashedRefV1;
  catalog: RuhrohFocusCatalogV1;
  catalogRef: RuhrohFocusHashedRefV1;
  mappingPack: RuhrohFocusMappingPackV1;
  mappingPackRef: RuhrohFocusHashedRefV1;
  bundleRef: RuhrohFocusHashedRefV1;
  conformanceReports: RuhrohFocusConformanceReportV1[];
  conformanceReportRefs: RuhrohFocusHashedRefV1[];
  datasets: RuhrohFocusDatasetInputV1[];
  attributionProfile?: RuhrohFocusAttributionProfileV1 | undefined;
  normalizedRowsRef?: RuhrohFocusHashedRefV1 | undefined;
}): RuhrohFocusImportResultV1 {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const blockers: string[] = [];
  if (input.specLock.releaseStatus !== "ratified" || input.specLock.focusVersion !== "1.4") blockers.push("runtime imports require the ratified FOCUS 1.4 profile");
  if (input.catalog.focusVersion !== input.specLock.focusVersion || input.catalog.modelRef.sha256 !== input.specLock.specification.model.sha256) blockers.push("catalog does not identify the pinned FOCUS model");
  if (input.mappingPack.specLockRef.sha256 !== input.specLockRef.sha256 || input.mappingPack.catalogRef.sha256 !== input.catalogRef.sha256) blockers.push("mapping pack references do not identify the supplied lock and catalog");
  if (input.conformanceReports.length !== input.conformanceReportRefs.length) blockers.push("conformance reports and references must have the same length");
  const inputsByDataset = new Map<RuhrohFocusDatasetIdV1, RuhrohFocusDatasetInputV1>();
  for (const source of input.datasets) {
    if (inputsByDataset.has(source.dataset)) blockers.push(`dataset ${source.dataset} is supplied more than once`);
    inputsByDataset.set(source.dataset, source);
  }
  for (const dataset of RUHROH_FOCUS_1_4_DATASETS) if (!inputsByDataset.has(dataset)) blockers.push(`dataset ${dataset} is missing`);

  const preservedDatasets: RuhrohFocusPreservedDatasetV1[] = [];
  for (const source of input.datasets) {
    const records = recordsFromInput(source);
    const actualHash = hashDatasetInput(source);
    if (actualHash !== source.sourceRef.sha256) blockers.push(`${source.dataset} source SHA-256 does not match sourceRef`);
    preservedDatasets.push({
      dataset: source.dataset,
      sourceRef: source.sourceRef,
      format: source.format,
      rows: records.map((record, index) => {
        const sourceRowSha256 = sha256Canonical(record);
        const ordinal = index + 1;
        return { sourceRowId: sha256Text(`${source.dataset}\n${source.sourceRef.sha256}\n${ordinal}\n${sourceRowSha256}`), sourceRowSha256, ordinal, record };
      }),
    });
  }

  const reportsByDataset = new Map<RuhrohFocusDatasetIdV1, RuhrohFocusConformanceReportV1>();
  for (const report of input.conformanceReports) {
    if (reportsByDataset.has(report.dataset)) blockers.push(`${report.dataset} has duplicate conformance reports`);
    reportsByDataset.set(report.dataset, report);
  }
  for (const source of input.datasets) {
    const dataset = source.dataset;
    const report = reportsByDataset.get(dataset);
    if (report === undefined) blockers.push(`${dataset} has no conformance report`);
    else {
      if (report.status !== "passed") blockers.push(`${dataset} conformance status is ${report.status}`);
      if (report.focusVersion !== input.specLock.focusVersion || report.releaseStatus !== input.specLock.releaseStatus) blockers.push(`${dataset} conformance report uses a different FOCUS profile`);
      if (report.validator.version !== input.specLock.validator.version || report.validator.commitSha !== input.specLock.validator.commitSha) blockers.push(`${dataset} conformance report uses a different validator identity`);
      if (report.inputRef.sha256 !== source.sourceRef.sha256) blockers.push(`${dataset} conformance report does not identify the supplied source bytes`);
    }
  }

  const cost = preservedDatasets.find((dataset) => dataset.dataset === "CostAndUsage");
  const normalizedRows: RuhrohNormalizedBillingRowV2[] = [];
  const rejectedOrdinals = new Set<number>();
  if (cost !== undefined) for (const row of cost.rows) {
    try { normalizedRows.push(normalizeCostRow(row, input.attributionProfile)); }
    catch (error) { rejectedOrdinals.add(row.ordinal); blockers.push(`CostAndUsage row ${row.ordinal}: ${message(error)}`); }
  }

  const relationshipCoverage = buildRelationshipCoverage(preservedDatasets);
  for (const relationship of relationshipCoverage) if (relationship.missing > 0 || relationship.ambiguous > 0) blockers.push(`${relationship.relationship} has ${relationship.missing} missing and ${relationship.ambiguous} ambiguous references`);
  const bundle: RuhrohFocusDatasetBundleV1 = {
    version: "ruhroh_focus_dataset_bundle_v1", bundleId: input.bundleId, focusVersion: "1.4", createdAt,
    datasets: preservedDatasets.map((dataset) => ({ dataset: dataset.dataset, format: dataset.format, sourceRef: dataset.sourceRef, rowCount: dataset.rows.length })).sort((a, b) => a.dataset.localeCompare(b.dataset)),
    relationships: relationshipCoverage, privacyClassification: "restricted", blockers: unique(blockers),
  };

  const catalogDatasets = new Map(input.catalog.datasets.map((dataset) => [dataset.dataset, dataset]));
  const mappingEntries = new Map(input.mappingPack.mappings.map((mapping) => [mapping.sourceColumn, mapping]));
  const datasetReports = preservedDatasets.map((dataset) => {
    const columns = unique(dataset.rows.flatMap((row) => Object.keys(row.record))).sort();
    const catalogDataset = catalogDatasets.get(dataset.dataset);
    const known = new Set(catalogDataset?.columns.map((column) => column.columnId) ?? []);
    const unknownColumns = columns.filter((column) => !known.has(column));
    if (unknownColumns.length > 0) blockers.push(`${dataset.dataset} contains unknown columns: ${unknownColumns.join(", ")}`);
    for (const column of catalogDataset?.columns ?? []) {
      if (column.requirement === "mandatory") for (const row of dataset.rows) if (row.record[column.columnId] === undefined || row.record[column.columnId] === null || row.record[column.columnId] === "") blockers.push(`${dataset.dataset} row ${row.ordinal} is missing mandatory column ${column.columnId}`);
      if (dataset.dataset === "CostAndUsage" && columns.includes(column.columnId) && !mappingEntries.has(column.columnId)) blockers.push(`${column.requirement} CostAndUsage column ${column.columnId} has no mapping disposition`);
    }
    return {
      dataset: dataset.dataset, sourceRows: dataset.rows.length,
      acceptedRows: dataset.dataset === "CostAndUsage" ? dataset.rows.length - rejectedOrdinals.size : dataset.rows.length,
      rejectedRows: dataset.dataset === "CostAndUsage" ? rejectedOrdinals.size : 0, unknownColumns,
    };
  });
  const sourceAmounts = new Map<string, string>();
  for (const row of cost?.rows ?? []) {
    const currency = stringValue(row.record.BillingCurrency);
    const amount = stringValue(row.record.BilledCost);
    if (currency === undefined || amount === undefined || !/^[A-Z]{3}$/u.test(currency)) continue;
    try { sourceAmounts.set(currency, addRuhrohDecimals(sourceAmounts.get(currency) ?? "0", canonicalizeRuhrohDecimal(amount))); }
    catch { /* the row-level normalization blocker already preserves the failure */ }
  }
  const currencies = unique([...sourceAmounts.keys(), ...normalizedRows.map((row) => row.currency)]).sort().map((currency) => {
    const sourceAmountDecimal = sourceAmounts.get(currency) ?? "0";
    const normalizedAmountDecimal = normalizedRows.filter((row) => row.currency === currency).reduce((total, row) => addRuhrohDecimals(total, row.amountDecimal), "0");
    const differenceDecimal = subtractRuhrohDecimals(normalizedAmountDecimal, sourceAmountDecimal);
    if (differenceDecimal !== "0") blockers.push(`${currency} source and normalized amounts do not reconcile exactly`);
    return { currency, sourceAmountDecimal, normalizedAmountDecimal, differenceDecimal };
  });
  const finalBlockers = unique(blockers);
  const report: RuhrohFocusImportReportV1 = {
    version: "ruhroh_focus_import_report_v1", reportId: input.reportId, createdAt, focusVersion: input.specLock.focusVersion,
    releaseStatus: input.specLock.releaseStatus, bundleRef: input.bundleRef, specLockRef: input.specLockRef, mappingPackRef: input.mappingPackRef,
    conformanceReportRefs: input.conformanceReportRefs, datasets: datasetReports.sort((a, b) => a.dataset.localeCompare(b.dataset)), currencies,
    relationshipCoverage, ...(input.normalizedRowsRef === undefined ? {} : { normalizedRowsRef: input.normalizedRowsRef }),
    readiness: finalBlockers.length === 0 ? "ready" : "review_required", blockers: finalBlockers,
  };
  return { bundle: { ...bundle, blockers: finalBlockers }, report, normalizedRows, preservedDatasets };
}

export function readRuhrohFocusParquet(bytes: Uint8Array): Array<Record<string, unknown>> {
  const wasmTable = readParquet(bytes);
  const ipc = wasmTable.intoIPCStream();
  const table = tableFromIPC(ipc);
  return arrowTableToExactRecords(table);
}

export function parseRuhrohFocusCsv(text: string): Array<Record<string, unknown>> {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? "";
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/u, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("CSV ends inside a quoted field");
  if (field.length > 0 || row.length > 0) { row.push(field.replace(/\r$/u, "")); rows.push(row); }
  const headers = rows.shift() ?? [];
  if (headers.length === 0 || new Set(headers).size !== headers.length) throw new Error("CSV header must contain unique columns");
  return rows.filter((values) => values.some((value) => value.length > 0)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] === "" ? null : values[index] ?? null])));
}

function normalizeCostRow(row: RuhrohFocusPreservedDatasetV1["rows"][number], attribution?: RuhrohFocusAttributionProfileV1): RuhrohNormalizedBillingRowV2 {
  const amount = requiredString(row.record.BilledCost, "BilledCost");
  const currency = requiredString(row.record.BillingCurrency, "BillingCurrency");
  if (!/^[A-Z]{3}$/u.test(currency)) throw new Error("BillingCurrency must be an uppercase three-letter code");
  const rawCategory = requiredString(row.record.ChargeCategory, "ChargeCategory");
  const kind = focusChargeCategoryToKind(rawCategory);
  const optional = (column: string): string | undefined => stringValue(row.record[column]);
  const attributed: Partial<RuhrohNormalizedBillingRowV2> = {};
  for (const selector of attribution?.sourceSelectors ?? []) {
    const raw = optional(selector.sourceColumn);
    if (raw === undefined) continue;
    const value = selector.transform === "sha256" ? sha256Text(raw) : selector.transform === "tag_value" ? extractTagValue(raw) : raw;
    if (selector.destination === "providerRequestId") attributed.providerRequestId = value;
    else if (selector.destination === "workloadId") attributed.workloadId = value;
    else if (selector.destination === "principalRef") attributed.principalRef = value;
    else attributed.model = value;
  }
  return {
    version: "ruhroh_normalized_billing_row_v2", sourceRowId: row.sourceRowId, sourceRowSha256: row.sourceRowSha256,
    amountDecimal: canonicalizeRuhrohDecimal(amount), currency, kind,
    ...(optional("ChargePeriodStart") === undefined ? {} : { occurredAt: optional("ChargePeriodStart") }),
    ...(optional("SkuId") === undefined ? {} : { sku: optional("SkuId") }), ...attributed,
  };
}

export function focusChargeCategoryToKind(category: string): RuhrohBillingFactKindV2 {
  if (category === "Usage" || category === "Purchase") return "charge";
  if (category === "Tax") return "tax";
  if (category === "Credit") return "credit";
  if (category === "Adjustment") return "adjustment";
  throw new Error(`unsupported ChargeCategory ${category}`);
}

function buildRelationshipCoverage(datasets: RuhrohFocusPreservedDatasetV1[]): RuhrohFocusDatasetBundleV1["relationships"] {
  const rows = (dataset: RuhrohFocusDatasetIdV1) => datasets.find((item) => item.dataset === dataset)?.rows.map((row) => row.record) ?? [];
  const costs = rows("CostAndUsage");
  const invoiceKeys = multiset(rows("InvoiceDetail"), (row) => pair(row.InvoiceId, row.InvoiceDetailId));
  const periods = multiset(rows("BillingPeriod"), (row) => triple(row.InvoiceIssuerName, row.BillingPeriodStart, row.BillingPeriodEnd));
  const commitments = multiset(rows("ContractCommitment"), (row) => pair(row.ContractId, row.ContractCommitmentId));
  return [
    relationship("cost_to_invoice_detail", costs.map((row) => pair(row.InvoiceId, row.InvoiceDetailId)).filter(nonEmpty), invoiceKeys),
    relationship("cost_to_billing_period", costs.map((row) => triple(row.InvoiceIssuerName, row.BillingPeriodStart, row.BillingPeriodEnd)).filter(nonEmpty), periods),
    relationship("cost_to_contract_commitment", costs.flatMap(contractKeys), commitments),
  ];
}

function relationship(name: RuhrohFocusDatasetBundleV1["relationships"][number]["relationship"], references: string[], targets: Map<string, number>): RuhrohFocusDatasetBundleV1["relationships"][number] {
  let matched = 0, missing = 0, ambiguous = 0;
  for (const reference of references) { const count = targets.get(reference) ?? 0; if (count === 0) missing += 1; else if (count === 1) matched += 1; else ambiguous += 1; }
  return { relationship: name, referenced: references.length, matched, missing, ambiguous };
}

function contractKeys(record: Record<string, unknown>): string[] {
  const raw = record.ContractApplied;
  if (raw === null || raw === undefined || raw === "") return [];
  let value: unknown = raw;
  if (typeof raw === "string") try { value = JSON.parse(raw) as unknown; } catch { return []; }
  const objects = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
  return objects.filter(isRecord).map((item) => pair(item.ContractId, item.ContractCommitmentId)).filter(nonEmpty);
}

function arrowTableToExactRecords(table: Table): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  for (let rowIndex = 0; rowIndex < table.numRows; rowIndex += 1) {
    const record: Record<string, unknown> = {};
    for (const field of table.schema.fields) {
      const vector = table.getChild(field.name);
      record[field.name] = arrowValue(vector?.get(rowIndex), field.type);
    }
    records.push(record);
  }
  return records;
}

function arrowValue(value: unknown, type: DataType): unknown {
  if (value === null || value === undefined) return null;
  if (isArrowDecimal(type)) return decimalFromUnscaled(exactArrowInteger(value), type.scale);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => arrowValue(item, type));
  if (isRecord(value) && !(value instanceof Uint8Array)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "bigint" ? item.toString() : item]));
  return value;
}

function isArrowDecimal(type: DataType): type is Decimal { return "scale" in type && "precision" in type && (type as { bitWidth?: unknown }).bitWidth !== undefined; }
function exactArrowInteger(value: unknown): string {
  if (!ArrayBuffer.isView(value)) return String(value);
  const words = new Uint32Array(value.buffer, value.byteOffset, value.byteLength / 4);
  let integer = 0n;
  for (let index = 0; index < words.length; index += 1) integer |= BigInt(words[index] ?? 0) << BigInt(index * 32);
  const bitWidth = BigInt(words.length * 32);
  if (((words.at(-1) ?? 0) & 0x80000000) !== 0) integer -= 1n << bitWidth;
  return integer.toString();
}
function decimalFromUnscaled(unscaled: string, scale: number): string {
  const negative = unscaled.startsWith("-");
  const digits = negative ? unscaled.slice(1) : unscaled;
  const padded = digits.padStart(scale + 1, "0");
  const value = scale === 0 ? padded : `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
  return canonicalizeRuhrohDecimal(`${negative ? "-" : ""}${value}`);
}

function recordsFromInput(input: RuhrohFocusDatasetInputV1): Array<Record<string, unknown>> {
  if (input.format === "csv") return parseRuhrohFocusCsv(input.text);
  if (input.format === "parquet") return readRuhrohFocusParquet(input.bytes);
  return input.records;
}
function hashDatasetInput(input: RuhrohFocusDatasetInputV1): string {
  if (input.format === "csv") return sha256Text(input.text);
  if (input.format === "parquet") return createHash("sha256").update(input.bytes).digest("hex");
  return sha256Canonical(input.records);
}
function multiset(records: Record<string, unknown>[], key: (record: Record<string, unknown>) => string): Map<string, number> { const result = new Map<string, number>(); for (const record of records) { const value = key(record); if (value !== "") result.set(value, (result.get(value) ?? 0) + 1); } return result; }
function pair(a: unknown, b: unknown): string { const left = stringValue(a), right = stringValue(b); return left === undefined || right === undefined ? "" : `${left}\u0000${right}`; }
function triple(a: unknown, b: unknown, c: unknown): string { const first = stringValue(a), second = stringValue(b), third = stringValue(c); return first === undefined || second === undefined || third === undefined ? "" : `${first}\u0000${second}\u0000${third}`; }
function requiredString(value: unknown, field: string): string { const result = stringValue(value); if (result === undefined) throw new Error(`${field} is required`); return result; }
function stringValue(value: unknown): string | undefined { if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") return undefined; const result = String(value).trim(); return result === "" ? undefined : result; }
function extractTagValue(value: string): string { try { const parsed = JSON.parse(value) as unknown; if (isRecord(parsed)) return String(Object.values(parsed)[0] ?? ""); } catch { /* validated as unavailable below */ } return ""; }
function sha256Canonical(value: unknown): string { return sha256Text(canonicalJson(value)); }
function sha256Text(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; if (typeof value === "bigint") return JSON.stringify(value.toString()); return JSON.stringify(value) ?? "null"; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonEmpty(value: string): boolean { return value.length > 0; }
function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
function message(error: unknown): string { return error instanceof Error ? error.message : String(error); }
