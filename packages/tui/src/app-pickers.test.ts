import { existsSync, mkdtempSync, rmSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
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
  listChats,
  listLibrary,
  readSettings,
  resolveAppPaths,
  type SimulatedReply,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
function character(embedded = false) {
  return importJson("mira.json", {
    spec: "chara_card_v3",
    spec_version: "3.0",
    data: {
      name: "Mira",
      description: "Keeper.",
      first_mes: "Welcome to the lighthouse.",
      ...(embedded ? { character_book: { name: "Card lore", entries: [] } } : {}),
    },
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

async function chooseCharacter(name = "Mira") {
  await app.submit("/characters");
  pick(name);
}
async function chooseLorebook(name: string) {
  await app.submit("/lorebooks");
  pick(name);
}

it("lists lorebook states in order and persists toggles without changing the chat", async () => {
  const card = character(true);
  const world = lorebook();
  importJson("other.json", { name: "Other", entries: [] });
  openApp();
  writeSettings(paths, { lorebookAttachments: { [card.id]: [world.id, "missing-book"] } });
  await chooseCharacter();
  const sessionId = app.chat?.sessionId;
  await app.submit("/lorebooks");
  const choices = overlay();
  expect(choices.indexOf("Import a lorebook")).toBeLessThan(choices.indexOf("Card lore"));
  expect(choices.indexOf("Card lore")).toBeLessThan(choices.indexOf("World"));
  expect(choices.indexOf("World")).toBeLessThan(choices.indexOf("Other"));
  expect(choices.indexOf("Other")).toBeLessThan(choices.indexOf("missing-book"));
  expect(choices).toContain("part of the card");
  expect(choices).toContain("not attached");
  expect(choices).toContain("attached, missing from the library");
  pick("World");
  expect(app.tui.hasOverlay()).toBe(false);
  expect(screen()).toContain("Detached World.");
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual(["missing-book"]);
  await chooseLorebook("World");
  expect(screen()).toContain("Attached World.");
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual(["missing-book", world.id]);
  await chooseLorebook("Card lore");
  expect(screen()).toContain("Card lore is part of the character card and cannot be detached.");
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual(["missing-book", world.id]);
  await chooseLorebook("missing-book");
  expect(screen()).toContain("Detached a lorebook that is no longer in the library.");
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual([world.id]);
  expect(app.chat?.sessionId).toBe(sessionId);
});

it.each([false, true])(
  "offers import in an empty lorebook library, embedded=%s",
  async (embedded) => {
    character(embedded);
    openApp();
    await chooseCharacter();
    await app.submit("/lorebooks");
    expect(app.tui.hasOverlay()).toBe(true);
    expect(overlay()).toContain("Import a lorebook");
    expect(overlay().includes("Card lore")).toBe(embedded);
    app.tui.getFocusedComponent()?.handleInput?.("\x1b");
    expect(app.tui.hasOverlay()).toBe(false);
  },
);

it.each([false, true])("requires a character for lorebooks, innkeeper=%s", async (innkeeper) => {
  openApp();
  if (innkeeper) await app.submit("/innkeeper");
  await app.submit("/lorebooks");
  expect(app.tui.hasOverlay()).toBe(false);
  expect(screen()).toContain("Start a character chat first (/characters).");
});

async function importFromLorebooks(filename: string) {
  await chooseLorebook("Import a lorebook");
  expect(overlay()).toContain("Import from");
  pick(filename);
}

it("imports and attaches a lorebook, including repeated already-imported selections", async () => {
  const card = character();
  const file = join(paths.importLorebooksDir, "forest.json");
  writeFileSync(file, JSON.stringify({ name: "Forest", entries: [] }));
  openApp();
  await chooseCharacter();
  await importFromLorebooks("forest.json");
  expect(screen()).toContain('Imported "Forest"');
  expect(screen()).toContain("Attached Forest.");
  const book = listLibrary(paths).find((item) => item.kind === "lorebook");
  expect(book).toBeDefined();
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual([book?.id]);
  await chooseLorebook("Forest");
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual([]);
  await importFromLorebooks("forest.json");
  await importFromLorebooks("forest.json");
  expect(screen()).toContain('Already imported: "Forest"');
  expect(readSettings(paths).lorebookAttachments?.[card.id]).toEqual([book?.id]);
  expect(listLibrary(paths).filter((item) => item.kind === "lorebook")).toHaveLength(1);
});

it("reports a character imported through lorebooks without attaching it", async () => {
  const card = character();
  writeFileSync(
    join(paths.importLorebooksDir, "visitor.json"),
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Visitor" },
    }),
  );
  openApp();
  await chooseCharacter();
  await importFromLorebooks("visitor.json");
  expect(screen()).toContain('Imported "Visitor"');
  expect(readSettings(paths).lorebookAttachments?.[card.id] ?? []).toEqual([]);
  expect(screen()).not.toContain("Attached Visitor.");
});

it.each(["damaged", "oversized"])(
  "reports a %s lorebook file without attaching anything",
  async (kind) => {
    const card = character();
    const file = join(paths.importLorebooksDir, "invalid.json");
    writeFileSync(file, "{broken}");
    if (kind === "oversized") truncateSync(file, 20 * 1024 * 1024 + 1);
    openApp();
    await chooseCharacter();
    await importFromLorebooks("invalid.json");
    expect(screen()).toContain(kind === "damaged" ? "damaged JSON" : "larger than 20 MB");
    expect(readSettings(paths).lorebookAttachments?.[card.id] ?? []).toEqual([]);
    expect(listLibrary(paths).filter((item) => item.kind === "lorebook")).toEqual([]);
  },
);

it.skipIf(process.platform === "win32")(
  "refuses a lorebook symlink outside the import folders",
  async () => {
    const card = character();
    const file = join(home, "outside.json");
    writeFileSync(file, JSON.stringify({ name: "Outside", entries: [] }));
    symlinkSync(file, join(paths.importLorebooksDir, "linked.json"));
    openApp();
    await chooseCharacter();
    await importFromLorebooks("linked.json");
    expect(screen()).toContain("linked.json is outside the import folders.");
    expect(readSettings(paths).lorebookAttachments?.[card.id] ?? []).toEqual([]);
    expect(listLibrary(paths).filter((item) => item.kind === "lorebook")).toEqual([]);
  },
);

it("starts a fresh character session and leaves the old chat resumable", async () => {
  character();
  openApp(["Earlier reply.", "New reply."]);
  await chooseCharacter();
  await app.submit("Earlier message.");
  const oldId = app.chat?.sessionId;
  const old = (await listChats(paths)).find((entry) => entry.sessionId === oldId);
  expect(old).toBeDefined();
  await app.submit("/new");
  expect(app.chat?.sessionId).not.toBe(oldId);
  expect(app.chat?.history()).toEqual([{ role: "character", text: "Welcome to the lighthouse." }]);
  expect(screen()).toContain("Started a new chat with Mira. Earlier chats are in /sessions.");
  expect(screen()).not.toContain("Earlier message.");
  expect(screen()).not.toContain("Earlier reply.");
  expect(existsSync(old?.path ?? "")).toBe(true);
  await app.submit("New message.");
  const chats = await listChats(paths);
  expect(chats).toHaveLength(2);
  await app.submit("/sessions");
  expect(overlay().match(/Mira/g)).toHaveLength(2);
  const index = chats.findIndex((entry) => entry.sessionId === oldId);
  for (let i = 0; i < index; i++) app.tui.getFocusedComponent()?.handleInput?.("\x1b[B");
  pick("");
  expect(app.chat?.sessionId).toBe(oldId);
  expect(screen()).toContain("Earlier reply.");
});

it("uses the resumed chat's character for new rather than the last character started", async () => {
  const mira = character();
  importJson("vera.json", {
    spec: "chara_card_v3",
    data: { name: "Vera", first_mes: "Hello from Vera." },
  });
  openApp(["Mira reply.", "Vera reply.", "Fresh reply."]);
  await chooseCharacter();
  await app.submit("Hello Mira.");
  const oldId = app.chat?.sessionId;
  await chooseCharacter("Vera");
  await app.submit("Hello Vera.");
  await app.submit("/sessions");
  pick("Mira");
  expect(app.chat?.sessionId).toBe(oldId);
  await app.submit("/new");
  expect(app.chat?.libraryId).toBe(mira.id);
  expect(app.chat?.sessionId).not.toBe(oldId);
  expect(app.chat?.history()).toEqual([{ role: "character", text: "Welcome to the lighthouse." }]);
  await app.submit("New message.");
  expect(await listChats(paths)).toHaveLength(3);
});

it("reports a deleted current character without changing the chat", async () => {
  const card = character();
  openApp();
  await chooseCharacter();
  const previous = app.chat;
  rmSync(join(paths.dataDir, "library", "characters", card.id), { recursive: true });
  await app.submit("/new");
  expect(app.chat).toBe(previous);
  expect(screen()).toContain(
    "Mira is no longer in the library. Choose a character with /characters.",
  );
});

it("clears innkeeper history and stays in innkeeper mode", async () => {
  const seen: { role: string; text: string }[][] = [];
  openApp([
    "Earlier reply.",
    (history) => {
      seen.push(history);
      return "Fresh reply.";
    },
  ]);
  await app.submit("/innkeeper");
  await app.submit("Earlier message.");
  await app.submit("/new");
  expect(screen()).toContain("Started a new conversation with the innkeeper.");
  expect(screen()).not.toContain("Earlier reply.");
  expect(screen()).toContain("Talk to the innkeeper");
  await app.submit("New message.");
  expect(seen).toEqual([[{ role: "user", text: "New message." }]]);
  expect(screen()).toContain("Fresh reply.");
  expect(app.chat).toBeNull();
});

it("explains new when neither a character nor innkeeper mode is selected", async () => {
  openApp();
  await app.submit("/new");
  expect(screen()).toContain("Choose a character with /characters, or use /innkeeper.");
  expect(app.chat).toBeNull();
});

it.each(["character", "innkeeper"])(
  "refuses new while %s is streaming without clearing the editor",
  async (mode) => {
    character();
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    openApp([
      async () => {
        await gate;
        return "Finished reply.";
      },
    ]);
    if (mode === "character") await chooseCharacter();
    else await app.submit("/innkeeper");
    const pending = app.submit("Earlier message.");
    try {
      await vi.waitFor(() => expect(screen()).toContain("Earlier message."));
      const current = app.chat;
      const before = current?.history();
      app.editor.setText(" /new ");
      await app.submit(" /new ");
      expect(screen()).toContain("Wait for the reply, or press Esc to stop it.");
      expect(app.editor.getText()).toBe(" /new ");
      expect(app.chat).toBe(current);
      expect(app.chat?.history()).toEqual(before);
    } finally {
      release();
      await pending;
    }
  },
);

it.each(["/chat", "/chat x", "/attach", "/attach x", "/detach", "/detach x"])(
  "treats removed command %s as unknown",
  async (command) => {
    openApp();
    await app.submit(command);
    expect(screen()).toContain("Unknown command. Use /help.");
    expect(app.tui.hasOverlay()).toBe(false);
  },
);

it("uses a picker attachment on the next request and sends fresh history after new", async () => {
  character();
  lorebook();
  const seen: { role: string; text: string }[][] = [];
  openApp([
    (history) => {
      seen.push(history);
      return "Earlier reply.";
    },
    (history) => {
      seen.push(history);
      return "Fresh reply.";
    },
  ]);
  await chooseCharacter();
  await chooseLorebook("World");
  await app.submit("Tell me about eldoria.");
  expect(seen[0]?.[0]?.text).toContain("Eldoria is a forest.");
  expect(app.chat?.lastTrace?.lore.some((entry) => entry.included)).toBe(true);
  await app.submit("/new");
  await app.submit("A fresh question.");
  expect(seen[1]?.filter((message) => message.role !== "system")).toEqual([
    { role: "assistant", text: "Welcome to the lighthouse." },
    { role: "user", text: "A fresh question." },
  ]);
  expect(JSON.stringify(seen[1])).not.toContain("Earlier reply.");
  expect(await listChats(paths)).toHaveLength(2);
});
