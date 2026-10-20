import { expect, it, vi } from "vitest";
import { copyText } from "./clipboard.ts";

it("returns success or the clipboard error without leaking framework types", async () => {
  const copy = vi.fn(async (_text: string) => {});
  expect(await copyText("selected text", copy)).toBe(true);
  expect(copy).toHaveBeenCalledWith("selected text");
  expect(
    await copyText("text", async () => {
      throw new Error("Clipboard unavailable");
    }),
  ).toBe("Clipboard unavailable");
  expect(
    await copyText("text", async () => {
      throw "copy failed";
    }),
  ).toBe("copy failed");
});
