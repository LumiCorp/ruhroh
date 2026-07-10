#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const explicitTarball = process.argv[2] === undefined ? undefined : path.resolve(process.argv[2]);
const packDir = mkdtempSync(path.join(tmpdir(), "ruhroh-pack-smoke-pack-"));
const projectDir = mkdtempSync(path.join(tmpdir(), "ruhroh-pack-smoke-project-"));

try {
  const tarball = explicitTarball ?? packPackage(packDir);
  console.log(`[package-smoke] installing ${tarball}`);

  writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ private: true, type: "module" }, null, 2));
  run(npmBin, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: projectDir,
    env: { npm_config_cache: path.join(projectDir, ".npm-cache") },
  });

  const ruhrohBin = path.join(projectDir, "node_modules", ".bin", process.platform === "win32" ? "ruhroh.cmd" : "ruhroh");
  run(ruhrohBin, ["--help"], { cwd: projectDir, expectStdout: "validate-summary" });
  run(ruhrohBin, ["--list-suites", "--json"], { cwd: projectDir, expectStdout: "\"ruhroh-smoke\"" });
  run(ruhrohBin, ["validate", "--scenario", "bookmark-manager-demo", "--json"], {
    cwd: projectDir,
    expectStdout: "\"id\": \"bookmark-manager-demo\"",
  });
  run(ruhrohBin, ["demo", "--json"], {
    cwd: projectDir,
    expectStatus: 1,
    expectStderr: "OPENROUTER_API_KEY is required",
  });

  run(process.execPath, [
    "--input-type=module",
    "-e",
    [
      "import('@kestrel-agents/ruhroh').then((m) => {",
      "if (typeof m.discoverRuhrohSuites !== 'function' || typeof m.validateRuhrohBenchmarkSummary !== 'function' || typeof m.buildRuhrohPublishCheckReport !== 'function' || typeof m.validateRuhrohPublishBundle !== 'function' || typeof m.verifyRuhrohBenchmarkClaimSources !== 'function') process.exit(1);",
      "const report = m.buildRuhrohPublishCheckReport({ source: { resultsPath: 'results' }, compare: { claimReadiness: { advisories: ['sample advisory'] }, benchmarkClaim: { scope: 'ad_hoc_compare', publishable: false, readiness: { publishable: false, blockers: ['no suite selected; use compare --suite for publishable benchmark claims'] }, evidence: {}, adapterSummaries: [], scenarioResults: [], pairwiseComparisons: [] } } });",
      "if (report.version !== 'ruhroh_publish_check_v1' || report.remediation[0]?.code !== 'suite_required') process.exit(1);",
      "})",
    ].join(" "),
  ], { cwd: projectDir });
  run(process.execPath, [
    "-e",
    "require.resolve('@kestrel-agents/ruhroh/schemas/benchmark-summary-v1.schema.json'); require.resolve('@kestrel-agents/ruhroh/schemas/benchmark-target-config-v1.schema.json'); require.resolve('@kestrel-agents/ruhroh/schemas/run-manifest-v1.schema.json');",
  ], { cwd: projectDir });

  const installedPackageRoot = path.join(projectDir, "node_modules", "@kestrel-agents", "ruhroh");
  for (const relativePath of [
    "docs/.vitepress",
    "docs/.vitepress/dist",
    "docs/public/samples",
  ]) {
    if (existsSync(path.join(installedPackageRoot, relativePath))) {
      throw new Error(`[package-smoke] installed package should not include generated docs output ${relativePath}`);
    }
  }
  for (const relativePath of [
    "CONTRIBUTING.md",
    "SECURITY.md",
    "docs/add-to-existing-project.md",
    "docs/adapter-examples.md",
    "docs/adjudication.md",
    "docs/benchmark-pack-registry.md",
    "docs/benchmark-pack-tutorial.md",
    "docs/claim-registry.md",
    "docs/concepts.md",
    "docs/contract-evolution.md",
    "docs/distributed-runs.md",
    "docs/eval-agent.md",
    "docs/benchmark-methodology.md",
    "docs/benchmark-suites.md",
    "docs/ci.md",
    "docs/troubleshooting.md",
    "docs/faq.md",
    "docs/write-an-evaluator.md",
    "docs/evaluator-cookbook.md",
    "docs/publish-claims.md",
    "docs/report-gallery.md",
    "docs/programmatic-api.md",
    "docs/scenario-evolution.md",
    "docs/security.md",
    "examples/adapters/aider/run.sh",
    "examples/adapters/aider/README.md",
    "examples/benchmark-targets/README.md",
    "examples/benchmark-targets/harness-controlled.openrouter-gpt55.json",
    "examples/benchmark-targets/model-controlled.aider-openrouter.json",
    "examples/benchmark-targets/recommended-stacks.json",
    "examples/evaluators/bookmark-manager-demo/run.sh",
    "examples/ci/ruhroh-pack-registry.yml",
    "examples/ci/ruhroh-claim-publication.yml",
    "examples/ci/ruhroh-sharded-collection.yml",
    "schemas/benchmark-target-config-v1.schema.json",
    "schemas/claim-index-v1.schema.json",
    "schemas/eval-calibration-report-v1.schema.json",
    "schemas/publish-bundle-v1.schema.json",
    "schemas/publish-check-v1.schema.json",
    "schemas/rerun-ledger-v1.schema.json",
    "scenarios/bookmark-manager-demo/scenario.json",
    "scenarios/bookmark-manager-demo/instruction.md",
    "scenarios/bookmark-manager-demo/assets/starter/package.json",
  ]) {
    if (!existsSync(path.join(installedPackageRoot, relativePath))) {
      throw new Error(`[package-smoke] installed package missing ${relativePath}`);
    }
  }
  for (const relativePath of [
    "examples/benchmark-targets/harness-controlled.openrouter-gpt55.json",
    "examples/benchmark-targets/model-controlled.aider-openrouter.json",
    "examples/benchmark-targets/recommended-stacks.json",
  ]) {
    run(ruhrohBin, ["validate-targets", path.join(installedPackageRoot, relativePath), "--json"], {
      cwd: projectDir,
      expectStdout: "\"errors\": []",
    });
  }

  run(ruhrohBin, ["init", "starter", "--json"], { cwd: projectDir, expectStdout: "ruhroh_init_v1" });
  run(ruhrohBin, [
    "validate",
    "--scenario-dir",
    "starter/ruhroh/scenarios",
    "--suite-dir",
    "starter/ruhroh/suites",
    "--suite",
    "ruhroh-smoke",
    "--json",
  ], { cwd: projectDir, expectStdout: "\"errors\": []" });
  run(ruhrohBin, [
    "--scenario-dir",
    "starter/ruhroh/scenarios",
    "--scenario",
    "simple-newsletter",
    "--adapter",
    "custom-shell",
    "--dry-run",
  ], {
    cwd: projectDir,
    env: {
      RUHROH_RUN_AGENT_COMMAND: path.join(projectDir, "starter", "ruhroh", "adapters", "fixture-newsletter", "run.sh"),
      RUHROH_EVAL_COMMAND: path.join(projectDir, "starter", "ruhroh", "evaluators", "fixture-newsletter", "run.sh"),
    },
    expectStdout: "harbor run",
  });

  console.log("[package-smoke] installed package smoke passed");
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
}

