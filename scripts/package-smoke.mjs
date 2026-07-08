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

  run(process.execPath, [
    "--input-type=module",
    "-e",
    "import('@kestrel-agents/ruhroh').then((m) => { if (typeof m.discoverRuhrohSuites !== 'function' || typeof m.validateRuhrohBenchmarkSummary !== 'function') process.exit(1); })",
  ], { cwd: projectDir });
  run(process.execPath, [
    "-e",
    "require.resolve('@kestrel-agents/ruhroh/schemas/benchmark-summary-v1.schema.json'); require.resolve('@kestrel-agents/ruhroh/schemas/run-manifest-v1.schema.json');",
  ], { cwd: projectDir });

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

  if (result.status !== 0 || result.error !== undefined) {
    fail(command, args, result, options.cwd);
  }
  if (options.expectStdout !== undefined && !result.stdout.includes(options.expectStdout)) {
    fail(command, args, result, options.cwd, `stdout did not include ${JSON.stringify(options.expectStdout)}`);
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
