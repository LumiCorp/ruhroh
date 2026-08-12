export type RuhrohFocusReleaseStatus = "ratified" | "preview";
export type RuhrohFocusDatasetIdV1 = "CostAndUsage" | "BillingPeriod" | "InvoiceDetail" | "ContractCommitment";
export type RuhrohFocusValidationStatus = "passed" | "failed" | "unavailable";
export type RuhrohFocusReadiness = "draft" | "review_required" | "ready";

export interface RuhrohFocusHashedRefV1 { path: string; sha256: string }

export interface RuhrohFocusSpecLockV1 {
  version: "ruhroh_focus_spec_lock_v1";
  profileId: string;
  focusVersion: string;
  releaseStatus: RuhrohFocusReleaseStatus;
  specification: {
    repository: string;
    ref: string;
    commitSha: string;
    releaseAssets: Array<RuhrohFocusHashedRefV1 & { name: string; upstreamDigest: string }>;
    model: RuhrohFocusHashedRefV1;
  };
  validator: { repository: string; version: string; commitSha: string };
  datasets: RuhrohFocusDatasetIdV1[];
  retrievedAt: string;
}

export interface RuhrohFocusCatalogColumnV1 {
  columnId: string;
  dataType: string;
  requirement: "mandatory" | "conditional" | "optional";
  applicabilityCriteria: string[];
  ruleIds: string[];
}

export interface RuhrohFocusCatalogV1 {
  version: "ruhroh_focus_catalog_v1";
  catalogId: string;
  focusVersion: string;
  modelRef: RuhrohFocusHashedRefV1;
  /** Catalogs may describe future datasets. Runtime import remains limited to RuhrohFocusDatasetIdV1. */
  datasets: Array<{ dataset: string; columns: RuhrohFocusCatalogColumnV1[]; ruleIds: string[] }>;
}

export type RuhrohFocusMappingDisposition = "mapped" | "preserved_only" | "unsupported";
export type RuhrohFocusNeutralBillingFieldV2 = "amountDecimal" | "currency" | "kind" | "occurredAt" | "sku";
export interface RuhrohFocusMappingEntryV1 {
  sourceColumn: string;
  disposition: RuhrohFocusMappingDisposition;
  destinationField?: RuhrohFocusNeutralBillingFieldV2 | undefined;
  transform?: "decimal_string" | "currency_code" | "charge_category_to_kind" | "timestamp" | "string" | undefined;
  requirementIds: string[];
  fixtureIds: string[];
  economicallyMaterial: boolean;
  reason?: string | undefined;
}
export interface RuhrohFocusMappingPackV1 {
  version: "ruhroh_focus_mapping_pack_v1";
  mappingPackId: string;
  focusVersion: "1.4";
  dataset: "CostAndUsage";
  specLockRef: RuhrohFocusHashedRefV1;
  catalogRef: RuhrohFocusHashedRefV1;
  mappings: RuhrohFocusMappingEntryV1[];
  unsupportedConcepts: string[];
}

export interface RuhrohFocusConformanceProfileV1 {
  version: "ruhroh_focus_conformance_profile_v1";
  profileId: string;
  focusVersion: "1.4";
  modelSha256: string;
  applicabilityCriteria: string[];
  allowedSkips: Array<{ ruleId: string; reason: string; reviewRef: RuhrohFocusHashedRefV1 }>;
}

export interface RuhrohFocusRuleResultV1 {
  ruleId: string;
  status: "passed" | "failed" | "skipped" | "error";
  count: number;
  message?: string | undefined;
}
export interface RuhrohFocusConformanceReportV1 {
  version: "ruhroh_focus_conformance_report_v1";
  reportId: string;
  createdAt: string;
  focusVersion: string;
  releaseStatus: RuhrohFocusReleaseStatus;
  dataset: RuhrohFocusDatasetIdV1;
  inputRef: RuhrohFocusHashedRefV1;
  specLockRef: RuhrohFocusHashedRefV1;
  conformanceProfileRef: RuhrohFocusHashedRefV1;
  validator: { repository: string; version: string; commitSha: string; executable: string };
  status: RuhrohFocusValidationStatus;
  requirements: { evaluated: number; passed: number; failed: number; skipped: number; errors: number };
  rules: RuhrohFocusRuleResultV1[];
  blockers: string[];
}

