#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import type { RuhrohScenarioTier } from "./scenarios.js";
interface RuntimeDeps {
    spawn: typeof spawnSync;
    env: NodeJS.ProcessEnv;
    cwd: string;
    stdout: Pick<NodeJS.WriteStream, "write">;
    stderr: Pick<NodeJS.WriteStream, "write">;
}
export interface RuhrohCliOptions {
    command: "run" | "generate" | "validate" | "report" | "compare";
    list: boolean;
    dryRun: boolean;
    generateOnly: boolean;
    json: boolean;
    harborBin: string;
    scenarioDir: string;
    generatedDir: string;
    inputPath?: string | undefined;
    scenarioId?: string | undefined;
    tier?: RuhrohScenarioTier | undefined;
    iterations?: number | undefined;
    adapter?: string | undefined;
}
export declare function parseRuhrohCliArgs(argv: string[], cwd?: string): RuhrohCliOptions;
export declare function runRuhrohCli(argv: string[], deps: RuntimeDeps): Promise<number>;
export declare function resolveRuhrohPackageRoot(): string;
export declare function resolveRuhrohPythonPath(): string;
export declare function buildHarborSpawnEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export {};
//# sourceMappingURL=cli.d.ts.map