import { createHash } from "node:crypto";
export function parseRuhrohBillingCsv(text, profile) {
    const records = parseCsv(text);
    return normalizeRuhrohBillingRecords(records, profile);
}
export function parseRuhrohBillingNdjson(text, profile) {
    const records = [];
    const errors = [];
    for (const [index, line] of text.split(/\r?\n/u).entries()) {
        if (line.trim().length === 0)
            continue;
        try {
            const parsed = JSON.parse(line);
            if (!isRecord(parsed))
                errors.push(`line ${index + 1} must be a JSON object`);
            else
                records.push(parsed);
        }
        catch (error) {
            errors.push(`line ${index + 1} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const normalized = normalizeRuhrohBillingRecords(records, profile);
    return { rows: normalized.rows, errors: [...errors, ...normalized.errors] };
}
export function normalizeRuhrohBillingRecords(records, profile) {
    const errors = validateRuhrohBillingMappingProfile(profile);
    const rows = [];
    for (const [index, record] of [...records].entries()) {
        const sourceRowId = stringValue(record[profile.fields.sourceRowId]);
        const amount = numberValue(record[profile.fields.amount]);
        const currency = stringValue(record[profile.fields.currency]);
        const rawKind = stringValue(record[profile.fields.kind]);
        const kind = rawKind === undefined ? undefined : resolveKind(rawKind, profile.kindValues);
        if (sourceRowId === undefined)
            errors.push(`records[${index}] is missing sourceRowId`);
        if (amount === undefined)
            errors.push(`records[${index}] has invalid amount`);
        if (currency === undefined || !/^[A-Z]{3}$/u.test(currency))
            errors.push(`records[${index}] has invalid currency`);
        if (kind === undefined)
            errors.push(`records[${index}] has unmapped billing fact kind`);
        if (sourceRowId === undefined || amount === undefined || currency === undefined || kind === undefined)
            continue;
        const optional = (field) => {
            const sourceField = profile.fields[field];
            return sourceField === undefined ? undefined : stringValue(record[sourceField]);
        };
        rows.push({
            version: "ruhroh_normalized_billing_row_v1",
            sourceRowId,
            sourceRowSha256: sha256Canonical(record),
            amount,
            currency,
            kind,
            ...(optional("occurredAt") === undefined ? {} : { occurredAt: optional("occurredAt") }),
            ...(optional("providerRequestId") === undefined ? {} : { providerRequestId: optional("providerRequestId") }),
            ...(optional("principalRef") === undefined ? {} : { principalRef: optional("principalRef") }),
            ...(optional("workloadId") === undefined ? {} : { workloadId: optional("workloadId") }),
            ...(optional("model") === undefined ? {} : { model: optional("model") }),
            ...(optional("sku") === undefined ? {} : { sku: optional("sku") }),
        });
    }
    const ids = new Set();
    for (const row of rows) {
        if (ids.has(row.sourceRowId))
            errors.push(`duplicate sourceRowId ${row.sourceRowId}`);
        ids.add(row.sourceRowId);
    }
    return { rows, errors: unique(errors) };
}
export function buildRuhrohCostReconciliation(input) {
    const blockers = [
        ...validateRuhrohBillingSourceManifest(input.billingSource),
        ...validateRuhrohBillingMappingProfile(input.mappingProfile),
        ...validateHashedRef(input.benchmarkClaimRef, "benchmarkClaimRef"),
        ...validateHashedRef(input.billingSourceRef, "billingSourceRef"),
        ...validateHashedRef(input.mappingProfileRef, "mappingProfileRef"),
        ...input.billingRows.flatMap((row, index) => validateRuhrohNormalizedBillingRow(row).map((error) => `billingRows[${index}]: ${error}`)),
        ...input.technicalFacts.flatMap((fact, index) => validateRuhrohTechnicalEconomicFact(fact).map((error) => `technicalFacts[${index}]: ${error}`)),
    ];
    if (input.billingSource.rowCount !== input.billingRows.length) {
        blockers.push(`billing source rowCount=${input.billingSource.rowCount} does not match normalized rows=${input.billingRows.length}`);
    }
    const declaredCurrencies = [...new Set(input.billingSource.currencies)].sort();
    const observedCurrencies = [...new Set(input.billingRows.map((row) => row.currency))].sort();
    if (JSON.stringify(declaredCurrencies) !== JSON.stringify(observedCurrencies)) {
        blockers.push(`billing source currencies ${declaredCurrencies.join(",")} do not match normalized row currencies ${observedCurrencies.join(",")}`);
    }
    const sourceRowIds = new Set(input.billingRows.map((row) => row.sourceRowId));
    for (const allocation of input.mappingProfile.allocations) {
        if (!sourceRowIds.has(allocation.sourceRowId))
            blockers.push(`allocation ${allocation.sourceRowId} does not reference a normalized billing row`);
    }
    const allocationByRow = new Map(input.mappingProfile.allocations.map((allocation) => [allocation.sourceRowId, allocation]));
    const joins = input.billingRows.flatMap((row) => reconcileRow(row, input.technicalFacts, allocationByRow.get(row.sourceRowId), input.mappingProfile));
    const currencies = [...new Set(input.billingRows.map((row) => row.currency))].sort().map((currency) => {
        const sourceRows = input.billingRows.filter((row) => row.currency === currency);
        const currencyJoins = joins.filter((join) => join.currency === currency);
        const sourceTotal = sum(sourceRows.map((row) => row.amount));
        const assignedTotal = sum(currencyJoins.map((join) => join.assignedAmount));
        const difference = assignedTotal - sourceTotal;
        if (Math.abs(difference) > input.mappingProfile.tolerance) {
            blockers.push(`${currency} reconciliation differs from source by ${difference}`);
        }
        return {
            currency,
            sourceTotal,
            assignedTotal,
            difference,
            byMatchClass: MATCH_CLASSES.reduce((result, matchClass) => ({
                ...result,
                [matchClass]: sum(currencyJoins.filter((join) => join.matchClass === matchClass).map((join) => join.assignedAmount)),
            }), emptyMatchTotals()),
            byFactKind: FACT_KINDS.reduce((result, kind) => ({
                ...result,
                [kind]: sum(sourceRows.filter((row) => row.kind === kind).map((row) => row.amount)),
            }), emptyFactTotals()),
        };
    });
    const rowClasses = new Map();
    for (const join of joins)
        rowClasses.set(join.sourceRowSha256, join.matchClass);
    const counts = (matchClass) => [...rowClasses.values()].filter((value) => value === matchClass).length;
    const unresolved = counts("ambiguous") + counts("unmatched");
    if (unresolved > 0)
        blockers.push(`${unresolved} billing row(s) remain ambiguous or unmatched`);
    return {
        version: "ruhroh_cost_reconciliation_v1",
        reconciliationId: input.reconciliationId,
        createdAt: input.createdAt ?? new Date().toISOString(),
        benchmarkClaimRef: input.benchmarkClaimRef,
        billingSourceRef: input.billingSourceRef,
        mappingProfileRef: input.mappingProfileRef,
        source: {
            sourceId: input.billingSource.sourceId,
            billingPeriod: input.billingSource.billingPeriod,
            rowCount: input.billingSource.rowCount,
        },
        joins,
        currencies,
        coverage: {
            exactRows: counts("exact"),
            boundedRows: counts("bounded"),
            allocatedRows: counts("allocated"),
            ambiguousRows: counts("ambiguous"),
            unmatchedRows: counts("unmatched"),
        },
        ready: blockers.length === 0,
        blockers: unique(blockers),
        unsupportedConcepts: ["foreign_exchange_conversion", "cross_currency_blended_total", "raw_billing_publication"],
    };
}
export function validateRuhrohBillingSourceManifest(manifest) {
    const errors = [];
    if (manifest.version !== "ruhroh_billing_source_manifest_v1")
        errors.push("billing source version must be ruhroh_billing_source_manifest_v1");
    if (!nonEmpty(manifest.sourceId))
        errors.push("sourceId is required");
    if (!nonEmpty(manifest.externalSchemaVersion))
        errors.push("externalSchemaVersion is required");
    if (!new Set(["csv", "ndjson", "records"]).has(manifest.format))
        errors.push("format must be csv, ndjson, or records");
    if (!(Date.parse(manifest.billingPeriod.startedAt) < Date.parse(manifest.billingPeriod.endedAt)))
        errors.push("billingPeriod must have an end after its start");
    if (!Number.isInteger(manifest.rowCount) || manifest.rowCount < 0)
        errors.push("rowCount must be a non-negative integer");
    if (manifest.currencies.length === 0 || new Set(manifest.currencies).size !== manifest.currencies.length)
        errors.push("currencies must be non-empty and unique");
    if (manifest.currencies.some((currency) => !/^[A-Z]{3}$/u.test(currency)))
        errors.push("currencies must be three-letter uppercase codes");
    if (manifest.privacyClassification !== "internal" && manifest.privacyClassification !== "restricted")
        errors.push("raw billing sources cannot be public");
    errors.push(...validateHashedRef(manifest.sourceRef, "sourceRef"));
    return unique(errors);
}
export function validateRuhrohBillingMappingProfile(profile) {
    const errors = [];
    if (profile.version !== "ruhroh_billing_mapping_profile_v1")
        errors.push("mapping profile version must be ruhroh_billing_mapping_profile_v1");
    for (const [field, value] of [["profileId", profile.profileId], ["provider", profile.provider], ["externalSchemaVersion", profile.externalSchemaVersion]]) {
        if (!nonEmpty(value))
            errors.push(`${field} is required`);
    }
    for (const field of ["sourceRowId", "amount", "currency", "kind"]) {
        if (profile.fields[field].trim().length === 0)
            errors.push(`fields.${field} is required`);
    }
    if (!Number.isFinite(profile.matching.boundedWindowSeconds) || profile.matching.boundedWindowSeconds < 0)
        errors.push("matching.boundedWindowSeconds must be non-negative");
    if (!Number.isFinite(profile.tolerance) || profile.tolerance < 0)
        errors.push("tolerance must be non-negative");
    const allocationIds = new Set();
    for (const allocation of profile.allocations) {
        if (allocationIds.has(allocation.sourceRowId))
            errors.push(`allocation ${allocation.sourceRowId} is duplicated`);
        allocationIds.add(allocation.sourceRowId);
        const total = sum(allocation.targets.map((target) => target.weight));
        if (!nonEmpty(allocation.sourceRowId))
            errors.push("allocation sourceRowId is required");
        if (new Set(allocation.targets.map((target) => target.workloadId)).size !== allocation.targets.length)
            errors.push(`allocation ${allocation.sourceRowId} has duplicate workload targets`);
        if (allocation.targets.some((target) => !nonEmpty(target.workloadId)))
            errors.push(`allocation ${allocation.sourceRowId} workloadId values are required`);
        if (allocation.targets.length === 0 || allocation.targets.some((target) => !Number.isFinite(target.weight) || target.weight <= 0) || Math.abs(total - 1) > profile.tolerance) {
            errors.push(`allocation ${allocation.sourceRowId} weights must be positive and sum to one`);
        }
    }
    const kindOwners = new Map();
    for (const kind of FACT_KINDS) {
        for (const raw of profile.kindValues[kind] ?? []) {
            if (!nonEmpty(raw))
                errors.push(`kindValues.${kind} must contain non-empty values`);
            const owner = kindOwners.get(raw);
            if (owner !== undefined && owner !== kind)
                errors.push(`billing kind value ${raw} is mapped to both ${owner} and ${kind}`);
            kindOwners.set(raw, kind);
        }
    }
    return unique(errors);
}
export function validateRuhrohNormalizedBillingRow(row) {
    const errors = [];
    if (row.version !== "ruhroh_normalized_billing_row_v1")
        errors.push("version must be ruhroh_normalized_billing_row_v1");
    if (!nonEmpty(row.sourceRowId))
        errors.push("sourceRowId is required");
    if (!sha256Digest(row.sourceRowSha256))
        errors.push("sourceRowSha256 must be lowercase SHA-256");
    if (!Number.isFinite(row.amount))
        errors.push("amount must be finite");
    if (!/^[A-Z]{3}$/u.test(row.currency))
        errors.push("currency must be a three-letter uppercase code");
    if (!FACT_KINDS.includes(row.kind))
        errors.push("kind is unsupported");
    if (row.occurredAt !== undefined && !Number.isFinite(Date.parse(row.occurredAt)))
        errors.push("occurredAt must be a timestamp when present");
    return errors;
}
export function validateRuhrohTechnicalEconomicFact(fact) {
    const errors = [];
    if (fact.version !== "ruhroh_technical_economic_fact_v1")
        errors.push("version must be ruhroh_technical_economic_fact_v1");
    for (const [field, value] of [
        ["factId", fact.factId],
        ["runId", fact.runId],
        ["benchmarkTargetId", fact.benchmarkTargetId],
        ["workloadId", fact.workloadId],
    ]) {
        if (!nonEmpty(value))
            errors.push(`${field} is required`);
    }
    if (!Number.isFinite(Date.parse(fact.occurredAt)))
        errors.push("occurredAt must be a timestamp");
    if (fact.providerRequestIdHash !== undefined && !sha256Digest(fact.providerRequestIdHash))
        errors.push("providerRequestIdHash must be lowercase SHA-256");
    errors.push(...validateHashedRef(fact.evidenceRef, "evidenceRef"));
    return errors;
}
export function validateRuhrohCostReconciliation(reconciliation) {
    const errors = [];
    if (reconciliation.version !== "ruhroh_cost_reconciliation_v1")
        errors.push("version must be ruhroh_cost_reconciliation_v1");
    for (const [field, ref] of [["benchmarkClaimRef", reconciliation.benchmarkClaimRef], ["billingSourceRef", reconciliation.billingSourceRef], ["mappingProfileRef", reconciliation.mappingProfileRef]]) {
        errors.push(...validateHashedRef(ref, field));
    }
    if (!nonEmpty(reconciliation.reconciliationId))
        errors.push("reconciliationId is required");
    if (!Number.isFinite(Date.parse(reconciliation.createdAt)))
        errors.push("createdAt must be a timestamp");
    for (const currency of reconciliation.currencies) {
        if (!/^[A-Z]{3}$/u.test(currency.currency))
            errors.push(`${currency.currency} is not a valid native currency code`);
        if (!Number.isFinite(currency.sourceTotal) || !Number.isFinite(currency.assignedTotal) || !Number.isFinite(currency.difference))
            errors.push(`${currency.currency} totals must be finite`);
        if (Math.abs(currency.difference - (currency.assignedTotal - currency.sourceTotal)) > 1e-9)
            errors.push(`${currency.currency} difference must equal assignedTotal - sourceTotal`);
        if (Math.abs(currency.difference) > 1e-9)
            errors.push(`${currency.currency} assigned total does not equal its source total`);
    }
    const weights = new Map();
    const classes = new Map();
    for (const [index, join] of reconciliation.joins.entries()) {
        if (!sha256Digest(join.sourceRowSha256))
            errors.push(`joins[${index}].sourceRowSha256 must be lowercase SHA-256`);
        if (!MATCH_CLASSES.includes(join.matchClass))
            errors.push(`joins[${index}].matchClass is unsupported`);
        if (!FACT_KINDS.includes(join.kind))
            errors.push(`joins[${index}].kind is unsupported`);
        if (!/^[A-Z]{3}$/u.test(join.currency))
            errors.push(`joins[${index}].currency must be a three-letter uppercase code`);
        if (!Number.isFinite(join.sourceAmount) || !Number.isFinite(join.assignedAmount))
            errors.push(`joins[${index}] amounts must be finite`);
        if (!Number.isFinite(join.allocationWeight) || join.allocationWeight <= 0 || join.allocationWeight > 1)
            errors.push(`joins[${index}].allocationWeight must be in (0, 1]`);
        weights.set(join.sourceRowSha256, (weights.get(join.sourceRowSha256) ?? 0) + join.allocationWeight);
        const priorClass = classes.get(join.sourceRowSha256);
        if (priorClass !== undefined && (priorClass !== "allocated" || join.matchClass !== "allocated"))
            errors.push(`source row ${join.sourceRowSha256} has multiple non-allocation joins`);
        classes.set(join.sourceRowSha256, join.matchClass);
    }
    for (const [row, weight] of weights)
        if (Math.abs(weight - 1) > 1e-9)
            errors.push(`source row ${row} allocation weights sum to ${weight}`);
    const count = (matchClass) => [...classes.values()].filter((value) => value === matchClass).length;
    for (const [field, matchClass] of [["exactRows", "exact"], ["boundedRows", "bounded"], ["allocatedRows", "allocated"], ["ambiguousRows", "ambiguous"], ["unmatchedRows", "unmatched"]]) {
        if (reconciliation.coverage[field] !== count(matchClass))
            errors.push(`coverage.${field} must equal reconciled row count ${count(matchClass)}`);
    }
    const shouldBeReady = errors.length === 0 && reconciliation.blockers.length === 0 && reconciliation.coverage.ambiguousRows === 0 && reconciliation.coverage.unmatchedRows === 0;
    if (reconciliation.ready !== shouldBeReady)
        errors.push(`ready must be ${shouldBeReady} for the recorded reconciliation state`);
    return unique(errors);
}
function reconcileRow(row, facts, allocation, profile) {
    if (allocation !== undefined) {
        return allocation.targets.map((target) => ({
            sourceRowSha256: row.sourceRowSha256,
            matchClass: "allocated",
            currency: row.currency,
            kind: row.kind,
            sourceAmount: row.amount,
            assignedAmount: row.amount * target.weight,
            allocationWeight: target.weight,
            technicalFactIds: facts.filter((fact) => fact.workloadId === target.workloadId).map((fact) => fact.factId).sort(),
            workloadIds: [target.workloadId],
            reason: "predeclared allocation policy",
        }));
    }
    const exact = row.providerRequestId === undefined ? [] : facts.filter((fact) => fact.providerRequestIdHash === sha256Text(row.providerRequestId ?? ""));
    if (exact.length === 1)
        return [joined(row, "exact", exact, "unique provider request identifier hash")];
    if (exact.length > 1)
        return [joined(row, "ambiguous", exact, "provider request identifier matched multiple technical facts")];
    const bounded = facts.filter((fact) => boundedMatch(row, fact, profile));
    if (bounded.length === 1)
        return [joined(row, "bounded", bounded, "unique bounded identity and time-window match")];
    if (bounded.length > 1)
        return [joined(row, "ambiguous", bounded, "bounded identity and time-window match returned multiple technical facts")];
    return [joined(row, "unmatched", [], "no exact, bounded, or allocation match")];
}
function joined(row, matchClass, facts, reason) {
    return {
        sourceRowSha256: row.sourceRowSha256,
        matchClass,
        currency: row.currency,
        kind: row.kind,
        sourceAmount: row.amount,
        assignedAmount: row.amount,
        allocationWeight: 1,
        technicalFactIds: facts.map((fact) => fact.factId).sort(),
        workloadIds: [...new Set(facts.map((fact) => fact.workloadId))].sort(),
        reason,
    };
}
function boundedMatch(row, fact, profile) {
    if (row.occurredAt === undefined)
        return false;
    const delta = Math.abs(Date.parse(row.occurredAt) - Date.parse(fact.occurredAt));
    if (!Number.isFinite(delta) || delta > profile.matching.boundedWindowSeconds * 1000)
        return false;
    let compared = 0;
    for (const field of profile.matching.boundedFields) {
        const left = row[field];
        const right = fact[field];
        if (left === undefined || right === undefined || left !== right)
            return false;
        compared += 1;
    }
    return compared > 0;
}
function resolveKind(raw, values) {
    return FACT_KINDS.find((kind) => (values[kind] ?? []).includes(raw));
}
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
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
    if (field.length > 0 || row.length > 0) {
        row.push(field.replace(/\r$/u, ""));
        rows.push(row);
    }
    const headers = rows.shift() ?? [];
    return rows.filter((values) => values.some((value) => value.length > 0)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}
const FACT_KINDS = ["charge", "credit", "refund", "commitment", "tax", "prepaid", "capacity"];
const MATCH_CLASSES = ["exact", "bounded", "allocated", "ambiguous", "unmatched"];
function emptyMatchTotals() {
    return { exact: 0, bounded: 0, allocated: 0, ambiguous: 0, unmatched: 0 };
}
function emptyFactTotals() {
    return { charge: 0, credit: 0, refund: 0, commitment: 0, tax: 0, prepaid: 0, capacity: 0 };
}
function sha256Canonical(value) { return sha256Text(canonicalJson(value)); }
function sha256Text(value) { return createHash("sha256").update(value).digest("hex"); }
function sha256Digest(value) { return /^[a-f0-9]{64}$/u.test(value); }
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(",")}]`;
    if (isRecord(value))
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value) ?? "null";
}
function stringValue(value) { const result = typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; return result.length === 0 ? undefined : result; }
function numberValue(value) { const result = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN; return Number.isFinite(result) ? result : undefined; }
function sum(values) { return values.reduce((total, value) => total + value, 0); }
function unique(values) { return [...new Set(values)]; }
function nonEmpty(value) { return typeof value === "string" && value.trim().length > 0; }
function validateHashedRef(ref, field) {
    const errors = [];
    if (!nonEmpty(ref.path))
        errors.push(`${field}.path is required`);
    if (!sha256Digest(ref.sha256))
        errors.push(`${field}.sha256 must be lowercase SHA-256`);
    return errors;
}
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
//# sourceMappingURL=billing.js.map