export interface RuhrohFocusDatasetBundleV1 {
  version: "ruhroh_focus_dataset_bundle_v1";
  bundleId: string;
  focusVersion: "1.4";
  createdAt: string;
  datasets: Array<{ dataset: RuhrohFocusDatasetIdV1; format: "csv" | "parquet" | "records"; sourceRef: RuhrohFocusHashedRefV1; rowCount: number }>;
  relationships: Array<{ relationship: "cost_to_invoice_detail" | "cost_to_billing_period" | "cost_to_contract_commitment"; referenced: number; matched: number; missing: number; ambiguous: number }>;
  privacyClassification: "restricted";
  blockers: string[];
}

export interface RuhrohFocusAttributionProfileV1 {
  version: "ruhroh_focus_attribution_profile_v1";
  profileId: string;
  provider: string;
  focusVersion: "1.4";
  sourceSelectors: Array<{ sourceColumn: string; destination: "providerRequestId" | "workloadId" | "principalRef" | "model"; transform: "identity" | "sha256" | "tag_value" }>;
  privacyClassification: "restricted";
}

export interface RuhrohFocusImportReportV1 {
  version: "ruhroh_focus_import_report_v1";
  reportId: string;
  createdAt: string;
  focusVersion: string;
  releaseStatus: RuhrohFocusReleaseStatus;
  bundleRef: RuhrohFocusHashedRefV1;
  specLockRef: RuhrohFocusHashedRefV1;
  mappingPackRef: RuhrohFocusHashedRefV1;
  conformanceReportRefs: RuhrohFocusHashedRefV1[];
  datasets: Array<{ dataset: RuhrohFocusDatasetIdV1; sourceRows: number; acceptedRows: number; rejectedRows: number; unknownColumns: string[] }>;
  currencies: Array<{ currency: string; sourceAmountDecimal: string; normalizedAmountDecimal: string; differenceDecimal: string }>;
  normalizedRowsRef?: RuhrohFocusHashedRefV1 | undefined;
  relationshipCoverage: RuhrohFocusDatasetBundleV1["relationships"];
  readiness: RuhrohFocusReadiness;
  blockers: string[];
}

export type RuhrohFocusChangeClassification = "editorial" | "additive_optional" | "additive_conditional" | "additive_mandatory" | "type_scale_unit_currency_nullability_applicability" | "rename_deprecation_removal" | "normative" | "dataset" | "validator";
export interface RuhrohFocusUpdateReviewV1 {
  version: "ruhroh_focus_update_review_v1";
  reviewId: string;
  createdAt: string;
  fromSpecLockRef: RuhrohFocusHashedRefV1;
  toSpecLockRef: RuhrohFocusHashedRefV1;
  candidateReleaseStatus: RuhrohFocusReleaseStatus;
  changes: Array<{ id: string; classification: RuhrohFocusChangeClassification; sourcePath: string; summary: string; impactedMappings: string[]; requiresHumanReview: boolean }>;
  generatedRefs: RuhrohFocusHashedRefV1[];
  unresolvedDecisions: string[];
  verification: Array<{ name: string; status: "passed" | "failed" | "not_run"; evidence?: RuhrohFocusHashedRefV1 | undefined }>;
  recommendation: "no_change" | "review_required" | "reject";
}

