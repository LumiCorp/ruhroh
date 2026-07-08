export const RUHROH_AGENT_ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_BASE_URL",
  "OPENAI_ORG_ID",
  "OPENAI_PROJECT_ID",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_NAME",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_VERSION",
  "TAVILY_API_KEY",
  "KCHAT_MODEL_PROVIDER",
  "KCHAT_MODEL",
  "KCHAT_MODEL_TIMEOUT_MS",
  "KCHAT_MODEL_RETRY_COUNT",
  "RUHROH_MODEL_PROVIDER",
  "RUHROH_MODEL",
  "RUHROH_PROMPT_VERSION",
  "RUHROH_SAMPLE_ID",
  "RUHROH_SAMPLE_SEED",
  "RUHROH_RUN_SEED",
  "RUHROH_RUN_MODE",
  "RUHROH_RUN_INDEX",
  "RUHROH_RUN_COUNT",
  "RUHROH_RETRY_POLICY",
  "RUHROH_CONTAINER_IMAGE",
  "RUHROH_COST_USD",
  "RUHROH_INPUT_TOKENS",
  "RUHROH_OUTPUT_TOKENS",
  "RUHROH_TOTAL_TOKENS",
  "RUHROH_AGENT_PROVIDER",
  "RUHROH_AGENT_MODEL",
  "RUHROH_AGENT_MODEL_VERSION",
  "RUHROH_AGENT_PROMPT_VERSION",
  "RUHROH_RUN_AGENT_ADAPTER_VERSION",
  "RUHROH_EVAL_PROVIDER",
  "RUHROH_EVAL_MODEL",
  "RUHROH_EVAL_MODEL_VERSION",
  "RUHROH_EVAL_PROMPT_VERSION",
  "RUHROH_EVAL_TIMEOUT_SEC",
  "RUHROH_EVAL_MODEL_TIMEOUT_MS",
  "RUHROH_EVAL_MODEL_RETRY_COUNT",
  "RUHROH_EVAL_RESULT_FIXTURE",
  "RUHROH_EVAL_RESULT_FIXTURE_PATH",
  "RUHROH_EVAL_MAX_STEPS",
  "RUHROH_EVAL_CALIBRATION_CASES_JSON",
  "RUHROH_EVAL_PRIVATE_ASSETS_JSON",
  "RUHROH_ITERATION_TIMEOUT_SEC",
  "RUHROH_AGENT_TIMEOUT_SEC",
  "RUHROH_INSTALL_TIMEOUT_SEC",
  "RUHROH_RUN_AGENT_ADAPTER",
  "RUHROH_RUN_AGENT_COMMAND",
  "RUHROH_RUN_AGENT_COMMAND_SHELL",
  "RUHROH_RUN_AGENT_COMPLETION_PROTOCOL",
  "RUHROH_EVAL_COMMAND",
  "RUHROH_EVAL_COMMAND_SHELL",
] as const;

export const RUHROH_RUNNER_ENV_KEYS = [
  ...RUHROH_AGENT_ENV_KEYS,
  "RUHROH_HARBOR_COMMAND_TIMEOUT_MS",
  "RUHROH_REPO_ROOT",
] as const;

export function buildAgentEnvArgs(env: NodeJS.ProcessEnv, keys: readonly string[] = RUHROH_AGENT_ENV_KEYS): string[] {
  return keys.flatMap((key) => {
    const value = env[key];
    return value === undefined || value === "" ? [] : ["--agent-env", `${key}=\${${key}}`];
  });
}

export function redactEnvAssignment(assignment: string): string {
  const index = assignment.indexOf("=");
  if (index < 0) {
    return assignment;
  }
  const key = assignment.slice(0, index);
  return `${key}=\${${key}}`;
}

export function filterForwardedEnv(
  env: NodeJS.ProcessEnv,
  keys: readonly string[] = RUHROH_RUNNER_ENV_KEYS,
): NodeJS.ProcessEnv {
  const forwarded: NodeJS.ProcessEnv = {};
  for (const key of keys) {
    if (env[key] !== undefined) {
      forwarded[key] = env[key];
    }
  }
  return forwarded;
}
