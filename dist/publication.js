import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { validateRuhrohBenchmarkClaim, validateRuhrohBenchmarkSummary, } from "./results.js";
const REQUIRED_PUBLISH_BUNDLE_ROLES = [
    "manifest",
    "publish-check",
    "compare-html",
    "benchmark-claim",
    "benchmark-summary",
    "review-json",
    "review-html",
    "eval-quality",
    "eval-quality-html",
    "readme",
];
const PUBLISH_CHECK_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-check-v1.schema.json";
const PUBLISH_BUNDLE_SCHEMA_URL = "https://lumicorp.github.io/ruhroh/schemas/publish-bundle-v1.schema.json";
export function buildRuhrohPublishCheckReport(input) {
    const benchmarkClaim = isRecord(input.compare.benchmarkClaim) ? input.compare.benchmarkClaim : undefined;
    if (benchmarkClaim === undefined) {
        throw new Error("publish-check compare output must include benchmarkClaim");
    }
    const readiness = isRecord(input.compare.claimReadiness) ? input.compare.claimReadiness : {};
    const sourceVerificationErrors = input.sourceVerification?.errors.map((error) => `source verification: ${error}`) ?? [];
    const sourceVerificationWarnings = input.sourceVerification?.warnings.map((warning) => `source verification: ${warning}`) ?? [];
    const publishabilityGate = benchmarkClaimPublishabilityGate(benchmarkClaim);
    const blockers = uniquePreserveOrder([
        ...publishabilityGate.blockers,
        ...sourceVerificationErrors,
    ]);
    const advisories = uniquePreserveOrder([
        ...stringArrayField(readiness, "advisories"),
        ...sourceVerificationWarnings,
    ]);
    return {
        $schema: PUBLISH_CHECK_SCHEMA_URL,
        version: "ruhroh_publish_check_v1",
        source: input.source,
        publishable: publishabilityGate.publishable && sourceVerificationErrors.length === 0,
        blockerCount: blockers.length,
        blockers,
        remediation: blockers.map(ruhrohPublishCheckRemediationForBlocker),
        advisoryCount: advisories.length,
        advisories,
        compare: input.compare,
        ...(input.sourceVerification === undefined ? {} : { sourceVerification: input.sourceVerification }),
    };
}
export function ruhrohPublishCheckRemediationCatalog() {
    return [
        ruhrohPublishCheckRemediationForBlocker("source verification: source file hash mismatch"),
        ruhrohPublishCheckRemediationForBlocker("no suite selected; use compare --suite for publishable benchmark claims"),
        ruhrohPublishCheckRemediationForBlocker("missing suite scenario: example-scenario"),
        ruhrohPublishCheckRemediationForBlocker("example-adapter: suite minimum runs or scenario coverage not satisfied"),
        ruhrohPublishCheckRemediationForBlocker("run plan warning: planned sample has no result artifact"),
        ruhrohPublishCheckRemediationForBlocker("artifact validation failed: 1 error(s)"),
        ruhrohPublishCheckRemediationForBlocker("review item: example run requires human review"),
        ruhrohPublishCheckRemediationForBlocker("eval-quality warnings present: missing evidenceRefs"),
        ruhrohPublishCheckRemediationForBlocker("pairwise comparison inconclusive: Fisher exact test is not significant"),
        ruhrohPublishCheckRemediationForBlocker("claim is not marked publishable"),
        ruhrohPublishCheckRemediationForBlocker("unclassified readiness blocker"),
    ];
}
export function ruhrohPublishCheckRemediationForBlocker(blocker) {
    const normalized = blocker.toLowerCase();
    if (normalized.includes("source verification")) {
        return {
            code: "source_verification_failed",
            category: "source_verification",
            severity: "blocker",
            blocker,
            action: "Re-run publish-check with current artifacts, or restore the claim's referenced files so every recorded hash matches.",
            docs: "publish-claims#what-it-checks",
        };
    }
    if (normalized.includes("no suite selected")) {
        return {
            code: "suite_required",
            category: "suite",
            severity: "blocker",
            blocker,
            action: "Select the benchmark suite with --suite-dir and --suite before publishing a benchmark claim.",
            docs: "benchmark-suites",
        };
    }
    if (normalized.includes("missing suite scenario")) {
        return {
            code: "suite_scenario_missing",
            category: "suite",
            severity: "blocker",
            blocker,
            action: "Collect runs for the missing suite scenario or publish against a suite version whose membership matches the result set.",
            docs: "benchmark-suites#compare-a-suite",
        };
    }
    if (normalized.includes("minimum runs") || normalized.includes("fewer than")) {
        return {
            code: "minimum_runs_not_met",
            category: "statistics",
            severity: "blocker",
            blocker,
            action: "Collect enough repeated samples for each scenario/adapter group to satisfy the suite methodology.",
            docs: "benchmark-methodology#sample-size",
        };
    }
    if (normalized.includes("run plan warning")) {
        return {
            code: "run_plan_mismatch",
            category: "run_plan",
            severity: "blocker",
            blocker,
            action: "Compare against the run plan generated for this run, or collect the missing planned samples before publishing.",
            docs: "publish-claims#what-it-checks",
        };
    }
    if (normalized.includes("artifact validation failed") || normalized.includes("artifact-completeness")) {
        return {
            code: "artifact_evidence_incomplete",
            category: "artifacts",
            severity: "blocker",
            blocker,
            action: "Run validate-artifacts on the result root and repair missing or inconsistent run evidence before publishing.",
            docs: "artifacts#validate-artifacts",
        };
    }
    if (normalized.includes("review item")) {
        return {
            code: "human_review_required",
            category: "review",
            severity: "blocker",
            blocker,
            action: "Open the review queue, resolve evaluator review items, and re-run compare before citing the result.",
            docs: "eval-agent#quality-checks",
        };
    }
    if (normalized.includes("evidence") || normalized.includes("judge") || normalized.includes("criteria")) {
        return {
            code: "evaluator_evidence_weak",
            category: "review",
            severity: "blocker",
            blocker,
            action: "Strengthen the evaluator output with concrete evidenceRefs, criteriaResults, commandsRun, and judge metadata.",
            docs: "write-an-evaluator#quality-bar",
        };
    }
    if (normalized.includes("fisher") || normalized.includes("delta") || normalized.includes("significant") || normalized.includes("inconclusive")) {
        return {
            code: "comparison_inconclusive",
            category: "comparison",
            severity: "blocker",
            blocker,
            action: "Collect more paired samples or present the comparison as inconclusive instead of a publishable superiority claim.",
            docs: "benchmark-methodology#statistics",
        };
    }
    if (normalized.includes("claim is not marked publishable")) {
        return {
            code: "claim_not_publishable",
            category: "claim",
            severity: "blocker",
            blocker,
            action: "Resolve all readiness blockers, then regenerate the claim with compare or publish-check.",
            docs: "publish-claims",
        };
    }
    return {
        code: "claim_readiness_blocker",
        category: "claim",
        severity: "blocker",
        blocker,
        action: "Inspect the blocker, fix the underlying evidence or methodology gap, and re-run publish-check.",
        docs: "publish-claims#common-blockers",
    };
}
export function verifyRuhrohBenchmarkClaimSources(claim, claimPath) {
    const checks = [];
    const sourceBaseDir = path.dirname(path.resolve(claimPath));
    const source = isRecord(claim.source) ? claim.source : undefined;
    if (source === undefined) {
        return {
            version: "ruhroh_claim_source_verification_v1",
            checked: false,
            checks,
            errors: ["claim source is missing"],
            warnings: [],
        };
    }
    verifyOptionalHashedSourceFile(checks, "suite", source.suitePath, source.suiteSha256, "source.suitePath", "source.suiteSha256", sourceBaseDir);
    verifyOptionalHashedSourceFile(checks, "runPlan", source.runPlanPath, source.runPlanSha256, "source.runPlanPath", "source.runPlanSha256", sourceBaseDir);
    verifyOptionalHashedSourceFile(checks, "rerunLedger", source.rerunLedgerPath, source.rerunLedgerSha256, "source.rerunLedgerPath", "source.rerunLedgerSha256", sourceBaseDir);
    verifyOptionalHashedSourceFile(checks, "evaluatorCalibrationReport", source.evaluatorCalibrationReportPath, source.evaluatorCalibrationReportSha256, "source.evaluatorCalibrationReportPath", "source.evaluatorCalibrationReportSha256", sourceBaseDir);
    const resultArtifacts = source.resultArtifacts;
    if (!Array.isArray(resultArtifacts) || resultArtifacts.length === 0) {
        checks.push({
            name: "resultArtifacts",
            status: "warning",
            details: "source.resultArtifacts is empty or missing",
        });
    }
    else {
        for (const [index, artifact] of resultArtifacts.entries()) {
            if (!isRecord(artifact)) {
                checks.push({
                    name: `resultArtifacts[${index}]`,
                    status: "failed",
                    details: `source.resultArtifacts[${index}] must be an object`,
                });
                continue;
            }
            verifyRequiredHashedSourceFile(checks, `resultArtifacts[${index}]`, artifact.path, artifact.sha256, `source.resultArtifacts[${index}].path`, `source.resultArtifacts[${index}].sha256`, sourceBaseDir);
            const inventory = artifact.artifactInventory;
            if (inventory !== undefined) {
                if (!Array.isArray(inventory)) {
                    checks.push({
                        name: `resultArtifacts[${index}].artifactInventory`,
                        status: "failed",
                        details: `source.resultArtifacts[${index}].artifactInventory must be an array`,
                    });
                }
                else {
                    for (const [inventoryIndex, inventoryItem] of inventory.entries()) {
                        verifyBenchmarkClaimInventoryItem(checks, inventoryItem, index, inventoryIndex, sourceBaseDir);
                    }
                }
            }
        }
    }
    if (typeof source.benchmarkClaimPath === "string" && resolveSourcePath(source.benchmarkClaimPath, sourceBaseDir) !== path.resolve(claimPath)) {
        checks.push({
            name: "benchmarkClaimPath",
            status: "warning",
            path: source.benchmarkClaimPath,
            details: "source.benchmarkClaimPath does not match the validated claim path",
        });
    }
    return {
        version: "ruhroh_claim_source_verification_v1",
        checked: true,
        checks,
        errors: checks.filter((check) => check.status === "failed").map(formatClaimSourceVerificationCheck),
        warnings: checks.filter((check) => check.status === "warning").map(formatClaimSourceVerificationCheck),
    };
}
export function validateRuhrohPublishBundle(inputPath) {
    const bundlePath = path.resolve(inputPath);
    if (!existsSync(bundlePath)) {
        throw new Error(`Path does not exist: ${bundlePath}`);
    }
    if (!statSync(bundlePath).isDirectory()) {
        throw new Error(`Publication bundle path is not a directory: ${bundlePath}`);
    }
    const checks = [];
    const manifestPath = path.join(bundlePath, "manifest.json");
    checks.push(publishBundleFilePresenceCheck("manifest", manifestPath));
    const manifest = readPublishBundleJson(checks, "manifest", manifestPath);
    const rolePaths = manifest === undefined
        ? new Map()
        : publishBundleRolePaths(manifest, bundlePath, checks);
    for (const role of REQUIRED_PUBLISH_BUNDLE_ROLES) {
        if (!rolePaths.has(role)) {
            checks.push({
                name: `files.${role}`,
                status: "failed",
                details: `bundle manifest does not list required role ${role}`,
            });
        }
    }
    const publishCheck = readPublishBundleJsonRole(checks, rolePaths, "publish-check");
    const benchmarkClaim = readPublishBundleJsonRole(checks, rolePaths, "benchmark-claim");
    const benchmarkSummary = readPublishBundleJsonRole(checks, rolePaths, "benchmark-summary");
    readPublishBundleJsonRole(checks, rolePaths, "review-json");
    readPublishBundleJsonRole(checks, rolePaths, "eval-quality");
    const evaluatorCalibrationReport = readPublishBundleJsonRole(checks, rolePaths, "evaluator-calibration-report");
    if (manifest !== undefined) {
        checks.push(publishBundleSchemaCheck("manifest.$schema", manifestPath, manifest, PUBLISH_BUNDLE_SCHEMA_URL));
        checks.push(publishBundleVersionCheck("manifest.version", manifestPath, manifest, "ruhroh_publish_bundle_v1"));
        if (isRecord(manifest.source) && typeof manifest.source.bundlePath === "string" && resolveSourcePath(manifest.source.bundlePath, bundlePath) !== bundlePath) {
            checks.push({
                name: "manifest.source.bundlePath",
                status: "warning",
                path: manifestPath,
                details: `manifest source bundlePath points at ${manifest.source.bundlePath}; validated bundle is ${bundlePath}`,
            });
        }
    }
    if (publishCheck !== undefined) {
        checks.push(publishBundleVersionCheck("publish-check.version", rolePaths.get("publish-check") ?? "", publishCheck, "ruhroh_publish_check_v1"));
    }
    if (benchmarkClaim !== undefined) {
        const claimPath = rolePaths.get("benchmark-claim") ?? "";
        checks.push(publishBundleVersionCheck("benchmark-claim.version", claimPath, benchmarkClaim, "ruhroh_benchmark_claim_v1"));
        const claimValidation = validateRuhrohBenchmarkClaim(benchmarkClaim);
        checks.push(...claimValidation.errors.map((error) => publishBundleValidationFailure("benchmark-claim.validation", claimPath, error)));
        checks.push(...claimValidation.warnings.map((warning) => publishBundleValidationWarning("benchmark-claim.validation", claimPath, warning)));
        if (claimValidation.errors.length === 0) {
            checks.push({
                name: "benchmark-claim.validation",
                status: "ok",
                path: claimPath,
                details: "benchmark claim validation passed",
            });
        }
        const claimSourceVerification = verifyRuhrohBenchmarkClaimSources(benchmarkClaim, claimPath);
        for (const check of claimSourceVerification.checks) {
            checks.push({
                name: `benchmark-claim.source.${check.name}`,
                status: check.status,
                ...(check.path === undefined ? {} : { path: check.path }),
                details: check.details,
            });
        }
    }
    if (benchmarkSummary !== undefined) {
        const summaryPath = rolePaths.get("benchmark-summary") ?? "";
        checks.push(publishBundleVersionCheck("benchmark-summary.version", summaryPath, benchmarkSummary, "ruhroh_benchmark_summary_v1"));
        const summaryValidation = validateRuhrohBenchmarkSummary(benchmarkSummary);
        checks.push(...summaryValidation.errors.map((error) => publishBundleValidationFailure("benchmark-summary.validation", summaryPath, error)));
        checks.push(...summaryValidation.warnings.map((warning) => publishBundleValidationWarning("benchmark-summary.validation", summaryPath, warning)));
        if (summaryValidation.errors.length === 0) {
            checks.push({
                name: "benchmark-summary.validation",
                status: "ok",
                path: summaryPath,
                details: "benchmark summary validation passed",
            });
        }
    }
    if (evaluatorCalibrationReport !== undefined) {
        const calibrationReportPath = rolePaths.get("evaluator-calibration-report") ?? "";
        checks.push(publishBundleVersionCheck("evaluator-calibration-report.version", calibrationReportPath, evaluatorCalibrationReport, "ruhroh_eval_calibration_report_v1"));
        validateEvaluatorCalibrationReportEvidence(checks, evaluatorCalibrationReport, bundlePath, calibrationReportPath);
    }
    validatePublishBundleCrossReferences(checks, manifest, publishCheck, benchmarkClaim, benchmarkSummary, rolePaths);
    const errors = checks.filter((check) => check.status === "failed").map(formatPublishBundleValidationCheck);
    const warnings = checks.filter((check) => check.status === "warning").map(formatPublishBundleValidationCheck);
    return {
        version: "ruhroh_publish_bundle_validation_report_v1",
        source: { bundlePath },
        valid: errors.length === 0,
        publishable: errors.length === 0 && publishCheck?.publishable === true && benchmarkClaimPublishabilityGate(benchmarkClaim ?? {}).publishable,
        checks,
        errors,
        warnings,
    };
}
function verifyBenchmarkClaimInventoryItem(checks, inventoryItem, artifactIndex, inventoryIndex, sourceBaseDir) {
    const name = `resultArtifacts[${artifactIndex}].artifactInventory[${inventoryIndex}]`;
    if (!isRecord(inventoryItem)) {
        checks.push({
            name,
            status: "failed",
            details: `source.${name} must be an object`,
        });
        return;
    }
    if (inventoryItem.available !== true) {
        return;
    }
    verifyRequiredHashedSourceFile(checks, name, inventoryItem.path, inventoryItem.sha256, `source.${name}.path`, `source.${name}.sha256`, sourceBaseDir);
    const inventorySourcePath = typeof inventoryItem.path === "string" ? inventoryItem.path : undefined;
    const inventoryItemPath = inventorySourcePath === undefined ? undefined : resolveSourcePath(inventorySourcePath, sourceBaseDir);
    if (typeof inventoryItem.sizeBytes === "number" && inventoryItemPath !== undefined && existsSync(inventoryItemPath)) {
        try {
            const actualSize = statSync(inventoryItemPath).size;
            if (actualSize !== inventoryItem.sizeBytes) {
                checks.push({
                    name,
                    status: "failed",
                    path: inventorySourcePath,
                    details: `${name} size mismatch: expected ${inventoryItem.sizeBytes}, found ${actualSize}`,
                });
            }
        }
        catch (error) {
            checks.push({
                name,
                status: "failed",
                path: inventorySourcePath,
                details: `${name} size check failed: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }
}
function verifyOptionalHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel, baseDir) {
    if (filePath === undefined && expectedSha256 === undefined) {
        return;
    }
    verifyRequiredHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel, baseDir);
}
function verifyRequiredHashedSourceFile(checks, name, filePath, expectedSha256, pathLabel, hashLabel, baseDir) {
    if (typeof filePath !== "string" || filePath.trim().length === 0) {
        checks.push({
            name,
            status: "failed",
            details: `${pathLabel} must be a non-empty string`,
        });
        return;
    }
    const resolvedFilePath = resolveSourcePath(filePath, baseDir);
    if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedSha256)) {
        checks.push({
            name,
            status: "failed",
            path: filePath,
            details: `${hashLabel} must be a lowercase SHA-256 digest`,
        });
        return;
    }
    if (!existsSync(resolvedFilePath)) {
        checks.push({
            name,
            status: "failed",
            path: filePath,
            expectedSha256,
            details: `${pathLabel} does not exist`,
        });
        return;
    }
    try {
        const actualSha256 = sha256File(resolvedFilePath);
        checks.push({
            name,
            status: actualSha256 === expectedSha256 ? "ok" : "failed",
            path: filePath,
            expectedSha256,
            actualSha256,
            details: actualSha256 === expectedSha256
                ? `${pathLabel} hash matches`
                : `${pathLabel} hash mismatch`,
        });
    }
    catch (error) {
        checks.push({
            name,
            status: "failed",
            path: filePath,
            expectedSha256,
            details: `${pathLabel} could not be hashed: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}
function publishBundleRolePaths(manifest, bundlePath, checks) {
    const rolePaths = new Map();
    const files = manifest.files;
    if (!Array.isArray(files)) {
        checks.push({
            name: "manifest.files",
            status: "failed",
            path: path.join(bundlePath, "manifest.json"),
            details: "manifest files must be an array",
        });
        return rolePaths;
    }
    for (const [index, file] of files.entries()) {
        if (!isRecord(file)) {
            checks.push({
                name: `manifest.files[${index}]`,
                status: "failed",
                path: path.join(bundlePath, "manifest.json"),
                details: "file entry must be an object",
            });
            continue;
        }
        const role = stringField(file, "role");
        const filePath = stringField(file, "path");
        if (role === undefined || filePath === undefined) {
            checks.push({
                name: `manifest.files[${index}]`,
                status: "failed",
                path: path.join(bundlePath, "manifest.json"),
                details: "file entry must include non-empty role and path strings",
            });
            continue;
        }
        if (rolePaths.has(role)) {
            checks.push({
                name: `manifest.files.${role}`,
                status: "failed",
                path: path.join(bundlePath, "manifest.json"),
                details: `duplicate file role ${role}`,
            });
            continue;
        }
        const resolvedFilePath = resolvePublishBundleFilePath(bundlePath, filePath);
        if (resolvedFilePath === undefined) {
            checks.push({
                name: `manifest.files.${role}`,
                status: "failed",
                path: path.join(bundlePath, "manifest.json"),
                details: `file path must be relative and stay inside the bundle: ${filePath}`,
            });
            continue;
        }
        rolePaths.set(role, resolvedFilePath);
        checks.push(publishBundleFilePresenceCheck(`files.${role}`, resolvedFilePath));
    }
    return rolePaths;
}
function resolvePublishBundleFilePath(bundlePath, filePath) {
    if (path.isAbsolute(filePath)) {
        return undefined;
    }
    const resolved = path.resolve(bundlePath, filePath);
    const relative = path.relative(bundlePath, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        return undefined;
    }
    return resolved;
}
function readPublishBundleJsonRole(checks, rolePaths, role) {
    const filePath = rolePaths.get(role);
    if (filePath === undefined || !existsSync(filePath) || !statSync(filePath).isFile()) {
        return undefined;
    }
    return readPublishBundleJson(checks, role, filePath);
}
function readPublishBundleJson(checks, name, filePath) {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        return undefined;
    }
    try {
        return readJsonObject(filePath);
    }
    catch (error) {
        checks.push({
            name: `${name}.json`,
            status: "failed",
            path: filePath,
            details: error instanceof Error ? error.message : String(error),
        });
        return undefined;
    }
}
function validatePublishBundleCrossReferences(checks, manifest, publishCheck, benchmarkClaim, benchmarkSummary, rolePaths) {
    const manifestPath = rolePaths.get("manifest") ?? "";
    const publishCheckPath = rolePaths.get("publish-check") ?? "";
    if (manifest !== undefined && publishCheck !== undefined) {
        if (manifest.publishable !== publishCheck.publishable) {
            checks.push(publishBundleValidationFailure("manifest.publishable", manifestPath, "manifest publishable must match publish-check publishable"));
        }
        if (manifest.blockerCount !== publishCheck.blockerCount) {
            checks.push(publishBundleValidationFailure("manifest.blockerCount", manifestPath, "manifest blockerCount must match publish-check blockerCount"));
        }
        if (manifest.advisoryCount !== publishCheck.advisoryCount) {
            checks.push(publishBundleValidationFailure("manifest.advisoryCount", manifestPath, "manifest advisoryCount must match publish-check advisoryCount"));
        }
    }
    const compare = isRecord(publishCheck?.compare) ? publishCheck.compare : undefined;
    if (publishCheck !== undefined && compare === undefined) {
        checks.push(publishBundleValidationFailure("publish-check.compare", publishCheckPath, "publish-check report must include compare output"));
    }
    if (compare !== undefined && benchmarkClaim !== undefined) {
        if (stableJsonStringify(compare.benchmarkClaim) !== stableJsonStringify(benchmarkClaim)) {
            checks.push(publishBundleValidationFailure("benchmark-claim.cross-reference", rolePaths.get("benchmark-claim") ?? "", "benchmark-claim.json must match publish-check.compare.benchmarkClaim"));
        }
        else {
            checks.push({
                name: "benchmark-claim.cross-reference",
                status: "ok",
                path: rolePaths.get("benchmark-claim"),
                details: "benchmark claim matches publish-check compare output",
            });
        }
    }
    if (compare !== undefined && benchmarkSummary !== undefined) {
        if (stableJsonStringify(compare.benchmarkSummary) !== stableJsonStringify(benchmarkSummary)) {
            checks.push(publishBundleValidationFailure("benchmark-summary.cross-reference", rolePaths.get("benchmark-summary") ?? "", "benchmark-summary.json must match publish-check.compare.benchmarkSummary"));
        }
        else {
            checks.push({
                name: "benchmark-summary.cross-reference",
                status: "ok",
                path: rolePaths.get("benchmark-summary"),
                details: "benchmark summary matches publish-check compare output",
            });
        }
    }
}
function benchmarkClaimPublishabilityGate(claim) {
    const readiness = isRecord(claim.readiness) ? claim.readiness : {};
    const evidence = isRecord(claim.evidence) ? claim.evidence : {};
    const suiteCoverage = isRecord(claim.suiteCoverage) ? claim.suiteCoverage : undefined;
    const blockers = [
        ...stringArrayField(readiness, "blockers"),
        ...(claim.scope === "suite" ? [] : ["no suite selected; use compare --suite for publishable benchmark claims"]),
        ...(claim.publishable === true && readiness.publishable === true ? [] : ["claim is not marked publishable"]),
        ...stringArrayField(evidence, "runPlanWarnings").map((warning) => `run plan warning: ${warning}`),
        ...(numberField(evidence, "artifactValidationErrors") > 0 ? [`artifact validation failed: ${numberField(evidence, "artifactValidationErrors")} error(s)`] : []),
        ...(numberField(evidence, "artifactCompletenessWarnings") > 0 ? ["artifact-completeness warnings present"] : []),
        ...(numberField(evidence, "requiredReviewItems") > 0 ? [`${numberField(evidence, "requiredReviewItems")} review item(s) required`] : []),
        ...suiteCoverageBlockers(suiteCoverage),
        ...recordArrayField(claim, "adapterSummaries").flatMap(adapterSummaryPublishabilityBlockers),
        ...recordArrayField(claim, "scenarioResults").flatMap(scenarioResultPublishabilityBlockers),
        ...recordArrayField(claim, "pairwiseComparisons").flatMap(pairwisePublishabilityBlockers),
    ];
    const uniqueBlockers = uniquePreserveOrder(blockers);
    return {
        publishable: uniqueBlockers.length === 0,
        blockers: uniqueBlockers,
    };
}
function suiteCoverageBlockers(suiteCoverage) {
    if (suiteCoverage === undefined) {
        return [];
    }
    return [
        ...(suiteCoverage.minRunsSatisfied === false ? ["suite minimum runs or scenario coverage not satisfied"] : []),
        ...stringArrayField(suiteCoverage, "missingScenarioIds").map((scenarioId) => `missing suite scenario ${scenarioId}`),
        ...recordArrayField(suiteCoverage, "adapters").flatMap((adapter) => [
            ...(adapter.minRunsSatisfied === false ? [`${stringField(adapter, "adapter") ?? "adapter"}: suite minimum runs or scenario coverage not satisfied`] : []),
            ...stringArrayField(adapter, "missingScenarioIds").map((scenarioId) => `${stringField(adapter, "adapter") ?? "adapter"}: missing suite scenario ${scenarioId}`),
            ...stringArrayField(adapter, "warnings").map((warning) => `${stringField(adapter, "adapter") ?? "adapter"}: ${warning}`),
        ]),
    ];
}
function adapterSummaryPublishabilityBlockers(adapterSummary) {
    if (adapterSummary.minRunsSatisfied !== false) {
        return [];
    }
    return [`${stringField(adapterSummary, "adapter") ?? "adapter"}: suite minimum runs or scenario coverage not satisfied`];
}
function scenarioResultPublishabilityBlockers(scenarioResult) {
    const label = `${stringField(scenarioResult, "scenarioId") ?? "scenario"}/${stringField(scenarioResult, "adapter") ?? "adapter"}`;
    return stringArrayField(scenarioResult, "statisticalWarnings").map((warning) => `${label}: ${warning}`);
}
function pairwisePublishabilityBlockers(comparison) {
    const label = [
        stringField(comparison, "scenarioId") ?? "scenario",
        `${stringField(comparison, "contenderAdapter") ?? "contender"} vs ${stringField(comparison, "baselineAdapter") ?? "baseline"}`,
    ].join("/");
    return stringArrayField(comparison, "warnings").map((warning) => `${label}: ${warning}`);
}
function publishBundleFilePresenceCheck(name, filePath) {
    if (!existsSync(filePath)) {
        return {
            name,
            status: "failed",
            path: filePath,
            details: "bundle file is missing",
        };
    }
    if (!statSync(filePath).isFile()) {
        return {
            name,
            status: "failed",
            path: filePath,
            details: "bundle path is not a file",
        };
    }
    return {
        name,
        status: "ok",
        path: filePath,
        details: "bundle file is present",
    };
}
function publishBundleDirectoryPresenceCheck(name, directoryPath) {
    if (!existsSync(directoryPath)) {
        return {
            name,
            status: "failed",
            path: directoryPath,
            details: "bundle directory is missing",
        };
    }
    if (!statSync(directoryPath).isDirectory()) {
        return {
            name,
            status: "failed",
            path: directoryPath,
            details: "bundle path is not a directory",
        };
    }
    return {
        name,
        status: "ok",
        path: directoryPath,
        details: "bundle directory is present",
    };
}
function validateEvaluatorCalibrationReportEvidence(checks, report, bundlePath, reportPath) {
    const source = isRecord(report.source) ? report.source : undefined;
    const sourceReportPath = source === undefined ? undefined : stringField(source, "reportPath");
    if (sourceReportPath !== undefined) {
        const resolvedSourceReportPath = resolvePublishBundleFilePath(bundlePath, sourceReportPath);
        if (resolvedSourceReportPath === undefined) {
            checks.push(publishBundleValidationFailure("evaluator-calibration-report.source.reportPath", reportPath, `reportPath must be relative and stay inside the bundle: ${sourceReportPath}`));
        }
        else if (reportPath.length > 0 && path.resolve(resolvedSourceReportPath) !== path.resolve(reportPath)) {
            checks.push(publishBundleValidationWarning("evaluator-calibration-report.source.reportPath", reportPath, `reportPath points at ${sourceReportPath}; manifest role points at ${path.relative(bundlePath, reportPath) || reportPath}`));
        }
        else {
            checks.push({
                name: "evaluator-calibration-report.source.reportPath",
                status: "ok",
                path: resolvedSourceReportPath,
                details: "reportPath matches the bundle manifest role",
            });
        }
    }
    if (!Array.isArray(report.results)) {
        checks.push(publishBundleValidationFailure("evaluator-calibration-report.results", reportPath, "results must be an array"));
        return;
    }
    for (const [index, result] of report.results.entries()) {
        const name = `evaluator-calibration-report.results[${index}]`;
        if (!isRecord(result)) {
            checks.push(publishBundleValidationFailure(name, reportPath, "calibration result must be an object"));
            continue;
        }
        validateCalibrationResultFilePath(checks, name, "inputPath", result, bundlePath, reportPath);
        validateCalibrationResultFilePath(checks, name, "outputPath", result, bundlePath, reportPath);
        validateCalibrationResultWorkspacePath(checks, name, result, bundlePath, reportPath);
    }
}
function validateCalibrationResultFilePath(checks, name, field, result, bundlePath, reportPath) {
    const itemPath = stringField(result, field);
    if (itemPath === undefined) {
        checks.push(publishBundleValidationFailure(`${name}.${field}`, reportPath, `${field} is required`));
        return;
    }
    const resolved = resolvePublishBundleFilePath(bundlePath, itemPath);
    if (resolved === undefined) {
        checks.push(publishBundleValidationFailure(`${name}.${field}`, reportPath, `${field} must be relative and stay inside the bundle: ${itemPath}`));
        return;
    }
    checks.push(publishBundleFilePresenceCheck(`${name}.${field}`, resolved));
}
function validateCalibrationResultWorkspacePath(checks, name, result, bundlePath, reportPath) {
    const itemPath = stringField(result, "workspacePath");
    if (itemPath === undefined) {
        checks.push(publishBundleValidationFailure(`${name}.workspacePath`, reportPath, "workspacePath is required"));
        return;
    }
    const resolved = resolvePublishBundleFilePath(bundlePath, itemPath);
    if (resolved === undefined) {
        checks.push(publishBundleValidationFailure(`${name}.workspacePath`, reportPath, `workspacePath must be relative and stay inside the bundle: ${itemPath}`));
        return;
    }
    checks.push(publishBundleDirectoryPresenceCheck(`${name}.workspacePath`, resolved));
}
function publishBundleVersionCheck(name, filePath, value, expectedVersion) {
    if (value.version !== expectedVersion) {
        return publishBundleValidationFailure(name, filePath, `expected version ${expectedVersion}, found ${typeof value.version === "string" ? value.version : "missing"}`);
    }
    return {
        name,
        status: "ok",
        path: filePath,
        details: `version=${expectedVersion}`,
    };
}
function publishBundleSchemaCheck(name, filePath, value, expectedSchemaUrl) {
    if (value.$schema !== expectedSchemaUrl) {
        return publishBundleValidationWarning(name, filePath, `expected $schema ${expectedSchemaUrl}, found ${typeof value.$schema === "string" ? value.$schema : "missing"}`);
    }
    return {
        name,
        status: "ok",
        path: filePath,
        details: `$schema=${expectedSchemaUrl}`,
    };
}
function publishBundleValidationFailure(name, filePath, details) {
    return {
        name,
        status: "failed",
        ...(filePath.length === 0 ? {} : { path: filePath }),
        details,
    };
}
function publishBundleValidationWarning(name, filePath, details) {
    return {
        name,
        status: "warning",
        ...(filePath.length === 0 ? {} : { path: filePath }),
        details,
    };
}
function formatClaimSourceVerificationCheck(check) {
    const pathLabel = check.path === undefined ? "" : ` (${check.path})`;
    const hashLabel = check.expectedSha256 === undefined
        ? ""
        : ` expected=${check.expectedSha256}${check.actualSha256 === undefined ? "" : ` actual=${check.actualSha256}`}`;
    return `${check.name}: ${check.details}${pathLabel}${hashLabel}`;
}
function formatPublishBundleValidationCheck(check) {
    const pathLabel = check.path === undefined ? "" : ` (${check.path})`;
    return `${check.name}: ${check.details}${pathLabel}`;
}
function readJsonObject(filePath) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isRecord(parsed)) {
        throw new Error(`Expected JSON object in ${filePath}`);
    }
    return parsed;
}
function resolveSourcePath(filePath, baseDir) {
    return path.resolve(baseDir ?? process.cwd(), filePath);
}
function sha256File(filePath) {
    return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}
function stableJsonStringify(value) {
    if (Array.isArray(value)) {
        return `[${value.map(stableJsonStringify).join(",")}]`;
    }
    if (isRecord(value)) {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
}
function stringField(record, field) {
    const value = record[field];
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
function stringArrayField(record, field) {
    const value = record[field];
    return Array.isArray(value)
        ? value.filter((item) => typeof item === "string" && item.trim().length > 0)
        : [];
}
function recordArrayField(record, field) {
    const value = record[field];
    return Array.isArray(value)
        ? value.filter((item) => isRecord(item))
        : [];
}
function numberField(record, field) {
    const value = record[field];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function uniquePreserveOrder(values) {
    const seen = new Set();
    return values.filter((value) => {
        if (seen.has(value)) {
            return false;
        }
        seen.add(value);
        return true;
    });
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
//# sourceMappingURL=publication.js.map