export function validateRuhrohFocusSpecLock(value: unknown): string[] {
  if (!isRecord(value)) return ["FOCUS spec lock must be an object"];
  const errors: string[] = [];
  if (value.version !== "ruhroh_focus_spec_lock_v1") errors.push("version must be ruhroh_focus_spec_lock_v1");
  if (!nonEmpty(value.profileId) || !nonEmpty(value.focusVersion) || !timestamp(value.retrievedAt)) errors.push("profileId, focusVersion, and retrievedAt are required");
  if (!isRecord(value.specification)) errors.push("specification is required");
  else {
    if (!nonEmpty(value.specification.repository) || !nonEmpty(value.specification.ref) || !gitSha(value.specification.commitSha)) errors.push("specification identity is invalid");
    errors.push(...validateRef(value.specification.model, "specification.model"));
    if (!Array.isArray(value.specification.releaseAssets) || value.specification.releaseAssets.length === 0) errors.push("releaseAssets must be non-empty");
    else value.specification.releaseAssets.forEach((asset, index) => { errors.push(...validateRef(asset, `releaseAssets[${index}]`)); if (!isRecord(asset) || !nonEmpty(asset.name) || !sha256(asset.upstreamDigest)) errors.push(`releaseAssets[${index}] identity is invalid`); });
  }
  if (!isRecord(value.validator) || !nonEmpty(value.validator.repository) || !nonEmpty(value.validator.version) || !gitSha(value.validator.commitSha)) errors.push("validator identity is invalid");
  if (!Array.isArray(value.datasets) || value.datasets.length !== 4 || value.datasets.some((dataset) => !isDataset(dataset)) || new Set(value.datasets).size !== 4) errors.push("datasets must contain exactly the four FOCUS 1.4 datasets");
  if (value.releaseStatus !== "ratified" && value.releaseStatus !== "preview") errors.push("releaseStatus is invalid");
  const specificationRef = isRecord(value.specification) ? value.specification.ref : undefined;
  if (value.releaseStatus === "ratified" && !String(specificationRef ?? "").startsWith("v")) errors.push("ratified locks require a release tag");
  if (value.releaseStatus === "preview" && !gitSha(specificationRef)) errors.push("preview locks require an immutable commit ref");
  return unique(errors);
}

