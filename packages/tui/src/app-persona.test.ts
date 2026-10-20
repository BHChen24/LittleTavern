import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  importFile,
  listPersonas,
  readSettings,
  resolveAppPaths,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

let home: string;
let paths: ReturnType<typeof resolveAppPaths>;
let app: ReturnType<typeof createApp>;
let terminal: Terminal;
let editorCommand: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-app-persona-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  const script = join(home, "editor.cjs");
  writeFileSync(
    script,
    'const fs = require("node:fs"), path = require("node:path"); fs.writeFileSync(path.join(__dirname, "opened.txt"), process.argv[2]); fs.writeFileSync(process.argv[2], fs.readFileSync(path.join(__dirname, "content.md")));',
  );
  editorCommand = `${process.execPath} ${script}`;
  terminal = {
    columns: 120,
    rows: 35,
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
  app = createApp({ paths, env: { VISUAL: editorCommand }, terminal });
  app.start();
  app.enterChat();
});
afterEach(async () => {
  await app.quit();
  rmSync(home, { recursive: true, force: true });
});
const input = (value: string) => app.tui.getFocusedComponent()?.handleInput?.(value);
const overlay = () => app.tui.getFocusedComponent()?.render(180).join("\n") ?? "";
const screen = () => app.tui.children.flatMap((component) => component.render(180)).join("\n");
function choose(label: string) {
  input(label);
  input("\r");
}

it("creates, persists, reopens and clears a persona through a fake VISUAL without a key", async () => {
  writeFileSync(join(home, "content.md"), "## Name\nTraveller\n## Description\nA visitor.\n");
  await app.submit("/persona");
  expect(overlay()).not.toContain("Edit active persona");
  choose("New persona");
  expect(readSettings(paths).persona).toBe("traveller.md");
  expect(listPersonas(paths)).toEqual([
    { file: "traveller.md", name: "Traveller", description: "A visitor." },
  ]);
  expect(screen()).toContain("You are now Traveller");
  expect(terminal.stop).toHaveBeenCalled();
  expect(terminal.start).toHaveBeenCalledTimes(2);
  expect(readFileSync(join(home, "opened.txt"), "utf8")).toContain(join("drafts", "personas"));
  expect(readdirSync(join(paths.importRoot, "drafts", "personas"))).toEqual([]);
  await app.quit();
  app = createApp({ paths, env: { VISUAL: editorCommand }, terminal });
  app.start();
  app.enterChat();
  await app.submit("/persona");
  expect(overlay()).toContain("● Traveller");
  writeFileSync(join(home, "content.md"), "## Name\nSailor\n## Description\nChanged.\n");
  choose("Edit active persona");
  expect(readFileSync(join(home, "opened.txt"), "utf8")).toBe(
    join(paths.importPersonasDir, "traveller.md"),
  );
  expect(listPersonas(paths)[0]).toMatchObject({ name: "Sailor", description: "Changed." });
  const card = join(home, "card.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Mira", first_mes: "Welcome {{user}}" },
    }),
  );
  const imported = importFile(paths, card);
  if (!imported.ok) throw new Error(imported.reason);
  await app.submit("/characters");
  app.tui.getFocusedComponent()?.handleInput?.(`${imported.item.id}`);
  app.tui.getFocusedComponent()?.handleInput?.("\r");
  expect(screen()).toContain("Welcome Sailor");
  await app.submit("/persona");
  choose("No persona");
  expect(readSettings(paths).persona).toBeNull();
  expect(existsSync(paths.credentialsFile)).toBe(false);
});

it("distinguishes same-name files, blocks invalid activation, and refreshes hand edits", async () => {
  for (const file of ["one.md", "two.md"])
    writeFileSync(join(paths.importPersonasDir, file), "## Name\nTraveller\n");
  writeFileSync(join(paths.importPersonasDir, "invalid.md"), "No name");
  await app.submit("/persona");
  expect(overlay()).toContain("one.md");
  expect(overlay()).toContain("two.md");
  expect(overlay()).toContain("A persona needs a name");
  choose("invalid.md");
  expect(app.tui.hasOverlay()).toBe(true);
  expect(readSettings(paths).persona).toBeUndefined();
  input("\x1b");
  await app.submit("/persona");
  choose("two.md");
  expect(readSettings(paths).persona).toBe("two.md");
  writeFileSync(join(paths.importPersonasDir, "one.md"), "## Name\nChanged by hand\n");
  await app.submit("/persona");
  expect(overlay()).toContain("Changed by hand");
  expect(overlay()).toContain("● Traveller");
});

it("retains invalid persona drafts separately from the character continuation picker", async () => {
  writeFileSync(join(home, "content.md"), "## Description\nKeep this draft.\n");
  await app.submit("/persona");
  choose("New persona");
  const folder = join(paths.importRoot, "drafts", "personas");
  const draft = readdirSync(folder)[0];
  expect(draft).toBeDefined();
  expect(readFileSync(join(folder, draft ?? ""), "utf8")).toContain("Keep this draft");
  expect(screen()).toContain("Draft kept at");
  mkdirSync(join(paths.importRoot, "drafts"), { recursive: true });
  writeFileSync(join(paths.importRoot, "drafts", "character.md"), "## Name\nMira\n");
  await app.submit("/characters");
  choose("New character");
  expect(overlay()).toContain("Continue character.md");
  expect(overlay()).not.toContain(draft);
  writeSettings(paths, { persona: null });
});
