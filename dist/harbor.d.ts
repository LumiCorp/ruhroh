import type { RuhrohScenario } from "./scenarios.js";
export declare const DEFAULT_RUHROH_DATASET_PATH = ".generated/ruhroh/harbor";
export declare const RUHROH_HARBOR_AGENT_IMPORT_PATH = "ruhroh.harbor_agent:RuhrohHarborAgent";
export declare const RUHROH_ARTIFACTS: readonly ["/installed-agent/ruhroh-loop-result.json", "/installed-agent/ruhroh-run-manifest.json", "/installed-agent/ruhroh-loop-iterations.jsonl", "/installed-agent/ruhroh-loop-journey.json", "/installed-agent/ruhroh-loop-eval-input.json", "/installed-agent/ruhroh-loop-eval.json", "/installed-agent/ruhroh-loop-bridge.jsonl", "/installed-agent/ruhroh-workspace-summary.json", "/installed-agent/ruhroh-workspace.tar.gz", "/installed-agent/ruhroh-loop-events.tar.gz", "/installed-agent/ruhroh-loop-transcripts.tar.gz"];
export interface BuildRuhrohHarborCommandInput {
    scenario: Pick<RuhrohScenario, "id" | "loop"> & Partial<Pick<RuhrohScenario, "evaluation" | "metadata" | "run">>;
    adapter: string;
    datasetPath: string;
    iterations?: number | undefined;
    env?: NodeJS.ProcessEnv | undefined;
    agentImportPath?: string | undefined;
    artifacts?: readonly string[] | undefined;
}
export interface RuhrohHarborCommand {
    scenarioId: string;
    args: string[];
    displayArgs: string[];
}
export declare function buildRuhrohHarborCommand(input: BuildRuhrohHarborCommandInput): RuhrohHarborCommand;
export declare function buildRuhrohHarborCommands(input: {
    scenarios: Array<Pick<RuhrohScenario, "id" | "loop"> & Partial<Pick<RuhrohScenario, "evaluation" | "metadata" | "run">>>;
    adapter: string;
    datasetPath: string;
    iterations?: number | undefined;
    env?: NodeJS.ProcessEnv | undefined;
    agentImportPath?: string | undefined;
    artifacts?: readonly string[] | undefined;
}): RuhrohHarborCommand[];
//# sourceMappingURL=harbor.d.ts.map