import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  type AppPaths,
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  ensureImportFolders,
  importFile,
  resolveAppPaths,
  type SimulatedReply,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { formatItemDetails } from "./library-format.ts";

let home: string;
let paths: AppPaths;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "lt-app-pickers-"));
  paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  ensureImportFolders(paths);
});
afterEach(async () => {
  await app?.quit();
  rmSync(home, { recursive: true, force: true });
});

function openApp(replies: SimulatedReply[] = []) {
  const terminal: Terminal = {
    columns: 80,
    rows: 24,
    kittyProtocolActive: false,
    start() {},
    stop() {},
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
  writeSettings(paths, { model: DEFAULT_MODEL_ID });
  app = createApp({
    terminal,
    env: { LITTLETAVERN_HOME: home, OPENROUTER_API_KEY: "synthetic-key" },
    session: new ChatSession({
      modelId: DEFAULT_MODEL_ID,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      getApiKey: () => "synthetic-key",
      simulated: { replies },
    }),
  });
  app.enterChat();
}

function importJson(name: string, value: unknown) {
  const file = join(home, name);
  writeFileSync(file, JSON.stringify(value));
  const report = importFile(paths, file);
  if (!report.ok) throw new Error(report.reason);
  return report.item;
}
function character() {
  return importJson("mira.json", {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: { name: "Mira", description: "Keeper.", first_mes: "Welcome to the lighthouse." },
  });
}
function lorebook() {
  return importJson("world.json", {
    name: "World",
    entries: { "0": { key: ["eldoria"], content: "Eldoria is a forest.", order: 1 } },
  });
}
function screen() {
  return app.tui.children.flatMap((component) => component.render(120)).join("\n");
}
function overlay() {
  return app.tui.getFocusedComponent()?.render(120).join("\n") ?? "";
}
function pick(filter: string) {
  const focused = app.tui.getFocusedComponent();
  focused?.handleInput?.(filter);
  focused?.handleInput?.("\r");
}

it("opens show with all item kinds, filters by name and shows the selected details", async () => {
  const card = character();
  const book = lorebook();
  openApp();
  await app.submit("/show");
  expect(overlay()).toContain("Inspect an item (Enter shows details, Esc cancels)");
  expect(overlay()).toContain(`character · ${card.id}`);
  expect(overlay()).toContain(`lorebook · ${book.id}`);
  app.tui.getFocusedComponent()?.handleInput?.("World");
  expect(overlay()).not.toContain(card.id);
  pick("");
  expect(app.tui.hasOverlay()).toBe(false);
  expect(app.tui.getFocusedComponent()).toBe(app.editor);
  for (const line of formatItemDetails(book)) expect(screen()).toContain(line);
  await app.submit("/show");
  pick("Mira");
  for (const line of formatItemDetails(card)) expect(screen()).toContain(line);
});

it("cancels show without changing the transcript", async () => {
  character();
  openApp();
  const before = screen();
  await app.submit("/show");
  app.tui.getFocusedComponent()?.handleInput?.("\x1b");
  expect(app.tui.hasOverlay()).toBe(false);
  expect(screen()).toBe(before);
});

it("explains show arguments instead of looking up an id", async () => {
  const card = character();
  openApp();
  await app.submit(`/show ${card.id}`);
  expect(app.tui.hasOverlay()).toBe(false);
  expect(screen()).toContain("/show opens a picker. In a shell, run: littletavern show <id>");
  expect(screen()).not.toContain("Description: Keeper.");
});

it("shows the empty-library hint without opening a picker", async () => {
  openApp();
  await app.submit("/show");
  expect(screen()).toContain("Library is empty.");
  expect(app.tui.hasOverlay()).toBe(false);
});
