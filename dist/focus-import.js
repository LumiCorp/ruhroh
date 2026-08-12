import { createHash } from "node:crypto";
import { tableFromIPC } from "apache-arrow";
import { readParquet } from "parquet-wasm";
import { addRuhrohDecimals, canonicalizeRuhrohDecimal, subtractRuhrohDecimals } from "./billing-v2.js";
import { RUHROH_FOCUS_1_4_DATASETS, } from "./focus-contracts.js";
export function importRuhrohFocusBundle(input) {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const blockers = [];
    if (input.specLock.releaseStatus !== "ratified" || input.specLock.focusVersion !== "1.4")
        blockers.push("runtime imports require the ratified FOCUS 1.4 profile");
    if (input.catalog.focusVersion !== input.specLock.focusVersion || input.catalog.modelRef.sha256 !== input.specLock.specification.model.sha256)
        blockers.push("catalog does not identify the pinned FOCUS model");
    if (input.mappingPack.specLockRef.sha256 !== input.specLockRef.sha256 || input.mappingPack.catalogRef.sha256 !== input.catalogRef.sha256)
        blockers.push("mapping pack references do not identify the supplied lock and catalog");
    if (input.conformanceReports.length !== input.conformanceReportRefs.length)
        blockers.push("conformance reports and references must have the same length");
    const inputsByDataset = new Map();
    for (const source of input.datasets) {
        if (inputsByDataset.has(source.dataset))
            blockers.push(`dataset ${source.dataset} is supplied more than once`);
        inputsByDataset.set(source.dataset, source);
    }
    for (const dataset of RUHROH_FOCUS_1_4_DATASETS)
        if (!inputsByDataset.has(dataset))
            blockers.push(`dataset ${dataset} is missing`);
    const preservedDatasets = [];
    for (const source of input.datasets) {
        const records = recordsFromInput(source);
        const actualHash = hashDatasetInput(source);
        if (actualHash !== source.sourceRef.sha256)
            blockers.push(`${source.dataset} source SHA-256 does not match sourceRef`);
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
    const reportsByDataset = new Map();
    for (const report of input.conformanceReports) {
        if (reportsByDataset.has(report.dataset))
            blockers.push(`${report.dataset} has duplicate conformance reports`);
        reportsByDataset.set(report.dataset, report);
    }
    for (const source of input.datasets) {
        const dataset = source.dataset;
        const report = reportsByDataset.get(dataset);
        if (report === undefined)
            blockers.push(`${dataset} has no conformance report`);
        else {
            if (report.status !== "passed")
                blockers.push(`${dataset} conformance status is ${report.status}`);
            if (report.focusVersion !== input.specLock.focusVersion || report.releaseStatus !== input.specLock.releaseStatus)
                blockers.push(`${dataset} conformance report uses a different FOCUS profile`);
            if (report.validator.version !== input.specLock.validator.version || report.validator.commitSha !== input.specLock.validator.commitSha)
                blockers.push(`${dataset} conformance report uses a different validator identity`);
            if (report.inputRef.sha256 !== source.sourceRef.sha256)
                blockers.push(`${dataset} conformance report does not identify the supplied source bytes`);
        }
    }
    const cost = preservedDatasets.find((dataset) => dataset.dataset === "CostAndUsage");
    const normalizedRows = [];
    const rejectedOrdinals = new Set();
    if (cost !== undefined)
        for (const row of cost.rows) {
            try {
                normalizedRows.push(normalizeCostRow(row, input.attributionProfile));
            }
            catch (error) {
                rejectedOrdinals.add(row.ordinal);
                blockers.push(`CostAndUsage row ${row.ordinal}: ${message(error)}`);
            }
        }
    const relationshipCoverage = buildRelationshipCoverage(preservedDatasets);
    for (const relationship of relationshipCoverage)
        if (relationship.missing > 0 || relationship.ambiguous > 0)
            blockers.push(`${relationship.relationship} has ${relationship.missing} missing and ${relationship.ambiguous} ambiguous references`);
    const bundle = {
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
        if (unknownColumns.length > 0)
            blockers.push(`${dataset.dataset} contains unknown columns: ${unknownColumns.join(", ")}`);
        for (const column of catalogDataset?.columns ?? []) {
            if (column.requirement === "mandatory")
                for (const row of dataset.rows)
                    if (row.record[column.columnId] === undefined || row.record[column.columnId] === null || row.record[column.columnId] === "")
                        blockers.push(`${dataset.dataset} row ${row.ordinal} is missing mandatory column ${column.columnId}`);
            if (dataset.dataset === "CostAndUsage" && columns.includes(column.columnId) && !mappingEntries.has(column.columnId))
                blockers.push(`${column.requirement} CostAndUsage column ${column.columnId} has no mapping disposition`);
        }
        return {
            dataset: dataset.dataset, sourceRows: dataset.rows.length,
            acceptedRows: dataset.dataset === "CostAndUsage" ? dataset.rows.length - rejectedOrdinals.size : dataset.rows.length,
            rejectedRows: dataset.dataset === "CostAndUsage" ? rejectedOrdinals.size : 0, unknownColumns,
        };
    });
    const sourceAmounts = new Map();
    for (const row of cost?.rows ?? []) {
        const currency = stringValue(row.record.BillingCurrency);
        const amount = stringValue(row.record.BilledCost);
        if (currency === undefined || amount === undefined || !/^[A-Z]{3}$/u.test(currency))
            continue;
        try {
            sourceAmounts.set(currency, addRuhrohDecimals(sourceAmounts.get(currency) ?? "0", canonicalizeRuhrohDecimal(amount)));
        }
        catch { /* the row-level normalization blocker already preserves the failure */ }
    }
    const currencies = unique([...sourceAmounts.keys(), ...normalizedRows.map((row) => row.currency)]).sort().map((currency) => {
        const sourceAmountDecimal = sourceAmounts.get(currency) ?? "0";
        const normalizedAmountDecimal = normalizedRows.filter((row) => row.currency === currency).reduce((total, row) => addRuhrohDecimals(total, row.amountDecimal), "0");
        const differenceDecimal = subtractRuhrohDecimals(normalizedAmountDecimal, sourceAmountDecimal);
        if (differenceDecimal !== "0")
            blockers.push(`${currency} source and normalized amounts do not reconcile exactly`);
        return { currency, sourceAmountDecimal, normalizedAmountDecimal, differenceDecimal };
    });
    const finalBlockers = unique(blockers);
    const report = {
        version: "ruhroh_focus_import_report_v1", reportId: input.reportId, createdAt, focusVersion: input.specLock.focusVersion,
        releaseStatus: input.specLock.releaseStatus, bundleRef: input.bundleRef, specLockRef: input.specLockRef, mappingPackRef: input.mappingPackRef,
        conformanceReportRefs: input.conformanceReportRefs, datasets: datasetReports.sort((a, b) => a.dataset.localeCompare(b.dataset)), currencies,
        relationshipCoverage, ...(input.normalizedRowsRef === undefined ? {} : { normalizedRowsRef: input.normalizedRowsRef }),
        readiness: finalBlockers.length === 0 ? "ready" : "review_required", blockers: finalBlockers,
    };
    return { bundle: { ...bundle, blockers: finalBlockers }, report, normalizedRows, preservedDatasets };
}
export function readRuhrohFocusParquet(bytes) {
    const wasmTable = readParquet(bytes);
    const ipc = wasmTable.intoIPCStream();
    const table = tableFromIPC(ipc);
    return arrowTableToExactRecords(table);
}
export function parseRuhrohFocusCsv(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index] ?? "";
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index += 1;
            }
            else if (character === '"')
                quoted = false;
            else
                field += character;
        }
        else if (character === '"')
            quoted = true;
        else if (character === ",") {
            row.push(field);
            field = "";
        }
        else if (character === "\n") {
            row.push(field.replace(/\r$/u, ""));
            rows.push(row);
            row = [];
            field = "";
        }
        else
            field += character;
    }
    if (quoted)
        throw new Error("CSV ends inside a quoted field");
    if (field.length > 0 || row.length > 0) {
        row.push(field.replace(/\r$/u, ""));
        rows.push(row);
    }
    const headers = rows.shift() ?? [];
    if (headers.length === 0 || new Set(headers).size !== headers.length)
        throw new Error("CSV header must contain unique columns");
    return rows.filter((values) => values.some((value) => value.length > 0)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] === "" ? null : values[index] ?? null])));
}
function normalizeCostRow(row, attribution) {
    const amount = requiredString(row.record.BilledCost, "BilledCost");
    const currency = requiredString(row.record.BillingCurrency, "BillingCurrency");
    if (!/^[A-Z]{3}$/u.test(currency))
        throw new Error("BillingCurrency must be an uppercase three-letter code");
    const rawCategory = requiredString(row.record.ChargeCategory, "ChargeCategory");
    const kind = focusChargeCategoryToKind(rawCategory);
    const optional = (column) => stringValue(row.record[column]);
    const attributed = {};
    for (const selector of attribution?.sourceSelectors ?? []) {
        const raw = optional(selector.sourceColumn);
        if (raw === undefined)
            continue;
        const value = selector.transform === "sha256" ? sha256Text(raw) : selector.transform === "tag_value" ? extractTagValue(raw) : raw;
        if (selector.destination === "providerRequestId")
            attributed.providerRequestId = value;
        else if (selector.destination === "workloadId")
            attributed.workloadId = value;
        else if (selector.destination === "principalRef")
            attributed.principalRef = value;
        else
            attributed.model = value;
    }
    return {
        version: "ruhroh_normalized_billing_row_v2", sourceRowId: row.sourceRowId, sourceRowSha256: row.sourceRowSha256,
        amountDecimal: canonicalizeRuhrohDecimal(amount), currency, kind,
        ...(optional("ChargePeriodStart") === undefined ? {} : { occurredAt: optional("ChargePeriodStart") }),
        ...(optional("SkuId") === undefined ? {} : { sku: optional("SkuId") }), ...attributed,
    };
}
export function focusChargeCategoryToKind(category) {
    if (category === "Usage" || category === "Purchase")
        return "charge";
    if (category === "Tax")
        return "tax";
    if (category === "Credit")
        return "credit";
    if (category === "Adjustment")
        return "adjustment";
    throw new Error(`unsupported ChargeCategory ${category}`);
}
function buildRelationshipCoverage(datasets) {
    const rows = (dataset) => datasets.find((item) => item.dataset === dataset)?.rows.map((row) => row.record) ?? [];
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
function relationship(name, references, targets) {
    let matched = 0, missing = 0, ambiguous = 0;
    for (const reference of references) {
        const count = targets.get(reference) ?? 0;
        if (count === 0)
            missing += 1;
        else if (count === 1)
            matched += 1;
        else
            ambiguous += 1;
    }
    return { relationship: name, referenced: references.length, matched, missing, ambiguous };
}
function contractKeys(record) {
    const raw = record.ContractApplied;
    if (raw === null || raw === undefined || raw === "")
        return [];
    let value = raw;
    if (typeof raw === "string")
        try {
            value = JSON.parse(raw);
        }
        catch {
            return [];
        }
    const objects = Array.isArray(value) ? value : isRecord(value) ? [value] : [];
    return objects.filter(isRecord).map((item) => pair(item.ContractId, item.ContractCommitmentId)).filter(nonEmpty);
}
function arrowTableToExactRecords(table) {
    const records = [];
    for (let rowIndex = 0; rowIndex < table.numRows; rowIndex += 1) {
        const record = {};
        for (const field of table.schema.fields) {
            const vector = table.getChild(field.name);
            record[field.name] = arrowValue(vector?.get(rowIndex), field.type);
        }
        records.push(record);
    }
    return records;
}
function arrowValue(value, type) {
    if (value === null || value === undefined)
        return null;
    if (isArrowDecimal(type))
        return decimalFromUnscaled(exactArrowInteger(value), type.scale);
    if (typeof value === "bigint")
        return value.toString();
    if (value instanceof Date)
        return value.toISOString();
    if (Array.isArray(value))
        return value.map((item) => arrowValue(item, type));
    if (isRecord(value) && !(value instanceof Uint8Array))
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === "bigint" ? item.toString() : item]));
    return value;
}
function isArrowDecimal(type) { return "scale" in type && "precision" in type && type.bitWidth !== undefined; }
function exactArrowInteger(value) {
    if (!ArrayBuffer.isView(value))
        return String(value);
    const words = new Uint32Array(value.buffer, value.byteOffset, value.byteLength / 4);
    let integer = 0n;
    for (let index = 0; index < words.length; index += 1)
        integer |= BigInt(words[index] ?? 0) << BigInt(index * 32);
    const bitWidth = BigInt(words.length * 32);
    if (((words.at(-1) ?? 0) & 0x80000000) !== 0)
        integer -= 1n << bitWidth;
    return integer.toString();
}
function decimalFromUnscaled(unscaled, scale) {
    const negative = unscaled.startsWith("-");
    const digits = negative ? unscaled.slice(1) : unscaled;
    const padded = digits.padStart(scale + 1, "0");
    const value = scale === 0 ? padded : `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
    return canonicalizeRuhrohDecimal(`${negative ? "-" : ""}${value}`);
}
function recordsFromInput(input) {
    if (input.format === "csv")
        return parseRuhrohFocusCsv(input.text);
    if (input.format === "parquet")
        return readRuhrohFocusParquet(input.bytes);
    return input.records;
}
function hashDatasetInput(input) {
    if (input.format === "csv")
        return sha256Text(input.text);
    if (input.format === "parquet")
        return createHash("sha256").update(input.bytes).digest("hex");
    return sha256Canonical(input.records);
}
function multiset(records, key) { const result = new Map(); for (const record of records) {
    const value = key(record);
    if (value !== "")
        result.set(value, (result.get(value) ?? 0) + 1);
} return result; }
function pair(a, b) { const left = stringValue(a), right = stringValue(b); return left === undefined || right === undefined ? "" : `${left}\u0000${right}`; }
function triple(a, b, c) { const first = stringValue(a), second = stringValue(b), third = stringValue(c); return first === undefined || second === undefined || third === undefined ? "" : `${first}\u0000${second}\u0000${third}`; }
function requiredString(value, field) { const result = stringValue(value); if (result === undefined)
    throw new Error(`${field} is required`); return result; }
function stringValue(value) { if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint")
    return undefined; const result = String(value).trim(); return result === "" ? undefined : result; }
function extractTagValue(value) { try {
    const parsed = JSON.parse(value);
    if (isRecord(parsed))
        return String(Object.values(parsed)[0] ?? "");
}
catch { /* validated as unavailable below */ } return ""; }
function sha256Canonical(value) { return sha256Text(canonicalJson(value)); }
function sha256Text(value) { return createHash("sha256").update(value).digest("hex"); }
function canonicalJson(value) { if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(",")}]`; if (isRecord(value))
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; if (typeof value === "bigint")
    return JSON.stringify(value.toString()); return JSON.stringify(value) ?? "null"; }
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonEmpty(value) { return value.length > 0; }
function unique(values) { return [...new Set(values)]; }
function message(error) { return error instanceof Error ? error.message : String(error); }
//# sourceMappingURL=focus-import.js.map