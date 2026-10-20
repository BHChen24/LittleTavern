import { expect, it } from "vitest";
import { compareContents } from "./check-release.mjs";

const contents = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/dist/cli.js",
  "package/examples/README.md",
  "package/examples/LICENSE",
  "package/examples/characters/alice.json",
  "package/examples/lorebooks/wonderland.json",
];
it("accepts exactly the contracted package contents regardless of tar ordering", () => {
  expect(compareContents([...contents].reverse())).toEqual([]);
});
it("names forbidden extra files and required missing files", () => {
  expect(compareContents([...contents, "package/tests/card.test.ts"])).toContain(
    "Unexpected file: package/tests/card.test.ts",
  );
  expect(compareContents(contents.filter((file) => file !== "package/LICENSE"))).toContain(
    "Missing file: package/LICENSE",
  );
});
