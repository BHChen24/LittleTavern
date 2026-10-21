import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Terminal } from "@earendil-works/pi-tui";
import {
  ChatSession,
  DEFAULT_MODEL_ID,
  DEFAULT_SYSTEM_PROMPT,
  importFile,
  listChats,
  readUsageRecords,
  resolveAppPaths,
  type SimulatedReply,
  writeSettings,
} from "@littletavern/engine";
import { afterEach, expect, it, vi } from "vitest";
import { createApp } from "./app.ts";

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

function fixture(replies: SimulatedReply[] = [], spendCap = 0) {
  const home = mkdtempSync(join(tmpdir(), "lt-editing-"));
  const paths = resolveAppPaths({ LITTLETAVERN_HOME: home });
  writeSettings(paths, {
    model: DEFAULT_MODEL_ID,
    userName: "Traveler",
    limits: { runSpendUsd: spendCap },
  });
  const card = join(home, "alice.json");
  writeFileSync(
    card,
    JSON.stringify({
      spec: "chara_card_v3",
      data: { name: "Alice", description: "A keeper.", first_mes: "Welcome, {{user}}." },
    }),
  );
  const imported = importFile(paths, card);
  if (!imported.ok) throw new Error(imported.reason);
  const session = new ChatSession({
    modelId: DEFAULT_MODEL_ID,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    getApiKey: () => "synthetic-key",
    simulated: { replies },
  });
  session.onFinish((turn) => {
    turn.usage.cost = { input: 0.006, output: 0.006, cacheRead: 0, cacheWrite: 0, total: 0.012 };
  });
  let onInput: ((data: string) => void) | undefined;
  const terminal: Terminal = {
    columns: 160,
    rows: 40,
    kittyProtocolActive: false,
    start(callback) {
      onInput = callback;
    },
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
  const app = createApp({ terminal, paths, env: { OPENROUTER_API_KEY: "synthetic-key" }, session });
  cleanups.push(async () => {
    await app.quit();
    rmSync(home, { recursive: true, force: true });
  });
  app.enterChat();
  const input = (value: string) => app.tui.getFocusedComponent()?.handleInput?.(value);
  const pick = (filter = "") => {
    input(filter);
    input("\r");
  };
  return {
    app,
    session,
    paths,
    home,
    terminal,
    input,
    pick,
    terminalInput: (value: string) => onInput?.(value),
    screen: () => app.tui.children.flatMap((component) => component.render(500)).join("\n"),
    overlay: () => app.tui.getFocusedComponent()?.render(500).join("\n") ?? "",
    character: async () => {
      await app.submit("/characters");
      pick("Alice");
    },
    file: async () => {
      const saved = (await listChats(paths)).find(
        (entry) => entry.sessionId === app.chat?.sessionId,
      );
      if (!saved) throw new Error("Expected a saved chat");
      return saved.path;
    },
  };
}

it("undoes a turn on screen, restores the player's input and keeps paid usage and trace", async () => {
  const f = fixture(["First reply", "Second reply"]);
  await f.character();
  await f.app.submit("First message");
  await f.app.submit("Second message");
  const trace = f.app.chat?.lastTrace;
  const usage = readUsageRecords(f.paths.usageLedgerFile);
  await f.app.submit("/undo");
  expect(f.screen()).toContain("First reply");
  expect(f.screen()).not.toContain("Second reply");
  expect(f.app.chat?.history().map((item) => item.text)).not.toContain("Second message");
  expect(f.app.editor.getText()).toBe("Second message");
  expect(readUsageRecords(f.paths.usageLedgerFile)).toEqual(usage);
  expect(f.app.chat?.lastTrace).toBe(trace);
  expect(f.screen()).toContain("$0.024");
  await f.app.submit("/undo");
  expect(f.app.editor.getText()).toBe("First message");
  await f.app.submit("/undo");
  expect(f.screen()).toContain("There is nothing to undo.");
});

it.each([false, true])(
  "explains undo outside a character chat, innkeeper=%s",
  async (innkeeper) => {
    const f = fixture();
    if (innkeeper) await f.app.submit("/innkeeper");
    await f.app.submit("/undo");
    expect(f.screen()).toContain("/undo works in character chats.");
  },
);

it.each([
  { command: "/undo", mode: "character" },
  { command: "/edit", mode: "character" },
  { command: "/undo", mode: "innkeeper" },
  { command: "/edit", mode: "innkeeper" },
])(
  "refuses $command during $mode streaming through submit and terminal Enter",
  async ({ command, mode }) => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const f = fixture([
      async () => {
        await gate;
        return "Reply";
      },
    ]);
    if (mode === "character") await f.character();
    else await f.app.submit("/innkeeper");
    f.app.start();
    const pending = f.app.submit("Message");
    try {
      await vi.waitFor(() => expect(f.session.isStreaming).toBe(true));
      const before = f.app.chat?.history();
      f.app.editor.setText(command);
      await f.app.submit(command);
      f.terminalInput("\r");
      expect(f.app.chat?.history()).toEqual(before);
      expect(f.app.editor.getText()).toBe(command);
      expect(f.screen().match(/Wait for the reply, or press Esc to stop it\./g)).toHaveLength(2);
    } finally {
      release();
      await pending;
    }
  },
);

