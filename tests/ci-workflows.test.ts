import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("GitHub workflows use package.json as the single pnpm version authority", () => {
  const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8")) as {
    packageManager?: string;
  };
  assert.match(packageJson.packageManager ?? "", /^pnpm@/u);

  const workflowDirectory = path.resolve(".github", "workflows");
  for (const filename of readdirSync(workflowDirectory).filter((entry) => /\.ya?ml$/u.test(entry))) {
    const workflow = readFileSync(path.join(workflowDirectory, filename), "utf8");
    const lines = workflow.split("\n");

    for (let index = 0; index < lines.length; index += 1) {
      const setupLine = lines[index] ?? "";
      if (!setupLine.includes("uses: pnpm/action-setup@")) continue;

      const stepIndent = setupLine.search(/\S/u);
      const stepLines = [setupLine];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const line = lines[cursor] ?? "";
        if (line.trim() !== "" && line.search(/\S/u) <= stepIndent) break;
        stepLines.push(line);
      }

      assert.doesNotMatch(
        stepLines.join("\n"),
        /^\s+version:/mu,
        `${filename} must not override package.json#packageManager`,
      );
    }
  }
});
