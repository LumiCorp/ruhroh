#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import type { RuhrohScenarioTier } from "./scenarios.js";
type RuhrohEvaluatorTemplate = "review" | "deterministic" | "model" | "hybrid";
type RuhrohAdapterTemplate = "generic" | "codex-cli" | "claude-code" | "gemini-cli" | "aider" | "fixture";
interface RuntimeDeps {
    spawn: typeof spawnSync;
    env: NodeJS.ProcessEnv;
    cwd: string;
    stdout: Pick<NodeJS.WriteStream, "write">;
    stderr: Pick<NodeJS.WriteStream, "write">;
    stdin?: NodeJS.ReadStream | undefined;
}
export interface RuhrohCliOptions {
    command: "run" | "demo" | "generate" | "list" | "list-suites" | "plan" | "validate" | "inspect-pack" | "validate-artifacts" | "validate-targets" | "validate-claim" | "validate-summary" | "validate-bundle" | "claim-index" | "report" | "compare" | "review" | "eval-quality" | "publish-check" | "explain" | "examples" | "first-run" | "workflow" | "doctor" | "init" | "new-scenario" | "new-suite" | "new-adapter" | "new-evaluator" | "calibrate-evaluator";
    list: boolean;
    listSuites: boolean;
    dryRun: boolean;
    generateOnly: boolean;
    json: boolean;
    allowDryRun: boolean;
    requirePublishable: boolean;
    requireCalibrated: boolean;
    requireRiskReviewed: boolean;
    verifySources: boolean;
    fresh: boolean;
    harborBin: string;
    scenarioDir: string;
    scenarioDirExplicit: boolean;
    suiteDir: string;
    suiteDirExplicit: boolean;
    generatedDir: string;
    runs: number;
    shard?: RuhrohRunShard | undefined;
    inputPath?: string | undefined;
    explainCode?: string | undefined;
    scenarioId?: string | undefined;
    suiteScenarioIds: string[];
    suiteId?: string | undefined;
    tier?: RuhrohScenarioTier | undefined;
    iterations?: number | undefined;
    adapter?: string | undefined;
    targetConfigPath?: string | undefined;
    targets: string[];
    evaluator?: string | undefined;
    evaluatorTemplate: RuhrohEvaluatorTemplate;
    adapterTemplate: RuhrohAdapterTemplate;
    templateExplicit: boolean;
    adapters: string[];
    htmlPath?: string | undefined;
    summaryMarkdownPath?: string | undefined;
    runPlanPath?: string | undefined;
    rerunLedgerPath?: string | undefined;
    benchmarkClaimPath?: string | undefined;
    benchmarkSummaryPath?: string | undefined;
    bundlePath?: string | undefined;
    demoModel?: string | undefined;
}
interface RuhrohRunShard {
    index: number;
    total: number;
}
export declare function parseRuhrohCliArgs(argv: string[], cwd?: string): RuhrohCliOptions;
export declare function runRuhrohCli(argv: string[], deps: RuntimeDeps): Promise<number>;
export declare function resolveRuhrohPackageRoot(): string;
export declare function resolveRuhrohPythonPath(): string;
export declare function buildHarborSpawnEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export {};
//# sourceMappingURL=cli.d.ts.map