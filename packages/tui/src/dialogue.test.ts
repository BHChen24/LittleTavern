import { afterEach, expect, it, vi } from "vitest";
import { colourDialogue } from "./dialogue.ts";
import { stripControls } from "./sanitize.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it("colours each quote style while preserving narration and Markdown", () => {
  vi.stubEnv("FORCE_COLOR", "1");
  vi.stubEnv("NO_COLOR", "");
  for (const quote of ['"Hello"', "“Hello”", "「こんにちは」"]) {
    const result = colourDialogue(`Before ${quote} *waves*`);
    expect(result).toBe(`Before \x1b[33m${quote}\x1b[39m *waves*`);
  }
});

it("ends an unclosed quote at the paragraph boundary", () => {
  vi.stubEnv("FORCE_COLOR", "1");
  vi.stubEnv("NO_COLOR", "");
  expect(colourDialogue('"unfinished\nline\n\nNarration')).toBe(
    '\x1b[33m"unfinished\nline\x1b[39m\n\nNarration',
  );
  expect(colourDialogue("No dialogue")).toBe("No dialogue");
  expect(colourDialogue(stripControls('\x1b[31m"Safe"\x1b[0m'))).toBe('\x1b[33m"Safe"\x1b[39m');
});
