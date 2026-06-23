import path from "node:path";

import { buildAgentEnvArgs } from "./env.js";
import type { RuhrohScenario } from "./scenarios.js";

export const DEFAULT_RUHROH_DATASET_PATH = ".generated/ruhroh/harbor";
export const RUHROH_HARBOR_AGENT_IMPORT_PATH = "ruhroh.harbor_agent:RuhrohHarborAgent";
export const RUHROH_ARTIFACTS = [
  "/installed-agent/ruhroh-loop-result.json",
  "/installed-agent/ruhroh-loop-iterations.jsonl",
  "/installed-agent/ruhroh-loop-journey.json",
  "/installed-agent/ruhroh-loop-eval.json",
  "/installed-agent/ruhroh-loop-bridge.jsonl",
  "/installed-agent/ruhroh-workspace.tar.gz",
  "/installed-agent/ruhroh-loop-events.tar.gz",
  "/installed-agent/ruhroh-loop-transcripts.tar.gz",
] as const;

export interface BuildRuhrohHarborCommandInput {
  scenario: Pick<RuhrohScenario, "id" | "loop">;
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
}

export function buildRuhrohHarborCommand(input: BuildRuhrohHarborCommandInput): RuhrohHarborCommand {
  const taskPath = path.join(input.datasetPath, "tasks", input.scenario.id);
  return {
    scenarioId: input.scenario.id,
    args: [
      "run",
      "--path",
      taskPath,
      "--agent-import-path",
      input.agentImportPath ?? RUHROH_HARBOR_AGENT_IMPORT_PATH,
      "--n-concurrent",
      "1",
      "--agent-env",
      `RUHROH_MAX_ITERATIONS=${String(input.iterations ?? input.scenario.loop.defaultMaxIterations)}`,
      "--agent-env",
      `RUHROH_RUN_AGENT_ADAPTER=${input.adapter}`,
      ...buildAgentEnvArgs(input.env ?? process.env),
      ...(input.artifacts ?? RUHROH_ARTIFACTS).flatMap((artifact) => ["--artifact", artifact]),
    ],
  };
}

export function buildRuhrohHarborCommands(input: {
  scenarios: Array<Pick<RuhrohScenario, "id" | "loop">>;
  adapter: string;
  datasetPath: string;
  iterations?: number | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  agentImportPath?: string | undefined;
  artifacts?: readonly string[] | undefined;
}): RuhrohHarborCommand[] {
  return input.scenarios.map((scenario) =>
    buildRuhrohHarborCommand({
      scenario,
      adapter: input.adapter,
      datasetPath: input.datasetPath,
      iterations: input.iterations,
      env: input.env,
      agentImportPath: input.agentImportPath,
      artifacts: input.artifacts,
    })
  );
}
