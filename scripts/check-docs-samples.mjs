#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = "docs/public/samples";
const samplePublicPrefix = "/ruhroh/samples/";
const cliPath = path.join(repoRoot, "dist", "cli.js");

if (!existsSync(cliPath)) {
  console.error([
    "[docs-samples] dist/cli.js is missing.",
    "Run `pnpm build` before checking or regenerating docs samples.",
  ].join("\n"));
  process.exit(1);
}

run(process.execPath, ["scripts/generate-docs-samples.mjs"]);
validateSampleLinks();

const diff = run("git", ["diff", "--exit-code", "--", samplePath], { allowFailure: true });
const untracked = run("git", ["ls-files", "--others", "--exclude-standard", "--", samplePath], { capture: true });

if (diff.status !== 0 || untracked.stdout.trim().length > 0) {
  const messages = [
    "[docs-samples] generated docs samples are stale or not checked in.",
    "Run `pnpm build && pnpm run docs:samples`, then include the resulting docs/public/samples changes.",
  ];
  if (diff.status !== 0) {
    messages.push("[docs-samples] tracked sample files changed; inspect `git diff -- docs/public/samples`.");
  }
  const untrackedFiles = untracked.stdout.trim().split(/\r?\n/u).filter(Boolean);
  if (untrackedFiles.length > 0) {
    messages.push("[docs-samples] untracked generated sample files:");
    messages.push(...untrackedFiles.slice(0, 20).map((file) => `  ${file}`));
    if (untrackedFiles.length > 20) {
      messages.push(`  ...and ${untrackedFiles.length - 20} more`);
    }
  }
  console.error(messages.join("\n"));
  process.exit(1);
}

console.log("[docs-samples] generated docs samples are fresh.");

function validateSampleLinks() {
  const errors = [];
  for (const markdownPath of listMarkdownFiles(path.join(repoRoot, "docs"))) {
    const text = readFileSync(markdownPath, "utf8");
    for (const match of findSampleLinks(text)) {
      const targetPath = path.join(repoRoot, "docs", "public", "samples", match.href.slice(samplePublicPrefix.length));
      if (!existsSync(targetPath)) {
        const relativePath = path.relative(repoRoot, markdownPath);
        errors.push(`${relativePath}:${lineNumberForIndex(text, match.index)} sample link target is missing: ${match.href}`);
      }
    }
  }
  if (errors.length > 0) {
    console.error([
      "[docs-samples] docs reference missing generated sample artifacts.",
      ...errors,
    ].join("\n"));
    process.exit(1);
  }
}

function findSampleLinks(text) {
  const links = [];
  const pattern = /\]\((\/ruhroh\/samples\/[^)\s]+)\)|href="(\/ruhroh\/samples\/[^"]+)"/gu;
  for (const match of text.matchAll(pattern)) {
    const rawHref = match[1] ?? match[2];
    if (rawHref === undefined) {
      continue;
    }
    const href = rawHref.split("#")[0].split("?")[0];
    links.push({ href: decodeURIComponent(href), index: match.index ?? 0 });
  }
  return links;
}

function listMarkdownFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".vitepress" || entry.name === "public") {
        continue;
      }
      files.push(...listMarkdownFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function lineNumberForIndex(text, index) {
  return text.slice(0, index).split(/\r?\n/u).length;
}

function run(command, args, options = {}) {
  if (command === "git" && args[0] === "diff" && !existsSync(path.join(repoRoot, samplePath))) {
    return { status: 1 };
  }
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: options.capture === true ? "pipe" : "inherit",
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0 && options.allowFailure !== true) {
    process.exit(result.status ?? 1);
  }
  return result;
}