export function validateRuhrohFocusCatalog(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_catalog_v1", ["catalogId", "focusVersion", "modelRef", "datasets"]);
  if (!isRecord(value)) return errors;
  errors.push(...validateRef(value.modelRef, "modelRef"));
  if (!Array.isArray(value.datasets) || value.datasets.some((dataset) => !isRecord(dataset) || !nonEmpty(dataset.dataset) || !Array.isArray(dataset.columns) || !Array.isArray(dataset.ruleIds))) errors.push("catalog datasets must have string identities, columns, and ruleIds");
  else for (const dataset of value.datasets) if (isRecord(dataset) && Array.isArray(dataset.columns)) for (const column of dataset.columns) if (!isRecord(column) || !nonEmpty(column.columnId) || !nonEmpty(column.dataType) || !["mandatory", "conditional", "optional"].includes(String(column.requirement)) || !Array.isArray(column.applicabilityCriteria) || !Array.isArray(column.ruleIds)) errors.push(`catalog dataset ${String(dataset.dataset)} contains an invalid column`);
  return unique(errors);
}
export function validateRuhrohFocusMappingPack(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_mapping_pack_v1", ["mappingPackId", "focusVersion", "dataset", "specLockRef", "catalogRef", "mappings", "unsupportedConcepts"]);
  if (!isRecord(value)) return errors;
  if (value.focusVersion !== "1.4" || value.dataset !== "CostAndUsage") errors.push("mapping pack supports only FOCUS 1.4 CostAndUsage");
  errors.push(...validateRef(value.specLockRef, "specLockRef"), ...validateRef(value.catalogRef, "catalogRef"));
  if (!Array.isArray(value.mappings) || value.mappings.length === 0) errors.push("mappings must be non-empty");
  else for (const mapping of value.mappings) {
    if (!isRecord(mapping) || !nonEmpty(mapping.sourceColumn) || !["mapped", "preserved_only", "unsupported"].includes(String(mapping.disposition)) || !Array.isArray(mapping.requirementIds) || !Array.isArray(mapping.fixtureIds) || typeof mapping.economicallyMaterial !== "boolean") errors.push("mapping entries must be fully classified");
    else if (mapping.disposition === "mapped" && (!nonEmpty(mapping.destinationField) || !nonEmpty(mapping.transform))) errors.push(`mapped column ${mapping.sourceColumn} requires a destination and transform`);
  }
  return unique(errors);
}
export function validateRuhrohFocusConformanceProfile(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_conformance_profile_v1", ["profileId", "focusVersion", "modelSha256", "applicabilityCriteria", "allowedSkips"]);
  if (isRecord(value) && !sha256(value.modelSha256)) errors.push("modelSha256 must be SHA-256");
  if (isRecord(value) && Array.isArray(value.allowedSkips)) for (const [index, skip] of value.allowedSkips.entries()) {
    if (!isRecord(skip) || !nonEmpty(skip.ruleId) || !nonEmpty(skip.reason)) errors.push(`allowedSkips[${index}] is invalid`);
    else errors.push(...validateRef(skip.reviewRef, `allowedSkips[${index}].reviewRef`));
  }
  return unique(errors);
}
export function validateRuhrohFocusConformanceReport(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_conformance_report_v1", ["reportId", "createdAt", "focusVersion", "releaseStatus", "dataset", "inputRef", "specLockRef", "conformanceProfileRef", "validator", "status", "requirements", "rules", "blockers"]);
  if (!isRecord(value)) return errors;
  if (!isDataset(value.dataset)) errors.push("dataset is invalid");
  if (!Array.isArray(value.blockers) || !Array.isArray(value.rules)) errors.push("rules and blockers must be arrays");
  errors.push(...validateRef(value.inputRef, "inputRef"), ...validateRef(value.specLockRef, "specLockRef"), ...validateRef(value.conformanceProfileRef, "conformanceProfileRef"));
  if (value.status === "passed" && (value.blockers as unknown[]).length > 0) errors.push("passed report cannot have blockers");
  return unique(errors);
}
export function validateRuhrohFocusDatasetBundle(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_dataset_bundle_v1", ["bundleId", "focusVersion", "createdAt", "datasets", "relationships", "privacyClassification", "blockers"]);
  if (isRecord(value) && value.privacyClassification !== "restricted") errors.push("FOCUS source bundles must be restricted");
  if (isRecord(value) && Array.isArray(value.datasets)) for (const [index, dataset] of value.datasets.entries()) {
    if (!isRecord(dataset) || !isDataset(dataset.dataset) || !["csv", "parquet", "records"].includes(String(dataset.format)) || !Number.isInteger(dataset.rowCount) || Number(dataset.rowCount) < 0) errors.push(`datasets[${index}] is invalid`);
    else errors.push(...validateRef(dataset.sourceRef, `datasets[${index}].sourceRef`));
  }
  return unique(errors);
}
export function validateRuhrohFocusAttributionProfile(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_attribution_profile_v1", ["profileId", "provider", "focusVersion", "sourceSelectors", "privacyClassification"]);
  if (isRecord(value) && value.privacyClassification !== "restricted") errors.push("attribution profiles must be restricted");
  if (isRecord(value) && (!Array.isArray(value.sourceSelectors) || value.sourceSelectors.some((selector) => !isRecord(selector) || !nonEmpty(selector.sourceColumn) || !["providerRequestId", "workloadId", "principalRef", "model"].includes(String(selector.destination)) || !["identity", "sha256", "tag_value"].includes(String(selector.transform))))) errors.push("sourceSelectors are invalid");
  return unique(errors);
}
export function validateRuhrohFocusImportReport(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_import_report_v1", ["reportId", "createdAt", "focusVersion", "releaseStatus", "bundleRef", "specLockRef", "mappingPackRef", "conformanceReportRefs", "datasets", "currencies", "relationshipCoverage", "readiness", "blockers"]);
  if (!isRecord(value)) return errors;
  if (value.readiness === "ready" && (value.releaseStatus !== "ratified" || !Array.isArray(value.blockers) || value.blockers.length > 0)) errors.push("ready imports require ratified evidence and no blockers");
  for (const field of ["bundleRef", "specLockRef", "mappingPackRef"] as const) errors.push(...validateRef(value[field], field));
  if (Array.isArray(value.conformanceReportRefs)) value.conformanceReportRefs.forEach((ref, index) => errors.push(...validateRef(ref, `conformanceReportRefs[${index}]`)));
  if (Array.isArray(value.currencies)) for (const currency of value.currencies) if (!isRecord(currency) || !/^[A-Z]{3}$/u.test(String(currency.currency)) || !canonicalDecimal(currency.sourceAmountDecimal) || !canonicalDecimal(currency.normalizedAmountDecimal) || !canonicalDecimal(currency.differenceDecimal)) errors.push("currency accounting must use canonical decimal strings");
  return unique(errors);
}
export function validateRuhrohFocusUpdateReview(value: unknown): string[] {
  const errors = validateVersioned(value, "ruhroh_focus_update_review_v1", ["reviewId", "createdAt", "fromSpecLockRef", "toSpecLockRef", "candidateReleaseStatus", "changes", "generatedRefs", "unresolvedDecisions", "verification", "recommendation"]);
  if (!isRecord(value)) return errors;
  errors.push(...validateRef(value.fromSpecLockRef, "fromSpecLockRef"), ...validateRef(value.toSpecLockRef, "toSpecLockRef"));
  if (value.recommendation === "no_change" && (Array.isArray(value.changes) && value.changes.length > 0)) errors.push("no_change cannot contain semantic changes");
  if (value.candidateReleaseStatus === "preview" && value.recommendation === "no_change") errors.push("preview candidates remain review-only even when no semantic diff is found");
  if (Array.isArray(value.changes) && value.changes.some((change) => isRecord(change) && change.classification !== "editorial" && change.requiresHumanReview !== true)) errors.push("all semantic changes must require human review");
  return unique(errors);
}

