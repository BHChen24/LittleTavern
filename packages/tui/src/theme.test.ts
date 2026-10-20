import { afterEach, expect, it, vi } from "vitest";
import { markdownTheme, messageStyles } from "./theme.ts";

const tty = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
afterEach(() => {
  if (tty) Object.defineProperty(process.stdout, "isTTY", tty);
  else Reflect.deleteProperty(process.stdout, "isTTY");
  vi.unstubAllEnvs();
});

it("removes only colours under NO_COLOR, keeping text attributes", () => {
  vi.stubEnv("NO_COLOR", "1");
  Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
  expect(messageStyles.user("user")).toBe("user");
  expect(messageStyles.character("character")).toBe("character");
  expect(markdownTheme.bold("label")).toBe("\x1b[1mlabel\x1b[22m");
  expect(markdownTheme.italic("action")).toBe("\x1b[3maction\x1b[23m");
  expect(messageStyles.muted("hint")).toBe("\x1b[2mhint\x1b[22m");
  vi.unstubAllEnvs();
});
