import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("keeps non-test TypeScript source free of CJK scripts", () => {
  const packages = fileURLToPath(new URL("../../", import.meta.url));
  const violations: string[] = [];
  function scan(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) scan(path);
      else if (
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        entry.name !== "fixtures.ts"
      ) {
        readFileSync(path, "utf8")
          .split("\n")
          .forEach((line, index) => {
            if (
              /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(line)
            ) {
              violations.push(`${relative(dirname(packages), path)}:${index + 1}`);
            }
          });
      }
    }
  }
  for (const entry of readdirSync(packages, { withFileTypes: true })) {
    if (entry.isDirectory()) scan(join(packages, entry.name, "src"));
  }
  expect(violations, violations.join("\n")).toEqual([]);
});
