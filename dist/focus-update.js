import { createHash } from "node:crypto";
export function buildRuhrohFocusCatalogFromModel(input) {
    if (!isRecord(input.model) || !isRecord(input.model.Details) || typeof input.model.Details.FOCUSVersion !== "string" || !isRecord(input.model.ModelRules))
        throw new Error("expected a commit-pinned compiled FOCUS model");
    const rules = Object.entries(input.model.ModelRules).filter((entry) => isRecord(entry[1]));
    const datasets = unique(rules.map(([, rule]) => rule.DatasetId).filter((dataset) => typeof dataset === "string" && dataset.length > 0)).sort().map((dataset) => {
        const datasetRules = rules.filter(([, rule]) => rule.DatasetId === dataset);
        const columnIds = [...new Set(datasetRules.filter(([, rule]) => rule.EntityType === "Column" && typeof rule.EntityId === "string").map(([, rule]) => rule.EntityId))].sort();
        const columns = columnIds.map((columnId) => {
            const columnRules = datasetRules.filter(([, rule]) => rule.EntityId === columnId);
            const typeRule = columnRules.find(([, rule]) => rule.Function === "Type")?.[1];
            const presence = datasetRules.find(([, rule]) => rule.Function === "Presence" && rule.EntityId === columnId);
            const typeText = typeRule?.ValidationCriteria?.MustSatisfy ?? "";
            const typeMatch = /type ([A-Za-z0-9/ _-]+?)(?:\.|$)/u.exec(typeText);
            const presenceSuffix = presence?.[0].split("-").at(-1);
            const requirement = presenceSuffix === "M" ? "mandatory" : presenceSuffix === "C" ? "conditional" : "optional";
            return {
                columnId,
                dataType: typeMatch?.[1]?.trim() || "Unknown",
                requirement,
                applicabilityCriteria: [...new Set(columnRules.flatMap(([, rule]) => rule.ApplicabilityCriteria ?? []))].sort(),
                ruleIds: columnRules.map(([ruleId]) => ruleId).sort(),
            };
        });
        return { dataset, columns, ruleIds: datasetRules.map(([ruleId]) => ruleId).sort() };
    });
    return { version: "ruhroh_focus_catalog_v1", catalogId: input.catalogId, focusVersion: input.model.Details.FOCUSVersion, modelRef: input.modelRef, datasets };
}
export function compareRuhrohFocusCatalogs(from, to) {
    const changes = [];
    const fromDatasets = new Map(from.datasets.map((dataset) => [dataset.dataset, dataset]));
    const toDatasets = new Map(to.datasets.map((dataset) => [dataset.dataset, dataset]));
    for (const datasetId of unique([...fromDatasets.keys(), ...toDatasets.keys()]).sort()) {
        const before = fromDatasets.get(datasetId), after = toDatasets.get(datasetId);
        if (before === undefined || after === undefined) {
            changes.push(change(`dataset:${datasetId}`, "dataset", `datasets/${datasetId}`, `${before === undefined ? "Added" : "Removed"} dataset ${datasetId}`));
            continue;
        }
        const beforeColumns = new Map(before.columns.map((column) => [column.columnId, column]));
        const afterColumns = new Map(after.columns.map((column) => [column.columnId, column]));
        for (const columnId of unique([...beforeColumns.keys(), ...afterColumns.keys()]).sort()) {
            const left = beforeColumns.get(columnId), right = afterColumns.get(columnId);
            const sourcePath = `datasets/${datasetId}/columns/${columnId}`;
            if (left === undefined && right !== undefined) {
                const classification = right.requirement === "mandatory" ? "additive_mandatory" : right.requirement === "conditional" ? "additive_conditional" : "additive_optional";
                changes.push(change(`${datasetId}:${columnId}:added`, classification, sourcePath, `Added ${right.requirement} column ${columnId}`));
            }
            else if (left !== undefined && right === undefined)
                changes.push(change(`${datasetId}:${columnId}:removed`, "rename_deprecation_removal", sourcePath, `Removed column ${columnId}`));
            else if (left !== undefined && right !== undefined) {
                if (left.dataType !== right.dataType || left.requirement !== right.requirement || JSON.stringify(left.applicabilityCriteria) !== JSON.stringify(right.applicabilityCriteria)) {
                    changes.push(change(`${datasetId}:${columnId}:shape`, "type_scale_unit_currency_nullability_applicability", sourcePath, `Changed type, requirement, or applicability for ${columnId}`));
                }
                if (JSON.stringify(left.ruleIds) !== JSON.stringify(right.ruleIds))
                    changes.push(change(`${datasetId}:${columnId}:rules`, "normative", sourcePath, `Changed normative rule set for ${columnId}`));
            }
        }
    }
    return changes.sort((a, b) => a.id.localeCompare(b.id));
}
export function buildRuhrohFocusUpdateReview(input) {
    const changes = compareRuhrohFocusCatalogs(input.fromCatalog, input.toCatalog).map((item) => ({
        ...item,
        impactedMappings: input.mappingPack?.mappings
            .filter((mapping) => item.sourcePath.endsWith(`/columns/${mapping.sourceColumn}`))
            .map((mapping) => `${input.mappingPack?.mappingPackId}:${mapping.sourceColumn}`) ?? [],
    }));
    if (input.validatorChanged === true)
        changes.push(change("validator:identity", "validator", "validator", "Changed official validator version or immutable commit"));
    for (const item of input.editorialChanges ?? [])
        changes.push(change(item.id, "editorial", item.sourcePath, item.summary));
    const previewDecision = input.candidateReleaseStatus === "preview" ? ["Working drafts are diff-only and cannot become runtime import profiles"] : [];
    return {
        version: "ruhroh_focus_update_review_v1", reviewId: input.reviewId, createdAt: input.createdAt ?? new Date().toISOString(),
        fromSpecLockRef: input.fromSpecLockRef, toSpecLockRef: input.toSpecLockRef, candidateReleaseStatus: input.candidateReleaseStatus,
        changes, generatedRefs: input.generatedRefs ?? [], unresolvedDecisions: [...previewDecision, ...changes.filter((item) => item.requiresHumanReview).map((item) => item.summary)],
        verification: input.verification ?? [], recommendation: changes.length === 0 && input.candidateReleaseStatus === "ratified" ? "no_change" : "review_required",
    };
}
export function canonicalRuhrohFocusCatalogJson(catalog) { return `${canonicalJson(catalog)}\n`; }
export function hashRuhrohFocusCatalog(catalog) { return createHash("sha256").update(canonicalRuhrohFocusCatalogJson(catalog)).digest("hex"); }
function change(id, classification, sourcePath, summary) { return { id, classification, sourcePath, summary, impactedMappings: [], requiresHumanReview: classification !== "editorial" }; }
function canonicalJson(value) { if (Array.isArray(value))
    return `[${value.map(canonicalJson).join(",")}]`; if (isRecord(value))
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value) ?? "null"; }
function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
function unique(values) { return [...new Set(values)]; }
//# sourceMappingURL=focus-update.js.map