export const RUHROH_FOCUS_1_4_DATASETS: readonly RuhrohFocusDatasetIdV1[] = ["BillingPeriod", "ContractCommitment", "CostAndUsage", "InvoiceDetail"];
function validateVersioned(value: unknown, version: string, required: string[]): string[] {
  if (!isRecord(value)) return [`${version} must be an object`];
  const errors: string[] = [];
  if (value.version !== version) errors.push(`version must be ${version}`);
  for (const field of required) if (value[field] === undefined || value[field] === "") errors.push(`${field} is required`);
  return errors;
}
export function validateRuhrohFocusRef(value: unknown, label = "ref"): string[] { return validateRef(value, label); }
function validateRef(value: unknown, label: string): string[] { return !isRecord(value) || !safePath(value.path) || !sha256(value.sha256) ? [`${label} must contain a safe path and SHA-256`] : []; }
export function isRuhrohFocusDatasetId(value: unknown): value is RuhrohFocusDatasetIdV1 { return isDataset(value); }
function isDataset(value: unknown): value is RuhrohFocusDatasetIdV1 { return typeof value === "string" && RUHROH_FOCUS_1_4_DATASETS.includes(value as RuhrohFocusDatasetIdV1); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function timestamp(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function gitSha(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value); }
function sha256(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value); }
function safePath(value: unknown): value is string { return nonEmpty(value) && !value.startsWith("/") && !value.split(/[/\\]/u).includes(".."); }
function canonicalDecimal(value: unknown): value is string { return typeof value === "string" && /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*[1-9])?$/u.test(value); }
function unique(values: string[]): string[] { return [...new Set(values)]; }