function packPackage(destination) {
  const cliPath = path.join(repoRoot, "dist", "cli.js");
  if (!existsSync(cliPath)) {
    throw new Error("[package-smoke] dist/cli.js is missing. Run the package build before smoke:package.");
  }
  run(pnpmBin, ["pack", "--pack-destination", destination], { cwd: repoRoot });
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const scopePrefix = packageJson.name.startsWith("@") ? packageJson.name.slice(1).replace("/", "-") : packageJson.name;
  return path.join(destination, `${scopePrefix}-${packageJson.version}.tgz`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const expectedStatus = options.expectStatus ?? 0;
  if (result.status !== expectedStatus || result.error !== undefined) {
    fail(command, args, result, options.cwd);
  }
  if (options.expectStdout !== undefined && !result.stdout.includes(options.expectStdout)) {
    fail(command, args, result, options.cwd, `stdout did not include ${JSON.stringify(options.expectStdout)}`);
  }
  if (options.expectStderr !== undefined && !result.stderr.includes(options.expectStderr)) {
    fail(command, args, result, options.cwd, `stderr did not include ${JSON.stringify(options.expectStderr)}`);
  }
}

function fail(command, args, result, cwd, reason = "command failed") {
  const lines = [
    `[package-smoke] ${reason}: ${command} ${args.join(" ")}`,
    `[package-smoke] cwd: ${cwd ?? repoRoot}`,
    `[package-smoke] status: ${result.status ?? "error"}`,
  ];
  if (result.error !== undefined) {
    lines.push(`[package-smoke] error: ${result.error.message}`);
  }
  if (result.stdout.trim().length > 0) {
    lines.push("[package-smoke] stdout:", result.stdout.trim());
  }
  if (result.stderr.trim().length > 0) {
    lines.push("[package-smoke] stderr:", result.stderr.trim());
  }
  throw new Error(lines.join("\n"));
}
