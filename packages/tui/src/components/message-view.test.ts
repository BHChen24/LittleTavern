import { stripVTControlCharacters } from "node:util";
import { visibleWidth } from "@earendil-works/pi-tui";
import { afterEach, expect, it, vi } from "vitest";
import { MessageView } from "./message-view.ts";

afterEach(() => vi.unstubAllEnvs());

it("uses bold labels, a bar on every body line and no gap after the label", () => {
  vi.stubEnv("FORCE_COLOR", "1");
  vi.stubEnv("NO_COLOR", "");
  for (const role of ["user", "character"] as const) {
    const lines = new MessageView(role, "Speaker", 'Hello "there" *waves*\n\nNext.').render(80);
    expect(lines[0]).toContain("\x1b[1mSpeaker:");
    const plain = lines.map(stripVTControlCharacters);
    expect(plain[0]).toBe("Speaker:");
    expect(plain[1]?.trimEnd()).toBe('│ Hello "there" waves');
    expect(plain.slice(1).every((line) => line.startsWith("│ "))).toBe(true);
    expect(lines.join("\n")).toContain("\x1b[33m");
    expect(lines.join("\n")).toContain("\x1b[3m");
  }
});

it("caps the width, reflows text and sanitizes before styling", () => {
  const message = new MessageView("character", "Mira", "words ".repeat(70));
  expect(message.render(200).every((line) => visibleWidth(line) <= 100)).toBe(true);
  expect(message.render(30).every((line) => visibleWidth(line) <= 30)).toBe(true);
  message.setText('\x1b]52;c;bad\x07"Safe"');
  expect(message.render(50).join("\n")).not.toContain("\x1b]");
  expect(message.render(50).join("\n")).toContain('"Safe"');
});
