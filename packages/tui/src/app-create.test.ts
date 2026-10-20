import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import { listLibrary, resolveAppPaths } from "@littletavern/engine";
import { expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

it("creates through a fake VISUAL, lists the character, continues a failed draft and restores the terminal", async () => {
  const home = mkdtempSync(join(tmpdir(), "lt-app-create-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const script = join(home, "editor.cjs");
  writeFileSync(
    script,
    'const fs = require("node:fs"); const file = process.argv[2]; fs.writeFileSync(file, fs.readFileSync(file, "utf8").includes("Keep this") ? "## Name\\nKept\\n## Description\\nKeep this\\n" : "## Name\\nMira\\n## First message\\nWelcome!\\n");',
  );
  const terminal: Terminal = {
    columns: 100,
    rows: 30,
    kittyProtocolActive: false,
    start: vi.fn(),
    stop: vi.fn(),
    write() {},
    moveBy() {},
    hideCursor() {},
    showCursor() {},
    clearLine() {},
    clearFromCursor() {},
    clearScreen() {},
    setTitle() {},
    async drainInput() {},
    setProgress() {},
    setProgramStatus() {},
  };
  const app = createApp({
    terminal,
    paths,
    env: { VISUAL: `${process.execPath} ${script}`, OPENROUTER_API_KEY: "synthetic-key" },
  });
  const screen = () => app.tui.render(100).join("\n");
  try {
    app.start();
    await app.submit("/new-character");
    expect(terminal.stop).toHaveBeenCalled();
    expect(terminal.start).toHaveBeenCalledTimes(2);
    expect(screen()).toContain("Start chatting with /chat");
    await app.submit("/library");
    expect(screen()).toContain("Mira");
    expect(readdirSync(join(paths.importRoot, "drafts"))).toEqual([]);
    const draft = join(paths.importRoot, "drafts", "kept.md");
    mkdirSync(join(paths.importRoot, "drafts"), { recursive: true });
    writeFileSync(draft, "## Description\nKeep this\n");
    await app.submit("/new-character");
    const picker = app.tui.getFocusedComponent();
    const choices = picker?.render(100).join("\n") ?? "";
    expect(choices).toContain("Continue kept.md");
    expect(choices).toContain("Start a new character");
    expect(readFileSync(draft, "utf8")).toContain("Keep this");
    picker?.handleInput?.("\r");
    expect(listLibrary(paths).map((item) => item.name)).toEqual(
      expect.arrayContaining(["Mira", "Kept"]),
    );
    expect(readdirSync(join(paths.importRoot, "drafts"))).toEqual([]);
    const item = listLibrary(paths).find((entry) => entry.name === "Mira");
    await app.submit(`/chat ${item?.id}`);
    expect(screen()).toContain("Welcome!");
  } finally {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  }
});
