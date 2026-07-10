#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplePath = "docs/public/samples";
const samplePublicPrefix = "/samples/";
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
validateNoSampleRouteShadowingPublicHtml();
validateGeneratedSampleHtmlLinks();

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
    for (const match of findDeployedSampleLinks(text)) {
      const relativePath = path.relative(repoRoot, markdownPath);
      errors.push([
        `${relativePath}:${lineNumberForIndex(text, match.index)} sample link includes the deployed base path: ${match.href}`,
        "Use `/samples/...` in docs source; VitePress adds `/ruhroh/` during build.",
      ].join("\n"));
    }
    for (const match of findSampleLinks(text)) {
      const targetPath = path.join(repoRoot, "docs", "public", "samples", match.href.slice(samplePublicPrefix.length));
      const cleanTargetPath = `${targetPath}.html`;
      const hasExtension = path.extname(match.href).length > 0;
      if (!hasExtension && existsSync(cleanTargetPath)) {
        const relativePath = path.relative(repoRoot, markdownPath);
        errors.push(`${relativePath}:${lineNumberForIndex(text, match.index)} sample HTML link omits .html: ${match.href}`);
        continue;
      }
      if (path.extname(match.href) === ".html" && !match.bypassesRouter) {
        const relativePath = path.relative(repoRoot, markdownPath);
        errors.push([
          `${relativePath}:${lineNumberForIndex(text, match.index)} sample HTML link is intercepted by the VitePress router: ${match.href}`,
          "Render it as an anchor with `target=\"_self\"` so the static report loads directly.",
        ].join("\n"));
        continue;
      }
      const targetExists = existsSync(targetPath) || (!hasExtension && existsSync(cleanTargetPath));
      if (!targetExists) {
        const relativePath = path.relative(repoRoot, markdownPath);
        errors.push(`${relativePath}:${lineNumberForIndex(text, match.index)} sample link target is missing: ${match.href}`);
        continue;
      }
      if (existsSync(targetPath) && statSync(targetPath).isDirectory() && !existsSync(path.join(targetPath, "index.html"))) {
        const relativePath = path.relative(repoRoot, markdownPath);
        errors.push(`${relativePath}:${lineNumberForIndex(text, match.index)} sample link target is a directory without index.html: ${match.href}`);
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

function validateNoSampleRouteShadowingPublicHtml() {
  const errors = [];
  const docsSampleRoot = path.join(repoRoot, "docs", "samples");
  if (!existsSync(docsSampleRoot)) {
    return;
  }
  for (const markdownPath of listMarkdownFiles(docsSampleRoot)) {
    const relativeSamplePath = path.relative(docsSampleRoot, markdownPath);
    const publicHtmlPath = path.join(
      repoRoot,
      "docs",
      "public",
      "samples",
      relativeSamplePath.replace(/\.md$/u, ".html"),
    );
    if (existsSync(publicHtmlPath)) {
      errors.push([
        `${path.relative(repoRoot, markdownPath)} shadows ${path.relative(repoRoot, publicHtmlPath)} during VitePress build.`,
        "Link directly to the public `.html` sample instead of creating a docs route wrapper.",
      ].join("\n"));
    }
  }
  if (errors.length > 0) {
    console.error([
      "[docs-samples] sample routes shadow generated public HTML reports.",
      ...errors,
    ].join("\n"));
    process.exit(1);
  }
}

function validateGeneratedSampleHtmlLinks() {
  const errors = [];
  const sampleRoot = path.join(repoRoot, samplePath);
  for (const htmlPath of listFilesByExtension(sampleRoot, ".html")) {
    const text = readFileSync(htmlPath, "utf8");
    const basePath = htmlBasePath(htmlPath, text);
    for (const match of findLocalHtmlLinks(text)) {
      const targetPath = path.resolve(basePath, match.href);
      if (!existsSync(targetPath)) {
        errors.push(`${path.relative(repoRoot, htmlPath)}:${lineNumberForIndex(text, match.index)} generated sample link target is missing: ${match.rawHref}`);
        continue;
      }
      if (statSync(targetPath).isDirectory() && !existsSync(path.join(targetPath, "index.html"))) {
        errors.push(`${path.relative(repoRoot, htmlPath)}:${lineNumberForIndex(text, match.index)} generated sample link targets a directory without index.html: ${match.rawHref}`);
      }
    }
  }
  if (errors.length > 0) {
    console.error([
      "[docs-samples] generated sample HTML contains broken local links.",
      ...errors,
    ].join("\n"));
    process.exit(1);
  }
}

function htmlBasePath(htmlPath, text) {
  const match = text.match(/<base\s+href="([^"]+)"/iu);
  if (match?.[1] === undefined) {
    return path.dirname(htmlPath);
  }
  return path.resolve(path.dirname(htmlPath), match[1]);
}

function findSampleLinks(text) {
  const links = [];
  const markdownPattern = /\]\((\/samples\/[^)\s]+)\)/gu;
  for (const match of text.matchAll(markdownPattern)) {
    const rawHref = match[1];
    if (rawHref === undefined) {
      continue;
    }
    const href = rawHref.split("#")[0].split("?")[0];
    links.push({ href: decodeURIComponent(href), index: match.index ?? 0, bypassesRouter: false });
  }
  const anchorPattern = /<a\b[^>]*?(?::href="withBase\('([^']+)'\)"|\bhref="([^"]+)")[^>]*>/giu;
  for (const match of text.matchAll(anchorPattern)) {
    const rawHref = match[1] ?? match[2];
    if (rawHref === undefined || !rawHref.startsWith(samplePublicPrefix)) {
      continue;
    }
    const href = rawHref.split("#")[0].split("?")[0];
    const bypassesRouter = /\btarget=(['"])_self\1/iu.test(match[0]);
    links.push({ href: decodeURIComponent(href), index: match.index ?? 0, bypassesRouter });
  }
  return links.sort((left, right) => left.index - right.index);
}

function findDeployedSampleLinks(text) {
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

function findLocalHtmlLinks(text) {
  const links = [];
  const pattern = /href="([^"]+)"/gu;
  for (const match of text.matchAll(pattern)) {
    const rawHref = match[1];
    if (rawHref === undefined || rawHref.startsWith("#") || /^[a-z][a-z0-9+.-]*:/iu.test(rawHref)) {
      continue;
    }
    const href = rawHref.split("#")[0].split("?")[0];
    try {
      links.push({ rawHref, href: decodeURIComponent(href), index: match.index ?? 0 });
    } catch {
      links.push({ rawHref, href, index: match.index ?? 0 });
    }
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

function listFilesByExtension(root, extension) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesByExtension(entryPath, extension));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(extension)) {
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
