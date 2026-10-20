import { expect, it } from "vitest";
import { HomeScreen } from "./home-screen.ts";

it("shows the welcome content, missing-key hint and empty-library drop folders", () => {
  const home = new HomeScreen({
    version: "0.1.0",
    keyStatus: "none",
    libraryEmpty: true,
    importDirs: ["/tmp/import/characters", "/tmp/import/lorebooks"],
  });
  const text = home.render(100).join("\n");
  for (const content of [
    "v0.1.0 · Terminal roleplay with character cards and lorebooks",
    "Press Enter to start",
    "Type / for commands",
    "No API key yet — use /apikey",
    "/tmp/import/characters",
    "/tmp/import/lorebooks",
  ])
    expect(text).toContain(content);
});
it("shows the key source and omits drop folders when the library has items", () => {
  const home = new HomeScreen({
    version: "0.1.0",
    keyStatus: "environment",
    libraryEmpty: false,
    importDirs: ["/tmp/import/characters", "/tmp/import/lorebooks"],
  });
  expect(home.render(100).join("\n")).toContain("API key: environment");
  expect(home.render(100).join("\n")).not.toContain("/tmp/import");
});

it("left-aligns the exact logo when it fits and shows the product name once below the boundary", () => {
  const home = new HomeScreen({
    version: "0.1.0",
    keyStatus: "none",
    libraryEmpty: false,
    importDirs: [],
  });
  const logo = [
    "  l i t t l e",
    "▀▀█▀▀ ▄▀▀▀▄ █   █ █▀▀▀▀ █▀▀▀▄ █▄  █",
    "  █   █▀▀▀█ ▀▄ ▄▀ █▀▀▀  █▀▀▀▄ █ ▀▄█",
    "  ▀   ▀   ▀   ▀   ▀▀▀▀▀ ▀   ▀ ▀   ▀",
  ];
  const logoWidth = logo[1]?.length ?? 0;
  expect(new Set(logo.slice(1).map((line) => line.length)).size).toBe(1);
  for (const width of [80, logoWidth]) {
    const lines = home.render(width).map(stripVTControlCharacters);
    expect(lines.slice(0, 4)).toEqual(logo);
    expect(lines.join("\n")).not.toContain("LittleTavern");
    expect(lines.join("\n").match(/v0\.1\.0/g)).toHaveLength(1);
  }
  const narrow = home
    .render(logoWidth - 1)
    .map(stripVTControlCharacters)
    .join("\n");
  expect(narrow).not.toContain(logo[0]);
  expect(narrow.match(/LittleTavern/g)).toHaveLength(1);
  expect(narrow).toContain("v0.1.0 · Terminal roleplay");
});

import { stripVTControlCharacters } from "node:util";