it("lists messages newest first, labels their speakers, searches full text and omits the greeting", async () => {
  const f = fixture(["First reply\nHidden word", "Second reply"]);
  await f.character();
  await f.app.submit("First message");
  await f.app.submit("Second message");
  await f.app.submit("/edit");
  const choices = f.overlay();
  expect(choices).toContain("Edit a message (Enter edits, Esc cancels)");
  expect(choices).toMatch(/F.*ilter messages/);
  expect(choices).toContain("You");
  expect(choices).toContain("Alice");
  expect(choices.indexOf("Second reply")).toBeLessThan(choices.indexOf("Second message"));
  expect(choices.indexOf("Second message")).toBeLessThan(choices.indexOf("First reply"));
  expect(choices).not.toContain("Welcome, Traveler.");
  f.pick("Hidden word");
  expect(f.app.tui.hasOverlay()).toBe(false);
  expect(f.app.editor.getText()).toBe("First reply\nHidden word");
  expect(f.screen()).toContain("Editing Alice's message · Enter saves · Esc cancels");
});

it.each([false, true])(
  "explains edit outside a character chat, innkeeper=%s",
  async (innkeeper) => {
    const f = fixture();
    if (innkeeper) await f.app.submit("/innkeeper");
    await f.app.submit("/edit");
    expect(f.screen()).toContain("/edit works in character chats.");
    expect(f.app.tui.hasOverlay()).toBe(false);
  },
);

it("does not open an edit list for the greeting alone", async () => {
  const f = fixture();
  await f.character();
  await f.app.submit("/edit");
  expect(f.screen()).toContain("There are no messages to edit.");
  expect(f.app.tui.hasOverlay()).toBe(false);
});

it.each([false, true])(
  "resends a selected player message and drops later turns, unchanged=%s",
  async (unchanged) => {
    const f = fixture(["First reply", "Second reply", "Fresh reply"]);
    await f.character();
    await f.app.submit("First message");
    await f.app.submit("Second message");
    await f.app.submit("/edit");
    f.pick("First message");
    expect(f.screen()).toContain("Editing your message · Enter saves and resends · Esc cancels");
    const edited = unchanged ? "First message" : "Corrected message";
    await f.app.submit(edited);
    expect(f.app.chat?.history().map((item) => item.text)).toEqual([
      "Welcome, Traveler.",
      edited,
      "Fresh reply",
    ]);
    expect(f.screen()).not.toContain("Second message");
    expect(f.screen()).not.toContain("Second reply");
    expect(f.screen()).not.toContain("Editing your message");
    expect(f.app.editor.getText()).toBe("");
    expect(readUsageRecords(f.paths.usageLedgerFile)).toHaveLength(3);
    expect(f.screen()).toContain("$0.0360");
  },
);

it("saves a character edit without a request and retains usage and the last trace", async () => {
  const f = fixture(["First reply", "Second reply"]);
  await f.character();
  await f.app.submit("First message");
  await f.app.submit("Second message");
  const trace = f.app.chat?.lastTrace;
  const usage = readUsageRecords(f.paths.usageLedgerFile);
  await f.app.submit("/edit");
  f.pick("First reply");
  await f.app.submit("Hand-edited reply");
  expect(f.app.chat?.history().map((item) => item.text)).toEqual([
    "Welcome, Traveler.",
    "First message",
    "Hand-edited reply",
  ]);
  expect(f.screen()).not.toContain("Second message");
  expect(f.screen()).not.toContain("Editing Alice");
  expect(readUsageRecords(f.paths.usageLedgerFile)).toEqual(usage);
  expect(f.app.chat?.lastTrace).toBe(trace);
  expect(f.screen()).toContain("$0.0240");
});

it("treats an unchanged character edit as a no-op, preserving later messages and the restore slot", async () => {
  const f = fixture(["First reply", "Second reply", "Replacement"]);
  await f.character();
  await f.app.submit("First message");
  await f.app.submit("Second message");
  await f.app.submit("/regenerate");
  const history = f.app.chat?.history();
  const file = await f.file();
  const bytes = readFileSync(file, "utf8");
  await f.app.submit("/edit");
  f.pick("First reply");
  await f.app.submit("First reply");
  expect(f.screen()).toContain("No changes.");
  expect(f.app.chat?.history()).toEqual(history);
  expect(readFileSync(file, "utf8")).toBe(bytes);
  await f.app.submit("/prev");
  expect(f.app.chat?.history().at(-1)?.text).toBe("Second reply");
});

