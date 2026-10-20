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
    "LittleTavern 0.1.0",
    "Terminal roleplay with character cards and lorebooks",
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
