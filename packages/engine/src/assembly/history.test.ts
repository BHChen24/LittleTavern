import { expect, it } from "vitest";
import { chat } from "./fixtures.ts";
import { fitHistory } from "./history.ts";

it("keeps all messages in chronological order when they fit", () => {
  const history = chat("1234", "abcdefgh", "你好");
  expect(fitHistory(history, 5)).toEqual({ kept: history, leftOut: 0, overflow: false });
});
it("stops at the first non-fitting message instead of skipping it", () => {
  const history = chat("a", "x".repeat(40), "last");
  expect(fitHistory(history, 2)).toEqual({
    kept: [history[2]],
    leftOut: 2,
    overflow: false,
  });
});
it("always keeps the newest message even when it exceeds available space", () => {
  const history = chat("old", "你好世界");
  expect(fitHistory(history, 1)).toEqual({ kept: [history[1]], leftOut: 1, overflow: true });
  expect(fitHistory(history, -1).overflow).toBe(true);
});
it("handles empty history and accounts for a system-only overflow", () => {
  expect(fitHistory([], 0)).toEqual({ kept: [], leftOut: 0, overflow: false });
  expect(fitHistory([], -1)).toEqual({ kept: [], leftOut: 0, overflow: true });
});