it("leaves an interrupted mark on an unchanged character submission", async () => {
  const f = fixture(["Interrupted reply".repeat(20)]);
  await f.character();
  const remove = f.session.onDelta(() => f.session.abort());
  await f.app.submit("Message");
  remove();
  const original = f.app.chat?.history().at(-1);
  expect(original?.interrupted).toBe(true);
  await f.app.submit("/edit");
  f.pick();
  await f.app.submit(original?.text ?? "");
  expect(f.screen()).toContain("No changes.");
  expect(f.app.chat?.history().at(-1)).toEqual(original);
});

it("rejects empty edits, blocks regenerate, cancels with Esc and never writes an unsaved edit", async () => {
  const f = fixture(["Reply"]);
  await f.character();
  await f.app.submit("Message");
  f.app.start();
  const file = await f.file();
  const bytes = readFileSync(file, "utf8");
  const history = f.app.chat?.history();
  await f.app.submit("/edit");
  f.pick();
  await f.app.submit("  ");
  expect(f.screen()).toContain("Please enter the message text, or press Esc to cancel.");
  expect(f.screen()).toContain("Editing Alice");
  f.terminalInput("\x12");
  expect(f.screen()).toContain("Finish the edit first: Enter saves, Esc cancels.");
  expect(readUsageRecords(f.paths.usageLedgerFile)).toHaveLength(1);
  f.app.editor.setText("Discard this draft");
  expect(readFileSync(file, "utf8")).toBe(bytes);
  f.terminalInput("\x1b");
  expect(f.app.editor.getText()).toBe("");
  expect(f.screen()).toContain("Edit cancelled.");
  expect(f.screen()).not.toContain("Editing Alice");
  expect(f.app.chat?.history()).toEqual(history);
  expect(readFileSync(file, "utf8")).toBe(bytes);
});

it.each(["save", "cancel"])(
  "disables slash/file completion while editing and restores it after %s",
  async (finish) => {
    const f = fixture(["Reply"]);
    await f.character();
    await f.app.submit("Message");
    f.app.start();
    await f.app.submit("/edit");
    f.pick();
    f.app.editor.setText("");
    for (const key of "/un") f.app.editor.handleInput(key);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.app.editor.isShowingAutocomplete()).toBe(false);
    f.app.editor.handleInput("\t");
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.app.editor.isShowingAutocomplete()).toBe(false);
    if (finish === "save") {
      f.app.editor.handleInput("\r");
      await vi.waitFor(() => expect(f.app.chat?.history().at(-1)?.text).toBe("/un"));
    } else {
      f.terminalInput("\x1b");
      expect(f.app.chat?.history().at(-1)?.text).toBe("Reply");
    }
    f.app.editor.handleInput("/");
    await vi.waitFor(() => expect(f.app.editor.isShowingAutocomplete()).toBe(true));
  },
);

it("keeps an edited player message pending on spend Stop, then sends it on Continue", async () => {
  const f = fixture(["Reply", "Fresh reply"], 0.01);
  await f.character();
  await f.app.submit("Message");
  const history = f.app.chat?.history();
  const bytes = readFileSync(await f.file(), "utf8");
  await f.app.submit("/edit");
  f.pick("Message");
  const stopped = f.app.submit("Corrected");
  expect(f.overlay()).toContain("Send anyway?");
  f.pick("Stop");
  await stopped;
  expect(f.app.editor.getText()).toBe("Corrected");
  expect(f.app.chat?.history()).toEqual(history);
  expect(f.screen()).toContain("Editing your message");
  expect(readFileSync(await f.file(), "utf8")).toBe(bytes);
  const continued = f.app.submit("Corrected");
  f.pick("Continue");
  await continued;
  expect(f.app.chat?.history().at(-1)?.text).toBe("Fresh reply");
  expect(f.screen()).not.toContain("Editing your message");
});

it("shows the failure notice for a saved player edit and retries it with Ctrl+R", async () => {
  const f = fixture([
    "Old reply",
    { text: "Partial", errorMessage: "fetch failed" },
    "Retried reply",
  ]);
  await f.character();
  await f.app.submit("Original");
  f.app.start();
  await f.app.submit("/edit");
  f.pick("Original");
  await f.app.submit("Corrected");
  expect(f.app.chat?.history().at(-1)?.text).toBe("Corrected");
  expect(f.screen()).toContain("The reply failed: network error.");
  expect(f.screen()).not.toContain("Editing your message");
  f.terminalInput("\x12");
  await vi.waitFor(() => expect(f.app.chat?.history().at(-1)?.text).toBe("Retried reply"));
});

it.each(["undo", "player", "character"])(
  "clears previous-reply restoration after %s",
  async (operation) => {
    const f = fixture(["First reply", "Second reply", "Replacement", "Fresh reply"]);
    await f.character();
    await f.app.submit("First message");
    await f.app.submit("Second message");
    await f.app.submit("/regenerate");
    if (operation === "undo") await f.app.submit("/undo");
    else {
      await f.app.submit("/edit");
      f.pick(operation === "player" ? "First message" : "First reply");
      await f.app.submit("Edited text");
    }
    await f.app.submit("/prev");
    expect(f.screen()).toContain("There is no previous reply to bring back.");
  },
);
