import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { examplesDir } from "./examples-dir.ts";

it("finds the examples in the development layout", () => {
  expect(examplesDir()).toBe(fileURLToPath(new URL("../../../examples/", import.meta.url)));
});
