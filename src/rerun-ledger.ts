import { readFileSync } from "node:fs";

export type RuhrohRerunLedgerDecision = "exclude" | "rerun";
export type RuhrohRerunLedgerReasonKind = "infrastructure" | "invalid_artifact" | "operator_error" | "other";

export interface RuhrohRerunLedger {
  version: "ruhroh_rerun_ledger_v1";
  entries: RuhrohRerunLedgerEntry[];
}

export interface RuhrohRerunLedgerEntry {
  sampleId: string;
  decision: RuhrohRerunLedgerDecision;
  reasonKind: RuhrohRerunLedgerReasonKind;
  reason: string;
  decidedBy: string;
  decidedAt: string;
}

export interface RuhrohRerunLedgerValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  ledger?: RuhrohRerunLedger | undefined;
}

export function validateRuhrohRerunLedger(value: unknown, sourceLabel = "Ruhroh rerun ledger"): RuhrohRerunLedgerValidationResult {
  if (!isRecord(value)) {
    return {
      valid: false,
      errors: [`Invalid ${sourceLabel}: entry must be an object`],
      warnings: [],
    };
  }
  if (value.version !== "ruhroh_rerun_ledger_v1") {
    return {
      valid: false,
      errors: [`Expected ruhroh_rerun_ledger_v1 in ${sourceLabel}`],
      warnings: [],
    };
  }
  if (!Array.isArray(value.entries)) {
    return {
      valid: false,
      errors: [`Invalid Ruhroh rerun ledger: entries must be an array in ${sourceLabel}`],
      warnings: [],
    };
  }

  const entries: RuhrohRerunLedgerEntry[] = [];
  const sampleIds = new Set<string>();
  const errors: string[] = [];
  for (const [index, entry] of value.entries.entries()) {
    if (!isRecord(entry)) {
      errors.push(`Invalid Ruhroh rerun ledger entry ${index}: entry must be an object`);
      continue;
    }
    const sampleId = stringField(entry, "sampleId");
    const decision = stringField(entry, "decision");
    const reasonKind = stringField(entry, "reasonKind");
    const reason = stringField(entry, "reason");
    const decidedBy = stringField(entry, "decidedBy");
    const decidedAt = stringField(entry, "decidedAt");
    if (sampleId === undefined || decision === undefined || reasonKind === undefined || reason === undefined || decidedBy === undefined || decidedAt === undefined) {
      errors.push(`Invalid Ruhroh rerun ledger entry ${index}: sampleId, decision, reasonKind, reason, decidedBy, and decidedAt are required`);
      continue;
    }
    if (!isRuhrohRerunLedgerDecision(decision)) {
      errors.push(`Invalid Ruhroh rerun ledger entry ${index}: decision must be exclude or rerun`);
      continue;
    }
    if (!isRuhrohRerunLedgerReasonKind(reasonKind)) {
      errors.push(`Invalid Ruhroh rerun ledger entry ${index}: reasonKind must be infrastructure, invalid_artifact, operator_error, or other`);
      continue;
    }
    if (sampleIds.has(sampleId)) {
      errors.push(`Invalid Ruhroh rerun ledger: duplicate sampleId ${sampleId}`);
      continue;
    }
    sampleIds.add(sampleId);
    entries.push({ sampleId, decision, reasonKind, reason, decidedBy, decidedAt });
  }

  return errors.length === 0
    ? { valid: true, errors: [], warnings: [], ledger: { version: "ruhroh_rerun_ledger_v1", entries } }
    : { valid: false, errors, warnings: [] };
}

export function loadRuhrohRerunLedger(filePath: string): RuhrohRerunLedger {
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  const validation = validateRuhrohRerunLedger(parsed, filePath);
  if (!validation.valid || validation.ledger === undefined) {
    throw new Error(validation.errors[0] ?? `Invalid Ruhroh rerun ledger: ${filePath}`);
  }
  return validation.ledger;
}

function isRuhrohRerunLedgerDecision(value: string): value is RuhrohRerunLedgerDecision {
  return value === "exclude" || value === "rerun";
}

function isRuhrohRerunLedgerReasonKind(value: string): value is RuhrohRerunLedgerReasonKind {
  return value === "infrastructure" || value === "invalid_artifact" || value === "operator_error" || value === "other";
}

function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
