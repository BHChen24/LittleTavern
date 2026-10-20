import { expect, it } from "vitest";
import { stripControls } from "./sanitize.ts";

it("removes clipboard, title, hyperlink and screen-control sequences", () => {
  const evil =
    "hi \x1b]52;c;cm0gLXJmIH4=\x07clip \x1b]0;pwned\x1b\\title \x1b[2J\x1b[Hclear " +
    "\x1b]8;;http://evil.example\x07link\x1b]8;;\x07 \x9b31mred";
  const clean = stripControls(evil);
  expect(clean).toBe("hi clip title clear link 31mred");
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal control characters is the purpose of this assertion
  expect(clean).not.toMatch(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/);
});

it("keeps newlines, tabs and ordinary text including CJK and emoji", () => {
  expect(stripControls("第一行\n\t第二行 🍺")).toBe("第一行\n\t第二行 🍺");
  expect(stripControls("a\r\nb\rc")).toBe("a\nb\nc");
});

it("removes a dangling escape at the end of a stream chunk", () => {
  expect(stripControls("partial\x1b")).toBe("partial");
  expect(stripControls("partial\x1b]52;c;abc")).toBe("partial");
});
