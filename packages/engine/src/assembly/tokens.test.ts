import { expect, it } from "vitest";
import { estimateTokens } from "./tokens.ts";

it.each([
  ["", 0],
  ["hello", 2],
  ["abcdefgh", 2],
  ["你好世界", 4],
  ["あア한𠀀", 4],
  ["hello你好", 4],
  ["😀abc", 1],
])("estimates tokens for %j", (text, expected) => {
  expect(estimateTokens(text)).toBe(expected);
});
